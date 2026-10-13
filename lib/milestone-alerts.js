'use strict';
const rules=require('./milestone-rules'),preferences=require('../config/milestone-preferences');
const {supabaseServiceRequest}=require('./supabase-server');
const {guardedSend,suppressed}=require('./notification-send');
const watchlist=require('../data/canonical/cricket-record-watchlist.v1.json');
const mode=environment=>['shadow','live'].includes(environment.MILESTONE_ALERTS_MODE)?environment.MILESTONE_ALERTS_MODE:'off';
const rpc=(request,name,body)=>request('/rest/v1/rpc/'+name,{method:'POST',body,timeoutMs:3000});
const query=(request,table,filter)=>request('/rest/v1/'+table+'?'+new URLSearchParams(filter),{timeoutMs:3000});
function checkpoint(e){
 const fields=['id','canonicalEventId','eventId','key','format','matchFormat','status','sourceStale','cricketPhaseConfirmed','competitionId','competitionName','gender','participantIds','homeParticipantId','awayParticipantId','name','startTimeUtc'];
 return {...Object.fromEntries(fields.filter(k=>e[k]!==undefined).map(k=>[k,e[k]])),innings:(e.innings||[]).map(i=>({inningNumber:i.inningNumber,detailCheckedAt:i.detailCheckedAt,detailStale:i.detailStale,batting:(i.batting||[]).map(p=>({playerId:p.playerId,runs:p.runs,didNotBat:p.didNotBat})),bowling:(i.bowling||[]).map(p=>({playerId:p.playerId,wickets:p.wickets}))}))};
}
async function observePublished({sourceId,fixtures,now=new Date(),request=supabaseServiceRequest,environment=process.env,records=watchlist}={}){
 if(mode(environment)==='off'||sourceId!=='cricket-ca-current')return {checked:0,moments:0};
 const ids=fixtures.filter(e=>rules.fresh(e,+now)&&e.innings?.some(i=>i.detailCheckedAt===now.toISOString())).map(rules.id).slice(0,2);
 if(!ids.length)return {checked:0,moments:0};
 const rows=await rpc(request,'nothingsports_milestone_observations',{p_source_id:sourceId,p_fixture_ids:ids});
 if(!Array.isArray(rows)||rows.length>2)throw Error('Invalid milestone source batch');
 const packets=rows.filter(row=>rules.fresh(row.fixture,+now)).map(row=>({fixture_id:row.fixture_id,previous_hash:row.previous_hash,score_hash:row.score_hash,state:checkpoint(row.fixture),moments:rules.detect(row.fixture,{previous:row.previous,now:+now,records})}));
 const count=packets.length?await rpc(request,'nothingsports_commit_milestone_observations',{p_source_id:sourceId,packets}):0;
 return {checked:packets.length,moments:Number(count)||0};
}
async function dispatch({now=new Date(),request=supabaseServiceRequest,send,environment=process.env,budget={remaining:()=>Infinity},records=watchlist}={}){
 const started=Date.now(),currentNow=()=>+now+Date.now()-started;
 const result={mode:mode(environment),checked:0,eligible:0,sent:0,failed:0,skipped:0};
 if(result.mode==='off')return result;
 const moments=await query(request,'nothingsports_moments',{expires_at:'gt.'+now.toISOString(),order:'updated_at.desc',limit:'20',select:'payload'});
 if(!moments.length){if(result.mode==='shadow'&&budget.remaining()>1500)await rpc(request,'nothingsports_record_milestone_shadow',{stats:result});return result;}
 const ids=[...new Set(moments.map(r=>r.payload.eventId))];
 const [rows,accounts,rollouts]=await Promise.all([
  rpc(request,'nothingsports_read_match_scores',{p_fixture_ids:ids}),
  rpc(request,'nothingsports_milestone_accounts',{p_moment_ids:moments.map(r=>r.payload.momentId)}),
  query(request,'nothingsports_milestone_rollout',{id:'eq.true',select:'enabled,shadow_verified_at,device_verified_at,shadow_evidence,device_evidence'}),
 ]);
 const rollout=rollouts?.[0];
 const live=result.mode==='live'&&environment.MATCH_CENTRE_ENABLED==='true'&&rollout?.enabled===true&&rollout.shadow_verified_at&&rollout.device_verified_at&&rollout.shadow_evidence&&rollout.device_evidence;
 if(result.mode==='live'&&!live)result.mode='shadow';
 const fixtures=new Map();for(const row of rows||[]){const id=rules.id(row.fixture),prior=fixtures.get(id);if(!prior||Date.parse(row.fixture.scoreCheckedAt)>Date.parse(prior.scoreCheckedAt))fixtures.set(id,row.fixture);}
 const groups=new Map();for(const row of moments){const e=fixtures.get(row.payload.eventId),m=e&&rules.revalidate(row.payload,e,{now:+now,records});result.checked++;if(!m){result.skipped++;continue;}const list=groups.get(m.eventId)||[];list.push(m);groups.set(m.eventId,list);}
 for(const account of accounts){
  if(budget.remaining()<1500)break;
  const eligible=[];
  for(const [id,list] of groups){const e=fixtures.get(id),choice=rules.recipient(e,{...account,eventSpoilerState:account.spoilers},+now);if(!choice){if(live)await rpc(request,'nothingsports_discard_milestone_moments',{target_user:account.user_id,moment_ids:list.map(m=>m.momentId),discard_at:now.toISOString()});continue;}const excluded=list.filter(m=>!preferences.allows(choice.settings,m.family));if(live&&excluded.length)await rpc(request,'nothingsports_discard_milestone_moments',{target_user:account.user_id,moment_ids:excluded.map(m=>m.momentId),discard_at:now.toISOString()});const selected=list.filter(m=>preferences.allows(choice.settings,m.family)).sort((a,b)=>a.priority-b.priority||a.momentId.localeCompare(b.momentId)).slice(0,5);if(selected.length)eligible.push({e,choice,moments:selected});}
  eligible.sort((a,b)=>a.moments[0].priority-b.moments[0].priority||a.e.id.localeCompare(b.e.id));
  result.eligible+=eligible.length;
  if(!live)continue;
  for(const item of eligible){
   if(budget.remaining()<5000)break;
   const currentRows=await rpc(request,'nothingsports_milestone_observations',{p_source_id:'cricket-ca-current',p_fixture_ids:[rules.id(item.e)]});
   const currentObservation=currentRows.find(r=>rules.id(r.fixture)===rules.id(item.e)),e=currentObservation?.fixture;
   if(!e){result.skipped++;continue;}
   item.moments=item.moments.map(m=>rules.revalidate(m,e,{now:currentNow(),records})).filter(Boolean);
   if(!item.moments.length){result.skipped++;continue;}
   const choice=item.choice;
   const group=await rpc(request,'nothingsports_claim_milestone_group',{target_user:account.user_id,expected_updated:account.updated_at,target_fixture:rules.id(e),moment_ids:item.moments.map(m=>m.momentId),expected_score_hash:currentObservation.score_hash,coverage:choice.settings.sports.cricket.coverage,claim_at:now.toISOString()});
   if(!group){result.skipped++;continue;}
   const receipts=await query(request,'nothingsports_milestone_receipts',{group_id:'eq.'+group,select:'moment_id'}),claimed=new Set(receipts.map(r=>r.moment_id));
   const selected=item.moments.filter(m=>claimed.has(m.momentId));
   const installations=await query(request,'nothingsports_push_installations',{user_id:'eq.'+account.user_id,permission:'eq.granted',select:'installation_id'});
   let accepted=false,uncertain=false,pending=false;
   for(const installation of installations){
    for(let attempt=0;attempt<3&&budget.remaining()>1500;attempt++){
     const current=await query(request,'nothingsports_user_state',{user_id:'eq.'+account.user_id,select:'preferences,event_user_state,event_spoiler_state,updated_at',limit:'1'});
     const state=current[0],valid=state&&rules.recipient(e,{preferences:state.preferences,actions:state.event_user_state,eventSpoilerState:state.event_spoiler_state},currentNow());
     if(!selected.every(m=>rules.revalidate(m,e,{now:currentNow(),records}))){result.skipped++;break;}
     if(!valid||state.updated_at!==account.updated_at){result.skipped++;break;}
     const count=await rpc(request,'nothingsports_claim_milestone_installation',{target_group:group,target_installation:installation.installation_id,expected_updated:state.updated_at,claim_at:now.toISOString()});
     if(!count)break;
     let status='sent';
     try{await guardedSend({installationId:installation.installation_id,expectedUserId:account.user_id,payload:JSON.stringify(rules.payload(e,selected,{showFacts:valid.showFacts,now:currentNow()})),options:{TTL:120,urgency:'high'},request,send,environment});accepted=true;result.sent++;}
     catch(error){result.failed++;if(suppressed(error))status='suppressed';else if(error.code==='notification_send_uncertain'||!Number(error.statusCode))status='uncertain';else if((Number(error.statusCode)>=500||Number(error.statusCode)===429)&&count<3)status='pending';else status='failed';if(Number(error.statusCode)===404||Number(error.statusCode)===410)await request('/rest/v1/nothingsports_push_installations?installation_id=eq.'+installation.installation_id,{method:'DELETE'});}
     await request('/rest/v1/nothingsports_milestone_installations?'+new URLSearchParams({group_id:'eq.'+group,installation_id:'eq.'+installation.installation_id}),{method:'PATCH',body:{status}});
     uncertain||=status==='uncertain';pending=status==='pending';if(status!=='pending')break;
    }
   }
   await request('/rest/v1/nothingsports_milestone_groups?group_id=eq.'+group,{method:'PATCH',body:{status:accepted?'sent':uncertain?'uncertain':pending?'sending':'failed'}});
  }
 }
 if(!live&&budget.remaining()>1500)await rpc(request,'nothingsports_record_milestone_shadow',{stats:result});
 return result;
}
module.exports={mode,checkpoint,observePublished,dispatch};
