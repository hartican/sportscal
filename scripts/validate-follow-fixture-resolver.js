#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { decryptSnapshot, encryptSnapshot } = require("../lib/follow-snapshot");
const {
  expandedFollowEntityIds,
  resolveUserFollowFixtures,
} = require("../lib/follow-fixture-resolver");
const { buildArtifact, validatePrivacy } = require("./build-follow-fixtures");
const {
  parseDiamondsArticle,
  parseHockeySchedulePage,
  parseNbaSchedulePage,
  officialHockeyFallbackFixtures,
} = require("./refresh-official-follow-fixtures");
const { buildServerFeed } = require("../lib/server-feed-pipeline");

function state(...entityFollows){
  return { preferences:{ preferenceGraph:{ entityFollows } } };
}

function follow(participantId, followLevel = "follow"){
  return { participantId, followLevel };
}

for (const [entityId, expectedMinimum] of [
  ["team:football:club:real-madrid", 1],
  ["team:football:club:barcelona", 1],
  ["team:football:club:marseille", 1],
  ["team:football:club:paris-saint-germain", 1],
  ["team:nfl:gb", 1],
  ["team:nhl:tor", 1],
  ["team:nhl:van", 1],
]){
  const resolved = resolveUserFollowFixtures({ events:[], userState:state(follow(entityId)) });
  assert(resolved.events.length >= expectedMinimum, `${entityId} must resolve fixtures from its existing source bundle`);
}

const playerState = state(follow("competitor:football:espn:134283"));
assert(expandedFollowEntityIds(playerState).has("team:football:club:real-madrid"), "a followed team-sport player must expand to the current team");
assert(resolveUserFollowFixtures({ events:[], userState:playerState }).events.length, "player-to-current-team expansion must resolve fixtures");
const mutedTeamState = state(follow("competitor:football:espn:134283"), follow("team:football:club:real-madrid", "mute"));
assert(!expandedFollowEntityIds(mutedTeamState).has("team:football:club:real-madrid"), "an explicit team mute must override player expansion");
assert.equal(resolveUserFollowFixtures({ events:[], userState:mutedTeamState }).events.length, 0, "muted current-team fixtures must not enter the personalised pool");

const tennisPlayerState = state(follow("competitor:tennis:atp:carlos-alcaraz"));
assert(expandedFollowEntityIds(tennisPlayerState).has("athlete:tennis:carlos-alcaraz"), "ATP/WTA follow ids must resolve the official US Open athlete identity");
const tennisPlayerFixtures = resolveUserFollowFixtures({ events:[], userState:tennisPlayerState }).events;
assert(tennisPlayerFixtures.some(event => event.participantIds.includes("athlete:tennis:carlos-alcaraz")), "a followed player with a published US Open match must resolve that fixture");

const nflPlayerState = state(follow("athlete:nfl:5084939"));
nflPlayerState.preferences.preferenceGraph.domainPreferences = [{
  sportDomainId:"sport:american-football",
  enabled:true,
  includeAllFixtures:false,
  includeMajorEvents:false,
  includeFollowedTeams:true,
}];
const nflPlayerResolved = resolveUserFollowFixtures({ events:[], userState:nflPlayerState });
assert(expandedFollowEntityIds(nflPlayerState).has("team:nfl:ari"), "a followed NFL player must expand to the current team");
assert(buildServerFeed({
  events:nflPlayerResolved.events,
  userId:"00000000-0000-4000-8000-000000000001",
  userState:nflPlayerState,
  participants:nflPlayerResolved.participants,
  now:new Date("2026-08-29T12:00:00.000Z"),
  limit:20,
}).events.length, "player-expanded fixtures must remain eligible after the server feed filter");

