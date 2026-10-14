'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const db=require('../lib/epic-classics'),policy=db.policy;
const sourceFile='data/editorial-post-match.v1.json';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function sources(){
 const events=[...read('data/editorial-maintenance-sources.v1.json').events,...require('../lib/calendar-catalogue').catalogue()];
 const map=new Map();for(const event of events){if(['major_event','tournament','ticket_sale'].includes(event.kind)||event.cardType==='tournament_overview')continue;const id=require('../lib/nothingscore-server').canonicalEventId(event.canonicalEventId||event.eventId||event.id);if(!id)continue;if(!map.has(id))map.set(id,{...event,canonicalEventId:id});else{const old=map.get(id);old.sourceEventIds=[...new Set([...(old.sourceEventIds||[]),event.id,event.eventId,...(event.sourceEventIds||[])].filter(Boolean))];}}
 const rows=[...map.values()],revision=db.hash(rows);return{events:rows,sourceRevision:revision};
}
function snapshot(source){
 const file=process.env.NS_EPIC_CONTROL_SNAPSHOT;if(!file)return null;
 assert(path.isAbsolute(file)&&!file.startsWith(path.resolve(__dirname,'..')+path.sep),'Private EPIC control snapshot must be outside the checkout.');assert.equal(fs.statSync(file).mode&0o077,0,'Private EPIC snapshot permissions required.');
 const data=read(file),age=Date.now()-Date.parse(data.capturedAt);assert(age>=0&&age<=900000,'Fresh EPIC snapshot required.');assert.equal(data.sourceRevision,source.sourceRevision);assert(data.complete===true&&Array.isArray(data.jobs),'Complete EPIC backlog required.');return data;
}
async function allJobs(request){let result=[];for(let offset=0;;offset+=500){const rows=await request(db.path('editorial_backlog',{select:'*',order:'event_id.asc',limit:'500',offset:String(offset)}));result.push(...rows);if(rows.length<500)return result;}}
function mergeObservation(event,job){const facts=job?.observations||{};return Object.keys(facts).length?require('../config/fixture-identity').mergeOverlays([event],[{...facts,canonicalEventId:event.canonicalEventId}])[0]:event;}
function validateEntry(entry,job){
 assert.equal(entry.eventId,job.event_id);assert.equal(entry.resultSignature,job.result_signature,'Research must match the verified result signature.');assert(policy.completed(job.fixture),'Confirmed completion is required.');
 assert(typeof entry.hook==='string'&&entry.hook.trim()&&entry.hook.length<=350,'Provide a fixture-specific original hook.');
 for(const key of ['whatHappened','decisiveDevelopments','whyItMatters'])assert(typeof entry[key]==='string'&&entry[key].trim(),'Provide '+key+'.');
 const body=[entry.whatHappened,entry.decisiveDevelopments,entry.whyItMatters].join('\n\n'),words=body.trim().split(/\s+/).length,[min,max]=({3:[100,180],4:[200,300],5:[350,500]})[job.tier];
 assert(words>=min&&words<=max,'Use the agreed '+job.tier+'/5 depth; defer thin evidence rather than padding.');
 const urls=[...new Set(entry.sourceUrls||[])];assert(urls.length>=({3:1,4:2,5:3})[job.tier]&&urls.every(u=>{try{const parsed=new URL(u);return parsed.protocol==='https:'&&!!parsed.hostname&&!parsed.username&&!parsed.password;}catch{return false;}}),'Retain official/trusted sources for the research depth.');
 assert(Array.isArray(entry.facts)&&entry.facts.length>=({3:2,4:4,5:6})[job.tier]&&entry.facts.every(f=>f.text?.trim()&&urls.includes(f.sourceUrl)),'Source every retained factual building block.');
 const at=Date.parse(entry.researchedAt);assert(Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<=86400000,'Fresh research observation required.');
 assert(!/next consequence-bearing chapter|this fixture will be important|sports bring us all together/i.test(body),'Generic or moralising filler cannot publish.');
 return{hook:entry.hook.trim(),body,sourceUrls:urls,facts:entry.facts,researchedAt:entry.researchedAt,tier:job.tier,resultSignature:job.result_signature,factsSignature:job.facts_signature};
}
async function main(args){
 const source=sources();
 if(args.includes('--prepare-registration')){
  const target=args[args.indexOf('--prepare-registration')+1];assert(target&&path.isAbsolute(target)&&!target.startsWith(path.resolve(__dirname,'..')+path.sep),'Private registration report outside Git required.');
  const records=source.events.map(e=>({...db.recordFor(e),copies:[]})).filter(r=>args.includes('--all-known')||r.nsScore>=3);
  fs.writeFileSync(target,JSON.stringify({sourceRevision:source.sourceRevision,day:policy.day(new Date()),records,operations:[]},null,2)+'\n',{mode:0o600});fs.chmodSync(target,0o600);console.log(JSON.stringify({prepared:records.length,databaseWrites:false}));return;
 }
 if(args.includes('--prepare-control')){console.log(JSON.stringify({sourceRevision:source.sourceRevision,groups:source.events.map(e=>({eventId:e.canonicalEventId,aliases:[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean)})),privateTables:['editorial_backlog','editorial_daily_budget'],day:policy.day(new Date())}));return;}
 if(args.includes('--apply')){const file=read(sourceFile);apply(file);return;}
 if(process.env.NS_EDITORIAL_ENV_FILE)process.loadEnvFile(process.env.NS_EDITORIAL_ENV_FILE);
 const control=snapshot(source),request=require('../lib/supabase-server').supabaseServiceRequest;
 if(args.includes('--record-release'))return require('./lib/epic-publication').recordRelease({args,source,control,request});
 if(args.includes('--dry-run')){console.log(JSON.stringify({sourceRevision:source.sourceRevision,knownFixtures:source.events.length,publishedNsQualified:source.events.filter(e=>Number(e.stakesScore)>=3).length,publishedNsFives:source.events.filter(e=>Number(e.stakesScore)===5).length,registeredVotesNotRead:true,databaseWrites:false}));return;}
 if(args.includes('--backfill')){
  assert(!control,'Backfill is an explicitly verified database operation, not an offline claim.');
  const jobs=await allJobs(request),byId=new Map(jobs.map(j=>[j.event_id,j]));
  await db.record(source.events.map(e=>mergeObservation(e,byId.get(e.canonicalEventId))),{request,captureCopies:false});
  const result=await db.rpc('backfill_classics',{},request);
  await db.record(source.events.map(e=>mergeObservation(e,byId.get(e.canonicalEventId))),{request});
  const accepted=await require('./lib/epic-accepted-history').recover({request,jobs:await allJobs(request)});await require('./lib/epic-accepted-history').persist(accepted.records,request);
  console.log(JSON.stringify({...result,acceptedFixturesRecovered:accepted.records.length,acceptedFixtureDetailsUnavailable:accepted.unavailable,sourceRevision:source.sourceRevision,unavailableHistoricalCopy:'Remains explicitly unavailable.'}));return;
 }
 let jobs=control?control.jobs:await allJobs(request);
 if(!control){const lookup=new Map(jobs.map(j=>[j.event_id,j]));const known=source.events.filter(e=>lookup.has(e.canonicalEventId)||db.recordFor(e).nsScore>=3).map(e=>mergeObservation(e,lookup.get(e.canonicalEventId)));await db.record(known,{request,captureCopies:false});jobs=await allJobs(request);}
 if(args.includes('--claim')){assert(!control,'Use the authorised connector claim RPC for a private snapshot.');jobs=await db.rpc('claim_epic_editorial',{claim_day:policy.day(new Date())},request);}
 const candidates=jobs.filter(j=>j.fixture?.completed&&!j.held&&j.editorial_eligible!==false&&['due','deferred','researching'].includes(j.status));
 const staged=jobs.filter(j=>!j.held&&j.editorial_eligible!==false&&j.status==='staged'&&j.staged_copy?.resultSignature===j.result_signature);
 if(staged.length){const file=read(sourceFile),map=new Map(file.entries.map(e=>[e.eventId,e]));for(const j of staged)map.set(j.event_id,{eventId:j.event_id,...j.staged_copy});const entries=[...map.values()].sort((a,b)=>a.eventId.localeCompare(b.eventId));if(db.hash(entries)!==db.hash(file.entries)){file.entries=entries;file.sourceRevision=db.hash(entries);fs.writeFileSync(sourceFile,JSON.stringify(file,null,2)+'\n');apply(file);}}
 if(args.includes('--list')||args.includes('--claim')){console.log(JSON.stringify({sourceRevision:source.sourceRevision,day:policy.day(new Date()),jobs:candidates,budget:control?.budget||null,queued:jobs.length},null,2));return;}
 const index=args.indexOf('--research');assert(index>=0&&args[index+1],'Use --list/--claim or --research <file>.');const research=read(args[index+1]);assert.equal(research.sourceRevision,source.sourceRevision);assert.equal(research.day,policy.day(new Date()));
 const file=fs.existsSync(sourceFile)?read(sourceFile):{schemaVersion:'editorial-post-match.v1',entries:[]},byEntry=new Map(file.entries.map(e=>[e.eventId,e])),operations=[],updated=[],deferred=[];
 for(const job of candidates.filter(j=>j.status==='researching'&&j.attempt_day===research.day)){
  const entry=research.entries?.find(e=>e.eventId===job.event_id),reason=research.deferred?.find(e=>e.eventId===job.event_id);let change;
  try{if(!entry)throw Error(reason?.reason||'Research was not supplied.');const copy=validateEntry(entry,job);byEntry.set(job.event_id,{eventId:job.event_id,...copy});change={staged_copy:copy,status:'staged',last_error:null,revision:job.revision+1};updated.push(job.event_id);}
  catch(error){change={status:'deferred',last_error:{reason:error.message,nextAction:reason?.nextAction||'Verify sources and submit complete fixture-specific research.'},revision:job.revision+1};deferred.push({id:job.event_id,...change.last_error});}
  if(control)operations.push({eventId:job.event_id,revision:job.revision,change});
  else{const result=await request(db.path('editorial_backlog',{event_id:'eq.'+job.event_id,revision:'eq.'+job.revision,held:'eq.false'}),{method:'PATCH',headers:{Prefer:'return=representation'},body:change});assert.equal(result.length,1,'EPIC editorial changed or was held; stop publication.');}
 }
 if(control){const report=process.env.NS_EPIC_CHECK_REPORT;assert(report&&path.isAbsolute(report)&&!report.startsWith(path.resolve(__dirname,'..')+path.sep),'Private EPIC CAS report required.');fs.writeFileSync(report,JSON.stringify({sourceRevision:source.sourceRevision,day:research.day,operations},null,2)+'\n',{mode:0o600});fs.chmodSync(report,0o600);}
 if(updated.length){file.entries=[...byEntry.values()].sort((a,b)=>a.eventId.localeCompare(b.eventId));file.sourceRevision=db.hash(file.entries);fs.writeFileSync(sourceFile,JSON.stringify(file,null,2)+'\n');apply(file);}
 console.log(JSON.stringify({updated,deferred,controlWrites:control?'prepared-CAS':'confirmed',publication:'Not published until the existing exact-SHA release and served-card proof.'}));
}
function apply(file=read(sourceFile)){
 const byId=new Map(file.entries.map(e=>[e.eventId,e]));
 for(const target of ['feeds/incoming/events.json','data/events.json']){const document=read(target);let changed=false;for(const event of document.events){const id=require('../lib/nothingscore-server').canonicalEventId(event.canonicalEventId||event.eventId||event.id),copy=byId.get(id);if(!copy||!policy.completed(event))continue;const signature=db.recordFor(event).resultSignature;if(copy.resultSignature!==signature)continue;if(!require('../config/editorial-maintenance').protectedFixture(event)){if(db.hash(event.postMatchEditorial)!==db.hash(copy)){event.postMatchEditorial=copy;changed=true;}}}
  if(changed)fs.writeFileSync(target,JSON.stringify(document,null,2)+'\n');
 }
}
module.exports={main,sources,validateEntry,apply,allJobs,mergeObservation};
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
