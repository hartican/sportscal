#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "data/canonical/swimming-directory.v1.json");
const SOURCE_PAGE = "https://www.worldaquatics.com/swimming/rankings";
const EVENTS = Object.freeze([
  ["FREESTYLE", 50], ["FREESTYLE", 100], ["FREESTYLE", 200], ["FREESTYLE", 400], ["FREESTYLE", 800], ["FREESTYLE", 1500],
  ["BACKSTROKE", 100], ["BACKSTROKE", 200], ["BREASTSTROKE", 100], ["BREASTSTROKE", 200],
  ["BUTTERFLY", 100], ["BUTTERFLY", 200], ["MEDLEY", 200], ["MEDLEY", 400],
]);

async function fetchJson(url){
  const response = await fetch(url, { headers:{ accept:"application/json", "user-agent":"nothingSport canonical refresh/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function titleName(value){
  return String(value || "").toLocaleLowerCase("en-AU").replace(/(^|[\s'-])\p{L}/gu, character => character.toLocaleUpperCase("en-AU"));
}

function rankingUrl(gender, stroke, distance){
  const params = new URLSearchParams({
    countryId:"", distance:String(distance), endDate:"", gender, pageSize:"200",
    poolConfiguration:"LCM", regionId:"", startDate:"", stroke,
    timesMode:"BEST_TIMES", year:"2026",
  });
  return `https://api.worldaquatics.com/fina/rankings/swimming?${params}`;
}

function normalizeAthletes(payloads, genderCategory){
  const byPerson = new Map();
  payloads.forEach(({ payload, stroke, distance, url }) => {
    for (const row of payload.swimmingWorldRankings || []){
      if (!row.personId || !Number.isFinite(Number(row.finaPoints))) continue;
      const existing = byPerson.get(row.personId) || {
        id:`athlete:swimming:${row.personId}`,
        displayName:`${titleName(row.firstName)} ${titleName(row.lastName)}`.trim() || titleName(row.fullName),
        aliases:[row.fullName].filter(Boolean), active:true, entityType:"athlete",
        genderCategory, countryCode:String(row.participantCountryCode || "").toUpperCase() || null,
        countryBasis:"official-world-aquatics-ranking", identityId:`athlete:swimming:${row.personId}`,
        leagueId:"competition:world-aquatics-swimming", sourceRefs:[SOURCE_PAGE], eventRanks:[],
        bestAquaPoints:0,
      };
      existing.bestAquaPoints = Math.max(existing.bestAquaPoints, Number(row.finaPoints));
      existing.sourceRefs = Array.from(new Set([...existing.sourceRefs, url]));
      existing.eventRanks.push({
        disciplineId:row.disciplineId || null, disciplineName:row.disciplineName || `${distance}m ${stroke}`,
        stroke, distance, poolConfiguration:"LCM", rank:Number(row.rank), aquaPoints:Number(row.finaPoints),
        time:row.time || null, resultDate:row.resultDate || null, eventName:row.eventName || null,
      });
      byPerson.set(row.personId, existing);
    }
  });
  return [...byPerson.values()]
    .sort((first, second) => second.bestAquaPoints - first.bestAquaPoints || first.displayName.localeCompare(second.displayName, "en-AU"))
    .slice(0, 30)
    .map((athlete, index) => ({
      ...athlete,
      ranking:index + 1,
      rankingBasis:"deduplicated-maximum-AQUA-points-across-selected-Olympic-LCM-events",
      eventRanks:athlete.eventRanks.sort((a, b) => b.aquaPoints - a.aquaPoints || a.rank - b.rank),
    }));
}

async function buildGender(gender, genderCategory){
  const payloads = [];
  for (const [stroke, distance] of EVENTS){
    const url = rankingUrl(gender, stroke, distance);
    payloads.push({ payload:await fetchJson(url), stroke, distance, url });
  }
  return { athletes:normalizeAthletes(payloads, genderCategory), generatedOn:payloads.map(item => item.payload.generatedOn).filter(Boolean).sort().at(-1) || null };
}

function validate(payload){
  if (payload.athletes.length !== 60) throw new Error(`Swimming: expected 60 athletes, found ${payload.athletes.length}`);
  for (const gender of ["female", "male"]){
    const athletes = payload.athletes.filter(record => record.genderCategory === gender);
    if (athletes.length !== 30) throw new Error(`Swimming: expected 30 ${gender} athletes, found ${athletes.length}`);
    if (new Set(athletes.map(record => record.id)).size !== 30) throw new Error(`Swimming: duplicate ${gender} athlete IDs`);
  }
  for (const athlete of payload.athletes){
    if (!Number.isFinite(athlete.ranking) || !athlete.countryCode || !athlete.eventRanks.length) throw new Error(`Swimming: incomplete ranked athlete ${athlete.id}`);
  }
}

async function main(){
  if (process.argv.includes("--check")){
    const payload = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    validate(payload);
    console.log("Swimming directory valid: 30 women and 30 men with official event-specific ranks.");
    return;
  }
  const [women, men] = await Promise.all([buildGender("F", "female"), buildGender("M", "male")]);
  const payload = {
    schemaVersion:"individual-sport-directory.v1", sportKey:"swimming",
    generatedAt:[women.generatedOn, men.generatedOn].filter(Boolean).sort().at(-1) || new Date().toISOString(),
    source:{ publisher:"World Aquatics", url:SOURCE_PAGE, apiBase:"https://api.worldaquatics.com/fina/rankings/swimming", year:2026, poolConfiguration:"LCM" },
    selection:{ women:30, men:30, events:EVENTS.map(([stroke, distance]) => ({ stroke, distance })), basis:"maximum official AQUA points, deduplicated by athlete" },
    athletes:[...women.athletes, ...men.athletes],
  };
  validate(payload);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive:true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log("Refreshed Swimming: 60 current athletes with official World Aquatics event ranks.");
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
