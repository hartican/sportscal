(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_FEED_FIXTURE_RECONCILIATION = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  function clean(value){ return String(value || "").trim(); }

  function identityAliases(event){
    return Array.from(new Set([
      event?.canonicalEventId,
      event?.eventId,
      event?.id,
      ...(Array.isArray(event?.identityAliases) ? event.identityAliases : []),
    ].map(clean).filter(Boolean)));
  }

  function participantIds(event){
    return Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participantSlots) ? event.participantSlots.map(slot => slot?.participantId) : []),
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].map(clean).filter(Boolean))).sort();
  }

  function semanticFixtureKey(event){
    const participants = participantIds(event);
    const parsedStart = Date.parse(event?.startTimeUtc || event?.timelineSortTimeUtc || "");
    if (participants.length < 2 || !Number.isFinite(parsedStart)) return "";
    const competition = clean(event?.competitionId || event?.competition || event?.sportId || event?.sport || "fixture").toLowerCase();
    return `${competition}|${new Date(parsedStart).toISOString()}|${participants.join("|")}`;
  }

  function fixtureIndexes(canonicalFixtures){
    const byAlias = new Map();
    const bySemantic = new Map();
    (canonicalFixtures || []).forEach(fixture => {
      identityAliases(fixture).forEach(alias => byAlias.set(alias, fixture));
      const key = semanticFixtureKey(fixture);
      if (key && !bySemantic.has(key)) bySemantic.set(key, fixture);
    });
    return { byAlias, bySemantic };
  }

  function canonicalFixtureFor(event, canonicalFixtures){
    const indexes = fixtureIndexes(canonicalFixtures);
    for (const alias of identityAliases(event)){
      if (indexes.byAlias.has(alias)) return indexes.byAlias.get(alias);
    }
    const semantic = semanticFixtureKey(event);
    return semantic ? indexes.bySemantic.get(semantic) || null : null;
  }

  function repairSavedFixture(savedFixture, canonicalFixtures){
    const fixture = canonicalFixtureFor(savedFixture, canonicalFixtures) || savedFixture;
    return {
      fixture,
      aliases:Array.from(new Set(identityAliases(savedFixture).filter(alias => !identityAliases(fixture).includes(alias)))),
    };
  }

  function reconcileFixtures(canonicalFixtures, supplementalFixtures){
    const canonical = Array.isArray(canonicalFixtures) ? canonicalFixtures.filter(Boolean) : [];
    const result = [...canonical];
    const aliases = new Set(canonical.flatMap(identityAliases));
    const semantics = new Set(canonical.map(semanticFixtureKey).filter(Boolean));
    (supplementalFixtures || []).filter(Boolean).forEach(candidate => {
      const match = canonicalFixtureFor(candidate, canonical);
      if (match) return;
      const ids = identityAliases(candidate);
      const semantic = semanticFixtureKey(candidate);
      if (ids.some(id => aliases.has(id)) || (semantic && semantics.has(semantic))) return;
      result.push(candidate);
      ids.forEach(id => aliases.add(id));
      if (semantic) semantics.add(semantic);
    });
    return result;
  }

  return Object.freeze({
    identityAliases,
    participantIds,
    semanticFixtureKey,
    canonicalFixtureFor,
    repairSavedFixture,
    reconcileFixtures,
  });
});
