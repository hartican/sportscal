'use strict';
const fs=require('node:fs'),path=require('node:path'),policy=require('../config/editorial-maintenance');
const {supabaseServiceRequest:request}=require('./supabase-server');
const TABLE='nothingsports_editorial_maintenance';
const query=(params={})=>'/rest/v1/'+TABLE+'?'+new URLSearchParams(params);
const rpc=(name,body)=>request('/rest/v1/rpc/'+name,{method:'POST',body});
const sources=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/editorial-maintenance-sources.v1.json'),'utf8'));
async function inventory({now=new Date(),requestImpl=request}={}){
  const source=sources(),events=source.events.filter(e=>policy.schedule(e,{},now).inWindow);
  const groups=events.map(event=>({event_id:event.id,aliases:policy.ids(event)})),signals=[];
  // Bound each aggregate read and retain full per-account aggregation on the server.
  for(let index=0;index<groups.length;index+=100)signals.push(...await requestImpl('/rest/v1/rpc/nothingsports_editorial_signals',{method:'POST',body:{target_groups:groups.slice(index,index+100)}}));
  const states=await requestImpl(query({select:'*',order:'event_id.asc',limit:'1000'}));
  if(states.length>=1000)throw Error('Editorial state pagination required; refusing a partial control snapshot.');
  const bySignal=new Map(signals.map(s=>[s.event_id,s])),byState=new Map(states.map(s=>[s.event_id,s]));
  return {horizon:{from:policy.day(now),to:policy.plus(policy.day(now),14)},sourceRevision:source.sourceRevision,cards:events.map(event=>{
    const state=policy.ids(event).map(id=>byState.get(id)).find(Boolean)||{event_id:event.id,revision:0};
    const signal=policy.ids(event).map(id=>bySignal.get(id)).find(Boolean)||{};
    const eligibility=policy.eligibility(signal),schedule=policy.schedule(event,state,now);
    return {event,state,eligibility,schedule,selected:eligibility.eligible||state.requested===true};
  })};
}
async function ensure(eventId){await request(query({on_conflict:'event_id'}),{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:{event_id:eventId}});}
async function patch(eventId,revision,body){
  await ensure(eventId);
  const result=await request(query({event_id:'eq.'+eventId,revision:'eq.'+revision}),{method:'PATCH',headers:{Prefer:'return=representation'},body});
  if(result.length!==1)throw Object.assign(Error('Editorial changed concurrently; refresh before saving.'),{status:409});
  return result[0];
}
async function checked(card,{copy,now=new Date(),deferred=null}={}){
  const body=deferred?{last_error:deferred}: {last_checked_at:now.toISOString(),last_error:null,staged_copy:copy||policy.copy(card.event),pending_copy:null};
  return patch(card.state.event_id,Number(card.state.revision),body);
}
async function command(body,user){
  if(body.action==='editorial-list'){
    const result=await inventory();
    return {...result,cards:result.cards.map(({event,state,eligibility,schedule,selected})=>({id:event.id,name:event.name,key:event.key,date:schedule.date,copy:policy.copy(event),sources:event.editorialSources||[],researchedAt:event.editorialNarrative?.researchedAt||null,state,eligibility,schedule,selected}))};
  }
  const event=sources().events.find(e=>e.id===body.eventId);
  if(!event)throw Object.assign(Error('Unknown editorial fixture.'),{status:404});
  if(policy.protectedFixture(event))throw Object.assign(Error('The approved men\'s NRL Grand Final editorial is protected.'),{status:409});
  const rows=await request(query({event_id:'eq.'+event.id,select:'*',limit:'1'})),state=rows[0]||{revision:0,history:[]};
  if(!Number.isInteger(body.expectedRevision)||state.revision!==body.expectedRevision)throw Object.assign(Error('Editorial revision conflict; reload before saving.'),{status:409});
  const change={revision:state.revision+1,updated_at:new Date().toISOString()};
  if(body.action==='editorial-save'){
    const copy=Object.fromEntries(policy.fields.map(field=>[field,String(body.copy?.[field]||'').trim()]));
    for(const field of policy.fields)if(!copy[field]||copy[field].length>(['formCopy','closingCopy'].includes(field)?700:4000))throw Object.assign(Error('Provide a valid '+field+' section.'),{status:400});
    if(new Set(Object.values(copy)).size!==4)throw Object.assign(Error('Editorial sections must be distinct.'),{status:400});
    change.pending_copy=copy;
  }else if(body.action==='editorial-hold'){change.held=body.held===true;}
  else throw Object.assign(Error('Unknown editorial action.'),{status:400});
  change.history=[...(state.history||[]),{revision:state.revision,copy:state.pending_copy||policy.copy(event),held:state.held||false,at:change.updated_at,reason:body.action}].slice(-30);
  return {state:await patch(event.id,state.revision,change),queued:true};
}
module.exports={TABLE,query,rpc,sources,inventory,patch,checked,command};
