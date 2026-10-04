'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file))),schedule=read('data/canonical/fiba-women-sailgp-motogp-2026.json');
const {validateNrlwFinals,mergeNrlwFinalCard,cardForEvent}=require('./sync-requested-sports-to-feed');
validateNrlwFinals(schedule);
for(const [name,mutate] of [
  ['incomplete collection',s=>s.events.splice(s.events.findIndex(e=>e.nrlwFinalsReviewed),1)],
  ['duplicate identity',s=>s.nrlwFinalsReview.fixtureIds[1]=s.nrlwFinalsReview.fixtureIds[0]],
  ['non-final status',s=>s.events.find(e=>e.nrlwFinalsReviewed).providerStatus='InProgress'],
  ['wrong competition',s=>s.events.find(e=>e.nrlwFinalsReviewed).competitionId='competition:nrl-premiership-2026'],
  ['unknown participant',s=>s.events.find(e=>e.nrlwFinalsReviewed).participantIds[0]='team:nrlw:unknown'],
  ['negative score',s=>s.events.find(e=>e.nrlwFinalsReviewed).homeScore=-1],
  ['string score',s=>s.events.find(e=>e.nrlwFinalsReviewed).homeScore='0'],
  ['unresolved tie',s=>{const e=s.events.find(e=>e.nrlwFinalsReviewed);e.homeScore=e.awayScore;}],
  ['invalid timestamp',s=>s.events.find(e=>e.nrlwFinalsReviewed).startTimeUtc='invalid'],
  ['wrong Sydney date',s=>s.events.find(e=>e.nrlwFinalsReviewed).date='2026-09-20'],
  ['future observation',s=>{const e=s.events.find(e=>e.nrlwFinalsReviewed);s.sources[e.sourceId].checkedAt='2099-01-01T00:00:00Z';}],
  ['renewed unchanged fact clock',s=>s.events.find(e=>e.nrlwFinalsReviewed).result.checkedAt='2026-10-03T08:00:00Z'],
  ['conflicting score',s=>s.events.find(e=>e.nrlwFinalsReviewed).result.score='Invented 1-2 result']
]){
  const s=structuredClone(schedule);mutate(s);assert.throws(()=>validateNrlwFinals(s),undefined,name+' must reject');
}
const finals=schedule.events.filter(e=>e.nrlwFinalsReviewed);
const grandFinal=finals.find(e=>e.id==='event:nrlw:2026:grand-final');
assert(grandFinal,'separately reviewed Grand Final is in the declared finals collection');
assert.equal(finals.length,5);assert.equal(grandFinal.homeScore,30);assert.equal(grandFinal.awayScore,6);
assert.equal(grandFinal.sourceCheckedAt,'2026-09-27T13:57:48.000Z','programme verification is not renewed by result review');
assert.notEqual(grandFinal.sourceId,grandFinal.result.sourceId,'schedule and result observations have independent sources');
for(const [name,mutate] of [
  ['undeclared final', (s,e)=>{delete e.nrlwFinalsReviewed;s.nrlwFinalsReview.fixtureIds=s.nrlwFinalsReview.fixtureIds.filter(id=>id!==e.id);}],
  ['wrong phase', (s,e)=>e.roundNumber=13],
  ['wrong fixture', (s,e)=>e.id='event:nrlw:2026:invented-grand-final'],
  ['swapped participants', (s,e)=>e.participantIds.reverse()],
  ['rescheduled kickoff', (s,e)=>e.startTimeUtc='2026-10-04T06:00:00.000Z'],
  ['changed venue', (s,e)=>e.venue='Allianz Stadium'],
  ['renewed programme date', (s,e)=>e.sourceCheckedAt=e.result.checkedAt],
  ['inconsistent result date', (s,e)=>e.result.checkedAt='2026-10-04T09:19:15.000Z'],
  ['unreviewed result', (s,e)=>delete e.result.evidenceKind],
  ['schedule reused as result', (s,e)=>e.result.sourceId=e.sourceId],
  ['account form as evidence', (s,e,source)=>source.url='https://account.nrl.com/authorize'],
  ['wrong source fixture', (s,e,source)=>source.fixtureId='event:nrl:2026:grand-final'],
  ['wrong source competition', (s,e,source)=>source.competitionId='competition:nrl-premiership-2026'],
  ['contradictory source score', (s,e,source)=>source.homeScore=31],
  ['non-final source', (s,e,source)=>source.finalStatus='InProgress'],
  ['pre-match observation', (s,e,source)=>{source.checkedAt=e.result.checkedAt='2026-10-04T04:00:00.000Z';}],
  ['invalid UTC source date', (s,e,source)=>{source.checkedAt=e.result.checkedAt='2026-10-04 09:19:16';}],
  ['future result date', (s,e,source)=>{source.checkedAt=e.result.checkedAt='2099-10-04T09:19:16.000Z';}],
  ['invented provider update', (s,e,source)=>source.providerUpdatedAt=source.checkedAt],
  ['invented provider identity', (s,e)=>e.providerMatchId='invented']
]){
  const s=structuredClone(schedule),e=s.events.find(e=>e.id===grandFinal.id);mutate(s,e,s.sources[e.result.sourceId]);
  assert.throws(()=>validateNrlwFinals(s),undefined,'Grand Final '+name+' must reject');
}
const historical=structuredClone(schedule),oldFinal=historical.events.find(e=>e.id===grandFinal.id);
for(const field of ['nrlwFinalsReviewed','roundNumber','providerStatus','status','homeScore','awayScore','result'])delete oldFinal[field];
historical.nrlwFinalsReview.fixtureIds=historical.nrlwFinalsReview.fixtureIds.filter(id=>id!==grandFinal.id);
validateNrlwFinals(historical); // The original four-match admission contract remains valid.

