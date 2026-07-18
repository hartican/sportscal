#!/usr/bin/env node

const fs = require("fs");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const feed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const events = Array.isArray(feed) ? feed : feed.events;
const now = new Date();
const today = now.toISOString().slice(0, 10);

function isDueForResult(event) {
  if (event.status === "completed") return true;
  if (!event.date || event.date > today) return false;
  if (event.date < today) return true;
  if (!event.time) return false;
  const start = new Date(`${event.date}T${event.time}:00+10:00`);
  return now.getTime() >= start.getTime() + 4 * 60 * 60 * 1000;
}

const missing = events
  .filter(isDueForResult)
  .filter(event => !event.score || !event.outcomeText || !event.recapText || !event.sourceName || !event.sourceUrl || !event.sourceCheckedAt);

const summary = {
  checkedAt: now.toISOString(),
  dueEvents: events.filter(isDueForResult).length,
  missingResults: missing.map(event => ({ id: event.id, name: event.name, date: event.date, status: event.status || "unset" })),
};
console.log(JSON.stringify(summary, null, 2));
if (missing.length) {
  console.error(`Result completeness failed for ${missing.length} due card(s).`);
  process.exit(1);
}
console.log("Result completeness passed: every due card has a result and provenance.");
