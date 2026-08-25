#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const FEED_PATH = path.resolve(process.argv[2] || "data/events.json");
const OVERRIDES_PATH = path.resolve(process.argv[3] || "feeds/editorial-preview-overrides.json");
const DIGEST_PATH = path.resolve("data/f1-editorial-digest.json");
const CONTEXT_PATH = path.resolve("data/canonical/f1-context-2026.json");
const PROMPT_VERSION = "f1-editorial.v1";
const ALLOWED_DOMAINS = ["formula1.com", "fia.com", "motorsport.com", "bbc.com", "the-race.com"];

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function eventId(event){ return String(event.eventId || event.id || ""); }
function eventTime(event){ return new Date(event.startTimeUtc || `${event.date || ""}T${event.time || "00:00"}:00+10:00`).getTime(); }
function sha(value){ return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function eligibleEvents(feed, reference = new Date()){
  const start = reference.getTime() - 6 * 60 * 60 * 1000;
  const end = reference.getTime() + 45 * 86400000;
  return (feed.events || []).filter(event => {
    const time = eventTime(event);
    return event.key === "f1"
      && Number.isFinite(time)
      && time >= start
      && time <= end
      && /\b(?:qualifying|sprint|race|grand prix)\b/i.test(String(event.name || ""));
  });
}

function officialEvidence(context){
  return (context.sources || []).slice(0, 3).map(source => ({
    title: source.sourceName || source.name || "Formula 1 official source",
    url: source.sourceUrl || source.url,
    sourceType: "official",
  })).filter(source => /^https:\/\//.test(source.url || ""));
}

function factualFallback(event, context, generatedAt){
  const driverTable = (context.ladderSnapshots || []).find(snapshot => snapshot.competitionId === "competition:f1-drivers-2026");
  const leader = (context.participants || []).find(participant => participant.id === driverTable?.entries?.[0]?.participantId)?.displayName || "the championship leader";
  const session = /qualifying/i.test(event.name) ? "Qualifying sets the grid" : /sprint/i.test(event.name) ? "The sprint brings points and grid pressure" : "The race is the weekend's points-paying session";
  const place = event.venue && !/tbc/i.test(event.venue) ? ` at ${event.venue}` : "";
  const evidenceReferences = officialEvidence(context);
  return {
    eventId:eventId(event),
    selectedSentence:`${session}${place}, with ${leader} carrying the current title lead into ${event.name}.`,
    fullSpiel:`${event.name} is scheduled for ${event.date || "date TBC"} at ${event.time || "time TBC"}. ${session}${place}; ${leader} leads the official 2026 driver standings at this refresh.`,
    angle:"The next published session viewed through current championship position and its direct sporting consequence.",
    contextSignals:["fixture-specific", "current-championship-standings", /qualifying/i.test(event.name) ? "grid-setting" : "points-paying-session"],
    evidenceReferences,
    sourceName:evidenceReferences[0]?.title || "Formula 1 official championship context",
    sourceUrl:evidenceReferences[0]?.url || "https://www.formula1.com/en/results/2026/drivers",
    sourceType:"official",
    sourceCheckedAt:generatedAt,
    generationMode:"factual-fallback",
  };
}

function responseText(payload){
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []){
    for (const content of item?.content || []){
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function validEvidence(item){
  try{
    const host = new URL(item?.url).hostname.replace(/^www\./, "");
    return ALLOWED_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
  }catch(_error){ return false; }
}

async function generateWithResponses(events, context, generatedAt){
  if (!process.env.OPENAI_API_KEY || !events.length) return null;
  const schema = {
    type:"object",
    additionalProperties:false,
    required:["events"],
    properties:{
      events:{
        type:"array",
        items:{
          type:"object",
          additionalProperties:false,
          required:["eventId","selectedSentence","fullSpiel","angle","contextSignals","evidenceReferences"],
          properties:{
            eventId:{ type:"string" },
            selectedSentence:{ type:"string" },
            fullSpiel:{ type:"string" },
            angle:{ type:"string" },
            contextSignals:{ type:"array", items:{ type:"string" }, minItems:2, maxItems:6 },
            evidenceReferences:{
              type:"array",
              minItems:2,
              maxItems:5,
              items:{
                type:"object",
                additionalProperties:false,
                required:["title","url","sourceType"],
                properties:{ title:{type:"string"}, url:{type:"string"}, sourceType:{enum:["official","trusted-reporting"]} },
              },
            },
          },
        },
      },
    },
  };
  const dossier = events.map(event => ({
    eventId:eventId(event), name:event.name, startTimeUtc:event.startTimeUtc, date:event.date, time:event.time,
    venue:event.venue, participants:event.participants, currentCopy:event.selectedSentence,
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method:"POST",
    headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body:JSON.stringify({
      model:"gpt-5.6-luna",
      store:false,
      tools:[{ type:"web_search", filters:{ allowed_domains:ALLOWED_DOMAINS } }],
      input:[
        { role:"system", content:[{ type:"input_text", text:"Write concise, contemporary Formula 1 card commentary. Verify current sporting claims. Prefer Formula 1/FIA truth, then official teams or drivers, then allowlisted reporting. Never invent quotes, results, injuries or records. Return every supplied event exactly once." }] },
        { role:"user", content:[{ type:"input_text", text:JSON.stringify({ generatedAt, currentOfficialContext:officialEvidence(context), events:dossier }) }] },
      ],
      text:{ format:{ type:"json_schema", name:"f1_editorial_digest", strict:true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`Responses API returned ${response.status}`);
  const parsed = JSON.parse(responseText(await response.json()));
  if (!Array.isArray(parsed.events) || parsed.events.length !== events.length) throw new Error("Responses output did not cover every F1 event");
  const expectedIds = new Set(events.map(eventId));
  parsed.events.forEach(item => {
    if (!expectedIds.has(item.eventId)) throw new Error(`Unexpected F1 editorial id ${item.eventId}`);
    if (item.evidenceReferences.length < 2 || !item.evidenceReferences.every(validEvidence)) throw new Error(`Invalid F1 evidence for ${item.eventId}`);
  });
  return parsed.events.map(item => ({
    ...item,
    sourceName:item.evidenceReferences[0].title,
    sourceUrl:item.evidenceReferences[0].url,
    sourceType:item.evidenceReferences[0].sourceType,
    sourceCheckedAt:generatedAt,
    generationMode:"gpt-5.6-luna-responses",
  }));
}

async function main(){
  const generatedAt = new Date().toISOString();
  const feed = readJson(FEED_PATH);
  const context = readJson(CONTEXT_PATH);
  const events = eligibleEvents(feed);
  let entries = null;
  try{ entries = await generateWithResponses(events, context, generatedAt); }
  catch(error){ console.warn(`F1 editorial generation failed; publishing factual fallbacks: ${error.message}`); }
  if (!entries) entries = events.map(event => factualFallback(event, context, generatedAt));
  const digest = {
    schemaVersion:"nothingsport.f1-editorial-digest.v1",
    generatedAt,
    promptVersion:PROMPT_VERSION,
    fingerprint:sha({ promptVersion:PROMPT_VERSION, entries }),
    entries,
  };
  writeJson(DIGEST_PATH, digest);
  const overrides = readJson(OVERRIDES_PATH);
  entries.forEach(entry => {
    overrides.events[entry.eventId] = {
      selectedSentence:entry.selectedSentence,
      fullSpiel:entry.fullSpiel,
      sourceName:entry.sourceName,
      sourceUrl:entry.sourceUrl,
      sourceCheckedAt:entry.sourceCheckedAt,
      sourceType:entry.sourceType,
      editorialPreview:{
        status:"journalistic",
        angle:entry.angle,
        contextSignals:entry.contextSignals,
        evidenceReferences:entry.evidenceReferences,
        digestFingerprint:digest.fingerprint,
        promptVersion:PROMPT_VERSION,
        sourceName:entry.sourceName,
        sourceUrl:entry.sourceUrl,
        sourceCheckedAt:entry.sourceCheckedAt,
        needsPreviewRefresh:false,
      },
    };
  });
  overrides.sourceCheckedAt = generatedAt;
  writeJson(OVERRIDES_PATH, overrides);
  console.log(`Refreshed ${entries.length} contemporary F1 previews (${entries[0]?.generationMode || "no upcoming sessions"}).`);
}

main().catch(error => { console.error(error.stack || error.message); process.exit(1); });
