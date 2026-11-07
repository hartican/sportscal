'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SCHEMA='golf-source-report.v1';
const STATES=['fetched','accepted','failed','unpublished','not-attested'];
const RESOURCES=['calendar','tee-times','field','pairings','entries','participation','results','team-contests'];
const STATUSES=['upcoming','scheduled','live','completed','cancelled','suspended','postponed'];
const EVIDENCE=['official-tournament','official-calendar','official-pairings','official-final','retained-calendar','not-attested'];
const validCode=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(value);
const bounded=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\r\n\x00]/.test(value);
function validate(doc,now=new Date()){
  const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=+now;
  if(doc?.schemaVersion!==SCHEMA||!bounded(doc.runId,80)||!['full','quick','offline','owner'].includes(doc.mode)||!stamp(doc.checkedAt)||!Array.isArray(doc.checks)||doc.checks.length>500||!Array.isArray(doc.resultsPasses)||doc.resultsPasses.length>10)throw Error('invalid_golf_report');
  for(const row of doc.checks){
    if(!RESOURCES.includes(row.resource)||!STATES.includes(row.state)||!validCode(row.code)||!stamp(row.checkedAt)||Date.parse(row.checkedAt)>Date.parse(doc.checkedAt)||row.sourceUrl!==null&&sourceUrl(row.sourceUrl)!==row.sourceUrl||row.retainedFactAt!==null&&(!stamp(row.retainedFactAt)||Date.parse(row.retainedFactAt)>Date.parse(row.checkedAt))||row.status!==null&&!STATUSES.includes(row.status)||row.statusEvidence!==null&&!EVIDENCE.includes(row.statusEvidence)||[['tournamentId',100],['name',200],['competitionId',100]].some(([key,max])=>row[key]!==null&&!bounded(row[key],max)))throw Error('invalid_golf_check');
  }
  for(const pass of doc.resultsPasses)if(!stamp(pass.checkedAt)||Date.parse(pass.checkedAt)>Date.parse(doc.checkedAt)||!Number.isSafeInteger(pass.checked)||pass.checked<0||pass.checked>4||!Array.isArray(pass.failures)||pass.failures.length>pass.checked||pass.failures.some(f=>!bounded(f.id,100)||!validCode(f.code)))throw Error('invalid_golf_results_pass');
  return doc;
}
function sourceUrl(value){
  try{const u=new URL(value);if(!['https://www.pgatour.com','https://www.lpga.com','https://www.presidentscup.com','https://presidentscup.com'].includes(u.origin)||u.username||u.password)return null;return u.origin+u.pathname;}catch{return null;}
}
function errorCode(error){
  if(['TimeoutError','AbortError'].includes(error?.name)||/timed? ?out/i.test(error?.message||''))return 'timeout';
  const http=/\bHTTP (\d{3})\b/.exec(error?.message||'');if(http)return 'http-'+http[1];
  return error?.code==='GOLF_TRANSPORT'?'transport':'invalid-response';
}
function read({file=process.env.GOLF_SOURCE_REPORT,runId=process.env.GOLF_SOURCE_RUN_ID,now=new Date()}={}){
  if(!file||!fs.existsSync(file))return null;
  const info=fs.lstatSync(file);if(!info.isFile()||info.size>5*1024*1024)throw Error('invalid_golf_report_file');
  const doc=JSON.parse(fs.readFileSync(file));return doc.schemaVersion===SCHEMA&&doc.runId===runId?validate(doc,now):null;
}
function create({file=process.env.GOLF_SOURCE_REPORT,runId=process.env.GOLF_SOURCE_RUN_ID||crypto.randomUUID(),mode='owner',clock=()=>new Date()}={}){
  const report=read({file,runId,now:clock()})||{schemaVersion:SCHEMA,runId,checkedAt:clock().toISOString(),mode,checks:[],resultsPasses:[]};
  function save(){
    report.checkedAt=clock().toISOString();
    if(file){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(report,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
  }
  function record(row){
    if(!STATES.includes(row.state)||!RESOURCES.includes(row.resource)||report.checks.length>=500)throw Error('Invalid or excessive Golf source observation');
    // Never persist transport messages, page bodies, credentials or query strings.
    const checkedAt=row.checkedAt||clock().toISOString();
    const clean={resource:row.resource,state:row.state,code:row.code||'observed',checkedAt,sourceUrl:sourceUrl(row.sourceUrl),tournamentId:row.tournamentId||null,name:row.name||null,competitionId:row.competitionId||null,retainedFactAt:row.retainedFactAt||null,status:row.status||null,statusEvidence:row.statusEvidence||null};
    validate({...report,checkedAt:clock().toISOString(),checks:[...report.checks,clean]},clock());
    report.checks.push(clean);save();return clean;
  }
  function resultsPass(result){
    const pass={checkedAt:clock().toISOString(),checked:result.checked,failures:result.failures.map(f=>({id:f.id,code:f.code||errorCode({message:f.message})}))};
    validate({...report,checkedAt:clock().toISOString(),resultsPasses:[...report.resultsPasses,pass]},clock());
    report.resultsPasses.push(pass);save();
  }
  return {report,record,resultsPass,save};
}
function reusableResults({file,runId,now=new Date()}={}){
  const doc=read({file,runId,now});const pass=doc?.resultsPasses?.at(-1);
  const age=+now-Date.parse(pass?.checkedAt);
  return pass&&Number.isFinite(age)&&age>=0&&age<6*3600000&&Number.isSafeInteger(pass.checked)&&pass.checked>=0&&pass.checked<=4&&Array.isArray(pass.failures)&&pass.failures.length<=pass.checked&&pass.failures.every(f=>typeof f.id==='string'&&typeof f.code==='string')?pass:null;
}
module.exports={SCHEMA,STATES,RESOURCES,sourceUrl,errorCode,read,create,reusableResults,validate};
