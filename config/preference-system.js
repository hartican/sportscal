(function attachNothingSportsPreferenceSystem(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PREFERENCE_SYSTEM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPreferenceSystem(){
  "use strict";

  const SCHEMA_VERSION = "preference-graph.v4";
  const MAX_LEARNING_SIGNALS = 120;
  const MAX_CALIBRATION_SKIPS = 10;
  const MAX_TUNING_DOMAINS = 24;
  const MEANINGFUL_TUNING_INTERACTIONS = 8;
  const MEANINGFUL_TUNING_DOMAINS = 2;
  const MEANINGFUL_TUNING_SESSIONS = 2;
  const POST_TUNING_DISLIKE_GAP = 100;
  const POST_TUNING_DAY_GAP = 30;
  const LEARNING_TARGET_TYPES = Object.freeze(["sport", "competition", "team", "player", "event", "event_family"]);
  const LEARNING_SOURCES = Object.freeze(["calibration", "feed", "tune"]);
  const DEFAULT_VIEWING_WINDOW = Object.freeze({
    startHourLocal: 7,
    endHourLocal: 22,
  });

  const templates = [
    {
      id: "template:froth",
      slug: "froth",
      name: "Froth",
      description: "More fixtures, stronger follow weighting, and high must-watch sensitivity.",
      rules: {
        includeAllFixturesDefault: true,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: true,
        narrativeIntensityDefault: 5,
        mustWatchSensitivityDefault: "high",
        reminderDefault: "allFollowed",
      },
    },
    {
      id: "template:like",
      slug: "like",
      name: "Like",
      description: "Important events and followed teams, with balanced follow weighting.",
      rules: {
        includeAllFixturesDefault: false,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: true,
        narrativeIntensityDefault: 3,
        mustWatchSensitivityDefault: "medium",
        reminderDefault: "importantOnly",
      },
    },
    {
      id: "template:casual",
      slug: "casual",
      name: "Casual",
      description: "Major events only, restrained context, and fewer reminders.",
      rules: {
        includeAllFixturesDefault: false,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: false,
        narrativeIntensityDefault: 2,
        mustWatchSensitivityDefault: "low",
        reminderDefault: "importantOnly",
      },
    },
    {
      id: "template:custom",
      slug: "custom",
      name: "Custom",
      description: "Start from balanced defaults, then control the detailed hierarchy directly.",
      rules: {
        includeAllFixturesDefault: false,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: true,
        narrativeIntensityDefault: 3,
        mustWatchSensitivityDefault: "medium",
        reminderDefault: "importantOnly",
      },
    },
  ].map(template => Object.freeze({
    ...template,
    rules: Object.freeze({ ...template.rules }),
  }));

  const templateById = Object.freeze(Object.fromEntries(templates.map(template => [template.id, template])));
  const templateBySlug = Object.freeze(Object.fromEntries(templates.map(template => [template.slug, template])));

  function uniqueStrings(values){
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(value => typeof value === "string" && value)));
  }

  function templateFor(value){
    return templateById[value] || templateBySlug[value] || templateById["template:like"];
  }

  function narrativeVisibilityFor(template){
    if (template.rules.narrativeIntensityDefault <= 1) return "off";
    if (template.rules.narrativeIntensityDefault >= 4) return "allEligible";
    return "importantOnly";
  }

  function expandTemplate(profileId, sportDomainId, templateId, overrides = {}){
    const template = templateFor(templateId);
    const { showLadder: _obsoleteShowLadder, ...cleanOverrides } = overrides || {};
    return {
      profileId,
      sportDomainId,
      enabled: overrides.enabled !== false,
      templateId: template.id,
      includeAllFixtures: template.rules.includeAllFixturesDefault,
      includeMajorEvents: template.rules.includeMajorEventsDefault,
      includeFollowedTeams: template.rules.includeFollowedTeamsDefault,
      narrativeVisibility: narrativeVisibilityFor(template),
      narrativeIntensity: template.rules.narrativeIntensityDefault,
      mustWatchSensitivity: template.rules.mustWatchSensitivityDefault,
      reminderDefault: template.rules.reminderDefault,
      scopedCompetitionIds: uniqueStrings(overrides.scopedCompetitionIds),
      ...cleanOverrides,
      profileId,
      sportDomainId,
      templateId: template.id,
    };
  }

  function normalizeHour(value){
    if (value === "" || value === null || value === undefined) return undefined;
    const hour = Number(value);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : undefined;
  }

  function normalizeLeadMinutes(values){
    const valid = (Array.isArray(values) ? values : [values])
      .map(Number)
      .filter(value => Number.isInteger(value) && value >= 0 && value <= 10080);
    return Array.from(new Set(valid)).sort((a, b) => a - b);
  }

  function normalizeTimestamp(value, fallback = null){
    if (value === null) return null;
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }

  function emptyLearning(){
    return {
      signals: [],
      dislikeCount: 0,
      tuningPromptCount: 0,
      lastTunePromptDislikeCount: null,
      calibrationSkippedTargetIds: [],
      calibrationCompletedAt: null,
      calibrationSkippedAt: null,
      tuningInteractionCount: 0,
      tuningDomainIds: [],
      completedTuningSessionCount: 0,
      lastTuningSessionCompletedAt: null,
      meaningfulTuningAt: null,
      meaningfulTuningDislikeCount: null,
    };
  }

  function normalizeLearningSignal(signal){
    if (!signal || typeof signal !== "object") return null;
    const targetType = LEARNING_TARGET_TYPES.includes(signal.targetType) ? signal.targetType : null;
    const targetId = typeof signal.targetId === "string" ? signal.targetId.trim().slice(0, 160) : "";
    const value = Number(signal.value) === 1 ? 1 : Number(signal.value) === -1 ? -1 : null;
    const source = LEARNING_SOURCES.includes(signal.source) ? signal.source : null;
    const recordedAt = normalizeTimestamp(signal.recordedAt);
    if (!targetType || !targetId || value === null || !source || !recordedAt) return null;
    return { targetType, targetId, value, source, recordedAt };
  }

  function normalizeLearning(input){
    const saved = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const byTarget = new Map();
    (Array.isArray(saved.signals) ? saved.signals : []).forEach(candidate => {
      const signal = normalizeLearningSignal(candidate);
      if (!signal) return;
      const key = `${signal.targetType}:${signal.targetId}`;
      const previous = byTarget.get(key);
      if (!previous || previous.recordedAt <= signal.recordedAt) byTarget.set(key, signal);
    });
    const signals = Array.from(byTarget.values())
      .sort((first, second) => first.recordedAt.localeCompare(second.recordedAt))
      .slice(-MAX_LEARNING_SIGNALS);
    return {
      signals,
      dislikeCount: Math.max(0, Math.floor(Number(saved.dislikeCount) || 0)),
      tuningPromptCount: Math.max(0, Math.floor(Number(saved.tuningPromptCount) || 0)),
      lastTunePromptDislikeCount: saved.lastTunePromptDislikeCount === null || saved.lastTunePromptDislikeCount === undefined
        ? null
        : Math.max(0, Math.floor(Number(saved.lastTunePromptDislikeCount) || 0)),
      calibrationSkippedTargetIds: uniqueStrings(saved.calibrationSkippedTargetIds).slice(-MAX_CALIBRATION_SKIPS),
      calibrationCompletedAt: normalizeTimestamp(saved.calibrationCompletedAt),
      calibrationSkippedAt: normalizeTimestamp(saved.calibrationSkippedAt),
      tuningInteractionCount: Math.max(0, Math.floor(Number(saved.tuningInteractionCount) || 0)),
      tuningDomainIds: uniqueStrings(saved.tuningDomainIds).slice(-MAX_TUNING_DOMAINS),
      completedTuningSessionCount: Math.max(0, Math.floor(Number(saved.completedTuningSessionCount) || 0)),
      lastTuningSessionCompletedAt: normalizeTimestamp(saved.lastTuningSessionCompletedAt),
      meaningfulTuningAt: normalizeTimestamp(saved.meaningfulTuningAt),
      meaningfulTuningDislikeCount: saved.meaningfulTuningDislikeCount === null || saved.meaningfulTuningDislikeCount === undefined
        ? null
        : Math.max(0, Math.floor(Number(saved.meaningfulTuningDislikeCount) || 0)),
    };
  }

  function buildViewingPreference(profileId, broadcasterIds, saved = {}, legacySelectedBroadcasterIds){
    const available = uniqueStrings(broadcasterIds);
    const known = uniqueStrings(saved.knownBroadcasterIds);
    const hasVersionedSelection = Array.isArray(saved.selectedBroadcasterIds) || Array.isArray(saved.excludedBroadcasterIds);
    const legacySelection = Array.isArray(legacySelectedBroadcasterIds) ? uniqueStrings(legacySelectedBroadcasterIds) : null;
    let excluded;

    if (hasVersionedSelection){
      const explicitExcluded = uniqueStrings(saved.excludedBroadcasterIds);
      const priorSelected = uniqueStrings(saved.selectedBroadcasterIds);
      const inferredExcluded = known.filter(id => !priorSelected.includes(id));
      excluded = uniqueStrings([...explicitExcluded, ...inferredExcluded]).filter(id => available.includes(id));
    } else if (legacySelection){
      excluded = available.filter(id => !legacySelection.includes(id));
    } else {
      excluded = [];
    }

    const selectedBroadcasterIds = available.filter(id => !excluded.includes(id));
    const savedStartHour = normalizeHour(saved.startHourLocal);
    const savedEndHour = normalizeHour(saved.endHourLocal);
    return {
      ...saved,
      profileId,
      selectedBroadcasterIds,
      excludedBroadcasterIds: excluded,
      knownBroadcasterIds: available,
      viewingWindowEnabled: typeof saved.viewingWindowEnabled === "boolean" ? saved.viewingWindowEnabled : true,
      startHourLocal: savedStartHour ?? DEFAULT_VIEWING_WINDOW.startHourLocal,
      endHourLocal: savedEndHour ?? DEFAULT_VIEWING_WINDOW.endHourLocal,
      allowLateNightOverrides: saved.allowLateNightOverrides !== false,
      calendarSyncEnabled: saved.calendarSyncEnabled !== false,
      browserAlertsEnabled: Boolean(saved.browserAlertsEnabled),
      reminderLeadMinutes: normalizeLeadMinutes(saved.reminderLeadMinutes?.length ? saved.reminderLeadMinutes : [60]),
    };
  }

  function createPreferenceGraph({
    profileId,
    domainIds = [],
    templateByDomain = {},
    broadcasterIds = [],
    legacySelectedBroadcasterIds,
  } = {}){
    const safeProfileId = typeof profileId === "string" && profileId ? profileId : "profile:local";
    const enabledDomains = uniqueStrings(domainIds);
    return {
      schemaVersion: SCHEMA_VERSION,
      profileId: safeProfileId,
      updatedAt: new Date().toISOString(),
      domainPreferences: enabledDomains.map(domainId => expandTemplate(safeProfileId, domainId, templateByDomain[domainId] || "template:like")),
      competitionPreferences: [],
      entityFollows: [],
      viewing: buildViewingPreference(safeProfileId, broadcasterIds, {}, legacySelectedBroadcasterIds),
      learning: emptyLearning(),
    };
  }

  function migratePreferenceGraph(raw, {
    profileId,
    domainIds = [],
    broadcasterIds = [],
    legacySelectedBroadcasterIds,
  } = {}){
    if (!raw || typeof raw !== "object"){
      return createPreferenceGraph({ profileId, domainIds, broadcasterIds, legacySelectedBroadcasterIds });
    }

    const safeProfileId = typeof profileId === "string" && profileId ? profileId : raw.profileId || "profile:local";
    const selectedDomains = uniqueStrings(domainIds);
    const existingDomains = Array.isArray(raw.domainPreferences) ? raw.domainPreferences : [];
    const existingById = new Map(existingDomains.filter(Boolean).map(preference => [preference.sportDomainId, preference]));
    const allDomainIds = uniqueStrings([...existingById.keys(), ...selectedDomains]);
    const domainPreferences = allDomainIds.map(domainId => {
      const existing = existingById.get(domainId);
      const enabled = selectedDomains.includes(domainId);
      return expandTemplate(safeProfileId, domainId, existing?.templateId || "template:like", {
        ...(existing || {}),
        enabled,
      });
    });

    const competitionPreferences = (Array.isArray(raw.competitionPreferences) ? raw.competitionPreferences : [])
      .filter(preference => preference && typeof preference.competitionId === "string")
      .map(preference => {
        const { showLadder: _obsoleteShowLadder, ...cleanPreference } = preference;
        return { ...cleanPreference, profileId: safeProfileId };
      });
    const entityFollows = (Array.isArray(raw.entityFollows) ? raw.entityFollows : [])
      .filter(preference => preference && typeof preference.participantId === "string" && ["follow", "priority", "mute"].includes(preference.followLevel))
      .map(preference => ({ ...preference, profileId: safeProfileId }));

    return {
      ...raw,
      schemaVersion: SCHEMA_VERSION,
      profileId: safeProfileId,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      domainPreferences,
      competitionPreferences,
      entityFollows,
      viewing: buildViewingPreference(safeProfileId, broadcasterIds, raw.viewing || {}, legacySelectedBroadcasterIds),
      learning: normalizeLearning(raw.learning),
    };
  }

  function cloneGraph(graph){
    return JSON.parse(JSON.stringify(graph));
  }

  function touch(graph){
    graph.schemaVersion = SCHEMA_VERSION;
    graph.updatedAt = new Date().toISOString();
    return graph;
  }

  function upsertDomain(graph, domainId, templateId, overrides = {}){
    const next = cloneGraph(graph);
    const index = next.domainPreferences.findIndex(preference => preference.sportDomainId === domainId);
    const previous = index >= 0 ? next.domainPreferences[index] : {};
    const preference = expandTemplate(next.profileId, domainId, templateId || previous.templateId, {
      ...previous,
      ...overrides,
      enabled: overrides.enabled !== false,
    });
    if (index >= 0) next.domainPreferences[index] = preference;
    else next.domainPreferences.push(preference);
    return touch(next);
  }

  function quickAddDomain(graph, domainId, templateId = "template:like"){
    const next = cloneGraph(graph);
    const index = next.domainPreferences.findIndex(preference => preference.sportDomainId === domainId);
    const previous = index >= 0 ? next.domainPreferences[index] : null;
    const preference = expandTemplate(next.profileId, domainId, templateId, {
      enabled: true,
      scopedCompetitionIds: previous?.scopedCompetitionIds || [],
    });
    if (index >= 0) next.domainPreferences[index] = preference;
    else next.domainPreferences.push(preference);
    return touch(next);
  }

  function customiseDomain(graph, domainId){
    return upsertDomain(graph, domainId, "template:custom", { enabled: true });
  }

  function disableDomain(graph, domainId){
    const next = cloneGraph(graph);
    const preference = next.domainPreferences.find(item => item.sportDomainId === domainId);
    if (preference) preference.enabled = false;
    return touch(next);
  }

  function applyDomainOverride(graph, domainId, patch){
    const next = upsertDomain(graph, domainId, "template:custom", patch || {});
    const preference = next.domainPreferences.find(item => item.sportDomainId === domainId);
    if (preference) preference.templateId = "template:custom";
    return touch(next);
  }

  function setCoverageMode(graph, domainId, mode){
    const patches = {
      all: { includeAllFixtures: true, includeMajorEvents: true, includeFollowedTeams: true },
      majorFollowed: { includeAllFixtures: false, includeMajorEvents: true, includeFollowedTeams: true },
      majorOnly: { includeAllFixtures: false, includeMajorEvents: true, includeFollowedTeams: false },
    };
    return applyDomainOverride(graph, domainId, patches[mode] || patches.majorFollowed);
  }

  function upsertCompetitionPreference(graph, competitionId, patch = {}){
    const next = cloneGraph(graph);
    const index = next.competitionPreferences.findIndex(preference => preference.competitionId === competitionId);
    const preference = {
      profileId: next.profileId,
      competitionId,
      enabled: patch.enabled !== false,
      templateInheritedFromDomain: patch.templateInheritedFromDomain !== false,
      ...(index >= 0 ? next.competitionPreferences[index] : {}),
      ...patch,
      profileId: next.profileId,
      competitionId,
    };
    delete preference.showLadder;
    if (index >= 0) next.competitionPreferences[index] = preference;
    else next.competitionPreferences.push(preference);
    return touch(next);
  }

  function setEntityFollow(graph, participantId, followLevel){
    const next = cloneGraph(graph);
    next.entityFollows = next.entityFollows.filter(preference => preference.participantId !== participantId);
    if (["follow", "priority", "mute"].includes(followLevel)){
      next.entityFollows.push({ profileId: next.profileId, participantId, followLevel });
    }
    return touch(next);
  }

  function updateViewingPreference(graph, patch, broadcasterIds){
    const next = cloneGraph(graph);
    const available = uniqueStrings(broadcasterIds || next.viewing?.knownBroadcasterIds);
    const selected = patch.selectedBroadcasterIds
      ? uniqueStrings(patch.selectedBroadcasterIds).filter(id => available.includes(id))
      : uniqueStrings(next.viewing?.selectedBroadcasterIds).filter(id => available.includes(id));
    const viewing = {
      ...(next.viewing || {}),
      ...(patch || {}),
      profileId: next.profileId,
      selectedBroadcasterIds: selected,
      excludedBroadcasterIds: available.filter(id => !selected.includes(id)),
      knownBroadcasterIds: available,
    };
    next.viewing = buildViewingPreference(next.profileId, available, viewing);
    return touch(next);
  }

  function applyLearningSignal(graph, signal, { recordedAt } = {}){
    const next = cloneGraph(graph);
    const learning = normalizeLearning(next.learning);
    const normalized = normalizeLearningSignal({
      ...(signal || {}),
      recordedAt: recordedAt || signal?.recordedAt || new Date().toISOString(),
    });
    if (!normalized) return touch({ ...next, learning });
    const key = `${normalized.targetType}:${normalized.targetId}`;
    learning.signals = learning.signals.filter(item => `${item.targetType}:${item.targetId}` !== key);
    learning.signals.push(normalized);
    learning.signals = learning.signals.slice(-MAX_LEARNING_SIGNALS);
    if (normalized.value < 0 && normalized.source === "feed") learning.dislikeCount += 1;
    next.learning = learning;
    return touch(next);
  }

  function isMeaningfullyTuned(input){
    const learning = normalizeLearning(input?.learning || input);
    return (
      learning.tuningInteractionCount >= MEANINGFUL_TUNING_INTERACTIONS
      && learning.tuningDomainIds.length >= MEANINGFUL_TUNING_DOMAINS
    ) || learning.completedTuningSessionCount >= MEANINGFUL_TUNING_SESSIONS;
  }

  function markMeaningfulTuning(learning, recordedAt){
    learning.meaningfulTuningAt = normalizeTimestamp(recordedAt || new Date().toISOString());
    learning.meaningfulTuningDislikeCount = learning.dislikeCount;
    return learning;
  }

  function applyTuningSignal(graph, signal, { domainId, recordedAt } = {}){
    const wasMeaningful = isMeaningfullyTuned(graph);
    const next = applyLearningSignal(graph, { ...(signal || {}), source: "tune" }, { recordedAt });
    const learning = normalizeLearning(next.learning);
    learning.tuningInteractionCount += 1;
    learning.tuningDomainIds = uniqueStrings([
      ...learning.tuningDomainIds,
      String(domainId || ""),
    ]).slice(-MAX_TUNING_DOMAINS);
    if (!wasMeaningful && isMeaningfullyTuned(learning)) markMeaningfulTuning(learning, recordedAt);
    next.learning = learning;
    return touch(next);
  }

  function completeTuningSession(graph, { recordedAt } = {}){
    const next = cloneGraph(graph);
    const learning = normalizeLearning(next.learning);
    const timestamp = normalizeTimestamp(recordedAt || new Date().toISOString());
    learning.completedTuningSessionCount += 1;
    learning.lastTuningSessionCompletedAt = timestamp;
    if (isMeaningfullyTuned(learning)) markMeaningfulTuning(learning, timestamp);
    next.learning = learning;
    return touch(next);
  }

  function skipCalibrationTarget(graph, targetId){
    const next = cloneGraph(graph);
    const learning = normalizeLearning(next.learning);
    learning.calibrationSkippedTargetIds = uniqueStrings([
      ...learning.calibrationSkippedTargetIds,
      String(targetId || ""),
    ]).slice(-MAX_CALIBRATION_SKIPS);
    next.learning = learning;
    return touch(next);
  }

  function completeCalibration(graph, { skipped = false, recordedAt } = {}){
    const next = cloneGraph(graph);
    const learning = normalizeLearning(next.learning);
    const timestamp = normalizeTimestamp(recordedAt || new Date().toISOString());
    learning.calibrationCompletedAt = timestamp;
    learning.calibrationSkippedAt = skipped ? timestamp : null;
    next.learning = learning;
    return touch(next);
  }

  function mergeLearning(base, incoming){
    const previous = normalizeLearning(base);
    const patch = normalizeLearning(incoming);
    const latestTimestamp = (first, second) => {
      const values = [first, second].filter(Boolean).sort();
      return values.length ? values[values.length - 1] : null;
    };
    return normalizeLearning({
      signals: [...previous.signals, ...patch.signals],
      dislikeCount: Math.max(previous.dislikeCount, patch.dislikeCount),
      tuningPromptCount: Math.max(previous.tuningPromptCount, patch.tuningPromptCount),
      lastTunePromptDislikeCount: Math.max(
        previous.lastTunePromptDislikeCount ?? 0,
        patch.lastTunePromptDislikeCount ?? 0
      ) || null,
      calibrationSkippedTargetIds: uniqueStrings([
        ...previous.calibrationSkippedTargetIds,
        ...patch.calibrationSkippedTargetIds,
      ]),
      calibrationCompletedAt: latestTimestamp(previous.calibrationCompletedAt, patch.calibrationCompletedAt),
      calibrationSkippedAt: latestTimestamp(previous.calibrationSkippedAt, patch.calibrationSkippedAt),
      tuningInteractionCount: Math.max(previous.tuningInteractionCount, patch.tuningInteractionCount),
      tuningDomainIds: uniqueStrings([...previous.tuningDomainIds, ...patch.tuningDomainIds]),
      completedTuningSessionCount: Math.max(previous.completedTuningSessionCount, patch.completedTuningSessionCount),
      lastTuningSessionCompletedAt: latestTimestamp(
        previous.lastTuningSessionCompletedAt,
        patch.lastTuningSessionCompletedAt
      ),
      meaningfulTuningAt: latestTimestamp(previous.meaningfulTuningAt, patch.meaningfulTuningAt),
      meaningfulTuningDislikeCount: (() => {
        const latest = [previous, patch]
          .filter(candidate => candidate.meaningfulTuningAt)
          .sort((first, second) => first.meaningfulTuningAt.localeCompare(second.meaningfulTuningAt))
          .at(-1);
        return latest?.meaningfulTuningDislikeCount ?? null;
      })(),
    });
  }

  function shouldPromptTune(input, { now = new Date() } = {}){
    const numericInput = typeof input === "number";
    const learning = numericInput ? null : normalizeLearning(input?.learning || input);
    const count = Math.max(0, Math.floor(Number(numericInput ? input : learning.dislikeCount) || 0));
    const standardCadence = count === 1 || count === 4 || count === 10 || count === 25 || count === 50 || (count > 50 && count % 50 === 0);
    if (!learning?.meaningfulTuningAt) return standardCadence;
    const tunedAt = new Date(learning.meaningfulTuningAt);
    const reference = now instanceof Date ? now : new Date(now);
    const elapsedDays = (reference.getTime() - tunedAt.getTime()) / (24 * 3600 * 1000);
    const baseline = learning.meaningfulTuningDislikeCount ?? learning.dislikeCount;
    if (elapsedDays < POST_TUNING_DAY_GAP || count - baseline < POST_TUNING_DISLIKE_GAP) return false;
    const lastPrompt = learning.lastTunePromptDislikeCount ?? baseline;
    return lastPrompt <= baseline || count - lastPrompt >= 50;
  }

  function recordTunePrompt(graph, { dislikeCount, recordedAt } = {}){
    const next = cloneGraph(graph);
    const learning = normalizeLearning(next.learning);
    learning.tuningPromptCount += 1;
    learning.lastTunePromptDislikeCount = Math.max(0, Math.floor(Number(dislikeCount ?? learning.dislikeCount) || 0));
    next.learning = learning;
    return touch(next);
  }

  function learningScore(graph, targetReferences){
    const references = Array.isArray(targetReferences) ? targetReferences : [];
    const referenceKeys = new Set(references
      .filter(reference => reference && LEARNING_TARGET_TYPES.includes(reference.targetType) && typeof reference.targetId === "string")
      .map(reference => `${reference.targetType}:${reference.targetId}`));
    const weights = { event: 20, player: 14, team: 14, competition: 12, event_family: 10, sport: 8 };
    const score = normalizeLearning(graph?.learning).signals.reduce((total, signal) => {
      if (!referenceKeys.has(`${signal.targetType}:${signal.targetId}`)) return total;
      return total + signal.value * (weights[signal.targetType] || 0);
    }, 0);
    return Math.max(-30, Math.min(30, score));
  }

  return Object.freeze({
    SCHEMA_VERSION,
    MAX_LEARNING_SIGNALS,
    MAX_CALIBRATION_SKIPS,
    MAX_TUNING_DOMAINS,
    MEANINGFUL_TUNING_INTERACTIONS,
    MEANINGFUL_TUNING_DOMAINS,
    MEANINGFUL_TUNING_SESSIONS,
    POST_TUNING_DISLIKE_GAP,
    POST_TUNING_DAY_GAP,
    LEARNING_TARGET_TYPES,
    LEARNING_SOURCES,
    DEFAULT_VIEWING_WINDOW,
    templates: Object.freeze(templates),
    templateById,
    expandTemplate,
    createPreferenceGraph,
    migratePreferenceGraph,
    quickAddDomain,
    customiseDomain,
    disableDomain,
    applyDomainOverride,
    setCoverageMode,
    upsertCompetitionPreference,
    setEntityFollow,
    updateViewingPreference,
    applyLearningSignal,
    applyTuningSignal,
    completeTuningSession,
    isMeaningfullyTuned,
    skipCalibrationTarget,
    completeCalibration,
    mergeLearning,
    shouldPromptTune,
    recordTunePrompt,
    learningScore,
  });
});
