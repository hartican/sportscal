#!/usr/bin/env node

const path = require("path");
const { readJson, writeJson } = require("./lib/feed-utils");
const { stakesFor, lifecycleFor } = require("./lib/storyline-card-rules");
const { previewState } = require("./lib/editorial-preview-quality");
const {
  buildStandingsIndex,
  resolveStandingsAwareOverride,
} = require("./lib/editorial-preview-standings");

const overridesPath = path.resolve(process.argv[2] || "feeds/editorial-preview-overrides.json");
const inputs = ["feeds/incoming/events.json", "data/events.json"];
const overrides = readJson(overridesPath);
const standingsIndex = buildStandingsIndex();

if (!overrides || overrides.schemaVersion !== "sportscal.editorial-previews.v1" || !overrides.events || typeof overrides.events !== "object") {
  throw new Error(`${overridesPath} must contain sportscal.editorial-previews.v1 with an events object.`);
}

const overrideIds = new Set(Object.keys(overrides.events));
const foundIds = new Set();

inputs.forEach(input => {
  const absolute = path.resolve(input);
  const feed = readJson(absolute);
  let applied = 0;
  let queued = 0;
  feed.events = feed.events.map(event => {
    const override = overrides.events[event.id] || overrides.events[event.eventId];
    if (override) {
      foundIds.add(event.id);
      const hasVerifiedResultOverride = override.status === "completed"
        && override.score
        && override.outcomeText
        && override.recapText
        && override.sourceName
        && override.sourceUrl
        && override.sourceCheckedAt;
      if (lifecycleFor(event) === "completed" && !hasVerifiedResultOverride) return event;
      applied += 1;
      return { ...event, ...resolveStandingsAwareOverride(event, override, standingsIndex) };
    }
    const status = lifecycleFor(event);
    const state = previewState({ ...event, status }, stakesFor(event));
    if (state !== "queued" || event.editorialPreview?.status === "journalistic") return event;
    queued += 1;
    return {
      ...event,
      editorialPreview: {
        status: "research-required",
        needsPreviewRefresh: true,
        editorialWindowDays: 10,
        note: "Replace generic schedule copy with current, source-backed pre-event commentary inside the editorial window.",
      },
    };
  });
  writeJson(absolute, feed);
  console.log(`Applied ${applied} editorial previews and queued ${queued} future cards in ${input}.`);
});

const missing = [...overrideIds].filter(id => !foundIds.has(id));
if (missing.length) {
  console.error(`Editorial overrides reference missing event ids: ${missing.join(", ")}`);
  process.exit(1);
}
