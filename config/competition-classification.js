(function attachCompetitionClassification(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_COMPETITION_CLASSIFICATION = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildCompetitionClassification(){
  "use strict";

  const CODE_SURFACE = "code";
  const EVENT_SURFACE = "event";

  const codeDefinitions = Object.freeze([
    Object.freeze({
      canonicalCodeId:"competition:uefa-champions-league",
      selectorId:"sport:champions-league",
      parentSportId:"sport:football",
      reason:"recurring-single-code-competition",
      legacyFollowIds:Object.freeze([
        "uefa-champions-league",
        "special:uefa-champions-league",
        "major-event:uefa-champions-league-2026-27",
        "major-event:uefa-champions-league-2026-27:qualification",
        "major-event:uefa-champions-league-2026-27:league-phase",
        "major-event:uefa-champions-league-2026-27:knockout",
        "competition:uefa-champions-league:2026-27",
      ]),
    }),
    Object.freeze({
      canonicalCodeId:"sport:afl",
      selectorId:"sport:afl",
      parentSportId:"sport:afl",
      reason:"phase-of-existing-code",
      legacyFollowIds:Object.freeze([
        "afl-finals",
        "special:afl-finals",
        "major-event:afl-finals-series-2026",
      ]),
    }),
    Object.freeze({
      canonicalCodeId:"sport:nrl",
      selectorId:"sport:nrl",
      parentSportId:"sport:nrl",
      reason:"phase-of-existing-code",
      legacyFollowIds:Object.freeze([
        "nrl-finals",
        "special:nrl-finals",
        "major-event:nrl-finals-series-2026",
      ]),
    }),
  ]);

  const definitionByAlias = new Map(codeDefinitions.flatMap(definition => (
    [definition.canonicalCodeId, definition.selectorId, ...definition.legacyFollowIds]
      .map(alias => [String(alias).toLowerCase(), definition])
  )));

  function normalizedCandidates(input){
    if (typeof input === "string") return [input];
    const record = input && typeof input === "object" ? input : {};
    return [
      record.id,
      record.eventFamilyId,
      record.familyId,
      record.competitionId,
      record.canonicalCodeId,
      record.selectorId,
    ].map(value => String(value || "").trim()).filter(Boolean);
  }

  function codeDefinition(input){
    for (const candidate of normalizedCandidates(input)){
      const normalized = candidate.toLowerCase();
      const exact = definitionByAlias.get(normalized);
      if (exact) return exact;
      if (normalized.startsWith("major-event:uefa-champions-league-")) return codeDefinitions[0];
    }
    return null;
  }

  function classificationFor(input){
    const explicit = typeof input === "object" ? String(input?.surfaceClassification || "").toLowerCase() : "";
    if ([CODE_SURFACE, EVENT_SURFACE].includes(explicit)){
      return Object.freeze({
        surface:explicit,
        canonicalCodeId:explicit === CODE_SURFACE ? String(input.canonicalCodeId || codeDefinition(input)?.canonicalCodeId || "") || null : null,
        parentSportId:explicit === CODE_SURFACE ? String(input.parentSportId || codeDefinition(input)?.parentSportId || "") || null : null,
        reason:String(input.classificationReason || "explicit-classification"),
      });
    }
    const definition = codeDefinition(input);
    if (definition) return Object.freeze({
      surface:CODE_SURFACE,
      canonicalCodeId:definition.canonicalCodeId,
      parentSportId:definition.parentSportId,
      reason:definition.reason,
    });
    return Object.freeze({ surface:EVENT_SURFACE, canonicalCodeId:null, parentSportId:null, reason:"bounded-special-event" });
  }

  function belongsInEvents(input){
    return classificationFor(input).surface === EVENT_SURFACE;
  }

  function legacyNavigationTarget(input){
    const definition = codeDefinition(input);
    return definition ? Object.freeze({ type:CODE_SURFACE, codeId:definition.canonicalCodeId }) : null;
  }

  function migrateLegacyEventFollows(input){
    const sourceIds = Array.from(new Set((Array.isArray(input) ? input : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)));
    const codeSelectorIds = [];
    const retainedEventFamilyIds = [];
    sourceIds.forEach(id => {
      const definition = codeDefinition(id);
      if (definition) codeSelectorIds.push(definition.selectorId);
      else retainedEventFamilyIds.push(id);
    });
    return Object.freeze({
      sourceIds:Object.freeze(sourceIds),
      codeSelectorIds:Object.freeze(Array.from(new Set(codeSelectorIds))),
      retainedEventFamilyIds:Object.freeze(Array.from(new Set(retainedEventFamilyIds))),
    });
  }

  return Object.freeze({
    schemaVersion:"competition-classification.v1",
    CODE_SURFACE,
    EVENT_SURFACE,
    codeDefinitions,
    codeDefinition,
    classificationFor,
    belongsInEvents,
    legacyNavigationTarget,
    migrateLegacyEventFollows,
  });
});
