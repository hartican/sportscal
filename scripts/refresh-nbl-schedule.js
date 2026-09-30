#!/usr/bin/env node
"use strict";

const fs=require("node:fs"),path=require("node:path");
const OUTPUT=path.resolve(__dirname,"../data/canonical/nbl-2026-27.json");
const SOURCE_URL="https://schedule.nbl.com.au/api/calendar/schedule?league=nbl&limit=500&offset=0&year=2026";
const PAGE_URL="https://schedule.nbl.com.au/nbl";
const {nblMatchContext}=require("./lib/nbl-match-context");
const {officialStandings}=require("./lib/nbl-standings");
const directory=require("../data/canonical/nbl-directory.v1.json");

const slug=value=>String(value||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const teamByName=new Map((directory.teams||[]).map(team=>[slug(team.displayName),team]));
teamByName.set("nz-breakers",teamByName.get("new-zealand-breakers"));
function localParts(iso){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso)).reduce((o,x)=>(x.type!=="literal"&&(o[x.type]=x.value),o),{});return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function teamFor(raw){const team=teamByName.get(slug(raw?.name));if(!team)throw new Error(`Unknown NBL team: ${raw?.name||"missing"}`);return team;}
function viewingFor(match,checkedAt){
 const labels=[match.primary_broadcaster?.label,match.secondary_broadcaster?.label].filter(Boolean);
 const free=labels.some(label=>/\b9now\b/i.test(label));
 const espn=labels.some(label=>/\bespn\b/i.test(label));
 return [...(free?['nine']:[]),...(espn?['disney','kayo','foxtel']:[])].map(providerId=>({
  providerId,rightsScope:'fixture',territory:'AU',liveOrReplay:'live',
  sourceUrl:PAGE_URL,verifiedAt:checkedAt,
  ...(providerId==='nine'?{}:{rightsSourceUrl:'https://www.nbl.com.au/news/how-to-watch-the-hungry-jacks-nbl27-season',rightsCheckedAt:'2026-09-27T17:28:49.660Z'}),
 }));
}
function build(payload,checkedAt=new Date().toISOString(),previousStandings=[]){
 if(payload?.leaguePath!=='nbl'||payload.year!==2026||payload.fallback!==false||payload.offset!==0||!Array.isArray(payload.matches)||payload.total!==payload.matches.length||!Number.isFinite(Date.parse(checkedAt)))throw Error('NBL schedule scope, completeness or observation is unverified');
 const season=payload.seasons_meta?.filter(s=>s.name==='NBL27'&&s.season_type==='regular');
 if(season?.length!==1||!season[0].id||season[0].match_count!==165)throw Error('NBL regular-season identity is unverified');
 const matches=(payload.matches||[]).filter(match=>match.season_type==="regular");
 if(matches.length!==165)throw new Error(`Expected 165 NBL27 regular-season games, received ${matches.length}`);
 const ids=new Set();
 for(const match of matches){
  if(typeof match.id!=='string'||!match.id||ids.has(match.id)||match.season_id!==season[0].id)throw Error('NBL fixture identity is missing, duplicated or wrong-season');ids.add(match.id);
  const start=match.starts_at_ms;
  if(!Number.isSafeInteger(start)||start<Date.parse('2026-09-01T00:00:00Z')||start>=Date.parse('2027-04-01T00:00:00Z')||!['upcoming','live','complete'].includes(match.phase))throw Error('NBL fixture time or phase requires review');
  if(teamFor(match.home).id===teamFor(match.away).id)throw Error('NBL fixture cannot match a club against itself');
  if(match.phase==='complete'&&(start>=Date.parse(checkedAt)||![match.home_score,match.away_score].every(n=>Number.isSafeInteger(n)&&n>=0)||match.home_score===match.away_score))throw Error('NBL completed fixture needs a past kickoff and decisive scores');
 }
 const events=matches.map(match=>{const home=teamFor(match.home),away=teamFor(match.away),start=new Date(match.starts_at_ms),local=localParts(start);return{
  id:`event:nbl:2026-27:${match.id}`,sportKey:"nbl",codeId:"sport:nbl",competitionId:"competition:nbl",season:"2026-27",name:`${home.displayName} v ${away.displayName}`,
  date:local.date,time:local.time,startTimeUtc:start.toISOString(),venue:match.venue_name||"Venue TBC",round:"all",roundLabel:`Round ${match.round_label}`,roundNumber:Number(match.round_label)||null,stage:"regular season",expected:5,
  participantIds:[home.id,away.id],sourceId:"nbl27-schedule",broadcastSourceId:"nbl27-schedule",status:match.phase==="complete"?"completed":match.phase==="live"?"live":"upcoming",
  result:match.phase==="complete"&&Number.isSafeInteger(match.home_score)&&Number.isSafeInteger(match.away_score)&&match.home_score>=0&&match.away_score>=0&&match.home_score!==match.away_score?{status:"official",homeScore:match.home_score,awayScore:match.away_score,score:`${match.home_score}-${match.away_score}`,winnerParticipantId:Number(match.home_score)>Number(match.away_score)?home.id:away.id,outcomeText:`${home.displayName} ${match.home_score}, ${away.displayName} ${match.away_score}`,recapText:"Official NBL result.",sourceId:"nbl27-schedule",checkedAt}:undefined,
  viewingOptions:viewingFor(match,checkedAt),
  hook:`${home.displayName} face ${away.displayName} in NBL27.`,context:`Official NBL27 Round ${match.round_label} fixture.`,providerId:match.id,
 };});
 for(const event of events)event.teamMatchContext=nblMatchContext(events,event,{season:"2026-27",checkedAt,participants:directory.teams});
 let standings,standingsStatus;
 try{standings=officialStandings(matches,events,{checkedAt,teamFor,sourceUrl:PAGE_URL});standingsStatus='current';}
 catch(error){
  // Optional table metadata must not prevent newer valid scores/fixtures.
  const known=new Set(directory.teams.map(t=>t.id));
  const valid=previousStandings.length===10&&new Set(previousStandings.map(r=>r.rank)).size===10&&new Set(previousStandings.map(r=>r.participantId)).size===10&&previousStandings.every(r=>known.has(r.participantId)&&r.competitionId==='competition:nbl'&&r.season==='2026-27'&&Number.isInteger(r.rank)&&r.rank>=1&&r.rank<=10&&[r.played,r.won,r.lost].every(n=>Number.isSafeInteger(n)&&n>=0)&&r.played===r.won+r.lost&&Number.isFinite(Date.parse(r.asOf))&&Date.parse(r.asOf)<=Date.parse(checkedAt));
  standings=valid?previousStandings.map(r=>({...r,tableNote:'Last verified NBL regular-season table. The latest source table could not be reconciled; positions may be out of date.'})):[];
  standingsStatus=valid?'retained':'unavailable';
 }
 return{schemaVersion:"requested-sports-schedule.v1",seasonLabel:"2026-27",generatedAt:checkedAt,sources:{"nbl27-schedule":{name:"NBL official schedule",url:PAGE_URL,apiUrl:SOURCE_URL,type:"official",checkedAt}},participants:[...(directory.teams||[])].map(team=>({id:team.id,sportKey:"nbl",displayName:team.displayName,countryCode:team.id.includes("new-zealand")?"NZ":"AU",type:"team"})),events,standings,standingsStatus};
}
async function main(){const response=await fetch(SOURCE_URL,{signal:AbortSignal.timeout(15000),headers:{Accept:"application/json"}});if(!response.ok)throw new Error(`NBL schedule HTTP ${response.status}`);const prior=fs.existsSync(OUTPUT)?JSON.parse(fs.readFileSync(OUTPUT)):null;const next=build(await response.json(),new Date().toISOString(),prior?.standings||[]);if(next.standingsStatus!=='current')console.warn(`NBL standings ${next.standingsStatus}; valid fixture updates retained.`);const check=process.argv.includes("--check");if(check){const prior=JSON.parse(fs.readFileSync(OUTPUT));if(JSON.stringify(prior.events)!==JSON.stringify(next.events))throw new Error("NBL schedule is stale; run refresh-nbl-schedule.js");console.log("NBL27 schedule is current: 165 games.");return;}fs.writeFileSync(OUTPUT,JSON.stringify(next,null,2)+"\n");console.log("NBL27 schedule refreshed: 165 games.");}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={build,localParts,viewingFor};
