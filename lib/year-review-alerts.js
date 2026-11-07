'use strict';
const {policy,path,rpc}=require('./epic-classics'),{guardedSend,suppressed}=require('./notification-send');
async function dispatch({now=new Date(),request,send}){
 const day=policy.day(now);if(!day||day.slice(5)<'12-27')return{checked:0,sent:0,failed:0};
 await rpc('prepare_year_reviews',{},request);
 const rows=await request(path('year_review_deliveries',{status:'eq.pending',year:'eq.'+day.slice(0,4),select:'*',order:'updated_at.asc',limit:'5'}));
 let sent=0,failed=0,skipped=0;
 for(const row of rows){
  const filter={user_id:'eq.'+row.user_id,year:'eq.'+row.year,installation_id:'eq.'+row.installation_id,status:'eq.pending'};
  const claimed=await request(path('year_review_deliveries',filter),{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'sending',attempts:row.attempts+1,updated_at:now.toISOString()}});if(!claimed.length)continue;
  let checks;try{checks=await Promise.all([
   request(path('classic_settings',{user_id:'eq.'+row.user_id,select:'year_review_enabled',limit:'1'})),
   request('/rest/v1/nothingsports_user_state?'+new URLSearchParams({user_id:'eq.'+row.user_id,select:'preferences',limit:'1'})),
   request('/rest/v1/nothingsports_push_installations?'+new URLSearchParams({user_id:'eq.'+row.user_id,installation_id:'eq.'+row.installation_id,select:'permission',limit:'1'})),
  ]);}catch{failed++;await request(path('year_review_deliveries',{...filter,status:'eq.sending'}),{method:'PATCH',body:{status:'pending',updated_at:now.toISOString()}});continue;}
  const [settings,state,installation]=checks;
  let status='sent';
  if(settings[0]?.year_review_enabled===false||state[0]?.preferences?.followFirst?.notifications?.enabled===false||installation[0]?.permission!=='granted'){status='suppressed';skipped++;}
  else try{await guardedSend({installationId:row.installation_id,expectedUserId:row.user_id,request,send,payload:JSON.stringify({title:'Review your classic fixtures',body:row.year+' · Your year of NS is ready to curate and share.',tag:'ns-year-review-'+row.year,url:'/?classicReview='+row.year}),options:{TTL:86400,urgency:'normal',timeout:3000}});sent++;}
  catch(error){if(suppressed(error)){status='suppressed';skipped++;}else{failed++;const code=Number(error.statusCode);status=(code>=500||code===429)&&row.attempts<2?'pending':code?'failed':'uncertain';}}
  await request(path('year_review_deliveries',{user_id:'eq.'+row.user_id,year:'eq.'+row.year,installation_id:'eq.'+row.installation_id}),{method:'PATCH',body:{status,updated_at:now.toISOString()}});
 }
 return{checked:rows.length,sent,failed,skipped};
}
module.exports={dispatch};
