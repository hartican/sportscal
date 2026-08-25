#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "data/follow-directory");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.v1.json");

function readJson(relativePath){
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeIfChanged(filePath, content, checkOnly){
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current === content) return false;
  if (checkOnly) throw new Error(`${path.relative(ROOT, filePath)} is stale; run node scripts/build-follow-directories.js`);
  fs.mkdirSync(path.dirname(filePath), { recursive:true });
  fs.writeFileSync(filePath, content);
  return true;
}

function sportKeyForParticipant(participant){
  const domain = String(participant?.sportDomainId || "");
  const discipline = String(participant?.metadata?.discipline || "").toLowerCase();
  if (domain.includes(":cwg:competitors")){
    if (discipline.includes("swimming")) return "swimming";
    if (discipline.includes("athletics")) return "athletics";
    if (discipline.includes("gymnastics")) return "gymnastics";
    if (discipline.includes("cycling")) return "cycling";
    if (discipline.includes("netball")) return "netball";
  }
  const mappings = [
    ["sport:american-football", "american-football"], ["sport:rugby-union", "rugby"],
    ["sport:multi-sport", "multi-sport"], ["sport:basketball", "nba"],
    ["sport:motorsport", "motorsport"], ["sport:gymnastics", "gymnastics"],
    ["sport:athletics", "athletics"], ["sport:swimming", "swimming"],
    ["sport:football", "football"], ["sport:cricket", "cricket"],
    ["sport:cycling", "cycling"], ["sport:extreme", "extreme"],
    ["sport:netball", "netball"], ["sport:hockey", "hockey"],
    ["sport:boxing", "boxing"], ["sport:tennis", "tennis"],
    ["sport:skiing", "skiing"], ["sport:rugby", "rugby"],
    ["sport:golf", "golf"], ["sport:surf", "surf"],
    ["sport:nrl", "nrl"], ["sport:afl", "afl"],
  ];
  return mappings.find(([prefix]) => domain === prefix || domain.startsWith(`${prefix}:`))?.[1] || null;
}

function normalizeGender(value){
  const text = String(value || "unknown").toLowerCase();
  if (["men", "mens", "male"].includes(text)) return "male";
  if (["women", "womens", "female"].includes(text)) return "female";
  if (["mixed", "open"].includes(text)) return "mixed";
  return "unknown";
}

function normalizeRecord(record, additions = {}){
  const metadata = record?.metadata || {};
  return {
    id:String(record.id),
    displayName:String(record.displayName || record.canonicalName || record.shortName || record.id),
    shortName:record.shortName || null,
    aliases:Array.from(new Set([...(record.aliases || []), ...(metadata.titleAliases || [])].filter(Boolean))),
    entityType:record.type === "competitor" || String(record.id).startsWith("competitor:") ? "athlete" : "team",
    current:record.active !== false && metadata.active !== false,
    countryCode:String(record.countryCode || record.birthCountryCode || additions.countryCode || "").toUpperCase() || null,
    countryBasis:record.birthCountryBasis || additions.countryBasis || (record.countryCode ? "official-record" : null),
    genderCategory:normalizeGender(record.genderCategory || record.gender || metadata.gender || additions.genderCategory),
    ranking:Number.isFinite(Number(additions.ranking ?? record.rank ?? record.ranking)) ? Number(additions.ranking ?? record.rank ?? record.ranking) : null,
    ladderPosition:Number.isFinite(Number(additions.ladderPosition ?? record.ladderPosition)) ? Number(additions.ladderPosition ?? record.ladderPosition) : null,
    marketValue:Number.isFinite(Number(record.marketValue ?? record.marketValueEur)) ? Number(record.marketValue ?? record.marketValueEur) : null,
    currentTeamId:record.currentTeamId || null,
    leagueId:record.leagueId || null,
    position:record.position || metadata.discipline || null,
    identityId:String(record.id),
    sourceRefs:Array.from(new Set([...(record.sourceRefs || []), ...(additions.sourceRefs || [])].filter(Boolean))),
  };
}

