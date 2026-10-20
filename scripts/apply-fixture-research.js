#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const narrative=require('./lib/editorial-narrative');
const cricket=require('../config/cricket-editorial-policy'),evidence=require('./lib/cricket-editorial-evidence');
function apply(knowledge,feed,majorEvents,research,catalogue=[],{now=new Date()}={}){
  const retention=require('../data/canonical/cricket-retention.v1.json');
  const retired=new Set((retention.retiredFixtureIds||[]).filter(id=>!retention.fixtureIds.includes(id)));
  if(research.scope!=='horse-flagships')knowledge.eventProjections=knowledge.eventProjections.map(p=>p.targetType==='feed-event'?{...p,targetIds:p.targetIds.filter(id=>!retired.has(id))}:p).filter(p=>p.targetIds.length);
  const upsert=(field,value)=>{const index=knowledge[field].findIndex(row=>row.id===value.id);if(index<0)knowledge[field].push(value);else knowledge[field][index]=value;};
  for(const entry of research.entries){
    // Undated Horse editions use this same researched document as Events
    // context. They cannot become fixture projections before a dated edition.
    if(entry.id.startsWith('event:horse-racing:')&&require('../feeds/provider-exports/horse-racing/marquee-calendar.v1.json').entries.some(r=>r.id===entry.id&&!r.date))continue;
    if(retired.has(entry.id))continue;
    if(require('../config/coverage-pauses').womensT20({key:'cricket',name:entry.title}))continue;
    const fixturePrefix=`fixture-research:${entry.id.replace(/[^a-z0-9:._-]/g,'-')}`;
    // Evidence is immutable: sibling projections can still reference an older
    // research revision after this fixture is refreshed. Identical retries reuse it.
    const revision=crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    const prefix=`${fixturePrefix}:revision-${revision}`;
    const overview=entry.id.match(/^tennis-tournament-(.+)-\d{4}-\d{2}-\d{2}$/);
    const targets=[...feed.events,...catalogue];
    const idsFor=event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].filter(Boolean);
    const targetIds=[...new Set(targets.filter(event=>idsFor(event).includes(entry.id) || overview && event.tennisTournamentId===`tournament:tennis:${overview[1]}` && ['tournament_overview','tennis_parent'].includes(event.cardType)).flatMap(idsFor))];
    if(!targetIds.length)throw new Error('Missing researched fixture '+entry.id);
    const fixture=targets.find(event=>idsFor(event).includes(entry.id));
    const cricketResearch=cricket.isCricket(fixture)&&cricket.hasPolicy(entry);
    let retainedEvidence;
    if(cricketResearch){
      // Reprojecting immutable, already reviewed history must not renew its
      // deadline or block fixture refresh when that editorial has expired.
      const retained=retainedEvidence=knowledge.eventProjections.find(p=>p.cricketEvidence&&JSON.stringify(p.cricketEvidence.entry)===JSON.stringify(entry))?.cricketEvidence;
      const issues=evidence.issues(entry,retained?.fixture||fixture,retained?new Date(retained.reviewedAt):now);
      if(issues.length)throw new Error(entry.id+': '+issues.join(' '));
    }
    // A copy refresh must not rename an exclusively owned projection. Shared
    // projections are split without rewriting their unrelated targets.
    const fallback=`projection:${fixturePrefix}`;
    // Provider aliases explicitly attached to the fixture are the same target,
    // not unrelated siblings. Recover its established identity after an older
    // refresh split canonical and provider IDs into competing projections.
    const matches=knowledge.eventProjections.filter(p=>p.targetType==='feed-event'&&p.targetIds.some(id=>targetIds.includes(id)));
    const existing=matches.find(p=>p.id!==fallback&&p.targetIds.every(id=>targetIds.includes(id))) || narrative.projectionForTarget(knowledge,'feed-event',{id:entry.id}) || matches[0];
    let projectionId=existing&&existing.targetIds.every(id=>targetIds.includes(id))?existing.id:fallback;
    let suffix=0;
    while(knowledge.eventProjections.some(p=>p.id===projectionId&&(p.targetType!=='feed-event'||p.targetIds.some(id=>!targetIds.includes(id)))))projectionId=`${fallback}:scope-${++suffix}`;
    const subjectId=`subject:${prefix}`,threadId=`thread:${prefix}`;
    const sourceIds=entry.sources.map((url,index)=>`source:${prefix}:${index}`);
    upsert('subjects',{id:subjectId,kind:'event',name:entry.title});
    const observations=entry.sourceObservations;
    if(observations!==undefined && (!Array.isArray(observations) || observations.length!==entry.sources.length))throw new Error('Incomplete research source observations for '+entry.id);
    entry.sources.forEach((url,index)=>{
      const observation=observations?.[index];
      if(observations && (!observation || observation.url!==url || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(observation.checkedAt || '') || !Number.isFinite(Date.parse(observation.checkedAt)) || new Date(observation.checkedAt).toISOString().slice(0,19)!==observation.checkedAt.slice(0,19) || Date.parse(observation.checkedAt)>Date.parse(entry.researchedAt)))throw new Error('Invalid research source observation for '+entry.id);
      upsert('sources',{id:sourceIds[index],name:observation?.name || `${entry.title} — official research ${index+1}`,url,sourceType:observation?.sourceType || 'official',checkedAt:observation?.checkedAt || entry.researchedAt,...(cricketResearch?Object.fromEntries(['publisher','author','originId','reportingType','publishedAt','updatedAt','retrievedAt','accessible'].map(key=>[key,observation[key]??null])):{})});
    });
    const factIds=entry.facts.map((fact,index)=>{
      const id=`fact:${prefix}:${index}`;
      const observedAt=observations ? new Date(Math.max(...fact.sourceIndexes.map(index=>Date.parse(observations[index]?.checkedAt)))).toISOString() : entry.researchedAt;
      upsert('narrativeFacts',{id,subjectIds:[subjectId],statement:fact.statement,dimension:fact.dimension,sourceIds:fact.sourceIndexes.map(index=>sourceIds[index]),observedAt,expiresAt:cricketResearch?fact.expiresAt||entry.validUntil:null,...(cricketResearch?{claimType:fact.claimType,attribution:fact.attribution||null,claimId:fact.claimId,support:fact.support,contradictorySupport:fact.contradictorySupport||[],agreement:fact.agreement===true}:{})});return id;
    });
    upsert('narrativeThreads',{id:threadId,subjectIds:[subjectId],title:entry.title,summary:entry.synopsis||entry.hook||'',...(cricketResearch?{editorialPolicyVersion:cricket.version}:{}),factIds,status:entry.promotedReplay?'resolved':'active',updatedAt:entry.researchedAt});
    knowledge.eventProjections=knowledge.eventProjections.map(projection=>projection.targetType==='feed-event'?{...projection,targetIds:projection.targetIds.filter(id=>id!==entry.id&&!targetIds.includes(id))}:projection).filter(projection=>projection.targetIds.length);
    const projection={id:projectionId,targetType:'feed-event',targetIds,researchDepth:entry.researchDepth || 5,hook:entry.hook,synopsis:entry.synopsis,...(entry.formCopy?{formCopy:entry.formCopy}:{}),...(entry.closingCopy?{closingCopy:entry.closingCopy}:{}),threadIds:[threadId],factIds,sourceIds,researchedAt:entry.researchedAt,editorialPhase:entry.editorialPhase||'preview',refreshAfter:entry.promotedReplay||entry.editorialPhase==='recap'?null:(entry.refreshAfter || [...feed.events,...catalogue].find(event=>targetIds.includes(event.id))?.startTimeUtc || null),generationMode:'researched',originalityReview:{method:'independent-summary-no-source-prose-retained',reviewedAt:entry.researchedAt},...(entry.hookSpoilerOn?{hookSpoilerOn:entry.hookSpoilerOn,synopsisSpoilerOn:entry.synopsisSpoilerOn}:{})};
    if(cricketResearch)Object.assign(projection,evidence.metadata(entry),{cricketEvidence:retainedEvidence||{entry,fixture:{id:fixture.id,key:'cricket',status:fixture.status,startTimeUtc:fixture.startTimeUtc},reviewedAt:entry.editorialReview.reviewedAt}});
    Object.assign(projection,require('../config/editorial-locks').projection([...feed.events,...catalogue].find(event=>targetIds.includes(event.id))||{id:entry.id},projection));
    knowledge.eventProjections.push(projection);
    const indexes=narrative.indexesFor(knowledge);
    const enrich=(event,child=false)=>{
      if(!targetIds.includes(event.id))return event;
      if(child){const clean={...event};for(const key of ['selectedSentence','fullSpiel','sourceName','sourceType','sourceCheckedAt','lastReviewedAt','editorialPreview'])delete clean[key];return {...clean,editorialNarrative:narrative.editorialNarrativeFor(projection,indexes)};}
      return {...narrative.applyToFeedEvent(event,projection,indexes,now),...(entry.promotedReplay?{editorialReplayRecommendation:{rating:5,label:'Promoted replay',sourceUrls:entry.sources,reviewedAt:entry.researchedAt}}:{})};
    };
    feed.events=feed.events.map(event=>enrich(event));
    majorEvents.events=majorEvents.events.map(parent=>({...parent,...(parent.subEvents?{subEvents:parent.subEvents.map(event=>enrich(event,true))}:{})}));
  }
  const issues=narrative.validateKnowledge(knowledge);if(issues.length)throw new Error(issues.join('\n'));
  return {knowledge,feed,majorEvents};
}
function projectHorseFeed(feed,knowledge){
  const indexes=narrative.indexesFor(knowledge);
  return {...feed,events:feed.events.map(event=>{
    if(event.key!=='horse-racing'&&event.sportKey!=='horse-racing')return event;
    const projection=narrative.projectionForTarget(knowledge,'feed-event',event);
    return projection?narrative.applyToFeedEvent(event,projection,indexes):event;
  })};
}
if(require.main===module){
  const files=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/major-events.v1.json'];
  const values=files.map(file=>JSON.parse(fs.readFileSync(file)));
  const catalogue=[...JSON.parse(fs.readFileSync('data/follow-sources/coverage.v1.json')).events,...JSON.parse(fs.readFileSync('data/events.json')).events,...JSON.parse(fs.readFileSync('data/tennis-feed-parents.v1.json')).parents];
  const research=JSON.parse(fs.readFileSync('data/editorial-fixture-research.v1.json'));
  if(process.argv.includes('--horse-only')){research.scope='horse-flagships';research.entries=research.entries.filter(e=>e.id.startsWith('event:horse-racing:'));}
  evidence.assertPublicationApproved(research.entries);
  const result=apply(...values,research,catalogue);
  // Retain the current published sporting observations outside this scope.
  // Publishing the entire incoming document here could replace newer scores.
  const published=research.scope==='horse-flagships'?projectHorseFeed(JSON.parse(fs.readFileSync('data/events.json')),result.knowledge):null;
  [result.knowledge,result.feed,result.majorEvents].forEach((value,i)=>fs.writeFileSync(files[i],JSON.stringify(value,null,2)+'\n'));
  if(published)fs.writeFileSync('data/events.json',JSON.stringify(published,null,2)+'\n');
  console.log('Applied independently researched fixture narratives and editorial replay recommendations.');
}
module.exports={apply,projectHorseFeed};
