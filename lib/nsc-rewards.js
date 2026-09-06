'use strict';
const server=require('./nothingscore-server');
const {supabaseServiceRequest}=require('./supabase-server');
const forecasts=require('../data/nsc-forecasts.json');
async function submit(userId,eventId,phase,rating,event,now=new Date()){
  const forecast=forecasts.fixtures?.[eventId];
  const valid=forecast&&Date.parse(forecast.generatedAt)<Date.parse(event.startTimeUtc)&&Date.parse(forecast.generatedAt)<=+now;
  return supabaseServiceRequest('/rest/v1/rpc/nothingsports_nsc_rate_current',{method:'POST',body:{target_user_id:userId,target_event_id:eventId,target_phase:phase,target_rating:rating,fixture_start:event.startTimeUtc,fixture_end:event.endTimeUtc,fixture_status:String(event.status || '').toLowerCase(),algorithm_forecast:valid?forecast.rating:null,algorithm_version:valid?forecast.version:null}});
}
async function rewardsFor(userId){
  await supabaseServiceRequest('/rest/v1/rpc/nothingsports_nsc_sync_rewards',{method:'POST',body:{target_user_id:userId}});
  const {allRows}=require('./nsc-rankings');
  const [points,settlements,entitlements,campaigns]=await Promise.all([
    allRows(server.TABLES.points,{user_id:`eq.${userId}`,select:'points'}),
    server.rows('nothingsports_nsc_foresight_settlements',{user_id:`eq.${userId}`,order:'settled_at.desc',limit:'50'}),
    server.rows('nothingsports_nsc_reward_entitlements',{user_id:`eq.${userId}`}),
    server.rows('nothingsports_nsc_reward_campaigns',{active:'eq.true'}),
  ]);
  const total=points.reduce((sum,p)=>sum+Number(p.points),0),eligible=campaigns.filter(c=>Date.parse(c.starts_at)<=Date.now()&&(!c.ends_at||Date.parse(c.ends_at)>Date.now())&&(c.eligibility==='registered'||c.eligible_user_ids?.includes(userId)));
  const next=eligible.filter(c=>c.kind==='privilege'&&c.points_per_entry>total).sort((a,b)=>a.points_per_entry-b.points_per_entry)[0];
  return {points:total,settlements:settlements.map(s=>({...s,name:server.eventFor(s.event_id)?.name})),nextPrivilege:next?{label:next.label,remaining:next.points_per_entry-total}:null,entries:entitlements.filter(e=>eligible.some(c=>c.id===e.campaign_id&&c.kind==='prize')).map(e=>({...e,label:eligible.find(c=>c.id===e.campaign_id).label})),privileges:entitlements.filter(e=>campaigns.some(c=>c.id===e.campaign_id&&c.kind==='privilege')).map(e=>({...e,label:campaigns.find(c=>c.id===e.campaign_id).label}))};
}
module.exports={submit,rewardsFor};
