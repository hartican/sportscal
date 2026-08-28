#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const nsc = require("../config/nothingscore");
const enrichment = require("../config/enrichment-engine");
const marquee = require("../lib/nothingscore-marquee-handler");
const nothingscoreApi = require("../lib/nothingscore-handler");

const read = file => fs.readFileSync(file, "utf8");
const html = read("index.html");
const sql = read("supabase/nothingscore.sql");
const api = read("lib/nothingscore-handler.js");
const server = read("lib/nothingscore-server.js");
const marqueeApi = read("lib/nothingscore-marquee-handler.js");
const sync = read("config/server-sync.js");
const worker = read("service-worker.js");

assert.equal(nsc.SCHEMA_VERSION, "nothingscore.v1");
assert.deepEqual(nsc.PERSONA_WEIGHTS, { general:1, pundit:1, rising:2, influencer:4, curator:8, editorial:8, admin:8 });
assert.deepEqual(nsc.HEAT_LABELS, ["Routine","Interesting","Notable","Major","Essential"]);
assert.deepEqual(nsc.PULSE_LABELS, ["Flat","Solid","Strong","Exceptional","Unforgettable"]);
assert.deepEqual(nsc.HEAT_TAGS, ["Box office","Big stakes","Rivalry","Star power","National interest","Great storyline"]);
assert.deepEqual(nsc.IMPACT_TAGS, ["Thrilling","Eye-popping","Mind-blowing","Emotional","Electric atmosphere","Pure chaos"]);
assert.equal(nsc.PULSE_BUCKET_MS, 5 * 60 * 1000);
assert.equal(nsc.PULSE_FRESH_MS, 10 * 60 * 1000);
assert.equal(nsc.PRESENCE_TTL_MS, 150 * 1000);

const twoPilotRows = [
  { userId:"pilot-one", persona:"general", rating:5, tags:["Rivalry"] },
  { userId:"pilot-two", persona:"influencer", rating:2, tags:["Big stakes"] },
];
assert.equal(nsc.weightedMean(twoPilotRows), 2.6, "persona weights must apply to at least two independent pilot users");
assert.equal(nsc.likeLift(49), .35, "like lift must cap at 0.35");
assert.equal(nsc.aggregateRatings([], 4).building, true, "likes alone must remain visibly low-confidence and building");
assert.equal(nsc.aggregateRatings([], 4).internalScore, 3.1, "likes alone use the neutral internal prior plus lift");
assert.equal(nsc.aggregateRatings(twoPilotRows, 8).score, 2.7);
assert.equal(nsc.aggregateRatings(twoPilotRows, 8).support, 7, "support combines role weights with 0.25 per like");
assert.equal(nsc.aggregateRatings(twoPilotRows, 100).support, 12, "like support must cap at seven while rating weight remains intact");
assert.deepEqual(nsc.validTags("heat", 3, ["Rivalry"]), []);
assert.deepEqual(nsc.validTags("heat", 5, ["Rivalry","Rivalry","Big stakes","Star power","Box office"]), ["Rivalry","Big stakes","Star power"]);
assert.equal(nsc.blendBand(2.99), 0);
assert.equal(nsc.blendBand(3), .25);
assert.equal(nsc.blendBand(10), .5);
assert.equal(nsc.blendBand(25), .75);
assert.equal(nsc.blendHeatWithStakes(1, 5, 25).score, 4, "Heat influence must never exceed 75 percent");
assert.deepEqual(nsc.impactSeed(5, 25), { rating:4.4, weight:10 });
assert.equal(nsc.capPointAwards(9, 24, 3), 1);
assert.equal(nsc.capPointAwards(10, 0, 1), 0);
assert.equal(nsc.normaliseHandle("@Pilot_One"), "pilot_one");
assert.equal(nsc.normaliseHandle("bad-handle"), "");
assert.equal(nothingscoreApi._test.fullDisplayName("Jack Hartican"), true);
assert.equal(nothingscoreApi._test.fullDisplayName("J H"), false, "initials must not be accepted as a public display name");

