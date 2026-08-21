(function attachNothingSportsHierarchy(root, factory){
  const hierarchy = factory();
  root.NOTHINGSPORTS_SPORT_HIERARCHY = hierarchy;
  if (typeof module !== "undefined" && module.exports) module.exports = hierarchy;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsHierarchy(){
  "use strict";

  const nodes = [
    ["sport:australian-football", "Australian football", "sport", null, ["AFL", "Aussie rules"]],
    ["discipline:australian-football:elite", "Elite Australian football", "discipline", "sport:australian-football"],
    ["competition:afl-premiership", "AFL Premiership", "competition", "discipline:australian-football:elite"],

    ["sport:rugby-league", "Rugby league", "sport", null, ["League"]],
    ["discipline:rugby-league:domestic", "Domestic rugby league", "discipline", "sport:rugby-league"],
    ["discipline:rugby-league:representative", "Representative rugby league", "discipline", "sport:rugby-league"],
    ["discipline:rugby-league:international", "International rugby league", "discipline", "sport:rugby-league"],
    ["competition:nrl-premiership", "NRL Premiership", "competition", "discipline:rugby-league:domestic", ["NRL"]],
    ["competition:nrlw-premiership", "NRLW Premiership", "competition", "discipline:rugby-league:domestic", ["NRLW"]],
    ["competition:state-of-origin", "State of Origin", "competition", "discipline:rugby-league:representative"],
    ["competition:rugby-league-world-cup", "Rugby League World Cup", "competition", "discipline:rugby-league:international", ["RLWC"]],

    ["sport:rugby-union", "Rugby union", "sport", null, ["Rugby"]],
    ["discipline:rugby-union:test", "Test rugby", "discipline", "sport:rugby-union"],
    ["discipline:rugby-union:club", "Club rugby", "discipline", "sport:rugby-union"],
    ["discipline:rugby-union:sevens", "Rugby sevens", "discipline", "sport:rugby-union"],
    ["competition:rugby-union-tests", "International rugby Tests", "competition", "discipline:rugby-union:test", ["Wallabies"]],
    ["competition:rugby-championship", "The Rugby Championship", "competition", "discipline:rugby-union:test"],
    ["competition:super-rugby", "Super Rugby", "competition", "discipline:rugby-union:club"],
    ["competition:six-nations", "Six Nations", "competition", "discipline:rugby-union:test"],

    ["sport:tennis", "Tennis", "sport"],
    ["discipline:tennis:professional", "Professional tennis", "discipline", "sport:tennis"],
    ["competition:atp-tour", "ATP Tour", "competition", "discipline:tennis:professional", ["ATP"]],
    ["competition:wta-tour", "WTA Tour", "competition", "discipline:tennis:professional", ["WTA"]],
    ["competition:grand-slams", "Grand Slams", "competition", "discipline:tennis:professional"],
    ["competition:davis-cup", "Davis Cup", "competition", "discipline:tennis:professional"],
    ["competition:billie-jean-king-cup", "Billie Jean King Cup", "competition", "discipline:tennis:professional", ["BJK Cup"]],
    ["event-series:wimbledon", "Wimbledon", "event_series", "competition:grand-slams"],
    ["event-series:national-bank-open", "National Bank Open", "event_series", "competition:wta-tour", ["Toronto WTA 1000", "Montreal WTA 1000"]],

    ["sport:football", "Football", "sport", null, ["Soccer"]],
    ["discipline:football:international", "International football", "discipline", "sport:football"],
    ["discipline:football:club", "Club football", "discipline", "sport:football"],
    ["competition:fifa-world-cup", "FIFA World Cup", "competition", "discipline:football:international"],
    ["competition:afc", "AFC competitions", "competition", "discipline:football:international"],
    ["competition:a-leagues", "A-Leagues", "competition", "discipline:football:club"],
    ["competition:premier-league", "Premier League", "competition", "discipline:football:club"],
    ["competition:uefa", "UEFA competitions", "competition", "discipline:football:club"],

    ["sport:cricket", "Cricket", "sport"],
    ["discipline:cricket:international", "International cricket", "discipline", "sport:cricket"],
    ["discipline:cricket:domestic", "Domestic cricket", "discipline", "sport:cricket"],
    ["competition:cricket-international", "International cricket", "competition", "discipline:cricket:international", ["Tests", "ODIs", "T20Is"]],
    ["competition:bbl", "Big Bash League", "competition", "discipline:cricket:domestic", ["BBL"]],
    ["competition:wbbl", "Women's Big Bash League", "competition", "discipline:cricket:domestic", ["WBBL"]],
    ["competition:ipl", "Indian Premier League", "competition", "discipline:cricket:domestic", ["IPL"]],

    ["sport:motorsport", "Motorsport", "sport"],
    ["discipline:motorsport:open-wheel", "Open-wheel racing", "discipline", "sport:motorsport"],
    ["discipline:motorsport:motorcycle", "Motorcycle racing", "discipline", "sport:motorsport"],
    ["discipline:motorsport:touring", "Touring cars", "discipline", "sport:motorsport"],
    ["discipline:motorsport:endurance", "Endurance racing", "discipline", "sport:motorsport"],
    ["discipline:motorsport:rally", "Rally", "discipline", "sport:motorsport"],
    ["discipline:motorsport:culture", "Motoring culture", "discipline", "sport:motorsport"],
    ["competition:formula-one", "Formula 1", "competition", "discipline:motorsport:open-wheel", ["F1"]],
    ["competition:motogp", "MotoGP", "competition", "discipline:motorsport:motorcycle"],
    ["competition:supercars", "Supercars Championship", "competition", "discipline:motorsport:touring"],
    ["competition:world-endurance-championship", "World Endurance Championship", "competition", "discipline:motorsport:endurance", ["WEC"]],
    ["competition:nascar", "NASCAR", "competition", "discipline:motorsport:touring"],
    ["competition:world-rally", "World rally events", "competition", "discipline:motorsport:rally"],
    ["competition:motorsport-culture", "Motoring culture events", "competition", "discipline:motorsport:culture"],
    ["event-series:goodwood-festival-of-speed", "Goodwood Festival of Speed", "event_series", "competition:motorsport-culture", ["Goodwood"]],
    ["event-series:le-mans-24-hours", "24 Hours of Le Mans", "event_series", "competition:world-endurance-championship", ["Le Mans"]],

    ["sport:combat-sports", "Combat sports", "sport"],
    ["discipline:combat:boxing", "Boxing", "discipline", "sport:combat-sports"],
    ["discipline:combat:mma", "Mixed martial arts", "discipline", "sport:combat-sports", ["MMA"]],
    ["discipline:combat:kickboxing", "Kickboxing", "discipline", "sport:combat-sports"],
    ["discipline:combat:grappling", "Grappling", "discipline", "sport:combat-sports"],
    ["competition:ufc", "UFC", "competition", "discipline:combat:mma"],
    ["competition:pfl", "Professional Fighters League", "competition", "discipline:combat:mma", ["PFL"]],
    ["competition:one-championship", "ONE Championship", "competition", "discipline:combat:mma", ["ONE"]],

    ["sport:cycling", "Cycling", "sport"],
    ["discipline:cycling:road", "Road cycling", "discipline", "sport:cycling"],
    ["discipline:cycling:track", "Track cycling", "discipline", "sport:cycling"],
    ["discipline:cycling:mountain-bike", "Mountain biking", "discipline", "sport:cycling", ["MTB"]],
    ["discipline:cycling:bmx", "BMX", "discipline", "sport:cycling"],
    ["competition:uci-worldtour", "UCI WorldTour", "competition", "discipline:cycling:road", ["WorldTour"]],
    ["competition:uci-mountain-bike", "UCI Mountain Bike", "competition", "discipline:cycling:mountain-bike"],
    ["event-series:tour-de-france", "Tour de France", "event_series", "competition:uci-worldtour"],

    ["sport:winter-sports", "Winter sports", "sport", null, ["Skiing"]],
    ["discipline:winter:alpine", "Alpine skiing", "discipline", "sport:winter-sports"],
    ["discipline:winter:freestyle", "Freestyle skiing", "discipline", "sport:winter-sports"],
    ["discipline:winter:nordic", "Nordic skiing", "discipline", "sport:winter-sports"],
    ["discipline:winter:ice", "Ice sports", "discipline", "sport:winter-sports"],
    ["discipline:winter:telemark", "Telemark skiing", "discipline", "sport:winter-sports"],
    ["competition:fis-alpine", "FIS Alpine", "competition", "discipline:winter:alpine"],
    ["competition:fis-freestyle", "FIS Freestyle", "competition", "discipline:winter:freestyle"],
    ["competition:biathlon", "Biathlon", "competition", "discipline:winter:nordic"],
    ["competition:telemark-world-cup", "Telemark World Cup", "competition", "discipline:winter:telemark"],

    ["sport:golf", "Golf", "sport"],
    ["discipline:golf:mens", "Men's golf", "discipline", "sport:golf"],
    ["discipline:golf:womens", "Women's golf", "discipline", "sport:golf"],
    ["discipline:golf:team", "Team golf", "discipline", "sport:golf"],
    ["competition:pga-tour", "PGA Tour", "competition", "discipline:golf:mens"],
    ["competition:lpga-tour", "LPGA Tour", "competition", "discipline:golf:womens"],
    ["competition:dp-world-tour", "DP World Tour", "competition", "discipline:golf:mens"],
    ["competition:golf-majors", "Golf majors", "competition", "discipline:golf:mens"],
    ["event-series:masters-tournament", "Masters Tournament", "event_series", "competition:golf-majors", ["The Masters"]],

    ["sport:horse-racing", "Horse racing", "sport"],
    ["discipline:horse-racing:thoroughbred", "Thoroughbred racing", "discipline", "sport:horse-racing"],
    ["discipline:horse-racing:harness", "Harness racing", "discipline", "sport:horse-racing"],
    ["competition:australian-thoroughbred", "Australian thoroughbred racing", "competition", "discipline:horse-racing:thoroughbred"],
    ["event-series:melbourne-cup-carnival", "Melbourne Cup Carnival", "event_series", "competition:australian-thoroughbred"],
    ["event-series:the-everest", "The Everest", "event_series", "competition:australian-thoroughbred"],

    ["sport:basketball", "Basketball", "sport"],
    ["discipline:basketball:professional", "Professional basketball", "discipline", "sport:basketball"],
    ["competition:nba", "National Basketball Association", "competition", "discipline:basketball:professional", ["NBA"]],

    ["sport:american-football", "American football", "sport"],
    ["discipline:american-football:professional", "Professional American football", "discipline", "sport:american-football"],
    ["competition:nfl", "National Football League", "competition", "discipline:american-football:professional", ["NFL"]],
    ["event-series:super-bowl", "Super Bowl", "event_series", "competition:nfl"],

    ["sport:multi-sport", "Multi-sport Games", "sport"],
    ["discipline:multi-sport:games", "Games", "discipline", "sport:multi-sport"],
    ["competition:commonwealth-games", "Commonwealth Games", "competition", "discipline:multi-sport:games"],
    ["competition:olympic-games", "Olympic Games", "competition", "discipline:multi-sport:games"],
    ["competition:paralympic-games", "Paralympic Games", "competition", "discipline:multi-sport:games"],
    ["event-series:commonwealth-games", "Commonwealth Games edition", "event_series", "competition:commonwealth-games", ["Glasgow 2026"]],

    ["sport:athletics", "Athletics", "sport"],
    ["sport:swimming", "Swimming", "sport"],
    ["sport:netball", "Netball", "sport"],
    ["sport:hockey", "Hockey", "sport"],
    ["sport:gymnastics", "Gymnastics", "sport"],

    ["sport:extreme-sports", "Extreme sports", "sport"],
    ["discipline:extreme:skateboarding", "Skateboarding", "discipline", "sport:extreme-sports"],
    ["competition:extreme-world-events", "Extreme sport world events", "competition", "discipline:extreme:skateboarding"],

    ["sport:surfing", "Surfing", "sport"],
    ["discipline:surfing:professional", "Professional surfing", "discipline", "sport:surfing"],
    ["discipline:surfing:big-wave", "Big-wave surfing", "discipline", "sport:surfing"],
    ["competition:world-surf-league", "World Surf League", "competition", "discipline:surfing:professional", ["WSL"]],
    ["competition:big-wave-events", "Big-wave events", "competition", "discipline:surfing:big-wave"],
  ].map(([id, label, level, parentId, aliases]) => Object.freeze({
    id,
    label,
    level,
    ...(parentId ? { parentId } : {}),
    aliases: Object.freeze(Array.isArray(aliases) ? aliases : []),
    active: true,
  }));

  const legacyIds = Object.freeze({
    "sport:afl": "sport:australian-football",
    "sport:nrl": "sport:rugby-league",
    "sport:f1": "competition:formula-one",
    "sport:rally": "competition:world-rally",
    "sport:goodwood": "event-series:goodwood-festival-of-speed",
    "sport:wsl": "competition:world-surf-league",
    "sport:big-wave": "competition:big-wave-events",
    "sport:downhill-mtb": "competition:uci-mountain-bike",
    "sport:rugby": "sport:rugby-union",
    "sport:nba": "competition:nba",
    "sport:skiing": "sport:winter-sports",
    "sport:extreme": "sport:extreme-sports",
    "sport:surf": "sport:surfing",
    "sport:boxing": "discipline:combat:boxing",
    "special:wimbledon": "event-series:wimbledon",
    "special:fifa-world-cup": "competition:fifa-world-cup",
    "special:tour-de-france": "event-series:tour-de-france",
    "special:masters-tournament": "event-series:masters-tournament",
    "special:le-mans-24-hours": "event-series:le-mans-24-hours",
    "special:super-bowl": "event-series:super-bowl",
    "special:commonwealth-games": "event-series:commonwealth-games",
    "competition:afl-premiership-2026": "competition:afl-premiership",
    "competition:nrl-premiership-2026": "competition:nrl-premiership",
    "competition:f1-drivers-2026": "competition:formula-one",
    "competition:f1-constructors-2026": "competition:formula-one",
    "competition:atp-singles-2026": "competition:atp-tour",
    "competition:tour-de-france-stage-jerseys-2026": "event-series:tour-de-france",
    "competition:nba-eastern-conference-2025-26": "competition:nba",
    "competition:nba-western-conference-2025-26": "competition:nba",
    "competition:glasgow-2026-medal-table": "event-series:commonwealth-games",
  });

  const legacySportKeys = Object.freeze({
    f1: "competition:formula-one",
    motorsport: "competition:motorsport-culture",
    extreme: "competition:extreme-world-events",
    rally: "competition:world-rally",
    goodwood: "event-series:goodwood-festival-of-speed",
    wsl: "competition:world-surf-league",
    "big-wave": "competition:big-wave-events",
    surf: "competition:world-surf-league",
    "downhill-mtb": "competition:uci-mountain-bike",
    mtb: "competition:uci-mountain-bike",
    cycling: "competition:uci-worldtour",
    telemark: "competition:telemark-world-cup",
    skateboard: "competition:extreme-world-events",
    rugby: "competition:rugby-union-tests",
    tennis: "sport:tennis",
    wimbledon: "event-series:wimbledon",
    fifa: "competition:fifa-world-cup",
    "premier-league": "competition:premier-league",
    tdf: "event-series:tour-de-france",
    nrl: "competition:nrl-premiership",
    afl: "competition:afl-premiership",
    cricket: "competition:cricket-international",
    nba: "competition:nba",
    masters: "event-series:masters-tournament",
    lemans: "event-series:le-mans-24-hours",
    nfl: "event-series:super-bowl",
    ski: "competition:fis-alpine",
    alpine: "competition:fis-alpine",
    freestyle: "competition:fis-freestyle",
    football: "sport:football",
    basketball: "sport:basketball",
    golf: "sport:golf",
    "american-football": "sport:american-football",
    athletics: "sport:athletics",
    swimming: "sport:swimming",
    netball: "sport:netball",
    hockey: "sport:hockey",
    gymnastics: "sport:gymnastics",
    boxing: "discipline:combat:boxing",
    "multi-sport": "sport:multi-sport",
    cwg: "event-series:commonwealth-games",
  });

  const byId = new Map(nodes.map(node => [node.id, node]));

  function canonicalNodeId(value){
    const id = String(value || "");
    if (byId.has(id)) return id;
    const legacySportKey = id.startsWith("sport:") ? id.slice("sport:".length) : id;
    return legacyIds[id] || legacySportKeys[id] || legacySportKeys[legacySportKey] || null;
  }

  function lineageFor(value){
    const id = canonicalNodeId(value);
    const lineage = [];
    const seen = new Set();
    let current = id ? byId.get(id) : null;
    while (current && !seen.has(current.id)){
      lineage.unshift(current);
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    return lineage;
  }

  return Object.freeze({
    schemaVersion: "sport-hierarchy.v1",
    levels: Object.freeze(["sport", "discipline", "competition", "event_series"]),
    nodes: Object.freeze(nodes),
    legacyIds,
    legacySportKeys,
    canonicalNodeId,
    lineageFor,
  });
});
