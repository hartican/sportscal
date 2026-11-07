(function attachNothingSportsPilotReadout(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PILOT_READOUT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPilotReadout(){
  "use strict";

  const SCHEMA_VERSION = "measurement-readout.v3";
  const COHORTS = Object.freeze(["curator", "hybrid", "completist"]);

  function finiteNumber(value, fallback = null){
    if (value == null || !["number", "string"].includes(typeof value) || (typeof value === "string" && !value.trim())) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function count(value){
    const number = finiteNumber(value);
    return number !== null && Number.isInteger(number) && number >= 0 ? number : null;
  }

  function normalizeInput(input = {}){
    const sample = input.sample && typeof input.sample === "object"
      ? input.sample
      : input.pilot && typeof input.pilot === "object"
        ? input.pilot
        : {};
    const readiness = input.readiness && typeof input.readiness === "object" ? input.readiness : {};
    const metrics = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
    return {
      sample: {
        windowStartedAt: sample.windowStartedAt || null,
        firstObservedAt: sample.firstObservedAt || sample.startedAt || null,
        generatedAt: sample.generatedAt || null,
        distinctUsers: count(sample.distinctUsers ?? sample.distinctPilotUsers),
        weeklyPulseUsers: count(sample.weeklyPulseUsers),
        surveyVersion: sample.surveyVersion || null,
      },
      readiness: {
        verified: readiness.verified === true,
        supportedFixtureCoveragePercent: finiteNumber(readiness.supportedFixtureCoveragePercent),
        overdueResults: count(readiness.overdueResults),
      },
      metrics: {
        usefulActionUsers: count(metrics.usefulActionUsers),
        returningUsefulUsers: count(metrics.returningUsefulUsers),
        usefulReturnPercent: finiteNumber(metrics.usefulReturnPercent),
        tsdrPercent: finiteNumber(metrics.tsdrPercent),
        fullFixtureAdoptionPercent: finiteNumber(metrics.fullFixtureAdoptionPercent),
        multipleCrossCheckPercent: finiteNumber(metrics.multipleCrossCheckPercent),
        missedFixturePercent: finiteNumber(metrics.missedFixturePercent),
        aboutRightFeedPercent: finiteNumber(metrics.aboutRightFeedPercent),
        positiveTrustPercent: finiteNumber(metrics.positiveTrustPercent),
        meaningfulActionRatePercent: finiteNumber(metrics.meaningfulActionRatePercent),
        promptDismissalPercent: finiteNumber(metrics.promptDismissalPercent),
        spectacleRatingCompletionPercent: finiteNumber(metrics.spectacleRatingCompletionPercent),
        weeklyTsdr: Array.isArray(metrics.weeklyTsdr) ? metrics.weeklyTsdr : [],
      },
    };
  }

  function sampleDescription(sample){
    if (sample.distinctUsers === null) return "Exposed-user count is unavailable.";
    if (!sample.distinctUsers) return "No exposed users are represented yet.";
    return `${sample.distinctUsers} exposed user${sample.distinctUsers === 1 ? "" : "s"}; ${sample.weeklyPulseUsers === null ? "unknown" : sample.weeklyPulseUsers} pulse respondent${sample.weeklyPulseUsers === 1 ? "" : "s"}.`;
  }

  function buildMeasurementReport(input){
    const normalized = normalizeInput(input);
    const operationalReady = normalized.readiness.verified
      && normalized.readiness.supportedFixtureCoveragePercent === 100
      && normalized.readiness.overdueResults === 0;
    return {
      schemaVersion: SCHEMA_VERSION,
      status: "report_ready",
      operationalReady,
      readinessScope: "NRL/AFL current-window completeness, nine NRL finals slots, due results and snapshot freshness; not cross-sport or commercial certification.",
      weeklyTsdrScope: "All measured accounts; partial calendar weeks may appear at the observation-window edges.",
      missingMetrics: Object.entries(normalized.metrics).filter(([, value]) => value === null).map(([key]) => key),
      recommendation: null,
      sample: {
        ...normalized.sample,
        description: sampleDescription(normalized.sample),
      },
      readiness: normalized.readiness,
      metrics: normalized.metrics,
      notes: [
        "Sample size is descriptive; absent observations do not prove repeat use or commercial readiness.",
        "Useful return counts fixture_check or watch_decision on at least two distinct Sydney dates in the rolling 28-day window. This is not D7 retention or verified invited-cohort membership; owner activity may be included.",
        "This report does not automatically recommend social or any other investment.",
        "Watch decisions count only when a genuine Mark watched or Remind interaction emits watch_decision; passive opens and swipes remain separate categorical actions.",
      ],
    };
  }

  return Object.freeze({
    COHORTS,
    SCHEMA_VERSION,
    buildMeasurementReport,
    evaluatePilotDecision: buildMeasurementReport,
    normalizeInput,
    sampleDescription,
  });
});
