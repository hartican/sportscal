const fs = require("fs");
const path = require("path");
const { spoilerContractIssues } = require("./storyline-card-rules");
const canonicalSportsTaxonomy = require(path.resolve(__dirname, "../../config/canonical-sports-taxonomy.js"));
const sourceTrust = require(path.resolve(__dirname, "../../config/source-trust.js"));

const LEGACY_SPORT_KEYS = new Set([
  "wimbledon",
  "rugby",
  "fifa",
  "f1",
  "rally",
  "goodwood",
  "cycling",
  "tdf",
  "skateboard",
  "downhill-mtb",
  "wsl",
  "big-wave",
  "nrl",
  "afl",
  "cricket",
  "nba",
  "masters",
  "telemark",
  "lemans",
  "nfl",
  "ski",
  "cwg",
  "premier-league",
]);
const SPORT_KEYS = new Set(LEGACY_SPORT_KEYS);

function mergeCanonicalSportKeys() {
  if (!canonicalSportsTaxonomy?.sportDomains) return;
  canonicalSportsTaxonomy.sportDomains.forEach(domain => {
    if (domain?.slug) SPORT_KEYS.add(domain.slug);
  });
  canonicalSportsTaxonomy.specialEventDomains?.forEach(domain => {
    (domain?.canonicalSportKeys || []).forEach(key => SPORT_KEYS.add(key));
  });
}

