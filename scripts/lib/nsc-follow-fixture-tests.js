"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),acorn=require("acorn");
const official=require("../../data/follow-sources/official.v1.json");
const nbaId="fixture:nba:0022600163";
const ausFixture=require("../../data/football/fixtures/australian-championship.json").events.find(event=>event.id==="football-australian-championship-2026-22278890");
const ausId=ausFixture?.canonicalEventId;
assert.equal(ausId,"event:football:australian-championship:2026:22278890");
let browserReminderSource;
let actualHtml;
const htmlSource=()=>actualHtml||=(fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8"));

async function reminderAcknowledgement(event,catalogue,now,{fail=false}={}){
  const identity=require("../../config/event-action-identity"),policy=require("../../config/fixture-reminder-policy");
  const intents=new Map(),scheduled=new Map(),calls=[];
  const request=async(route,options)=>{
    calls.push(route);
    if(route.endsWith("/nothingsports_set_reminder_choice")){
      intents.set(options.body.fixture_key,{fixtureId:options.body.fixture_key,choice:options.body.enabled?"on":"off",enabled:options.body.enabled,chosenAt:now.toISOString()});return null;
    }
    if(route.endsWith("/nothingsports_reminder_accounts"))return [{user_id:"disposable-user",updated_at:now.toISOString(),preferences:{followFirst:{notifications:{enabled:true,autoRemindersEnabled:false}}},actions:{},intents:[...intents.values()]}];
    if(route.endsWith("/nothingsports_reconcile_reminder_accounts")){
      for(const packet of options.body.packets)for(const item of packet.items)scheduled.set(item.fixture_id,item);
      return scheduled.size;
    }
    throw Error("Unexpected disposable reminder route: "+route);
  };
  if(!browserReminderSource){
    const html=htmlSource();
    const code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes("function savePreferences("));
    const tree=acorn.parse(code,{ecmaVersion:"latest"}),names=["optimisticLostResponse","runOptimisticMutation","toggleQuickReminder"];
    browserReminderSource=names.map(name=>{const nodes=tree.body.filter(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert.equal(nodes.length,1);return code.slice(nodes[0].start,nodes[0].end);}).join("\n");
  }
  let actions={},buttonState=null,explanation=null,release,entered;
  const wait=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  const group={querySelector:()=>explanation,appendChild(node){explanation=node;}};
  const action=ev=>identity.resolveAction(ev,actions).action||{};
  const context={console,Date,EVENT_ACTION_IDENTITY:identity,eventActions:actions,userPreferences:{},
    getEventAction:action,storedEventAction:action,eventReminderTiming:ev=>policy.manualTiming(ev,+now),reminderCanBeScheduled:t=>Boolean(t&&Date.parse(t.startsAt)>+now),
    updateEventAction(ev,patch){actions=identity.writeAction(actions,ev,{...action(ev),...patch});context.eventActions=actions;},
    saveEventActions(next){actions=next;context.eventActions=actions;},renderQuickReminderInstances(_ev,enabled,options={}){buttonState={enabled,pending:Boolean(options.pending)};},
    document:{createElement:()=>({textContent:"",remove(){explanation=null;}})},
    ensureWebPushReminder:async()=>{
      entered();await wait;
      if(fail)throw Object.assign(Error("Server sync is temporarily unavailable."),{status:503});
      await require("../../lib/automatic-reminders").choose({userId:"disposable-user",fixture:event,enabled:true,request,now,catalogue});
      return {reminded:true,eventId:policy.fixtureId(event)};
    },removeWebPushReminder(){throw Error("Unexpected cancellation");},serverSyncClient:{getSession:()=>({})},
    clonePreferences:structuredClone,setBackgroundNotificationPreference:p=>p,savePreferences(){},recordEventFeedAction(){},recordWatchDecision(){},recordCodeAffinity(){},codeIdForEvent:()=>event.codeId||event.key,toasts:[],
  };
  context.showToast=message=>context.toasts.push(message);vm.createContext(context);vm.runInContext(browserReminderSource,context);
  const pending=context.toggleQuickReminder(event,{closest:()=>group});await started;
  assert.deepEqual(buttonState,{enabled:true,pending:true},"initial toggle is provisional");assert.equal(intents.size,0);assert.equal(scheduled.size,0);
  release();await pending;
  assert.deepEqual(buttonState,{enabled:!fail,pending:false},"final UI state follows the acknowledgement");
  if(fail){assert.equal(calls.length,0);assert.equal(Boolean(action(event).reminderRequested),false);assert(context.toasts.some(s=>s.includes("Server sync is temporarily unavailable")));}
  else{
    const id=policy.fixtureId(event);assert.equal(intents.get(id)?.choice,"on");assert.equal(scheduled.get(id)?.enabled,true);assert.equal(scheduled.get(id)?.starts_at,event.startTimeUtc);
    assert.equal(calls.length,3);assert.equal(action(event).reminderRequested,true);
  }
  return {eventId:policy.fixtureId(event),finalOn:!fail,persistedIntents:intents.size,persistedSchedules:scheduled.size,transport:"in-memory only; delivery untested"};
}

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
    const server=require("../../lib/nothingscore-server"),map=server.eventMap(),now=new Date("2026-11-02T00:00:00.000Z");
    const browserId=htmlSource().match(/function nothingscoreEventId\(ev\)\{[\s\S]*?\n\}/)?.[0];assert(browserId);
    assert.equal(vm.runInNewContext("("+browserId+")(fixture)",{fixture:ausFixture}),ausId,"Aus control uses the exact ID sent by the browser");
    const nba=official.events.find(event=>event.id===nbaId);assert(nba,"retained NBA positive fixture exists");
    assert.equal(vm.runInNewContext("("+browserId+")(fixture)",{fixture:nba}),nbaId,"NBA target uses the exact ID sent by the browser");
    const reminders=require("../../lib/reminder-fixtures"),policy=require("../../config/fixture-reminder-policy");
    const reminderCatalogue=await reminders.catalogue({snapshots:[],now});
    const lookup={nbaId,ausId,rating:Boolean(server.eventFor(nbaId)),reminder:Boolean(reminderCatalogue.resolve(nbaId)),nbaReminderTiming:Boolean(policy.manualTiming(reminderCatalogue.resolve(nbaId),+now)),ausRating:Boolean(server.eventFor(ausId)),ausReminder:Boolean(policy.manualTiming(reminderCatalogue.resolve(ausId),+now))};
    console.log("Fixture lookup comparison: "+JSON.stringify(lookup));
    const handler=require("../../lib/nothingscore-handler"),crowd=require("../../lib/nsc-crowd");
    for(const id of [nbaId,ausId]){
      if(!server.eventFor(id))continue;
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
    const reminderResults=[];
    for(const id of [nbaId,ausId]){
      const fixture=reminderCatalogue.resolve(id);
      if(fixture&&policy.manualTiming(fixture,+now))reminderResults.push(await reminderAcknowledgement(fixture,reminderCatalogue,now));
      else reminderResults.push({eventId:id,status:"UNRUN_MISSING_SUPPORTED_FIXTURE_TIMING"});
    }
    if(reminderCatalogue.resolve(nbaId)&&policy.manualTiming(reminderCatalogue.resolve(nbaId),+now))reminderResults.push(await reminderAcknowledgement(reminderCatalogue.resolve(nbaId),reminderCatalogue,now,{fail:true}));
    console.log("Fixture action final states: "+JSON.stringify({lookup,ratingRpcCalls:calls.length,reminderResults}));
    assert(lookup.ausRating,"working Australian Championship control must resolve through the complete lookup");
    assert(lookup.ausReminder,"working Aus reminder control must resolve with supported future timing");
    assert(lookup.rating&&lookup.reminder,"NBA fixture already supported by Follow/Feed must resolve for both ratings and reminders");
    assert(lookup.nbaReminderTiming,"the known NBA UTC start must carry supported precision before a reminder can be acknowledged");
    assert.equal(reminderResults.length,3,"NBA/Aus acknowledgements and NBA service-failure rollback are mandatory");
    assert.deepEqual(reminderResults.map(result=>[result.eventId,result.finalOn,result.persistedIntents,result.persistedSchedules]),[[nbaId,true,1,1],[ausId,true,1,1],[nbaId,false,0,0]]);
    assert.deepEqual(server.eventFor(ausId).participantIds,ausFixture.participantIds,"existing Aus participants remain exact");
    assert.equal(Date.parse(server.eventFor(ausId).startTimeUtc),Date.parse(ausFixture.startTimeUtc),"existing Aus kickoff remains exact");
    assert.equal(calls.length,2,"one disposable RPC per deliberate rating, no ancillary calls");
    const nbaFixtures=official.events.filter(event=>event.key==="nba");
    assert(nbaFixtures.length>1000,"the existing official NBA schedule remains the source");
    for(const fixture of nbaFixtures){
      const resolved=server.eventFor(fixture.canonicalEventId||fixture.eventId||fixture.id);
      assert(resolved,"every supported official NBA fixture has a rating identity: "+fixture.id);
      assert.deepEqual(resolved.participantIds,fixture.participantIds,"rating lookup cannot infer or change teams");
      assert.equal(resolved.startTimeUtc,fixture.startTimeUtc,"rating lookup cannot invent kickoff");
    }
    const event=server.eventFor(nbaId);
    assert.equal(crowd.phaseFor({...server.eventTiming(event),status:"postponed"},now),null);
    assert.equal(crowd.phaseFor(server.eventTiming(event),new Date("2026-11-04T00:00:00Z")),null,"elapsed clock cannot invent live or finished play");
    assert.equal(server.eventFor("fixture:nba:unregistered"),null,"unknown fixture identity stays unknown");
    assert.equal(policy.manualTiming({...reminderCatalogue.resolve(nbaId),timePrecision:"unknown"},+now),null,"unknown precision stays blocked");
    assert.equal(policy.manualTiming({...reminderCatalogue.resolve(nbaId),timingVerified:false},+now),null,"unverified timing stays blocked");
    assert.equal(policy.manualTiming({...reminderCatalogue.resolve(nbaId),status:"completed"},+now),null,"completed play cannot acquire a future reminder");
    const projection=require("../../lib/official-follow-fixtures");
    for(const held of [{timePrecision:"unknown"},{timePrecision:"tbc"},{timeTbc:true},{startTimeTbc:true},{dateOnly:true},{timingVerified:false},{startTimeUtc:null}]){
      assert.equal(policy.manualTiming(projection.project({...nba,...held}),+now),null,"source uncertainty must survive official fixture projection: "+JSON.stringify(held));
    }
    assert.equal(projection.project(nba).sourceCheckedAt,nba.sourceCheckedAt,"projection cannot refresh a source observation");
    return {scope:"actual full NSC/reminder lookup, rating-call metadata and browser final acknowledgement; disposable transport/storage only, no physical phone/database/delivery proof",nbaFixtures:nbaFixtures.length,controls:[nbaId,ausId],rpcCalls:calls.length,reminderResults};
  }finally{
    require.cache[supabasePath].exports=originalSupabase;
    for(const file of paths){delete require.cache[file];if(previous.get(file))require.cache[file]=previous.get(file);}
  }
}
module.exports={run};
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
