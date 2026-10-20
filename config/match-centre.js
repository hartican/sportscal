(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_MATCH_CENTRE=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const id=e=>String(e.canonicalEventId||e.eventId||e.id||'');
 const sport=e=>{const key=String(e.key||'').replace(/-women$/,'');return ({wimbledon:'tennis',rugby:'rugby-union'})[key]||key;};
 const final=e=>/^(completed|finished|final)$/.test(e.status||'');
 const interrupted=e=>/^(stumps|suspended|interrupted|delayed|rain-delay|break)$/.test(e.status||'');
 const halftime=e=>e.status==='break'&&e.statusText==='Half-time';
 const cardTiming=()=>typeof module==='object'&&module.exports?require('./card-timing'):globalThis.NOTHINGSPORTS_CARD_TIMING;
 const interruption=e=>cardTiming()?.interruption(e)||null;
 const unexpected=e=>cardTiming()?.unexpected(e)||false;
 const interruptionPresentation=(e,now=Date.now())=>cardTiming()?.interruptionPresentation(e,now)||null;
 const pausedLabel=e=>interruption(e)?.label||cardTiming()?.pausePresentation(e)?.label||String(e.status||'').replace(/-/g,' ');
 function longPause(e,now){if(!interrupted(e)&&e.status!=='ongoing')return false;const fact=e.pauseObservation,at=Date.parse(fact?.status===e.status&&fact.reason===String(e.score?.racing?.statusText||e.statusText||pausedLabel(e)).trim().toLowerCase()?fact.observedAt:'');return e.status==='stumps'||/^(End of day|Session ended)$/i.test(e.statusText||'')||Number.isFinite(at)&&at<=now&&now-at>=1800000;}
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
  const known=[e.firstConfirmedCompleteAt,e.resultPublishedAt,final(e)||/^(abandoned|cancelled|canceled)$/.test(e.status||'')?e.statusFactObservedAt:null].map(v=>Date.parse(v||'')).filter(Number.isFinite);
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
  if(interrupted(e)&&!halftime(e))return 'paused';
  if(e.stale!==true&&e.sourceStale!==true&&age<=interval(e,now)*2)return paused?'paused':'playing';
  return 'awaiting-update';
 }
 function section(e,now=Date.now()){
  if(!supported(e)||/^(past|postponed)$/.test(e.status||''))return null;
  if(final(e)||/^(cancelled|canceled|abandoned)$/.test(e.status||'')){const end=completion(e);return Number.isFinite(end)&&end<=now&&now<=end+3600000?'recently-finished':null;}
  if(sport(e)==='golf'&&score(e).golf?.phase==='round-completed')return null;
  const state=liveState(e,now);if(state)return state==='playing'||unexpected(e)?'live':longPause(e,now)?'ongoing-not-in-play':state==='paused'?'paused':'awaiting-update';
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
  const priority=e=>unexpected(e)&&section(e,now)==='live'?0.5:({'live':0,'paused':1,'awaiting-update':2,'starting-soon':3,'recently-finished':4,'ongoing-not-in-play':5})[section(e,now)];
  return members.filter(e=>!suppressed.has(id(e))).sort((a,b)=>priority(a)-priority(b)||(final(a)&&final(b)?completion(b)-completion(a):(Date.parse(a.startTimeUtc||a.estimatedStartTimeUtc)||0)-(Date.parse(b.startTimeUtc||b.estimatedStartTimeUtc)||0))||id(a).localeCompare(id(b)));
 }
 function interval(e,now=Date.now()){if(unexpected(e))return 600000;if(e.score?.racing)return 240000;const restart=Date.parse(e.restartTimeUtc||'');return interrupted(e)&&!halftime(e)&&!(restart>=now-120000&&restart<=now+1800000)?1800000:120000;}
 function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
 function officialUrl(e){return safeUrl(e.sourceUrl||e.canonicalSourceUrl||e.officialUrl)||({nrl:'https://www.nrl.com/draw/',afl:'https://www.afl.com.au/fixture','rugby-union':'https://www.world.rugby/tournaments/fixtures-results'})[sport(e)]||null;}
 function scorecard(e){
  const supplied=safeUrl(e.officialScorecardUrl)||safeUrl(e.scorecardUrl);
  const ca=[id(e),...(e.sourceEventIds||[]),e.sourceFixtureId].map(value=>String(value||'').match(/^(?:fixture:cricket:)?CA:(\d+)$/)).find(Boolean);
  const caUrl=sport(e)==='cricket'&&ca?`https://www.cricket.com.au/matches/CA%3A${ca[1]}`:null;
  const url=supplied||caUrl;
  return {scorecardUrl:url,scorecardOfficial:Boolean(url&&(url===caUrl||e.sourceType==='official'))};
 }
 function racingSummary(r){
  const l=r.leader||r.entries?.[0],names=l?.drivers?.filter(name=>typeof name==='string').join(' / ')||l?.currentDriver;
  if(r.kind==='horse')return [['nominations','acceptances'].includes(r.phase)?'Early entries':r.statusText,r.entryCount+' entries',r.raceTime?'Race time '+r.raceTime:null].filter(Boolean).join(' · ');
  const laps=l?.laps??l?.[r.columns?.find(([label])=>/^laps$/i.test(label))?.[1]];
  return [l?.position!=null?'P'+l.position:null,names,laps!=null?'Lap '+laps+(r.totalLaps?' / '+r.totalLaps:''):null].filter(Boolean).join(' · ');
 }
 const label=value=>typeof value==='string'?value.slice(0,180):null;
 const count=value=>Number.isFinite(value)&&value>=0?value:null;
 function players(rows,kind){
  if(!Array.isArray(rows))return [];
  return rows.slice(0,30).filter(r=>r&&label(r.name||r.playerName||r.player?.name)).map(r=>({name:label(r.name||r.playerName||r.player?.name),
   ...(kind==='batting'?{runs:count(r.runs??r.runsScored),balls:count(r.balls??r.ballsFaced),fours:count(r.fours),sixes:count(r.sixes),strikeRate:count(r.strikeRate),notOut:r.notOut===true,didNotBat:r.didNotBat===true,dismissedBy:label(r.dismissedBy),dismissal:label(r.dismissal||r.dismissalText||r.howOut),bowledBy:label(r.bowledBy||r.bowler?.name)}:{overs:label(r.overs??r.oversBowled),maidens:count(r.maidens??r.maidensBowled),runs:count(r.runs??r.runsConceded),wickets:count(r.wickets??r.wicketsTaken),economy:count(r.economy),wides:count(r.wides??r.wideBalls),noBalls:count(r.noBalls)})}));
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
 function score(e,{racing=false}={}){
  if(sport(e)==='golf'&&(e.score?.golf||e.roundScores?.length))return {golf:e.score?.golf||{rows:e.roundScores,officialUrl:e.sourceUrl?.replace(/tee-times$/,'leaderboard')}};
  const detail=racingDetail(e);
  if(detail){const {entries,...summary}=detail;return {racing:{...summary,entryCount:entries?.length??summary.entryCount??0,leader:detail.kind==='horse'||detail.phase==='unavailable'?null:entries?.[0]||summary.leader||null,...(racing?{entries:entries||[]}:{})}};}
  // Official team-tennis reports store tie totals and winner-first set strings.
  // Parse only that explicit score field, never narrative or a title.
  if(sport(e)==='tennis'&&e.contestUnit==='tie'&&/^\d+[–-]\d+$/.test(e.score||'')){const [home,away]=e.score.split(/[–-]/).map(Number);return {home,away};}
  if(sport(e)==='tennis'&&e.contestUnit==='rubber'&&/^\d+[–-]\d+(?:\(\d+\))?(?:\s+\d+[–-]\d+(?:\(\d+\))?)*$/.test(e.score||''))return {sets:e.score.split(/\s+/).map(s=>{const [home,away]=s.split(/[–-]/).map(v=>parseInt(v,10));return {home,away};}),games:null};
  // Never parse a title or free-form commentary into a score, or reverse source sides.
  if(sport(e)==='tennis')return {sets:Array.isArray(e.sets)?e.sets.map(s=>({home:s.home??s.homeScore,away:s.away??s.awayScore,...(s.homeTiebreak!=null||s.awayTiebreak!=null?{homeTiebreak:s.homeTiebreak??null,awayTiebreak:s.awayTiebreak??null}:{})})):[],games:e.games?{home:e.games.home,away:e.games.away}:null,home:e.homeScore??null,away:e.awayScore??null};
  if(e.classification||e.fixtureResults?.rows)return {classification:(e.classification||e.fixtureResults.rows).slice(0,50)};
  if(sport(e)==='cricket')return {innings:Array.isArray(e.innings)?e.innings.slice(0,4).map(i=>{const participantId=i.participantId||(i.battingTeamId!=null?`team:cricket:ca-${i.battingTeamId}`:null);const p=(e.participants||[]).find(p=>p.id===participantId);return {participantId,team:i.team||p?.displayName||p?.name,runs:i.runs??i.runsScored,wickets:typeof i.wickets==='number'?i.wickets:i.wicketsCount??i.numberOfWicketsFallen,overs:i.overs??i.oversBowled,inningNumber:i.inningNumber??null,isDeclared:i.isDeclared===true,isFollowOn:i.isFollowOn===true,isForfeited:i.isForfeited===true,extras:i.extras||null,fallOfWickets:Array.isArray(i.wickets)?i.wickets:i.fallOfWickets||[],detailCheckedAt:i.detailCheckedAt||null,detailStale:i.detailStale===true||e.sourceStale===true,batting:players(i.batting||i.batsmen,'batting'),bowling:players(i.bowling||i.bowlers,'bowling')};}):[]};
  // Explicit flat values, including null, belong to their source observation.
  // Never combine a partial/cleared flat pair with older canonical slots.
  if(Object.hasOwn(e,'homeScore')||Object.hasOwn(e,'awayScore'))return {home:e.homeScore??null,away:e.awayScore??null};
  if(!final(e)&&!interrupted(e)&&!['live','in-progress','in_progress','ongoing','abandoned','cancelled','canceled'].includes(e.status))return {home:null,away:null};
  const pair=pairedScore(e);return {home:pair?Number(pair.home.score):null,away:pair?Number(pair.away.score):null};
 }
 function cricketBalance(e,innings){
  const value=label(e.cricketBalance);
  if(!value||!innings?.length)return value;
  // Only recognise a whole, score-only sentence for the identified current
  // batting side. Never turn narrative into a score or repair provider facts.
  const match=e.cricketBalance.trim().match(/^(.+?)\s+(?:(\d{1,2})[-–](\d+)|(\d+)\/(\d{1,2}))$/);
  if(!match||innings.some(i=>!Number.isSafeInteger(i.inningNumber))||new Set(innings.map(i=>i.inningNumber)).size!==innings.length)return value;
  const current=innings.reduce((a,b)=>b.inningNumber>a.inningNumber?b:a),participantId=current.participantId;
  if(!participantId||![current.runs,current.wickets].every(n=>Number.isSafeInteger(n)&&n>=0))return value;
  const fold=name=>String(name).trim().toLocaleLowerCase('en').replace(/\s+/g,' '),aliases=new Map();
  const add=(id,name)=>{if(!id||typeof name!=='string'||!name.trim())return;const key=fold(name),ids=aliases.get(key)||new Set();ids.add(id);aliases.set(key,ids);
   // The men's provider label has an explicit genderless form in its fixture
   // summary. Do not apply that shortening to an unconfirmed women's alias.
   if(e.gender==='men'&&/ Men$/i.test(name))add(id,name.replace(/ Men$/i,''));
  };
  for(const i of innings)add(i.participantId,i.team);
  for(const p of e.participants||[])for(const name of [p.name,p.displayName,...(Array.isArray(p.aliases)?p.aliases:[])])add(p.id||p.participantId,name);
  for(const slot of e.participantSlots||[])add(slot.participantId,slot.label);
  const ids=aliases.get(fold(match[1]));if(ids?.size!==1||!ids.has(participantId))return value;
  const runs=Number(match[3]??match[4]),wickets=Number(match[2]??match[5]);
  return runs!==current.runs||wickets!==current.wickets?null:value;
 }
 const consistentBalance=e=>(e.sport==='cricket'||sport(e)==='cricket')?{...e,cricketBalance:cricketBalance(e,e.score?.innings)}:e;
 // Day proof keeps its complete accepted identity through status-only receipts.
 const dayIdentityKeys=['sport','homeParticipantId','awayParticipantId','startTimeUtc','gender'];
 // Keep the independent score/status clocks through status-only receipts.
 function observation(prior,next){
  if(!prior)return consistentBalance(next);
  const stamp=x=>Date.parse(x.observationCheckedAt||x.statusCheckedAt||x.scoreCheckedAt||x.checkedAt||'');
  const settled=e=>final(e)||/^(abandoned|cancelled|canceled)$/.test(e.status||'');
  if(settled(prior)&&!settled(next)||Number.isFinite(stamp(prior))&&(!Number.isFinite(stamp(next))||stamp(next)<stamp(prior)))return consistentBalance({...prior,stale:true});
  const hasScore=s=>s&&(s.home!=null||s.away!=null||s.innings?.length||s.sets?.length||s.games||s.golf||s.racing||s.classification?.length);
  const sameIdentity=id(prior)&&id(prior)===id(next)&&['sport','homeParticipantId','awayParticipantId'].every(key=>prior[key]==null||next[key]==null||prior[key]===next[key]);
  if(sameIdentity&&Object.hasOwn(prior,'matchDay')&&dayIdentityKeys.every(k=>!Object.hasOwn(next,k)||next[k]===prior[k]||k==='startTimeUtc'&&Number.isFinite(Date.parse(prior[k]))&&Date.parse(next[k])===Date.parse(prior[k]))&&!Object.hasOwn(next,'matchDay'))next={...dayFields(prior),...Object.fromEntries(dayIdentityKeys.filter(k=>Object.hasOwn(prior,k)).map(k=>[k,prior[k]])),...next};
  const scoreAt=Date.parse(next.scoreCheckedAt||''),priorScoreAt=Date.parse(prior.scoreCheckedAt||'');
  const newerScoreReceipt=Number.isFinite(scoreAt)&&(!Number.isFinite(priorScoreAt)||scoreAt>priorScoreAt);
  // An interruption-only receipt cannot erase the last score or renew its
  // observation clock. Carry that specific retention across repeated resumed
  // play receipts; a new score receipt (including a clear) ends the chain.
  if(sameIdentity&&(unexpected(prior)||unexpected(next)||prior.interruptionScoreRetained===true)&&!hasScore(next.score)&&!newerScoreReceipt&&hasScore(prior.score))return consistentBalance({...next,score:prior.score,scoreCheckedAt:prior.scoreCheckedAt||null,checkedAt:prior.checkedAt||null,stale:true,interruptionScoreRetained:true});
  return consistentBalance({...next});
 }
 function dayFields(e){return Object.hasOwn(e,'matchDay')?{...Object.fromEntries(['matchDay','numberOfDays','matchDaySourceCheckedAt'].filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]])),matchDaySourceUrl:e.matchDaySourceUrl||null,...(!Object.hasOwn(e,'matchDaySourceCheckedAt')&&e.sourceCheckedAt?{matchDaySourceCheckedAt:e.sourceCheckedAt}:{})}:{};}
 function compact(e,{checkedAt=null,stale=false,rubbers=false,racing=false}={}){
  const value=score(e,{racing}),pair=pairedScore(e),hasScore=value.golf||value.racing||value.home!=null||value.away!=null||value.sets?.length||value.games||value.innings?.length;
  const observationCheckedAt=e.scoreCheckedAt||(!hasScore?e.statusCheckedAt:null)||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt||e.canonicalSourceCheckedAt)||null;
  return {...dayFields(e),...(sport(e)==='cricket'&&Object.hasOwn(e,'gender')?{gender:e.gender}:{}),court:e.court||null,tournamentId:e.tournamentId||e.tennisTournamentId||null,statusSourceType:e.statusSourceType||null,format:e.format||e.matchFormat||null,actualStartTimeUtc:e.actualStartTimeUtc||null,livePlayObservedAt:e.livePlayObservedAt||null,id:id(e),sport:sport(e),status:e.status||'scheduled',homeParticipantId:e.homeParticipantId||pair?.home.participantId||e.matchupSides?.[0]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[0]?.participantId||e.participantIds?.[0]:null)||null,awayParticipantId:e.awayParticipantId||pair?.away.participantId||e.matchupSides?.[1]?.players?.[0]?.id||(e.contestUnit==='tie'?e.participantSlots?.[1]?.participantId||e.participantIds?.[1]:null)||null,startTimeUtc:e.startTimeUtc||null,...(Object.hasOwn(e,'planningTimeEvidence')?{estimatedStartTimeUtc:e.estimatedStartTimeUtc||null,timePrecision:e.timePrecision,scheduleStatus:e.scheduleStatus,timeTbc:e.timeTbc,startTimeTbc:e.startTimeTbc===true,time:e.time,date:e.date,planningTimeEvidence:e.planningTimeEvidence}:{}),restartTimeUtc:e.restartTimeUtc||null,restartSourceUrl:e.restartSourceUrl||null,restartSourceCheckedAt:e.restartSourceCheckedAt||null,statusFactObservedAt:e.statusFactObservedAt||null,pauseObservation:e.pauseObservation||null,cricketBalance:cricketBalance(e,value.innings),completedAt:Number.isFinite(completion(e))?new Date(completion(e)).toISOString():null,scoreCheckedAt:e.scoreCheckedAt||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt)||null,statusCheckedAt:e.statusCheckedAt||(e.fixtureObservationSchema?null:checkedAt||e.sourceCheckedAt)||null,checkedAt:observationCheckedAt,stale:stale||e.stale===true||e.sourceStale===true||Boolean(e.fixtureObservationSchema&&hasScore&&!e.scoreCheckedAt),score:value,officialUrl:officialUrl(e),...scorecard(e),statusText:typeof e.statusText==='string'?e.statusText:null,clock:duration(e),incidents:(Array.isArray(e.incidents)?e.incidents:Array.isArray(e.goalScorers)?e.goalScorers:[]).filter(i=>i&&typeof i==='object').slice(0,40).map(i=>({name:i.name||i.playerName||i.scorer?.name||(typeof i.scorer==='string'?i.scorer:null),time:i.minute??i.elapsedMinute??i.time??i.clock??null,type:i.type||(Array.isArray(e.incidents)?null:'Goal'),addedTime:i.addedTime??i.stoppageTime??null,ownGoal:i.ownGoal===true,penalty:i.penalty===true,goalType:i.goalType||null,teamName:i.teamName||i.team?.name||null,disallowed:i.disallowed===true||i.isDisallowed===true||i.cancelled===true})),...(rubbers?{rubbers:(e.rubbers||[]).slice(0,10).map(r=>({id:id(r),name:r.sides?.length?r.sides.map(s=>s.names.join(' / ')).join(' v '):r.name||'',status:r.status,score:score({...r,key:'tennis'})}))}:{})};}
 function reviewedBathurstClassification(e){
  const results=e.fixtureResults,columns=results?.columns,rows=results?.rows;
  const url='https://www.supercars.com/results/2026/2026-bathurst-1000/R17';
  const stamp=Date.parse(results?.checkedAt||'');
  if(sport(e)!=='supercars'||id(e)!=='supercars-bathurst-1000-2026'||e.competitionId!=='competition:supercars'||e.date!=='2026-10-11'||!final(e)||e.resultStatus!=='official'||e.sourceType!=='official'||results?.schemaVersion!=='fixture-results.v1'||results.sourceUrl!==url||e.resultSourceUrl!==url||!Number.isFinite(stamp)||stamp>Date.now())return null;
  const labels=['Finish','No','Drivers','Team','Race time','Laps','Points'];
  if(!Array.isArray(columns)||columns.length!==labels.length||columns.some((label,i)=>label!==labels[i])||!Array.isArray(rows)||rows.length!==26||rows.some(row=>!Array.isArray(row)||row.length!==labels.length||row.some(value=>typeof value!=='string')))return null;
  const names=[];let unclassified=false,position=0;
  for(const row of rows){
   if(row[0]==='NC')unclassified=true;else if(unclassified||row[0]!==String(++position))return null;
   const drivers=row[2].split(' / ');names.push(...drivers);
   if(!/^\d{1,3}$/.test(row[1])||drivers.length!==2||drivers.some(name=>!name.trim())||!row[3].trim()||!/^\d+:\d{2}:\d{2}\.\d{3}$/.test(row[4])||!/^\d+$/.test(row[5])||Number(row[5])>161||!/^\+?\d+$/.test(row[6]))return null;
  }
  if(rows[0][0]!=='1'||rows[0][5]!=='161'||new Set(rows.map(row=>Number(row[1]))).size!==26||new Set(names).size!==52)return null;
  const entries=rows.map(row=>({id:'entry:'+Number(row[1]),number:row[1],drivers:row[2].split(' / '),position:row[0],...Object.fromEntries(row.map((value,i)=>['value'+i,value]))}));
  return {schema:'racing.v1',kind:'classification',eventId:id(e),sessionId:'R17',sessionName:'2026 Bathurst 1000 · Race 30',provider:'Supercars',officialUrl:url,providerAt:null,checkedAt:results.checkedAt,phase:'official-result',status:'completed',statusText:'Official classification',columns:columns.map((label,i)=>[label,'value'+i]),entries};
 }
 function racingDetail(e){
  const reviewed=reviewedBathurstClassification(e);if(reviewed)return reviewed;
  if(e.score?.racing?.schema==='racing.v1')return typeof module==='object'?require('./racing-details').sanitizeHorseDetail(e.score.racing,{horse:sport(e)==='horse-racing'}):e.score.racing;
  if(!/^(f1|supercars|motogp|wrc)$/.test(sport(e)))return null;
  const results=e.fixtureResults,columns=results?.columns,rows=results?.rows;
  const fallback={schema:'racing.v1',kind:'classification',eventId:id(e),sessionId:id(e),sessionName:e.name,provider:e.sourceName||'Official source',officialUrl:e.officialTimingUrl||(final(e)?safeUrl(e.resultSourceUrl):null)||({'f1':'https://www.formula1.com/en/timing/f1-live-lite','motogp':'https://www.motogp.com/en/gp-results','wrc':'https://www.wrc.com/en/results-and-standings','supercars':'https://www.supercars.com/live-timing'})[sport(e)],providerAt:null,checkedAt:null,phase:'unavailable',status:e.status,statusText:'Embedded timing unavailable',entries:[]};
  if(!Array.isArray(columns)||columns.length<3||columns.length>12||!Array.isArray(rows)||!rows.length||rows.length>100||rows.some(r=>!Array.isArray(r)||r.length!==columns.length))return fallback;
  // Only the reviewed 2026 F1 classification adapter is enabled here. Other
  // series keep their verified summary/link until their full-field contract passes.
  const stamp=Date.parse(results.checkedAt||e.scoreCheckedAt||''),url=safeUrl(results.sourceUrl),route=url?.match(/\/races\/\d+\/([^/]+)\/(.+)$/),circuit=String(e.circuitId||'').split(':').at(-1),session=/sprint.*(?:qualifying|shootout)/i.test(e.name)?'sprint-qualifying':/qualifying/i.test(e.name)?'qualifying':/practice\s*([123])/i.test(e.name)?'practice/'+e.name.match(/practice\s*([123])/i)[1]:/sprint/i.test(e.name)?'sprint-results':/race|grand prix/i.test(e.name)?'race-result':null;
  if(sport(e)!=='f1'||!url?.startsWith('https://www.formula1.com/en/results/2026/races/')||rows.length!==22||!Number.isFinite(stamp)||stamp>Date.now()||!final(e)||!(e.sourceUrl===results.sourceUrl||e.resultSourceUrl===results.sourceUrl||route&&route[1]===circuit&&route[2]===session))return fallback;
  const driver=columns.findIndex(c=>/^(driver|rider)$/i.test(c)),number=columns.findIndex(c=>/^(no\.?|number|car number)$/i.test(c));if(driver<0||number<0||rows.some(r=>!/^\d{1,3}$/.test(String(r[number]??''))||typeof r[driver]!=='string'||!r[driver].trim())||new Set(rows.map(r=>String(r[number]))).size!==rows.length)return fallback;
  const entries=rows.map(r=>({id:'entry:'+r[number],number:r[number],drivers:[r[driver]],position:r[0],...Object.fromEntries(r.map((v,i)=>['value'+i,v]))}));
  return {...fallback,officialUrl:safeUrl(results.sourceUrl)||fallback.officialUrl,checkedAt:results.checkedAt||e.scoreCheckedAt||null,phase:e.resultStatus==='official'?'official-result':'provisional-result',statusText:e.resultStatus==='official'?'Official classification':'Provisional classification',columns:columns.map((label,i)=>[label,'value'+i]),entries};
 }
 return {id,sport,final,interrupted,halftime,interruption,unexpected,interruptionPresentation,pausedLabel,supported,completion,observed,liveState,section,courtKey,conflicts,eligible,select,interval,compact,dayFields,observation,racingDetail,racingSummary};
});
