(function attachNothingSportsPreferenceSystem(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PREFERENCE_SYSTEM = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPreferenceSystem(){
  "use strict";

  const SCHEMA_VERSION = "preference-graph.v1";

  const templates = [
    {
      id: "template:froth",
      slug: "froth",
      name: "Froth",
      description: "More fixtures, full ladders, stronger follow weighting, and high must-watch sensitivity.",
      rules: {
        includeAllFixturesDefault: true,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: true,
        ladderVisibilityDefault: "full",
        narrativeIntensityDefault: 5,
        mustWatchSensitivityDefault: "high",
        reminderDefault: "allFollowed",
      },
    },
    {
      id: "template:like",
      slug: "like",
      name: "Like",
      description: "Important events and followed teams, with a compact ladder summary.",
      rules: {
        includeAllFixturesDefault: false,
        includeMajorEventsDefault: true,
        includeFollowedTeamsDefault: true,
        ladderVisibilityDefault: "summary",
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
        ladderVisibilityDefault: "hidden",
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
        ladderVisibilityDefault: "summary",
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
    return {
      profileId,
      sportDomainId,
      enabled: overrides.enabled !== false,
      templateId: template.id,
      includeAllFixtures: template.rules.includeAllFixturesDefault,
      includeMajorEvents: template.rules.includeMajorEventsDefault,
      includeFollowedTeams: template.rules.includeFollowedTeamsDefault,
      showLadder: template.rules.ladderVisibilityDefault,
      narrativeVisibility: narrativeVisibilityFor(template),
      narrativeIntensity: template.rules.narrativeIntensityDefault,
      mustWatchSensitivity: template.rules.mustWatchSensitivityDefault,
      reminderDefault: template.rules.reminderDefault,
      scopedCompetitionIds: uniqueStrings(overrides.scopedCompetitionIds),
      ...overrides,
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
    return {
      profileId,
      selectedBroadcasterIds,
      excludedBroadcasterIds: excluded,
      knownBroadcasterIds: available,
      startHourLocal: normalizeHour(saved.startHourLocal),
      endHourLocal: normalizeHour(saved.endHourLocal),
      allowLateNightOverrides: saved.allowLateNightOverrides !== false,
      calendarSyncEnabled: Boolean(saved.calendarSyncEnabled),
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
      .map(preference => ({ ...preference, profileId: safeProfileId }));
    const entityFollows = (Array.isArray(raw.entityFollows) ? raw.entityFollows : [])
      .filter(preference => preference && typeof preference.participantId === "string" && ["follow", "priority", "mute"].includes(preference.followLevel))
      .map(preference => ({ ...preference, profileId: safeProfileId }));

    return {
      schemaVersion: SCHEMA_VERSION,
      profileId: safeProfileId,
      updatedAt: new Date().toISOString(),
      domainPreferences,
      competitionPreferences,
      entityFollows,
      viewing: buildViewingPreference(safeProfileId, broadcasterIds, raw.viewing || {}, legacySelectedBroadcasterIds),
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

  return Object.freeze({
    SCHEMA_VERSION,
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
  });
});
