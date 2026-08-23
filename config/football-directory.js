(function attachNothingSportsFootballDirectory(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOOTBALL_DIRECTORY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFootballDirectory(){
  "use strict";

  const SCHEMA_VERSION = "football-directory.v1";
  const SESSION_SCHEMA_VERSION = "standings-directory-session.v1";
  const SESSION_STORAGE_KEY = "nothingsport:standings-directory-session:v1";
  const PLAYER_ID_PREFIX = "competitor:football:";

  function unique(values){
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function defaultSessionState(selectedSportKeys = []){
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      activeView: "tables",
      selectedSportKeys: unique(selectedSportKeys),
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

  function parseSessionState(raw, selectedSportKeys = []){
    let parsed = raw;
    if (typeof raw === "string"){
      try { parsed = JSON.parse(raw); } catch (_error) { parsed = null; }
    }
    if (!parsed || parsed.schemaVersion !== SESSION_SCHEMA_VERSION) return defaultSessionState(selectedSportKeys);
    const filtersBySport = Object.fromEntries(Object.entries(parsed.filtersBySport || {})
      .filter(([key]) => typeof key === "string" && key.length <= 48)
      .map(([key, filters]) => [key, normalizeFilters(filters)]));
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      activeView: parsed.activeView === "directory" ? "directory" : "tables",
      selectedSportKeys: unique(Array.isArray(parsed.selectedSportKeys) ? parsed.selectedSportKeys : selectedSportKeys),
      directorySportKey: typeof parsed.directorySportKey === "string" ? parsed.directorySportKey : "football",
      filtersBySport,
    };
  }

  function playerTeamMap(index){
    return new Map((index?.players || []).map(player => [player.id, player.currentTeamId]));
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
      if (!String(follow.participantId || "").startsWith(PLAYER_ID_PREFIX)) return false;
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
      const team = teams.find(item => item.id === player.currentTeamId);
      return [player.displayName, player.position, player.prominenceTier, team?.displayName]
        .filter(Boolean).join(" ").toLocaleLowerCase("en-AU").includes(query);
    });
    const playerTeamIds = new Set(players.map(player => player.currentTeamId));
    const visibleTeams = teams.filter(team => !query || playerTeamIds.has(team.id)
      || [team.displayName, ...(team.aliases || [])].join(" ").toLocaleLowerCase("en-AU").includes(query));
    return { teams: visibleTeams, players };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SESSION_SCHEMA_VERSION,
    SESSION_STORAGE_KEY,
    PLAYER_ID_PREFIX,
    defaultSessionState,
    parseSessionState,
    normalizeFilters,
    playerTeamMap,
    expandedFollowLevels,
    filteredDirectory,
  });
});
