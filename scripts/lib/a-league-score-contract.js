'use strict';
// Frozen retained identities, never new observations or a fixture admission path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const scope=require('../fixtures/a-league-score-scope-20261031.json');
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const records=new Map(scope.records.map(row=>[row.officialMatchId,row])),byCanonical=new Map(scope.records.map(row=>[row.canonicalEventId,row]));
const FILE='data/football/fixtures/a-league-men.json',RESULT_FIELDS=scope.resultFields;
const fail=code=>{throw Object.assign(Error('A-League score contract: '+code),{aLeagueCode:code});};
function route(argv){
 if(!argv.some(arg=>arg.startsWith('--a-league-results')))return null;
 const evidence=argv.filter(arg=>arg.startsWith('--a-league-results-evidence='));
 const allowed=new Set(['--a-league','--a-league-results-only','--local-only']);
 if(evidence.length!==1||!evidence[0].slice('--a-league-results-evidence='.length)||new Set(argv).size!==argv.length||!argv.includes('--a-league')||!argv.includes('--a-league-results-only')||!argv.includes('--local-only')||argv.some(arg=>!allowed.has(arg)&&arg!==evidence[0]))fail('invalid-local-route');
 const output=evidence[0].slice('--a-league-results-evidence='.length);if(!path.isAbsolute(output)||path.resolve(output)!==output)fail('invalid-evidence-path');return {output};
}
function utc(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return null;const n=Date.parse(value);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,19)===value.slice(0,19)?new Date(n).toISOString():null;}
const strip=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!RESULT_FIELDS.includes(key)));
const pair=row=>Number.isSafeInteger(row.homeScore)&&row.homeScore>=0&&Number.isSafeInteger(row.awayScore)&&row.awayScore>=0?[row.homeScore,row.awayScore]:null;
function preflight(root,now=new Date()){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),document=read(FILE),directory=read('data/canonical/football-directory.v1.json');
 if(document.schemaVersion!=='football-fixtures.v1'||document.leagueId!=='competition:a-leagues'||document.leagueKey!=='a-league-men'||document.seasonLabel!=='2026/27'||document.sourceUrl!==scope.sourceUrl||document.events?.length!==156)fail('retained-season');
 const teams=directory.teams.filter(row=>row.leagueId==='competition:a-leagues');
 if(teams.length!==12||scope.clubs.some(club=>teams.filter(t=>t.id===club.id&&t.externalIds?.aleagues===club.officialId).length!==1))fail('retained-clubs');
 document.events.forEach((row,index)=>{
  const bound=scope.records[index];if(row.id!==bound.id||row.eventId!==bound.eventId||row.canonicalEventId!==bound.canonicalEventId||row.officialMatchId!==bound.officialMatchId||row.canonicalSourceId!==bound.officialMatchId||row.homeParticipantId!==bound.homeParticipantId||row.awayParticipantId!==bound.awayParticipantId||JSON.stringify(row.participantIds)!==JSON.stringify([bound.homeParticipantId,bound.awayParticipantId])||row.startTimeUtc!==bound.startTimeUtc||row.roundNumber!==bound.roundNumber)fail('retained-binding');
  if(bound.target&&row.status==='completed'?sha(strip(row))!==bound.nonResultSha256:sha(row)!==bound.recordSha256)fail('retained-fact-mutation');
  if(bound.target&&!['upcoming','completed'].includes(row.status))fail('retained-status');
  for(const stamp of [row.sourceCheckedAt,row.canonicalSourceCheckedAt,row.lastReviewedAt,row.scoreCheckedAt,row.statusCheckedAt,row.resultSourceCheckedAt])if(stamp!=null&&(!utc(stamp)||Date.parse(stamp)>+now))fail('retained-clock');
  if(row.status==='completed'&&!pair(row))fail('retained-final-score');
  if(bound.target&&row.status==='completed'){
   const text=`${row.participants[0].name} ${row.homeScore}-${row.awayScore} ${row.participants[1].name}`;
   if(row.resultStatus!=='official'||row.score!==text||row.canonicalResultScoreline!==text||row.result?.status!=='completed'||row.result.scorelineText!==text||row.resultSourceUrl!==scope.sourceUrl||row.result.source?.sourceUrl!==scope.sourceUrl||row.result.source?.sourceType!=='official'||!/^[a-f0-9]{64}$/.test(row.result.source?.bodySha256||''))fail('retained-final-evidence');
   for(const stamp of [row.scoreCheckedAt,row.statusCheckedAt,row.resultSourceCheckedAt,row.result.source?.checkedAt])if(!utc(stamp)||stamp!==row.scoreCheckedAt||Date.parse(stamp)<Date.parse(row.startTimeUtc)||Date.parse(stamp)>+now)fail('retained-final-clock');
   const provider=row.result.source?.providerUpdatedAt;if(provider!=null&&(!utc(provider)||Date.parse(provider)<Date.parse(row.startTimeUtc)||Date.parse(provider)>Date.parse(row.scoreCheckedAt)))fail('retained-provider-clock');
  }
 });
 for(const file of ['data/code-inspector/football.json','data/follow-schedule/football.json']){
  const chunk=read(file),rows=chunk.fixtures?.filter(row=>row.competitionId==='competition:a-leagues');
  if(chunk.schemaVersion!=='code-inspector-chunk.v1'||chunk.code?.id!=='sport:football'||rows?.length!==156)fail('retained-projection-count');
  for(const expected of scope.records){const found=rows.filter(row=>row.canonicalEventId===expected.canonicalEventId);if(found.length!==1)fail('retained-projection-identity');const row=found[0],original=document.events.find(e=>e.id===expected.id);if(row.id!==expected.canonicalEventId||row.startTimeUtc!==expected.startTimeUtc||row.homeParticipantId!==expected.homeParticipantId||row.awayParticipantId!==expected.awayParticipantId||row.status!==original.status||original.status==='completed'&&JSON.stringify(pair(row))!==JSON.stringify(pair(original)))fail('retained-projection-binding');}
 }
 for(const file of ['feeds/incoming/events.json','data/events.json'])if(read(file).events.some(row=>row.competitionId==='competition:a-leagues'||[row.id,row.eventId,row.canonicalEventId,...row.sourceEventIds||[]].some(id=>byCanonical.has(id)||scope.records.some(bound=>bound.id===id))))fail('unexpected-feed-admission');
 return document;
}
function evaluate(matches,previous,{observedAt,bodySha256,now=new Date(),check=()=>{}}){
 if(!Array.isArray(matches))fail('invalid-collection');
 const seen=new Set(),rows=[],byOld=new Map(previous.events.map(row=>[row.officialMatchId,row])),clubIds=new Map(scope.clubs.map(club=>[club.id,club.officialId]));
 // Every supplied row is bound and checked before a partial collection can hide
 // a future/final contradiction. No partial set can admit any results.
 for(const match of matches){
  check();const bound=records.get(match?.id);if(!bound||seen.has(match.id))fail('unknown-or-duplicate-fixture');seen.add(match.id);
  if(match.competition?.id!==scope.competitionId||match.tournament?.id!==scope.tournamentId||match.stage?.name!=='Regular Season'||String(match.week)!==String(bound.roundNumber)||match.homeTeam?.id!==clubIds.get(bound.homeParticipantId)||match.awayTeam?.id!==clubIds.get(bound.awayParticipantId))fail('source-identity-season-round');
  if(!Number.isSafeInteger(match.startDate)||match.startDate!==Date.parse(bound.startTimeUtc))fail('source-calendar-mismatch-held');
  const old=byOld.get(match.id),status=match.matchStatus;
  const explicit=['Played','FullTime','Finished','Completed'].includes(status),numeric=match.liveData?.matchDetails?.scores?.total;
  const good=numeric&&Number.isSafeInteger(numeric.home)&&numeric.home>=0&&Number.isSafeInteger(numeric.away)&&numeric.away>=0;
  if((explicit||['Playing','InProgress','HalfTime'].includes(status))&&match.startDate>Date.parse(observedAt))fail('future-playing-or-final');
  if(Object.hasOwn(match,'lastUpdated')&&(!Number.isSafeInteger(match.lastUpdated)||match.lastUpdated<0||match.lastUpdated>Date.parse(observedAt)||(explicit&&match.lastUpdated<match.startDate)))fail('provider-fact-clock');
  if((explicit||old.status==='completed')&&['home','away'].some(side=>Number.isSafeInteger(numeric?.[side])&&numeric[side]>=0&&match[side+'Score']!=null&&match[side+'Score']!==numeric[side]))fail('contradictory-score-channels');
  if(old.status==='completed'&&(!explicit||['home','away'].some(side=>Number.isSafeInteger(numeric?.[side])&&numeric[side]>=0&&numeric[side]!==old[side+'Score'])))fail('accepted-final-conflict');
  rows.push({match,bound,old,explicit,numeric,good});
 }
 if(matches.length!==156||seen.size!==156)fail('incomplete-competition');
 if(!utc(observedAt)||Date.parse(observedAt)>+now||!/^[a-f0-9]{64}$/.test(bodySha256))fail('body-observation');
 const changed=[],deferrals=[],patches=new Map();let supported=0;
 for(const {match,bound,old,explicit,numeric,good}of rows){
  check();if(!bound.target)continue;
  if(!explicit||!good){deferrals.push({id:bound.id,reason:!explicit?'explicit-final-unavailable':'paired-final-score-unavailable',nextAction:'Review official card-specific result evidence in a separately allocated source window'});continue;}
  supported++;if(old.status==='completed')continue;
  const score=`${old.participants[0].name} ${numeric.home}-${numeric.away} ${old.participants[1].name}`;
  const next={...old,status:'completed',homeScore:numeric.home,awayScore:numeric.away,score,canonicalResultScoreline:score,resultStatus:'official',resultSourceUrl:scope.sourceUrl,resultSourceCheckedAt:observedAt,scoreCheckedAt:observedAt,statusCheckedAt:observedAt,result:{status:'completed',scorelineText:score,source:{sourceType:'official',sourceName:'A-Leagues official results',sourceUrl:scope.sourceUrl,checkedAt:observedAt,bodySha256,...(Object.hasOwn(match,'lastUpdated')?{providerUpdatedAt:new Date(match.lastUpdated).toISOString()}:{})}}};
  if(numeric.home!==numeric.away)next.winnerParticipantId=numeric.home>numeric.away?old.homeParticipantId:old.awayParticipantId;
  patches.set(old.id,next);changed.push(bound.canonicalEventId);
 }
 if(!supported)fail('no-supported-target-finals');
 return {document:{...previous,events:previous.events.map(row=>patches.get(row.id)||row)},changed,deferrals,supported};
}
function selectedIds(value){if(!Array.isArray(value)||!value.length||value.length>11||new Set(value).size!==value.length||value.some(id=>!byCanonical.get(id)?.target))fail('invalid-projection-selector');return new Set(value);}
function projectRows(rows,document,ids){
 const selected=selectedIds(ids),originals=new Map(document.events.map(row=>[row.canonicalEventId,row])),found=new Set();
 const next=rows.map(row=>{
  if(!selected.has(row.canonicalEventId))return row;const bound=byCanonical.get(row.canonicalEventId),source=originals.get(row.canonicalEventId);
  if(found.has(bound.canonicalEventId)||row.id!==bound.canonicalEventId||row.competitionId!=='competition:a-leagues'||row.startTimeUtc!==bound.startTimeUtc||row.homeParticipantId!==bound.homeParticipantId||row.awayParticipantId!==bound.awayParticipantId||source?.status!=='completed'||!pair(source))fail('projection-binding');found.add(bound.canonicalEventId);
  return {...row,...Object.fromEntries(RESULT_FIELDS.filter(key=>Object.hasOwn(source,key)).map(key=>[key,source[key]]))};
 });if(found.size!==selected.size)fail('missing-projection-target');return next;
}
module.exports={scope,FILE,RESULT_FIELDS,sha,route,utc,preflight,evaluate,projectRows,selectedIds};
