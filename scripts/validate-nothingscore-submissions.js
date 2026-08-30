#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const root = `${__dirname}/..`;
const sql = fs.readFileSync(`${root}/supabase/nothingscore.sql`, "utf8");
const handlerSource = fs.readFileSync(`${root}/lib/nothingscore-handler.js`, "utf8");
const serverSource = fs.readFileSync(`${root}/lib/nothingscore-server.js`, "utf8");

assert.match(sql, /submitted_at timestamptz/);
assert.match(sql, /update public\.nothingsports_nsc_contributions[\s\S]+phase in \('heat','impact'\)[\s\S]+submitted_at is null/i);
assert.match(sql, /create or replace function public\.nothingsports_nsc_submit_rating/i);
assert.match(sql, /nothingsports_nsc_submit_rating[\s\S]+language plpgsql security invoker set search_path=''/i);
assert.match(sql, /nsc_already_submitted/i);
assert.match(sql, /nothingsports_nsc_lock_submitted_contribution/i);
assert.match(sql, /if tg_op = 'INSERT'[\s\S]+new\.phase in \('heat','impact'\)[\s\S]+new\.submitted_at := coalesce/i, "rolling deploys must stamp Heat/Impact rows written by the previous API");
assert.match(sql, /create trigger nothingsports_nsc_lock_submitted_contribution\s+before insert or update/i, "the compatibility stamp and immutable update lock must share one trigger");
assert.match(sql, /revoke all on function public\.nothingsports_nsc_submit_rating[\s\S]+from public,anon,authenticated/i);
assert.match(sql, /grant execute on function public\.nothingsports_nsc_submit_rating[\s\S]+to service_role/i);
assert.match(handlerSource, /body\.action==="submit"/);
assert.match(handlerSource, /nsc_already_submitted/);
assert.doesNotMatch(handlerSource, /async function postProfile\(body,user\)[\s\S]{0,240}pilotFor/);
assert.match(serverSource, /async function submitRating/);
assert.match(serverSource, /submitted_at/);
assert.match(serverSource, /pointsAwarded/);
assert.match(serverSource, /submissions/);

function responseCapture(){
  return {
    statusCode:0,
    body:null,
    headers:{},
    setHeader(name,value){this.headers[name]=value;},
    status(code){this.statusCode=code;return this;},
    json(value){this.body=value;return this;},
  };
}

async function serverContract(){
  const supabasePath = require.resolve(`${root}/lib/supabase-server.js`);
  const serverPath = require.resolve(`${root}/lib/nothingscore-server.js`);
  const actualSupabase = require(supabasePath);
  const supabaseCache = require.cache[supabasePath];
  const calls=[];
  supabaseCache.exports={
    ...actualSupabase,
    async supabaseServiceRequest(path,options){
      calls.push({path,options});
      return [{
        event_id:"fixture-one", phase:"heat", rating:5, tags:["Big stakes"],
        submitted_at:"2026-08-30T01:00:00.000Z", points_awarded:3, replayed:false,
      }];
    },
  };
  delete require.cache[serverPath];
  try{
    const server = require(serverPath);
    const hiddenProfile={profile_id:"profile-hidden",display_name:"Private Person",handle:"private_person",visibility:"hidden"};
    assert.deepEqual(server.ownerProfile(hiddenProfile),{
      profileId:"profile-hidden",displayName:"Private Person",handle:"@private_person",visibility:"hidden",hidden:true,deleted:false,
    },"the signed-in owner must receive their real hidden Public Profile fields");
    assert.deepEqual(server.publicProfile(hiddenProfile),{
      displayName:"Hidden contributor",handle:null,hidden:true,
    },"public contributor surfaces must continue anonymising hidden profiles");
    assert.deepEqual(server.ownerProfile({...hiddenProfile,visibility:"deleted"}),{
      profileId:"profile-hidden",displayName:null,handle:null,visibility:"deleted",hidden:true,deleted:true,
    },"a deleted profile must remain a recreation sentinel rather than exposing deleted placeholder values");
    const receipt=await server.submitRating("user-one","fixture-one","heat",5,["Big stakes"],"2026-08-30T01:00:00.000Z");
    assert.equal(calls.length,1);
    assert.equal(calls[0].path,"/rest/v1/rpc/nothingsports_nsc_submit_rating");
    assert.deepEqual(calls[0].options.body,{
      target_user_id:"user-one",target_event_id:"fixture-one",target_phase:"heat",
      target_rating:5,target_tags:["Big stakes"],submitted_time:"2026-08-30T01:00:00.000Z",
    });
    assert.deepEqual(receipt,{
      eventId:"fixture-one",phase:"heat",rating:5,tags:["Big stakes"],
      submitted:true,submittedAt:"2026-08-30T01:00:00.000Z",pointsAwarded:3,replayed:false,
    });
  }finally{
    delete require.cache[serverPath];
    supabaseCache.exports=actualSupabase;
  }
}

