'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
function validate(){
 const ui=require('../../config/racing-details'),model=require('../../config/match-centre'),identity=require('../../config/fixture-identity');
 const raw={schema:'racing.v1',kind:'horse',provider:'Racing Australia',phase:'acceptances',checkedAt:'2026-10-11T12:37:29.370Z',raceNumber:8,form:'forbidden',odds:'forbidden',bettingTips:'forbidden',entries:[{id:'horse:a',name:'SOURCE (IRE)',number:'10',barrier:'10',weight:'56.5kg',trainer:'Trainer A',jockey:null,form:'forbidden',odds:'forbidden',bettingTips:'forbidden',bettingAnalysis:'forbidden',position:'1',margin:'2L'},{id:'horse:b',name:'SOURCE B (FR)',number:'2',barrier:'2',weight:'52.5kg'},{id:'horse:c',name:'SOURCE C',number:null,barrier:null,weight:null}]};
 assert.throws(()=>ui.sanitizeHorseDetail({...raw,entries:Array.from({length:101},(_,i)=>({id:String(i),name:'Controlled'}))}),/Incomplete/);assert.throws(()=>ui.sanitizeHorseDetail({...raw,entries:[raw.entries[0],raw.entries[0]]}),/Incomplete/);
 const before=JSON.stringify(raw),clean=ui.sanitizeHorseDetail(raw);assert.equal(JSON.stringify(raw),before,'Sanitization cannot mutate source observations');
 assert(!JSON.stringify(clean).includes('forbidden'));assert.equal(clean.entries[0].countryCode,'IE');assert.equal(clean.entries[1].countryCode,'FR');assert(!Object.hasOwn(clean.entries[2],'countryCode'),'No country inferred from local venue/trainer');assert.equal(clean.checkedAt,raw.checkedAt);assert.equal(clean.raceNumber,8,'Programme number is not a horse number');
 assert.deepEqual(ui.horseEntries(raw).map(e=>e.id),['horse:b','horse:a','horse:c'],'Gate2 precedes10, missing last');
 const weights={...raw,entries:raw.entries.map(e=>({...e,barrier:null}))};assert.deepEqual(ui.horseEntries(weights).map(e=>e.id),['horse:a','horse:b','horse:c'],'Weights descend numerically before gates');
 const tie={...raw,entries:[{id:'b',name:'Same',number:'10',weight:'50kg'},{id:'a',name:'Same',number:'2',weight:'50kg'},{id:'c',name:'A',number:null,weight:'50kg'}]};assert.deepEqual(ui.horseEntries(tie).map(e=>e.id),['a','b','c']);
 assert.equal(ui.numeric('2.5','gate'),null);assert.equal(ui.numeric('0','gate'),null);assert.equal(ui.numeric('56.5kg'),56.5);assert.equal(ui.numeric('2e','number'),2);assert.equal(ui.horseIdentity({name:'H (USA)'}).countryCode,'US');assert.equal(ui.horseIdentity({name:'H (XYZ)'}).countryCode,null);assert.equal(ui.horseIdentity({name:'H',trainer:'Australian trainer',venueCountryCode:'AU'}).countryCode,null);
 const fixture={id:'event:horse-racing:melbourne-cup:2026',key:'horse-racing',date:'2026-11-03',name:'Melbourne Cup',score:{racing:raw}};
 for(const value of [model.compact(fixture,{racing:true}),identity.normalizeCore(fixture),require('./feed-utils').normalizeFeed({events:[fixture]})])assert(!JSON.stringify(value).includes('forbidden'),'All existing public projections sanitize retained fields');
 assert.equal(ui.horseLabel({...raw,phase:'official-result'},false),'Race field');assert.equal(ui.horseLabel(raw,false),'Early entries');
 const research=JSON.parse(fs.readFileSync('data/editorial-fixture-research.v1.json')),entries=research.entries.filter(e=>e.id.startsWith('event:horse-racing:'));
 assert.equal(entries.length,12);assert.equal(new Set(entries.map(e=>e.id)).size,12);assert(entries.every(e=>e.hook&&e.synopsis&&e.closingCopy&&!/unconfirmed|unavailable|subject to|entry.stage|nominations|acceptances|odds|betting|ballot/i.test(e.hook+' '+e.synopsis+' '+e.closingCopy)));
 const knowledge=JSON.parse(fs.readFileSync('data/editorial-knowledge.v1.json')),feed=JSON.parse(fs.readFileSync('feeds/incoming/events.json')),major=JSON.parse(fs.readFileSync('data/major-events.v1.json')),catalogue=[...JSON.parse(fs.readFileSync('data/events.json')).events,...JSON.parse(fs.readFileSync('data/event-overviews.v1.json')).events.filter(e=>e.sportKey==='horse-racing'&&e.calendarPending)];
 const unrelated=JSON.stringify(feed.events.filter(e=>e.key!=='horse-racing'));
 const result=require('../apply-fixture-research').apply(knowledge,feed,major,{...research,scope:'horse-flagships',entries},catalogue);
 assert.equal(JSON.stringify(result.feed.events.filter(e=>e.key!=='horse-racing')),unrelated,'Horse research cannot rewrite unrelated fixtures');
 const current={events:[{id:'unrelated:newer',key:'tennis',score:{home:7,away:5},scoreCheckedAt:'2026-10-13T09:00:00Z'},fixture]},currentBefore=JSON.stringify(current);
 const published=require('../apply-fixture-research').projectHorseFeed(current,result.knowledge);
 assert.equal(published.events[0],current.events[0],'Scoped publication preserves newer unrelated published observations by reference');assert.equal(JSON.stringify(current),currentBefore,'Scoped publication cannot mutate input');assert(published.events[1].editorialNarrative?.projectionId);
 const narrative=require('./editorial-narrative');assert.deepEqual(narrative.validateKnowledge(result.knowledge),[]);
 const review=require('../../feeds/provider-exports/horse-racing/marquee-calendar.v1.json'),dated=new Set(review.entries.filter(e=>e.date).map(e=>e.id));
 const projections=entries.filter(e=>dated.has(e.id)).map(e=>narrative.projectionForTarget(result.knowledge,'feed-event',{id:e.id}));assert.equal(projections.length,9);assert(projections.every(Boolean));assert(projections.every(p=>p.researchDepth>=4));
 for(const e of entries.filter(e=>!dated.has(e.id)))assert(!narrative.projectionForTarget(result.knowledge,'feed-event',{id:e.id}),'Pending stories cannot manufacture fixture projections');
 const completedHorse=narrative.applyToFeedEvent({...fixture,status:'completed',score:{racing:raw}},projections[0],narrative.indexesFor(result.knowledge));assert.equal(completedHorse.status,'completed');assert.equal(completedHorse.selectedSentence,projections[0].hook);assert(!completedHorse.fullSpiel.includes('[object Object]'));assert.equal(completedHorse.score.racing,raw,'Editorial cannot rewrite finishing facts');
 for(const visible of [false,true])assert.deepEqual(require('../../config/editorial-lifecycle').copy(completedHorse,completedHorse.editorialNarrative,visible),{hook:projections[0].hook,synopsis:projections[0].synopsis},'Completed Horse cards retain neutral stories independently of separate Results controls');
 const pending=require('../../lib/event-overviews').build([]).filter(e=>e.sportKey==='horse-racing');assert.equal(pending.length,3);assert(pending.every(e=>e.calendarPending&&!e.date&&!e.startTimeUtc&&e.hook&&e.context),'Pending stories do not manufacture fixtures/clocks');
 assert(fs.readFileSync('scripts/update-cards.js','utf8').includes('--horse-presentation-only'));assert(fs.readFileSync('config/racing-details.js','utf8').includes('tel:1800858858'));
 console.log('Horse fields: numeric gates/weights/ties/countries, source immutability, collection/public/API allowlists,12valid researched stories and3untimed context editions passed. No provider/customer writes.');
}
async function validateRetained(){
 const path=require('node:path'),os=require('node:os'),root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-horse-presentation-'));
 try{
  const review=JSON.parse(fs.readFileSync('feeds/provider-exports/horse-racing/marquee-calendar.v1.json')),prior=JSON.parse(fs.readFileSync('data/canonical/horse-features.v1.json'));
  for(const [file,value] of [['feeds/provider-exports/horse-racing/marquee-calendar.v1.json',review],['data/canonical/horse-features.v1.json',prior]]){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(value));}
  let requests=0;await require('../refresh-horse-racing').refresh({root,presentationOnly:true,now:new Date('2026-10-13T09:00:00Z'),fetchImpl:async()=>{requests++;throw Error('Forbidden presentation provider read');}});
  const result=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/horse-features.v1.json')));assert.equal(requests,0);assert.deepEqual(result.coverage,prior.coverage);assert.equal(result.events.length,9);assert.equal(result.pending.length,3);
  for(const old of prior.events){const updated=result.events.find(e=>e.id===old.id);for(const field of ['sourceCheckedAt','scoreCheckedAt','statusCheckedAt','startTimeUtc','status','timingProvenance'])assert.deepEqual(updated[field],old[field],`${field} observation must survive presentation`);if(old.score?.racing)assert.equal(updated.score.racing.checkedAt,old.score.racing.checkedAt);}
  console.log('Retained Horse presentation: zero provider calls, nine dated/three pending editions, original coverage/status/source/clock observations preserved in an isolated temporary root.');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={validate,validateRetained};
