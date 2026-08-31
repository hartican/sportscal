"use strict";

const nsc = require("../config/nothingscore");

const SCHEMA_VERSION = "nsc-modelled-panel.v2";
const MODES = Object.freeze(["off", "internal", "public"]);
const PERSONAS = Object.freeze([
  Object.freeze({ id:"cohort-01", audienceCohort:"multi-sport-marquee", sports:["afl","nrl","football","tennis","formula 1","surfing"], keywords:["final","major","world cup","grand prix","slam","origin"], selectivity:0.78 }),
  Object.freeze({ id:"cohort-02", audienceCohort:"curated-plus-fixtures", sports:["afl","nrl","football","cricket","tennis","rugby"], keywords:["round","test","series","final"], selectivity:0.46 }),
  Object.freeze({ id:"cohort-03", audienceCohort:"afl-nrl-completist", sports:["afl","nrl","australian football","rugby league"], keywords:["afl","nrl","state of origin"], selectivity:0.18, requiresSport:true }),
  Object.freeze({ id:"cohort-04", audienceCohort:"team-first-australia", sports:["football","cricket","rugby","afl","nrl","tennis"], keywords:["australia","matildas","socceroos","wallabies","wallaroos","ashes","sydney swans","brisbane broncos"], selectivity:0.35, requiresKeyword:true }),
  Object.freeze({ id:"cohort-05", audienceCohort:"global-event-first", sports:["tennis","formula 1","motorsport","football","athletics","swimming"], keywords:["slam","final","grand prix","world cup","olympic","championship"], selectivity:0.48 }),
  Object.freeze({ id:"cohort-06", audienceCohort:"athlete-first", sports:["tennis","motorsport","formula 1","surfing"], keywords:["de minaur","piastri","ricciardo","picklum","jack robinson","open","prix","pro","masters","championship"], selectivity:0.42, requiresSport:true }),
]);

