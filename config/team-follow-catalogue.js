(function attachNothingSportsTeamFollowCatalogue(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_TEAM_FOLLOW_CATALOGUE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsTeamFollowCatalogue(){
  "use strict";

  const groups = [
    ["sport:rugby", "Rugby", [
      ["International", [
        ["team:rugby:wallabies", "Wallabies", ["Australia", "Wallabies"]],
        ["team:rugby:all-blacks", "All Blacks", ["New Zealand", "All Blacks"]],
        ["team:rugby:springboks", "Springboks", ["South Africa", "Springboks"]],
        ["team:rugby:argentina", "Argentina", ["Argentina", "Los Pumas"]],
        ["team:rugby:england", "England", ["England"]],
        ["team:rugby:ireland", "Ireland", ["Ireland"]],
        ["team:rugby:france", "France", ["France"]],
        ["team:rugby:scotland", "Scotland", ["Scotland"]],
        ["team:rugby:wales", "Wales", ["Wales"]],
      ]],
      ["Domestic", [
        ["team:rugby:brumbies", "Brumbies", ["Brumbies"]],
        ["team:rugby:waratahs", "Waratahs", ["Waratahs"]],
        ["team:rugby:reds", "Reds", ["Reds", "Queensland Reds"]],
        ["team:rugby:force", "Western Force", ["Western Force", "Force"]],
        ["team:rugby:rebels", "Rebels", ["Melbourne Rebels", "Rebels"]],
        ["team:rugby:blues", "Blues", ["Blues"]],
        ["team:rugby:chiefs", "Chiefs", ["Chiefs"]],
        ["team:rugby:crusaders", "Crusaders", ["Crusaders"]],
        ["team:rugby:hurricanes", "Hurricanes", ["Hurricanes"]],
        ["team:rugby:highlanders", "Highlanders", ["Highlanders"]],
      ]],
    ]],
    ["sport:cricket", "Cricket", [
      ["International", [
        ["team:cricket:australia", "Australia", ["Australia", "Australian"]],
        ["team:cricket:england", "England", ["England"]],
        ["team:cricket:india", "India", ["India"]],
        ["team:cricket:new-zealand", "New Zealand", ["New Zealand"]],
        ["team:cricket:south-africa", "South Africa", ["South Africa"]],
        ["team:cricket:pakistan", "Pakistan", ["Pakistan"]],
        ["team:cricket:bangladesh", "Bangladesh", ["Bangladesh"]],
        ["team:cricket:sri-lanka", "Sri Lanka", ["Sri Lanka"]],
        ["team:cricket:west-indies", "West Indies", ["West Indies"]],
      ]],
      ["Domestic", [
        ["team:cricket:sydney-sixers", "Sydney Sixers", ["Sydney Sixers"]],
        ["team:cricket:sydney-thunder", "Sydney Thunder", ["Sydney Thunder"]],
        ["team:cricket:brisbane-heat", "Brisbane Heat", ["Brisbane Heat"]],
        ["team:cricket:melbourne-stars", "Melbourne Stars", ["Melbourne Stars"]],
        ["team:cricket:melbourne-renegades", "Melbourne Renegades", ["Melbourne Renegades"]],
        ["team:cricket:perth-scorchers", "Perth Scorchers", ["Perth Scorchers"]],
        ["team:cricket:adelaide-strikers", "Adelaide Strikers", ["Adelaide Strikers"]],
        ["team:cricket:hobart-hurricanes", "Hobart Hurricanes", ["Hobart Hurricanes"]],
      ]],
    ]],
    ["sport:football", "Football", [
      ["International", [
        ["team:football:socceroos", "Socceroos", ["Australia", "Socceroos"]],
        ["team:football:matildas", "Matildas", ["Australia", "Matildas"]],
        ["team:football:england", "England", ["England"]],
        ["team:football:argentina", "Argentina", ["Argentina"]],
        ["team:football:france", "France", ["France"]],
        ["team:football:spain", "Spain", ["Spain"]],
        ["team:football:brazil", "Brazil", ["Brazil"]],
      ]],
      ["Domestic", [
        ["team:football:sydney-fc", "Sydney FC", ["Sydney FC"]],
        ["team:football:western-sydney-wanderers", "Western Sydney Wanderers", ["Western Sydney Wanderers"]],
        ["team:football:melbourne-victory", "Melbourne Victory", ["Melbourne Victory"]],
        ["team:football:melbourne-city", "Melbourne City", ["Melbourne City"]],
        ["team:football:brisbane-roar", "Brisbane Roar", ["Brisbane Roar"]],
        ["team:football:adelaide-united", "Adelaide United", ["Adelaide United"]],
        ["team:football:perth-glory", "Perth Glory", ["Perth Glory"]],
      ]],
      ["Premier League", [
        ["team:football:epl:1", "Arsenal", ["Arsenal"]],
        ["team:football:epl:2", "Aston Villa", ["Aston Villa"]],
        ["team:football:epl:127", "Bournemouth", ["Bournemouth", "AFC Bournemouth"]],
        ["team:football:epl:130", "Brentford", ["Brentford"]],
        ["team:football:epl:131", "Brighton & Hove Albion", ["Brighton & Hove Albion", "Brighton"]],
        ["team:football:epl:4", "Chelsea", ["Chelsea"]],
        ["team:football:epl:5", "Coventry City", ["Coventry City", "Coventry"]],
        ["team:football:epl:6", "Crystal Palace", ["Crystal Palace"]],
        ["team:football:epl:7", "Everton", ["Everton"]],
        ["team:football:epl:34", "Fulham", ["Fulham"]],
        ["team:football:epl:41", "Hull City", ["Hull City", "Hull"]],
        ["team:football:epl:8", "Ipswich Town", ["Ipswich Town", "Ipswich"]],
        ["team:football:epl:9", "Leeds United", ["Leeds United", "Leeds"]],
        ["team:football:epl:10", "Liverpool", ["Liverpool"]],
        ["team:football:epl:11", "Manchester City", ["Manchester City", "Man City"]],
        ["team:football:epl:12", "Manchester United", ["Manchester United", "Man Utd"]],
        ["team:football:epl:23", "Newcastle United", ["Newcastle United", "Newcastle"]],
        ["team:football:epl:15", "Nottingham Forest", ["Nottingham Forest", "Nott'm Forest"]],
        ["team:football:epl:29", "Sunderland", ["Sunderland"]],
        ["team:football:epl:21", "Tottenham Hotspur", ["Tottenham Hotspur", "Tottenham", "Spurs"]],
      ]],
    ]],
  ].map(([domainId, label, sections]) => Object.freeze({
    domainId,
    label,
    sections: Object.freeze(sections.map(([sectionLabel, teams]) => Object.freeze({
      label: sectionLabel,
      teams: Object.freeze(teams.map(([id, displayName, aliases]) => Object.freeze({
        id, displayName, aliases: Object.freeze(aliases), type: sectionLabel === "International" ? "nationalSide" : "team", sportDomainId: domainId,
      }))),
    }))),
  }));

  const allTeams = Object.freeze(groups.flatMap(group => group.sections.flatMap(section => section.teams)));
  const teamsById = Object.freeze(Object.fromEntries(allTeams.map(team => [team.id, team])));

  function teamsForDomain(domainId){
    return groups.find(group => group.domainId === domainId)?.sections || [];
  }

  function participantIdsForEvent(event){
    const sportKey = String(event?.key || "");
    const domainId = sportKey === "rugby" ? "sport:rugby" : sportKey === "cricket" ? "sport:cricket" : ["football", "fifa", "premier-league"].includes(sportKey) ? "sport:football" : null;
    if (!domainId) return [];
    const text = [event?.name, event?.displayTitleCompact, ...(Array.isArray(event?.participants) ? event.participants.map(participant => participant?.name) : [])]
      .filter(Boolean).join(" | ").toLowerCase();
    return teamsForDomain(domainId).flatMap(section => section.teams)
      .filter(team => team.aliases.some(alias => new RegExp(`(?:^|[^a-z])${escapeRegExp(alias.toLowerCase())}(?:$|[^a-z])`).test(text)))
      .map(team => team.id);
  }

  function escapeRegExp(value){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  return Object.freeze({ version: "team-follow-catalogue.v1", groups: Object.freeze(groups), allTeams, teamsById, teamsForDomain, participantIdsForEvent });
});
