'use strict';
const assert=require('node:assert/strict');
async function run(){
 const db=await require('./validate-profile-fixture-scope').database();let checks=0;
 try{
  const source='discovery-calendar-index',today=(await db.query("select (statement_timestamp() at time zone 'Australia/Sydney')::date::text as reference_day")).rows[0].reference_day;
  const day=offset=>new Date(Date.parse(today+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
  const dates=[undefined,null,'','invalid',false,{},[],day(-8),day(-7),today,day(367)];
  const overrides=[null,{}, {status:null,date:null}, {status:'live',date:day(-100)}, {status:'completed',endDate:day(-8)}, {date:day(367),startDate:today}, {date:null,schedulingWindow:{startsOn:today,endsOn:today}}, {date:false,schedulingWindow:null}];
  const fixtures=[],scores=[];let n=0;
  for(const status of ['upcoming','completed','live',null])for(const date of dates)for(const override of overrides){
   const id='fixture:calendar:'+n++,fixture={id,key:'premier-league',status,...(date===undefined?{}:{date}),participantIds:['team:calendar:a'],sourceCheckedAt:'2026-01-01T00:00:00Z'};
   fixtures.push({id,fixture});if(override!==null)scores.push({id,score:override});
  }
  await db.query('insert into public.nothingsports_fixture_sources(source_id) values($1)',[source]);
  await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select $1,id,fixture,array[id],id from jsonb_to_recordset($2::jsonb) r(id text,fixture jsonb)',[source,JSON.stringify(fixtures)]);
  await db.query('insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) select $1,id,score,id from jsonb_to_recordset($2::jsonb) r(id text,score jsonb)',[source,JSON.stringify(scores)]);
  const scope={sportKeys:['premier-league'],knownSportKeys:['premier-league','tennis'],participantIds:['team:calendar:a'],requiredIds:['fixture:calendar:0']};
  const read=async(name,body)=>(await db.query('select public.nothingsports_read_fixture_bundle_part($1,$2,$3,$4,$5,$6) value',[body.p_scope,body.p_part,body.p_sport_keys,body.p_known_sport_keys,body.p_participant_ids,body.p_required_ids])).rows[0].value;
  async function equal(label){
   for(const kind of ['participants','global']){
    const original=(await db.query(kind==='global'?'select public.nothingsports_read_current_fixture_bundle(null) value':'select public.nothingsports_read_participant_fixture_bundle($1,$2,$3,$4) value',kind==='global'?[]:[scope.sportKeys,scope.knownSportKeys,scope.participantIds,scope.requiredIds])).rows[0].value;
    const candidate=await require('../lib/fixture-bundle-parts').readBundleParts(read,{scope:kind,...(kind==='participants'?scope:{})});
    assert.equal(candidate.complete,true,label+' complete');assert.deepEqual(candidate.rows,original.rows,label+' '+kind);checks++;
   }
  }
  await equal('Present/null/absent/invalid date, status, score and window combinations');
  const before=(await db.query('select ctid::text tid from nothingsports_fixture_read_private.fixture_context where source_id=$1 and fixture_id=$2',[source,fixtures[1].id])).rows[0].tid;
  await db.query("update public.nothingsports_fixture_current set fixture=fixture||'{\"sourceCheckedAt\":\"2026-02-01T00:00:00Z\"}'::jsonb where source_id=$1 and fixture_id=$2",[source,fixtures[1].id]);
  assert.equal((await db.query('select ctid::text tid from nothingsports_fixture_read_private.fixture_context where source_id=$1 and fixture_id=$2',[source,fixtures[1].id])).rows[0].tid,before,'Check-only changes do not rewrite selection metadata');checks++;
  await db.query("update nothingsports_fixture_read_private.fixture_context set base_selection=base_selection-'calendarWindow',score_selection=score_selection-'calendarWindow' where source_id=$1",[source]);
  await equal('Unprepared metadata falls back to the same canonical facts');
  await db.query("update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('date',$2::text,'status','upcoming') where source_id=$1",[source,today]);
  await db.query("update public.nothingsports_live_scores set score=score||jsonb_build_object('date',$2::text,'status','live') where source_id=$1",[source,day(-100)]);
  assert.equal((await db.query("select count(*)::integer n from nothingsports_fixture_read_private.fixture_context where source_id=$1 and (not (base_selection?'calendarWindow') or not (score_selection?'calendarWindow'))",[source])).rows[0].n,0,'Existing canonical hooks prepare and maintain the window descriptors');checks++;
  await equal('Canonical date/status changes remain complete');
  assert.deepEqual((await db.query("select has_function_privilege('anon','nothingsports_fixture_read_private.window_fields(jsonb)','execute') a,has_function_privilege('authenticated','nothingsports_fixture_read_private.window_fields(jsonb)','execute') u,has_function_privilege('service_role','nothingsports_fixture_read_private.window_fields(jsonb)','execute') s")).rows[0],{a:false,u:false,s:true});checks++;
  console.log(JSON.stringify({passed:true,checks,fixtures:fixtures.length,actualSql:true,calendarFallback:true,productionChanged:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
