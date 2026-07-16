const fs = require("fs");
const path = require("path");

const SPORT_KEYS = new Set([
  "wimbledon",
  "rugby",
  "fifa",
  "f1",
  "tdf",
  "nrl",
  "afl",
  "cricket",
  "nba",
  "masters",
  "lemans",
  "nfl",
  "ski",
]);

const ROUNDS = new Set(["all", "early", "knockout", "quarterfinal", "semifinal", "final"]);
const SOURCE_TYPES = new Set(["official", "broadcaster", "reputable", "personal-calendar"]);
const STANDARD_PRELOAD_DAYS = 92;
const MARQUEE_ANNUAL_MONTHS = 12;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n");
}

function isDate(value) {
  return typeof value === "string" && /^20\d{2}-[01]\d-[0-3]\d$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

function isTime(value) {
  if (typeof value !== "string" || !/^[0-2]\d:[0-5]\d$/.test(value)) return false;
  const [hours] = value.split(":").map(Number);
  return hours <= 23;
}

function isDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string" && value.toLowerCase() === "true") return true;
  if (typeof value === "string" && value.toLowerCase() === "false") return false;
  return value;
}

function normalizeCopyReview(value) {
  if (value === undefined || value === null) return undefined;
  const review = {
    reviewRequired: normalizeBoolean(value.reviewRequired),
    reviewComplete: normalizeBoolean(value.reviewComplete),
  };
  ["reviewer", "note", "overrideSource"].forEach(field => {
    if (value[field] !== undefined && value[field] !== null && String(value[field]).trim()) {
      review[field] = String(value[field]).trim();
    }
  });
  return review;
}

function ensureEventDefaults(event, index) {
  const id = normalizeId(event.id || event.eventId || event.name || "event-" + index);
  const copyReview = normalizeCopyReview(event.copyReview);
  return {
    ...event,
    id,
    eventId: normalizeId(event.eventId || id),
    displayTitleCompact: event.displayTitleCompact || event.name,
    broadcastOptions: event.broadcastOptions || [event.broadcaster].filter(Boolean),
    venue: event.venue ?? null,
    liveWindow: Number(event.liveWindow || event.calendarTemplate?.durationHours || 3),
    round: event.round || "all",
    narrativeType: event.narrativeType || event.round || "all",
    expected: Number(event.expected),
    replayEligible: event.replayEligible ?? Number(event.expected) >= 7,
    highlightEligible: event.highlightEligible ?? Number(event.expected) >= 6,
    briefingEligible: event.briefingEligible ?? Number(event.expected) >= 7,
    catchupEligible: event.catchupEligible ?? Number(event.expected) >= 7,
    ...(copyReview ? { copyReview } : {}),
  };
}

