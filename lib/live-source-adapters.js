"use strict";
// Shared canonical parsers. Live mode fetches facts only: no ladders, editorial,
// local file writes, prediction settlements or deployment subprocesses.
const canonical=require("../scripts/refresh-canonical-sports");
const tennis=require("../scripts/refresh-us-open-events");
const f1=require("../scripts/refresh-f1-results");
const pl=require("../scripts/refresh-premier-league-cards");
const {coverageSources}=require("./source-coverage");
const {catalogue}=require("./calendar-catalogue");
function liveTeamFixture(event,key,homeScore,awayScore){
  const scored=['live','completed'].includes(event.status)&&homeScore!=null&&awayScore!=null&&Number.isFinite(Number(homeScore))&&Number.isFinite(Number(awayScore));
  return {...event,key,name:event.displayName||event.name,...(scored?{homeScore:Number(homeScore),awayScore:Number(awayScore),scoreDisplay:`${homeScore}–${awayScore}`}:{})};
}
function liveSources(fetchImpl=globalThis.fetch,{environment=process.env}={}){
  const seed=catalogue();
  const json=async url=>{const response=await fetchImpl(url,{signal:AbortSignal.timeout(10000),headers:{Origin:"https://www.afl.com.au",Referer:"https://www.afl.com.au/"}});if(!response.ok)throw new Error("Fixture source unavailable");return response.json();};
  const sources=[...coverageSources(fetchImpl,{discovery:false})];
  for(const code of ["afl","aflw"]){
    sources.push({id:`live-${code}`,seed:seed.filter(event=>event.key===code),fetch:async({now,previous})=>{
      const near=previous.filter(event=>Math.abs(Date.parse(event.startTimeUtc)-now)<7*86400000);
      const seasons=await json(`https://aflapi.afl.com.au/afl/v2/competitions/${code==="aflw"?3:1}/compseasons?pageSize=20`);
      const season=seasons.compSeasons?.find(item=>item.name.startsWith(String(now.getUTCFullYear())));if(!season)throw new Error("Season unavailable");
      // Schedule cards need not carry canonical roundNumber. Resolve their
      // published labels against the official round directory and include the
      // source's current neighbourhood to discover newly announced fixtures.
      const detail=await json(`https://aflapi.afl.com.au/afl/v2/compseasons/${season.id}`);
      const available=detail.compSeasons?.[0]?.rounds||[];
      const wanted=new Set(near.map(event=>Number.isInteger(event.roundNumber)?event.roundNumber:available.find(round=>round.name===event.roundLabel)?.roundNumber).filter(Number.isInteger));
      if(Number.isInteger(season.currentRoundNumber))for(const offset of [-1,0,1])wanted.add(season.currentRoundNumber+offset);
      const rounds=available.filter(round=>wanted.has(round.roundNumber)).slice(0,4).map(round=>round.roundNumber),events=[];
      if(!rounds.length)throw new Error('Official rounds unavailable');
      for(const round of rounds){
        const response=await json(`https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=${season.id}&roundNumber=${round}&pageSize=50`);
        if(!Array.isArray(response.matches))throw new Error("Invalid round");
        events.push(...response.matches.map(match=>liveTeamFixture(canonical.buildAflEvent(match,now.toISOString(),new Map(),code==="aflw"?{code,competitionId:"competition:aflw-2026",discoverySportId:"sport:aflw"}:{}).event,code,match.home?.score?.totalScore,match.away?.score?.totalScore)));
      }return events;
    }});
  }
  sources.push({id:"live-nrl",seed:seed.filter(event=>event.key==="nrl"),fetch:async({now})=>{
    const response=await json("https://mc.championdata.com/data/12999/fixture.json");
    if(!Array.isArray(response.fixture?.match))throw new Error("Invalid NRL fixtures");
    return response.fixture.match.map(match=>liveTeamFixture(canonical.buildNrlEvent(match,now.toISOString(),new Map()).event,'nrl',match.homeSquadScore,match.awaySquadScore));
  }});
  sources.push({id:"live-f1",seed:seed.filter(event=>event.key==="f1"),fetch:async({now,previous})=>{
    const updates=await f1.updatesFor(previous,now,async url=>{const response=await fetchImpl(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("F1 source unavailable");return response.text();});
    // No newly published results is a valid unchanged response, not a deletion.
    return updates.length?updates:previous;
  }});
  sources.push({id:"live-premier-league",seed:seed.filter(event=>event.key==="premier-league"),fetch:async({now})=>(await pl.loadFixtures()).map(fixture=>pl.cardForFixture(fixture,now.toISOString()))});
  sources.push({id:"live-us-open",seed:seed.filter(event=>String(event.competitionId).includes("us-open")),fetch:async({now,previous})=>{
    const cached=require("../feeds/provider-exports/tennis/us-open-2026-official-schedule.json");
    const parent=require("../data/major-events.v1.json").events.find(event=>/US Open 2026/.test(event.name));
    if(parent && (now.toISOString().slice(0,10)<parent.startDate || now.toISOString().slice(0,10)>parent.endDate))return previous;
    const snapshot=await tennis.fetchOfficialSnapshot({quick:true,now,cached});
    return tennis.fixturesFromSnapshot(snapshot).map(event=>({...tennis.canonicalUsOpenFixture(event),key:"tennis",sport:"Tennis",eventFamilyId:"us-open"}));
  }});
  return [...sources,...require('./coverage-discovery').discoverySources(fetchImpl),...require('./discovery-sources').discoveryJobs({fetchImpl,environment})];
}
module.exports={liveSources};
