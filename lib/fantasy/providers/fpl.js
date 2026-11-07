'use strict';
const crypto=require('node:crypto');
const crosswalk=require('../../../data/canonical/fantasy-provider-crosswalks.v1.json');
const fantasy=require('../../../config/fantasy-deadlines');
const BOOTSTRAP='https://fantasy.premierleague.com/api/bootstrap-static/',FIXTURES='https://fantasy.premierleague.com/api/fixtures/';
function normalize({bootstrap,fixtures,events,previous=[],mapping=crosswalk}){
  if(!Array.isArray(bootstrap?.events)||!Array.isArray(bootstrap?.teams)||!Array.isArray(fixtures)||!fixtures.length)throw Error('Invalid FPL response');
  if(new Set(bootstrap.events.map(r=>r.id)).size!==bootstrap.events.length||new Set(fixtures.map(f=>f.id)).size!==fixtures.length)throw Error('Conflicting FPL identifiers');
  for(const [id,team] of Object.entries(mapping.teams))if(bootstrap.teams.find(t=>String(t.id)===id)?.name!==team.providerName)throw Error('FPL season/team crosswalk changed');
  const year=Number(mapping.seasonId.slice(0,4));if(!bootstrap.events.every(r=>Number.isFinite(Date.parse(r.deadline_time))&&new Date(r.deadline_time).getUTCFullYear()>=year&&new Date(r.deadline_time).getUTCFullYear()<=year+1))throw Error('Invalid FPL season/deadline');
  const rounds=new Map(bootstrap.events.map(r=>[r.id,r]));
  const providerHash=crypto.createHash('sha256').update(JSON.stringify([bootstrap.events.map(r=>[r.id,r.deadline_time]),fixtures.map(f=>[f.id,f.event,f.team_h,f.team_a,f.kickoff_time])])).digest('hex');
  const counts={mapped:0,unmatched:0,ambiguous:0,withdrawn:0};
  const output=[];const byAlias=new Map(previous.flatMap(e=>[e.id,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean).map(id=>[id,e])));
  const seen=new Set();
  for(const event of events){
    if(event.competitionId!==`${mapping.competitionId}-${mapping.seasonId}`)continue;
    const id=String(event.canonicalEventId||event.eventId||event.id);if(seen.has(id))continue;seen.add(id);
    const prior=[id,event.id,...(event.sourceEventIds||[])].map(id=>byAlias.get(id)).find(Boolean);
    const pinned=prior?.fantasyDeadlines?.find(r=>r.gameId==='fpl-classic')?.providerFixtureId||mapping.fixtures[id];
    const identity=f=>mapping.teams[String(f.team_h)]?.participantId===event.homeParticipantId&&mapping.teams[String(f.team_a)]?.participantId===event.awayParticipantId;
    const candidates=fixtures.filter(f=>identity(f)&&(pinned?String(f.id)===String(pinned):Date.parse(f.kickoff_time)===Date.parse(event.startTimeUtc)));
    const fixture=candidates.length===1?candidates[0]:null,round=fixture&&rounds.get(fixture.event);
    let record={schemaVersion:fantasy.SCHEMA_VERSION,providerId:'premier-league',gameId:'fpl-classic',sourceId:'live-fantasy-fpl',competitionId:event.competitionId,seasonId:mapping.seasonId,...(pinned?{providerFixtureId:String(pinned)}:{}),mappingStatus:'withdrawn'};
    if(fixture&&round&&identity(fixture)&&Number.isFinite(Date.parse(event.startTimeUtc))&&Date.parse(fixture.kickoff_time)===Date.parse(event.startTimeUtc)){
      record={...record,mappingStatus:'verified',providerFixtureId:String(fixture.id),fantasyRoundId:`fpl-classic:${mapping.seasonId}:${round.id}`,roundLabel:round.name,deadlineAt:new Date(round.deadline_time).toISOString(),lockoutType:'whole-team',action:'initial-team-submission',fixtureStartAt:event.startTimeUtc,homeParticipantId:event.homeParticipantId,awayParticipantId:event.awayParticipantId,mappingMethod:pinned?'verified-provider-fixture':'exact-competition-season-teams-kickoff',sourceUrl:BOOTSTRAP,fixtureSourceUrl:FIXTURES,adapterVersion:'fpl.v1',providerHash};counts.mapped++;
    }else{counts[candidates.length>1?'ambiguous':'unmatched']++;if(prior)counts.withdrawn++;}
    output.push({id,canonicalEventId:id,sourceEventIds:[...new Set([event.id,event.eventId,...(event.sourceEventIds||[])].filter(Boolean))],enrichmentOnly:true,fantasyOnly:true,fantasyDeadlines:[record]});
  }
  for(const prior of previous)if(!seen.has(prior.id))output.push({...prior,fantasyDeadlines:(prior.fantasyDeadlines||[]).map(r=>({...r,mappingStatus:'withdrawn'}))});
  if(!output.length)throw Error('No canonical FPL mapping candidates');
  output.coverage={schemaVersion:'fantasy-coverage.v1',...counts,status:'verified',gameId:'fpl-classic',seasonId:mapping.seasonId};return output;
}
function source({fetchImpl=globalThis.fetch,events,environment=process.env}){
  // Evaluation is explicit operator authorisation, not provider licence approval.
  if(!require('../access').access(environment).enabled)return null;
  return {id:'live-fantasy-fpl',timeoutMs:20000,refreshInterval:fantasy.interval,fetch:async({previous,signal})=>{
    const read=async url=>{const response=await fetchImpl(url,{signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('FPL source unavailable');const text=await response.text();if(text.length>5_000_000)throw Error('FPL response too large');return JSON.parse(text);};
    const [bootstrap,fixtures]=await Promise.all([read(BOOTSTRAP),read(FIXTURES)]);return normalize({bootstrap,fixtures,events:typeof events==='function'?await events():events,previous});
  }};
}
module.exports={normalize,source,BOOTSTRAP,FIXTURES};
