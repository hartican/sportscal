(function(root,factory){const api=factory(typeof module==='object'?require('./follow-first'):root.NOTHINGSPORTS_FOLLOW_FIRST);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_ATHLETES=api;})(globalThis,function(follow){
 'use strict';
 const identity=id=>follow.participantFollowIdentityKey(id);
 const individual=record=>/^(athlete|competitor|player):/.test(String(record?.id||record))||['athlete','competitor','player'].includes(record?.type||record?.entityType);
 const sport=record=>record.sportKey||String(record.sportDomainId||record.id||'').split(':')[1]||'';
 function role(key){key=String(key||'').replace(/-women$/,'');return ['tennis','wimbledon','football','soccer','afl','aflw','nrl','nrlw','rugby','rugby-union','nba','nbl','nfl','nhl','ice-hockey','cricket','basketball','netball','hockey','fiba'].includes(key)?'Player':['f1','wrc','motorsport','supercars'].includes(key)?'Driver':key==='motogp'?'Rider':key==='golf'?'Golfer':'Athlete';}
 function participantIds(event){return [...new Set([...(event.participantIds||[]),...(event.participants||[]).map(p=>p.id),...(event.participantSlots||[]).map(p=>p.participantId),...(event.matchupSides||[]).flatMap(s=>(s.players||[]).map(p=>p.id)),event.homeParticipantId,event.awayParticipantId].filter(Boolean))];}
 const involves=(event,id)=>participantIds(event).some(p=>identity(p)===identity(id));
 function list(records,activeIds){
  const keys=new Set([...activeIds].filter(individual).map(identity)),seen=new Set();
  return records.filter(individual).filter(p=>{const key=identity(p.id);if(!keys.has(key)||seen.has(key))return false;seen.add(key);return true;}).map(p=>({...p,sportKey:sport(p),displayName:p.displayName||p.canonicalName||p.name||'Followed athlete'})).sort((a,b)=>a.displayName.localeCompare(b.displayName));
 }
 function next(events,id,now=Date.now()){
  return events.filter(e=>involves(e,id)&&!(/^(completed|finished|final|cancelled|canceled|abandoned|withdrawn)$/.test(e.status||''))).filter(e=>Date.parse(e.startTimeUtc||'')>=now||e.date>=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))||/^(live|in-progress|stumps|suspended|interrupted)$/.test(e.status||''))
   .sort((a,b)=>{const fresh=e=>/^(live|in-progress)$/.test(e.status||'')&&Date.parse(e.statusCheckedAt||e.livePlayObservedAt||'')<=now&&now-Date.parse(e.statusCheckedAt||e.livePlayObservedAt||'')<=1800000;return Number(fresh(b))-Number(fresh(a))||(Date.parse(a.startTimeUtc||a.date)||Infinity)-(Date.parse(b.startTimeUtc||b.date)||Infinity);})[0]||null;
 }
 return {identity,individual,sport,role,participantIds,involves,list,next};
});
