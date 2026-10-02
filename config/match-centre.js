(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_MATCH_CENTRE=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
 const sport=e=>{const key=String(e.key||'').replace(/-women$/,'');return ({wimbledon:'tennis',rugby:'rugby-union'})[key]||key;};
 const final=e=>/^(completed|finished|final)$/.test(e.status||'');
 const interrupted=e=>/^(stumps|suspended|interrupted|delayed|rain-delay|break)$/.test(e.status||'');
 function supported(e){
  if(e.key==='golf'&&e.eventFamilyId==='presidents-cup'&&e.tournamentParent===true)return true;
  return !['tennis_parent','tennis_rubber'].includes(e.cardType)&&!e.parentTieId&&!(e.tieId&&e.contestUnit!=='tie')&&e.contestUnit!=='rubber'&&!['major_event','tournament','ticket_sale','rubber'].includes(e.kind);
 }

 function completion(e){return Date.parse(e.actualEndTimeUtc||e.completedAt||e.firstConfirmedCompleteAt||e.resultPublishedAt||'');}
 function eligible(e,now=Date.now()){
  if(!supported(e)||/^(cancelled|canceled|abandoned)$/.test(e.status||''))return false;
  if(final(e)){const end=completion(e);return Number.isFinite(end)&&now<=end+3600000;}
  if(e.status==='live'||e.status==='in-progress'||interrupted(e))return true;
  const start=Date.parse(!e.timeTbc&&!e.startTimeTbc&&(!e.timePrecision||['exact','session-start','not-before'].includes(e.timePrecision))?e.startTimeUtc||'':'');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const multiDay=e.endDate&&e.endDate>e.date;
  return Number.isFinite(start)&&start<=now+1800000&&(start>=now-86400000||multiDay&&today<=(e.endDate||e.date));
 }
 function select(events,now=Date.now()){return [...new Map(events.filter(e=>eligible(e,now)).map(e=>[id(e),e])).values()].sort((a,b)=>(Date.parse(a.startTimeUtc||a.estimatedStartTimeUtc)||0)-(Date.parse(b.startTimeUtc||b.estimatedStartTimeUtc)||0)||id(a).localeCompare(id(b)));}
 function interval(e,now=Date.now()){const restart=Date.parse(e.restartTimeUtc||'');return interrupted(e)&&!(restart>=now-120000&&restart<=now+1800000)?1800000:sport(e)==='tennis'?120000:300000;}
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function officialUrl(e){return safeUrl(e.sourceUrl||e.canonicalSourceUrl||e.officialUrl)||({nrl:'https://www.nrl.com/draw/',afl:'https://www.afl.com.au/fixture','rugby-union':'https://www.world.rugby/tournaments/fixtures-results'})[sport(e)]||null;}
 function score(e){
  // Official team-tennis reports store tie totals and winner-first set strings.
  // Parse only that explicit score field, never narrative or a title.
  if(sport(e)==='tennis'&&e.contestUnit==='tie'&&/^\d+[–-]\d+$/.test(e.score||'')){const [home,away]=e.score.split(/[–-]/).map(Number);return {home,away};}
  if(sport(e)==='tennis'&&e.contestUnit==='rubber'&&/^\d+[–-]\d+(?:\(\d+\))?(?:\s+\d+[–-]\d+(?:\(\d+\))?)*$/.test(e.score||''))return {sets:e.score.split(/\s+/).map(s=>{const [home,away]=s.split(/[–-]/).map(v=>parseInt(v,10));return {home,away};}),games:null};
  // Never parse a title or free-form commentary into a score, or reverse source sides.
  if(sport(e)==='tennis')return {sets:Array.isArray(e.sets)?e.sets.map(s=>({home:s.home??s.homeScore,away:s.away??s.awayScore})):[],games:e.games?{home:e.games.home,away:e.games.away}:null,home:e.homeScore??null,away:e.awayScore??null};
  if(sport(e)==='cricket')return {innings:Array.isArray(e.innings)?e.innings.map(i=>{const participantId=i.participantId||(i.battingTeamId!=null?`team:cricket:ca-${i.battingTeamId}`:null);const p=(e.participants||[]).find(p=>p.id===participantId);return {participantId,team:i.team||p?.displayName||p?.name,runs:i.runs??i.runsScored,wickets:i.wickets??i.numberOfWicketsFallen,overs:i.overs??i.oversBowled};}):[]};
  return {home:e.homeScore??null,away:e.awayScore??null};
 }
 // Score, status and freshness belong to a single source observation.
 function observation(prior,next){
  if(!prior)return next;
  const stamp=x=>Date.parse(x.observationCheckedAt||x.statusCheckedAt||x.scoreCheckedAt||x.checkedAt||'');
  const settled=e=>final(e)||e.status==='abandoned';
  if(settled(prior)&&!settled(next)||Number.isFinite(stamp(prior))&&(!Number.isFinite(stamp(next))||stamp(next)<stamp(prior)))return {...prior,stale:true};
  return {...next};
 }
 function compact(e,{checkedAt=null,stale=false,rubbers=false}={}){return {format:e.format||e.matchFormat||null,actualStartTimeUtc:e.actualStartTimeUtc||null,livePlayObservedAt:e.livePlayObservedAt||null,id:id(e),sport:sport(e),status:e.status||'scheduled',homeParticipantId:e.homeParticipantId||e.matchupSides?.[0]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[0]?.participantId||e.participantIds?.[0]:null)||null,awayParticipantId:e.awayParticipantId||e.matchupSides?.[1]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[1]?.participantId||e.participantIds?.[1]:null)||null,startTimeUtc:e.startTimeUtc||null,completedAt:Number.isFinite(completion(e))?new Date(completion(e)).toISOString():null,scoreCheckedAt:e.scoreCheckedAt||checkedAt||e.sourceCheckedAt||null,statusCheckedAt:e.statusCheckedAt||checkedAt||e.sourceCheckedAt||null,checkedAt:e.scoreCheckedAt||checkedAt||e.sourceCheckedAt||e.canonicalSourceCheckedAt||null,stale,score:score(e),officialUrl:officialUrl(e),...(rubbers?{rubbers:(e.rubbers||[]).slice(0,10).map(r=>({id:id(r),name:r.sides?.length?r.sides.map(s=>s.names.join(' / ')).join(' v '):r.name||'',status:r.status,score:score({...r,key:'tennis'})}))}:{})};}
 return {id,sport,final,interrupted,supported,completion,eligible,select,interval,compact,observation};
});