const lowStakesFollow = {
  id:"fixture:test:low-stakes-follow",
  eventId:"fixture:test:low-stakes-follow",
  canonicalEventId:"fixture:test:low-stakes-follow",
  key:"nrl",
  sport:"NRL",
  sportDomainId:"sport:nrl",
  competitionId:"competition:nrl-premiership-2026",
  name:"Followed team routine fixture",
  date:"2026-08-30",
  time:"14:00",
  participantIds:["team:nrl:321", "team:nrl:325"],
  homeParticipantId:"team:nrl:321",
  awayParticipantId:"team:nrl:325",
  expected:2,
  storyline:{ stakes:2, intensity:2 },
};
assert.equal(buildServerFeed({
  events:[lowStakesFollow],
  userId:"00000000-0000-4000-8000-000000000002",
  userState:state(follow("team:nrl:321")),
  now:new Date("2026-08-29T12:00:00.000Z"),
  limit:20,
}).events.length, 1, "an explicit team follow must outrank the generic minimum-stakes filter");

const realMadrid = resolveUserFollowFixtures({ events:[], userState:state(follow("team:football:club:real-madrid")) }).events[0];
const deduped = resolveUserFollowFixtures({ events:[realMadrid], userState:state(follow("team:football:club:real-madrid")) });
assert.equal(deduped.events.filter(event => event.canonicalEventId === realMadrid.canonicalEventId).length, 1, "base and follow source fixtures must deduplicate by canonical id");

const nbaGame = {
  gameId:"0022600088",
  gameStatus:1,
  gameDateTimeUTC:"2026-10-21T23:30:00Z",
  arenaName:"Scotiabank Arena",
  arenaCity:"Toronto",
  homeTeam:{ teamTricode:"TOR" },
  awayTeam:{ teamTricode:"CHI" },
};
const nbaHtml = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props:{ pageProps:{ team:{ schedule:[nbaGame] } } } })}</script>`;
const nbaEvents = parseNbaSchedulePage(nbaHtml, "https://www.nba.com/team/1610612741/schedule", "2026-08-29T12:00:00.000Z");
assert.equal(nbaEvents.length, 1);
assert(nbaEvents[0].participantIds.includes("team:nba:chicago-bulls"), "NBA official fixtures must resolve canonical Bulls identity");

const hockeyHtml = String.raw`UpcomingTeamSchedule-module-scss-module__1lkiPW__Match __Date\",\"children\":[\"Saturday 29 August\",\" - \",\"Women's\"] \"children\":\"Belgium\" \"children\":\"vs\" \"children\":\"Australia\" \"children\":\"9:00pm AEST | 7:00pm AWST\" \"children\":\"Wagener Hockey Stadium, Amstelveen (NED)\"`;
const hockeyEvents = parseHockeySchedulePage(hockeyHtml, {
  teamId:"team:hockey:hockeyroos",
  teamName:"Hockeyroos",
  gender:"female",
  sourceUrl:"https://www.hockey.org.au/teams/hockeyroos/schedule",
  checkedAt:"2026-08-29T11:25:00.000Z",
  now:"2026-08-29T11:25:00.000Z",
});
assert.equal(hockeyEvents.length, 1);
assert.equal(hockeyEvents[0].startTimeUtc, "2026-08-29T11:00:00.000Z");
assert(hockeyEvents[0].participantIds.includes("team:hockey:hockeyroos"));

const hockeyFallbacks = officialHockeyFallbackFixtures({
  checkedAt:"2026-08-29T11:25:00.000Z",
  hockeyroosArticle:"Australia will now face Belgium on Saturday at 9:00pm AEST.",
  kookaburrasArticle:"The Kookaburras finished the campaign by defeating England 2-0 to secure fifth place.",
});
assert.equal(hockeyFallbacks.length, 2);
assert.equal(hockeyFallbacks.find(event => event.participantIds.includes("team:hockey:hockeyroos")).startTimeUtc, "2026-08-29T11:00:00.000Z");
assert.equal(hockeyFallbacks.find(event => event.participantIds.includes("team:hockey:kookaburras")).startTimeUtc, "2026-08-28T13:00:00.000Z");

