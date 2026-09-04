(function attachNothingSportsFootballDirectory(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOOTBALL_DIRECTORY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFootballDirectory(){
  "use strict";

  const SCHEMA_VERSION = "football-directory.v1";
  const SESSION_SCHEMA_VERSION = "standings-directory-session.v2";
  const SESSION_STORAGE_KEY = "nothingsport:standings-directory-session:v2";
  const PLAYER_ID_PREFIX = "competitor:football:";
  const DIRECTORY_PLAYER_ID_PREFIXES = Object.freeze([
    PLAYER_ID_PREFIX,
    "competitor:nrl:",
    "competitor:afl:",
    "competitor:aflw:",
  ]);

  function unique(values){
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function defaultSessionState(){
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      activeView: "tables",
      directorySportKey: "football",
      filtersBySport: {},
    };
  }

  function normalizeFilters(raw = {}){
    return {
      leagueId: typeof raw.leagueId === "string" ? raw.leagueId : "",
      teamId: typeof raw.teamId === "string" ? raw.teamId : "",
      birthCountryCode: typeof raw.birthCountryCode === "string" ? raw.birthCountryCode.toUpperCase() : "",
      prominenceTier: ["marquee", "established", "emerging"].includes(raw.prominenceTier) ? raw.prominenceTier : "",
      sortMode: ["table", "value", "alpha"].includes(raw.sortMode) ? raw.sortMode : "table",
      genderCategory: ["male", "female", "mixed", "unknown"].includes(raw.genderCategory) ? raw.genderCategory : "",
      query: typeof raw.query === "string" ? raw.query.slice(0, 80) : "",
      expandedTeamId: typeof raw.expandedTeamId === "string" ? raw.expandedTeamId : "",
    };
  }

  function parseSessionState(raw){
    let parsed = raw;
    if (typeof raw === "string"){
      try { parsed = JSON.parse(raw); } catch (_error) { parsed = null; }
    }
    if (!parsed || parsed.schemaVersion !== SESSION_SCHEMA_VERSION) return defaultSessionState();
    const filtersBySport = Object.fromEntries(Object.entries(parsed.filtersBySport || {})
      .filter(([key]) => typeof key === "string" && key.length <= 48)
      .map(([key, filters]) => [key, normalizeFilters(filters)]));
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      activeView: parsed.activeView === "directory" ? "directory" : "tables",
      directorySportKey: typeof parsed.directorySportKey === "string" ? parsed.directorySportKey : "football",
      filtersBySport,
    };
  }

  function playerTeamMap(index){
    return new Map((index?.players || []).map(player => [player.id, player.currentTeamId]));
  }

  function isDirectoryPlayerId(value){
    return DIRECTORY_PLAYER_ID_PREFIXES.some(prefix => String(value || "").startsWith(prefix));
  }

  function expandedFollowLevels(event, graph, index){
    const eventParticipants = new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].filter(Boolean));
    const playerTeams = playerTeamMap(index);
    return (graph?.entityFollows || []).filter(follow => {
      if (eventParticipants.has(follow.participantId)) return true;
      if (!isDirectoryPlayerId(follow.participantId)) return false;
      if (follow.followLevel === "mute") return false;
      return eventParticipants.has(playerTeams.get(follow.participantId));
    }).map(follow => follow.followLevel);
  }

  function teamsForLeague(directory, leagueId){
    return (directory?.teams || []).filter(team => !leagueId || team.leagueId === leagueId);
  }

  function normalizedSearchText(value){
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .trim()
      .toLocaleLowerCase("en-AU");
  }

  function boundedEditDistance(first, second, limit = 2){
    const left = normalizedSearchText(first);
    const right = normalizedSearchText(second);
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    const previous = Array.from({ length:right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1){
      const current = [row];
      let rowMinimum = current[0];
      for (let column = 1; column <= right.length; column += 1){
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
        rowMinimum = Math.min(rowMinimum, current[column]);
      }
      if (rowMinimum > limit) return limit + 1;
      previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
  }

  function searchMatchScore(record, rawQuery){
    const query = normalizedSearchText(rawQuery);
    if (!query) return 0;
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const aliases = unique([
      record?.displayName,
      record?.shortName,
      record?.sortName,
      record?.position,
      ...(record?.aliases || []),
      ...(record?.metadata?.titleAliases || []),
    ]).map(normalizedSearchText).filter(Boolean);
    if (aliases.some(alias => alias === query)) return 0;
    if (aliases.some(alias => alias.startsWith(query))) return 1;
    const candidateTokens = aliases.flatMap(alias => alias.split(/\s+/)).filter(Boolean);
    if (queryTokens.every(token => candidateTokens.some(candidate => candidate === token || candidate.startsWith(token)))) return 2;
    const allowedDistance = query.length >= 5 ? 2 : 1;
    if (queryTokens.every(token => candidateTokens.some(candidate => boundedEditDistance(token, candidate, allowedDistance) <= allowedDistance))) return 3;
    return Number.POSITIVE_INFINITY;
  }

  function filteredDirectory(directory, rawFilters = {}){
    const filters = normalizeFilters(rawFilters);
    const teams = teamsForLeague(directory, filters.leagueId).filter(team => !filters.teamId || team.id === filters.teamId);
    const teamIds = new Set(teams.map(team => team.id));
    const players = (directory?.players || []).filter(player => {
      if (!teamIds.has(player.currentTeamId)) return false;
      if (filters.birthCountryCode && player.birthCountryCode !== filters.birthCountryCode) return false;
      if (filters.genderCategory && String(player.genderCategory || player.gender || "unknown") !== filters.genderCategory) return false;
      if (filters.prominenceTier && player.prominenceTier !== filters.prominenceTier) return false;
      return Number.isFinite(searchMatchScore(player, filters.query));
    });
    const playerTeamIds = new Set(players.map(player => player.currentTeamId));
    const visibleTeams = teams.filter(team => !filters.query || playerTeamIds.has(team.id)
      || Number.isFinite(searchMatchScore(team, filters.query)));
    const rankValue = record => Number(record?.ladderPosition ?? record?.rank ?? record?.ranking);
    const marketValue = record => Number(record?.marketValue ?? record?.marketValueEur);
    const compare = (first, second) => {
      if (filters.query){
        const scoreDelta = searchMatchScore(first, filters.query) - searchMatchScore(second, filters.query);
        if (scoreDelta) return scoreDelta;
      }
      if (filters.sortMode === "value"){
        const firstValue = marketValue(first);
        const secondValue = marketValue(second);
        if (Number.isFinite(firstValue) || Number.isFinite(secondValue)) return (Number.isFinite(secondValue) ? secondValue : -1) - (Number.isFinite(firstValue) ? firstValue : -1);
      }
      if (filters.sortMode === "table"){
        const firstRank = rankValue(first);
        const secondRank = rankValue(second);
        if (Number.isFinite(firstRank) || Number.isFinite(secondRank)) return (Number.isFinite(firstRank) ? firstRank : Number.MAX_SAFE_INTEGER) - (Number.isFinite(secondRank) ? secondRank : Number.MAX_SAFE_INTEGER);
      }
      return String(first.sortName || first.displayName || "").localeCompare(String(second.sortName || second.displayName || ""), "en-AU", { sensitivity:"base" });
    };
    return { teams: visibleTeams.slice().sort(compare), players: players.slice().sort(compare), playerTeamIds: Array.from(playerTeamIds) };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SESSION_SCHEMA_VERSION,
    SESSION_STORAGE_KEY,
    PLAYER_ID_PREFIX,
    DIRECTORY_PLAYER_ID_PREFIXES,
    defaultSessionState,
    parseSessionState,
    normalizeFilters,
    playerTeamMap,
    isDirectoryPlayerId,
    expandedFollowLevels,
    normalizedSearchText,
    boundedEditDistance,
    searchMatchScore,
    filteredDirectory,
  });
});
