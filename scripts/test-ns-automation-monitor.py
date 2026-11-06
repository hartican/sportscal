#!/usr/bin/env python3
"""Offline checks only. No fixture facts, providers, schedules or remote writes."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('monitor', Path(__file__).with_name('ns-automation-monitor.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
STAMP = '2026-10-17T00:00:00+00:00'


class MonitorTests(unittest.TestCase):
    def signal(self, **values):
        return m.signal_check({'key': 'example:job', 'resource': 'example', **values}, STAMP)

    def observation(self, **values):
        return {'checkedAt': STAMP, 'checks': [{'key': 'refresh:date', 'resource': 'refresh',
                'status': 'issue', 'severity': 'high', 'summary': 'Accepted result fixture date mismatch',
                'evidence': ['GitHub #131', 'GitHub #132'], **values}]}

    def test_recorded_refresh_failures_group_by_cause(self):
        state = m.assess({}, self.observation())
        m.assess(state, self.observation(evidence=['GitHub #132', 'later evidence']))
        self.assertEqual(len(state['incidents']), 1)
        self.assertEqual(len(state['pendingAlerts']), 1)

    def test_acknowledged_unchanged_issue_is_quiet(self):
        state = m.assess({}, self.observation())
        state['incidents']['refresh:date']['notifiedSignature'] = state['pendingAlerts']['refresh:date']['signature']
        state['pendingAlerts'] = {}
        m.assess(state, self.observation(evidence=['new run, same cause']))
        self.assertFalse(state['pendingAlerts'])

    def test_severity_escalation_alerts(self):
        state = m.assess({}, self.observation())
        first = state['pendingAlerts']['refresh:date']['signature']
        m.assess(state, self.observation(severity='critical'))
        self.assertNotEqual(first, state['pendingAlerts']['refresh:date']['signature'])

    def test_absence_cannot_resolve(self):
        state = m.assess({}, self.observation())
        m.assess(state, {'checkedAt': STAMP, 'checks': []})
        self.assertEqual(state['incidents']['refresh:date']['status'], 'issue')

    def test_green_without_output_proof_cannot_resolve(self):
        state = m.assess({}, self.observation())
        m.assess(state, self.observation(status='healthy'))
        self.assertEqual(state['incidents']['refresh:date']['status'], 'issue')

    def test_imported_acceptance_cannot_be_shortened(self):
        state = m.assess({}, self.observation())
        state['incidents']['refresh:date']['requiredAcceptance'] = ['full', 'two-natural-runs']
        m.assess(state, self.observation(status='healthy', recoveryVerified=True, acceptancePassed=['full']))
        self.assertEqual(state['incidents']['refresh:date']['status'], 'issue')
        m.assess(state, self.observation(status='healthy', recoveryVerified=True,
                                       acceptancePassed=['full', 'two-natural-runs']))
        self.assertEqual(state['incidents']['refresh:date']['status'], 'resolved')

    def test_missed_execution(self):
        self.assertEqual(self.signal(expectedAt='2026-10-16T19:00:00Z', graceSeconds=14400)['status'], 'issue')

    def test_delay_grace(self):
        self.assertEqual(self.signal(expectedAt='2026-10-16T23:00:00Z', graceSeconds=14400)['status'], 'healthy')

    def test_stale_output_despite_green_run(self):
        self.assertEqual(self.signal(outputFresh=False)['status'], 'issue')

    def test_partial_http_is_failure(self):
        self.assertEqual(self.signal(partialFailures=['source_refresh_partial'])['status'], 'issue')

    def test_inaccessible_is_gap(self):
        self.assertEqual(self.signal(accessible=False)['status'], 'gap')

    def test_paused_is_not_failure(self):
        self.assertEqual(self.signal(intendedEnabled=False, enabled=False)['status'], 'paused')

    def test_unexpected_disable(self):
        self.assertEqual(self.signal(intendedEnabled=True, enabled=False)['status'], 'issue')

    def test_stuck_job(self):
        self.assertEqual(self.signal(runningSince='2026-10-16T20:00:00Z', timeoutSeconds=5400)['status'], 'issue')

    def test_no_change_refresh_can_be_healthy(self):
        self.assertEqual(self.signal(outputFresh=True, recoveryVerified=True)['status'], 'healthy')

    def test_retry_survives_restart(self):
        state = m.assess({'remediationEnabled': True}, self.observation(retryEligible=True))
        state = m.claim(state, 'refresh:date', 'same-operation', 'retry', 'test', STAMP)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'state.json'
            m.write(path, state)
            state = m.read(path)
        state['activeRepair'] = None
        with self.assertRaises(ValueError):
            m.claim(state, 'refresh:date', 'different-command', 'retry', 'test', STAMP)

    def test_concurrent_release_and_existing_owner_are_blocked(self):
        state = m.assess({'remediationEnabled': True}, self.observation(activeOwner='publisher'))
        with self.assertRaises(ValueError):
            m.claim(state, 'refresh:date', 'repair', 'repair', 'test', STAMP)
        state['incidents']['refresh:date']['activeOwner'] = None
        state['activeRepair'] = {'owner': 'another-run'}
        with self.assertRaises(ValueError):
            m.claim(state, 'refresh:date', 'repair', 'repair', 'test', STAMP)

    def test_initial_read_only_mode(self):
        state = m.assess({}, self.observation(retryEligible=True))
        with self.assertRaises(ValueError):
            m.claim(state, 'refresh:date', 'retry', 'retry', 'test', STAMP)

    def test_failed_github_observation_does_not_advance_watermark(self):
        state = m.assess({}, {'checkedAt': STAMP, 'checks': [], 'coverage': {'github': {'complete': False}}})
        self.assertNotIn('lastGithubAssessmentAt', state)

    def test_cross_midnight_assessment_uses_capture_checkpoint(self):
        captured = '2026-10-18T23:50:00+00:00'
        finished = '2026-10-19T01:30:00+00:00'
        state = m.assess({}, {'checkedAt': finished, 'checks': [],
                             'coverage': {'github': {'complete': True, 'observedAt': captured}}})
        self.assertEqual(state['lastGithubAssessmentAt'], captured)
        # collect() sends a date-granularity filter after its one-hour overlap.
        cutoff = m.date(state['lastGithubAssessmentAt']) - m.dt.timedelta(hours=1)
        self.assertEqual(str(cutoff.date()), '2026-10-18')

    def test_missing_capture_time_retains_previous_checkpoint(self):
        previous = '2026-10-16T20:00:00+00:00'
        state = m.assess({'lastGithubAssessmentAt': previous},
                         {'checkedAt': STAMP, 'checks': [], 'coverage': {'github': {'complete': True}}})
        self.assertEqual(state['lastGithubAssessmentAt'], previous)
        self.assertFalse(state['coverage']['github']['complete'])

    def test_future_capture_time_cannot_advance_checkpoint(self):
        state = m.assess({}, {'checkedAt': STAMP, 'checks': [],
                             'coverage': {'github': {'complete': True, 'observedAt': '2026-10-18T00:00:00Z'}}})
        self.assertNotIn('lastGithubAssessmentAt', state)
        self.assertFalse(state['coverage']['github']['complete'])

    def test_recurrence_after_verified_recovery_is_new_episode(self):
        state = m.assess({}, self.observation())
        state['incidents']['refresh:date']['attempts'] = [{'kind': 'retry'}]
        m.assess(state, self.observation(status='healthy', recoveryVerified=True))
        m.assess(state, self.observation())
        self.assertEqual(state['incidents']['refresh:date']['episode'], 2)
        self.assertFalse(state['incidents']['refresh:date']['attempts'])

    def test_material_change_survives_an_omitted_repeat_annotation(self):
        state = m.assess({}, self.observation(materialChange='current-due-results-confirmed'))
        alert = state['pendingAlerts']['refresh:date']
        state['incidents']['refresh:date']['notifiedSignature'] = alert['signature']
        state['pendingAlerts'] = {}
        m.assess(state, self.observation(evidence=['same cause, later receipt']))
        self.assertFalse(state['pendingAlerts'])

    def test_material_change_is_persisted_across_restart(self):
        state = m.assess({}, self.observation(materialChange='current-due-results-confirmed'))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'state.json'
            m.write(path, state)
            state = m.read(path)
        self.assertEqual(state['incidents']['refresh:date']['materialChange'],
                         'current-due-results-confirmed')

    def test_approved_queue_prevents_early_repair_claim(self):
        state = m.assess({'remediationEnabled': True, 'recoveryPlan': {
            'prerequisites': {'featureDeliveryObserved': False}}}, self.observation())
        with self.assertRaises(ValueError):
            m.claim(state, 'refresh:date', 'repair', 'repair', 'test', STAMP)
        state['recoveryPlan']['prerequisites']['featureDeliveryObserved'] = True
        self.assertEqual(m.claim(state, 'refresh:date', 'repair', 'repair', 'test', STAMP)
                         ['activeRepair']['operation'], 'repair')

    def test_reminder_repair_requires_phone_and_backend_receipts(self):
        state = m.assess({}, self.observation())
        required = ['scheduler-natural-execution', 'application-completion',
                    'physical-device-delivery']
        state['incidents']['refresh:date']['requiredAcceptance'] = required
        m.assess(state, self.observation(status='healthy', recoveryVerified=True,
                                       acceptancePassed=required[:2]))
        self.assertEqual(state['incidents']['refresh:date']['status'], 'issue')
        self.assertIn('refresh:date', state['pendingAlerts'])
        m.assess(state, self.observation(status='healthy', recoveryVerified=True,
                                       acceptancePassed=required))
        self.assertEqual(state['incidents']['refresh:date']['status'], 'resolved')


if __name__ == '__main__':
    unittest.main()
