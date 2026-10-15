'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const migration='20261015232237_coalesce_highlight_lookups.sql';
const functions={claim_youtube_lookup:['p_fixture_id','p_query_hash','p_token'],reserve_youtube_lookup_quota:['p_fixture_id','p_query_hash','p_token','p_bucket'],withdraw_youtube_lookup:['p_fixture_id','p_query_hash','p_token','p_video_id'],finish_youtube_lookup:['p_fixture_id','p_query_hash','p_token','p_outcome','p_selection','p_invalid_video_id']};
async function database(){
  const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql','20260914061506_right_size_fixture_runtime.sql','20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261010140633_align_live_source_refresh_cadence.sql','20261010233101_hydrate_cricket_refresh_claim.sql','20261014130245_shared_youtube_top_result_budget.sql','20261014203039_youtube_highlight_upload_metadata.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8').split('-- One write replaces')[0]);
  const before=(await db.query("select md5(pg_get_functiondef(oid)) as hash from pg_proc where proname='nothingsports_reserve_youtube_quota'")).rows[0].hash;
  await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
  await db.exec("insert into public.nothingsports_fixture_sources(source_id,discovery_report) values('discovery-tennis-highlights','{}');set role service_role;");
  async function request(path,options={}){
    assert(options.timeoutMs>0&&options.timeoutMs<=3000,'database calls retain the three-second budget');
    const name=path.split('/rpc/nothingsports_')[1];
    if(name){
      assert(functions[name],'only the four reviewed service RPCs');
      const keys=functions[name],body=options.body;
      return (await db.query('select public.nothingsports_'+name+'('+keys.map((key,i)=>key+'=> $'+(i+1)).join(',')+') as result',keys.map(key=>typeof body[key]==='object'&&body[key]!==null?JSON.stringify(body[key]):body[key]??null))).rows[0].result;
    }
    assert.equal(options.method||'GET','GET');
    const url=new URL(path,'http://local');assert.equal(url.pathname,'/rest/v1/nothingsports_youtube_selections');
    const where=[],values=[];
    for(const field of ['fixture_id','query_hash','selected_at','published_at']){
      const filter=url.searchParams.get(field);if(!filter)continue;
      const dot=filter.indexOf('.'),op=filter.slice(0,dot);assert(['eq','neq','gte'].includes(op));
      values.push(filter.slice(dot+1));where.push(field+({eq:'=',neq:'<>',gte:'>='}[op])+'$'+values.length);
    }
    return (await db.query('select to_jsonb(s) as row from public.nothingsports_youtube_selections s where '+where.join(' and ')+' order by selected_at desc limit 1',values)).rows.map(r=>r.row);
  }
  const reset=()=>db.exec("delete from public.nothingsports_youtube_selections;delete from public.nothingsports_youtube_api_daily;update public.nothingsports_fixture_sources set discovery_report='{}',lease_token=null,lease_until=null;");
  return {db,request,reset,before,migration,functions};
}
module.exports={database};
