"use strict";
const assert=require("node:assert/strict");
const official=require("../../data/follow-sources/official.v1.json");
const nbaId="fixture:nba:0022600163";
const ausId="football-australian-championship-2026-22278890";

async function run(){
  const supabasePath=require.resolve("../../lib/supabase-server");
  const originalSupabase=require(supabasePath),calls=[];
  const paths=["../../lib/nothingscore-server","../../lib/nothingscore-handler","../../lib/nsc-rewards","../../lib/epic-classics"].map(name=>require.resolve(name));
  const previous=new Map(paths.map(file=>[file,require.cache[file]]));
  require.cache[supabasePath].exports={...originalSupabase,async supabaseServiceRequest(path,options){
    assert.equal(path,"/rest/v1/rpc/nothingsports_rate_v2","only the disposable rating RPC is allowed");
    calls.push({path,body:options.body});
    return {eventId:options.body.target_event_id,phase:options.body.target_phase,rating:options.body.target_rating,submitted:true,replayed:false};
  }};
  paths.forEach(file=>delete require.cache[file]);
  try{
    const server=require("../../lib/nothingscore-server"),map=server.eventMap();
    assert(map.has(ausId),"working Australian Championship control must remain registered");
    const nba=official.events.find(event=>event.id===nbaId);assert(nba,"retained NBA positive fixture exists");
    assert(map.has(nbaId),"NBA fixture already supported by Follow/Feed must be registered for rating lookup");
    const nbaFixtures=official.events.filter(event=>event.key==="nba");
    assert(nbaFixtures.length>1000,"the existing official NBA schedule remains the source");
    for(const fixture of nbaFixtures){
      const event=map.get(fixture.canonicalEventId||fixture.eventId||fixture.id);
      assert(event,"every supported official NBA fixture has a rating identity: "+fixture.id);
      assert.deepEqual(event.participantIds,fixture.participantIds,"rating lookup cannot infer or change teams");
      assert.equal(event.startTimeUtc,fixture.startTimeUtc,"rating lookup cannot invent kickoff");
    }
    const handler=require("../../lib/nothingscore-handler"),crowd=require("../../lib/nsc-crowd");
    const now=new Date("2026-11-02T00:00:00.000Z");
    for(const id of [nbaId,ausId]){
      const resolved=handler._test.requireEvent(id);
      assert.equal(resolved.id,server.canonicalEventId(id));
      assert.equal(resolved.event,server.eventFor(id),"the actual API lookup uses the registered record");
      assert.equal(crowd.phaseFor(server.eventTiming(resolved.event),now),"heat");
      const receipt=await require("../../lib/nsc-rewards").submit("disposable-user",resolved.id,"heat",4,resolved.event,now);
      assert.equal(receipt.eventId,resolved.id);assert.equal(receipt.rating,4);
      const body=calls.at(-1).body;
      assert.equal(body.target_user_id,"disposable-user");assert.equal(body.target_event_id,resolved.id);
      assert.equal(body.target_phase,"heat");assert.equal(body.fixture_start,resolved.event.startTimeUtc);
      assert.equal(body.fixture_status,resolved.event.status);
    }
    assert.equal(calls.length,2,"one disposable RPC per deliberate rating, no ancillary calls");
    const event=server.eventFor(nbaId);
    assert.equal(crowd.phaseFor({...server.eventTiming(event),status:"postponed"},now),null);
    assert.equal(crowd.phaseFor(server.eventTiming(event),new Date("2026-11-04T00:00:00Z")),null,"elapsed clock cannot invent live or finished play");
    assert.equal(map.has("fixture:nba:unregistered"),false,"unknown fixture identity stays unknown");
    return {scope:"actual cold NSC registry/API lookup/reward-call metadata; disposable RPC only, not physical phone or database persistence",nbaFixtures:nbaFixtures.length,controls:[nbaId,ausId],rpcCalls:calls.length};
  }finally{
    require.cache[supabasePath].exports=originalSupabase;
    for(const file of paths){delete require.cache[file];if(previous.get(file))require.cache[file]=previous.get(file);}
  }
}
module.exports={run};
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
