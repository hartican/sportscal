'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {apply}=require('./apply-fixture-research');
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
function main(args){
  const range=weekend(),published=read('data/events.json');
  const catalogue=require('../config/fixture-identity').mergeOverlays(read('data/follow-sources/coverage.v1.json').events,read('data/discovery/enrichment.v1.json').events);
  const knowledge=read('data/editorial-knowledge.v1.json');
  const narrative=require('./lib/editorial-narrative'),indexes=narrative.indexesFor(knowledge);
  const projections=new Map(knowledge.eventProjections.filter(p=>p.targetType==='feed-event').flatMap(p=>p.targetIds.map(id=>[id,p])));
  const candidates=[...new Map([...catalogue,...published.events].map(event=>[event.id,event])).values()].map(event=>{
    const projection=[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].map(id=>projections.get(id)).find(Boolean);
    return projection?{...event,editorialNarrative:narrative.editorialNarrativeFor(projection,indexes)}:event;
  });
  const cards=selected(candidates,range);
  if(args.includes('--list')){console.log(JSON.stringify({weekend:range,cards:cards.map(e=>({id:e.id,name:e.name,date:e.date,stakes:e.storyline?.stakes??e.stakesScore,hook:e.editorialNarrative?.hook||e.selectedSentence}))},null,2));return;}
  if(!cards.length){console.log('No qualifying weekend cards; no changes.');return;}
  const index=args.indexOf('--research');assert(index>=0&&args[index+1],'Provide --research <dated JSON file>, or --list first.');
  const research=read(args[index+1]);assert.deepEqual(research.weekend,range,'Research must cover the current Sydney Friday-Monday only.');
  const ids=new Set(cards.map(e=>e.id));
  assert.equal(research.entries.length,ids.size,'Research must cover every qualifying card exactly once.');
  assert.equal(new Set(research.entries.map(e=>e.id)).size,ids.size,'Duplicate research IDs.');
  for(const entry of research.entries){assert(ids.has(entry.id),'Out-of-scope research: '+entry.id);assert(entry.sources?.length&&entry.facts?.length>=3,'Source-backed research facts required.');assert(Date.now()-Date.parse(entry.researchedAt)<72*3600000&&Date.parse(entry.researchedAt)<=Date.now()+60000,'Research must be fresh.');}
  validateEditorialFocus(cards,research);
  if(/^[a-z0-9-]+$/.test(published.version)&&cards.every(e=>{const r=research.entries.find(r=>r.id===e.id);return e.editorialNarrative?.hook===r.hook&&e.editorialNarrative?.synopsis===r.synopsis;})){console.log('Weekend editorial unchanged; no release required.');return;}
  const incoming=read('feeds/incoming/events.json'),major=read('data/major-events.v1.json');
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
  console.log(`Weekend editorial complete: ${cards.length} cards, ${range.from} through ${range.to}. Non-editorial card fields preserved.`);
}
module.exports={main,weekend,selected};
