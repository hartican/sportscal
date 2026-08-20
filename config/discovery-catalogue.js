(function attachDiscoveryCatalogue(root, factory){
  const selectorTaxonomy = root.NOTHINGSPORTS_SELECTOR_TAXONOMY
    || (typeof require === "function" ? require("./selector-taxonomy.js") : null);
  const api = factory(selectorTaxonomy);
  root.NOTHINGSPORTS_DISCOVERY_CATALOGUE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildDiscoveryCatalogue(selectorTaxonomy){
  "use strict";

  const SCHEMA_VERSION = "sports-discovery-catalogue.v1";
  const PREFERENCE_VERSION = 13;
  const SYDNEY_TIME_ZONE = "Australia/Sydney";
  const DEFAULT_WINDOW_DAYS = 30;
  const DEFAULT_VISIBILITY_THRESHOLD = 5;
  const UNDERLYING_COLLECTION_FIELDS = Object.freeze(["underlyingEvents", "fixtures", "matches", "races", "sessions"]);
  const FINISHED_STATUSES = new Set(["completed", "finished", "final", "past", "cancelled", "canceled", "abandoned"]);

  const sportNodes = Object.freeze((selectorTaxonomy?.sportNodes || []).slice());
  const internalEventTags = Object.freeze((selectorTaxonomy?.internalEventTags || selectorTaxonomy?.specialEvents || []).slice());
  const commonwealthDisciplines = Object.freeze((selectorTaxonomy?.commonwealthDisciplines || []).slice());
  const sportById = new Map(sportNodes.map(node => [node.id, node]));
  const internalTagById = new Map(internalEventTags.map(node => [node.id, node]));
  const commonwealthById = new Map(commonwealthDisciplines.map(node => [node.id, node]));
  const commonwealthByDiscipline = new Map(commonwealthDisciplines.map(node => [node.canonicalDiscipline, node]));
  const topLevelSportNodes = Object.freeze(sportNodes.filter(node => node.parentId === "category:sports"));
  const catalogueOrder = new Map(sportNodes.map((node, index) => [node.id, index]));
  const oneOffMotorsportFrothRules = Object.freeze([
    Object.freeze({
      sportId: "sport:f1",
      canonicalKeys: Object.freeze(["lemans", "goodwood"]),
      titlePattern: /\ble mans\b|\bbathurst(?:\s+1000)?\b|\bindy(?:\s+500)?\b|\bindianapolis\s+500\b|\bgoodwood\b/i,
    }),
    Object.freeze({
      sportId: "sport:rally",
      canonicalKeys: Object.freeze([]),
      titlePattern: /\b(?:paris[- ]?)?dakar\b/i,
    }),
  ]);

  const legacyFollowAliases = Object.freeze({
    "category:sports": sportNodes.map(node => node.id),
    "category:special-events": internalEventTags.flatMap(node => node.underlyingSportIds || []),
    "sport:australian-football": ["sport:afl"],
    "sport:rugby-league": ["sport:nrl"],
    "sport:extreme-sports": ["sport:extreme"],
    "sport:surfing": ["sport:surf"],
    "sport:winter-sports": ["sport:skiing"],
    "sport:basketball": ["sport:nba"],
    "sport:wsl": ["sport:surf"],
    "sport:big-wave": ["sport:big-wave"],
    "sport:ski": ["sport:alpine"],
    "sport:snow": ["sport:skiing"],
    "sport:freestyle-skiing": ["sport:freestyle"],
    "sport:mtb": ["sport:downhill-mtb"],
    "sport:goodwood": ["sport:motorsport"],
    "sport:wimbledon": ["sport:tennis"],
    "sport:fifa": ["sport:football"],
    "sport:tdf": ["sport:cycling"],
    "sport:masters": ["sport:golf"],
    "sport:lemans": ["sport:motorsport"],
    "sport:nfl": ["sport:american-football"],
    "sport:cwg": ["sport:multi-sport"],
    wsl: ["sport:surf"],
    surf: ["sport:surf"],
    ski: ["sport:alpine"],
    snow: ["sport:skiing"],
    freestyle: ["sport:freestyle"],
    "downhill-mtb": ["sport:downhill-mtb"],
    mtb: ["sport:downhill-mtb"],
    goodwood: ["sport:motorsport"],
    wimbledon: ["sport:tennis"],
    fifa: ["sport:football"],
    tdf: ["sport:cycling"],
    masters: ["sport:golf"],
    lemans: ["sport:motorsport"],
    nfl: ["sport:american-football"],
    cwg: ["sport:multi-sport"],
  });

  const sportKeyById = Object.freeze(Object.fromEntries(sportNodes.map(node => [node.id, node.canonicalSportKeys?.[0] || node.id.replace(/^sport:/, "")])));
  const sportIdByCanonicalKey = new Map();
  sportNodes.forEach(node => (node.canonicalSportKeys || []).forEach(key => sportIdByCanonicalKey.set(String(key).toLowerCase(), node.id)));
  internalEventTags.forEach(tag => (tag.canonicalSportKeys || []).forEach(key => {
    const firstSportId = tag.underlyingSportIds?.[0];
    if (firstSportId) sportIdByCanonicalKey.set(String(key).toLowerCase(), firstSportId);
  }));

  function uniqueStrings(values){
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)));
  }

  function orderedSportIds(values){
    return uniqueStrings(values)
      .filter(id => sportById.has(id))
      .sort((first, second) => (catalogueOrder.get(first) ?? Number.MAX_SAFE_INTEGER) - (catalogueOrder.get(second) ?? Number.MAX_SAFE_INTEGER));
  }

  function descendantsOf(nodeId, { includeSelf = false } = {}){
    const result = [];
    const queue = [String(nodeId || "")];
    const seen = new Set();
    while (queue.length){
      const currentId = queue.shift();
      if (!currentId || seen.has(currentId)) continue;
      seen.add(currentId);
      if (includeSelf || currentId !== nodeId) result.push(currentId);
      const node = sportById.get(currentId);
      (node?.childIds || []).forEach(childId => queue.push(childId));
    }
    return orderedSportIds(result);
  }

  function familyIds(nodeId){
    return orderedSportIds([nodeId, ...descendantsOf(nodeId)]);
  }

  function topLevelSportId(nodeId){
    let node = sportById.get(String(nodeId || ""));
    const seen = new Set();
    while (node && node.parentId !== "category:sports" && !seen.has(node.id)){
      seen.add(node.id);
      node = sportById.get(node.parentId);
    }
    return node?.id || null;
  }

  function normalizeCommonwealthDiscipline(value){
    const label = String(value || "").trim().toLowerCase();
    if (!label) return null;
    if (commonwealthById.has(label)) return commonwealthById.get(label).canonicalDiscipline;
    if (commonwealthByDiscipline.has(label)) return label;
    if (/\bathletics?|track and field\b/.test(label)) return "athletics";
    if (/\bswimm?ing|aquatics?\b/.test(label)) return "swimming";
    if (/\brugby sevens?|rugby 7s\b/.test(label)) return "rugby-sevens";
    if (/\bnetball\b/.test(label)) return "netball";
    if (/\bcricket\b/.test(label)) return "cricket";
    if (/\bhockey\b/.test(label)) return "hockey";
    if (/\bgymnastics?\b/.test(label)) return "gymnastics";
    if (/\bcycling|bmx|mountain bike\b/.test(label)) return "cycling";
    if (/\bboxing\b/.test(label)) return "boxing";
    if (/\bmiscellaneous|other\b/.test(label)) return "miscellaneous";
    return null;
  }

  function commonwealthSportIds(disciplineIds){
    const normalized = uniqueStrings(disciplineIds).map(value => normalizeCommonwealthDiscipline(value)).filter(Boolean);
    const selected = normalized.length ? normalized : commonwealthDisciplines.map(node => node.canonicalDiscipline);
    return orderedSportIds(selected.flatMap(discipline => commonwealthByDiscipline.get(discipline)?.underlyingSportIds || []));
  }

  function directSportIdsForFollow(followId){
    const id = String(followId || "").trim();
    if (!id) return [];
    if (sportById.has(id)) return [id];
    if (commonwealthById.has(id)) return commonwealthById.get(id).underlyingSportIds || [];
    if (internalTagById.has(id) && id !== "special:commonwealth-games") return internalTagById.get(id).underlyingSportIds || [];
    if (legacyFollowAliases[id]) return legacyFollowAliases[id];
    const normalized = id.toLowerCase().replace(/^sport:/, "");
    return sportIdByCanonicalKey.has(normalized) ? [sportIdByCanonicalKey.get(normalized)] : [];
  }

  function migrateEventBrandFollows(followIds, { commonwealthDisciplineIds = [] } = {}){
    const sourceIds = uniqueStrings(followIds);
    const selectedDisciplineIds = uniqueStrings([
      ...commonwealthDisciplineIds,
      ...sourceIds.filter(id => id.startsWith("cwg:")),
    ]);
    const commonwealthRequested = sourceIds.some(id => ["special:commonwealth-games", "sport:cwg", "cwg"].includes(id))
      || selectedDisciplineIds.length > 0;
    const sportIds = [];
    const migratedEventFollowIds = [];

    sourceIds.forEach(id => {
      if (id === "special:commonwealth-games" || id === "sport:cwg" || id === "cwg"){
        migratedEventFollowIds.push(id);
        return;
      }
      if (commonwealthById.has(id)){
        migratedEventFollowIds.push(id);
        return;
      }
      if (internalTagById.has(id)) migratedEventFollowIds.push(id);
      sportIds.push(...directSportIdsForFollow(id));
    });
    if (commonwealthRequested) sportIds.push(...commonwealthSportIds(selectedDisciplineIds));

    return Object.freeze({
      schemaVersion: "event-follow-migration.v1",
      sourceIds: Object.freeze(sourceIds),
      sportIds: Object.freeze(orderedSportIds(sportIds)),
      followedSportKeys: Object.freeze(orderedSportIds(sportIds).map(id => sportKeyById[id]).filter(Boolean)),
      migratedEventFollowIds: Object.freeze(uniqueStrings(migratedEventFollowIds)),
      commonwealthDisciplineIds: Object.freeze(selectedDisciplineIds),
    });
  }

  function migrateDomainPreferences(domainPreferences, options = {}){
    const candidates = [];
    (Array.isArray(domainPreferences) ? domainPreferences : []).forEach((preference, sourceIndex) => {
      if (!preference || typeof preference !== "object") return;
      const sourceId = String(preference.sportDomainId || "").trim();
      if (!sourceId) return;
      const migration = migrateEventBrandFollows([sourceId], options);
      const mappedIds = migration.sportIds.length ? migration.sportIds : directSportIdsForFollow(sourceId);
      mappedIds.forEach(sportId => candidates.push({
        sportId,
        sourceId,
        sourceIndex,
        priority: sportById.has(sourceId) ? 2 : 1,
        preference,
      }));
    });
    const bySportId = new Map();
    candidates.forEach(candidate => {
      const previous = bySportId.get(candidate.sportId);
      if (!previous || candidate.priority > previous.priority || (candidate.priority === previous.priority && candidate.sourceIndex > previous.sourceIndex)){
        bySportId.set(candidate.sportId, candidate);
      }
    });
    return orderedSportIds(Array.from(bySportId.keys())).map(sportId => {
      const source = bySportId.get(sportId);
      const node = sportById.get(sportId);
      return {
        ...source.preference,
        sportDomainId: sportId,
        taxonomyNodeId: node?.taxonomyNodeId || source.preference.taxonomyNodeId || null,
      };
    });
  }

  function migratePreferences(savedPreferences){
    const saved = savedPreferences && typeof savedPreferences === "object" && !Array.isArray(savedPreferences)
      ? savedPreferences
      : {};
    const selectedSelectorEntityIds = Array.isArray(saved.selectedSelectorEntityIds) ? saved.selectedSelectorEntityIds : [];
    const followedSports = Array.isArray(saved.followedSports) ? saved.followedSports : [];
    const commonwealthDisciplineIds = uniqueStrings([
      ...(Array.isArray(saved.commonwealthDisciplineIds) ? saved.commonwealthDisciplineIds : []),
      ...selectedSelectorEntityIds.filter(id => String(id).startsWith("cwg:")),
    ]);
    // Explicit selector IDs are the durable source of truth whenever they exist.
    // `followedSports` is a derived compatibility field and can contain every
    // descendant of a selected parent, so unioning it here would silently turn a
    // Motorsport parent follow into separate F1 and Rally follows.
    const migration = migrateEventBrandFollows(
      selectedSelectorEntityIds.length ? selectedSelectorEntityIds : followedSports,
      { commonwealthDisciplineIds }
    );
    const next = {
      ...saved,
      version: PREFERENCE_VERSION,
      discoveryCatalogueVersion: SCHEMA_VERSION,
      selectedSelectorEntityIds: migration.sportIds.slice(),
      followedSports: migration.followedSportKeys.slice(),
    };
    if (saved.preferenceGraph && typeof saved.preferenceGraph === "object"){
      next.preferenceGraph = {
        ...saved.preferenceGraph,
        domainPreferences: migrateDomainPreferences(saved.preferenceGraph.domainPreferences, { commonwealthDisciplineIds }),
      };
    }
    // Inclusion is deliberately rebuilt on every app visit and never migrates into durable state.
    delete next.discoverySessionInclusion;
    delete next.sessionSportInclusion;
    return next;
  }

  function createSessionInclusion(visibleSportIds){
    return orderedSportIds(uniqueStrings(visibleSportIds).flatMap(id => familyIds(id)));
  }

  function resetSessionInclusion(visibleSportIds){
    return createSessionInclusion(visibleSportIds);
  }

  function setSessionNodeIncluded(currentIds, nodeId, included){
    const next = new Set(orderedSportIds(currentIds));
    familyIds(nodeId).forEach(id => included ? next.add(id) : next.delete(id));
    return orderedSportIds(Array.from(next));
  }

  function selectionState(nodeId, includedIds){
    const relevantIds = familyIds(nodeId);
    const included = new Set(orderedSportIds(includedIds));
    const selectedCount = relevantIds.filter(id => included.has(id)).length;
    return Object.freeze({
      checked: relevantIds.length > 0 && selectedCount === relevantIds.length,
      mixed: selectedCount > 0 && selectedCount < relevantIds.length,
      selectedCount,
      totalCount: relevantIds.length,
    });
  }

  function stableUnderlyingEventId(event){
    if (Object.prototype.hasOwnProperty.call(event || {}, "underlyingStableId")){
      const childId = String(event?.underlyingStableId || "").trim();
      return childId || null;
    }
    for (const field of ["canonicalEventId", "eventId", "fixtureId", "matchId", "raceId", "sessionId", "id"]){
      const value = String(event?.[field] || "").trim();
      if (value) return value;
    }
    return null;
  }

  function underlyingEventsForCard(card){
    for (const field of UNDERLYING_COLLECTION_FIELDS){
      const children = Array.isArray(card?.[field]) ? card[field] : [];
      if (!children.length) continue;
      return children.map(child => ({
        ...card,
        ...child,
        groupedCardId: stableUnderlyingEventId(card),
        underlyingStableId: stableUnderlyingEventId(child),
      }));
    }
    return card && typeof card === "object" ? [card] : [];
  }

  function sydneyDateKey(value){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: SYDNEY_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function addCalendarDays(dateKey, days){
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + Number(days || 0)));
    return date.toISOString().slice(0, 10);
  }

  function eventSydneyDateKey(event){
    for (const field of ["sydneyDate", "date", "localDate"]){
      const direct = /^(\d{4}-\d{2}-\d{2})/.exec(String(event?.[field] || ""))?.[1];
      if (direct) return direct;
    }
    for (const field of ["startTimeUtc", "startTime", "scheduledAt", "start"]){
      if (event?.[field]){
        const derived = sydneyDateKey(event[field]);
        if (derived) return derived;
      }
    }
    return null;
  }

  function isUnfinishedEvent(event){
    if (event?.completed === true || event?.finished === true) return false;
    return !FINISHED_STATUSES.has(String(event?.status || "").trim().toLowerCase());
  }

  function eventIsInSydneyWindow(event, { now = new Date(), windowDays = DEFAULT_WINDOW_DAYS } = {}){
    if (!isUnfinishedEvent(event)) return false;
    const eventDate = eventSydneyDateKey(event);
    const startDate = sydneyDateKey(now);
    const endDateExclusive = addCalendarDays(startDate, Math.max(1, Number(windowDays) || DEFAULT_WINDOW_DAYS));
    return Boolean(eventDate && startDate && endDateExclusive && eventDate >= startDate && eventDate < endDateExclusive);
  }

  function eventNodeId(event){
    for (const field of ["discoverySportId", "catalogueSportId", "sportCatalogueNodeId"]){
      const explicit = String(event?.[field] || "").trim();
      if (sportById.has(explicit)) return explicit;
    }
    const commonwealthKey = String(event?.key || event?.sportKey || event?.sportId || "").trim().toLowerCase();
    const eventTagIds = uniqueStrings([event?.internalEventTagId, event?.eventTagId, ...(Array.isArray(event?.internalEventTagIds) ? event.internalEventTagIds : [])]);
    const isCommonwealth = commonwealthKey === "cwg" || eventTagIds.includes("special:commonwealth-games");
    if (isCommonwealth){
      const discipline = normalizeCommonwealthDiscipline(event?.commonwealthDiscipline || event?.discipline || event?.sportDiscipline || event?.sport);
      return commonwealthByDiscipline.get(discipline)?.underlyingSportIds?.[0] || "sport:multi-sport";
    }
    for (const tagId of eventTagIds){
      const mapped = internalTagById.get(tagId)?.underlyingSportIds?.[0];
      if (mapped) return mapped;
    }
    const candidates = [event?.key, event?.sportKey, event?.sportId, event?.sportDomainId, event?.taxonomySportId]
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    for (const candidate of candidates){
      if (sportById.has(candidate)) return candidate;
      const internalTagSportId = internalTagById.get(candidate)?.underlyingSportIds?.[0];
      if (internalTagSportId) return internalTagSportId;
      const withoutPrefix = candidate.replace(/^sport:/, "");
      if (sportIdByCanonicalKey.has(withoutPrefix)) return sportIdByCanonicalKey.get(withoutPrefix);
      const aliases = legacyFollowAliases[candidate] || legacyFollowAliases[withoutPrefix];
      if (aliases?.length) return aliases[0];
    }
    return null;
  }

  function oneOffMotorsportFrothIds(event){
    const canonicalKey = String(event?.key || event?.sportKey || event?.sportId || "").trim().toLowerCase().replace(/^sport:/, "");
    const title = [event?.name, event?.displayTitleCompact, event?.sport, event?.competition]
      .filter(Boolean)
      .join(" | ");
    return orderedSportIds(oneOffMotorsportFrothRules
      .filter(rule => rule.canonicalKeys.includes(canonicalKey) || rule.titlePattern.test(title))
      .map(rule => rule.sportId));
  }

  function nodeDepth(nodeId){
    let depth = 0;
    let node = sportById.get(nodeId);
    const seen = new Set();
    while (node && node.parentId !== "category:sports" && !seen.has(node.id)){
      seen.add(node.id);
      depth += 1;
      node = sportById.get(node.parentId);
    }
    return depth;
  }

  function countUnderlyingEvents(events, options = {}){
    const byStableId = new Map();
    (Array.isArray(events) ? events : []).flatMap(underlyingEventsForCard).forEach(event => {
      if (!eventIsInSydneyWindow(event, options)) return;
      const id = stableUnderlyingEventId(event);
      const nodeId = eventNodeId(event);
      if (!id || !nodeId) return;
      const previous = byStableId.get(id);
      if (!previous || nodeDepth(nodeId) > nodeDepth(previous.nodeId)) byStableId.set(id, { id, nodeId });
    });

    const idsByNode = new Map(sportNodes.map(node => [node.id, new Set()]));
    byStableId.forEach(record => idsByNode.get(record.nodeId)?.add(record.id));
    const exactCounts = Object.freeze(Object.fromEntries(sportNodes.map(node => [node.id, idsByNode.get(node.id).size])));
    const aggregateCounts = Object.freeze(Object.fromEntries(sportNodes.map(node => {
      const ids = new Set();
      familyIds(node.id).forEach(id => idsByNode.get(id)?.forEach(eventId => ids.add(eventId)));
      return [node.id, ids.size];
    })));
    return Object.freeze({
      schemaVersion: "discovery-event-counts.v1",
      windowDays: Math.max(1, Number(options.windowDays) || DEFAULT_WINDOW_DAYS),
      uniqueEventCount: byStableId.size,
      exactCounts,
      aggregateCounts,
    });
  }

  function catalogueVisibility(events, { followedSportIds = [], threshold = DEFAULT_VISIBILITY_THRESHOLD, ...windowOptions } = {}){
    const counts = countUnderlyingEvents(events, windowOptions);
    const mainIds = topLevelSportNodes
      .filter(node => Number(counts.aggregateCounts[node.id] || 0) >= Number(threshold || DEFAULT_VISIBILITY_THRESHOLD))
      .map(node => node.id);
    const mainSet = new Set(mainIds);
    const moreIds = orderedSportIds(followedSportIds).filter(id => !mainSet.has(topLevelSportId(id)));
    return Object.freeze({
      schemaVersion: "discovery-catalogue-visibility.v1",
      threshold: Number(threshold || DEFAULT_VISIBILITY_THRESHOLD),
      mainIds: Object.freeze(mainIds),
      moreIds: Object.freeze(moreIds),
      visibleSportIds: Object.freeze(orderedSportIds([...mainIds, ...moreIds])),
      counts,
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    PREFERENCE_VERSION,
    SYDNEY_TIME_ZONE,
    DEFAULT_WINDOW_DAYS,
    DEFAULT_VISIBILITY_THRESHOLD,
    sportNodes,
    topLevelSportNodes,
    internalEventTags,
    commonwealthDisciplines,
    descendantsOf,
    familyIds,
    topLevelSportId,
    normalizeCommonwealthDiscipline,
    commonwealthSportIds,
    migrateEventBrandFollows,
    migrateDomainPreferences,
    migratePreferences,
    createSessionInclusion,
    resetSessionInclusion,
    setSessionNodeIncluded,
    selectionState,
    stableUnderlyingEventId,
    underlyingEventsForCard,
    sydneyDateKey,
    addCalendarDays,
    eventSydneyDateKey,
    isUnfinishedEvent,
    eventIsInSydneyWindow,
    eventNodeId,
    oneOffMotorsportFrothIds,
    countUnderlyingEvents,
    catalogueVisibility,
  });
});
