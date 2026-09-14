#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("scripts/refresh-nfl-ice-hockey.js", "utf8");
const canonicalSports = fs.readFileSync("scripts/refresh-canonical-sports.js", "utf8");
const premierLeague = fs.readFileSync("scripts/refresh-premier-league-context.js", "utf8");
const tennisRankings = fs.readFileSync("scripts/refresh-tennis-ranking-exports.js", "utf8");
const rollingEditorial = fs.readFileSync("scripts/update-rolling-editorial-projections.js", "utf8");
const teamDirectories = fs.readFileSync("scripts/build-team-player-directories.js", "utf8");
const officialFollow = fs.readFileSync("scripts/refresh-official-follow-fixtures.js", "utf8");
const swimming = fs.readFileSync("scripts/refresh-swimming-directory.js", "utf8");
const { f1Narrative } = require("./update-rolling-editorial-projections");
assert.match(source, /AbortSignal\.timeout\(20_000\)/, "slow source calls need a bounded timeout");
assert.match(source, /preserv(?:e|ing) existing/i, "transient source failure must retain validated current snapshots");
assert.match(source, /retiredEspnRosterEndpoint[^]*404\\s\+Not Found:[^]*site\\\.api\\\.espn\\\.com[^]*roster/i, "the retired ESPN roster capability must preserve the last validated NFL snapshot instead of blocking every canonical refresh");
assert.match(source, /validate\(nfl,[\s\S]+validate\(iceHockey,/, "preserved snapshots must still pass the canonical contract");
assert.match(canonicalSports, /preserving \$\{existing\.events\.length\} validated fixtures for immediate canonical checks/, "AFL and NRL refresh must preserve a validated canonical bundle only on transient failure");
assert.match(premierLeague, /preserving \$\{snapshot\.entries\.length\} validated clubs for the immediate --check pass/, "Premier League refresh must preserve only a validated table after transient failure");
assert.match(tennisRankings, /assertCompleteRankingUniverse\(current\.payload\.athletes \|\| \[\], tour\)/, "ranking refresh must validate both retained Top 50 and Australian universes");
assert.match(rollingEditorial, /projection\.targetIds \|\| \[\][\s\S]+publishedIds\.has/, "daily editorial refresh must prune only rolling projections whose published target has left the feed");
assert.match(teamDirectories, /AbortSignal\.timeout\(20_000\)/, "team/player source calls need a bounded timeout");
assert.match(teamDirectories, /preserving existing directories for the immediate --check validation/i, "team/player refresh must preserve only into its canonical check stage");
assert.match(officialFollow, /AbortSignal\.timeout\(20_000\)/, "official follow source calls need a bounded timeout");
assert.match(officialFollow, /preserving \$\{payload\.events\.length\} validated fixtures/, "official follow refresh must preserve only a validated artifact after a transient failure");
assert.match(swimming, /AbortSignal\.timeout\(20_000\)/, "World Aquatics calls need a bounded timeout");
assert.match(swimming, /validate\(existing\)[\s\S]+preserving \$\{existing\.athletes\.length\} validated athletes for the immediate --check pass/i, "a changed or unavailable World Aquatics endpoint must preserve the last validated swimming directory");
const f1Projection = f1Narrative({
  id:"fixture:f1:2026:singapore:race",
  key:"f1",
  name:"Singapore GP Race",
  sourceUrl:"https://www.formula1.com/en/results/2026/drivers",
  editorialPreview:{ evidenceReferences:[
    { url:"https://www.formula1.com/en/results/2026/drivers" },
    { url:"https://www.formula1.com/en/results/2026/team" },
    { url:"https://www.formula1.com/en/results/2026/races" },
  ] },
}, {
  participants:[
    { id:"driver:leader", displayName:"Driver One" },
    { id:"driver:second", displayName:"Driver Two" },
    { id:"constructor:leader", displayName:"Constructor One" },
    { id:"constructor:second", displayName:"Constructor Two" },
  ],
  sources:[{ provider:"Formula 1", sourceUrl:"https://www.formula1.com/en/results/2026/races" }],
  ladderSnapshots:[
    { competitionId:"competition:f1-drivers-2026", snapshotTimeUtc:"2026-09-14T00:00:00.000Z", source:{ sourceUrl:"https://www.formula1.com/en/results/2026/drivers" }, entries:[{ participantId:"driver:leader", points:300 }, { participantId:"driver:second", points:280 }] },
    { competitionId:"competition:f1-constructors-2026", snapshotTimeUtc:"2026-09-14T00:00:00.000Z", source:{ sourceUrl:"https://www.formula1.com/en/results/2026/team" }, entries:[{ participantId:"constructor:leader", points:500 }, { participantId:"constructor:second", points:450 }] },
  ],
}, new Date("2026-09-14T00:00:00.000Z"));
assert.equal(f1Projection.facts.length, 4, "an ordinary F1 marquee session needs four sourced facts");
assert.equal(new Set(f1Projection.facts.map(fact => fact.dimension)).size, 3, "an ordinary F1 marquee session needs three narrative dimensions");
assert.equal(new Set([f1Projection.sourceId, ...f1Projection.extraSources.map(source => source.id)]).size, 3, "an ordinary F1 marquee session needs three source records");
assert.match(f1Projection.extraSources.find(source => source.id.includes(":session:"))?.url || "", /\/races$/, "the session fact must use the official race/session source instead of duplicating the driver standings source");
const monzaQualifying = f1Narrative({ id:"fixture:f1:2026:italy:qualifying", key:"f1", name:"Italian GP Qualifying" }, {
  participants:[{ id:"driver:leader", displayName:"Driver One" }, { id:"driver:second", displayName:"Driver Two" }],
  sources:[{ provider:"Formula 1", sourceUrl:"https://www.formula1.com/en/results/2026/races" }],
  ladderSnapshots:[{ competitionId:"competition:f1-drivers-2026", snapshotTimeUtc:"2026-09-14T00:00:00.000Z", source:{ sourceUrl:"https://www.formula1.com/en/results/2026/drivers" }, entries:[{ participantId:"driver:leader", points:300 }, { participantId:"driver:second", points:280 }] }],
}, new Date("2026-09-14T00:00:00.000Z"));
const monzaRace = f1Narrative({ id:"fixture:f1:2026:italy:race", key:"f1", name:"Italian GP Race" }, {
  participants:[{ id:"driver:leader", displayName:"Driver One" }, { id:"driver:second", displayName:"Driver Two" }],
  sources:[{ provider:"Formula 1", sourceUrl:"https://www.formula1.com/en/results/2026/races" }],
  ladderSnapshots:[{ competitionId:"competition:f1-drivers-2026", snapshotTimeUtc:"2026-09-14T00:00:00.000Z", source:{ sourceUrl:"https://www.formula1.com/en/results/2026/drivers" }, entries:[{ participantId:"driver:leader", points:300 }, { participantId:"driver:second", points:280 }] }],
}, new Date("2026-09-14T00:00:00.000Z"));
assert.notEqual(monzaQualifying.facts.find(fact => fact.dimension === "format")?.id, monzaRace.facts.find(fact => fact.dimension === "format")?.id, "two sessions at one Grand Prix must not overwrite each other's circuit fact provenance");
console.log("Canonical source resilience valid: bounded fetches and validated preservation passed.");
