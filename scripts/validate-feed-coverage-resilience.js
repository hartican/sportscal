#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { catalogue } = require("../lib/calendar-catalogue");

const ROOT = path.resolve(__dirname, "..");
const followArtifact = require("../data/follow-fixtures.v1.json");
const majorEvents = require("../data/major-events.v1.json");
const publishedFeed = require("../data/events.json");
const cardIdentities = require("../config/card-identities.js");
const candidates = catalogue();
const identifiers = event => [event?.canonicalEventId, event?.eventId, event?.id].filter(Boolean).map(String);
const candidateIds = new Set(candidates.flatMap(identifiers));
const followIds = new Set((followArtifact.events || []).flatMap(identifiers));

function identity(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function searchText(event){
  return [event?.name, event?.sport, event?.key, event?.competitionId, event?.roundLabel, event?.round, event?.stage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function sydneyDate(event){
  const raw = event?.startTimeUtc || event?.timelineSortTimeUtc || event?.sessionStartTimeUtc || event?.date || event?.startDate || "";
  if (!raw) return "";
  const value = /^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? `${raw}T00:00:00+10:00` : raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Australia/Sydney", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(date);
}

assert(candidates.length > (followArtifact.events || []).length + 500,
  "the shared candidate catalogue must be a broad union, not an alias of follow-fixtures");

for (const id of [
  "event-afl-cd_m20260142701",
  "event-nrl-129992708",
  "epl-2026-27-128953",
  "rugby-argentina-australia-mendoza-2026-09-06",
  "fixture:us-open-2026:official:ms:1156",
]) {
  assert(candidateIds.has(id), `shared catalogue lost canonical fixture ${id}`);

}

assert([...candidateIds].filter(id=>!followIds.has(id)).length>500,"the shared catalogue remains independent of personalised follow snapshots");
const usOpen = (majorEvents.events || []).find(event => event.id === "major-event:us-open-2026");
assert(usOpen && Array.isArray(usOpen.subEvents) && usOpen.subEvents.length > 100,
  "the released US Open order of play must remain in the shared catalogue");
assert(usOpen.subEvents.some(event => /Sabalenka/i.test(event.name || "")), "US Open coverage lost Sabalenka");
assert(usOpen.subEvents.some(event => /Tsitsipas/i.test(event.name || "")), "US Open coverage lost Tsitsipas");
assert(usOpen.subEvents.every(event => candidateIds.has(identity(event))),
  "every released US Open fixture must be reachable from the shared catalogue");
assert(usOpen.subEvents.every(event => ["exact", "follows", "date-only", "tbc"].includes(event.timePrecision)),
  "US Open fixtures must use the canonical timing precision vocabulary");
const wuAlcaraz = usOpen.subEvents.find(event => /Yibing Wu v Carlos Alcaraz/i.test(event.name || ""));
const zverevTabilo = usOpen.subEvents.find(event => /Alexander Zverev v Alejandro Tabilo/i.test(event.name || ""));
assert.equal(wuAlcaraz?.startTimeUtc, "2026-09-05T02:30:00.000Z", "Wu-Alcaraz must retain the verified 12:30pm Sydney start");
assert.equal(zverevTabilo?.startTimeUtc, "2026-09-06T01:30:00.000Z", "Zverev-Tabilo must retain the verified 11:30am Sydney start");
assert([wuAlcaraz, zverevTabilo].every(event => event?.timePrecision === "exact" && event?.timingSource?.publisher === "Stan Sport"),
  "broadcaster-upgraded tennis times must retain exact precision and source provenance");
const stormHunter = usOpen.subEvents.find(event => /Storm Hunter/i.test(event.name || ""));
const stormMark = cardIdentities.markForEvent({ ...stormHunter, key:"tennis", sport:"Tennis" });
assert(stormHunter?.participantIds?.includes("athlete:tennis:storm-hunter") && stormHunter.identityRef === "event:us-open",
  "Storm Hunter must remain a typed tennis athlete under the US Open identity");
assert.equal(stormMark?.id, "brand:us-open", "an Event-derived Storm Hunter fixture must render the tournament mark");
const leMans = (publishedFeed.events || []).filter(event => /24 Hours of Le Mans/i.test(event.name || ""));
assert(leMans.length === 2 && leMans.every(event => event.competitionId === "competition:fia-wec" && event.identityRef === "event:le-mans" && Number(event.publishedDurationHours) === 24),
  "24 Hours of Le Mans cards must remain endurance/WEC fixtures with their published duration");
assert(leMans.every(event => cardIdentities.markForEvent(event)?.id === "brand:le-mans-24-hours"),
  "Le Mans cards must render the official event identity rather than Formula 1");

const september = candidates.filter(event => {
  const day = sydneyDate(event);
  return day >= "2026-09-06" && day <= "2026-09-17";
});
const includes = expression => september.some(event => expression.test(searchText(event)));
assert(includes(/premier league|competition:premier-league/), "September sentinel lost EPL fixtures");
assert(includes(/rugby/), "September sentinel lost rugby fixtures");
assert(includes(/afl.*semi finals|semi finals.*afl|competition:afl-premiership/), "September sentinel lost AFL finals");
assert(includes(/nrl finals|competition:nrl-premiership/), "September sentinel lost NRL coverage");
assert(includes(/us open/), "September sentinel lost the active US Open");

const occupiedDays = [...new Set(september.map(sydneyDate).filter(Boolean))].sort();
for (let index = 1; index < occupiedDays.length; index += 1) {
  const previous = Date.parse(`${occupiedDays[index - 1]}T00:00:00Z`);
  const current = Date.parse(`${occupiedDays[index]}T00:00:00Z`);
  assert(current - previous <= 4 * 86400000,
    `unexpected shared-catalogue gap between ${occupiedDays[index - 1]} and ${occupiedDays[index]}`);
}

const apiSource = fs.readFileSync(path.join(ROOT, "api/feed.js"), "utf8");
const calendarSource = fs.readFileSync(path.join(ROOT, "lib/calendar-catalogue.js"), "utf8");
const browserSource = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
assert.match(apiSource, /require\("\.\.\/lib\/calendar-catalogue"\)[\s\S]*catalogue\(\)/,
  "server Feed must start from the shared catalogue");
assert.match(calendarSource, /manifest\.codes[\s\S]*majorDocument\.events[\s\S]*fixtureFromSubEvent/,
  "calendar catalogue must union published cards, Schedule chunks and Event fixtures");
assert.match(browserSource, /FOLLOW_FEED_POLICY\.(?:eligibleForFollow|sportingFixture)/,
  "browser fallback must use the shared eligibility policy");

console.log(`Feed coverage resilience passed: ${candidates.length} union candidates, ${september.length} fixtures or Events in the 6-17 September regression window, and ${usOpen.subEvents.length} released US Open fixtures.`);
