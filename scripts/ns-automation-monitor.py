#!/usr/bin/env python3
"""Local NS observer state. Never dispatches jobs or changes remote services."""
import argparse
import base64
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import tomllib

DEFAULT_ROOT = Path('/Users/jackhartican/Documents/AI/Codex/ns-automation-monitor')
SEVERITY = {'info': 0, 'warning': 1, 'high': 2, 'critical': 3}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def date(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as out:
            json.dump(value, out, indent=2, ensure_ascii=False)
            out.write('\n')
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def gh(endpoint):
    result = subprocess.run(['gh', 'api', endpoint], capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise RuntimeError('GitHub read failed; inspect gh authentication or API availability')
    return json.loads(result.stdout)


def collect(root):
    """Capture current remote definitions/history, with explicit pagination limits."""
    state = read(root / 'state.json', {})
    previous = state.get('lastGithubAssessmentAt')
    since = date(previous) - dt.timedelta(hours=1) if previous else date(now()) - dt.timedelta(days=8)
    capture = {'capturedAt': now(), 'since': since.isoformat(), 'complete': True,
               'workflows': [], 'runs': [], 'automations': [], 'gaps': []}
    try:
        capture['main'] = gh('repos/hartican/sportscal/commits/main')['sha']
        for page in range(1, 11):
            rows = gh(f'repos/hartican/sportscal/actions/workflows?per_page=100&page={page}')['workflows']
            capture['workflows'].extend(rows)
            if len(rows) < 100:
                break
        else:
            capture['gaps'].append('Workflow inventory pagination cap reached')
        for workflow in capture['workflows']:
            payload = gh(f"repos/hartican/sportscal/contents/{workflow['path']}?ref=main")
            workflow['definition'] = base64.b64decode(payload['content']).decode()
        for page in range(1, 11):
            endpoint = f'repos/hartican/sportscal/actions/runs?per_page=100&page={page}&created=%3E%3D{since.date()}'
            rows = gh(endpoint)['workflow_runs']
            capture['runs'].extend(rows)
            if len(rows) < 100:
                break
        else:
            capture['gaps'].append('Run history pagination cap reached')
        # Keep the latest ordinary execution for slow jobs even after the incremental window.
        capture['latestScheduledRuns'] = {}
        for workflow in capture['workflows']:
            rows = gh(f"repos/hartican/sportscal/actions/workflows/{workflow['id']}/runs?event=schedule&per_page=1")['workflow_runs']
            capture['latestScheduledRuns'][str(workflow['id'])] = rows
    except (RuntimeError, KeyError, ValueError, subprocess.TimeoutExpired) as error:
        capture['gaps'].append(str(error))
    directory = Path(os.environ.get('CODEX_HOME', '/Users/jackhartican/.codex')) / 'automations'
    for path in sorted(directory.glob('*/automation.toml')):
        config = tomllib.loads(path.read_text())
        if any(word in str(config).lower() for word in ('sportscal', 'nothingsport', 'nothing sport', 'ns automation')):
            capture['automations'].append({key: value for key, value in config.items() if key != 'prompt'})
    capture['complete'] = not capture['gaps']
    target = root / 'runs' / capture['capturedAt'].replace(':', '-') / 'collection.json'
    write(target, capture)
    return {'path': str(target), 'complete': capture['complete'], 'workflows': len(capture['workflows']),
            'runs': len(capture['runs']), 'automations': len(capture['automations']), 'gaps': capture['gaps']}


def signal_check(signal, stamp):
    """Evaluate scheduler facts; schedule instants are supplied in UTC by the observer."""
    result = {'key': signal['key'], 'resource': signal['resource'], 'status': 'healthy',
              'summary': signal.get('summary', 'Observed checks passed'),
              'evidence': signal.get('evidence', []),
              'recoveryVerified': signal.get('recoveryVerified', False),
              'acceptancePassed': signal.get('acceptancePassed', [])}
    reason = None
    if not signal.get('accessible', True):
        result.update(status='gap', severity='warning', summary=signal.get('summary', 'Monitoring access unavailable'))
        return result
    if signal.get('intendedEnabled') is False:
        if signal.get('enabled') is True:
            reason = 'A deliberately paused job has been enabled'
        else:
            result.update(status='paused', summary='Intentionally paused; preserve this state')
            return result
    elif signal.get('enabled') is False:
        reason = 'Expected job is disabled'
    if signal.get('failure'):
        reason = signal['failure']
    elif signal.get('partialFailures'):
        reason = 'Partial processing failure: ' + ', '.join(signal['partialFailures'])
    elif signal.get('outputFresh') is False:
        reason = 'Job completed but its expected output is stale'
    elif signal.get('runningSince') and signal.get('timeoutSeconds'):
        if (date(stamp) - date(signal['runningSince'])).total_seconds() > signal['timeoutSeconds'] + 900:
            reason = 'Job exceeds its execution timeout plus fifteen minutes'
    if not reason and signal.get('expectedAt'):
        completed = signal.get('lastCompletedAt')
        if date(stamp) > date(signal['expectedAt']) + dt.timedelta(seconds=signal.get('graceSeconds', 0)):
            if not completed or date(completed) < date(signal['expectedAt']):
                reason = 'Expected execution or completion is overdue'
    if reason:
        result.update(status='issue', severity=signal.get('severity', 'high'), summary=reason,
                      activeOwner=signal.get('activeOwner'), retryEligible=signal.get('retryEligible', False))
    return result


def assess(state, observation):
    """Absence is never recovery; timestamps and repeated runs never create alert spam."""
    checks = observation.get('checks', []) + [signal_check(s, observation['checkedAt']) for s in observation.get('signals', [])]
    if len({c['key'] for c in checks}) != len(checks):
        raise ValueError('Check keys must be unique')
    if any(c['status'] not in ('issue', 'gap', 'healthy', 'paused', 'pending') for c in checks):
        raise ValueError('Invalid check status')
    incidents = state.setdefault('incidents', {})
    alerts = state.setdefault('pendingAlerts', {})
    stamp = observation['checkedAt']
    for check in checks:
        key = check['key']
        existing = incidents.get(key)
        if check['status'] in ('issue', 'gap'):
            severity = check.get('severity', 'warning')
            if severity not in SEVERITY:
                raise ValueError('Invalid severity')
            was_resolved = existing and existing.get('status') == 'resolved'
            incident = existing or {'firstSeenAt': stamp, 'attempts': [], 'requiredAcceptance': []}
            material_change = check.get('materialChange',
                                        '' if was_resolved else incident.get('materialChange', ''))
            incident.update({'key': key, 'status': check['status'], 'severity': severity,
                             'lastSeenAt': stamp, 'summary': check['summary'],
                             'resource': check['resource'], 'evidence': check.get('evidence', []),
                             'activeOwner': check.get('activeOwner'),
                             'retryEligible': check.get('retryEligible', False),
                             'materialChange': material_change})
            if not existing or was_resolved:
                incident['episode'] = incident.get('episode', 0) + 1
                incident['attempts'] = []
            incidents[key] = incident
            signature = hashlib.sha256(json.dumps([key, incident.get('episode', 1), check['status'], severity,
                                                   material_change]).encode()).hexdigest()
            if incident.get('notifiedSignature') != signature:
                alerts[key] = {'signature': signature, 'key': key, 'severity': severity,
                               'summary': check['summary'], 'status': check['status']}
        elif existing and existing['status'] != 'resolved' and check['status'] == 'healthy':
            required = set(existing.get('requiredAcceptance', []))
            passed = set(check.get('acceptancePassed', []))
            if check.get('recoveryVerified') is True and required <= passed:
                existing.update(status='resolved', resolvedAt=stamp, recoveryEvidence=check.get('evidence', []))
                signature = f"resolved:{key}:{existing.get('episode', 1)}"
                alerts[key] = {'signature': signature, 'key': key, 'severity': 'info',
                               'summary': check['summary'], 'status': 'resolved'}
    previous = state.get('lastAssessmentAt')
    if previous and (date(stamp) - date(previous)).total_seconds() > 13 * 3600:
        key = 'monitor:missed-checks'
        alerts[key] = {'key': key, 'signature': stamp, 'severity': 'warning', 'status': 'gap',
                       'summary': 'Monitoring resumed after a gap longer than thirteen hours; reconcile retained history.'}
    state['lastAssessmentAt'] = stamp
    state['coverage'] = observation.get('coverage', {})
    github = state['coverage'].get('github', {})
    if github.get('complete'):
        captured = github.get('observedAt')
        try:
            if not captured or date(captured) > date(stamp):
                raise ValueError('Invalid collection time')
        except (ValueError, TypeError, AttributeError):
            github['complete'] = False
            github.setdefault('gaps', []).append('Missing or invalid capture time; previous GitHub checkpoint retained')
        else:
            # A slow assessment must not skip runs created after collection.
            state['lastGithubAssessmentAt'] = captured
    return state


def claim(state, key, operation, kind, owner, stamp):
    incident = state.get('incidents', {}).get(key)
    if not state.get('remediationEnabled') or not incident or incident['status'] != 'issue':
        raise ValueError('Remediation disabled or no open actionable incident')
    plan = state.get('recoveryPlan')
    if plan and not plan.get('prerequisites', {}).get('featureDeliveryObserved'):
        raise ValueError('Approved earlier delivery queue must complete before recovery repairs')
    if incident.get('activeOwner'):
        raise ValueError('Existing owner must finish or hand over first')
    if state.get('activeRepair'):
        raise ValueError('Another remediation is already claimed; reconcile it before continuing')
    if kind == 'retry' and (not incident.get('retryEligible') or any(a['kind'] == 'retry' for a in incident['attempts'])):
        raise ValueError('Retry is unsafe or already consumed for this incident episode')
    action = {'incident': key, 'operation': operation, 'kind': kind, 'owner': owner, 'claimedAt': stamp}
    incident['attempts'].append(action)
    state['activeRepair'] = action
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('collect')
    assess_parser = commands.add_parser('assess')
    assess_parser.add_argument('observations', type=Path)
    commands.add_parser('ack-alerts')
    claim_parser = commands.add_parser('claim')
    claim_parser.add_argument('incident')
    claim_parser.add_argument('operation')
    claim_parser.add_argument('--kind', choices=['retry', 'repair'], required=True)
    claim_parser.add_argument('--owner', required=True)
    commands.add_parser('status')
    args = parser.parse_args()
    args.root.mkdir(parents=True, exist_ok=True)
    with (args.root / '.state.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = read(args.root / 'state.json', {'schemaVersion': 1, 'remediationEnabled': False})
        if args.command == 'collect':
            result = collect(args.root)
        elif args.command == 'assess':
            observation = read(args.observations)
            if state.get('lastAssessmentAt') and date(observation['checkedAt']) < date(state['lastAssessmentAt']):
                raise ValueError('Refusing an out-of-order assessment')
            state = assess(state, observation)
            write(args.root / 'state.json', state)
            write(args.root / 'runs' / observation['checkedAt'].replace(':', '-') / 'assessment.json', state)
            result = {'alerts': list(state.get('pendingAlerts', {}).values()), 'coverage': state.get('coverage', {})}
        elif args.command == 'ack-alerts':
            for key, alert in state.get('pendingAlerts', {}).items():
                if key in state.get('incidents', {}):
                    state['incidents'][key]['notifiedSignature'] = alert['signature']
            state['pendingAlerts'] = {}
            write(args.root / 'state.json', state)
            result = {'acknowledged': True}
        elif args.command == 'claim':
            state = claim(state, args.incident, args.operation, args.kind, args.owner, now())
            write(args.root / 'state.json', state)
            result = state['activeRepair']
        else:
            result = state
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
