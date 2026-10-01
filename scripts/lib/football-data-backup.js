'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {setTimeout:pause}=require('node:timers/promises');
const trial=require('./football-data-trial');
const overlay=require('../../lib/football-delayed-results');
const ROOT=path.resolve(__dirname,'../..');
const OUTPUT=path.join(ROOT,'data/canonical/football-delayed-results.v1.json');
const SOURCE='https://www.football-data.org/';
const coordinators=new Map();
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=`${file}.${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(value)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
function session(){
  if(!process.env.FOOTBALL_DATA_RUN_DIR)process.env.FOOTBALL_DATA_RUN_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'ns-football-backup-'));
  return process.env.FOOTBALL_DATA_RUN_DIR;
}
function safe(message){return String(message||'source unavailable').replace(/https?:\/\/\S+/g,SOURCE).replace(/\b[a-f0-9]{32}\b/gi,'[redacted]').slice(0,200);}
function record(row,{directory=session(),now=new Date()}={}){
  const file=path.join(directory,'report.json');const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{schemaVersion:'football-data-backup-report.v1',checkedAt:now.toISOString(),checks:[]};
  report.checks.push(row);write(file,report);
  if(process.env.FOOTBALL_DATA_REPORT&&directory===process.env.FOOTBALL_DATA_RUN_DIR)write(process.env.FOOTBALL_DATA_REPORT,report);
  return report;
}
function createCoordinator({directory=session(),token=process.env.FOOTBALL_DATA_API_TOKEN,fetchImpl=fetch,now=Date.now,wait=pause,timeoutMs=15000}={}){
  if(coordinators.has(directory))return coordinators.get(directory);
  let queue=Promise.resolve();
  const request=function(code,resource){
    if(!trial.SCOPE[code]||!['matches','standings'].includes(resource))return Promise.reject(Error('Unreviewed backup resource'));
    const work=queue.then(async()=>{
      const cache=path.join(directory,`${code}-${resource}.json`);
      if(fs.existsSync(cache)){const value=JSON.parse(fs.readFileSync(cache));if(value.error)throw Error(value.error);return value;}
      if(typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))throw Error('FOOTBALL_DATA_API_TOKEN unavailable to canonical refresh');
      const stateFile=path.join(directory,'budget.json');const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{calls:0,lastStarted:null};
      if(state.calls>=4)throw Error('Football backup invocation budget exhausted');
      if(state.lastStarted!==null)await wait(Math.max(0,6500-(now()-state.lastStarted)));
      state.calls++;state.lastStarted=now();write(stateFile,state);
      const url=`https://api.football-data.org/v4/competitions/${code}/${resource}?season=2026`;
      try{
        const response=await fetchImpl(url,{headers:{Accept:'application/json','X-Auth-Token':token},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        let raw='';if(response.body?.[Symbol.asyncIterator]){let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=Buffer.byteLength(chunk);if(bytes>2_000_000)throw Error('response budget exceeded');chunks.push(Buffer.from(chunk));}raw=Buffer.concat(chunks).toString('utf8');}else raw=await response.text();
        if(Buffer.byteLength(raw)>2_000_000||raw.includes(token))throw Error('unsafe response');
        const value={url,checkedAt:new Date(now()).toISOString(),payload:JSON.parse(raw)};write(cache,value);return value;
      }catch(error){const message=/^HTTP \d{3}$/.test(error.message)?`Football backup ${error.message}`:'Football backup request failed; details withheld';write(cache,{error:message});throw Error(message);}
    });queue=work.catch(()=>{});return work;
  };coordinators.set(directory,request);return request;
}
function readOverlay(file=OUTPUT){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{schemaVersion:'football-delayed-results.v1',results:[]};}
function reconcile(known,candidate,{now=new Date()}={}){
  const age=now.getTime()-Date.parse(candidate.checkedAt);
  if(!Number.isFinite(age)||age<0||age>30*3600000)throw Error('Backup observation stale or future');
  const comparison=trial.compareFixtures(known,candidate.fixtures);
  if(comparison.matched!==known.length||comparison.matched!==candidate.fixtures.length||comparison.exactKickoffs!==comparison.matched||comparison.differences.length||comparison.results.referenceOnly)throw Error('Backup conflicts with last-good fixtures or results');
  const byKey=new Map(candidate.fixtures.map(f=>[trial.fixtureKey(f),f]));
  return known.filter(f=>!f.result&&byKey.get(trial.fixtureKey(f)).result).map(f=>{
    const next=byKey.get(trial.fixtureKey(f));
    if(next.providerStatus!=='FINISHED'||Date.parse(next.sourceUpdatedAt)>now.getTime()||Date.parse(next.sourceUpdatedAt)<Date.parse(f.startTimeUtc)||Date.parse(f.startTimeUtc)>now.getTime())throw Error('Backup final has invalid status or timestamp');
    return {fixtureId:f.fixtureId||f.providerFixtureId,competitionId:candidate.competitionId,
      homeParticipantId:f.homeParticipantId,awayParticipantId:f.awayParticipantId,roundNumber:f.roundNumber,
      homeScore:next.result.homeScore,awayScore:next.result.awayScore,providerFixtureId:next.providerFixtureId,
      sourceUrl:SOURCE,sourceCheckedAt:candidate.checkedAt,sourceUpdatedAt:next.sourceUpdatedAt};
  });
}
function asFixture(e){return {fixtureId:e.id||e.eventId,providerFixtureId:e.id||e.eventId,homeParticipantId:e.homeParticipantId,awayParticipantId:e.awayParticipantId,
  roundNumber:e.roundNumber,startTimeUtc:e.startTimeUtc,result:e.status==='completed'&&Number.isSafeInteger(e.homeScore)&&Number.isSafeInteger(e.awayScore)?{homeScore:e.homeScore,awayScore:e.awayScore}:null};}