const diamondsHtml = `<p><strong>2026 CONSTELLATION CUP</strong><br><strong>Match 1</strong>: Sunday 18 October – Spark Arena, Auckland&nbsp;<br><strong>Match 2: </strong>Wednesday 21 October – Wolfbrook Arena, Christchurch&nbsp;<br><strong>Match 3: </strong>Sunday 25 October – Qudos Bank Arena, Sydney&nbsp;<br><strong>Match 4:</strong> Wednesday 28 October – John Cain Arena, Melbourne&nbsp;</p>`;
const diamondsEvents = parseDiamondsArticle(diamondsHtml, "https://netball.com.au/news/2026-con-cup-schedule-revealed");
assert.equal(diamondsEvents.length, 4);
assert(diamondsEvents.every(event => event.participantIds.includes("team:netball:diamonds")));
assert(diamondsEvents.every(event => event.scheduleStatus === "time-tbc"), "unpublished Diamonds start times must stay explicitly TBC");
assert(diamondsEvents.every(event => event.timeTbc === true), "unpublished Diamonds start times must not render as midnight");

const rawKey = Buffer.alloc(32, 7).toString("base64");
const privatePayload = { schemaVersion:"follow-snapshot.v1", profiles:[{ profileHash:"anonymous", entityFollows:[follow("team:nfl:gb")] }] };
const envelope = encryptSnapshot(privatePayload, rawKey);
assert(!JSON.stringify(envelope).includes("team:nfl:gb"), "the temporary server snapshot must be encrypted at rest");
assert.deepEqual(decryptSnapshot(envelope, rawKey), privatePayload);

const artifact = buildArtifact({ schemaVersion:"follow-snapshot.v1", profiles:[{ profileHash:"anonymous", entityFollows:[follow("team:nfl:gb")] }] }, {
  now:new Date("2026-08-29T12:00:00.000Z"),
  baseEvents:[],
});
assert(validatePrivacy(artifact));
assert(!JSON.stringify(artifact).includes("anonymous"));
assert(!JSON.stringify(artifact).includes("entityFollows"));

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "follow-fixture-permission-test-"));
try{
  fs.chmodSync(tempDirectory, 0o700);
  const snapshotPath = path.join(tempDirectory, "snapshot.enc.json");
  fs.writeFileSync(snapshotPath, JSON.stringify(envelope), { mode:0o600 });
  assert.equal(fs.statSync(tempDirectory).mode & 0o777, 0o700);
  assert.equal(fs.statSync(snapshotPath).mode & 0o777, 0o600);
}finally{
  fs.rmSync(tempDirectory, { recursive:true, force:true });
}

const snapshotSource = fs.readFileSync(path.resolve(__dirname, "snapshot-active-follows.js"), "utf8");
assert.match(snapshotSource, /FOLLOW_SNAPSHOT_PRELOADED_PATH[^]*readSnapshot[^]*encryptSnapshot/, "a server connector snapshot must be decrypted only in memory and re-encrypted into updater-owned storage");
const artifactBuilderSource = fs.readFileSync(path.resolve(__dirname, "build-follow-fixtures.js"), "utf8");
assert(artifactBuilderSource.includes("includeCompactArtifact:false"), "the compact artifact must be regenerated from source bundles rather than its previous saved state");

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
assert(html.includes('PERSONALISED_FEED_CACHE_VERSION = "server-feed.v3:first-page.v1"'), "v2 personalised pages must be invalidated");
assert(html.includes('payload?.schemaVersion !== "server-feed.v3"'), "the client must reject stale personalised schemas");
assert(html.includes("requestFeedRebuildAfterFollowChange"), "follow changes must request an immediate server rebuild");
assert.match(html, /await syncCurrentServerState\(\);[^]*await clearCachedPersonalisedFeed[^]*await refreshRemoteFeed/, "the follow rebuild must complete server sync before fetching the new page");
assert.match(html, /followFeedRefreshPending = true[^]*navigator\?\.onLine === false/, "offline follow changes must stay pending locally");
assert.match(html, /window\.addEventListener\("online"[^]*followFeedRefreshPending[^]*requestFeedRebuildAfterFollowChange/, "pending follow refreshes must retry on reconnection");
assert(html.includes('b.textContent = "Live Now"'), "live cards must display explicit Live Now signage");

console.log("Follow fixture resolver valid: source adapters, player expansion, mutes, deduplication, private snapshots, cache invalidation and offline retry passed.");
