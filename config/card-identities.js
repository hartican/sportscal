(function attachNothingSportsCardIdentities(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_CARD_IDENTITIES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsCardIdentities(){
  "use strict";

  const OFFICIAL_REFERENCE_USE = Object.freeze({
    assetClass: "official-reference",
    rightsStatus: "official-reference",
    provenance: "official-site",
    displayUse: "editorial-identification",
  });

  function officialMark(id, label, url, sourceUrl, options = {}){
    return Object.freeze({ id, label, url, sourceUrl, fit: options.fit || "contain", ...OFFICIAL_REFERENCE_USE });
  }

  function sportMark(key, label, glyph, wordmark = ""){
    return Object.freeze({
      id: `sport:${key}`,
      kind: "sport",
      label,
      glyph,
      wordmark,
      assetClass: "open-use",
      rightsStatus: "open-use",
      provenance: "licensed-library",
      displayUse: "editorial-identification",
      sourceUrl: "https://github.com/ookamiinc/sporticon",
    });
  }

  const eventMarks = Object.freeze({
    nrl: officialMark("competition:nrl", "NRL", "https://www.nrl.com/siteassets/.lookups/sponsors/2026-special/together-round/nrl-logo.svg", "https://www.nrl.com/clubs/"),
    afl: officialMark("competition:afl", "AFL", "https://resources.afl.com.au/photo-resources/2019/12/05/9afccce2-87db-4a20-abcc-0c62c6516b3d/afl-logo.png?width=256&height=128", "https://www.afl.com.au/teams"),
    wimbledon: officialMark("brand:wimbledon", "Wimbledon", "https://www.wimbledon.com/_next/static/media/Logo-Wimbledon.2wyelfplbl7j4.svg", "https://www.wimbledon.com/"),
    "roland-garros": officialMark("brand:roland-garros", "Roland Garros", "https://www.rolandgarros.com/img/logo-rg-mobile.svg", "https://www.rolandgarros.com/"),
  });

  // A local, open-use sport mark covers every supported sport. This avoids
  // treating a governing body's protected trademark as the app's own identity.
  const sportMarks = Object.freeze({
    f1: sportMark("f1", "Formula One", "sport:motorsport", "F1"),
    motorsport: sportMark("motorsport", "Motorsport", "sport:motorsport"),
    rally: sportMark("rally", "Rally", "sport:motorsport"),
    goodwood: sportMark("goodwood", "Goodwood motorsport", "sport:motorsport"),
    lemans: sportMark("lemans", "Endurance motorsport", "sport:motorsport"),
    extreme: sportMark("extreme", "Extreme sport", "sport:extreme"),
    "downhill-mtb": sportMark("downhill-mtb", "Downhill mountain biking", "sport:extreme"),
    mtb: sportMark("mtb", "Mountain biking", "sport:extreme"),
    skateboard: sportMark("skateboard", "Skateboarding", "sport:extreme"),
    wsl: sportMark("wsl", "Surfing", "sport:surf"),
    "big-wave": sportMark("big-wave", "Big-wave surfing", "sport:surf"),
    surf: sportMark("surf", "Surfing", "sport:surf"),
    telemark: sportMark("telemark", "Telemark skiing", "sport:skiing"),
    ski: sportMark("ski", "Skiing", "sport:skiing"),
    alpine: sportMark("alpine", "Alpine skiing", "sport:skiing"),
    freestyle: sportMark("freestyle", "Freestyle skiing", "sport:skiing"),
    cycling: sportMark("cycling", "Cycling", "sport:cycling"),
    tdf: sportMark("tdf", "Tour cycling", "sport:cycling"),
    rugby: sportMark("rugby", "Rugby", "sport:rugby", "RUG"),
    tennis: sportMark("tennis", "Tennis", "sport:tennis"),
    fifa: sportMark("fifa", "Football", "sport:football"),
    football: sportMark("football", "Football", "sport:football"),
    cricket: sportMark("cricket", "Cricket", "sport:cricket", "CRK"),
    nba: sportMark("nba", "Basketball", "sport:basketball"),
    basketball: sportMark("basketball", "Basketball", "sport:basketball"),
    masters: sportMark("masters", "Golf", "sport:golf"),
    golf: sportMark("golf", "Golf", "sport:golf"),
    nfl: sportMark("nfl", "American football", "sport:american-football"),
    "american-football": sportMark("american-football", "American football", "sport:american-football"),
    cwg: sportMark("cwg", "Multi-sport games", "sport:multi-sport"),
    athletics: sportMark("athletics", "Athletics", "sport:multi-sport"),
    swimming: sportMark("swimming", "Swimming", "sport:multi-sport"),
    netball: sportMark("netball", "Netball", "sport:multi-sport"),
    hockey: sportMark("hockey", "Hockey", "sport:multi-sport"),
    gymnastics: sportMark("gymnastics", "Gymnastics", "sport:multi-sport"),
    boxing: sportMark("boxing", "Boxing", "sport:multi-sport"),
    "multi-sport": sportMark("multi-sport", "Multi-sport games", "sport:multi-sport"),
  });

  const nrlTeamSlugs = Object.freeze({
    "team:nrl:322": "broncos", "team:nrl:332": "bulldogs", "team:nrl:326": "cowboys", "team:nrl:9538": "dolphins", "team:nrl:330": "dragons", "team:nrl:328": "eels", "team:nrl:325": "knights", "team:nrl:329": "panthers", "team:nrl:335": "rabbitohs", "team:nrl:323": "raiders", "team:nrl:331": "roosters", "team:nrl:336": "sea-eagles", "team:nrl:333": "sharks", "team:nrl:324": "storm", "team:nrl:337": "titans", "team:nrl:321": "warriors", "team:nrl:334": "wests-tigers",
  });
  const nrlDefaultBadgeExceptions = new Set(["eels", "roosters", "titans"]);
  const aflTeamAssets = Object.freeze({
    "team:afl:cd_t10": ["Adelaide Crows", "https://resources.afl.com.au/photo-resources/2024/11/19/027ba733-e379-48d4-94a8-9b20c06a285f/Adelaide-Crows-16-9.png?width=270&height=152"],
    "team:afl:cd_t20": ["Brisbane Lions", "https://resources.afl.com.au/photo-resources/2023/08/11/41ce722c-142b-4b00-9de4-1e60c5a0aabd/BL.jpeg?width=270&height=152"],
    "team:afl:cd_t30": ["Carlton", "https://resources.afl.com.au/photo-resources/2023/08/11/35c0ff6e-c60e-4946-9a30-328aa3818140/CARL.jpeg?width=270&height=152"],
    "team:afl:cd_t40": ["Collingwood", "https://resources.afl.com.au/photo-resources/2023/08/11/480bd807-9b25-4b2f-ab29-f0ce15991049/COLL.jpeg?width=270&height=152"],
    "team:afl:cd_t50": ["Essendon", "https://resources.afl.com.au/photo-resources/2023/08/11/1bf4ca3f-fb53-4b72-b361-d4dcd1f3528f/ESS.jpeg?width=270&height=152"],
    "team:afl:cd_t60": ["Fremantle", "https://resources.afl.com.au/photo-resources/2023/08/11/c604e10a-9ae3-4083-90e3-7a99b36dfd50/FRE.jpeg?width=270&height=152"],
    "team:afl:cd_t70": ["Geelong Cats", "https://resources.afl.com.au/photo-resources/2023/08/11/82c0f2f0-a4ed-4623-bf20-c34e395b2a19/GEEL.jpeg?width=270&height=152"],
    "team:afl:cd_t1000": ["Gold Coast SUNS", "https://resources.afl.com.au/photo-resources/2024/11/19/bc20e892-5723-4761-b931-711ff2bf1240/Gold-Coast-SUNS-16-9.png?width=270&height=152"],
    "team:afl:cd_t1010": ["GWS GIANTS", "https://resources.afl.com.au/photo-resources/2023/08/11/e6740288-a035-4e2a-bf61-a1032a7609e2/GWS.png?width=270&height=152"],
    "team:afl:cd_t80": ["Hawthorn", "https://resources.afl.com.au/photo-resources/2023/08/11/e2db80ea-567c-41da-a3f8-3ec3977c688b/HAW.jpeg?width=270&height=152"],
    "team:afl:cd_t90": ["Melbourne", "https://resources.afl.com.au/photo-resources/2023/08/11/a97d65ce-b997-4edb-b79f-9477b063d704/MELB.jpeg?width=270&height=152"],
    "team:afl:cd_t100": ["North Melbourne", "https://resources.afl.com.au/photo-resources/2023/08/11/c5cf7f27-5aa1-4eed-8f39-28e4c20075bf/NMFC.jpeg?width=270&height=152"],
    "team:afl:cd_t110": ["Port Adelaide", "https://resources.afl.com.au/photo-resources/2023/08/11/0857230b-55f3-4b70-a15c-3d4076d7ab29/PORT.jpeg?width=270&height=152"],
    "team:afl:cd_t120": ["Richmond", "https://resources.afl.com.au/photo-resources/2023/08/11/50a71f61-e3c0-443c-a3c2-2d3a5040b1cd/RICH.jpeg?width=270&height=152"],
    "team:afl:cd_t130": ["St Kilda", "https://resources.afl.com.au/photo-resources/2024/11/19/472df204-e3ec-48f0-9a2a-e5c91b1e101f/ST-KILDA-NEW-LOGO-16x9.png?width=270&height=152"],
    "team:afl:cd_t160": ["Sydney Swans", "https://resources.afl.com.au/photo-resources/2023/08/11/875dfb95-9a71-4547-8edc-4cc4a67ab502/SYD.jpeg?width=270&height=152"],
    "team:afl:cd_t150": ["West Coast Eagles", "https://resources.afl.com.au/photo-resources/2023/08/11/e9e3449f-25d0-4ec8-b88c-0d5e01e8524e/WCE.jpeg?width=270&height=152"],
    "team:afl:cd_t140": ["Western Bulldogs", "https://resources.afl.com.au/photo-resources/2023/08/11/61392440-4084-419b-8371-55c9f922d099/WB.jpeg?width=270&height=152"],
  });

  const participantMarks = Object.freeze(Object.fromEntries([
    ...Object.entries(nrlTeamSlugs).map(([participantId, slug]) => [participantId, officialMark(`participant:${participantId}`, slug, `https://www.nrl.com/.theme/${slug}/${nrlDefaultBadgeExceptions.has(slug) ? "badge.svg" : "badge-light.svg"}`, "https://www.nrl.com/clubs/")]),
    ...Object.entries(aflTeamAssets).map(([participantId, [label, url]]) => [participantId, officialMark(`participant:${participantId}`, label, url, "https://www.afl.com.au/teams")]),
  ]));

  const brandRules = Object.freeze([
    Object.freeze({ id: "roland-garros", pattern: /\b(?:roland garros|french open)\b/i }),
    Object.freeze({ id: "wimbledon", pattern: /\b(?:wimbledon|the championships)\b/i }),
  ]);
  function eventSearchText(event){ return [event?.brandId, event?.competitionId, event?.series, event?.tournament, event?.name, event?.displayTitleCompact, event?.spoilerSafeTitle].filter(Boolean).join(" "); }
  function markForEvent(event){
    const brandRule = brandRules.find(rule => rule.pattern.test(eventSearchText(event)));
    if (brandRule) return eventMarks[brandRule.id] || null;
    return eventMarks[event?.key] || sportMarks[event?.key] || null;
  }
  function normalize(value){ return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en"); }
  function participantAliases(participant){ return Array.from(new Set([...(Array.isArray(participant?.metadata?.titleAliases) ? participant.metadata.titleAliases : []), participant?.shortName, participant?.displayName, participant?.canonicalName].map(value => String(value || "").trim()).filter(Boolean))).sort((left, right) => right.length - left.length); }
  function aliasRange(title, participant){
    const source = String(title || ""); const normalizedSource = normalize(source);
    for (const alias of participantAliases(participant)){
      const normalizedAlias = normalize(alias); let fromIndex = 0;
      while (fromIndex <= normalizedSource.length){
        const start = normalizedSource.indexOf(normalizedAlias, fromIndex); if (start < 0) break;
        const before = start === 0 ? "" : normalizedSource[start - 1]; const end = start + normalizedAlias.length; const after = end >= normalizedSource.length ? "" : normalizedSource[end];
        if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return { start, end, text: source.slice(start, end) };
        fromIndex = start + 1;
      }
    }
    return null;
  }
  function participantMarksForEvent(event, participants, title = ""){
    const participantList = Array.isArray(participants) ? participants : []; const byId = new Map(participantList.map(participant => [participant.id, participant])); const resolved = []; const seen = new Set();
    const addParticipant = participant => { const mark = participantMarks[participant?.id]; if (!participant || !mark || seen.has(participant.id)) return; seen.add(participant.id); resolved.push(Object.freeze({ participant, mark })); };
    (Array.isArray(event?.participantIds) ? event.participantIds : []).map(participantId => byId.get(participantId)).forEach(addParticipant);
    if (resolved.length < 2) participantList.filter(participant => participantMarks[participant.id]).filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    return resolved;
  }
  return Object.freeze({ schemaVersion: "card-identities.v1", policy: Object.freeze({ protectedMarks: "official-reference-or-open-use-sport-mark", displayUse: "editorial-identification", bundledCopies: false }), eventMarks, sportMarks, participantMarks, brandRules, markForEvent, participantMarksForEvent, participantAliases, aliasRange });
});
