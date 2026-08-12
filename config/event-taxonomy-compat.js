(function attachEventTaxonomyCompat(root, factory){
  const hierarchy = root.NOTHINGSPORTS_SPORT_HIERARCHY
    || (typeof require === "function" ? require("./sport-hierarchy.js") : null);
  const api = factory(hierarchy);
  root.NOTHINGSPORTS_EVENT_TAXONOMY_COMPAT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildEventTaxonomyCompat(hierarchy){
  "use strict";

  function uniqueStrings(values){
    return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean)));
  }

  function primaryTaxonomyId(event){
    const explicitCandidates = [
      event?.taxonomyNodeId,
      event?.eventSeriesId,
      event?.taxonomyCompetitionId,
      event?.disciplineId,
      event?.taxonomySportId,
    ];
    for (const candidate of explicitCandidates){
      const resolved = hierarchy?.canonicalNodeId?.(candidate);
      if (resolved) return resolved;
    }
    const title = String(event?.name || event?.displayName || event?.title || "");
    const titleRules = [
      [/\b(nrlw)\b/i, "competition:nrlw-premiership"],
      [/\b(state of origin)\b/i, "competition:state-of-origin"],
      [/\b(rugby league world cup|rlwc)\b/i, "competition:rugby-league-world-cup"],
      [/\b(super rugby)\b/i, "competition:super-rugby"],
      [/\b(rugby championship|bledisloe)\b/i, "competition:rugby-championship"],
      [/\b(six nations)\b/i, "competition:six-nations"],
    ];
    const titleMatch = titleRules.find(([pattern]) => pattern.test(title));
    if (titleMatch) return titleMatch[1];
    const legacyCandidates = [
      event?.competitionId,
      event?.sportId,
      event?.key,
      event?.sportDomainId,
    ];
    for (const candidate of legacyCandidates){
      const resolved = hierarchy?.canonicalNodeId?.(candidate);
      if (resolved) return resolved;
    }
    return null;
  }

  function resolveEvent(event){
    const taxonomyNodeId = primaryTaxonomyId(event);
    const lineage = hierarchy?.lineageFor?.(taxonomyNodeId) || [];
    const byLevel = Object.fromEntries(lineage.map(node => [node.level, node.id]));
    return {
      taxonomyVersion: hierarchy?.schemaVersion || "sport-hierarchy-unavailable",
      taxonomyNodeId,
      sportId: byLevel.sport || null,
      disciplineId: byLevel.discipline || null,
      competitionId: byLevel.competition || null,
      eventSeriesId: byLevel.event_series || null,
      lineageIds: lineage.map(node => node.id),
    };
  }

  function platformName(option){
    if (typeof option === "string") return option.trim();
    return String(option?.broadcasterName || option?.platform || "").trim();
  }

  function broadcastOptionsFor(event){
    const structured = Array.isArray(event?.broadcasts) ? event.broadcasts : [];
    const labels = Array.isArray(event?.broadcastOptions) ? event.broadcastOptions : [];
    return [...structured, ...labels, event?.broadcaster].filter(Boolean);
  }

  function broadcastType(option){
    const declaredType = typeof option === "string" ? "" : String(option?.platformType || "").toLowerCase();
    if (declaredType === "fta") return "free";
    if (["subscription", "streaming"].includes(declaredType)) return "included";
    if (["ppv", "radio", "highlights"].includes(declaredType)) return declaredType;
    const label = platformName(option).toLowerCase();
    if (/\bppv\b|pay.per.view/.test(label)) return "ppv";
    if (/\bradio\b/.test(label)) return "radio";
    if (/\bhighlights?\b/.test(label)) return "highlights";
    if (/\bsbs\b|\b7plus\b|\bseven\b|\b9now\b|\bnine\b|\babc\b|kayo freebies|youtube/.test(label)) return "free";
    if (/\bkayo\b|\bfoxtel\b|\bbinge\b|\bespn\b|\beurosport\b|\bfox sports\b|\bfox footy\b|\bstan sport\b|paramount|\bsky sports\b|watchespn|supersport/.test(label)) return "included";
    return null;
  }

  function friendlyWindow(startTimeUtc){
    const parsed = Date.parse(startTimeUtc || "");
    if (!Number.isFinite(parsed)) return "unknown";
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(parsed));
    const hour = Number(parts.find(part => part.type === "hour")?.value);
    if (hour >= 5 && hour < 10) return "breakfast";
    if (hour >= 10 && hour < 17) return "daytime";
    if (hour >= 17 && hour < 23) return "primetime";
    if (hour >= 23 || hour < 1) return "late_night";
    return "overnight";
  }

  function deriveAuViewing(event){
    const options = broadcastOptionsFor(event).filter(option => broadcastType(option));
    const platformsAu = uniqueStrings(options.map(platformName));
    const types = options.map(broadcastType);
    const isPpvAu = types.includes("ppv");
    const isFreeToWatchAu = types.includes("free");
    const isIncludedWithSubscriptionAu = !isPpvAu && types.includes("included");
    const availability = isPpvAu ? "ppv" : isFreeToWatchAu ? "free" : isIncludedWithSubscriptionAu ? "included" : "unknown";
    return {
      friendlyWindow: friendlyWindow(event?.startTimeUtc),
      availability,
      isFreeToWatchAu,
      isIncludedWithSubscriptionAu,
      isPpvAu,
      primaryPlatformAu: platformsAu[0] || null,
      platformsAu,
    };
  }

  function enrichEvent(event){
    if (!event || typeof event !== "object") return event;
    const resolved = resolveEvent(event);
    if (!resolved.taxonomyNodeId) return { ...event, taxonomyVersion: resolved.taxonomyVersion };
    return {
      ...event,
      taxonomyVersion: resolved.taxonomyVersion,
      taxonomyNodeId: resolved.taxonomyNodeId,
      sportId: event.sportId || event.key || null,
      taxonomySportId: resolved.sportId,
      disciplineId: resolved.disciplineId,
      competitionId: event.competitionId || resolved.competitionId,
      taxonomyCompetitionId: resolved.competitionId,
      ...(event.eventSeriesId || resolved.eventSeriesId ? { eventSeriesId: event.eventSeriesId || resolved.eventSeriesId } : {}),
      auViewing: event.auViewing || deriveAuViewing(event),
    };
  }

  function participantType(value){
    if (value === "competitor") return "athlete";
    if (value === "nationalSide") return "team";
    return ["team", "athlete", "driver", "fighter", "pair"].includes(value) ? value : "team";
  }

  function normalizedParticipants(event, participantIndex = new Map()){
    const embedded = Array.isArray(event?.participants) ? event.participants : [];
    const referenced = Array.isArray(event?.participantIds)
      ? event.participantIds.map(id => participantIndex.get(id) || { id, name: id })
      : [];
    const participants = embedded.length ? embedded : referenced;
    return participants.map((participant, index) => ({
      id: String(participant.id || `participant:${event.id || "event"}:${index + 1}`),
      name: String(participant.name || participant.displayName || "Unknown participant"),
      type: participantType(participant.type),
      ...(participant.shortName ? { shortName: String(participant.shortName) } : {}),
      ...(participant.countryCode ? { countryCode: String(participant.countryCode) } : {}),
      ...(participant.role ? { role: String(participant.role) } : {}),
    }));
  }

  function normalizedBroadcasts(event){
    const normalized = broadcastOptionsFor(event).map(option => {
      const platform = platformName(option);
      const type = broadcastType(option);
      if (!platform || !type) return null;
      return {
        platform,
        type,
        region: "AU",
        ...(typeof option === "object" && option.deeplinkUrl ? { deeplink: option.deeplinkUrl } : {}),
      };
    }).filter(Boolean);
    return Array.from(new Map(normalized.map(option => [`${option.platform}:${option.type}:${option.region}`, option])).values());
  }

  function normalizedStoryline(event){
    const storyline = event?.storyline;
    if (!storyline || typeof storyline !== "object") return undefined;
    const stakesByScore = [null, "low", "low", "medium", "high", "critical"];
    const stakes = typeof storyline.stakes === "number" ? stakesByScore[storyline.stakes] : storyline.stakes;
    const arcStage = storyline.arcStage === "recap" ? "resolution"
      : storyline.arcStage === "preview" ? "rising"
        : storyline.arcStage;
    return {
      ...(stakes ? { stakes } : {}),
      ...(arcStage ? { arcStage } : {}),
      ...(storyline.intensity ? { intensity: storyline.intensity } : {}),
      ...(storyline.archetype ? { archetype: storyline.archetype } : {}),
      ...(storyline.narrativeHook || storyline.hookSpoilerOff ? { narrativeHook: storyline.narrativeHook || storyline.hookSpoilerOff } : {}),
      intensitySource: storyline.intensitySource || (event.lastReviewedAt ? "manual" : "computed"),
      ...(event.lastReviewedAt || storyline.lastReviewedAt ? { lastReviewedAt: event.lastReviewedAt || storyline.lastReviewedAt } : {}),
    };
  }

  function isoTimestamp(value){
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(0).toISOString();
  }

  function toCatalogEvent(event, { participantIndex = new Map() } = {}){
    const enriched = enrichEvent(event);
    const title = String(enriched?.name || enriched?.displayName || enriched?.title || "Untitled event");
    const status = ["completed", "past"].includes(enriched?.status) ? "finished"
      : ["scheduled", "live", "postponed", "cancelled", "finished"].includes(enriched?.status) ? enriched.status
        : "scheduled";
    const storyline = normalizedStoryline(enriched);
    const startTimeUtc = enriched.startTimeUtc || null;
    return {
      schemaVersion: "catalog-event.v1",
      id: String(enriched.id || enriched.eventId),
      sourceIds: { legacy: String(enriched.eventId || enriched.id) },
      sportId: enriched.taxonomySportId,
      disciplineId: enriched.disciplineId,
      competitionId: enriched.taxonomyCompetitionId || enriched.competitionId,
      ...(enriched.eventSeriesId ? { eventSeriesId: enriched.eventSeriesId } : {}),
      title,
      ...(enriched.season || enriched.seasonLabel ? { season: String(enriched.season || enriched.seasonLabel) } : {}),
      ...(enriched.round || enriched.roundLabel ? { round: String(enriched.round || enriched.roundLabel) } : {}),
      ...(enriched.stage || enriched.stageLabel ? { stage: String(enriched.stage || enriched.stageLabel) } : {}),
      participants: normalizedParticipants(enriched, participantIndex),
      startTimeUtc,
      ...(enriched.endTimeUtc ? { endTimeUtc: enriched.endTimeUtc } : {}),
      ...(enriched.venue || enriched.venueName ? {
        venue: {
          name: String(enriched.venueName || enriched.venue),
          countryCode: String(enriched.venueCountryCode || "XX"),
          tz: String(enriched.localTimezone || "Etc/UTC"),
          ...(enriched.venueCity ? { city: String(enriched.venueCity) } : {}),
        },
      } : {}),
      status,
      broadcasts: normalizedBroadcasts(enriched),
      auViewing: deriveAuViewing(enriched),
      ...(Array.isArray(enriched.tags) ? { tags: uniqueStrings(enriched.tags) } : {}),
      ...(storyline ? { storyline } : {}),
      updatedAt: isoTimestamp(enriched.updatedAt || enriched.sourceCheckedAt),
      source: {
        name: String(enriched.source?.provider || enriched.sourceName || "Legacy nothingsport feed"),
        url: String(enriched.source?.sourceUrl || enriched.sourceUrl || "calendar://legacy/nothingsport"),
        checkedAt: isoTimestamp(enriched.source?.checkedAt || enriched.sourceCheckedAt || enriched.updatedAt),
      },
      legacyCompatibility: {
        key: enriched.key || null,
        sportDomainId: enriched.sportDomainId || null,
        competitionId: event.competitionId || null,
      },
    };
  }

  return Object.freeze({
    resolveEvent,
    deriveAuViewing,
    enrichEvent,
    toCatalogEvent,
  });
});
