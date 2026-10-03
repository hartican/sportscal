'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),source=require('../data/canonical/wrc-context-2026.json').events.find(e=>e.status==='cancelled');assert(source,'use the actual withdrawn WRC round');
const fixture=require('../data/events.json').events.find(e=>e.canonicalEventId===source.id);assert(fixture,'withdrawn WRC fixture must have its retained card identity');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-states-'));
try{
 const states=['cancelled','postponed','abandoned','live','scheduled','upcoming'];
 const events=states.map(status=>({...fixture,id:`qa-${status}`,eventId:`qa-${status}`,status,date:'2026-07-01',time:'10:00',startTimeUtc:'2026-07-01T00:00:00Z'}));
 for(const file of ['feeds/incoming/events.json','data/events.json']){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.writeFileSync(path.join(temp,file),JSON.stringify({events}));}
 for(let i=0;i<2;i++)execFileSync(process.execPath,[path.join(root,'scripts/enrich-storyline-cards.js'),'--write'],{cwd:temp,stdio:'pipe'});
 for(const file of ['feeds/incoming/events.json','data/events.json']){const written=JSON.parse(fs.readFileSync(path.join(temp,file))).events;assert.deepEqual(written.map(e=>e.status),states,'editorial lifecycle cannot overwrite the source status');assert(written.every(e=>e.storyline.arcStage!=='recap'),'an elapsed unresolved match cannot acquire final editorial');for(let i=0;i<events.length;i++)for(const key of ['id','canonicalEventId','participantIds','sourceCheckedAt','statusCheckedAt','sourceUrl'])assert.deepEqual(written[i][key],events[i][key],'identity and actual observations survive');}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Editorial source states: actual cancelled WRC card, elapsed unresolved/live states, real two-surface writer/reruns, stable identities/clocks and non-final copy passed.');