async function snapshotContract(){
  const supabasePath = require.resolve(`${root}/lib/supabase-server.js`);
  const serverPath = require.resolve(`${root}/lib/nothingscore-server.js`);
  const actualSupabase = require(supabasePath);
  const supabaseCache = require.cache[supabasePath];
  const userId="11111111-1111-4111-8111-111111111111";
  const eventId="fifa-group-australia-turkiye-2026";
  supabaseCache.exports={
    ...actualSupabase,
    async supabaseServiceRequest(path){
      if(path.includes("nothingsports_nsc_contributions"))return[{
        event_id:eventId,user_id:userId,phase:"heat",bucket_start:"1970-01-01T00:00:00.000Z",
        rating:5,tags:["Big stakes"],submitted_at:"2026-06-13T01:00:00.000Z",
        created_at:"2026-06-13T01:00:00.000Z",updated_at:"2026-06-13T01:00:00.000Z",
      }];
      if(path.includes("nothingsports_nsc_points"))return[
        {event_id:eventId,action_key:"heat_rating",points:2},
        {event_id:eventId,action_key:"heat_valid_tags",points:1},
      ];
      if(path.includes("nothingsports_nsc_profiles"))return[{
        user_id:userId,profile_id:"22222222-2222-4222-8222-222222222222",handle:"test_person",display_name:"Test Person",visibility:"visible",
      }];
      if(path.includes("nothingsports_nsc_personas"))return[{user_id:userId,persona:"general",moderation_flag:false}];
      return[];
    },
  };
  delete require.cache[serverPath];
  try{
    const server=require(serverPath);
    const [snapshot]=await server.snapshots([eventId],{userId,now:new Date("2026-06-13T02:00:00.000Z"),demoMode:"public"});
    assert.equal(snapshot.phase,"heat");
    assert.equal(snapshot.aggregate.contributorMix.real,1);
    assert(snapshot.aggregate.contributorMix.demo>0,"public mode must disclose deterministic demo cohorts separately");
    assert.equal(snapshot.crowdEditorial.mode,"demo","fewer than three real contributors must retain the demo disclosure");
    assert.equal(snapshot.series,undefined,"batch summaries must not carry graph payloads until card detail is requested");
    assert.deepEqual(snapshot.currentUser.submissions.heat,{
      phase:"heat",rating:5,tags:["Big stakes"],bucketStart:"1970-01-01T00:00:00.000Z",
      submitted:true,submittedAt:"2026-06-13T01:00:00.000Z",pointsAwarded:3,
    });
    assert.deepEqual(snapshot.currentUser.contribution,snapshot.currentUser.submissions.heat,"the active-phase compatibility field must expose the same durable receipt");
  }finally{
    delete require.cache[serverPath];
    supabaseCache.exports=actualSupabase;
  }
}

