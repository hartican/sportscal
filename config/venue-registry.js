(function attachNothingSportsVenueRegistry(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_VENUE_REGISTRY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsVenueRegistry(){
  "use strict";

  const VERSION = "venue-registry.v3";
  // Optional official names and aliases expand to the same public record shape.
  const ENTRIES = Object.freeze([
    ["autodromo-hermanos-rodriguez", "Autódromo Hermanos Rodríguez"],
    ["autodromo-jose-carlos-pace", "Autódromo José Carlos Pace"],
    ["autodromo-nazionale-monza", "Autodromo Nazionale Monza"],
    ["baku-city-circuit", "Baku City Circuit"],
    ["circuit-de-spa-francorchamps", "Circuit de Spa-Francorchamps"],
    ["circuit-of-the-americas", "Circuit of The Americas"],
    ["circuit-zandvoort", "Circuit Zandvoort"],
    ["hungaroring", "Hungaroring"],
    ["las-vegas-strip-circuit", "Las Vegas Strip Circuit"],
    ["madring", "Madring"],
    ["marina-bay-street-circuit", "Marina Bay Street Circuit"],
    ["mount-panorama", "Mount Panorama"],
    ["pat-rafter-arena", "Pat Rafter Arena"],
    ["sepang-international-circuit", "Sepang International Circuit"],
    ["yas-marina-circuit", "Yas Marina Circuit"],
    ["us-open-louis-armstrong", "Louis Armstrong Stadium"],
    ["arthur-ashe-stadium", "Arthur Ashe Stadium"],
    ["stadium-australia", "Stadium Australia", "Accor Stadium", ["Accor Stadium", "Accor Stadium, Sydney"]],
    ["sydney-football-stadium", "Sydney Football Stadium", "Allianz Stadium", ["Allianz Stadium", "Allianz Stadium, Sydney"]],
    ["brookvale-oval", "Brookvale Oval", "4 Pines Park"],
    ["melbourne-rectangular-stadium", "Melbourne Rectangular Stadium", "AAMI Park"],
    ["gabba", "the Gabba", "Brisbane Cricket Ground", ["Brisbane Cricket Ground", "Gabba, Brisbane"]],
    ["bellerive-oval", "Bellerive Oval", ["Bellerive Oval", "Bellerive Oval, Hobart"]],
    ["kardinia-park", "Kardinia Park", "GMHBA Stadium", ["GMHBA Stadium, Geelong"]],
    ["docklands-stadium", "Docklands Stadium", "Marvel Stadium", ["Marvel Stadium", "Marvel Stadium, Melbourne"]],
    ["gio-stadium", "Bruce stadium", "GIO Stadium Canberra", ["GIO Stadium", "GIO Stadium Canberra", "Canberra Stadium", "Bruce Stadium", "Bruce stadium"]],
    ["manuka-oval", "Manuka Oval", "Corroboree Group Oval", ["Corroboree Group Oval, Manuka", "Corroboree Group Oval Manuka, Canberra", "Manuka Oval, Canberra"]],
    ["shark-park", "Shark Park", "Ocean Protect Stadium"],
    ["perth-stadium", "Perth Stadium", "Optus Stadium", ["Optus Stadium", "Optus Stadium, Perth", "Perth Stadium"]],
    ["lang-park", "Lang Park", "Suncorp Stadium", ["Suncorp Stadium", "Suncorp Stadium, Brisbane"]],
    ["townsville-stadium", "Townsville Stadium", "Queensland Country Bank Stadium", ["Queensland Country Bank Stadium", "Queensland Country Bank Stadium, Townsville"]],
    ["robina-stadium", "Robina Stadium", "Cbus Super Stadium"],
    ["parramatta-stadium", "Parramatta Stadium", "CommBank Stadium"],
    ["sydney-showground-stadium", "Sydney Showground", "ENGIE Stadium", ["ENGIE Stadium", "ENGIE Stadium, Sydney", "Sydney Showground Stadium"]],
    ["jubilee-oval", "Kogarah Oval", "Netstrata Jubilee Stadium", ["Netstrata Jubilee Stadium", "Jubilee Oval", "Jubilee Stadium"]],
    ["scg", "the SCG", "Sydney Cricket Ground", ["SCG", "SCG, Sydney", "Sydney Cricket Ground"]],
    ["mcg", "the MCG", "Melbourne Cricket Ground", ["MCG", "MCG, Melbourne", "Melbourne Cricket Ground"]],
    ["hbf-park", "HBF Park", ["HBF Park", "HBF Park, Perth"]],
    ["eden-park", "Eden Park", ["Eden Park", "Eden Park, Auckland"]],
    ["ellis-park", "Ellis Park", ["Ellis Park, Johannesburg"]],
    ["twickenham", "Twickenham", "Twickenham Stadium", ["Twickenham Stadium, London"]],
    ["murrayfield", "Murrayfield", "Murrayfield Stadium", ["Murrayfield Stadium, Edinburgh"]],
    ["all-england-club", "Wimbledon", "All England Club", ["All England Club, Wimbledon"]],
    ["melbourne-park", "Melbourne Park"],
    ["adelaide-oval", "Adelaide Oval", ["Adelaide Oval", "Adelaide Oval, Adelaide"]],
    ["alberton-oval", "Alberton Oval", ["Alberton Oval", "Alberton Oval, Adelaide"]],
    ["arden-street-oval", "Arden Street Oval", ["Arden Street Oval", "Arden Street Oval, Melbourne"]],
    ["brighton-homes-arena", "Brighton Homes Arena", ["Brighton Homes Arena", "Brighton Homes Arena, Ipswich"]],
    ["coffs-international-stadium", "Coffs International Stadium", "C.ex Coffs International Stadium", ["C.ex Coffs International Stadium", "C.ex Coffs International Stadium, Coffs Harbour"]],
    ["casey-fields", "Casey Fields", ["Casey Fields", "Casey Fields, Melbourne"]],
    ["cazalys-stadium", "Cazalys Stadium", ["Cazalys Stadium", "Cazalys Stadium, Cairns"]],
    ["cockburn-arc-oval", "Cockburn ARC", "Cockburn ARC Oval", ["Cockburn ARC Oval", "Cockburn ARC Oval, Perth"]],
    ["henson-park", "Henson Park", ["Henson Park", "Henson Park, Sydney"]],
    ["ikon-park", "Princes Park", "IKON Park", ["IKON Park", "IKON Park, Melbourne"]],
    ["kennedy-community-centre", "Kennedy Community Centre", ["Kennedy Community Centre", "Kennedy Community Centre, Dingley Village"]],
    ["eureka-stadium", "Eureka Stadium", "Mars Stadium", ["Mars Stadium", "Mars Stadium, Ballarat"]],
    ["lathlain-park", "Lathlain Park", "Mineral Resources Park", ["Mineral Resources Park", "Mineral Resources Park, Perth"]],
    ["western-oval", "Western Oval", "Mission Whitten Oval", ["Mission Whitten Oval", "Mission Whitten Oval, Melbourne", "Whitten Oval"]],
    ["north-hobart-oval", "North Hobart Oval", ["North Hobart Oval", "North Hobart Oval, Hobart"]],
    ["moorabbin-oval", "Moorabbin Oval", "RSEA Park", ["RSEA Park", "RSEA Park, Melbourne"]],
    ["leederville-oval", "Leederville Oval", "Sullivan Logistics Stadium", ["Sullivan Logistics Stadium", "Sullivan Logistics Stadium, Perth"]],
    ["unley-oval", "Unley Oval", ["Unley Oval", "Unley Oval, Adelaide"]],
    ["victoria-park-melbourne", "Victoria Park", ["Victoria Park, Melbourne"]],
    ["windy-hill", "Windy Hill", ["Windy Hill", "Windy Hill, Melbourne"]],
    ["albert-park-circuit", "Albert Park", "Albert Park Grand Prix Circuit", ["Albert Park Grand Prix Circuit", "Albert Park Grand Prix Circuit, Melbourne"]],
    ["mercedes-benz-stadium", "Mercedes-Benz Stadium", ["Atlanta Stadium", "Mercedes-Benz Stadium"]],
    ["augusta-national", "Augusta National", "Augusta National Golf Club"],
    ["bc-place", "BC Place", ["BC Place", "BC Place Vancouver"]],
    ["gillette-stadium", "Gillette Stadium", ["Boston Stadium", "Gillette Stadium"]],
    ["circuit-24-heures-du-mans", "Le Mans", "Circuit des 24 Heures du Mans", ["Circuit de la Sarthe, Le Mans", "Circuit des 24 Heures du Mans"]],
    ["att-stadium", "AT&T Stadium", ["Dallas Stadium", "AT&T Stadium"]],
    ["estadio-23-de-agosto", "23 de Agosto", "Estadio 23 de Agosto", ["Estadio 23 de Agosto", "Estadio 23 de Agosto, San Salvador de Jujuy"]],
    ["estadio-malvinas-argentinas", "Malvinas Argentinas", "Estadio Malvinas Argentinas", ["Estadio Malvinas Argentinas", "Estadio Malvinas Argentinas, Mendoza"]],
    ["glen-willow-stadium", "Glen Willow", "Club Mudgee Stadium", ["Glen Willow Oval", "Glen Willow Regional Sports Stadium", "Club Mudgee Stadium"]],
    ["mt-smart-stadium", "Mt Smart", "Go Media Stadium Mt Smart", ["Go Media Stadium", "Go Media Stadium Mt Smart", "Mt Smart Stadium"]],
    ["goodwood-estate", "Goodwood", "Goodwood Estate", ["Goodwood Estate", "Goodwood Estate, UK"]],
    ["ray-mitchell-oval", "Harrup Park", "Great Barrier Reef Arena", ["Great Barrier Reef Arena", "Great Barrier Reef Arena, Mackay", "Ray Mitchell Oval", "Harrup Park"]],
    ["hanazono-rugby-stadium", "Hanazono", "Higashiosaka Hanazono Rugby Stadium", ["Hanazono Rugby Stadium", "Hanazono Rugby Stadium, Osaka", "Higashiosaka Hanazono Rugby Stadium"]],
    ["nrg-stadium", "NRG Stadium", ["Houston Stadium", "NRG Stadium"]],
    ["arrowhead-stadium", "Arrowhead", "Arrowhead Stadium", ["Kansas City Stadium", "Arrowhead Stadium"]],
    ["levis-stadium", "Levi's Stadium", ["Levi's Stadium", "Levi's Stadium, Santa Clara", "San Francisco Bay Area Stadium"]],
    ["sofi-stadium", "SoFi Stadium", ["Los Angeles Stadium", "SoFi Stadium"]],
    ["marrara-cricket-ground", "Marrara", "Marrara Stadium", ["Marrara Cricket Ground", "Marrara Cricket Ground, Darwin", "Marrara Stadium", "TIO Stadium", "TIO Stadium, Darwin"]],
    ["newcastle-stadium", "Newcastle Stadium", "McDonald Jones Stadium", ["McDonald Jones Stadium", "Newcastle International Sports Centre", "Marathon Stadium", "EnergyAustralia Stadium"]],
    ["estadio-azteca", "the Azteca", "Estadio Banorte", ["Mexico City Stadium", "Estadio Azteca", "Estadio Banorte", "Estadio Ciudad de México"]],
    ["hard-rock-stadium", "Hard Rock Stadium", ["Miami Stadium", "Hard Rock Stadium"]],
    ["metlife-stadium", "MetLife Stadium", ["New York New Jersey Stadium", "MetLife Stadium"]],
    ["north-sydney-oval", "North Sydney Oval", ["North Sydney Oval", "Bear Park"]],
    ["carrara-stadium", "Carrara", "People First Stadium", ["People First Stadium", "People First Stadium, Gold Coast", "Carrara Stadium", "Metricon Stadium", "Heritage Bank Stadium", "Gold Coast Stadium"]],
    ["kingsmead-cricket-ground", "Kingsmead", "Hollywoodbets Kingsmead Stadium", ["Kingsmead", "Kingsmead, Durban", "Hollywoodbets Kingsmead Stadium"]],
    ["st-georges-park-cricket-ground", "St George's Park", "St George's Park Cricket Ground", ["St George's Park", "St George's Park, Gqeberha", "St George's Park Cricket Ground"]],
    ["newlands-cricket-ground", "Newlands", "Newlands Cricket Ground", ["Newlands", "Newlands, Cape Town", "Newlands Cricket Ground"]],
    ["lincoln-financial-field", "the Linc", "Lincoln Financial Field", ["Philadelphia Stadium", "Lincoln Financial Field"]],
    ["millennium-stadium", "Millennium Stadium", "Principality Stadium", ["Principality Stadium", "Principality Stadium, Cardiff", "Millennium Stadium"]],
    ["sec-armadillo", "the Armadillo", "SEC Armadillo", ["SEC Armadillo", "Clyde Auditorium"]],
    ["scotstoun-stadium", "Scotstoun", "Scotstoun Stadium", ["Scotstoun Stadium", "EDF Scotstoun Stadium"]],
    ["lumen-field", "Lumen Field", ["Seattle Stadium", "Lumen Field"]],
    ["silverstone-circuit", "Silverstone", "Silverstone Circuit"],
    ["sir-chris-hoy-velodrome", "Chris Hoy Velodrome", "Sir Chris Hoy Velodrome"],
    ["the-hydro", "the Hydro", "OVO Hydro", ["The Hydro", "OVO Hydro"]],
    ["tollcross-swimming-centre", "Tollcross", "Tollcross International Swimming Centre"],
    ["york-park", "York Park", "UTAS Stadium", ["UTAS Stadium", "UTAS Stadium, Launceston", "York Park"]],
    ["wollongong-showground", "WIN Stadium", ["WIN Stadium", "Wollongong Showground"]],
    ["lindner-family-tennis-center", "Cincinnati Open", "Lindner Family Tennis Center"],
    ["usta-billie-jean-king-national-tennis-center", "US Open", "USTA Billie Jean King National Tennis Center", ["USTA Billie Jean King National Tennis Center", "Billie Jean King National Tennis Center"]],
    ["nevis-range-downhill", "Fort William", "Nevis Range Mountain Experience", ["Nevis Range Mountain Experience", "Nevis Range downhill track"]],
    ["margaret-river-main-break", "Main Break", "Surfers Point", ["Main Break", "Surfers Point"]],
    ["banzai-pipeline", "Pipeline", "ʻEhukai Beach Park", ["Banzai Pipeline", "Pipeline", "ʻEhukai Beach Park"]],
    ["praia-do-norte", "Nazaré", "Praia do Norte"],
    ["kvitfjell-olympiabakken", "Kvitfjell", "Olympiabakken"],
    ["shahdag-fis-stadium", "Shahdag", "Shahdag FIS Stadium"],
    ["sun-valley-challenger", "Sun Valley", "Challenger course at Sun Valley Resort"],
    ["glasgow-international-arena", "Glasgow International Arena", ["Glasgow International Arena", "Emirates Arena"]],
    ["sec-centre", "the SEC", "SEC Centre"],
    ["american-express-stadium", "American Express Stadium", ["American Express Stadium", "Amex Stadium"]],
    ["anfield", "Anfield"],
    ["coventry-building-society-arena", "Coventry Building Society Arena"],
    ["craven-cottage", "Craven Cottage"],
    ["elland-road", "Elland Road"],
    ["emirates-stadium", "Emirates Stadium"],
    ["etihad-stadium-manchester", "Etihad Stadium", ["Etihad Stadium, Manchester"]],
    ["gtech-community-stadium", "Gtech Community Stadium"],
    ["hill-dickinson-stadium", "Hill Dickinson Stadium"],
    ["old-trafford", "Old Trafford"],
    ["portman-road", "Portman Road"],
    ["selhurst-park", "Selhurst Park"],
    ["st-james-park-newcastle", "St James' Park", ["St. James' Park", "St James' Park"]],
    ["stadium-of-light", "Stadium of Light"],
    ["stamford-bridge", "Stamford Bridge"],
    ["city-ground-nottingham", "The City Ground", ["The City Ground", "City Ground"]],
    ["mkm-stadium", "MKM Stadium", "The MKM Stadium", ["The MKM Stadium", "MKM Stadium"]],
    ["tottenham-hotspur-stadium", "Tottenham Hotspur Stadium"],
    ["villa-park", "Villa Park"],
    ["vitality-stadium", "Vitality Stadium"],
    ["leichhardt-oval", "Leichhardt Oval"],
    ["totally-workwear-stadium", "Totally Workwear Stadium"],
    ["uber-arena-berlin", "Uber Arena", ["Uber Arena, Berlin"]],
    ["algarve-international-circuit", "Algarve International Circuit"],
    ["circuit-ricardo-tormo", "Circuit Ricardo Tormo"],
    ["lusail-international-circuit", "Lusail International Circuit"],
    ["misano-world-circuit", "Misano World Circuit", "Misano World Circuit Marco Simoncelli"],
    ["mobility-resort-motegi", "Motegi", "Mobility Resort Motegi"],
    ["mandalika-international-circuit", "Mandalika", "Pertamina Mandalika International Circuit"],
    ["sepang-international-circuit", "Sepang", "Petronas Sepang International Circuit"],
    ["phillip-island-grand-prix-circuit", "Phillip Island", "Phillip Island Grand Prix Circuit"],
    ["red-bull-ring", "Red Bull Ring"],
    ["abu-dhabi-sailgp", "Abu Dhabi", "Abu Dhabi, United Arab Emirates"],
    ["dubai-sailgp", "Dubai", "Dubai, United Arab Emirates"],
    ["geneva-sailgp", "Geneva", "Geneva, Switzerland"],
    ["valencia-sailgp", "Valencia", "Valencia, Spain"],
    ["american-family-field", "American Family Field"],
    ["daikin-park", "Daikin Park"],
    ["petco-park", "Petco Park"],
    ["progressive-field", "Progressive Field"],
    ["rate-field", "Rate Field"],
    ["tropicana-field", "Tropicana Field"],
    ["truist-park", "Truist Park"],
    ["dodger-stadium", "Dodger Stadium", "UNIQLO Field at Dodger Stadium", ["UNIQLO Field at Dodger Stadium", "Dodger Stadium"]],
    ["yankee-stadium", "Yankee Stadium"],
    ["china-national-tennis-center", "China National Tennis Center"],
    ["ariake-tennis-forest-park", "Ariake Tennis Forest Park"],
    ["qizhong-tennis-center", "Qizhong Tennis Centre", "Qizhong Forest Sports City Tennis Center"],
    ["optics-valley-tennis-center", "Optics Valley International Tennis Centre"],
    ["caulfield-racecourse", "Caulfield Racecourse"],
    ["flemington-racecourse", "Flemington Racecourse"],
    ["royal-randwick-racecourse", "Royal Randwick", "Royal Randwick Racecourse", ["Royal Randwick", "Royal Randwick Racecourse"]],
    ["rosehill-gardens-racecourse", "Rosehill Gardens", "Rosehill Gardens Racecourse", ["Rosehill Gardens", "Rosehill Gardens Racecourse"]]
  ].map(([id, displayName, third, fourth]) => {
    const officialName = Array.isArray(third) ? displayName : third || displayName;
    const aliases = Array.isArray(third) ? third : fourth || [officialName];
    return Object.freeze({ id, displayName, officialName, aliases: Object.freeze(aliases) });
  }));

  const CONTEXTUAL_ALIASES = Object.freeze({
    "caulfield": Object.freeze({id:"caulfield-racecourse",keys:Object.freeze(["horse-racing"])}),
    "flemington": Object.freeze({id:"flemington-racecourse",keys:Object.freeze(["horse-racing"])}),
    "grandstand": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 6": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 7": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 11": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 12": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 13": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),
    "court 15": Object.freeze({id:"usta-billie-jean-king-national-tennis-center", keys:Object.freeze(["tennis"]), eventSeriesId:"event-series:us-open"}),

    "brisbane stadium": Object.freeze({ id: "lang-park", keys: Object.freeze(["rugby"]) }),
    "cincinnati usa": Object.freeze({ id: "lindner-family-tennis-center", keys: Object.freeze(["tennis", "wimbledon"]) }),
    "new york usa": Object.freeze({ id: "usta-billie-jean-king-national-tennis-center", keys: Object.freeze(["tennis"]) }),
    "fort william": Object.freeze({ id: "nevis-range-downhill", keys: Object.freeze(["downhill-mtb"]) }),
    "margaret river western australia": Object.freeze({ id: "margaret-river-main-break", keys: Object.freeze(["wsl"]) }),
    "honolulu hawaii": Object.freeze({ id: "banzai-pipeline", keys: Object.freeze(["big-wave"]) }),
    "nazare portugal": Object.freeze({ id: "praia-do-norte", keys: Object.freeze(["big-wave"]) }),
    "kvitfjell norway": Object.freeze({ id: "kvitfjell-olympiabakken", keys: Object.freeze(["ski"]) }),
    "shahdag azerbaijan": Object.freeze({ id: "shahdag-fis-stadium", keys: Object.freeze(["ski"]) }),
    "sun valley idaho": Object.freeze({ id: "sun-valley-challenger", keys: Object.freeze(["ski"]) }),
    "the arena": Object.freeze({ id: "glasgow-international-arena", keys: Object.freeze(["cwg"]) }),
    "scottish event campus": Object.freeze({ id: "sec-centre", keys: Object.freeze(["cwg"]) }),
    "etihad stadium": Object.freeze({ id: "etihad-stadium-manchester", keys: Object.freeze(["premier-league"]) }),
    "berlin germany": Object.freeze({ id: "uber-arena-berlin", keys: Object.freeze(["fiba-women"]) }),
  });

  const REVIEW_DISPOSITIONS = Object.freeze({
    "beijing chn": "source_name_pending_review",
    // Newly refreshed source labels: preserve verbatim until canonical venue review.
    "adelaide entertainment centre": "source_name_pending_review",
    "afterpay arena": "source_name_pending_review",
    "ais arena": "source_name_pending_review",
    "augusta national golf club georgia": "source_name_pending_review",
    "brisbane entertainment centre": "source_name_pending_review",
    "cairns convention centre": "source_name_pending_review",
    "gippsland regional indoor sports stadium": "source_name_pending_review",
    "john cain arena": "source_name_pending_review",
    "mystate bank arena": "source_name_pending_review",
    "nissan arena": "source_name_pending_review",
    "pat rafter arena subject to change": "source_name_pending_review",
    "pebble beach golf links california": "source_name_pending_review",
    "pga frisco texas": "source_name_pending_review",
    "rac arena": "source_name_pending_review",
    "red energy arena bendigo": "source_name_pending_review",
    "shenzhen chn": "source_name_pending_review",
    "silverdome": "source_name_pending_review",
    "spark arena": "source_name_pending_review",
    "state basketball centre": "source_name_pending_review",
    "tbc": "competition_placeholder",
    "the old course st andrews": "source_name_pending_review",
    "win entertainment centre": "source_name_pending_review",
    "venue tbc": "competition_placeholder",
    "2026 nba finals": "competition_placeholder",
    "belfort": "place_or_route",
    "chalon sur saone": "place_or_route",
    "chile": "place_or_route",
    "croatia": "place_or_route",
    "estonia": "place_or_route",
    "finland": "place_or_route",
    "greece": "place_or_route",
    "italy": "place_or_route",
    "japan": "place_or_route",
    "kenya": "place_or_route",
    "le markstein": "place_or_route",
    "monaco": "place_or_route",
    "paraguay": "place_or_route",
    "portugal": "place_or_route",
    "saudi arabia": "place_or_route",
    "spain": "place_or_route",
    "sweden": "place_or_route",
    "tour de france 2026": "competition_placeholder",
    "davos switzerland": "quarantine_conflicting_fixture",
    "marrakech to ouarzazate": "quarantine_conflicting_fixture",
    "nairobi to malindi": "quarantine_unverified_route",
    // 4 October full-source inventory: retain observed names without claiming
    // a canonical venue. These exact labels remain pending independent review.
    ...Object.fromEntries(["Ariake Colosseum, Tokyo","Auckland","Belmore Sports Ground","Bermuda","Campbelltown Sports Stadium","Concepción","Encarnación","Eric Tweedale Stadium","Exponor service park","FMG Stadium Waikato","Gap / Monaco","Geneva","Geohex Park","Gran Canaria Stadium service park","Grobnik Circuit service park","Halifax","Jyväskylä","Loutraki","Lungomare Barcellona service park","Monaco / French Alps","Naivasha","National Tennis Center, Beijing","New York","Polytec Stadium","Portsmouth","Rio","San Francisco","Sassnitz","St George Venues Jubilee Stadium","Sydney","Tartu","Toyota Stadium service park","Umeå","Valencia"].map(name=>[normalise(name),"source_name_pending_review"])),
  });

  function normalise(value){
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  const aliasIndex = new Map();
  ENTRIES.forEach(entry => entry.aliases.forEach(alias => aliasIndex.set(normalise(alias), entry)));
  const entriesById = new Map(ENTRIES.map(entry => [entry.id, entry]));

  function fallbackId(value){
    return `venue:${normalise(value).replace(/\s+/g, "-") || "unknown"}`;
  }

  // Exact reviewed 2026 tournament identities; a city alone cannot select a site.
  // The second court list retains source labels whose current identity needs review.
  const TENNIS_SITES = [
    ["beijing", ["atp", "wta"], "china-national-tennis-center", ["Capital Group Diamond", "Brad Drewett", "Lotus"], ["HSBC Moon", "Court 3", "Court 4", "Court 5"]],
    ["tokyo", ["atp"], "ariake-tennis-forest-park", ["Colosseum"], ["Kinoshita Group Show Court", "Court 1", "Court 2"]],
    ["shanghai", ["atp"], "qizhong-tennis-center", ["Stadium Court", "Grandstand 2", "Show Court 3", "Court 4"], ["Court 7"]],
    // Current publisher labels are retained only for this exact edition. They
    // do not attest a physical court identity, location or official assignment.
    ["wuhan", ["wta"], "optics-valley-tennis-center", [], ["Court 1", "Court 2", "Dongfeng Voyah Center Court"]],
  ];

  function tennisVenue(normalized, context){
    if (context.key !== "tennis") return null;
    if (context.tennisTournamentId && context.tournamentId && context.tennisTournamentId !== context.tournamentId) return null;
    const tournament = context.tennisTournamentId || context.tournamentId;
    const site = TENNIS_SITES.find(([city, tours]) => tours.some(tour => tournament === `tournament:tennis:${tour}-${city}-2026`));
    if (!site) return null;
    const [city, , facilityId, reviewed, pending] = site;
    if (normalized === city || (city === "shanghai" && normalized === "shanghai chn")) return { ...entriesById.get(facilityId), audited: true };
    const name = [...reviewed, ...pending].find(name => normalise(name) === normalized);
    if (!name) return null;
    const audited = reviewed.includes(name);
    return Object.freeze({
      id: `${facilityId}/${normalise(name).replace(/\s+/g, "-")}`,
      displayName: name, officialName: name, aliases: Object.freeze([name]),
      audited, ...(!audited ? { reviewDisposition: "court_identity_pending_review" } : {}),
    });
  }

  function resolve(value, context = {}){
    const officialName = String(value || "").trim();
    if (!officialName) return null;
    const normalized = normalise(officialName);
    let entry = aliasIndex.get(normalized);
    const tennis = !entry && tennisVenue(normalized, context);
    if (tennis) return tennis;
    const contextual = CONTEXTUAL_ALIASES[normalized];
    if (!entry && contextual && contextual.keys.includes(String(context?.key || "")) && (!contextual.eventSeriesId || context.eventSeriesId === contextual.eventSeriesId || /us-open/.test(context.id || context.parentEventId || ""))) entry = entriesById.get(contextual.id);
    if (!entry && context.venueVerified === true && context.venueOfficialName === officialName) entry = {id:context.venueId || fallbackId(officialName),displayName:officialName,officialName,aliases:[officialName]};
    if (entry) return Object.freeze({ ...entry, audited: true });
    return Object.freeze({
      id: fallbackId(officialName),
      displayName: officialName,
      officialName,
      aliases: Object.freeze([officialName]),
      audited: false,
      reviewDisposition: REVIEW_DISPOSITIONS[normalized] || (contextual ? "context_required" : "unclassified"),
    });
  }

  function audit(events){
    const byInput = new Map();
    (events || []).forEach(event => {
      const venue = String(event?.venue || "").trim();
      if (!venue) return;
      const record = resolve(venue, event);
      const contexts = byInput.get(venue) || new Map();
      const key = [event.key || "", event.tennisTournamentId || event.tournamentId || "", event.eventSeriesId || "", record.id, record.reviewDisposition || ""].join("|");
      contexts.set(key, record);
      byInput.set(venue, contexts);
    });
    const records = [...byInput.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([input, contexts]) => ({
      input, contexts: [...contexts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, record]) => ({ key, ...record })),
    }));
    const pending = records.filter(record => record.contexts.some(context => !context.audited));
    return Object.freeze({
      version: VERSION,
      total: records.length,
      audited: records.length - pending.length,
      pending: pending.map(record => record.input),
      dispositions: pending.flatMap(record => record.contexts.filter(context => !context.audited).map(context => Object.freeze({ input: record.input, disposition: context.reviewDisposition, context: context.key }))),
      unclassified: records.filter(record => record.contexts.some(context => context.reviewDisposition === "unclassified")).map(record => record.input),
      contexts: records.flatMap(record => record.contexts.map(context => Object.freeze({ input: record.input, ...context }))),
    });
  }

  // The browser uses the resolver; inventory and audit are Node release checks.
  return Object.freeze({ VERSION, normalise, resolve, ...(typeof module !== "undefined" && module.exports ? { ENTRIES, CONTEXTUAL_ALIASES, REVIEW_DISPOSITIONS, audit } : {}) });
});
