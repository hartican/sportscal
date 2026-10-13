'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const captured=require('./fixtures/completed-source-recovery-20261013.json');
const golf=require('../lib/golf-live'),universe=require('../lib/live-universe');
const {contentHash,createSnapshotStore,refreshDueSources}=require('../lib/live-fixtures');
const now=new Date(captured.observedAt),published=[captured.reviewedBathurst,...captured.sources.find(s=>s.source_id==='live-golf-current').fixtures];
function adapters(fetchImpl){return [golf.source({published,fetchImpl}),universe.sources({published,fetchImpl}).find(s=>s.id==='live-supercars-bathurst')];}
async function collectionChecks(){
 let reads=0;
 for(const source of adapters(async()=>{reads++;throw Error('Completed source must not contact provider');})){
  const row=captured.sources.find(r=>r.source_id===source.id),before=structuredClone(row.fixtures);
  assert.deepEqual(await source.fetch({now,previous:before}),row.fixtures,'Actual captured final collection and child observations stay unchanged');
  assert.deepEqual(await source.fetch({now,previous:before}),row.fixtures,'Unchanged rerun remains quiet');
 }
 assert.equal(reads,0);
 const coldBathurst=adapters(async()=>{throw Error('Reviewed cold final must not contact provider');}).find(s=>s.id==='live-supercars-bathurst');
 assert.deepEqual(await coldBathurst.fetch({now,previous:[]}),[captured.reviewedBathurst],'A new source can initialise from the qualified published final without an invalid empty snapshot');
 const previous=captured.sources.find(s=>s.source_id==='live-golf-current').fixtures,parent=previous.find(f=>f.cardType==='golf_tournament'),children=previous.filter(f=>f.parentEventId);
 assert.equal(children.length,4);
 const source=golf.source({published:previous,fetchImpl:async()=>{throw Error('No provider expected');}});
 assert.deepEqual(source.seed.map(f=>f.id),[parent.id],'Initial seed also excludes real tee-time appearances');
 for(const child of children)for(const field of ['cardType','cardKind','parentEventId']){
  const appearance={...child,cardType:undefined,cardKind:undefined,parentEventId:undefined,[field]:field==='parentEventId'?parent.id:'golf_appearance',status:'live',score:{golf:{phase:'playing'}}};
  assert.deepEqual(await source.fetch({now,previous:[parent,appearance]}),[parent,appearance]);
  assert.equal(source.refreshInterval([parent,appearance],+now),1800000,'An appearance cannot drive tournament polling');
 }
 const receipt=require('./fixtures/golf/baycurrent-final-20261011.json'),live={...parent,status:'live',score:{golf:{phase:'playing'}}};
 const liveSource=golf.source({published:[live,...children],fetchImpl:async(url,{signal})=>{reads++;assert.equal(url,receipt.sourceUrl);assert(signal instanceof AbortSignal);return new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{dehydratedState:{queries:receipt.queries}}}})+'</script>');}});
 const refreshed=await liveSource.fetch({now:new Date(receipt.checkedAt),previous:[...children,live]});
 assert.equal(reads,1,'A real active parent still makes one bounded ordinary request');assert.equal(refreshed.find(f=>f.id===parent.id).status,'completed');
 assert.deepEqual(refreshed.filter(f=>f.parentEventId),children,'Refreshing a parent never turns tee-time appearances into tournament results');
 assert.equal(liveSource.timeoutMs,4000);assert.equal(liveSource.minimumIntervalMs,120000);assert.equal(liveSource.refreshInterval([live],+now),120000);
 const bathurstPrevious=captured.sources.find(s=>s.source_id==='live-supercars-bathurst').fixtures;
 for(const mutate of [e=>e.status='upcoming',e=>e.resultStatus='provisional',e=>e.fixtureResults.rows.pop(),e=>e.fixtureResults.sourceUrl='https://example.org/unverified',e=>e.fixtureResults.checkedAt='2026-10-14T00:00:00Z',e=>{delete e.fixtureResults;e.score={racing:{schema:'racing.v1',phase:'official-result',kind:'classification',provider:'Supercars'}};}]){
  const edition=structuredClone(captured.reviewedBathurst);mutate(edition);let calls=0;
  const unconfirmed=universe.sources({published:[edition],fetchImpl:async()=>{calls++;throw Error('Ordinary timetable request retained');}}).find(s=>s.id==='live-supercars-bathurst');
  await assert.rejects(()=>unconfirmed.fetch({now,previous:bathurstPrevious}),/Ordinary timetable request retained/);assert.equal(calls,1,'Only the complete reviewed final suppresses the source request');
 }
 // A valid published receipt cannot be used before its actual observation.
 const beforeReview=new Date(Date.parse(captured.reviewedBathurst.fixtureResults.checkedAt)-1);let calls=0;
 const notObservedYet=universe.sources({published:[captured.reviewedBathurst],fetchImpl:async()=>{calls++;throw Error('Future receipt cannot suppress request');}}).find(s=>s.id==='live-supercars-bathurst');
 await assert.rejects(()=>notObservedYet.fetch({now:beforeReview,previous:bathurstPrevious}),/Future receipt cannot suppress request/);assert.equal(calls,1);
}
async function persistenceChecks(){
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 const mode=process.env.MATCH_CENTRE_SCORE_WRITES;process.env.MATCH_CENTRE_SCORE_WRITES='true';
 try{
  await db.exec("set timezone='UTC';create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
  for(const file of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql','20260914061506_right_size_fixture_runtime.sql','20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261010233101_hydrate_cricket_refresh_claim.sql','20261010140633_align_live_source_refresh_cadence.sql','20261012113815_expire_unchanged_fixture_history.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8').split('-- One write replaces')[0]);
  await db.exec('set role service_role');
  // Initialise through the actual fenced publisher so its core/score foreign
  // keys and hashes are established by the real code, rather than mirrored.
  const seedToken='11111111-1111-4111-8111-111111111111';
  for(const row of captured.sources){
   await db.query('select * from public.nothingsports_claim_fixture_source($1,$2)',[row.source_id,seedToken]);
   await db.query('select public.nothingsports_publish_compact_scores($1,$2,$3::jsonb,$4::jsonb,$5,1800000,null)',[row.source_id,seedToken,JSON.stringify(row.fixtures),JSON.stringify(captured.scores.filter(s=>s.source_id===row.source_id&&row.fixtures.some(f=>f.id===s.fixture_id)).map(s=>s.score)),contentHash(row.fixtures)]);
  }
  // Restore the captured lookup graph too: an older race alias remains stored
  // outside the current source array and must not disappear from this replay.
  for(const row of captured.current)await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash,updated_at) values($1,$2,$3,$4::jsonb,$5,$6) on conflict(source_id,fixture_id) do update set identity_keys=excluded.identity_keys,fixture=excluded.fixture,content_hash=excluded.content_hash,updated_at=excluded.updated_at',[row.source_id,row.fixture_id,row.identity_keys,JSON.stringify(row.fixture),row.content_hash,row.updated_at]);
  for(const row of captured.scores)await db.query('insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values($1,$2,$3::jsonb,$4,$5) on conflict(source_id,fixture_id) do update set score=excluded.score,content_hash=excluded.content_hash,first_completed_at=excluded.first_completed_at',[row.source_id,row.fixture_id,JSON.stringify(row.score),row.content_hash,row.first_completed_at]);
  for(const row of captured.sourceMetadata)await db.query('update public.nothingsports_fixture_sources set revision=$2,content_hash=$3,checked_at=$4,discovery_report=$5::jsonb where source_id=$1',[row.source_id,row.revision,row.content_hash,row.checked_at,JSON.stringify(row.discovery_report)]);
  await db.exec("update public.nothingsports_fixture_sources set next_due_at=clock_timestamp()-interval '1 second',failure_count=3");
  const before=(await db.query("select source_id,fixture_id,score,first_completed_at,ctid::text from public.nothingsports_live_scores order by source_id,fixture_id")).rows;
  const coreBefore=(await db.query('select source_id,fixture_id,identity_keys,fixture,content_hash from public.nothingsports_fixture_current order by source_id,fixture_id')).rows;
  const sourceBefore=(await db.query('select source_id,revision,content_hash,fixtures from public.nothingsports_fixture_sources order by source_id')).rows;
  const request=async(path,{body={}}={})=>{
   if(path.includes('?select=source_id,next_due_at'))return (await db.query('select source_id,next_due_at from public.nothingsports_fixture_sources')).rows;
   const name=path.split('/').at(-1),keys={nothingsports_claim_fixture_source:['p_source_id','p_token'],nothingsports_publish_compact_scores:['p_source_id','p_token','p_fixtures','p_scores','p_hash','p_interval_ms','p_report']}[name];assert(keys,'Unexpected RPC '+name);
   return (await db.query(`select * from public.${name}(${keys.map((k,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>['p_fixtures','p_scores','p_report'].includes(k)?body[k]===null?null:JSON.stringify(body[k]):body[k]))).rows;
  };
  let providerReads=0;
  const sources=adapters(async()=>{providerReads++;throw Error('No completed provider request');}),store=createSnapshotStore({request});
  for(let pass=0;pass<2;pass++){
   if(pass)await db.exec("update public.nothingsports_fixture_sources set next_due_at=clock_timestamp()-interval '1 second'");
   const result=await refreshDueSources({sources,store,now:new Date(),maxRuntimeMs:45000});assert.deepEqual(result.failed,[]);assert.equal(result.refreshed.length,2);
   const after=(await db.query("select source_id,fixture_id,score,first_completed_at,ctid::text from public.nothingsports_live_scores order by source_id,fixture_id")).rows;
   assert.deepEqual(after,before,'Actual fenced compact writer retains score bytes, original clocks, completion and unchanged score rows');
   assert.deepEqual((await db.query('select source_id,fixture_id,identity_keys,fixture,content_hash from public.nothingsports_fixture_current order by source_id,fixture_id')).rows,coreBefore,'All lookup aliases and original core facts remain');
   assert.deepEqual((await db.query('select source_id,revision,content_hash,fixtures from public.nothingsports_fixture_sources order by source_id')).rows,sourceBefore,'An unchanged completed pass creates no sporting revision or source payload changes');
   const health=(await db.query('select source_id,failure_count from public.nothingsports_fixture_sources order by source_id')).rows;assert(health.every(r=>r.failure_count===0),'Normal accepted checks clear prior failures without an operator reset');
  }
  assert.equal(providerReads,0);
  const coldSources=adapters(async()=>{providerReads++;throw Error('Cold completed source must not contact provider');}).map(source=>({...source,id:source.id+'-cold-replay'}));
  const cold=await refreshDueSources({sources:coldSources,store,now:new Date(),maxRuntimeMs:45000});assert.deepEqual(cold.failed,[]);assert.equal(cold.refreshed.length,2);
  const coldRows=(await db.query("select source_id,failure_count,jsonb_array_length(fixtures) as records from public.nothingsports_fixture_sources where source_id like '%-cold-replay' order by source_id")).rows;
  assert.equal(coldRows.length,2);assert(coldRows.every(r=>r.failure_count===0&&r.records>=1),'Both new source rows initialise without provider reads or invalid empty publication');assert.equal(providerReads,0);
 }finally{if(mode===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;else process.env.MATCH_CENTRE_SCORE_WRITES=mode;await db.close();}
}
(async()=>{await collectionChecks();await persistenceChecks();console.log('Completed-source recovery: captured Golf/Bathurst, active/unconfirmed guards, actual fenced persistence, original scores/clocks and quiet reruns passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
