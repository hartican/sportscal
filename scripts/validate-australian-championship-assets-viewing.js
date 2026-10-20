#!/usr/bin/env node
'use strict';
// Offline source-candidate checks. Generated directories and shell registrations
// remain the canonical release owner's responsibility.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const {createRequire}=require('node:module');
const adapter=require('./lib/australian-championship');
const marks=require('../data/football/australian-championship-marks.v1.json');
const retained=require('../data/football/fixtures/australian-championship.json');
const directory=require('../data/canonical/football-directory.v1.json');
const audit=require('../data/coverage/australian-viewing-rights.v1.json');
const {footballIdentitySource}=require('./lib/football-identity-source');
const {reviewedAuViewing:review}=require('../lib/reviewed-au-viewing');
const follow=require('../config/follow-first');
const projected=adapter.project(adapter.loadCapture());
assert.deepEqual(projected.document.events,retained.events,'Crests and viewing preparation must not change any sporting field or source clock');
assert.deepEqual(projected.document.standings,retained.standings,'Published groups and results remain exact');
assert.equal(marks.competitionId,adapter.COMPETITION);
assert.equal(marks.clubs.length,16);
assert.equal(new Set(marks.clubs.map(mark=>mark.participantId)).size,16);
assert.deepEqual(marks.clubs.map(mark=>mark.participantId).sort(),projected.clubs.map(club=>club.id).sort());
let assetBytes=0;
for(const mark of marks.clubs){
 const club=projected.clubs.find(club=>club.id===mark.participantId),bytes=fs.readFileSync(mark.assetPath);
 assetBytes+=bytes.length;
 assert.equal(mark.sourceUrl,'https://australianchampionship.com.au/');
 assert.equal(new URL(mark.assetUrl).hostname,'australianchampionship.com.au');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),mark.sha256,'Reviewed artwork bytes must not be replaced silently');
 assert.equal(mark.mimeType==='image/png'?bytes.subarray(0,8).toString('hex'):'',mark.mimeType==='image/png'?'89504e470d0a1a0a':'');
 assert(['image/png','image/jpeg'].includes(mark.mimeType));
 if(mark.mimeType==='image/jpeg'){assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');assert(mark.assetPath.endsWith('.jpg'));}
 assert.equal(club.crestUrl,mark.assetPath);assert.equal(club.crestSourceUrl,mark.sourceUrl);
 assert.equal(club.crestProvenance.verifiedAt,marks.checkedAt);
 assert.equal(club.playerCoverage,'unavailable');
 const old=directory.teams.find(team=>team.id===club.id);
 const sporting=({crestUrl,crestSourceUrl,crestStatus,crestProvenance,...rest})=>rest;
 assert.deepEqual(sporting(club),sporting(old),'Adding a crest cannot change retained participant facts');
}
// Exercise the existing registration generator without writing its runtime output.
const candidateTeams=[...directory.teams.filter(team=>team.leagueId!==adapter.COMPETITION),...projected.clubs];
const identitySource=fs.readFileSync(require.resolve('../config/card-identities'),'utf8').replace(/\/\* football-club-identities:start \*\/[\s\S]*?\/\* football-club-identities:end \*\//,()=>footballIdentitySource(candidateTeams.filter(team=>team.crestUrl)));
const sandbox={module:{exports:{}},require:createRequire(require.resolve('../config/card-identities'))};
vm.runInNewContext(identitySource,sandbox,{filename:'candidate-card-identities.js'});
const identities=sandbox.module.exports;
for(const club of projected.clubs){
 const resolved=identities.participantMarksForEvent({key:'football',participantIds:[club.id]},projected.clubs,club.displayName);
 assert.equal(resolved.length,1);assert.equal(resolved[0].participant.id,club.id);
 for(const useDark of [false,true])assert.equal(identities.logoForTheme(resolved[0].mark,{useDark}),club.crestUrl);
 assert.equal(resolved[0].mark.logo.backgroundLight,'light');assert.equal(resolved[0].mark.logo.backgroundDark,'light');
 assert.equal(resolved[0].mark.fit,'contain');
}
for(const event of retained.events){
 const sides=identities.matchupSidesForEvent(event,projected.clubs,event.name);
 assert.equal(sides.length,2);
 sides.forEach((side,index)=>{assert.equal(side.participant.id,event.participantIds[index]);assert.equal(side.mark.url,projected.clubs.find(club=>club.id===event.participantIds[index]).crestUrl);});
}
assert.equal(identities.participantMarksForEvent({key:'football',participantIds:['team:football:unknown']},[{id:'team:football:unknown',displayName:'Unpublished club'}],'Unpublished club').length,0,'An unknown club cannot borrow a crest');
const rules=audit.reviewedWindows.filter(rule=>rule.competitionIds?.includes(adapter.COMPETITION));
assert.equal(rules.length,48);assert.equal(new Set(rules.flatMap(rule=>rule.fixtureIds)).size,48);
const counts={SBS:0,SBS2:0,onDemandOnly:0,fixtureLinks:0,eventLinks:0};
const withoutViewing=({viewingOptions,broadcastOptions,broadcaster,broadcasterIds,...rest})=>rest;
for(const event of retained.events){
 const rule=rules.find(rule=>rule.fixtureIds.includes(event.id));assert(rule);
 assert.equal(rule.rightsScope,'fixture');assert.equal(rule.fixtureIds.length,1);assert.equal(rule.providers.length,1);
 assert.equal(Date.parse(rule.startTimeUtc),Date.parse(event.startTimeUtc));
 const viewed=review(event),options=follow.viewingOptions(viewed);assert.equal(options.length,1,event.id);
 const option=options[0];assert.equal(option.providerId,'sbs');assert.equal(option.territory,'AU');assert.equal(option.accessType,'free');
 assert.equal(option.rightsScope,'fixture');assert.equal(option.replayVerified,false,'Published links do not certify replay playback');
 assert.equal(option.webUrl,rule.providers[0].url);assert.equal(option.verifiedAt,rule.verifiedAt);
 assert.equal(new URL(option.webUrl).hostname,'www.sbs.com.au');
 if(option.linkScope==='fixture'){counts.fixtureLinks++;assert.match(option.webUrl,/\/australian-championship-2026-s2026-ep[1-8]\/\d+$/);assert.equal(event.roundNumber,1);assert.equal(option.sourceUrl,'https://www.sbs.com.au/ondemand/sports-series/australian-championship-2026/season-2026');}
 else{counts.eventLinks++;assert.equal(option.linkScope,'event');assert.equal(option.webUrl,'https://www.sbs.com.au/ondemand/sports-series/australian-championship-2026/season-2026');assert.equal(option.permalinkVerifiedAt,null);}
 counts[option.channelBrand||'onDemandOnly']++;
 assert.deepEqual(withoutViewing(viewed),withoutViewing(event));assert.deepEqual(review(viewed),viewed);
 const equivalent={...event,startTimeUtc:new Date(event.startTimeUtc).toISOString()};assert.equal(follow.viewingOptions(review(equivalent)).length,1,'Equivalent UTC serializations retain the same evidence');
 assert.equal(follow.viewingOptions({...viewed,startTimeUtc:new Date(Date.parse(event.startTimeUtc)+3600000).toISOString()}).length,0,'A cached reviewed listing cannot survive a same-day reschedule without rerunning the projector');
 assert.equal(follow.viewingOptions({...viewed,startTimeUtc:null}).length,0,'A cached exact-start listing cannot fall back to a date-only clock');
 assert.equal(follow.viewingOptions({...viewed,startTimeUtc:new Date(event.startTimeUtc).toISOString()}).length,1,'A cached exact-start listing accepts equivalent UTC serialization');
 assert.equal(Date.parse(viewed.viewingOptions[0].coverageWindow[12]),Date.parse(event.startTimeUtc));
 for(const bad of [null,'invalid',123]){
  const invalidWindow=structuredClone(viewed);invalidWindow.viewingOptions[0].coverageWindow[12]=bad;
  assert.equal(follow.viewingOptions(invalidWindow).length,0,'Malformed appended exact-start constraints cannot authorize a cached option');
 }
 const invalid=[
  {competitionId:'competition:australian-championship-reserves'},
  {id:'unknown',eventId:'unknown',canonicalEventId:'unknown'},
  {startTimeUtc:new Date(Date.parse(event.startTimeUtc)+3600000).toISOString()},
  {startTimeUtc:'2027-10-20T00:00:00Z',date:'2027-10-20'},
  {startTimeUtc:null}, {participantIds:['team:football:unknown',event.participantIds[1]]},
  {roundLabel:'Grand Final',roundNumber:9},
 ];
 for(const change of invalid)assert.equal(follow.viewingOptions(review({...viewed,...change})).length,0,'Rescheduled or mismatched fixtures must lose this reviewed evidence');
}
assert.deepEqual(counts,{SBS:6,SBS2:6,onDemandOnly:36,fixtureLinks:8,eventLinks:40});
console.log(JSON.stringify({passed:true,clubs:16,assetBytes,fixtures:48,counts,networkRequests:0,registration:'in-memory canonical helper; no runtime/generated writes',limits:'No production, authenticated playback or physical-device proof'}));
module.exports={projected,identities,identitySource};
