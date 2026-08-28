#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const registry = require("../config/national-team-identities");
const cardIdentities = require("../config/card-identities");
const catalogue = require("../config/team-follow-catalogue");

const ROOT = path.resolve(__dirname, "..");
const assetsOnly = process.argv.includes("--assets-only");
const serviceWorkerSource = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

assert.equal(registry.schemaVersion, "national-team-identities.v1");
assert.equal(registry.baselineCount, 58);
assert.equal(registry.allTeams.length, 58, "the audited baseline must contain 58 national-team identities");
assert.equal(new Set(registry.allTeams.map(team => team.id)).size, 58, "national-team IDs must be unique");
assert.equal(new Set(registry.allTeams.map(team => team.assetPath)).size, 58, "each national-team identity must have an explicit local asset path");
assert.deepEqual(registry.policy.order, ["team-logo", "federation-crest", "coat-of-arms"]);

registry.allTeams.forEach(team => {
  assert.match(team.id, /^team:/, `${team.displayName} must have a stable team ID`);
  assert(team.sport && team.sportDomainId && team.countryCode && team.gender, `${team.id} must record sport, domain, country and gender`);
  assert(team.aliases.length, `${team.id} must provide aliases`);
  assert(["team-logo", "federation-crest", "coat-of-arms"].includes(team.assetKind), `${team.id} has an invalid artwork type`);
  assert.match(team.assetPath, /^assets\/identities\/national\//, `${team.id} must use the national identity library`);
  assert.doesNotMatch(team.assetPath, /^https?:/i, `${team.id} must not hotlink at runtime`);
  const absoluteAssetPath = path.join(ROOT, team.assetPath);
  assert(fs.existsSync(absoluteAssetPath), `${team.id} is missing ${team.assetPath}`);
  const source = fs.readFileSync(absoluteAssetPath);
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  assert.equal(hash, team.sha256, `${team.id} asset hash does not match its provenance record`);
  assert.match(team.sourceUrl, /^https:\/\//, `${team.id} needs an official source URL`);
  assert.match(team.assetSourceUrl, /^https:\/\//, `${team.id} needs an artwork retrieval URL`);
  assert.equal(team.retrievedAt, "2026-08-28");
  assert(["recorded", "permission-review-required"].includes(team.permissionReviewStatus), `${team.id} needs a permission review status`);
  if (team.assetKind === "coat-of-arms") assert.equal(team.permissionReviewStatus, "permission-review-required", `${team.id} government artwork must remain permission-review-required`);
  const mark = cardIdentities.participantMarks[team.id];
  assert(mark, `${team.id} must be available to every card surface`);
  assert.equal(mark.url, team.assetPath, `${team.id} card identity must use its local registry asset`);
  assert.equal(mark.isNationalTeam, true);
  assert.equal(mark.teamKind, "national");
  assert(!("fallbackCountryCode" in mark), `${team.id} must not expose a flag fallback`);
  assert(!("countryCode" in mark), `${team.id} card mark must not resolve as a country flag`);
  assert(serviceWorkerSource.includes(`"/${team.assetPath}"`), `${team.id} must be cached for offline use`);
});

assert.equal(cardIdentities.schemaVersion, "card-identities.v4");
assert.equal(cardIdentities.policy.nationalTeamFlags, false);
assert.equal(catalogue.allTeams.filter(team => team.teamKind === "national").length, 58, "Follow must consume all 58 registry identities");
assert.doesNotMatch(html, /<script src="config\/national-team-identities\.js"><\/script>/, "the full provenance registry must stay out of the critical app shell");
assert.match(html, /const nationalTeamIdentityReady[\s\S]*loadDeferredScript\("config\/national-team-identities\.js"\)/, "the national registry must load concurrently with the first feed page");
assert.match(html, /Promise\.all\(\[nationalTeamIdentityReady, remoteFeedTask\]\)/, "the first national-team card must wait for the canonical registry");
assert.match(html, /if \(mark\?\.isNationalTeam \|\| mark\?\.teamKind === "national"\)/, "national-team broken images need an explicit no-flag fallback branch");
assert.match(html, /const showNationalityFlag = athlete/, "athlete nationality flags must remain separate");
assert.doesNotMatch(html, /if \(showNationalityFlag \|\| nationalTeam\)/, "Follow must not share the athlete flag branch with national teams");
assert.match(serviceWorkerSource, /nothingsport-shell-v161/, "the application-shell cache must be bumped for the identity library");

const regressionCases = [
  [{ key:"nrl", name:"Australia v New Zealand" }, ["team:nrl:kangaroos", "team:nrl:kiwis"]],
  [{ key:"nrl", name:"Australia v Fiji — Rugby League World Cup" }, ["team:nrl:kangaroos", "team:nrl:fiji-bati"]],
  [{ key:"nrl", name:"Australia v Cook Islands — Rugby League World Cup" }, ["team:nrl:kangaroos", "team:nrl:cook-islands-aitu"]],
  [{ key:"nrl", name:"Australia Women v New Zealand Women" }, ["team:nrl:jillaroos", "team:nrl:kiwi-ferns"]],
  [{ key:"football", name:"Australia v England" }, ["team:football:socceroos", "team:football:england"]],
  [{ key:"football", name:"Matildas v USA" }, ["team:football:matildas", "team:football:usa"]],
  [{ key:"rugby", name:"Australia v New Zealand" }, ["team:rugby:wallabies", "team:rugby:all-blacks"]],
  [{ key:"netball", name:"Australia v New Zealand" }, ["team:netball:diamonds", "team:netball:silver-ferns"]],
  [{ key:"netball", name:"South Africa v Jamaica" }, ["team:netball:south-africa-proteas", "team:netball:jamaica-sunshine-girls"]],
  [{ key:"cricket", name:"South Africa v Australia" }, ["team:cricket:south-africa", "team:cricket:australia"]],
  [{ key:"basketball", name:"Australia Women v USA" }, ["team:basketball:opals"]],
  [{ key:"hockey", name:"Australia Women v Netherlands" }, ["team:hockey:hockeyroos"]],
  [{ key:"afl", id:"aflw-australia-ireland-2026-08-01", name:"AFLW — Australia v Ireland" }, ["team:aflw:representative:australia", "team:aflw:representative:ireland"]],
];
regressionCases.forEach(([event, expected]) => {
  assert.deepEqual(registry.participantIdsForEvent(event), expected, `${event.name} must resolve its sport- and gender-specific national identities`);
});
assert.equal(registry.canonicalId("team:football:national:australia"), "team:football:socceroos");
assert.equal(registry.canonicalId("team:nrl:national:new-zealand"), "team:nrl:kiwis");
assert.equal(registry.canonicalId("team:netball:national:australia"), "team:netball:diamonds");

if (!assetsOnly){
  const feed = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events.json"), "utf8"));
  const majorEvents = JSON.parse(fs.readFileSync(path.join(ROOT, "data/major-events.v1.json"), "utf8"));
  const audited = [];
  function auditRecords(value, sourceLabel){
    if (Array.isArray(value)) return value.forEach(child => auditRecords(child, sourceLabel));
    if (!value || typeof value !== "object") return;
    const resolvedIds = registry.participantIdsForEvent(value);
    if (resolvedIds.length === 2 && value.name){
      const persistedIds = Array.isArray(value.participantIds) ? value.participantIds.map(registry.canonicalId) : [];
      assert.deepEqual(persistedIds, resolvedIds, `${sourceLabel}:${value.id || value.eventId || value.name} must persist canonical national-team participant IDs`);
      assert.doesNotMatch(String(value.name), /\p{Regional_Indicator}{2}/u, `${sourceLabel}:${value.id || value.eventId || value.name} must not retain a team flag emoji`);
      persistedIds.forEach(id => {
        const team = registry.teamForId(id);
        assert(team, `${sourceLabel}:${value.id || value.name} contains unresolved national-team ID ${id}`);
        assert(fs.existsSync(path.join(ROOT, team.assetPath)), `${id} has a missing local asset`);
      });
      audited.push(`${sourceLabel}:${value.id || value.eventId || value.name}`);
    }
    Object.values(value).forEach(child => auditRecords(child, sourceLabel));
  }
  auditRecords(feed, "feed");
  auditRecords(majorEvents, "major-events");
  assert(audited.length >= 32, `expected the baseline national-team card audit to cover at least 32 fixtures, found ${audited.length}`);

  const codeInspectorDir = path.join(ROOT, "data/code-inspector");
  fs.readdirSync(codeInspectorDir).filter(name => name.endsWith(".json") && name !== "manifest.v1.json").forEach(name => {
    const chunk = JSON.parse(fs.readFileSync(path.join(codeInspectorDir, name), "utf8"));
    (chunk.fixtures || []).forEach(fixture => {
      const ids = registry.participantIdsForEvent(fixture);
      if (ids.length !== 2) return;
      assert.deepEqual((fixture.participantSlots || []).map(slot => registry.canonicalId(slot.participantId)), ids, `${name}:${fixture.id} must expose canonical participant slots`);
      (fixture.participantSlots || []).forEach(slot => {
        assert.match(slot.logoUrl || "", /^assets\/identities\/national\//, `${name}:${fixture.id} must expose a local national-team logo`);
        assert.doesNotMatch(slot.logoUrl || "", /^https?:/i, `${name}:${fixture.id} must not hotlink a national-team asset`);
      });
    });
  });

  const followRecords = fs.readdirSync(path.join(ROOT, "data/follow-directory")).filter(name => name.endsWith(".v1.json") && name !== "manifest.v1.json")
    .flatMap(name => JSON.parse(fs.readFileSync(path.join(ROOT, "data/follow-directory", name), "utf8")).records || [])
    .filter(record => record.teamKind === "national");
  assert.equal(followRecords.length, 58, "generated Follow data must retain all national teams as teamKind national");
  followRecords.forEach(record => {
    assert(registry.teamForId(record.id), `Follow contains unknown national team ${record.id}`);
    assert.match(record.logoUrl || "", /^assets\/identities\/national\//, `${record.id} Follow logo must be local`);
  });
}

console.log(`National-team identity validation passed for 58 identities${assetsOnly ? " (assets and integration)" : " across Feed, major events, Standings & Fixtures and Follow"}.`);
