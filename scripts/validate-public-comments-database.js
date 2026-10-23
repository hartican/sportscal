'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
async function main(){
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema private;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
 create table public.nothingsports_nsc_profiles(user_id uuid primary key references auth.users on delete cascade,handle text,visibility text);
 create table public.nothingsports_nsc_personas(user_id uuid primary key references auth.users on delete cascade,moderation_flag boolean);
 create table public.nothingsports_nsc_points(user_id uuid references auth.users on delete cascade,points integer);
 create table public.nothingsports_user_follows(follower_user_id uuid references auth.users on delete cascade,followed_user_id uuid references auth.users on delete cascade,primary key(follower_user_id,followed_user_id));
 create table public.nothingsports_push_installations(installation_id uuid primary key,user_id uuid references auth.users on delete cascade,permission text default 'granted');
 create table public.nothingsports_classic_fixtures(event_id text primary key,fixture jsonb default '{}');
 create table public.nothingsports_personal_classics(user_id uuid references auth.users on delete cascade,event_id text references public.nothingsports_classic_fixtures,primary key(user_id,event_id));
 grant usage on schema public,private to service_role;grant all on all tables in schema public to service_role;`);
 // Load actual existing chat/reminder tables and canonical erasure owners.
 const canonical=fs.readFileSync('supabase/private-fixture-chat.sql','utf8');
 for(const name of ['chat_rooms','chat_members','chat_messages','chat_attachments','saved_game_media']){const sql=canonical.match(new RegExp(`create table if not exists public.nothingsports_${name} \\([\\s\\S]*?\\n\\);`))?.[0];assert(sql,'Actual '+name+' schema required');await db.exec(sql);}
 const reminders=fs.readFileSync('supabase/follow-first-user-meta-and-notifications.sql','utf8').match(/create table if not exists public\.nothingsports_reminders \([\s\S]*?\n\);/)?.[0];assert(reminders);await db.exec(reminders);
 await db.exec(`create schema storage;create table storage.objects(owner_id text,name text,bucket_id text);
 create table nothingsports_nsc_reward_campaigns(eligible_user_ids uuid[]);create table nothingsports_marquee_subscribers(email_normalized text);create table nothingsports_avatar_cleanup(object_path text);
 create table nothingsports_notification_send_leases(account_ids uuid[],finished_at timestamptz);grant all on all tables in schema public to service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20260927144441_guard_account_erasure_writes.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260927150138_mark_erasure_in_auth_metadata.sql','utf8'));
 const guard=fs.readFileSync('supabase/migrations/20260927164938_redact_erased_account_audit_snapshots.sql','utf8').match(/create or replace function private\.nothingsports_guard_erasure_write\(\)[\s\S]*?end \$\$;/)?.[0];assert(guard);await db.exec(guard);
 await db.exec(fs.readFileSync('supabase/migrations/20260927152733_account_erasure_inventory.sql','utf8'));
 const featureSql=process.argv.includes('--reviewed-baseline')?require('node:child_process').execFileSync('git',['show','95885e63bd93d22980ac7526633c638239c910df:supabase/migrations/20261023222545_public_fixture_comments.sql'],{encoding:'utf8'}):fs.readFileSync('supabase/migrations/20261023222545_public_fixture_comments.sql','utf8');await db.exec(featureSql);
 const [a,b,c,r]=Array.from({length:4},()=>crypto.randomUUID());
 for(const [id,handle] of [[a,'alice'],[b,'bob'],[c,'carol'],[r,'reader']]){await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@example.invalid']);await db.query("insert into nothingsports_nsc_profiles values($1,$2,'visible')",[id,handle]);}
 await db.query('insert into nothingsports_user_follows values($1,$2),($1,$3)',[r,a,c]);await db.query('insert into nothingsports_nsc_points values($1,25),($2,24)',[a,b]);
 await db.exec('set role service_role');
 // The real catalog inventory must still qualify the real operator workflow,
 // even for a nonexistent sentinel or an account with zero public comments.
 const inventory=async id=>(await db.query('select public.nothingsports_account_erasure_inventory($1) result',[id])).rows[0].result;
 const workflow=require('../lib/account-erasure-workflow'),{verifyDirectGuards,SENTINEL}=require('./lib/account-erasure-guard-verification');
 const emptyInventory=await inventory(SENTINEL);verifyDirectGuards(emptyInventory);assert(emptyInventory.references.some(ref=>ref.table_name==='nothingsports_public_comments'&&ref.column_name==='author_user_id'&&ref.guarded===true));
 const pristine=crypto.randomUUID();await db.exec('reset role');await db.query('insert into auth.users(id,email) values($1,$2)',[pristine,'pristine@example.invalid']);await db.exec('set role service_role');
 const journal=workflow.newJournal(pristine,{verifiedAccountId:pristine,requestId:'synthetic-public-feed-inventory',verifiedAt:new Date().toISOString()});
 const erasure=require('../lib/account-erasure-operator').operator({environment:{SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co'},request:async(path,options)=>{const id=options.body.target_user_id;if(path.endsWith('/nothingsports_account_erasure_inventory'))return inventory(id);if(path.endsWith('/nothingsports_begin_account_erasure'))return(await db.query('select public.nothingsports_begin_account_erasure($1) started',[id])).rows[0].started;throw Error('Unexpected operator boundary in isolated database test');}});
 await workflow.advance({journal,inventory:erasure.inventory,persist:async()=>{},operations:{freeze:erasure.operations.freeze}});
 assert.equal(journal.steps[0]?.phase,'freeze','actual inventory permits the existing workflow to freeze a zero-comment account');assert.deepEqual(journal.pending,['captureLineage_not_connected'],'later erasure phases remain explicitly unallocated');
 const rpc=async(user,event,command)=>(await db.query('select nothingsports_public_comments($1,$2,$3) result',[user,event,JSON.stringify(command)])).rows[0].result;
 const post=(user,event,body,extra={})=>rpc(user,event,{action:'post',clientId:crypto.randomUUID(),body,fixture:{id:event,name:'Fixture',status:'upcoming'},...extra});
 const count=async(table,where='',args=[])=>(await db.query('select count(*)::integer n from nothingsports_'+table+' '+where,args)).rows[0].n;
 const first=await post(a,'fixture:one','First'),reply=await post(a,'fixture:one','Reply',{parentId:first.comment.id});await post(a,'fixture:one','Again');
 assert.equal(await count('public_comment_runs'),1,'A,A,A is one run');
 await post(b,'fixture:one','Unfollowed');await post(a,'fixture:one','Still Alice');assert.equal(await count('public_comment_runs'),1,'unfollowed Bob cannot reset Alice');
 await post(c,'fixture:one','Carol');await post(a,'fixture:one','Alice again');assert.equal(await count('public_comment_runs'),3,'A,followed C,A is three runs');
 await post(a,'fixture:two','Other fixture');assert.equal(await count('public_comment_runs'),4,'separate fixture starts separately');
 await assert.rejects(post(c,'fixture:two','Bad parent',{parentId:first.comment.id}),/invalid_parent/);
 await assert.rejects(post(c,'fixture:one','Nested reply',{parentId:reply.comment.id}),/invalid_parent/);
 const clientId=crypto.randomUUID(),same={action:'post',clientId,body:'Once',fixture:{id:'fixture:two'}};await rpc(a,'fixture:two',same);const before=await count('public_comments');assert((await rpc(a,'fixture:two',same)).replayed);assert.equal(await count('public_comments'),before);await assert.rejects(rpc(a,'fixture:two',{...same,body:'Different'}),/id_conflict/);
 for(const value of [1,-1,0]){const result=await rpc(r,'fixture:one',{action:'vote',id:reply.comment.id,value});assert.equal(result.comment.score,value);assert.equal(result.comment.myVote,value);}
 await assert.rejects(rpc(r,'fixture:one',{action:'vote',id:reply.comment.id,value:2}),/invalid_vote/);
 await assert.rejects(rpc(r,'fixture:one',{action:'delete',id:first.comment.id}),/not_owned/);
 await rpc(a,'fixture:one',{action:'delete',id:first.comment.id});const page=await rpc(r,'fixture:one',{action:'page'});assert(page.comments.some(x=>x.id===first.comment.id&&x.deleted&&!x.body&&!x.handle));assert(page.comments.some(x=>x.id===reply.comment.id),'deleting parent preserves replies');
 const gif={provider:'giphy',contentType:'image/gif',contentUrl:'https://media.giphy.com/media/example/giphy.gif'};
 await assert.rejects(post(b,'fixture:one','GIF',{gif}),/gif_locked/);await post(a,'fixture:one','',{gif});
 await db.query("update nothingsports_nsc_profiles set visibility='hidden' where user_id=$1",[c]);await assert.rejects(post(c,'fixture:one','Hidden'),/handle_required/);assert(!(await rpc(r,'fixture:one',{action:'page'})).comments.some(x=>x.handle==='@carol'||x.body==='Carol'));
 await db.query("update nothingsports_nsc_profiles set visibility='visible' where user_id=$1",[c]);
 const changes=await rpc(r,'fixture:one',{action:'changes',after:0});assert(changes.comments.some(x=>x.id===reply.comment.id));
 await db.query('insert into nothingsports_classic_fixtures(event_id) values($1)',['fixture:one']);await db.query('insert into nothingsports_personal_classics values($1,$2)',[r,'fixture:one']);
 await rpc(r,'fixture:one',{action:'vote',id:reply.comment.id,value:1});
 const end=(await db.query("select ((clock_timestamp() at time zone 'Australia/Sydney')::date-8)::text d")).rows[0].d;
 const retire=fixture=>db.query('select nothingsports_retire_public_comments($1,$2) result',['fixture:one',JSON.stringify({retirementEligible:true,...fixture})]);
 assert.equal((await retire({finalDate:end,status:'ongoing',retirementEligible:false})).rows[0].result.retired,false,'shared ongoing protection');assert.equal((await retire({status:'completed'})).rows[0].result.retired,false,'unknown finish protection');
 const boundary=(await db.query("select ((clock_timestamp() at time zone 'Australia/Sydney')::date-7)::text d")).rows[0].d;assert.equal((await retire({finalDate:boundary,status:'completed'})).rows[0].result.retired,false,'seventh Sydney calendar day remains available');
 await db.exec("reset role;create function private.reject_comment_capture() returns trigger language plpgsql as $$begin raise exception 'synthetic capture failure';end$$;create trigger reject_comment_capture before insert on nothingsports_classic_comments for each row execute function private.reject_comment_capture();set role service_role");
 await assert.rejects(retire({finalDate:end,status:'completed'}),/synthetic capture failure/);assert((await count('public_comments','where event_id=$1',['fixture:one']))>0,'capture failure rolls back thread/media deletion');await db.exec('reset role;drop trigger reject_comment_capture on nothingsports_classic_comments;drop function private.reject_comment_capture();set role service_role');
 assert.equal((await retire({finalDate:end,status:'completed'})).rows[0].result.retired,true);
 assert.equal(await count('public_comments','where event_id=$1',['fixture:one']),0);const saved=(await db.query('select * from nothingsports_classic_comments order by position')).rows;assert.equal(saved.length,3);assert.equal(saved[0].comment_id,reply.comment.id,'reply competes in same ranking');assert(saved.every(x=>x.body&&x.handle&&!Object.hasOwn(x,'gif')));await assert.rejects(post(a,'fixture:one','Retired'),/retired/);
 const original=JSON.stringify(saved);await retire({finalDate:end,status:'completed'});assert.equal(JSON.stringify((await db.query('select * from nothingsports_classic_comments order by position')).rows),original,'capture immutable and idempotent');
 // More than one delta batch must drain without skipping current rows or erasure tombstones.
 for(let index=0;index<105;index++)await db.query("insert into nothingsports_public_comments(event_id,author_user_id,client_id,body,revision) values('fixture:two',$1,$2,$3,0)",[b,crypto.randomUUID(),'Delta '+index]);
 let after=0,seen=new Set(),batches=0;do{const delta=await rpc(r,'fixture:two',{action:'changes',after});for(const entry of delta.comments)if(!entry.removed)seen.add(entry.id);assert(delta.revision>=after);after=delta.revision;batches++;if(!delta.hasMore)break;assert(batches<5);}while(true);assert(batches>=2);assert.equal(seen.size,await count('public_comments',"where event_id='fixture:two'"));
 const beforeErasure=after,owned=(await db.query('select id from nothingsports_public_comments where event_id=$1 and author_user_id=$2',['fixture:two',a])).rows.map(row=>row.id);
 await db.query('insert into nothingsports_account_erasure_blocks values($1)',[a]);await assert.rejects(post(a,'fixture:two','Blocked'),/account_unavailable/);
 await assert.rejects(db.query("update nothingsports_public_comments set body='forbidden late text' where author_user_id=$1",[a]),/account_erasure_in_progress/);await assert.rejects(db.query("update nothingsports_public_comments set score=9999 where author_user_id=$1",[a]),/account_erasure_in_progress/);
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[a]);assert.equal(await count('classic_comments','where author_user_id=$1',[a]),0,'account erasure removes preserved attribution/text');
 const erased=await rpc(r,'fixture:two',{action:'changes',after:beforeErasure});for(const id of owned)assert(erased.comments.some(row=>row.id===id&&row.removed),'cached live authors are removed by hard-erasure deltas');
 // Peer vote/parent cascades can finish while both authors are blocked for erasure.
 await db.exec('set role service_role');const parent=await post(b,'fixture:erase','Parent'),peer=await post(c,'fixture:erase','Peer',{parentId:parent.comment.id});await rpc(b,'fixture:erase',{action:'vote',id:peer.comment.id,value:1});await db.query('insert into nothingsports_account_erasure_blocks values($1),($2)',[b,c]);await db.exec('reset role');await db.query('delete from auth.users where id=$1',[b]);assert.equal((await db.query('select parent_id,score from nothingsports_public_comments where id=$1',[peer.comment.id])).rows[0].parent_id,null);await db.query('delete from auth.users where id=$1',[c]);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from nothingsports_public_comments'),/permission denied/);await assert.rejects(rpc(r,'fixture:two',{action:'page'}),/permission denied/);
 await db.exec('set role anon');await assert.rejects(db.query('select * from nothingsports_classic_comments'),/permission denied/);
 console.log('Public comments database: actual RPCs, erasure guard, grants, run sequences, replies, vote changes/removal, idempotency, GIF unlock, privacy, retirement and immutable yearbook passed.');
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
