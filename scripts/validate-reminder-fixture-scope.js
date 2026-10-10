#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const fixtures=require('../lib/reminder-fixtures'),automatic=require('../lib/automatic-reminders'),policy=require('../config/fixture-reminder-policy'),schedules=require('../lib/reminder-schedules');
(async()=>{
 const db=new PGlite(),now=new Date(),start=h=>new Date(+now+h*3600000).toISOString(),athlete='competitor:tennis:wta:aryna-sabalenka';
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;');
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
  for(const name of ['20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec("create table public.nothingsports_reminder_intents(fixture_id text,enabled boolean,choice text);create table public.nothingsports_reminders(event_id text,dispatched_at timestamptz);grant select on public.nothingsports_reminder_intents,public.nothingsports_reminders to service_role;");
  await db.exec(fs.readFileSync('supabase/migrations/20261010114326_bound_reminder_fixture_read_scope.sql','utf8'));
  await db.query("insert into public.nothingsports_fixture_sources(source_id,checked_at,next_due_at) values('test',$1,$2)",[now.toISOString(),start(1)]);
  const base={key:'tennis-women',name:'Sabalenka vs opponent',participantIds:[athlete,'athlete:opponent'],status:'upcoming',scheduleStatus:'confirmed',timePrecision:'exact',sourceUrl:'https://organiser.example/order',sourceCheckedAt:now.toISOString(),roundLabel:'Round of 64',tournamentLevel:'WTA 1000'};
  const rows=[
   {...base,id:'near-new',startTimeUtc:start(1)},
   {...base,id:'far-new',startTimeUtc:start(100)},
   {...base,id:'bool-round',roundLabel:'Sport-specific stage',isKnockout:true,startTimeUtc:start(100)},
   {...base,id:'ordinal-round',roundLabel:'First round',startTimeUtc:start(100)},
   {...base,id:'minor-final',tournamentLevel:'WTA 500',roundLabel:'Final',startTimeUtc:start(100)},
   {...base,id:'minor-semi',tournamentLevel:'WTA 500',roundLabel:'Semi-final',startTimeUtc:start(100)},
   {...base,id:'group-finals',tournamentLevel:'WTA Finals',roundLabel:'Group',startTimeUtc:start(1)},
   {...base,id:'manual-league',key:'football',roundLabel:'Week 7',startTimeUtc:start(100),sourceEventIds:['alias:manual']},
   {...base,id:'manual-request',roundLabel:'Group',startTimeUtc:start(200)},
   {...base,id:'saved-completed',status:'completed',startTimeUtc:null},
   {...base,id:'saved-postponed',status:'postponed',startTimeUtc:null},
   {...base,id:'queue-cancelled',status:'cancelled',startTimeUtc:null},
   {...base,id:'score-near',roundLabel:'League',startTimeUtc:start(100)},
   {...base,id:'score-cleared',startTimeUtc:start(1)},
   {...base,id:'invalid-clock',startTimeUtc:'2026-02-30T12:00:00Z'},
   {...base,id:'no-zone',startTimeUtc:'2099-01-01T12:00:00'},
   {...base,id:'not-before',timePrecision:'not-before',startTimeUtc:start(100)},
   {...base,id:'estimated',timePrecision:'estimated',startTimeUtc:start(1)},
   {id:'nested-parent',kind:'tournament',publishedFixtures:[{...base,id:'nested:1',startTimeUtc:start(100)}]},
  ];
  const insert=async values=>db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'test',e->>'id',e,array[e->>'id']||array(select jsonb_array_elements_text(coalesce(e->'sourceEventIds','[]'::jsonb))),md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(values)]);
  await insert(rows);
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'test','league:'||i,jsonb_build_object('id','league:'||i,'roundLabel','Week 1','startTimeUtc',$1::text,'editorialNarrative',repeat('x',2000)),array['league:'||i],'test' from generate_series(1,3000) i",[start(200)]);
  await db.exec("insert into public.nothingsports_reminder_intents values('alias:manual',true,'on'),('saved-completed',true,'automatic'),('saved-postponed',true,'automatic');insert into public.nothingsports_reminders values('queue-cancelled',null);");
  for(const [id,t] of [['score-near',start(1)],['score-cleared',null]])await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('test',$1,jsonb_build_object('id',$1::text,'startTimeUtc',$2::text),'test')",[id,t]);
  await db.exec('set role service_role');
  const calls=[],request=async(p,o)=>{
   calls.push({p,o});const name=p.split('/').at(-1),value=await db.query('select * from public.'+name+'('+('p_required_ids' in o.body?'$1':'')+')','p_required_ids' in o.body?[o.body.p_required_ids]:[]);
   return name.endsWith('bundle')?value.rows[0][name]:value.rows;
  };
  const catalogue=await fixtures.catalogue({rows:[],now,requiredIds:['manual-request'],request});
  assert.equal(calls.length,2,'One shared scope uses the existing two parallel reads');assert(!calls.some(c=>c.p.includes('read_current_fixture_bundle')));
  assert(!catalogue.resolve('league:3000'),'Unselected distant non-knockout leagues do not transfer their season context');
  for(const id of ['near-new','far-new','bool-round','ordinal-round','minor-final','not-before','manual-league','manual-request','saved-completed','saved-postponed','queue-cancelled','score-near','nested-parent'])assert(catalogue.resolve(id),'Retain discovery, decisions and correction for '+id);
  assert(!catalogue.resolve('invalid-clock'));assert(!catalogue.resolve('no-zone'));assert(!catalogue.resolve('score-cleared'),'An absent clock cannot manufacture a new automatic intent');
  assert.equal(catalogue.resolve('not-before').timePrecision,'not-before');assert.equal(catalogue.resolve('far-new').sourceCheckedAt,now.toISOString(),'Read cannot renew source evidence');
  assert.deepEqual(catalogue.resolve('nested-parent').publishedFixtures,rows.at(-1).publishedFixtures,'Nested children retain their independent clocks');
  const fullRows=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) value')).rows[0].value.rows.map(r=>r.fixture),full=fixtures.index(fullRows);
  const preferences={version:24,preferenceGraph:{entityFollows:[{participantId:athlete,followLevel:'follow'}]},followFirst:{notifications:{}}};
  for(const override of [{},{autoRemindersEnabled:false}]){
   const account={preferences:{...preferences,followFirst:{notifications:override}},actions:{'far-new':{reminderChoice:'off'}},intents:[{fixtureId:'manual-league',choice:'on',enabled:true},{fixtureId:'saved-postponed',choice:'automatic',enabled:true}]};
   assert.deepEqual(automatic.decisions(account,catalogue,now),automatic.decisions(account,full,now),'Full and scoped account decisions agree with OFF, manual intent and stopped matches');
  }
  for(const row of fullRows)if(policy.automatic(row,preferences,{},+now))assert(catalogue.resolve(row.id),'Every automatic candidate survives conservative SQL selection, including distant rounds');
  for(const id of ['saved-completed','saved-postponed','queue-cancelled'])assert.equal(schedules.decision({id,event_id:id,delivery_mode:'match-15'},catalogue.resolve(id),now).state,'inactive','Terminal corrections are retained for unsent queues');
  await db.exec('reset role');for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.nothingsports_read_reminder_fixture_bundle(text[])','execute') ok",[role])).rows[0].ok,false);
  const bundle=(await db.query('select public.nothingsports_read_reminder_fixture_bundle($1) value',[Array.from({length:5001},(_,i)=>'budget:'+i)])).rows[0].value;assert.equal(bundle.complete,false,'Identity overflow fails closed');
  await insert(Array.from({length:5001},(_,i)=>({...base,id:'overflow:'+i,startTimeUtc:start(1)})));
  assert.equal((await db.query('select public.nothingsports_read_reminder_fixture_bundle($1) value',[[]])).rows[0].value.complete,false,'Fixture overflow fails closed');
  await assert.rejects(()=>fixtures.catalogue({rows:[],now,request}),/Incomplete current fixture bundle/);
 }finally{await db.close();}
 const empty={schemaVersion:'current-fixture-bundle.v1',scope:'reminders',requiredIds:[],complete:true,rows:[]};
 for(const mutation of [{scope:'global'},{requiredIds:['wrong']},{complete:false}])await assert.rejects(()=>fixtures.catalogue({rows:[],now,request:async p=>p.endsWith('bundle')?{...empty,...mutation}:[]}));
 for(const status of [400,404]){
  const calls=[];await assert.rejects(()=>fixtures.catalogue({rows:[],now,request:async p=>{calls.push(p);if(p.endsWith('bundle'))throw new (require('../lib/supabase-server').SupabaseRequestError)('Missing',{status});return [];} }),e=>e.status===503);
  assert.equal(calls.length,2,'Missing scoped RPC cannot fall back to a broad unverified catalogue');
 }
 console.log('Reminder SQL scope: distant automatic intent, manual/alias decisions, terminal queue corrections, nested clocks, source overlay, full-policy parity, unchanged two-read budget and service-only fail-closed limits passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
