(function attachSportDomainRegistry(root, factory){
  const registry = factory();
  root.NOTHINGSPORTS_SPORT_DOMAIN_REGISTRY = registry;
  if (typeof module !== "undefined" && module.exports) module.exports = registry;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSportDomainRegistry(){
  "use strict";

  const narrativeProfiles = Object.freeze(Object.fromEntries(Object.entries({
    f1: { id: "narrative:motorsport-grand-prix", signals: [{ match: "record|milestone|all-time", label: "Record Chase", archetype: "quest" }, { match: "championship|decider", label: "Title Decider", archetype: "quest" }] },
    rugby: { id: "narrative:rugby-test", signals: [{ match: "bledisloe|rival|derby", label: "Rivalry", archetype: "rivalry" }, { match: "final|decider", label: "Title Decider", archetype: "quest" }] },
    motorsport: { id: "narrative:motorsport-family", signals: [{ match: "stage|rally|endurance|finish|qualifying", label: "Title Decider", archetype: "quest" }, { match: "record|best lap|fastest", label: "Record Chase", archetype: "quest" }, { match: "podium|championship|winner", label: "Rivalry", archetype: "rivalry" }] },
    extreme: { id: "narrative:extreme-sport", signals: [{ match: "world cup|championship|title|final", label: "Title Decider", archetype: "quest" }, { match: "record|run|dirt|jump|crash", label: "Record Chase", archetype: "quest" }, { match: "trick|park|gravity", label: "Rivalry", archetype: "rivalry" }] },
    "downhill-mtb": { id: "narrative:extreme-sport", signals: [{ match: "course|run|gate|time|descent", label: "Title Decider", archetype: "quest" }, { match: "record|drop|line|crash", label: "Record Chase", archetype: "quest" }, { match: "flow|split|comeback", label: "Rivalry", archetype: "rivalry" }] },
    wsl: { id: "narrative:surf-events", signals: [{ match: "heat|wave|master|heats|board|condition", label: "Top pick", archetype: "quest" }, { match: "title|championship|winner", label: "Title Decider", archetype: "quest" }, { match: "forecast|swell|wind|tide", label: "Record Chase", archetype: "quest" }] },
    "big-wave": { id: "narrative:surf-events", signals: [{ match: "wave|deep|condition|forecast|title", label: "Top pick", archetype: "quest" }, { match: "championship|masters|major", label: "Title Decider", archetype: "quest" }] },
    surf: { id: "narrative:surf-events", signals: [{ match: "swell|wave|forecast|lineup|heats", label: "Top pick", archetype: "quest" }, { match: "title|championship|major", label: "Title Decider", archetype: "quest" }, { match: "record|high score|heat", label: "Record Chase", archetype: "quest" }] },
    skiing: { id: "narrative:snow-finals", signals: [{ match: "final|decider", label: "Title Decider", archetype: "quest" }, { match: "record|time|gate", label: "Record Chase", archetype: "quest" }, { match: "situation|course|glide", label: "Rivalry", archetype: "rivalry" }] },
    skateboard: { id: "narrative:extreme-sport", signals: [{ match: "park|street|park style|trick|heat", label: "Top pick", archetype: "quest" }, { match: "title|final|run", label: "Title Decider", archetype: "quest" }, { match: "record|line|height", label: "Record Chase", archetype: "quest" }] },
    telemark: { id: "narrative:snow-finals", signals: [{ match: "final|run|gate|combined|championship", label: "Title Decider", archetype: "quest" }, { match: "record|time|jump", label: "Record Chase", archetype: "quest" }] },
    cycling: { id: "narrative:cycling-tour", signals: [{ match: "stage|time trial|climb|sprint", label: "Top pick", archetype: "quest" }, { match: "final|general|yellow|podium", label: "Title Decider", archetype: "quest" }, { match: "record|time|gap", label: "Record Chase", archetype: "quest" }] },
    rally: { id: "narrative:motorsport-family", signals: [{ match: "stage|rally|split|endurance|finish", label: "Title Decider", archetype: "quest" }, { match: "podium|class|leader|time", label: "Rivalry", archetype: "rivalry" }] },
    goodwood: { id: "narrative:motorsport-family", signals: [{ match: "hillclimb|event|podium|feature|showdown", label: "Top pick", archetype: "quest" }, { match: "winner|headline", label: "Title Decider", archetype: "quest" }] },
    wimbledon: { id: "narrative:tennis-major", signals: [{ match: "final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    tennis: { id: "narrative:tennis-tour", signals: [{ match: "grand slam|final|1000", label: "Title Decider", archetype: "quest" }, { match: "australian|top 50", label: "Top pick", archetype: "quest" }] },
    fifa: { id: "narrative:football-tournament", signals: [{ match: "final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }, { match: "upset|underdog", label: "Upset Watch", archetype: "ragsToRiches" }] },
    tdf: { id: "narrative:cycling-tour", signals: [{ match: "alpe d.huez|mountain|time trial", label: "Top pick", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nrl: { id: "narrative:rugby-league-season", signals: [{ match: "grand final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby|state of origin", label: "Rivalry", archetype: "rivalry" }] },
    afl: { id: "narrative:afl-season", signals: [{ match: "grand final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby|showdown", label: "Rivalry", archetype: "rivalry" }] },
    cricket: { id: "narrative:cricket-series", signals: [{ match: "ashes|border.gavaskar|rival", label: "Rivalry", archetype: "rivalry" }, { match: "final|decider", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nba: { id: "narrative:basketball-finals", signals: [{ match: "game 7|final", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }] },
    masters: { id: "narrative:golf-major", signals: [{ match: "final round|sunday", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    lemans: { id: "narrative:endurance-race", signals: [{ match: "finish|decider", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    nfl: { id: "narrative:american-football-final", signals: [{ match: "super bowl|final", label: "Title Decider", archetype: "quest" }, { match: "rival|derby", label: "Rivalry", archetype: "rivalry" }] },
    "ice-hockey": { id: "narrative:ice-hockey-season", signals: [{ match: "stanley cup|final|decider", label: "Title Decider", archetype: "quest" }, { match: "rival|derby|original six", label: "Rivalry", archetype: "rivalry" }] },
    ski: { id: "narrative:snow-finals", signals: [{ match: "final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
    cwg: { id: "narrative:multi-sport-games", signals: [{ match: "gold medal|final", label: "Title Decider", archetype: "quest" }, { match: "record", label: "Record Chase", archetype: "quest" }] },
  }).map(([key, profile]) => [key, Object.freeze({ ...profile, signals: Object.freeze(profile.signals.map(Object.freeze)) })])));

  const narrativeProfileKeyByDomainId = Object.freeze({
    "sport:motorsport": "motorsport",
    "sport:extreme": "extreme",
    "sport:surf": "surf",
    "sport:rugby-union": "rugby",
    "sport:tennis": "tennis",
    "sport:football": "fifa",
    "sport:cycling": "cycling",
    "sport:cricket": "cricket",
    "sport:basketball": "nba",
    "sport:golf": "masters",
    "sport:american-football": "nfl",
    "sport:ice-hockey": "ice-hockey",
    "sport:skiing": "ski",
    "sport:athletics": "cwg",
    "sport:swimming": "cwg",
    "sport:netball": "cwg",
    "sport:hockey": "cwg",
    "sport:gymnastics": "cwg",
    "sport:boxing": "cwg",
    "sport:multi-sport": "cwg",
    "special:commonwealth-games": "cwg",
  });

  // Adding a surfaced sport starts here. Rendering, filters, and selector choices
  // derive from these records instead of requiring a bespoke UI branch.
  const domains = [
    { key: "f1", domainId: "sport:motorsport", label: "F1", selectorLabel: "F1", detail: "Qualifying, races, driver and constructor standings.", color: "var(--c-f1)", glyph: "sport:motorsport", sortOrder: 10, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "motorsport", domainId: "sport:motorsport", label: "Motorsport", selectorLabel: "Motorsport", detail: "Cross-discipline motorsport coverage spanning rally, endurance and performance events.", color: "var(--c-motorsport)", glyph: "sport:motorsport", sortOrder: 15, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "extreme", domainId: "sport:extreme", label: "Extreme", selectorLabel: "Extreme", detail: "Skateboarding, big drops and gravity sports.", color: "var(--c-extreme)", glyph: "sport:extreme", sortOrder: 17, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "rally", domainId: "sport:motorsport", label: "Rally", selectorLabel: "Rally", detail: "Stage-based rally events and cross-country runs.", color: "var(--c-motorsport)", glyph: "sport:motorsport", sortOrder: 18, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "goodwood", domainId: "sport:motorsport", label: "Goodwood Festival", selectorLabel: "Goodwood Festival", detail: "Hill climbs, exhibition runs and fan-facing competition.", color: "var(--c-lemans)", glyph: "sport:motorsport", sortOrder: 19, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "wsl", domainId: "sport:surf", label: "Surfing", selectorLabel: "Surfing", detail: "WSL and related high-significance surf events.", color: "var(--c-surf)", glyph: "sport:surf", sortOrder: 22, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "big-wave", domainId: "sport:surf", label: "Big Wave", selectorLabel: "Big-wave Surfing", detail: "Big-wave windows and specialist events in deep-ocean conditions.", color: "var(--c-surf)", glyph: "sport:surf", sortOrder: 23, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "surf", domainId: "sport:surf", label: "Surfing", selectorLabel: "Surf", detail: "WSL and major surf events, including Big Wave windows.", color: "var(--c-surf)", sortOrder: 24, supportsLadders: false, supportsNarrative: true, selector: false, glyph: "sport:surf" },
    { key: "downhill-mtb", domainId: "sport:extreme", label: "Downhill MTB", selectorLabel: "Downhill MTB", detail: "High-skill gravity MTB events across major courses.", color: "var(--c-extreme)", glyph: "sport:extreme", sortOrder: 25, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "mtb", domainId: "sport:extreme", label: "MTB", selectorLabel: "MTB", detail: "Mountain-bike races and gravity events.", color: "var(--c-extreme)", glyph: "sport:extreme", sortOrder: 25.1, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "cycling", domainId: "sport:cycling", label: "Cycling", selectorLabel: "Cycling", detail: "Key cycling fixtures and select title events.", color: "var(--c-cycling)", glyph: "sport:cycling", sortOrder: 26, selector: false, supportsLadders: false, supportsNarrative: true },
    { key: "telemark", domainId: "sport:skiing", label: "Telemark", selectorLabel: "Telemark", detail: "Telemark-specific world cup events and title rounds.", color: "var(--c-ski)", glyph: "sport:skiing", sortOrder: 27, selector: false, supportsLadders: false, supportsNarrative: true },
    { key: "skateboard", domainId: "sport:extreme", label: "Skateboarding", selectorLabel: "Skateboarding", detail: "Park, bowl and big audience street competitions.", color: "var(--c-extreme)", glyph: "sport:extreme", sortOrder: 28, selector: false, supportsLadders: false, supportsNarrative: true },
    { key: "rugby", domainId: "sport:rugby-union", label: "Rugby", selectorLabel: "Rugby", detail: "Wallabies Tests and major international windows.", color: "var(--c-rugby)", glyph: "sport:rugby", sortOrder: 20, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "tennis", domainId: "sport:tennis", label: "Tennis", selectorLabel: "Tennis", detail: "ATP and WTA marquee tournaments, Top 50 players, Australians, and followed athletes.", color: "var(--c-tennis)", glyph: "sport:tennis", sortOrder: 29, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "wimbledon", domainId: "sport:tennis", label: "Wimbledon", selectorLabel: "Tennis", detail: "Grand Slam rounds, finals, competitor follows, and ATP ranking context.", color: "var(--c-tennis)", glyph: "sport:tennis", sortOrder: 30, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "fifa", domainId: "sport:football", label: "FIFA World Cup", selectorLabel: "Football / World Cup", detail: "Socceroos and knockout-stage World Cup matches.", color: "var(--c-football)", glyph: "sport:football", sortOrder: 40, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "premier-league", domainId: "sport:football", label: "Premier League", selectorLabel: "Premier League", detail: "Every 2026/27 English Premier League fixture, with club follows, the official table and schedule refreshes.", color: "var(--c-football)", glyph: "sport:football", sortOrder: 41, selector: false, supportsLadders: true, supportsNarrative: true },
    { key: "tdf", domainId: "sport:cycling", label: "Tour de France", selectorLabel: "Le Tour de France", detail: "Mountain stages, rider follows, and spoiler-protected stage jersey changes.", color: "var(--c-cycling)", glyph: "sport:cycling", sortOrder: 50, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nrl", domainId: "sport:nrl", label: "NRL", selectorLabel: "Rugby League", detail: "Every premiership fixture, the live ladder, finals, and Grand Final.", color: "var(--c-nrl)", glyph: "sport:rugby", sortOrder: 60, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "afl", domainId: "sport:afl", label: "AFL", selectorLabel: "AFL", detail: "Every premiership fixture, the live ladder, and the finals series.", color: "var(--c-afl)", glyph: "sport:australian-football", sortOrder: 70, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "cricket", domainId: "sport:cricket", label: "Cricket", selectorLabel: "Cricket", detail: "Australian Tests and summer headline matches.", color: "var(--c-cricket)", glyph: "sport:cricket", sortOrder: 80, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nba", domainId: "sport:basketball", label: "NBA", selectorLabel: "NBA Finals", detail: "Finals games, team and top-competitor follows, and conference standings.", color: "var(--c-nba)", glyph: "sport:basketball", sortOrder: 90, selector: true, supportsLadders: true, supportsNarrative: true },
    { key: "masters", domainId: "sport:golf", label: "Masters", selectorLabel: "Masters Golf", detail: "Augusta rounds and Sunday contention windows.", color: "var(--c-golf)", glyph: "sport:golf", sortOrder: 100, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "lemans", domainId: "sport:motorsport", label: "Le Mans", selectorLabel: "Le Mans", detail: "24 Hours start and finish windows.", color: "var(--c-lemans)", glyph: "sport:motorsport", sortOrder: 110, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "nfl", domainId: "sport:american-football", label: "Super Bowl", selectorLabel: "Super Bowl", detail: "The NFL championship event.", color: "var(--c-nfl)", glyph: "sport:american-football", sortOrder: 120, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "ski", domainId: "sport:skiing", label: "Ski/Alpine", selectorLabel: "Alpine / Freestyle Skiing", detail: "World Cup and finals events.", color: "var(--c-ski)", glyph: "sport:skiing", sortOrder: 130, selector: true, supportsLadders: false, supportsNarrative: true },
    { key: "alpine", domainId: "sport:skiing", label: "Alpine", selectorLabel: "Alpine", detail: "Alpine races and title events.", color: "var(--c-ski)", glyph: "sport:skiing", sortOrder: 131, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "freestyle", domainId: "sport:skiing", label: "Freestyle", selectorLabel: "Freestyle", detail: "Freestyle skiing finals and major events.", color: "var(--c-ski)", glyph: "sport:skiing", sortOrder: 132, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "football", domainId: "sport:football", label: "Football", selectorLabel: "Football", detail: "Major football fixtures, tournaments and supported league tables.", color: "var(--c-football)", glyph: "sport:football", sortOrder: 141, selector: false, supportsLadders: true, supportsNarrative: false },
    { key: "basketball", domainId: "sport:basketball", label: "Basketball", selectorLabel: "Basketball", detail: "Major basketball fixtures and finals.", color: "var(--c-nba)", glyph: "sport:basketball", sortOrder: 142, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "golf", domainId: "sport:golf", label: "Golf", selectorLabel: "Golf", detail: "Major golf rounds and title events.", color: "var(--c-golf)", glyph: "sport:golf", sortOrder: 143, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "american-football", domainId: "sport:american-football", label: "American Football", selectorLabel: "American Football", detail: "Major American football fixtures and finals.", color: "var(--c-nfl)", glyph: "sport:american-football", sortOrder: 144, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "ice-hockey", domainId: "sport:ice-hockey", label: "Ice Hockey", selectorLabel: "Ice Hockey", detail: "NHL and Champions Hockey League teams, fixtures, tables and knockout rounds.", color: "#1687d9", glyph: "sport:ice-hockey", sortOrder: 145, selector: false, supportsLadders: true, supportsNarrative: true },
    { key: "athletics", domainId: "sport:athletics", label: "Athletics", selectorLabel: "Athletics", detail: "Track and field finals and major sessions.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 150, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "swimming", domainId: "sport:swimming", label: "Swimming", selectorLabel: "Swimming", detail: "Major swimming sessions and finals.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 151, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "netball", domainId: "sport:netball", label: "Netball", selectorLabel: "Netball", detail: "Major netball fixtures and finals.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 152, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "hockey", domainId: "sport:hockey", label: "Field Hockey (legacy)", selectorLabel: "Field Hockey (legacy)", detail: "Historical Commonwealth Games compatibility only.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 153, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "gymnastics", domainId: "sport:gymnastics", label: "Gymnastics (legacy)", selectorLabel: "Gymnastics (legacy)", detail: "Historical Commonwealth Games compatibility only.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 154, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "boxing", domainId: "sport:boxing", label: "Boxing", selectorLabel: "Boxing", detail: "Major boxing bouts and medal sessions.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 155, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "multi-sport", domainId: "sport:multi-sport", label: "Commonwealth Games compatibility", selectorLabel: "Commonwealth Games compatibility", detail: "Historical multi-sport event compatibility only.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 156, selector: false, supportsLadders: false, supportsNarrative: false },
    { key: "cwg", domainId: "special:commonwealth-games", label: "Commonwealth Games", selectorLabel: "Commonwealth Games", detail: "Curated Glasgow 2026 sessions, top-competitor follows, and a spoiler-protected medal table.", color: "var(--c-cwg)", glyph: "sport:multi-sport", sortOrder: 140, selector: false, supportsLadders: true, supportsNarrative: true },
  ].map(domain => Object.freeze({
    ...domain,
    narrativeProfile: narrativeProfiles[domain.key] || narrativeProfiles[narrativeProfileKeyByDomainId[domain.domainId]],
  }));

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
