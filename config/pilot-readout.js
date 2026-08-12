(function attachNothingSportsPilotReadout(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PILOT_READOUT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPilotReadout(){
  "use strict";

  const SCHEMA_VERSION = "measurement-readout.v2";
  const COHORTS = Object.freeze(["curator", "hybrid", "completist"]);

  function finiteNumber(value, fallback = 0){
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
        firstObservedAt: sample.firstObservedAt || sample.startedAt || null,
        generatedAt: sample.generatedAt || null,
        distinctUsers: Math.max(0, Math.floor(finiteNumber(sample.distinctUsers ?? sample.distinctPilotUsers))),
        weeklyPulseUsers: Math.max(0, Math.floor(finiteNumber(sample.weeklyPulseUsers))),
        surveyVersion: sample.surveyVersion || null,
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
        weeklyTsdr: Array.isArray(metrics.weeklyTsdr) ? metrics.weeklyTsdr : [],
      },
    };
  }

  function sampleDescription(sample){
    if (!sample.distinctUsers) return "No exposed users are represented yet.";
    return `${sample.distinctUsers} exposed user${sample.distinctUsers === 1 ? "" : "s"}; ${sample.weeklyPulseUsers} pulse respondent${sample.weeklyPulseUsers === 1 ? "" : "s"}.`;
  }

  function buildMeasurementReport(input){
    const normalized = normalizeInput(input);
    const operationalReady = normalized.readiness.supportedFixtureCoveragePercent === 100
      && normalized.readiness.overdueResults === 0;
    return {
      schemaVersion: SCHEMA_VERSION,
      status: "report_ready",
      operationalReady,
      recommendation: null,
      sample: {
        ...normalized.sample,
        description: sampleDescription(normalized.sample),
      },
      readiness: normalized.readiness,
      metrics: normalized.metrics,
      notes: [
        "Sample size is descriptive and does not block MVP completion.",
        "This report does not automatically recommend social or any other investment.",
        "Watch decisions count only when a genuine Watch or Remind interaction emits watch_decision; fixture checks are the currently implemented TSDR action.",
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
