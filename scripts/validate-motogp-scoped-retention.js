'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-motogp-retention-'));
const published=JSON.parse(fs.readFileSync(path.join(root,'data/events.json'))).events;
const inspector=JSON.parse(fs.readFileSync(path.join(root,'data/code-inspector/motogp.json'))).fixtures;
for(const event of published.filter(e=>e.key==='motogp'&&e.resultStatus==='pending')){
 const matches=inspector.filter(f=>[f.id,f.canonicalEventId,...(f.sourceEventIds||[])].includes(event.id));
 assert.equal(matches.length,1,'published pending result has one canonical Schedule projection');
 assert.equal(matches[0].resultStatus,'pending','Schedule retains explicit degraded result state');
 assert.equal(matches[0].resultSourceCheckedAt,event.resultSourceCheckedAt,'Schedule retains actual result observation date');
}
try{
 for(const source of ['feeds/incoming/events.json','data/events.json']){
  const original=JSON.parse(fs.readFileSync(path.join(root,source))),file=path.join(temp,'events.json');
  const outside=original.events.filter(e=>e.key!=='motogp');
  // Include an explicitly synthetic raw-provider spelling so the boundary
  // remains tested even when every currently retained ID is already normalised.
  const test=structuredClone(outside.find(e=>e.key==='tennis'));assert(test);
  test.id=test.eventId='qa:tennis:retained-provider-id';delete test.canonicalEventId;delete test.sourceEventIds;
  original.events.push(test);outside.push(test);fs.writeFileSync(file,JSON.stringify(original));
  execFileSync(process.execPath,[path.join(root,'scripts/sync-requested-sports-to-feed.js'),file,file,'--motogp-only'],{cwd:root,stdio:'pipe'});
  const written=JSON.parse(fs.readFileSync(file));
  assert.deepEqual(written.events.filter(e=>e.key!=='motogp'),outside,`${source}: actual scoped writer preserves all unrelated IDs, facts, editorial and clocks`);
  assert.equal(new Set(written.events.map(e=>e.id)).size,written.events.length,'scoped refresh does not duplicate identities');
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Scoped MotoGP retention: both real feed surfaces and raw-provider identity rehearsal passed.');