const pulseNow = new Date("2026-08-29T10:10:00.000Z");
const pulse = nsc.pulseAggregate([
  { userId:"pilot-one", persona:"general", rating:1, updatedAt:"2026-08-29T09:55:00.000Z" },
  { userId:"pilot-one", persona:"general", rating:5, updatedAt:"2026-08-29T10:09:00.000Z" },
  { userId:"pilot-two", persona:"rising", rating:4, updatedAt:"2026-08-29T10:08:00.000Z" },
  { userId:"stale", persona:"admin", rating:5, updatedAt:"2026-08-29T09:40:00.000Z" },
], pulseNow);
assert.equal(pulse.uniqueContributors, 2, "only users fresh in the last ten minutes may shape live Pulse");
assert.equal(pulse.score, 3.7, "a fresh user's live value is their event-wide mean across buckets");
assert.equal(nsc.pulseBucket("2026-08-29T10:12:59.000Z"), "2026-08-29T10:10:00.000Z");
assert.equal(nsc.activePresence([{lastHeartbeatAt:"2026-08-29T10:07:31.000Z"},{lastHeartbeatAt:"2026-08-29T10:07:29.000Z"}], pulseNow).length, 1);

assert.equal(nsc.phaseFor({startTimeUtc:"2026-08-29T10:00:00.000Z",endTimeUtc:"2026-08-29T12:00:00.000Z"}, "2026-08-29T09:59:00.000Z"), "heat");
assert.equal(nsc.phaseFor({startTimeUtc:"2026-08-29T10:00:00.000Z",session:{status:"active",effectiveStartAt:"2026-08-29T10:00:00.000Z",effectiveEndAt:"2026-08-29T12:00:00.000Z"}}, "2026-08-29T10:30:00.000Z"), "pulse");
assert.equal(nsc.phaseFor({startTimeUtc:"2026-08-29T10:00:00.000Z",endTimeUtc:"2026-08-29T12:00:00.000Z"}, "2026-08-29T12:00:00.000Z"), "impact");

const baseEvent = {
  id:"nsc-ranking-test", key:"rugby", sportId:"rugby", name:"Routine fixture", date:"2026-09-01", time:"19:30",
  startTimeUtc:"2026-09-01T09:30:00.000Z", storyline:{stakes:1,intensity:1}, expected:1,
};
const noSupport = enrichment.enrichEvent({...baseEvent,nothingscoreSnapshot:{phase:"heat",aggregate:{score:5,support:2},aggregates:{heat:{score:5,support:2}}}});
const highSupport = enrichment.enrichEvent({...baseEvent,nothingscoreSnapshot:{phase:"heat",aggregate:{score:5,support:25},aggregates:{heat:{score:5,support:25}}}});
assert.equal(noSupport.stakesScore, 1, "canonical editorial Stakes must remain untouched");
assert.equal(noSupport.surfacingStakesScore, 1, "sub-threshold Heat must not alter eligibility");
assert.equal(highSupport.surfacingStakesScore, 4, "eligible Heat may influence surfacing by at most 75 percent");
assert.equal(highSupport.stakesScore, 1, "blending must not rewrite the canonical Stakes field");
const noReplay = enrichment.enrichEvent({...baseEvent,nothingscoreSnapshot:{phase:"impact",aggregate:{score:5,support:30},aggregates:{heat:{score:1,support:0},impact:{score:5,support:30}}}});
assert.equal(noReplay.surfacingStakesScore, 1, "Impact cannot promote a future/non-replay fixture");
const replay = enrichment.enrichEvent({...baseEvent,replayEligible:true,nothingscoreSnapshot:{phase:"impact",aggregate:{score:5,support:30},aggregates:{heat:{score:1,support:0},impact:{score:5,support:30}}}});
assert.equal(replay.surfacingStakesScore, 5, "supported Impact may promote an eligible replay/highlight surface");

const tieRank = enrichment.rankEvents([
  {...baseEvent,id:"quiet",nothingscoreSnapshot:{phase:"pulse",aggregate:{score:4},watchingCount:2}},
  {...baseEvent,id:"busy",nothingscoreSnapshot:{phase:"pulse",aggregate:{score:4},watchingCount:20}},
]);
assert.equal(tieRank[0].event.id, "busy", "live Pulse and Watching Now count must break otherwise equal prominence ties");