function main(){
  const checkOnly = process.argv.includes("--check");
  global.window = global;
  const taxonomy = require(path.join(ROOT, "config/selector-taxonomy.js"));
  const catalogue = require(path.join(ROOT, "config/team-follow-catalogue.js"));
  const sports = taxonomy.exposedSportNodes.filter(entity => Number(entity.level) === 2)
    .map(entity => ({ key:entity.id.replace(/^sport:/, ""), label:entity.label }));
  const chunks = new Map(sports.map(sport => [sport.key, new Map()]));
  const contexts = [
    "data/canonical/afl-nrl-2026.json", "data/canonical/f1-context-2026.json",
    "data/canonical/tennis-context-2026.json", "data/canonical/cycling-context-2026.json",
    "data/canonical/nba-context-2026.json", "data/canonical/cwg-context-2026.json",
  ].map(readJson);
  const sourceGeneratedAt = contexts.map(context => context.generatedAt).filter(Boolean);
  const rankByParticipant = new Map();
  contexts.forEach(context => (context.ladderSnapshots || []).forEach(snapshot => (snapshot.entries || []).forEach(entry => {
    const rank = Number(entry.rank ?? entry.position);
    if (!Number.isFinite(rank)) return;
    const previous = rankByParticipant.get(entry.participantId);
    if (!Number.isFinite(previous) || rank < previous) rankByParticipant.set(entry.participantId, rank);
  })));
  contexts.forEach(context => (context.participants || []).forEach(participant => {
    const key = sportKeyForParticipant(participant);
    if (!key || !chunks.has(key) || participant?.metadata?.active === false) return;
    chunks.get(key).set(participant.id, normalizeRecord(participant, { ranking:rankByParticipant.get(participant.id) }));
  }));
  (catalogue.groups || []).forEach(group => {
    const key = String(group.domainId || "").replace(/^sport:/, "");
    if (!chunks.has(key)) return;
    (group.sections || []).forEach(section => (section.teams || []).forEach(team => {
      chunks.get(key).set(team.id, normalizeRecord({ ...team, type:"team" }, { sourceRefs:[`catalogue:${key}`] }));
    }));
  });
  [
    ["afl", "data/canonical/afl-directory.v1.json"],
    ["nrl", "data/canonical/nrl-directory.v1.json"],
    ["football", "data/canonical/football-directory.v1.json"],
  ].forEach(([key, relativePath]) => {
    const directory = readJson(relativePath);
    if (directory.generatedAt) sourceGeneratedAt.push(directory.generatedAt);
    (directory.teams || []).forEach(team => chunks.get(key).set(team.id, normalizeRecord({ ...team, type:"team" }, { genderCategory:"male", sourceRefs:team.sourceRefs })));
    (directory.players || []).filter(player => player.active !== false).forEach(player => chunks.get(key).set(player.id, normalizeRecord({ ...player, type:"competitor" }, { genderCategory:"male", sourceRefs:player.sourceRefs })));
  });

  const generatedAt = sourceGeneratedAt.slice().sort().at(-1) || "2026-08-25T00:00:00.000Z";
  const manifest = {
    schemaVersion:"follow-directory-manifest.v1",
    generatedAt,
    sports:sports.map(sport => {
      const records = [...chunks.get(sport.key).values()];
      return {
        ...sport,
        status:records.length ? "available" : "unavailable",
        recordCount:records.length,
        jsonUrl:`data/follow-directory/${sport.key}.v1.json`,
        scriptUrl:`data/follow-directory/${sport.key}.v1.js`,
      };
    }),
  };
  let changed = writeIfChanged(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, checkOnly);
  changed = writeIfChanged(path.join(OUTPUT_DIR, "manifest.v1.js"), `globalThis.NOTHINGSPORTS_FOLLOW_DIRECTORY_MANIFEST = ${JSON.stringify(manifest)};\n`, checkOnly) || changed;
  manifest.sports.forEach(sport => {
    const records = [...chunks.get(sport.key).values()].sort((first, second) => (
      (first.ranking ?? first.ladderPosition ?? Number.MAX_SAFE_INTEGER) - (second.ranking ?? second.ladderPosition ?? Number.MAX_SAFE_INTEGER)
      || first.displayName.localeCompare(second.displayName, "en-AU", { sensitivity:"base" })
    ));
    const payload = {
      schemaVersion:"follow-directory-chunk.v1",
      sportKey:sport.key,
      label:sport.label,
      generatedAt,
      status:sport.status,
      sortBasis:records.some(record => Number.isFinite(record.ranking) || Number.isFinite(record.ladderPosition)) ? "ranking-or-ladder-then-alphabetical" : "alphabetical-fallback",
      records,
    };
    changed = writeIfChanged(path.join(OUTPUT_DIR, `${sport.key}.v1.json`), `${JSON.stringify(payload, null, 2)}\n`, checkOnly) || changed;
    changed = writeIfChanged(path.join(OUTPUT_DIR, `${sport.key}.v1.js`), `globalThis.NOTHINGSPORTS_FOLLOW_DIRECTORY_CHUNKS = globalThis.NOTHINGSPORTS_FOLLOW_DIRECTORY_CHUNKS || {};\nglobalThis.NOTHINGSPORTS_FOLLOW_DIRECTORY_CHUNKS[${JSON.stringify(sport.key)}] = ${JSON.stringify(payload)};\n`, checkOnly) || changed;
  });
  console.log(`${checkOnly ? "Checked" : changed ? "Built" : "Unchanged"} ${manifest.sports.length} lazy Follow directory chunks (${manifest.sports.reduce((sum, sport) => sum + sport.recordCount, 0)} records).`);
}

main();
