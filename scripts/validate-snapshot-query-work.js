'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const near='nothingsports_read_match_centre_fixture_bundle',participant='nothingsports_read_participant_fixture_bundle';
// The original equivalence rehearsal below deliberately keeps its historical
// contract. This separate latest-reader rehearsal expands terminal membership.
async function terminalPolicy(){
 const db=await require('./validate-profile-fixture-scope').database(),model=require('../config/match-centre');let checks=0;
 const {createSnapshotStore}=require('../lib/live-fixtures'),{createMatchCentreHandler}=require('../lib/match-centre-handler');
 try{
  for(const suffix of ['_bound_fixture_snapshot_query_work.sql','_defer_match_fixture_payload.sql'])await db.exec('begin;'+fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(n=>n.endsWith(suffix)),'utf8')+'commit;');
  const signature='public.'+near+'(text[])',definition=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;
  assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) h',[signature])).rows[0].h,'5618806378575ad0aebb7d5ba43922d7');checks++;
  await db.exec(definition.replace('public.'+near+'(','public.qa_before_terminal_near(')+';');
  const names=fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('_include_source_terminal_match_window.sql'));assert.equal(names.length,1);
  const migration=fs.readFileSync('supabase/migrations/'+names[0],'utf8');
  const metadata=async()=>(await db.query("select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) hash,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'nothingsports_%' order by signature")).rows;
  const before=await metadata();
  for(const mode of ['default-acl','inherited-anon','inherited-authenticated','different-body','different-projector']){
   await db.exec('begin');
   if(mode==='default-acl')await db.exec('drop function '+signature+';'+definition+';');
   else if(mode.startsWith('inherited-'))await db.exec('grant service_role to '+mode.slice(10));
   else if(mode==='different-body')await db.exec(definition.replace('with recursive','with /* unexpected */ recursive'));
   else await db.exec("alter function public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz) volatile");
   await assert.rejects(db.exec(migration),mode.startsWith('different-')?/reviewed baseline/:/service boundary/);await db.exec('rollback');checks++;
  }
  const now=Date.parse((await db.query('select statement_timestamp() t')).rows[0].t),clock=m=>new Date(now+m*60000).toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const fixture=(id,extra={})=>({id,key:'nrl',kind:'fixture',date,status:'cancelled',startTimeUtc:clock(-90),statusCheckedAt:clock(-20),homeParticipantId:id+':h',awayParticipantId:id+':a',...extra});
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('terminal-policy')");
  const insert=async e=>db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) values('terminal-policy',$1,$2,$3::jsonb,$1)",[e.id,[e.id,...(e.fixtureIdAliases||[])],JSON.stringify(e)]);
  const patch=async(id,value)=>db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('terminal-policy',$1,$2::jsonb,$1) on conflict(source_id,fixture_id) do update set score=excluded.score",[id,JSON.stringify(value)]);
  const rpc=async(ids=[])=> (await db.query('select public.'+near+'($1) body',[ids])).rows[0].body;
  const raw=['cancelled','canceled','abandoned'].map(status=>fixture('raw:'+status,{status}));
  for(const e of raw)await insert(e);
  assert.equal(model.select(raw.map(e=>({...e,statusFactObservedAt:e.statusCheckedAt})),now).length,3);
  assert.deepEqual((await rpc()).rows,[],'Definitive pre-repair RED: source-only terminals omitted with complete:true');assert.equal((await rpc()).complete,true);checks++;
  await db.exec('begin;'+migration+'commit;');
  const after=await metadata(),nearSignature=signature.replace(/^public\./,'');assert.deepEqual(after.map(r=>({...r,hash:r.signature===nearSignature?'changed':r.hash})),before.map(r=>({...r,hash:r.signature===nearSignature?'changed':r.hash})),'Only the near definition changes; every function/permission/projector remains');checks++;
  const expanded=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;
  assert.equal(expanded.replaceAll("in('completed','finished','final','cancelled','canceled','abandoned')","in('completed','finished','final')"),definition,'Exactly three terminal sets change in the installed late-projection body');checks++;
  await db.exec('begin');await assert.rejects(db.exec(migration),/reviewed baseline/);await db.exec('rollback');checks++;
  const calls=[];
  const store=createSnapshotStore({timer:()=>0,request:async(route,{body,timeoutMs})=>{
   assert.equal(timeoutMs,5000);calls.push({route,body});
   if(route.endsWith('nothingsports_read_fixture_source_health'))return (await db.query('select * from public.nothingsports_read_fixture_source_health()')).rows;
   assert(route.endsWith(near));return rpc(body.p_membership_ids);
  }});
  const read=async()=>store.read({scope:'match-centre',interactive:true,now});
  const events=async()=> (await read()).flatMap(s=>s.fixtures);
  let moment=now,fail=false;
  const handler=createMatchCentreHandler({enabled:()=>true,published:()=>[],clock:()=>moment,timer:()=>0,request:async route=>{assert(route.endsWith('nothingsports_read_match_scores'));return [];},snapshotRead:async opts=>{
   assert.deepEqual(opts.preserveIds,[]);assert.equal(opts.scope,'match-centre');
   if(fail)throw Error('Controlled SQL transport unavailable');
   return {sources:await read(),stale:false,readAt:moment};
  }});
  const response=async()=>{const res={setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};await handler({method:'GET',url:'/?membership=everything&limit=60'},res);assert.equal(res.statusCode,200);return res.body;};
  for(const status of ['cancelled','canceled','abandoned']){
   await insert(fixture('score:'+status,{status:'upcoming',statusCheckedAt:clock(-100)}));await patch('score:'+status,{status,statusCheckedAt:clock(-20)});
  }
  const expected=[...raw.map(e=>e.id),...['cancelled','canceled','abandoned'].map(s=>'score:'+s)].sort();
  assert.deepEqual((await rpc()).rows.map(r=>r.fixture_id).sort(),expected);checks++;
  let loaded=await events();assert.deepEqual(model.select(loaded,now).map(model.id).sort(),expected);
  let publicBody=await response();assert.equal(publicBody.membershipStale,false);assert.deepEqual(publicBody.fixtures.map(e=>e.id).sort(),expected);for(const e of publicBody.fixtures)assert(expected.includes(e.id)&&/^(cancelled|canceled|abandoned)$/.test(e.status));checks+=2;
  assert(calls.every(c=>!c.route.includes('read_current_fixture')));assert(calls.filter(c=>c.route.endsWith(near)).every(c=>c.body.p_membership_ids.length===0),'No published/preserved IDs hide the source-only bug');checks++;
  // Re-verification updates independent receipts, never the sporting fact.
  const original=Object.fromEntries(loaded.map(e=>[e.id,e.statusFactObservedAt]));
  await db.query("update public.nothingsports_fixture_sources set checked_at=$1,discovery_report=$2::jsonb where source_id='terminal-policy'",[clock(0),JSON.stringify({_fixtureObservations:Object.fromEntries(expected.map(id=>[id,{t:clock(0),s:clock(0)}]))})]);
  loaded=await events();for(const e of loaded){assert.equal(e.statusFactObservedAt,original[e.id]);assert.equal(Date.parse(e.statusCheckedAt),now);assert.equal(model.section(e,now+41*60000),null);assert.equal(model.section(e,now+39*60000),'recently-finished');}checks++;
  moment=now+41*60000;assert.equal((await response()).fixtures.length,0,'Later reread cannot renew original terminal hour');moment=now;checks++;
  for(const status of ['cancelled','canceled','abandoned']){
   // Retain the earliest known terminal fact even when a newer fact is present.
   const id='first:'+status;await insert(fixture(id,{status,firstConfirmedCompleteAt:clock(-59),statusCheckedAt:clock(-1)}));
   const e=(await events()).find(e=>e.id===id);assert.equal(model.section(e,now),'recently-finished');assert.equal(model.section(e,now+2*60000),null);checks++;
   const compactId='first-score:'+status;await insert(fixture(compactId,{status:'upcoming',statusCheckedAt:null}));await patch(compactId,{status,statusCheckedAt:clock(-1)});
   await db.query("update public.nothingsports_live_scores set first_completed_at=$1 where fixture_id=$2",[clock(-59),compactId]);
   const compact=(await events()).find(e=>e.id===compactId);assert.equal(Date.parse(compact.firstConfirmedCompleteAt),Date.parse(clock(-59)));assert.equal(model.section(compact,now),'recently-finished');assert.equal(model.section(compact,now+2*60000),null);checks++;
   for(const mode of ['raw','score']){
    const id='expired:'+mode+':'+status;await insert(fixture(id,{status:mode==='raw'?status:'upcoming',statusCheckedAt:clock(-100)}));if(mode==='score')await patch(id,{status,statusCheckedAt:clock(-100)});
    assert(!(await rpc()).rows.some(r=>r.fixture_id===id),'Original old terminal facts do not enter near SQL');checks++;
   }
  }
  // Conservative SQL inclusion of malformed nonempty marks is intentional;
  // strict shared model/handler eligibility cannot turn them into a clock.
  for(const [label,value] of [['null',null],['unknown','unconfirmed'],['invalid','2026-99-99T25:00:00Z'],['future',clock(10)]])for(const mode of ['raw','score']){
   const id='clock:'+mode+':'+label;await insert(fixture(id,{status:mode==='raw'?'abandoned':'upcoming',statusCheckedAt:null}));
   if(mode==='raw')await db.query("update public.nothingsports_fixture_current set fixture=fixture||jsonb_build_object('statusCheckedAt',$1::text) where fixture_id=$2",[value,id]);else await patch(id,{status:'abandoned',statusCheckedAt:value});
   const e=(await events()).find(e=>e.id===id);if(e)assert.equal(model.section(e,now),null);assert(!(await response()).fixtures.some(e=>e.id===id));checks++;
  }
  await patch('clock:score:unknown',{status:'abandoned',statusCheckedAt:clock(-10)});assert((await response()).fixtures.some(e=>e.id==='clock:score:unknown'),'A genuine corrected fact recovers without refresh/retry');checks++;
  fail=true;assert.equal((await response()).membershipStale,true);fail=false;assert.equal((await response()).membershipStale,false);checks++;
  // Raw and compact explicit actual/final marks take their existing priority.
  for(const status of ['cancelled','canceled','abandoned'])for(const mode of ['raw','score']){
   const id='actual:'+mode+':'+status,fields={actualEndTimeUtc:clock(-30),completedAt:clock(-15),statusCheckedAt:null};await insert(fixture(id,{status:mode==='raw'?status:'upcoming',statusCheckedAt:null,...(mode==='raw'?fields:{})}));if(mode==='score')await patch(id,{status,...fields});
   const e=(await events()).find(e=>e.id===id);assert(e);assert.equal(model.section(e,now),'recently-finished');assert.equal(model.section(e,now+31*60000),null);checks++;
  }
  for(const status of ['cancelled','canceled','abandoned']){
   const id='null-override:'+status;await insert(fixture(id,{status,completedAt:clock(-20),statusCheckedAt:null}));assert((await response()).fixtures.some(e=>e.id===id));
   await patch(id,{completedAt:null,statusCheckedAt:null});assert(!(await rpc()).rows.some(r=>r.fixture_id===id),'Explicit compact null removes its raw terminal clock');assert(!(await response()).fixtures.some(e=>e.id===id));checks++;
  }
  // Independently compare every model clock against actual global projection,
  // including raw statusFactObservedAt without another completion clock. The
  // accepted projector owns whether that raw field survives; this reader must
  // not invent or renew a fact to make it eligible.
  const clockAdmission=[];
  for(const status of ['cancelled','canceled','abandoned'])for(const mode of ['raw','score'])for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt','statusCheckedAt','statusFactObservedAt']){
   const id='only:'+mode+':'+status+':'+field,fields={[field]:clock(-20)};
   await insert(fixture(id,{status:mode==='raw'?status:'upcoming',statusCheckedAt:null,...(mode==='raw'?fields:{})}));if(mode==='score')await patch(id,{status,statusCheckedAt:null,...fields});
   const global=(await db.query("select public.nothingsports_read_current_fixture_bundle(null) body")).rows[0].body.rows.find(r=>r.fixture_id===id).fixture;
   const selected=model.select([global],now).map(model.id),nearBody=await rpc(),nearRow=nearBody.rows.find(r=>r.fixture_id===id);
   if(selected.length){assert(nearRow,id+' actual global admission must survive near SQL');assert.deepEqual(nearRow.fixture,global);assert((await response()).fixtures.some(e=>e.id===id));}
   else assert(!(await response()).fixtures.some(e=>e.id===id),id+' cannot gain a completion clock through near selection');
   clockAdmission.push({status,mode,field,globallyEligible:selected.length===1,nearReturned:Boolean(nearRow),projectedStatusFactObservedAt:global.statusFactObservedAt});checks++;
  }
  // Original same-side and transitive identity closure is still conservative.
  const anchor=fixture('context-anchor',{status:'abandoned'});await insert(anchor);
  await insert(fixture('alias-one',{status:'past',fixtureIdAliases:['context-anchor'],venue:'Original context'}));
  await insert(fixture('alias-two',{status:'past',fixtureIdAliases:['alias-one'],venue:'Transitive context'}));
  await insert(fixture('same-sides',{status:'past',homeParticipantId:anchor.homeParticipantId,awayParticipantId:anchor.awayParticipantId}));
  const context=await rpc();for(const id of ['context-anchor','alias-one','alias-two','same-sides'])assert(context.rows.some(r=>r.fixture_id===id));checks++;
  // Compare unchanged policy facts using both actual SQL definitions.
  await db.exec('begin');await db.exec("delete from public.nothingsports_live_scores;delete from public.nothingsports_fixture_current");
  for(const status of ['upcoming','live','completed','postponed'])await insert(fixture('unchanged:'+status,{status,startTimeUtc:clock(10)}));
  let equal=(await db.query("select public.qa_before_terminal_near('{}') old,public."+near+"('{}') new")).rows[0];assert.deepEqual(equal.new,equal.old);await db.exec('rollback');checks++;
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(rpc(),/permission denied/);await db.exec('reset role');checks++;}
  await db.exec('set role service_role');assert.equal((await rpc()).complete,true);await db.exec('reset role');checks++;
  assert.equal((await rpc(Array(5001).fill('too-many'))).complete,false);checks++;
  // A large terminal-only source must retain the 5001 completeness sentinel.
  await db.exec('begin');await db.exec("delete from public.nothingsports_live_scores;delete from public.nothingsports_fixture_current");
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) select 'terminal-policy','cap:'||n,array['cap:'||n],jsonb_build_object('id','cap:'||n,'key','nrl','kind','fixture','date',$1::text,'status',case n%3 when 0 then 'cancelled' when 1 then 'canceled' else 'abandoned' end,'statusCheckedAt',$2::text),'cap' from generate_series(1,5001) n",[date,clock(-20)]);
  const cap=await rpc();assert.equal(cap.complete,false);assert.equal(cap.rows.length,5001);await assert.rejects(read(),/Incomplete current fixture bundle/);await db.exec('rollback');checks++;
  return {checks,baselineHash:'5618806378575ad0aebb7d5ba43922d7',newHash:after.find(r=>r.signature===nearSignature).hash,actualSqlStoreHandler:true,sourceOnly:true,clockAdmission,productionChanged:false};
 }finally{await db.close();}
}
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
  const terminal=await terminalPolicy();
  console.log(JSON.stringify({passed:true,checks,actualSql:true,completePayloadAgreement:true,integrityCorruptions:corruptions.length,overCapacitySentinel:true,metadataUnchanged:true,newDefinitions:after,expandedTerminalPolicy:terminal,productionChanged:false}));
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
