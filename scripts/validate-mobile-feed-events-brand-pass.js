#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const brand = require("../config/brand-copy.js");
const followFirst = require("../config/follow-first.js");
const identities = require("../config/card-identities.js");
const majorEvents = require("../config/major-events.js");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const updateSource = fs.readFileSync("scripts/refresh-f1-editorial.js", "utf8");
const majorEventDocument = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const published = JSON.parse(fs.readFileSync("data/events.json", "utf8"));

assert.equal(brand.descriptor, "Like having a sports-fanatic in your pocket.");
assert.equal(brand.loadingDescriptor, brand.descriptor, "top bar and startup must share the official abbreviated slogan");
assert.match(brand.about, /live sports curator, tailored to your tastes/i);
assert.doesNotMatch(brand.descriptor, /live sports curator|mate/i);
assert(html.includes('data-brand-copy="loadingDescriptor"'), "the startup overlay must render the official loading slogan");
assert(html.includes("function startLoadingSloganTypewriter"), "startup must own a deterministic two-second typewriter");
assert(html.includes("prefers-reduced-motion: reduce"), "the loading slogan must respect reduced motion");
assert(html.includes('settingsSection === "feedback") renderFeedbackAppearanceSettings(body)'), "the day/night/system Appearance selector must remain reachable from Settings > Feedback");

const eplViewing = followFirst.viewingLink({
  key:"fifa",
  sport:"Football",
  competitionId:"competition:premier-league",
  name:"Arsenal v Liverpool",
  status:"scheduled",
});
assert.equal(eplViewing?.providerId, "stan", "every EPL fixture must infer Stan Sport from Australian competition rights");
assert.equal(eplViewing?.territory, "AU");
assert.equal(eplViewing?.liveOrReplay, "live");
assert.match(eplViewing?.webUrl || "", /stan\.com\.au\/watch\/sport\/football\/premier-league/);
assert.match(eplViewing?.appScheme || "", /^stan:/);

const championsLeagueViewing = followFirst.viewingLink({ key:"fifa", competitionId:"competition:uefa-champions-league", name:"UEFA Champions League" });
assert.equal(championsLeagueViewing?.providerId, "stan");
const usOpenViewing = followFirst.viewingLink({ key:"tennis", competitionId:"competition:us-open", name:"US Open" });
assert.equal(usOpenViewing?.providerId, "stan");

const completedEplViewing = followFirst.viewingLink({
  key:"fifa",
  competitionId:"competition:premier-league",
  name:"Arsenal v Liverpool",
  status:"completed",
});
assert.equal(completedEplViewing?.liveOrReplay, "replay");

const aflViewing = followFirst.viewingOptions({ key:"afl", competitionId:"competition:afl", stage:"Preliminary Final" });
assert.deepEqual(aflViewing.slice(0, 4).map(option => option.providerId), ["kayo", "foxtel", "seven", "watch-afl"]);
const aflGrandFinal = followFirst.viewingOptions({ key:"afl", competitionId:"competition:afl", stage:"Grand Final" });
assert.equal(aflGrandFinal[0]?.providerId, "seven", "AFL Grand Final must apply its event-specific Australian rights exception");

assert(html.includes('prefix.textContent = `${viewing.liveOrReplay === "replay" ? "Replay" : "Watch"} on`;'), "watch actions must put the provider mark after Watch on / Replay on");
assert(html.includes('fallback.textContent = viewing.actionLabel || viewing.label;'), "provider-name text must be the image fallback");
assert(html.includes('rel = "noopener noreferrer external"'), "web fallbacks must leave the standalone PWA in a separate external window");

const f1Mark = identities.markForEvent({ key:"f1", name:"Australian Grand Prix" });
assert.match(f1Mark?.url || "", /^https:\/\/media\.formula1\.com\/.+f1_logo\.svg$/);
assert.notEqual(f1Mark?.kind, "wordmark", "the generated F1 editorial wordmark must be retired");
assert.match(updateSource, /model:"gpt-5\.6-luna"/);
assert.match(updateSource, /store:false/);
assert.match(updateSource, /type:"json_schema"[\s\S]{0,80}strict:true/);
assert.match(updateSource, /ALLOWED_DOMAINS = \["formula1\.com",\s*"fia\.com",\s*"motorsport\.com",\s*"bbc\.com",\s*"the-race\.com"\]/);

