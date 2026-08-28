#!/usr/bin/env node
"use strict";

const action=String(process.argv[2]||"status");
const eventId=String(process.argv[3]||"").trim();
const minutes=Number(process.argv[4]||0);
const token=String(process.env.NOTHINGSPORT_ADMIN_TOKEN||"").trim();
const origin=String(process.env.NOTHINGSPORT_ORIGIN||"http://127.0.0.1:3000").replace(/\/$/,"");
if(!["start","extend","stop","status"].includes(action)||!eventId){console.error("Usage: NOTHINGSPORT_ADMIN_TOKEN=… node scripts/nothingscore-marquee.js <start|extend|stop|status> <canonical-event-id> [extension-minutes]");process.exit(2)}
if(!token){console.error("NOTHINGSPORT_ADMIN_TOKEN is required; the command calls the protected server handler and never uses the service-role key.");process.exit(2)}
fetch(`${origin}/api/nothingscore-marquee`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({action,eventId,...(action==="extend"?{minutes}:{})})}).then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(`${payload.code||response.status}: ${payload.error||"Request failed"}`);console.log(JSON.stringify(payload,null,2))}).catch(error=>{console.error(error.message);process.exitCode=1});
