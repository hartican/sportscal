'use strict';
const fs=require('node:fs');
const SEASON=2026;
const resources=()=>[SEASON,SEASON+1].map(year=>({year,url:`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&limit=1000`}));
const nflDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
// Carry the evening playing date through the overnight final update window.
const recentResource=now=>{const day=nflDay(new Date(+new Date(now)-8*3600000));return {day,url:`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${day.replace(/-/g,'')}&limit=1000`};};
const fail=message=>{throw Error('NFL fixtures: '+message);};
function observation(value,now){
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value||Date.parse(value)>+now||+now-Date.parse(value)>6*3600000)fail('invalid or stale observation');
}
function kickoff(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value.slice(0,10))fail('invalid kickoff');
 return value;
}
function score(value){
 if(value&&typeof value==='object')value=value.displayValue;
 if(!['number','string'].includes(typeof value)||typeof value==='string'&&!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<0||Number(value)>200)fail('invalid score');
 return Number(value);
}
function localParts(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).reduce((o,p)=>(o[p.type]=p.value,o),{});}
function fixture(event,{teamIds,checkedAt,now,roundLabel}){
 if(!/^\d{9}$/.test(event.id||'')||event.season?.year!==SEASON||![1,2].includes(event.season?.type)||event.competitions?.length!==1)fail('invalid current-season identity');
 const c=event.competitions[0],date=kickoff(event.date),p=localParts(date),type=event.status?.type;
 if(String(c.id)!==String(event.id)||kickoff(c.date)!==date||c.competitors?.length!==2||!Number.isInteger(event.week?.number)||event.week.number<1||event.week.number>(event.season.type===2?18:4))fail('invalid fixture structure');
 const states={STATUS_SCHEDULED:['pre',false,'upcoming'],STATUS_IN_PROGRESS:['in',false,'live'],STATUS_HALFTIME:['in',false,'live'],STATUS_FINAL:['post',true,'completed']},state=states[type?.name];
 if(!state||type.state!==state[0]||type.completed!==state[1]||c.status?.type?.name!==type.name||c.status.type.state!==type.state||c.status.type.completed!==type.completed)fail('unknown or conflicting source status');
 const status=state[2],scored=status!=='upcoming';
 if(scored&&Date.parse(date)>Date.parse(checkedAt))fail('observed play before kickoff');
 if(typeof c.timeValid!=='boolean'||event.timeValid!=null&&typeof event.timeValid!=='boolean')fail('missing kickoff precision');
 const provisional=c.timeValid===false||event.timeValid===false,seen=new Set(),roles=new Set();
 const participantSlots=c.competitors.map(side=>{
  const id='team:nfl:'+String(side.team?.abbreviation||'').toLowerCase();
  if(!teamIds.has(id)||seen.has(id)||!['home','away'].includes(side.homeAway)||roles.has(side.homeAway)||!side.team?.displayName)fail('unknown or ambiguous participants');
  seen.add(id);roles.add(side.homeAway);
  return {participantId:id,label:side.team.displayName,homeAway:side.homeAway,...(scored?{score:score(side.score)}:{}),logoUrl:side.team.logos?.find(l=>l.rel?.includes('default'))?.href||side.team.logo||null};
 });
 const sourceUrl=`https://www.espn.com/nfl/game/_/gameId/${event.id}`;
 return {id:'fixture:nfl:'+event.id,sportDomainId:'sport:american-football',competitionId:'competition:nfl',name:event.name||event.shortName||fail('missing match name'),date:`${p.year}-${p.month}-${p.day}`,time:provisional?null:`${p.hour}:${p.minute}`,startTimeUtc:provisional?null:date,...(provisional?{estimatedStartTimeUtc:date,timeTbc:true,timePrecision:'tbc',scheduleNote:'Provisional planning date; kickoff is still to be scheduled.'}:{timePrecision:'exact'}),venue:c.venue?.fullName||null,status,scheduleStatus:provisional?'provisional':'confirmed',roundLabel,roundNumber:event.week.number,season:SEASON,seasonType:event.season.type,participantSlots,sourceUrl,sourceName:'ESPN',sourceType:'publisher-schedule',sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,statusSourceUrl:sourceUrl,statusSourceName:'ESPN',statusSourceType:'publisher-schedule',...(status==='completed'?{resultLabels:type.detail==='Final/OT'?['After overtime']:[]}:{}),...(scored?{scoreCheckedAt:checkedAt,resultSourceCheckedAt:checkedAt,resultSourceUrl:sourceUrl}:{})};
}
function parse(responses,{teams,now=new Date()}={}){
 const teamIds=new Set(teams.map(t=>t.id));if(teamIds.size!==32||responses.length!==2)fail('incomplete known league');
 const seen=new Set(),rows=[],calendar=responses[0]?.payload?.leagues?.[0]?.calendar;
 if(!Array.isArray(calendar))fail('missing season calendar labels');
 for(const {payload,observedAt}of responses){
  observation(observedAt,now);
  if(payload?.leagues?.length!==1||payload.leagues[0].id!=='28'||payload.leagues[0].slug!=='nfl'||!Array.isArray(payload.events)||payload.events.length>400)fail('invalid calendar response');
  for(const event of payload.events){
   if(event.season?.year!==SEASON||![1,2].includes(event.season?.type))continue;
   if(seen.has(event.id))fail('duplicate fixture');seen.add(event.id);const phase=calendar.find(g=>String(g.value)===String(event.season.type)),roundLabel=phase?.entries?.find(w=>String(w.value)===String(event.week?.number))?.label;
   if(typeof roundLabel!=='string'||!roundLabel.trim())fail('missing source round label');
   rows.push(fixture(event,{teamIds,checkedAt:observedAt,now,roundLabel}));
  }
 }
 const regular=rows.filter(r=>r.seasonType===2),pre=rows.filter(r=>r.seasonType===1),counts=new Map(),weeks=new Set();
 for(const r of regular){weeks.add(r.roundNumber);for(const s of r.participantSlots)counts.set(s.participantId,(counts.get(s.participantId)||0)+1);}
 if(regular.length!==272||pre.length!==49||weeks.size!==18||counts.size!==32||[...counts.values()].some(n=>n!==17))fail('incomplete current preseason/regular season');
 return rows;
}
function applyRecent(rows,response,{teams,now=new Date(),previousFixtures=[]}={}){
 observation(response.observedAt,now);
 const day=recentResource(now).day,payload=response.payload;
 if(response.day!==day||payload?.leagues?.length!==1||payload.leagues[0].id!=='28'||!Array.isArray(payload.events)||payload.events.length>16)fail('invalid recent-day response');
 const byId=new Map(rows.map(f=>[f.id,f])),seen=new Set(),updates=new Map(),teamIds=new Set(teams.map(t=>t.id));
 for(const event of payload.events){
  const id='fixture:nfl:'+event.id,known=byId.get(id);
  if(!known||seen.has(id)||nflDay(event.date)!==day)fail('unknown, duplicate or wrong-day recent fixture');seen.add(id);
  const current=fixture(event,{teamIds,checkedAt:response.observedAt,now,roundLabel:known.roundLabel});
  if(current.roundNumber!==known.roundNumber||current.seasonType!==known.seasonType)fail('recent edition or round conflict');
  updates.set(id,current);
 }
 if(rows.some(f=>nflDay(f.startTimeUtc||f.estimatedStartTimeUtc)===day&&!seen.has(f.id)))fail('incomplete recent-day fixtures');
 const retained=new Map(previousFixtures.map(f=>[f.id,f]));
 return rows.map(f=>{
  if(updates.has(f.id))return updates.get(f.id);
  const old=retained.get(f.id);
  if(old&&(['live','completed'].includes(old.status)&&f.status==='upcoming'||old.status==='live'&&f.status==='live'&&JSON.stringify(old.participantSlots.map(s=>s.score))===JSON.stringify(f.participantSlots.map(s=>s.score))))return old;
  return f;
 });
}
const DATE_KEYS=new Set(['sourceCheckedAt','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt']);
const meaning=v=>JSON.stringify(v,(k,x)=>DATE_KEYS.has(k)?undefined:x);
const scheduleMeaning=f=>JSON.stringify(['date','time','startTimeUtc','estimatedStartTimeUtc','venue','scheduleStatus','timePrecision','timeTbc','scheduleNote','sourceUrl'].map(k=>f?.[k]));
const resultMeaning=f=>JSON.stringify([f.status,f.participantSlots.map(s=>[s.participantId,s.score]),f.resultSourceUrl,f.resultLabels||[]]);
function merge(previous,fixtures){
 const oldById=new Map(previous.fixtures.map(f=>[f.id,f])),updates=new Map();
 for(const row of fixtures){
  const old=oldById.get(row.id);if(!old){updates.set(row.id,row);continue;}
  if(JSON.stringify(old.participantSlots.map(s=>[s.participantId,s.homeAway]))!==JSON.stringify(row.participantSlots.map(s=>[s.participantId,s.homeAway])))fail('published participant identity changed');
  if(old.status==='completed'&&row.status!=='completed'||old.status==='live'&&row.status==='upcoming')fail('cannot regress observed play');
  // Retain destinations and original source URL while adding genuine fact clocks.
  let next={...old,...row,sourceUrl:old.sourceUrl||row.sourceUrl};
  next.statusSourceUrl=next.sourceUrl;if(row.status!=='upcoming')next.resultSourceUrl=next.sourceUrl;
  if(row.scheduleStatus==='confirmed')for(const k of ['estimatedStartTimeUtc','timeTbc','scheduleNote'])delete next[k];
  if(row.status==='upcoming')for(const k of ['resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt'])delete next[k];
  const prior=Math.max(...[...DATE_KEYS].map(k=>Date.parse(old[k])).filter(Number.isFinite)),receipt=Date.parse(row.sourceCheckedAt),freshLive=row.status==='live'&&receipt>(Date.parse(old.statusCheckedAt)||0);
  if((meaning(old)!==meaning(next)||freshLive)&&Number.isFinite(prior)&&receipt<=prior)fail('stale or conflicting observation');
  if(scheduleMeaning(old)===scheduleMeaning(next)&&old.sourceCheckedAt)next.sourceCheckedAt=old.sourceCheckedAt;
  if(old.status===next.status&&old.statusCheckedAt&&!freshLive)next.statusCheckedAt=old.statusCheckedAt;
  if(resultMeaning(old)===resultMeaning(next)&&old.resultSourceCheckedAt&&!freshLive){next.resultSourceCheckedAt=old.resultSourceCheckedAt;next.scoreCheckedAt=old.scoreCheckedAt;}
  if(meaning(old)===meaning(next)&&!freshLive)next=old;
  updates.set(row.id,next);
 }
 if(previous.fixtures.some(f=>f.season===SEASON&&[1,2].includes(f.seasonType)&&!updates.has(f.id)))fail('published current-season fixture disappeared');
 return {...previous,fixtures:[...previous.fixtures.map(f=>updates.get(f.id)||f),...fixtures.filter(f=>!oldById.has(f.id))]};
}
async function refreshFile({filePath,fetchJson,clock=()=>new Date()}={}){
 const previous=JSON.parse(fs.readFileSync(filePath,'utf8')),responses=[];
 for(const route of resources()){const payload=await fetchJson(route.url);responses.push({payload,observedAt:clock().toISOString()});}
 const parsed=parse(responses,{teams:previous.teams,now:clock()}),route=recentResource(clock()),payload=await fetchJson(route.url),observedAt=clock().toISOString();
 const fixtures=applyRecent(parsed,{...route,payload,observedAt},{teams:previous.teams,now:clock(),previousFixtures:previous.fixtures}),next=merge(previous,fixtures);
 next.standings=require('./nfl-standings').withResultCoverage(next.standings||[],next.fixtures);
 const changed=JSON.stringify(next)!==JSON.stringify(previous);
 if(changed)fs.writeFileSync(filePath,JSON.stringify(next,null,2)+'\n');
 return {changed,checkedAt:observedAt,sourceRequests:3,recentDay:route.day,fixtures:fixtures.length,regularFixtures:272,preseasonFixtures:49,liveObservations:fixtures.filter(f=>f.status==='live').length,finals:fixtures.filter(f=>f.status==='completed').length,provisional:fixtures.filter(f=>f.scheduleStatus==='provisional').length};
}
function projectionCurrent(directory,{inspector,schedule}){
 return [inspector,schedule].every(doc=>directory.fixtures.every(f=>{
  const projected=doc?.fixtures?.find(r=>r.id===f.id||r.sourceEventIds?.includes(f.id));
  return projected&&['status','sourceCheckedAt','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt','timeTbc'].every(k=>(projected[k]??null)===(f[k]??null))&&(projected.startTimeUtc==null&&f.startTimeUtc==null||Date.parse(projected.startTimeUtc)===Date.parse(f.startTimeUtc))&&(!f.timePrecision||projected.timePrecision===f.timePrecision)&&JSON.stringify(projected.participantSlots?.map(s=>[s.participantId,s.score==null?null:Number(s.score)]))===JSON.stringify(f.participantSlots.map(s=>[s.participantId,s.score==null?null:Number(s.score)]));
 }));
}
module.exports={SEASON,resources,recentResource,applyRecent,fixture,parse,merge,refreshFile,projectionCurrent,meaning};
