'use strict';
const assert=require('node:assert/strict');
const canonical='rugby-australia-new-zealand-2026-10-17',old='fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8',user='11111111-1111-4111-8111-111111111111';
const sp=require.resolve('../lib/supabase-server'),np=require.resolve('../lib/nothingscore-server');
const actual=require(sp),cache=require.cache[sp];let mode='missing',consolidated=false,calls=[];
cache.exports={...actual,async supabaseServiceRequest(path,options){
 calls.push({path,options});
 if(path.includes('/rpc/nothingsports_bledisloe_identity_ready')){if(mode==='missing')throw new Error('not deployed');return mode==='ready';}
 const url=new URL(path,'http://mock'),table=url.pathname.split('/').pop();
 if(['nothingsports_nsc_contributions','nothingsports_nsc_points'].includes(table)){
  const ids=url.searchParams.get('event_id');assert(ids.includes(canonical)&&ids.includes(old),'both storage identities in the same query');
  if(table==='nothingsports_nsc_points')return [{event_id:consolidated?canonical:old,action_key:'heat_rating',points:1},{event_id:canonical,action_key:'heat_rating',points:1}];
  const latest={event_id:consolidated?canonical:old,user_id:user,phase:'heat',bucket_start:'1970-01-01T00:00:00Z',rating:3,tags:[],submitted_at:'2026-09-27T12:00:00Z',updated_at:'2026-09-28T12:00:00Z'};
  return consolidated?[latest]:[{...latest,event_id:canonical,rating:5,updated_at:'2026-09-27T13:00:00Z'},latest];
 }
 if(table==='nothingsports_nsc_profiles')return [{user_id:user,visibility:'hidden'}];
 return [];
}};
delete require.cache[np];
(async()=>{try{
 const server=require(np);assert(await server.reviewedIdentityReady('evt_13'),'other fixtures add no readiness request');assert.equal(calls.length,0);
 for(const id of [canonical,old,'fixture-rugby-ra-949627'])assert.equal(await server.reviewedIdentityReady(id),false,'missing RPC holds the reviewed match');
 mode='pending';assert.equal(await server.reviewedIdentityReady(old),false);mode='ready';assert.equal(await server.reviewedIdentityReady(old),true);
 let before;
 for(const merged of [false,true]){
  consolidated=merged;calls=[];
  const result=await server.snapshots([old,canonical],{userId:user,now:new Date('2026-10-02T04:00:00Z'),demoMode:'off'});
  assert.equal(result.length,2);assert.equal(result[0].eventId,old,'old cached client gets its requested key');assert.equal(result[0].canonicalEventId,canonical);assert.equal(result[0].phase,'heat');assert.equal(result[0].timing.startTimeUtc,'2026-10-17T05:00:00.000Z');assert.equal(result[0].timing.endTimeUtc,'2026-10-17T08:00:00.000Z');
  assert.equal(result[0].currentUser.submissions.heat.rating,3,'latest rating survives, never source-order dependent');
  assert.equal(result[0].currentUser.submissions.heat.pointsAwarded,2,'all earned credits survive');
  assert.equal(result[0].peerResults.count,1,'one contributor, not both identities');
  assert(!JSON.stringify(result).includes(user),'private account ID not disclosed');
  assert.equal(calls.filter(c=>/nothingsports_nsc_(contributions|likes|presence|marquee_sessions|points)/.test(c.path)).length,5,'no new reads for alias expansion');
  if(before)assert.deepEqual(result,before,'public payload stays stable across database cutover');else before=result;
 }
 console.log('Bledisloe API: legacy response keys, latest ratings, complete credits, private profiles and unchanged query count before/after cutover; missing/pending/ready safety gate passed.');
}finally{delete require.cache[np];cache.exports=actual;}})().catch(e=>{console.error(e);process.exitCode=1});
