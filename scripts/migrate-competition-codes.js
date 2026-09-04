#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EVENTS_PATH = path.join(ROOT, "data/major-events.v1.json");
const UCL_PATH = path.join(ROOT, "data/canonical/uefa-champions-league-2026-27.json");
const FINALS_PATH = path.join(ROOT, "data/canonical/afl-nrl-finals-2026.json");
const FOOTBALL_DIRECTORY_PATH = path.join(ROOT, "data/canonical/football-directory.v1.json");
const classification = require("../config/competition-classification.js");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizedName(value){
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value){
  return normalizedName(value).replace(/\s+/g, "-") || "unknown";
}

function writeIfChanged(filePath, value, checkOnly){
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current === next) return false;
  if (checkOnly) throw new Error(`${path.relative(ROOT, filePath)} is stale; run node scripts/migrate-competition-codes.js`);
  fs.writeFileSync(filePath, next);
  return true;
}

function buildChampionsLeagueDocument(records, priorDocument = null){
  if (!records.length){
    if (!priorDocument) throw new Error("Champions League source phases are missing and no canonical Code document exists.");
    return {
      ...priorDocument,
      phases:(priorDocument.phases || []).map(phase => ({
        ...phase,
        fixtures:(phase.fixtures || []).map(fixture => ({
          ...fixture,
          competitionScope:fixture.competitionScope || "international",
          isInternational:true,
          sourceName:fixture.sourceName || phase.sources?.[0]?.name || null,
          sourceUrl:fixture.sourceUrl || phase.sources?.[0]?.url || null,
          sourceCheckedAt:fixture.sourceCheckedAt || phase.sources?.[0]?.checkedAt || null,
        })),
      })),
    };
  }
  const footballDirectory = readJson(FOOTBALL_DIRECTORY_PATH);
  const existingTeamIds = new Map((footballDirectory.teams || []).flatMap(team => (
    [team.displayName, team.shortName, ...(team.aliases || [])]
      .map(name => [normalizedName(name), team.id])
      .filter(([name]) => name)
  )));
  const sources = new Map();
  records.forEach(record => (record.sources || []).forEach(source => sources.set(source.url, source)));
  const sourceUrls = [...sources.keys()];
  const participants = new Map();
  const participantFor = raw => {
    const name = String(raw?.displayName || raw?.name || raw?.label || "").trim();
    if (!name) return null;
    const id = raw?.id || existingTeamIds.get(normalizedName(name)) || `team:football:club:${slug(name)}`;
    if (!participants.has(id)) participants.set(id, {
      id,
      displayName:name,
      shortName:name,
      aliases:[name],
      type:"team",
      entityType:"team",
      active:true,
      current:true,
      sportDomainId:"sport:football",
      leagueId:"competition:uefa-champions-league",
      sourceRefs:sourceUrls,
    });
    return participants.get(id);
  };
  const phases = records.map(record => ({
    id:`phase:uefa-champions-league:2026-27:${record.phaseId}`,
    legacyEventId:record.id,
    phaseId:record.phaseId,
    phaseLabel:record.phaseLabel,
    phaseIdentity:record.phaseIdentity,
    startDate:record.startDate,
    endDate:record.endDate,
    dateStatus:record.dateStatus,
    timezone:record.timezone,
    summary:record.summary,
    details:record.details,
    sources:record.sources,
    editorialNarrative:record.editorialNarrative,
    fixtures:(record.subEvents || []).map(subEvent => {
      const rawParticipants = Array.isArray(subEvent.participants) ? subEvent.participants : [];
      const teams = rawParticipants.map(participantFor).filter(Boolean);
      return {
        ...subEvent,
        codeId:"competition:uefa-champions-league",
        sportDomainId:"sport:football",
        competitionId:"competition:uefa-champions-league",
        phaseId:record.phaseId,
        phaseLabel:record.phaseLabel,
        surfaceClassification:"code",
        competitionScope:subEvent.competitionScope || "international",
        isInternational:true,
        sourceName:subEvent.sourceName || record.sources?.[0]?.name || null,
        sourceUrl:subEvent.sourceUrl || record.sources?.[0]?.url || null,
        sourceCheckedAt:subEvent.sourceCheckedAt || record.sources?.[0]?.checkedAt || null,
        participantIds:teams.map(team => team.id),
        participantSlots:teams.map((team, index) => ({ slot:index + 1, participantId:team.id, label:team.displayName })),
        participants:teams.map(team => ({ id:team.id, participantId:team.id, name:team.displayName })),
        ...(!subEvent.startTimeUtc ? {
          schedulingWindow:{ startsOn:record.startDate, endsOn:record.endDate, timeZone:record.timezone || "Europe/London" },
        } : {}),
      };
    }),
  }));
  const checkedTimes = [...sources.values()].map(source => Date.parse(source.checkedAt)).filter(Number.isFinite);
  return {
    schemaVersion:"competition-code.v1",
    id:"competition:uefa-champions-league",
    seasonId:"competition:uefa-champions-league:2026-27",
    seasonLabel:"2026/27",
    name:"UEFA Champions League",
    surfaceClassification:"code",
    classificationReason:"recurring-single-code-competition",
    parentSportId:"sport:football",
    parentDisciplineId:"discipline:football:club",
    generatedAt:checkedTimes.length ? new Date(Math.max(...checkedTimes)).toISOString() : null,
    sources:[...sources.values()],
    participants:[...participants.values()].sort((left, right) => left.displayName.localeCompare(right.displayName, "en-AU")),
    phases,
    standings:[],
    standingsStatus:"not-yet-published",
    standingsSource:{ name:"UEFA Champions League table", url:"https://www.uefa.com/uefachampionsleague/standings/" },
  };
}

