#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const cases=[
 ['refresh-method',405,'POST required'],['refresh-query-method',405,'POST required'],
 ['refresh-no-token',401,'Unauthorised'],['refresh-query-no-token',401,'Unauthorised'],
 ['refresh-wrong-token',401,'Unauthorised'],['refresh-short-secret',401,'Unauthorised'],
 ['refresh-maintenance',503,'Fixture refresh paused for database recovery'],
 ['fixtures-method',405,'GET required'],['fixtures-query-method',405,'GET required'],
 ['fixture-identity',400,'Invalid fixture selection'],['fixture-bound',400,'Invalid fixture selection'],
 ['athlete-identity',400,'Invalid athlete identity'],['athlete-bound',400,'Invalid athlete identity']
];
async function child(name){
 const scenario=cases.find(c=>c[0]===name);assert(scenario,'Known rejected request');
 const {performance}=require('node:perf_hooks'),Module=require('node:module'),crypto=require('node:crypto');
 const began=performance.now(),cpu=process.cpuUsage();
 const secret='synthetic-refresh-secret-longer-than-32-characters';
 process.env.FIXTURE_REFRESH_SECRET=name==='refresh-short-secret'?'short':secret;
 process.env.SUPABASE_URL='https://rehearsal.invalid';process.env.SUPABASE_SECRET_KEY='sb_secret_synthetic';
 delete process.env.SUPABASE_MAINTENANCE_MODE;delete process.env.CONSENSUS_SETTLEMENT_ENABLED;
 if(name==='refresh-maintenance')process.env.SUPABASE_MAINTENANCE_MODE='1';
 let networkCalls=0;
 global.fetch=async(url,options)=>{
  networkCalls++;assert.equal(new URL(url).origin,'https://rehearsal.invalid','Synthetic services only');
  assert(['/rest/v1/rpc/nothingsports_read_fixture_source_health','/rest/v1/rpc/nothingsports_read_current_fixtures'].includes(new URL(url).pathname),'Read-only fixture RPCs only');
  assert.equal(options.method,'POST');return new Response('[]',{status:200});
 };
 const sportingReads=[],read=fs.readFileSync;
 fs.readFileSync=function(file,...args){if(String(file).includes(path.join(root,'data')+path.sep))sportingReads.push(path.relative(root,String(file)));return read.call(this,file,...args);};
 if(process.env.FIXTURE_BASELINE_SOURCE){
  const filename=path.join(root,'lib/live-fixture-handler.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(read(process.env.FIXTURE_BASELINE_SOURCE,'utf8'),filename);require.cache[filename]=m;
 }
 const handler=require('../api/feed');
 let request={url:name.includes('query')?'/api/feed?route=fixture-refresh':'/api/fixture-refresh',method:name.includes('method')?'GET':'POST',headers:{}};
 if(name==='refresh-wrong-token')request.headers.authorization='Bearer wrong-synthetic-token';
 if(name==='refresh-maintenance'||name==='refresh-short-secret')request.headers.authorization='Bearer '+process.env.FIXTURE_REFRESH_SECRET;
 if(name.startsWith('fixtures-'))request={url:name.includes('query')?'/api/feed?route=fixtures':'/api/fixtures',method:'POST',headers:{}};
 if(name.startsWith('fixture-'))request={url:'/api/fixtures?ids='+encodeURIComponent(name==='fixture-bound'?Array.from({length:61},(_,i)=>'id'+i).join(','):'<script>'),method:'GET',headers:{}};
 if(name.startsWith('athlete-'))request={url:'/api/fixtures?athlete='+encodeURIComponent(name==='athlete-bound'?'a'.repeat(201):'<script>'),method:'GET',headers:{}};
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},json(v){this.body=v;return this;},end(){this.ended=true;}};
 await handler(request,response);fs.readFileSync=read;
 assert.equal(response.code,scenario[1],name+' retains status');assert.equal(response.body.error,scenario[2],name+' retains diagnostic');
 if(name.startsWith('refresh-'))assert.equal(response.headers['Cache-Control'],'no-store');
 else if(!name.startsWith('fixtures-'))assert.equal(response.headers['Cache-Control'],'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
 if(name.includes('method'))assert.equal(response.headers.Allow,name.startsWith('refresh-')?'POST':'GET');
 if(name==='refresh-maintenance')assert.equal(response.body.code,'supabase_maintenance');
 assert(!JSON.stringify(response.body).includes(secret),'Server secret must not appear in rejection');
 const sportingImports=Object.keys(require.cache).filter(p=>p.includes(path.join(root,'data')+path.sep));
 const observation={scenario:name,status:response.code,bodyHash:crypto.createHash('sha256').update(JSON.stringify(response.body)).digest('hex'),elapsedMs:performance.now()-began,cpuUs:Object.values(process.cpuUsage(cpu)).reduce((a,b)=>a+b,0),rssBytes:process.memoryUsage().rss,networkCalls,sportingReads:sportingReads.length,sportingImports:sportingImports.length};
 console.log(JSON.stringify(observation));
 if(!process.env.FIXTURE_MEASURE_ONLY){assert.equal(networkCalls,0,name+' must reject before database access');assert.equal(sportingReads.length,0,name+' must reject before sporting reads');assert.equal(sportingImports.length,0,name+' must reject before sporting imports');}
}
function run(){
 for(const [name]of cases){const r=spawnSync(process.execPath,[__filename,'--case',name],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);}
 console.log('Live fixture initialization: 13 real cold rejection paths retain status/cache/auth bounds without sporting data or database reads');
}
if(require.main===module){if(process.argv[2]==='--case')child(process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});else run();}
module.exports={run,cases};
