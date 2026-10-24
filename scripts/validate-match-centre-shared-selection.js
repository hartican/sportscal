'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const signature='public.nothingsports_read_match_centre_fixture_bundle(text[])';
const migration=fs.readFileSync('supabase/migrations/20261024095500_share_match_centre_selection_scan.sql','utf8');
const undo=fs.readFileSync('scripts/sql/rollback-match-centre-selection-scan.sql','utf8');
(async()=>{
 const db=await require('./fixture-read-test-baseline').database();let checks=0;
 try{
 const digest=async()=>(await db.query('select md5(pg_get_functiondef($1::regprocedure)) d',[signature])).rows[0].d;
 assert.equal(await digest(),'d9b49086166c24b3a10b4dc1f7279b7c');
 const inputFingerprints={};
 for(const [name,expected] of [['public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)','44d1edfc00ada08fad8deb987472ad54'],['public.nothingsports_fixture_observation_time(text)','13842433b7af056a35c01e8b234ae3c9'],['nothingsports_fixture_read_private.sync_fixture(text,text)','3c20e52d95ebda90af1bb15369939738']]){inputFingerprints[name]=(await db.query('select md5(pg_get_functiondef($1::regprocedure)) d',[name])).rows[0].d;assert.equal(inputFingerprints[name],expected);}
 const currentRelation=(await db.query("select relkind,relrowsecurity,relforcerowsecurity from pg_class where oid='public.nothingsports_fixture_current'::regclass")).rows[0];assert.deepEqual(currentRelation,{relkind:'r',relrowsecurity:true,relforcerowsecurity:true});
 const original=(await db.query('select pg_get_functiondef($1::regprocedure) d',[signature])).rows[0].d;
 await db.exec(original.replace('public.nothingsports_read_match_centre_fixture_bundle','public.qa_shared_selection_reference')+';revoke all on function public.qa_shared_selection_reference(text[]) from public,anon,authenticated;grant execute on function public.qa_shared_selection_reference(text[]) to service_role;');
 const attrs=async()=>(await db.query('select provolatile,prosecdef,proparallel,proleakproof,proisstrict,proconfig,proacl::text acl,prorettype,proretset,prorows,proargnames from pg_proc where oid=$1::regprocedure',[signature])).rows[0];
 const contracts=async()=>(await db.query("select jsonb_object_agg(p.oid::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='nothingsports_fixture_read_private' or n.nspname='public' and p.proname like 'nothingsports_%') and p.oid<>$1::regprocedure",[signature])).rows[0].v;
 const beforeAttrs=await attrs(),beforeContracts=await contracts();
 for(const mutation of ['alter function '+signature+' immutable','alter function '+signature+' security definer','grant execute on function '+signature+' to public','grant service_role to anon','revoke execute on function '+signature+' from service_role','alter table public.nothingsports_fixture_current alter column global_fixture drop expression','alter table public.nothingsports_fixture_current disable row level security']){
  await db.exec('begin;'+mutation+';');await assert.rejects(db.exec(migration),/differs from reviewed baseline|differs from private service boundary/);await db.exec('rollback;');checks++;
 }
 await db.exec('begin;'+migration+'commit;');assert.equal(await digest(),'2b77bfdd5e17d2ceb0737ea53221a4d9');
 assert.deepEqual(await attrs(),beforeAttrs);assert.deepEqual(await contracts(),beforeContracts);checks++;
 await db.exec('begin;');await assert.rejects(db.exec(migration),/differs from reviewed baseline/);await db.exec('rollback;');checks++;
 const now=Date.now(),at=m=>new Date(now+m*60000).toISOString();
 const fixture=(id,patch={})=>({id,key:'nrl',status:'scheduled',startTimeUtc:at(600),homeParticipantId:id+':home',awayParticipantId:id+':away',statusCheckedAt:at(-1440),...patch});
 const insert=async(events,source='shared-test')=>db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select $1,e->>\'id\',e,array[e->>\'id\']||coalesce(array(select jsonb_array_elements_text(e->\'fixtureIdAliases\')),\'{}\'::text[]),md5(e::text) from jsonb_array_elements($2::jsonb) e',[source,JSON.stringify(events)]);
 const read=async(ids=[])=>(await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1) v',[ids])).rows[0].v;
 const equal=async(ids=[])=>{assert.equal((await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)=public.qa_shared_selection_reference($1) same',[ids])).rows[0].same,true,'Whole ordered payload and complete membership must match independent D9');checks++;};
 await equal();await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('shared-test'),('shared-peer');");
 const fixtures=[fixture('preserved-far',{fixtureIdAliases:['alias:far']}),fixture('missing-date',{startTimeUtc:null}),fixture('alias-a',{status:'live',fixtureIdAliases:['link:a']}),fixture('alias-b',{fixtureIdAliases:['link:a','link:b']}),fixture('alias-c',{fixtureIdAliases:['link:b']}),fixture('same-sides',{homeParticipantId:'alias-a:away',awayParticipantId:'alias-a:home'}),fixture('pipe-a',{status:'live',homeParticipantId:'a|b',awayParticipantId:'c'}),fixture('pipe-b',{homeParticipantId:'a',awayParticipantId:'b|c'})];
 for(const status of ['live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing','scheduled','upcoming','completed','finished','final','cancelled','canceled','abandoned',null,'unknown'])fixtures.push(fixture('status:'+status,{status,statusCheckedAt:at(-10),startTimeUtc:at(15)}));
 for(const [i,startTimeUtc] of [null,'',0,{unknown:true},'unconfirmed','2026-02-30T10:00:00Z','2026-10-24T10:00:00',at(30),at(32)].entries())fixtures.push(fixture('clock:'+i,{startTimeUtc}));
 for(const field of ['actualEndTimeUtc','completedAt','firstConfirmedCompleteAt','resultPublishedAt','statusCheckedAt'])for(const [i,value] of [null,'unconfirmed',at(-10),at(-1440),0,{unknown:true}].entries())fixtures.push(fixture(field+':'+i,{status:'completed',[field]:value}));
 await insert(fixtures);await insert([fixture('peer-alias',{fixtureIdAliases:['link:b'],status:'completed',homeScore:0,awayScore:0,statusCheckedAt:at(-10)})],'shared-peer');
 for(const ids of [[],null,['alias:far'],['missing-date'],['alias:far','alias:far'],["');SELECT 1;--"],Array(5001).fill('alias:far')])await equal(ids);
 const got=await read(['alias:far','missing-date']),ids=new Set(got.rows.map(r=>r.fixture_id));for(const id of ['preserved-far','missing-date','alias-a','alias-b','alias-c','same-sides','peer-alias'])assert(ids.has(id),id);assert(!ids.has('pipe-b'));checks++;
 for(const patch of [{status:null,startTimeUtc:null,homeParticipantId:null},{status:'completed',statusCheckedAt:at(-10),homeScore:0,awayScore:0},{status:'scheduled',startTimeUtc:'unconfirmed',awayParticipantId:'changed'}]){
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('shared-test','alias-a',$1,'test') on conflict(source_id,fixture_id) do update set score=excluded.score",[JSON.stringify(patch)]);await equal(['alias:far']);
 }
 for(const firstCompleted of [at(-10),at(-1440)]){await db.query("update public.nothingsports_live_scores set first_completed_at=$1 where source_id='shared-test' and fixture_id='alias-a'",[firstCompleted]);await equal();}
 await db.query("update public.nothingsports_fixture_sources set discovery_report=$1 where source_id='shared-test'",[JSON.stringify({_fixtureObservations:Object.fromEntries(fixtures.map(e=>[e.id,{s:at(-15),t:at(-12)}]))})]);await equal();
 await db.exec("begin;delete from nothingsports_fixture_read_private.fixture_context where source_id='shared-test' and fixture_id='alias-a';");await equal();await db.exec('rollback;');
 await db.exec("begin;update public.nothingsports_fixture_current set fixture=fixture||'{\"startTimeUtc\":null,\"status\":\"live\"}'::jsonb where fixture_id='preserved-far';");await equal();await db.exec('rollback;');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(read(),/permission denied/);await db.exec('reset role');checks++;}
 await db.exec('set role service_role;');await equal(['alias:far']);await db.exec('reset role;');
 const plan=async()=>{const body=(await db.query('select prosrc s from pg_proc where oid=$1::regprocedure',[signature])).rows[0].s;return(await db.query('explain(format json) '+body.replaceAll('p_membership_ids','$1::text[]'),[[]])).rows[0]['QUERY PLAN'][0];};
 const sharedScan=async()=>{const stages=[];function walk(n){if(['CTE scan_inputs','CTE seed_inputs','CTE lookup'].includes(n['Subplan Name']))stages.push(n);for(const c of n.Plans||[])walk(c);}walk((await plan()).Plan);assert.equal(stages.filter(n=>n['Subplan Name']==='CTE scan_inputs').length,1,'Unfiltered input scan must be shared');let baseScans=0;function count(n){if(n['Relation Name']==='nothingsports_fixture_current')baseScans++;for(const c of n.Plans||[])count(c);}for(const n of stages)count(n);assert.equal(baseScans,1,'Admission and lookup must share exactly one canonical scan');};
 await sharedScan();checks++;
 await db.exec('begin;'+undo);await assert.rejects(sharedScan(),/Unfiltered input scan must be shared/,'Exact original reader must fail work-reduction check');await db.exec('rollback;');checks++;
 await db.exec('begin;'+undo+'commit;');assert.equal(await digest(),'d9b49086166c24b3a10b4dc1f7279b7c');await equal(['alias:far']);
 await db.exec('begin;'+migration+'commit;');await equal(['alias:far']);await sharedScan();
 await db.exec("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'shared-test','overflow:'||i,jsonb_build_object('id','overflow:'||i,'status','live'),array['overflow:'||i],'overflow' from generate_series(1,5002) i;");
 await equal();const overflow=await read();assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001);checks++;
 assert.equal((await read(Array(5001).fill('missing-date'))).complete,false);checks++;
 assert.deepEqual(await attrs(),beforeAttrs);assert.deepEqual(await contracts(),beforeContracts);checks++;
 console.log(JSON.stringify({passed:true,checks,engine:(await db.query('select version() v')).rows[0].v,inputFingerprints,currentRelation,wholeOrderedPayloadEqual:true,actualOldWorkNegative:true,serviceOnly:true,rollbackReapply:true,productionCalls:0,hostedAcceptance:false}));
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
