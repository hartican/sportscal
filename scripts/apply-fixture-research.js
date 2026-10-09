#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const narrative=require('./lib/editorial-narrative');
function apply(knowledge,feed,majorEvents,research,catalogue=[]){
  const retention=require('../data/canonical/cricket-retention.v1.json');
  const retired=new Set((retention.retiredFixtureIds||[]).filter(id=>!retention.fixtureIds.includes(id)));
  knowledge.eventProjections=knowledge.eventProjections.map(p=>p.targetType==='feed-event'?{...p,targetIds:p.targetIds.filter(id=>!retired.has(id))}:p).filter(p=>p.targetIds.length);
  const upsert=(field,value)=>{const index=knowledge[field].findIndex(row=>row.id===value.id);if(index<0)knowledge[field].push(value);else knowledge[field][index]=value;};
  for(const entry of research.entries){
    if(retired.has(entry.id))continue;
    if(require('../config/coverage-pauses').womensT20({key:'cricket',name:entry.title}))continue;
    const fixturePrefix=`fixture-research:${entry.id.replace(/[^a-z0-9:._-]/g,'-')}`;
    // Evidence is immutable: sibling projections can still reference an older
    // research revision after this fixture is refreshed. Identical retries reuse it.
    const revision=crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    const prefix=`${fixturePrefix}:revision-${revision}`;
    const overview=entry.id.match(/^tennis-tournament-(.+)-\d{4}-\d{2}-\d{2}$/);
    const targets=[...feed.events,...catalogue];
    const targetIds=[...new Set(targets.filter(event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].includes(entry.id) || overview && event.tennisTournamentId===`tournament:tennis:${overview[1]}` && ['tournament_overview','tennis_parent'].includes(event.cardType)).map(event=>event.id))];
    if(!targetIds.length)throw new Error('Missing researched fixture '+entry.id);
    // A copy refresh must not rename an exclusively owned projection. Shared
    // projections are split without rewriting their unrelated targets.
    const existing=narrative.projectionForTarget(knowledge,'feed-event',{id:entry.id}) || knowledge.eventProjections.find(p=>p.targetType==='feed-event'&&p.targetIds.some(id=>targetIds.includes(id)));
    const fallback=`projection:${fixturePrefix}`;
    let projectionId=existing&&existing.targetIds.every(id=>targetIds.includes(id))?existing.id:fallback;
    let suffix=0;
    while(knowledge.eventProjections.some(p=>p.id===projectionId&&(p.targetType!=='feed-event'||p.targetIds.some(id=>!targetIds.includes(id)))))projectionId=`${fallback}:scope-${++suffix}`;
    const subjectId=`subject:${prefix}`,threadId=`thread:${prefix}`;
    const sourceIds=entry.sources.map((url,index)=>`source:${prefix}:${index}`);
    upsert('subjects',{id:subjectId,kind:'event',name:entry.title});
    entry.sources.forEach((url,index)=>upsert('sources',{id:sourceIds[index],name:`${entry.title} — official research ${index+1}`,url,sourceType:'official',checkedAt:entry.researchedAt}));
    const factIds=entry.facts.map((fact,index)=>{
      const id=`fact:${prefix}:${index}`;
      upsert('narrativeFacts',{id,subjectIds:[subjectId],statement:fact.statement,dimension:fact.dimension,sourceIds:fact.sourceIndexes.map(index=>sourceIds[index]),observedAt:entry.researchedAt,expiresAt:null});return id;
    });
    upsert('narrativeThreads',{id:threadId,subjectIds:[subjectId],title:entry.title,summary:entry.synopsis,factIds,status:entry.promotedReplay?'resolved':'active',updatedAt:entry.researchedAt});
    knowledge.eventProjections=knowledge.eventProjections.map(projection=>projection.targetType==='feed-event'?{...projection,targetIds:projection.targetIds.filter(id=>id!==entry.id&&!targetIds.includes(id))}:projection).filter(projection=>projection.targetIds.length);
    const projection={id:projectionId,targetType:'feed-event',targetIds,researchDepth:entry.researchDepth || 5,hook:entry.hook,synopsis:entry.synopsis,...(entry.formCopy?{formCopy:entry.formCopy}:{}),...(entry.closingCopy?{closingCopy:entry.closingCopy}:{}),threadIds:[threadId],factIds,sourceIds,researchedAt:entry.researchedAt,editorialPhase:entry.editorialPhase||'preview',refreshAfter:entry.promotedReplay||entry.editorialPhase==='recap'?null:(entry.refreshAfter || [...feed.events,...catalogue].find(event=>targetIds.includes(event.id))?.startTimeUtc || null),generationMode:'researched',originalityReview:{method:'independent-summary-no-source-prose-retained',reviewedAt:entry.researchedAt},...(entry.hookSpoilerOn?{hookSpoilerOn:entry.hookSpoilerOn,synopsisSpoilerOn:entry.synopsisSpoilerOn}:{})};
    Object.assign(projection,require('../config/editorial-locks').projection([...feed.events,...catalogue].find(event=>targetIds.includes(event.id))||{id:entry.id},projection));
    knowledge.eventProjections.push(projection);
    const indexes=narrative.indexesFor(knowledge);
    const enrich=(event,child=false)=>{
      if(!targetIds.includes(event.id))return event;
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
  const catalogue=[...JSON.parse(fs.readFileSync('data/follow-sources/coverage.v1.json')).events,...JSON.parse(fs.readFileSync('data/events.json')).events,...JSON.parse(fs.readFileSync('data/tennis-feed-parents.v1.json')).parents];
  const result=apply(...values,JSON.parse(fs.readFileSync('data/editorial-fixture-research.v1.json')),catalogue);
  [result.knowledge,result.feed,result.majorEvents].forEach((value,i)=>fs.writeFileSync(files[i],JSON.stringify(value,null,2)+'\n'));
  console.log('Applied independently researched fixture narratives and editorial replay recommendations.');
}
module.exports={apply};
