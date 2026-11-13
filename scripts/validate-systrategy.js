'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const clean=require('../config/retired-feedback').clean,sync=require('../config/user-state-sync'),profiles=require('../config/profile-storage');
const before={followedSports:['cricket'],preferenceGraph:{entityFollows:[{participantId:'team:a',followLevel:'unfollow'}],learning:{signals:[{value:-1}],dislikeCount:8,futureField:{keep:true}}},followFirst:{feedback:{schemaVersion:'feedback.v1',entries:[{eventId:'a'}],sequence:1},refinement:{firstSwipeAt:'today'},excludedMajorEventIds:['cup']},future:{keep:true}};
const raw=JSON.stringify(before),after=clean(before);
assert.equal(JSON.stringify(before),raw,'cleanup must not mutate receipt/source');
assert.deepEqual(after.preferenceGraph.learning,{futureField:{keep:true}});
assert.deepEqual(after.followFirst,{excludedMajorEventIds:['cup']});
assert.deepEqual(clean(after),after,'cleanup is idempotent');
assert(profiles.preferenceBaseMatches({basePreferences:before},after),'retired fields alone cannot hold owned pending intent');
assert(!profiles.preferenceBaseMatches({basePreferences:before},{...after,followedSports:[]}),'actual follow differences stay protected');
assert(!profiles.preferenceBaseMatches({basePreferences:before},{...after,future:{keep:false}}),'unknown fields stay protected');
const receipt={basePreferences:before,preferences:{...before,followedSports:['cricket','tennis']}};
const receiptRaw=JSON.stringify(receipt),patch=sync.createPatch({preferences:before},{preferences:receipt.preferences});
const applied=sync.applyPatch({preferences:before,eventUserState:{a:{dismissed:true,saved:true}}},patch);
assert(profiles.preferenceIntentMatches(receipt,applied.preferences,sync));
assert.equal(JSON.stringify(receipt),receiptRaw,'ACK comparison retains immutable original receipt');
assert.deepEqual(applied.eventUserState,{a:{dismissed:true,saved:true}});
const stale=sync.applyPatch(applied,{schemaVersion:'user-state-patch.v1',changes:[{path:['preferences','preferenceGraph','learning','signals'],value:[{value:1}]}]});
assert(!('signals' in stale.preferences.preferenceGraph.learning),'an old client cannot reintroduce thumb signals');
const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('assets/js/nsc-rankings-ui.js','utf8');
assert(html.includes('YURTERS')&&!html.includes('LEADER<br>BOARD'));
for(const removed of ['function createChatState(','function applyCuratedEventSwipe(','function renderFineTuningSettings(','function renderMyForesight('])assert(!html.includes(removed),removed);
assert(!ui.includes('bonusAwarded')&&!ui.includes('efficiency')&&!ui.includes("sort='points'"));
assert(html.includes('scheduleNothingscoreHeartbeat'),'Watching Now remains');
assert(!JSON.parse(fs.readFileSync('config/app-shell-modules.json')).some(x=>/chat-contract|swipe-calibration|fine-tuning/.test(x)));
let status,body;require('../api/chat')({}, {setHeader(){},status(s){status=s;return this;},json(b){body=b;}});assert.equal(status,410);assert.equal(body.code,'feature_retired');
async function database(){
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create schema nothingsports_recovery;
 create function nothingsports_recovery.fixture_alias_v1(id text) returns text language sql as $$select id$$;
 create function nothingsports_recovery.epl_operating_ids_v1(id text) returns text[] language sql as $$select array[id]$$;
 create function nothingsports_recovery.epl_reward_clock_v1(id text,status text,ends timestamptz) returns jsonb language sql as $$select null::jsonb$$;
 create table nothingsports_nsc_profiles(user_id uuid primary key references auth.users,profile_id uuid unique,display_name text,handle text,visibility text default 'visible',avatar_url text,updated_at timestamptz default now());
 create table nothingsports_nsc_personas(user_id uuid,moderation_flag boolean default false);
 create table nothingsports_nsc_contributions(contribution_id uuid default gen_random_uuid(),event_id text,user_id uuid references auth.users,phase text,bucket_start timestamptz,rating integer,tags text[],submitted_at timestamptz,updated_at timestamptz,scoring_version text,maximum_points integer,unique(event_id,user_id,phase,bucket_start));
 create table nothingsports_user_state(user_id uuid primary key,preferences jsonb default '{}',event_user_state jsonb default '{}',updated_at timestamptz default now());
 create table nothingsports_user_follows(follower_user_id uuid,followed_user_id uuid,created_at timestamptz,primary key(follower_user_id,followed_user_id));
 create table nothingsports_social_notifications(id uuid default gen_random_uuid(),recipient_user_id uuid,actor_user_id uuid,kind text,points integer default 0,dedupe_key text unique);
 create table nothingsports_friend_activity(id uuid default gen_random_uuid(),recipient_user_id uuid,rater_user_id uuid,event_id text,phase text,alert_id uuid,unique(recipient_user_id,rater_user_id,event_id,phase));
 create table nothingsports_live_rating_alerts(id uuid default gen_random_uuid(),recipient_user_id uuid,event_id text,completed_at timestamptz,ready_at timestamptz,created_at timestamptz default now());
 create schema private;create function private.impact_inbox_eligible(u uuid,e text) returns boolean language sql as $$select true$$;create table nothingsports_inbox(id uuid default gen_random_uuid(),recipient_user_id uuid,kind text,activity_at timestamptz,actor_user_id uuid,event_id text,phase text,version integer,read_at timestamptz,title text,detail text);create table nothingsports_nsc_points(user_id uuid,points integer);create table nothingsports_nsc_likes(user_id uuid);
 grant usage on schema public,nothingsports_recovery to service_role;grant all on all tables in schema public to service_role;`);
 const migration=fs.readFileSync('supabase/migrations/20261113082047_systrategy_retire_social_extras.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 await db.exec('create trigger friend_activity after insert or update on nothingsports_nsc_contributions for each row execute function nothingsports_enqueue_live_rating_alert()');
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 for(const [id,name]of [[a,'Zed'],[b,'alice'],[c,'Bob']]){await db.query('insert into auth.users values($1)',[id]);await db.query('insert into nothingsports_nsc_profiles(user_id,profile_id,display_name,handle) values($1,$1,$2,$3)',[id,name,name.toLowerCase()]);}
 await db.exec('set role service_role');
 const call=async(sql,args)=>(await db.query(sql,args)).rows[0].r;
 const follow=following=>call('select nothingsports_follow_person($1,$2,$3) r',[a,b,following]);
 await follow(true);await follow(false);await follow(true);
 const future=new Date(Date.now()+3600000).toISOString(),past=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()+7200000).toISOString();
 for(const [phase,status,start]of [['heat','scheduled',future],['pulse','live',past],['impact','completed',past]]){
  const receipt=await call('select nothingsports_rate_v2($1,$2,$3,5,$4,$5,$6,\'cricket\',\'men\') r',[b,'fixture:'+phase,phase,start,end,status]);assert.equal(receipt.pointsAwarded,0);assert(receipt.submitted);
 }
 assert.equal((await db.query('select count(*)::int n from nothingsports_friend_activity')).rows[0].n,3,'all three retained rating phases produce friend recommendations');
 assert.equal((await db.query('select count(*)::int n from nothingsports_nsc_contributions')).rows[0].n,3);
 const copy=()=>call("select nothingsports_copy_picks($1,$2,'{}','{}','{}','{}',array['cricket']) r",[a,b]);
 await copy();await copy();
 assert.deepEqual((await db.query('select kind,points from nothingsports_social_notifications order by kind')).rows,[{kind:'follows_copied',points:0},{kind:'profile_followed',points:0}]);
 await assert.rejects(call("select nothingsports_copy_picks($1,$2,'{\"wrong\":true}','{}','{}','{}',array['cricket']) r",[a,b]),/preferences_changed_retry/);
 const all=await call("select nothingsports_yurters(null,'all','',0) r",[]);assert.deepEqual(all.entries.map(x=>x.name),['alice','Bob','Zed']);assert(all.entries.every(x=>x.canFollow),'guests can initiate the sign-in flow from Follow');assert(!JSON.stringify(all).includes('points'));
 const followed=await call("select nothingsports_yurters($1,'following','',0) r",[a]);assert.deepEqual(followed.entries.map(x=>x.profileId),[b]);
 const oldPrefs={...before};await db.query('insert into nothingsports_user_state(user_id,preferences) values($1,$2) on conflict(user_id) do update set preferences=excluded.preferences',[a,oldPrefs]);assert.deepEqual((await db.query('select preferences from nothingsports_user_state where user_id=$1',[a])).rows[0].preferences,after,'DB trigger matches JS cleanup without removing unknown fields');
 await db.exec('reset role');await db.query("update nothingsports_nsc_profiles set visibility='hidden' where user_id=$1",[b]);await db.exec('set role service_role');assert.equal((await call("select nothingsports_yurters($1,'following','',0) r",[a])).entries.length,0);
 assert.equal((await call("select nothingsports_save_public_profile($1,'New name','new_handle') r",[b])).visibility,'hidden','editing a hidden profile cannot make its follows public');
 assert.equal((await db.query('select nothingsports_settle_consensus_batch() n')).rows[0].n,0,'old live refresh can continue without settling rewards');
 assert.equal((await db.query('select count(*)::int n from nothingsports_nsc_points')).rows[0].n,0);
 await assert.rejects(db.query('insert into nothingsports_nsc_points values($1,1)',[a]),/permission denied/);
 await assert.rejects(db.query('insert into nothingsports_nsc_likes values($1)',[a]),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select nothingsports_yurters()'),/permission denied/);
 }finally{await db.close();}
}
async function retirement(){
 const retirement=require('../lib/systrategy-retirement'),now=Date.now(),sha='a'.repeat(40),receipt={schemaVersion:'systrategy-acceptance.v1',databaseProjectId:retirement.PROJECT,sha,productionSha:sha,deploymentState:'READY',deploymentId:'test-deployment',aliasVerified:true,verifiedAt:new Date(now).toISOString(),issuersStoppedAt:new Date(now-7300000).toISOString(),checks:Object.fromEntries(retirement.CHECKS.map(name=>[name,'PASS']))};
 let requests=0,sqlCalls=0;const files=new Map(retirement.BUCKETS.map(name=>[name,[{id:'object',name:'one'}]]));
 const adapters={receipt,sha,now:()=>now,verifyProduction:async()=>({sha,deploymentId:'test-deployment',ready:true,aliasVerified:true}),request:async(url,options)=>{requests++;if(url==='/storage/v1/bucket')return retirement.BUCKETS.map(id=>({id}));const bucket=url.split('/').at(-1);if(options.method==='DELETE'){assert.deepEqual(options.body.prefixes,['one']);files.set(bucket,[]);return [];}return files.get(bucket);},executeSQL:async sql=>{sqlCalls++;assert([...files.values()].every(rows=>!rows.length),'Storage is removed before metadata');assert(!sql.includes('delete from public.nothingsports_nsc_contributions'));assert(!sql.includes('delete from auth.users'));}};
 await assert.rejects(retirement.purge({...adapters,receipt:{...receipt,checks:{...receipt.checks,performance:'FAIL'}}}),/Every retained-flow/);assert.equal(requests,0);assert.equal(sqlCalls,0);
 await assert.rejects(retirement.purge({...adapters,receipt:{...receipt,issuersStoppedAt:new Date(now).toISOString()}}),/upload capabilities/);assert.equal(requests,0);
 assert.equal((await retirement.purge(adapters)).removedObjects,2);assert.equal(sqlCalls,1);
 assert.equal((await retirement.purge(adapters)).removedObjects,0);assert.equal(sqlCalls,2,'repeating a completed purge is idempotent');
}
database().then(retirement).then(()=>console.log('sySTRATEGY: retirement gates/purge ordering, ratings, friend activity, copy CAS, directory privacy/order and pending-intent cleanup passed.')).catch(e=>{console.error(e);process.exitCode=1;});
