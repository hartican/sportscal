#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "data/events.json");
const OUTPUT_DIR = path.join(ROOT, "data/feed");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const PAGE_SIZE = 20;
const RETENTION_DAYS = 14;

function stableEventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function sydneyDateKey(value){
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function retainedEvents(source){
  const referenceKey = sydneyDateKey(source.publishedAt || new Date()) || new Date().toISOString().slice(0, 10);
  const cutoff = new Date(`${referenceKey}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return source.events
    .filter(event => !event?.date || String(event.date) >= cutoffKey)
    .sort((first, second) => {
      const firstDate = String(first.date || "9999-12-31");
      const secondDate = String(second.date || "9999-12-31");
      const firstUpcoming = firstDate >= referenceKey;
      const secondUpcoming = secondDate >= referenceKey;
      if (firstUpcoming !== secondUpcoming) return firstUpcoming ? -1 : 1;
      const dateOrder = firstUpcoming
        ? firstDate.localeCompare(secondDate)
        : secondDate.localeCompare(firstDate);
      return dateOrder
        || String(first.time || "23:59").localeCompare(String(second.time || "23:59"))
        || stableEventId(first).localeCompare(stableEventId(second));
    });
}

function buildPagedFeed(source){
  if (!source || !Array.isArray(source.events)) throw new Error("Published events.json is invalid");
  const publishedEvents = retainedEvents(source);
  const pages = [];
  for (let offset = 0; offset < publishedEvents.length; offset += PAGE_SIZE){
    const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
    const fileName = `page-${String(pageNumber).padStart(3, "0")}.json`;
    const events = publishedEvents.slice(offset, offset + PAGE_SIZE);
    pages.push({
      index: pageNumber - 1,
      path: `data/feed/${fileName}`,
      eventCount: events.length,
      firstEventId: stableEventId(events[0]),
      lastEventId: stableEventId(events.at(-1)),
      payload: {
        schemaVersion: "public-feed-page.v2",
        sourceVersion: source.version || "",
        sourcePublishedAt: source.publishedAt || null,
        page: pageNumber - 1,
        events,
      },
    });
  }
  return {
    schemaVersion: "public-feed.v2",
    sourceVersion: source.version || "",
    sourcePublishedAt: source.publishedAt || null,
    pageSize: PAGE_SIZE,
    retentionDays: RETENTION_DAYS,
    inputEventCount: source.events.length,
    eventCount: publishedEvents.length,
    pages,
  };
}

function writePagedFeed(document){
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const expectedFiles = new Set(document.pages.map(page => path.basename(page.path)));
  fs.readdirSync(OUTPUT_DIR).filter(name => /^page-\d+\.json$/.test(name) && !expectedFiles.has(name))
    .forEach(name => fs.unlinkSync(path.join(OUTPUT_DIR, name)));
  document.pages.forEach(page => {
    fs.writeFileSync(path.join(ROOT, page.path), `${JSON.stringify(page.payload)}\n`);
  });
  const manifest = {
    schemaVersion: document.schemaVersion,
    sourceVersion: document.sourceVersion,
    sourcePublishedAt: document.sourcePublishedAt,
    pageSize: document.pageSize,
    retentionDays: document.retentionDays,
    inputEventCount: document.inputEventCount,
    eventCount: document.eventCount,
    pages: document.pages.map(({ payload: _payload, ...page }) => page),
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function main(){
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
  const manifest = writePagedFeed(buildPagedFeed(source));
  console.log(`Paged feed built: ${manifest.eventCount} events across ${manifest.pages.length} pages of at most ${manifest.pageSize}.`);
}

if (require.main === module) main();

module.exports = { PAGE_SIZE, RETENTION_DAYS, buildPagedFeed, retainedEvents, writePagedFeed };
