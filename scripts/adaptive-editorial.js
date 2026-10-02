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
  write('data/editorial-maintenance-sources.v1.json',{schemaVersion:'editorial-maintenance-sources.v1',sourceRevision,events});
  return {events:events.length,sourceRevision};
}
async function main(args){
  if(args.includes('--build-sources')){console.log(JSON.stringify(buildSources()));return;}
  // Local operators may load a private environment file without printing secrets.
  if(process.env.NS_EDITORIAL_ENV_FILE)process.loadEnvFile(process.env.NS_EDITORIAL_ENV_FILE);
  if(args.includes('--record-release')){
    const sha=args[args.indexOf('--record-release')+1];assert(/^[a-f0-9]{40}$/.test(sha),'Full verified release SHA required.');
    const response=await fetch('https://nothingsport.vercel.app/data/editorial-maintenance-sources.v1.json?release='+sha,{cache:'no-store'});assert(response.ok,'Published editorial artifact unavailable.');
    const live=await response.json(),local=store.sources();assert.equal(live.sourceRevision,local.sourceRevision,'Wrong production editorial revision.');
    const app=await fetch('https://nothingsport.vercel.app/app-version.json?release='+sha,{cache:'no-store'});assert(app.ok,'Production release metadata unavailable.');
    // The serialized pipeline supplies the READY/SHA proof; this step verifies exact served editorial bytes.
    const request=require('../lib/supabase-server').supabaseServiceRequest,rows=await request(store.query({select:'*',limit:'1000'}));
    for(const row of rows){const event=local.events.find(e=>policy.ids(e).includes(row.event_id));if(event&&row.staged_copy&&policy.equalCopy(row.staged_copy,policy.copy(event)))await store.patch(row.event_id,row.revision,{published_copy:row.staged_copy,published_git_sha:sha,staged_copy:null});}
    console.log('Verified editorial publication recorded for '+sha);return;
  }
  const inventory=await store.inventory(),cards=inventory.cards.filter(c=>c.selected&&c.schedule.due);
  if(args.includes('--list')){console.log(JSON.stringify({...inventory,cards:cards.map(c=>({id:c.event.id,name:c.event.name,date:c.schedule.date,eligibility:c.eligibility,schedule:c.schedule,copy:c.state.pending_copy||policy.copy(c.event),sources:c.event.editorialSources||[],pendingEdit:!!c.state.pending_copy,revision:c.state.revision}))},null,2));return;}
  if(!cards.length){console.log('No due qualifying 5/5 editorial; no changes or release.');return {updatedIds:[],deferred:[]};}
  const index=args.indexOf('--research');assert(index>=0&&args[index+1],'Provide --research <dated JSON>, or --list first.');
  const research=read(args[index+1]);assert.deepEqual(research.horizon,inventory.horizon,'Research must match the current 14-day Sydney horizon.');
  const result=require('./weekend-editorial').main(args,{range:inventory.horizon,cards:cards.map(c=>c.event),rangeKey:'horizon',mode:'adaptive'});
  const after=read('data/events.json');
  for(const card of cards){const deferred=result.deferred?.find(d=>d.id===card.event.id);const event=after.events.find(e=>e.id===card.event.id)||card.event;
    await store.checked(card,{copy:policy.copy(event),deferred:deferred||null});
  }
  if(result.updatedIds?.length){
    for(const cmd of [['scripts/build-marquee-candidates.js'],['scripts/adaptive-editorial.js','--build-sources']]){const run=spawnSync(process.execPath,cmd,{stdio:'inherit'});assert.equal(run.status,0,cmd[0]+' failed; do not release.');}
  }
  return result;
}
module.exports={main,buildSources};
