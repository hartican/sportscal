(function attachNothingSportsCardLifecycle(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_CARD_LIFECYCLE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildCardLifecycle(){
  "use strict";

  const SCHEMA_VERSION = "derived-card-cache.v1";
  const ARCHIVE_DAYS = 7;
  const RETENTION_DAYS = 14;
  const ARCHIVE_MS = ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
  const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const SURFACES = new Set(["homeMustWatch", "topStorylines", "sportFeed", "teamFeed", "saved", "recent"]);

  function clone(value){
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function eventId(event){
    return String(event?.canonicalEventId || event?.eventId || event?.id || "");
  }

  function eventStart(event){
    if (event?.startTimeUtc){
      const parsed = new Date(event.startTimeUtc);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (event?.date){
      const parsed = new Date(`${event.date}T${event.time || "00:00"}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function eventEnd(event){
    if (event?.endTimeUtc){
      const parsed = new Date(event.endTimeUtc);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const start = eventStart(event);
    if (!start) return null;
    const durationHours = Number(event.liveWindow || event.calendarTemplate?.durationHours || 3);
    return new Date(start.getTime() + (Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 3) * 60 * 60 * 1000);
  }

  function expiresAtForEvent(event){
    const end = eventEnd(event);
    return end ? new Date(end.getTime() + RETENTION_MS) : null;
  }

  function archivesAtForEvent(event){
    const end = eventEnd(event);
    return end ? new Date(end.getTime() + ARCHIVE_MS) : null;
  }

  function isSavedAction(action = {}){
    return Boolean(action.watchLater || action.mustWatch || action.saved);
  }

  function lifecycleState(event, {
    action = {},
    saved = isSavedAction(action),
    now = new Date(),
  } = {}){
    const end = eventEnd(event);
    const reference = now instanceof Date ? now : new Date(now);
    if (!end || Number.isNaN(reference.getTime())){
      return {
        state: "active",
        saved: Boolean(saved),
        archivesAt: archivesAtForEvent(event)?.toISOString() || null,
        expiresAt: expiresAtForEvent(event)?.toISOString() || null,
      };
    }
    const ageMs = reference.getTime() - end.getTime();
    const state = saved
      ? "saved"
      : ageMs > RETENTION_MS
        ? "expired"
        : ageMs > ARCHIVE_MS
          ? "archived"
          : "active";
    return {
      state,
      saved: Boolean(saved),
      archivesAt: new Date(end.getTime() + ARCHIVE_MS).toISOString(),
      expiresAt: new Date(end.getTime() + RETENTION_MS).toISOString(),
    };
  }

  function isWithinRetention(event, reference = new Date(), options = {}){
    const state = lifecycleState(event, {
      ...options,
      now: reference,
    }).state;
    return state !== "expired";
  }

  function shouldAutoArchive(event, reference = new Date(), action = {}){
    return lifecycleState(event, { action, now: reference }).state === "archived";
  }

  function emptyCache(now = new Date()){
    const timestamp = (now instanceof Date ? now : new Date(now)).toISOString();
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: timestamp,
      buildOrigin: "local",
      derivedCards: [],
    };
  }

  function normalizeCache(raw, now = new Date()){
    if (!raw || raw.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.derivedCards)) return emptyCache(now);
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: raw.generatedAt || (now instanceof Date ? now : new Date(now)).toISOString(),
      buildOrigin: raw.buildOrigin === "server" ? "server" : "local",
      ...(typeof raw.sourceVersion === "string" && raw.sourceVersion ? { sourceVersion: raw.sourceVersion } : {}),
      derivedCards: raw.derivedCards.filter(card => card && typeof card.canonicalEventId === "string"),
    };
  }

  function createDerivedCard(event, enrichment, {
    profileId,
    surface = "sportFeed",
    rank = 0,
    generatedAt = new Date(),
    retentionExempt = false,
  } = {}){
    const canonicalEventId = eventId(event);
    if (!canonicalEventId) throw new Error("Derived cards require a canonical event id");
    if (!profileId) throw new Error("Derived cards require a stable profile id");
    if (!SURFACES.has(surface)) throw new Error(`Unknown derived-card surface: ${surface}`);
    const generated = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
    const expiry = expiresAtForEvent(event) || new Date(generated.getTime() + RETENTION_MS);
    return {
      id: `card:${profileId}:${surface}:${canonicalEventId}`,
      canonicalEventId,
      profileId,
      surface,
      cardVariant: enrichment.cardVariant,
      intensity: enrichment.intensity,
      rank,
      renderPayload: {
        displayTitle: event.displayTitleCompact || event.name,
        date: event.date,
        time: event.time,
        mustWatchScore: enrichment.mustWatchScore,
        followContext: Array.isArray(enrichment.followContext) ? clone(enrichment.followContext) : [],
        storyline: enrichment.storyline && typeof enrichment.storyline === "object"
          ? clone(enrichment.storyline)
          : { scoreReasons: [] },
      },
      generatedAt: generated.toISOString(),
      expiresAt: expiry.toISOString(),
      retentionExempt: Boolean(retentionExempt),
      isArchived: false,
    };
  }

  function surfaceFor(event, enrichment, action = {}){
    if (action.watchLater) return "saved";
    const status = String(event.status || "").toLowerCase();
    if (["past", "completed"].includes(status)) return "recent";
    if (action.mustWatch || enrichment.mustWatchScore >= 70) return "homeMustWatch";
    if (enrichment.intensity >= 4) return "topStorylines";
    return "sportFeed";
  }

  function materialize(events, {
    profileId,
    enrich,
    actionFor = () => ({}),
    now = new Date(),
    buildOrigin = "local",
    sourceVersion,
  } = {}){
    if (typeof enrich !== "function") throw new Error("materialize requires an enrichment function");
    const reference = now instanceof Date ? now : new Date(now);
    const ranked = events
      .map(event => {
        const action = actionFor(event);
        return {
          event,
          action,
          retention: lifecycleState(event, { action, now: reference }),
        };
      })
      .filter(item => item.retention.state === "active" || item.retention.state === "saved")
      .map(item => ({ ...item, enrichment: enrich(item.event) }))
      .sort((first, second) => {
        const score = second.enrichment.mustWatchScore - first.enrichment.mustWatchScore;
        return score || eventId(first.event).localeCompare(eventId(second.event));
      });
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: reference.toISOString(),
      buildOrigin: buildOrigin === "server" ? "server" : "local",
      ...(typeof sourceVersion === "string" && sourceVersion ? { sourceVersion } : {}),
      derivedCards: ranked.map(({ event, enrichment, action }, index) => createDerivedCard(event, enrichment, {
        profileId,
        surface: surfaceFor(event, enrichment, action),
        rank: index + 1,
        generatedAt: reference,
        retentionExempt: isSavedAction(action),
      })),
    };
  }

  function purgeExpired(cache, now = new Date()){
    const reference = now instanceof Date ? now : new Date(now);
    const normalized = normalizeCache(cache, reference);
    const derivedCards = normalized.derivedCards.filter(card => {
      if (card.retentionExempt) return true;
      const expires = new Date(card.expiresAt);
      return !Number.isNaN(expires.getTime()) && expires > reference;
    });
    return {
      cache: { ...normalized, generatedAt: reference.toISOString(), derivedCards },
      removedCount: normalized.derivedCards.length - derivedCards.length,
    };
  }

  function archiveReference(references, event, {
    profileId,
    archivedFromCardId,
    note,
    now = new Date(),
  } = {}){
    const canonicalEventId = eventId(event);
    if (!canonicalEventId || !profileId) throw new Error("Archive references require profile and event ids");
    const existing = (Array.isArray(references) ? references : []).filter(reference => reference.canonicalEventId !== canonicalEventId);
    const archivedAt = (now instanceof Date ? now : new Date(now)).toISOString();
    return [...existing, {
      id: `archive:${profileId}:${canonicalEventId}`,
      profileId,
      canonicalEventId,
      ...(archivedFromCardId ? { archivedFromCardId } : {}),
      archivedAt,
      ...(note ? { note: String(note) } : {}),
    }];
  }

  function removeArchiveReference(references, canonicalEventId){
    return (Array.isArray(references) ? references : []).filter(reference => reference.canonicalEventId !== canonicalEventId);
  }

  function rebuildArchive(references, canonicalEvents){
    const eventsById = new Map((Array.isArray(canonicalEvents) ? canonicalEvents : []).map(event => [eventId(event), event]));
    const events = [];
    const missingReferences = [];
    (Array.isArray(references) ? references : []).forEach(reference => {
      const event = eventsById.get(reference.canonicalEventId);
      if (event) events.push(clone(event));
      else missingReferences.push(clone(reference));
    });
    return { events, missingReferences };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    ARCHIVE_DAYS,
    RETENTION_DAYS,
    ARCHIVE_MS,
    RETENTION_MS,
    emptyCache,
    normalizeCache,
    archivesAtForEvent,
    expiresAtForEvent,
    isSavedAction,
    lifecycleState,
    isWithinRetention,
    shouldAutoArchive,
    createDerivedCard,
    materialize,
    purgeExpired,
    archiveReference,
    removeArchiveReference,
    rebuildArchive,
  });
});
