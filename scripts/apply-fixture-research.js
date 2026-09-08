#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const narrative=require('./lib/editorial-narrative');
function apply(knowledge,feed,majorEvents,research){
  const upsert=(field,value)=>{const index=knowledge[field].findIndex(row=>row.id===value.id);if(index<0)knowledge[field].push(value);else knowledge[field][index]=value;};
  for(const entry of research.entries){
    const prefix=`fixture-research:${entry.id.replace(/[^a-z0-9:._-]/g,'-')}`;
    const targetIds=feed.events.filter(event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].includes(entry.id)).map(event=>event.id);
    if(!targetIds.length)throw new Error('Missing researched fixture '+entry.id);
    const subjectId=`subject:${prefix}`,threadId=`thread:${prefix}`;
    const sourceIds=entry.sources.map((url,index)=>`source:${prefix}:${index}`);
    upsert('subjects',{id:subjectId,kind:'event',name:entry.title});
    entry.sources.forEach((url,index)=>upsert('sources',{id:sourceIds[index],name:`${entry.title} — official research ${index+1}`,url,sourceType:'official',checkedAt:entry.researchedAt}));
    const factIds=entry.facts.map((fact,index)=>{
      const id=`fact:${prefix}:${index}`;
      upsert('narrativeFacts',{id,subjectIds:[subjectId],statement:fact.statement,dimension:fact.dimension,sourceIds:fact.sourceIndexes.map(index=>sourceIds[index]),observedAt:entry.researchedAt,expiresAt:null});return id;
    });
    upsert('narrativeThreads',{id:threadId,subjectIds:[subjectId],title:entry.title,summary:entry.synopsis,factIds,status:entry.promotedReplay?'resolved':'active',updatedAt:entry.researchedAt});
    knowledge.eventProjections=knowledge.eventProjections.filter(projection=>projection.id!==`projection:${prefix}`).map(projection=>projection.targetType==='feed-event'?{...projection,targetIds:projection.targetIds.filter(id=>id!==entry.id&&!targetIds.includes(id))}:projection).filter(projection=>projection.targetIds.length);
    const projection={id:`projection:${prefix}`,targetType:'feed-event',targetIds,researchDepth:entry.researchDepth || 5,hook:entry.hook,synopsis:entry.synopsis,threadIds:[threadId],factIds,sourceIds,researchedAt:entry.researchedAt,refreshAfter:entry.promotedReplay?null:'2026-09-09T12:00:00.000Z',generationMode:'researched',originalityReview:{method:'independent-summary-no-source-prose-retained',reviewedAt:entry.researchedAt},...(entry.hookSpoilerOn?{hookSpoilerOn:entry.hookSpoilerOn,synopsisSpoilerOn:entry.synopsisSpoilerOn}:{})};
    knowledge.eventProjections.push(projection);
    const indexes=narrative.indexesFor(knowledge);
    const enrich=(event,child=false)=>{
      if(![event.id,event.eventId,event.canonicalEventId].includes(entry.id))return event;
      if(child){const clean={...event};for(const key of ['selectedSentence','fullSpiel','sourceName','sourceType','sourceCheckedAt','lastReviewedAt','editorialPreview'])delete clean[key];return {...clean,editorialNarrative:narrative.editorialNarrativeFor(projection,indexes)};}
      return {...narrative.applyToFeedEvent(event,projection,indexes),...(entry.promotedReplay?{editorialReplayRecommendation:{rating:5,label:'Promoted replay',sourceUrls:entry.sources,reviewedAt:entry.researchedAt}}:{})};
    };
    feed.events=feed.events.map(event=>enrich(event));
    majorEvents.events=majorEvents.events.map(parent=>({...parent,...(parent.subEvents?{subEvents:parent.subEvents.map(event=>enrich(event,true))}:{})}));
  }
  const issues=narrative.validateKnowledge(knowledge);if(issues.length)throw new Error(issues.join('\n'));
  return {knowledge,feed,majorEvents};
}
if(require.main===module){
  const files=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/major-events.v1.json'];
  const values=files.map(file=>JSON.parse(fs.readFileSync(file)));
  const result=apply(...values,JSON.parse(fs.readFileSync('data/editorial-fixture-research.v1.json')));
  [result.knowledge,result.feed,result.majorEvents].forEach((value,i)=>fs.writeFileSync(files[i],JSON.stringify(value,null,2)+'\n'));
  console.log('Applied independently researched fixture narratives and editorial replay recommendations.');
}
module.exports={apply};