function mode(value = process.env.NSC_DEMO_PANEL_MODE){
  const candidate = String(value || "off").trim().toLowerCase();
  return MODES.includes(candidate) ? candidate : "off";
}
function enabled(value, { internal = false } = {}){
  const current = mode(value);
  return current === "public" || (current === "internal" && internal === true);
}
function hash(value){
  let result = 2166136261;
  for (const character of String(value || "")){ result ^= character.codePointAt(0); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
function eventText(event){
  return [event?.sport, event?.competition, event?.name, event?.displayTitleCompact, event?.stage, ...(Array.isArray(event?.participants) ? event.participants : []).map(item => typeof item === "string" ? item : item?.name)]
    .filter(Boolean).join(" ").toLowerCase();
}
function eventId(event){ return String(event?.canonicalEventId || event?.eventId || event?.id || "event"); }
function stakesValue(event){
  const numeric=Number(event?.stakesScore);
  if(Number.isFinite(numeric))return Math.max(1,Math.min(5,numeric));
  return({low:1,medium:3,high:4,"must-watch":5,"must watch":5}[String(event?.stakes||"").toLowerCase()]||3);
}
function affinity(persona, event){
  const text = eventText(event);
  const sportHit = persona.sports.some(value => text.includes(value));
  const keywordHits = persona.keywords.filter(value => text.includes(value)).length;
  const stakes = stakesValue(event);
  return Math.min(1, (sportHit ? .5 : .12) + keywordHits * .16 + stakes * .06);
}
function participates(persona, event){
  const text=eventText(event),sportHit=persona.sports.some(value=>text.includes(value)),keywordHit=persona.keywords.some(value=>text.includes(value));
  if(persona.requiresSport&&!sportHit)return false;
  if(persona.requiresKeyword&&!keywordHit)return false;
  const stable = (hash(`${SCHEMA_VERSION}|${eventId(event)}|${persona.id}|participates`) % 1000) / 1000;
  return affinity(persona, event) >= persona.selectivity || stable > persona.selectivity + .18;
}
function outlierFor(persona, event, phase, bucketStart = ""){
  return hash(`${SCHEMA_VERSION}|${eventId(event)}|${persona.id}|${phase}|${bucketStart}|mild-outlier`) % 100 < 8;
}
function applyOutlier(rating, persona, event, phase, bucketStart = ""){
  if (!outlierFor(persona, event, phase, bucketStart)) return rating;
  const direction = rating >= 4 ? -1 : rating <= 2 ? 1 : (hash(`${SCHEMA_VERSION}|${eventId(event)}|${persona.id}|${phase}|${bucketStart}|outlier-direction`) % 2 ? 1 : -1);
  return Math.max(1, Math.min(5, rating + direction));
}
function ratingFor(persona, event, phase, bucketStart = ""){
  const stakes = stakesValue(event);
  const noise = (hash(`${SCHEMA_VERSION}|${eventId(event)}|${persona.id}|${phase}|${bucketStart}`) % 5) - 2;
  const phaseShift = phase === "impact" ? ((hash(`${eventId(event)}|impact`) % 3) - 1) : phase === "pulse" ? 1 : 0;
  const rating = Math.max(1, Math.min(5, Math.round(stakes * .62 + affinity(persona, event) * 1.7 + noise * .28 + phaseShift * .25)));
  return applyOutlier(rating, persona, event, phase, bucketStart);
}
function tagsFor(persona, event, phase, rating){
  if (rating < 4 || phase === "pulse") return [];
  const allowed = phase === "impact" ? nsc.IMPACT_TAGS : nsc.HEAT_TAGS;
  const offset = hash(`${eventId(event)}|${persona.id}|${phase}|tags`) % allowed.length;
  return [allowed[offset], allowed[(offset + 2) % allowed.length]].filter((tag, index, all) => all.indexOf(tag) === index);
}
function activePersonas(event){
  const selected=PERSONAS.filter(persona=>participates(persona,event));
  if(selected.length)return selected;
  return [PERSONAS.slice().sort((first,second)=>affinity(second,event)-affinity(first,event)||first.id.localeCompare(second.id))[0]];
}
function demoRows(event, phase, nowValue = new Date(), options = {}){
  if (!enabled(options.mode, { internal:options.internal })) return [];
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  const active = activePersonas(event);
  if (phase !== "pulse") return active.map(persona => {
    const rating = ratingFor(persona, event, phase);
    const start=Date.parse(event?.startTimeUtc||""),end=Date.parse(event?.endTimeUtc||"");
    const updated=phase==="heat"?start:(Number.isFinite(end)?end:Number.isFinite(start)?start+Number(event?.liveWindow||3)*3600000:0);
    return { userId:`modelled:${persona.id}`, phase, rating, tags:tagsFor(persona,event,phase,rating), bucketStart:"1970-01-01T00:00:00.000Z", updatedAt:new Date(Number.isFinite(updated)?updated:0).toISOString(), persona:"general", modelled:true, demo:true, audienceCohort:persona.audienceCohort };
  });
  const start = Date.parse(event?.startTimeUtc || "") || now.getTime() - 25 * 60_000;
  if(now.getTime()<start)return[];
  const publishedEnd=Date.parse(event?.endTimeUtc||"");
  const end=Number.isFinite(publishedEnd)?publishedEnd:start+Number(event?.liveWindow||3)*3600000;
  const anchor=Math.min(now.getTime(),end);
  const first = Math.max(start, anchor - 25 * 60_000);
  const rows = [];
  for (let bucket = Math.ceil(first / nsc.PULSE_BUCKET_MS) * nsc.PULSE_BUCKET_MS; bucket <= anchor; bucket += nsc.PULSE_BUCKET_MS){
    const bucketStart = new Date(bucket).toISOString();
    active.forEach(persona => rows.push({ userId:`modelled:${persona.id}`, phase:"pulse", rating:ratingFor(persona,event,"pulse",bucketStart), tags:[], bucketStart, updatedAt:bucketStart, persona:"general", modelled:true, demo:true, audienceCohort:persona.audienceCohort }));
  }
  return rows;
}

module.exports = Object.freeze({ SCHEMA_VERSION, MODES, PERSONAS, activePersonas, affinity, applyOutlier, demoRows, enabled, hash, mode, outlierFor, participates, ratingFor, stakesValue });
