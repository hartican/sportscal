(function(root,factory){const api=factory(typeof module==='object'?require('./follow-first'):root.NOTHINGSPORTS_FOLLOW_FIRST);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_ATHLETES=api;})(globalThis,function(follow){
 'use strict';
 const identity=id=>follow.participantFollowIdentityKey(id);
 const individual=record=>/^(athlete|competitor|player):/.test(String(record?.id||record))||['athlete','competitor','player'].includes(record?.type||record?.entityType);
 const sport=record=>record.sportKey||String(record.sportDomainId||record.id||'').split(':')[1]||'';
 function role(key){key=String(key||'').replace(/-women$/,'');return ['tennis','wimbledon','football','soccer','afl','aflw','nrl','nrlw','rugby','rugby-union','nba','nbl','nfl','nhl','ice-hockey','cricket','basketball','netball','hockey','fiba'].includes(key)?'Player':['f1','wrc','motorsport','supercars'].includes(key)?'Driver':key==='motogp'?'Rider':key==='golf'?'Golfer':'Athlete';}
 function participantIds(event){return [...new Set([...(event.participantIds||[]),...(event.participants||[]).map(p=>p.id),...(event.participantSlots||[]).map(p=>p.participantId),...(event.matchupSides||[]).flatMap(s=>(s.players||[]).map(p=>p.id)),event.homeParticipantId,event.awayParticipantId].filter(Boolean))];}
 const involves=(event,id)=>participantIds(event).some(p=>identity(p)===identity(id));
 function list(records,activeIds,includeTeams=false){
  const keys=new Set([...activeIds].filter(id=>individual(id)||includeTeams&&String(id).startsWith('team:')).map(identity)),seen=new Set();
  return records.filter(p=>individual(p)||includeTeams&&String(p.id).startsWith('team:')).filter(p=>{const key=identity(p.id);if(!keys.has(key)||seen.has(key))return false;seen.add(key);return true;}).map(p=>({...p,sportKey:sport(p),displayName:p.displayName||p.canonicalName||p.name||'Followed athlete'})).sort((a,b)=>a.displayName.localeCompare(b.displayName));
 }
 function next(events,id,now=Date.now()){
  return events.filter(e=>involves(e,id)&&!(/^(completed|finished|final|cancelled|canceled|abandoned|withdrawn)$/.test(e.status||''))).filter(e=>Date.parse(e.startTimeUtc||'')>=now||e.date>=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now))||/^(live|in-progress|stumps|suspended|interrupted)$/.test(e.status||''))
   .sort((a,b)=>{const fresh=e=>/^(live|in-progress)$/.test(e.status||'')&&Date.parse(e.statusCheckedAt||e.livePlayObservedAt||'')<=now&&now-Date.parse(e.statusCheckedAt||e.livePlayObservedAt||'')<=1800000;return Number(fresh(b))-Number(fresh(a))||(Date.parse(a.startTimeUtc||a.date)||Infinity)-(Date.parse(b.startTimeUtc||b.date)||Infinity);})[0]||null;
 }
 function currentContext(document,id,day,preferences){
  const player=document?.players?.find(p=>identity(p.id)===identity(id));if(!player)return null;
  const policy=typeof require==='function'?require('./follow-feed-policy'):globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY;
  for(const edition of document.editions||[]){
   const participation=edition.participation.find(p=>identity(p.playerId)===identity(id)&&p.status==='confirmed');
   const window=edition.tourWindows.find(w=>w.tour===player.tour&&w.startDate<=day&&w.endDate>=day);
   if(!participation||!window||policy.explicitlyExcluded({id:edition.id,key:'tennis',eventFamilyId:edition.eventFamilyId,tournamentId:window.tournamentId,competitionId:window.tournamentId},preferences))continue;
   const review=document.coverageReviews?.find(r=>r.editionId===edition.id&&r.tour===player.tour);
   return {edition,participation,window,review};
  }
  return null;
 }
 function timingState(event,now=Date.now()){
  if(event.timingVerified===false||event.sourceStale===true)return 'stale';
  const pendingChecked=Date.parse(event.publicationPendingVerifiedAt||event.sourceCheckedAt||'');
  if(event.organiserPublicationPending===true&&event.publicationPendingVerified===true&&Number.isFinite(pendingChecked)&&pendingChecked<=+now&&/^https:\/\//.test(event.publicationSourceUrl||''))return 'publication-pending';
  const precision=String(event.timePrecision||'').replace('_','-');
  if(!['exact','not-before'].includes(precision)||!Number.isFinite(Date.parse(event.startTimeUtc)))return 'unresolved';
  const checked=Date.parse(event.sourceCheckedAt||event.canonicalSourceCheckedAt||event.lastVerifiedAt||'');
  return Number.isFinite(checked)&&checked<=+now&&/^https:\/\//.test(event.sourceUrl||event.scheduleSourceUrl||'')?'published':'unverified';
 }
 return {identity,individual,sport,role,participantIds,involves,list,next,currentContext,timingState};
});
