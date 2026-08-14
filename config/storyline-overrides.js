(function attachNothingSportsStorylineOverrides(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_STORYLINE_OVERRIDES = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildStorylineOverrides(){
  "use strict";

  const SCHEMA_VERSION = "storyline-overrides.v1";
  const OVERRIDES = Object.freeze({
    "fifa-third-place-2026": Object.freeze({
      stakes: 4,
      intensity: 4,
      archetype: "title_decider",
      expectedSpectacle: 6,
      reviewedAt: "2026-07-30T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Manual podium-decider treatment retained from the reviewed World Cup card set.",
    }),
    "nrl-raiders-rabbitohs-2026-07-18": Object.freeze({
      stakes: 4,
      intensity: 4,
      archetype: "quest",
      arcStage: "recap",
      hookSpoilerOff: "A fast start, a late Souths surge and a desperate final stand in Canberra.",
      hookSpoilerOn: "Canberra held off Souths 34–24 to make it three wins in a row.",
      synopsisSpoilerOff: "The contest swung sharply after half-time before a tense late finish at GIO Stadium. Canberra's season-defining urgency was tested to the last set.",
      synopsisSpoilerOn: "The Raiders built the platform early, absorbed a second-half Rabbitohs surge and closed out a valuable home win. The result kept their late finals push alive, though Hudson Young left injured.",
      expectedSpectacle: 8,
      actualSpectacle: 8,
      reviewedAt: "2026-07-30T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Reviewed result-aware storyline with distinct spoiler states.",
    }),
    "rugby-australia-italy-2026-07-18": Object.freeze({
      stakes: 4,
      reviewedAt: "2026-07-30T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Manual international-Test significance retained from the reviewed card set.",
    }),
    "evt_84": Object.freeze({
      stakes: 5,
      intensity: 5,
      archetype: "title_decider",
      visibleLabel: "Title Decider",
      cardVariant: "marquee",
      forceSurface: "homeMustWatch",
      reviewedAt: "2026-08-13T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Flagship NRL Grand Final treatment.",
    }),
  });

  const RULE_OVERRIDES = Object.freeze({
    "active-wta-1000-tournament-overview": Object.freeze({
      stakes: 4,
      intensity: 4,
      archetype: "quest",
      visibleLabel: "Must Watch",
      cardVariant: "marquee",
      forceSurface: "homeMustWatch",
      reviewedAt: "2026-08-14T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Current active WTA 1000 tournament overview receives the reviewed flagship coverage guarantee.",
    }),
  });

  function eventId(eventOrId){
    if (typeof eventOrId === "string") return eventOrId;
    return String(eventOrId?.canonicalEventId || eventOrId?.eventId || eventOrId?.id || "");
  }

  function forEvent(eventOrId){
    const exactOverride = OVERRIDES[eventId(eventOrId)];
    if (exactOverride) return { ...exactOverride };
    if (!eventOrId || typeof eventOrId === "string") return null;
    const status = String(eventOrId.status || "").toLowerCase();
    const isActiveWta1000Overview = String(eventOrId.key || eventOrId.sport || "").toLowerCase() === "tennis"
      && String(eventOrId.tour || "").toUpperCase() === "WTA"
      && eventOrId.tennisLevel === "wta_1000"
      && eventOrId.cardType === "tournament_overview"
      && !["completed", "past", "cancelled", "abandoned"].includes(status);
    return isActiveWta1000Overview
      ? { ...RULE_OVERRIDES["active-wta-1000-tournament-overview"] }
      : null;
  }

  function editorialMetadata(eventOrId){
    const override = forEvent(eventOrId);
    if (!override) return null;
    return {
      reviewedAt: override.reviewedAt,
      reviewedBy: override.reviewedBy,
      note: override.note,
      forceSurface: override.forceSurface || null,
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    overrides: OVERRIDES,
    ruleOverrides: RULE_OVERRIDES,
    forEvent,
    editorialMetadata,
  });
});
