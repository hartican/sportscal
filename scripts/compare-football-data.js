#!/usr/bin/env node
'use strict';

// Explicit server-side trial. Never writes fixtures, tables, Feed or releases.
const fs=require('node:fs');
const path=require('node:path');
const {normalizeMatches,normalizeStandings,compareFixtures,createClient,trialRecovery,ATTRIBUTION}=require('./lib/football-data-trial');
const {normalizeLeague,resolveLeagueIdentities}=require('./lib/openligadb-football');
const registry=require('../config/football-openligadb-identities.json');
const ROOT=path.resolve(__dirname,'..');
function argument(name){const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];}
function load(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function compareTables(reference,candidate,{compareRanks=true}={}){
  const incoming=new Map(candidate.map(row=>[row.participantId,row]));const differences=[];
  const fields=['played','won','drawn','lost','ladderPoints','pointsFor','pointsAgainst','pointsDifference'];
  let matched=0,matchingStats=0;const rankDifferences=[];
  for(const row of reference){
    const next=incoming.get(row.participantId);
    if(!next){differences.push({participantId:row.participantId,kind:'missing'});continue;}
    matched++;let equal=true;
    for(const field of fields)if(row[field]!==next[field]){equal=false;differences.push({participantId:row.participantId,field,reference:row[field],candidate:next[field]});}
    if(equal)matchingStats++;
    if(compareRanks && row.rank!==next.rank)rankDifferences.push({participantId:row.participantId,reference:row.rank,candidate:next.rank});
  }
  return {referenceCount:reference.length,candidateCount:candidate.length,matched,matchingStats,differences,rankDifferences};
}
function publishedFixture(e){return {providerFixtureId:e.id,homeParticipantId:e.homeParticipantId||e.participantIds?.[0],awayParticipantId:e.awayParticipantId||e.participantIds?.[1],roundNumber:e.roundNumber,startTimeUtc:e.startTimeUtc,
  result:e.status==='completed'&&Number.isSafeInteger(e.homeScore)&&Number.isSafeInteger(e.awayScore)?{homeScore:e.homeScore,awayScore:e.awayScore}:null};}
function referencePulse(m){return {providerFixtureId:String(m.id),homeParticipantId:`team:football:epl:${m.teams[0].team.club.id}`,awayParticipantId:`team:football:epl:${m.teams[1].team.club.id}`,roundNumber:m.gameweek.gameweek,startTimeUtc:new Date(m.kickoff.millis).toISOString(),
  result:m.status==='C'&&Number.isSafeInteger(m.teams[0].score)&&Number.isSafeInteger(m.teams[1].score)?{homeScore:m.teams[0].score,awayScore:m.teams[1].score}:null};}
function uclFixture(m){return {...m,homeParticipantId:m.participants[0].participantId,awayParticipantId:m.participants[1].participantId};}
async function main(){
  const output=argument('--report-dir');
  if(!output || !path.isAbsolute(output))throw new Error('Pass an absolute --report-dir outside the repository.');
  const relative=path.relative(ROOT,output);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('Trial outputs must stay outside the repository.');
  if(process.argv.includes('--live')){
    const envFile=argument('--env-file');let token=process.env.FOOTBALL_DATA_API_TOKEN;
    if(envFile){
      if((fs.statSync(envFile).mode&0o077)!==0)throw new Error('Credential file must restrict access to its owner.');
      token=fs.readFileSync(envFile,'utf8').match(/^FOOTBALL_DATA_API_TOKEN=([a-f0-9]{32})$/m)?.[1];
    }
    const client=createClient({token});fs.mkdirSync(output,{recursive:true});
    for(const code of ['PL','CL'])for(const resource of ['matches','standings']){
      const record=await client(code,resource);
      fs.writeFileSync(path.join(output,`${code.toLowerCase()}-${resource}.json`),JSON.stringify(record,null,2)+'\n',{mode:0o600});
    }
  }else if(!process.argv.includes('--recorded'))throw new Error('Choose --live or --recorded.');
  const observations={};
  for(const code of ['PL','CL']){
    const matches=load(path.join(output,`${code.toLowerCase()}-matches.json`));
    const standings=load(path.join(output,`${code.toLowerCase()}-standings.json`));
    if(matches.httpStatus!==200||standings.httpStatus!==200)throw new Error('Successful API observations required.');
    observations[code]={facts:normalizeMatches(matches.payload,{code,checkedAt:matches.checkedAt}),table:normalizeStandings(standings.payload,{code}),matchCheckedAt:matches.checkedAt,tableCheckedAt:standings.checkedAt};
  }
  const pulse=load(path.join(output,'fresh-pulse-fixtures.json'));
  const open=load(path.join(output,'fresh-openligadb-ucl.json'));
  const freshUcl=resolveLeagueIdentities(normalizeLeague(open.payload,{league:'ucl',checkedAt:open.checkedAt}),registry);
  const publicUcl=load(path.join(output,'production-openligadb.json'));
  const publicCanonical=load(path.join(output,'production-canonical.json'));
  const pulseTable=load(path.join(output,'fresh-pulse-standings.json')).payload.tables[0].entries.map(row=>({participantId:`team:football:epl:${row.team.club.id}`,rank:row.position,
    played:row.overall.played,won:row.overall.won,drawn:row.overall.drawn,lost:row.overall.lost,ladderPoints:row.overall.points,pointsFor:row.overall.goalsFor,pointsAgainst:row.overall.goalsAgainst,pointsDifference:row.overall.goalsDifference}));
  const publicPl=load(path.join(output,'production-events.json'));
  const publicEvents=Array.isArray(publicPl.payload)?publicPl.payload:publicPl.payload.events;
  const report={schemaVersion:'football-data-comparison.v1',generatedAt:new Date().toISOString(),attribution:ATTRIBUTION,reviewedGitSnapshot:argument('--snapshot')||null,
    scope:'2026/27 EPL whole season and UCL league phase; delayed free plan; one observation window; no deployed source change',
    observations:Object.fromEntries(Object.entries(observations).map(([code,o])=>[code,{matchCheckedAt:o.matchCheckedAt,tableCheckedAt:o.tableCheckedAt,fixtures:o.facts.fixtures.length,clubs:o.table.length}])),
    PL:{freshSource:compareFixtures(pulse.payload.map(referencePulse),observations.PL.facts.fixtures),published:compareFixtures(publicEvents.filter(e=>e.competitionId==='competition:premier-league-2026-27').map(publishedFixture),observations.PL.facts.fixtures),
      freshTable:compareTables(pulseTable,observations.PL.table),publishedTable:compareTables(publicCanonical.payload.ladderSnapshots.find(s=>s.competitionId==='competition:premier-league-2026-27').entries,observations.PL.table)},
    CL:{freshSource:compareFixtures(freshUcl.fixtures.map(uclFixture),observations.CL.facts.fixtures),published:compareFixtures(publicUcl.payload.leagues.find(l=>l.competitionId==='competition:uefa-champions-league').fixtures.map(uclFixture),observations.CL.facts.fixtures),
      publishedTable:compareTables(publicUcl.payload.standings.filter(s=>s.competitionId==='competition:uefa-champions-league'),observations.CL.table,{compareRanks:false}),
      tableNote:'Compare the eight basic statistical fields only. Keep NS provisional ranks and complete UEFA tie-break requirements; no rank/qualification promotion from this API.'},
    limitations:['Agreement does not establish source independence or long-term uptime.','Only one observation window; scores and schedules may lag.','No live-score, Europa League, knockout, AU viewing or branding-rights coverage added.','Existing production sources, fixture IDs, freshness and Follow consent are unchanged.']};
  for(const code of ['PL','CL']){
    const checks=[report[code].freshSource,report[code].published];
    report[code].fixtureReconciliationPassed=checks.every(c=>c.matched===c.referenceCount&&c.referenceCount===c.candidateCount&&c.exactKickoffs===c.matched&&c.differences.length===0&&c.results.referenceOnly===0&&c.results.candidateOnly===0);
    const publishedPlEvents=publicEvents.filter(e=>e.competitionId==='competition:premier-league-2026-27');
    const publishedUclLeague=publicUcl.payload.leagues.find(l=>l.competitionId==='competition:uefa-champions-league');
    const fixtures=code==='PL'?publishedPlEvents.map(publishedFixture):publishedUclLeague.fixtures.map(uclFixture);
    // Public retrieval time is not source freshness. Retain the original checks.
    const lastGoodCheckedAt=code==='PL'?publishedPlEvents.map(e=>e.sourceCheckedAt).sort()[0]:publishedUclLeague.checkedAt;
    const lastGood={...observations[code].facts,fixtures,checkedAt:lastGoodCheckedAt};
    const recovery=await trialRecovery({loadPrimary:async()=>{throw new Error('Simulated outage');},loadBackup:async()=>observations[code].facts,lastGood});
    const known=new Map(fixtures.map(f=>[`${f.homeParticipantId}|${f.awayParticipantId}|${f.roundNumber}`,f.providerFixtureId]));
    const idsPreserved=recovery.snapshot.fixtures.every(f=>known.get(`${f.homeParticipantId}|${f.awayParticipantId}|${f.roundNumber}`)===f.providerFixtureId);
    report[code].simulatedOutage={mode:recovery.mode,fixtures:recovery.snapshot.fixtures.length,idsPreserved,lastGoodCheckedAt,backupCheckedAt:recovery.snapshot.checkedAt,passed:recovery.mode==='backup'&&idsPreserved};
  }
  fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({PL:report.PL,CL:report.CL}));return report;
}
module.exports={compareTables,main};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
