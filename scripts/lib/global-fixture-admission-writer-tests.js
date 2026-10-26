'use strict';
const assert=require('node:assert/strict'),live=require('../../lib/live-fixtures');
async function writers(db,same){
 const source='discovery-admission-writer',token='00000000-0000-4000-8000-000000000087',id='admission-writer:0',checks=[];
 await db.query('insert into public.nothingsports_fixture_sources(source_id)values($1)',[source]);
 const request=async(route,options)=>{
  const names={nothingsports_claim_fixture_source:[['p_source_id','p_token'],['text','uuid']],nothingsports_publish_compact_scores:[['p_source_id','p_token','p_fixtures','p_scores','p_hash','p_interval_ms','p_report'],['text','uuid','jsonb','jsonb','text','integer','jsonb']]};
  const name=route.split('/').pop(),spec=names[name];assert(spec,'Unexpected canonical writer RPC');const [keys,types]=spec;
  assert.deepEqual(Object.keys(options.body).sort(),[...keys].sort());const values=keys.map((key,i)=>types[i]==='jsonb'&&options.body[key]!==null?JSON.stringify(options.body[key]):options.body[key]);
  const args=types.map((type,i)=>'$'+(i+1)+'::'+type).join(',');
  if(name==='nothingsports_claim_fixture_source')return(await db.query('select * from public.'+name+'('+args+')',values)).rows;
  return(await db.query('select public.'+name+'('+args+') result',values)).rows[0].result;
 };
 const store=live.createSnapshotStore({request}),now=Date.now();
 const stored=async()=>(await db.query("select row_to_json(c)::text current,row_to_json(s)::text score from public.nothingsports_fixture_current c left join public.nothingsports_live_scores s using(source_id,fixture_id)where c.source_id=$1 and c.fixture_id=$2",[source,id])).rows[0];
 let fixture={id,key:'football',date:new Date(now).toISOString().slice(0,10),status:'scheduled',startTimeUtc:new Date(now+3600000).toISOString(),homeParticipantId:'qa-home',awayParticipantId:'qa-away',scoreCheckedAt:new Date(now-5000).toISOString(),statusCheckedAt:new Date(now-5000).toISOString(),homeScore:0,awayScore:0};
 const publish=async f=>{
  await db.query("update public.nothingsports_fixture_sources set next_due_at=clock_timestamp()where source_id=$1",[source]);
  await db.exec('set role service_role');const previous=process.env.MATCH_CENTRE_SCORE_WRITES;process.env.MATCH_CENTRE_SCORE_WRITES='true';
  try{assert(await store.claim(source,token));await store.publish(source,token,{fixtures:[f],hash:live.contentHash([f]),intervalMs:120000,observedFixtures:[f],observedAt:new Date(),coverage:{status:'complete'}});}
  finally{if(previous===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;else process.env.MATCH_CENTRE_SCORE_WRITES=previous;await db.exec('reset role');}
 };
 for(const [name,change]of [['canonical insert',{}],['canonical no-op',{}],['canonical unsent schedule correction',{startTimeUtc:new Date(now+7200000).toISOString()}],['canonical live score',{status:'live',homeScore:1,awayScore:0,statusCheckedAt:new Date(now-3000).toISOString(),scoreCheckedAt:new Date(now-3000).toISOString()}],['canonical final',{status:'completed',homeScore:2,awayScore:0,statusCheckedAt:new Date(now-1000).toISOString(),scoreCheckedAt:new Date(now-1000).toISOString()}]]){
  const before=name==='canonical no-op'?await stored():null;
  fixture={...fixture,...change};await publish(fixture);if(before)assert.deepEqual(await stored(),before,'Canonical unchanged observations do not rewrite facts');await same(name);checks.push(name);
 }
 await db.query("update public.nothingsports_fixture_current set fixture=fixture||'{\"date\":null}'::jsonb where source_id=$1 and fixture_id=$2",[source,id]);await same('direct canonical current update');checks.push('direct current');
 await db.query("update public.nothingsports_live_scores set score=score||'{\"awayScore\":1}'::jsonb where source_id=$1 and fixture_id=$2",[source,id]);await same('direct score correction');checks.push('direct score');
 await db.exec('begin');try{await db.query("update nothingsports_fixture_read_private.fixture_context set base_selection=base_selection||'{\"changed\":true}'::jsonb where source_id=$1 and fixture_id=$2",[source,id]);await same('writer pending-integrity fallback',true);checks.push('pending fallback');}finally{await db.exec('rollback');}
 return checks;
}
module.exports={writers};