for (const table of ["profiles","personas","pilot_members","contributions","likes","presence","marquee_sessions","points","username_reports"]){
  assert.match(sql, new RegExp(`nothingsports_nsc_${table}`));
}
assert.match(sql, /force row level security/i);
assert.match(sql, /revoke all on public\.%I from anon, authenticated/i);
assert.match(sql, /grant select, insert, update, delete on public\.%I to service_role/i);
assert.match(sql, /pg_advisory_xact_lock/);
assert.match(sql, /25-day_total/);
assert.match(sql, /10-fixture_total/);
assert.match(sql, /at time zone 'Australia\/Sydney'/i);
assert.match(sql, /profile_id uuid not null default gen_random_uuid\(\) unique/);
assert.doesNotMatch(sql, /email|raw_ip|ip_address/i);
assert.doesNotMatch(sql, /citext/i);
for (const index of ["contribution_user_idx","like_user_idx","presence_user_idx","persona_assigner_idx","pilot_approver_idx","session_activator_idx"]){
  assert.match(sql, new RegExp(`nothingsports_nsc_${index}`));
}

assert.match(api, /ids\.length>50/);
assert.match(api, /targetProfileId/);
assert.doesNotMatch(api, /targetUserId/);
assert.match(api, /visibility==="deleted"/);
assert.match(api, /profile-visibility/);
assert.match(api, /first_fixture_like/);
assert.match(api, /pulse_15m/);
assert.match(api, /watching_two_heartbeats/);
assert.match(server, /profileId:profile\.profile_id/);
assert.match(server, /Hidden contributor/);
assert.match(server, /pulse_frozen_at:"is\.null"/);
assert.match(server, /risingEligible/);
assert.match(server, /influencerEligible/);
assert.match(marqueeApi, /app_metadata\?\.role/);
assert.doesNotMatch(marqueeApi, /user_metadata/);
assert.deepEqual(marquee._test.canonicalWindow({startTimeUtc:"2026-08-29T10:00:00.000Z",liveWindow:3}), {startTimeUtc:"2026-08-29T10:00:00.000Z",endTimeUtc:"2026-08-29T13:00:00.000Z"});
assert.match(marqueeApi, /marquee_already_frozen/);
assert.match(marqueeApi, /start|extend|stop|status/);

assert.match(sync, /ids\.slice\(0, 50\)/);
assert.match(sync, /authenticatedRequest\("\/api\/nothingscore"/);
assert.match(sync, /authenticatedRequest\("\/api\/nothingscore-marquee"/);
assert.match(read("api/participation.js"), /routeMode === "nothingscore"[\s\S]+routeMode === "nothingscore-marquee"/);
assert.equal(JSON.parse(read("vercel.json")).rewrites.filter(rule => rule.source.startsWith("/api/nothingscore")).length, 2);
assert.match(html, /src="config\/nothingscore\.js"[\s\S]+src="config\/enrichment-engine\.js"/);
assert.match(html, /summary\.className = "nsc-summary"/);
assert.match(html, /buildNothingscoreContributors/);
assert.match(html, /name\.textContent = contributor\.displayName/);
assert.doesNotMatch(html, /nsc-contributor[^\n]+innerHTML/);
assert.match(html, /publishPositiveNothingscoreLike/);
assert.match(html, /nothingscorePollFailures >= 3/);
assert.match(html, /scheduleNothingscorePoll\(30_000\)/);
assert.match(html, /scheduleNothingscoreHeartbeat\(60_000\)/);
assert.match(html, /document\.visibilityState === "hidden"/);
assert.match(html, /NOTHINGSCORE_SOUND_KEY/);
assert.match(html, /prefers-reduced-motion: reduce/);
assert.match(html, /This week/);
assert.match(html, /All time/);
assert.match(html, /Report username/);
assert.match(html, /NSC building/);
assert.match(worker, /nothingsport-shell-v167/);
assert.match(worker, /"\/config\/nothingscore\.js"/);
assert.equal(html.match(/<meta name="app-shell-version" content="(\d+)">/)?.[1], "167");

const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(inlineScript);
assert.doesNotThrow(() => new Function(inlineScript), "the integrated Nothingscore UI must parse as part of the full app shell");

console.log("Nothingscore validation passed (three phases, two-user weighting, private identity boundary, scoring, pilot controls, marquee lifecycle, leaderboards and UI polling).");
