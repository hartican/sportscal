'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const policy=require('../config/fixture-reminder-policy');
const managed=id=>Boolean(id);
function decision(reminder,fixture,now=new Date()){
 if(String(reminder.delivery_mode||'match-15')!=='match-15')throw Error('Unreviewed reminder mode or competition');
 const base={id:reminder.id,expected_start:reminder.starts_at,expected_updated:reminder.updated_at,new_start:null};
 if(!fixture)return {...base,state:'unavailable'};
 if(['completed','live','cancelled','withdrawn','postponed','suspended','abandoned'].includes(fixture.status))return {...base,state:'inactive'};
 if(Date.parse(fixture.startTimeUtc)<=+now)return {...base,state:'passed'};
 const timing=reminder.reminder_origin==='manual'?policy.manualTiming(fixture,+now):policy.timing(fixture,+now);
 return timing?{...base,state:'ready',new_start:timing.startsAt,new_precision:timing.precision}:{...base,state:'unconfirmed'};
}
async function reconcile({request=supabaseServiceRequest,now=new Date(),fixtures,loadCatalogue}={}){
 const rows=await request('/rest/v1/rpc/nothingsports_reminder_schedule_candidates',{method:'POST',body:{}});
 if(!Array.isArray(rows)||rows.length>20)throw Error('Invalid bounded reminder schedule inventory');
 if(!rows.length)return {checked:0,updated:0};
 const catalogue=fixtures?require('./reminder-fixtures').index(fixtures):await (loadCatalogue?loadCatalogue():require('./reminder-fixtures').catalogue({request,now}));
 const updates=rows.map(row=>decision(row,catalogue.resolve(row.event_id),now));
 const updated=await request('/rest/v1/rpc/nothingsports_reconcile_reminder_schedules',{method:'POST',body:{updates}});
 return {checked:rows.length,updated:Number(updated)||0,held:updates.filter(u=>u.state!=='ready').length};
}
module.exports={managed,decision,reconcile};
