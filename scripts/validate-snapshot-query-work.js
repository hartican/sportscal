'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const near='nothingsports_read_match_centre_fixture_bundle',participant='nothingsports_read_participant_fixture_bundle';
async function run(){
 const db=await require('./validate-profile-fixture-scope').database();let checks=0;
 try{
  const names=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('_bound_fixture_snapshot_query_work.sql'));assert.equal(names.length,1);
  const migration=fs.readFileSync('supabase/migrations/'+names[0],'utf8');
  const finalNames=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('_defer_match_fixture_payload.sql'));assert.equal(finalNames.length,1);
  const finalMigration=fs.readFileSync('supabase/migrations/'+finalNames[0],'utf8');
  const signatures=[near+'(text[])',participant+'(text[],text[],text[],text[])'];
  const definitions=[];
  for(const signature of signatures){const row=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0];definitions.push(row.definition);}
  await db.exec(definitions[0].replace('public.'+near+'(','public.qa_before_snapshot_near(')+';');
  await db.exec(definitions[1].replace('public.'+participant+'(','public.qa_before_snapshot_participant(')+';');
  const metadata=async()=>(await db.query("select p.proname,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text acl from pg_proc p where p.oid=any(array['public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure,'public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure]) order by p.proname")).rows;
  // Function-definition hashes do not bind ACLs or inherited execution grants.
  for(const mode of ['default-acl','inherited-anon','inherited-authenticated']){
   await db.exec('begin');
   if(mode==='default-acl')await db.exec('drop function public.'+near+'(text[]);'+definitions[0]+';');
   else await db.exec('grant service_role to '+(mode==='inherited-anon'?'anon':'authenticated'));
   assert.equal((await db.query("select md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) h")).rows[0].h,'d98d88497311a8d06a31556004df30a2','Unsafe privileges can coexist with the exact baseline body hash');
   await assert.rejects(db.exec(migration),/service boundary/,'The migration must reject '+mode);await db.exec('rollback');checks++;
  }
  const before=await metadata();await db.exec('begin;'+migration+'commit;');
  const firstNear=(await db.query('select pg_get_functiondef($1::regprocedure) definition',[signatures[0]])).rows[0].definition;
  for(const mode of ['default-acl','inherited-anon','inherited-authenticated']){
   await db.exec('begin');
   if(mode==='default-acl')await db.exec('drop function public.'+near+'(text[]);'+firstNear+';');
   else await db.exec('grant service_role to '+(mode==='inherited-anon'?'anon':'authenticated'));
   await assert.rejects(db.exec(finalMigration),/service boundary/,'Late projection must reject '+mode);await db.exec('rollback');checks++;
  }
  await db.exec('begin;'+finalMigration+'commit;');assert.deepEqual(await metadata(),before,'Stable/invoker, empty search path and exact private grants remain unchanged');checks++;
  await db.exec('begin');await assert.rejects(db.exec(finalMigration),/differ from reviewed first repair/);await db.exec('rollback');checks++;
  await db.exec('begin');await assert.rejects(db.exec(migration),/differ from reviewed baseline/);await db.exec('rollback');checks++;
  const now=(await db.query('select statement_timestamp() as t')).rows[0].t,clock=m=>new Date(Date.parse(now)+m*60000).toISOString(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const base={key:'football',date:today,status:'upcoming',startTimeUtc:clock(120),sourceCheckedAt:clock(-30),homeParticipantId:'home',awayParticipantId:'away',participantIds:['home','away'],originalNested:{unknown:[0,null,false,'retained']}};
  const fixtures=[
   {...base,id:'live',status:'live',startTimeUtc:clock(-10),homeScore:0,awayScore:7},
   {...base,id:'same-sides',date:'2099-01-01',startTimeUtc:'2099-01-01T12:00:00Z'},
   {...base,id:'alias',fixtureIdAliases:['live']},
   {...base,id:'unknown-clock',startTimeUtc:'unconfirmed'},
   {...base,id:'date-only',startTimeUtc:null},
   {...base,id:'zero',status:'completed',statusCheckedAt:clock(-20),homeScore:0,awayScore:0},
   {...base,id:'old',date:'2020-01-01',status:'completed',startTimeUtc:'2020-01-01T12:00:00Z'},
   {...base,id:'window',date:null,startDate:null,schedulingWindow:{startsOn:today,endsOn:today}},
   {...base,id:'pipe-one',status:'live',homeParticipantId:'A|B',awayParticipantId:'C'},
   {...base,id:'pipe-other',homeParticipantId:'A',awayParticipantId:'B|C'},
  ];
  for(let i=0;i<180;i++)fixtures.push({...base,id:'future:'+i,homeParticipantId:'home:'+i,awayParticipantId:'away:'+i,participantIds:['home:'+i,'away:'+i]});
  await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report) values('query-work',$1::jsonb),('query-context','{}')",[JSON.stringify({_fixtureObservations:{live:{s:clock(-30),t:clock(-30)}}})]);
  const insert=async(source,events)=>db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select $1,e->>'id',e,array[e->>'id']||array(select jsonb_array_elements_text(coalesce(e->'fixtureIdAliases','[]'))),e->>'id' from jsonb_array_elements($2::jsonb) e",[source,JSON.stringify(events)]);
  await insert('query-work',fixtures);await insert('query-context',[{...base,id:'transitive',key:null,fixtureIdAliases:['alias'],venue:'Original context'}]);
  const scope=(ids=['home'],required=[])=>[['football'],['football','tennis','nrl'],ids,required];
  const equal=async(label,ids=[],params=scope())=>{
   let r=(await db.query('select public.qa_before_snapshot_near($1) old,public.'+near+'($1) new',[ids])).rows[0];assert.deepEqual(r.new,r.old,label+' near complete payload');
   r=(await db.query('select public.qa_before_snapshot_participant($1,$2,$3,$4) old,public.'+participant+'($1,$2,$3,$4) new',params)).rows[0];assert.deepEqual(r.new,r.old,label+' participant complete payload');checks+=2;return r.new;
  };
  await equal('Full facts, context, unknown clocks, originals, completed and zero');await equal('Protected far corrections',['future:179'],scope(['home'],['future:179']));await equal('Bound unusual identities',["'); SELECT 1; --"],scope(['home'],['future:179']));
  for(const patch of [{status:null,startTimeUtc:null,date:null,schedulingWindow:null},{status:'live',homeScore:0,awayScore:0},{status:'completed',statusCheckedAt:clock(-20),date:'2020-01-01'},{status:'upcoming',startTimeUtc:'invalid',endDate:'unknown'}]){
   await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('query-work','date-only',$1::jsonb,'changed') on conflict(source_id,fixture_id) do update set score=excluded.score",[JSON.stringify(patch)]);await equal('Score/null/date override');
  }
  const hasNear=async fixtureId=>(await db.query('select public.'+near+"('{}') body")).rows[0].body.rows.some(r=>r.fixture_id===fixtureId);
  // Completion selection must preserve presence/null rules while decoding
  // only the raw fields needed by a completed fixture.
  for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt']){
   const fixtureId='completion:'+field;
   await insert('query-work',[{...base,id:fixtureId,status:'completed',homeParticipantId:fixtureId+':h',awayParticipantId:fixtureId+':a',participantIds:[],[field]:'unconfirmed',unmodifiedPayload:{original:[null,false,0,{nested:'retained'}]}}]);
   await equal('Malformed completion remains conservatively included');assert(await hasNear(fixtureId));checks++;
   await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('query-work',$1,$2::jsonb,'null-clock')",[fixtureId,JSON.stringify({[field]:null})]);
   await equal('Explicit score-null suppresses its base completion field');assert(!await hasNear(fixtureId));checks++;
  }
  await insert('query-work',[{...base,id:'recent-completion',status:'completed',homeParticipantId:'recent:h',awayParticipantId:'recent:a',participantIds:[]}]);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('query-work','recent-completion','{}','recent',$1)",[clock(-20)]);
  await equal('Recent first completion is sufficient without other marks');assert(await hasNear('recent-completion'));checks++;
  await insert('query-work',[{...base,id:'both-status-checks',status:'completed',statusCheckedAt:'unconfirmed',homeParticipantId:'checks:h',awayParticipantId:'checks:a',participantIds:[]}]);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('query-work','both-status-checks','{\"statusCheckedAt\":null}','checks')");
  await equal('Both raw status-check marks remain independent');assert(await hasNear('both-status-checks'));checks++;
  await insert('query-work',[{...base,id:'irrelevant-completion',actualEndTimeUtc:{unknown:true},homeParticipantId:'irrelevant:h',awayParticipantId:'irrelevant:a',participantIds:[]}]);
  await equal('Non-final completion fields cannot admit a future fixture');assert(!await hasNear('irrelevant-completion'));checks++;
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('query-work','irrelevant-completion','{\"status\":\"completed\",\"actualEndTimeUtc\":0}','non-text')");
  await equal('Non-text final completion remains conservatively included');assert(await hasNear('irrelevant-completion'));checks++;
  const corruptions=[
   "delete from nothingsports_fixture_read_private.fixture_tokens where source_id='query-work' and fixture_id='live' and kind=1",
   "insert into nothingsports_fixture_read_private.fixture_tokens(source_id,fixture_id,kind,token) values('query-work','live',1,'extra-token')",
   "delete from nothingsports_fixture_read_private.source_tokens where source_id='query-work' and kind=1 and token='live'",
   "insert into nothingsports_fixture_read_private.source_tokens(source_id,kind,token) values('query-work',1,'extra-source-token')",
   "update nothingsports_fixture_read_private.fixture_context set shape_version=2 where source_id='query-work' and fixture_id='live'",
   "delete from nothingsports_fixture_read_private.fixture_context where source_id='query-work' and fixture_id='live'",
  ];
  for(const sql of corruptions){await db.exec('begin');await db.exec(sql);const got=await equal('Pending corruption retains every original integrity check');assert.equal(got.complete,false);checks++;await db.exec('rollback');}
  await db.exec('begin');await db.query("update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('date','2099-01-01','startTimeUtc',$1::text) where fixture_id='window'",['2099-01-01T12:00:00Z']);await equal('Read during canonical transaction');await db.exec('rollback');
  for(const params of [scope(['home'],Array(5001).fill('too-many')),[['football'],['tennis'],['home'],[]],scope(['invalid identity'])]){const got=await equal('Invalid requirements remain incomplete',Array(5001).fill('too-many'),params);assert.equal(got.complete,false);checks++;}
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.'+near+"('{}')"),/permission denied/);await assert.rejects(db.query('select public.'+participant+"('{football}','{football}','{home}','{}')"),/permission denied/);await db.exec('reset role');checks+=2;}
  await db.exec('set role service_role');await equal('Actual service caller');await db.exec('reset role');
  const cap=Array.from({length:5002},(_,i)=>({id:'cap:'+i,key:'football',status:'live'}));await insert('query-work',cap);const got=await equal('5001-row sentinel is retained');assert.equal(got.complete,false);assert.equal(got.rows.length,5001);checks++;
  const after=(await db.query("select md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) near,md5(pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure)) participant")).rows[0];
  await db.exec('begin');await db.exec(definitions.join(';\n')+';');assert.equal((await db.query("select md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) h")).rows[0].h,'d98d88497311a8d06a31556004df30a2');assert.equal((await db.query("select md5(pg_get_functiondef('public.nothingsports_read_participant_fixture_bundle(text[],text[],text[],text[])'::regprocedure)) h")).rows[0].h,'8071c1ba3e6712a57a1c6b30c2cc6b9b');await db.exec('rollback');checks+=2;
  console.log(JSON.stringify({passed:true,checks,actualSql:true,completePayloadAgreement:true,integrityCorruptions:corruptions.length,overCapacitySentinel:true,metadataUnchanged:true,newDefinitions:after,productionChanged:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
