'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {apply}=require('./apply-fixture-research');
const locks=require('../config/editorial-locks');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function weekend(now=new Date()){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const date=new Date(day+'T12:00:00Z'),weekday=date.getUTCDay();
  date.setUTCDate(date.getUTCDate()+(weekday===0?-2:weekday===1?-3:weekday===6?-1:(5-weekday+7)%7));
  const from=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+3);
  return {from,to:date.toISOString().slice(0,10)};
}
function selected(events,range){return events.filter(e=>e.date>=range.from&&e.date<=range.to&&Number(e.storyline?.stakes??e.stakesScore)>=4&&Number(e.storyline?.stakes??e.stakesScore)<=5);}
function participantNames(event){
  return [...new Set((event.participants||[]).flatMap(participant=>[
    participant.name,participant.displayName,...(participant.aliases||[]),
  ]).filter(Boolean).map(String))];
}
function mentions(text,name){
  const copy=String(text||'').toLowerCase();
  return [name,...(name.split(/\s+/).length>1?[name.split(/\s+/)[0]]:[])].some(alias=>
    new RegExp(`\\b${String(alias).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').toLowerCase()}\\b`).test(copy)
  );
}
function validateEditorialFocus(cards,research){
  const byCompetition=new Map();
  cards.forEach(card=>{const key=card.competitionId||card.key||'unknown';const group=byCompetition.get(key)||[];group.push(card);byCompetition.set(key,group);});
  const fingerprints=new Set();
  for(const entry of research.entries){
    const card=cards.find(candidate=>candidate.id===entry.id);if(!card)continue;
    const group=byCompetition.get(card.competitionId||card.key||'unknown')||[];
    const ownNames=new Set(participantNames(card).map(name=>name.toLowerCase()));
    const opponents=group.filter(candidate=>candidate.id!==card.id).flatMap(participantNames)
      .filter(name=>!ownNames.has(name.toLowerCase()));
    const copy=`${entry.hook} ${entry.synopsis}`;
    const unrelated=[...new Set(opponents.filter(name=>mentions(copy,name)))];
    assert.equal(unrelated.length,0,`${entry.id} editorial mentions other selected teams: ${unrelated.join(', ')}`);
    const fingerprint=`${entry.hook}\u0000${entry.synopsis}`;
    assert(!fingerprints.has(fingerprint),`${entry.id} duplicates another selected card's editorial.`);
    fingerprints.add(fingerprint);
  }
}
function partitionResearch(cards,research,validateEntry=()=>{}){
  const scope=new Set(cards.map(card=>card.id)),accepted=[],deferred=new Map();
  assert(Array.isArray(research.entries),'Research entries must be an array.');
  for(const item of [...research.entries,...(research.deferred||[])])assert(scope.has(item.id),'Out-of-scope research: '+item.id);
  for(const item of research.deferred||[]){
    assert(item.reason&&item.nextAction,'Deferred cards require a reason and nextAction.');
    deferred.set(item.id,item);
  }
  for(const card of cards){
    if(deferred.has(card.id))continue;
    try{
      const entries=research.entries.filter(entry=>entry.id===card.id);
      assert.equal(entries.length,1,'Missing or duplicate research entry.');
      const entry=entries[0];
      assert(entry.title&&entry.hook&&entry.synopsis,'Title, hook and synopsis required.');
      assert(new Set(entry.sources).size>=3&&entry.facts?.length>=4,'Three sources and four supported facts required.');
      assert(entry.sources.every(url=>/^https:\/\//.test(url)),'HTTPS sources required.');
      assert(entry.facts.every(fact=>fact.statement&&fact.dimension&&fact.sourceIndexes?.length&&fact.sourceIndexes.every(i=>Number.isInteger(i)&&i>=0&&i<entry.sources.length)),'Invalid fact/source references.');
      assert(Date.now()-Date.parse(entry.researchedAt)<72*3600000&&Date.parse(entry.researchedAt)<=Date.now()+60000,'Research must be fresh.');
      assert((entry.dependsOn||[]).every(id=>scope.has(id)),'Unknown dependency.');
      validateEditorialFocus(cards,{entries:[...accepted,entry]});
      validateEntry(entry);
      accepted.push(entry);
    }catch(error){deferred.set(card.id,{id:card.id,reason:error.message,nextAction:'Repair this card research and retry through the canonical weekend mode.'});}
  }
  let changed=true;
  while(changed){changed=false;for(const entry of accepted){if(deferred.has(entry.id))continue;const blockers=(entry.dependsOn||[]).filter(id=>deferred.has(id));if(blockers.length){deferred.set(entry.id,{id:entry.id,reason:'Direct research dependency unavailable.',dependsOn:blockers,nextAction:'Resolve the listed dependency before retrying this card.'});changed=true;}}}
  return {entries:accepted.filter(entry=>!deferred.has(entry.id)),deferred:[...deferred.values()]};
}
function main(args,options={}){
  const range=options.range||weekend(),mode=options.mode||'weekend',rangeKey=options.rangeKey||'weekend',published=read('data/events.json');
  const catalogue=require('../config/fixture-identity').mergeOverlays(read('data/follow-sources/coverage.v1.json').events,read('data/discovery/enrichment.v1.json').events);
  const knowledge=read('data/editorial-knowledge.v1.json');
  const narrative=require('./lib/editorial-narrative'),indexes=narrative.indexesFor(knowledge);
  const projections=new Map(knowledge.eventProjections.filter(p=>p.targetType==='feed-event').flatMap(p=>p.targetIds.map(id=>[id,p])));
  const candidates=[...new Map([...catalogue,...published.events].map(event=>[event.id,event])).values()].map(event=>{
    const projection=[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].map(id=>projections.get(id)).find(Boolean);
    return projection?{...event,editorialNarrative:narrative.editorialNarrativeFor(projection,indexes)}:event;
  });
  const maintenance=require('../config/editorial-maintenance');
  let cards=(options.cards||selected(candidates,range)).filter(event=>!locks.activeFor(event)&&!maintenance.protectedFixture(event));
  if(args.includes('--list')){console.log(JSON.stringify({weekend:range,cards:cards.map(e=>({id:e.id,name:e.name,date:e.date,stakes:e.storyline?.stakes??e.stakesScore,hook:e.editorialNarrative?.hook||e.selectedSentence}))},null,2));return;}
  if(!cards.length){console.log('No qualifying editorial cards; no changes.');return {updatedIds:[],deferred:[]};}
  const index=args.indexOf('--research');assert(index>=0&&args[index+1],'Provide --research <dated JSON file>, or --list first.');
  const research=read(args[index+1]);assert.deepEqual(research[rangeKey],range,'Research range must match the selected Sydney editorial window.');
  const baselineIssues=narrative.validateKnowledge(knowledge);
  assert.equal(baselineIssues.length,0,'Shared knowledge integrity failure: '+baselineIssues.join('; '));
  const major=read('data/major-events.v1.json');
  const partition=partitionResearch(cards,research,entry=>{
    if(mode==='adaptive')assert(entry.formCopy&&entry.closingCopy,'Full Hook/Form/Storyline/Match Context required.');
    apply(structuredClone(knowledge),{...published,events:structuredClone(candidates)},structuredClone(major),{entries:[entry]});
  });
  research.entries=partition.entries;
  const ids=new Set(research.entries.map(entry=>entry.id));
  const report={weekend:range,acceptedIds:[...ids],deferred:partition.deferred};
  write(`data/editorial-${mode}-report-${range.from}.json`,report);
  for(const item of partition.deferred)console.warn(`Deferred ${item.id}: ${item.reason} Next: ${item.nextAction}`);
  cards=cards.filter(card=>ids.has(card.id));
  if(!cards.length){console.log('No independently valid research; deferred report saved. No feed changes.');return {updatedIds:[],deferred:partition.deferred};}
  const incoming=read('feeds/incoming/events.json');
  const publication=require('./lib/editorial-publication');
  if(/^[a-z0-9-]+$/.test(published.version)&&cards.every(e=>maintenance.equalCopy(maintenance.copy(e),research.entries.find(r=>r.id===e.id))&&!publication.publicationMismatch(e,published.events)&&!publication.publicationMismatch(e,incoming.events))){console.log('Editorial unchanged; no release required.');return {updatedIds:[],deferred:partition.deferred};}
  const result=apply(knowledge,{...published,events:structuredClone(candidates)},major,research);
  const updated=new Map(result.feed.events.filter(e=>ids.has(e.id)).map(e=>[e.id,e]));
  const fields=['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline'];
  const patch=e=>{const source=updated.get(e.id);if(!source)return e;return {...e,...Object.fromEntries(fields.map(k=>[k,source[k]]))};};
  result.feed.events=published.events.map(patch);incoming.events=incoming.events.map(patch);
  for(let i=0;i<published.events.length;i++){const before=published.events[i],after=result.feed.events[i];if(!ids.has(before.id))assert.deepEqual(after,before);else for(const key of Object.keys(before).filter(k=>!fields.includes(k)))assert.deepEqual(after[key],before[key],'Non-editorial field changed: '+key);}
  const stamp=new Date().toISOString();result.feed.version='weekend-editorial-'+stamp.replace(/[^0-9]/g,'');assert(/^[a-z0-9-]+$/.test(result.feed.version),'Feed version must be a lowercase slug before writing outputs.');result.feed.publishedAt=stamp;
  incoming.version=result.feed.version;incoming.publishedAt=stamp;
  const prior=read('data/editorial-fixture-research.v1.json');prior.entries=[...prior.entries.filter(e=>!ids.has(e.id)),...research.entries];
  write('data/editorial-fixture-research.v1.json',prior);write('data/editorial-knowledge.v1.json',result.knowledge);
  write('feeds/incoming/events.json',incoming);write('data/events.json',result.feed);
  write('data/feed-meta.json',{...read('data/feed-meta.json'),version:result.feed.version,publishedAt:stamp});
  fs.writeFileSync('data/events.js','/* Generated by scripts/publish-feed.js. Do not edit directly. */\nglobalThis.NOTHINGSPORTS_EVENTS = '+JSON.stringify(result.feed.events,null,2)+';\n');
  const codes=[...new Set(cards.flatMap(e=>e.key==='motogp'?['motogp','motorsport']:[e.key]))];
  for(const command of [['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js','--codes='+codes.join(',')],['scripts/qa-storyline-spoilers.js','data/events.json'],['scripts/validate-feed.js','data/events.json']]){
    const run=spawnSync(process.execPath,command,{stdio:'inherit'});assert.equal(run.status,0,command[0]+' failed; do not release.');
  }
  console.log(`${mode} editorial complete: ${cards.length} cards, ${partition.deferred.length} deferred, ${range.from} through ${range.to}. Non-editorial card fields preserved.`);
  return {updatedIds:cards.map(c=>c.id),acceptedIds:[...ids],deferred:partition.deferred};
}
module.exports={main,weekend,selected,partitionResearch};
