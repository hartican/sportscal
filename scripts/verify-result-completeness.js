#!/usr/bin/env node

const fs = require("fs");
const calendar = require("../config/calendar-export");
const sydneyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone:"Australia/Sydney", year:"numeric", month:"2-digit", day:"2-digit",
  hour:"2-digit", minute:"2-digit", hourCycle:"h23",
});

function sydneyClock(date, time) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return null;
  const start = calendar.eventStart({date, time});
  if (!start || !Number.isFinite(+start)) return null;
  const key = value => {
    const parts = Object.fromEntries(sydneyFormatter.formatToParts(value).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const expected = `${date}T${time}`;
  // A normalized invalid date, a missing spring hour or a repeated autumn hour
  // cannot establish a unique deadline without a genuine UTC source instant.
  if (key(start) !== expected || [-1,1].some(hours => key(new Date(+start + hours * 3600000)) === expected)) return null;
  return start;
}

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const feed = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const events = Array.isArray(feed) ? feed : feed.events;
const now = process.env.RESULT_CHECK_NOW ? new Date(process.env.RESULT_CHECK_NOW) : new Date();
if (Number.isNaN(now.getTime())) throw new Error("RESULT_CHECK_NOW must be a valid date-time when provided.");

function expectedCloseAt(event) {
  const explicitEnd = event.endTimeUtc ? new Date(event.endTimeUtc) : null;
  if (explicitEnd && !Number.isNaN(explicitEnd.getTime())) return explicitEnd;
  if (event.dateOnly && event.endDate){
    const finalMinute = sydneyClock(event.endDate, "23:59");
    return finalMinute ? new Date(+finalMinute + 59000) : null;
  }
  const sourceStart = new Date(event.startTimeUtc || "");
  const start = Number.isFinite(+sourceStart) ? sourceStart : sydneyClock(event.date, event.time);
  if (!start) return null;
  const isMultiDayCricketTest = String(event.key || event.sport || "").toLowerCase() === "cricket"
    && String(event.narrativeType || "").toLowerCase() === "test";
  const durationHours = isMultiDayCricketTest ? 5 * 24 : Number(event.liveWindow);
  const expectedDurationMs = (Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 3) * 60 * 60 * 1000;
  return new Date(start.getTime() + expectedDurationMs);
}

function isDueForResult(event) {
  if(require("../config/coverage-pauses").womensT20(event))return false;
  if(!require("../config/follow-feed-policy").feedEligibleSession(event))return false;
  // Tournament overview cards represent an active event window, not one
  // scoreable contest. They remain preview coverage until a verified match or
  // final result is available, so a daily order-of-play timestamp is never a
  // result deadline.
  if (event.cardType === "tournament_overview") return false;
  if (event.cardKind === "event") return false;
  // Ticket release watches represent an alert window, not a scoreable sporting
  // contest. Their date can pass while the underlying future event remains
  // unresolved, so they must never be forced through result completeness.
  if (event.narrativeType === "ticket-sale-watch") return false;
  if (event.status === "completed") return true;
  const expectedClose = expectedCloseAt(event);
  return Boolean(expectedClose && now.getTime() >= expectedClose.getTime());
}

function resultSourceKind(event) {
  return event.sourceType === "reputable" ? "media-consensus" : (event.sourceType || "source-type-unspecified");
}

const dueEvents = events.filter(isDueForResult);

const missing = dueEvents
  .filter(event => event.resultStatus === "pending"
    ? !event.resultSourceUrl || !event.resultSourceCheckedAt
    : !event.score || !event.outcomeText || !event.recapText || !event.sourceName || !event.sourceUrl || !event.sourceCheckedAt);

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
