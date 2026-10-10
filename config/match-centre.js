(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_MATCH_CENTRE=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
 const sport=e=>{const key=String(e.key||'').replace(/-women$/,'');return ({wimbledon:'tennis',rugby:'rugby-union'})[key]||key;};
 const final=e=>/^(completed|finished|final)$/.test(e.status||'');
 const interrupted=e=>/^(stumps|suspended|interrupted|delayed|rain-delay|break)$/.test(e.status||'');
 function supported(e,{catalogue=true}={}){
  const policy=globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null);if(policy&&!policy.activeEligible(e))return false;
  const cricket=globalThis.NOTHINGSPORTS_CRICKET_COVERAGE||(typeof require==='function'?require('./cricket-coverage'):null);if(catalogue&&cricket?.isCricket(e)&&!cricket.allowed(e))return false;
  if(e.key==='golf'&&e.eventFamilyId==='presidents-cup'&&e.tournamentParent===true)return true;
  return !['tennis_parent','tennis_rubber'].includes(e.cardType)&&!e.parentTieId&&!(e.tieId&&e.contestUnit!=='tie')&&e.contestUnit!=='rubber'&&!['major_event','tournament','ticket_sale','rubber'].includes(e.kind);
 }

 function completion(e){
  const actual=Date.parse(e.actualEndTimeUtc||e.completedAt||'');if(Number.isFinite(actual))return actual;
  // Importing an already-final fixture is not a new sporting completion.
  // The independent status-fact clock survives later verification receipts.
  const known=[e.firstConfirmedCompleteAt,e.resultPublishedAt,final(e)?e.statusFactObservedAt:null].map(v=>Date.parse(v||'')).filter(Number.isFinite);
  if(!known.length)return NaN;const first=Math.min(...known);
  // A first import of an old result cannot prove that it finished recently.
  // Calendar bounds only withhold membership; they never establish a result.
  let lastDay=e.endDate||e.date;
  if(!e.endDate&&Number.isFinite(Date.parse(e.date||''))&&Number.isSafeInteger(e.numberOfDays)&&e.numberOfDays>1)lastDay=new Date(Date.parse(e.date)+Math.min(14,e.numberOfDays-1)*86400000).toISOString().slice(0,10);
  const windowEnd=typeof lastDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(lastDay)?Date.parse(lastDay+'T23:59:59Z'):NaN;
  return Number.isFinite(windowEnd)&&first>windowEnd+86400000?NaN:first;
 }
 function observed(e){return Date.parse(e.statusCheckedAt||e.livePlayObservedAt||'');}
 function liveState(e,now=Date.now()){
  const paused=interrupted(e)||e.status==='ongoing';
  if(!paused&&!/^(live|in-progress|in_progress)$/.test(e.status||''))return null;
  const at=observed(e),age=now-at;
  if(!Number.isFinite(at)||age<0)return null;
  // A missing check cannot close an unresolved contest. Keep the source's
  // explicit interruption, otherwise qualify old or failed play observations.
  if(interrupted(e))return 'paused';
  if(e.stale!==true&&e.sourceStale!==true&&age<=interval(e,now)*2)return paused?'paused':'playing';
  return 'awaiting-update';
 }
 function section(e,now=Date.now()){
  if(!supported(e)||/^(cancelled|canceled|abandoned|past|postponed)$/.test(e.status||''))return null;
  if(final(e)){const end=completion(e);return Number.isFinite(end)&&end<=now&&now<=end+3600000?'recently-finished':null;}
  if(liveState(e,now))return 'live';
  if(!/^(scheduled|upcoming)$/.test(e.status||''))return null;
  const precision=String(e.timePrecision||'exact').replace('_','-');
  const start=Date.parse(!e.timeTbc&&!e.startTimeTbc&&e.timingVerified!==false&&e.sourceStale!==true&&(['exact','not-before'].includes(precision)||precision==='session-start'&&sport(e)!=='tennis')?e.startTimeUtc||'':'');
  return Number.isFinite(start)&&start>=now&&start<=now+1800000?'starting-soon':null;
 }
 const eligible=(e,now=Date.now())=>Boolean(section(e,now));
 // Verified same-kickoff CA/ESPN Shield and Australia A records, 9 October.
 // Display grouping only: provider/action IDs and saved personal state survive.
 const publicCricketTeams={'team:cricket:espn-584':'team:cricket:ca-82','team:cricket:espn-520':'team:cricket:ca-1214','team:cricket:espn-387':'team:cricket:ca-674','team:cricket:espn-560':'team:cricket:ca-85','team:cricket:espn-602':'team:cricket:ca-83','team:cricket:espn-459':'team:cricket:ca-1205','team:cricket:espn-1781':'team:cricket:ca-63','team:cricket:espn-49':'team:cricket:ca-64'};
 function contest(e){const sides=[e.homeParticipantId,e.awayParticipantId].filter(Boolean).sort();if(sport(e)==='cricket'&&sides.length===2&&Number.isFinite(Date.parse(e.startTimeUtc||'')))return ['cricket',Date.parse(e.startTimeUtc),...sides.map(s=>publicCricketTeams[s]||s).sort()].join('|');return sides.length===2?[sport(e),e.tournamentId||e.tennisTournamentId||'',e.roundLabel||e.round||'',e.startTimeUtc||e.date||'',...sides].join('|'):id(e);}
 function courtKey(e){const court=e.courtId||e.court,tournament=e.tournamentId||e.tennisTournamentId;return sport(e)==='tennis'&&tournament&&court?`${tournament}|${e.tournamentEditionId||e.editionId||e.season||''}|${String(court).normalize('NFKD').trim().toLowerCase().replace(/\s+/g,' ')}`:null;}
 function conflicts(events,now=Date.now()){
  const groups=new Map();for(const e of events){const key=courtKey(e);if(!key||liveState(e,now)!=='playing')continue;const group=groups.get(key)||new Map();group.set(contest(e),e);groups.set(key,group);}
  return [...groups].filter(([,g])=>g.size>1).map(([court,g])=>({court,events:[...g.values()]}));
 }
 function select(events,now=Date.now()){
  const contests=new Map();for(const e of events.filter(e=>eligible(e,now))){const key=contest(e),prior=contests.get(key);if(!prior||sport(e)==='cricket'&&e.sourceType==='official'&&prior.sourceType!=='official')contests.set(key,e);}const members=[...new Map([...contests.values()].map(e=>[id(e),e])).values()],suppressed=new Set();
  for(const group of conflicts(members,now)){
   const official=group.events.filter(e=>e.statusSourceType==='official'),playing=group.events.filter(e=>Number.isFinite(Date.parse(e.livePlayObservedAt)));
   const winner=official.length===1?official[0]:!official.length&&playing.length===1?playing[0]:null;
   for(const e of group.events)if(e!==winner)suppressed.add(id(e));
  }
  const priority=e=>({'live':liveState(e,now)==='playing'?0:1,'starting-soon':2,'recently-finished':3})[section(e,now)];
  return members.filter(e=>!suppressed.has(id(e))).sort((a,b)=>priority(a)-priority(b)||(final(a)&&final(b)?completion(b)-completion(a):(Date.parse(a.startTimeUtc||a.estimatedStartTimeUtc)||0)-(Date.parse(b.startTimeUtc||b.estimatedStartTimeUtc)||0))||id(a).localeCompare(id(b)));
 }
 function interval(e,now=Date.now()){const restart=Date.parse(e.restartTimeUtc||'');return interrupted(e)&&!(restart>=now-120000&&restart<=now+1800000)?1800000:120000;}
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function officialUrl(e){return safeUrl(e.sourceUrl||e.canonicalSourceUrl||e.officialUrl)||({nrl:'https://www.nrl.com/draw/',afl:'https://www.afl.com.au/fixture','rugby-union':'https://www.world.rugby/tournaments/fixtures-results'})[sport(e)]||null;}
 function scorecard(e){
  const supplied=safeUrl(e.officialScorecardUrl)||safeUrl(e.scorecardUrl);
  const ca=[id(e),e.sourceFixtureId].map(value=>String(value||'').match(/^(?:fixture:cricket:)?CA:(\d+)$/)).find(Boolean);
  const url=supplied||(sport(e)==='cricket'&&e.sourceType==='official'&&ca?`https://www.cricket.com.au/matches/CA%3A${ca[1]}`:null);
  return {scorecardUrl:url,scorecardOfficial:Boolean(url&&e.sourceType==='official')};
 }
 const label=value=>typeof value==='string'?value.slice(0,180):null;
 const count=value=>Number.isFinite(value)&&value>=0?value:null;
 function players(rows,kind){
  if(!Array.isArray(rows))return [];
  return rows.slice(0,30).filter(r=>r&&label(r.name||r.playerName||r.player?.name)).map(r=>({name:label(r.name||r.playerName||r.player?.name),
   ...(kind==='batting'?{runs:count(r.runs??r.runsScored),balls:count(r.balls??r.ballsFaced),fours:count(r.fours),sixes:count(r.sixes),dismissal:label(r.dismissal||r.dismissalText||r.howOut),bowledBy:label(r.bowledBy||r.bowler?.name)}:{overs:label(r.overs??r.oversBowled),maidens:count(r.maidens??r.maidensBowled),runs:count(r.runs??r.runsConceded),wickets:count(r.wickets??r.wicketsTaken)})}));
 }
 function duration(e){
  if(sport(e)!=='tennis')return typeof (e.displayClock||e.clock)==='string'?(e.displayClock||e.clock):null;
  const supplied=label(e.matchDuration?.displayValue||e.matchDuration);
  if(supplied)return supplied;
  const seconds=e.matchDurationSeconds;
  return Number.isSafeInteger(seconds)&&seconds>=0&&seconds<=86400?`${Math.floor(seconds/3600)}:${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:null;
 }
 function pairedScore(e){
  const slots=e.participantSlots;if(!Array.isArray(slots)||slots.length!==2)return null;
  const home=slots.find(s=>s.homeAway==='home'),away=slots.find(s=>s.homeAway==='away');
  const valid=s=>s&&typeof s.participantId==='string'&&s.participantId&&((typeof s.score==='number'&&Number.isSafeInteger(s.score)&&s.score>=0)||(typeof s.score==='string'&&/^\d+$/.test(s.score)&&Number.isSafeInteger(Number(s.score))));
  return valid(home)&&valid(away)&&home.participantId!==away.participantId&&(!e.homeParticipantId||e.homeParticipantId===home.participantId)&&(!e.awayParticipantId||e.awayParticipantId===away.participantId)?{home,away}:null;
 }
 function score(e){
  // Official team-tennis reports store tie totals and winner-first set strings.
  // Parse only that explicit score field, never narrative or a title.
  if(sport(e)==='tennis'&&e.contestUnit==='tie'&&/^\d+[–-]\d+$/.test(e.score||'')){const [home,away]=e.score.split(/[–-]/).map(Number);return {home,away};}
  if(sport(e)==='tennis'&&e.contestUnit==='rubber'&&/^\d+[–-]\d+(?:\(\d+\))?(?:\s+\d+[–-]\d+(?:\(\d+\))?)*$/.test(e.score||''))return {sets:e.score.split(/\s+/).map(s=>{const [home,away]=s.split(/[–-]/).map(v=>parseInt(v,10));return {home,away};}),games:null};
  // Never parse a title or free-form commentary into a score, or reverse source sides.
  if(sport(e)==='tennis')return {sets:Array.isArray(e.sets)?e.sets.map(s=>({home:s.home??s.homeScore,away:s.away??s.awayScore,...(s.homeTiebreak!=null||s.awayTiebreak!=null?{homeTiebreak:s.homeTiebreak??null,awayTiebreak:s.awayTiebreak??null}:{})})):[],games:e.games?{home:e.games.home,away:e.games.away}:null,home:e.homeScore??null,away:e.awayScore??null};
  if(e.classification||e.fixtureResults?.rows)return {classification:(e.classification||e.fixtureResults.rows).slice(0,50)};
  if(sport(e)==='cricket')return {innings:Array.isArray(e.innings)?e.innings.slice(0,4).map(i=>{const participantId=i.participantId||(i.battingTeamId!=null?`team:cricket:ca-${i.battingTeamId}`:null);const p=(e.participants||[]).find(p=>p.id===participantId);return {participantId,team:i.team||p?.displayName||p?.name,runs:i.runs??i.runsScored,wickets:i.wickets??i.numberOfWicketsFallen,overs:i.overs??i.oversBowled,inningNumber:i.inningNumber??null,batting:players(i.batting||i.batsmen,'batting'),bowling:players(i.bowling||i.bowlers,'bowling')};}):[]};
  // Explicit flat values, including null, belong to their source observation.
  // Never combine a partial/cleared flat pair with older canonical slots.
  if(Object.hasOwn(e,'homeScore')||Object.hasOwn(e,'awayScore'))return {home:e.homeScore??null,away:e.awayScore??null};
  if(!final(e)&&!interrupted(e)&&!['live','in-progress','in_progress','ongoing'].includes(e.status))return {home:null,away:null};
  const pair=pairedScore(e);return {home:pair?Number(pair.home.score):null,away:pair?Number(pair.away.score):null};
 }
 // Score, status and freshness belong to a single source observation.
 function observation(prior,next){
  if(!prior)return next;
  const stamp=x=>Date.parse(x.observationCheckedAt||x.statusCheckedAt||x.scoreCheckedAt||x.checkedAt||'');
  const settled=e=>final(e)||e.status==='abandoned';
  if(settled(prior)&&!settled(next)||Number.isFinite(stamp(prior))&&(!Number.isFinite(stamp(next))||stamp(next)<stamp(prior)))return {...prior,stale:true};
  return {...next};
 }
 function compact(e,{checkedAt=null,stale=false,rubbers=false}={}){
  const value=score(e),pair=pairedScore(e),hasScore=value.home!=null||value.away!=null||value.sets?.length||value.games||value.innings?.length;
  const observationCheckedAt=e.scoreCheckedAt||(!hasScore?e.statusCheckedAt:null)||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt||e.canonicalSourceCheckedAt)||null;
  return {court:e.court||null,tournamentId:e.tournamentId||e.tennisTournamentId||null,statusSourceType:e.statusSourceType||null,format:e.format||e.matchFormat||null,actualStartTimeUtc:e.actualStartTimeUtc||null,livePlayObservedAt:e.livePlayObservedAt||null,id:id(e),sport:sport(e),status:e.status||'scheduled',homeParticipantId:e.homeParticipantId||pair?.home.participantId||e.matchupSides?.[0]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[0]?.participantId||e.participantIds?.[0]:null)||null,awayParticipantId:e.awayParticipantId||pair?.away.participantId||e.matchupSides?.[1]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[1]?.participantId||e.participantIds?.[1]:null)||null,startTimeUtc:e.startTimeUtc||null,completedAt:Number.isFinite(completion(e))?new Date(completion(e)).toISOString():null,scoreCheckedAt:e.scoreCheckedAt||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt)||null,statusCheckedAt:e.statusCheckedAt||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt)||null,checkedAt:observationCheckedAt,stale:stale||e.stale===true||e.sourceStale===true||Boolean(e.fixtureObservationSchema&&hasScore&&!e.scoreCheckedAt),score:value,officialUrl:officialUrl(e),...scorecard(e),statusText:typeof e.statusText==='string'?e.statusText:null,clock:duration(e),incidents:(Array.isArray(e.incidents)?e.incidents:Array.isArray(e.goalScorers)?e.goalScorers:[]).filter(i=>i&&typeof i==='object').slice(0,40).map(i=>({name:i.name||i.playerName||i.scorer||null,time:i.time??i.minute??i.clock??null,type:i.type||(Array.isArray(e.incidents)?null:'Goal')})),...(rubbers?{rubbers:(e.rubbers||[]).slice(0,10).map(r=>({id:id(r),name:r.sides?.length?r.sides.map(s=>s.names.join(' / ')).join(' v '):r.name||'',status:r.status,score:score({...r,key:'tennis'})}))}:{})};}
 return {id,sport,final,interrupted,supported,completion,observed,liveState,section,courtKey,conflicts,eligible,select,interval,compact,observation};
});
