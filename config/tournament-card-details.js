(function(root,factory){const api=factory();root.NOTHINGSPORTS_TOURNAMENT_DETAILS=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const ids=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
function edition(parent,overviews){const tournamentIds=[parent.tournamentId,parent.tennisTournamentId,...(parent.tournamentIds||[])].filter(Boolean);return overviews.find(e=>ids(parent).some(id=>ids(e).includes(id)||(e.fixtureIds||[]).includes(id)))||overviews.find(e=>tournamentIds.includes(e.tournamentId));}
function related(parent,f){const tournaments=[parent.tournamentId,parent.tennisTournamentId,...(parent.tournamentIds||[])].filter(Boolean);return ids(parent).includes(f.parentEventId)||tournaments.includes(f.tournamentId||f.tennisTournamentId)||(parent.fixtureIds||[]).some(id=>ids(f).includes(id));}
function project(parent,fixtures,follows,now=new Date()){
 const relevant=[...new Map(fixtures.filter(f=>related(parent,f)&&f.participantsConfirmed!==false&&(f.participantIds||f.participants?.map(p=>p.id)||[]).some(follows)&&!f.tournamentParent&&!['tennis_parent','golf_tournament'].includes(f.cardType)).map(f=>[ids(f)[0],f])).values()];
 const ended=f=>['completed','finished','final'].includes(f.status),sort=(a,b)=>String(a.date||'').localeCompare(b.date||'')||(Date.parse(a.startTimeUtc||a.estimatedStartTimeUtc)||Infinity)-(Date.parse(b.startTimeUtc||b.estimatedStartTimeUtc)||Infinity)||String(a.id||'').localeCompare(b.id||'');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const upcoming=relevant.filter(f=>!ended(f)&&!['cancelled','canceled','abandoned'].includes(f.status)&&(Number.isFinite(Date.parse(f.startTimeUtc||f.estimatedStartTimeUtc))?Date.parse(f.startTimeUtc||f.estimatedStartTimeUtc)>=+now:!f.date||f.date>=today)).sort(sort);
 const results=relevant.filter(ended).sort((a,b)=>String(b.actualEndTimeUtc||b.completedAt||b.date||'').localeCompare(a.actualEndTimeUtc||a.completedAt||a.date||''));
 return {upcoming,latest:results.slice(0,2),older:results.slice(2)};
}
return {edition,related,project};
});
