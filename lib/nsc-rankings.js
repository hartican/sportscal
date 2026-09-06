'use strict';
const crowd=require('./nsc-crowd');
const server=require('./nothingscore-server');
const {catalogue,subscriptionEvents}=require('./calendar-catalogue');
const {supabaseServiceRequest,USER_STATE_TABLE,userStateFromRow}=require('./supabase-server');
async function allRows(table,parameters={}){
  const result=[];for(let offset=0;;offset+=1000){const page=await server.rows(table,{...parameters,limit:'1000',offset:String(offset)});result.push(...page);if(page.length<1000)return result;}
}
async function rankings(query,user){
  const phase=({upcoming:'heat',live:'pulse',past:'impact'})[query.tab || 'upcoming'];if(!phase)throw new Error('Invalid ranking tab');
  const now=new Date(),days=Math.max(1,Math.min(365,Number(query.days)||7));
  let prefs={};try{prefs=JSON.parse(query.preferences || '{}');}catch{}
  let state={preferences:prefs};
  if(user){const stored=await supabaseServiceRequest(`/rest/v1/${USER_STATE_TABLE}?user_id=eq.${user.id}&select=*&limit=1`);if(stored?.[0])state=userStateFromRow(stored[0]);}
  const candidates=query.scope==='all'?catalogue():subscriptionEvents(state,{includedIds:[],excludedIds:[]},now,{historyDays:days+1});
  const events=new Map();
  for(const raw of candidates){
    const id=server.canonicalEventId(raw.eventId || raw.id),ev=server.eventFor(id)||server.eventWithTiming(raw);
    if(!ev || ['major_event','tournament','ticket_sale'].includes(ev.kind)||crowd.phaseFor(ev,now)!==phase)continue;
    const sportFamily=key=>({'premier-league':'football',fifa:'football',f1:'motorsport',nba:'basketball',nfl:'american-football',rugby:'rugby-union',wimbledon:'tennis',aflw:'afl'})[key]||key;
    if(query.sport&&sportFamily(ev.key)!==query.sport&&sportFamily(raw.key)!==query.sport&&ev.key!==query.sport)continue;
    const start=Date.parse(ev.startTimeUtc || '');
    if(phase!=='pulse'&&(!Number.isFinite(start)|| (phase==='heat'?(start<+now||start>+now+days*86400000):(start<+now-days*86400000||start>+now))))continue;
    events.set(id,{id,name:ev.name,key:ev.key || raw.key,startTimeUtc:ev.startTimeUtc,status:ev.status,phase});
  }
  const rows=await allRows(server.TABLES.contributions,{phase:`eq.${phase}`,select:'event_id,user_id,phase,rating,updated_at',...(phase==='pulse'?{updated_at:`gt.${new Date(+now-crowd.LIVE_MS).toISOString()}`}:{})});
  const byEvent=new Map();for(const row of rows){const id=server.canonicalEventId(row.event_id);if(events.has(id)){if(!byEvent.has(id))byEvent.set(id,[]);byEvent.get(id).push(row);}}
  const entries=[...events.values()].map(ev=>({...ev,crowd:crowd.summary(byEvent.get(ev.id)||[],{phase,now})})).sort(crowd.compare);
  let rank=0;entries.forEach(ev=>ev.rank=ev.crowd.ranked?++rank:null);
  const offset=Math.max(0,Number(query.cursor)||0),limit=25;
  return {entries:entries.slice(offset,offset+limit),total:entries.length,nextCursor:offset+limit<entries.length?offset+limit:null,calculatedAt:now.toISOString()};
}
module.exports={rankings,allRows};
