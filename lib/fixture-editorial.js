'use strict';
const narrative=require('../scripts/lib/editorial-narrative');
const policy=require('../config/follow-feed-policy');
const pauses=require('../config/coverage-pauses');
function editorialKey(event){
 const ids=policy.participantIds(event).sort();
 const date=String(event.date||event.startTimeUtc||'').slice(0,10);
 if(ids.length!==2||!date)return '';
 const text=[event.format,event.matchFormat,event.name].filter(Boolean).join(' ');
 const format=/\bt20/i.test(text)?'t20':/\bodi\b/i.test(text)?'odi':/\btest\b/i.test(text)?'test':'';
 return `${policy.sportKey(event)}|${date}|${ids.join('|')}|${format}`;
}
function createResolver(knowledge,events){
 const indexes=narrative.indexesFor(knowledge),byId=new Map(),byFixture=new Map();
 for(const projection of knowledge.eventProjections||[])if(projection.targetType==='feed-event')for(const id of projection.targetIds)byId.set(id,projection);
 const aliases=event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])];
 for(const event of events){const p=aliases(event).map(id=>byId.get(id)).find(Boolean),key=editorialKey(event);if(p&&key)byFixture.set(key,p);}
 for(const event of events){const p=byFixture.get(editorialKey(event));if(p)for(const id of aliases(event))if(id&&!byId.has(id))byId.set(id,p);}
 return event=>{
  if(pauses.womensT20(event))return pauses.apply(event);
  const projection=aliases(event).map(id=>byId.get(id)).find(Boolean)||byFixture.get(editorialKey(event));
  if(!projection)return event;
  const enriched=narrative.applyToFeedEvent(event,projection,indexes);
  // Fixture facts and provenance are authoritative; copy only editorial fields.
  return {...event,editorialNarrative:enriched.editorialNarrative,editorialPreview:enriched.editorialPreview,storyline:enriched.storyline};
 };
}
module.exports={editorialKey,createResolver};
