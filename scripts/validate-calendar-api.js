#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const serverPath=require.resolve('../lib/supabase-server');
const real=require(serverPath);
let rows=new Map(),states=new Map(),clock=0;
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
require.cache[serverPath].exports={...real,
 authenticatedUser:async token=>{if(token==='anonymous')return{id:owner,is_anonymous:true};if(![owner,other].includes(token))throw new real.SupabaseRequestError('Unauthorised',{status:401});return{id:token};},
 supabaseRequest:async(path,options)=>{
  const uid=options.accessToken;assert(path.includes(uid)||options.method==='POST');
  if(options.method==='DELETE'){rows.delete(uid);return null;}
  if(['PATCH','POST'].includes(options.method)){
    assert.equal(options.body.user_id,uid);const previous=rows.get(uid);
    const row={...options.body,token:previous?.token || (++clock).toString(16).padStart(64,'0'),updated_at:new Date(Date.now()+clock).toISOString()};rows.set(uid,row);return[row];
  }
  return rows.has(uid)?[rows.get(uid)]:[];
 },
 supabaseServiceRequest:async path=>{
  if(path.includes('calendar_subscriptions'))return [...rows.values()].filter(row=>path.includes(`token=eq.${row.token}`));
  return [...states.values()].filter(row=>path.includes(`user_id=eq.${row.user_id}`));
 }
};

const livePath=require.resolve('../lib/live-fixtures'),originalLive=require(livePath),dictionary=require('../lib/fixture-source-groups-v2');
const calendarReads=[];let currentUnavailable=false;
require.cache[livePath].exports={...originalLive,readLiveSnapshots:async options=>{
 calendarReads.push(options);assert.equal(options.globalTransport,dictionary.CANDIDATE,'calendar GET must use the trusted private v2 token');assert.deepEqual(Object.keys(options),['globalTransport']);
 if(currentUnavailable)throw Error('Synthetic current fixture read unavailable');
 return {revision:'calendar-controlled-current',sources:[],stale:false};
}};

const handler=require('../lib/calendar-handler');
async function request(method,token,body,url='/api/calendar'){
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;},send(body){this.body=body;}};
 await handler({method,url,body,headers:token?{authorization:`Bearer ${token}`} : {}},response);return response;
}
(async()=>{
 assert.equal((await request('GET')).code,401);
 assert.equal((await request('POST','anonymous',{includedIds:[],excludedIds:[]})).code,401);assert.equal(rows.size,0);
 assert.equal((await request('POST',owner,{includedIds:'bad',excludedIds:[]})).code,400);
 assert.equal((await request('POST',owner,{includedIds:[],excludedIds:[],user_id:other})).code,200);
 const first=rows.get(owner),stable=first.token;assert(!rows.has(other));
 assert.equal((await request('GET',other)).body.subscription,null);
 assert.equal((await request('POST',owner,{includedIds:['fixture'],excludedIds:[],updatedAt:'stale'})).code,409);
 const saved=await request('POST',owner,{includedIds:['fixture'],excludedIds:['omitted'],updatedAt:first.updated_at});assert.equal(saved.code,200);assert.equal(saved.body.subscription.token,stable);
 states.set(owner,{user_id:owner,preferences:{followedSports:['rugby']}});
 assert.equal(calendarReads.length,0,'management/auth/rejected paths must not read current fixtures');
 const ics=await request('GET',null,null,`/api/calendar?token=${stable}`);assert.equal(ics.code,200);assert(ics.body.startsWith('BEGIN:VCALENDAR'));assert.equal(ics.headers['Cache-Control'],'private, no-store');
 assert(!ics.body.includes(owner));assert(!ics.body.includes(stable));

 assert.equal(calendarReads.length,1);assert.equal(ics.headers['X-Fixture-Revision'],'calendar-controlled-current');assert.equal(ics.headers['Referrer-Policy'],'no-referrer');assert.equal(ics.headers['Content-Type'],'text/calendar; charset=utf-8');
 currentUnavailable=true;
 const fallback=await request('GET',null,null,`/api/calendar?token=${stable}&globalTransport=v1`);
 assert.equal(fallback.code,200);assert(fallback.body.startsWith('BEGIN:VCALENDAR'));assert.equal(fallback.headers['Cache-Control'],'private, no-store');assert.equal(fallback.headers['X-Fixture-Revision'],undefined);assert(!fallback.body.includes(owner));assert(!fallback.body.includes(stable));assert.equal(calendarReads.length,2);
 currentUnavailable=false;
 const retainedState=states.get(owner);states.delete(owner);
 assert.equal((await request('GET',null,null,`/api/calendar?token=${stable}`)).code,409);assert.equal(calendarReads.length,2,'missing saved account state cannot invoke current fixtures');states.set(owner,retainedState);
 assert.equal((await request('GET',null,null,'/api/calendar?token='+'f'.repeat(64))).code,404);assert.equal(calendarReads.length,2,'unknown valid-form token cannot invoke current fixtures');

 assert.equal((await request('GET',null,null,'/api/calendar?token=invalid')).code,404);
 await request('DELETE',other);assert(rows.has(owner));
 assert.equal((await request('DELETE',owner)).code,200);
 assert.equal((await request('GET',null,null,`/api/calendar?token=${stable}`)).code,404);
 assert.equal((await request('POST',owner,{includedIds:[],excludedIds:[]})).code,200);assert.notEqual(rows.get(owner).token,stable);
 assert.equal(calendarReads.length,2,'invalid/revoked tokens and later management retain zero current reads');
 for(const options of calendarReads){assert.equal(options.globalTransport,dictionary.CANDIDATE);assert.deepEqual(Object.keys(options),['globalTransport']);}
 console.log('Calendar endpoint: authentication, owner scoping, validation, concurrent edits, stable URL, private ICS and revocation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{require.cache[livePath].exports=originalLive;require.cache[serverPath].exports=real;});
