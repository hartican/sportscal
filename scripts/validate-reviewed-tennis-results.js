'use strict';
// Exercises the retained publication boundary, not a source-fetch rehearsal.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validate,apply}=require('./apply-reviewed-participant-fixtures'),doc=validate(),policy=require('../config/fixture-reminder-policy'),model=require('../config/athletes');
const clone=()=>structuredClone(doc),finals=doc.events.filter(e=>e.status==='completed');
assert.equal(finals.length,7);
assert.deepEqual(finals.find(e=>e.id.includes('sabalenka-bartunkova')).sets,[{home:4,away:6},{home:3,away:6}],'winner-first draw scores must orient to Sabalenka home');
for(const mutate of [e=>{e.resultEvidence.fixtureId='wrong';},e=>{e.resultEvidence.sourceSha256='missing';},e=>{e.resultSourceCheckedAt=new Date(Date.now()+86400000).toISOString();},e=>{e.resultEvidence.participantIds.reverse();},e=>{e.winnerParticipantId='competitor:tennis:atp:someone-else';},e=>{e.sets[0].home=99;},e=>{e.scoreCheckedAt=e.sourceCheckedAt;},e=>{delete e.resultEvidence;},e=>{e.resultStatus='pending';}]){
 const bad=clone();mutate(bad.events[0]);assert.throws(()=>validate(bad),'unverified or misassociated completion must fail');
}
const instant=Date.parse('2026-10-06T02:11:00Z'),nexts=doc.events.filter(e=>e.tour==='ATP'&&['scheduled','live'].includes(e.status));
assert.equal(nexts.length,1);
for(const e of nexts){
 assert.equal(e.timePrecision,'not-before');
 assert.equal(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(e.startTimeUtc)),e.tournamentName==='Japan Open'?'20:00':'22:00','Sydney daylight saving conversion');
 assert.equal(model.next(doc.events,e.homeParticipantId,instant)?.id,e.id);
 assert.equal(policy.automaticEventScope(e),true,'Reviewed ATP500 singles championship final enters the owner-approved automatic scope');
 assert(policy.timing({...e,status:'scheduled'},instant),'the retained official timing remains available before play');
 if(e.status==='live')assert.equal(policy.timing(e,instant),null,'a match already observed live cannot queue a start reminder');
}
assert.equal(model.next(doc.events,'athlete:tennis:alex-de-minaur',instant)?.id,nexts.find(e=>e.id.includes('djokovic-de-minaur')).id,'both followed finalists share one canonical next fixture');
const japanFinal=finals.find(e=>e.id==='fixture:tennis:atp-tokyo-2026:f:alcaraz-lehecka');assert(japanFinal);assert.equal(japanFinal.startTimeUtc,'2026-10-06T09:00:00.000Z');assert.equal(policy.timing(japanFinal,instant),null,'verified completion cannot queue a start reminder');
const observedLive=doc.events.find(e=>e.status==='live'&&e.tour==='ATP');assert(observedLive);assert.equal(observedLive.statusEvidence.fixtureId,observedLive.id);
for(const mutate of [e=>{delete e.statusEvidence;},e=>{e.statusEvidence.participantIds=['someone'];},e=>{e.statusEvidence.fixtureId='wrong';},e=>{e.statusEvidence.checkedAt='2100-01-01T00:00:00Z';},e=>{e.statusEvidence.matchLabel='Tournament in progress';}]){const bad=clone();mutate(bad.events.find(e=>e.status==='live'&&e.tour==='ATP'));assert.throws(()=>validate(bad),'unbound or generic live evidence cannot manufacture live play');}
assert.equal(require('../config/feed-controls').isLiveNow(observedLive,Date.parse(observedLive.statusCheckedAt)+31*60000),false,'a retained live review expires without fresh match evidence');
const retirement=doc.events.find(e=>e.resultCode==='RET');assert(retirement);assert.equal(retirement.retiredParticipantId,retirement.awayParticipantId);assert.equal(model.next([retirement],retirement.homeParticipantId,instant),null,'a retirement is terminal, including an unfinished set');
for(const mutate of [e=>{delete e.resultEvidence.resultCode;},e=>{e.retiredParticipantId=e.winnerParticipantId;},e=>{e.resultCode='DEF';}]){const bad=clone();mutate(bad.events.find(e=>e.resultCode==='RET'));assert.throws(()=>validate(bad),'unverified terminal codes fail before publication');}
const djokovic=doc.events.find(e=>e.id.includes('djokovic-zverev'));
assert.equal(djokovic.round,'quarterfinal');assert.equal(djokovic.startTimeUtc,null);assert.equal(djokovic.date,null);assert.equal(policy.timing(djokovic,instant),null,'conditional semifinal clock cannot time a quarterfinal');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-tennis-review-'));
try{
 const files=['data/events.json','feeds/incoming/events.json'];
 const newerSchedule={sourceCheckedAt:'2026-10-04T13:00:00.000Z',sourceUrl:'https://example.org/newer-verified-schedule',sourceName:'Already verified schedule'};
 for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify({events:[{id:'unrelated',name:'Retained unrelated fixture'},...finals.map(e=>({...e,...newerSchedule,id:e.id.replaceAll(':','-'),status:'scheduled',score:null,sets:[],editorialPreview:'Retained fixture editorial',...(e.id===japanFinal.id?{storyline:{arcStage:'preview',hookSpoilerOff:'Preview',hookSpoilerOn:'Preview',synopsisSpoilerOff:'Preview',synopsisSpoilerOn:'Preview'}}:{})}))]},null,2)+'\n');}
 apply({root});const first=files.map(f=>fs.readFileSync(path.join(root,f),'utf8'));apply({root});assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'retries cannot duplicate or renew source facts');
 for(const text of first){const rows=JSON.parse(text).events;assert.equal(rows.length,doc.events.length+1);assert.equal(rows.find(e=>e.id==='unrelated').name,'Retained unrelated fixture');for(const e of finals){const row=rows.find(r=>r.canonicalEventId===e.id);assert.equal(row.status,'completed');assert.equal(row.id,e.id.replaceAll(':','-'),'existing action identity survives');for(const [key,value] of Object.entries(newerSchedule))assert.equal(row[key],value,'result review cannot roll back or renew independently checked scheduling');assert.equal(row.resultSourceCheckedAt,e.resultSourceCheckedAt);assert(!row.actualEndTimeUtc&&!row.completedAt,'a draw cannot invent the actual finish');if(e.id===japanFinal.id){assert.equal(row.storyline.arcStage,'recap');assert.notEqual(row.storyline.hookSpoilerOff,row.storyline.hookSpoilerOn);assert(!row.selectedSentence.includes('defeated'));assert(!row.editorialPreview);}else assert.equal(row.editorialPreview,'Retained fixture editorial');}}
 const stale=clone();for(const e of stale.events){if(e.status==='completed'){e.status='scheduled';delete e.resultStatus;delete e.score;delete e.scoreDisplay;delete e.sets;delete e.result;delete e.resultEvidence;delete e.winnerParticipantId;}}apply({root,doc:stale});assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'stale reviewed export cannot reopen a terminal fixture');
 const bad=clone();bad.events[0].resultEvidence.sourceSha256='';assert.throws(()=>apply({root,doc:bad}));assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'validation fails before any publication writes');
 fs.writeFileSync(path.join(root,files[1]),'invalid json');assert.throws(()=>apply({root}));assert.equal(fs.readFileSync(path.join(root,files[0]),'utf8'),first[0],'both publication surfaces preflight before writing');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('Reviewed tennis: verified completion, oriented scores, next match timing, lower-tier exclusions, stable actions and retry/preflight preservation passed.');
