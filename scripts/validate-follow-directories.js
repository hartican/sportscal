#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/manifest.v1.json"), "utf8"));
assert.equal(manifest.schemaVersion, "follow-directory-manifest.v1");
assert.equal(manifest.sports.length, 28, "all exposed sports plus NBL and the published child codes require lazy chunks");
for (const supportKey of ["hockey", "multi-sport"]){
  const supportChunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${supportKey}.v1.json`), "utf8"));
  assert(supportChunk.records.some(record => record.teamKind === "national"), `${supportKey}: hidden national-team support data must remain current without becoming a top-level Follow category`);
}
manifest.sports.forEach(sport => {
  if(sport.key==='supercars'){
    assert.equal(sport.status,'schedule-only','Bathurst-only scope must not imply a sourced driver directory');
    assert.equal(sport.recordCount,0,'do not invent Supercars participants');
    assert(fs.existsSync(path.join(ROOT,sport.jsonUrl)),'schedule-only categories retain a lazy empty chunk');return;
  }
  assert.equal(sport.status, "available", `${sport.key}: every active sport must expose a populated lazy directory`);
  assert.ok(sport.recordCount > 0, `${sport.key}: populated directory cannot be empty`);
  const chunkPath = path.join(ROOT, sport.jsonUrl);
  assert.ok(fs.existsSync(chunkPath), `${sport.key}: JSON chunk missing`);
  assert.ok(fs.existsSync(chunkPath.replace(/\.json$/, ".js")), `${sport.key}: direct-file fallback missing`);
  const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8"));
  assert.equal(chunk.sportKey, sport.key);
  assert.equal(chunk.records.length, sport.recordCount);
  chunk.records.forEach(record => {
    assert.ok(record.id && record.displayName, `${sport.key}: identity fields required`);
    assert.ok(["male", "female", "mixed", "unknown"].includes(record.genderCategory));
    if (sport.key !== "tennis" || !record.watchPoolMember){
      assert.equal(record.current, true, `${record.id}: historical or inactive records are forbidden outside the explicit Tennis watch pool`);
    }
  });
  const ordered = chunk.records.map(record => record.ranking ?? record.ladderPosition ?? Number.MAX_SAFE_INTEGER);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b), `${sport.key}: null ranks must sort after ranked records`);
});
for (const sportKey of ["extreme", "surf", "skiing", "golf", "boxing"]){
  const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${sportKey}.v1.json`), "utf8"));
  assert.ok(chunk.records.every(record => record.countryCode && record.countryBasis), `${sportKey}: supplemented records require country flags and an evidence basis`);
  assert.ok(chunk.records.every(record => record.sourceRefs.some(ref => /^https:\/\//.test(ref))), `${sportKey}: supplemented records require an official source URL`);
  assert.ok(chunk.records.some(record => record.genderCategory === "male"), `${sportKey}: men's choices missing`);
  if (sportKey !== "american-football") assert.ok(chunk.records.some(record => record.genderCategory === "female"), `${sportKey}: women's choices missing`);
}
for (const sportKey of ["american-football", "ice-hockey"]){
  const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${sportKey}.v1.json`), "utf8"));
  const teams = chunk.records.filter(record => record.entityType === "team");
  assert.ok(teams.length >= 32, `${sportKey}: complete club directory missing`);
  assert.ok(teams.every(record => record.identityId && record.logoUrl), `${sportKey}: club teams require crests rather than flags`);
  assert.ok(teams.every(record => record.sourceRefs.some(ref => /^https:\/\//.test(ref))), `${sportKey}: teams require a current source URL`);
}
const runtime = require(path.join(ROOT, "config/football-directory.js"));
const football = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/football.v1.json"), "utf8"));
const lucas = football.records.find(record => record.displayName === "Lucas Herrington");
assert.ok(lucas, "Lucas Herrington must remain in the current Football directory");
assert.ok(Number.isFinite(runtime.searchMatchScore(lucas, "Harrington")), "one-character Football search variants must match");
const tennis = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/tennis.v1.json"), "utf8"));
assert.equal(tennis.records.filter(record => record.watchPoolMember).length, 51, "Tennis must expose the expanded watch-pool players");
assert.equal(tennis.collections.length, 8, "Tennis must expose the original groups plus ATP/WTA watch lists");
const tennisPlayers=tennis.records.filter(record=>record.entityType!=="team");
assert.equal(new Set(tennisPlayers.map(record => record.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())).size, tennisPlayers.length, "Tennis player rows must be deduplicated by name");
for (const collectionId of ["collection:tennis:mens-top-10", "collection:tennis:womens-top-10"]){
  assert.equal(tennis.collections.find(collection => collection.id === collectionId)?.memberIds.length, 10, `${collectionId}: current top ten must contain ten players`);
}
const tennisRecordsById = new Map(tennis.records.map(record => [record.id, record]));
const mensWatch = tennis.collections.find(collection => collection.id === "collection:tennis:atp-mens-watch");
const womensWatch = tennis.collections.find(collection => collection.id === "collection:tennis:wta-womens-watch");
assert(mensWatch && womensWatch, "Tennis must publish separate ATP/mens and WTA/womens watch lists");
assert(mensWatch.memberIds.every(id => tennisRecordsById.has(id)), "every ATP/mens watch-list member must resolve to a rendered player");
assert(womensWatch.memberIds.every(id => tennisRecordsById.has(id)), "every WTA/womens watch-list member must resolve to a rendered player");
assert(tennis.records.filter(record => record.genderCategory === "male" && Number.isFinite(record.ranking)).every(record => mensWatch.memberIds.includes(record.id)), "the ATP/mens watch list must retain every ranked man already in the directory");
assert(tennis.records.filter(record => record.genderCategory === "female" && Number.isFinite(record.ranking)).every(record => womensWatch.memberIds.includes(record.id)), "the WTA/womens watch list must retain every ranked woman already in the directory");
for (const name of ["Stefanos Tsitsipas", "Rafael Nadal", "Roger Federer"]){
  const record = tennis.records.find(item => item.displayName === name);
  assert(record && mensWatch.memberIds.includes(record.id), `${name} must remain in the ATP/mens watch list without requiring a rank`);
}
const serena = tennis.records.find(record => record.displayName === "Serena Williams");
assert(serena && womensWatch.memberIds.includes(serena.id), "Serena Williams must remain in the WTA/womens watch list without requiring a rank");
assert(["Rafael Nadal", "Roger Federer", "Serena Williams"].every(name => tennis.records.find(record => record.displayName === name)?.ranking === null), "watch-list membership must not require an ATP or WTA ranking");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert(html.includes('buildDirectorySelect("List", filters.collectionId') && html.includes("selectedCollectionMemberIds.has(record.id)"), "the Tennis directory must expose collection membership as a working List filter");
for (const sportKey of ["afl", "aflw", "f1"]){
  const chunk = JSON.parse(fs.readFileSync(path.join(ROOT, `data/follow-directory/${sportKey}.v1.json`), "utf8"));
  const athletes = chunk.records.filter(record => record.entityType === "athlete");
  assert.ok(athletes.length >= (sportKey === "f1" ? 22 : 500), `${sportKey}: current athlete directory is incomplete`);
  assert.ok(athletes.every(record => record.headshotUrl || record.standingsOnly && record.sourceRefs.length), `${sportKey}: every athlete needs a portrait URL`);
  if (sportKey === "f1") assert.ok(athletes.every(record => record.standingsOnly || Number(record.competitionNumber) > 0 && record.competitionNumberKind === "racing"), "F1 drivers need current racing numbers");
  else assert.ok(athletes.every(record => record.competitionNumberKind === "guernsey"), `${sportKey}: guernsey metadata is required even while a source number is TBC`);
}
const wrc = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/wrc.v1.json"), "utf8"));
const wrcContext=require('../data/canonical/wrc-context-2026.json');
assert.deepEqual(new Set(wrc.records.map(r=>r.id)),new Set(wrcContext.participants.map(p=>p.id)),"WRC directory must expose every sourced senior participant exactly once");
assert.equal(wrc.records.length,wrcContext.participants.length);
for(const role of ['driver','co-driver','manufacturer'])assert.equal(wrc.records.filter(r=>r.position===role).length,wrcContext.participants.filter(p=>p.metadata.championshipRole===role).length,role+' directory incomplete');
assert.ok(wrc.records.every(record => record.sourceRefs.some(ref => /^https:\/\/(?:www\.)?(?:wrc\.com|fia\.com|api\.fia\.com)/.test(ref))), "WRC follows require official source provenance");
const motorsport = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/motorsport.v1.json"), "utf8"));
assert.ok(motorsport.records.some(record => String(record.id).startsWith("competitor:f1:")), "general Motorsport must retain F1 discovery");
assert.ok(motorsport.records.some(record => String(record.id).startsWith("competitor:wrc:")), "general Motorsport must include WRC discovery");
const nrlw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/nrlw.v1.json"), "utf8"));
assert.equal(nrlw.records.filter(record => record.entityType === "team").length, 12, "NRLW must expose all twelve current clubs");
const nbl = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/nbl.v1.json"), "utf8"));
assert.equal(nbl.records.filter(record => record.entityType === "team").length, 10, "NBL must expose all ten current clubs");
assert.ok(nbl.records.filter(record => record.entityType === "athlete").every(record => record.currentTeamId), "NBL player follows require a current official roster mapping");
assert.ok(nbl.records.every(record => record.sourceRefs.some(ref => /^https:\/\/(?:league\.)?nbl\.com\.au\//.test(ref))), "NBL follows require official source provenance");
assert.ok(nrlw.records.every(record => record.genderCategory === "female"), "NRLW directory records must retain the women's competition scope");
const fibaWomen = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/fiba-women.v1.json"), "utf8"));
assert.equal(fibaWomen.records.filter(record => record.entityType === "team").length, 16, "FIBA Women must expose all sixteen World Cup teams");
assert.ok(fibaWomen.records.some(record => record.id === "team:basketball:opals"), "the Opals must be followable inside FIBA Women");
const motogp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/motogp.v1.json"), "utf8"));
assert.equal(motogp.records.filter(record => record.entityType === "athlete").length, 22, "MotoGP must expose the current twenty-two rider field");
assert.ok(motogp.records.every(record => Number(record.competitionNumber) > 0 && record.competitionNumberKind === "racing"), "MotoGP riders need current racing numbers");
const sailgp = JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory/sailgp.v1.json"), "utf8"));
assert.equal(sailgp.records.filter(record => record.entityType === "team").length, 13, "SailGP must expose all thirteen 2026 teams");
console.log(`Follow directory manifest valid: ${manifest.sports.length} chunks, tolerant search and current-only records.`);
