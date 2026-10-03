'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {seal,internalSources,consumers}=require('../seal-deployment-output');
function validateBuiltPublicBoundary(){
  const deploy=fs.readFileSync(path.resolve(__dirname,'../deploy-current-commit.sh'),'utf8');
  const build=deploy.indexOf('run_vercel build '),sealAt=deploy.indexOf('node scripts/seal-deployment-output.js'),upload=deploy.indexOf('run_vercel deploy ');
  assert(build>=0&&sealAt>build&&upload>sealAt,'Validate/seal the actual build before any upload');
  assert(deploy.slice(build,sealAt).includes('--standalone'),'Server sources must survive independently of static files');
  assert(deploy.slice(upload).includes('--prebuilt'),'Do not rebuild and reintroduce source files after sealing');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-built-source-boundary-'));
  const write=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
  function fixture(name){
    const sourceRoot=path.join(root,name),output=path.join(sourceRoot,'.vercel/output');
    const files=internalSources.map((file,index)=>{const bytes=Buffer.from(JSON.stringify({serverSource:index})+'\n');write(path.join(sourceRoot,file),bytes);write(path.join(output,'static',file),bytes);return {path:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};});
    write(path.join(sourceRoot,'deployment-files.json'),JSON.stringify({revision:'a'.repeat(40),files}));write(path.join(output,'config.json'),JSON.stringify({version:3}));write(path.join(output,'static/index.html'),'public shell');
    for(const [name,needed] of Object.entries(consumers)){
      const folder=path.join(output,'functions/api',name+'.func');write(path.join(folder,'.vc-config.json'),JSON.stringify({handler:'api/'+name+'.js',runtime:'nodejs24.x'}));
      for(const file of needed){fs.mkdirSync(path.dirname(path.join(folder,file)),{recursive:true});fs.symlinkSync(path.join(sourceRoot,file),path.join(folder,file));}
    }
    return {sourceRoot,output};
  }
  try{
    const good=fixture('good'),r=seal(good);assert.equal(r.staticFilesBefore,4);assert.equal(r.staticFilesAfter,1);assert.equal(r.functionSources.length,6);assert.equal(fs.readFileSync(path.join(good.output,'static/index.html'),'utf8'),'public shell');
    for(const [name,needed] of Object.entries(consumers))for(const file of needed)assert(fs.existsSync(path.join(good.output,'functions/api',name+'.func',file)),'Unlinking static sources cannot remove server symlink targets');
    for(const mode of ['missing-function-source','wrong-static-source','wrong-function-source','environment-static']){
      const bad=fixture(mode),first=internalSources[0];
      if(mode==='missing-function-source')fs.unlinkSync(path.join(bad.output,'functions/api/participation.func',first));
      if(mode==='wrong-static-source')write(path.join(bad.output,'static',first),'wrong');
      if(mode==='wrong-function-source'){const file=path.join(bad.output,'functions/api/participation.func',first);fs.unlinkSync(file);write(file,'wrong');}
      if(mode==='environment-static')write(path.join(bad.output,'static/.env.production.local'),'test-only');
      assert.throws(()=>seal(bad));for(const file of internalSources)assert(fs.existsSync(path.join(bad.output,'static',file)),'Invalid output must reject before any static file is removed');
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
module.exports={validateBuiltPublicBoundary};
