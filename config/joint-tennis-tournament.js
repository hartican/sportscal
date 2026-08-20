(function attachNothingSportsJointTennisTournament(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_JOINT_TENNIS_TOURNAMENT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsJointTennisTournament(){
  "use strict";

  const SCHEMA_VERSION = "joint-tennis-tournament.v1";
  const CONFIDENCE_STATES = Object.freeze(["Confirmed", "Provisional", "Session only", "Stale"]);
  const TIMING_TYPES = Object.freeze(["exact", "not_before", "followed_by", "session_only"]);
  const RESULT_AVAILABILITY_STATUSES = Object.freeze(["available", "unavailable"]);
  const RESULT_CHECK_STATES = Object.freeze(["not_checked", "no_parseable_completed_results", "parsed"]);
  const TRUSTED_NARRATIVE_SOURCES = new Set(["official", "licensed_provider", "established_media", "internal_editorial"]);
  const OUTCOME_SIGNAL_PATTERN = /(?:result|winner|\bwin(?:ning)?\b|won|loss|lost|score|set score|post-match|beat(?:ing)?|defeat(?:ed)?|advanced|streak)/i;
  const ROUND_SCORES = Object.freeze({
    final: 35,
    semifinal: 30,
    quarterfinal: 24,
    round_of_16: 18,
    round_of_32: 12,
    round_of_64: 8,
    round_of_128: 5,
    qualifying: 4,
    unknown: 6,
  });

  function slug(value){
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function clone(value){
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function zonedDateKey(value, timeZone){
    const date = value instanceof Date ? value : new Date(value);
    if (!timeZone || Number.isNaN(date.getTime())) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function zonedDateTimeToUtc(dateKey, timeKey, timeZone){
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(`${dateKey}T${timeKey}`);
    if (!match || !timeZone) return null;
    const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
    let guess = desired;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    for (let attempt = 0; attempt < 3; attempt += 1){
      const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      guess += desired - observed;
    }
    const result = new Date(guess);
    return Number.isNaN(result.getTime()) ? null : result.toISOString();
  }

  function normalizeTour(value){
    const tour = String(value || "").trim().toUpperCase();
    if (!new Set(["ATP", "WTA"]).has(tour)) throw new Error(`Unsupported tennis tour: ${value}`);
    return tour;
  }

  function normalizeRound(value){
    const normalized = slug(value).replace(/^r(?=\d+$)/, "round-");
    const aliases = {
      "championship": "final",
      "finals": "final",
      "semi-final": "semifinal",
      "semi-finals": "semifinal",
      "semifinals": "semifinal",
      "quarter-final": "quarterfinal",
      "quarter-finals": "quarterfinal",
      "quarterfinals": "quarterfinal",
      "round-16": "round_of_16",
      "round-of-16": "round_of_16",
      "r16": "round_of_16",
      "round-32": "round_of_32",
      "round-of-32": "round_of_32",
      "r32": "round_of_32",
      "round-64": "round_of_64",
      "round-of-64": "round_of_64",
      "r64": "round_of_64",
      "round-128": "round_of_128",
      "round-of-128": "round_of_128",
      "r128": "round_of_128",
      "qualifier": "qualifying",
      "qualifiers": "qualifying",
      "qualification": "qualifying",
    };
    return aliases[normalized] || normalized.replace(/-/g, "_") || "unknown";
  }

  function stableTournamentId(input){
    const season = Number(input?.season);
    const name = slug(input?.name || "joint-tennis-tournament");
    if (!Number.isInteger(season) || season < 2000) throw new Error("A valid tournament season is required");
    return `tournament:tennis:joint:${name}:${season}`;
  }

  function participantIdentity(participant, tour){
    const name = slug(participant?.name);
    if (!name) throw new Error("Every tournament participant needs a name");
    return participant?.playerId || `competitor:tennis:${String(tour).toLowerCase()}:${name}`;
  }

  function stableMatchId(input){
    const tournamentId = String(input?.tournamentId || "").trim();
    const tour = normalizeTour(input?.tour);
    const participants = (input?.players || []).map(player => participantIdentity(player, tour)).sort();
    if (!/^tournament:tennis:/.test(tournamentId)) throw new Error("A canonical tournament ID is required");
    if (participants.length !== 2 || new Set(participants).size !== 2) throw new Error("A singles match needs two distinct participants");
    return `match:tennis:${slug(tournamentId)}:${tour.toLowerCase()}:${participants.map(slug).join("--")}`;
  }

  function rankingComponent(players){
    const scores = (players || []).map(player => {
      const ranking = Number(player?.ranking);
      if (!Number.isInteger(ranking) || ranking < 1) return 2;
      return Math.max(2, 15 - ((Math.min(ranking, 100) - 1) * 0.13));
    });
    return Number(scores.reduce((total, score) => total + score, 0).toFixed(2));
  }

  function australianComponent(players){
    return (players || []).some(player => player?.nationalityCode === "AUS" || player?.isAustralian === true) ? 20 : 0;
  }

  function narrativeComponent(signals){
    const accepted = (signals || []).filter(signal => {
      if (!signal || !TRUSTED_NARRATIVE_SOURCES.has(signal.trust)) return false;
      return !OUTCOME_SIGNAL_PATTERN.test(`${signal.kind || ""} ${signal.label || ""}`);
    });
    const score = Math.min(15, accepted.reduce((total, signal) => total + Math.max(0, Math.min(8, Number(signal.weight) || 0)), 0));
    return { score: Number(score.toFixed(2)), accepted };
  }

  function scoreMatch(match){
    const round = normalizeRound(match?.round);
    const roundImportance = ROUND_SCORES[round] ?? ROUND_SCORES.unknown;
    const playerRankings = rankingComponent(match?.players);
    const australianInterest = australianComponent(match?.players);
    const narrative = narrativeComponent(match?.narrativeSignals);
    const score = Number((roundImportance + playerRankings + australianInterest + narrative.score).toFixed(2));
    const reasons = [
      `${round.replace(/_/g, " ")} importance`,
      ...(playerRankings > 4 ? ["player rankings"] : []),
      ...(australianInterest ? ["Australian interest"] : []),
      ...narrative.accepted.map(signal => signal.label || signal.kind).filter(Boolean),
    ];
    return Object.freeze({
      score,
      components: Object.freeze({ roundImportance, playerRankings, australianInterest, narrative: narrative.score }),
      reasons: Object.freeze(Array.from(new Set(reasons))),
    });
  }

  function scheduleOrder(first, second){
    const firstSequence = Number(first?.scheduledSequence);
    const secondSequence = Number(second?.scheduledSequence);
    if (Number.isFinite(firstSequence) && Number.isFinite(secondSequence) && firstSequence !== secondSequence) return firstSequence - secondSequence;
    const firstCourt = Number(first?.courtSequence);
    const secondCourt = Number(second?.courtSequence);
    if (Number.isFinite(firstCourt) && Number.isFinite(secondCourt) && firstCourt !== secondCourt) return firstCourt - secondCourt;
    return String(first?.matchId || "").localeCompare(String(second?.matchId || ""));
  }

  function selectPromotedMatches(matches, limit = 3){
    const scored = (matches || []).map(match => ({ ...match, selection: scoreMatch(match) }));
    const selectedIds = new Set(scored
      .slice()
      .sort((first, second) => second.selection.score - first.selection.score || first.matchId.localeCompare(second.matchId))
      .slice(0, Math.max(0, limit))
      .map(match => match.matchId));
    return Object.freeze({
      matches: Object.freeze(scored.map(match => Object.freeze(match))),
      promotedMatchIds: Object.freeze(scored.filter(match => selectedIds.has(match.matchId)).sort(scheduleOrder).map(match => match.matchId)),
    });
  }

  function confidenceForTiming(timing){
    if (timing?.type === "exact") return "Confirmed";
    if (timing?.type === "session_only") return "Session only";
    return "Provisional";
  }

  function aggregateConfidence(matches){
    if (!(matches || []).length) return "Provisional";
    const states = new Set(matches.map(match => confidenceForTiming(match.timing)));
    if (states.has("Session only")) return "Session only";
    if (states.has("Provisional")) return "Provisional";
    return "Confirmed";
  }

  function stripScheduleOutcomes(value, parentKey = ""){
    if (Array.isArray(value)) return value.map(item => stripScheduleOutcomes(item, parentKey));
    if (!value || typeof value !== "object") return value;
    const output = {};
    Object.entries(value).forEach(([key, child]) => {
      const isSelectionScore = key === "score" && parentKey === "selection";
      if (!isSelectionScore && /^(?:result|results|score|scores|winner|winnerId|sets|outcome|outcomeSignals|completed)$/i.test(key)) return;
      output[key] = stripScheduleOutcomes(child, key);
    });
    return output;
  }

  function spoilerSafeView(document, resultsVisible = false){
    const output = clone(document);
    if (output?.schedule?.matches) output.schedule.matches = stripScheduleOutcomes(output.schedule.matches);
    if (output?.matchHistory) output.matchHistory = stripScheduleOutcomes(output.matchHistory);
    if (!resultsVisible) {
      delete output.resultsByMatchId;
      delete output.resultAvailability;
      delete output.reporting;
    }
    return output;
  }

  function normalizeResultAvailability(value, resultCount, fallbackCheckedAt){
    const input = value || {};
    const checkedAt = String(input.checkedAt || fallbackCheckedAt || "");
    if (!RESULT_CHECK_STATES.includes(input.lastCheck)) throw new Error(`Unsupported Cincinnati result check state: ${input.lastCheck}`);
    if (!checkedAt || new Date(checkedAt).toISOString() !== checkedAt) throw new Error("Cincinnati result availability needs a normalized checkedAt time");
    let sourceUrl = null;
    let sourceTrust = input.sourceTrust === "unverified" ? "unverified" : "verified";
    if (input.sourceUrl != null) {
      const source = new URL(String(input.sourceUrl));
      if (source.protocol !== "https:") throw new Error("Cincinnati result availability sources must use HTTPS");
      sourceUrl = source.href;
    }
    return {
      status: Number(resultCount) > 0 ? "available" : "unavailable",
      checkedAt,
      sourceUrl,
      lastCheck: input.lastCheck,
      ...(sourceUrl ? { sourceTrust } : {}),
    };
  }

  function normalizeCompletedResult(result, match){
    if (result?.status !== "completed") throw new Error("Only completed Cincinnati results may be stored");
    const score = String(result?.score || "").replace(/\s+/g, " ").trim();
    if (!/(?:^|\s)[0-7][-–][0-7](?:\(\d+\))?(?=\s|$)/.test(score)) throw new Error("A completed Cincinnati result needs an explicit tennis set score");
    if (!(match?.players || []).some(player => player.playerId === result?.winnerPlayerId)) throw new Error("A Cincinnati result winner must be one of the scheduled participants");
    const source = new URL(String(result?.sourceUrl || ""));
    if (source.protocol !== "https:") throw new Error("Cincinnati result sources must use HTTPS");
    const sourceTrust = result?.sourceTrust === "unverified" ? "unverified" : "verified";
    const retrievedAt = String(result?.retrievedAt || "");
    if (!retrievedAt || new Date(retrievedAt).toISOString() !== retrievedAt) throw new Error("A Cincinnati result needs a normalized retrieval time");
    return {
      status: "completed",
      score,
      winnerPlayerId: result.winnerPlayerId,
      sourceUrl: source.href,
      sourceTrust,
      ...(result?.sourceName ? { sourceName: String(result.sourceName).trim() } : {}),
      ...(result?.sourceRecordId ? { sourceRecordId: String(result.sourceRecordId).trim() } : {}),
      ...(Number.isInteger(result?.reliabilityRank) ? { reliabilityRank: result.reliabilityRank } : {}),
      retrievedAt,
    };
  }

  function withResults(document, resultsByMatchId, resultAvailability = document?.resultAvailability){
    const output = spoilerSafeView(document, false);
    const matches = new Map([
      ...(output?.schedule?.matches || []),
      ...(output?.matchHistory || []),
    ].map(match => [match.matchId, match]));
    const normalizedResults = {};
    Object.entries(resultsByMatchId || {}).forEach(([matchId, result]) => {
      const match = matches.get(matchId);
      if (!match) throw new Error(`Result references an unknown match: ${matchId}`);
      normalizedResults[matchId] = normalizeCompletedResult(result, match);
    });
    if (Object.keys(normalizedResults).length) output.resultsByMatchId = normalizedResults;
    output.resultAvailability = normalizeResultAvailability(resultAvailability, Object.keys(normalizedResults).length, output?.retrievedAt);
    return output;
  }

  function savedMatches(document, savedMatchIds, promotedMatchIds = document?.schedule?.promotedMatchIds || []){
    const saved = new Set(savedMatchIds || []);
    const promoted = new Set(promotedMatchIds || []);
    const addressable = [...(document?.schedule?.matches || []), ...(document?.matchHistory || [])];
    return Array.from(new Map(addressable.map(match => [match.matchId, match])).values())
      .filter(match => saved.has(match.matchId) && !promoted.has(match.matchId))
      .sort(scheduleOrder);
  }

  return Object.freeze({
    SCHEMA_VERSION,
    CONFIDENCE_STATES,
    TIMING_TYPES,
    RESULT_AVAILABILITY_STATUSES,
    RESULT_CHECK_STATES,
    ROUND_SCORES,
    TRUSTED_NARRATIVE_SOURCES,
    aggregateConfidence,
    confidenceForTiming,
    normalizeRound,
    normalizeResultAvailability,
    savedMatches,
    scheduleOrder,
    scoreMatch,
    selectPromotedMatches,
    slug,
    spoilerSafeView,
    stableMatchId,
    stableTournamentId,
    stripScheduleOutcomes,
    withResults,
    zonedDateKey,
    zonedDateTimeToUtc,
  });
});
