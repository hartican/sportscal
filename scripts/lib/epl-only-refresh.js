'use strict';
// The existing quick owner supplies projection and whole-candidate rollback.
// This scope has only the four official EPL pages and the official EPL table.
const fs=require('node:fs'),path=require('node:path');
const primary=require('../refresh-premier-league-cards'),table=require('../refresh-premier-league-context');
const identities=require('../../lib/epl-provider-identities');
const {patchKnown}=require('./known-fixture-patch');
const ROOT=path.resolve(__dirname,'../..'),COMPETITION=table.COMPETITION_ID;
const FEEDS=['feeds/incoming/events.json','data/events.json'],BUNDLE='data/canonical/afl-nrl-2026.json';
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(ROOT,file),JSON.stringify(value,null,2)+'\n');
function observation(value){
 const time=Date.parse(value);
 if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(time))throw Error('EPL source observation clock is invalid');
 const offset=value.match(/([+-])(\d{2}):(\d{2})$/),shift=offset?(offset[1]==='+'?1:-1)*(Number(offset[2])*60+Number(offset[3]))*60000:0;
 if(new Date(time+shift).toISOString().slice(0,19)!==value.slice(0,19))throw Error('EPL source observation clock has an invalid calendar date');
 return time;
}
function supportedDelayedFinal(old,overlay,checkedAt){
 if(old.delayedResultSource?.provider!=='Football-Data.org')return false;
 const aliases=new Set(identities.aliasesForId(identities.binding(old).record.primaryId));
 const rows=(overlay.results||[]).filter(row=>aliases.has(row.fixtureId));
 if(rows.length!==1)return false;
 const row=rows[0],start=Date.parse(old.startTimeUtc),limit=Date.parse(checkedAt);
 return row.competitionId===old.competitionId&&row.homeParticipantId===old.homeParticipantId&&row.awayParticipantId===old.awayParticipantId&&row.roundNumber===old.roundNumber
  &&[row.homeScore,row.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0)&&row.homeScore===old.homeScore&&row.awayScore===old.awayScore
  &&row.sourceUrl==='https://www.football-data.org/'&&old.delayedResultSource.sourceUrl===row.sourceUrl
  &&['sourceCheckedAt','sourceUpdatedAt'].every(key=>typeof row[key]==='string'&&Number.isFinite(Date.parse(row[key]))&&Date.parse(row[key])>=start&&Date.parse(row[key])<=limit)
  &&old.delayedResultSource.checkedAt===row.sourceCheckedAt&&old.delayedResultSource.updatedAt===row.sourceUpdatedAt;
}
function validateCandidate(surfaces,{fixtures,cards,checkedAt,overlay,deferredFixtures}){
 const oldById=new Map();
 for(const {document}of surfaces)for(const event of document.events.filter(e=>e.competitionId===COMPETITION)){
  const id=identities.binding(event).record.primaryId;if(!oldById.has(id))oldById.set(id,[]);oldById.get(id).push(event);
 }
 for(const fixture of fixtures){
  const playing=fixture.status==='L',final=fixture.status==='C',start=fixture.kickoff?.millis,at=Date.parse(checkedAt);
  // Display or incomplete score fields must not conceal a separately evaluable
  // future-final/playing claim or reopening of an accepted final.
  if(Number.isFinite(start)&&Number.isFinite(new Date(start).getTime())&&(final?start>=at:playing&&start>at))throw Error('EPL playing/final fixture has a future kickoff relative to its source observation');
  if(fixture.status==='U'||playing)for(const old of oldById.get('epl-2026-27-'+fixture.id)||[])if(old.status==='completed'&&!supportedDelayedFinal(old,overlay,checkedAt))throw Error('EPL primary result continuity failed: source reopens a retained final');
 }
 identities.validatePrimaryCollection(cards);
 for(const card of cards)if(card.status==='completed'?Date.parse(card.startTimeUtc)>=Date.parse(checkedAt):['live','break'].includes(card.status)&&Date.parse(card.startTimeUtc)>Date.parse(checkedAt))throw Error('EPL playing/final fixture has a future kickoff relative to its source observation');
 const byId=new Map(cards.map(e=>[identities.binding(e).record.primaryId,e])),deferred=new Set(deferredFixtures.map(row=>row.primaryId));
 for(const [id,previous]of oldById){if(deferred.has(id))continue;const next=byId.get(id);for(const old of previous)if(!next||old.status==='completed'&&next.status!=='completed'||JSON.stringify(old.participantIds)!==JSON.stringify(next.participantIds))throw Error('EPL primary identity/result continuity failed');}
}
async function refresh({now=new Date()}={}){
 if(!Number.isFinite(+now)||+now>Date.now())throw Error('EPL collection clock is invalid or future');
 const surfaces=FEEDS.map(file=>({file,document:read(file)})),bundle=read(BUNDLE),priorTable=table.validatePublishedContext(bundle);
 for(const {document}of surfaces)identities.validatePrimaryCollection(document.events.filter(e=>e.competitionId===COMPETITION));
 const priorClocks=[priorTable.snapshotTimeUtc,priorTable.source?.checkedAt];
 for(const {document}of surfaces)for(const event of document.events.filter(e=>e.competitionId===COMPETITION))for(const key of['sourceCheckedAt','canonicalSourceCheckedAt','scoreCheckedAt','resultSourceCheckedAt','statusCheckedAt'])if(event[key]!=null&&event[key]!=='')priorClocks.push(event[key]);
 if(priorClocks.some(value=>observation(value)>+now))throw Error('EPL collection clock is stale relative to retained observations');
 const observations={fixtures:[],table:[]};
 function record(kind){return receipt=>{
  if(observation(receipt.observedAt)<+now||observation(receipt.observedAt)>Date.now())throw Error('EPL source observation clock is stale or future');
  observations[kind].push(receipt);
 };}
 const failures=[],changes=[];let cards,context,fixtureError,tableError,cardReport={deferredFixtures:[],retainedOverlayFixtureIds:[]};
 const backup={networkRequestsAllowed:0,coordinatorInvocationCap:4,minimumStartIntervalMs:6500,maxResourceMs:15000,maxResourceBytes:2000000,state:'primary-only-window',retainedOverlayFixtureIds:[]};
 try{
  cards=await primary.loadCards(surfaces[0].document.events.filter(e=>e.competitionId===COMPETITION),{
   loader:()=>primary.loadFixtures({allowFixtureDeferrals:true,fetcher:url=>primary.fetchJson(url,{onObservation:record('fixtures')})}),
   checkedAt:()=>observations.fixtures.at(-1).observedAt,allowFixtureDeferrals:true,
   backupOptions:{now,coordinator:async()=>{throw Error('EPL backup network deferred: this scope permits five primary GETs only.');}},
   validateCandidate:candidate=>validateCandidate(surfaces,candidate),
   onReport:report=>{cardReport=report;backup.retainedOverlayFixtureIds=report.retainedOverlayFixtureIds||[];if(report.backup){backup.state='deferred-unallocated';backup.recovery=report.backup;}},
  });
 }catch(error){fixtureError=error;cards=null;failures.push('EPL fixtures: '+require('./refresh-report').sanitise(error.message));}
 try{
  const payload=await table.fetchJson(table.STANDINGS_URL,{onObservation:record('table')});
  context=table.buildSnapshot(payload,read('data/canonical/football-directory.v1.json'),observations.table.at(-1).observedAt);
  const previous=new Map(priorTable.entries.map(row=>[row.participantId,row]));
  if(context.snapshot.entries.some(row=>!previous.has(row.participantId)||row.played<previous.get(row.participantId).played))throw Error('EPL table would regress retained club identities or completed match counts; review required');
 }catch(error){context=null;tableError=error;failures.push('EPL table: '+require('./refresh-report').sanitise(error.message));}
 const checkedAt=[...observations.fixtures,...observations.table].map(r=>r.observedAt).sort().at(-1)||now.toISOString();
 if(cardReport.deferredFixtures?.length){backup.state='deferred-unallocated';backup.deferredPrimaryFixtureIds=cardReport.deferredFixtures.map(row=>row.fixtureId);}
 for(const deferred of cardReport.deferredFixtures||[])failures.push('EPL fixture '+deferred.fixtureId+': '+deferred.reason);
 const report={mode:'quick',source:'epl',checkedAt,changed:changes,failures,deferredFixtures:cardReport.deferredFixtures||[],backup,resources:{fixtures:{state:cards?(cardReport.acceptedPrimaryFixtures===0?'retained-last-good':cardReport.deferredFixtures?.length?'partial-primary':backup.retainedOverlayFixtureIds.length?'primary-with-retained-delayed-overlay':'primary'):'retained-last-good',acceptedPrimaryFixtures:cards?cardReport.acceptedPrimaryFixtures:0,deferredFixtureCount:cardReport.deferredFixtures?.length||0,expectedResources:4,observations:observations.fixtures},table:{state:context?'primary':'retained-last-good',expectedResources:1,observations:observations.table}},publicationState:failures.length?'partial-candidate':'candidate',aiCalls:0};
 if((!cards||cardReport.acceptedPrimaryFixtures===0)&&!context){fixtureError ||= Error('No supported EPL fixture facts or official table observation; last-good facts retained.');try{fixtureError.eplReport={...report,publicationState:'blocked-retained'};}catch{}throw fixtureError;}
 let count=0;const deferredViewing=new Set(),updatedIds=new Set();report.updatedFixtureIdsBySurface=Object.fromEntries(FEEDS.map(file=>[file,[]]));
 if(cards)for(const {file,document}of surfaces){
  const byId=new Map(cards.map(card=>[identities.binding(card).record.primaryId,card]));
  const updates=document.events.filter(event=>event.competitionId===COMPETITION).map(old=>{
   const id=identities.binding(old).record.primaryId;if(report.deferredFixtures.some(row=>row.primaryId===id))return old;
   const fresh=byId.get(id);
   // A saved delayed overlay cannot overwrite an already accepted final on
   // either surface while the primary has not confirmed completion.
   if(old.status==='completed'&&fresh.delayedResultSource){report.backup.primaryConfirmationPendingFixtureIds ||= [];if(!report.backup.primaryConfirmationPendingFixtureIds.includes(old.id))report.backup.primaryConfirmationPendingFixtureIds.push(old.id);return old;}
   const update={...fresh,id:old.id||old.eventId};
   // This source contains scores/schedules, not a new broadcaster review.
   delete update.viewingOptions;
   if(Array.isArray(old.viewingOptions)){
    const same=old.competitionId===fresh.competitionId&&old.season===fresh.season&&old.startTimeUtc===fresh.startTimeUtc&&JSON.stringify(old.participantIds)===JSON.stringify(fresh.participantIds);
    update.viewingOptions=same?old.viewingOptions:old.viewingOptions.filter(option=>option.rightsScope!=='fixture');
    if(update.viewingOptions.length!==old.viewingOptions.length)deferredViewing.add(old.id||old.eventId);
   }
   return update;
  });
  const patched=patchKnown(document.events,updates);if(patched.count){for(let i=0;i<patched.events.length;i++)if(patched.events[i]!==document.events[i]){const id=patched.events[i].id;updatedIds.add(id);report.updatedFixtureIdsBySurface[file].push(id);}write(file,{...document,events:patched.events});count+=patched.count;}
 }
 report.updatedFixtureIds=[...updatedIds];
 report.deferredViewingFixtureIds=[...deferredViewing];
 if(count)changes.push('Premier League '+count);
 if(context){
  if(fixtureError||report.deferredFixtures.length)context.snapshot.metadata={...context.snapshot.metadata,fixtureResultsStale:true,tableNote:[context.snapshot.metadata.tableNote,'Official table checked. Unrefreshed fixture results retain their previous observations.'].filter(Boolean).join(' ')};
  const next=table.updateBundle(bundle,context,checkedAt);table.validatePublishedContext(next);
  if(JSON.stringify(next)!==JSON.stringify(bundle)){write(BUNDLE,next);changes.push('EPL standings source check');}
 }else{
  const prior=table.validatePublishedContext(bundle);
  const retained={...prior,stale:true,metadata:{...prior.metadata,tableNote:'Last verified Premier League table. The latest table check failed; positions may be out of date.'}};
  const next={...bundle,ladderSnapshots:bundle.ladderSnapshots.map(row=>row===prior?retained:row)};
  if(JSON.stringify(next)!==JSON.stringify(bundle)){write(BUNDLE,next);changes.push('EPL standings availability');}
 }
 return report;
}
function retainedRebuild({now=new Date(),updatedFixtureIdsBySurface}={}){
 if(!Number.isFinite(+now)||+now>Date.now())throw Error('EPL rebuild clock is invalid');
 require('./epl-publication-scope').argument(updatedFixtureIdsBySurface);
 const clubs=new Set();
 for(const file of FEEDS){
  const document=read(file),events=identities.validatePrimaryCollection(document.events),rounds=new Map();
  const ids=new Set(events.map(event=>event.id));
  if(updatedFixtureIdsBySurface[file].some(id=>!ids.has(id)))throw Error('EPL rebuild selector is not present on its retained surface');
  for(const event of events){
   if(event.season!==identities.SEASON||!Number.isInteger(event.roundNumber)||event.roundNumber<1||event.roundNumber>38)throw Error('EPL retained fixture season or round is invalid');
   const start=observation(event.startTimeUtc);
   if(!['upcoming','completed','live','break'].includes(event.status))throw Error('EPL retained fixture status is unsupported');
   if(event.status==='completed'&&(![event.homeScore,event.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0)||observation(event.scoreCheckedAt)<=start||observation(event.resultSourceCheckedAt)<=start))throw Error('EPL retained final evidence is incomplete');
   const round=rounds.get(event.roundNumber)||new Set();
   for(const id of event.participantIds){if(round.has(id))throw Error('EPL retained round repeats a club');round.add(id);}
   rounds.set(event.roundNumber,round);
   for(const id of event.participantIds)clubs.add(id);
   for(const key of ['sourceCheckedAt','canonicalSourceCheckedAt','scoreCheckedAt','resultSourceCheckedAt','statusCheckedAt'])if(event[key]!=null&&observation(event[key])>+now)throw Error('EPL retained fixture observation is future');
  }
  if(rounds.size!==38||[...rounds.values()].some(round=>round.size!==20))throw Error('EPL retained round set is incomplete');
 }
 const bundle=read(BUNDLE),snapshot=table.validatePublishedContext(bundle);
 if(bundle.ladderSnapshots.filter(row=>row.competitionId===COMPETITION).length!==1||snapshot.seasonLabel!==identities.SEASON||snapshot.source?.provider!=='Premier League'||snapshot.source.sourceType!=='official'||snapshot.source.sourceUrl!=='https://www.premierleague.com/en/tables/premier-league/2026-27'||observation(snapshot.snapshotTimeUtc)>+now||observation(snapshot.source.checkedAt)>+now||clubs.size!==20||snapshot.entries.some(row=>!clubs.has(row.participantId)))throw Error('EPL retained official table evidence is invalid');
 // Even empty per-surface selectors keep full Feed/spoiler/build validation.
 const changed=['EPL standings retained rebuild','Premier League retained rebuild'];
 return {mode:'quick',source:'epl',rebuiltAt:now.toISOString(),changed,failures:[],updatedFixtureIdsBySurface,sourceRequests:0,retainedSourceObservations:true,tableSnapshotTimeUtc:snapshot.snapshotTimeUtc,aiCalls:0,publicationState:'candidate'};
}
module.exports={refresh,retainedRebuild};