async function handlerContracts(){
  const supabasePath = require.resolve(`${root}/lib/supabase-server.js`);
  const serverPath = require.resolve(`${root}/lib/nothingscore-server.js`);
  const handlerPath = require.resolve(`${root}/lib/nothingscore-handler.js`);
  const actualSupabase = require(supabasePath);
  const actualServer = require(serverPath);
  const supabaseCache = require.cache[supabasePath];
  const serverCache = require.cache[serverPath];
  let pilotCalls=0,profileWrites=0,submitMode="success",profileVisibility="visible",eventPhase="heat",existingSubmission=null;
  const submitCalls=[];
  supabaseCache.exports={
    ...actualSupabase,
    bearerToken(){return "token";},
    async authenticatedUser(){return{id:"11111111-1111-4111-8111-111111111111"};},
    async supabaseServiceRequest(){profileWrites+=1;return null;},
  };
  serverCache.exports={
    TABLES:{profiles:"profiles",sessions:"sessions",contributions:"contributions"},
    canonicalEventId(value){return value;},
    eventFor(){return eventPhase==="heat"
      ?{startTimeUtc:"2099-01-01T00:00:00.000Z",endTimeUtc:"2099-01-01T03:00:00.000Z"}
      :{startTimeUtc:"2020-01-01T00:00:00.000Z",endTimeUtc:"2020-01-01T03:00:00.000Z"};},
    eventTiming(event){return event;},
    async rows(table){return table==="contributions"&&existingSubmission?[existingSubmission]:[];},
    rowsPath(){return"/profiles";},
    async pilotFor(){pilotCalls+=1;return{approved:true,suspended:false};},
    async profileFor(){return{profile_id:"profile-one",display_name:"Test Person",handle:"test_person",visibility:profileVisibility};},
    async snapshots(){return[];},
    ownerProfile:actualServer.ownerProfile,
    async personaFor(){return{persona:"general",moderation_flag:false};},
    async submitRating(_userId,_eventId,phase,rating,tags){
      submitCalls.push({phase,rating,tags});
      if(submitMode==="conflict")throw new actualSupabase.SupabaseRequestError("nsc_already_submitted",{status:400,payload:{code:"P0001",message:"nsc_already_submitted"}});
      return{eventId:"fixture-one",phase,rating,tags,submitted:true,submittedAt:"2026-08-30T01:00:00.000Z",pointsAwarded:2,replayed:submitMode==="replay"};
    },
  };
  delete require.cache[handlerPath];
  try{
    const handler=require(handlerPath);
    const profileResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"profile",displayName:"Test Person",handle:"test_person"}},profileResponse);
    assert.equal(profileResponse.statusCode,200);
    assert.equal(profileWrites,1);
    assert.equal(pilotCalls,0,"creating a Public Profile must not require NSC pilot access");

    const submitResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"submit",eventId:"fixture-one",phase:"heat",rating:4,tags:[]}},submitResponse);
    assert.equal(submitResponse.statusCode,200);
    assert.equal(submitResponse.body.submitted,true);
    assert.equal(submitResponse.body.pointsAwarded,2);
    assert.deepEqual(submitCalls.at(-1),{phase:"heat",rating:4,tags:[]},"the API must submit the phase selected by the user");
    assert.equal(pilotCalls,1,"submitting an NSC rating must remain pilot-gated");

    const callsBeforeUnbound=submitCalls.length;
    const unboundPhaseResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"submit",eventId:"fixture-one",rating:4,tags:[]}},unboundPhaseResponse);
    assert.equal(unboundPhaseResponse.statusCode,400,"a submission without its selected phase must not be reclassified from server time");
    assert.equal(unboundPhaseResponse.body.code,"invalid_nsc_phase");
    assert.equal(submitCalls.length,callsBeforeUnbound);

    eventPhase="impact";
    existingSubmission={phase:"heat",rating:4,tags:[],submitted_at:"2026-08-30T01:00:00.000Z"};
    submitMode="replay";
    const replayResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"submit",eventId:"fixture-one",phase:"heat",rating:4,tags:[]}},replayResponse);
    assert.equal(replayResponse.statusCode,200,"an identical submitted Heat retry must replay after the fixture crosses phase");
    assert.equal(replayResponse.body.phase,"heat");
    assert.equal(replayResponse.body.replayed,true);

    existingSubmission=null;
    submitMode="success";
    const callsBeforeStale=submitCalls.length;
    const stalePhaseResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"submit",eventId:"fixture-one",phase:"heat",rating:4,tags:[]}},stalePhaseResponse);
    assert.equal(stalePhaseResponse.statusCode,409,"a new draft from an expired phase must not be persisted in the current phase");
    assert.equal(stalePhaseResponse.body.code,"phase_action_mismatch");
    assert.equal(submitCalls.length,callsBeforeStale,"stale new submissions must be rejected before the atomic submission RPC");
    eventPhase="heat";

    profileVisibility="hidden";
    const hiddenOwnerResponse=responseCapture();
    await handler({method:"GET",url:"https://nothingsport.vercel.app/api/nothingscore?ids=fixture-one",headers:{authorization:"Bearer token"}},hiddenOwnerResponse);
    assert.equal(hiddenOwnerResponse.statusCode,200);
    assert.deepEqual(hiddenOwnerResponse.body.viewer.profile,{
      profileId:"profile-one",displayName:"Test Person",handle:"@test_person",visibility:"hidden",hidden:true,deleted:false,
    },"viewer.profile GET must serialize the signed-in owner's hidden profile, not the public anonymous form");

    profileVisibility="deleted";
    const deletedOwnerResponse=responseCapture();
    await handler({method:"GET",url:"https://nothingsport.vercel.app/api/nothingscore?ids=fixture-one",headers:{authorization:"Bearer token"}},deletedOwnerResponse);
    assert.equal(deletedOwnerResponse.statusCode,200);
    assert.equal(deletedOwnerResponse.body.viewer.profile.visibility,"deleted");
    assert.equal(deletedOwnerResponse.body.viewer.profile.displayName,null,"deleted owner profiles must still require recreation");
    profileVisibility="visible";

    const staleResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"rate",eventId:"fixture-one",rating:4,tags:[]}},staleResponse);
    assert.equal(staleResponse.statusCode,409);
    assert.equal(staleResponse.body.code,"nsc_submit_required","stale instant-save clients must not silently lock a draft");

    submitMode="conflict";
    const conflictResponse=responseCapture();
    await handler({method:"POST",headers:{authorization:"Bearer token"},body:{action:"submit",eventId:"fixture-one",phase:"heat",rating:5,tags:[]}},conflictResponse);
    assert.equal(conflictResponse.statusCode,409);
    assert.equal(conflictResponse.body.code,"nsc_already_submitted");
  }finally{
    delete require.cache[handlerPath];
    supabaseCache.exports=actualSupabase;
    serverCache.exports=actualServer;
  }
}

Promise.resolve()
  .then(serverContract)
  .then(snapshotContract)
  .then(handlerContracts)
  .then(()=>console.log("Nothingscore submission validation passed (global profile, atomic immutable receipts, exact points and snapshot hooks)."))
  .catch(error=>{console.error(error);process.exitCode=1;});
