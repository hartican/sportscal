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
      ...(event?.sourceEventIds || []),
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

  function sportKey(event){
    const explicit = clean(
      event?.key
      || event?.sportKey
      || event?.sportId
      || event?.codeId
      || event?.sport
    ).toLowerCase().replace(/^(?:sport|competition):/, "");
    if (explicit) return explicit;
    const competition = clean(event?.competitionId || event?.competition).toLowerCase();
    return competition.match(/^competition:([^:]+)/)?.[1] || competition || "fixture";
  }

  function f1SessionType(event){
    const value = [event?.sessionType,event?.stage,event?.roundLabel,event?.name].map(clean).join(" ").toLowerCase();
    const practice = value.match(/\b(?:practice|fp)\s*([123])\b/);
    if (practice) return `practice-${practice[1]}`;
    if (/\b(?:sprint qualifying|sprint shootout)\b/.test(value)) return "sprint-qualifying";
    if (/\bqualifying\b/.test(value)) return "qualifying";
    if (/\bsprint\b/.test(value)) return "sprint";
    if (/\brace\b/.test(value) || /\b(?:grand prix|gp)\b/.test(value)) return "race";
    return "";
  }

  function f1FixtureIdentity(event){
    if (sportKey(event) !== "f1") return "";
    const canonical = identityAliases(event).map(value => value.match(/^event:f1:(\d{4}):([^:]+):(practice-[123]|sprint-qualifying|sprint|qualifying|race)$/i)).find(Boolean);
    if (canonical) return `f1|${canonical[1]}|${canonical[2].toLowerCase()}|${canonical[3].toLowerCase()}`;
    const session = f1SessionType(event);
    const year = String(event?.date || event?.startTimeUtc || "").match(/\b(20\d{2})\b/)?.[1] || "";
    const rawRace = clean(event?.name)
      .toLowerCase()
      .replace(/^r\d+\s+/, "")
      .replace(/\b(?:practice|fp)\s*[123]\b|\bsprint qualifying\b|\bsprint shootout\b|\bqualifying\b|\bsprint\b|\brace\b/gi, " ")
      .replace(/\b(?:grand prix|gp)\b/gi, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const race = ({spanish:"spain","mexico-city":"mexico","sao-paulo":"brazil","abu-dhabi":"united-arab-emirates"})[rawRace] || rawRace;
    return year && race && session ? `f1|${year}|${race}|${session}` : "";
  }

  function semanticFixtureKey(event){
    const f1 = f1FixtureIdentity(event);
    if (f1) return f1;
    const participants = participantIds(event);
    const parsedStart = Date.parse(event?.startTimeUtc || event?.timelineSortTimeUtc || "");
    if (participants.length < 2 || !Number.isFinite(parsedStart)) return "";
    return `${sportKey(event)}|${new Date(parsedStart).toISOString()}|${participants.join("|")}`;
  }

  function feedFixtureIdentity(event){
    return semanticFixtureKey(event) || identityAliases(event).map(id => `id|${id}`)[0] || "";
  }

  const cachedIndexes=new WeakMap();
  function fixtureIndexes(canonicalFixtures){
    const cached=cachedIndexes.get(canonicalFixtures);if(cached?.length===canonicalFixtures.length)return cached;
    const byAlias = new Map();
    const bySemantic = new Map();
    (canonicalFixtures || []).forEach(fixture => {
      identityAliases(fixture).forEach(alias => byAlias.set(alias, fixture));
      const key = semanticFixtureKey(fixture);
      if (key && !bySemantic.has(key)) bySemantic.set(key, fixture);
    });
    const result={byAlias,bySemantic,length:canonicalFixtures.length};cachedIndexes.set(canonicalFixtures,result);return result;
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
    f1SessionType,
    f1FixtureIdentity,
    semanticFixtureKey,
    feedFixtureIdentity,
    canonicalFixtureFor,
    repairSavedFixture,
    reconcileFixtures,
  });
});
