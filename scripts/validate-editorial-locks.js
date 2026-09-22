#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const locks=require('../config/editorial-locks'),narrative=require('./lib/editorial-narrative');
const {createResolver}=require('../lib/fixture-editorial'),{buildQueue}=require('./build-editorial-research-queue');
const knowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json'));
const indexes=narrative.indexesFor(knowledge),feed=JSON.parse(fs.readFileSync('data/events.json'));
const approved=locks.records[0],base=feed.events.find(event=>locks.recordFor(event));
assert(base,'locked fixture exists');
const projection=narrative.projectionForTarget(knowledge,'feed-event',base);
const stale={...projection,hook:'Stale placeholder',synopsis:'Stale generated body'};
for(const id of [approved.canonicalEventId,...approved.aliases]){
 for(const status of ['upcoming','live','postponed','past']){
  const event={...base,id,eventId:id,canonicalEventId:id,status,scheduleStatus:status,startTimeUtc:'2000-01-01T00:00:00Z'};
  const copy=narrative.applyToFeedEvent(event,stale,indexes);
  assert.equal(copy.selectedSentence,approved.hook);assert.equal(copy.fullSpiel,approved.synopsis);
  assert.equal(copy.editorialNarrative.hook,approved.hook);assert.equal(copy.storyline.synopsisSpoilerOff,approved.synopsis);
  for(const field of ['id','status','startTimeUtc','participantIds','score','sourceUrl'])assert.deepEqual(copy[field],event[field]);
  assert.deepEqual(locks.apply(copy),copy,'repeated refresh is idempotent');
  const resolver=createResolver({...knowledge,eventProjections:[{...stale,targetIds:[id]}]},[event]);
  assert.equal(resolver(event).editorialNarrative.synopsis,approved.synopsis);
 }
}
for(const status of ['completed','finished','final'])assert.equal(locks.activeFor({...base,status,scheduleStatus:'confirmed'}),null);
assert(locks.activeFor({...base,status:'completed',scheduleStatus:'postponed'}));
const completed={...base,status:'completed',outcomeText:'A verified outcome',recapText:'A verified recap'};
assert.equal(narrative.applyToFeedEvent(completed,{...stale,hook:'New post-match hook',synopsis:'New post-match body'},indexes).editorialNarrative.hook,'New post-match hook');
const lifecycle=require('../config/editorial-lifecycle');
assert(!lifecycle.copy(completed,narrative.applyToFeedEvent(completed,stale,indexes).editorialNarrative,false).hook.includes(completed.outcomeText));
const queue=event=>buildQueue({knowledge,feed:{events:[event]},majorEvents:{events:[]},signals:{signals:[]},reference:new Date('2026-09-22T00:00:00Z')}).entries.find(entry=>entry.targetId===event.canonicalEventId);
assert.equal(queue(base).priority,'five-star');assert.equal(queue(base).fiveStarSignal,false,'owner priority never manufactures crowd evidence');
assert.equal(queue(base).editorialLocked,true);assert.equal(queue(base).refreshDeadline,null);
assert.equal(queue(completed).editorialLocked,false);assert.equal(queue(completed).priority,'five-star');
assert.equal(queue(completed).editorialPhase,'post-match');assert(queue(completed).refreshDeadline);
const unrelated={id:'different-fixture',name:base.name,status:'upcoming'};assert.equal(locks.apply(unrelated),unrelated);
if(process.argv.includes('--published')){
 for(const file of ['feeds/incoming/events.json','data/events.json']){
  const event=JSON.parse(fs.readFileSync(file)).events.find(event=>locks.recordFor(event));
  if(locks.activeFor(event)){assert.equal(event.editorialNarrative.hook,approved.hook,file);assert.equal(event.editorialNarrative.synopsis,approved.synopsis,file);assert.equal(event.fullSpiel,approved.synopsis,file);}
 }
}
console.log('Editorial lock: aliases, repeated projection/server application, source facts, completion, spoilers and honest five-star priority passed.');
