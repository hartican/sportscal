(function attachNothingSportsPilotReadout(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PILOT_READOUT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPilotReadout(){
  "use strict";

  const SCHEMA_VERSION = "pilot-readout.v1";
  const PILOT_DURATION_DAYS = 14;
  const COHORTS = Object.freeze(["curator", "hybrid", "completist"]);
  const RECOMMENDATIONS = Object.freeze({
    COVERAGE: "coverage_and_freshness",
    PERSONALISATION: "personalisation",
    WATCHING_NOW: "watching_now_candidate",
  });
  const THRESHOLDS = Object.freeze({
    minimumPilotUsers: 5,
    minimumPulseUsers: 3,
    supportedFixtureCoveragePercent: 100,
    overdueResults: 0,
    maximumMultipleCrossCheckPercent: 20,
    maximumMissedFixturePercent: 10,
    minimumPositiveTrustPercent: 70,
    minimumTsdrPercent: 60,
    minimumMeaningfulActionRatePercent: 15,
    minimumAboutRightFeedPercent: 60,
    maximumPromptDismissalPercent: 50,
  });

  function finiteNumber(value, fallback = 0){
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function daysBetween(startedAt, endedAt){
    const start = Date.parse(startedAt || "");
    const end = Date.parse(endedAt || "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return Math.floor((end - start) / 86_400_000);
  }

  function normalizeInput(input = {}){
    const pilot = input.pilot && typeof input.pilot === "object" ? input.pilot : {};
    const readiness = input.readiness && typeof input.readiness === "object" ? input.readiness : {};
    const metrics = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
    return {
      pilot: {
        startedAt: pilot.startedAt || null,
        endedAt: pilot.endedAt || null,
        daysObserved: Number.isFinite(Number(pilot.daysObserved))
          ? Math.max(0, Math.floor(Number(pilot.daysObserved)))
          : daysBetween(pilot.startedAt, pilot.endedAt),
        distinctPilotUsers: Math.max(0, Math.floor(finiteNumber(pilot.distinctPilotUsers))),
        weeklyPulseUsers: Math.max(0, Math.floor(finiteNumber(pilot.weeklyPulseUsers))),
      },
      readiness: {
        supportedFixtureCoveragePercent: finiteNumber(readiness.supportedFixtureCoveragePercent),
        overdueResults: Math.max(0, Math.floor(finiteNumber(readiness.overdueResults))),
      },
      metrics: {
        tsdrPercent: finiteNumber(metrics.tsdrPercent),
        fullFixtureAdoptionPercent: finiteNumber(metrics.fullFixtureAdoptionPercent),
        multipleCrossCheckPercent: finiteNumber(metrics.multipleCrossCheckPercent),
        missedFixturePercent: finiteNumber(metrics.missedFixturePercent),
        aboutRightFeedPercent: finiteNumber(metrics.aboutRightFeedPercent),
        positiveTrustPercent: finiteNumber(metrics.positiveTrustPercent),
        meaningfulActionRatePercent: finiteNumber(metrics.meaningfulActionRatePercent),
        promptDismissalPercent: finiteNumber(metrics.promptDismissalPercent),
        spectacleRatingCompletionPercent: finiteNumber(metrics.spectacleRatingCompletionPercent),
      },
    };
  }

  function evaluatePilotDecision(input, thresholds = THRESHOLDS){
    const normalized = normalizeInput(input);
    const { pilot, readiness, metrics } = normalized;
    const evidenceBlockers = [];
    if (pilot.daysObserved < PILOT_DURATION_DAYS) evidenceBlockers.push(`Observe ${PILOT_DURATION_DAYS} full days.`);
    if (pilot.distinctPilotUsers < thresholds.minimumPilotUsers) evidenceBlockers.push(`Reach ${thresholds.minimumPilotUsers} exposed pilot users.`);
    if (pilot.weeklyPulseUsers < thresholds.minimumPulseUsers) evidenceBlockers.push(`Collect fixed-choice pulses from ${thresholds.minimumPulseUsers} users.`);
    if (evidenceBlockers.length){
      return {
        schemaVersion: SCHEMA_VERSION,
        status: "collecting",
        recommendation: null,
        evidenceComplete: false,
        blockers: evidenceBlockers,
        reasons: [],
        input: normalized,
      };
    }

    const coverageReasons = [];
    if (readiness.supportedFixtureCoveragePercent < thresholds.supportedFixtureCoveragePercent){
      coverageReasons.push("Supported current/next-round coverage is below 100%.");
    }
    if (readiness.overdueResults > thresholds.overdueResults){
      coverageReasons.push("One or more supported results are overdue.");
    }
    if (metrics.multipleCrossCheckPercent > thresholds.maximumMultipleCrossCheckPercent){
      coverageReasons.push("Too many users still cross-check other sports apps multiple times.");
    }
    if (metrics.missedFixturePercent > thresholds.maximumMissedFixturePercent){
      coverageReasons.push("Too many users report at least one missed fixture.");
    }
    if (metrics.positiveTrustPercent < thresholds.minimumPositiveTrustPercent){
      coverageReasons.push("Fixture-coverage confidence is below the trust threshold.");
    }
    if (coverageReasons.length){
      return {
        schemaVersion: SCHEMA_VERSION,
        status: "decision_ready",
        recommendation: RECOMMENDATIONS.COVERAGE,
        evidenceComplete: true,
        blockers: [],
        reasons: coverageReasons,
        input: normalized,
      };
    }

    const relevanceReasons = [];
    if (metrics.tsdrPercent < thresholds.minimumTsdrPercent){
      relevanceReasons.push("Trusted Sports Decision Rate is below the core-loop threshold.");
    }
    if (metrics.meaningfulActionRatePercent < thresholds.minimumMeaningfulActionRatePercent){
      relevanceReasons.push("Meaningful actions per curated-card exposure are too low.");
    }
    if (metrics.aboutRightFeedPercent < thresholds.minimumAboutRightFeedPercent){
      relevanceReasons.push("Too few pulse respondents describe feed density as about right.");
    }
    if (metrics.promptDismissalPercent > thresholds.maximumPromptDismissalPercent){
      relevanceReasons.push("Tune and rating prompt dismissal burden is too high.");
    }
    if (relevanceReasons.length){
      return {
        schemaVersion: SCHEMA_VERSION,
        status: "decision_ready",
        recommendation: RECOMMENDATIONS.PERSONALISATION,
        evidenceComplete: true,
        blockers: [],
        reasons: relevanceReasons,
        input: normalized,
      };
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      status: "decision_ready",
      recommendation: RECOMMENDATIONS.WATCHING_NOW,
      evidenceComplete: true,
      blockers: [],
      reasons: ["Coverage trust and the core sports-decision loop cleared every pilot threshold."],
      input: normalized,
    };
  }

  return Object.freeze({
    COHORTS,
    PILOT_DURATION_DAYS,
    RECOMMENDATIONS,
    SCHEMA_VERSION,
    THRESHOLDS,
    daysBetween,
    evaluatePilotDecision,
    normalizeInput,
  });
});
