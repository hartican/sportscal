'use strict';
const assert=require('node:assert/strict');
const reviewed=require('../../data/canonical/epl-kickoff-certainty.v1.json');
const COMPETITION='competition:premier-league-2026-27',SEASON='2026/27';
const provisionalNote='Provisional scheduled kickoff; subject to broadcast and competition amendments.';
function validInstant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function validate(review){
 assert(review?.schemaVersion==='epl-kickoff-certainty.v1'&&review.competitionId===COMPETITION&&review.season===SEASON,'EPL timing review scope is invalid');
 assert(validInstant(review.observedAt)&&Date.parse(review.observedAt)<=Date.now(),'EPL timing review requires a real non-future observation');
 assert(Array.isArray(review.reviewedMatchweeks)&&review.reviewedMatchweeks.length>0&&new Set(review.reviewedMatchweeks).size===review.reviewedMatchweeks.length&&review.reviewedMatchweeks.every(w=>Number.isInteger(w)&&w>=1&&w<=38),'EPL timing review matchweeks are invalid');
 assert(Array.isArray(review.fixtures),'EPL timing review fixtures are missing');
 const ids=new Set(),pairs=new Set(),counts=new Map(),index=new Map();
 for(const row of review.fixtures){
  assert(Number.isSafeInteger(row.sourceFixtureId)&&row.sourceFixtureId>0&&!ids.has(row.sourceFixtureId),'EPL timing review has an invalid/duplicate source identity');
  assert(review.reviewedMatchweeks.includes(row.roundNumber),'EPL timing review fixture is outside the reviewed matchweeks');
  assert(Array.isArray(row.participantIds)&&row.participantIds.length===2&&row.participantIds.every(p=>/^team:football:epl:[1-9]\d*$/.test(p))&&new Set(row.participantIds).size===2,'EPL timing review requires two distinct reviewed clubs');
  const pair=row.participantIds.join(':');assert(!pairs.has(pair),'EPL timing review has a duplicate pairing');
  assert(validInstant(row.startTimeUtc),'EPL timing review kickoff is invalid');
  const url=new URL(row.sourceUrl);assert(url.protocol==='https:'&&url.hostname==='www.premierleague.com'&&!url.username&&!url.password&&/^\/en\/news\/\d+/.test(url.pathname),'EPL timing review requires an official notice');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(row.sourcePublishedAt)&&new Date(row.sourcePublishedAt+'T00:00:00Z').toISOString().slice(0,10)===row.sourcePublishedAt&&Date.parse(row.sourcePublishedAt)<=Date.parse(review.observedAt),'EPL timing review publication date is invalid');
  ids.add(row.sourceFixtureId);pairs.add(pair);counts.set(row.roundNumber,(counts.get(row.roundNumber)||0)+1);index.set(String(row.sourceFixtureId),row);
 }
 assert(review.reviewedMatchweeks.every(w=>counts.get(w)===10),'EPL timing review must reconcile each declared ten-match window');
 return index;
}
const index=validate(reviewed);
function qualify(event,{review=reviewed}={}){
 if(event.competitionId!==COMPETITION||event.season!==SEASON||!['upcoming','scheduled','completed'].includes(event.status))return event;
 const lookup=review===reviewed?index:validate(review);
 const id=String(event.canonicalSourceId||String(event.canonicalEventId||event.id||'').match(/^(?:event:premier-league:|epl-2026-27-)([1-9]\d*)$/)?.[1]||'');
 const row=lookup.get(id),participants=event.participantIds;
 const usable=validInstant(event.startTimeUtc)&&event.timeTbc!==true&&event.startTimeTbc!==true;
 const confirmed=usable&&(event.status==='completed'||!!(row&&event.roundNumber===row.roundNumber&&event.startTimeUtc===row.startTimeUtc&&Array.isArray(participants)&&participants.length===2&&participants.every((p,i)=>p===row.participantIds[i])));
 const next={...event,scheduleStatus:confirmed?'confirmed':'provisional',timePrecision:confirmed?'exact':'estimated'};
 if(!confirmed)next.scheduleNote=provisionalNote;
 else if(next.scheduleNote===provisionalNote)delete next.scheduleNote;
 if(row&&confirmed&&event.status!=='completed')next.timingProvenance={sourceName:'Premier League fixture amendment notice',sourceUrl:row.sourceUrl,checkedAt:review.observedAt,precision:'exact',sourcePublishedAt:row.sourcePublishedAt};
 else if(next.timingProvenance?.sourceName==='Premier League fixture amendment notice')delete next.timingProvenance;
 if(/^Premier League Matchweek \d+ fixture, with the confirmed kick-off sourced from the official schedule\.$/.test(next.selectedSentence||''))next.selectedSentence=`Premier League Matchweek ${event.roundNumber} fixture, with ${confirmed?'the scheduled kickoff sourced from the league':'a provisional kickoff subject to broadcast and competition amendments'}.`;
 return next;
}
function applyRetained({root=require('node:path').resolve(__dirname,'../..')}={}){
 const fs=require('node:fs'),path=require('node:path'),reports=[];
 for(const relative of ['feeds/incoming/events.json','data/events.json']){
  const file=path.join(root,relative),document=JSON.parse(fs.readFileSync(file,'utf8'));let changed=0;
  document.events=document.events.map(event=>{const next=qualify(event);if(JSON.stringify(next)!==JSON.stringify(event))changed++;return next;});
  if(changed)fs.writeFileSync(file,JSON.stringify(document,null,2)+'\n');reports.push({file:relative,changed});
 }
 return reports;
}
module.exports={qualify,validate,applyRetained,provisionalNote};
