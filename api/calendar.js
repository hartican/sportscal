"use strict";

const feed = require("../data/events.json");
const {
  buildCalendarIcs,
  filterCalendarEvents,
  normalizeCalendarSyncQuery,
} = require("../lib/calendar-sync");

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

  const events = filterCalendarEvents(feed.events || feed, config);
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
