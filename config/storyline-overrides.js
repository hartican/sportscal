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
    "tennis-tournament-wta-toronto-806-2026-2026-08-13": Object.freeze({
      stakes: 4,
      intensity: 4,
      archetype: "quest",
      visibleLabel: "Must Watch",
      cardVariant: "marquee",
      forceSurface: "homeMustWatch",
      reviewedAt: "2026-08-13T00:00:00.000Z",
      reviewedBy: "nothingSport editorial",
      note: "Flagship WTA 1000 coverage guarantee and Toronto regression event.",
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

  function eventId(eventOrId){
    if (typeof eventOrId === "string") return eventOrId;
    return String(eventOrId?.canonicalEventId || eventOrId?.eventId || eventOrId?.id || "");
  }

  function forEvent(eventOrId){
    const override = OVERRIDES[eventId(eventOrId)];
    return override ? { ...override } : null;
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
    forEvent,
    editorialMetadata,
  });
});