async function recover({code,events,primaryError,outputPath=OUTPUT,coordinator=createCoordinator(),now,directory=session()}={}){
  const previous=readOverlay(outputPath);const known=overlay.apply(events,previous);
  try{
    const observation=await coordinator(code,'matches');const facts=trial.normalizeMatches(observation.payload,{code,checkedAt:observation.checkedAt});
    const additions=reconcile(known.map(asFixture),facts,{now:now||new Date()});
    // Tables remain evidence only. A table failure cannot erase valid fixture recovery.
    let table;
    try{const observation=await coordinator(code,'standings');table={state:'observed',checkedAt:observation.checkedAt,rows:trial.normalizeStandings(observation.payload,{code}).length};}
    catch(error){table={state:'unavailable',message:safe(error.message)};}
    if(additions.length)write(outputPath,{...previous,results:[...previous.results,...additions]});
    const row={code,state:'backup',primaryFailure:safe(primaryError?.message),newFinals:additions.length,checkedAt:observation.checkedAt,table};record(row,{directory,now:now||new Date()});
    return {recovered:true,events:overlay.apply(events,readOverlay(outputPath)),row};
  }catch(error){const row={code,state:'last-good',primaryFailure:safe(primaryError?.message),backupFailure:safe(error.message),newFinals:0};record(row,{directory,now:now||new Date()});return {recovered:false,events:known,row};}
}
async function compareTable({code,entries,primaryError,coordinator=createCoordinator(),directory=session(),now=new Date()}={}){
  try{
    const observation=await coordinator(code,'standings');const rows=trial.normalizeStandings(observation.payload,{code});
    const byId=new Map(rows.map(row=>[row.participantId,row]));
    const fields=['played','won','drawn','lost','ladderPoints','pointsFor','pointsAgainst','pointsDifference'];
    const differences=entries.filter(e=>!byId.has(e.participantId)||fields.some(f=>e[f]!==byId.get(e.participantId)[f])).length;
    record({code,state:'table-comparison',primaryFailure:safe(primaryError?.message),table:{state:'observed',checkedAt:observation.checkedAt,rows:rows.length,differingRows:differences}},{directory,now});
    return {rows:rows.length,differingRows:differences};
  }catch(error){record({code,state:'last-good-table',primaryFailure:safe(primaryError?.message),backupFailure:safe(error.message)},{directory,now});return null;}
}
function primary(events,{outputPath=OUTPUT}={}){
  const previous=readOverlay(outputPath);const completed=new Set(events.filter(e=>e.status==='completed').map(e=>String(e.id||e.eventId)));
  const results=previous.results.filter(r=>!completed.has(r.fixtureId));
  if(results.length!==previous.results.length)write(outputPath,{...previous,results});
  return overlay.apply(events,{...previous,results});
}
module.exports={compareTable,createCoordinator,reconcile,recover,primary,readOverlay,record,session,asFixture,OUTPUT};
