(function attachNothingSportsVenueRegistry(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_VENUE_REGISTRY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsVenueRegistry(){
  "use strict";

  const VERSION = "venue-registry.v2";
  const ENTRIES = Object.freeze([
    ["stadium-australia", "Stadium Australia", "Accor Stadium", ["Accor Stadium", "Accor Stadium, Sydney"]],
    ["sydney-football-stadium", "Sydney Football Stadium", "Allianz Stadium", ["Allianz Stadium", "Allianz Stadium, Sydney"]],
    ["brookvale-oval", "Brookvale Oval", "4 Pines Park", ["4 Pines Park"]],
    ["melbourne-rectangular-stadium", "Melbourne Rectangular Stadium", "AAMI Park", ["AAMI Park"]],
    ["gabba", "the Gabba", "Brisbane Cricket Ground", ["Brisbane Cricket Ground", "Gabba, Brisbane"]],
    ["bellerive-oval", "Bellerive Oval", "Bellerive Oval", ["Bellerive Oval", "Bellerive Oval, Hobart"]],
    ["kardinia-park", "Kardinia Park", "GMHBA Stadium", ["GMHBA Stadium, Geelong"]],
    ["docklands-stadium", "Docklands Stadium", "Marvel Stadium", ["Marvel Stadium", "Marvel Stadium, Melbourne"]],
    ["gio-stadium", "Bruce stadium", "GIO Stadium Canberra", ["GIO Stadium", "GIO Stadium Canberra", "Canberra Stadium", "Bruce Stadium", "Bruce stadium"]],
    ["manuka-oval", "Manuka Oval", "Corroboree Group Oval", ["Corroboree Group Oval, Manuka", "Corroboree Group Oval Manuka, Canberra", "Manuka Oval, Canberra"]],
    ["shark-park", "Shark Park", "Ocean Protect Stadium", ["Ocean Protect Stadium"]],
    ["perth-stadium", "Perth Stadium", "Optus Stadium", ["Optus Stadium, Perth", "Perth Stadium"]],
    ["lang-park", "Lang Park", "Suncorp Stadium", ["Suncorp Stadium", "Suncorp Stadium, Brisbane"]],
    ["townsville-stadium", "Townsville Stadium", "Queensland Country Bank Stadium", ["Queensland Country Bank Stadium", "Queensland Country Bank Stadium, Townsville"]],
    ["robina-stadium", "Robina Stadium", "Cbus Super Stadium", ["Cbus Super Stadium"]],
    ["parramatta-stadium", "Parramatta Stadium", "CommBank Stadium", ["CommBank Stadium"]],
    ["sydney-showground-stadium", "Sydney Showground", "ENGIE Stadium", ["ENGIE Stadium", "ENGIE Stadium, Sydney", "Sydney Showground Stadium"]],
    ["jubilee-oval", "Kogarah Oval", "Netstrata Jubilee Stadium", ["Netstrata Jubilee Stadium", "Jubilee Oval", "Jubilee Stadium"]],
    ["scg", "the SCG", "Sydney Cricket Ground", ["SCG, Sydney", "Sydney Cricket Ground"]],
    ["mcg", "the MCG", "Melbourne Cricket Ground", ["MCG, Melbourne", "Melbourne Cricket Ground"]],
    ["hbf-park", "HBF Park", "HBF Park", ["HBF Park", "HBF Park, Perth"]],
    ["eden-park", "Eden Park", "Eden Park", ["Eden Park, Auckland"]],
    ["ellis-park", "Ellis Park", "Ellis Park", ["Ellis Park, Johannesburg"]],
    ["twickenham", "Twickenham", "Twickenham Stadium", ["Twickenham Stadium, London"]],
    ["murrayfield", "Murrayfield", "Murrayfield Stadium", ["Murrayfield Stadium, Edinburgh"]],
    ["all-england-club", "Wimbledon", "All England Club", ["All England Club, Wimbledon"]],
    ["melbourne-park", "Melbourne Park", "Melbourne Park", ["Melbourne Park"]],
    ["adelaide-oval", "Adelaide Oval", "Adelaide Oval", ["Adelaide Oval", "Adelaide Oval, Adelaide"]],
    ["alberton-oval", "Alberton Oval", "Alberton Oval", ["Alberton Oval", "Alberton Oval, Adelaide"]],
    ["arden-street-oval", "Arden Street Oval", "Arden Street Oval", ["Arden Street Oval", "Arden Street Oval, Melbourne"]],
    ["brighton-homes-arena", "Brighton Homes Arena", "Brighton Homes Arena", ["Brighton Homes Arena", "Brighton Homes Arena, Ipswich"]],
    ["coffs-international-stadium", "Coffs International Stadium", "C.ex Coffs International Stadium", ["C.ex Coffs International Stadium", "C.ex Coffs International Stadium, Coffs Harbour"]],
    ["casey-fields", "Casey Fields", "Casey Fields", ["Casey Fields", "Casey Fields, Melbourne"]],
    ["cazalys-stadium", "Cazalys Stadium", "Cazalys Stadium", ["Cazalys Stadium", "Cazalys Stadium, Cairns"]],
    ["cockburn-arc-oval", "Cockburn ARC", "Cockburn ARC Oval", ["Cockburn ARC Oval", "Cockburn ARC Oval, Perth"]],
    ["henson-park", "Henson Park", "Henson Park", ["Henson Park", "Henson Park, Sydney"]],
    ["ikon-park", "Princes Park", "IKON Park", ["IKON Park", "IKON Park, Melbourne"]],
    ["kennedy-community-centre", "Kennedy Community Centre", "Kennedy Community Centre", ["Kennedy Community Centre", "Kennedy Community Centre, Dingley Village"]],
    ["eureka-stadium", "Eureka Stadium", "Mars Stadium", ["Mars Stadium", "Mars Stadium, Ballarat"]],
    ["lathlain-park", "Lathlain Park", "Mineral Resources Park", ["Mineral Resources Park", "Mineral Resources Park, Perth"]],
    ["western-oval", "Western Oval", "Mission Whitten Oval", ["Mission Whitten Oval", "Mission Whitten Oval, Melbourne", "Whitten Oval"]],
    ["north-hobart-oval", "North Hobart Oval", "North Hobart Oval", ["North Hobart Oval", "North Hobart Oval, Hobart"]],
    ["moorabbin-oval", "Moorabbin Oval", "RSEA Park", ["RSEA Park", "RSEA Park, Melbourne"]],
    ["leederville-oval", "Leederville Oval", "Sullivan Logistics Stadium", ["Sullivan Logistics Stadium", "Sullivan Logistics Stadium, Perth"]],
    ["unley-oval", "Unley Oval", "Unley Oval", ["Unley Oval", "Unley Oval, Adelaide"]],
    ["victoria-park-melbourne", "Victoria Park", "Victoria Park", ["Victoria Park, Melbourne"]],
    ["windy-hill", "Windy Hill", "Windy Hill", ["Windy Hill", "Windy Hill, Melbourne"]],
    ["albert-park-circuit", "Albert Park", "Albert Park Grand Prix Circuit", ["Albert Park Grand Prix Circuit", "Albert Park Grand Prix Circuit, Melbourne"]],
    ["mercedes-benz-stadium", "Mercedes-Benz Stadium", "Mercedes-Benz Stadium", ["Atlanta Stadium", "Mercedes-Benz Stadium"]],
    ["augusta-national", "Augusta National", "Augusta National Golf Club", ["Augusta National Golf Club"]],
    ["bc-place", "BC Place", "BC Place", ["BC Place", "BC Place Vancouver"]],
    ["gillette-stadium", "Gillette Stadium", "Gillette Stadium", ["Boston Stadium", "Gillette Stadium"]],
    ["circuit-24-heures-du-mans", "Le Mans", "Circuit des 24 Heures du Mans", ["Circuit de la Sarthe, Le Mans", "Circuit des 24 Heures du Mans"]],
    ["att-stadium", "AT&T Stadium", "AT&T Stadium", ["Dallas Stadium", "AT&T Stadium"]],
    ["estadio-23-de-agosto", "23 de Agosto", "Estadio 23 de Agosto", ["Estadio 23 de Agosto", "Estadio 23 de Agosto, San Salvador de Jujuy"]],
    ["estadio-malvinas-argentinas", "Malvinas Argentinas", "Estadio Malvinas Argentinas", ["Estadio Malvinas Argentinas", "Estadio Malvinas Argentinas, Mendoza"]],
    ["glen-willow-stadium", "Glen Willow", "Club Mudgee Stadium", ["Glen Willow Oval", "Glen Willow Regional Sports Stadium", "Club Mudgee Stadium"]],
    ["mt-smart-stadium", "Mt Smart", "Go Media Stadium Mt Smart", ["Go Media Stadium", "Go Media Stadium Mt Smart", "Mt Smart Stadium"]],
    ["goodwood-estate", "Goodwood", "Goodwood Estate", ["Goodwood Estate", "Goodwood Estate, UK"]],
    ["ray-mitchell-oval", "Harrup Park", "Great Barrier Reef Arena", ["Great Barrier Reef Arena", "Great Barrier Reef Arena, Mackay", "Ray Mitchell Oval", "Harrup Park"]],
    ["hanazono-rugby-stadium", "Hanazono", "Higashiosaka Hanazono Rugby Stadium", ["Hanazono Rugby Stadium", "Hanazono Rugby Stadium, Osaka", "Higashiosaka Hanazono Rugby Stadium"]],
    ["nrg-stadium", "NRG Stadium", "NRG Stadium", ["Houston Stadium", "NRG Stadium"]],
    ["arrowhead-stadium", "Arrowhead", "Arrowhead Stadium", ["Kansas City Stadium", "Arrowhead Stadium"]],
    ["levis-stadium", "Levi's Stadium", "Levi's Stadium", ["Levi's Stadium", "Levi's Stadium, Santa Clara", "San Francisco Bay Area Stadium"]],
    ["sofi-stadium", "SoFi Stadium", "SoFi Stadium", ["Los Angeles Stadium", "SoFi Stadium"]],
    ["marrara-cricket-ground", "Marrara", "Marrara Stadium", ["Marrara Cricket Ground", "Marrara Cricket Ground, Darwin", "Marrara Stadium", "TIO Stadium", "TIO Stadium, Darwin"]],
    ["newcastle-stadium", "Newcastle Stadium", "McDonald Jones Stadium", ["McDonald Jones Stadium", "Newcastle International Sports Centre", "Marathon Stadium", "EnergyAustralia Stadium"]],
    ["estadio-azteca", "the Azteca", "Estadio Banorte", ["Mexico City Stadium", "Estadio Azteca", "Estadio Banorte", "Estadio Ciudad de México"]],
    ["hard-rock-stadium", "Hard Rock Stadium", "Hard Rock Stadium", ["Miami Stadium", "Hard Rock Stadium"]],
    ["metlife-stadium", "MetLife Stadium", "MetLife Stadium", ["New York New Jersey Stadium", "MetLife Stadium"]],
    ["north-sydney-oval", "North Sydney Oval", "North Sydney Oval", ["North Sydney Oval", "Bear Park"]],
    ["carrara-stadium", "Carrara", "People First Stadium", ["People First Stadium", "People First Stadium, Gold Coast", "Carrara Stadium", "Metricon Stadium", "Heritage Bank Stadium", "Gold Coast Stadium"]],
    ["kingsmead-cricket-ground", "Kingsmead", "Hollywoodbets Kingsmead Stadium", ["Kingsmead", "Kingsmead, Durban", "Hollywoodbets Kingsmead Stadium"]],
    ["st-georges-park-cricket-ground", "St George's Park", "St George's Park Cricket Ground", ["St George's Park", "St George's Park, Gqeberha", "St George's Park Cricket Ground"]],
    ["newlands-cricket-ground", "Newlands", "Newlands Cricket Ground", ["Newlands", "Newlands, Cape Town", "Newlands Cricket Ground"]],
    ["lincoln-financial-field", "the Linc", "Lincoln Financial Field", ["Philadelphia Stadium", "Lincoln Financial Field"]],
    ["millennium-stadium", "Millennium Stadium", "Principality Stadium", ["Principality Stadium", "Principality Stadium, Cardiff", "Millennium Stadium"]],
    ["sec-armadillo", "the Armadillo", "SEC Armadillo", ["SEC Armadillo", "Clyde Auditorium"]],
    ["scotstoun-stadium", "Scotstoun", "Scotstoun Stadium", ["Scotstoun Stadium", "EDF Scotstoun Stadium"]],
    ["lumen-field", "Lumen Field", "Lumen Field", ["Seattle Stadium", "Lumen Field"]],
    ["silverstone-circuit", "Silverstone", "Silverstone Circuit", ["Silverstone Circuit"]],
    ["sir-chris-hoy-velodrome", "Chris Hoy Velodrome", "Sir Chris Hoy Velodrome", ["Sir Chris Hoy Velodrome"]],
    ["the-hydro", "the Hydro", "OVO Hydro", ["The Hydro", "OVO Hydro"]],
    ["tollcross-swimming-centre", "Tollcross", "Tollcross International Swimming Centre", ["Tollcross International Swimming Centre"]],
    ["york-park", "York Park", "UTAS Stadium", ["UTAS Stadium", "UTAS Stadium, Launceston", "York Park"]],
    ["wollongong-showground", "WIN Stadium", "WIN Stadium", ["WIN Stadium", "Wollongong Showground"]],
    ["lindner-family-tennis-center", "Cincinnati Open", "Lindner Family Tennis Center", ["Lindner Family Tennis Center"]],
    ["usta-billie-jean-king-national-tennis-center", "US Open", "USTA Billie Jean King National Tennis Center", ["USTA Billie Jean King National Tennis Center", "Billie Jean King National Tennis Center"]],
    ["nevis-range-downhill", "Fort William", "Nevis Range Mountain Experience", ["Nevis Range Mountain Experience", "Nevis Range downhill track"]],
    ["margaret-river-main-break", "Main Break", "Surfers Point", ["Main Break", "Surfers Point"]],
    ["banzai-pipeline", "Pipeline", "ʻEhukai Beach Park", ["Banzai Pipeline", "Pipeline", "ʻEhukai Beach Park"]],
    ["praia-do-norte", "Nazaré", "Praia do Norte", ["Praia do Norte"]],
    ["kvitfjell-olympiabakken", "Kvitfjell", "Olympiabakken", ["Olympiabakken"]],
    ["shahdag-fis-stadium", "Shahdag", "Shahdag FIS Stadium", ["Shahdag FIS Stadium"]],
    ["sun-valley-challenger", "Sun Valley", "Challenger course at Sun Valley Resort", ["Challenger course at Sun Valley Resort"]],
    ["glasgow-international-arena", "Glasgow International Arena", "Glasgow International Arena", ["Glasgow International Arena", "Emirates Arena"]],
    ["sec-centre", "the SEC", "SEC Centre", ["SEC Centre"]],
    ["american-express-stadium", "American Express Stadium", "American Express Stadium", ["American Express Stadium", "Amex Stadium"]],
    ["anfield", "Anfield", "Anfield", ["Anfield"]],
    ["coventry-building-society-arena", "Coventry Building Society Arena", "Coventry Building Society Arena", ["Coventry Building Society Arena"]],
    ["craven-cottage", "Craven Cottage", "Craven Cottage", ["Craven Cottage"]],
    ["elland-road", "Elland Road", "Elland Road", ["Elland Road"]],
    ["emirates-stadium", "Emirates Stadium", "Emirates Stadium", ["Emirates Stadium"]],
    ["etihad-stadium-manchester", "Etihad Stadium", "Etihad Stadium", ["Etihad Stadium, Manchester"]],
    ["gtech-community-stadium", "Gtech Community Stadium", "Gtech Community Stadium", ["Gtech Community Stadium"]],
    ["hill-dickinson-stadium", "Hill Dickinson Stadium", "Hill Dickinson Stadium", ["Hill Dickinson Stadium"]],
    ["old-trafford", "Old Trafford", "Old Trafford", ["Old Trafford"]],
    ["portman-road", "Portman Road", "Portman Road", ["Portman Road"]],
    ["selhurst-park", "Selhurst Park", "Selhurst Park", ["Selhurst Park"]],
    ["st-james-park-newcastle", "St James' Park", "St James' Park", ["St. James' Park", "St James' Park"]],
    ["stadium-of-light", "Stadium of Light", "Stadium of Light", ["Stadium of Light"]],
    ["stamford-bridge", "Stamford Bridge", "Stamford Bridge", ["Stamford Bridge"]],
    ["city-ground-nottingham", "The City Ground", "The City Ground", ["The City Ground", "City Ground"]],
    ["mkm-stadium", "MKM Stadium", "The MKM Stadium", ["The MKM Stadium", "MKM Stadium"]],
    ["tottenham-hotspur-stadium", "Tottenham Hotspur Stadium", "Tottenham Hotspur Stadium", ["Tottenham Hotspur Stadium"]],
    ["villa-park", "Villa Park", "Villa Park", ["Villa Park"]],
    ["vitality-stadium", "Vitality Stadium", "Vitality Stadium", ["Vitality Stadium"]],
  ].map(([id, displayName, officialName, aliases]) => Object.freeze({ id, displayName, officialName, aliases: Object.freeze(aliases) })));

  const CONTEXTUAL_ALIASES = Object.freeze({
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
  });

  const REVIEW_DISPOSITIONS = Object.freeze({
    "2026 nba finals": "competition_placeholder",
    "belfort": "place_or_route",
    "chalon sur saone": "place_or_route",
    "le markstein": "place_or_route",
    "tour de france 2026": "competition_placeholder",
    "davos switzerland": "quarantine_conflicting_fixture",
    "marrakech to ouarzazate": "quarantine_conflicting_fixture",
    "nairobi to malindi": "quarantine_unverified_route",
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

  function resolve(value, context = {}){
    const officialName = String(value || "").trim();
    if (!officialName) return null;
    const normalized = normalise(officialName);
    let entry = aliasIndex.get(normalized);
    const contextual = CONTEXTUAL_ALIASES[normalized];
    if (!entry && contextual && contextual.keys.includes(String(context?.key || ""))) entry = entriesById.get(contextual.id);
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
      if (!venue || byInput.has(venue)) return;
      byInput.set(venue, resolve(venue, event));
    });
    const records = [...byInput.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, record]) => record);
    return Object.freeze({
      version: VERSION,
      total: records.length,
      audited: records.filter(record => record.audited).length,
      pending: records.filter(record => !record.audited).map(record => record.officialName),
      dispositions: records.filter(record => !record.audited).map(record => Object.freeze({ input: record.officialName, disposition: record.reviewDisposition })),
      unclassified: records.filter(record => !record.audited && record.reviewDisposition === "unclassified").map(record => record.officialName),
    });
  }

  return Object.freeze({ VERSION, ENTRIES, CONTEXTUAL_ALIASES, REVIEW_DISPOSITIONS, normalise, resolve, audit });
});
