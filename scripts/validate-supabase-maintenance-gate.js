#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const server=require("../lib/supabase-server");
const {createLiveFixtureHandler}=require("../lib/live-fixture-handler");

function response(){
  return {statusCode:0,body:null,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},end(){}};
}

async function main(){
  assert.equal(server.supabaseMaintenanceMode({SUPABASE_MAINTENANCE_MODE:"1"}),true);
  assert.equal(server.supabaseMaintenanceMode({SUPABASE_MAINTENANCE_MODE:"true"}),true);
  assert.equal(server.supabaseMaintenanceMode({SUPABASE_MAINTENANCE_MODE:"0"}),false);
  let fetched=false;
  await assert.rejects(server.supabaseRequest("/rest/v1/test",{
    environment:{SUPABASE_MAINTENANCE_MODE:"1"},fetchImpl:async()=>{fetched=true;}
  }),error=>error.status===503&&error.payload?.code==="supabase_maintenance");
  assert.equal(fetched,false,"maintenance mode must make zero Supabase requests");

  let refreshed=false;
  const secret="x".repeat(32);
  const handler=createLiveFixtureHandler({
    environment:{SUPABASE_MAINTENANCE_MODE:"1",FIXTURE_REFRESH_SECRET:secret},
    publishedFixtures:()=>[],refresh:async()=>{refreshed=true;return {failed:[]};},
  });
  const res=response();
  await handler({url:"/api/fixture-refresh",method:"POST",headers:{authorization:`Bearer ${secret}`}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.code,"supabase_maintenance");
  assert.equal(refreshed,false,"scheduled refresh must stop before source or database work");

  const cleanup=fs.readFileSync("supabase/recover-disk-pressure.sql","utf8");
  assert.match(cleanup,/set active=false/);
  assert.match(cleanup,/limit 1000/);
  assert.match(cleanup,/limit 100/);
  assert.doesNotMatch(cleanup,/^\s*truncate/im);
  assert.doesNotMatch(cleanup,/^\s*vacuum\s+full/im);
  console.log("Supabase maintenance gate: zero application requests and bounded cleanup passed.");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
