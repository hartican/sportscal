'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const policy=require('../config/editorial-maintenance'),store=require('../lib/editorial-maintenance');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,data)=>fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
function buildSources(){
  const source=read('data/comms-sources.v1.json'),knowledge=read('data/editorial-knowledge.v1.json'),feed=read('data/events.json');
  const resolve=require('../lib/fixture-editorial').createResolver(knowledge,feed.events);
  const events=require('../config/fixture-identity').mergeOverlays(source.events,feed.events).map(resolve).map(event=>{
    const urls=(event.editorialNarrative?.sourceIds||[]).map(id=>knowledge.sources.find(s=>s.id===id)?.url).filter(Boolean);
    return {...event,editorialSources:[...new Set(urls)]};
  });
  const sourceRevision=crypto.createHash('sha256').update(JSON.stringify(events)).digest('hex');
  fs.writeFileSync('data/editorial-maintenance-sources.v1.json',JSON.stringify({schemaVersion:'editorial-maintenance-sources.v1',sourceRevision,events})+'\n');
  return {events:events.length,sourceRevision};
}
async function main(args){
  if(args.includes('--build-sources')){console.log(JSON.stringify(buildSources()));return;}
  if(args.includes('--prepare-control')){
    const source=store.sources(),now=new Date();
    console.log(JSON.stringify({sourceRevision:source.sourceRevision,groups:source.events.filter(e=>policy.schedule(e,{},now).inWindow).map(e=>({event_id:e.id,aliases:policy.ids(e)}))}));return;
  }
  // Local operators may load a private environment file without printing secrets.
  if(process.env.NS_EDITORIAL_ENV_FILE)process.loadEnvFile(process.env.NS_EDITORIAL_ENV_FILE);
  if(args.includes('--record-release')){
    const sha=args[args.indexOf('--record-release')+1];assert(/^[a-f0-9]{40}$/.test(sha),'Full verified release SHA required.');
    const proofPath=args[args.indexOf('--release-proof')+1];assert(args.includes('--release-proof')&&proofPath,'Provide --release-proof <pipeline production-verification.json>.');
    const proof=read(proofPath);assert.equal(proof.sha,sha);assert.equal(proof.deployment?.sha,sha);assert.equal(proof.deployment?.state,'READY');assert.equal(proof.deployment?.target,'production');
    const head=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});assert.equal(head.status,0);assert.equal(head.stdout.trim(),sha,'Record publication from the exact released checkout.');
    // Server research is not a public download. Bind its exact source/transform
    // to the existing release inventory and freshly verified production target.
    const inventory=read(require('node:path').join(require('node:path').dirname(proofPath),'deployment-files.json'));
    const release=require('./lib/editorial-source-release'),local=store.sources();
    assert.equal(release.verifySourceInventory(sha,inventory,fs.readFileSync(release.sourcePath)),local.sourceRevision);
    const vercel=require('./lib/vercel-project'),current=vercel.project().targets?.production;
    assert.equal(current?.readyState,'READY','Current production is not READY.');
    assert.equal(vercel.sha(current),sha,'Current production does not match the release proof.');
    assert.equal(current.id||current.uid,proof.deployment.id,'Current production deployment differs from the release proof.');
    const app=await fetch('https://nothingsport.vercel.app/app-version.json?release='+sha,{cache:'no-store'});assert(app.ok,'Production release metadata unavailable.');
    assert.deepEqual(await app.json(),read('app-version.json'),'Wrong production shell revision.');
    const servedResponse=await fetch('https://nothingsport.vercel.app/data/events.json?release='+sha,{cache:'no-store'});assert(servedResponse.ok,'Served cards unavailable.');
    const served=await servedResponse.json();assert.equal(served.version,read('data/events.json').version,'Wrong production feed revision.');
    // The artifact is research, not proof of visible copy. Verify the served
    // fixture without enriching it from knowledge and isolate card-local gaps.
    const request=process.env.NS_EDITORIAL_CONTROL_SNAPSHOT?require('../lib/editorial-control-snapshot').request:require('../lib/supabase-server').supabaseServiceRequest,rows=await request(store.query({select:'*',limit:'1000'}));
    assert(rows.length<1000,'Refusing a partial publication control snapshot.');
    const plan=require('./lib/editorial-publication').publicationPlan(rows,local.events,served.events);
    for(const row of plan.published)await store.patch(row.event_id,row.revision,{published_copy:row.staged_copy,published_git_sha:sha,staged_copy:null,last_error:null});
    for(const {row,reason} of plan.deferred)await store.patch(row.event_id,row.revision,{last_error:reason});
    console.log(JSON.stringify({sha,published:plan.published.map(row=>row.event_id),deferred:plan.deferred.map(({row,reason})=>({id:row.event_id,reason})),controlWrites:process.env.NS_EDITORIAL_CONTROL_SNAPSHOT?'prepared-CAS':'confirmed'}));return plan;
  }
  const mode=args.includes('--list')?'list':'research';
  const readout=require('./lib/editorial-run-readout').begin({mode});
  let failure;
  try{
  const inventory=await store.inventory(),published=read('data/events.json'),publication=require('./lib/editorial-publication');
  const display=require('./lib/editorial-display-copy');
  const cards=display.selectCards(inventory,published.events,publication.publicationMismatch);
  readout.inventory(inventory,cards);
  if(args.includes('--list')){readout.stage('complete');console.log(JSON.stringify({...inventory,cards:cards.map(c=>({id:c.event.id,name:c.event.name,date:c.schedule.date,eligibility:c.eligibility,schedule:c.schedule,repairReason:c.repairReason,copy:display.baselineCopy(c),sources:c.event.editorialSources||[],pendingEdit:!!c.state.pending_copy,revision:c.state.revision}))},null,2));return;}
  if(!cards.length){readout.stage('complete');console.log('No due qualifying 5/5 editorial; no changes or release.');return {updatedIds:[],deferred:[]};}
  readout.stage('research');
  const index=args.indexOf('--research');assert(index>=0&&args[index+1],'Provide --research <dated JSON>, or --list first.');
  const research=read(args[index+1]);assert.deepEqual(research.horizon,inventory.horizon,'Research must match the current 14-day Sydney horizon.');
  const result=require('./weekend-editorial').main(args,{range:inventory.horizon,cards:cards.map(c=>c.event),rangeKey:'horizon',mode:'adaptive'});
  readout.result(result);readout.stage('checks');
  const after=read('data/events.json');
  for(const card of cards){const deferred=result.deferred?.find(d=>d.id===card.event.id);const event=after.events.find(e=>e.id===card.event.id)||card.event;
    await store.checked(card,{copy:policy.copy(event),deferred:deferred||null});
    readout.checked(deferred);
  }
  if(result.updatedIds?.length){
    readout.stage('build');
    for(const cmd of [['scripts/build-marquee-candidates.js'],['scripts/adaptive-editorial.js','--build-sources']]){const run=spawnSync(process.execPath,cmd,{stdio:'inherit'});assert.equal(run.status,0,cmd[0]+' failed; do not release.');}
  }
  readout.stage('complete');
  return result;
  }catch(error){failure=error;throw error;}
  finally{try{readout.finish(failure);}catch(reportError){if(failure)throw new AggregateError([failure,reportError],failure.message+'; private run measurement also failed: '+reportError.message+'. Do not publish.');throw reportError;}}
}
module.exports={main,buildSources};
