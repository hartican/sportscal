"use strict";

const feed = require("../data/events.json");
const canonicalSports = require("../data/canonical/afl-nrl-2026.json");
const f1Context = require("../data/canonical/f1-context-2026.json");
const tennisContext = require("../data/canonical/tennis-context-2026.json");
const cyclingContext = require("../data/canonical/cycling-context-2026.json");
const nbaContext = require("../data/canonical/nba-context-2026.json");
const cwgContext = require("../data/canonical/cwg-context-2026.json");
const sportContext = require("../config/sport-context");
const {
  buildCalendarIcs,
  filterCalendarEvents,
  normalizeCalendarSyncQuery,
} = require("../lib/calendar-sync");

const canonicalSportContext = sportContext.mergeCanonicalBundles(
  canonicalSports,
  f1Context,
  tennisContext,
  cyclingContext,
  nbaContext,
  cwgContext
);
const contextualEvents = sportContext.applyContextToEvents(feed.events || feed, canonicalSportContext);

function requestQuery(request){
  if (request.query && typeof request.query === "object") return request.query;
  const url = new URL(request.url || "/api/calendar", "https://nothingsport.vercel.app");
  return Object.fromEntries(url.searchParams.entries());
}

module.exports = function calendarSyncHandler(request, response){
  if (request.method && request.method !== "GET"){
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Calendar sync supports GET requests only." });
    return;
  }

  const config = normalizeCalendarSyncQuery(requestQuery(request));
  if (!config.sports.length){
    response.status(400).json({ error: "Choose at least one followed sport for Calendar sync." });
    return;
  }

  const events = filterCalendarEvents(contextualEvents, config);
  const calendar = buildCalendarIcs(events, {
    generatedAt: feed.publishedAt || new Date(),
    reminderMinutes: config.reminderMinutes,
  });

  response.setHeader("Content-Type", "text/calendar; charset=utf-8");
  response.setHeader("Content-Disposition", 'inline; filename="nothingsports-calendar.ics"');
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=900");
  response.setHeader("X-nothingSports-Events", String(events.length));
  response.status(200).send(calendar);
};
