(function attachNothingSportsRepresentativeEvents(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_REPRESENTATIVE_EVENTS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildRepresentativeEvents(){
  "use strict";

  const EVENTS_BY_SPORT = Object.freeze({
    rugby:Object.freeze([
      "evt_8", "evt_9", "evt_100", "rugby-australia-italy-2026-07-18",
      "rugby-japan-australia-2026-08-08", "rugby-australia-japan-2026-08-15",
      "rugby-argentina-australia-jujuy-2026-08-30", "rugby-argentina-australia-mendoza-2026-09-06",
      "rugby-australia-south-africa-2026-09-27", "rugby-new-zealand-australia-2026-10-10",
      "rugby-australia-new-zealand-2026-10-17", "rugby-england-australia-2026-11-09",
      "rugby-scotland-australia-2026-11-16", "rugby-wales-australia-2026-11-22",
    ]),
    football:Object.freeze([
      "fifa-group-australia-turkiye-2026", "fifa-group-usa-australia-2026",
      "fifa-group-paraguay-australia-2026", "fifa-r32-australia-egypt-2026",
    ]),
    cricket:Object.freeze([
      "cricket-australia-bangladesh-first-test-2026", "cricket-australia-bangladesh-second-test-2026",
      "cricket-australia-england-first-odi-2026", "cricket-australia-england-second-odi-2026",
      "cricket-australia-england-third-odi-2026", "cricket-australia-england-first-t20-2026",
      "cricket-australia-england-second-t20-2026", "cricket-australia-england-third-t20-2026",
      "cricket-australia-england-fourth-t20-2026", "cricket-australia-england-fifth-t20-2026",
      "cricket-australia-new-zealand-test-2026",
    ]),
    nrl:Object.freeze([
      "rlwc-australia-new-zealand-2026", "rlwc-australia-fiji-2026", "rlwc-australia-cook-islands-2026",
    ]),
    afl:Object.freeze(["aflw-australia-ireland-2026-08-01"]),
    nba:Object.freeze(["cwg-glasgow-2026-3x3-australia-opening"]),
    netball:Object.freeze([
      "cwg-glasgow-2026-netball-australia-england", "cwg-glasgow-2026-netball-australia-malawi",
      "cwg-glasgow-2026-netball-australia-south-africa", "cwg-glasgow-2026-netball-australia-jamaica-semifinal",
      "cwg-glasgow-2026-netball-australia-england-bronze",
    ]),
  });

  const metadataByEventId = Object.freeze(Object.fromEntries(Object.entries(EVENTS_BY_SPORT)
    .flatMap(([representativeSportKey, eventIds]) => eventIds.map(eventId => [eventId, Object.freeze({
      competitionScope:"international",
      isInternational:true,
      representativeCountryCodes:Object.freeze(["AUS"]),
      representativeSportKey,
    })]))));

  function metadataForEventId(eventId){
    return metadataByEventId[String(eventId || "")] || null;
  }

  function applyToEvent(event){
    const metadata = metadataForEventId(event?.eventId || event?.id);
    return metadata ? { ...event, ...metadata, representativeCountryCodes:[...metadata.representativeCountryCodes] } : event;
  }

  return Object.freeze({ EVENTS_BY_SPORT, metadataByEventId, metadataForEventId, applyToEvent });
});
