'use strict';
// Exercises the retained publication boundary, not a source-fetch rehearsal.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validate,apply}=require('./apply-reviewed-participant-fixtures'),doc=validate(),policy=require('../config/fixture-reminder-policy'),model=require('../config/athletes');
const clone=()=>structuredClone(doc),finals=doc.events.filter(e=>e.status==='completed');
assert.equal(finals.length,6);
assert.deepEqual(finals.find(e=>e.id.includes('sabalenka-bartunkova')).sets,[{home:4,away:6},{home:3,away:6}],'winner-first draw scores must orient to Sabalenka home');
for(const mutate of [e=>{e.resultEvidence.fixtureId='wrong';},e=>{e.resultEvidence.sourceSha256='missing';},e=>{e.resultSourceCheckedAt=new Date(Date.now()+86400000).toISOString();},e=>{e.resultEvidence.participantIds.reverse();},e=>{e.winnerParticipantId='competitor:tennis:atp:someone-else';},e=>{e.sets[0].home=99;},e=>{e.scoreCheckedAt=e.sourceCheckedAt;},e=>{delete e.resultEvidence;},e=>{e.resultStatus='pending';}]){
 const bad=clone();mutate(bad.events[0]);assert.throws(()=>validate(bad),'unverified or misassociated completion must fail');
}
const instant=Date.parse('2026-10-06T02:11:00Z'),nexts=doc.events.filter(e=>e.status==='scheduled');
assert.equal(nexts.length,2);
for(const e of nexts){
 assert.equal(e.timePrecision,'not-before');
 assert.equal(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(e.startTimeUtc)),e.tournamentName==='Japan Open'?'20:00':'22:00','Sydney daylight saving conversion');
 assert.equal(model.next(doc.events,e.homeParticipantId,instant)?.id,e.id);
 assert.equal(policy.automaticEventScope(e),false,'ATP500 final cannot become automatic ON');assert(policy.timing(e,instant),'manual timing remains available');
}
assert.equal(model.next(doc.events,'athlete:tennis:alex-de-minaur',instant)?.id,nexts.find(e=>e.id.includes('djokovic-de-minaur')).id,'both followed finalists share one canonical next fixture');
const retirement=doc.events.find(e=>e.resultCode==='RET');assert(retirement);assert.equal(retirement.retiredParticipantId,retirement.awayParticipantId);assert.equal(model.next([retirement],retirement.homeParticipantId,instant),null,'a retirement is terminal, including an unfinished set');
for(const mutate of [e=>{delete e.resultEvidence.resultCode;},e=>{e.retiredParticipantId=e.winnerParticipantId;},e=>{e.resultCode='DEF';}]){const bad=clone();mutate(bad.events.find(e=>e.resultCode==='RET'));assert.throws(()=>validate(bad),'unverified terminal codes fail before publication');}
const djokovic=doc.events.find(e=>e.id.includes('djokovic-zverev'));
assert.equal(djokovic.round,'quarterfinal');assert.equal(djokovic.startTimeUtc,null);assert.equal(djokovic.date,null);assert.equal(policy.timing(djokovic,instant),null,'conditional semifinal clock cannot time a quarterfinal');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-tennis-review-'));
try{
 const files=['data/events.json','feeds/incoming/events.json'];
 const newerSchedule={sourceCheckedAt:'2026-10-04T13:00:00.000Z',sourceUrl:'https://example.org/newer-verified-schedule',sourceName:'Already verified schedule'};
 for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify({events:[{id:'unrelated',name:'Retained unrelated fixture'},...finals.map(e=>({...e,...newerSchedule,id:e.id.replaceAll(':','-'),status:'scheduled',score:null,sets:[],editorialPreview:'Retained fixture editorial'}))]},null,2)+'\n');}
 apply({root});const first=files.map(f=>fs.readFileSync(path.join(root,f),'utf8'));apply({root});assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'retries cannot duplicate or renew source facts');
 for(const text of first){const rows=JSON.parse(text).events;assert.equal(rows.length,doc.events.length+1);assert.equal(rows.find(e=>e.id==='unrelated').name,'Retained unrelated fixture');for(const e of finals){const row=rows.find(r=>r.canonicalEventId===e.id);assert.equal(row.status,'completed');assert.equal(row.id,e.id.replaceAll(':','-'),'existing action identity survives');for(const [key,value] of Object.entries(newerSchedule))assert.equal(row[key],value,'result review cannot roll back or renew independently checked scheduling');assert.equal(row.resultSourceCheckedAt,e.resultSourceCheckedAt);assert(!row.actualEndTimeUtc&&!row.completedAt,'a draw cannot invent the actual finish');assert.equal(row.editorialPreview,'Retained fixture editorial');}}
 const stale=clone();for(const e of stale.events){if(e.status==='completed'){e.status='scheduled';delete e.resultStatus;delete e.score;delete e.scoreDisplay;delete e.sets;delete e.result;delete e.resultEvidence;delete e.winnerParticipantId;}}apply({root,doc:stale});assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'stale reviewed export cannot reopen a terminal fixture');
 const bad=clone();bad.events[0].resultEvidence.sourceSha256='';assert.throws(()=>apply({root,doc:bad}));assert.deepEqual(files.map(f=>fs.readFileSync(path.join(root,f),'utf8')),first,'validation fails before any publication writes');
 fs.writeFileSync(path.join(root,files[1]),'invalid json');assert.throws(()=>apply({root}));assert.equal(fs.readFileSync(path.join(root,files[0]),'utf8'),first[0],'both publication surfaces preflight before writing');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('Reviewed tennis: verified completion, oriented scores, next match timing, lower-tier exclusions, stable actions and retry/preflight preservation passed.');
