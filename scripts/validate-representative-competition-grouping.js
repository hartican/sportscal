'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),registry=require('../config/representative-events'),follow=require('../config/follow-first');
const rounds=new Map([['rlwc-australia-new-zealand-2026',1],['rlwc-australia-fiji-2026',2],['rlwc-australia-cook-islands-2026',3]]);
const context=new Set(['competitionId','competitionName','roundNumber','roundLabel']);
const withoutContext=event=>Object.fromEntries(Object.entries(event).filter(([key])=>!context.has(key)));
for(const file of ['feeds/incoming/events.json','data/events.json','data/code-inspector/nrl.json']){
 const doc=JSON.parse(fs.readFileSync(path.join(root,file)));const events=doc.events||doc.fixtures;
 for(const [id,round] of rounds){
  const matches=events.filter(event=>event.id===id);assert.equal(matches.length,1,`${file}: existing identity appears once`);
  const event=matches[0];assert.equal(event.competitionId,'competition:rugby-league-world-cup:2026');
  assert.equal(event.roundNumber,round);assert.equal(event.roundLabel,`Rugby League World Cup Round ${round}`);
 }
}
// Exercise the actual writer with real retained source records. Only reviewed
// context may change; dates, scores, source clocks and durable IDs must survive.
const source=JSON.parse(fs.readFileSync(path.join(root,'feeds/incoming/events.json')));
const original=structuredClone(source);
for(const event of source.events)if(rounds.has(event.id))for(const key of context)delete event[key];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-representative-context-'));
try{
 const file=path.join(temp,'events.json');fs.writeFileSync(file,JSON.stringify(source));
 execFileSync(process.execPath,[path.join(root,'scripts/apply-representative-metadata.js'),file],{cwd:root,stdio:'pipe'});
 const written=JSON.parse(fs.readFileSync(file));
 assert.deepEqual(written.events.map(e=>e.id),original.events.map(e=>e.id),'writer preserves all source identities/order');
 for(let i=0;i<written.events.length;i++){
  const before=source.events[i],after=written.events[i];
  if(rounds.has(before.id)){
   assert.deepEqual(withoutContext(after),withoutContext(before),'writer preserves original sporting facts and clocks');
   assert.deepEqual(follow.viewingOptions(after),follow.viewingOptions(before),'competition grouping preserves existing viewing destinations');
  }else assert.deepEqual(after,before,'unrelated source records remain exact');
 }
 const bytes=fs.readFileSync(file);execFileSync(process.execPath,[path.join(root,'scripts/apply-representative-metadata.js'),file],{cwd:root,stdio:'pipe'});
 assert(fs.readFileSync(file).equals(bytes),'identical context rerun is byte-stable');
 assert.equal(registry.metadataForEventId('rlwc-australia-fiji-2030'),null,'another edition is not guessed');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Representative competition grouping: three existing World Cup rounds, actual writer preservation, viewing and byte-stable reruns passed.');