const pinnedEpl = majorEvents.fixtureFromSubEvent({
  id:"epl-test",
  name:"Arsenal v Liverpool",
  startTimeUtc:"2026-08-30T03:00:00Z",
  participants:[{ id:"team:arsenal", name:"Arsenal" }, { id:"team:liverpool", name:"Liverpool" }],
  broadcastOptions:[{ serviceId:"stan", serviceLabel:"Stan Sport", territory:"AU", liveOrReplay:"live" }],
}, {
  id:"major-event:epl-test",
  sportKey:"fifa",
  sportLabel:"Football",
  competitionId:"competition:premier-league",
  stakesScore:5,
  sources:[{ name:"Premier League", url:"https://www.premierleague.com/" }],
});
assert.equal(pinnedEpl.cardKind, "fixture");
assert.equal(pinnedEpl.broadcastOptions[0].serviceId, "stan", "manual pins must retain provider metadata");
assert.equal(pinnedEpl.majorEventId, "major-event:epl-test");

assert.equal(followFirst.normalizeDirectoryRank(null), null);
assert.equal(followFirst.normalizeDirectoryRank(""), null);
assert.equal(followFirst.normalizeDirectoryRank(1), 1);
assert.equal(followFirst.directoryEntityLabel({ entityType:"athlete", sectionLabel:"" }), "Player");
assert.equal(followFirst.directoryEntityLabel({ entityType:"team", sectionLabel:"" }), "Team");

const eplEvents = (published.events || []).filter(event => (
  String(event.competitionId || "").startsWith("competition:premier-league")
  || /premier league/i.test(String(event.competition || event.competitionName || ""))
));
assert(eplEvents.length > 0, "published feed must contain current Premier League fixtures");
eplEvents.forEach(event => assert.equal(followFirst.viewingLink(event)?.providerId, "stan", `${event.eventId || event.id} must resolve Stan Sport`));

const championsLeaguePhases = majorEventDocument.events.filter(event => String(event.id).startsWith("major-event:uefa-champions-league-2026-27:"));
assert.deepEqual(championsLeaguePhases.map(event => event.phaseIdentity), ["qualification", "league", "knockout"]);
assert.equal(championsLeaguePhases[0].subEvents.length, 7, "the live qualification phase must expose its seven concrete second legs");
assert.equal(championsLeaguePhases.reduce((total, event) => total + event.subEvents.length, 0), 13, "the split phases must preserve the complete published schedule");
assert(championsLeaguePhases.slice(1).every(event => event.subEvents.length > 0), "league and knockout phases must remain distinct populated Event cards");

assert(html.includes("index += 5") && html.includes("entries.slice(index, index + 5)"), "L2 event draws must paginate after five mobile rows");
assert(html.includes('limit: state === "compact" ? 1 : state === "selected" ? 3 : Infinity'), "Events L0/L1 must expose exactly one/three chronological fixtures");
assert(html.includes('fallback.textContent = viewing.actionLabel || viewing.label;'), "Watch on provider logos must retain a provider-name text fallback");
assert(html.includes("serverAuthoritativeFixturePins"), "server fixture-pin state must override the local backup outside pending offline commands");
assert(html.includes("pinMutationId"), "fixture pin mutations must be idempotently identifiable");
assert(html.includes("ticketAlertSeenAt") && html.includes("ticket-sale-countdown"), "ticket alerts must own unseen and countdown states");
assert(!/preserveFollowRowAnchor|window\.scrollTo\([^)]*follow/i.test(html), "Follow state changes must not schedule scroll corrections");

assert(worker.includes('/assets/providers/stan-sport'), "the installed shell must include the Stan Sport provider mark");
assert(worker.includes('/assets/providers/foxtel.svg') && worker.includes('/assets/providers/paramount-plus.svg'), "provider marks must be available offline with the installed shell");
assert(/headers\.has\("range"\)[\s\S]{0,450}fetch\(event\.request\)/i.test(worker), "audio byte ranges must continue bypassing Cache Storage");

console.log(`Mobile Feed/Events/brand pass valid: ${eplEvents.length} EPL cards resolve Stan Sport, provider-first actions and exact brand copy passed.`);
