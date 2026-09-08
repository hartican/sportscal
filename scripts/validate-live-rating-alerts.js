#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {dispatch, currentEpicRaters, payload} = require('../lib/live-rating-alerts');
const now = new Date('2026-09-08T12:01:01Z');
const vote = (id, rating = 5, at = now) => ({user_id:id, phase:'pulse', rating, updated_at:new Date(at).toISOString()});
const profiles = new Map(['jim','ann','lee','max','viewer'].map(id => [id,{visibility:'visible',display_name:id === 'jim' ? 'Jim' : id}]));
const followed = new Set(profiles.keys());
assert.equal(currentEpicRaters([vote('jim',5,new Date(+now-1)),vote('jim',4)],followed,profiles,'viewer',now).length,0,'changed ratings replace older EPIC votes');
assert.equal(currentEpicRaters([vote('jim'),vote('jim'),vote('viewer')],followed,profiles,'viewer',now).length,1,'distinct people; recipient excluded');
assert.equal(currentEpicRaters([vote('jim')],new Set(),profiles,'viewer',now).length,0,'unfollow is rechecked');
assert.equal(currentEpicRaters([vote('jim',5,new Date(+now-16*60000))],followed,profiles,'viewer',now).length,0,'stale live ratings excluded');
assert.equal(currentEpicRaters([vote('jim')],followed,new Map([['jim',{visibility:'hidden'}]]),'viewer',now).length,0,'private identities excluded');
assert.match(payload({id:'match:1',name:'Alcaraz v Sinner'},[{name:'Jim'},{name:'Ann'},{name:'Lee'},{name:'Max'}]).body,/Jim and 3 others you follow/);
assert.match(payload({id:'match:1',name:'Alcaraz v Sinner'},[{name:'Jim'}]).url,/event=match%3A1&liveRatings=1/);

