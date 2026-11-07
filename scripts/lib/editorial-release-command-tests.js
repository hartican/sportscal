'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
async function validateEditorialReleaseCommand(){
  const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-release-'));
  const vercel=require('./vercel-project'),server=require('../../lib/supabase-server'),store=require('../../lib/editorial-maintenance');
  const original={project:vercel.project,request:server.supabaseServiceRequest,patch:store.patch,fetch:global.fetch,log:console.log,snapshot:process.env.NS_EDITORIAL_CONTROL_SNAPSHOT};
  const sha=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),bytes=fs.readFileSync(path.join(root,'data/editorial-maintenance-sources.v1.json'));
  const compact=Buffer.from(JSON.stringify(JSON.parse(bytes))+'\n'),hash=(type,value)=>crypto.createHash(type).update(value).digest('hex');
  const inventory={revision:sha,files:[{path:'data/editorial-maintenance-sources.v1.json',gitBlob:hash('sha1',Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])),transform:'json-compact',bytes:compact.length,sha256:hash('sha256',compact)}]};
  const proof={sha,deployment:{sha,state:'READY',target:'production',id:'dpl_isolatedTest'}},proofPath=path.join(dir,'production-verification.json'),inventoryPath=path.join(dir,'deployment-files.json');
  fs.writeFileSync(proofPath,JSON.stringify(proof));fs.writeFileSync(inventoryPath,JSON.stringify(inventory));
  let network=0,controlReads=0,writes=0;
  try{
    delete process.env.NS_EDITORIAL_CONTROL_SNAPSHOT;
    vercel.project=()=>({targets:{production:{id:proof.deployment.id,readyState:'READY',meta:{releaseGitSha:sha}}}});
    global.fetch=async(url)=>{network++;assert(!url.includes('editorial-maintenance-sources'),'Recording publication must not reopen the server source download');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,url.includes('app-version.json')?'app-version.json':'data/events.json')))};};
    server.supabaseServiceRequest=async()=>{controlReads++;return [];};store.patch=async()=>{writes++;throw Error('No fixture is staged in this isolated test');};console.log=()=>{};
    const cli=require('../adaptive-editorial'),args=['--record-release',sha,'--release-proof',proofPath];
    const result=await cli.main(args);assert.deepEqual(result.published,[]);assert.equal(network,2);assert.equal(controlReads,1);assert.equal(writes,0);
    network=0;controlReads=0;
    const bad=structuredClone(inventory);bad.files[0].sha256='0'.repeat(64);fs.writeFileSync(inventoryPath,JSON.stringify(bad));
    await assert.rejects(()=>cli.main(args),/source hash/);assert.equal(network,0);assert.equal(controlReads,0);
    fs.writeFileSync(inventoryPath,JSON.stringify(inventory));vercel.project=()=>({targets:{production:{id:proof.deployment.id,readyState:'READY',meta:{releaseGitSha:'b'.repeat(40)}}}});
    await assert.rejects(()=>cli.main(args),/does not match/);assert.equal(network,0);assert.equal(controlReads,0);assert.equal(writes,0);
  }finally{
    vercel.project=original.project;server.supabaseServiceRequest=original.request;store.patch=original.patch;global.fetch=original.fetch;console.log=original.log;
    if(original.snapshot===undefined)delete process.env.NS_EDITORIAL_CONTROL_SNAPSHOT;else process.env.NS_EDITORIAL_CONTROL_SNAPSHOT=original.snapshot;
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
module.exports={validateEditorialReleaseCommand};