function validateFeed(feed) {
  const errors = [];
  if (!feed || typeof feed !== "object" || Array.isArray(feed)) {
    return ["Feed must be a JSON object."];
  }
  if (feed.schemaVersion !== "events.v1") errors.push("schemaVersion must be events.v1.");
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(feed.version || "")) errors.push("version must be a lowercase slug.");
  if (!isDateTime(feed.publishedAt)) errors.push("publishedAt must be an ISO date-time string.");
  if (!Array.isArray(feed.events) || feed.events.length === 0) errors.push("events must be a non-empty array.");

  const ids = new Set();
  const eventIds = new Set();
  (feed.events || []).forEach((event, index) => {
    const prefix = `events[${index}]`;
    const required = ["id", "eventId", "sport", "key", "name", "displayTitleCompact", "date", "time", "broadcaster", "expected", "liveWindow", "selectedSentence", "fullSpiel", "sourceName", "sourceUrl", "sourceCheckedAt"];
    required.forEach(field => {
      if (event[field] === undefined || event[field] === null || event[field] === "") errors.push(`${prefix}.${field} is required.`);
    });
    if (!SPORT_KEYS.has(event.key)) errors.push(`${prefix}.key is not a supported sport key: ${event.key}`);
    if (!isDate(event.date)) errors.push(`${prefix}.date must be YYYY-MM-DD.`);
    if (!isTime(event.time)) errors.push(`${prefix}.time must be HH:MM Sydney time.`);
    if (event.startTimeUtc !== undefined && event.startTimeUtc !== null && !isDateTime(event.startTimeUtc)) errors.push(`${prefix}.startTimeUtc must be ISO date-time if present.`);
    if (event.endTimeUtc !== undefined && event.endTimeUtc !== null && !isDateTime(event.endTimeUtc)) errors.push(`${prefix}.endTimeUtc must be ISO date-time if present.`);
    if (!Number.isFinite(Number(event.expected)) || Number(event.expected) < 1 || Number(event.expected) > 10) errors.push(`${prefix}.expected must be 1-10.`);
    if (!Number.isFinite(Number(event.liveWindow)) || Number(event.liveWindow) <= 0 || Number(event.liveWindow) > 24) errors.push(`${prefix}.liveWindow must be > 0 and <= 24.`);
    if (event.round && !ROUNDS.has(event.round)) errors.push(`${prefix}.round must be one of ${Array.from(ROUNDS).join(", ")}.`);
    if (String(event.displayTitleCompact || "").length > 80) errors.push(`${prefix}.displayTitleCompact must be 80 chars or fewer.`);
    if (String(event.selectedSentence || "").length > 180) errors.push(`${prefix}.selectedSentence must be 180 chars or fewer.`);
    if (String(event.fullSpiel || "").length > 700) errors.push(`${prefix}.fullSpiel must be 700 chars or fewer.`);
    if (!/^(https?|calendar):\/\//.test(event.sourceUrl || "")) errors.push(`${prefix}.sourceUrl must be an http(s) or calendar URL.`);
    if (!isDateTime(event.sourceCheckedAt)) errors.push(`${prefix}.sourceCheckedAt must be an ISO date-time string.`);
    if (event.sourceType !== undefined && !SOURCE_TYPES.has(event.sourceType)) errors.push(`${prefix}.sourceType is unsupported.`);
    if (event.customClassification !== undefined) {
      const classification = event.customClassification;
      if (!classification || typeof classification !== "object" || Array.isArray(classification)) {
        errors.push(`${prefix}.customClassification must be an object if present.`);
      } else {
        ["schemaVersion", "calendarName", "sportRule", "eventRule"].forEach(field => {
          if (!String(classification[field] || "").trim()) errors.push(`${prefix}.customClassification.${field} is required.`);
        });
        if (classification.schemaVersion && classification.schemaVersion !== "calendar-events.v1") errors.push(`${prefix}.customClassification.schemaVersion must be calendar-events.v1.`);
      }
      if (event.sourceType !== "personal-calendar") errors.push(`${prefix}.customClassification requires sourceType personal-calendar.`);
    }
    if (event.copyReview !== undefined) {
      if (!event.copyReview || typeof event.copyReview !== "object" || Array.isArray(event.copyReview)) {
        errors.push(`${prefix}.copyReview must be an object if present.`);
      } else {
        if (typeof event.copyReview.reviewRequired !== "boolean") errors.push(`${prefix}.copyReview.reviewRequired must be boolean.`);
        if (typeof event.copyReview.reviewComplete !== "boolean") errors.push(`${prefix}.copyReview.reviewComplete must be boolean.`);
        ["reviewer", "note", "overrideSource"].forEach(field => {
          if (event.copyReview[field] !== undefined && (typeof event.copyReview[field] !== "string" || !event.copyReview[field].trim())) {
            errors.push(`${prefix}.copyReview.${field} must be a non-empty string if present.`);
          }
        });
        if (event.copyReview.reviewComplete && event.copyReview.reviewRequired && !event.copyReview.reviewer && !event.copyReview.note && !event.copyReview.overrideSource) {
          errors.push(`${prefix}.copyReview should include reviewer, note, or overrideSource when required review is complete.`);
        }
      }
    }
    if (ids.has(event.id)) errors.push(`${prefix}.id duplicates ${event.id}.`);
    if (eventIds.has(event.eventId)) errors.push(`${prefix}.eventId duplicates ${event.eventId}.`);
    ids.add(event.id);
    eventIds.add(event.eventId);
  });

  return errors;
}

function normalizeFeed(feed) {
  return {
    ...feed,
    schemaVersion: "events.v1",
    events: feed.events.map(ensureEventDefaults),
  };
}

