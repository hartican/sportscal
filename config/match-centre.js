(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_MATCH_CENTRE=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
 const sport=e=>({wimbledon:'tennis',rugby:'rugby-union'})[e.key]||e.key;
 const final=e=>/^(completed|finished|final)$/.test(e.status||'');
 const interrupted=e=>/^(stumps|suspended|interrupted|delayed|rain-delay|break)$/.test(e.status||'');
 function supported(e){return ['nrl','afl','cricket','rugby-union','tennis'].includes(sport(e))&&!['tennis_parent','tennis_rubber'].includes(e.cardType)&&!e.parentTieId&&!(e.tieId&&e.contestUnit!=='tie')&&e.contestUnit!=='rubber'&&!['major_event','tournament','ticket_sale','rubber'].includes(e.kind)&&(sport(e)==='tennis'||!/(women|female|aflw|nrlw)/i.test([e.gender,e.genderCategory,e.competitionId,e.codeId].join(' ')));}
 function completion(e){return Date.parse(e.actualEndTimeUtc||e.completedAt||e.firstConfirmedCompleteAt||e.resultPublishedAt||'');}
 function eligible(e,now=Date.now()){
  if(!supported(e)||/^(cancelled|canceled|abandoned)$/.test(e.status||''))return false;
  if(final(e)){const end=completion(e);return Number.isFinite(end)&&now<=end+3600000;}
  if(e.status==='live'||e.status==='in-progress'||interrupted(e))return true;
  const start=Date.parse(e.startTimeUtc||e.estimatedStartTimeUtc||'');
  return Number.isFinite(start)&&start<=now+1800000&&start>=now-86400000;
 }
 function select(events,now=Date.now()){return [...new Map(events.filter(e=>eligible(e,now)).map(e=>[id(e),e])).values()].sort((a,b)=>(Date.parse(a.startTimeUtc||a.estimatedStartTimeUtc)||0)-(Date.parse(b.startTimeUtc||b.estimatedStartTimeUtc)||0)||id(a).localeCompare(id(b)));}
 function interval(e,now=Date.now()){const restart=Date.parse(e.restartTimeUtc||'');return interrupted(e)&&!(restart>=now-120000&&restart<=now+1800000)?1800000:sport(e)==='tennis'?120000:300000;}
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function officialUrl(e){return safeUrl(e.sourceUrl||e.canonicalSourceUrl||e.officialUrl)||({nrl:'https://www.nrl.com/draw/',afl:'https://www.afl.com.au/fixture','rugby-union':'https://www.world.rugby/tournaments/fixtures-results'})[sport(e)]||null;}
 function score(e){
  // Never parse a title or free-form commentary into a score, or reverse source sides.
  if(sport(e)==='tennis')return {sets:Array.isArray(e.sets)?e.sets.map(s=>({home:s.home??s.homeScore,away:s.away??s.awayScore})):[],games:e.games?{home:e.games.home,away:e.games.away}:null,home:e.homeScore??null,away:e.awayScore??null};
  if(sport(e)==='cricket')return {innings:Array.isArray(e.innings)?e.innings.map(i=>{const participantId=i.participantId||(i.battingTeamId!=null?`team:cricket:ca-${i.battingTeamId}`:null);const p=(e.participants||[]).find(p=>p.id===participantId);return {participantId,team:i.team||p?.displayName||p?.name,runs:i.runs??i.runsScored,wickets:i.wickets??i.numberOfWicketsFallen,overs:i.overs??i.oversBowled};}):[]};
  return {home:e.homeScore??null,away:e.awayScore??null};
 }
 function compact(e,{checkedAt=null,stale=false,rubbers=false}={}){return {id:id(e),sport:sport(e),status:e.status||'scheduled',homeParticipantId:e.homeParticipantId||e.matchupSides?.[0]?.players?.[0]?.id||null,awayParticipantId:e.awayParticipantId||e.matchupSides?.[1]?.players?.[0]?.id||null,startTimeUtc:e.startTimeUtc||null,completedAt:Number.isFinite(completion(e))?new Date(completion(e)).toISOString():null,checkedAt:checkedAt||e.sourceCheckedAt||e.canonicalSourceCheckedAt||null,stale,score:score(e),officialUrl:officialUrl(e),...(rubbers?{rubbers:(e.rubbers||[]).slice(0,10).map(r=>({id:id(r),name:r.name||'',status:r.status,score:score({...r,key:'tennis'})}))}:{})};}
 return {id,sport,final,interrupted,supported,completion,eligible,select,interval,compact};
});
