(function attachNothingSportsPreferenceTaxonomy(root, factory){
  const hierarchy = root.NOTHINGSPORTS_SPORT_HIERARCHY
    || (typeof require === "function" ? require("./sport-hierarchy.js") : null);
  const api = factory(hierarchy);
  root.NOTHINGSPORTS_PREFERENCE_TAXONOMY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPreferenceTaxonomy(hierarchy){
  "use strict";

  const SCHEMA_VERSION = "preference-taxonomy.v1";

  function uniqueStrings(values){
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)));
  }

  function canonicalNodeId(selectorEntityId, canonicalSportKeys = []){
    const direct = hierarchy?.canonicalNodeId?.(selectorEntityId);
    if (direct) return direct;
    for (const key of uniqueStrings(canonicalSportKeys)){
      const resolved = hierarchy?.canonicalNodeId?.(key);
      if (resolved) return resolved;
    }
    return null;
  }

  function hierarchyLevel(taxonomyNodeId){
    return hierarchy?.lineageFor?.(taxonomyNodeId)?.at(-1)?.level || null;
  }

  function normalizeQualifier(input){
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const type = String(input.type || "").trim();
    const value = String(input.value || "").trim();
    return type && value ? { type, value } : null;
  }

  function translateSelection({ sourceSelectorEntityIds = [], effectiveSelectors = [] } = {}){
    const mappings = [];
    const seen = new Set();
    (Array.isArray(effectiveSelectors) ? effectiveSelectors : []).forEach(selector => {
      const selectorEntityId = String(selector?.id || "").trim();
      const canonicalSportKeys = uniqueStrings(selector?.canonicalSportKeys);
      const taxonomyNodeId = canonicalNodeId(selectorEntityId, canonicalSportKeys);
      const qualifier = normalizeQualifier(selector?.qualifier);
      if (!selectorEntityId || !taxonomyNodeId) return;
      const identity = `${selectorEntityId}:${taxonomyNodeId}:${qualifier?.type || ""}:${qualifier?.value || ""}`;
      if (seen.has(identity)) return;
      seen.add(identity);
      mappings.push({
        selectorEntityId,
        taxonomyNodeId,
        hierarchyLevel: hierarchyLevel(taxonomyNodeId),
        canonicalSportKeys,
        ...(qualifier ? { qualifier } : {}),
      });
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      taxonomyVersion: hierarchy?.schemaVersion || "sport-hierarchy-unavailable",
      sourceSelectorEntityIds: uniqueStrings(sourceSelectorEntityIds),
      mappings,
    };
  }

  function mappingMatchesResolvedEvent(mapping, resolvedEvent){
    if (!mapping?.taxonomyNodeId || !resolvedEvent) return false;
    const lineageIds = uniqueStrings(resolvedEvent.lineageIds);
    return lineageIds.includes(mapping.taxonomyNodeId)
      || mapping.taxonomyNodeId === resolvedEvent.taxonomyNodeId;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    TAXONOMY_VERSION: hierarchy?.schemaVersion || "sport-hierarchy-unavailable",
    canonicalNodeId,
    mappingMatchesResolvedEvent,
    translateSelection,
  });
});
