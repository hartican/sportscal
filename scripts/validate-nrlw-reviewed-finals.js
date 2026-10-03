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
assert(finals.some(e=>e.homeScore===0),'source-backed zero final is valid');
const card=cardForEvent(finals[0],schedule,new Map(schedule.participants.map(p=>[p.id,p])));
const corrected={...card,score:'Reviewed later correction',resultSourceCheckedAt:'2026-10-03T08:18:00.000Z'};
assert.deepEqual(mergeNrlwFinalCard(card,corrected),corrected,'a stale static review cannot regress a later verified result');
assert.throws(()=>mergeNrlwFinalCard(card,{...card,score:'Conflicting result'}),/conflicting result/,'same-observation contradiction rejects');
const ids=new Set(finals.map(e=>e.id)),aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
for(const file of ['feeds/incoming/events.json','data/events.json','data/code-inspector/nrlw.json','data/follow-schedule/nrlw.json']){
  const doc=read(file),events=doc.events||doc.fixtures;
  for(const final of finals){
    const matches=events.filter(e=>aliases(e).includes(final.id));assert.equal(matches.length,1,file+': exactly one reviewed fixture');
    const e=matches[0];assert.equal(e.startTimeUtc,final.startTimeUtc);assert.deepEqual(e.participantIds,final.participantIds);assert.equal(e.status,'completed');assert.equal(e.resultStatus,'official');assert.equal(e.score,final.result.score);assert.equal(e.resultSourceCheckedAt,final.result.checkedAt);assert.equal(e.sourceCheckedAt,final.sourceCheckedAt);assert.equal(e.venue,final.venue);
  }
}
assert.equal(read('data/code-inspector/nrlw.json').coverageStatus,'partial','eleven reviewed fixtures cannot certify a whole season');
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
console.log('NRLW reviewed finals: complete four-match collection, zero scores, rejected malformed facts, exact persistence/reruns, explicit consent and retained history limits passed.');
