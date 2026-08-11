(function attachNothingSportsSwipeCalibration(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SWIPE_CALIBRATION = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildSwipeCalibration(){
  "use strict";

  const SCHEMA_VERSION = "swipe-calibration.v1";
  const anchors = [
    {
      id: "calibration:wimbledon",
      targetType: "event_family",
      targetId: "special:wimbledon",
      label: "Wimbledon",
      detail: "Grand Slam finals, deep runs and Australian contenders.",
      glyph: "sport:tennis",
      canonicalSource: { kind: "selector", id: "special:wimbledon" },
      match: { sportKeys: ["wimbledon"] },
    },
    {
      id: "calibration:fifa-world-cup",
      targetType: "event_family",
      targetId: "special:fifa-world-cup",
      label: "FIFA World Cup",
      detail: "Socceroos, knockout matches and the biggest global fixtures.",
      glyph: "sport:football",
      canonicalSource: { kind: "selector", id: "special:fifa-world-cup" },
      match: { sportKeys: ["fifa"] },
    },
    {
      id: "calibration:tour-de-france",
      targetType: "event_family",
      targetId: "special:tour-de-france",
      label: "Tour de France",
      detail: "Mountain stages, time trials and the Paris finish.",
      glyph: "sport:cycling",
      canonicalSource: { kind: "selector", id: "special:tour-de-france" },
      match: { sportKeys: ["tdf"] },
    },
    {
      id: "calibration:super-bowl",
      targetType: "event_family",
      targetId: "special:super-bowl",
      label: "Super Bowl",
      detail: "The NFL championship and its surrounding spectacle.",
      glyph: "sport:american-football",
      canonicalSource: { kind: "selector", id: "special:super-bowl" },
      match: { sportKeys: ["nfl"] },
    },
    {
      id: "calibration:masters",
      targetType: "event_family",
      targetId: "special:masters-tournament",
      label: "Masters Tournament",
      detail: "Augusta contention windows and the Sunday finish.",
      glyph: "sport:golf",
      canonicalSource: { kind: "selector", id: "special:masters-tournament" },
      match: { sportKeys: ["masters"] },
    },
    {
      id: "calibration:le-mans",
      targetType: "event_family",
      targetId: "special:le-mans-24-hours",
      label: "24 Hours of Le Mans",
      detail: "The start, overnight story and finish of the endurance classic.",
      glyph: "sport:motorsport",
      canonicalSource: { kind: "selector", id: "special:le-mans-24-hours" },
      match: { sportKeys: ["lemans"] },
    },
    {
      id: "calibration:oscar-piastri",
      targetType: "player",
      targetId: "competitor:f1:oscar-piastri",
      label: "Oscar Piastri",
      detail: "Australian interest across Formula 1 qualifying and race weekends.",
      glyph: "sport:motorsport",
      canonicalSource: { kind: "canonical-participant", id: "competitor:f1:oscar-piastri" },
      match: { sportKeys: ["f1"], terms: ["piastri"] },
    },
    {
      id: "calibration:nrl",
      targetType: "sport",
      targetId: "sport:nrl",
      label: "NRL",
      detail: "Premiership rounds, rivalries, finals and State of Origin.",
      glyph: "sport:rugby",
      canonicalSource: { kind: "canonical-sport", id: "sport:nrl" },
      match: { sportKeys: ["nrl"] },
    },
    {
      id: "calibration:afl",
      targetType: "sport",
      targetId: "sport:afl",
      label: "AFL",
      detail: "Premiership rounds, marquee matches and the finals series.",
      glyph: "sport:australian-football",
      canonicalSource: { kind: "canonical-sport", id: "sport:afl" },
      match: { sportKeys: ["afl"] },
    },
    {
      id: "calibration:wallabies",
      targetType: "sport",
      targetId: "sport:rugby",
      label: "Wallabies",
      detail: "Australian Tests, Rugby Championship matches and major tours.",
      glyph: "sport:rugby",
      canonicalSource: { kind: "canonical-sport", id: "sport:rugby-union" },
      match: { sportKeys: ["rugby"], terms: ["australia", "wallabies"] },
    },
  ].map(anchor => Object.freeze({
    ...anchor,
    canonicalSource: Object.freeze({ ...anchor.canonicalSource }),
    match: Object.freeze({
      sportKeys: Object.freeze([...(anchor.match?.sportKeys || [])]),
      terms: Object.freeze([...(anchor.match?.terms || [])]),
    }),
  }));

  function eventText(event){
    return [
      event?.name,
      event?.displayTitleCompact,
      event?.selectedSentence,
      event?.fullSpiel,
      event?.stakesReason,
      event?.storyline?.previewText,
      event?.storyline?.fullText,
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function anchorMatchesEvent(anchor, event){
    const key = String(event?.key || event?.sportId || "");
    if (!(anchor.match.sportKeys || []).includes(key)) return false;
    const terms = anchor.match.terms || [];
    if (!terms.length) return true;
    const text = eventText(event);
    return terms.some(term => text.includes(String(term).toLowerCase()));
  }

  function targetReferencesForEvent(event){
    const references = [];
    const canonicalEventId = String(event?.canonicalEventId || event?.eventId || event?.id || "");
    if (canonicalEventId) references.push({ targetType: "event", targetId: canonicalEventId });
    anchors.filter(anchor => anchorMatchesEvent(anchor, event)).forEach(anchor => {
      references.push({ targetType: anchor.targetType, targetId: anchor.targetId });
    });
    if (event?.competitionId) references.push({ targetType: "competition", targetId: String(event.competitionId) });
    if (event?.competitionFamilyId) references.push({ targetType: "event_family", targetId: String(event.competitionFamilyId) });
    (Array.isArray(event?.participantIds) ? event.participantIds : []).forEach(participantId => {
      const id = String(participantId || "");
      if (!id) return;
      references.push({ targetType: id.startsWith("team:") ? "team" : "player", targetId: id });
    });
    if (event?.sportDomainId) references.push({ targetType: "sport", targetId: String(event.sportDomainId) });
    const key = String(event?.key || event?.sportId || "");
    if (key) references.push({ targetType: "sport", targetId: `sport:${key}` });
    return references.filter((reference, index, list) => (
      list.findIndex(candidate => candidate.targetType === reference.targetType && candidate.targetId === reference.targetId) === index
    ));
  }

  function primaryTargetForEvent(event){
    const anchor = anchors.find(candidate => anchorMatchesEvent(candidate, event));
    if (anchor) return { targetType: anchor.targetType, targetId: anchor.targetId, label: anchor.label };
    const key = String(event?.key || event?.sportId || "sport");
    return { targetType: "sport", targetId: `sport:${key}`, label: key.toUpperCase() };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    anchors: Object.freeze(anchors),
    anchorMatchesEvent,
    targetReferencesForEvent,
    primaryTargetForEvent,
  });
});