async function dispatchCase({prefs, phase='live', votes=[vote('jim')], friends=['jim'], visibility='visible', moderation=false, installations=true, fail=[], concurrent=false}={}){
  const event={id:'match:1',eventId:'match:1',key:'tennis',name:'Alcaraz v Sinner',date:'2026-09-08',startTimeUtc:'2026-09-08T12:00:00Z',endTimeUtc:'2026-09-08T15:00:00Z',status:phase,participantIds:['athlete:one','athlete:two'],round:'Final'};
  const alert={id:'alert',event_id:event.id,recipient_user_id:'viewer',created_at:'2026-09-08T12:00:00Z'};
  const deliveries=[];let complete=false,sends=0;
  const api={TABLES:{contributions:'votes'},refreshEventSnapshots:async()=>{},eventFor:()=>phase==='missing'?null:event,eventWithTiming:e=>e,identityMaps:async()=>({profiles:new Map([['jim',{visibility,display_name:'Jim'}]]),personas:new Map([['jim',{moderation_flag:moderation}]])}),rows:async(table)=>{
    if(table==='nothingsports_live_rating_alerts')return complete?[]:[alert];
    if(table==='nothingsports_user_state')return [{preferences:prefs||{followedSports:['tennis']}}];
    if(table==='nothingsports_user_follows')return friends.map(followed_user_id=>({followed_user_id}));
    if(table==='votes')return votes;
    if(table==='nothingsports_push_installations')return installations?[{installation_id:'device',endpoint:'https://push.test',p256dh:'key',auth_key:'auth'}]:[];
    if(table==='nothingsports_live_rating_deliveries')return deliveries;
    throw new Error('Unexpected table '+table);
  }};
  const request=async(path,{body})=>{
    if(path.includes('/rpc/')){
      if(concurrent){if(!deliveries.length)deliveries.push({installation_id:'device',status:'sending'});return [];}
      let d=deliveries[0];if(!d){d={installation_id:'device',status:'pending',attempts:0};deliveries.push(d);}
      if(d.status!=='pending'||d.attempts>=3)return [];
      d.status='sending';d.attempts++;return [{...d}];
    }
    if(path.includes('live_rating_deliveries'))Object.assign(deliveries[0],body);
    else complete=true;
    return [];
  };
  const send=async()=>{sends++;if(fail.length)throw fail.shift();};
  for(let i=0;i<4;i++)await dispatch({now,api,request,send});
  return {sends,complete,deliveries};
}
(async()=>{
  assert.equal((await dispatchCase()).sends,1,'idempotent across dispatch retries');
  assert.equal((await dispatchCase({fail:[{statusCode:503}]})).sends,2,'confirmed rejection retries');
  assert.equal((await dispatchCase({fail:[{statusCode:503},{statusCode:503},{statusCode:503},{statusCode:503}]})).sends,3,'retry cap');
  assert.equal((await dispatchCase({fail:[new Error('unknown outcome')]})).sends,1,'ambiguous delivery never blindly retries');
  assert.equal((await dispatchCase({concurrent:true})).complete,false,'concurrent sending worker keeps queue open');
  for(const options of [{prefs:{}},{prefs:{followedSports:['tennis'],followFirst:{notifications:{liveRatingsEnabled:false}}}},{friends:[]},{visibility:'hidden'},{moderation:true},{votes:[vote('jim',4)]},{votes:[]},{installations:false},{phase:'missing'}])assert.equal((await dispatchCase(options)).sends,0,JSON.stringify(options));
  if(process.env.PGLITE_MODULE){
    const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite();
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
      grant usage on schema public to anon,authenticated,service_role;
      create table public.nothingsports_push_installations(installation_id uuid primary key);
      create table public.nothingsports_nsc_profiles(user_id uuid,visibility text);
      create table public.nothingsports_nsc_personas(user_id uuid,moderation_flag boolean);
      create table public.nothingsports_nsc_contributions(user_id uuid,event_id text,phase text,rating integer,updated_at timestamptz default now());`);
    await db.exec(fs.readFileSync('supabase/migrations/20260908120216_followed_user_epic_alerts.sql','utf8'));
    const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
    await db.query('insert into auth.users values($1),($2),($3)',[a,b,c]);
    await db.query("insert into nothingsports_nsc_profiles values($1,'visible'),($2,'hidden')",[b,c]);
    await db.query('insert into nothingsports_user_follows(follower_user_id,followed_user_id) values($1,$2),($1,$3)',[a,b,c]);
    await assert.rejects(db.query('insert into nothingsports_user_follows(follower_user_id,followed_user_id) values($1,$1)',[a]),/check constraint/);
    for(const [id,phase,rating] of [[b,'heat',5],[b,'pulse',4],[c,'pulse',5],[b,'pulse',5],[b,'pulse',5]])await db.query('insert into nothingsports_nsc_contributions(user_id,event_id,phase,rating) values($1,$2,$3,$4)',[id,'match:1',phase,rating]);
    const alerts=(await db.query('select *,ready_at-created_at as delay from nothingsports_live_rating_alerts')).rows;
    assert.equal(alerts.length,1,'outbox deduplicates real EPIC ratings; skips private and heat');
    assert.equal(new Date(alerts[0].ready_at)-new Date(alerts[0].created_at),60000,'60 second grouping');
    await db.query('insert into nothingsports_push_installations values($1)',[c]);
    await db.exec('set role authenticated');await assert.rejects(db.query('select * from nothingsports_user_follows'),/permission denied/);
    await assert.rejects(db.query('select * from nothingsports_claim_live_rating_delivery($1,$2)',[alerts[0].id,c]),/permission denied/);
    await db.exec('reset role;set role service_role');
    assert.equal((await db.query('select * from nothingsports_claim_live_rating_delivery($1,$2)',[alerts[0].id,c])).rows.length,1);
    assert.equal((await db.query('select * from nothingsports_claim_live_rating_delivery($1,$2)',[alerts[0].id,c])).rows.length,0,'atomic claim');
    await db.close();
  }
  console.log('EPIC alerts: privacy, opt-outs, current votes, grouping, idempotency, retries and deep links passed'+(process.env.PGLITE_MODULE?'; database RLS, trigger and atomic claims passed.':'. Database checks not run.'));
})().catch(error=>{console.error(error);process.exitCode=1;});
