(function attachNothingSportsEnrichmentEngine(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_ENRICHMENT_ENGINE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildEnrichmentEngine(){
  "use strict";

  const SCHEMA_VERSION = "enriched-event.v1";
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const ALLOWED_ARCHETYPES = new Set([
    "monster",
    "ragsToRiches",
    "quest",
    "voyageReturn",
    "rivalry",
    "rebirth",
    "comedy",
  ]);
  const ALLOWED_LABELS = new Set([
    "Must Watch",
    "Rivalry",
    "Record Chase",
    "Title Decider",
    "Upset Watch",
  ]);
  const INTERNATIONAL_ALIASES = Object.freeze({
    "all blacks": "New Zealand",
    "brave blossoms": "Japan",
    "cherry blossoms": "Japan",
    "football ferns": "New Zealand",
    matildas: "Australia",
    nz: "New Zealand",
    socceroos: "Australia",
    springboks: "South Africa",
    wallabies: "Australia",
  });
  const INTERNATIONAL_DOMAIN_KEYS = new Set(["fifa", "football", "rugby", "soccer"]);

  function clamp(value, min, max){
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function canonicalSideName(value, sportKey){
    let side = String(value || "").trim();
    if (!INTERNATIONAL_DOMAIN_KEYS.has(String(sportKey || "").toLowerCase())) return side;
    Object.entries(INTERNATIONAL_ALIASES)
      .sort(([first], [second]) => second.length - first.length)
      .forEach(([alias, country]) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        side = side.replace(new RegExp(`\\b${escaped}\\b`, "gi"), country);
      });
    return side;
  }

  function canonicalFixtureTitle(value, { sportKey } = {}){
    const original = String(value || "").trim();
    if (!original) return original;
    const withCanonicalSeparator = original
      .replace(/\s+(?:vs\.?|versus)\s+/gi, " v ")
      .replace(/\s+[vV]\s+/g, " v ")
      .replace(/\s{2,}/g, " ");
    const parts = withCanonicalSeparator.split(" v ");
    if (parts.length < 2) return canonicalSideName(withCanonicalSeparator, sportKey);
    return parts.map(part => canonicalSideName(part, sportKey)).join(" v ");
  }

  function eventStatus(event, now){
    const status = String(event.status || "").toLowerCase();
    if (["completed", "past", "live", "cancelled", "abandoned"].includes(status)) return status;
    const start = eventDate(event);
    return start && start <= now ? "live" : (status || "scheduled");
  }

  function eventDate(event){
    if (event.startTimeUtc){
      const parsed = new Date(event.startTimeUtc);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (event.date){
      const parsed = new Date(`${event.date}T${event.time || "00:00"}:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  function sourceCompletedAt(source, participant){
    const value = participant?.sourceCompletedAtUtc
      || participant?.resolvedAtUtc
      || source?.completedAtUtc
      || source?.endTimeUtc
      || source?.startTimeUtc
      || (source?.date ? `${source.date}T${source.time || "00:00"}:00` : null);
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function shouldHideParticipant(participant, event, context = {}){
    if (!participant?.sourceEventId) return false;
    const now = context.now instanceof Date ? context.now : new Date(context.now || Date.now());
    const status = eventStatus(event, now);
    if (["completed", "past", "live"].includes(status)) return false;
    if (context.revealSpoilers || context.isSourceRevealed?.(participant.sourceEventId)) return false;

    const source = context.sourceEventsById?.get?.(participant.sourceEventId)
      || context.sourceEventsById?.[participant.sourceEventId]
      || null;
    if (!source) return false;
    const sourceStatus = eventStatus(source, now);
    if (!["completed", "past"].includes(sourceStatus)) return true;
    const completedAt = sourceCompletedAt(source, participant);
    if (!completedAt) return false;
    return now.getTime() - completedAt.getTime() <= THREE_DAYS_MS;
  }

  function spoilerSafeFixtureTitle(event, context = {}){
    const participants = Array.isArray(event.matchupParticipants) ? event.matchupParticipants : [];
    const fallback = canonicalFixtureTitle(event.displayTitleCompact || event.name, { sportKey: event.sportId || event.key });
    if (participants.length < 2) return fallback;
    const names = participants.map(participant => canonicalSideName(participant.name, event.sportId || event.key));
    const hidden = participants.map(participant => shouldHideParticipant(participant, event, context));
    if (hidden.every(Boolean)) return canonicalFixtureTitle(event.spoilerSafeTitle || fallback, { sportKey: event.sportId || event.key });
    const matchup = names.map((name, index) => hidden[index] ? "Opponent hidden" : name).join(" v ");
    if (hidden.some(Boolean)) return matchup;
    const compactFixtureLabel = /^World Cup Semi(?:final| Final) \d+$/i.test(event.displayTitleCompact || "")
      ? String(event.displayTitleCompact).replace(/\bSemifinal\b/g, "Semi Final")
      : "";
    const fixtureLabel = String(event.revealedFixtureLabel || compactFixtureLabel).replace(/\bSemifinal\b/g, "Semi Final");
    return fixtureLabel ? `${matchup} — ${fixtureLabel}` : matchup;
  }

  function numericIntensity(event){
    const storyline = Number(event.storyline?.intensity ?? event.storyline?.stakes);
    if (Number.isFinite(storyline)) return Math.round(clamp(storyline, 1, 5));
    const stakes = Number(event.stakesScore);
    if (Number.isFinite(stakes)) return Math.round(clamp(stakes, 1, 5));
    const expected = Number(event.expected || event.recommendationScore || 0);
    if (expected >= 9) return 5;
    if (expected >= 8) return 4;
    if (expected >= 6) return 3;
    if (expected >= 4) return 2;
    return 1;
  }

  function domainPreferenceFor(event, graph){
    const domainId = event.sportDomainId || event.sportId || event.key;
    return graph?.domainPreferences?.find(preference => preference.sportDomainId === domainId) || null;
  }

  function competitionPreferenceFor(event, graph){
    const competitionId = event.competitionId || event.key;
    return graph?.competitionPreferences?.find(preference => preference.competitionId === competitionId) || null;
  }

  function userInterestScore(event, context){
    if (context.explicitMustWatch) return 5;
    const graph = context.preferenceGraph;
    const competition = competitionPreferenceFor(event, graph);
    if (competition?.enabled === false) return 0;
    const domain = domainPreferenceFor(event, graph);
    if (domain?.enabled === false) return 0;
    const templateScores = {
      "template:froth": 5,
      "template:like": 4,
      "template:casual": 2,
      "template:custom": 3,
    };
    if (domain) return templateScores[domain.templateId] ?? 3;
    const followed = context.followedSports || [];
    return followed.includes(event.sportId || event.key) ? 3 : 0;
  }

  function participantIdsFor(event){
    return Array.from(new Set([
      ...(Array.isArray(event.participantIds) ? event.participantIds : []),
      event.homeParticipantId,
      event.awayParticipantId,
      ...(Array.isArray(event.matchupParticipants) ? event.matchupParticipants.map(participant => participant.participantId || participant.id) : []),
    ].filter(Boolean)));
  }

  function followBoost(event, graph){
    const participantIds = participantIdsFor(event);
    const follows = (graph?.entityFollows || []).filter(follow => participantIds.includes(follow.participantId));
    if (follows.some(follow => follow.followLevel === "mute")) return 0;
    if (follows.some(follow => follow.followLevel === "priority")) return 5;
    return follows.some(follow => follow.followLevel === "follow") ? 3 : 0;
  }

  function broadcasterFitScore(event, context){
    const available = Array.isArray(event.broadcasterIds) ? event.broadcasterIds : [];
    const selected = context.selectedBroadcasterIds || context.preferenceGraph?.viewing?.selectedBroadcasterIds || [];
    if (!available.length) return 2;
    if (!selected.length) return 0;
    return available.some(id => selected.includes(id)) ? 5 : 0;
  }

  function localEventHour(event){
    if (event.time && /^\d{2}:\d{2}$/.test(event.time)) return Number(event.time.slice(0, 2));
    const start = eventDate(event);
    return start ? start.getHours() : null;
  }

  function timeWindowFitScore(event, context, intensity){
    const viewing = context.preferenceGraph?.viewing || context.viewing || {};
    const start = Number(viewing.startHourLocal);
    const end = Number(viewing.endHourLocal);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return 5;
    const hour = localEventHour(event);
    if (hour === null) return 3;
    const within = start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
    if (within) return 5;
    return viewing.allowLateNightOverrides !== false && intensity >= 4 ? 3 : 0;
  }

  function stakesLabel(intensity){
    if (intensity >= 4) return "critical";
    if (intensity === 3) return "high";
    if (intensity === 2) return "medium";
    return "low";
  }

  function arcStage(event, intensity){
    const status = String(event.status || "").toLowerCase();
    if (["completed", "past"].includes(status)) return "resolution";
    if (intensity >= 5 || /\b(?:final|decider|gold medal|super bowl)\b/i.test(event.name || "")) return "climax";
    if (intensity >= 3) return "rising";
    return "inciting";
  }

  function archetypeFor(event){
    const supplied = event.storyline?.archetype;
    if (ALLOWED_ARCHETYPES.has(supplied)) return supplied;
    const text = `${supplied || ""} ${event.name || ""}`.toLowerCase();
    if (/rival|derby/.test(text)) return "rivalry";
    if (/upset|underdog|rags/.test(text)) return "ragsToRiches";
    if (/return|comeback/.test(text)) return "rebirth";
    if (/record|title|champion|final|major|medal|quest/.test(text)) return "quest";
    return undefined;
  }

  function visibleLabelFor(event, mustWatchScore){
    const supplied = event.storyline?.visibleLabel;
    if (ALLOWED_LABELS.has(supplied)) return supplied;
    const text = `${event.storyline?.archetype || ""} ${event.name || ""}`;
    if (/rival|derby/i.test(text)) return "Rivalry";
    if (/record/i.test(text)) return "Record Chase";
    if (/upset|underdog/i.test(text)) return "Upset Watch";
    if (/\b(?:final|decider|gold medal|super bowl)\b/i.test(text)) return "Title Decider";
    return mustWatchScore >= 70 ? "Must Watch" : undefined;
  }

  function variantForIntensity(intensity){
    if (intensity >= 5) return "marquee";
    if (intensity >= 3) return "standard";
    if (intensity === 2) return "compact";
    return "plain";
  }

  function enrichEvent(event, context = {}){
    const canonicalEventId = String(event.canonicalEventId || event.eventId || event.id || "");
    if (!canonicalEventId) throw new Error("enrichEvent requires a canonical event id");
    const intensity = numericIntensity(event);
    const interest = clamp(userInterestScore(event, context), 0, 5);
    const follows = clamp(followBoost(event, context.preferenceGraph), 0, 5);
    const broadcaster = clamp(broadcasterFitScore(event, context), 0, 5);
    const timeWindow = clamp(timeWindowFitScore(event, context, intensity), 0, 5);
    const mustWatchScore = Math.round(clamp(
      intensity * 12
      + interest * 5
      + follows
      + broadcaster
      + timeWindow
      + (context.explicitMustWatch ? 10 : 0),
      0,
      100
    ));
    const scoreReasons = [
      `Storyline intensity ${intensity}/5 contributed ${intensity * 12} points.`,
      `Your interest contributed ${interest * 5} points.`,
      follows ? `A followed participant added ${follows} points.` : "No followed-participant boost applied.",
      broadcaster === 5 ? "Available on a selected provider." : broadcaster === 0 ? "No selected provider match." : "Broadcaster availability is still being confirmed.",
      timeWindow === 5 ? "Fits your viewing window." : timeWindow === 3 ? "High stakes triggered your late-night override." : "Falls outside your viewing window.",
    ];
    const storyline = {
      stakes: stakesLabel(intensity),
      arcStage: arcStage(event, intensity),
      narrativeHook: event.storyline?.narrativeHook || event.storyline?.hookSpoilerOff || event.selectedSentence || undefined,
      intensity,
      intensitySource: Number.isFinite(Number(event.storyline?.intensity)) ? "manual" : "computed",
      scoreReasons,
    };
    const archetype = archetypeFor(event);
    if (archetype) storyline.archetype = archetype;
    const visibleLabel = visibleLabelFor(event, mustWatchScore);
    if (visibleLabel) storyline.visibleLabel = visibleLabel;
    if (Array.isArray(event.storyline?.characterRoles)) storyline.characterRoles = event.storyline.characterRoles.slice();
    if (event.updatedAt) storyline.lastReviewedAt = event.updatedAt;

    return {
      schemaVersion: SCHEMA_VERSION,
      canonicalEventId,
      userInterestScore: interest,
      followBoost: follows,
      broadcasterFitScore: broadcaster,
      timeWindowFitScore: timeWindow,
      mustWatchScore,
      intensity,
      cardVariant: variantForIntensity(intensity),
      storyline,
    };
  }

  function rankEvents(events, context = {}){
    return events.map(event => ({ event, enrichment: enrichEvent(event, context) }))
      .sort((first, second) => {
        const scoreDifference = second.enrichment.mustWatchScore - first.enrichment.mustWatchScore;
        if (scoreDifference) return scoreDifference;
        const timeDifference = (eventDate(first.event)?.getTime() || 0) - (eventDate(second.event)?.getTime() || 0);
        if (timeDifference) return timeDifference;
        return first.enrichment.canonicalEventId.localeCompare(second.enrichment.canonicalEventId);
      });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    THREE_DAYS_MS,
    canonicalFixtureTitle,
    shouldHideParticipant,
    spoilerSafeFixtureTitle,
    enrichEvent,
    rankEvents,
  });
});
