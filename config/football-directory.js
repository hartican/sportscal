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

  function filteredDirectory(directory, rawFilters = {}){
    const filters = normalizeFilters(rawFilters);
    const query = filters.query.trim().toLocaleLowerCase("en-AU");
    const teams = teamsForLeague(directory, filters.leagueId).filter(team => !filters.teamId || team.id === filters.teamId);
    const teamIds = new Set(teams.map(team => team.id));
    const players = (directory?.players || []).filter(player => {
      if (!teamIds.has(player.currentTeamId)) return false;
      if (filters.birthCountryCode && player.birthCountryCode !== filters.birthCountryCode) return false;
      if (filters.prominenceTier && player.prominenceTier !== filters.prominenceTier) return false;
      if (!query) return true;
      return [player.displayName, player.position, player.prominenceTier]
        .filter(Boolean).join(" ").toLocaleLowerCase("en-AU").includes(query);
    });
    const playerTeamIds = new Set(players.map(player => player.currentTeamId));
    const visibleTeams = teams.filter(team => !query || playerTeamIds.has(team.id)
      || [team.displayName, ...(team.aliases || [])].join(" ").toLocaleLowerCase("en-AU").includes(query));
    return { teams: visibleTeams, players, playerTeamIds: Array.from(playerTeamIds) };
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
    filteredDirectory,
  });
});
