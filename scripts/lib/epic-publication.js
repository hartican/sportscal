'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),db=require('../../lib/epic-classics');
const sourcePath='data/editorial-post-match.v1.json',read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function publicationPlan(jobs,articles,served){
 const entries=new Map(articles.entries.map(e=>[e.eventId,e])),published=[],deferred=[];
 for(const job of jobs.filter(j=>j.status==='staged'&&!j.held&&j.editorial_eligible!==false)){
  const copy=entries.get(job.event_id),event=served.find(e=>require('../../lib/nothingscore-server').canonicalEventId(e.canonicalEventId||e.eventId||e.id)===job.event_id);
  let reason=!copy?'Published source has no article.':copy.resultSignature!==job.result_signature?'Verified result changed.':db.hash(copy)!==db.hash({eventId:job.event_id,...job.staged_copy})?'Published source differs from staged research.':null;
  if(!reason&&event&&!require('../../config/editorial-maintenance').protectedFixture(event)&&db.policy.completed(event)&&db.hash(event.postMatchEditorial)!==db.hash(copy))reason='Served card did not preserve staged Impact copy.';
  if(reason)deferred.push({job,reason});else published.push({job,copy});
 }
 return{published,deferred};
}
async function recordRelease({args,source,control,request}){
 const sha=args[args.indexOf('--record-release')+1],proofPath=args[args.indexOf('--release-proof')+1];assert(/^[a-f0-9]{40}$/.test(sha)&&args.includes('--release-proof')&&proofPath,'Exact release SHA and production proof required.');
 const proof=read(proofPath),inventory=read(path.join(path.dirname(proofPath),'deployment-files.json')),articles=read(sourcePath);
 assert.equal(proof.sha,sha);assert.equal(proof.deployment?.sha,sha);assert.equal(proof.deployment?.state,'READY');assert.equal(proof.deployment?.target,'production');assert.equal(spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),sha);
 assert.equal(articles.sourceRevision,db.hash(articles.entries));assert.equal(require('./editorial-source-release').verifySourceInventory(sha,inventory,fs.readFileSync(sourcePath),sourcePath),articles.sourceRevision);
 const current=require('./vercel-project').project().targets?.production;assert.equal(current?.readyState,'READY');assert.equal(require('./vercel-project').sha(current),sha);assert.equal(current.id||current.uid,proof.deployment.id);
 const [versionResponse,feedResponse]=await Promise.all([fetch('https://nothingsport.vercel.app/app-version.json?release='+sha,{cache:'no-store'}),fetch('https://nothingsport.vercel.app/data/events.json?release='+sha,{cache:'no-store'})]);assert(versionResponse.ok&&feedResponse.ok,'Production source proof unavailable.');assert.deepEqual(await versionResponse.json(),read('app-version.json'));const served=await feedResponse.json();assert.equal(served.version,read('data/events.json').version);
 const jobs=control?.jobs||await require('../epic-editorial').allJobs(request),plan=publicationPlan(jobs,articles,served.events),operations=[],records=[];
 for(const {job,copy} of plan.published){const event=source.events.find(e=>e.canonicalEventId===job.event_id)||{...job.fixture,id:job.event_id};const observed=require('../epic-editorial').mergeObservation(event,job);records.push(db.recordFor({...observed,status:'completed',postMatchEditorial:copy},{publishedSha:sha,held:job.held}));operations.push({eventId:job.event_id,revision:job.revision,change:{status:'published',published_signature:job.result_signature,last_error:null,revision:job.revision+1}});}
 const recordedIds=new Set(records.map(r=>r.eventId)),preserved=new Set(jobs.filter(j=>j.tier===5).map(j=>j.event_id));
 for(const event of source.events)if(!recordedIds.has(event.canonicalEventId)&&(preserved.has(event.canonicalEventId)||db.recordFor(event).nsScore===5)){const job=jobs.find(j=>j.event_id===event.canonicalEventId);records.push(db.recordFor(require('../epic-editorial').mergeObservation(event,job),{publishedSha:sha}));}
 for(const {job,reason} of plan.deferred)operations.push({eventId:job.event_id,revision:job.revision,change:{last_error:{reason,nextAction:'Repair served projection or submit research for the changed result.'},revision:job.revision+1}});
 if(control){const file=process.env.NS_EPIC_CHECK_REPORT;assert(file&&path.isAbsolute(file)&&!file.startsWith(path.resolve(__dirname,'../..')+path.sep),'Private publication CAS report required.');fs.writeFileSync(file,JSON.stringify({sourceRevision:source.sourceRevision,day:db.policy.day(new Date()),sha,records,operations},null,2)+'\n',{mode:0o600});fs.chmodSync(file,0o600);}
 else{const protectedIds=new Set(operations.map(o=>o.eventId)),transactionRecords=records.filter(r=>protectedIds.has(r.eventId));await db.rpc('commit_epic_publication',{records:transactionRecords,operations},request);const ordinary=records.filter(r=>!protectedIds.has(r.eventId));for(let i=0;i<ordinary.length;i+=100)await db.rpc('record_classic_fixtures',{records:ordinary.slice(i,i+100)},request);}
 return{sha,published:plan.published.map(p=>p.job.event_id),deferred:plan.deferred.map(p=>({id:p.job.event_id,reason:p.reason})),controlWrites:control?'prepared-CAS':'confirmed'};
}
module.exports={publicationPlan,recordRelease};
