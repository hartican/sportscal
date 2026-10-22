'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawnSync} = require('node:child_process');
const api = require('./lib/editorial-narrative');
const {editorialPreviewIssues} = require('./lib/editorial-preview-quality');
const {buildMlb} = require('./update-sport-editorial-depth');
const ROOT = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file)));
const ids = ['849831','849836','849809','849812','849811','849810','849808','849806','849807'];
const retained = read('scripts/fixtures/postseason-editorial-20261011.json').fixtures;
const rules = read('config/mlb-editorial-rules-2026.json');
const reference = new Date(Math.max(Date.parse(rules.reviewedAt) + 1000, Date.now()));
const fixtures = ids.map(id => {
  const event = retained.find(e => e.canonicalEventId === `fixture:mlb:${id}`);
  assert(event, `retained MLB fixture ${id} is required for the real boundary regression`);
  return {...structuredClone(event), status:'upcoming'};
});
const tennis = structuredClone(retained.find(e => e.canonicalEventId === 'fixture:tennis:espn:wta:184356'));
assert(tennis, 'the reviewed named China Open final is retained');
const allowed = new Set(['selectedSentence','fullSpiel','editorialPreview','editorialNarrative','storyline','lastReviewedAt']);
const facts = e => JSON.stringify(Object.fromEntries(Object.entries(e).filter(([key]) => !allowed.has(key))));
const freshKnowledge = () => Object.fromEntries(Object.entries(read('data/editorial-knowledge.v1.json')).map(([key,value]) => [key,Array.isArray(value) ? [] : value]));
const knowledge = freshKnowledge();
assert.equal(buildMlb(knowledge, fixtures, reference), 9);
assert.deepEqual(api.validateKnowledge(knowledge), []);
function project(event, k=knowledge){return api.applyToFeedEvent(event, api.projectionForTarget(k, 'feed-event', event), api.indexesFor(k));}
const projected = fixtures.map(event => project(event));
assert.equal(new Set(projected.map(e => e.selectedSentence)).size, 9, 'each game retains a distinct description');
for (let i=0;i<fixtures.length;i++){
  assert.equal(facts(projected[i]), facts(fixtures[i]), 'editorial must preserve every fixture fact, identity and source clock');
  assert.deepEqual(editorialPreviewIssues(projected[i], 4, reference), []);
  for (const key of ['selectedSentence','fullSpiel']) assert.equal(require('./lib/storyline-card-rules').RESULT_LEAK.test(projected[i][key]),false,'series format/progression cannot disclose the fixture result');
  if (fixtures[i].scheduleStatus === 'conditional'){
    assert.match(projected[i].selectedSentence, /if needed/);
    assert.match(projected[i].fullSpiel, /only played if earlier results leave the series undecided/);
    assert.equal(projected[i].startTimeUtc, null);
  }
}
const stable = fixtures.map(event => project(event));
buildMlb(knowledge, fixtures, new Date(+reference + 60000));
assert.deepEqual(fixtures.map(event => project(event)), stable, 'rerunning the writer cannot manufacture a newly observed fact or newer card research');
for (const changes of [{season:2027},{status:'completed'},{roundLabel:'Unreviewed final Game 1'},{roundLabel:'NLCS Game 8'},{sourceUrl:'https://example.invalid/game'},{scheduleStatus:'unreviewed'},{homeParticipantId:'team:mlb:999'}]){
  const k=freshKnowledge();assert.equal(buildMlb(k,[{...fixtures[0],...changes}],reference),0);
}
assert.throws(() => buildMlb(freshKnowledge(),[{...fixtures[0],sourceCheckedAt:'2026-13-40T00:00:00Z'}],reference), /dated source observation/);
for (const status of ['cancelled','postponed','suspended']){
  const k=freshKnowledge(),event={...fixtures[0],status};
  assert.equal(buildMlb(k,[event],reference),1);
  const card=project(event,k);
  assert.match(card.selectedSentence,new RegExp('is '+status));
  assert(!card.selectedSentence.includes('in the race'));
  assert.equal(facts(card),facts(event),'source-declared non-playing states remain authoritative');
}
// The actual newly sourced World Series identities must receive factual context.
const wsCapture=require('./fixtures/mlb-postponed-successor-20261023.json');
const worldSeries=require('../lib/mlb-postseason').parse(wsCapture.payload,{checkedAt:wsCapture.checkedAt,now:new Date(wsCapture.checkedAt)}).fixtures.filter(event=>/^World Series Game /.test(event.roundLabel));
assert.equal(worldSeries.length,7);
const wsKnowledge=freshKnowledge();assert.equal(buildMlb(wsKnowledge,worldSeries,reference),7);
assert.deepEqual(api.validateKnowledge(wsKnowledge),[]);
const wsProjected=worldSeries.map(event=>project(event,wsKnowledge));
assert.equal(new Set(wsProjected.map(event=>event.selectedSentence)).size,7);
for(const [i,event] of wsProjected.entries()){
 assert.equal(facts(event),facts(worldSeries[i]),'World Series context preserves all fixture facts and original clocks');
 assert.deepEqual(editorialPreviewIssues(event,4,reference),[]);
 assert.match(event.fullSpiel,/first team to 4 wins takes the World Series/);
 assert.doesNotMatch(event.fullSpiel,/advances to the World Series|American League World Series|National League World Series/);
 if(event.scheduleStatus==='conditional'){assert.match(event.selectedSentence,/if needed/);assert.equal(event.startTimeUtc,null);}
}
const wsSourceFacts=JSON.stringify({sources:wsKnowledge.sources,facts:wsKnowledge.narrativeFacts});
buildMlb(wsKnowledge,worldSeries,new Date(+reference+60000));
assert.deepEqual(worldSeries.map(event=>project(event,wsKnowledge)),wsProjected,'unchanged context retains rendered copy and research dates');
assert.equal(JSON.stringify({sources:wsKnowledge.sources,facts:wsKnowledge.narrativeFacts}),wsSourceFacts,'unchanged context retains source and fact observations');
for(const roundLabel of ['World Series Game 0','World Series Game 8','AL World Series Game 1'])assert.equal(buildMlb(freshKnowledge(),[{...worldSeries[0],roundLabel}],reference),0);
const wsFinal={...worldSeries[0],status:'completed',homeScore:1,awayScore:3};
assert.equal(buildMlb(freshKnowledge(),[wsFinal],reference),0,'preview writer cannot replace a completed World Series result');
const independentlyReviewed = freshKnowledge();
buildMlb(independentlyReviewed,[fixtures[0]],reference);
independentlyReviewed.eventProjections[0].id='projection:independent-reviewed-story';
const original = JSON.stringify(independentlyReviewed);
assert.equal(buildMlb(independentlyReviewed,[fixtures[0]],reference),0);
assert.equal(JSON.stringify(independentlyReviewed),original,'independent research is retained');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'ns-postseason-editorial-'));
const write = (name,value) => {const file=path.join(temporary,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const invoke = (name,args=[]) => spawnSync(process.execPath,[path.join(ROOT,'scripts',name),...args],{cwd:temporary,encoding:'utf8',env:{...process.env,NS_EDITORIAL_REFERENCE:reference.toISOString()},timeout:30000});
const assertPass = result => assert.equal(result.status,0,result.stderr || result.stdout);
const review=read('data/editorial-fixture-research.v1.json').entries.find(e=>e.id===tennis.canonicalEventId);
assert(review?.researchDepth===5 && review.facts.length>=4 && review.sources.length>=3,'the final retains its full marquee research requirement');
const preview={selectedSentence:review.hook,fullSpiel:review.synopsis,sourceName:review.sourceObservations[0].name,sourceUrl:review.sources[0],sourceCheckedAt:review.sourceObservations[0].checkedAt,editorialPreview:{status:'journalistic',angle:review.title,contextSignals:['home-milestone','season-form'],sourceName:review.sourceObservations[0].name,sourceUrl:review.sources[0],sourceCheckedAt:review.sourceObservations[0].checkedAt}};
const applyResearch=require('./apply-fixture-research').apply;
const cup=retained.find(e=>e.canonicalEventId==='event:horse-racing:melbourne-cup:2026');
const cupReview=read('data/editorial-fixture-research.v1.json').entries.find(e=>e.id===cup.canonicalEventId);
assert(cupReview?.researchDepth===5&&cupReview.sources.length>=3&&cupReview.facts.length>=4,'The Cup retains the full marquee requirement');
const cupApplied=applyResearch(read('data/editorial-knowledge.v1.json'),{events:[cup]},{events:[]},{entries:[cupReview]});
const cupProjection=api.projectionForTarget(cupApplied.knowledge,'feed-event',cup);
assert(cupProjection&&cupProjection.researchDepth===5);
assert.equal(facts(cupApplied.feed.events[0]),facts(cup),'Background cannot replace the current entry stage, race time, IDs or source clocks');
assert.equal([cupProjection.hook,cupProjection.synopsis,cupProjection.closingCopy].join(' '),'Few sporting moments bring Australia to a halt quite like the Melbourne Cup. At Flemington, 3,200 metres separate a field of horses and jockeys from a place in racing history. Storied, celebrated and sometimes controversial, it is Australia’s defining horse race. The Cup matters because it turns an extraordinary test of endurance and riding skill into a national occasion, bringing generations of stories and rivalries together for a few unforgettable minutes.','The approved sporting story replaces procedural nomination copy');
assert.doesNotMatch(cupProjection.hook+' '+cupProjection.synopsis+' '+cupProjection.closingCopy,/not a prediction|nominations|acceptances|unconfirmed|\bR7\b|3\s*pm/i,'Editorial cannot supply an unpublished programme clock or field caveat');
assert(!cupProjection.hook.includes('101'),'A dated early nomination count cannot look like the current field');
const currentCup=read('feeds/incoming/events.json').events.find(e=>e.canonicalEventId===cup.canonicalEventId);
if(currentCup)assert.equal(facts(applyResearch(read('data/editorial-knowledge.v1.json'),{events:[currentCup]},{events:[]},{entries:[cupReview]}).feed.events[0]),facts(currentCup),'The real current Cup retains its complete source field without copying the roster into a test fixture');
for(const observation of cupReview.sourceObservations)assert.equal(cupApplied.knowledge.sources.find(s=>cupProjection.sourceIds.includes(s.id)&&s.url===observation.url).checkedAt,observation.checkedAt);
const researched=applyResearch(read('data/editorial-knowledge.v1.json'),{events:[tennis]},{events:[]},{entries:[review]});
assert.equal(facts(researched.feed.events[0]),facts(tennis));
const reviewedProjection=api.projectionForTarget(researched.knowledge,'feed-event',tennis);
const closed={...tennis,status:'completed',homeScore:2,awayScore:0,score:'Qinwen Zheng 2–0 Mirra Andreeva',outcomeText:'Qinwen Zheng defeated Mirra Andreeva.',recapText:'A controlled final for the regression.',winnerParticipantId:tennis.homeParticipantId};
const closedReview=applyResearch(read('data/editorial-knowledge.v1.json'),{events:[closed]},{events:[]},{entries:[review]}).feed.events[0];
assert.equal(facts(closedReview),facts(closed),'pre-match research cannot replace an observed final');
assert.equal(require('./lib/storyline-card-rules').RESULT_LEAK.test(closedReview.selectedSentence+' '+closedReview.fullSpiel),false,'a completed fixture keeps its result protected in default copy');
for(const observation of review.sourceObservations)assert.equal(researched.knowledge.sources.find(s=>reviewedProjection.sourceIds.includes(s.id)&&s.url===observation.url).checkedAt,observation.checkedAt,'each actual source keeps its own check time');
for(let i=0;i<review.facts.length;i++)assert.equal(researched.knowledge.narrativeFacts.find(f=>f.id===reviewedProjection.factIds[i]).observedAt,new Date(Math.max(...review.facts[i].sourceIndexes.map(index=>Date.parse(review.sourceObservations[index].checkedAt)))).toISOString(),'facts use their supporting observation, not the assembly date');
for(const change of [r=>r.sourceObservations=[],r=>r.sourceObservations[0]=null,r=>r.sourceObservations[0].url='https://example.invalid',r=>r.sourceObservations[0].checkedAt='2026-02-30T00:00:00Z',r=>r.sourceObservations[0].checkedAt='2999-01-01T00:00:00Z']){
  const invalid=structuredClone(review);change(invalid);
  assert.throws(()=>applyResearch(read('data/editorial-knowledge.v1.json'),{events:[tennis]},{events:[]},{entries:[invalid]}),/research source observation/);
}
try {
  write('data/canonical/afl-nrl-2026.json',read('data/canonical/afl-nrl-2026.json'));
  // Rehearse the actual complete retained inputs. The other sport assemblers
  // deliberately reject invented or absent source records.
  write('data/editorial-knowledge.v1.json',read('data/editorial-knowledge.v1.json'));
  write('data/major-events.v1.json',read('data/major-events.v1.json'));
  for(const file of ['schemas/event-feed.schema.json','schemas/major-events.schema.json'])write(file,read(file));
  fs.copyFileSync(path.join(ROOT,'index.html'),path.join(temporary,'index.html'));
  const overrides=read('feeds/editorial-preview-overrides.json');overrides.events[tennis.canonicalEventId]=preview;
  write('feeds/editorial-preview-overrides.json',overrides);
  for(const file of ['data/editorial-fixture-research.v1.json','data/follow-sources/coverage.v1.json','data/tennis-feed-parents.v1.json'])write(file,read(file));
  const incoming={...tennis,id:tennis.canonicalEventId,eventId:tennis.canonicalEventId};
  for(const file of ['feeds/incoming/events.json','data/events.json'])write(file,read(file));
  // The full owner publishes retained horse stages before its editorial pass.
  // Rehearse that publisher before injecting the controlled identity cases.
  for(const file of ['feeds/incoming/events.json','data/events.json'])assertPass(invoke('sync-requested-sports-to-feed.js',[file,file,'--horse-racing-only']));
  for (const [file,event] of [['feeds/incoming/events.json',incoming],['data/events.json',tennis]]){
    const document=JSON.parse(fs.readFileSync(path.join(temporary,file)));
    document.events=document.events.map(old => old.canonicalEventId === tennis.canonicalEventId ? event : fixtures.find(f=>f.canonicalEventId===old.canonicalEventId) || old);
    write(file,document);
  }
  assertPass(invoke('apply-editorial-previews.js'));
  const paths=['feeds/incoming/events.json','data/events.json'];
  const hash=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(temporary,file))).digest('hex');
  const previewBefore=paths.map(hash);
  assertPass(invoke('apply-editorial-previews.js'));
  assert.deepEqual(paths.map(hash),previewBefore,'an unchanged preview run is byte-stable');
  assertPass(invoke('enrich-storyline-cards.js',['--write']));
  assertPass(invoke('apply-fixture-research.js'));
  assertPass(invoke('update-sport-editorial-depth.js',['--write']));
  assertPass(invoke('apply-editorial-narratives.js',['--write']));
  assertPass(invoke('validate-editorial-narratives.js'));
  assertPass(invoke('audit-editorial-previews.js',['data/events.json','preview-audit.json']));
  for (const file of ['feeds/incoming/events.json','data/events.json']){
    const document=JSON.parse(fs.readFileSync(path.join(temporary,file)));
    for (const event of document.events.filter(e => e.canonicalEventId===tennis.canonicalEventId || fixtures.some(f=>f.canonicalEventId===e.canonicalEventId))){
      const original=event.canonicalEventId===tennis.canonicalEventId ? (file.startsWith('feeds/') ? incoming : tennis) : fixtures.find(f=>f.id===event.id);
      assert.equal(facts(event),facts(original),`${file} facts and clocks remain intact`);
      assert.equal(event.editorialPreview.status,'journalistic');
      assert.deepEqual(editorialPreviewIssues(event,4,reference),[]);
    }
  }
  const before=paths.map(hash);
  write('feeds/editorial-preview-overrides.json',{schemaVersion:'sportscal.editorial-previews.v1',events:{[tennis.canonicalEventId]:preview,'fixture:missing:reviewed':preview}});
  const missing=invoke('apply-editorial-previews.js');
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/missing event ids: fixture:missing:reviewed/);
  assert.deepEqual(paths.map(hash),before,'missing targets reject before either feed is written');
  write('feeds/editorial-preview-overrides.json',{schemaVersion:'sportscal.editorial-previews.v1',events:{[tennis.canonicalEventId]:preview}});
  const final={...tennis,status:'completed',score:'Qinwen Zheng 2–0 Mirra Andreeva',selectedSentence:'The final is complete. Reveal results when ready.',fullSpiel:'The verified final remains protected.'};
  for(const file of paths)write(file,{events:[final]});
  assertPass(invoke('apply-editorial-previews.js'));
  for(const file of paths)assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temporary,file))).events[0],final,'a dated pre-match preview cannot overwrite an observed final');
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
console.log('Postseason descriptions: nine retained and seven captured World Series MLB identities, conditional games, untouched facts/clocks, stable reruns, protected finals, canonical tennis aliases and real writer/audit commands passed.');
