(function attachNothingSportsFineTuning(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FINE_TUNING = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFineTuning(){
  "use strict";

  const SCHEMA_VERSION = "fine-tuning.v1";
  const sections = [
    {
      id: "broad",
      title: "Sports & marquee events",
      detail: "Set the broad shape of your curated feed first.",
      targets: [
        ["sport", "sport:nrl", "NRL", "Rounds, rivalries and finals.", "sport:nrl", "sport:rugby"],
        ["sport", "sport:afl", "AFL", "Premiership rounds and finals.", "sport:afl", "sport:australian-football"],
        ["sport", "sport:motorsport", "Motorsport", "Formula 1 and endurance racing.", "sport:motorsport", "sport:motorsport"],
        ["sport", "sport:rugby-union", "Rugby Union", "Wallabies Tests and major tours.", "sport:rugby-union", "sport:rugby"],
        ["sport", "sport:tennis", "Tennis", "Majors, finals and leading players.", "sport:tennis", "sport:tennis"],
        ["sport", "sport:football", "Football", "International tournaments and major ties.", "sport:football", "sport:football"],
        ["sport", "sport:cycling", "Cycling", "Grand Tours and decisive stages.", "sport:cycling", "sport:cycling"],
        ["sport", "sport:basketball", "Basketball", "NBA contenders, playoffs and Finals.", "sport:basketball", "sport:basketball"],
        ["event_family", "special:wimbledon", "Wimbledon", "Deep runs, finals and Australian interest.", "sport:tennis", "sport:tennis"],
        ["event_family", "special:fifa-world-cup", "FIFA World Cup", "Socceroos and knockout football.", "sport:football", "sport:football"],
      ],
    },
    {
      id: "teams",
      title: "Competitions & teams",
      detail: "Tell Nothing Sport which recurring competitions and teams deserve more weight.",
      targets: [
        ["competition", "competition:nrl-premiership-2026", "NRL Premiership", "The complete Australian rugby league season.", "sport:nrl", "sport:rugby"],
        ["competition", "competition:afl-premiership-2026", "AFL Premiership", "The complete Australian football season.", "sport:afl", "sport:australian-football"],
        ["team", "team:nrl:323", "Canberra Raiders", "Raiders fixtures and rivalry matches.", "sport:nrl", "sport:rugby"],
        ["team", "team:nrl:329", "Penrith Panthers", "Panthers fixtures and title runs.", "sport:nrl", "sport:rugby"],
        ["team", "team:nrl:324", "Melbourne Storm", "Storm fixtures and title runs.", "sport:nrl", "sport:rugby"],
        ["team", "team:afl:cd_t160", "Sydney Swans", "Swans fixtures and finals stakes.", "sport:afl", "sport:australian-football"],
        ["team", "team:afl:cd_t40", "Collingwood", "Magpies fixtures and rivalry matches.", "sport:afl", "sport:australian-football"],
        ["team", "team:afl:cd_t20", "Brisbane Lions", "Lions fixtures and finals stakes.", "sport:afl", "sport:australian-football"],
        ["team", "team:f1:mclaren", "McLaren", "McLaren race weekends and title implications.", "sport:motorsport", "sport:motorsport"],
        ["team", "team:nba:oklahoma-city-thunder", "Oklahoma City Thunder", "Thunder contenders and playoff games.", "sport:basketball", "sport:basketball"],
      ],
    },
    {
      id: "people",
      title: "Players & event families",
      detail: "Add the recognisable people and event types that make a card personally relevant.",
      targets: [
        ["player", "competitor:f1:oscar-piastri", "Oscar Piastri", "Australian interest across Formula 1.", "sport:motorsport", "sport:motorsport"],
        ["player", "competitor:f1:max-verstappen", "Max Verstappen", "Championship fights and race weekends.", "sport:motorsport", "sport:motorsport"],
        ["player", "competitor:tennis:atp:alex-de-minaur", "Alex de Minaur", "Australian runs across the ATP Tour.", "sport:tennis", "sport:tennis"],
        ["player", "competitor:tennis:atp:jannik-sinner", "Jannik Sinner", "Major runs and top-level matchups.", "sport:tennis", "sport:tennis"],
        ["player", "competitor:cycling:tdf:tadej-pogacar", "Tadej Pogačar", "Tour stages and general-classification battles.", "sport:cycling", "sport:cycling"],
        ["player", "competitor:nba:victor-wembanyama", "Victor Wembanyama", "Major NBA matchups and award races.", "sport:basketball", "sport:basketball"],
        ["event_family", "special:tour-de-france", "Tour de France", "Mountains, time trials and the Paris finish.", "sport:cycling", "sport:cycling"],
        ["event_family", "special:masters-tournament", "Masters Tournament", "Augusta contention and the Sunday finish.", "sport:golf", "sport:golf"],
        ["event_family", "special:le-mans-24-hours", "24 Hours of Le Mans", "Start, overnight story and finish.", "sport:motorsport", "sport:motorsport"],
        ["event_family", "special:commonwealth-games", "Commonwealth Games", "Australian medal events across the Games.", "sport:multi-sport", "sport:multi-sport"],
      ],
    },
  ].map((section, sectionIndex) => Object.freeze({
    id: section.id,
    title: section.title,
    detail: section.detail,
    index: sectionIndex,
    targets: Object.freeze(section.targets.map(([
      targetType,
      targetId,
      label,
      detail,
      domainId,
      glyph,
    ], targetIndex) => Object.freeze({
      id: `tune:${section.id}:${targetIndex + 1}`,
      targetType,
      targetId,
      label,
      detail,
      domainId,
      glyph,
    }))),
  }));

  const targets = sections.flatMap(section => section.targets);

  function targetKey(target){
    return `${target?.targetType || ""}:${target?.targetId || ""}`;
  }

  function selectedValue(graph, target){
    const key = targetKey(target);
    const signal = (graph?.learning?.signals || []).find(candidate => targetKey(candidate) === key);
    return signal?.value === 1 || signal?.value === -1 ? signal.value : 0;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    sections: Object.freeze(sections),
    targets: Object.freeze(targets),
    targetKey,
    selectedValue,
  });
});
