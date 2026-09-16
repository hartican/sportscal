#!/usr/bin/env node
"use strict";

const fs=require("node:fs"),path=require("node:path");
const OUTPUT=path.resolve(__dirname,"../data/canonical/nbl-2026-27.json");
const SOURCE_URL="https://schedule.nbl.com.au/api/calendar/schedule?league=nbl&limit=500&offset=0&year=2026";
const PAGE_URL="https://schedule.nbl.com.au/nbl";
const directory=require("../data/canonical/nbl-directory.v1.json");

const slug=value=>String(value||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const teamByName=new Map((directory.teams||[]).map(team=>[slug(team.displayName),team]));
teamByName.set("nz-breakers",teamByName.get("new-zealand-breakers"));
function localParts(iso){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function teamFor(raw){const team=teamByName.get(slug(raw?.name));if(!team)throw new Error(`Unknown NBL team: ${raw?.name||"missing"}`);return team;}
function build(payload,checkedAt=new Date().toISOString()){
 const matches=(payload.matches||[]).filter(match=>match.season_type==="regular");
 if(matches.length!==165)throw new Error(`Expected 165 NBL27 regular-season games, received ${matches.length}`);
 const events=matches.map(match=>{const home=teamFor(match.home),away=teamFor(match.away),start=new Date(match.starts_at_ms),local=localParts(start);return{
  id:`event:nbl:2026-27:${match.id}`,sportKey:"nbl",codeId:"sport:nbl",competitionId:"competition:nbl",name:`${home.displayName} v ${away.displayName}`,
  date:local.date,time:local.time,startTimeUtc:start.toISOString(),venue:match.venue_name||"Venue TBC",round:"all",roundLabel:`Round ${match.round_label}`,roundNumber:Number(match.round_label)||null,stage:"regular season",expected:5,
  participantIds:[home.id,away.id],sourceId:"nbl27-schedule",broadcastSourceId:"nbl27-schedule",status:match.phase==="complete"?"completed":match.phase==="live"?"live":"upcoming",
  result:match.phase==="complete"&&Number.isFinite(match.home_score)&&Number.isFinite(match.away_score)?{status:"official",score:`${match.home_score}-${match.away_score}`,winnerParticipantId:Number(match.home_score)>Number(match.away_score)?home.id:away.id,outcomeText:`${home.displayName} ${match.home_score}, ${away.displayName} ${match.away_score}`,recapText:"Official NBL result.",sourceId:"nbl27-schedule",checkedAt}:undefined,
  hook:`${home.displayName} face ${away.displayName} in NBL27.`,context:`Official NBL27 Round ${match.round_label} fixture.`,providerId:match.id,
 };});
 return{schemaVersion:"requested-sports-schedule.v1",seasonLabel:"2026-27",generatedAt:checkedAt,sources:{"nbl27-schedule":{name:"NBL official schedule",url:PAGE_URL,apiUrl:SOURCE_URL,type:"official",checkedAt}},participants:[...(directory.teams||[])].map(team=>({id:team.id,sportKey:"nbl",displayName:team.displayName,countryCode:team.id.includes("new-zealand")?"NZ":"AU",type:"team"})),events};
}
async function main(){const response=await fetch(SOURCE_URL,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`NBL schedule HTTP ${response.status}`);const next=build(await response.json());const check=process.argv.includes("--check");if(check){const prior=JSON.parse(fs.readFileSync(OUTPUT));if(JSON.stringify(prior.events)!==JSON.stringify(next.events))throw new Error("NBL schedule is stale; run refresh-nbl-schedule.js");console.log("NBL27 schedule is current: 165 games.");return;}fs.writeFileSync(OUTPUT,JSON.stringify(next,null,2)+"\n");console.log("NBL27 schedule refreshed: 165 games.");}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={build,localParts};
