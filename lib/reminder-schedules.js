'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const managed=id=>/^(?:event:premier-league:\d+|fixture:football:openligadb:uefa-(?:champions|europa)-league:\d+)$/.test(id||'');
function decision(reminder,fixture,now=new Date()){
 if(!managed(reminder.event_id)||String(reminder.delivery_mode||'match-15')!=='match-15')throw Error('Unreviewed reminder mode or competition');
 const base={id:reminder.id,expected_start:reminder.starts_at,expected_updated:reminder.updated_at,new_start:null};
 if(!fixture)return {...base,state:'unavailable'};
 if(['completed','live','cancelled','postponed','suspended','abandoned'].includes(fixture.status))return {...base,state:'inactive'};
 if(!['upcoming','scheduled'].includes(fixture.status))return {...base,state:'unconfirmed'};
 const start=Date.parse(fixture.startTimeUtc||'');
 if(!Number.isFinite(start)||fixture.timePrecision!=='exact'||fixture.scheduleStatus!=='confirmed')return {...base,state:'unconfirmed'};
 if(start<=+now)return {...base,state:'passed'};
 return {...base,state:'ready',new_start:new Date(start).toISOString()};
}
async function reconcile({request=supabaseServiceRequest,now=new Date(),fixtures}={}){
 const rows=await request('/rest/v1/rpc/nothingsports_reminder_schedule_candidates',{method:'POST',body:{}});
 if(!Array.isArray(rows)||rows.length>20)throw Error('Invalid bounded reminder schedule inventory');
 if(!rows.length)return {checked:0,updated:0};
 const catalogue=fixtures||require('../data/code-inspector/football.json').fixtures;
 const index=new Map(catalogue.map(f=>[f.id,f]));
 const updates=rows.map(row=>decision(row,index.get(row.event_id),now));
 const updated=await request('/rest/v1/rpc/nothingsports_reconcile_reminder_schedules',{method:'POST',body:{updates}});
 return {checked:rows.length,updated:Number(updated)||0,held:updates.filter(u=>u.state!=='ready').length};
}
module.exports={managed,decision,reconcile};
