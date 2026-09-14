#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/afl-nrl-2026.json"), "utf8"));
const gwsId = "team:aflw:cd_t7889";
const all = bundle.events.filter(event => event.competitionId === "competition:aflw-2026" && event.participantIds?.includes(gwsId));
const published = all.filter(event => Date.parse(event.startTimeUtc) >= Date.parse("2026-08-27T14:00:00.000Z"));
assert.equal(all.length, 12, "GWS must have all 12 published 2026 AFLW home-and-away fixtures");
assert.equal(published.length, 10, "GWS must have all ten fixtures on/after 28 August Sydney time");
for (const event of published){
  assert.ok(event.selectedSentence?.includes(event.displayName));
  assert.ok(event.fullSpiel?.length >= 180);
  assert.equal(event.editorialPreview?.status, "journalistic");
  assert.ok(event.editorialPreview.evidenceReferences.length >= 3);
  assert.ok(!/generic|coming up|don't miss/i.test(`${event.selectedSentence} ${event.fullSpiel}`));
}
const profiles=JSON.parse(fs.readFileSync(path.join(ROOT,"data/athlete-profiles/aflw.v1.json"),"utf8")).profiles;
const tarni=profiles.find(profile=>profile.participantId==="competitor:aflw:tarni-evans");
assert(tarni,"Tarni Evans profile must be published");
assert.match(tarni.biography,/left-footed forward/i);
assert.match(tarni.biography,/leading goalkicker/i);
assert.equal(tarni.keyFacts.find(fact=>fact.label==="Position")?.value,"Key forward");
assert.match(tarni.keyFacts.find(fact=>fact.label==="Honours")?.value||"",/22Under22/);
assert(tarni.sourceLinks.some(link=>link.url==="https://www.gwsgiants.com.au/players/aflw/4040/tarni-evans"));
console.log("GWS AFLW editorial valid: 12 fixtures present and ten post-cutoff fixtures carry source-backed, fixture-specific copy.");
