'use strict';
const assert=require('node:assert/strict');
const canonical='event:premier-league:128969',old='event:football:premier-league:401879272',other='event:premier-league:129031',user='11111111-1111-4111-8111-111111111111';
const sp=require.resolve('../lib/supabase-server'),np=require.resolve('../lib/nothingscore-server');
const actual=require(sp),cache=require.cache[sp];let mode='missing',calls=[];
cache.exports={...actual,async supabaseServiceRequest(path,options){
 calls.push({path,options});
 if(path.includes('/rpc/nothingsports_epl_identity_ready')){if(mode==='missing')throw Error('not deployed');return mode==='ready';}
 const url=new URL(path,'http://mock'),table=url.pathname.split('/').pop();
 if(mode==='leaderboard'&&table==='nothingsports_nsc_points')return [old,canonical,...Array.from({length:8},(_,i)=>`event:unchanged:${i}`)].map(event_id=>({user_id:user,event_id,points:10,awarded_at:'2026-10-12T18:00:00Z'}));
 if(['nothingsports_nsc_contributions','nothingsports_nsc_points'].includes(table)){
  const ids=url.searchParams.get('event_id');assert(ids.includes(canonical)&&ids.includes(old),'the two proven operating identities are read in the existing query');
  if(table==='nothingsports_nsc_points')return [{event_id:old,action_key:'impact_rating',points:2},{event_id:canonical,action_key:'impact_rating',points:2}];
  const latest={event_id:old,user_id:user,phase:'impact',bucket_start:'1970-01-01T00:00:00Z',rating:3,tags:[],submitted_at:'2026-09-20T12:00:00Z',updated_at:'2026-09-21T12:00:00Z'};
  return [{...latest,event_id:canonical,rating:5,updated_at:'2026-09-20T13:00:00Z'},latest];
 }
 if(table==='nothingsports_nsc_profiles')return [{user_id:user,visibility:'hidden'}];
 return [];
}};
delete require.cache[np];
(async()=>{try{
 const server=require(np),primary=require('../data/events.json').events.find(e=>e.canonicalEventId===canonical);assert(primary);
 assert.equal(server.canonicalEventId(old),canonical);assert.equal(server.canonicalEventId('football-premier-league-2026-27-401879272'),canonical);
 const event=server.eventFor(old);assert.equal(event.canonicalEventId,canonical);assert.equal(event.startTimeUtc,primary.startTimeUtc);
 assert(await server.reviewedIdentityReady(other),'the other 378 league fixtures do not add a readiness request');assert.equal(calls.length,0);
 for(const id of [canonical,old])assert.equal(await server.reviewedIdentityReady(id),false,'missing operating safeguard holds only the two historic activity identities');
 mode='pending';assert.equal(await server.reviewedIdentityReady(old),false);mode='ready';assert.equal(await server.reviewedIdentityReady(old),true);
 calls=[];const result=await server.snapshots([old,canonical],{userId:user,now:new Date('2026-10-12T18:00:00Z'),demoMode:'off'});
 assert.equal(result.length,2);assert.equal(result[0].eventId,old,'the old client retains its requested response key');assert.equal(result[0].canonicalEventId,canonical);
 assert.equal(result[0].currentUser.submissions.impact.rating,3,'the latest actual contributor observation wins once');
 assert.equal(result[0].currentUser.submissions.impact.pointsAwarded,4,'every original credit survives without rewriting its row');
 assert.equal(result[0].peerResults.count,1,'a contributor represented by two source IDs is counted once');
 assert(!JSON.stringify(result).includes(user),'hidden profile/account identifiers are not disclosed');
 assert.equal(calls.filter(c=>/nothingsports_nsc_(contributions|likes|presence|marquee_sessions|points)/.test(c.path)).length,5,'alias expansion adds no snapshot query');
 mode='leaderboard';calls=[];const [rank]=await server.leaderboard('lifetime');
 assert.equal(rank.points,100,'every original credit stays in the leaderboard');
 assert.equal(rank.uniqueFixtures,9,'two reviewed provider IDs count as one match; unrelated fixture IDs stay distinct');
 assert.equal(rank.risingEligible,false,'a duplicate source match cannot unlock the ten-match badge');
 assert.equal(calls.filter(c=>c.path.includes('/nothingsports_nsc_points')).length,1,'identity counting adds no ledger read');
 console.log('EPL API: official record, requested legacy keys, latest rating once, all original credits, hidden profiles, existing query count and narrowly scoped missing/pending/ready guard passed.');
}finally{delete require.cache[np];cache.exports=actual;}})().catch(e=>{console.error(e);process.exitCode=1;});
