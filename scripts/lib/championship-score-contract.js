'use strict';
// Frozen existing competition only. No transport, fixture admission or table maths.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const scope=require('../fixtures/championship-score-scope-20261031.json');
const FILE='data/football/fixtures/australian-championship.json',COMPETITION='competition:australian-championship',BASE='https://api.ffa.football/c1143/s2026';
const RESULT_FIELDS=scope.resultFields,sha=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const bound=new Map(scope.records.map(r=>[r.officialMatchId,r])),canonical=new Map(scope.records.map(r=>[r.canonicalEventId,r])),clubs=new Map(scope.clubs.map(t=>[Number(t.externalIds.ffa),t]));
const fail=code=>{throw Object.assign(Error('Championship score contract: '+code),{championshipCode:code});};
const strip=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!RESULT_FIELDS.includes(k)));
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const exactKeys=(object,keys)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===keys.length&&keys.every(k=>Object.hasOwn(object,k));
function epoch(value){
 if(typeof value!=='string')return null;
 const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/);if(!m)return null;
 const [y,mo,d,h,mi,s]=m.slice(1,7).map(Number),days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 if(mo<1||mo>12||d<1||d>days[mo-1]||h>23||mi>59||s>59||Number(m[10]||0)>23||Number(m[11]||0)>59)return null;
 const date=new Date(0);date.setUTCFullYear(y,mo-1,d);date.setUTCHours(h,mi,s,0);
 return date.getTime()+Number('0.'+(m[7]||'0'))*1000-(m[8]==='Z'?0:(m[9]==='-'?-1:1)*(Number(m[10])*60+Number(m[11]))*60000);
}
function clock(value,low,high,code){const n=epoch(value);if(n===null||n<low||n>high)fail(code);return n;}
function route(argv){
 if(!argv.some(a=>a.startsWith('--championship-results')))return null;
 const prefix='--championship-results-evidence=',outputs=argv.filter(a=>a.startsWith(prefix)),allowed=new Set(['--australian-championship','--championship-results-only','--local-only']);
 if(outputs.length!==1||!outputs[0].slice(prefix.length)||new Set(argv).size!==argv.length||[...allowed].some(a=>!argv.includes(a))||argv.some(a=>!allowed.has(a)&&a!==outputs[0]))fail('invalid-local-route');
 const output=outputs[0].slice(prefix.length);if(!path.isAbsolute(output)||path.resolve(output)!==output)fail('invalid-evidence-path');return {output};
}
function scoreText(row,home,away,shootout){return `${row.participants[0].name} ${home}–${away} ${row.participants[1].name}${shootout.sourcePeriod==='ShootOut'?` · Penalties ${shootout.home}–${shootout.away}`:''}`;}
// Each contradiction needs only its own known fields, never a complete result.
function assertResultConsistency(info,homeId,awayId,code){
 if(!info||typeof info!=='object')return;
 const h=info.home_team||{},a=info.away_team||{},regulation=integer(h.score)&&integer(a.score),penalties=integer(h.shootout_score)&&integer(a.shootout_score);
 let expected=null;
 if(info.period==='SecondHalf'){
  if([h.shootout_score,a.shootout_score].some(v=>integer(v)&&v!==0))fail(code);
  if(regulation)expected=h.score===a.score?0:h.score>a.score?homeId:awayId;
 }else if(info.period==='ShootOut'){
  if(regulation&&h.score!==a.score||penalties&&h.shootout_score===a.shootout_score)fail(code);
  if(penalties)expected=h.shootout_score>a.shootout_score?homeId:awayId;
 }
 if(expected!==null&&Number.isSafeInteger(info.winner_id)&&info.winner_id!==0&&info.winner_id!==expected)fail(code);
}
function validateRetainedFinal(row,now){
 if(!exactKeys(row.shootout,['home','away','sourcePeriod'])||!integer(row.homeScore)||!integer(row.awayScore)||!row.shootout||!integer(row.shootout.home)||!integer(row.shootout.away)||!['SecondHalf','ShootOut'].includes(row.shootout.sourcePeriod))fail('retained-final-score');
 const evidence=row.resultSourceEvidence,start=epoch(row.startTimeUtc),at=clock(row.scoreCheckedAt,start,+now,'retained-final-clock');
 if(!exactKeys(evidence,['sourceUrl','bodySha256','observedAt','providerUpdatedAt','responseTimestamp'])||row.statusCheckedAt!==row.scoreCheckedAt||row.resultSourceCheckedAt!==row.scoreCheckedAt||row.resultStatus!=='official'||row.resultSourceUrl!==BASE+'/r'+row.roundNumber+'/fixture'||!evidence||evidence.observedAt!==row.scoreCheckedAt||evidence.sourceUrl!==row.resultSourceUrl||!/^[a-f0-9]{64}$/.test(evidence.bodySha256||''))fail('retained-final-evidence');
 clock(evidence.providerUpdatedAt,start,at,'retained-provider-clock');clock(evidence.responseTimestamp,epoch(evidence.providerUpdatedAt),at,'retained-response-clock');
 const text=scoreText(row,row.homeScore,row.awayScore,row.shootout);
 if(['score','scoreDisplay','result','canonicalResultScoreline'].some(k=>row[k]!==text)||sha(row.resultLabels)!==sha(row.shootout.sourcePeriod==='ShootOut'?[`Penalties ${row.shootout.home}–${row.shootout.away}`]:[]))fail('retained-final-text');
 const info=row.sourceMatchInfo;if(!exactKeys(info,['period','winner_id','home_team','away_team'])||!exactKeys(info.home_team,['score','shootout_score'])||!exactKeys(info.away_team,['score','shootout_score'])||info?.period!==row.shootout.sourcePeriod||info.winner_id!==row.sourceWinnerId||info.home_team?.score!==row.homeScore||info.away_team?.score!==row.awayScore||info.home_team?.shootout_score!==row.shootout.home||info.away_team?.shootout_score!==row.shootout.away)fail('retained-final-channels');
 assertResultConsistency(info,Number(row.homeParticipantId.split(':').at(-1)),Number(row.awayParticipantId.split(':').at(-1)),'retained-result-contradiction');
 if(![0,Number(row.homeParticipantId.split(':').at(-1)),Number(row.awayParticipantId.split(':').at(-1))].includes(row.sourceWinnerId))fail('retained-final-winner');
 if(row.sourceWinnerId===0?Object.hasOwn(row,'winnerParticipantId'):row.winnerParticipantId!=='team:football:australian-championship:'+row.sourceWinnerId)fail('retained-winner-inference');
}
function validateDocument(document,now=new Date()){
 if(document.schemaVersion!=='football-fixtures.v1'||document.leagueId!==COMPETITION||document.events?.length!==48||sha({...document,events:[]})!==scope.headerSha256)fail('retained-document');
 document.events.forEach((row,i)=>{
  const r=scope.records[i];if(row.id!==r.id||row.canonicalEventId!==r.canonicalEventId||row.officialMatchId!==r.officialMatchId||row.officialMatchUuid!==r.officialMatchUuid||row.homeParticipantId!==r.homeParticipantId||row.awayParticipantId!==r.awayParticipantId||row.startTimeUtc!==r.startTimeUtc||row.roundNumber!==r.roundNumber||row.groupId!==r.groupId)fail('retained-binding');
  if(r.target&&row.status==='completed'){if(sha(strip(row))!==r.nonResultSha256)fail('retained-nonresult-mutation');validateRetainedFinal(row,now);}
  else if(sha(row)!==r.recordSha256)fail('retained-record-mutation');
  for(const k of ['sourceCheckedAt','canonicalSourceCheckedAt','sourceUpdatedAt','providerResponseTimestamp','captureReceivedAt','scoreCheckedAt','statusCheckedAt'])if(row[k]!=null)clock(row[k],-Infinity,+now,'retained-clock');
 });return document;
}
function preflight(root,now=new Date()){
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),document=validateDocument(read(FILE),now),teams=read('data/canonical/football-directory.v1.json').teams.filter(t=>t.leagueId===COMPETITION);
 if(sha(teams)!==sha(scope.clubs))fail('retained-clubs');
 for(const file of ['data/code-inspector/football.json','data/follow-schedule/football.json']){
  const d=read(file),rows=d.fixtures?.filter(r=>r.competitionId===COMPETITION);if(d.schemaVersion!=='code-inspector-chunk.v1'||d.code?.id!=='sport:football'||rows?.length!==48)fail('retained-projection-count');
  for(const r of scope.records){const found=rows.filter(x=>x.canonicalEventId===r.canonicalEventId),source=document.events.find(x=>x.id===r.id);if(found.length!==1)fail('retained-projection-identity');const row=found[0];if(row.id!==r.canonicalEventId||row.homeParticipantId!==r.homeParticipantId||row.awayParticipantId!==r.awayParticipantId||row.startTimeUtc!==r.projectionStartTimeUtc||row.status!==source.status||source.status==='completed'&&(row.homeScore!==source.homeScore||row.awayScore!==source.awayScore))fail('retained-projection-binding');
   const frozen=scope.projections[file][r.canonicalEventId];if(r.target&&source.status==='completed'?sha(strip(row))!==frozen.nonResultSha256:sha(row)!==frozen.recordSha256)fail('retained-projection-mutation');
   if(r.target&&source.status==='completed')for(const k of RESULT_FIELDS.filter(k=>Object.hasOwn(source,k)))if(sha(row[k]??null)!==sha(source[k]))fail('retained-projection-result');
  }
 }
 for(const file of ['feeds/incoming/events.json','data/events.json'])if(read(file).events.some(r=>r.competitionId===COMPETITION||[r.id,r.eventId,r.canonicalEventId,...r.sourceEventIds||[]].some(id=>canonical.has(id)||scope.records.some(b=>b.id===id))))fail('unexpected-feed-admission');
 return document;
}
function evaluate({round,payload},previous,{observedAt,bodySha256,now=new Date(),check=()=>{}}){
 if(![2,3].includes(round)||payload?.competition?.id!==1143||payload.competition.uuid!=='b07c475b-bbf8-4872-8530-109b90f09dea'||payload.competition.active_season!==2026||payload.season?.id!==2026||payload.season.uuid!=='833e16c2-ede7-4c51-9f2c-769c2a2fb373'||payload.round_info?.num_rounds!==9)fail('source-envelope');
 const observation=clock(observedAt,-Infinity,+now,'body-observation');if(!/^[a-f0-9]{64}$/.test(bodySha256))fail('body-hash');clock(payload.timestamp,-Infinity,observation,'response-clock');
 const deferRound=reason=>({document:previous,changed:[],supported:0,deferrals:scope.records.filter(r=>r.target&&r.roundNumber===round).map(r=>({id:r.id,reason,nextAction:'Review complete official round in a separately allocated source window'}))});
 if(!Array.isArray(payload.rounds))return deferRound('incomplete-round');
 const seen=new Set(),rows=[];
 for(const m of payload.rounds){
  check();const r=bound.get(m?.id);if(!r||r.roundNumber!==round||seen.has(m.id))fail('unknown-duplicate-round-identity');seen.add(m.id);
  const old=previous.events.find(e=>e.id===r.id),home=clubs.get(Number(r.homeParticipantId.split(':').at(-1))),away=clubs.get(Number(r.awayParticipantId.split(':').at(-1)));
  if(m.uuid!==r.officialMatchUuid||m.round_number!==round||m.round?.number!==round||m.home_team?.id!==Number(home.externalIds.ffa)||m.home_team.uuid!==home.externalIds.ffaUuid||m.away_team?.id!==Number(away.externalIds.ffa)||m.away_team.uuid!==away.externalIds.ffaUuid||m.group&&m.group.id!==r.groupId)fail('source-ordered-identity');
  const start=clock(m.start_date,-Infinity,Infinity,'source-start');if(start!==epoch(r.startTimeUtc)||m.timing!==1||m.time_accuracy!==1)fail('source-calendar-held');
  const explicit=m.status==='FullTime',live=['InProgress','Playing','HalfTime'].includes(m.status),info=m.match_info;
  if((explicit||live)&&start>observation)fail('future-playing-or-final');
  clock(m.last_updated,explicit?start:-Infinity,epoch(payload.timestamp),'provider-result-clock');
  if(explicit&&epoch(payload.timestamp)<start)fail('response-before-result');
  // Check every independently evaluable conflicting channel before deferral or
  // page completeness. A missing/unknown field cannot hide a known contradiction.
  for(const [side,key]of [['home_team','homeScore'],['away_team','awayScore']]){
   const numeric=info?.[side]?.score;if(integer(numeric)&&m[key]!=null&&m[key]!==numeric)fail('conflicting-score-channels');
   if(old.status==='completed'&&[numeric,m[key]].some(v=>integer(v)&&v!==old[key]))fail('accepted-final-conflict');
  }
  if(old.status==='completed'){
   if(!explicit)fail('accepted-final-reopened');
   for(const [side,key]of [['home_team','home'],['away_team','away']])if(integer(info?.[side]?.shootout_score)&&info[side].shootout_score!==old.shootout[key])fail('accepted-shootout-conflict');
   if(info?.period!=null&&info.period!==old.shootout.sourcePeriod||old.sourceWinnerId!==0&&info?.winner_id!=null&&info.winner_id!==old.sourceWinnerId)fail('accepted-result-conflict');
  }
  const good=explicit&&info&&['SecondHalf','ShootOut'].includes(info.period)&&['home_team','away_team'].every(k=>integer(info[k]?.score)&&integer(info[k]?.shootout_score))&&[0,m.home_team.id,m.away_team.id].includes(info.winner_id);
  if(explicit)assertResultConsistency(info,m.home_team.id,m.away_team.id,'independent-result-contradiction');
  rows.push({r,m,old,info,good});
 }
 const expected=scope.records.filter(r=>r.roundNumber===round);
 if(payload.rounds.length!==8||seen.size!==8||expected.some(r=>!seen.has(r.officialMatchId)))return {document:previous,changed:[],supported:0,deferrals:expected.filter(r=>r.target).map(r=>({id:r.id,reason:'incomplete-round',nextAction:'Review complete official round in a separately allocated source window'}))};
 const patches=new Map(),changed=[],deferrals=[];let supported=0;
 for(const {r,m,old,info,good}of rows){check();if(!r.target)continue;if(!good){deferrals.push({id:r.id,reason:'unsupported-final-fields',nextAction:'Review official final phase/paired scores/winner in a separately allocated window'});continue;}supported++;if(old.status==='completed')continue;
  const shootout={home:info.home_team.shootout_score,away:info.away_team.shootout_score,sourcePeriod:info.period},homeScore=info.home_team.score,awayScore=info.away_team.score,text=scoreText(old,homeScore,awayScore,shootout),sourceUrl=BASE+'/r'+round+'/fixture';
  const next={...old,status:'completed',homeScore,awayScore,shootout,sourceMatchInfo:{period:info.period,winner_id:info.winner_id,home_team:{score:homeScore,shootout_score:shootout.home},away_team:{score:awayScore,shootout_score:shootout.away}},sourceWinnerId:info.winner_id,score:text,scoreDisplay:text,result:text,canonicalResultScoreline:text,resultLabels:info.period==='ShootOut'?[`Penalties ${shootout.home}–${shootout.away}`]:[],scoreCheckedAt:observedAt,statusCheckedAt:observedAt,resultStatus:'official',resultSourceUrl:sourceUrl,resultSourceCheckedAt:observedAt,resultSourceEvidence:{sourceUrl,bodySha256,observedAt,providerUpdatedAt:m.last_updated,responseTimestamp:payload.timestamp}};
  if(info.winner_id!==0)next.winnerParticipantId='team:football:australian-championship:'+info.winner_id;
  validateRetainedFinal(next,now);patches.set(old.id,next);changed.push(r.canonicalEventId);
 }
 return {document:{...previous,events:previous.events.map(r=>patches.get(r.id)||r)},changed,deferrals,supported};
}
function combine(results,previous,sourceFailures=[]){
 const supported=results.reduce((n,r)=>n+r.supported,0);if(!supported)fail('no-supported-target-finals');
 const changed=results.flatMap(r=>r.changed),byId=new Map(results.flatMap(r=>r.document.events.filter(e=>r.changed.includes(e.canonicalEventId))).map(e=>[e.id,e]));
 return {document:{...previous,events:previous.events.map(e=>byId.get(e.id)||e)},changed,supported,deferrals:results.flatMap(r=>r.deferrals),sourceFailures};
}
function selectedIds(ids){if(!Array.isArray(ids)||!ids.length||ids.length>11||new Set(ids).size!==ids.length||ids.some(id=>!canonical.get(id)?.target))fail('invalid-projection-selector');return new Set(ids);}
function projectRows(rows,document,ids){const selected=selectedIds(ids),found=new Set(),source=new Map(document.events.map(e=>[e.canonicalEventId,e]));const next=rows.map(r=>{if(!selected.has(r.canonicalEventId))return r;const e=source.get(r.canonicalEventId),b=canonical.get(r.canonicalEventId);if(found.has(r.canonicalEventId)||r.id!==b.canonicalEventId||r.competitionId!==COMPETITION||r.homeParticipantId!==b.homeParticipantId||r.awayParticipantId!==b.awayParticipantId||r.startTimeUtc!==b.projectionStartTimeUtc||e?.status!=='completed')fail('projection-binding');found.add(r.canonicalEventId);return {...r,...Object.fromEntries(RESULT_FIELDS.filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]))};});if(found.size!==selected.size)fail('missing-projection-target');return next;}
function assertLegacyRebuildSafe(root){
 const file=path.join(root,FILE);if(!fs.existsSync(file))return;const d=JSON.parse(fs.readFileSync(file,'utf8'));
 if(d.events?.some(e=>bound.get(e.officialMatchId)?.target&&sha(e)!==bound.get(e.officialMatchId).recordSha256)){validateDocument(d);fail('legacy-rebuild-with-adopted-finals-held');}
}
function preserveAccepted(document,previous,now=new Date()){
 // Old complete facts can rebuild calendars but never erase adopted result facts.
 validateDocument(previous,now);if(sha({...document,events:[]})!==scope.headerSha256)fail('legacy-document-changed');
 if(document.events.length!==48)fail('legacy-inventory');
 const next={...document,events:document.events.map((e,i)=>{const old=previous.events[i],r=scope.records[i];if(sha(e)!==r.recordSha256)fail('legacy-baseline-changed');return r.target&&old.status==='completed'?old:e;})};return validateDocument(next,now);
}
module.exports={scope,FILE,COMPETITION,BASE,RESULT_FIELDS,sha,epoch,clock,route,strip,preflight,validateDocument,evaluate,combine,selectedIds,projectRows,preserveAccepted,assertLegacyRebuildSafe};
