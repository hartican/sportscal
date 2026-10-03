#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const cases=[
 ['missing-token',401,'missing_access_token',0],['bad-header',401,'missing_access_token',0],
 ['expired-token',401,'bad_jwt',1],['erasing-account',403,'account_erasure_in_progress',1],
 ['auth-network',502,'supabase_request_failed',1],['unconfigured',503,'supabase_not_configured',0],
 ['maintenance',503,'supabase_maintenance',0],['missing-state',409,'user_state_missing',2],
 ['state-failure',503,'supabase_request_failed',2],['oversized-profile',413,null,0],
 ['oversized-followed',413,null,0],['invalid-participant',400,null,0],['wrong-method',405,'method_not_allowed',0]
];
async function child(name){
 const scenario=cases.find(c=>c[0]===name);assert(scenario,'Known rejected request');
 const {performance}=require('node:perf_hooks'),Module=require('node:module'),crypto=require('node:crypto');
 const began=performance.now(),cpu=process.cpuUsage();
 process.env.SUPABASE_URL='https://rehearsal.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic-public-key';
 delete process.env.SUPABASE_MAINTENANCE_MODE;
 if(name==='unconfigured'){delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;delete process.env.SUPABASE_ANON_KEY;}
 if(name==='maintenance')process.env.SUPABASE_MAINTENANCE_MODE='1';
 let networkCalls=0;global.fetch=async(url,options)=>{
  networkCalls++;assert.equal(new URL(url).origin,'https://rehearsal.invalid','Synthetic services only');
  assert.equal(options.method,'GET','No external writes');
  if(name==='auth-network')throw Error('Synthetic unavailable Auth');
  if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify(name==='expired-token'?{msg:'JWT has expired',code:'bad_jwt'}:{id:'synthetic-account',app_metadata:name==='erasing-account'?{nothingsport_erasure_started_at:'2026-10-03T00:00:00Z'}:{}}),{status:name==='expired-token'?401:200});
  assert(String(url).includes('/rest/v1/nothingsports_user_state'),'Only existing account state path');
  return new Response(JSON.stringify(name==='state-failure'?{message:'Synthetic state unavailable'}:[]),{status:name==='state-failure'?503:200});
 };
 const sportingReads=[],read=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).includes(path.join(root,'data')+path.sep))sportingReads.push(path.relative(root,String(file)));return read.call(this,file,...args);};
 let handler;
 if(process.env.FEED_BASELINE_SOURCE){const filename=path.join(root,'api/feed.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(read(process.env.FEED_BASELINE_SOURCE,'utf8'),filename);handler=m.exports;}
 else handler=require('../api/feed');
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;}};
 let request={method:'GET',url:'/api/feed',headers:name==='missing-token'?{}:{authorization:name==='bad-header'?'Basic synthetic':'Bearer synthetic-token'}};
 if(name.startsWith('oversized-'))request={method:'POST',url:'/api/feed?scope='+(name==='oversized-profile'?'athletes':'match-centre'),body:{preferences:{blob:'x'.repeat(131073)}}};
 if(name==='invalid-participant')request={method:'POST',url:'/api/feed?scope=athletes&participantId=%3Cscript%3E'};
 if(name==='wrong-method')request={method:'POST',url:'/api/feed',body:{}};
 await handler(request,response);fs.readFileSync=read;
 assert.equal(response.code,scenario[1],name+' retains status');
 if(scenario[2])assert.equal(response.body.code,scenario[2],name+' retains bounded diagnostic');
 if(name==='missing-token')assert.deepEqual(response.body,{error:'Sign in is required.',code:'missing_access_token'});
 assert.equal(networkCalls,scenario[3],name+' retains read count');
 assert.equal(response.headers['Cache-Control'],'private, max-age=0, must-revalidate');
 const sportingImports=Object.keys(require.cache).filter(p=>p.includes(path.join(root,'data')+path.sep));
 const observation={scenario:name,status:response.code,code:response.body.code||null,bodyHash:crypto.createHash('sha256').update(JSON.stringify(response.body)).digest('hex'),elapsedMs:performance.now()-began,cpuUs:Object.values(process.cpuUsage(cpu)).reduce((a,b)=>a+b,0),rssBytes:process.memoryUsage().rss,networkCalls,sportingReads:sportingReads.length,sportingImports:sportingImports.length};
 console.log(JSON.stringify(observation));
 if(!process.env.FEED_MEASURE_ONLY){assert.equal(sportingReads.length,0,name+' must not read sporting data before rejection');assert.equal(sportingImports.length,0,name+' must not import sporting data before rejection');}
}
if(process.argv[2]==='--case')child(process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
else{
 for(const [name]of cases){const r=spawnSync(process.execPath,[__filename,'--case',name],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);}
 console.log('Feed initialization: 13 real cold rejection paths retain auth/erasure/status/privacy/read bounds and read zero sporting datasets');
}
