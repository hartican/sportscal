#!/usr/bin/env node

const path = require("path");
const {
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const SPORT_META = {
  wimbledon: { sport: "Tennis", label: "Tennis" },
  rugby: { sport: "Rugby Union", label: "Rugby Union" },
  fifa: { sport: "Football", label: "Football" },
  f1: { sport: "F1", label: "F1" },
  tdf: { sport: "Cycling", label: "Cycling" },
  nrl: { sport: "Rugby League", label: "Rugby League" },
  afl: { sport: "AFL", label: "AFL" },
  cricket: { sport: "Cricket", label: "Cricket" },
  nba: { sport: "NBA", label: "NBA" },
  masters: { sport: "Golf", label: "Golf" },
  lemans: { sport: "Le Mans", label: "Le Mans" },
  nfl: { sport: "NFL", label: "NFL" },
  ski: { sport: "Ski/Alpine", label: "Ski/Alpine" },
  cwg: { sport: "Commonwealth Games", label: "Commonwealth Games" },
};

// First match wins. Keep this list ordered and versioned: it is the deterministic
// fallback when a calendar record does not state sportKey explicitly.
const SPORT_RULES = [
  { id: "commonwealth-games", key: "cwg", pattern: /\bcommonwealth games?\b/i },
  { id: "afl.teams-or-league", key: "afl", pattern: /\b(afl|aussie rules|swans|gws|giants|collingwood|magpies|western bulldogs|carlton|richmond)\b/i },
  { id: "nrl.teams-or-league", key: "nrl", pattern: /\b(nrl|rugby league|raiders|rabbitohs|broncos|kangaroos|state of origin)\b/i },
  { id: "rugby.union", key: "rugby", pattern: /\b(rugby union|wallabies|brumbies|super rugby|bledisloe|six nations)\b/i },
  { id: "cricket", key: "cricket", pattern: /\b(cricket|test match|odi|one day international|t20)\b/i },
  { id: "tennis", key: "wimbledon", pattern: /\b(tennis|australian open|roland garros|french open|wimbledon|us open)\b/i },
  { id: "formula-one", key: "f1", pattern: /\b(formula 1|formula one|f1|grand prix)\b/i },
  { id: "cycling", key: "tdf", pattern: /\b(cycling|tour de france|giro d['’]italia|la vuelta|vuelta)\b/i },
  { id: "golf", key: "masters", pattern: /\b(golf|pga|lpga|masters tournament)\b/i },
  { id: "football", key: "fifa", pattern: /\b(football|soccer|fifa|world cup)\b/i },
  { id: "basketball", key: "nba", pattern: /\b(nba|basketball)\b/i },
  { id: "american-football", key: "nfl", pattern: /\b(nfl|american football|super bowl)\b/i },
  { id: "endurance-racing", key: "lemans", pattern: /\b(le mans|bathurst|supercars|endurance racing)\b/i },
  { id: "skiing", key: "ski", pattern: /\b(ski|skiing|snowboard|alpine)\b/i },
];

function classifyCommonwealthDiscipline(value) {
  const text = String(value || "");
  if (/\bathletics?|track and field\b/i.test(text)) return "athletics";
  if (/\bswimm?ing|aquatics?\b/i.test(text)) return "swimming";
  if (/\brugby sevens?|rugby 7s\b/i.test(text)) return "rugby-sevens";
  if (/\bnetball\b/i.test(text)) return "netball";
  if (/\bcricket\b/i.test(text)) return "cricket";
  if (/\bhockey\b/i.test(text)) return "hockey";
  if (/\bgymnastics?\b/i.test(text)) return "gymnastics";
  if (/\bcycling|bmx|mountain bike\b/i.test(text)) return "cycling";
  if (/\bboxing\b/i.test(text)) return "boxing";
  return "miscellaneous";
}

const EVENT_TYPE_RULES = [
  { id: "semifinal", value: "semifinal", pattern: /\b(semi[- ]?final|semi)\b/i },
  { id: "quarterfinal", value: "quarterfinal", pattern: /\b(quarter[- ]?final|qf)\b/i },
  { id: "final", value: "final", pattern: /\b(final|grand final|championship)\b/i },
  { id: "test", value: "test", pattern: /\btest\b/i },
  { id: "race", value: "race", pattern: /\b(race|grand prix)\b/i },
  { id: "fixture", value: "fixture", pattern: /\b(v |vs\.? |versus )\b/i },
];

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasTimezone(value) {
  return typeof value === "string" && /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
}

function isDateTime(value) {
  return hasTimezone(value) && !Number.isNaN(Date.parse(value));
}

function validateCalendarImport(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return ["Calendar import must be a JSON object."];
  if (payload.schemaVersion !== "calendar-events.v1") errors.push("schemaVersion must be calendar-events.v1.");
  if (!String(payload.calendarName || "").trim()) errors.push("calendarName is required.");
  if (!isDateTime(payload.importedAt)) errors.push("importedAt must be an ISO date-time with a timezone.");
  if (!Array.isArray(payload.events) || !payload.events.length) errors.push("events must be a non-empty array.");

  const ids = new Set();
  (payload.events || []).forEach((event, index) => {
    const prefix = `events[${index}]`;
    if (!String(event.calendarEventId || "").trim()) errors.push(`${prefix}.calendarEventId is required.`);
    if (!String(event.title || "").trim()) errors.push(`${prefix}.title is required.`);
    if (!isDateTime(event.startTime)) errors.push(`${prefix}.startTime must be an ISO date-time with a timezone.`);
    if (event.endTime !== undefined && !isDateTime(event.endTime)) errors.push(`${prefix}.endTime must be an ISO date-time with a timezone if present.`);
    if (event.endTime && event.startTime && Date.parse(event.endTime) <= Date.parse(event.startTime)) errors.push(`${prefix}.endTime must be after startTime.`);
    if (event.expected !== undefined && (!Number.isFinite(Number(event.expected)) || Number(event.expected) < 5 || Number(event.expected) > 10)) errors.push(`${prefix}.expected must be 5-10.`);
    if (event.sportKey !== undefined && !SPORT_META[event.sportKey]) errors.push(`${prefix}.sportKey is unsupported.`);
    if (event.commonwealthDiscipline !== undefined && (String(event.commonwealthDiscipline).trim().length < 2 || String(event.commonwealthDiscipline).length > 80)) errors.push(`${prefix}.commonwealthDiscipline must be 2-80 characters if present.`);
    if (event.eventType !== undefined && !["all", "fixture", "match", "test", "race", "knockout", "quarterfinal", "semifinal", "final"].includes(event.eventType)) errors.push(`${prefix}.eventType is unsupported.`);
    if (event.url !== undefined && !/^https?:\/\//.test(event.url)) errors.push(`${prefix}.url must be an http(s) URL if present.`);
    if (ids.has(event.calendarEventId)) errors.push(`${prefix}.calendarEventId duplicates ${event.calendarEventId}.`);
    ids.add(event.calendarEventId);
  });
  return errors;
}

function sydneyParts(iso) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function classifyCalendarEvent(event) {
  if (event.sportKey) {
    return { key: event.sportKey, sportRule: "explicit.sportKey", eventType: event.eventType || "all", eventRule: event.eventType ? "explicit.eventType" : "default.all" };
  }
  const text = [event.title, event.description, event.location].filter(Boolean).join(" ");
  const sportRule = SPORT_RULES.find(rule => rule.pattern.test(text));
  if (!sportRule) {
    throw new Error(`cannot classify \"${event.title}\"; set sportKey explicitly`);
  }
  const eventRule = event.eventType ? { id: "explicit.eventType", value: event.eventType } : EVENT_TYPE_RULES.find(rule => rule.pattern.test(text));
  return { key: sportRule.key, sportRule: sportRule.id, eventType: eventRule?.value || "all", eventRule: eventRule?.id || "default.all" };
}

function toImportedEvent(calendar, event) {
  const classification = classifyCalendarEvent(event);
  const start = new Date(event.startTime);
  const parts = sydneyParts(event.startTime);
  const duration = event.endTime ? (new Date(event.endTime).getTime() - start.getTime()) / 3600000 : 3;
  const calendarSlug = slug(calendar.calendarName) || "personal-calendar";
  const eventSlug = slug(event.calendarEventId);
  const title = String(event.title).trim();
  const sourceUrl = event.url || `calendar://${calendarSlug}/${eventSlug}`;
  const sport = SPORT_META[classification.key];
  const commonwealthDiscipline = classification.key === "cwg"
    ? classifyCommonwealthDiscipline(event.commonwealthDiscipline || [event.title, event.description, event.location].filter(Boolean).join(" "))
    : null;
  const round = ["knockout", "quarterfinal", "semifinal", "final"].includes(classification.eventType)
    ? classification.eventType
    : "all";
  return {
    id: `calendar-${calendarSlug}-${eventSlug}`,
    eventId: `calendar-${calendarSlug}-${eventSlug}`,
    sport: sport.sport,
    key: classification.key,
    ...(commonwealthDiscipline ? { commonwealthDiscipline } : {}),
    name: title,
    displayTitleCompact: title.slice(0, 80),
    date: parts.date,
    time: parts.time,
    startTimeUtc: start.toISOString(),
    ...(event.endTime ? { endTimeUtc: new Date(event.endTime).toISOString() } : {}),
    broadcaster: event.broadcaster || "Not specified",
    broadcastOptions: event.broadcaster ? [event.broadcaster] : [],
    expected: Number(event.expected ?? 6),
    venue: event.location || null,
    liveWindow: Math.max(1, Math.min(24, Number(duration.toFixed(1)))),
    round,
    narrativeType: classification.eventType,
    selectedSentence: `Personal calendar event, categorised as ${sport.label} by the ${classification.sportRule} rule.`,
    fullSpiel: `Imported from ${calendar.calendarName}. nothingSports categorised this event as ${sport.label} using the ${classification.sportRule} rule and assigned the ${classification.eventRule} event category.`,
    sourceName: `Imported from ${calendar.calendarName}`,
    sourceUrl,
    sourceCheckedAt: calendar.importedAt,
    sourceType: "personal-calendar",
    customClassification: {
      schemaVersion: "calendar-events.v1",
      calendarName: calendar.calendarName,
      sportRule: classification.sportRule,
      eventRule: classification.eventRule,
    },
  };
}

function importCalendarEvents(calendar, baseFeed) {
  const errors = validateCalendarImport(calendar);
  if (errors.length) throw new Error(errors.join("\n"));
  const imported = calendar.events.map(event => toImportedEvent(calendar, event));
  const calendarName = calendar.calendarName;
  const retained = baseFeed.events.filter(event => event.sourceType !== "personal-calendar" || event.customClassification?.calendarName !== calendarName);
  const events = [...retained, ...imported].sort((a, b) => `${a.date}T${a.time}${a.id}`.localeCompare(`${b.date}T${b.time}${b.id}`));
  const version = `${String(baseFeed.version).replace(/-calendar$/, "")}-calendar`;
  return {
    ...baseFeed,
    version,
    publishedAt: calendar.importedAt,
    sourceNote: `${baseFeed.sourceNote || "Event feed"} Personal calendar import from ${calendarName}; categories are deterministic rules or explicit overrides.`,
    events,
  };
}

function main() {
  const inputPath = process.argv[2] || "feeds/incoming/calendar-events.json";
  const basePath = process.argv[3] || "feeds/incoming/events.json";
  const outputPath = process.argv[4] || "feeds/incoming/events.with-calendar.json";
  const calendar = readJson(inputPath);
  const baseFeed = normalizeFeed(readJson(basePath));
  const baseErrors = validateFeed(baseFeed);
  if (baseErrors.length) throw new Error(`Base feed is invalid:\n${baseErrors.join("\n")}`);
  const merged = normalizeFeed(importCalendarEvents(calendar, baseFeed));
  const mergedErrors = validateFeed(merged);
  if (mergedErrors.length) throw new Error(`Imported feed is invalid:\n${mergedErrors.join("\n")}`);
  writeJson(outputPath, merged);
  const classificationSummary = merged.events
    .filter(event => event.sourceType === "personal-calendar" && event.customClassification?.calendarName === calendar.calendarName)
    .map(event => `${event.name} -> ${event.key}/${event.narrativeType}`);
  console.log(`Imported ${classificationSummary.length} personal calendar events into ${outputPath}`);
  classificationSummary.forEach(line => console.log(`- ${line}`));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Calendar import failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { classifyCalendarEvent, classifyCommonwealthDiscipline, importCalendarEvents, toImportedEvent, validateCalendarImport };
