#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const adapter=require('./lib/a-league-schedule'),follow=require('../config/follow-first');
const root=path.resolve(__dirname,'..'),directory=require('../data/canonical/football-directory.v1.json'),snapshot=require('../data/football/fixtures/a-league-men.json');
const teams=directory.teams.filter(t=>t.leagueId===adapter.COMPETITION);
async function main(){
 assert.equal(teams.length,12);assert.equal(snapshot.events.filter(e=>e.stage==='Regular Season').length,156);
 assert.equal(new Set(snapshot.events.map(e=>e.id)).size,snapshot.events.length);
 const ids=new Set(teams.map(t=>t.id));for(const e of snapshot.events){assert(e.participantIds.every(id=>ids.has(id)));assert.equal(e.sourceType,'official');assert(Number.isFinite(Date.parse(e.startTimeUtc)));assert(e.officialMatchId);assert(follow.viewingOptions(e).some(o=>o.providerId==='paramount'));}
 const first=snapshot.events.find(e=>e.officialMatchId==='4e0451akfpt8wphhcwc1y47pw');assert(first);assert.equal(first.startTimeUtc,'2026-10-16T09:00:00.000Z');assert.equal(first.venue,'Allianz Stadium');assert.equal(first.roundLabel,'Matchweek 1');assert(follow.viewingOptions(first).some(o=>o.providerId==='ten-tv'&&!o.replayVerified),'TV listing is separate from verified replay/streaming');
 const broad=follow.migratePreferences({followedSports:['football'],selectedSelectorEntityIds:['sport:football']});assert.equal(follow.reasonForEvent(first,broad),null);
 const selected=follow.migratePreferences({preferenceGraph:{entityFollows:[{participantId:first.homeParticipantId,followLevel:'follow'}]}});assert.equal(follow.reasonForEvent(first,selected)?.entityKind,'team');
 const muted=structuredClone(selected);muted.preferenceGraph.entityFollows[0].followLevel='mute';assert.equal(follow.reasonForEvent(first,muted),null);
 const persisted={...selected,version:24,selectedSelectorEntityIds:['sport:football','competition:a-leagues'],preferenceGraph:{...selected.preferenceGraph,competitionPreferences:[{competitionId:adapter.COMPETITION,enabled:true}]}};
 const saved=require('../lib/supabase-server').normalizeUserState({preferences:persisted});assert(saved.preferences.selectedSelectorEntityIds.includes(adapter.COMPETITION));assert(saved.preferences.preferenceGraph.entityFollows.some(f=>f.participantId===first.homeParticipantId));
 const storageMap=new Map([['ns_preferences_v1',JSON.stringify(persisted)]]),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
 const profiles=require('../config/profile-storage'),profile=profiles.loadActiveProfile(storage);assert(profile.preferences.selectedSelectorEntityIds.includes(adapter.COMPETITION));assert(profile.preferences.preferenceGraph.entityFollows.some(f=>f.participantId===first.homeParticipantId));
 const loaded=profiles.loadActiveProfile(storage);assert.deepEqual(loaded.preferences.preferenceGraph.entityFollows,profile.preferences.preferenceGraph.entityFollows);
 const steps=require('./quick-results').projectionSteps(['A-League schedule']);assert(steps.some(s=>s[0]==='scripts/build-code-inspector.js'&&s.includes('--codes=football')),'incremental refresh rebuilds the existing Football schedule');assert(!steps.some(s=>s[0]==='scripts/publish-feed.js'),'schedule updates do not replace the global feed');
 assert.throws(()=>require('./update-cards').parseOptions(['--a-league','--quick']),/cannot be combined/);
 const resolved=require('../lib/follow-fixture-resolver').resolveUserFollowFixtures({events:[],userState:{preferences:selected},includeCompactArtifact:false});assert(resolved.events.some(e=>e.id===first.id),'server resolves followed A-League club without a global feed seed');
 const officialTeam=id=>{const t=teams.find(t=>t.id===id);return{id:t.externalIds.aleagues,officialName:t.displayName,name:t.displayName};};
 const matches=snapshot.events.map(e=>({id:e.officialMatchId,competition:{id:'xwnjb1az11zffwty3m6vn8y6'},tournament:{id:'1ztoqmkrzy1d4ejf5jokthiqc'},stage:{name:e.stage},homeTeam:officialTeam(e.homeParticipantId),awayTeam:officialTeam(e.awayParticipantId),startDate:Date.parse(e.startTimeUtc),week:String(e.roundNumber),matchStatus:'Fixture',venue:{longName:e.venue},isCh10:e.viewingOptions.some(o=>o.providerId==='ten-tv'),is10Play:e.viewingOptions.some(o=>o.providerId==='ten')}));
 const options={matches,teams,previous:snapshot,checkedAt:snapshot.checkedAt};
 assert.throws(()=>adapter.build({...options,matches:matches.slice(1)}),/156/);
 assert.throws(()=>adapter.build({...options,matches:[...matches,matches[0]]}),/156|Duplicate/);
 const bad=structuredClone(matches);bad[0].homeTeam.id='unrecognised';bad[0].homeTeam.officialName='Unknown';bad[0].homeTeam.name='Unknown';assert.throws(()=>adapter.build({...options,matches:bad}),/incomplete|Unknown/);
 const moved=structuredClone(matches);moved[0].startDate+=86400000;const revised=adapter.build({...options,matches:moved}).document.events.find(e=>e.officialMatchId===first.officialMatchId);assert.equal(revised.id,first.id);assert.equal(revised.canonicalEventId,first.canonicalEventId);assert.notEqual(revised.startTimeUtc,first.startTimeUtc);
 const finished=structuredClone(matches);finished[0].matchStatus='Played';finished[0].liveData={matchDetails:{scores:{total:{home:2,away:1}}}};const final=adapter.build({...options,matches:finished}).document.events.find(e=>e.id===first.id);assert.equal(final.status,'completed');assert.equal(final.homeScore,2);assert(!follow.viewingOptions(final).some(o=>o.replayVerified));
 const cancelled=structuredClone(matches);cancelled[0].matchStatus='Postponed';assert.equal(adapter.build({...options,matches:cancelled}).document.events.find(e=>e.id===first.id).status,'postponed');
 const noTv=structuredClone(matches);noTv[0].isCh10=false;assert.deepEqual(follow.viewingOptions(adapter.build({...options,matches:noTv}).document.events.find(e=>e.id===first.id)).map(o=>o.providerId),['paramount']);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-a-league-'));
 try{
  const files=['data/canonical/football-directory.v1.json','data/canonical/football-directory.v1.js','data/canonical/football-follow-index.v1.json','data/canonical/football-follow-index.v1.js','data/football/fixtures/a-league-men.json','data/football/fixtures/a-league-men.js','config/card-identities.js'];
  for(const f of files){fs.mkdirSync(path.dirname(path.join(temp,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(temp,f));}
  const bytes=files.map(f=>fs.readFileSync(path.join(temp,f)));
  const failed=await adapter.refresh({root:temp,force:true,fetchImpl:async()=>({ok:false,status:503})});assert.equal(failed.state,'deferred-retained');files.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(temp,f)),bytes[i]));
  const incomplete=await adapter.refresh({root:temp,force:true,fetchImpl:async()=>({ok:true,json:async()=>matches.slice(1)})});assert.equal(incomplete.state,'deferred-retained');files.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(temp,f)),bytes[i]));
  const current=await adapter.refresh({root:temp,now:new Date(snapshot.checkedAt),fetchImpl:async()=>{throw Error('Unexpected source request');}});assert.equal(current.requests,0);
  const refreshed=await adapter.refresh({root:temp,force:true,fetchImpl:async()=>({ok:true,json:async()=>moved})});assert.equal(refreshed.changed,true);assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'data/football/fixtures/a-league-men.json'))).events.find(e=>e.id===first.id).startTimeUtc,revised.startTimeUtc);
  const unchanged=await adapter.refresh({root:temp,force:true,fetchImpl:async()=>({ok:true,json:async()=>moved})});assert.equal(unchanged.changed,false);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log('A-League: complete official schedule, stable reschedules, source failure retention, results, Follow admission and fixture-specific TV passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
