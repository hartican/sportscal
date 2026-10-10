'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const policy=require('../config/fixture-reminder-policy'),actionIdentity=require('../config/event-action-identity');
const fixturesApi=require('./reminder-fixtures');
function decisions(account,catalogue,now=new Date()){
 const actions={...(account.actions||{})};
 for(const i of account.intents||[])if(i.choice!=='automatic')actions[i.fixtureId]={actionKey:i.fixtureId,canonicalEventId:i.fixtureId,reminderChoice:i.choice,reminderChangedAt:i.chosenAt};
 const chosenIds=new Set((account.intents||[]).filter(i=>i.choice==='automatic'&&i.enabled).map(i=>i.fixtureId));
 for(const [key,a] of Object.entries(actions)){const f=catalogue.resolve(key);if((a.reminderChoice||Object.hasOwn(a,'reminderRequested'))&&f&&(policy.manualTiming(f,+now)||Date.parse(f.startTimeUtc)>+now||f.sessionOrderEvidence&&['upcoming','scheduled'].includes(f.status)))chosenIds.add(key);}
 const candidates=new Map();
 for(const f of catalogue.fixtures){
  const key=policy.fixtureId(f),selected=chosenIds.has(key)||actionIdentity.aliasesForEvent(f).some(id=>chosenIds.has(id));
  if(!selected&&(!policy.knockout(f)||!policy.timing(f,+now)))continue;
  const intent=policy.intent(f,account.preferences,actions,fixturesApi.collections,+now);
  if(intent.enabled||chosenIds.has(key)||actionIdentity.aliasesForEvent(f).some(id=>chosenIds.has(id)))candidates.set(key,{f,intent});
 }
 for(const key of chosenIds)if(!catalogue.resolve(key))candidates.set(key,{f:{id:key,sourceEventIds:(account.intents||[]).find(i=>i.fixtureId===key)?.aliases||[]},intent:policy.intent({id:key},account.preferences,actions,fixturesApi.collections,+now)});
 if(candidates.size>100)throw Error('Account reminder inventory exceeds its 100-fixture budget');
 return [...candidates].map(([key,{f,intent}])=>{
  const timing=intent.choice==='on'?policy.manualTiming(f,+now):policy.timing(f,+now);
  return {fixture_id:key,aliases:actionIdentity.aliasesForEvent(f),choice:intent.choice,enabled:intent.enabled,title:String(f.name||f.displayTitleCompact||'Sporting fixture').slice(0,180),starts_at:timing?.startsAt||null,precision:timing?.precision||'exact'};
 });
}
async function reconcile({request=supabaseServiceRequest,now=new Date(),catalogue,loadCatalogue,targetUser=null}={}){
 const accounts=await request('/rest/v1/rpc/nothingsports_reminder_accounts',{method:'POST',body:{target_user:targetUser},timeoutMs:3000});
 if(!Array.isArray(accounts)||accounts.length>20)throw Error('Invalid account reminder inventory');
 if(!accounts.length)return {accounts:0,fixtures:0};
 const shared=catalogue||await (loadCatalogue?loadCatalogue():fixturesApi.catalogue({request,now}));
 const packets=accounts.map(a=>({user_id:a.user_id,expected_updated:a.updated_at,items:decisions(a,shared,now)}));
 const fixtures=await request('/rest/v1/rpc/nothingsports_reconcile_reminder_accounts',{method:'POST',body:{packets},timeoutMs:3000});
 return {accounts:accounts.length,fixtures:Number(fixtures)||0};
}
async function choose({userId,fixture,enabled,request=supabaseServiceRequest,now=new Date(),catalogue}={}){
 await request('/rest/v1/rpc/nothingsports_set_reminder_choice',{method:'POST',body:{target_user:userId,fixture_key:policy.fixtureId(fixture),fixture_aliases:actionIdentity.aliasesForEvent(fixture),enabled},timeoutMs:3000});
 if(enabled)return reconcile({request,now,catalogue,targetUser:userId});
 return {cancelled:true};
}
module.exports={decisions,reconcile,choose};