const IDENTITY_STOP_WORDS = new Set([
  "australia", "australian", "match", "game", "round", "stage", "day", "tour", "home", "away",
  "first", "second", "third", "fourth", "fifth", "one", "two", "three", "four", "five",
  "international", "finals", "final", "semi", "semifinal", "quarterfinal", "preliminary",
  "test", "race", "qualifying", "versus", "world", "cup", "men", "women",
]);

function identityTokens(event) {
  return new Set(String(event.name || "")
    .toLowerCase()
    .replace(/new\s+zealand/g, "newzealand")
    .replace(/\bnz\b/g, "newzealand")
    .replace(/\bvs?\.?\b/g, "versus")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 2 && !IDENTITY_STOP_WORDS.has(token)));
}

function daysApart(first, second) {
  const firstTime = Date.parse(`${first.date}T00:00:00Z`);
  const secondTime = Date.parse(`${second.date}T00:00:00Z`);
  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) return Infinity;
  return Math.abs(firstTime - secondTime) / (24 * 3600 * 1000);
}

function isSupersededEvent(retained, incoming) {
  if (retained.id === incoming.id || retained.eventId === incoming.eventId) return true;
  if (retained.key !== incoming.key || daysApart(retained, incoming) > 7) return false;
  if (incoming.sourceName === "Bundled Sportscal seed data") return false;
  const retainedTokens = identityTokens(retained);
  const incomingTokens = identityTokens(incoming);
  let sharedTokens = 0;
  retainedTokens.forEach(token => {
    if (incomingTokens.has(token)) sharedTokens += 1;
  });
  return sharedTokens >= 2;
}

function mergeFeedEvents(primaryEvents, retainedEvents) {
  const originalRetained = [...retainedEvents];
  const retained = [...retainedEvents];
  primaryEvents.forEach(incoming => {
    const matchingIndexes = retained
      .map((event, index) => isSupersededEvent(event, incoming) ? index : -1)
      .filter(index => index >= 0);
    if (matchingIndexes.length) {
      matchingIndexes.reverse().forEach(index => retained.splice(index, 1));
    }
  });
  const events = [...retained, ...primaryEvents]
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  const added = primaryEvents.filter(incoming => !originalRetained.some(event => isSupersededEvent(event, incoming))).length;
  return { events, added, overridden: originalRetained.length - retained.length, preserved: retained.length };
}

function activeSportsFor(feed) {
  return Array.from(new Set(feed.events.map(event => event.key))).filter(key => SPORT_KEYS.has(key));
}

function dateOnly(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function daysBetween(startDate, endDate) {
  const start = Date.parse(startDate + "T00:00:00Z");
  const end = Date.parse(endDate + "T00:00:00Z");
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / (24 * 3600 * 1000));
}

function summarizeFeedHorizon(feed, options = {}) {
  const events = Array.isArray(feed) ? feed : feed.events || [];
  const dates = events.map(event => event.date).filter(isDate).sort();
  const basisDate = options.basisDate || dateOnly(feed.publishedAt) || new Date().toISOString().slice(0, 10);
  const lastEventDate = dates[dates.length - 1] || null;
  const firstEventDate = dates[0] || null;
  const sports = {};
  events.forEach(event => {
    if (!SPORT_KEYS.has(event.key) || !isDate(event.date)) return;
    if (!sports[event.key]) {
      sports[event.key] = {
        count: 0,
        firstEventDate: event.date,
        lastEventDate: event.date,
      };
    }
    sports[event.key].count += 1;
    if (event.date < sports[event.key].firstEventDate) sports[event.key].firstEventDate = event.date;
    if (event.date > sports[event.key].lastEventDate) sports[event.key].lastEventDate = event.date;
  });
  const daysAhead = lastEventDate ? daysBetween(basisDate, lastEventDate) : null;
  return {
    basisDate,
    target: {
      standardPreloadDays: STANDARD_PRELOAD_DAYS,
      marqueeAnnualMonths: MARQUEE_ANNUAL_MONTHS,
    },
    status: "scaffolded",
    firstEventDate,
    lastEventDate,
    daysAhead,
    coversStandardPreloadWindow: daysAhead !== null && daysAhead >= STANDARD_PRELOAD_DAYS,
    sports,
  };
}

module.exports = {
  activeSportsFor,
  mergeFeedEvents,
  normalizeFeed,
  readJson,
  summarizeFeedHorizon,
  validateFeed,
  writeJson,
};
