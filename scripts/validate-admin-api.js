#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");

function responseCapture(){return{headers:{},statusCode:0,body:null,setHeader(name,value){this.headers[name]=value},status(value){this.statusCode=value;return this},json(value){this.body=value;return this}}}
function parsePath(value){return new URL(value,"https://supabase.test")}

async function main(){
  process.env.PARTICIPATION_SECRET="a".repeat(64);
  const supabase=require("../lib/supabase-server"),originalRequest=supabase.supabaseServiceRequest,originalUser=supabase.authenticatedUser;
  const actorId="00000000-0000-4000-8000-000000000001",jimId="00000000-0000-4000-8000-000000000002",reporterId="00000000-0000-4000-8000-000000000003",reportId="10000000-0000-4000-8000-000000000001";
  const accounts=[
    {id:actorId,email:"owner@example.test",email_confirmed_at:"2026-08-01T00:00:00Z",last_sign_in_at:"2026-08-30T00:00:00Z"},
    {id:jimId,email:"jim@example.test",email_confirmed_at:"2026-08-02T00:00:00Z",last_sign_in_at:null},
    {id:reporterId,email:"reporter@example.test",email_confirmed_at:"2026-08-03T00:00:00Z",last_sign_in_at:null},
  ];
  const profiles=new Map([
    [jimId,{user_id:jimId,profile_id:"20000000-0000-4000-8000-000000000002",display_name:"Jim Sample",handle:"jim_sample",visibility:"visible",updated_at:"2026-08-20T00:00:00Z"}],
    [reporterId,{user_id:reporterId,profile_id:"20000000-0000-4000-8000-000000000003",display_name:"Riley Reporter",handle:"riley_reporter",visibility:"visible",updated_at:"2026-08-20T00:00:00Z"}],
  ]),pilots=new Map(),contributions=[],panelState={id:"public",public_enabled:true,retirement_threshold:10,retired_at:null,retired_by:null,updated_at:"2026-08-31T00:00:00Z"},reports=[{report_id:reportId,reporter_user_id:reporterId,target_user_id:jimId,reason:"offensive",status:"open",created_at:"2026-08-30T00:00:00Z",reviewed_at:null,resolution:null,resolved_at:null}],audits=[];

  supabase.authenticatedUser=async()=>({id:actorId,app_metadata:{role:"admin"},user_metadata:{role:"viewer"}});
  supabase.supabaseServiceRequest=async(path,options={})=>{
    const url=parsePath(path),method=options.method||"GET",table=url.pathname.split("/").at(-1);
    if(url.pathname==="/auth/v1/admin/users")return{users:accounts};
    if(table==="nothingsports_nsc_profiles"){
      if(method==="PATCH"){const userId=url.searchParams.get("user_id").replace(/^eq\./,"");const next={...profiles.get(userId),...options.body};profiles.set(userId,next);return[next]}
      const userId=(url.searchParams.get("user_id")||"").replace(/^eq\./,"");return userId?(profiles.has(userId)?[profiles.get(userId)]:[]):[...profiles.values()];
    }
    if(table==="nothingsports_nsc_pilot_members"){
      if(method==="POST"){const next={...(pilots.get(options.body.user_id)||{}),...options.body};pilots.set(options.body.user_id,next);return[next]}
      const userId=(url.searchParams.get("user_id")||"").replace(/^eq\./,"");return userId?(pilots.has(userId)?[pilots.get(userId)]:[]):[...pilots.values()];
    }
    if(table==="nothingsports_nsc_contributions")return contributions;
    if(table==="nothingsports_nsc_early_panel_state"){
      if(method==="PATCH"){Object.assign(panelState,options.body);return[panelState]}
      return[panelState];
    }
    if(table==="nothingsports_nsc_username_reports"){
      if(method==="PATCH"){const id=url.searchParams.get("report_id").replace(/^eq\./,"");const report=reports.find(item=>item.report_id===id);Object.assign(report,options.body);return[]}
      const id=(url.searchParams.get("report_id")||"").replace(/^eq\./,"");const status=(url.searchParams.get("status")||"").replace(/^eq\./,"");return reports.filter(report=>(!id||report.report_id===id)&&(!status||report.status===status));
    }
    if(table==="nothingsports_nsc_admin_audit"&&method==="POST"){audits.push(options.body);return[]}
    throw new Error(`Unhandled mock request ${method} ${path}`);
  };
  delete require.cache[require.resolve("../lib/admin-moderation")];delete require.cache[require.resolve("../lib/admin-api")];
  const{usersHandler,reportsHandler,panelHandler}=require("../lib/admin-api");
  try{
    const usersResponse=responseCapture();await usersHandler({method:"GET",headers:{authorization:"Bearer test"},query:{q:"jim"}},usersResponse);
    assert.equal(usersResponse.statusCode,200);assert.equal(usersResponse.body.users.length,1);assert.equal(usersResponse.body.users[0].email,"jim@example.test");assert.equal(Object.hasOwn(usersResponse.body.users[0],"id"),false,"raw Auth IDs must not leave the users API");
    const jimRef=usersResponse.body.users[0].subjectRef;
    const unconfirmed=responseCapture();await usersHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"approve",subjectRef:jimRef}},unconfirmed);
    assert.equal(unconfirmed.statusCode,409);assert.equal(pilots.has(jimId),false,"unconfirmed controls must not mutate pilot state");
    const approved=responseCapture();await usersHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"approve",subjectRef:jimRef,confirm:true}},approved);
    assert.equal(approved.statusCode,200);assert.equal(pilots.get(jimId).approved,true);assert.equal(audits.at(-1).action,"approve");

    const reportsResponse=responseCapture();await reportsHandler({method:"GET",headers:{authorization:"Bearer test"},query:{status:"open"}},reportsResponse);
    assert.equal(reportsResponse.statusCode,200);assert.equal(reportsResponse.body.reports.length,1);
    const serialized=JSON.stringify(reportsResponse.body);assert(!serialized.includes(jimId)&&!serialized.includes(reporterId),"reports must not expose raw Auth IDs");assert(!serialized.includes("@example.test"),"reports must not expose reporter or target emails");
    const beforePilot={...pilots.get(jimId)},beforeVisibility=profiles.get(jimId).visibility;
    const reviewed=responseCapture();await reportsHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"mark-reviewed",reportId,resolution:"Checked",confirm:true}},reviewed);
    assert.equal(reviewed.statusCode,200);assert.equal(reports[0].status,"reviewed");assert.deepEqual(pilots.get(jimId),beforePilot,"reviewing a report must not change pilot access");assert.equal(profiles.get(jimId).visibility,beforeVisibility,"reviewing a report must not hide the profile");
    const hidden=responseCapture();await reportsHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"hide-profile",reportId,confirm:true}},hidden);
    assert.equal(hidden.statusCode,200);assert.equal(profiles.get(jimId).visibility,"hidden");assert.equal(pilots.get(jimId).approved,true,"profile moderation must remain independent from pilot approval");assert.equal(audits.at(-1).report_id,reportId);

    const panelBefore=responseCapture();await panelHandler({method:"GET",headers:{authorization:"Bearer test"}},panelBefore);
    assert.equal(panelBefore.statusCode,200);assert.equal(panelBefore.body.activeRealContributors90d,0);assert.equal(panelBefore.body.retirementThreshold,10);assert.equal(panelBefore.body.eligibleToRetire,false);
    const premature=responseCapture();await panelHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"retire-early-panel",confirm:true}},premature);
    assert.equal(premature.statusCode,409,"the public panel cannot be retired before the genuine-contributor milestone");
    for(let index=0;index<10;index+=1){const id=`30000000-0000-4000-8000-${String(index).padStart(12,"0")}`;pilots.set(id,{user_id:id,approved:true,suspended:false});contributions.push({user_id:id,phase:"heat",rating:4,submitted_at:"2026-08-30T00:00:00Z",updated_at:"2026-08-30T00:00:00Z"})}
    const retired=responseCapture();await panelHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"retire-early-panel",confirm:true}},retired);
    assert.equal(retired.statusCode,200);assert.equal(panelState.public_enabled,false);assert.equal(audits.at(-1).action,"retire-early-panel");
    const restored=responseCapture();await panelHandler({method:"POST",headers:{authorization:"Bearer test"},body:{action:"restore-early-panel",confirm:true}},restored);
    assert.equal(restored.statusCode,200);assert.equal(panelState.public_enabled,true);assert.equal(audits.at(-1).action,"restore-early-panel");
  }finally{
    supabase.supabaseServiceRequest=originalRequest;supabase.authenticatedUser=originalUser;
  }
  console.log("Owner console API validation passed: confirmation, approval/profile gates, independent report actions, privacy and audit writes are enforced.");
}

main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1});
