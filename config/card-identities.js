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

  function logoAssets(url, options = {}){
    const primary = options.primary || url;
    return Object.freeze({
      primary,
      light: options.light || primary,
      dark: options.dark || primary,
      icon: options.icon || primary,
      iconLight: options.iconLight || options.icon || options.light || primary,
      iconDark: options.iconDark || options.icon || options.dark || primary,
      backgroundLight: options.backgroundLight || "light",
      backgroundDark: options.backgroundDark || "light",
    });
  }

  function officialMark(id, label, url, sourceUrl, options = {}){
    const logo = logoAssets(url, options.logo || options);
    return Object.freeze({ id, label, url: logo.primary, logo, sourceUrl, fit: options.fit || "contain", ...OFFICIAL_REFERENCE_USE });
  }

  function referenceMark(id, label, url, sourceUrl, options = {}){
    const logo = logoAssets(url, options.logo || options);
    return Object.freeze({
      id,
      label,
      url: logo.primary,
      logo,
      sourceUrl,
      fit: options.fit || "contain",
      assetClass: "official-reference",
      rightsStatus: "official-reference",
      provenance: "reference-library",
      displayUse: "editorial-identification",
    });
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

  function nationalTeamMark(id, label, url, sourceUrl, aliases, fallbackCountryCode = "", options = {}){
    return Object.freeze({
      ...officialMark(id, label, url, sourceUrl, options),
      aliases: Object.freeze(aliases),
      fallbackCountryCode,
    });
  }

  function nationalFlagMark(id, label, countryCode, sourceUrl, aliases){
    return Object.freeze({
      id,
      label,
      countryCode,
      aliases: Object.freeze(aliases),
      assetClass: "open-use",
      rightsStatus: "open-use",
      provenance: "licensed-library",
      displayUse: "editorial-identification",
      sourceUrl,
    });
  }

  function teamMark(id, label, url, sourceUrl, aliases, fallbackCountryCode = "", options = {}){
    return Object.freeze({
      ...officialMark(id, label, url, sourceUrl, options),
      aliases: Object.freeze(aliases),
      fallbackCountryCode,
    });
  }

  const eventMarks = Object.freeze({
    // Formula One publishes this transparent white wordmark in its own media
    // library. It is paired with a dark contrast surface in the renderer;
    // there is no need for an image filter or a made-up monochrome variant.
    f1: officialMark("competition:formula-one", "Formula One", "https://media.formula1.com/image/upload/v1677237319/etc/designs/fom-website/images/f1_logo.svg", "https://www.formula1.com/en/", {
      logo: { backgroundLight: "dark", backgroundDark: "dark" },
    }),
    nrl: officialMark("competition:nrl", "NRL", "https://www.nrl.com/siteassets/.lookups/sponsors/2026-special/together-round/nrl-logo.svg", "https://www.nrl.com/clubs/"),
    afl: officialMark("competition:afl", "AFL", "https://resources.afl.com.au/photo-resources/2019/12/05/9afccce2-87db-4a20-abcc-0c62c6516b3d/afl-logo.png?width=256&height=128", "https://www.afl.com.au/teams"),
    wimbledon: officialMark("brand:wimbledon", "Wimbledon", "https://www.wimbledon.com/_next/static/media/Logo-Wimbledon.2wyelfplbl7j4.svg", "https://www.wimbledon.com/"),
    "roland-garros": officialMark("brand:roland-garros", "Roland Garros", "https://www.rolandgarros.com/img/logo-rg-mobile.svg", "https://www.rolandgarros.com/"),
    "cricket-icc": officialMark("competition:icc", "International Cricket Council", "https://images.icc-cricket.com/image/private/t_q-best/v1698133655/prd/assets/logos/icc-white-logo.svg", "https://www.icc-cricket.com/", {
      logo: { backgroundLight: "dark", backgroundDark: "dark" },
    }),
    "cricket-australia": officialMark("organisation:cricket-australia", "Cricket Australia", "https://resources.cricket-australia.pulselive.com/cricket-australia/document/2022/10/25/bdb5b713-9bb9-40c9-aefd-84b51f0b1b20/CricketAustraliaLogoWhiteWide.svg", "https://www.cricket.com.au/", {
      logo: { backgroundLight: "dark", backgroundDark: "dark" },
    }),
    rugby: referenceMark("competition:rugby-australia", "Rugby Australia", "https://upload.wikimedia.org/wikipedia/commons/8/8b/Rugby_Australia_2017_vector_logo.svg", "https://commons.wikimedia.org/wiki/File:Rugby_Australia_2017_vector_logo.svg"),
    "premier-league": referenceMark("competition:premier-league", "Premier League", "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg", "https://www.premierleague.com/"),
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
    "premier-league": sportMark("premier-league", "Football", "sport:football"),
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
  const cricketTeamMarks = Object.freeze({
    // The national teams use their own compact crests rather than the Cricket
    // Australia wordmark or BCB's animated board logo. Both sources preserve
    // transparent artwork in the fixed matchup-logo box.
    "team:cricket:australia": nationalTeamMark("team:cricket:australia", "Cricket Australia", "https://vignette.wikia.nocookie.net/logopedia/images/a/af/1280px-Australia_cricket_logo.svg.png/revision/latest?cb=20180103230009", "https://shop.cricket.com.au/products/odi-au-mens-2526-shirt-craumt0096", ["Australia", "Australian"], "AU"),
    "team:cricket:bangladesh": nationalTeamMark("team:cricket:bangladesh", "Bangladesh Cricket Board", "https://www.tigercricket.com.bd/public/images/2016/12/cropped-Bangladesh-Cricket-Team-LogoW-1-192x192.png", "https://www.tigercricket.com.bd/public/", ["Bangladesh"], "BD"),
    "team:cricket:england": nationalTeamMark("team:cricket:england", "England and Wales Cricket Board", "https://resources.ecb.co.uk/ecb/document/2023/06/07/0d9368e6-932a-4bf2-90a3-509a0c4b1cc2/ECB.co.uk.png", "https://www.ecb.co.uk/", ["England"], "GB"),
    "team:cricket:new-zealand": nationalTeamMark("team:cricket:new-zealand", "New Zealand Cricket", "https://www.nzc.nz/dist/img/nzc-logo-vert-2.svg", "https://www.nzc.nz/", ["New Zealand"], "NZ"),
    "team:cricket:south-africa": nationalFlagMark("team:cricket:south-africa", "South Africa cricket", "ZA", "https://www.cricket.co.za/", ["South Africa"]),
  });
  const cricketParticipants = Object.freeze(Object.entries(cricketTeamMarks).map(([id, mark]) => Object.freeze({
    id,
    canonicalName: mark.label,
    displayName: mark.label,
    shortName: mark.label,
    metadata: Object.freeze({ titleAliases: mark.aliases }),
  })));
  // International crests come from Rugby Australia's official match centre;
  // Super Rugby Pacific clubs use the competition's official team assets.
  const rugbyTeamMarks = Object.freeze({
    "team:rugby:wallabies": teamMark("team:rugby:wallabies", "Wallabies", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/929920ed-8900-40f0-8402-4563c0006eec.png", "https://www.rugby.com.au/", ["Wallabies", "Australia", "Australian"], "AU"),
    "team:rugby:ireland": teamMark("team:rugby:ireland", "Ireland", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/993f90f6-3586-4741-45ad-08d8e29e6bc6.png", "https://www.rugby.com.au/", ["Ireland", "Irish"], "IE"),
    "team:rugby:france": teamMark("team:rugby:france", "France", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/d6161a2f-f770-46b9-23d9-08d9369d2141.png", "https://www.rugby.com.au/", ["France", "French"], "FR"),
    "team:rugby:italy": teamMark("team:rugby:italy", "Italy", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/56e05e32-60ca-451d-b09a-ec3ad52cc709.png", "https://www.rugby.com.au/", ["Italy", "Italian"], "IT"),
    "team:rugby:japan": teamMark("team:rugby:japan", "Japan", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/aaf401bd-6fbf-4881-a7db-52aec716f789.png", "https://www.rugby.com.au/", ["Japan", "Japanese"], "JP"),
    "team:rugby:springboks": teamMark("team:rugby:springboks", "Springboks", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/bedf129f-471d-4442-b7ad-fdf07c516630.png", "https://www.rugby.com.au/", ["Springboks", "South Africa", "South African"], "ZA"),
    "team:rugby:all-blacks": teamMark("team:rugby:all-blacks", "All Blacks", "https://images.allblacks.com/image/private/t_q_good/v1780998849/prd/assets/teams/logos_darkmode/AB.png", "https://www.allblacks.com/team/all-blacks", ["All Blacks", "New Zealand", "New Zealander"], "NZ", {
      logo: {
        dark: "https://images.allblacks.com/image/private/t_q_good/v1780998849/prd/assets/teams/logos_darkmode/AB.png",
        iconDark: "https://images.allblacks.com/image/private/t_q_good/v1780998849/prd/assets/teams/logos_darkmode/AB.png",
        backgroundLight: "dark",
        backgroundDark: "dark",
      },
    }),
    "team:rugby:argentina": teamMark("team:rugby:argentina", "Argentina", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/0d879300-8bf6-4f95-b91e-ea8b69723b75.png", "https://www.rugby.com.au/", ["Argentina", "Los Pumas", "Argentine"], "AR"),
    "team:rugby:england": teamMark("team:rugby:england", "England", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/1fc97be3-7806-4009-a341-81a734684a79.png", "https://www.rugby.com.au/", ["England", "English"], "GB"),
    "team:rugby:scotland": teamMark("team:rugby:scotland", "Scotland", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/45384b69-1c6c-4a23-9ee2-8c420e938e3d.png", "https://www.rugby.com.au/", ["Scotland", "Scottish"], "GB"),
    "team:rugby:wales": teamMark("team:rugby:wales", "Wales", "https://d26phqdbpt0w91.cloudfront.net/NonVideo/d01e3086-cb62-47bd-9e2b-61db9c1dc397.png", "https://www.rugby.com.au/", ["Wales", "Welsh"], "GB"),
    "team:rugby:brumbies": teamMark("team:rugby:brumbies", "ACT Brumbies", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_ACT_Brumbies.png", "https://super.rugby/superrugby/teams/", ["ACT Brumbies", "Brumbies"]),
    "team:rugby:waratahs": teamMark("team:rugby:waratahs", "NSW Waratahs", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_NSW_Waratahs.png", "https://super.rugby/superrugby/teams/", ["NSW Waratahs", "Waratahs"]),
    "team:rugby:reds": teamMark("team:rugby:reds", "Queensland Reds", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Reds.png", "https://super.rugby/superrugby/teams/", ["Queensland Reds", "Reds"]),
    "team:rugby:force": teamMark("team:rugby:force", "Western Force", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Western_Force.png", "https://super.rugby/superrugby/teams/", ["Western Force", "Force"]),
    "team:rugby:drua": teamMark("team:rugby:drua", "Fijian Drua", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Fijian_Drua_1.png", "https://super.rugby/superrugby/teams/", ["Fijian Drua", "Drua"]),
    "team:rugby:blues": teamMark("team:rugby:blues", "Blues", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Blues.png", "https://super.rugby/superrugby/teams/", ["Blues"]),
    "team:rugby:chiefs": teamMark("team:rugby:chiefs", "Chiefs", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Chiefs.png", "https://super.rugby/superrugby/teams/", ["Chiefs"]),
    "team:rugby:crusaders": teamMark("team:rugby:crusaders", "Crusaders", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Crusaders.png", "https://super.rugby/superrugby/teams/", ["Crusaders"]),
    "team:rugby:highlanders": teamMark("team:rugby:highlanders", "Highlanders", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Highlanders.png", "https://super.rugby/superrugby/teams/", ["Highlanders"]),
    "team:rugby:hurricanes": teamMark("team:rugby:hurricanes", "Hurricanes", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Hurricanes.png", "https://super.rugby/superrugby/teams/", ["Hurricanes"]),
    "team:rugby:moana-pasifika": teamMark("team:rugby:moana-pasifika", "Moana Pasifika", "https://super.rugby/sites/sanzar/assets/teamlogos/SRP_Moana_Pasifika.png", "https://super.rugby/superrugby/teams/", ["Moana Pasifika"]),
  });
  const rugbyParticipants = Object.freeze(Object.entries(rugbyTeamMarks).map(([id, mark]) => Object.freeze({
    id,
    canonicalName: mark.label,
    displayName: mark.label,
    shortName: mark.label,
    metadata: Object.freeze({ titleAliases: mark.aliases }),
  })));
  // Formula One's current team hubs publish their transparent wordmarks from
  // the same first-party media library. These are retained separately from
  // the series mark for standings, follow controls and future team matchups.
  const F1_TEAM_LOGO_BASE = "https://media.formula1.com/image/upload/c_fit,h_128/q_auto/v1740000001/common/f1";
  function f1TeamMark(id, label, season, slug, filename, aliases){
    const url = `${F1_TEAM_LOGO_BASE}/${season}/${slug}/${filename}`;
    const teamPath = slug === "redbullracing" ? "red-bull-racing" : slug === "racingbulls" ? "racing-bulls" : slug;
    return teamMark(id, label, url, `https://www.formula1.com/en/teams/${teamPath}/`, aliases, "", {
      logo: {
        primary: url, light: url, dark: url, icon: url, iconLight: url, iconDark: url,
        backgroundLight: "dark", backgroundDark: "dark",
      },
    });
  }
  const f1TeamMarks = Object.freeze({
    "team:f1:mercedes": f1TeamMark("team:f1:mercedes", "Mercedes", "2025", "mercedes", "2025mercedeslogowhite.webp", ["Mercedes"]),
    "team:f1:ferrari": f1TeamMark("team:f1:ferrari", "Ferrari", "2025", "ferrari", "2025ferrarilogolight.webp", ["Ferrari"]),
    "team:f1:mclaren": f1TeamMark("team:f1:mclaren", "McLaren", "2025", "mclaren", "2025mclarenlogowhite.webp", ["McLaren"]),
    "team:f1:red-bull-racing": f1TeamMark("team:f1:red-bull-racing", "Red Bull Racing", "2025", "redbullracing", "2025redbullracinglogowhite.webp", ["Red Bull Racing", "Red Bull"]),
    "team:f1:racing-bulls": f1TeamMark("team:f1:racing-bulls", "Racing Bulls", "2025", "racingbulls", "2025racingbullslogowhite.webp", ["Racing Bulls"]),
    "team:f1:alpine": f1TeamMark("team:f1:alpine", "Alpine", "2025", "alpine", "2025alpinelogowhite.webp", ["Alpine"]),
    "team:f1:haas": f1TeamMark("team:f1:haas", "Haas F1 Team", "2025", "haas", "2025haaslogowhite.webp", ["Haas F1 Team", "Haas"]),
    "team:f1:audi": f1TeamMark("team:f1:audi", "Audi", "2026", "audi", "2026audilogowhite.webp", ["Audi"]),
    "team:f1:williams": f1TeamMark("team:f1:williams", "Williams", "2025", "williams", "2025williamslogowhite.webp", ["Williams"]),
    "team:f1:aston-martin": f1TeamMark("team:f1:aston-martin", "Aston Martin", "2025", "astonmartin", "2025astonmartinlogowhite.webp", ["Aston Martin"]),
    "team:f1:cadillac": f1TeamMark("team:f1:cadillac", "Cadillac", "2026", "cadillac", "2026cadillaclogowhite.webp", ["Cadillac"]),
  });
  // Club marks are Premier League's own published 100px badge resources, keyed
  // by the season's stable club IDs from the official fixture service.
  const premierLeagueTeamMarks = Object.freeze({
    "team:football:epl:1": teamMark("team:football:epl:1", "Arsenal", "https://resources.premierleague.com/premierleague/badges/100/t3.png", "https://www.premierleague.com/en/clubs/1/arsenal/overview", ["Arsenal"]),
    "team:football:epl:2": teamMark("team:football:epl:2", "Aston Villa", "https://resources.premierleague.com/premierleague/badges/100/t7.png", "https://www.premierleague.com/en/clubs/2/aston-villa/overview", ["Aston Villa"]),
    "team:football:epl:127": teamMark("team:football:epl:127", "Bournemouth", "https://resources.premierleague.com/premierleague/badges/100/t91.png", "https://www.premierleague.com/en/clubs/127/bournemouth/overview", ["Bournemouth", "AFC Bournemouth"]),
    "team:football:epl:130": teamMark("team:football:epl:130", "Brentford", "https://resources.premierleague.com/premierleague/badges/100/t94.png", "https://www.premierleague.com/en/clubs/130/brentford/overview", ["Brentford"]),
    "team:football:epl:131": teamMark("team:football:epl:131", "Brighton & Hove Albion", "https://resources.premierleague.com/premierleague/badges/100/t36.png", "https://www.premierleague.com/en/clubs/131/brighton-and-hove-albion/overview", ["Brighton & Hove Albion", "Brighton"]),
    "team:football:epl:4": teamMark("team:football:epl:4", "Chelsea", "https://resources.premierleague.com/premierleague/badges/100/t8.png", "https://www.premierleague.com/en/clubs/4/chelsea/overview", ["Chelsea"]),
    "team:football:epl:5": teamMark("team:football:epl:5", "Coventry City", "https://resources.premierleague.com/premierleague/badges/100/t9.png", "https://www.premierleague.com/en/clubs/5/coventry-city/overview", ["Coventry City", "Coventry"]),
    "team:football:epl:6": teamMark("team:football:epl:6", "Crystal Palace", "https://resources.premierleague.com/premierleague/badges/100/t31.png", "https://www.premierleague.com/en/clubs/6/crystal-palace/overview", ["Crystal Palace"]),
    "team:football:epl:7": teamMark("team:football:epl:7", "Everton", "https://resources.premierleague.com/premierleague/badges/100/t11.png", "https://www.premierleague.com/en/clubs/7/everton/overview", ["Everton"]),
    "team:football:epl:34": teamMark("team:football:epl:34", "Fulham", "https://resources.premierleague.com/premierleague/badges/100/t54.png", "https://www.premierleague.com/en/clubs/34/fulham/overview", ["Fulham"]),
    "team:football:epl:41": teamMark("team:football:epl:41", "Hull City", "https://resources.premierleague.com/premierleague/badges/100/t88.png", "https://www.premierleague.com/en/clubs/41/hull-city/overview", ["Hull City", "Hull"]),
    "team:football:epl:8": teamMark("team:football:epl:8", "Ipswich Town", "https://resources.premierleague.com/premierleague/badges/100/t40.png", "https://www.premierleague.com/en/clubs/8/ipswich-town/overview", ["Ipswich Town", "Ipswich"]),
    "team:football:epl:9": teamMark("team:football:epl:9", "Leeds United", "https://resources.premierleague.com/premierleague/badges/100/t2.png", "https://www.premierleague.com/en/clubs/9/leeds-united/overview", ["Leeds United", "Leeds"]),
    "team:football:epl:10": teamMark("team:football:epl:10", "Liverpool", "https://resources.premierleague.com/premierleague/badges/100/t14.png", "https://www.premierleague.com/en/clubs/10/liverpool/overview", ["Liverpool"]),
    "team:football:epl:11": teamMark("team:football:epl:11", "Manchester City", "https://resources.premierleague.com/premierleague/badges/100/t43.png", "https://www.premierleague.com/en/clubs/11/manchester-city/overview", ["Manchester City", "Man City"]),
    "team:football:epl:12": teamMark("team:football:epl:12", "Manchester United", "https://resources.premierleague.com/premierleague/badges/100/t1.png", "https://www.premierleague.com/en/clubs/12/manchester-united/overview", ["Manchester United", "Man Utd"]),
    "team:football:epl:23": teamMark("team:football:epl:23", "Newcastle United", "https://resources.premierleague.com/premierleague/badges/100/t4.png", "https://www.premierleague.com/en/clubs/23/newcastle-united/overview", ["Newcastle United", "Newcastle"]),
    "team:football:epl:15": teamMark("team:football:epl:15", "Nottingham Forest", "https://resources.premierleague.com/premierleague/badges/100/t17.png", "https://www.premierleague.com/en/clubs/15/nottingham-forest/overview", ["Nottingham Forest", "Nott'm Forest"]),
    "team:football:epl:29": teamMark("team:football:epl:29", "Sunderland", "https://resources.premierleague.com/premierleague/badges/100/t56.png", "https://www.premierleague.com/en/clubs/29/sunderland/overview", ["Sunderland"]),
    "team:football:epl:21": teamMark("team:football:epl:21", "Tottenham Hotspur", "https://resources.premierleague.com/premierleague/badges/100/t6.png", "https://www.premierleague.com/en/clubs/21/tottenham-hotspur/overview", ["Tottenham Hotspur", "Tottenham", "Spurs"]),
  });
  const footballParticipants = Object.freeze(Object.entries(premierLeagueTeamMarks).map(([id, mark]) => Object.freeze({
    id,
    canonicalName: mark.label,
    displayName: mark.label,
    shortName: mark.label,
    metadata: Object.freeze({ titleAliases: mark.aliases }),
  })));
  // Extracted unchanged from AFL's club-navigation sprite. The colour and
  // light SVGs are standalone, transparent vectors rather than campaign tiles.
  const aflTeamAssets = Object.freeze({
    "team:afl:cd_t10": ["Adelaide Crows", "adel"], "team:afl:cd_t20": ["Brisbane Lions", "bl"],
    "team:afl:cd_t30": ["Carlton", "carl"], "team:afl:cd_t40": ["Collingwood", "coll"],
    "team:afl:cd_t50": ["Essendon", "ess"], "team:afl:cd_t60": ["Fremantle", "fre"],
    "team:afl:cd_t70": ["Geelong Cats", "geel"], "team:afl:cd_t1000": ["Gold Coast SUNS", "gcfc"],
    "team:afl:cd_t1010": ["GWS GIANTS", "gws"], "team:afl:cd_t80": ["Hawthorn", "haw"],
    "team:afl:cd_t90": ["Melbourne", "melb"], "team:afl:cd_t100": ["North Melbourne", "nmfc"],
    "team:afl:cd_t110": ["Port Adelaide", "port"], "team:afl:cd_t120": ["Richmond", "rich"],
    "team:afl:cd_t130": ["St Kilda", "stk"], "team:afl:cd_t160": ["Sydney Swans", "syd"],
    "team:afl:cd_t150": ["West Coast Eagles", "wce"], "team:afl:cd_t140": ["Western Bulldogs", "wb"],
  });
  const AFL_CREST_SOURCE = "https://www.afl.com.au/resources/v5.52.26/i/svg-output/icons.svg";
  const aflCrestAsset = (slug, variant = "") => `/assets/teams/afl/${slug}${variant}.svg`;

  const participantMarks = Object.freeze(Object.fromEntries([
    ...Object.entries(nrlTeamSlugs).map(([participantId, slug]) => [participantId, officialMark(`participant:${participantId}`, slug, `https://www.nrl.com/.theme/${slug}/${nrlDefaultBadgeExceptions.has(slug) ? "badge.svg" : "badge-light.svg"}`, "https://www.nrl.com/clubs/", {
      logo: {
        light: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        dark: `https://www.nrl.com/.theme/${slug}/badge-light.svg`,
        icon: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        iconLight: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        iconDark: `https://www.nrl.com/.theme/${slug}/badge-light.svg`,
        backgroundLight: "light",
        backgroundDark: "dark",
      },
    })]),
    ...Object.entries(aflTeamAssets).map(([participantId, [label, slug]]) => [participantId, officialMark(
      `participant:${participantId}`, label, aflCrestAsset(slug), AFL_CREST_SOURCE, {
        logo: {
          light: aflCrestAsset(slug), dark: aflCrestAsset(slug, "-light"),
          icon: aflCrestAsset(slug), iconLight: aflCrestAsset(slug), iconDark: aflCrestAsset(slug, "-light"),
        },
      },
    )]),
    ...Object.entries(cricketTeamMarks),
    ...Object.entries(rugbyTeamMarks),
    ...Object.entries(f1TeamMarks),
    ...Object.entries(premierLeagueTeamMarks),
  ]));
  const identityParticipants = Object.freeze(Object.fromEntries(Object.entries(participantMarks).map(([id, mark]) => [id, Object.freeze({
    id,
    canonicalName: mark.label,
    displayName: mark.label,
    shortName: mark.label,
    metadata: Object.freeze({ titleAliases: mark.aliases || [mark.label] }),
  })])));

  const brandRules = Object.freeze([
    Object.freeze({ id: "roland-garros", pattern: /\b(?:roland garros|french open)\b/i }),
    Object.freeze({ id: "wimbledon", pattern: /\b(?:wimbledon|the championships)\b/i }),
  ]);
  function eventSearchText(event){ return [event?.brandId, event?.competitionId, event?.series, event?.tournament, event?.name, event?.displayTitleCompact, event?.spoilerSafeTitle].filter(Boolean).join(" "); }
  function cricketOrganisationMarkForEvent(event){
    const search = [eventSearchText(event), event?.sourceName, event?.sourceUrl, event?.selectedSentence, event?.fullSpiel].filter(Boolean).join(" ");
    if (/\b(?:icc|world test championship|cricket world cup|champions trophy|t20 world cup|under-?19 cricket world cup)\b/i.test(search)) return eventMarks["cricket-icc"];
    if (/\b(?:australia|australian|cricket australia)\b/i.test(search) || /cricket\.com\.au/i.test(search)) return eventMarks["cricket-australia"];
    return sportMarks.cricket;
  }
  function markForEvent(event){
    const brandRule = brandRules.find(rule => rule.pattern.test(eventSearchText(event)));
    if (brandRule) return eventMarks[brandRule.id] || null;
    if (event?.key === "cricket") return cricketOrganisationMarkForEvent(event);
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
    (Array.isArray(event?.participantIds) ? event.participantIds : []).map(participantId => byId.get(participantId) || identityParticipants[participantId]).forEach(addParticipant);
    if (resolved.length < 2) participantList.filter(participant => participantMarks[participant.id]).filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "cricket") cricketParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "rugby") rugbyParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "premier-league") footballParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    return resolved;
  }
  function logoForTheme(mark, { context = "primary", useDark = false } = {}){
    const assets = mark?.logo || {};
    const themedContext = `${context}${useDark ? "Dark" : "Light"}`;
    return assets[themedContext] || assets[useDark ? "dark" : "light"] || assets[context] || assets.primary || mark?.url || "";
  }
  return Object.freeze({ schemaVersion: "card-identities.v2", policy: Object.freeze({ protectedMarks: "official-reference-or-open-use-sport-mark", displayUse: "editorial-identification", bundledCopies: false }), eventMarks, sportMarks, participantMarks, brandRules, markForEvent, participantMarksForEvent, participantAliases, aliasRange, logoForTheme });
});
