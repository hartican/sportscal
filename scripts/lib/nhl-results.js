'use strict';
// NHL facts only: shared by the existing full and quick canonical owners.
const fs=require('node:fs');
const SEASON='20262027',TABLE_URL='https://api-web.nhle.com/v1/standings/now';
const ABBREVS='ANA BOS BUF CAR CBJ CGY CHI COL DAL DET EDM FLA LAK MIN MTL NJD NSH NYI NYR OTT PHI PIT SEA SJS STL TBL TOR UTA VAN VGK WPG WSH'.split(' ');
const PROVIDER_IDS={ANA:24,BOS:6,BUF:7,CAR:12,CBJ:29,CGY:20,CHI:16,COL:21,DAL:25,DET:17,EDM:22,FLA:13,LAK:26,MIN:30,MTL:8,NJD:1,NSH:18,NYI:2,NYR:3,OTT:9,PHI:4,PIT:5,SEA:55,SJS:28,STL:19,TBL:14,TOR:10,UTA:68,VAN:23,VGK:54,WPG:52,WSH:15};
const fail=message=>{throw Error(`NHL: ${message}`);};
const name=v=>typeof v==='string'?v:v?.default||Object.values(v||{})[0]||'';
function instant(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().replace('.000Z','Z')!==value.replace('.000Z','Z'))fail('invalid source timestamp');return value;
}
function day(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('invalid schedule date');return value;}
function observed(value,now){instant(value);if(Date.parse(value)>+now)fail('future observation');return value;}
function knownTeams(teams){const ids=new Set((teams||[]).map(t=>t.id));if(ids.size!==32||ABBREVS.some(a=>!ids.has('team:nhl:'+a.toLowerCase())))fail('expected the 32 reviewed NHL clubs');return ids;}
function localParts(value,timeZone='Australia/Sydney'){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(p=>[p.type,p.value]));}
function leagueDay(value){const p=localParts(value,'America/New_York');return `${p.year}-${p.month}-${p.day}`;}
function fixture(game,{teamIds=new Set(ABBREVS.map(a=>'team:nhl:'+a.toLowerCase())),checkedAt,now=new Date(),sourceGameDate}={}){
 if(checkedAt)observed(checkedAt,now);
 if(!Number.isInteger(game?.id)||String(game.id).length!==10||String(game.season)!==SEASON||![1,2,3].includes(game.gameType)||!String(game.id).startsWith('2026'+String(game.gameType).padStart(2,'0')))fail('invalid match identity, season or phase');
 instant(game.startTimeUTC);
 if(game.startTimeUTC<'2026-09-19T00:00:00Z'||game.startTimeUTC>='2027-06-12T00:00:00Z')fail('match outside reviewed season window');
 if(!['FUT','PRE','LIVE','OFF','FINAL'].includes(game.gameState)||game.gameScheduleState!=='OK')fail(`match ${game.id}: unreviewed playing/schedule state ${game.gameState}/${game.gameScheduleState}; retain last-good facts`);
 if(sourceGameDate&&leagueDay(game.startTimeUTC)!==day(sourceGameDate))fail('match does not belong to the declared league day');
 const completed=['OFF','FINAL'].includes(game.gameState),live=game.gameState==='LIVE',scored=completed||live,local=localParts(game.startTimeUTC);
 if(live&&(!checkedAt||Date.parse(game.startTimeUTC)>Date.parse(checkedAt)))fail('live play requires a genuine observation after scheduled start');
 const slots=[game.awayTeam,game.homeTeam].map((team,index)=>{
  const id='team:nhl:'+String(team?.abbrev||'').toLowerCase(),label=[name(team?.placeName),name(team?.commonName)].filter(Boolean).join(' ').trim();
  if(!teamIds.has(id)||team?.id!==PROVIDER_IDS[team?.abbrev]||!label)fail('unknown participant');
  if(scored&&(!Number.isInteger(team.score)||team.score<0))fail('invalid paired observed scores');
  return {participantId:id,label,homeAway:index?'home':'away',score:scored?team.score:null,logoUrl:team.logo||null};
 });
 if(slots[0].participantId===slots[1].participantId)fail('duplicate playing participant');
 if(completed&&(slots[0].score===slots[1].score||!['REG','OT','SO'].includes(game.gameOutcome?.lastPeriodType)))fail('invalid final outcome');
 if(completed&&checkedAt&&Date.parse(game.startTimeUTC)>Date.parse(checkedAt))fail('future final observation');
 if(typeof game.gameCenterLink!=='string'||!/^\/gamecenter\/[a-z0-9-]+\/\d{4}\/\d\d\/\d\d\/\d{10}$/.test(game.gameCenterLink)||!game.gameCenterLink.endsWith('/'+game.id))fail('invalid source match link');
 const sourceUrl='https://www.nhl.com'+game.gameCenterLink;
 return {id:'fixture:nhl:'+game.id,sportDomainId:'sport:ice-hockey',competitionId:'competition:nhl',name:`${slots[0].label} v ${slots[1].label}`,date:`${local.year}-${local.month}-${local.day}`,time:`${local.hour}:${local.minute}`,startTimeUtc:game.startTimeUTC,venue:name(game.venue)||null,status:completed?'completed':live?'live':'upcoming',scheduleStatus:'confirmed',roundLabel:({1:'Preseason',2:'Regular season',3:'Playoffs'})[game.gameType],participantSlots:slots,sourceUrl,ticketUrl:game.ticketsLink||null,
  ...(checkedAt?{sourceName:'NHL',sourceType:'official-schedule',sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,statusSourceUrl:sourceUrl,statusSourceName:'NHL',statusSourceType:'official-schedule'}:{}),
  ...(scored&&checkedAt?{resultSourceUrl:sourceUrl,resultSourceCheckedAt:checkedAt,scoreCheckedAt:checkedAt}:{}),
  ...(completed?{resultOutcomeType:game.gameOutcome.lastPeriodType,resultLabels:game.gameOutcome.lastPeriodType==='REG'?[]:[game.gameOutcome.lastPeriodType==='OT'?'After overtime':'After shootout']}:{})};
}
function parseWeek(payload,{requestedDate,teams,checkedAt,now=new Date(),previousFixtures=[]}={}){
 observed(checkedAt,now);day(requestedDate);const teamIds=knownTeams(teams),seen=new Set(),dates=new Set(),rows=[];
 if(!Array.isArray(payload?.gameWeek)||payload.gameWeek.length!==7||payload.previousStartDate!==shiftDay(requestedDate,-7)||payload.nextStartDate!==shiftDay(requestedDate,7))fail('incomplete seven-day schedule');
 for(let n=0;n<7;n++){
  const entry=payload.gameWeek[n];if(entry.date!==shiftDay(requestedDate,n)||!Array.isArray(entry.games)||entry.numberOfGames!==entry.games.length)fail('incomplete declared game day');dates.add(entry.date);
  for(const game of entry.games){if(seen.has(game.id))fail('duplicate match');seen.add(game.id);rows.push(fixture(game,{teamIds,checkedAt,now,sourceGameDate:entry.date}));}
 }
 if(!Number.isInteger(payload.numberOfGames)||payload.numberOfGames!==rows.length||rows.length>150)fail('incomplete or unbounded weekly schedule');
 if(previousFixtures.some(f=>f.startTimeUtc&&dates.has(leagueDay(f.startTimeUtc))&&!seen.has(Number(f.id.split(':').at(-1)))))fail('published match disappeared from the checked window');
 return rows;
}
function shiftDay(date,days){day(date);return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
function resources(now){const p=localParts(now.toISOString()),date=`${p.year}-${p.month}-${p.day}`,weekday=new Date(date+'T00:00:00Z').getUTCDay(),monday=shiftDay(date,-((weekday+6)%7));return [shiftDay(monday,-7),monday].map(requestedDate=>({requestedDate,url:'https://api-web.nhle.com/v1/schedule/'+requestedDate}));}
function parseClubSchedules(clubs,{teams,checkedAt,now=new Date(),previousFixtures=[]}={}){
 const ids=knownTeams(teams),seenClubs=new Set(),matches=new Map(),owners=new Map();
 for(const {abbreviation,payload,observedAt=checkedAt} of clubs){
  observed(observedAt,now);const clubId='team:nhl:'+String(abbreviation).toLowerCase();
  if(!ids.has(clubId)||seenClubs.has(clubId)||String(payload?.currentSeason)!==SEASON||!Array.isArray(payload.games)||payload.games.length<82||payload.games.length>120)fail('incomplete or unknown club season schedule');seenClubs.add(clubId);
  const localIds=new Set();let regular=0;
  for(const game of payload.games){const row=fixture(game,{teamIds:ids,checkedAt:observedAt,now});if(localIds.has(row.id)||!row.participantSlots.some(s=>s.participantId===clubId))fail('invalid club match identity');localIds.add(row.id);regular+=game.gameType===2;
   const old=matches.get(row.id);if(old&&meaning(old)!==meaning(row))fail('conflicting mirrored club schedule');if(!old||Date.parse(row.sourceCheckedAt)<Date.parse(old.sourceCheckedAt))matches.set(row.id,row);const set=owners.get(row.id)||new Set();set.add(clubId);owners.set(row.id,set);
  }
  if(regular!==84)fail('incomplete 84-match club regular season');
 }
 if(seenClubs.size!==32||[...owners.values()].some(s=>s.size!==2)||[...matches.values()].filter(f=>f.roundLabel==='Regular season').length!==1344)fail('incomplete mirrored league schedule');
 if(previousFixtures.some(f=>!matches.has(f.id)))fail('published season match disappeared');
 return [...matches.values()];
}
const DATE_KEYS=new Set(['asOf','sourceCheckedAt','statusCheckedAt','resultSourceCheckedAt','scoreCheckedAt','sourceDate','sourcePublishedAt']);
// Club and weekly resources use different marketing destinations. This result
// boundary keeps the existing ticket owner instead of changing commercial links.
const meaning=v=>JSON.stringify(v,(k,x)=>DATE_KEYS.has(k)||k==='ticketUrl'?undefined:x);
function newer(previous,next){const dates=['sourceCheckedAt','statusCheckedAt','resultSourceCheckedAt','scoreCheckedAt','asOf'].map(k=>Date.parse(previous?.[k])).filter(Number.isFinite);if(dates.length&&Date.parse(next)<=Math.max(...dates))fail('stale or conflicting observation');}
function scheduleMeaning(f){if(!f)return null;return JSON.stringify(['id','sportDomainId','competitionId','name','date','time','startTimeUtc','venue','scheduleStatus','roundLabel','sourceUrl','ticketUrl','sourceName','sourceType'].map(k=>f[k]).concat([(f.participantSlots||[]).map(({score,...s})=>s)]));}
function resultMeaning(f){return JSON.stringify([f?.status,f?.participantSlots?.map(s=>[s.participantId,s.score]),f?.resultLabels||[],f?.resultOutcomeType,f?.resultSourceUrl]);}
function mergeFixtures(previous,fixtures){
 const originals=new Map(previous.fixtures.filter(f=>f.competitionId==='competition:nhl').map(f=>[f.id,f]));
 const changes=new Map(fixtures.map(row=>{
  const old=originals.get(row.id);if(!old)return [row.id,row];
  if(JSON.stringify(old.participantSlots.map(s=>[s.participantId,s.homeAway]))!==JSON.stringify(row.participantSlots.map(s=>[s.participantId,s.homeAway])))fail('published participant identity changed');
  if(old.status==='completed'&&row.status!=='completed')fail('cannot regress a completed match');
  if(old.status==='live'&&row.status==='upcoming')fail('cannot regress observed play to a schedule-only match');
  let next={...old,...row};if(Object.hasOwn(old,'ticketUrl'))next.ticketUrl=old.ticketUrl;
  if(row.status!=='completed')for(const k of ['resultLabels','resultOutcomeType'])delete next[k];
  if(row.status!=='completed'&&row.status!=='live')for(const k of ['resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt'])delete next[k];
  const freshLive=row.status==='live'&&(!old.statusCheckedAt||Date.parse(row.statusCheckedAt)>Date.parse(old.statusCheckedAt));
  if(meaning(old)!==meaning(next)||freshLive)newer(old,row.sourceCheckedAt);
  if(scheduleMeaning(old)===scheduleMeaning(next)&&old.sourceCheckedAt)next.sourceCheckedAt=old.sourceCheckedAt;
  if(old.status===next.status&&old.statusCheckedAt&&!freshLive)next.statusCheckedAt=old.statusCheckedAt;
  if(resultMeaning(old)===resultMeaning(next)&&old.resultSourceCheckedAt&&!freshLive){next.resultSourceCheckedAt=old.resultSourceCheckedAt;next.scoreCheckedAt=old.scoreCheckedAt;}
  if(meaning(old)===meaning(next)&&!freshLive)next=old;
  return [row.id,next];
 }));
 return [...previous.fixtures.map(f=>changes.get(f.id)||f),...fixtures.filter(f=>!originals.has(f.id))];
}
function parseStandings(payload,{teams,fixtures,checkedAt,now=new Date()}={}){
 observed(checkedAt,now);observed(payload?.standingsDateTimeUtc,now);if(Date.parse(payload.standingsDateTimeUtc)>Date.parse(checkedAt))fail('table published after observation');const ids=knownTeams(teams),seen=new Set(),ranks=new Set(),groups=new Map();
 if(!Array.isArray(payload.standings)||payload.standings.length!==32)fail('incomplete league table');
 const totals=new Map([...ids].map(id=>[id,{gamesPlayed:0,wins:0,goalsFor:0,goalsAgainst:0}]));for(const f of fixtures.filter(f=>f.competitionId==='competition:nhl'&&f.roundLabel==='Regular season'&&f.status==='completed'))for(const s of f.participantSlots){if(!totals.has(s.participantId))fail('unknown retained final participant');const other=f.participantSlots.find(o=>o.participantId!==s.participantId),t=totals.get(s.participantId);if(!Number.isInteger(s.score)||!Number.isInteger(other?.score))fail('invalid retained final score');t.gamesPlayed++;t.wins+=s.score>other.score;t.goalsFor+=s.score;t.goalsAgainst+=other.score;}
 const rows=payload.standings.map(r=>{
  const id='team:nhl:'+name(r.teamAbbrev).toLowerCase();if(!ids.has(id)||seen.has(id)||String(r.seasonId)!==SEASON||r.gameTypeId!==2||!name(r.teamName))fail('unknown or duplicate current-season table identity');seen.add(id);day(r.date);
  const fields={gamesPlayed:r.gamesPlayed,wins:r.wins,losses:r.losses,otLosses:r.otLosses,points:r.points,goalsFor:r.goalFor,goalsAgainst:r.goalAgainst};if(Object.values(fields).some(v=>!Number.isInteger(v)||v<0)||fields.gamesPlayed!==fields.wins+fields.losses+fields.otLosses||fields.points!==2*fields.wins+fields.otLosses||!Number.isInteger(r.goalDifferential)||r.goalDifferential!==fields.goalsFor-fields.goalsAgainst)fail('invalid table records');
  if(!Number.isInteger(r.leagueSequence)||r.leagueSequence<1||r.leagueSequence>32||ranks.has(r.leagueSequence))fail('invalid published league position');ranks.add(r.leagueSequence);
  if(!['Eastern','Western'].includes(r.conferenceName)||!['Atlantic','Metropolitan','Central','Pacific'].includes(r.divisionName)||!Number.isInteger(r.conferenceSequence)||r.conferenceSequence<1||r.conferenceSequence>16||!Number.isInteger(r.divisionSequence)||r.divisionSequence<1||r.divisionSequence>8)fail('invalid conference or division position');
  for(const [group,position]of [[r.conferenceName,r.conferenceSequence],[r.divisionName,r.divisionSequence]]){const set=groups.get(group)||new Set();if(set.has(position))fail('duplicate published group position');set.add(position);groups.set(group,set);}
  return {participantId:id,displayName:name(r.teamName),competitionId:'competition:nhl',competitionName:'National Hockey League',season:SEASON,rank:r.leagueSequence,rankScope:'league',conference:r.conferenceName,conferenceRank:r.conferenceSequence,division:r.divisionName,divisionRank:r.divisionSequence,...fields,goalDifferential:r.goalDifferential,asOf:payload.standingsDateTimeUtc,sourceCheckedAt:checkedAt,sourceDate:r.date,sourcePublishedAt:payload.standingsDateTimeUtc,sourceName:'NHL',sourceType:'official-standings',sourceUrl:TABLE_URL,tableNote:'Published NHL league positions and records; playoff qualification is not inferred.',...(Object.keys(totals.get(id)).some(k=>fields[k]!==totals.get(id)[k])?{stale:true,staleNote:'Table and retained final results cover different match totals.'}:{})};
 });
 if(groups.size!==6||groups.get('Eastern')?.size!==16||groups.get('Western')?.size!==16||['Atlantic','Metropolitan','Central','Pacific'].some(g=>groups.get(g)?.size!==8))fail('incomplete published conference or division positions');
 return rows.sort((a,b)=>a.rank-b.rank);
}
function merge(previous,{fixtures,standings}){
 const merged=mergeFixtures(previous,fixtures),oldRows=new Map(previous.standings.map(r=>[r.participantId,r]));
 standings=standings.map(row=>{const old=oldRows.get(row.participantId);if(meaning(old)===meaning(row))return old;newer(old,row.sourceCheckedAt);return row;});
 return {...previous,fixtures:merged,standings:[...standings,...previous.standings.filter(r=>!r.participantId.startsWith('team:nhl:'))],sourceStatus:{...previous.sourceStatus,nhl:{...previous.sourceStatus?.nhl,standingsStatus:standings.some(r=>r.stale)?'stale':'published',latestPublishedStandingsSeason:SEASON}}};
}
async function refreshFile({filePath,fetchJson,clock=()=>new Date()}={}){
 const previous=JSON.parse(fs.readFileSync(filePath,'utf8')),teams=previous.teams.filter(t=>t.leagueId==='competition:nhl'),routes=resources(clock()),fixtures=[];let checkedAt;
 for(const route of routes){const payload=await fetchJson(route.url),now=clock();checkedAt=now.toISOString();fixtures.push(...parseWeek(payload,{...route,teams,checkedAt,now,previousFixtures:previous.fixtures.filter(f=>f.competitionId==='competition:nhl')}));}
 const table=await fetchJson(TABLE_URL),now=clock();checkedAt=now.toISOString();const merged=mergeFixtures(previous,fixtures),standings=parseStandings(table,{teams,fixtures:merged,checkedAt,now}),next=merge(previous,{fixtures,standings}),changed=JSON.stringify(next)!==JSON.stringify(previous);
 if(changed)fs.writeFileSync(filePath,JSON.stringify(next,null,2)+'\n');
 return {checkedAt,changed,sourceRequests:3,sourceUrl:'https://api-web.nhle.com/v1/schedule',windowStartsOn:routes[0].requestedDate,windowEndsOn:shiftDay(routes[1].requestedDate,6),fixtures:fixtures.length,finals:fixtures.filter(f=>f.status==='completed').length,liveObservations:fixtures.filter(f=>f.status==='live').length,records:standings.length,standingsStatus:next.sourceStatus.nhl.standingsStatus,retainedFactAt:next.fixtures.find(f=>f.id===fixtures[0]?.id)?.sourceCheckedAt,unreviewedPlayingStates:'Retained last-good data when the provider uses an unreviewed playing or schedule state.'};
}
function projectionCurrent(directory,{inspector,schedule}={}){
 const fixtures=directory.fixtures.filter(f=>f.competitionId==='competition:nhl'),keys=['name','venue','status','scheduleStatus','roundLabel','startTimeUtc','sourceCheckedAt','resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt','statusCheckedAt','resultLabels'];
 for(const surface of [inspector,schedule]){if(surface?.fixtures?.filter(f=>f.competitionId==='competition:nhl').length!==fixtures.length)return false;for(const f of fixtures){const row=surface.fixtures.find(r=>r.id===f.id);if(!row||keys.some(k=>k==='startTimeUtc'?Date.parse(row[k])!==Date.parse(f[k]):JSON.stringify(row[k])!==JSON.stringify(f[k])))return false;const slots=x=>x.participantSlots.map(s=>[s.participantId,s.homeAway,s.score==null?null:String(s.score)]);if(JSON.stringify(slots(row))!==JSON.stringify(slots(f)))return false;if(f.status==='completed'){const[a,b]=f.participantSlots,label=(f.resultLabels||[]).join(' · '),score=`${a.label} ${a.score}-${b.score} ${b.label}${label?' · '+label:''}`;if(row.scoreDisplay!==score)return false;}}}
 const rows=directory.standings.filter(r=>r.competitionId==='competition:nhl'),keysTable=['rank','conferenceRank','divisionRank','gamesPlayed','wins','losses','otLosses','points','goalsFor','goalsAgainst','goalDifferential','asOf','sourceCheckedAt','sourcePublishedAt','stale'];return rows.length===32&&rows.every(r=>{const p=inspector.standings?.find(p=>p.participantId===r.participantId);return p&&keysTable.every(k=>r[k]===p[k]);});
}
module.exports={SEASON,TABLE_URL,ABBREVS,fixture,parseWeek,parseClubSchedules,parseStandings,mergeFixtures,merge,refreshFile,resources,projectionCurrent};
