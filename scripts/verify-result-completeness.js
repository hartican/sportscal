#!/usr/bin/env node

const fs = require("fs");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const feed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const events = Array.isArray(feed) ? feed : feed.events;
const now = new Date();

function expectedCloseAt(event) {
  const explicitEnd = event.endTimeUtc ? new Date(event.endTimeUtc) : null;
  if (explicitEnd && !Number.isNaN(explicitEnd.getTime())) return explicitEnd;
  if (!event.date || !event.time) return null;
  const start = new Date(`${event.date}T${event.time}:00+10:00`);
  if (Number.isNaN(start.getTime())) return null;
  const durationHours = Number(event.liveWindow);
  const expectedDurationMs = (Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 3) * 60 * 60 * 1000;
  return new Date(start.getTime() + expectedDurationMs);
}

function isDueForResult(event) {
  if (event.status === "completed") return true;
  const expectedClose = expectedCloseAt(event);
  return Boolean(expectedClose && now.getTime() >= expectedClose.getTime());
}

function resultSourceKind(event) {
  return event.sourceType === "reputable" ? "media-consensus" : (event.sourceType || "source-type-unspecified");
}

const dueEvents = events.filter(isDueForResult);

const missing = dueEvents
  .filter(event => !event.score || !event.outcomeText || !event.recapText || !event.sourceName || !event.sourceUrl || !event.sourceCheckedAt);

const summary = {
  checkedAt: now.toISOString(),
  dueEvents: dueEvents.length,
  resultsBySource: dueEvents.reduce((counts, event) => {
    const kind = resultSourceKind(event);
    counts[kind] = (counts[kind] || 0) + 1;
    return counts;
  }, {}),
  missingResults: missing.map(event => ({
    id: event.id,
    name: event.name,
    date: event.date,
    status: event.status || "unset",
    expectedCloseAt: expectedCloseAt(event)?.toISOString() || null,
  })),
};
console.log(JSON.stringify(summary, null, 2));
if (missing.length) {
  console.error(`Result completeness failed for ${missing.length} due card(s).`);
  process.exit(1);
}
console.log("Result completeness passed: every due card has a result and provenance.");
