'use strict';
const fs=require('node:fs'),path=require('node:path');
const policy=require('../config/fixture-reminder-policy'),identity=require('../config/event-action-identity');
const {overlaySnapshots,createSnapshotStore}=require('./live-fixtures');
const pool=require('../data/canonical/tennis-watch-pool-2026.json'),players=require('../data/canonical/tennis-context-2026.json').participants||[];
const collections=Object.fromEntries((pool.collections||[]).map(c=>[c.id,{...c,memberIds:[...new Set([...(c.memberIds||[]),...players.filter(p=>c.includeTour&&p.sportDomainId==='sport:tennis:'+c.includeTour.toLowerCase()).map(p=>p.id),...(pool.players||[]).filter(p=>c.includeWatchPoolGender&&p.genderCategory===c.includeWatchPoolGender).map(p=>p.id)])]}]));
function published(){
 const dir=path.join(__dirname,'../data/code-inspector');
 const docs=fs.readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
 const rows=[...require('../data/events.json').events,...docs.flatMap(d=>d.fixtures||[]),...require('../data/tournament-horizon.v1.json').tournaments.flatMap(t=>(t.publishedFixtures||[]).map(f=>({...f,tournamentLevel:f.tournamentLevel||t.level})))];
 const expand=f=>[f,...(f.rubbers||f.matches||f.publishedFixtures||[]).filter(c=>c?.id||c?.eventId).flatMap(c=>expand({...c,competitionId:c.competitionId||f.competitionId,tournamentLevel:c.tournamentLevel||f.tournamentLevel,sourceUrl:c.sourceUrl||f.sourceUrl,sourceCheckedAt:c.sourceCheckedAt||f.sourceCheckedAt}))];
 return rows.flatMap(expand);
}
function index(rows){
 const map=new Map(),byId=new Map();
 for(let f of rows){
  const aliasesFor=identity.aliasesForEvent(f),key=aliasesFor.map(id=>map.get(id)?.actionKey).find(Boolean)||policy.fixtureId(f);if(!key)continue;
  for(const alias of aliasesFor){const prior=map.get(alias);if(prior?.actionKey&&prior.actionKey!==key){const removed=byId.get(prior.actionKey);byId.delete(prior.actionKey);if(removed)f={...removed,...f,sourceEventIds:[...(removed.sourceEventIds||[]),...(f.sourceEventIds||[])]};}}
  const old=byId.get(key),aliases=[...new Set([...identity.aliasesForEvent(f),...(old?.sourceEventIds||[])])];
  const next={...old,...f,actionKey:key,canonicalEventId:key,sourceEventIds:aliases};byId.set(key,next);for(const alias of aliases)map.set(alias,next);
 }
 for(const f of byId.values())for(const alias of identity.aliasesForEvent(f))map.set(alias,f);
 return {fixtures:[...byId.values()],resolve:id=>map.get(String(id||''))||null};
}
async function catalogue({request,rows=published(),snapshots,now=new Date(),requiredIds=[]}={}){
 let sources=snapshots;
 if(!sources){
  // A transient three-second snapshot timeout must not abort the whole run.
  // Keep each attempt bounded by the caller's dispatch budget and never use
  // stale/static timing to send when both attempts fail.
  const transport=request||require('./supabase-server').supabaseServiceRequest;
  const required=[...new Set([...requiredIds,...rows.filter(f=>f.sessionOrderEvidence).flatMap(f=>f.sessionOrderEvidence.fixtureIds||[]),...rows.filter(f=>policy.knockout(f)&&policy.timing(f,+now)).flatMap(identity.aliasesForEvent)])].map(String).sort();
  if(required.length>5000||required.some(id=>id.length>200))throw Error('Reminder identity budget exceeded');
  const scopedRead=async(p,o)=>{
   if(!p.endsWith('nothingsports_read_current_fixture_bundle'))return transport(p,o);
   let result;
   try{result=await transport('/rest/v1/rpc/nothingsports_read_reminder_fixture_bundle',{...o,body:{p_required_ids:required}});}
   catch(error){if([400,404].includes(Number(error?.status)))throw new (require('./supabase-server').SupabaseRequestError)('Reminder snapshot unavailable',{status:503,payload:{code:'reminder_snapshot_unavailable'}});throw error;}
   if(result?.scope!=='reminders'||JSON.stringify(result.requiredIds)!==JSON.stringify(required))throw Error('Wrong reminder snapshot scope');
   return result;
  };
  const retryRead=async(p,o)=>{
   try{return await scopedRead(p,o);}
   catch(error){if(![502,504].includes(Number(error?.status)))throw error;return scopedRead(p,o);}
  };
  sources=await createSnapshotStore({request:retryRead}).read();
 }
 const merged=overlaySnapshots(rows,sources,{now});
 // Retain display facts on failure. Failed or overdue shared source observations
 // cannot verify an imminent start for a reminder.
 const held=new Set((sources||[]).filter(s=>s.failure_count>0||s.last_error||s.next_due_at&&Date.parse(s.next_due_at)+600000<+now).flatMap(s=>(s.fixtures||[]).flatMap(identity.aliasesForEvent)));
 return index(require('./session-order-estimates').apply(merged.map(f=>held.has(f.id)||identity.aliasesForEvent(f).some(id=>held.has(id))?{...f,timingVerified:false,manualEstimateHeld:true}:f),now));
}
module.exports={published,index,catalogue,collections};
