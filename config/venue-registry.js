(function attachNothingSportsVenueRegistry(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_VENUE_REGISTRY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsVenueRegistry(){
  "use strict";

  const VERSION = "venue-registry.v1";
  const ENTRIES = Object.freeze([
    ["stadium-australia", "Stadium Australia", "Accor Stadium", ["Accor Stadium", "Accor Stadium, Sydney"]],
    ["sydney-football-stadium", "Sydney Football Stadium", "Allianz Stadium", ["Allianz Stadium", "Allianz Stadium, Sydney"]],
    ["brookvale-oval", "Brookvale Oval", "4 Pines Park", ["4 Pines Park"]],
    ["melbourne-rectangular-stadium", "Melbourne Rectangular Stadium", "AAMI Park", ["AAMI Park"]],
    ["gabba", "the Gabba", "Brisbane Cricket Ground", ["Brisbane Cricket Ground", "Gabba, Brisbane"]],
    ["kardinia-park", "Kardinia Park", "GMHBA Stadium", ["GMHBA Stadium, Geelong"]],
    ["docklands-stadium", "Docklands Stadium", "Marvel Stadium", ["Marvel Stadium", "Marvel Stadium, Melbourne"]],
    ["canberra-stadium", "Canberra Stadium", "GIO Stadium Canberra", ["GIO Stadium Canberra"]],
    ["manuka-oval", "Manuka Oval", "Corroboree Group Oval", ["Corroboree Group Oval, Manuka", "Manuka Oval, Canberra"]],
    ["shark-park", "Shark Park", "Ocean Protect Stadium", ["Ocean Protect Stadium"]],
    ["perth-stadium", "Perth Stadium", "Optus Stadium", ["Optus Stadium, Perth", "Perth Stadium"]],
    ["lang-park", "Lang Park", "Suncorp Stadium", ["Suncorp Stadium", "Suncorp Stadium, Brisbane"]],
    ["townsville-stadium", "Townsville Stadium", "Queensland Country Bank Stadium", ["Queensland Country Bank Stadium", "Queensland Country Bank Stadium, Townsville"]],
    ["robina-stadium", "Robina Stadium", "Cbus Super Stadium", ["Cbus Super Stadium"]],
    ["parramatta-stadium", "Parramatta Stadium", "CommBank Stadium", ["CommBank Stadium"]],
    ["jubilee-stadium", "Jubilee Stadium", "ENGIE Stadium", ["ENGIE Stadium, Sydney", "Netstrata Jubilee Stadium"]],
    ["scg", "the SCG", "Sydney Cricket Ground", ["SCG, Sydney", "Sydney Cricket Ground"]],
    ["mcg", "the MCG", "Melbourne Cricket Ground", ["MCG, Melbourne", "Melbourne Cricket Ground"]],
    ["hbf-park", "HBF Park", "HBF Park", ["HBF Park", "HBF Park, Perth"]],
    ["eden-park", "Eden Park", "Eden Park", ["Eden Park, Auckland"]],
    ["ellis-park", "Ellis Park", "Ellis Park", ["Ellis Park, Johannesburg"]],
    ["twickenham", "Twickenham", "Twickenham Stadium", ["Twickenham Stadium, London"]],
    ["murrayfield", "Murrayfield", "Murrayfield Stadium", ["Murrayfield Stadium, Edinburgh"]],
    ["all-england-club", "Wimbledon", "All England Club", ["All England Club, Wimbledon"]],
    ["melbourne-park", "Melbourne Park", "Melbourne Park", ["Melbourne Park"]],
  ].map(([id, displayName, officialName, aliases]) => Object.freeze({ id, displayName, officialName, aliases: Object.freeze(aliases) })));

  function normalise(value){
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  const aliasIndex = new Map();
  ENTRIES.forEach(entry => entry.aliases.forEach(alias => aliasIndex.set(normalise(alias), entry)));

  function fallbackId(value){
    return `venue:${normalise(value).replace(/\s+/g, "-") || "unknown"}`;
  }

  function resolve(value){
    const officialName = String(value || "").trim();
    if (!officialName) return null;
    const entry = aliasIndex.get(normalise(officialName));
    if (entry) return Object.freeze({ ...entry, audited: true });
    return Object.freeze({
      id: fallbackId(officialName),
      displayName: officialName,
      officialName,
      aliases: Object.freeze([officialName]),
      audited: false,
    });
  }

  function audit(events){
    const records = Array.from(new Set((events || []).map(event => String(event?.venue || "").trim()).filter(Boolean)))
      .sort()
      .map(venue => resolve(venue));
    return Object.freeze({
      version: VERSION,
      total: records.length,
      audited: records.filter(record => record.audited).length,
      pending: records.filter(record => !record.audited).map(record => record.officialName),
    });
  }

  return Object.freeze({ VERSION, ENTRIES, normalise, resolve, audit });
});
