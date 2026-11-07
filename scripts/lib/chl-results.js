'use strict';
// Shared facts boundary below the full and quick canonical refresh owners.
const fs=require('node:fs');
const SEASON='2026/27',SEASON_ID='fc954f6d33272fdf4a8b95bb';
const PAGE_URL='https://www.chl.hockey/en/schedule';
const PLACEHOLDERS=new Set(['team:chl:fd005d24de9d6485e82a33b7','team:chl:3f421e7347de6c0aa68a5b65']);
const teamId=team=>`team:chl:${team?._entityId||''}`;
const fail=message=>{throw Error(`CHL: ${message}`);};
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))fail('invalid source timestamp');
 return value;
}
function observation(checkedAt,now=new Date()){instant(checkedAt);if(Date.parse(checkedAt)>+now)fail('future observation');return checkedAt;}
function discover(html){
 const id=html.match(/"currentSeason":\{"_entityId":"([a-f0-9]+)"/)?.[1],name=html.match(/"currentSeason":\{[^}]*"name":"([^"]+)"/)?.[1];
 if(id!==SEASON_ID||name!==SEASON)fail('unreviewed or missing current season');
 const urls=[...new Set([...html.matchAll(/https:\/\/www\.chl\.hockey\/api\/s3\?q=(schedule-[^'"\\]+\.json)/g)].map(m=>`https://www.chl.hockey/api/s3?q=${m[1]}`).filter(url=>url.includes(id)))];
 if(urls.length!==1)fail('expected the reviewed complete season schedule feed');
 const file=new URL(urls[0]).searchParams.get('q'),prefix=file.slice(9,-`.json`.length-id.length-1);
 if(!/^[a-f0-9]+$/.test(prefix))fail('invalid schedule resource');
 return {seasonId:id,seasonName:name,scheduleUrl:urls[0],teamsUrl:`https://www.chl.hockey/api/s3?q=teams-${prefix}-${id}.json`,recordsUrl:`https://www.chl.hockey/api/s3?q=teams-stats-${prefix}-${id}.json`};
}
function collection(payload){if(!Array.isArray(payload?.data)||!Array.isArray(payload.errors)||payload.errors.length)fail('incomplete or failed collection');return payload.data;}
function knownTeams(teams){const ids=new Set(teams.map(t=>t.id));if(ids.size!==24||[...ids].some(id=>!/^team:chl:[a-f0-9]{24}$/.test(id)||PLACEHOLDERS.has(id)))fail('expected 24 distinct known clubs');return ids;}
function sydney(value){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};}
function parseFixture(match,{teamIds,checkedAt}={}){
 if(!/^[a-f0-9]{24}$/.test(match?._entityId||''))fail('missing match identity');
 instant(match.startDate);
 if(!/^2026-(?:09|10|11|12)-|^2027-(?:01|02)-/.test(match.startDate))fail('match outside reviewed season window');
 if(!['finished','not-started'].includes(match.status)||typeof match.startDateNotConfirmed!=='boolean')fail('unreviewed status or schedule certainty');
 const home=match.teams?.home,away=match.teams?.away,homeId=teamId(home),awayId=teamId(away);
 if(homeId===awayId||!home?.name||!away?.name||!match.stage?.group?.name||!match.stage?.round?.name)fail('invalid teams or stage');
 const calendar=PLACEHOLDERS.has(homeId)&&PLACEHOLDERS.has(awayId)&&home.name==='TBA'&&away.name==='TBA';
 if(!calendar&&(!teamIds?.has(homeId)||!teamIds?.has(awayId)))fail('unknown participant');
 if(calendar&&(match.status!=='not-started'||match.startDateNotConfirmed!==true||match.stage.group.name==='Regular Season'))fail('invalid programme placeholder');
 const completed=match.status==='finished';
 const scores=match.results?.scores;
 if(completed&&Date.parse(match.startDate)>Date.parse(checkedAt))fail('future final observation');
 if(completed&&(!scores||['home','away'].some(s=>!Number.isInteger(scores[s])||scores[s]<0)||scores.home===scores.away))fail('invalid paired final scores');
 if(completed&&!['Fulltime','Fulltime/Overtime','Fulltime/Shootout'].includes(match.state?.name))fail('unreviewed final qualifier');
 if(!/^\/matches\/[a-f0-9]{24}\//.test(match.link?.url||'')||!match.link.url.startsWith(`/matches/${match._entityId}/`))fail('invalid source match link');
 const sourceUrl=`https://www.chl.hockey/en${match.link.url}`;
 const local=sydney(match.startDate),resultLabels=completed&&match.state.name!=='Fulltime'?[match.state.name==='Fulltime/Overtime'?'After overtime':'After shootout']:[];
 const base={id:`fixture:chl:${match._entityId}`,sportDomainId:'sport:ice-hockey',competitionId:'competition:chl',name:`${away.name} v ${home.name}`,date:local.date,time:local.time,startTimeUtc:match.startDate,venue:match.venue?.name||null,status:completed?'completed':'upcoming',scheduleStatus:match.startDateNotConfirmed?'provisional':'confirmed',stage:match.stage.group.name,roundLabel:match.stage.round.name,
  participantSlots:[['away',away],['home',home]].map(([side,team])=>({participantId:teamId(team),label:team.name,homeAway:side,logoUrl:team.externalId?`https://res.cloudinary.com/chl-production/image/upload/c_fit,g_center,h_300,w_300/chl-prod/assets/teams/${team.externalId}`:null,...(completed?{score:scores[side]}:{})})),
  sourceUrl,sourceName:'Champions Hockey League',sourceType:'official-schedule',sourceCheckedAt:checkedAt,
  viewingOptions:[{providerId:'iihf-tv',webUrl:'https://iihf.tv/',sportUrl:'https://iihf.tv/',linkScope:'sport',sourceUrl:'https://www.chl.hockey/en/fans/where-to-watch',verifiedAt:'2026-08-26T00:00:00.000Z',permalinkVerifiedAt:null}],
  ...(completed?{resultSourceUrl:sourceUrl,resultSourceCheckedAt:checkedAt,scoreCheckedAt:checkedAt,...(resultLabels.length?{resultLabels}:{})}:{})};
 if(calendar){const date=match.startDate.slice(0,10);return {...base,name:`${match.stage.group.name} · programme date`,date:null,time:null,startTimeUtc:null,timeTbc:true,timePrecision:'tbc',scheduleStatus:'tbc',participantsConfirmed:false,participantSlots:[],participantIds:[],displayDateLabel:`${date} (CHL programme date)`,schedulingWindow:{startsOn:date,endsOn:date,timeZone:'UTC'},timingProvenance:{precision:'competition-stage-calendar',sourceDateLabel:date,sourceStartTimeUtc:match.startDate,sourceUrl,observedAt:checkedAt},scheduleNote:'Programme date only; teams and kickoff not announced.'};}
 return {...base,participantsConfirmed:true};
}
function parseSchedule(payload,{teams,previousFixtures=[],checkedAt,now=new Date()}={}){
 observation(checkedAt,now);const ids=knownTeams(teams),matches=collection(payload),seen=new Set(),rounds=new Map(),appearances=new Map();
 if(matches.length<72||matches.length>200)fail('incomplete or unbounded season schedule');
 const fixtures=matches.map(match=>{
  if(seen.has(match._entityId))fail('duplicate match');seen.add(match._entityId);
  const fixture=parseFixture(match,{teamIds:ids,checkedAt});
  if(match.stage.group.name==='Regular Season'){
   const n=Number(match.stage.round.order);if(!Number.isInteger(n)||n<1||n>6||match.stage.round.name!==`Game Day ${n}`)fail('invalid regular-season round');
   const members=rounds.get(n)||new Set();for(const slot of fixture.participantSlots){if(members.has(slot.participantId))fail('duplicate club in regular-season round');members.add(slot.participantId);appearances.set(slot.participantId,(appearances.get(slot.participantId)||0)+1);}rounds.set(n,members);
  }
  return fixture;
 });
 if(rounds.size!==6||[...rounds.values()].some(s=>s.size!==24)||[...ids].some(id=>appearances.get(id)!==6))fail('incomplete six-round club schedule');
 if(previousFixtures.some(f=>!seen.has(f.id.replace(/^fixture:chl:/,''))))fail('published fixture disappeared');
 return fixtures.sort((a,b)=>String(a.startTimeUtc||a.schedulingWindow?.startsOn||'').localeCompare(String(b.startTimeUtc||b.schedulingWindow?.startsOn||''))||a.id.localeCompare(b.id));
}
function parseRecords(payload,{teams,fixtures,sourceUrl,checkedAt,now=new Date()}={}){
 observation(checkedAt,now);const ids=knownTeams(teams),seen=new Set(),totals=new Map([...ids].map(id=>[id,{gamesPlayed:0,wins:0,losses:0,goalsFor:0,goalsAgainst:0}]));
 for(const f of fixtures.filter(f=>f.status==='completed'))for(const slot of f.participantSlots){const other=f.participantSlots.find(s=>s.homeAway!==slot.homeAway),t=totals.get(slot.participantId);t.gamesPlayed++;t.wins+=slot.score>other.score;t.losses+=slot.score<other.score;t.goalsFor+=slot.score;t.goalsAgainst+=other.score;}
 const rows=collection(payload).map(entry=>{
  const id=teamId(entry);if(!ids.has(id)||seen.has(id)||!entry.name)fail('unknown or duplicate club record');seen.add(id);
  const stats=entry.stats,record={gamesPlayed:stats?.matches?.played?.total,wins:stats?.matches?.won?.total,losses:stats?.matches?.lost?.total,goalsFor:stats?.goals?.scored?.total,goalsAgainst:stats?.goals?.conceded?.total};
  if(Object.values(record).some(v=>!Number.isInteger(v)||v<0)||record.gamesPlayed!==record.wins+record.losses||stats?.matches?.drawn!==0)fail('invalid club record');
  const stale=Object.keys(record).some(key=>record[key]!==totals.get(id)[key]);
  return {participantId:id,displayName:entry.name,competitionId:'competition:chl',competitionName:'Champions Hockey League',season:SEASON,rank:null,rankPending:true,recordKind:'club-record',...record,asOf:checkedAt,sourceName:'Champions Hockey League',sourceType:'official-club-records',sourceUrl,tableNote:'Published club records; competition positions and qualification are unavailable.',...(stale?{stale:true,staleNote:'Club records await source confirmation of final results.'}:{})};
 });
 if(seen.size!==24)fail('incomplete club records');
 return rows.sort((a,b)=>a.participantId.localeCompare(b.participantId));
}
const DATE_KEYS=new Set(['asOf','sourceCheckedAt','resultSourceCheckedAt','scoreCheckedAt','observedAt']);
const semantic=value=>JSON.stringify(value,(key,v)=>DATE_KEYS.has(key)?undefined:v);
function retainDates(previous,next){
 if(semantic(previous)===semantic(next))return previous;
 const before=[previous?.asOf,previous?.sourceCheckedAt,previous?.resultSourceCheckedAt].map(Date.parse).filter(Number.isFinite),after=Date.parse(next.asOf||next.sourceCheckedAt);
 if(before.length&&after<=Math.max(...before))fail('stale or conflicting observation');
 return next;
}
function merge(previous,{fixtures,standings}){
 const oldFixtures=new Map((previous.fixtures||[]).filter(f=>f.competitionId==='competition:chl').map(f=>[f.id,f]));
 fixtures=fixtures.map(next=>{
  const old=oldFixtures.get(next.id);if(!old)return next;
  const combined={...old,...next,viewingOptions:old.viewingOptions||next.viewingOptions};
  for(const key of ['resultLabels','resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt','timingProvenance','timeTbc','timePrecision','displayDateLabel','schedulingWindow','scheduleNote','score','scoreDisplay','result','participantIds'])if(!Object.hasOwn(next,key))delete combined[key];
  if(old.status==='completed'&&next.status!=='completed')fail('cannot regress a completed match');
  if(next.status==='completed'&&semantic(old.participantSlots)===semantic(next.participantSlots)&&old.resultSourceCheckedAt){combined.resultSourceCheckedAt=old.resultSourceCheckedAt;combined.scoreCheckedAt=old.scoreCheckedAt;}
  return retainDates(old,combined);
 });
 const oldRows=new Map((previous.standings||[]).map(r=>[r.participantId,r]));standings=standings.map(row=>retainDates(oldRows.get(row.participantId),row));
 const next={...previous,fixtures:(previous.fixtures||[]).map(f=>f.competitionId==='competition:chl'?fixtures.find(n=>n.id===f.id):f),standings:[...(previous.standings||[]).filter(r=>!String(r.participantId).startsWith('team:chl:')), ...standings]};
 const existingIds=new Set(next.fixtures.map(f=>f.id));next.fixtures.push(...fixtures.filter(f=>!existingIds.has(f.id)));
 next.sourceStatus={...previous.sourceStatus,chl:{...previous.sourceStatus?.chl,scheduleFeedCount:1,playableFixtureCount:fixtures.filter(f=>f.participantSlots.length===2).length,calendarEntryCount:fixtures.filter(f=>f.participantSlots.length===0).length,completedResultCount:fixtures.filter(f=>f.status==='completed').length,clubRecordsStatus:standings.some(r=>r.stale)?'stale':'published'}};
 return next;
}
async function refreshFile({filePath,fetchJson,fetchText,clock=()=>new Date()}={}){
 const previous=JSON.parse(fs.readFileSync(filePath,'utf8')),resources=discover(await fetchText(PAGE_URL));
 const [schedule,records]=await Promise.all([fetchJson(resources.scheduleUrl),fetchJson(resources.recordsUrl)]),now=clock(),checkedAt=now.toISOString(),teams=previous.teams.filter(t=>t.leagueId==='competition:chl');
 const fixtures=parseSchedule(schedule,{teams,previousFixtures:previous.fixtures.filter(f=>f.competitionId==='competition:chl'),checkedAt,now}),standings=parseRecords(records,{teams,fixtures,sourceUrl:resources.recordsUrl,checkedAt,now});
 const next=merge(previous,{fixtures,standings}),changed=JSON.stringify(next)!==JSON.stringify(previous);
 if(changed)fs.writeFileSync(filePath,JSON.stringify(next,null,2)+'\n');
 return {checkedAt,changed,sourceUrl:PAGE_URL,fixtures:fixtures.length,finals:fixtures.filter(f=>f.status==='completed').length,calendarEntries:fixtures.filter(f=>!f.participantSlots.length).length,records:standings.length,retainedFactAt:next.fixtures.find(f=>f.competitionId==='competition:chl')?.sourceCheckedAt,sourceRequests:3};
}
function projectionCurrent(directory,{inspector,schedule}={}){
 if(inspector?.coverageStatus!=='partial'||!Array.isArray(schedule?.fixtures))return false;
 const fixtures=directory.fixtures.filter(f=>f.competitionId==='competition:chl');
 const keys=['name','venue','status','scheduleStatus','stage','roundLabel','startTimeUtc','sourceCheckedAt','resultSourceCheckedAt','scoreCheckedAt','displayDateLabel','participantsConfirmed','timingProvenance'];
 const slots=f=>(f.participantSlots||[]).map(s=>[s.participantId,s.homeAway,s.score==null?null:String(s.score)]);
 for(const surface of [inspector,schedule]){
  if(surface.fixtures?.filter(f=>f.competitionId==='competition:chl').length!==fixtures.length)return false;
  for(const fixture of fixtures){
   const row=surface.fixtures.find(f=>f.id===fixture.id);if(!row||keys.some(k=>JSON.stringify(row[k])!==JSON.stringify(fixture[k]))||JSON.stringify(slots(row))!==JSON.stringify(slots(fixture)))return false;
   if(fixture.status==='completed'){const [a,b]=fixture.participantSlots,qualifier=(fixture.resultLabels||[]).filter(label=>['After overtime','After shootout'].includes(label)).join(' · '),score=`${a.label} ${a.score}-${b.score} ${b.label}${qualifier?' · '+qualifier:''}`;if(row.scoreDisplay!==score||row.score!==score)return false;}
  }
 }
 const records=directory.standings.filter(r=>r.competitionId==='competition:chl'),published=inspector.standings?.filter(r=>r.competitionId==='competition:chl');
 const recordKeys=['asOf','rank','rankPending','recordKind','gamesPlayed','wins','losses','goalsFor','goalsAgainst','stale'];
 return published?.length===records.length&&records.every(record=>{const row=published.find(r=>r.participantId===record.participantId);return row&&recordKeys.every(k=>row[k]===record[k]);});
}
module.exports={SEASON,SEASON_ID,PAGE_URL,discover,parseFixture,parseSchedule,parseRecords,merge,retainDates,refreshFile,projectionCurrent};
