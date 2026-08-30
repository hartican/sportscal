(function attachNothingSportsEnrichmentEngine(root, factory){
  const api = factory(root);
  root.NOTHINGSPORTS_ENRICHMENT_ENGINE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildEnrichmentEngine(root){
  "use strict";

  const SCHEMA_VERSION = "enriched-event.v2";
  const RANKING_VERSION = "premium-ranking.v1";
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const PREMIUM_SURFACE_POLICY = Object.freeze({
    mustWatchThreshold: 78,
    topStorylineMinimumStakes: 4,
    mustWatchLimit: 3,
    topStorylineLimit: 5,
    horizonDays: 7,
  });
  const STORYLINE_OVERRIDES = root.NOTHINGSPORTS_STORYLINE_OVERRIDES
    || (typeof require === "function" ? require("./storyline-overrides.js") : null);
  const browserNothingscore = Object.freeze({
    HEAT_LABELS:Object.freeze(["Routine","Interesting","Notable","Major","Essential"]),
    PULSE_LABELS:Object.freeze(["Flat","Solid","Strong","Exceptional","Unforgettable"]),
    IMPACT_LABELS:Object.freeze(["Flat","Solid","Strong","Exceptional","Unforgettable"]),
    HEAT_TAGS:Object.freeze(["Box office","Big stakes","Rivalry","Star power","National interest","Great storyline"]),
    IMPACT_TAGS:Object.freeze(["Thrilling","Eye-popping","Mind-blowing","Emotional","Electric atmosphere","Pure chaos"]),
    blendHeatWithStakes(stakes,heatScore,support){
      const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,Number(value)||0));
      const effectiveSupport=Math.max(0,Number(support)||0);
      const weight=effectiveSupport < 3 ? 0 : effectiveSupport < 10 ? .25 : effectiveSupport < 25 ? .5 : .75;
      const canonical=clamp(stakes,1,5),heat=Number.isFinite(Number(heatScore))?clamp(heatScore,1,5):canonical;
      return{score:Math.round((canonical*(1-weight)+heat*weight)*10)/10,heatWeight:weight,stakesWeight:1-weight};
    },
    labelFor(phase,score){
      const index=Math.max(0,Math.min(4,Math.round(Math.max(1,Math.min(5,Number(score)||0)))-1));
      return(phase==="heat"?this.HEAT_LABELS:phase==="impact"?this.IMPACT_LABELS:this.PULSE_LABELS)[index];
    },
  });
  const NOTHINGSCORE = root.NOTHINGSPORTS_NOTHINGSCORE
    || (typeof require === "function" ? require("./nothingscore.js") : browserNothingscore);
  if (!root.NOTHINGSPORTS_NOTHINGSCORE) root.NOTHINGSPORTS_NOTHINGSCORE = NOTHINGSCORE;
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
    "Top pick",
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

  function editorialNarrativeReadyForCard(narrative){
    if (!narrative || !/^editorial-narrative\.v(?:1|2|3)$/.test(String(narrative.schemaVersion || ""))) return false;
    if (!String(narrative.hook || "").trim() || !String(narrative.synopsis || "").trim()) return false;
    if (narrative.generationMode !== "researched") return true;
    return Array.isArray(narrative.factIds)
      && narrative.factIds.length > 0
      && Array.isArray(narrative.sourceIds)
      && narrative.sourceIds.length > 0;
  }

  function editorialConsequenceReadyForCard(narrative){
    const consequence = narrative?.consequence;
    return narrative?.schemaVersion === "editorial-narrative.v3"
      && consequence?.schemaVersion === "editorial-consequence.v1"
      && String(consequence.previewSentence || "").trim().length > 0
      && Array.isArray(consequence.participants)
      && consequence.participants.length === 2
      && Array.isArray(consequence.factIds)
      && consequence.factIds.length > 0
      && Array.isArray(consequence.sourceIds)
      && consequence.sourceIds.length > 0;
  }

  function eventDomainIdentifiers(event){
    const key = String(event?.key || "").trim();
    const sportId = String(event?.sportId || "").trim();
    const registryDomainId = key ? `sport:${key.toLowerCase()}` : "";
    const sportIdDomainId = sportId ? `sport:${sportId.toLowerCase()}` : "";
    const ids = [];
    const add = value => {
      const normalized = String(value || "").trim();
      if (normalized) ids.push(normalized);
    };
    add(event?.sportDomainId);
    if (Array.isArray(event?.sportDomainIds)) event.sportDomainIds.forEach(item => add(item));
    add(key);
    add(sportId);
    add(registryDomainId);
    add(sportIdDomainId);
    return Array.from(new Set(ids.filter(Boolean)));
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
      .replace(/\p{Regional_Indicator}{2}/gu, "")
      .replace(/\p{Extended_Pictographic}/gu, "")
      .replace(/\uFE0F/g, "")
      .replace(/\s+(?:vs\.?|versus)\s+/gi, " v ")
      .replace(/\s+[vV]\s+/g, " v ")
      .replace(/\s{2,}/g, " ")
      .trim();
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

  function editorialOverrideFor(event){
    return STORYLINE_OVERRIDES?.forEvent?.(event) || null;
  }

  function inferredStakesScore(event){
    const name = String(event.name || "");
    const round = String(event.round || "").toLowerCase();
    const expected = Number(event.expected || event.recommendationScore || 0);
    if (/grand final|super bowl|world cup final|gold medal|title decider|championship decider/i.test(name)) return 5;
    if (round === "final" || /\bfinals?\b|semi-?final|preliminary final|quarter-?final|playoffs?|test match|\btest\b|masters 1000|wta 1000|grand prix race/i.test(name)) return 4;
    if (/derby|rival|round of (?:16|32)|knockout|qualifying|major|world cup/i.test(name)) return 3;
    if (expected >= 10) return 5;
    if (expected >= 8) return 4;
    if (expected >= 6) return 3;
    if (expected >= 4) return 2;
    return 1;
  }

  function numericStakes(event, override = editorialOverrideFor(event)){
    const supplied = Number(override?.stakes ?? event.storyline?.stakes ?? event.stakesScore);
    if (Number.isFinite(supplied)) return Math.round(clamp(supplied, 1, 5));
    return inferredStakesScore(event);
  }

  function numericIntensity(event, stakes = numericStakes(event), override = editorialOverrideFor(event)){
    const supplied = Number(override?.intensity ?? event.storyline?.intensity);
    if (Number.isFinite(supplied)) return Math.round(clamp(supplied, 1, 5));
    const expected = Number(event.expected || event.recommendationScore || 0);
    const spectacle = expected >= 9 ? 5 : expected >= 7 ? 4 : expected >= 5 ? 3 : expected >= 4 ? 2 : 1;
    return Math.round(clamp(Math.max(stakes, spectacle), 1, 5));
  }

  function domainPreferenceFor(event, graph){
    const domainPreferences = graph?.domainPreferences || [];
    const domainIds = new Set(eventDomainIdentifiers(event));
    for (const domainId of domainIds){
      const found = domainPreferences.find(preference => preference?.sportDomainId === domainId);
      if (found) return found;
    }
    return null;
  }

  function competitionPreferenceFor(event, graph){
    const competitionId = event.competitionId || event.key;
    return graph?.competitionPreferences?.find(preference => preference.competitionId === competitionId) || null;
  }

  function userInterestScore(event, context){
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

  function australianRelevanceScore(event){
    if (event.australianInterest === true || Number(event.australianInterestScore) > 0) return 5;
    const text = `${event.name || ""} ${event.displayTitleCompact || ""} ${event.storyline?.narrativeHook || ""}`;
    if (/\b(?:Australia|Australian|Wallabies|Socceroos|Matildas|Diamonds|Kangaroos|Boomers|Opals)\b/i.test(text)) return 5;
    return 0;
  }

  function participantIdsFor(event){
    return Array.from(new Set([
      ...(Array.isArray(event.participantIds) ? event.participantIds : []),
      event.homeParticipantId,
      event.awayParticipantId,
      ...(Array.isArray(event.matchupParticipants) ? event.matchupParticipants.map(participant => participant.participantId || participant.id) : []),
    ].filter(Boolean)));
  }

  function followContextForEvent(event, context = {}){
    const participantIds = new Set(participantIdsFor(event));
    const participants = new Map((Array.isArray(context.participants) ? context.participants : [])
      .filter(participant => participant?.id)
      .map(participant => [participant.id, participant]));
    return (context.preferenceGraph?.entityFollows || [])
      .filter(follow => participantIds.has(follow.participantId))
      .filter(follow => follow.followLevel === "follow" || follow.followLevel === "priority")
      .map(follow => {
        const participant = participants.get(follow.participantId);
        if (!participant) return null;
        return {
          participantId: follow.participantId,
          participantType: participant.type || "unknown",
          displayName: participant.displayName || participant.shortName || participant.canonicalName,
          followLevel: follow.followLevel,
        };
      })
      .filter(contextItem => contextItem?.displayName)
      .sort((first, second) => {
        if (first.followLevel !== second.followLevel) return first.followLevel === "priority" ? -1 : 1;
        return first.displayName.localeCompare(second.displayName);
      });
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

  function availabilityScore(event, context){
    const fit = broadcasterFitScore(event, context);
    const availability = String(event.auViewing?.availability || "").toLowerCase();
    if (availability === "free") return Math.max(5, fit);
    if (availability === "included") return Math.max(4, fit);
    if (availability === "ppv") return fit ? 2 : 1;
    return fit || 2;
  }

  function localEventHour(event){
    if (event.time && /^\d{2}:\d{2}$/.test(event.time)) return Number(event.time.slice(0, 2));
    const start = eventDate(event);
    return start ? start.getHours() : null;
  }

  function timeWindowFitScore(event, context, intensity){
    const viewing = context.preferenceGraph?.viewing || context.viewing || {};
    if (viewing.viewingWindowEnabled === false) return 5;
    const start = Number(viewing.startHourLocal);
    const end = Number(viewing.endHourLocal);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return 5;
    const hour = localEventHour(event);
    if (hour === null) return 3;
    const within = start <= end ? hour >= start && hour <= end : hour >= start || hour <= end;
    if (within) return 5;
    return viewing.allowLateNightOverrides !== false && intensity >= 4 ? 3 : 0;
  }

  function stakesLabel(stakes){
    if (stakes >= 5) return "critical";
    if (stakes >= 4) return "high";
    if (stakes >= 2) return "medium";
    return "low";
  }

  function arcStage(event, stakes, override = editorialOverrideFor(event)){
    const status = String(event.status || "").toLowerCase();
    if (["completed", "past"].includes(status)) return "resolution";
    const supplied = String(override?.arcStage || event.storyline?.arcStage || "");
    if (["inciting", "rising", "climax"].includes(supplied)) return supplied;
    if (supplied === "preview") return stakes >= 4 ? "rising" : "inciting";
    if (stakes >= 5 || /\b(?:final|decider|gold medal|super bowl)\b/i.test(event.name || "")) return "climax";
    if (stakes >= 3) return "rising";
    return "inciting";
  }

  function sportSpecificNarrative(event, context = {}){
    const text = `${event.storyline?.narrativeHook || ""} ${event.name || ""}`;
    const signals = Array.isArray(context.narrativeProfile?.signals) ? context.narrativeProfile.signals : [];
    return signals.find(signal => {
      try {
        return new RegExp(signal.match, "i").test(text);
      } catch {
        return false;
      }
    });
  }

  function archetypeFor(event, context = {}, override = editorialOverrideFor(event)){
    const supplied = override?.archetype || event.storyline?.archetype;
    const aliases = {
      derby: "rivalry",
      record_chase: "quest",
      title_decider: "quest",
    };
    if (aliases[supplied]) return aliases[supplied];
    if (ALLOWED_ARCHETYPES.has(supplied)) return supplied;
    const sportSpecific = sportSpecificNarrative(event, context);
    if (ALLOWED_ARCHETYPES.has(sportSpecific?.archetype)) return sportSpecific.archetype;
    const text = `${supplied || ""} ${event.name || ""}`.toLowerCase();
    if (/rival|derby/.test(text)) return "rivalry";
    if (/upset|underdog|rags/.test(text)) return "ragsToRiches";
    if (/return|comeback/.test(text)) return "rebirth";
    if (/record|title|champion|final|major|medal|quest/.test(text)) return "quest";
    return undefined;
  }

  function visibleLabelFor(event, mustWatchScore, context = {}, override = editorialOverrideFor(event)){
    const supplied = override?.visibleLabel || event.storyline?.visibleLabel;
    if (ALLOWED_LABELS.has(supplied)) return supplied;
    const sportSpecific = sportSpecificNarrative(event, context);
    if (ALLOWED_LABELS.has(sportSpecific?.label)) return sportSpecific.label;
    const text = `${event.storyline?.archetype || ""} ${event.name || ""}`;
    if (/rival|derby/i.test(text)) return "Rivalry";
    if (/record/i.test(text)) return "Record Chase";
    if (/upset|underdog/i.test(text)) return "Upset Watch";
    if (/\b(?:final|decider|gold medal|super bowl)\b/i.test(text)) return "Title Decider";
    return mustWatchScore >= PREMIUM_SURFACE_POLICY.mustWatchThreshold ? "Top pick" : undefined;
  }

  function variantForSignificance(stakes, intensity, mustWatchScore, override = null){
    if (["plain", "compact", "standard", "marquee"].includes(override?.cardVariant)) return override.cardVariant;
    if (stakes >= 5 || mustWatchScore >= 82) return "marquee";
    if (stakes >= 3 || intensity >= 3) return "standard";
    if (stakes === 2 || intensity === 2) return "compact";
    return "plain";
  }

  function enrichEvent(event, context = {}){
    const canonicalEventId = String(event.canonicalEventId || event.eventId || event.id || "");
    if (!canonicalEventId) throw new Error("enrichEvent requires a canonical event id");
    const override = editorialOverrideFor(event);
    const stakes = numericStakes(event, override);
    const nothingscore = typeof context.nothingscoreForEvent === "function"
      ? context.nothingscoreForEvent(event)
      : event.nothingscoreSnapshot || null;
    const heat = nothingscore?.aggregates?.heat || (nothingscore?.phase === "heat" ? nothingscore.aggregate : null);
    const impact = nothingscore?.aggregates?.impact || (nothingscore?.phase === "impact" ? nothingscore.aggregate : null);
    const heatBlend = NOTHINGSCORE?.blendHeatWithStakes?.(stakes, heat?.score, heat?.support) || { score:stakes, heatWeight:0, stakesWeight:1 };
    const impactEligible = nothingscore?.phase === "impact"
      && Number(impact?.support || 0) >= 10
      && Boolean(event.replayEligible || event.highlightEligible);
    const surfacingStakes = impactEligible ? Math.max(heatBlend.score, Number(impact?.score || 0)) : heatBlend.score;
    const intensity = numericIntensity(event, stakes, override);
    const interest = clamp(userInterestScore(event, context), 0, 5);
    const follows = clamp(followBoost(event, context.preferenceGraph), 0, 5);
    const followContext = followContextForEvent(event, context);
    const broadcaster = clamp(broadcasterFitScore(event, context), 0, 5);
    const availability = clamp(availabilityScore(event, context), 0, 5);
    const australia = clamp(australianRelevanceScore(event), 0, 5);
    const timeWindow = clamp(timeWindowFitScore(event, context, stakes), 0, 5);
    const editorialBoost = override ? 5 : 0;
    const mustWatchScore = Math.round(clamp(
      surfacingStakes * 12
      + intensity * 4
      + interest * 4
      + follows * 2
      + australia * 2
      + availability
      + timeWindow
      + editorialBoost,
      0,
      100
    ));
    const scoreReasons = [
      heatBlend.heatWeight
        ? `Pre-fixture crowd scoring blended ${Math.round(heatBlend.heatWeight * 100)}% with Stakes for surfacing; canonical Stakes remains ${stakes}/5.`
        : `Stakes ${stakes}/5 contributed ${stakes * 12} points.`,
      `Storyline intensity ${intensity}/5 contributed ${intensity * 4} points.`,
      interest ? `Your sport or competition interest added ${interest * 4} points.` : "No explicit sport or competition interest boost applied.",
      follows ? `A followed participant added ${follows * 2} points.` : "No followed-participant boost applied.",
      australia ? `Australian relevance added ${australia * 2} points.` : "No Australian-relevance boost applied.",
      availability === 5 ? "Free or selected-provider availability added 5 points." : availability === 4 ? "Included subscription availability added 4 points." : availability <= 1 ? "Premium access limits the availability boost." : "Availability is still being confirmed.",
      timeWindow === 5 ? "Fits your viewing window." : timeWindow === 3 ? "High stakes triggered your late-night override." : "Falls outside your viewing window.",
    ];
    if (override) scoreReasons.push(`Editorial review added ${editorialBoost} points.`);
    const storyline = {
      stakes: stakesLabel(stakes),
      arcStage: arcStage(event, stakes, override),
      narrativeHook: event.storyline?.narrativeHook || event.storyline?.hookSpoilerOff || event.selectedSentence || undefined,
      intensity,
      intensitySource: Number.isFinite(Number(override?.intensity ?? event.storyline?.intensity)) ? "manual" : "computed",
      scoreReasons,
    };
    const archetype = archetypeFor(event, context, override);
    if (archetype) storyline.archetype = archetype;
    const visibleLabel = visibleLabelFor(event, mustWatchScore, context, override);
    if (visibleLabel) storyline.visibleLabel = visibleLabel;
    if (Array.isArray(event.storyline?.characterRoles)) storyline.characterRoles = event.storyline.characterRoles.slice();
    if (override?.reviewedAt || event.updatedAt) storyline.lastReviewedAt = override?.reviewedAt || event.updatedAt;

    return {
      schemaVersion: SCHEMA_VERSION,
      rankingVersion: RANKING_VERSION,
      canonicalEventId,
      userInterestScore: interest,
      followBoost: follows,
      followContext,
      broadcasterFitScore: broadcaster,
      stakesScore: stakes,
      surfacingStakesScore: surfacingStakes,
      nothingscoreBlend:heatBlend,
      nothingscoreProminence:nothingscore?.phase === "pulse" ? Number(nothingscore.aggregate?.score || 0) * 1000 + Number(nothingscore.watchingCount || 0) : impactEligible ? Number(impact?.score || 0) * 100 : 0,
      australiaRelevanceScore: australia,
      availabilityScore: availability,
      timeWindowFitScore: timeWindow,
      editorialBoost,
      mustWatchScore,
      intensity,
      cardVariant: variantForSignificance(surfacingStakes, intensity, mustWatchScore, override),
      premiumSurface: override?.forceSurface || (mustWatchScore >= PREMIUM_SURFACE_POLICY.mustWatchThreshold ? "homeMustWatch" : surfacingStakes >= 4 ? "topStorylines" : "sportFeed"),
      editorialOverride: override ? {
        reviewedAt: override.reviewedAt,
        reviewedBy: override.reviewedBy,
        note: override.note,
      } : null,
      storyline,
    };
  }

  function rankEvents(events, context = {}){
    return events.map(event => ({
      event,
      enrichment: enrichEvent(event, typeof context.contextForEvent === "function" ? context.contextForEvent(event) : context),
    }))
      .sort((first, second) => {
        const scoreDifference = second.enrichment.mustWatchScore - first.enrichment.mustWatchScore;
        if (scoreDifference) return scoreDifference;
        const socialDifference = Number(second.enrichment.nothingscoreProminence || 0) - Number(first.enrichment.nothingscoreProminence || 0);
        if (socialDifference) return socialDifference;
        const affinityDifference = (second.enrichment.userInterestScore + second.enrichment.followBoost)
          - (first.enrichment.userInterestScore + first.enrichment.followBoost);
        if (affinityDifference) return affinityDifference;
        const timeDifference = (eventDate(first.event)?.getTime() || 0) - (eventDate(second.event)?.getTime() || 0);
        if (timeDifference) return timeDifference;
        return first.enrichment.canonicalEventId.localeCompare(second.enrichment.canonicalEventId);
      });
  }

  function selectPremiumSurfaces(events, context = {}, options = {}){
    const now = context.now instanceof Date ? context.now : new Date(context.now || Date.now());
    const horizonDays = Number(options.horizonDays ?? PREMIUM_SURFACE_POLICY.horizonDays);
    const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const ranked = rankEvents((Array.isArray(events) ? events : []).filter(event => {
      const start = eventDate(event);
      const status = eventStatus(event, now);
      return start
        && start <= horizon
        && (start >= now || status === "live")
        && !["completed", "past", "cancelled", "abandoned"].includes(status);
    }), context);
    const mustWatchLimit = Number(options.mustWatchLimit ?? PREMIUM_SURFACE_POLICY.mustWatchLimit);
    const topStorylineLimit = Number(options.topStorylineLimit ?? PREMIUM_SURFACE_POLICY.topStorylineLimit);
    const mustWatch = ranked.filter(item => (
      item.enrichment.premiumSurface === "homeMustWatch"
      || item.enrichment.mustWatchScore >= PREMIUM_SURFACE_POLICY.mustWatchThreshold
    )).slice(0, mustWatchLimit);
    const selectedIds = new Set(mustWatch.map(item => item.enrichment.canonicalEventId));
    const topStorylines = ranked.filter(item => (
      !selectedIds.has(item.enrichment.canonicalEventId)
      && item.enrichment.surfacingStakesScore >= PREMIUM_SURFACE_POLICY.topStorylineMinimumStakes
    )).slice(0, topStorylineLimit);
    return { mustWatch, topStorylines };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    RANKING_VERSION,
    PREMIUM_SURFACE_POLICY,
    THREE_DAYS_MS,
    canonicalFixtureTitle,
    shouldHideParticipant,
    spoilerSafeFixtureTitle,
    followContextForEvent,
    editorialOverrideFor,
    editorialNarrativeReadyForCard,
    editorialConsequenceReadyForCard,
    stakesScoreFor: numericStakes,
    intensityFor: numericIntensity,
    arcStageFor: arcStage,
    enrichEvent,
    rankEvents,
    selectPremiumSurfaces,
  });
});
