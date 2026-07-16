#!/usr/bin/env node

const fs = require("fs");
const {
  mergeFeedEvents,
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const outputPath = process.argv[3] || "feeds/incoming/events.restored.json";
const html = fs.readFileSync("index.html", "utf8");
const match = html.match(/const EVENTS = (\[[\s\S]*?\]);\n\nconst SPORT_META/);

if (!match) throw new Error("Bundled EVENTS block not found in index.html.");

const bundled = JSON.parse(match[1])
  .filter(event => Number(event.expected) >= 5)
  .map((event, index) => ({
    ...event,
    eventId: event.eventId || event.id || `bundled-${index}`,
    displayTitleCompact: event.displayTitleCompact || event.name,
    selectedSentence: event.selectedSentence || "Preserved from the existing Sportscal card set until a newer source supersedes it.",
    fullSpiel: event.fullSpiel || `${event.name} remains available from the existing Sportscal card set. Its schedule details are retained until a newer, matching source record replaces them.`,
    sourceName: event.sourceName || "Bundled Sportscal seed data",
    sourceUrl: event.sourceUrl || "https://github.com/hartican/sportscal",
    sourceCheckedAt: event.sourceCheckedAt || "2026-07-10T08:30:00+10:00",
  }));

const incoming = normalizeFeed(readJson(inputPath));
const incomingErrors = validateFeed(incoming);
if (incomingErrors.length) throw new Error(`Incoming feed is invalid:\n${incomingErrors.join("\n")}`);

const merged = mergeFeedEvents(incoming.events, bundled);
const output = normalizeFeed({
  ...incoming,
  version: "population-feed-2026-07-16-preserved",
  publishedAt: "2026-07-16T09:00:00+10:00",
  sourceNote: `${incoming.sourceNote} Existing bundled cards are preserved; matching source-backed records supersede them.`,
  events: merged.events,
});
const errors = validateFeed(output);
if (errors.length) throw new Error(`Restored feed is invalid:\n${errors.join("\n")}`);

writeJson(outputPath, output);
console.log(`Restored ${merged.preserved} bundled cards and retained ${incoming.events.length} incoming cards.`);
console.log(`Source-backed replacements: ${merged.overridden}. Output: ${outputPath}`);
