(function attachNothingSportsDiscoveryMeasurement(root, factory){
  const feedControls = root.NOTHINGSPORTS_FEED_CONTROLS
    || (typeof require === "function" ? require("./feed-controls.js") : null);
  const broadcasterDiscovery = root.NOTHINGSPORTS_BROADCASTER_DISCOVERY
    || (typeof require === "function" ? require("./broadcaster-discovery.js") : null);
  const api = factory(feedControls, broadcasterDiscovery);
  root.NOTHINGSPORTS_DISCOVERY_MEASUREMENT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildDiscoveryMeasurement(feedControls, broadcasterDiscovery){
  "use strict";

  const SCHEMA_VERSION = "discovery-measurement.v1";
  const MIN_DISCOVERY_EXPOSURES_FOR_REVIEW = 20;
  const REQUIRED_BEHAVIOURAL_FIELDS = Object.freeze([
    "discovery_exposures",
    "discovery_opens",
    "discovery_saves",
    "discovery_reminders",
    "discovery_watch_throughs",
    "discovery_negative_actions",
    "cold_start_exposures",
    "cold_start_distinct_sports",
  ]);

  function finiteNumber(value, fallback = 0){
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function percent(numerator, denominator){
    if (!denominator) return null;
    return Math.round((10000 * numerator) / denominator) / 100;
  }

  function jsonArray(value){
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try{
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    }catch{
      return [];
    }
  }

  function readoutRows(payload){
    if (Array.isArray(payload)) return payload;
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  function overallRow(payload){
    const rows = readoutRows(payload);
    return rows.find(row => row?.cohort === "all")
      || rows.find(row => row?.cohort === "overall")
      || rows[0]
      || null;
  }

  function eventIds(feed){
    return new Set((Array.isArray(feed?.events) ? feed.events : [])
      .flatMap(event => [event?.eventId, event?.id])
      .filter(Boolean)
      .map(String));
  }

  function missingMarqueeMetric(policy, feed){
    const expected = Array.isArray(policy?.events) ? policy.events : [];
    const publishedIds = eventIds(feed);
    const missingIds = expected
      .map(event => String(event?.id || ""))
      .filter(id => id && !publishedIds.has(id));
    return {
      status: expected.length ? "measured" : "not_configured",
      expectedCount: expected.length,
      presentCount: expected.length - missingIds.length,
      missingCount: missingIds.length,
      missingEventIds: missingIds,
      ratePercent: percent(missingIds.length, expected.length),
    };
  }

  function normalizeHistory(history, current, observedAt){
    const snapshots = Array.isArray(history?.snapshots) ? history.snapshots : [];
    const normalized = snapshots.map(snapshot => ({
      observedAt: snapshot.observedAt || null,
      expectedCount: Math.max(0, Math.floor(finiteNumber(snapshot.expectedCount))),
      missingCount: Math.max(0, Math.floor(finiteNumber(snapshot.missingCount))),
      ratePercent: snapshot.ratePercent === null || snapshot.ratePercent === undefined
        ? percent(finiteNumber(snapshot.missingCount), finiteNumber(snapshot.expectedCount))
        : finiteNumber(snapshot.ratePercent),
    })).filter(snapshot => snapshot.observedAt && snapshot.ratePercent !== null);
    if (current.status === "measured" && observedAt){
      const currentSnapshot = {
        observedAt,
        expectedCount: current.expectedCount,
        missingCount: current.missingCount,
        ratePercent: current.ratePercent,
      };
      const existingIndex = normalized.findIndex(snapshot => snapshot.observedAt === observedAt);
      if (existingIndex >= 0) normalized[existingIndex] = currentSnapshot;
      else normalized.push(currentSnapshot);
    }
    return normalized.sort((left, right) => String(left.observedAt).localeCompare(String(right.observedAt)));
  }

  function marqueeTrend(snapshots){
    if (snapshots.length < 2){
      return {
        status: "insufficient_history",
        direction: null,
        changePercentagePoints: null,
        observationCount: snapshots.length,
        note: "At least two independently generated coverage snapshots are required before claiming a trend.",
      };
    }
    const first = snapshots[0];
    const latest = snapshots.at(-1);
    const change = Math.round((latest.ratePercent - first.ratePercent) * 100) / 100;
    return {
      status: "measured",
      direction: change < 0 ? "down" : change > 0 ? "up" : "flat",
      changePercentagePoints: change,
      observationCount: snapshots.length,
      firstObservedAt: first.observedAt,
      latestObservedAt: latest.observedAt,
    };
  }

  function candidatePublishMetric(coverageReport, approvedCoverage){
    const candidateCount = Array.isArray(coverageReport?.candidates) ? coverageReport.candidates.length : 0;
    const summary = approvedCoverage?.summary || {};
    const reviewedCount = Math.max(0, Math.floor(finiteNumber(summary.decisionCount)));
    const publishCount = Math.max(0, Math.floor(finiteNumber(summary.publish)));
    return {
      status: reviewedCount ? "measured" : "insufficient_reviewed_candidates",
      candidateCount,
      reviewedCount,
      publishCount,
      pendingCount: Math.max(0, Math.floor(finiteNumber(summary.pending, candidateCount - reviewedCount))),
      ratePercent: percent(publishCount, reviewedCount),
      denominator: "editorially reviewed candidates",
    };
  }

  function behaviouralMetric(payload){
    const row = overallRow(payload);
    const declaredStatus = row?.instrumentation_status || null;
    const missingFields = row
      ? REQUIRED_BEHAVIOURAL_FIELDS.filter(field => !Object.prototype.hasOwnProperty.call(row, field))
      : REQUIRED_BEHAVIOURAL_FIELDS.slice();
    const contractReady = Boolean(row) && !missingFields.length && declaredStatus !== "pending_approval";
    const exposures = Math.max(0, Math.floor(finiteNumber(row?.discovery_exposures)));
    const opens = Math.max(0, Math.floor(finiteNumber(row?.discovery_opens)));
    const saves = Math.max(0, Math.floor(finiteNumber(row?.discovery_saves)));
    const reminders = Math.max(0, Math.floor(finiteNumber(row?.discovery_reminders)));
    const watchThroughs = Math.max(0, Math.floor(finiteNumber(row?.discovery_watch_throughs)));
    const negativeActions = Math.max(0, Math.floor(finiteNumber(row?.discovery_negative_actions)));
    const coldStartExposures = Math.max(0, Math.floor(finiteNumber(row?.cold_start_exposures)));
    const coldStartDistinctSports = Math.max(0, Math.floor(finiteNumber(row?.cold_start_distinct_sports)));
    const status = !contractReady
      ? "instrumentation_pending"
      : exposures < MIN_DISCOVERY_EXPOSURES_FOR_REVIEW
        ? "insufficient_data"
        : "measured";
    const positiveActions = opens + saves + reminders + watchThroughs;
    return {
      status,
      instrumentationStatus: declaredStatus || (row ? "partial" : "not_available"),
      missingAggregateFields: missingFields,
      minimumDiscoveryExposuresForReview: MIN_DISCOVERY_EXPOSURES_FOR_REVIEW,
      discovery: {
        exposures,
        opens,
        saves,
        reminders,
        watchThroughs,
        negativeActions,
        openRatePercent: percent(opens, exposures),
        saveRatePercent: percent(saves, exposures),
        reminderRatePercent: percent(reminders, exposures),
        watchThroughRatePercent: percent(watchThroughs, exposures),
        positiveActionRatePercent: percent(positiveActions, exposures),
        negativeActionRatePercent: percent(negativeActions, exposures),
      },
      negativeFeedback: {
        status: contractReady ? (exposures ? "measured" : "insufficient_data") : "not_available",
        bySport: jsonArray(row?.negative_feedback_by_sport),
        byCompetition: jsonArray(row?.negative_feedback_by_competition),
        note: contractReady
          ? "Discovery negatives combine left swipes with explicit unfollows; rates use discovery opportunity exposures in the same sport or competition as the denominator."
          : "The approved categorical action aggregate is not available in this export.",
      },
      satisfactionProxy: {
        status,
        saves,
        reminders,
        watchThroughs,
        totalActions: saves + reminders + watchThroughs,
        ratePercent: percent(saves + reminders + watchThroughs, exposures),
      },
      coldStartDiversity: {
        status: contractReady && coldStartExposures ? "measured" : status,
        exposureCount: coldStartExposures,
        distinctSportCount: coldStartDistinctSports,
        ratePercent: percent(coldStartDistinctSports, Math.min(coldStartExposures, 10)),
        definition: "Distinct sports represented within the first ten cold-start opportunities.",
      },
    };
  }

  function tuningState(behaviour, candidatePublish){
    const defaults = feedControls?.DEFAULT_CONTROLS || {};
    const mix = feedControls?.MIX_TARGETS?.[defaults.froth] || null;
    const current = {
      frothDefault: defaults.froth || "balanced",
      balancedMix: mix,
      firstImpressionDepth: feedControls?.FIRST_IMPRESSION_DEPTH ?? 10,
      firstImpressionDiscoveryCap: feedControls?.FIRST_IMPRESSION_DISCOVERY_CAP ?? 1,
      coverageMatchConfidenceThreshold: broadcasterDiscovery?.MATCH_CONFIDENCE_THRESHOLD ?? 0.65,
      coverageAutoPublishConfidenceThreshold: broadcasterDiscovery?.AUTO_PUBLISH_CONFIDENCE_THRESHOLD ?? 0.92,
      coverageAmbiguityMargin: broadcasterDiscovery?.AMBIGUITY_CONFIDENCE_MARGIN ?? 0.08,
    };
    let discoveryDecision = "hold";
    let discoveryRationale = "The discovery action sample is not sufficient to justify changing the balanced mix or first-impression cap.";
    if (behaviour.status === "measured"){
      const positive = finiteNumber(behaviour.discovery.positiveActionRatePercent);
      const negative = finiteNumber(behaviour.discovery.negativeActionRatePercent);
      const satisfaction = finiteNumber(behaviour.satisfactionProxy.ratePercent);
      if (negative > positive){
        discoveryDecision = "review_tightening";
        discoveryRationale = "Observed discovery negatives exceed positive actions; review a lower discovery share before changing production defaults.";
      } else if (satisfaction > 0 && positive >= negative * 2){
        discoveryDecision = "review_broadening";
        discoveryRationale = "Observed discovery actions materially exceed negatives and include a save, reminder or watch-through; review a bounded expansion experiment.";
      } else {
        discoveryRationale = "The observed balance does not support either tightening or broadening yet.";
      }
    }
    const coverageDecision = candidatePublish.reviewedCount
      ? "review_against_labelled_outcomes"
      : "hold";
    return {
      policy: "recommend_only_never_auto_apply",
      autoApplied: false,
      current,
      recommendations: [
        {
          area: "froth_default",
          decision: discoveryDecision,
          evidenceStatus: behaviour.status,
          rationale: discoveryRationale,
        },
        {
          area: "first_impression_discovery_cap",
          decision: discoveryDecision,
          evidenceStatus: behaviour.status,
          rationale: `Keep the current cap of ${current.firstImpressionDiscoveryCap} in the first ${current.firstImpressionDepth} until discovery engagement and negative feedback are both measurable.`,
        },
        {
          area: "coverage_confidence_thresholds",
          decision: coverageDecision,
          evidenceStatus: candidatePublish.status,
          rationale: candidatePublish.reviewedCount
            ? "Compare confidence against reviewed publish, review and ignore outcomes before proposing a threshold change."
            : "No reviewed coverage decisions exist, so changing match or publication thresholds would be instinct rather than evidence.",
        },
      ],
    };
  }

  function acceptanceState(missingTrend, behaviour){
    const positive = finiteNumber(behaviour?.discovery?.positiveActionRatePercent, -1);
    const negative = finiteNumber(behaviour?.discovery?.negativeActionRatePercent, -1);
    return {
      missingMarqueeRateTrendingDown: missingTrend.status === "measured" && missingTrend.direction === "down"
        ? "supported"
        : "unproven",
      positiveDiscoveryWithoutDisproportionateNegatives: behaviour.status === "measured" && positive >= 0 && negative >= 0 && positive > negative
        ? "supported"
        : "unproven",
      balancedFrothBroaderWithoutNoise: "requires_pilot_review",
    };
  }

  function buildReport({
    feed,
    marqueePolicy,
    coverageReport,
    approvedCoverage,
    behaviouralReadout,
    coverageHistory,
    generatedAt = null,
  } = {}){
    const missingMarquee = missingMarqueeMetric(marqueePolicy, feed);
    const observedAt = coverageReport?.generatedAt || null;
    const snapshots = normalizeHistory(coverageHistory, missingMarquee, observedAt);
    const trend = marqueeTrend(snapshots);
    const candidatePublish = candidatePublishMetric(coverageReport, approvedCoverage);
    const behaviour = behaviouralMetric(behaviouralReadout);
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: generatedAt || observedAt,
      evidenceState: behaviour.status === "measured" && trend.status === "measured"
        ? "decision_ready"
        : "partial_evidence",
      coverage: {
        missingMarquee,
        missingMarqueeTrend: trend,
        snapshots,
        candidatePublish,
        commercialSourceOptions: Array.isArray(coverageReport?.commercialSourceOptions)
          ? coverageReport.commercialSourceOptions
          : [],
      },
      behaviour,
      tuning: tuningState(behaviour, candidatePublish),
      acceptance: acceptanceState(trend, behaviour),
      privacy: {
        readPath: "operator_only_aggregate_export",
        clientAccess: "none",
        rawUserEventsStoredInRepository: false,
        note: "The dashboard consumes aggregate rows only. It does not weaken product_events RLS or add browser read access.",
      },
      notes: [
        "A zero current missing-marquee rate is a baseline, not proof of a downward trend.",
        "No tuning recommendation is applied automatically.",
        "Behavioural rates use only approved categorical action events and are never inferred from ratings or passive fixture checks.",
      ],
    };
  }

  return Object.freeze({
    MIN_DISCOVERY_EXPOSURES_FOR_REVIEW,
    REQUIRED_BEHAVIOURAL_FIELDS,
    SCHEMA_VERSION,
    behaviouralMetric,
    buildReport,
    candidatePublishMetric,
    marqueeTrend,
    missingMarqueeMetric,
    overallRow,
    percent,
    tuningState,
  });
});