function buildFinalsDocument(records, priorDocument = null){
  if (!records.length){
    if (!priorDocument) throw new Error("AFL/NRL finals source phases are missing and no canonical Code-phase document exists.");
    return {
      ...priorDocument,
      phases:(priorDocument.phases || []).map(phase => ({
        ...phase,
        competitionId:phase.codeId === "sport:afl" ? "competition:afl-premiership-2026" : "competition:nrl:premiership:2026",
      })),
    };
  }
  const phases = records.map(record => {
    const definition = classification.codeDefinition(record);
    return {
      id:`phase:${definition.canonicalCodeId.replace(/^sport:/, "")}:2026:finals`,
      codeId:definition.canonicalCodeId,
      legacyEventId:record.id,
      name:record.name,
      phaseId:record.phaseId,
      phaseLabel:record.phaseLabel,
      competitionId:record.competitionId,
      startDate:record.startDate,
      endDate:record.endDate,
      timezone:record.timezone,
      summary:record.summary,
      details:record.details,
      ticketing:record.ticketing || null,
      sources:record.sources,
      editorialNarrative:record.editorialNarrative,
      bracketProgression:record.bracketProgression || null,
      fixtures:(record.subEvents || []).map(fixture => ({
        ...fixture,
        codeId:definition.canonicalCodeId,
        surfaceClassification:"code",
      })),
    };
  });
  const sources = new Map(phases.flatMap(phase => phase.sources || []).map(source => [source.url, source]));
  const checkedTimes = [...sources.values()].map(source => Date.parse(source.checkedAt)).filter(Number.isFinite);
  return {
    schemaVersion:"code-phases.v1",
    seasonLabel:"2026",
    surfaceClassification:"code",
    classificationReason:"phase-of-existing-code",
    generatedAt:checkedTimes.length ? new Date(Math.max(...checkedTimes)).toISOString() : null,
    sources:[...sources.values()],
    phases,
  };
}

function baselineEventsDocument(){
  return JSON.parse(execFileSync("git", ["show", "HEAD:data/major-events.v1.json"], { cwd:ROOT, encoding:"utf8", maxBuffer:16 * 1024 * 1024 }));
}

function migrate({ checkOnly = false } = {}){
  const eventsDocument = readJson(EVENTS_PATH);
  const priorUcl = fs.existsSync(UCL_PATH) ? readJson(UCL_PATH) : null;
  const priorFinals = fs.existsSync(FINALS_PATH) ? readJson(FINALS_PATH) : null;
  const uclRecords = eventsDocument.events.filter(record => classification.codeDefinition(record)?.canonicalCodeId === "competition:uefa-champions-league");
  let finalsRecords = eventsDocument.events.filter(record => ["sport:afl", "sport:nrl"].includes(classification.codeDefinition(record)?.canonicalCodeId));
  if (!finalsRecords.length && !priorFinals){
    finalsRecords = baselineEventsDocument().events.filter(record => ["sport:afl", "sport:nrl"].includes(classification.codeDefinition(record)?.canonicalCodeId));
  }
  const uclDocument = buildChampionsLeagueDocument(uclRecords, priorUcl);
  const finalsDocument = buildFinalsDocument(finalsRecords, priorFinals);
  const retainedEvents = eventsDocument.events.filter(record => classification.belongsInEvents(record));
  const nextEvents = {
    ...eventsDocument,
    classificationVersion:classification.schemaVersion,
    events:retainedEvents,
  };
  const uclChanged = writeIfChanged(UCL_PATH, uclDocument, checkOnly);
  const finalsChanged = writeIfChanged(FINALS_PATH, finalsDocument, checkOnly);
  const eventsChanged = writeIfChanged(EVENTS_PATH, nextEvents, checkOnly);
  return { uclChanged, finalsChanged, eventsChanged, removedCount:eventsDocument.events.length - retainedEvents.length };
}

function main(){
  const checkOnly = process.argv.includes("--check");
  const result = migrate({ checkOnly });
  console.log(checkOnly
    ? "Competition classification is current: Champions League, AFL Finals and NRL Finals are outside Events."
    : `Competition classification migrated (${result.removedCount} Event records removed).`);
}

if (require.main === module) main();

module.exports = { buildChampionsLeagueDocument, buildFinalsDocument, migrate, normalizedName, slug };
