#!/usr/bin/env node
"use strict";

const fs=require("node:fs"),path=require("node:path");
const OUTPUT=path.resolve(__dirname,"../data/canonical/f1-sessions-2026.json");
const RACES=["spain","azerbaijan","bahrain","singapore","united-states","mexico","brazil","las-vegas","qatar","united-arab-emirates"];
const URL=slug=>`https://www.formula1.com/en/racing/2026/${slug}`;
const slugify=value=>String(value||"").toLowerCase().replace(/grand prix/g,"gp").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function localParts(iso){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function parse(html,raceSlug,checkedAt=new Date().toISOString()){
 const blocks=[...String(html).matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g)].map(match=>JSON.parse(match[1]));
 const race=blocks.find(item=>item?.["@type"]==="SportsEvent"&&Array.isArray(item.subEvent));if(!race)throw new Error(`${raceSlug}: official page has no SportsEvent sessions`);
 return race.subEvent.map(session=>{const start=new Date(session.startDate),end=new Date(session.endDate),local=localParts(start);const type=String(session.name).split(" - ")[0].trim(),raceName=String(session.name).split(" - ").slice(1).join(" - ").replace(/ Grand Prix$/," GP");return{
  id:`event:f1:2026:${raceSlug}:${slugify(type)}`,sportKey:"f1",codeId:"sport:f1",competitionId:"competition:formula-one",name:`${raceName} · ${type}`,date:local.date,time:local.time,startTimeUtc:start.toISOString(),endTimeUtc:end.toISOString(),round:"all",roundLabel:type,stage:type,sessionType:type,expected:/race|sprint$/i.test(type)?9:/qualifying/i.test(type)?8:4,status:end<Date.now()?"completed":"upcoming",sourceId:`f1-${raceSlug}`,hook:`${type} at the ${raceName}.`,context:"Published Formula 1 session from the official 2026 race hub.",sourceUrl:URL(raceSlug),sourceCheckedAt:checkedAt,
 };});
}
async function main(){const checkedAt=new Date().toISOString(),sources={},events=[];for(const race of RACES){const response=await fetch(URL(race));if(!response.ok)throw new Error(`${race}: Formula 1 HTTP ${response.status}`);sources[`f1-${race}`]={name:"Formula 1 official race hub",url:URL(race),type:"official",checkedAt};events.push(...parse(await response.text(),race,checkedAt));}if(events.length<45)throw new Error(`Expected at least 45 F1 sessions, received ${events.length}`);const next={schemaVersion:"requested-sports-schedule.v1",seasonLabel:"2026",generatedAt:checkedAt,sources,participants:[],events};if(process.argv.includes("--check")){const prior=JSON.parse(fs.readFileSync(OUTPUT));if(JSON.stringify(prior.events.map(({sourceCheckedAt,...x})=>x))!==JSON.stringify(next.events.map(({sourceCheckedAt,...x})=>x)))throw new Error("F1 sessions are stale; run refresh-f1-sessions.js");console.log(`F1 sessions are current: ${events.length}.`);return;}fs.writeFileSync(OUTPUT,JSON.stringify(next,null,2)+"\n");console.log(`F1 sessions refreshed: ${events.length}.`);}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={parse,localParts};
