'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {APPROVED,prepare,writePrepared}=require('./lib/reviewed-fixture-admission');
const {parseOptions}=require('./update-cards');
const {mergeRecord,applyFixtureAndResultEvidence}=require('./apply-current-card-evidence');
const clone=value=>structuredClone(value);
const referenceTime=new Date('2026-11-02T05:42:15.000Z');
function focused(){
  const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/canonical/current-card-evidence-2026.json'),'utf8'));
  const ids=Object.keys(APPROVED);
  const peer={id:'reference:peer',eventId:'reference:peer',cardKind:'fixture',key:'football',name:'Preserved unrelated fixture',date:'2026-11-02',time:'20:00',timePrecision:'exact',expected:null,liveWindow:3,sourceCheckedAt:'2026-10-31T12:00:00.000Z'};
  const feed={schemaVersion:'events.v1',version:'reference-20261102',publishedAt:'2026-11-01T06:51:22.000Z',events:[peer]};
  const input={evidence,incoming:clone(feed),published:clone(feed),ids};
  const before=JSON.stringify(input),result=prepare(input,{referenceTime});
  assert.equal(JSON.stringify(input),before,'preparation never mutates source inputs');
  assert.equal(result.added.length,4);assert(result.changed);
  const ordinaryEvidence={checkedAt:evidence.checkedAt,fixtureOverrides:evidence.fixtureOverrides.filter(row=>ids.includes(row.id)),resultOverrides:[]};
  const ordinary=applyFixtureAndResultEvidence([clone(peer)],ordinaryEvidence,{upsert:true});
  assert.deepEqual(ordinary[0],peer,'ordinary upsert preserves unrelated fixture');
  for(const id of ids){
    const row=ordinary.find(event=>event.id===id);
    assert(row,'ordinary upsert admits '+id);assert.equal(row.expected,null);
    assert.equal(row.stakesScore,undefined);assert.equal(row.storyline,undefined);
    assert.equal(row.reviewedScheduleOnly,undefined,'internal seed control is not published copy');
    assert.equal(row.sourceCheckedAt,'2026-11-02T05:42:14.000Z');
  }
  const rated=clone(ordinary);Object.assign(rated[1],{expected:6,stakesScore:3,storyline:{stakes:3,intensity:3,arcStage:'preview'}});
  const ratedNext=applyFixtureAndResultEvidence(rated,ordinaryEvidence,{upsert:true});
  assert.equal(ratedNext[1].expected,6);assert.equal(ratedNext[1].stakesScore,3);assert.deepEqual(ratedNext[1].storyline,rated[1].storyline,'schedule-only seed policy never overwrites an existing rating');
  const legacy=applyFixtureAndResultEvidence([],{checkedAt:evidence.checkedAt,fixtureOverrides:[{id:'reference:legacy',name:'Unrelated existing admission contract'}],resultOverrides:[]},{upsert:true})[0];
  assert.equal(legacy.expected,8);assert.equal(legacy.stakesScore,5,'unrelated legacy seed behaviour remains out of this repair scope');
  for(const key of ['incoming','published']){
    assert.deepEqual(result[key].events[0],peer);
    assert.equal(result[key].version,feed.version);assert.equal(result[key].publishedAt,feed.publishedAt);
    for(const id of ids){
      const card=result[key].events.find(row=>row.id===id),fact=APPROVED[id];
      assert.equal(card.canonicalEventId,id);assert.equal(card.date,fact.date);assert.equal(card.time,fact.time);
      assert.equal(card.startTimeUtc,fact.start);assert.equal(card.venue,fact.venue);
      assert.equal(card.sourceCheckedAt,'2026-11-02T05:42:14.000Z');
      assert.equal(card.expected,null);assert.equal(card.stakesScore,undefined);
      assert.equal(card.status,'scheduled');assert.equal(card.broadcaster,'Paramount+');
      assert.deepEqual(card.participantIds,['team:football:'+fact.opponent,'team:football:socceroos']);
      for(const field of ['actualStartTimeUtc','scoreDisplay','editorialNarrative','editorialPreview'])assert.equal(card[field],undefined);
    }
  }
  const repeated=prepare({...input,incoming:result.incoming,published:result.published},{referenceTime});
  assert.equal(repeated.changed,false);assert.deepEqual(repeated.published,result.published);
  const completed=clone(result.published);
  Object.assign(completed.events[1],{status:'completed',scoreDisplay:'Retained confirmed result',stakesScore:4,selectedSentence:'Retained approved copy',sourceCheckedAt:'2026-11-15T05:00:00.000Z'});
  const filled=prepare({...input,published:completed},{referenceTime});
  assert.deepEqual(filled.incoming.events[1],completed.events[1],'missing surface inherits newer retained result and copy, never scheduled defaults');
  assert.deepEqual(filled.published,completed);
  assert.equal(mergeRecord({id:'x',stakesScore:3},{id:'x'},'2026-11-02T05:42:14.000Z').stakesScore,3);
  assert.equal(mergeRecord({id:'x'},{id:'x'},'2026-11-02T05:42:14.000Z').stakesScore,undefined,'evidence merge does not invent a five');
  const mutations=[
    value=>{value.ids=['unknown'];},value=>{value.ids=[ids[0],ids[0]];},
    value=>{value.evidence.fixtureOverrides.push(clone(value.evidence.fixtureOverrides.find(row=>row.id===ids[0])));},
    ...['sourceUrl','sourceCheckedAt','startTimeUtc','venue','participantIds','broadcasterIds'].map(field=>value=>{value.evidence.fixtureOverrides.find(row=>row.id===ids[0])[field]='unreviewed';}),
    value=>{value.evidence.fixtureOverrides.find(row=>row.id===ids[0]).expected=8;},
    value=>{value.evidence.fixtureOverrides.find(row=>row.id===ids[0]).reviewedScheduleOnly=false;},
    value=>{value.evidence.resultOverrides=[{id:ids[0]}];},
    value=>{value.published.events.push(clone(result.published.events[1]),clone(result.published.events[1]));},
    value=>{const row=clone(result.published.events[1]);row.participantIds=['different'];value.published.events.push(row);},
  ];
  for(const mutate of mutations){const value=clone(input);mutate(value);const original=JSON.stringify(value);assert.throws(()=>prepare(value,{referenceTime}),/Reviewed fixture admission:/);assert.equal(JSON.stringify(value),original);}
  assert.throws(()=>prepare(input,{referenceTime:new Date('2026-11-02T05:42:13.999Z')}),/observation/);
  const argv=['--reviewed-fixtures','--admit-reviewed-fixtures','--ids='+ids.join(','),'--local-only'];
  assert.equal(parseOptions(argv,{}).localOnly,true);
  for(const args of [argv.filter(arg=>arg!=='--local-only'),[...argv,'--result-observations'],[...argv,'--admit-major-subevents'],[...argv,'--quick']])assert.throws(()=>parseOptions(args,{}),/requires only/);
  const files=['feeds/incoming/events.json','data/events.json'].map(relative=>({relative,before:'before:'+relative,after:'after:'+relative}));
  const root='/synthetic-reviewed-fixture-test';
  const map=new Map(files.map(file=>[path.join(root,file.relative),file.before]));
  let calls=0,failSecond=false;
  const io={readFileSync:file=>map.get(file),writeFileSync:(file,bytes)=>{calls++;if(failSecond&&calls===2)throw Error('synthetic second write failed');map.set(file,bytes);}};
  map.set(path.join(root,files[1].relative),'concurrent change');
  assert.throws(()=>writePrepared({files},{root,io}),/changed after preparation/);assert.equal(calls,0,'CAS checks every surface before any write');
  map.set(path.join(root,files[1].relative),files[1].before);failSecond=true;
  assert.throws(()=>writePrepared({files},{root,io}),/synthetic second write failed/);
  for(const file of files)assert.equal(map.get(path.join(root,file.relative)),file.before,'partial write restores both beforeimages');
  calls=0;failSecond=false;writePrepared({files},{root,io});
  for(const file of files)assert.equal(map.get(path.join(root,file.relative)),file.after);
  console.log('Reviewed fixture admission: schedule/identity, no invented ratings/results, retained peer/result preservation, idempotency, route rejection, CAS and rollback assertions passed. No provider/account/publication calls.');
}
if(require.main===module)focused();
module.exports={focused};
