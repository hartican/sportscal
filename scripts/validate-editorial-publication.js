'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const policy=require('../config/editorial-maintenance'),publication=require('./lib/editorial-publication');
const knowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json'));
const feed=JSON.parse(fs.readFileSync('data/events.json'));
const id='supercars-bathurst-1000-2026',current=feed.events.find(event=>event.id===id);
const projection=require('./lib/editorial-narrative').projectionForTarget(knowledge,'feed-event',current);
// Keep temporal assertions relative to the real research, not a date that expires.
const researchTime=Date.parse(current.editorialNarrative.researchedAt);
assert(Number.isFinite(researchTime),'Published research must have a valid timestamp');
const relativeTime=hours=>new Date(researchTime+hours*60*60*1000).toISOString();
const old={...current,selectedSentence:'Old Mountain hook',fullSpiel:'Old context',editorialNarrative:{...current.editorialNarrative,projectionId:'projection:supercars-bathurst-1000-2026',hook:'Old Mountain hook',synopsis:'Old context',formCopy:undefined,closingCopy:undefined,researchedAt:relativeTime(-2)},sourceCheckedAt:relativeTime(1)};
const [repaired]=publication.reconcileFullPreviews([old],knowledge);
assert(policy.equalCopy(policy.copy(repaired),projection),'Current full research survives a newer score fetch');
for(const key of Object.keys(old).filter(key=>!publication.fields.includes(key)))assert.deepEqual(repaired[key],old[key],key+' unchanged');
assert.deepEqual(publication.reconcileFullPreviews([repaired],knowledge),[repaired],'Repeated publication stable');
const newer={...repaired,editorialNarrative:{...repaired.editorialNarrative,hook:'New reviewed hook',researchedAt:relativeTime(2)}};
assert.deepEqual(publication.reconcileFullPreviews([newer],knowledge),[newer],'Newer editorial wins');
for(const event of [{...old,status:'completed'},feed.events.find(event=>event.id==='evt_84')])assert.deepEqual(publication.reconcileFullPreviews([event],knowledge),[event],'Results and protected NRL copy retained');
const copy=policy.copy(repaired),row={event_id:id,revision:0,staged_copy:copy};
const other={...repaired,id:'fixture:independent',eventId:'fixture:independent',canonicalEventId:'fixture:independent',sourceEventIds:[]};
const otherRow={...row,event_id:other.id};
const gap=publication.publicationPlan([row,otherRow],[repaired,other],[old,other]);
assert.deepEqual(gap.published,[otherRow]);assert.equal(gap.deferred.length,1);assert.equal(gap.deferred[0].row,row);assert.equal(row.staged_copy,copy,'Failed visible card retains staged copy');
assert.deepEqual(publication.publicationPlan([row],[repaired],[repaired]).published,[row]);
assert.equal(publication.publicationPlan([{...row,held:true}],[repaired],[repaired]).published.length,0);
assert.equal(publication.publicationPlan([row],[repaired],[]).deferred.length,1,'Missing served fixture is not publication');
assert.equal(publication.publicationPlan([row],[repaired],[{...repaired,selectedSentence:'Old compatibility hook'}]).deferred.length,1);
assert(publication.publicationMismatch(repaired,[old]));assert(!publication.publicationMismatch(repaired,[repaired]));
assert(policy.equalCopy(policy.copy(current),projection),'Bathurst published full four-section preview');
console.log('Editorial publication: stale seed/quick refresh, actual served four-section proof, independent gaps, unchanged sporting facts, newer editorial, holds and protected NRL passed.');

const crypto=require('node:crypto'),release=require('./lib/editorial-source-release');
const bytes=fs.readFileSync(release.sourcePath),sha='a'.repeat(40),hash=(algorithm,value)=>crypto.createHash(algorithm).update(value).digest('hex');
for(const transform of ['identity','json-compact']){
 const deployed=transform==='identity'?bytes:Buffer.from(JSON.stringify(JSON.parse(bytes))+'\n');
 const inventory={revision:sha,files:[{path:release.sourcePath,gitBlob:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),transform,bytes:deployed.length,sha256:hash('sha256',deployed)}]};
 assert.equal(release.verifySourceInventory(sha,inventory,bytes),JSON.parse(bytes).sourceRevision);
 for(const change of [i=>i.revision='b'.repeat(40),i=>i.files=[],i=>i.files.push({...i.files[0]}),i=>i.files[0].gitBlob='0'.repeat(40),i=>i.files[0].transform='unreviewed',i=>i.files[0].bytes++,i=>i.files[0].sha256='0'.repeat(64)]){const bad=structuredClone(inventory);change(bad);assert.throws(()=>release.verifySourceInventory(sha,bad,bytes));}
 assert.throws(()=>release.verifySourceInventory(sha,inventory,Buffer.concat([bytes,Buffer.from(' ')])),'Wrong source bytes must reject before recording publication');
}
console.log('Editorial server-source inventory: exact commit, source blob, identity/compact transforms, length/hash and conflicting or duplicate entries passed.');
require('./lib/editorial-release-command-tests').validateEditorialReleaseCommand().then(()=>console.log('Actual editorial release command: source inventory and fresh target binding passed; stale/hash conflicts reject before control writes.')).catch(error=>{console.error(error);process.exitCode=1;});
