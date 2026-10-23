'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),alerts=require('../lib/public-comment-alerts');
async function trial({enabled=true,followed=true,visible=true,feed=true,failure=null,suppress=false}={}){
 const recipient=crypto.randomUUID(),actor=crypto.randomUUID(),installation=crypto.randomUUID(),run={id:crypto.randomUUID(),event_id:'fixture:one',actor_user_id:actor,recipient_user_id:recipient,comment_count:3,claimed_at:null,completed_at:null},deliveries=new Map(),inbox=new Map(),sent=[];let contacted=0;
 const request=async(path,options={})=>{
  const u=new URL(path,'https://db.invalid'),name=u.pathname.split('/').at(-1),q=u.searchParams;
  if(name==='nothingsports_claim_public_comment_runs'){if(run.completed_at)return[];run.claimed_at=options.body.claim_at;return[{...run}];}
  if(name==='nothingsports_public_comment_installations')return ['sent','failed','uncertain'].includes(deliveries.get(installation)?.status)?[]:[{installation_id:installation}];
  if(name==='nothingsports_nsc_profiles')return visible?[{handle:'alice'}]:[];
  if(name==='nothingsports_nsc_personas')return[];
  if(name==='nothingsports_user_follows')return followed?[{followed_user_id:actor}]:[];
  if(name==='nothingsports_user_state')return[{preferences:{followFirst:{notifications:{enabled:true,commentAlertsEnabled:enabled}}},event_user_state:{},archived_events:[]}];
  if(name==='nothingsports_inbox'){inbox.set(options.body.source_key,options.body);return[];}
  if(name==='nothingsports_begin_notification_send')return suppress?null:{leaseId:crypto.randomUUID(),subscription:{endpoint:'https://push.invalid',keys:{}}};
  if(name==='nothingsports_notification_send_leases')return[];
  if(name==='nothingsports_public_comment_runs'){Object.assign(run,options.body);return[];}
  if(name==='nothingsports_public_comment_deliveries'){
   if(options.method==='POST'){if(!deliveries.has(installation))deliveries.set(installation,{status:'pending',attempts:0});return[];}
   const row=deliveries.get(installation);if(!row)return[];const match=q.get('status')?.slice(3);if(match&&row.status!==match)return[];
   if(q.get('started_at')?.startsWith('lt.')&&(!row.started_at||row.started_at>=q.get('started_at').slice(3)))return[];
   Object.assign(row,options.body);return options.headers?.Prefer==='return=representation'?[{...row}]:[];
  }
  throw Error('Unexpected mocked request '+name);
 };
 const send=async(_subscription,payload)=>{contacted++;if(failure)throw failure;sent.push(JSON.parse(payload));};
 const options={now:new Date('2026-10-24T01:00Z'),api:{eventFor:()=>({id:'fixture:one'})},request,send,eligible:()=>feed,environment:{}};
 const first=await alerts.dispatch(options),second=await alerts.dispatch(options);
 return{first,second,run,deliveries,inbox,sent,contacted};
}
async function main(){
 let t=await trial();assert.equal(t.contacted,1);assert.equal(t.inbox.size,1);assert.equal(t.first.sent,1);assert.equal(t.second.sent,0);assert.equal(t.sent[0].title,'@alice commented on a fixture');assert(t.sent[0].url.includes('discussion='));assert(!JSON.stringify(t.sent[0]).includes('private comment'));
 for(const condition of [{enabled:false},{followed:false},{visible:false},{feed:false}]){t=await trial(condition);assert.equal(t.contacted,0);assert.equal(t.inbox.size,0);assert(t.run.completed_at);}
 t=await trial({failure:Error('unknown transport outcome')});assert.equal(t.contacted,1);assert.equal([...t.deliveries.values()][0].status,'uncertain','unknown send is not blindly replayed');
 t=await trial({failure:Object.assign(Error('provider rejected'),{statusCode:503})});assert.equal(t.contacted,2);assert.equal([...t.deliveries.values()][0].status,'pending','confirmed rejection may retry');
 t=await trial({suppress:true});assert.equal(t.contacted,0);assert.equal(t.first.skipped,1);
 let calls=0;const paused=await alerts.dispatch({environment:{SUPABASE_MAINTENANCE_MODE:'true'},request:async()=>{calls++;}});assert.equal(calls,0);assert.equal(paused.deferred,'supabase_maintenance');
 const archive=require('../lib/public-comment-archive');calls=0;assert.deepEqual(await archive.comments('fixture',{results:false,rows:async()=>{calls++;return[];}}),[]);assert.equal(calls,0,'Results OFF never reads result-bearing comment snapshots');
 const rows=async table=>({classic_comments:[{comment_id:'a',author_user_id:'a',body:'Allowed',score:3},{comment_id:'b',author_user_id:'b',body:'Private',score:2},{comment_id:'c',author_user_id:'c',body:'Erasing',score:1}],nsc_profiles:[{user_id:'a',handle:'alice'},{user_id:'c',handle:'carol'}],nsc_personas:[],account_erasure_blocks:[{user_id:'c'}]})[table];
 const quotes=await archive.comments('fixture',{results:true,rows});assert.deepEqual(quotes,[{id:'a',handle:'@alice',body:'Allowed',score:3}]);assert(!JSON.stringify(quotes).includes('author_user_id'));
 const event={id:'fixture:proof',eventId:'fixture:proof',kind:'fixture',key:'cricket',name:'A v B',date:'2026-10-24',startTimeUtc:'2026-10-24T04:00Z',participantIds:['team:cricket:australia','team:cricket:india'],status:'upcoming'};
 const state={preferences:{},eventUserState:{'fixture:proof':{addedToFixtures:true,addedFixture:event}}};
 assert.equal(alerts.inFeed(event,state,new Date('2026-10-24T01:00Z')),true,'existing deliberate Feed admission qualifies');state.eventUserState['fixture:proof'].dismissed=true;assert.equal(alerts.inFeed(event,state,new Date('2026-10-24T01:00Z')),false,'dismissed fixture cannot notify');
 console.log('Public comment delivery/archive: consent/follow/Feed/privacy gates, per-run idempotency, guarded sends, rejection-vs-uncertain, maintenance pause, spoiler/erasure snapshot filtering and real Feed policy passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
