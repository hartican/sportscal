'use strict';
const {authenticatedUser,bearerToken,supabaseRequest,supabaseServiceRequest,publicError,userStateFromRow,USER_STATE_TABLE}=require('./supabase-server');
const {subscriptionEvents}=require('./calendar-catalogue');
const {buildIcs}=require('../config/calendar-export');
const TABLE='nothingsports_calendar_subscriptions';
function selectionIds(value){
  if(!Array.isArray(value) || value.length>10000 || value.some(id=>typeof id!=='string'||id.length>240))throw Object.assign(new Error('Invalid calendar selection.'),{status:400});
  return [...new Set(value)];
}
module.exports=async function calendarHandler(request,response){
  response.setHeader('Cache-Control','private, no-store');
  response.setHeader('Referrer-Policy','no-referrer');
  try{
    const url=new URL(request.url || '/api/calendar','https://nothingsport.local');
    const method=request.method || 'GET';
    const token=url.searchParams.get('token') || request.query?.token;
    if(method==='GET' && token){
      if(!/^[a-f0-9]{64}$/.test(token)){response.status(404).json({error:'Subscription not found.'});return;}
      const rows=await supabaseServiceRequest(`/rest/v1/${TABLE}?token=eq.${token}&select=user_id,included_ids,excluded_ids&limit=1`);
      const subscription=rows?.[0];
      if(!subscription){response.status(404).json({error:'Subscription not found.'});return;}
      const states=await supabaseServiceRequest(`/rest/v1/${USER_STATE_TABLE}?user_id=eq.${subscription.user_id}&select=*&limit=1`);
      if(!states?.[0]){response.status(409).json({error:'Save your Nothing Sport follows before subscribing.'});return;}
      const events=subscriptionEvents(userStateFromRow(states[0]),{includedIds:subscription.included_ids,excludedIds:subscription.excluded_ids});
      response.setHeader('Content-Type','text/calendar; charset=utf-8');
      response.setHeader('Content-Disposition','inline; filename="nothing-sport.ics"');
      response.status(200).send(buildIcs(events));return;
    }
    if(!['GET','POST','DELETE'].includes(method)){response.setHeader('Allow','GET, POST, DELETE');response.status(405).json({error:'Method not allowed.'});return;}
    const accessToken=bearerToken(request),user=await authenticatedUser(accessToken);
    if(user.is_anonymous){response.status(401).json({error:'Sign in with a registered account to manage a subscription.'});return;}
    const endpoint=`/rest/v1/${TABLE}?user_id=eq.${user.id}`;
    if(method==='GET'){
      const rows=await supabaseRequest(endpoint,{accessToken});
      response.status(200).json({subscription:rows?.[0] || null});return;
    }
    if(method==='DELETE'){
      await supabaseRequest(endpoint,{method:'DELETE',accessToken});response.status(200).json({revoked:true});return;
    }
    let body=request.body || {};if(typeof body==='string')body=JSON.parse(body);
    const included=selectionIds(body.includedIds),excluded=selectionIds(body.excludedIds);
    const rows=await supabaseRequest(endpoint,{accessToken});
    const existing=rows?.[0];
    if(existing && body.updatedAt!==existing.updated_at){response.status(409).json({error:'Calendar choices changed on another device. Reopen Calendar sync to reload them.'});return;}
    const data={user_id:user.id,included_ids:included,excluded_ids:excluded,updated_at:new Date().toISOString()};
    const result=await supabaseRequest(existing?`${endpoint}&updated_at=eq.${encodeURIComponent(existing.updated_at)}`:`/rest/v1/${TABLE}`,{
      accessToken,method:existing?'PATCH':'POST',headers:{Prefer:'return=representation'},body:data,
    });
    if(!result?.length){response.status(409).json({error:'Calendar choices changed. Reopen Calendar sync.'});return;}
    response.status(200).json({subscription:result[0]});
  }catch(error){
    if(error.status===400 || error instanceof SyntaxError){response.status(400).json({error:error.message});return;}
    const outgoing=publicError(error);response.status(outgoing.status).json(outgoing.body);
  }
};
module.exports.selectionIds=selectionIds;
