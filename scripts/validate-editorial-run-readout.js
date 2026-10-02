'use strict';
// Exercise the real CLI, inventory and check preparation without service access,
// editorial publication, public artifact writes or credentials.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const child=require('node:child_process'),store=require('../lib/editorial-maintenance'),policy=require('../config/editorial-maintenance'),weekend=require('./weekend-editorial'),supabase=require('../lib/supabase-server');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-readout-'));
fs.chmodSync(dir,0o700);
const source=store.sources(),now=new Date('2026-10-03T00:00:00Z');
const window=source.events.filter(e=>policy.schedule(e,{},now).inWindow);
const fixtures=window.filter(e=>policy.schedule(e,{},now).due).slice(0,2);
assert.equal(fixtures.length,2,'Retained fixture sample required for real inventory checks.');
const groups=window.map(e=>({event_id:e.id,aliases:policy.ids(e)}));
const artifacts=['data/events.json','data/events.js','data/editorial-maintenance-sources.v1.json','data/editorial-knowledge.v1.json','app-version.json'];
const hashes=()=>Object.fromEntries(artifacts.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const baseline=hashes(),keys=['NS_EDITORIAL_CONTROL_SNAPSHOT','NS_EDITORIAL_CHECK_REPORT','NS_EDITORIAL_ENV_FILE'];
const originals={inventory:store.inventory,research:weekend.main,request:supabase.supabaseServiceRequest,spawn:child.spawnSync,fetch:global.fetch,log:console.log,env:Object.fromEntries(keys.map(key=>[key,process.env[key]]))};
let builds=[],captured,number=0;
supabase.supabaseServiceRequest=async()=>{throw Error('Test forbids service access.');};
global.fetch=async()=>{throw Error('Test forbids network access.');};
child.spawnSync=(executable,args)=>{assert.equal(executable,process.execPath);builds.push(args[0]);return {status:0};};
// Load after installing the build spy; unchanged runs must never invoke it.
const cli=require('./adaptive-editorial');
store.inventory=async()=>{captured=await originals.inventory({now});return captured;};
console.log=()=>{};
function setup({selected=true,existing=false}={}){
  const report=path.join(dir,'report-'+(++number)+'.json'),snapshot=path.join(dir,'control-'+number+'.json');
  const states=selected?fixtures.map(e=>({event_id:e.id,revision:7,held:false,pending_copy:{hook:'PRIVATE-QUEUED-DRAFT'}})):[];
  const value={capturedAt:new Date().toISOString(),sourceRevision:source.sourceRevision,complete:true,groups,signals:selected?fixtures.map(e=>({event_id:e.id,count:1,mean:5})):[],states};
  fs.writeFileSync(snapshot,JSON.stringify(value),{mode:0o600});
  if(existing)fs.writeFileSync(report,JSON.stringify({sourceRevision:source.sourceRevision,operations:[{eventId:'prior-private-fixture',expectedRevision:0,change:{last_error:{reason:'PRIVATE-PREVIOUS-ERROR'}}}]}),{mode:0o600});
  process.env.NS_EDITORIAL_CONTROL_SNAPSHOT=snapshot;process.env.NS_EDITORIAL_CHECK_REPORT=report;delete process.env.NS_EDITORIAL_ENV_FILE;
  delete require.cache[require.resolve('../lib/editorial-control-snapshot')];
  builds=[];
  return {report,snapshot,value};
}
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const last=file=>read(file).runReadouts.at(-1);
const researchFile=path.join(dir,'research.json');
fs.writeFileSync(researchFile,JSON.stringify({horizon:{from:policy.day(now),to:policy.plus(policy.day(now),14)}}),{mode:0o600});
const args=['--research',researchFile];
function aggregate(file){
  const result=last(file),serialized=JSON.stringify(result);
  assert(Number.isInteger(result.cliElapsedMs)&&result.cliElapsedMs>=0);
  for(const privateValue of [...fixtures.map(e=>e.id),'PRIVATE-QUEUED-DRAFT','PRIVATE-PREVIOUS-ERROR','SECRET-UPSTREAM'])assert(!serialized.includes(privateValue));
  assert.equal(result.connectorCommitObserved,false);
  assert.equal(result.externalModelTokens,null);assert.equal(result.externalResearchRuntimeMs,null);assert.equal(result.cashCostAUD,null);
  assert.equal(fs.statSync(file).mode&0o077,0);
  return result;
}
async function main(){
  try{
    // Real inventory/list with zero synthetic eligibility is read-only.
    let run=setup({selected:false});await cli.main(['--list']);
    let metrics=aggregate(run.report);
    assert.equal(metrics.windowCards,window.length);assert.equal(metrics.selectedCards,0);assert.equal(metrics.dueCards,0);assert.equal(metrics.stage,'complete');assert.equal(metrics.status,'completed');
    assert.deepEqual(read(run.report).operations,[]);assert.deepEqual(builds,[]);
    await cli.main([]);assert.equal(read(run.report).runReadouts.length,2);assert.deepEqual(read(run.report).operations,[]);assert.deepEqual(builds,[]);

    // Actual checked() and snapshot PATCH preserve old CAS ops; deferrals write
    // only their diagnostic and never clear a queued private draft.
    run=setup({existing:true});
    const deferred={id:fixtures[1].id,reason:'SECRET-UPSTREAM source unavailable',nextAction:'Retry after evidence is available.'};
    weekend.main=()=>({updatedIds:[],deferred:[deferred,deferred]});
    await cli.main(args);metrics=aggregate(run.report);
    assert.equal(metrics.selectedCards,2);assert.equal(metrics.dueCards,2);assert.equal(metrics.changedCards,0);assert.equal(metrics.deferredCards,1);
    assert.equal(metrics.successfulChecks,1);assert.equal(metrics.preparedUpdates,2);assert.equal(metrics.directPersistedUpdates,0);
    const prepared=read(run.report);assert.equal(prepared.operations.length,3);assert.equal(prepared.operations[0].change.last_error.reason,'PRIVATE-PREVIOUS-ERROR');
    assert.equal(prepared.operations[1].change.pending_copy,null);assert(!('pending_copy' in prepared.operations[2].change));
    assert.equal(captured.cards.find(c=>c.event.id===fixtures[1].id).state.pending_copy.hook,'PRIVATE-QUEUED-DRAFT');
    assert.match(require('./editorial-control-sql').sql(prepared),/for update/);assert.deepEqual(builds,[]);

    // Known domain/transport failures remain failures with no fictitious checks.
    run=setup({existing:true});weekend.main=()=>{captured.cards.find(c=>c.event.id===fixtures[0].id).state.held=true;return {updatedIds:[],deferred:[]};};
    await assert.rejects(()=>cli.main(args),error=>error.code==='editorial_hold');metrics=aggregate(run.report);
    assert.equal(metrics.stage,'checks');assert.equal(metrics.status,'failed');assert.equal(metrics.preparedUpdates,0);assert.equal(metrics.successfulChecks,0);assert.equal(read(run.report).operations.length,1);
    run=setup({existing:true});weekend.main=()=>({updatedIds:[],deferred:[]});
    const adapter=require('../lib/editorial-control-snapshot'),request=adapter.request;
    adapter.request=async(url,options={})=>options.method==='PATCH'?[]:request(url,options);
    await assert.rejects(()=>cli.main(args),error=>error.code==='editorial_revision_conflict');metrics=aggregate(run.report);
    assert.equal(metrics.stage,'checks');assert.equal(metrics.preparedUpdates,0);assert.equal(read(run.report).operations.length,1);
    run=setup();store.inventory=async()=>{throw Error('SECRET-UPSTREAM inventory outage');};
    await assert.rejects(()=>cli.main(['--list']),/inventory outage/);metrics=aggregate(run.report);
    assert.equal(metrics.stage,'inventory');assert.equal(metrics.status,'failed');assert.equal(metrics.windowCards,null);assert.equal(metrics.dueCards,null);assert.equal(metrics.sourceRevision,null);
    assert.throws(()=>require('./editorial-control-sql').sql(read(run.report)),/assert/);
    store.inventory=async()=>{captured=await originals.inventory({now});return captured;};
    run=setup();await assert.rejects(()=>cli.main(['--research',path.join(dir,'missing.json')]),/ENOENT/);assert.equal(aggregate(run.report).stage,'research');

    // Failed readout saving preserves the original failure for the operator.
    run=setup();store.inventory=async()=>{fs.chmodSync(run.report,0o644);throw Error('Original inventory failure');};
    fs.writeFileSync(run.report,JSON.stringify({sourceRevision:source.sourceRevision,operations:[]}),{mode:0o600});
    await assert.rejects(()=>cli.main(['--list']),error=>error instanceof AggregateError&&error.errors[0].message==='Original inventory failure'&&/private/.test(error.errors[1].message));
    store.inventory=async()=>{captured=await originals.inventory({now});return captured;};

    // Direct-service acknowledgement is separate from offline preparation.
    run=setup();delete process.env.NS_EDITORIAL_CONTROL_SNAPSHOT;
    supabase.supabaseServiceRequest=async(url,options={})=>{
      const u=new URL(url,'https://test.invalid');
      if(u.pathname==='/rest/v1/rpc/nothingsports_editorial_signals')return run.value.signals;
      assert.equal(u.pathname,'/rest/v1/nothingsports_editorial_maintenance');
      if(options.method==='POST')return [];
      if(options.method==='PATCH'){const row=run.value.states.find(s=>'eq.'+s.event_id===u.searchParams.get('event_id'));assert.equal(u.searchParams.get('revision'),'eq.'+row.revision);Object.assign(row,options.body);return [row];}
      return run.value.states;
    };
    weekend.main=()=>({updatedIds:[],deferred:[]});await cli.main(args);metrics=aggregate(run.report);
    assert.equal(metrics.directPersistedUpdates,2);assert.equal(metrics.preparedUpdates,0);assert.equal(metrics.controlMode,'direct-service');assert.deepEqual(read(run.report).operations,[]);
    supabase.supabaseServiceRequest=async()=>{throw Error('Test forbids service access.');};

    // Changed-copy/build failures accurately retain the last failed stage.
    run=setup();weekend.main=()=>({updatedIds:[fixtures[0].id,fixtures[0].id],deferred:[]});
    await cli.main(args);assert.equal(aggregate(run.report).changedCards,1);assert.deepEqual(builds,['scripts/build-marquee-candidates.js','scripts/adaptive-editorial.js']);
    child.spawnSync=()=>({status:1});delete require.cache[require.resolve('./adaptive-editorial')];
    const failingBuild=require('./adaptive-editorial');run=setup();await assert.rejects(()=>failingBuild.main(args),/do not release/);assert.equal(aggregate(run.report).stage,'build');

    // Unsafe report paths fail before inventory/service/research side effects.
    let inventoryCalls=0;store.inventory=async()=>{inventoryCalls++;throw Error('Unexpected inventory');};
    for(const file of [path.join(root,'data','readout-test.json'),path.join(dir,'public.json'),path.join(dir,'dangling.json'),path.join(dir,'link.json')]){
      if(file.endsWith('public.json'))fs.writeFileSync(file,JSON.stringify({operations:[]}),{mode:0o644});
      if(file.endsWith('dangling.json'))fs.symlinkSync(path.join(dir,'absent-target.json'),file);
      if(file.endsWith('link.json'))fs.symlinkSync(sourcePath(),file);
      process.env.NS_EDITORIAL_CHECK_REPORT=file;
      await assert.rejects(()=>cli.main(['--list']),/outside the checkout|private|regular/);
    }
    assert.equal(inventoryCalls,0);assert(!fs.existsSync(path.join(root,'data','readout-test.json')));assert(!fs.existsSync(path.join(dir,'absent-target.json')));
    run=setup({existing:true});const old=read(run.report);old.sourceRevision='0'.repeat(64);fs.writeFileSync(run.report,JSON.stringify(old),{mode:0o600});
    store.inventory=async()=>originals.inventory({now});await assert.rejects(()=>cli.main(args),/source revision mismatch/);assert.equal(read(run.report).operations.length,1);assert.equal(last(run.report).stage,'inventory');

    // Bound only aggregate history, never prepared operations; absent optional
    // reporting retains the existing quiet behaviour.
    run=setup({existing:true,selected:false});for(let i=0;i<34;i++)await cli.main(['--list']);assert.equal(read(run.report).runReadouts.length,32);assert.equal(read(run.report).operations.length,1);
    delete process.env.NS_EDITORIAL_CHECK_REPORT;await cli.main(['--list']);assert.deepEqual(hashes(),baseline);
    originals.log('Editorial run readout: real inventory/check preparation, retained CAS/drafts, no-change artifacts, held/conflict/outage stages, direct vs prepared saves, private paths and bounded aggregate history passed. No production writes or publication.');
  }finally{
    store.inventory=originals.inventory;weekend.main=originals.research;supabase.supabaseServiceRequest=originals.request;child.spawnSync=originals.spawn;global.fetch=originals.fetch;console.log=originals.log;
    for(const key of keys){if(originals.env[key]===undefined)delete process.env[key];else process.env[key]=originals.env[key];}
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
function sourcePath(){return path.join(root,'data/editorial-maintenance-sources.v1.json');}
main().catch(error=>{console.error(error);process.exitCode=1;});