assert(finals.some(e=>e.homeScore===0),'source-backed zero final is valid');
const card=cardForEvent(grandFinal,schedule,new Map(schedule.participants.map(p=>[p.id,p])));
const corrected={...card,score:'Reviewed later correction',resultSourceCheckedAt:new Date(Date.parse(card.resultSourceCheckedAt)+1000).toISOString()};
assert.deepEqual(mergeNrlwFinalCard(card,corrected),corrected,'a stale static review cannot regress a later verified result');
assert.throws(()=>mergeNrlwFinalCard(card,{...card,score:'Conflicting result'}),/conflicting result/,'same-observation contradiction rejects');
const ids=new Set(finals.map(e=>e.id)),aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
for(const file of ['feeds/incoming/events.json','data/events.json','data/code-inspector/nrlw.json','data/follow-schedule/nrlw.json']){
  const doc=read(file),events=doc.events||doc.fixtures;
  for(const final of finals){
    const matches=events.filter(e=>aliases(e).includes(final.id));assert.equal(matches.length,1,file+': exactly one reviewed fixture');
    const e=matches[0];assert.equal(e.startTimeUtc,final.startTimeUtc);assert.deepEqual(e.participantIds,final.participantIds);assert.equal(e.status,'completed');assert.equal(e.resultStatus,'official');assert.equal(e.score,final.result.score);assert.equal(e.resultSourceCheckedAt,final.result.checkedAt);assert.equal(e.sourceCheckedAt,final.sourceCheckedAt);assert.equal(e.venue,final.venue);
    if(final.id===grandFinal.id){assert.equal(e.resultSourceUrl,schedule.sources[grandFinal.result.sourceId].url);assert.equal(e.scoreCheckedAt,grandFinal.result.checkedAt);assert.equal(e.statusCheckedAt,grandFinal.result.checkedAt);}
  }
}
assert.equal(read('data/code-inspector/nrlw.json').coverageStatus,'partial','a dated season collection and reviewed finals cannot certify the whole family');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nrlw-finals-'));
try{for(const file of ['feeds/incoming/events.json','data/events.json']){
  const original=read(file),raw=structuredClone(original.events.find(e=>e.key==='tennis'));raw.id=raw.eventId='qa:tennis:retained-raw-provider-id';delete raw.canonicalEventId;delete raw.sourceEventIds;original.events.push(raw);
  const outside=original.events.filter(e=>!aliases(e).some(id=>ids.has(id))),target=path.join(temp,'events.json');fs.writeFileSync(target,JSON.stringify(original));
  for(let i=0;i<2;i++)execFileSync(process.execPath,[path.join(root,'scripts/sync-requested-sports-to-feed.js'),target,target,'--nrlw-finals-only'],{cwd:root,stdio:'pipe'});
  const written=JSON.parse(fs.readFileSync(target));assert.deepEqual(written.events.filter(e=>!aliases(e).some(id=>ids.has(id))),outside,file+': all original fixtures and raw identities survive');assert.equal(new Set(written.events.map(e=>e.id)).size,written.events.length);
  for(const id of ids){const first=original.events.find(e=>aliases(e).includes(id)),last=written.events.find(e=>aliases(e).includes(id));assert.deepEqual(last,first,'unchanged final reruns preserve every field and original observation');}
}}finally{fs.rmSync(temp,{recursive:true,force:true});}
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const events=read('data/events.json').events;
const preferences=selected=>({selectedSelectorEntityIds:selected,followedSports:selected.includes('sport:nrlw')?['nrlw']:['nrl'],preferenceGraph:{domainPreferences:selected.map(sportDomainId=>({sportDomainId,enabled:true}))}});
const admitted=(selected,now)=>buildServerFeed({events,userId:'nrlw-reviewed-finals-qa',userState:{preferences:preferences(selected)},now:new Date(now)}).events;
assert(finals.filter(e=>e.roundNumber===13).every(e=>admitted(['sport:nrlw'],'2026-09-28T00:00:00Z').some(f=>aliases(f).includes(e.id))),'explicit NRLW follows admit current preliminaries');
assert(finals.every(e=>!admitted(['sport:nrl-premiership'],'2026-09-28T00:00:00Z').some(f=>aliases(f).includes(e.id))),'men’s NRL follow cannot opt into NRLW');
assert(finals.filter(e=>e.roundNumber===12).every(e=>!admitted(['sport:nrlw'],'2026-10-03T00:00:00Z').some(f=>aliases(f).includes(e.id))),'restoring history does not extend Feed retention');
console.log('NRLW reviewed finals: five-match collection, independent Grand Final report/programme dates, zero scores, 33 malformed cases, exact persistence/reruns, explicit consent and retained history limits passed.');
