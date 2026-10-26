(function attachNothingSportsCardIdentities(root, factory){
  const nodeNationalTeamIdentities = typeof module !== "undefined" && module.exports ? require("./national-team-identities.js") : null;
  const api = factory(() => root.NOTHINGSPORTS_NATIONAL_TEAM_IDENTITIES || nodeNationalTeamIdentities);
  root.NOTHINGSPORTS_CARD_IDENTITIES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsCardIdentities(getNationalTeamIdentities){
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
      provenance: options.provenance || "reference-library",
      displayUse: "editorial-identification",
      ...(options.assetSource ? { assetSource:options.assetSource } : {}),
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

  function wordmarkMark(id, label, wordmark, themeColor){
    return Object.freeze({
      id,
      kind: "wordmark",
      label,
      wordmark,
      themeColor: Object.freeze({ ...themeColor }),
      assetClass: "open-use",
      rightsStatus: "open-use",
      provenance: "editorial-wordmark",
      displayUse: "editorial-identification",
      sourceUrl: "https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt",
    });
  }

  function vectorMark(id, label, glyph, wordmark = ""){
    return Object.freeze({
      id,
      kind: "vector",
      label,
      glyph,
      wordmark,
      assetClass: "open-use",
      rightsStatus: "open-use",
      provenance: "first-party",
      displayUse: "editorial-identification",
      sourceUrl: "https://www.nrl.com/operations/the-game/premiership-winners/",
    });
  }

  function nationalTeamMark(id, label, url, sourceUrl, aliases, fallbackCountryCode = "", options = {}){
    return Object.freeze({
      ...officialMark(id, label, url, sourceUrl, options),
      aliases: Object.freeze(aliases),
      fallbackCountryCode,
    });
  }

  function teamMark(id, label, url, sourceUrl, aliases, fallbackCountryCode = "", options = {}){
    return Object.freeze({
      ...officialMark(id, label, url, sourceUrl, options),
      aliases: Object.freeze(aliases),
      fallbackCountryCode,
      assetSourceUrl: options.assetSourceUrl || url,
    });
  }

  const nrlCompetitionMark = officialMark("competition:nrl", "NRL", "https://www.nrl.com/siteassets/.lookups/sponsors/2026-special/together-round/nrl-logo.svg", "https://www.nrl.com/clubs/");
  const eventMarks = Object.freeze({
    // The project-owner supplied red trademark reference remains readable on
    // both themes and avoids a network dependency for the competition mark.
    f1: referenceMark("competition:formula-one", "Formula One", "assets/identities/f1/formula-one-red-512.png", "https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt", {
      provenance:"user-supplied-reference",
      assetSource:"project-owner-supplied",
      logo: {
        primary:"assets/identities/f1/formula-one-red-512.png",
        light:"assets/identities/f1/formula-one-red-512.png",
        dark:"assets/identities/f1/formula-one-red-512.png",
        icon:"assets/identities/f1/formula-one-red-256.png",
        iconLight:"assets/identities/f1/formula-one-red-256.png",
        iconDark:"assets/identities/f1/formula-one-red-256.png",
        backgroundLight:"light",
        backgroundDark:"light",
      },
    }),
    "nrl-finals": Object.freeze({ ...nrlCompetitionMark, id:"event:nrl-finals", label:"NRL Finals" }),
    nrl: nrlCompetitionMark,
    afl: officialMark("competition:afl", "AFL", "https://resources.afl.com.au/photo-resources/2019/12/05/9afccce2-87db-4a20-abcc-0c62c6516b3d/afl-logo.png?width=256&height=128", "https://www.afl.com.au/teams"),
    aflw: officialMark("competition:aflw", "AFLW", "https://resources.afl.com.au/photo-resources/2019/12/05/9afccce2-87db-4a20-abcc-0c62c6516b3d/afl-logo.png?width=256&height=128", "https://www.afl.com.au/aflw"),
    wimbledon: officialMark("brand:wimbledon", "Wimbledon", "https://www.wimbledon.com/_next/static/media/Logo-Wimbledon.2wyelfplbl7j4.svg", "https://www.wimbledon.com/"),
    "roland-garros": officialMark("brand:roland-garros", "Roland Garros", "https://www.rolandgarros.com/img/logo-rg-mobile.svg", "https://www.rolandgarros.com/"),
    "cincinnati-open": officialMark("brand:cincinnati-open", "Cincinnati Open", "https://cincinnatiopen.com/wp-content/uploads/2024/01/Cincinnati-Open_Logo_01-Primary-RGB-1.png", "https://cincinnatiopen.com/our-brand/"),
    "us-open": referenceMark("brand:us-open", "US Open", "assets/identities/events/us-open-wordmark.svg", "https://www.usopen.org/images/header/usopen-header-logo.svg", {assetSource:"https://upload.wikimedia.org/wikipedia/commons/2/26/Usopen-header-logo.svg"}),
    "australian-open": officialMark("brand:australian-open", "Australian Open", "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ca/21/c5/ca21c5e1-dd94-4fdc-25c0-4602be548fcb/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/512x512bb.jpg", "https://ausopen.com/app"),
    "le-mans": officialMark("brand:le-mans-24-hours", "24 Hours of Le Mans", "assets/identities/events/le-mans-24-hours.png", "https://www.24h-lemans.com/en/news/the-24-hours-of-le-mans-reveals-a-new-brand-identity-60525"),
    supercars: officialMark("competition:supercars", "Repco Supercars Championship", "assets/identities/competitions/supercars.png", "https://www.supercars.com/events/2026-bathurst-1000"),
    "cricket-icc": officialMark("competition:icc", "International Cricket Council", "https://images.icc-cricket.com/image/private/t_q-best/v1698133655/prd/assets/logos/icc-white-logo.svg", "https://www.icc-cricket.com/", {
      logo: { backgroundLight: "dark", backgroundDark: "dark" },
    }),
    "cricket-australia": officialMark("organisation:cricket-australia", "Cricket Australia", "https://resources.cricket-australia.pulselive.com/cricket-australia/document/2022/10/25/bdb5b713-9bb9-40c9-aefd-84b51f0b1b20/CricketAustraliaLogoWhiteWide.svg", "https://www.cricket.com.au/", {
      logo: { backgroundLight: "dark", backgroundDark: "dark" },
    }),
    tdf: officialMark("competition:tour-de-france", "Tour de France", "assets/identities/cycling/tdf-brand.png", "https://www.letour.fr/", {logo:{backgroundLight:"light",backgroundDark:"light"}}),
    giro: officialMark("competition:giro-ditalia", "Giro d’Italia", "assets/identities/cycling/giro-brand.svg", "https://www.giroditalia.it/", {logo:{backgroundLight:"light",backgroundDark:"light"}}),
    vuelta: officialMark("competition:vuelta-a-espana", "La Vuelta", "assets/identities/cycling/vuelta-brand.png", "https://www.lavuelta.es/", {logo:{backgroundLight:"light",backgroundDark:"light"}}),
    wsl: officialMark("competition:wsl-championship-tour", "World Surf League", "assets/identities/wsl/brand.png", "https://www.worldsurfleague.com/", {logo:{backgroundLight:"dark",backgroundDark:"dark"}}),
    sailgp: officialMark("competition:sailgp", "SailGP", "assets/identities/sailgp/brand-light.png", "https://sailgp.com/", {
      logo: {
        dark: "assets/identities/sailgp/brand-dark.png",
        iconDark: "assets/identities/sailgp/brand-dark.png",
        backgroundLight: "light",
        backgroundDark: "dark",
      },
    }),
    dakar: officialMark("brand:dakar","Dakar Rally","assets/identities/dakar/dakar-brand.png","https://www.dakar.com/",{backgroundLight:"dark",backgroundDark:"dark"}),
    motogp: Object.freeze({...referenceMark("competition:motogp", "MotoGP", "assets/identities/motogp/badge.svg", "https://www.flaticon.com/free-icon/world_14063354", {provenance:"user-supplied",backgroundLight:"transparent",backgroundDark:"transparent"}), assetClass:"licensed",rightsStatus:"user-supplied",author:"Roundicons Premium",license:"Flaticon License (attribution required)",attribution:"Motogp icons created by Roundicons Premium - Flaticon"}),
    nfl: referenceMark("competition:nfl", "NFL", "https://upload.wikimedia.org/wikipedia/en/a/a2/National_Football_League_logo.svg", "https://designplaybook.nfl.com/"),
    rugby: referenceMark("competition:rugby-australia", "Rugby Australia", "https://upload.wikimedia.org/wikipedia/commons/8/8b/Rugby_Australia_2017_vector_logo.svg", "https://commons.wikimedia.org/wiki/File:Rugby_Australia_2017_vector_logo.svg"),
    "premier-league": referenceMark("competition:premier-league", "Premier League", "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg", "https://www.premierleague.com/"),
    bundesliga: officialMark("competition:bundesliga", "Bundesliga", "https://www.bundesliga.com/assets/logo/bundesliga_pos.svg", "https://www.bundesliga.com/en/bundesliga"),
    "la-liga": officialMark("competition:la-liga", "LALIGA", "https://assets.laliga.com/assets/logos/laliga-v/laliga-v-300x300.jpg", "https://www.laliga.com/en-GB"),
    "serie-a": officialMark("competition:serie-a", "Serie A", "https://images.legaseriea.it/image/private/t_w_480/v1764689566/prd/assets/mobileapp/logos/seriea-enilive-logo_jssflz.png", "https://en.legaseriea.it/serie-a"),
    "ligue-1": officialMark("competition:ligue-1", "Ligue 1", "https://ligue1.com/images/Logo_Ligue1.webp", "https://ligue1.com/"),
    "uefa-champions-league": officialMark("competition:uefa-champions-league", "UEFA Champions League", "https://img.uefa.com/imgml/uefacom/ucl/2024/logos/logo_dark.svg", "https://www.uefa.com/uefachampionsleague/", { logo: { backgroundLight:"dark", backgroundDark:"dark" } }),
  });

  // A local, open-use sport mark covers every supported sport. This avoids
  // treating a governing body's protected trademark as the app's own identity.
  const sportMarks = Object.freeze({
    "horse-racing":Object.freeze({...wordmarkMark("sport:horse-racing","Melbourne Cup","MC",{light:"#111111",dark:"#ffffff"}),sourceUrl:"https://github.com/hartican/sportscal"}),
    f1: sportMark("f1", "Formula One", "sport:motorsport", "F1"),
    motogp: Object.freeze({...sportMark("motogp", "MotoGP", "sport:motorcycle", "MGP"),assetClass:"licensed",rightsStatus:"user-supplied",sourceUrl:"https://www.flaticon.com/free-icon/motorbike_1768191",author:"Magnific",license:"Flaticon License (attribution required)"}),
    dakar: sportMark("dakar","Dakar Rally","sport:motorsport","DKR"),
    sailgp: sportMark("sailgp", "SailGP", "sport:sailing", "SGP"),
    motorsport: sportMark("motorsport", "Motorsport", "sport:motorsport"),
    wrc: officialMark("competition:wrc", "FIA World Rally Championship", "assets/identities/competitions/wrc-dark.png", "https://www.wrc.com/en", {logo:{dark:"assets/identities/competitions/wrc-light.png",backgroundDark:"dark"}}),
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
    nrlw: sportMark("nrlw", "NRLW", "sport:rugby", "NRLW"),
    tennis: sportMark("tennis", "Tennis", "sport:tennis"),
    fifa: sportMark("fifa", "Football", "sport:football"),
    football: sportMark("football", "Football", "sport:football"),
    "premier-league": sportMark("premier-league", "Football", "sport:football"),
    bundesliga: sportMark("bundesliga", "Football", "sport:football"),
    "la-liga": sportMark("la-liga", "Football", "sport:football"),
    "serie-a": sportMark("serie-a", "Football", "sport:football"),
    "ligue-1": sportMark("ligue-1", "Football", "sport:football"),
    cricket: sportMark("cricket", "Cricket", "sport:cricket", "CRK"),
    nba: sportMark("nba", "Basketball", "sport:basketball"),
    basketball: sportMark("basketball", "Basketball", "sport:basketball"),
    "fiba-women": sportMark("fiba-women", "FIBA women's basketball", "sport:basketball"),
    masters: sportMark("masters", "Golf", "sport:golf"),
    golf: sportMark("golf", "Golf", "sport:golf"),
    baseball:sportMark("baseball","Baseball","sport:baseball"),
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
    "team:cricket:south-africa": nationalTeamMark("team:cricket:south-africa", "South Africa cricket", "assets/identities/national/cricket/south-africa-proteas.svg", "https://www.cricket.co.za/", ["South Africa", "Proteas"]),
    "team:cricket:zimbabwe": nationalTeamMark("team:cricket:zimbabwe", "Zimbabwe Cricket", "https://upload.wikimedia.org/wikipedia/en/4/48/Zimbabwe_Cricket_%28logo%29.svg", "https://www.zimcricket.org/", ["Zimbabwe", "Zimbabwe Men", "Zimbabwe Women"], "ZW"),
    "team:cricket:queensland": teamMark("team:cricket:queensland", "Queensland Bulls", "https://static-files.cricket-australia.pulselive.com/flag/120/1205@2x.png", "https://www.cricket.com.au/teams/CA%3A1205/queensland-bulls", ["Queensland", "Queensland Bulls", "QLD"]),
    "team:cricket:new-south-wales": teamMark("team:cricket:new-south-wales", "NSW Men", "https://static-files.cricket-australia.pulselive.com/flag/120/674@2x.png", "https://www.cricket.com.au/teams/CA%3A674/nsw-men", ["New South Wales", "NSW", "NSW Men", "NSW Blues"]),
    "team:cricket:victoria": teamMark("team:cricket:victoria", "Victoria Men", "https://static-files.cricket-australia.pulselive.com/flag/120/82@2x.png", "https://www.cricket.com.au/teams/CA%3A82/victoria-men", ["Victoria", "Victoria Men", "Victorian", "VIC"]),
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
  // Keep the app's stable participant IDs while using the current club IDs and
  // first-party vector badges published by the Premier League team service.
  function premierLeagueTeamMark(id, label, badgeId, clubPath, aliases){
    const assetSourceUrl = `https://resources.premierleague.com/premierleague25/badges/${badgeId}.svg`;
    return teamMark(
      id,
      label,
      `assets/identities/epl/${badgeId}.svg`,
      `https://www.premierleague.com/en/clubs/${badgeId}/${clubPath}/overview`,
      aliases,
      "",
      { assetSourceUrl }
    );
  }
  const premierLeagueTeamMarks = Object.freeze({
    "team:football:epl:1": premierLeagueTeamMark("team:football:epl:1", "Arsenal", 3, "arsenal", ["Arsenal"]),
    "team:football:epl:2": premierLeagueTeamMark("team:football:epl:2", "Aston Villa", 7, "aston-villa", ["Aston Villa"]),
    "team:football:epl:127": premierLeagueTeamMark("team:football:epl:127", "Bournemouth", 91, "bournemouth", ["Bournemouth", "AFC Bournemouth"]),
    "team:football:epl:130": premierLeagueTeamMark("team:football:epl:130", "Brentford", 94, "brentford", ["Brentford"]),
    "team:football:epl:131": premierLeagueTeamMark("team:football:epl:131", "Brighton & Hove Albion", 36, "brighton-and-hove-albion", ["Brighton & Hove Albion", "Brighton"]),
    "team:football:epl:4": premierLeagueTeamMark("team:football:epl:4", "Chelsea", 8, "chelsea", ["Chelsea"]),
    "team:football:epl:5": premierLeagueTeamMark("team:football:epl:5", "Coventry City", 9, "coventry-city", ["Coventry City", "Coventry"]),
    "team:football:epl:6": premierLeagueTeamMark("team:football:epl:6", "Crystal Palace", 31, "crystal-palace", ["Crystal Palace"]),
    "team:football:epl:7": premierLeagueTeamMark("team:football:epl:7", "Everton", 11, "everton", ["Everton"]),
    "team:football:epl:34": premierLeagueTeamMark("team:football:epl:34", "Fulham", 54, "fulham", ["Fulham"]),
    "team:football:epl:41": premierLeagueTeamMark("team:football:epl:41", "Hull City", 88, "hull-city", ["Hull City", "Hull"]),
    "team:football:epl:8": premierLeagueTeamMark("team:football:epl:8", "Ipswich Town", 40, "ipswich-town", ["Ipswich Town", "Ipswich"]),
    "team:football:epl:9": premierLeagueTeamMark("team:football:epl:9", "Leeds United", 2, "leeds-united", ["Leeds United", "Leeds"]),
    "team:football:epl:10": premierLeagueTeamMark("team:football:epl:10", "Liverpool", 14, "liverpool", ["Liverpool"]),
    "team:football:epl:11": premierLeagueTeamMark("team:football:epl:11", "Manchester City", 43, "manchester-city", ["Manchester City", "Man City"]),
    "team:football:epl:12": premierLeagueTeamMark("team:football:epl:12", "Manchester United", 1, "manchester-united", ["Manchester United", "Man Utd"]),
    "team:football:epl:23": premierLeagueTeamMark("team:football:epl:23", "Newcastle United", 4, "newcastle-united", ["Newcastle United", "Newcastle"]),
    "team:football:epl:15": premierLeagueTeamMark("team:football:epl:15", "Nottingham Forest", 17, "nottingham-forest", ["Nottingham Forest", "Nott'm Forest"]),
    "team:football:epl:29": premierLeagueTeamMark("team:football:epl:29", "Sunderland", 56, "sunderland", ["Sunderland"]),
    "team:football:epl:21": premierLeagueTeamMark("team:football:epl:21", "Tottenham Hotspur", 6, "tottenham-hotspur", ["Tottenham Hotspur", "Tottenham", "Spurs"]),
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
    "team:aflw:cd_t8098": ["Adelaide Crows", "adel"], "team:aflw:cd_t7887": ["Brisbane Lions", "bl"],
    "team:aflw:cd_t8096": ["Carlton", "carl"], "team:aflw:cd_t8097": ["Collingwood", "coll"],
    "team:aflw:cd_t9406": ["Essendon", "ess"], "team:aflw:cd_t8467": ["Geelong Cats", "geel"],
    "team:aflw:cd_t8786": ["Gold Coast SUNS", "gcfc"], "team:aflw:cd_t7889": ["GWS GIANTS", "gws"],
    "team:aflw:cd_t9407": ["Hawthorn", "haw"], "team:aflw:cd_t7386": ["Melbourne", "melb"],
    "team:aflw:cd_t8466": ["North Melbourne", "nmfc"], "team:aflw:cd_t9409": ["Port Adelaide", "port"],
    "team:aflw:cd_t8788": ["Richmond", "rich"], "team:aflw:cd_t8796": ["St Kilda", "stk"],
    "team:aflw:cd_t9408": ["Sydney Swans", "syd"], "team:aflw:cd_t7886": ["Fremantle", "fre"],
    "team:aflw:cd_t8787": ["West Coast Eagles", "wce"], "team:aflw:cd_t7387": ["Western Bulldogs", "wb"],
  });
  const AFL_CREST_SOURCE = "https://www.afl.com.au/resources/v5.52.26/i/svg-output/icons.svg";
  const aflCrestAsset = (slug, variant = "") => `/assets/teams/afl/${slug}${variant}.svg`;

  const NBA_LOGO_IDS = Object.freeze({
    "team:nba:atlanta-hawks":1610612737, "team:nba:boston-celtics":1610612738,
    "team:nba:brooklyn-nets":1610612751, "team:nba:charlotte-hornets":1610612766,
    "team:nba:chicago-bulls":1610612741, "team:nba:cleveland-cavaliers":1610612739,
    "team:nba:detroit-pistons":1610612765, "team:nba:indiana-pacers":1610612754,
    "team:nba:miami-heat":1610612748, "team:nba:milwaukee-bucks":1610612749,
    "team:nba:new-york-knicks":1610612752, "team:nba:orlando-magic":1610612753,
    "team:nba:philadelphia-76ers":1610612755, "team:nba:toronto-raptors":1610612761,
    "team:nba:washington-wizards":1610612764, "team:nba:dallas-mavericks":1610612742,
    "team:nba:denver-nuggets":1610612743, "team:nba:golden-state-warriors":1610612744,
    "team:nba:houston-rockets":1610612745, "team:nba:la-clippers":1610612746,
    "team:nba:los-angeles-lakers":1610612747, "team:nba:memphis-grizzlies":1610612763,
    "team:nba:minnesota-timberwolves":1610612750, "team:nba:new-orleans-pelicans":1610612740,
    "team:nba:oklahoma-city-thunder":1610612760, "team:nba:phoenix-suns":1610612756,
    "team:nba:portland-trail-blazers":1610612757, "team:nba:sacramento-kings":1610612758,
    "team:nba:san-antonio-spurs":1610612759, "team:nba:utah-jazz":1610612762,
  });
  const NBA_TEAM_LABELS = Object.freeze(Object.fromEntries(Object.keys(NBA_LOGO_IDS).map(id => [id, id.split(":").at(-1).split("-").map(word => word === "la" ? "LA" : word[0].toUpperCase() + word.slice(1)).join(" ")])));
  const nbaTeamMarks = Object.freeze(Object.fromEntries(Object.entries(NBA_LOGO_IDS).map(([id, nbaId]) => {
    const label = NBA_TEAM_LABELS[id];
    const url = `https://cdn.nba.com/logos/nba/${nbaId}/global/L/logo.svg`;
    return [id, teamMark(id, label, url, "https://www.nba.com/teams", [label], id === "team:nba:toronto-raptors" ? "CA" : "US")];
  })));
  const NBL_TEAM_ASSETS = Object.freeze({
    "team:nbl:adelaide-36ers":["Adelaide 36ers","adl"],
    "team:nbl:brisbane-bullets":["Brisbane Bullets","bri"],
    "team:nbl:cairns-taipans":["Cairns Taipans","cns"],
    "team:nbl:illawarra-hawks":["Illawarra Hawks","hwk"],
    "team:nbl:melbourne-united":["Melbourne United","mel"],
    "team:nbl:new-zealand-breakers":["New Zealand Breakers","nzl"],
    "team:nbl:perth-wildcats":["Perth Wildcats","per"],
    "team:nbl:south-east-melbourne-phoenix":["South East Melbourne Phoenix","pnx"],
    "team:nbl:sydney-kings":["Sydney Kings","syd"],
    "team:nbl:tasmania-jackjumpers":["Tasmania JackJumpers","tas"],
  });
  const nblTeamMarks = Object.freeze(Object.fromEntries(Object.entries(NBL_TEAM_ASSETS).map(([id,[label,slug]]) => {
    const url=`https://a.espncdn.com/i/teamlogos/nbl/500/${slug}.png`;
    return [id,referenceMark(`participant:${id}`,label,url,"https://www.espn.com/nbl/teams",{assetSource:url})];
  })));

  // Lightweight NFL identities are available on a cold Feed before Follow
  // loads the full player directory. The canonical refresh script keeps this
  // compact team list in sync with american-football-directory.v1.json.
  /* nfl-club-identities:start */
  const nflClubIdentities = [["team:nfl:ari","Arizona Cardinals","Cardinals",["ARI","Arizona","Cardinals"]],["team:nfl:atl","Atlanta Falcons","Falcons",["ATL","Atlanta","Falcons"]],["team:nfl:bal","Baltimore Ravens","Ravens",["BAL","Baltimore","Ravens"]],["team:nfl:buf","Buffalo Bills","Bills",["BUF","Buffalo","Bills"]],["team:nfl:car","Carolina Panthers","Panthers",["CAR","Carolina","Panthers"]],["team:nfl:chi","Chicago Bears","Bears",["CHI","Chicago","Bears"]],["team:nfl:cin","Cincinnati Bengals","Bengals",["CIN","Cincinnati","Bengals"]],["team:nfl:cle","Cleveland Browns","Browns",["CLE","Cleveland","Browns"]],["team:nfl:dal","Dallas Cowboys","Cowboys",["DAL","Dallas","Cowboys"]],["team:nfl:den","Denver Broncos","Broncos",["DEN","Denver","Broncos"]],["team:nfl:det","Detroit Lions","Lions",["DET","Detroit","Lions"]],["team:nfl:gb","Green Bay Packers","Packers",["GB","Green Bay","Packers"]],["team:nfl:hou","Houston Texans","Texans",["HOU","Houston","Texans"]],["team:nfl:ind","Indianapolis Colts","Colts",["IND","Indianapolis","Colts"]],["team:nfl:jax","Jacksonville Jaguars","Jaguars",["JAX","Jacksonville","Jaguars"]],["team:nfl:kc","Kansas City Chiefs","Chiefs",["KC","Kansas City","Chiefs"]],["team:nfl:lv","Las Vegas Raiders","Raiders",["LV","Las Vegas","Raiders"]],["team:nfl:lac","Los Angeles Chargers","Chargers",["LAC","Los Angeles","Chargers"]],["team:nfl:lar","Los Angeles Rams","Rams",["LAR","Los Angeles","Rams"]],["team:nfl:mia","Miami Dolphins","Dolphins",["MIA","Miami","Dolphins"]],["team:nfl:min","Minnesota Vikings","Vikings",["MIN","Minnesota","Vikings"]],["team:nfl:ne","New England Patriots","Patriots",["NE","New England","Patriots"]],["team:nfl:no","New Orleans Saints","Saints",["NO","New Orleans","Saints"]],["team:nfl:nyg","New York Giants","Giants",["NYG","New York","Giants"]],["team:nfl:nyj","New York Jets","Jets",["NYJ","New York","Jets"]],["team:nfl:phi","Philadelphia Eagles","Eagles",["PHI","Philadelphia","Eagles"]],["team:nfl:pit","Pittsburgh Steelers","Steelers",["PIT","Pittsburgh","Steelers"]],["team:nfl:sf","San Francisco 49ers","49ers",["SF","San Francisco","49ers"]],["team:nfl:sea","Seattle Seahawks","Seahawks",["SEA","Seattle","Seahawks"]],["team:nfl:tb","Tampa Bay Buccaneers","Buccaneers",["TB","Tampa Bay","Buccaneers"]],["team:nfl:ten","Tennessee Titans","Titans",["TEN","Tennessee","Titans"]],["team:nfl:wsh","Washington Commanders","Commanders",["WSH","Washington","Commanders"]]];
  /* nfl-club-identities:end */
  const nflTeamMarks = Object.freeze(Object.fromEntries(nflClubIdentities.map(([id, label, shortName, aliases]) => {
    const abbreviation = id.split(":").at(-1);
    const url = `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation}.png`;
    const dark = `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${abbreviation}.png`;
    return [id, Object.freeze({
      ...referenceMark(`participant:${id}`, label, url, "https://www.nfl.com/teams/", {
        assetSource:url,
        logo:{ dark, iconDark:dark, backgroundLight:"light", backgroundDark:"dark" },
      }),
      aliases:Object.freeze(Array.from(new Set([label, shortName, ...aliases]))),
      fallbackCountryCode:"US",
    })];
  })));

  const baseParticipantMarks = Object.freeze(Object.fromEntries([
    ...['roosters','broncos'].map(slug=>[`team:nrlw:${slug}`,officialMark(`participant:team:nrlw:${slug}`,slug==='roosters'?'Sydney Roosters':'Brisbane Broncos',`assets/identities/nrlw-${slug}.svg`,'https://www.nrl.com/clubs/')]),
    ...Object.entries(nrlTeamSlugs).map(([participantId, slug]) => [participantId, officialMark(`participant:${participantId}`, slug, `https://www.nrl.com/.theme/${slug}/${nrlDefaultBadgeExceptions.has(slug) ? "badge.svg" : "badge-light.svg"}`, "https://www.nrl.com/clubs/", {
      logo: {
        light: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        dark: `https://www.nrl.com/.theme/${slug}/${nrlDefaultBadgeExceptions.has(slug) ? "badge.svg" : "badge-light.svg"}`,
        icon: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        iconLight: `https://www.nrl.com/.theme/${slug}/badge.svg`,
        iconDark: `https://www.nrl.com/.theme/${slug}/${nrlDefaultBadgeExceptions.has(slug) ? "badge.svg" : "badge-light.svg"}`,
        backgroundLight: "light",
        backgroundDark: "light",
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
    ...Object.entries(nbaTeamMarks),
    ...Object.entries(nblTeamMarks),
    ...Object.entries(nflTeamMarks),
  ]));
  // Lightweight club identities are available on a cold Feed before Follow loads.
  // Kept in sync by scripts/refresh-football-directory.js; no player roster here.
  /* football-club-identities:start */
  const footballClubIdentities = [["epl:127","AFC Bournemouth","349.png","349/afc-bournemouth",["AFC Bournemouth","Bournemouth"]],["epl:1","Arsenal","359.png","359/arsenal",["Arsenal"]],["epl:2","Aston Villa","362.png","362/aston-villa",["Aston Villa"]],["epl:130","Brentford","337.png","337/brentford",["Brentford"]],["epl:131","Brighton & Hove Albion","331.png","331/brighton-hove-albion",["Brighton & Hove Albion","Brighton"]],["epl:4","Chelsea","363.png","363/chelsea",["Chelsea"]],["epl:5","Coventry City","388.png","388/coventry-city",["Coventry City","Coventry"]],["epl:6","Crystal Palace","384.png","384/crystal-palace",["Crystal Palace","C Palace"]],["epl:7","Everton","368.png","368/everton",["Everton"]],["epl:34","Fulham","370.png","370/fulham",["Fulham"]],["epl:41","Hull City","306.png","306/hull-city",["Hull City","Hull"]],["epl:8","Ipswich Town","373.png","373/ipswich-town",["Ipswich Town","Ipswich"]],["epl:9","Leeds United","357.png","357/leeds-united",["Leeds United","Leeds"]],["epl:10","Liverpool","364.png","364/liverpool",["Liverpool"]],["epl:11","Manchester City","382.png","382/manchester-city",["Manchester City","Man City"]],["epl:12","Manchester United","360.png","360/manchester-united",["Manchester United","Man United"]],["epl:23","Newcastle United","361.png","361/newcastle-united",["Newcastle United","Newcastle"]],["epl:15","Nottingham Forest","393.png","393/nottingham-forest",["Nottingham Forest","Nottm Forest"]],["epl:29","Sunderland","366.png","366/sunderland",["Sunderland"]],["epl:21","Tottenham Hotspur","367.png","367/tottenham-hotspur",["Tottenham Hotspur","Spurs"]],["club:1-fc-union-berlin","1. FC Union Berlin","598.png","598/1-fc-union-berlin",["1. FC Union Berlin","Union Berlin"]],["club:bayer-leverkusen","Bayer Leverkusen","131.png","131/bayer-leverkusen",["Bayer Leverkusen","Leverkusen"]],["club:bayern-munich","Bayern Munich","132.png","132/bayern-munich",["Bayern Munich","Bayern"]],["club:borussia-dortmund","Borussia Dortmund","124.png","124/borussia-dortmund",["Borussia Dortmund","Dortmund"]],["club:borussia-monchengladbach","Borussia Mönchengladbach","268.png","268/borussia-monchengladbach",["Borussia Mönchengladbach","Gladbach"]],["club:eintracht-frankfurt","Eintracht Frankfurt","125.png","125/eintracht-frankfurt",["Eintracht Frankfurt","Frankfurt"]],["club:fc-augsburg","FC Augsburg","3841.png","3841/fc-augsburg",["FC Augsburg","Augsburg"]],["club:fc-cologne","FC Cologne","122.png","122/fc-cologne",["FC Cologne","Cologne"]],["club:hamburg-sv","Hamburg SV","127.png","127/hamburg-sv",["Hamburg SV","Hamburg"]],["club:mainz","Mainz","2950.png","2950/mainz",["Mainz"]],["club:rb-leipzig","RB Leipzig","11420.png","11420/rb-leipzig",["RB Leipzig"]],["club:sc-freiburg","SC Freiburg","126.png","126/sc-freiburg",["SC Freiburg","Freiburg"]],["club:sc-paderborn-07","SC Paderborn 07","3307.png","3307/sc-paderborn-07",["SC Paderborn 07","Paderborn"]],["club:sv-elversberg","SV Elversberg","10388.png","10388/sv-elversberg",["SV Elversberg","Elversberg"]],["club:schalke-04","Schalke 04","133.png","133/schalke-04",["Schalke 04","Schalke"]],["club:tsg-hoffenheim","TSG Hoffenheim","7911.png","7911/tsg-hoffenheim",["TSG Hoffenheim","Hoffenheim"]],["club:vfb-stuttgart","VfB Stuttgart","134.png","134/vfb-stuttgart",["VfB Stuttgart","Stuttgart"]],["club:werder-bremen","Werder Bremen","137.png","137/werder-bremen",["Werder Bremen","Bremen"]],["club:alaves","Alavés","96.png","96/alaves",["Alavés"]],["club:athletic-club","Athletic Club","93.png","93/athletic-club",["Athletic Club","Athletic"]],["club:atletico-madrid","Atlético Madrid","1068.png","1068/atletico-madrid",["Atlético Madrid","Atlético"]],["club:barcelona","Barcelona","83.png","83/barcelona",["Barcelona"]],["club:celta-vigo","Celta Vigo","85.png","85/celta-vigo",["Celta Vigo"]],["club:deportivo","Deportivo","90.png","90/deportivo",["Deportivo"]],["club:elche","Elche","3751.png","3751/elche",["Elche"]],["club:espanyol","Espanyol","88.png","88/espanyol",["Espanyol"]],["club:getafe","Getafe","2922.png","2922/getafe",["Getafe"]],["club:levante","Levante","1538.png","1538/levante",["Levante"]],["club:malaga","Málaga","99.png","99/malaga",["Málaga"]],["club:osasuna","Osasuna","97.png","97/osasuna",["Osasuna"]],["club:racing-santander","Racing Santander","87.png","87/racing-santander",["Racing Santander","Racing"]],["club:rayo-vallecano","Rayo Vallecano","101.png","101/rayo-vallecano",["Rayo Vallecano","Rayo"]],["club:real-betis","Real Betis","244.png","244/real-betis",["Real Betis","Betis"]],["club:real-madrid","Real Madrid","86.png","86/real-madrid",["Real Madrid"]],["club:real-sociedad","Real Sociedad","89.png","89/real-sociedad",["Real Sociedad"]],["club:sevilla","Sevilla","243.png","243/sevilla",["Sevilla"]],["club:valencia","Valencia","94.png","94/valencia",["Valencia"]],["club:villarreal","Villarreal","102.png","102/villarreal",["Villarreal"]],["club:ac-milan","AC Milan","103.png","103/ac-milan",["AC Milan","Milan"]],["club:as-roma","AS Roma","104.png","104/as-roma",["AS Roma"]],["club:atalanta","Atalanta","105.png","105/atalanta",["Atalanta"]],["club:bologna","Bologna","107.png","107/bologna",["Bologna"]],["club:cagliari","Cagliari","2925.png","2925/cagliari",["Cagliari"]],["club:como","Como","2572.png","2572/como",["Como"]],["club:fiorentina","Fiorentina","109.png","109/fiorentina",["Fiorentina"]],["club:frosinone","Frosinone","4057.png","4057/frosinone",["Frosinone"]],["club:genoa","Genoa","3263.png","3263/genoa",["Genoa"]],["club:internazionale","Internazionale","110.png","110/internazionale",["Internazionale","Inter Milan"]],["club:juventus","Juventus","111.png","111/juventus",["Juventus"]],["club:lazio","Lazio","112.png","112/lazio",["Lazio"]],["club:lecce","Lecce","113.png","113/lecce",["Lecce"]],["club:monza","Monza","4007.png","4007/monza",["Monza"]],["club:napoli","Napoli","114.png","114/napoli",["Napoli"]],["club:parma","Parma","115.png","115/parma",["Parma"]],["club:sassuolo","Sassuolo","3997.png","3997/sassuolo",["Sassuolo"]],["club:torino","Torino","239.png","239/torino",["Torino"]],["club:udinese","Udinese","118.png","118/udinese",["Udinese"]],["club:venezia","Venezia","17530.png","17530/venezia",["Venezia"]],["club:aj-auxerre","AJ Auxerre","172.png","172/aj-auxerre",["AJ Auxerre","Auxerre"]],["club:as-monaco","AS Monaco","174.png","174/as-monaco",["AS Monaco","Monaco"]],["club:angers","Angers","7868.png","7868/angers",["Angers"]],["club:brest","Brest","6997.png","6997/brest",["Brest"]],["club:le-havre-ac","Le Havre AC","3236.png","3236/le-havre-ac",["Le Havre AC"]],["club:le-mans","Le Mans","2697.png","2697/le-mans",["Le Mans"]],["club:lens","Lens","175.png","175/lens",["Lens"]],["club:lille","Lille","166.png","166/lille",["Lille"]],["club:lorient","Lorient","273.png","273/lorient",["Lorient"]],["club:lyon","Lyon","167.png","167/lyon",["Lyon"]],["club:marseille","Marseille","176.png","176/marseille",["Marseille"]],["club:nice","Nice","2502.png","2502/nice",["Nice"]],["club:paris-fc","Paris FC","6851.png","6851/paris-fc",["Paris FC"]],["club:paris-saint-germain","Paris Saint-Germain","160.png","160/paris-saint-germain",["Paris Saint-Germain","PSG"]],["club:stade-rennais","Stade Rennais","169.png","169/stade-rennais",["Stade Rennais","Rennes"]],["club:strasbourg","Strasbourg","180.png","180/strasbourg",["Strasbourg"]],["club:toulouse","Toulouse","179.png","179/toulouse",["Toulouse"]],["club:troyes","Troyes","170.png","170/troyes",["Troyes"]],["adelaide-united","Adelaide United","5321.png","5321/adelaide-united",["Adelaide United","Adelaide Utd"]],["club:auckland-fc","Auckland FC","22344.png","22344/auckland-fc",["Auckland FC","Auckland"]],["brisbane-roar","Brisbane Roar","5326.png","5326/brisbane-roar",["Brisbane Roar","Brisbane"]],["club:central-coast-mariners","Central Coast Mariners","5325.png","5325/central-coast-mariners",["Central Coast Mariners","CC Mariners"]],["club:macarthur-fc","Macarthur FC","19340.png","19340/macarthur-fc",["Macarthur FC","Macarthur"]],["club:melbourne-city-fc","Melbourne City FC","11143.png","11143/melbourne-city-fc",["Melbourne City FC","Melbourne City"]],["melbourne-victory","Melbourne Victory","5328.png","5328/melbourne-victory",["Melbourne Victory","Melbourne V"]],["club:newcastle-jets","Newcastle Jets","5323.png","5323/newcastle-jets",["Newcastle Jets"]],["perth-glory","Perth Glory","5322.png","5322/perth-glory",["Perth Glory"]],["sydney-fc","Sydney FC","5327.png","5327/sydney-fc",["Sydney FC"]],["club:wellington-phoenix-fc","Wellington Phoenix FC","8352.png","8352/wellington-phoenix-fc",["Wellington Phoenix FC","Wellington"]],["western-sydney-wanderers","Western Sydney Wanderers","13696.png","13696/western-sydney-wanderers",["Western Sydney Wanderers","Western Sydney"]],["australian-championship:9927","Adelaide City",["assets/identities/football/australian-championship/9927.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:14521","Avondale FC",["assets/identities/football/australian-championship/14521.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:9944","Bayswater City",["assets/identities/football/australian-championship/9944.jpg"],["https://australianchampionship.com.au/"],[]],["australian-championship:9946","Broadmeadow Magic",["assets/identities/football/australian-championship/9946.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:11255","Canberra Croatia",["assets/identities/football/australian-championship/11255.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:11022","Lions FC",["assets/identities/football/australian-championship/11022.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:3502","Marconi Stallions",["assets/identities/football/australian-championship/3502.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:11021","Oakleigh Cannons",["assets/identities/football/australian-championship/11021.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:20436","Preston Lions",["assets/identities/football/australian-championship/20436.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:9928","South Hobart",["assets/identities/football/australian-championship/9928.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:10470","South Melbourne",["assets/identities/football/australian-championship/10470.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:15433","Sutherland Sharks",["assets/identities/football/australian-championship/15433.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:9938","Sydney Olympic",["assets/identities/football/australian-championship/9938.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:9939","Sydney United 58",["assets/identities/football/australian-championship/9939.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:20439","Wests Apia",["assets/identities/football/australian-championship/20439.png"],["https://australianchampionship.com.au/"],[]],["australian-championship:879","Wollongong Wolves",["assets/identities/football/australian-championship/879.png"],["https://australianchampionship.com.au/"],[]]].map(([id,label,url,source,aliases])=>[typeof id==="string"?"team:football:"+id:id[0],label,typeof url==="string"?"https://a.espncdn.com/i/teamlogos/soccer/500/"+url:url[0],typeof source==="string"?"https://www.espn.com/soccer/club/_/id/"+source:source[0],aliases]);
  /* football-club-identities:end */
  const footballClubMarks = Object.fromEntries(footballClubIdentities.map(([id, label, url, source, aliases]) => [id, { ...referenceMark(`participant:${id}`, label, url, source), aliases }]));
  // Reviewed artwork for exact carried IDs; this does not register name aliases.
  // validate-card-identities checks these against football-club-crests.json.
  const reviewedFootballClubMarks = {
    "team:football:club:celje": referenceMark("participant:team:football:club:celje", "Celje", "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/NK_Celje_logo.png/250px-NK_Celje_logo.png", "https://commons.wikimedia.org/wiki/File:NK_Celje_logo.png"),
    "team:football:club:sabah": referenceMark("participant:team:football:club:sabah", "Sabah", "https://sabahfc.az/static/uploads/638945_444141.webp", "https://sabahfc.az/"),
  };
  const nationalMarks = () => getNationalTeamIdentities()?.participantMarks || {};
  const participantMarks = new Proxy({ ...footballClubMarks, ...reviewedFootballClubMarks, ...baseParticipantMarks }, {
    get:(target, property) => nationalMarks()[property] || target[property],
    ownKeys:target => Array.from(new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(nationalMarks())])),
    getOwnPropertyDescriptor(target, property){
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (descriptor) return descriptor;
      const value = nationalMarks()[property];
      return value ? { configurable:true, enumerable:true, writable:false, value } : undefined;
    },
  });
  const baseIdentityParticipants = Object.freeze(Object.fromEntries(Object.entries(baseParticipantMarks).map(([id, mark]) => [id, Object.freeze({
    id,
    canonicalName: mark.label,
    displayName: mark.label,
    shortName: mark.label,
    metadata: Object.freeze({ titleAliases: mark.aliases || [mark.label] }),
  })])));
  const nationalParticipantForId = id => getNationalTeamIdentities()?.participantsById?.[id] || null;
  const identityParticipants = new Proxy({ ...Object.fromEntries(footballClubIdentities.map(([id, displayName, crestUrl, crestSourceUrl, aliases]) => [id, { id, displayName, crestUrl, crestSourceUrl, aliases }])), ...baseIdentityParticipants }, {
    get:(target, property) => nationalParticipantForId(property) || target[property],
    ownKeys:target => Array.from(new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(getNationalTeamIdentities()?.participantsById || {})])),
    getOwnPropertyDescriptor(target, property){
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (descriptor) return descriptor;
      const value = nationalParticipantForId(property);
      return value ? { configurable:true, enumerable:true, writable:false, value } : undefined;
    },
  });
  const participantIdPrefixesByEventKey = Object.freeze({
    afl: Object.freeze(["team:afl:"]),
    aflw: Object.freeze(["team:aflw:"]),
    nrl: Object.freeze(["team:nrl:"]),
    nrlw: Object.freeze(["team:nrlw:"]),
    rugby: Object.freeze(["team:rugby:"]),
    cricket: Object.freeze(["team:cricket:"]),
    f1: Object.freeze(["team:f1:"]),
    motorsport: Object.freeze(["team:f1:"]),
    "premier-league": Object.freeze(["team:football:epl:"]),
    bundesliga: Object.freeze(["team:football:"]),
    "la-liga": Object.freeze(["team:football:"]),
    "serie-a": Object.freeze(["team:football:"]),
    "ligue-1": Object.freeze(["team:football:"]),
    fifa: Object.freeze(["team:football:"]),
    football: Object.freeze(["team:football:"]),
    nba: Object.freeze(["team:nba:", "team:basketball:"]),
    basketball: Object.freeze(["team:nba:", "team:basketball:"]),
    nfl: Object.freeze(["team:nfl:"]),
    "american-football": Object.freeze(["team:nfl:"]),
    netball: Object.freeze(["team:netball:"]),
    hockey: Object.freeze(["team:hockey:"]),
    "ice-hockey": Object.freeze(["team:nhl:", "team:chl:"]),
    cwg: Object.freeze(["team:cwg:"]),
    "multi-sport": Object.freeze(["team:cwg:"]),
  });

  const brandRules = Object.freeze([
    Object.freeze({ id: "nrl-finals", pattern: /\bnrl-finals-series\b/i }),
    Object.freeze({ id: "roland-garros", pattern: /\b(?:roland garros|french open)\b/i }),
    Object.freeze({ id: "wimbledon", pattern: /\b(?:wimbledon|the championships)\b/i }),
    Object.freeze({ id: "cincinnati-open", pattern: /\bcincinnati open\b/i }),
    Object.freeze({ id: "us-open", pattern: /\bus open\b/i }),
    Object.freeze({ id: "australian-open", pattern: /\b(?:australian open|aus open)\b/i }),
  ]);
  const golfMajorMarks=Object.freeze({
    masters:referenceMark('brand:masters-golf','Masters Tournament','assets/identities/golf/masters-brand.png','https://commons.wikimedia.org/wiki/File:Masters_Tournament.svg'),
    'pga-championship':officialMark('brand:pga-championship','PGA Championship','assets/identities/golf/pga-brand.png','https://www.pgachampionship.com/tickets'),
    'the-open':officialMark('brand:the-open-golf','The Open Championship','assets/identities/golf/open-brand.svg','https://www.theopen.com/st-andrews-2027',{backgroundLight:'dark',backgroundDark:'dark'}),
    'us-open':Object.freeze({...referenceMark('fallback:us-open-golf','U.S. Open — golf identity fallback','assets/identities/golf/golf-white.svg','https://www.flaticon.com/free-icon/golf_5147640',{provenance:'licensed-library',backgroundLight:'dark',backgroundDark:'dark'}),assetClass:'licensed',rightsStatus:'attribution-required',author:'Plastic Donut',license:'Flaticon attribution licence'}),
  });
  const competitionMarks = Object.freeze({
    "competition:billie-jean-king-cup":officialMark("brand:billie-jean-king-cup", "Billie Jean King Cup", "assets/identities/events/billie-jean-king-cup-day.png", "https://www.billiejeankingcup.com/en", {dark:"assets/identities/events/billie-jean-king-cup.svg"}),
    "competition:formula-one":eventMarks.f1,
    "competition:motogp":eventMarks.motogp,
    "competition:supercars":eventMarks.supercars,
    "competition:sailgp":eventMarks.sailgp,
    "competition:dakar":eventMarks.dakar,
    "competition:wsl-championship-tour":eventMarks.wsl,
    "competition:tour-de-france":eventMarks.tdf,
    "competition:giro-ditalia":eventMarks.giro,
    "competition:vuelta-a-espana":eventMarks.vuelta,
    "competition:nfl":eventMarks.nfl,
    "competition:wrc":sportMarks.wrc,
    "competition:premier-league": eventMarks["premier-league"],
    "competition:bundesliga": eventMarks.bundesliga,
    "competition:la-liga": eventMarks["la-liga"],
    "competition:serie-a": eventMarks["serie-a"],
    "competition:ligue-1": eventMarks["ligue-1"],
    "competition:uefa-champions-league": eventMarks["uefa-champions-league"],
    "competition:tennis:us-open": eventMarks["us-open"],
    "competition:tennis:australian-open": eventMarks["australian-open"],
    "tournament:tennis:joint:cincinnati-open": eventMarks["cincinnati-open"],
    "competition:afl:premiership": eventMarks.afl,
    "competition:nrl:premiership": eventMarks.nrl,
    "competition:fia-wec": eventMarks["le-mans"],
    "competition:le-mans": eventMarks["le-mans"],
  });
  function eventSearchText(event){ return [event?.brandId, event?.competitionId, event?.series, event?.tournament, event?.name, event?.displayTitleCompact, event?.spoilerSafeTitle].filter(Boolean).join(" "); }
  function cricketOrganisationMarkForEvent(event){
    const search = [eventSearchText(event), event?.sourceName, event?.sourceUrl, event?.selectedSentence, event?.fullSpiel].filter(Boolean).join(" ");
    if (/\b(?:icc|world test championship|cricket world cup|champions trophy|t20 world cup|under-?19 cricket world cup)\b/i.test(search)) return eventMarks["cricket-icc"];
    if (/\b(?:australia|australian|cricket australia)\b/i.test(search) || /cricket\.com\.au/i.test(search)) return eventMarks["cricket-australia"];
    return sportMarks.cricket;
  }
  function markForEvent(event){
    if(event?.tournamentId==='R2026527'||/\bbaycurrent classic\b/i.test(eventSearchText(event)))return officialMark('brand:baycurrent-classic','Baycurrent Classic','assets/identities/golf/baycurrent-classic-2026.png','https://www.pgatour.com/tournaments/2026/baycurrent-classic/R2026527/tee-times');
    if(event?.identityRef==="event:le-mans" || /\b24 hours of le mans\b/i.test(eventSearchText(event)))return eventMarks["le-mans"];
    if(event?.golfMajorCalendar&&golfMajorMarks[event.majorSlug])return golfMajorMarks[event.majorSlug];
    const brandRule = brandRules.find(rule => rule.pattern.test(eventSearchText(event)));
    if (brandRule) return eventMarks[brandRule.id] || null;
    const competitionMark = markForCompetitionId(event?.competitionId);
    if (competitionMark) return competitionMark;
    if (/\b(?:uefa )?champions league\b/i.test(eventSearchText(event))) return eventMarks["uefa-champions-league"];
    if (event?.key === "cricket") return cricketOrganisationMarkForEvent(event);
    const neutral=String(event?.key||'').replace(/-women$/,'');
    const base={skiing:'ski',surf:'wsl',rugby:'rugby',football:'football',hockey:'hockey','ice-hockey':'hockey'}[neutral]||neutral;
    return eventMarks[event?.key] || sportMarks[event?.key] || sportMarks[base] || null;
  }
  function markForCompetitionId(competitionId){
    const id = String(competitionId || "");
    if (competitionMarks[id]) return competitionMarks[id];
    const major=id.match(/^competition:(?:golf:)?(masters|pga-championship|the-open|us-open)(?:-20\d\d|:20\d\d)?$/);if(major)return golfMajorMarks[major[1]];
    if (/^competition:wrc(?:[-:]|$)/.test(id)) return sportMarks.wrc;
    if (/^competition:formula-one(?:[-:]|$)/.test(id)) return eventMarks.f1;
    if (/^competition:motogp(?:[-:]|$)/.test(id)) return eventMarks.motogp;
    if (id === "competition:wsl-championship-tour") return eventMarks.wsl;
    if (/^competition:sailgp(?:[-:]|$)/.test(id)) return eventMarks.sailgp;
    if (/^competition:nfl(?:[-:]|$)/.test(id)) return eventMarks.nfl;
    const versionlessId = id.replace(/:(?:19|20)\d{2}(?:-\d{2})?(?::.*)?$/, "");
    if (competitionMarks[versionlessId]) return competitionMarks[versionlessId];
    if (/^competition:uefa-champions-league(?::|$)/.test(id)) return eventMarks["uefa-champions-league"];
    if (/^competition:tennis:us-open(?::|$)/.test(id)) return eventMarks["us-open"];
    if (/^competition:tennis:australian-open(?::|$)/.test(id)) return eventMarks["australian-open"];
    if (/^tournament:tennis:joint:cincinnati-open(?::|$)/.test(id)) return eventMarks["cincinnati-open"];
    if (/^competition:afl(?::|$)/.test(id)) return eventMarks.afl;
    if (/^competition:nrl(?::|$)/.test(id)) return eventMarks.nrl;
    return null;
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
    const slotParticipants = (Array.isArray(event?.participantSlots) ? event.participantSlots : []).map(slot => ({
      id:slot?.participantId,
      displayName:slot?.label || slot?.displayName || slot?.name,
      shortName:slot?.label || slot?.displayName || slot?.name,
      logoUrl:slot?.logoUrl || null,
      logoDarkUrl:slot?.logoDarkUrl || slot?.logoUrl || null,
      crestSourceUrl:slot?.sourceUrl || event?.sourceUrl || "",
      metadata:{ titleAliases:[slot?.label, slot?.displayName, slot?.name].filter(Boolean) },
    })).filter(participant => participant.id);
    const participantList = [...(Array.isArray(participants) ? participants : []), ...slotParticipants]; const byId = new Map(participantList.map(participant => [participant.id, participant])); const resolved = []; const seen = new Set();
    const fixtureParticipantIds = new Set([...(Array.isArray(event?.participantIds) ? event.participantIds : []), ...slotParticipants.map(participant => participant.id)]);
    const addParticipant = participant => {
      // These source repairs are exact-ID references, not new name aliases.
      if (reviewedFootballClubMarks[participant?.id] && !fixtureParticipantIds.has(participant.id)) return;
      const mark = participantMarks[participant?.id] || directoryMarkForParticipant(participant); if (!participant || !mark || seen.has(participant.id)) return; seen.add(participant.id); resolved.push(Object.freeze({ participant, mark }));
    };
    const nationalTeamIdentities = getNationalTeamIdentities();
    [...(Array.isArray(event?.participantIds) ? event.participantIds : []), ...slotParticipants.map(participant => participant.id)].map(participantId => nationalTeamIdentities?.canonicalId(participantId) || participantId).map(participantId => byId.get(participantId) || identityParticipants[participantId]).forEach(addParticipant);
    (nationalTeamIdentities?.identitiesForEvent({ ...event, name:title || event?.name }) || []).map(team => nationalTeamIdentities.participantsById[team.id]).forEach(addParticipant);
    const registeredPrefixes = participantIdPrefixesByEventKey[event?.key] || [];
    if (resolved.length < 2 && registeredPrefixes.length && /\s+v\.?\s+/i.test(title)){
      const registeredParticipants = Object.values(identityParticipants).filter(participant => registeredPrefixes.some(prefix => participant.id.startsWith(prefix)));
      [...participantList.filter(participant=>registeredPrefixes.some(prefix=>String(participant?.id||"").startsWith(prefix))), ...registeredParticipants]
        .filter(participant => participantMarks[participant.id] || participant.crestUrl || participant.logoUrl)
        .filter(participant => aliasRange(title, participant))
        .forEach(addParticipant);
    }
    if (event?.key === "cricket") cricketParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "rugby") rugbyParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "premier-league") footballParticipants.filter(participant => aliasRange(title, participant)).forEach(addParticipant);
    const nationalParticipants = nationalTeamIdentities?.participants || [];
    if (["fifa", "football"].includes(event?.key)) nationalParticipants.filter(participant => participant.id.startsWith("team:football:") && aliasRange(title, participant)).forEach(addParticipant);
    if (event?.key === "nrl") nationalParticipants.filter(participant => participant.id.startsWith("team:nrl:") && aliasRange(title, participant)).forEach(addParticipant);
    if (["netball", "cwg"].includes(event?.key)) nationalParticipants.filter(participant => participant.id.startsWith("team:netball:") && aliasRange(title, participant)).forEach(addParticipant);
    return resolved;
  }
  function directoryMarkForParticipant(participant){
    const light = participant?.crestUrl || participant?.logoUrl;
    if (!participant?.id || !light) return null;
    const dark = participant?.logoDarkUrl || light;
    const label = participant.displayName || participant.canonicalName || participant.shortName || participant.id;
    return Object.freeze({
      ...referenceMark(`participant:${participant.id}`, label, light, participant.crestSourceUrl || participant.sourceUrl || "", {
        assetSource:light,
        logo:{ dark, iconDark:dark, backgroundLight:"light", backgroundDark:"dark" },
      }),
      aliases:Object.freeze(participantAliases(participant)),
      fallbackCountryCode:participant.countryCode || participant.metadata?.countryCode || "",
    });
  }
  const TEAM_SPORT_KEYS = new Set(["afl", "nrl", "nrlw", "rugby", "cricket", "fifa", "football", "premier-league", "bundesliga", "la-liga", "serie-a", "ligue-1", "nba", "basketball", "nfl", "american-football", "cwg", "netball", "hockey", "ice-hockey"]);
  function isTeamSportMatchup(event, title = ""){
    return TEAM_SPORT_KEYS.has(String(event?.key || "")) && /\s+v\.?\s+/i.test(String(title || event?.name || ""));
  }
  function cleanMatchupSideLabel(value, side){
    let label = String(value || "").trim().replace(/^(?:(?:Qualifying & Elimination|Qualifying|Elimination|Semi|Preliminary|Grand) Final(?: \d+)?|Finals?)\s*[-—–:]\s*/i, "");
    if (side === 0 && /\s[—–]\s/.test(label)) label = label.split(/\s[—–]\s/).pop().trim();
    if (side === 1 && /\s[—–]\s/.test(label)) label = label.split(/\s[—–]\s/)[0].trim();
    label = label.replace(/\s+(?:[—–-])\s+(?:group|round|quarterfinal|semifinal|semi final|preliminary final|grand final|final)\b.*$/i, "").trim();
    return label || "Team";
  }
  function matchupSidesForEvent(event, participants, title = ""){
    const source = String(title || event?.name || "");
    if (!isTeamSportMatchup(event, source)) return [];
    const divider = /\s+v\.?\s+/i.exec(source);
    if (!divider) return [];
    const labels = [cleanMatchupSideLabel(source.slice(0, divider.index), 0), cleanMatchupSideLabel(source.slice(divider.index + divider[0].length), 1)];
    const resolved = participantMarksForEvent(event, participants, source);
    const labelsApi = globalThis.NOTHINGSPORTS_FIXTURE_LABELS || (typeof require === "function" ? require("./fixture-labels") : null);
    const sides = labels.map((label, index) => {
      const explicitId=event.participantSlots?.[index]?.participantId || event.participantIds?.[index];
      const identity = resolved.find(candidate => {
        if (reviewedFootballClubMarks[candidate.participant?.id] && candidate.participant.id !== explicitId) return false;
        const record=labelsApi ? labelsApi.participantRecord(candidate.participant,event,participants) : candidate.participant;
        return aliasRange(label,{...record,metadata:{...(record.metadata||{}),titleAliases:[...(record.metadata?.titleAliases||[]),...(record.aliases||[]),...(candidate.mark?.aliases||[]),labelsApi?labelsApi.displayName(record.name,event):record.name].filter(Boolean)}});
      }) || resolved.find(candidate => candidate.participant?.id === explicitId) || null;
      const supplied=[...(event.participants||[]),...(participants||[])].find(p=>(p.id||p.participantId)===explicitId);
      // Artwork may be unavailable while the sourced participant is known.
      // Preserve that identity for profile/follow links without inventing a logo.
      const participant=identity?.participant || (explicitId?{...supplied,id:explicitId,displayName:supplied?.displayName||supplied?.name||label}:null);
      return Object.freeze({ label, participant, mark:identity?.mark || null });
    });
    return labelsApi ? labelsApi.australianFirst(sides,event,participants) : sides;
  }
  function logoForTheme(mark, { context = "primary", useDark = false } = {}){
    const assets = mark?.logo || {};
    const themedContext = `${context}${useDark ? "Dark" : "Light"}`;
    return assets[themedContext] || assets[useDark ? "dark" : "light"] || assets[context] || assets.primary || mark?.url || "";
  }
  return Object.freeze({ schemaVersion: "card-identities.v4", policy: Object.freeze({ protectedMarks: "official-reference-or-open-use-sport-mark", nationalTeamFallbackOrder:Object.freeze(["team-logo", "federation-crest", "coat-of-arms"]), nationalTeamFlags:false, displayUse: "editorial-identification", bundledCopies: true }), get nationalTeamIdentities(){ return getNationalTeamIdentities(); }, eventMarks, sportMarks, participantMarks, brandRules, competitionMarks, markForCompetitionId, markForEvent, participantMarksForEvent, matchupSidesForEvent, isTeamSportMatchup, participantAliases, aliasRange, logoForTheme });
});
