'use strict';
const assert=require('node:assert/strict'),engine=require('../lib/milestone-alerts'),rules=require('../lib/milestone-rules'),data=require('./lib/milestone-fixtures');
const now=new Date(),e=data.fixture(now),moments=rules.detect(e,{now}),account=data.account(e);
async function scenario({mode='live',gate=true,matchCentre=true,latest=e,current=account.preferences,revision=account.updated_at,reject=0,uncertain=false,erased=false,budget=Infinity}={}){
 const calls=[],pushes=[],updates=[],claims=new Map();let groupClaimed=false;
 const request=async(path,options={})=>{calls.push({path,options});const route=path.split('?')[0].split('/').at(-1);
  if(route==='nothingsports_moments')return moments.map(payload=>({payload}));
  if(route==='nothingsports_read_match_scores')return [{fixture:latest}];
  if(route==='nothingsports_milestone_observations')return [{fixture:latest,score_hash:'source-current'}];
  if(route==='nothingsports_milestone_accounts'){assert.deepEqual(options.body,{p_moment_ids:moments.filter(m=>rules.revalidate(m,latest,{now:+now})).map(m=>m.momentId)},'Account selection uses only currently valid selected moments');return [account];}
  if(route==='nothingsports_milestone_rollout')return [{enabled:gate,shadow_verified_at:gate&&now.toISOString(),device_verified_at:gate&&now.toISOString(),shadow_evidence:gate&&'controlled-only',device_evidence:gate&&'controlled-only'}];
  if(route==='nothingsports_record_milestone_shadow'||route==='nothingsports_discard_milestone_moments'||route==='nothingsports_milestone_maintenance')return null;
  if(route==='nothingsports_claim_milestone_group'){if(groupClaimed)return null;groupClaimed=true;return 'group';}
  if(route==='nothingsports_milestone_receipts')return moments.map(m=>({moment_id:m.momentId}));
  if(route==='nothingsports_push_installations')return options.method==='DELETE'?null:[{installation_id:'phone'},{installation_id:'desktop'}];
  if(route==='nothingsports_user_state')return [{preferences:current,event_user_state:account.actions,event_spoiler_state:account.spoilers,updated_at:revision}];
  if(route==='nothingsports_claim_milestone_installation'){const id=options.body.target_installation,n=(claims.get(id)||0)+1;claims.set(id,n);return n;}
  if(route==='nothingsports_begin_notification_send')return erased?null:{leaseId:'lease',subscription:{endpoint:'https://push.example/'+options.body.target_installation}};
  if(['nothingsports_notification_send_leases','nothingsports_milestone_installations','nothingsports_milestone_groups'].includes(route)){updates.push({route,body:options.body});return null;}
  throw Error('Unexpected request: '+path);
 };
 const send=async(_sub,body,options)=>{pushes.push({payload:JSON.parse(body),options});if(uncertain)throw Error('Unknown transport outcome');if(pushes.length<=reject)throw Object.assign(Error('Provider rejected'),{statusCode:503});};
 const result=await engine.dispatch({now,request,send,environment:{MILESTONE_ALERTS_MODE:mode,MATCH_CENTRE_ENABLED:String(matchCentre)},budget:{remaining:()=>budget}});
 return {result,calls,pushes,updates,claims};
}
(async()=>{
 const off=await scenario({mode:'off'});assert.equal(off.calls.length,0);
 const shadow=await scenario({mode:'shadow'});assert.equal(shadow.pushes.length,0);assert(shadow.result.eligible);assert(shadow.calls.some(c=>c.path.endsWith('record_milestone_shadow')));assert(!shadow.calls.some(c=>c.path.includes('claim_milestone_group')));
 const gate=await scenario({gate:false});assert.equal(gate.result.mode,'shadow');assert.equal(gate.pushes.length,0);
 const disabledCentre=await scenario({matchCentre:false});assert.equal(disabledCentre.pushes.length,0,'Disabling Match Centre cannot leave live milestone pushes pointing at an unavailable landing');assert.equal(disabledCentre.result.mode,'shadow');
 const live=await scenario();assert.equal(live.result.sent,2);assert.equal(live.calls.filter(c=>c.path.includes('claim_milestone_group')).length,1,'One grouped account reservation spans all devices');assert(live.pushes.every(p=>p.options.TTL===120&&!/84|century/.test(p.payload.body)));assert.match(live.pushes[0].payload.url,/surface=match-centre/);
 const passed=await scenario({latest:data.fixture(now,{runs:103})});assert.equal(passed.pushes.length,0,'A passed threshold is rechecked before sending');assert(!passed.calls.some(c=>c.path.endsWith('nothingsports_milestone_accounts')),'Invalid selected moments cannot keep handled accounts ahead of valid later work');
 const dismissed=structuredClone(e);dismissed.innings.at(-1).batting.forEach(p=>{p.isBatting=false;});assert.equal((await scenario({latest:dismissed})).pushes.length,0);
 const consent=structuredClone(account.preferences);consent.followFirst.notifications.milestones.enabled=false;assert.equal((await scenario({current:consent})).pushes.length,0,'Late category OFF prevents provider contact');
 assert.equal((await scenario({revision:'changed'})).pushes.length,0,'Concurrent preference revision fences all device sends');assert.equal((await scenario({erased:true})).pushes.length,0,'Existing account-erasure send admission remains authoritative');
 const retry=await scenario({reject:1});assert.equal(retry.pushes.length,3);assert.equal(retry.result.sent,2);assert(retry.updates.some(u=>u.body.status==='pending'));
 const ambiguous=await scenario({uncertain:true});assert.equal(ambiguous.pushes.length,2,'An ambiguous outcome gets no blind retry');assert(ambiguous.updates.some(u=>u.route==='nothingsports_milestone_groups'&&u.body.status==='uncertain'));
 assert.equal((await scenario({budget:1000})).pushes.length,0,'The existing owner deadline is preserved');
 const accepted=data.fixture(now,{runs:89});let packets;
 const observed=await engine.observePublished({sourceId:'cricket-ca-current',fixtures:[e],now,environment:{MILESTONE_ALERTS_MODE:'shadow'},request:async(path,options)=>{if(path.endsWith('milestone_observations')&&!path.includes('commit'))return [{fixture_id:e.id,fixture:accepted,previous:null,previous_hash:null,score_hash:'accepted'}];packets=options.body.packets;return packets[0].moments.length;}});
 assert(observed.checked===1&&packets[0].moments[0].value===89,'Only the accepted server observation supplies alert facts');
 console.log('Milestone dispatch: gated shadow/live, accepted observations, grouped devices, consent races, corrections, rejection retry, uncertain outcomes and deadline passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
