'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
async function main(){
  const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');
    for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql','20260914061506_right_size_fixture_runtime.sql','20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261010140633_align_live_source_refresh_cadence.sql','20261010233101_hydrate_cricket_refresh_claim.sql','20261014130245_shared_youtube_top_result_budget.sql','20261014203039_youtube_highlight_upload_metadata.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8').split('-- One write replaces')[0]);
    const day=(await db.query("select (clock_timestamp() at time zone 'America/Los_Angeles')::date::text as day")).rows[0].day;
    await db.query("insert into public.nothingsports_youtube_selections(fixture_id,query_hash,video_id) values('fixture:test:legacy',$1,'OLDVIDEO123')",['a'.repeat(64)]);
    assert.deepEqual((await db.query("select published_at,duration_seconds from public.nothingsports_youtube_selections where fixture_id='fixture:test:legacy'")).rows,[{published_at:null,duration_seconds:null}],'rolling-release legacy rows cannot acquire invented video metadata');
    await assert.rejects(db.query("update public.nothingsports_youtube_selections set duration_seconds=10800 where fixture_id='fixture:test:legacy'"),/check constraint/);
    await db.query("update public.nothingsports_youtube_selections set published_at=clock_timestamp(),duration_seconds=300 where fixture_id='fixture:test:legacy'");
    await db.query("delete from public.nothingsports_youtube_selections where fixture_id='fixture:test:legacy'");
    await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report) values('discovery-tennis-highlights',$1)",[{_highlightQuota:{day,search:89,ordinary:499}}]);
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      for(const table of ['nothingsports_youtube_api_daily','nothingsports_youtube_selections'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);
      await assert.rejects(db.query("select public.nothingsports_reserve_youtube_quota('search')"),/permission denied/);
      await assert.rejects(db.query('select public.nothingsports_account_youtube_legacy_lease()'),/permission denied/);
      await assert.rejects(db.query("select * from public.nothingsports_claim_highlights_source('11111111-1111-4111-8111-111111111111')"),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const reserve=async(bucket='search',token=null)=>(await db.query('select public.nothingsports_reserve_youtube_quota($1,$2) as result',[bucket,token])).rows[0].result;
    const first=await reserve();assert(first.granted);assert.equal(first.quota.search,90,'legacy spent units are retained before first new dispatch');
    assert(!(await reserve()).granted);assert((await reserve('ordinary')).granted);assert(!(await reserve('ordinary')).granted);
    await db.exec("delete from public.nothingsports_youtube_api_daily;update public.nothingsports_fixture_sources set discovery_report='{}',lease_token=null,lease_until=null;");
    const arrivals=await Promise.all(Array.from({length:120},()=>reserve()));assert.equal(arrivals.filter(r=>r.granted).length,90,'racing reservations cannot overrun the shared search cap');
    const ordinary=await Promise.all(Array.from({length:520},()=>reserve('ordinary')));assert.equal(ordinary.filter(r=>r.granted).length,500);
    assert.deepEqual((await db.query('select search_calls,ordinary_calls from public.nothingsports_youtube_api_daily')).rows,[{search_calls:90,ordinary_calls:500}]);
    // Exact mixed-version regression: an old producer must receive the ten
    // intervening tap reservations, rather than publish twelve over total20.
    await db.exec("delete from public.nothingsports_youtube_api_daily;");
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1,lease_token=null,lease_until=null,next_due_at='-infinity'",[{_highlightQuota:{day,search:10,ordinary:0}}]);
    for(let i=0;i<10;i++)assert((await reserve()).granted);
    const legacyToken='33333333-3333-4333-8333-333333333333';
    const legacy=(await db.query("select * from public.nothingsports_claim_fixture_source('discovery-tennis-highlights',$1)",[legacyToken])).rows[0];
    assert.equal(legacy.discovery_report._highlightQuota.search,20,'actual old canonical claim reads updated shared spend');
    assert(!(await reserve()).granted,'the unbridged old lease blocks concurrent manual spend');
    const legacyReport={...legacy.discovery_report,_highlightQuota:{day,search:22,ordinary:0}};
    await db.query("select public.nothingsports_publish_fixture_source_report('discovery-tennis-highlights',$1,'[]','legacy-hash',1800000,$2)",[legacyToken,legacyReport]);
    assert.equal((await reserve()).quota.search,23,'ten legacy + ten taps + two old dispatches + next tap are all counted');
    // A new producer can publish its older local copy after an interleaved tap.
    // The canonical claim used by OLD code repairs that copy before returning it.
    await db.exec("delete from public.nothingsports_youtube_api_daily;");
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1,lease_token=null,lease_until=null,next_due_at='-infinity'",[{_highlightQuota:{day,search:19,ordinary:0}}]);
    const modernToken='55555555-5555-4555-8555-555555555555';
    await db.query('select * from public.nothingsports_claim_highlights_source($1)',[modernToken]);
    assert.equal((await reserve('search',modernToken)).quota.search,20);
    assert.equal((await reserve()).quota.search,21);
    await db.query("select public.nothingsports_publish_fixture_source_report('discovery-tennis-highlights',$1,'[]','modern-hash',1800000,$2)",[modernToken,{_highlightQuota:{day,search:20,ordinary:0}}]);
    await db.exec("update public.nothingsports_fixture_sources set next_due_at='-infinity'");
    const afterPublish=(await db.query("select * from public.nothingsports_claim_fixture_source('discovery-tennis-highlights',$1)",[legacyToken])).rows[0];
    assert.equal(afterPublish.discovery_report._highlightQuota.search,21,'old canonical caller cannot read regressed20');
    await db.query("select public.nothingsports_publish_fixture_source_report('discovery-tennis-highlights',$1,'[]','old-next-hash',1800000,$2)",[legacyToken,{_highlightQuota:{day,search:23,ordinary:0}}]);
    assert.equal((await reserve()).quota.search,24,'actual23 plus next grant24 after publication regression');
    // An old killed worker may never persist its two search/eight ordinary
    // reservations. The wrapper accounts that worst case before token replacement.
    await db.exec("delete from public.nothingsports_youtube_api_daily;");
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1,lease_token=$2,lease_until=clock_timestamp()-interval '1 second',next_due_at='-infinity'",[{_highlightQuota:{day,search:10,ordinary:10}},legacyToken]);
    const newToken='44444444-4444-4444-8444-444444444444';
    const recovered=(await db.query('select * from public.nothingsports_claim_highlights_source($1)',[newToken])).rows[0];
    assert.equal(recovered.lease_token,newToken);assert.equal(recovered.discovery_report._highlightQuota.search,12);assert.equal(recovered.discovery_report._highlightQuota.ordinary,18);
    assert(!(await reserve()).granted,'new token does not inherit an old bridge');
    const bridged=await reserve('search',newToken);assert.equal(bridged.quota.search,13);assert.equal((await reserve()).quota.search,14,'modern source and tap spend continue after conservative recovery');
    const publicReport=require('../lib/compact-fixture-observations').publicReport((await db.query("select discovery_report from public.nothingsports_fixture_sources where source_id='discovery-tennis-highlights'")).rows[0].discovery_report);
    assert(!JSON.stringify(publicReport).includes(newToken),'bridge tokens remain inside existing stripped private metadata');
    await db.exec("delete from public.nothingsports_youtube_api_daily;update public.nothingsports_fixture_sources set discovery_report='{}';");
    const token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
    await db.query("update public.nothingsports_fixture_sources set lease_token=$1,lease_until=clock_timestamp()+interval '90 seconds'",[token]);
    assert(!(await reserve()).granted,'an unbridged old source lease blocks new lucky spending');
    assert(!(await reserve('search',other)).granted,'stale source tokens are denied');
    assert((await reserve('search',token)).granted);assert((await reserve()).granted,'a bridged source and user tap share one atomic counter');
    await db.exec("update public.nothingsports_fixture_sources set lease_token=null,lease_until=null;");
    for(const ledger of [null,{day:'2026-02-30',search:0,ordinary:0},{day:'2100-01-01',search:0,ordinary:0},{day,search:-1,ordinary:0},{day,search:0,ordinary:501}]){
      await db.query("update public.nothingsports_fixture_sources set discovery_report=$1",[{_highlightQuota:ledger}]);assert(!(await reserve()).granted,'malformed/regressed ledgers cannot reset quota');
    }
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1",[{_highlightQuota:{day:'2020-01-01',search:90,ordinary:500}}]);
    assert((await reserve()).granted,'previous Pacific-day usage does not carry into today');
    const days=(await db.query("select (t at time zone 'America/Los_Angeles')::date::text as day from unnest(array['2026-10-15 06:59:59+00'::timestamptz,'2026-10-15 07:00:00+00','2026-11-02 07:59:59+00','2026-11-02 08:00:00+00']) t")).rows.map(r=>r.day);
    assert.deepEqual(days,['2026-10-14','2026-10-15','2026-11-01','2026-11-02']);
    const yesterday=(await db.query("select ((clock_timestamp() at time zone 'America/Los_Angeles')::date-1)::text as day")).rows[0].day;
    await db.exec("delete from public.nothingsports_youtube_api_daily;");
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1,lease_token=null,lease_until=null,next_due_at='-infinity'",[{_highlightQuota:{day,search:4,ordinary:0}}]);
    assert.equal((await reserve()).quota.search,5);
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1",[{_highlightQuota:{day:yesterday,search:20,ordinary:0}}]);
    const midnight=(await db.query("select * from public.nothingsports_claim_fixture_source('discovery-tennis-highlights',$1)",[legacyToken])).rows[0];
    assert.deepEqual(midnight.discovery_report._highlightQuota,{day,search:5,ordinary:0},'yesterday publication cannot erase today before an old claim');
    await db.query("select public.nothingsports_publish_fixture_source_report('discovery-tennis-highlights',$1,'[]','midnight-hash',1800000,$2)",[legacyToken,{_highlightQuota:{day,search:7,ordinary:0}}]);
    assert.equal((await reserve()).quota.search,8,'current five + two old calls + next grant remain counted across midnight');
    await db.exec("delete from public.nothingsports_youtube_api_daily;");
    await db.query("update public.nothingsports_fixture_sources set discovery_report=$1,lease_token=$2,lease_until=clock_timestamp()-interval '1 second',next_due_at='-infinity'",[{_highlightQuota:{day,search:89,ordinary:499}},legacyToken]);
    assert(!(await reserve()).granted);assert.deepEqual((await db.query('select search_calls,ordinary_calls from public.nothingsports_youtube_api_daily')).rows,[{search_calls:90,ordinary_calls:500}],'abandoned worst-case charges clamp at both hard caps');
    assert(await reserve().then(r=>!r.granted));assert.equal((await db.query("select discovery_report->'_highlightQuota' as quota from public.nothingsports_fixture_sources")).rows[0].quota.search,90,'same abandoned token is accounted once');
    await db.exec("delete from public.nothingsports_youtube_api_daily;update public.nothingsports_fixture_sources set discovery_report='{}',lease_token=null,lease_until=null;");
    await db.query("insert into public.nothingsports_youtube_selections values('fixture:test:old',$1,'UNOFFICIAL1',clock_timestamp()-interval '30 days'),('fixture:test:fresh',$1,'RPmOiRHHgX8',clock_timestamp())",['a'.repeat(64)]);
    await reserve();assert.deepEqual((await db.query('select fixture_id from public.nothingsports_youtube_selections')).rows,[{fixture_id:'fixture:test:fresh'}],'expired lookup metadata is removed by the same reservation owner');
    await db.exec("delete from public.nothingsports_youtube_api_daily;update public.nothingsports_fixture_sources set discovery_report='{}';");
    await db.query("update public.nothingsports_fixture_sources set lease_token=$1,lease_until=clock_timestamp()+interval '90 seconds'",[token]);
    const scheduled=await Promise.all(Array.from({length:70},()=>reserve('search',token)));assert.equal(scheduled.filter(r=>r.granted).length,50,'background discovery leaves forty searches for deliberate taps');
    const taps=await Promise.all(Array.from({length:50},()=>reserve()));assert.equal(taps.filter(r=>r.granted).length,40);
    assert.deepEqual((await db.query('select search_calls,scheduled_search_calls from public.nothingsports_youtube_api_daily')).rows,[{search_calls:90,scheduled_search_calls:50}]);
    assert.equal((await db.query("select prosecdef from pg_proc where proname='nothingsports_reserve_youtube_quota'")).rows[0].prosecdef,false,'public RPC is an invoker, never a public definer');
    console.log('Postgres YouTube quota: service-only RLS/grants, atomic 90/500 caps, failed-call durable reservations, legacy lease bridge, malformed state, Pacific/DST reset and 30-day metadata cleanup passed.');
  }finally{await db.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
