'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/mlb-postseason.v1.json';
const TEAM_IDS=new Set([108,109,110,111,112,113,114,115,116,117,118,119,120,121,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,158]);
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date(value));
const fail=message=>{throw Error('MLB postseason: '+message);};
function sourceUrl(now){const shift=n=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${shift(-7)}&endDate=${shift(14)}&hydrate=team`;}
function explicitUtc(value){
 const at=Date.parse(value);
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)||!Number.isFinite(at)||new Date(at).toISOString().slice(0,19)!==value.slice(0,19))fail('invalid postponement linkage clock');
 return at;
}
function postponedDr(game){
 if(game.status?.statusCode!=='DR')return false;
 if(game.status.codedGameState!=='D'||game.status.detailedState!=='Postponed')fail('contradictory postponed DR metadata');
 return true;
}
function uniqueScheduleGames(payload,universe){
 const groups=new Map(),admitted=g=>['F','D','L','W'].includes(g?.gameType)||(universe&&['R','S'].includes(g?.gameType));
 // Raw completeness is checked before any row can be coalesced.
 for(const date of payload.dates){
  if(!Array.isArray(date.games)||date.totalGames!==date.games.length)fail('incomplete date collection');
  for(const game of date.games){if(!game||typeof game!=='object'||Array.isArray(game))fail('invalid game record');const rows=groups.get(game.gamePk)||[];rows.push(game);groups.set(game.gamePk,rows);}
 }
 const selected=[];
 for(const rows of groups.values()){
  if(!rows.some(admitted))continue;
  if(rows.length===1){postponedDr(rows[0]);selected.push(rows[0]);continue;}
  if(rows.length!==2||!rows.every(admitted))fail('duplicate or invalid game identity');
  const priors=rows.filter(postponedDr);
  if(priors.length!==1)fail('duplicate game lacks one explicit postponed predecessor');
  const prior=priors[0],next=rows.find(row=>row!==prior);
  const sameTeams=['home','away'].every(role=>['id','name'].every(key=>prior.teams?.[role]?.team?.[key]===next.teams?.[role]?.team?.[key])&&prior.teams?.[role]?.team?.sport?.id===next.teams?.[role]?.team?.sport?.id&&prior.teams?.[role]?.team?.league?.id===next.teams?.[role]?.team?.league?.id);
  if(!Number.isSafeInteger(prior.gamePk)||prior.gamePk<=0||!sameTeams||typeof prior.gameGuid!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prior.gameGuid)||prior.gameGuid!==next.gameGuid||prior.gameType!==next.gameType||String(prior.season)!==String(next.season))fail('postponement successor identity mismatch');
  if(prior.rescheduledFrom!=null||next.rescheduleDate!=null||['home','away'].some(role=>prior.teams?.[role]?.score!=null))fail('contradictory postponed predecessor or successor');
  const oldTime=explicitUtc(prior.gameDate),newTime=explicitUtc(next.gameDate);
  if(explicitUtc(prior.rescheduleDate)!==newTime||explicitUtc(next.rescheduledFrom)!==oldTime||newTime<=oldTime)fail('nonreciprocal postponement successor linkage');
  if(!['F','O','I','S','P','PW','D','C','U'].includes(next.status?.statusCode))fail('unreviewed successor game state '+next.status?.statusCode);
  if(['F','O'].includes(next.status.statusCode)&&!['F','O'].includes(next.status.codedGameState))fail('contradictory successor final state');
  selected.push(next);
 }
 return selected;
}
function parse(payload,{checkedAt,now=new Date(),universe=false}={}){
 if(!Number.isFinite(Date.parse(checkedAt))||Date.parse(checkedAt)>+now||+now-Date.parse(checkedAt)>6*3600000||!Array.isArray(payload.dates)||!Number.isInteger(payload.totalGames)||payload.totalGames!==payload.dates.reduce((n,d)=>n+(d.games?.length||0),0))fail('incomplete or undated schedule');
 const seen=new Set(),fixtures=[],gaps=[];
 for(const game of uniqueScheduleGames(payload,universe)){
   if(!['F','D','L','W'].includes(game.gameType)&&!(universe&&['R','S'].includes(game.gameType)))continue;
   if(!Number.isSafeInteger(game.gamePk)||seen.has(game.gamePk))fail('duplicate or invalid game identity');seen.add(game.gamePk);
   if(!Number.isFinite(Date.parse(game.gameDate))||String(game.season)!==String(new Date(now).getUTCFullYear()))fail('invalid edition or clock');
   const teams=['home','away'].map(role=>game.teams?.[role]?.team);
   if(teams.some(team=>!TEAM_IDS.has(team?.id))){gaps.push({id:game.gamePk,reason:'Participants not assigned'});continue;}
   if(teams.some(team=>!team.name||team.sport?.id!==1||![103,104].includes(team.league?.id)))fail('unknown team metadata');
   const states={F:'completed',O:'completed',I:'live',S:'upcoming',P:'upcoming',PW:'upcoming',D:'postponed',DR:'postponed',C:'cancelled',U:'suspended'};
   const status=states[game.status?.statusCode];if(!status)fail('unreviewed game state '+game.status?.statusCode);
   const scored=['completed','live'].includes(status),scores=['home','away'].map(role=>game.teams[role].score);
   if(scored&&scores.some(score=>!Number.isSafeInteger(score)||score<0))fail('missing paired score');
   if(scored&&Date.parse(game.gameDate)>Date.parse(checkedAt))fail('play observed before kickoff');
   const conditional=game.ifNecessary===true||game.ifNecessary==='Y';
   const id='fixture:mlb:'+game.gamePk,start=game.status.startTimeTBD!==true&&!conditional?new Date(game.gameDate).toISOString():null;
   const local=start?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(start)):null;
   const participants=teams.map(team=>({id:'team:mlb:'+team.id,name:team.name,displayName:team.name,entityType:'team',type:'team',sportDomainId:'sport:baseball',competitionId:'competition:mlb',countryCode:team.id===141?'CA':'US',logoUrl:`https://www.mlbstatic.com/team-logos/${team.id}.svg`}));
   if(status==='completed'&&scores[0]===scores[1])fail('tied final cannot establish a completed MLB game');
   const title=teams.map(team=>team.name).join(' v '),competitionName=game.gameType==='R'?'MLB regular season':game.gameType==='S'?'MLB spring training':'MLB postseason',roundLabel=String(game.description||competitionName),url=`https://www.mlb.com/gameday/${game.gamePk}`;
   const safe=status==='completed'?`${roundLabel} is complete. Reveal results for the outcome.`:`${roundLabel} at ${game.venue?.name||'the published venue'}. Check the official game page for updates.`;
   fixtures.push({id,eventId:id,canonicalEventId:id,key:'baseball',sportDomainId:'sport:baseball',competitionId:'competition:mlb',competitionName,gender:'men',broadcaster:'Australian viewing unconfirmed',liveWindow:6,season:Number(game.season),name:title,roundLabel,stage:roundLabel,date:day(game.gameDate),time:local,startTimeUtc:start,timePrecision:start?'exact':'tbc',scheduleStatus:start?'confirmed':conditional?'conditional':'tbc',status,venue:game.venue?.name||null,cardKind:'fixture',kind:'fixture',participantsConfirmed:true,participants,participantIds:participants.map(p=>p.id),homeParticipantId:participants[0].id,awayParticipantId:participants[1].id,participantSlots:participants.map((p,i)=>({participantId:p.id,label:p.name,logoUrl:p.logoUrl,homeAway:i?'away':'home',...(scored?{score:scores[i]}:{})})),sourceName:'MLB',sourceType:'official',sourceUrl:url,sourceRefs:[url,sourceUrl(now)],sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,statusFactObservedAt:checkedAt,...(scored?{score:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,...(status==='completed'?{resultStatus:'official',outcomeText:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,recapText:`${roundLabel}: ${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}. MLB reports this game as final.`,winnerParticipantId:participants[scores[0]>scores[1]?0:1].id}:{}),homeScore:scores[0],awayScore:scores[1],scoreCheckedAt:checkedAt,scoreFactObservedAt:checkedAt,resultSourceUrl:url,resultSourceCheckedAt:checkedAt}:{}),selectedSentence:safe,fullSpiel:safe,lastReviewedAt:checkedAt,stakesScore:4,storyline:{stakes:4,intensity:4,arcStage:status==='completed'?'recap':'preview',hookSpoilerOff:safe,synopsisSpoilerOff:safe,hookSpoilerOn:safe,synopsisSpoilerOn:safe,...(status==='completed'?{hookSpoilerOn:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,synopsisSpoilerOn:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`}:{})}});
 }
 return {fixtures,gaps};
}
const factKeys=['name','roundLabel','stage','date','time','startTimeUtc','timePrecision','scheduleStatus','status','venue','participantIds','participantSlots','score','homeScore','awayScore','resultStatus','outcomeText','recapText','winnerParticipantId'];
function retainedClock(row,key,observedAt){
 const value=row[key];
 if(value==null||value==='')return value;
 const at=Date.parse(value);
 const calendar=typeof value==='string'?value.slice(0,10):'',midnight=Date.parse(calendar+'T00:00:00Z');
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(at)||!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==calendar||at>Date.parse(observedAt))fail('invalid retained '+key);
 return value;
}
function preserveObservation(target,old,factKey,receiptKeys,observedAt,retainReceipts=true){
 for(const key of receiptKeys)if(Object.hasOwn(old,key)){const value=retainedClock(old,key,observedAt);if(retainReceipts)target[key]=value;}
 // An explicit unknown stays unknown. Only its own prior receipt can supply a
 // missing fact observation; a general source/review check cannot supply it.
 if(Object.hasOwn(old,factKey))target[factKey]=retainedClock(old,factKey,observedAt);
 else{const key=receiptKeys.find(key=>old[key]!=null&&old[key]!=='');if(key)target[factKey]=retainedClock(old,key,observedAt);}
}
function merge(previous,updates){
 const retained=new Map(previous.map(f=>[f.id,f]));
 for(const next of updates){
  const old=retained.get(next.id);
  if(!old){retained.set(next.id,next);continue;}
  if(JSON.stringify(old.participantIds)!==JSON.stringify(next.participantIds))fail('participant identity changed');
  if(old.season!==next.season||old.competitionId!==next.competitionId)fail('fixture edition changed');
  if(old.status==='completed'&&next.status!=='completed')fail('completed fixture regressed');
  const unchanged=factKeys.every(key=>JSON.stringify(old[key])===JSON.stringify(next[key]))&&next.status!=='live';
  let merged=unchanged?{...old,selectedSentence:next.selectedSentence,fullSpiel:next.fullSpiel,broadcaster:next.broadcaster,storyline:next.storyline,lastReviewedAt:old.lastReviewedAt||old.sourceCheckedAt}:{...next};
  // New fixture facts keep their actual source receipt. Unchanged checks are
  // recorded in the refresh report, without rewriting accepted fixture bytes.
  if(!unchanged){merged.sourceCheckedAt=next.sourceCheckedAt;merged.sourceRefs=next.sourceRefs;}
  const sameSource=old.sourceName==='MLB'&&next.sourceName==='MLB'&&old.sourceType==='official'&&next.sourceType==='official'&&old.sourceUrl===next.sourceUrl&&old.sourceUrl==='https://www.mlb.com/gameday/'+next.id.replace('fixture:mlb:','');
  if(!sameSource)merged={...next};
  if(sameSource){
   const sameStatus=old.status===next.status;
   const paired=row=>Number.isSafeInteger(row.homeScore)&&row.homeScore>=0&&Number.isSafeInteger(row.awayScore)&&row.awayScore>=0;
   const sameScore=['completed','live'].includes(old.status)&&['completed','live'].includes(next.status)&&paired(old)&&paired(next)&&old.homeScore===next.homeScore&&old.awayScore===next.awayScore&&(old.winnerParticipantId==null||old.winnerParticipantId===next.winnerParticipantId)&&(old.resultSourceUrl==null||old.resultSourceUrl===next.resultSourceUrl);
   if(sameScore)preserveObservation(merged,old,'scoreFactObservedAt',['scoreCheckedAt','resultSourceCheckedAt'],next.sourceCheckedAt,next.status!=='live');
   if(sameStatus){
    preserveObservation(merged,old,'statusFactObservedAt',['statusCheckedAt'],next.sourceCheckedAt,next.status!=='live');
    for(const key of ['statusSourceUrl','statusSourceName','statusSourceType'])if(old[key]!==undefined&&next[key]===undefined)merged[key]=old[key];
   }
   if(old.status==='completed'&&next.status==='completed'&&old.firstConfirmedCompleteAt!=null&&old.firstConfirmedCompleteAt!==''){
    const prior=retainedClock(old,'firstConfirmedCompleteAt',next.sourceCheckedAt),current=retainedClock(next,'firstConfirmedCompleteAt',next.sourceCheckedAt);
    merged.firstConfirmedCompleteAt=current&&Date.parse(current)<Date.parse(prior)?current:prior;
   }
   if(old.status==='completed'&&next.status==='completed')for(const key of ['actualEndTimeUtc','completedAt'])if(old[key]!=null&&!Object.hasOwn(next,key))merged[key]=retainedClock(old,key,next.sourceCheckedAt);
  }
  retained.set(next.id,merged);
 }
 return [...retained.values()];
}
async function refresh({now=new Date(),fetchImpl=globalThis.fetch,root=ROOT}={}){
 const url=sourceUrl(now),response=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)fail('source returned '+response.status);
 const parsed=parse(await response.json(),{checkedAt:now.toISOString(),now}),file=path.join(root,FILE),previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {schemaVersion:'mlb-postseason.v1',fixtures:[]};
 const fixtures=merge(previous.fixtures,parsed.fixtures),changed=JSON.stringify(fixtures)!==JSON.stringify(previous.fixtures);
 const writes=[];
 for(const target of ['feeds/incoming/events.json','data/events.json']){
  const p=path.join(root,target),document=JSON.parse(fs.readFileSync(p));
  const merged=require('./fixture-snapshot').mergeFixtureSnapshot(document.events,fixtures).events;
  const issues=require('../scripts/lib/feed-utils').validateFeed({...document,events:merged});if(issues.length)fail(issues[0]);
  if(JSON.stringify(merged)!==JSON.stringify(document.events))writes.push([p,JSON.stringify({...document,events:merged},null,2)+'\n']);
 }
 if(changed)writes.push([file,JSON.stringify({...previous,checkedAt:now.toISOString(),sourceUrl:url,fixtures},null,2)+'\n']);
 for(const [p,bytes] of writes){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);}

 return {changed:changed||writes.length>0,fixtures:fixtures.length,gaps:parsed.gaps,sourceRequests:1,checkedAt:now.toISOString()};
}
module.exports={sourceUrl,parse,merge,refresh};
