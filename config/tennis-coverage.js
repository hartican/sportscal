(function attachNothingSportsTennisCoverage(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_TENNIS_COVERAGE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsTennisCoverage(){
  "use strict";

  const FROTH_LEVELS = Object.freeze(["low", "balanced", "high", "maximum"]);
  const BASELINE_LEVELS = new Set(["grand_slam", "atp_masters_1000", "wta_1000", "atp_finals", "wta_finals", "team_competition"]);
  const THOUSAND_LEVELS = new Set(["atp_masters_1000", "wta_1000"]);
  const FIVE_HUNDRED_LEVELS = new Set(["atp_500", "wta_500"]);
  const TWO_FIFTY_LEVELS = new Set(["atp_250", "wta_250"]);
  const LATE_ROUNDS = new Set(["quarterfinal", "semifinal", "final"]);
  const LEVEL_COMPETITIONS = Object.freeze({
    grand_slam: "competition:grand-slams",
    atp_masters_1000: "competition:atp-tour",
    atp_500: "competition:atp-tour",
    atp_250: "competition:atp-tour",
    atp_finals: "competition:atp-tour",
    wta_1000: "competition:wta-tour",
    wta_500: "competition:wta-tour",
    wta_250: "competition:wta-tour",
    wta_finals: "competition:wta-tour",
    team_competition: "competition:davis-cup",
    challenger: "competition:atp-tour",
  });

  function slug(value){
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeFroth(value){
    const normalized = String(value || "balanced").toLowerCase();
    if (FROTH_LEVELS.includes(normalized)) return normalized;
    if (normalized === "casual") return "low";
    if (normalized === "like") return "balanced";
    if (normalized === "froth") return "high";
    return "balanced";
  }

  function normalizeTournament(input){
    if (!input || typeof input !== "object") throw new TypeError("A tennis tournament record is required");
    const representedTours = Array.from(new Set(input.representedTours || (input.tour === "BOTH" ? ["ATP", "WTA"] : [input.tour])));
    const tournamentId = input.tournamentId || `tournament:tennis:${slug(input.providerId || `${input.tour}-${input.name}-${input.city}-${input.season || ""}`)}`;
    const competitionId = input.competitionId
      || (input.level === "team_competition" && /billie|bjk/i.test(input.name) ? "competition:billie-jean-king-cup" : LEVEL_COMPETITIONS[input.level]);
    if (!competitionId) throw new Error(`Unsupported tennis level: ${input.level}`);
    return Object.freeze({
      ...input,
      tournamentId,
      providerAlias: input.providerAlias || `${String(input.tour || "tennis").toLowerCase()}:tournament:${input.providerId}`,
      representedTours: Object.freeze(representedTours),
      competitionId,
      taxonomySportId: "sport:tennis",
      disciplineId: "discipline:tennis:professional",
      baselineEligible: BASELINE_LEVELS.has(input.level),
    });
  }

  function isTournamentActive(tournament, referenceDate){
    const day = String(referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 10) : referenceDate || "").slice(0, 10);
    return Boolean(day && tournament?.startDate <= day && tournament?.endDate >= day);
  }

  function inclusionReasons(event, { broadcasterConfidenceThreshold = 0.8 } = {}){
    const reasons = [];
    if (BASELINE_LEVELS.has(event?.level)) reasons.push(event.level);
    if ((event?.participants || []).some(participant => Number(participant.rankingSingles) <= 50)) reasons.push("top_50");
    if ((event?.participants || []).some(participant => participant.isAustralian || participant.nationalityCode === "AUS")) reasons.push("australian");
    if (event?.editorialPromoted) reasons.push("editorial");
    if (Number(event?.broadcasterConfidence) >= broadcasterConfidenceThreshold) reasons.push("broadcaster_confidence");
    return Array.from(new Set(reasons));
  }

  function isCatalogueEligible(event, options){
    return inclusionReasons(event, options).length > 0;
  }

  function isVisibleAtFroth(event, frothValue, context = {}){
    const froth = normalizeFroth(frothValue);
    const reasons = inclusionReasons(event, context);
    const followedParticipantIds = new Set(context.followedParticipantIds || []);
    const followedPlayer = (event?.participants || []).some(participant => followedParticipantIds.has(participant.athleteId || participant.id));
    const australian = reasons.includes("australian");
    const top50 = reasons.includes("top_50");
    const lateRound = LATE_ROUNDS.has(event?.round);
    const overview = event?.cardType === "tournament_overview";
    if (followedPlayer || australian) return true;
    if (froth === "low") {
      return event?.level === "grand_slam"
        || event?.level === "atp_finals"
        || event?.level === "wta_finals"
        || (THOUSAND_LEVELS.has(event?.level) && lateRound);
    }
    if (froth === "balanced") {
      return event?.level === "grand_slam"
        || event?.level === "atp_finals"
        || event?.level === "wta_finals"
        || event?.level === "team_competition"
        || (THOUSAND_LEVELS.has(event?.level) && (overview || top50 || lateRound))
        || (FIVE_HUNDRED_LEVELS.has(event?.level) && event?.round === "final");
    }
    if (froth === "high") {
      return BASELINE_LEVELS.has(event?.level)
        || FIVE_HUNDRED_LEVELS.has(event?.level)
        || TWO_FIFTY_LEVELS.has(event?.level)
        || reasons.includes("editorial")
        || reasons.includes("broadcaster_confidence");
    }
    return isCatalogueEligible(event, context)
      || event?.level === "challenger"
      || event?.eventType === "doubles"
      || event?.emergingPlayerStoryline === true;
  }

  function rankingScore(event, context = {}){
    const levelScore = {
      grand_slam: 96,
      atp_finals: 93,
      wta_finals: 93,
      atp_masters_1000: 88,
      wta_1000: 88,
      team_competition: 82,
      atp_500: 68,
      wta_500: 68,
      atp_250: 54,
      wta_250: 54,
      challenger: 38,
    }[event?.level] || 30;
    const reasons = inclusionReasons(event, context);
    const followedTours = new Set(context.followedTours || []);
    return levelScore
      + (event?.active ? 10 : 0)
      + (followedTours.has(event?.tour) || followedTours.has("TENNIS") ? 8 : 0)
      + (reasons.includes("australian") ? 7 : 0)
      + (reasons.includes("top_50") ? 4 : 0)
      + (event?.round === "final" ? 6 : event?.round === "semifinal" ? 4 : event?.round === "quarterfinal" ? 2 : 0);
  }

  function activeTournamentOverviewEvents(catalogue, { referenceDate, froth = "balanced" } = {}){
    return (catalogue?.tournaments || [])
      .filter(tournament => isTournamentActive(tournament, referenceDate))
      .map(tournament => ({ ...tournament, active: true, cardType: "tournament_overview", round: "all", participants: [] }))
      .filter(event => isVisibleAtFroth(event, froth))
      .map(event => ({ ...event, rankingScore: rankingScore(event) }))
      .sort((first, second) => second.rankingScore - first.rankingScore || first.name.localeCompare(second.name));
  }

  return Object.freeze({
    SCHEMA_VERSION: "tennis-coverage.v1",
    FROTH_LEVELS,
    BASELINE_LEVELS,
    normalizeFroth,
    normalizeTournament,
    isTournamentActive,
    inclusionReasons,
    isCatalogueEligible,
    isVisibleAtFroth,
    rankingScore,
    activeTournamentOverviewEvents,
  });
});
