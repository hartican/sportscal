'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/mlb-postseason.v1.json';
const TEAM_IDS=new Set([108,109,110,111,112,113,114,115,116,117,118,119,120,121,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,158]);
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date(value));
const fail=message=>{throw Error('MLB postseason: '+message);};
function sourceUrl(now){const shift=n=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};return `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${shift(-7)}&endDate=${shift(14)}&hydrate=team`;}
function parse(payload,{checkedAt,now=new Date(),universe=false}={}){
 if(!Number.isFinite(Date.parse(checkedAt))||Date.parse(checkedAt)>+now||+now-Date.parse(checkedAt)>6*3600000||!Array.isArray(payload.dates)||!Number.isInteger(payload.totalGames)||payload.totalGames!==payload.dates.reduce((n,d)=>n+(d.games?.length||0),0))fail('incomplete or undated schedule');
 const seen=new Set(),fixtures=[],gaps=[];
 for(const date of payload.dates){
  if(!Array.isArray(date.games)||date.totalGames!==date.games.length)fail('incomplete date collection');
  for(const game of date.games){
   if(!['F','D','L','W'].includes(game.gameType)&&!(universe&&['R','S'].includes(game.gameType)))continue;
   if(!Number.isSafeInteger(game.gamePk)||seen.has(game.gamePk))fail('duplicate or invalid game identity');seen.add(game.gamePk);
   if(!Number.isFinite(Date.parse(game.gameDate))||String(game.season)!==String(new Date(now).getUTCFullYear()))fail('invalid edition or clock');
   const teams=['home','away'].map(role=>game.teams?.[role]?.team);
   if(teams.some(team=>!TEAM_IDS.has(team?.id))){gaps.push({id:game.gamePk,reason:'Participants not assigned'});continue;}
   if(teams.some(team=>!team.name||team.sport?.id!==1||![103,104].includes(team.league?.id)))fail('unknown team metadata');
   const states={F:'completed',O:'completed',I:'live',S:'upcoming',P:'upcoming',PW:'upcoming',D:'postponed',C:'cancelled',U:'suspended'};
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
   fixtures.push({id,eventId:id,canonicalEventId:id,key:'baseball',sportDomainId:'sport:baseball',competitionId:'competition:mlb',competitionName,gender:'men',broadcaster:'Australian viewing unconfirmed',liveWindow:6,season:Number(game.season),name:title,roundLabel,stage:roundLabel,date:day(game.gameDate),time:local,startTimeUtc:start,timePrecision:start?'exact':'tbc',scheduleStatus:start?'confirmed':conditional?'conditional':'tbc',status,venue:game.venue?.name||null,cardKind:'fixture',kind:'fixture',participantsConfirmed:true,participants,participantIds:participants.map(p=>p.id),homeParticipantId:participants[0].id,awayParticipantId:participants[1].id,participantSlots:participants.map((p,i)=>({participantId:p.id,label:p.name,logoUrl:p.logoUrl,homeAway:i?'away':'home',...(scored?{score:scores[i]}:{})})),sourceName:'MLB',sourceType:'official',sourceUrl:url,sourceRefs:[url,sourceUrl(now)],sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,...(scored?{score:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,...(status==='completed'?{resultStatus:'official',outcomeText:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,recapText:`${roundLabel}: ${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}. MLB reports this game as final.`,winnerParticipantId:participants[scores[0]>scores[1]?0:1].id}:{}),homeScore:scores[0],awayScore:scores[1],scoreCheckedAt:checkedAt,resultSourceUrl:url,resultSourceCheckedAt:checkedAt}:{}),selectedSentence:safe,fullSpiel:safe,lastReviewedAt:checkedAt,stakesScore:4,storyline:{stakes:4,intensity:4,arcStage:status==='completed'?'recap':'preview',hookSpoilerOff:safe,synopsisSpoilerOff:safe,hookSpoilerOn:safe,synopsisSpoilerOn:safe,...(status==='completed'?{hookSpoilerOn:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`,synopsisSpoilerOn:`${teams[0].name} ${scores[0]}–${scores[1]} ${teams[1].name}`}:{})}});
  }
 }
 return {fixtures,gaps};
}
const factKeys=['name','roundLabel','stage','date','time','startTimeUtc','timePrecision','scheduleStatus','status','venue','participantIds','participantSlots','score','homeScore','awayScore','resultStatus','outcomeText','recapText','winnerParticipantId'];
function merge(previous,updates){
 const retained=new Map(previous.map(f=>[f.id,f]));
 for(const next of updates){const old=retained.get(next.id);if(old){if(JSON.stringify(old.participantIds)!==JSON.stringify(next.participantIds))fail('participant identity changed');if(old.status==='completed'&&next.status!=='completed')fail('completed fixture regressed');if(factKeys.every(key=>JSON.stringify(old[key])===JSON.stringify(next[key]))&&next.status!=='live'){retained.set(next.id,{...old,selectedSentence:next.selectedSentence,fullSpiel:next.fullSpiel,broadcaster:next.broadcaster,storyline:next.storyline,lastReviewedAt:old.lastReviewedAt||old.sourceCheckedAt});continue;}}retained.set(next.id,next);}
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
