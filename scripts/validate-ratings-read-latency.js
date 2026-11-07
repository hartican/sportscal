'use strict';
// Exercise the real handler/server with held I/O, without production writes.
const assert=require('node:assert/strict');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
(async()=>{
 const supabasePath=require.resolve('../lib/supabase-server'),serverPath=require.resolve('../lib/nothingscore-server');
 const actual=require(supabasePath),gate=deferred(),calls=[];
 require.cache[supabasePath].exports={...actual,supabaseServiceRequest:async path=>{calls.push(path);if(path.includes('early_panel_state'))await gate.promise;return [];}};
 delete require.cache[serverPath];const server=require(serverPath);
 const request=server.snapshots(['major-match-nrl-finals-2026-preliminary-final-2'],{demoMode:'public'});
 await new Promise(r=>setImmediate(r));
 const overlap=calls.some(p=>p.includes('event_id='));gate.resolve();await request;
 assert(overlap,'fixture reads must start while independent panel metadata is pending');
 const refresh=deferred(),started=[];
 require.cache[serverPath].exports={...server,refreshEventSnapshots:async()=>{started.push('refresh');await refresh.promise;},snapshots:async()=>{started.push('snapshots');return [];},profileFor:async()=>{started.push('profile');return null;},personaFor:async()=>{started.push('persona');return null;}};
 require.cache[supabasePath].exports={...actual,authenticatedUser:async()=>({id:'qa-account'}),bearerToken:()=> 'qa-token'};
 const handler=require('../lib/nothingscore-handler');const response={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;}};
 const pending=handler({method:'GET',url:'/api/nothingscore?ids=fixture-one'},response);
 await new Promise(r=>setImmediate(r));const concurrent=started.includes('profile')&&started.includes('persona');refresh.resolve();await pending;
 assert(concurrent,'viewer metadata must not wait behind fixture hydration and summaries');assert.equal(response.code,200);assert(started.indexOf('snapshots')>started.indexOf('refresh'));
 console.log('Rating reads overlap independent I/O while preserving hydration-before-phase and private viewer response.');
})().catch(e=>{console.error(e);process.exitCode=1;});
