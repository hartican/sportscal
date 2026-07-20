(function attachSportDomainRegistry(root, factory){
  const registry = factory();
  root.NOTHINGSPORTS_SPORT_DOMAIN_REGISTRY = registry;
  if (typeof module !== "undefined" && module.exports) module.exports = registry;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSportDomainRegistry(){
  "use strict";

  const narrativeProfiles = Object.freeze(Object.fromEntries(Object.entries({
    f1: { id: "narrative:motorsport-grand-prix", signals: [{ match: "record|pole|qualifying", label: "Record Chase", archetype: "quest" }, { match: "championship|decider", label: "Title Decider", archetype: "quest" }] },
    rugby: { id: "narrative:rugby-test", signals: [{ match: "bledisloe|rival|derby", label: "Rivalry", archetype: "rivalry" }, { match: "final|decider", label: "Title Decider", archetype: "quest" }] },
    wimbledon: { id: "narrative:tennis-major", signals: [{ match: "final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    fifa: { id: "narrative:football-tournament", signals: [{ match: "final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }, { match: "upset|underdog", label: "Upset Watch", archetype: "ragsToRiches" }] },
    tdf: { id: "narrative:cycling-tour", signals: [{ match: "alpe d.huez|mountain|time trial", label: "Must Watch", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nrl: { id: "narrative:rugby-league-season", signals: [{ match: "grand final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby|state of origin", label: "Rivalry", archetype: "rivalry" }] },
    afl: { id: "narrative:afl-season", signals: [{ match: "grand final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby|showdown", label: "Rivalry", archetype: "rivalry" }] },
    cricket: { id: "narrative:cricket-series", signals: [{ match: "ashes|border.gavaskar|rival", label: "Rivalry", archetype: "rivalry" }, { match: "final|decider", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nba: { id: "narrative:basketball-finals", signals: [{ match: "game 7|final", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }] },
    masters: { id: "narrative:golf-major", signals: [{ match: "final round|sunday", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    lemans: { id: "narrative:endurance-race", signals: [{ match: "finish|decider", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nfl: { id: "narrative:american-football-final", signals: [{ match: "super bowl|final", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }] },
    ski: { id: "narrative:snow-finals", signals: [{ match: "final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    cwg: { id: "narrative:multi-sport-games", signals: [{ match: "gold medal|final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
  }).map(([key, profile]) => [key, Object.freeze({ ...profile, signals: Object.freeze(profile.signals.map(Object.freeze)) })])));

  // Adding a surfaced sport starts here. Rendering, filters, and selector choices
  // derive from these records instead of requiring a bespoke UI branch.
  const domains = [
    { key: "f1", domainId: "sport:motorsport", label: "F1", selectorLabel: "F1", detail: "Qualifying and race sessions in Sydney time.", color: "var(--c-f1)", glyph: "sport:motorsport", sortOrder: 10, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "rugby", domainId: "sport:rugby-union", label: "Rugby", selectorLabel: "Rugby", detail: "Wallabies Tests and major international windows.", color: "var(--c-rugby)", glyph: "sport:rugby", sortOrder: 20, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "wimbledon", domainId: "sport:tennis", label: "Wimbledon", selectorLabel: "Tennis", detail: "Grand Slam rounds, finals, and Australian contenders.", color: "var(--c-tennis)", glyph: "sport:tennis", sortOrder: 30, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "fifa", domainId: "sport:football", label: "FIFA World Cup", selectorLabel: "Football / World Cup", detail: "Socceroos and knockout-stage World Cup matches.", color: "var(--c-football)", glyph: "sport:football", sortOrder: 40, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "tdf", domainId: "sport:cycling", label: "Tour de France", selectorLabel: "Le Tour de France", detail: "Mountain stages, time trials, and the Paris finish.", color: "var(--c-cycling)", glyph: "sport:cycling", sortOrder: 50, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nrl", domainId: "sport:nrl", label: "NRL", selectorLabel: "Rugby League", detail: "Every premiership fixture, the live ladder, finals, and Grand Final.", color: "var(--c-nrl)", glyph: "sport:rugby", sortOrder: 60, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "afl", domainId: "sport:afl", label: "AFL", selectorLabel: "AFL", detail: "Every premiership fixture, the live ladder, and the finals series.", color: "var(--c-afl)", glyph: "sport:australian-football", sortOrder: 70, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "cricket", domainId: "sport:cricket", label: "Cricket", selectorLabel: "Cricket", detail: "Australian Tests and summer headline matches.", color: "var(--c-cricket)", glyph: "sport:cricket", sortOrder: 80, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nba", domainId: "sport:basketball", label: "NBA", selectorLabel: "NBA Finals", detail: "Finals games and potential deciders.", color: "var(--c-nba)", glyph: "sport:basketball", sortOrder: 90, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "masters", domainId: "sport:golf", label: "Masters", selectorLabel: "Masters Golf", detail: "Augusta rounds and Sunday contention windows.", color: "var(--c-golf)", glyph: "sport:golf", sortOrder: 100, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "lemans", domainId: "sport:motorsport", label: "Le Mans", selectorLabel: "Le Mans", detail: "24 Hours start and finish windows.", color: "var(--c-lemans)", glyph: "sport:motorsport", sortOrder: 110, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nfl", domainId: "sport:american-football", label: "Super Bowl", selectorLabel: "Super Bowl", detail: "The NFL championship event.", color: "var(--c-nfl)", glyph: "sport:american-football", sortOrder: 120, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "ski", domainId: "sport:skiing", label: "Ski/Alpine", selectorLabel: "Alpine / Freestyle Skiing", detail: "World Cup and finals events.", color: "var(--c-ski)", glyph: "sport:skiing", sortOrder: 130, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "cwg", domainId: "special:commonwealth-games", label: "Commonwealth Games", selectorLabel: "Commonwealth Games", detail: "Curated Glasgow 2026 sessions with Australian relevance.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 140, selector: false, supportsLadders: false, supportsNarrative: true },
  ].map(domain => Object.freeze({ ...domain, narrativeProfile: narrativeProfiles[domain.key] }));

  const byKey = Object.freeze(Object.fromEntries(domains.map(domain => [domain.key, domain])));

  function metaByKey(){
    return Object.freeze(Object.fromEntries(domains.map(domain => [domain.key, Object.freeze({
      label: domain.label,
      color: domain.color,
      glyph: domain.glyph,
      domainId: domain.domainId,
    })])));
  }

  function selectorLibrary(){
    return Object.freeze(Object.fromEntries(domains.filter(domain => domain.selector).map(domain => [domain.key, Object.freeze({
      label: domain.selectorLabel,
      filterLabel: domain.label,
      detail: domain.detail,
      color: domain.color,
      glyph: domain.glyph,
      domainId: domain.domainId,
      supportsLadders: domain.supportsLadders,
      supportsNarrative: domain.supportsNarrative,
    })])));
  }

  return Object.freeze({
    schemaVersion: "sport-domain-registry.v1",
    domains: Object.freeze(domains),
    byKey,
    narrativeProfiles,
    metaByKey,
    selectorLibrary,
    filterOrder: Object.freeze(["all", ...domains.map(domain => domain.key)]),
  });
});