mergeCanonicalSportKeys();
const SPORT_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const ROUNDS = new Set(["all", "early", "knockout", "quarterfinal", "semifinal", "final"]);
const SOURCE_TYPES = new Set(["official", "broadcaster", "explicitly-permitted", "reputable", "scraped", "community", "personal-calendar"]);
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
    sourceTrust: sourceTrust.normaliseTrust(event.sourceTrust, event.sourceType),
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
    if (!SPORT_KEY_PATTERN.test(event.key)) errors.push(`${prefix}.key must be a lowercase key (lowercase slug with . _ -).`);
    if (!SPORT_KEYS.has(event.key)) errors.push(`${prefix}.key is not a supported sport key: ${event.key}`);
    if (event.commonwealthDiscipline !== undefined && (String(event.commonwealthDiscipline).trim().length < 2 || String(event.commonwealthDiscipline).length > 80)) errors.push(`${prefix}.commonwealthDiscipline must be 2-80 characters if present.`);
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
    if (event.sourceTrust !== undefined && !["verified", "unverified"].includes(event.sourceTrust)) errors.push(`${prefix}.sourceTrust must be verified or unverified if present.`);
    if (event.status !== undefined && !["upcoming", "completed"].includes(event.status)) errors.push(`${prefix}.status must be upcoming or completed.`);
    if (event.lastReviewedAt !== undefined && !isDateTime(event.lastReviewedAt)) errors.push(`${prefix}.lastReviewedAt must be an ISO date-time string.`);
    if (event.participants !== undefined && (!Array.isArray(event.participants) || event.participants.length < 2 || event.participants.some(participant => !participant || !String(participant.name || "").trim()))) {
      errors.push(`${prefix}.participants must contain at least two named participants if present.`);
    }
    if (event.consensusResult !== undefined && (!event.consensusResult || typeof event.consensusResult !== "object" || Array.isArray(event.consensusResult))) {
      errors.push(`${prefix}.consensusResult must be an object if present.`);
    }
    if (event.storyline !== undefined) {
      const storyline = event.storyline;
      if (!storyline || typeof storyline !== "object" || Array.isArray(storyline)) {
        errors.push(`${prefix}.storyline must be an object if present.`);
      } else {
        ["stakes", "intensity"].forEach(field => {
          if (storyline[field] !== undefined && (!Number.isInteger(storyline[field]) || storyline[field] < 1 || storyline[field] > 5)) errors.push(`${prefix}.storyline.${field} must be an integer from 1 to 5.`);
        });
        if (storyline.intensitySource !== undefined && !["computed", "manual"].includes(storyline.intensitySource)) errors.push(`${prefix}.storyline.intensitySource must be computed or manual.`);
        if (storyline.lastReviewedAt !== undefined && !isDateTime(storyline.lastReviewedAt)) errors.push(`${prefix}.storyline.lastReviewedAt must be an ISO date-time.`);
        ["expectedSpectacle", "actualSpectacle"].forEach(field => {
          if (storyline[field] !== undefined && (!Number.isFinite(Number(storyline[field])) || storyline[field] < 1 || storyline[field] > 10)) errors.push(`${prefix}.storyline.${field} must be a number from 1 to 10.`);
        });
        if (storyline.arcStage !== undefined && !["preview", "recap"].includes(storyline.arcStage)) errors.push(`${prefix}.storyline.arcStage must be preview or recap.`);
        ["hookSpoilerOff", "hookSpoilerOn", "synopsisSpoilerOff", "synopsisSpoilerOn"].forEach(field => {
          if (storyline[field] !== undefined && (!String(storyline[field]).trim() || String(storyline[field]).length > 700)) errors.push(`${prefix}.storyline.${field} must be a non-empty string of 700 characters or fewer.`);
        });
      }
    }
    if (event.editorialNarrative !== undefined) {
      const narrative = event.editorialNarrative;
      if (!narrative || typeof narrative !== "object" || Array.isArray(narrative)) {
        errors.push(`${prefix}.editorialNarrative must be an object if present.`);
      } else {
        if (!["editorial-narrative.v1", "editorial-narrative.v2", "editorial-narrative.v3"].includes(narrative.schemaVersion)) errors.push(`${prefix}.editorialNarrative.schemaVersion must be editorial-narrative.v1, editorial-narrative.v2 or editorial-narrative.v3.`);
        if (!String(narrative.projectionId || "").trim()) errors.push(`${prefix}.editorialNarrative.projectionId is required.`);
        if (!["standard", "featured", "marquee"].includes(narrative.researchTier)) errors.push(`${prefix}.editorialNarrative.researchTier is unsupported.`);
        if (!String(narrative.hook || "").trim() || String(narrative.hook || "").length > 180) errors.push(`${prefix}.editorialNarrative.hook must be a non-empty string of 180 characters or fewer.`);
        if (["editorial-narrative.v2", "editorial-narrative.v3"].includes(narrative.schemaVersion) && (String(narrative.synopsis || "").trim().length < 80 || String(narrative.synopsis || "").length > 700)) errors.push(`${prefix}.editorialNarrative.synopsis must be 80-700 characters for v2/v3 projections.`);
        if (narrative.synopsis !== undefined && (!String(narrative.synopsis || "").trim() || String(narrative.synopsis || "").length > 700)) errors.push(`${prefix}.editorialNarrative.synopsis must be a non-empty string of 700 characters or fewer when present.`);
        [["threadIds", 1], ["factIds", 1], ["sourceIds", 1], ["dimensions", 1]].forEach(([field, minimum]) => {
          if (!Array.isArray(narrative[field]) || narrative[field].filter(Boolean).length < minimum || new Set(narrative[field]).size !== narrative[field].length) errors.push(`${prefix}.editorialNarrative.${field} must contain unique values.`);
        });
        if (!isDateTime(narrative.researchedAt)) errors.push(`${prefix}.editorialNarrative.researchedAt must be an ISO date-time.`);
        if (narrative.refreshAfter !== undefined && narrative.refreshAfter !== null && !isDateTime(narrative.refreshAfter)) errors.push(`${prefix}.editorialNarrative.refreshAfter must be null or an ISO date-time.`);
        if (!["researched", "source-derived-fallback"].includes(narrative.generationMode)) errors.push(`${prefix}.editorialNarrative.generationMode is unsupported.`);
        if (narrative.schemaVersion === "editorial-narrative.v3") {
          const consequence = narrative.consequence;
          if (!consequence || typeof consequence !== "object" || Array.isArray(consequence)) errors.push(`${prefix}.editorialNarrative.consequence is required for v3 projections.`);
          else {
            if (consequence.schemaVersion !== "editorial-consequence.v1") errors.push(`${prefix}.editorialNarrative.consequence.schemaVersion must be editorial-consequence.v1.`);
            if (!isDateTime(consequence.capturedAt)) errors.push(`${prefix}.editorialNarrative.consequence.capturedAt must be an ISO date-time.`);
            if (!Array.isArray(consequence.participants) || consequence.participants.length !== 2) errors.push(`${prefix}.editorialNarrative.consequence.participants must contain exactly two participants.`);
            else consequence.participants.forEach((participant, participantIndex) => {
              if (!String(participant?.subjectId || "").trim() || !String(participant?.name || "").trim() || String(participant?.need || "").trim().length < 12) errors.push(`${prefix}.editorialNarrative.consequence.participants[${participantIndex}] must include subjectId, name and need.`);
              ["win", "draw", "loss"].forEach(outcomeKey => {
                const outcome = participant?.outcomes?.[outcomeKey];
                if (!outcome || String(outcome.effect || "").trim().length < 12 || !["certain", "conditional"].includes(outcome.certainty)) errors.push(`${prefix}.editorialNarrative.consequence.participants[${participantIndex}].outcomes.${outcomeKey} is invalid.`);
                if (outcome?.certainty === "conditional" && String(outcome.dependsOn || "").trim().length < 12) errors.push(`${prefix}.editorialNarrative.consequence.participants[${participantIndex}].outcomes.${outcomeKey}.dependsOn is required for conditional effects.`);
              });
            });
            if (!/^If\b/i.test(String(consequence.previewSentence || "")) || String(consequence.previewSentence || "").length > 360) errors.push(`${prefix}.editorialNarrative.consequence.previewSentence must be an If-then sentence of 360 characters or fewer.`);
            if (!Array.isArray(consequence.factIds) || !consequence.factIds.length || !Array.isArray(consequence.sourceIds) || !consequence.sourceIds.length) errors.push(`${prefix}.editorialNarrative.consequence must retain fact and source provenance.`);
            if (consequence.spoilerOnSentence !== undefined && (!String(consequence.spoilerOnSentence || "").trim() || String(consequence.spoilerOnSentence).length > 700 || !isDateTime(consequence.resultCapturedAt) || !Array.isArray(consequence.resultFactIds) || !consequence.resultFactIds.length || !Array.isArray(consequence.resultSourceIds) || !consequence.resultSourceIds.length)) errors.push(`${prefix}.editorialNarrative.consequence result copy requires captured fact and source provenance.`);
          }
        }
        if (narrative.sentiment !== undefined) {
          const sentiment = narrative.sentiment;
          if (!sentiment || typeof sentiment !== "object" || Array.isArray(sentiment)) errors.push(`${prefix}.editorialNarrative.sentiment must be an object if present.`);
          else {
            if (!String(sentiment.sourceEventId || "").trim()) errors.push(`${prefix}.editorialNarrative.sentiment.sourceEventId is required.`);
            if (!Number.isFinite(Number(sentiment.impactScore)) || sentiment.impactScore < 1 || sentiment.impactScore > 5) errors.push(`${prefix}.editorialNarrative.sentiment.impactScore must be 1-5.`);
            if (!Number.isInteger(sentiment.uniqueContributorCount) || sentiment.uniqueContributorCount < 3) errors.push(`${prefix}.editorialNarrative.sentiment.uniqueContributorCount must be at least 3.`);
            if (!Array.isArray(sentiment.leadingTags) || sentiment.leadingTags.length > 3) errors.push(`${prefix}.editorialNarrative.sentiment.leadingTags must contain up to three labels.`);
            if (!isDateTime(sentiment.capturedAt) || !isDateTime(sentiment.expiresAt)) errors.push(`${prefix}.editorialNarrative.sentiment timestamps must be ISO date-times.`);
            if (!["source", "carried"].includes(sentiment.relationship)) errors.push(`${prefix}.editorialNarrative.sentiment.relationship is unsupported.`);
            if (/\b(?:userId|user_id|profileId|profile_id|persona|rawRatings|ratings|contributors)\b/.test(JSON.stringify(sentiment))) errors.push(`${prefix}.editorialNarrative.sentiment contains private or raw fields.`);
          }
        }
        if (narrative.researchTier === "marquee") {
          if ((narrative.factIds || []).length < 4) errors.push(`${prefix}.editorialNarrative.factIds needs four facts for marquee coverage.`);
          if ((narrative.sourceIds || []).length < 3) errors.push(`${prefix}.editorialNarrative.sourceIds needs three sources for marquee coverage.`);
          if ((narrative.dimensions || []).length < 3) errors.push(`${prefix}.editorialNarrative.dimensions needs three dimensions for marquee coverage.`);
        }
      }
    }
    if (event.editorialPreview !== undefined) {
      const preview = event.editorialPreview;
      if (!preview || typeof preview !== "object" || Array.isArray(preview)) {
        errors.push(`${prefix}.editorialPreview must be an object if present.`);
      } else {
        if (!['journalistic', 'research-required'].includes(preview.status)) errors.push(`${prefix}.editorialPreview.status must be journalistic or research-required.`);
        if (preview.status === 'journalistic') {
          if (!String(preview.angle || '').trim()) errors.push(`${prefix}.editorialPreview.angle is required for journalistic previews.`);
          if (!Array.isArray(preview.contextSignals) || preview.contextSignals.filter(Boolean).length < 2) errors.push(`${prefix}.editorialPreview.contextSignals must contain at least two values for journalistic previews.`);
          if (!String(preview.sourceName || '').trim()) errors.push(`${prefix}.editorialPreview.sourceName is required for journalistic previews.`);
          if (!/https:\/\//.test(preview.sourceUrl || '')) errors.push(`${prefix}.editorialPreview.sourceUrl must be an https URL for journalistic previews.`);
          if (!isDateTime(preview.sourceCheckedAt)) errors.push(`${prefix}.editorialPreview.sourceCheckedAt must be an ISO date-time for journalistic previews.`);
        }
        if (preview.needsPreviewRefresh !== undefined && typeof preview.needsPreviewRefresh !== 'boolean') errors.push(`${prefix}.editorialPreview.needsPreviewRefresh must be boolean if present.`);
      }
    }
    if (event.spoilerSafeTitle !== undefined && (!String(event.spoilerSafeTitle).trim() || String(event.spoilerSafeTitle).length > 80)) {
      errors.push(`${prefix}.spoilerSafeTitle must be 1-80 characters if present.`);
    }
    if (event.matchupParticipants !== undefined) {
      if (!Array.isArray(event.matchupParticipants) || event.matchupParticipants.length !== 2) {
        errors.push(`${prefix}.matchupParticipants must contain exactly two participants.`);
      } else {
        event.matchupParticipants.forEach((participant, participantIndex) => {
          if (!participant || typeof participant !== "object" || !String(participant.name || "").trim()) {
            errors.push(`${prefix}.matchupParticipants[${participantIndex}].name is required.`);
          }
          if (!String(participant?.sourceEventId || "").trim()) {
            errors.push(`${prefix}.matchupParticipants[${participantIndex}].sourceEventId is required.`);
          }
        });
      }
    }
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
    spoilerContractIssues(event).forEach(issue => errors.push(`${prefix} violates spoiler copy contract: ${issue}.`));
    if (ids.has(event.id)) errors.push(`${prefix}.id duplicates ${event.id}.`);
    if (eventIds.has(event.eventId)) errors.push(`${prefix}.eventId duplicates ${event.eventId}.`);
    ids.add(event.id);
    eventIds.add(event.eventId);
  });

  (feed.events || []).forEach((event, index) => {
    (event.matchupParticipants || []).forEach((participant, participantIndex) => {
      if (participant?.sourceEventId && !eventIds.has(participant.sourceEventId)) {
        errors.push(`events[${index}].matchupParticipants[${participantIndex}].sourceEventId does not exist: ${participant.sourceEventId}`);
      }
    });
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
  if (retained.canonicalEventId && incoming.canonicalEventId) return retained.canonicalEventId === incoming.canonicalEventId;
  if (retained.key !== incoming.key || daysApart(retained, incoming) > 1) return false;
  if (incoming.sourceName === "Bundled nothingsport seed data") return false;
  const retainedTokens = identityTokens(retained);
  const incomingTokens = identityTokens(incoming);
  let sharedTokens = 0;
  retainedTokens.forEach(token => {
    if (incomingTokens.has(token)) sharedTokens += 1;
  });
  return sharedTokens >= 2;
}

function protectVerifiedEventFacts(primaryEvents, retainedEvents) {
  return primaryEvents.map(incoming => {
    const verifiedMatch = retainedEvents.find(retained => (
      isSupersededEvent(retained, incoming)
      && sourceTrust.normaliseTrust(retained.sourceTrust, retained.sourceType) === "verified"
    ));
    if (!verifiedMatch || sourceTrust.normaliseTrust(incoming.sourceTrust, incoming.sourceType) !== "unverified") return incoming;
    return sourceTrust.mergeClaims(verifiedMatch, incoming);
  });
}

function mergeFeedEvents(primaryEvents, retainedEvents) {
  const protectedPrimaryEvents = protectVerifiedEventFacts(primaryEvents, retainedEvents);
  const originalRetained = [...retainedEvents];
  const retained = [...retainedEvents];
  protectedPrimaryEvents.forEach(incoming => {
    const matchingIndexes = retained
      .map((event, index) => isSupersededEvent(event, incoming) ? index : -1)
      .filter(index => index >= 0);
    if (matchingIndexes.length) {
      matchingIndexes.reverse().forEach(index => retained.splice(index, 1));
    }
  });
  const events = [...retained, ...protectedPrimaryEvents]
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  const added = protectedPrimaryEvents.filter(incoming => !originalRetained.some(event => isSupersededEvent(event, incoming))).length;
  return { events, added, overridden: originalRetained.length - retained.length, preserved: retained.length };
}

function activeSportsFor(feed) {
  return Array.from(new Set(feed.events.map(event => event.key)));
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
    if (!isDate(event.date)) return;
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
  protectVerifiedEventFacts,
  readJson,
  summarizeFeedHorizon,
  validateFeed,
  writeJson,
};
