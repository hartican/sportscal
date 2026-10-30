#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const {
  activeSportsFor,
  mergeFeedEvents,
  normalizeFeed,
  protectVerifiedEventFacts,
  readJson,
  summarizeFeedHorizon,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const coverageArgs=process.argv.slice(2).filter(arg=>arg==='--coverage-sport'||arg.startsWith('--coverage-sport='));
if(coverageArgs.length&&(coverageArgs.length!==1||coverageArgs[0]!=='--coverage-sport=rugby-union'))throw Error('Unsupported scoped Feed publication');
const coverageSport=coverageArgs.length?'rugby-union':null,coverageScope=require('./lib/live-coverage-scope');
const args = process.argv.slice(2).filter(arg => !["--replace","--preserve-known",...coverageArgs].includes(arg));
const replaceExisting = process.argv.includes("--replace");
const preserveKnown = process.argv.includes("--preserve-known");
const inputPath = args[0] || "feeds/incoming/events.json";
const eventsOutPath = args[1] || "data/events.json";
const metaOutPath = args[2] || "data/feed-meta.json";
const bundleOutPath = args[3] || "data/events.js";

if(coverageSport&&(!preserveKnown||replaceExisting||args.length!==4||path.resolve(inputPath)!==path.resolve(eventsOutPath)))throw Error('Scoped Feed publication requires the retained published surface');
const identityForScope=require('../config/fixture-identity'),codeForScope=e=>identityForScope.sportKey(e)==='rugby'?'rugby-union':identityForScope.sportKey(e);
const originalInput=readJson(inputPath);
const normalizeInput=value=>normalizeFeed(coverageSport?{...value,events:value.events.filter(e=>codeForScope(e)===coverageSport)}:value);
const feed = normalizeInput(originalInput);
const eplIdentities=require('../lib/epl-provider-identities');
feed.events=eplIdentities.reconcile(feed.events);
const errors = validateFeed(feed);

if (errors.length) {
  console.error(`Refusing to publish invalid feed from ${inputPath}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

let publishedFeed = feed;
let mergeSummary = null;
if (replaceExisting) {
  try {
    const existing = normalizeInput(readJson(eventsOutPath));
    existing.events=eplIdentities.reconcile(existing.events);
    const existingErrors = validateFeed(existing);
    if (existingErrors.length) throw new Error(existingErrors.join("; "));
    publishedFeed = { ...feed, events: protectVerifiedEventFacts(feed.events, existing.events) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
} else {
  try {
    const existing = normalizeInput(readJson(eventsOutPath));
    existing.events=eplIdentities.reconcile(existing.events);
    const existingErrors = validateFeed(existing);
    if (existingErrors.length) {
      throw new Error(existingErrors.join("; "));
    }
    if (preserveKnown){
      const retained = require("../lib/fixture-snapshot").mergeFixtureSnapshot(existing.events,protectVerifiedEventFacts(feed.events,existing.events));
      mergeSummary = {...retained,preserved:retained.retained,overridden:retained.updated,added:retained.events.length-existing.events.length};
    } else mergeSummary = mergeFeedEvents(feed.events, existing.events);
    publishedFeed = { ...feed, events: mergeSummary.events };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const identity=require('../config/fixture-identity'),scope=require('../config/cricket-coverage'),protectedIds=new Set(require('../data/canonical/cricket-retention.v1.json').fixtureIds);
publishedFeed.events=identity.mergeOverlays([],publishedFeed.events).map(e=>{if(Array.isArray(e.participants)&&!e.participants.length){const {participants,...withoutEmptyParticipants}=e;return withoutEmptyParticipants;}return e;}).filter(e=>scope.allowed(e)||[e.id,...(e.sourceEventIds||[])].some(id=>protectedIds.has(id)));
publishedFeed.events=publishedFeed.events.map(require('./lib/fixture-competition-context').createResolver());
if(!coverageSport)publishedFeed.events=publishedFeed.events.map(require('./lib/cricket-reviewed-context').createResolver());
const publicationStamp = new Date().toISOString();
publishedFeed.events=publishedFeed.events.map(require('../lib/reviewed-au-viewing').reviewedAuViewing);
// A reviewed official correction keeps the original calendar import provenance
// separately. Merging the retained seed must not restore its obsolete source kind.
publishedFeed.events=publishedFeed.events.map(event=>{
  if(event.sourceType!=='personal-calendar' && event.importedCalendarClassification && JSON.stringify(event.customClassification)===JSON.stringify(event.importedCalendarClassification)){
    const {customClassification,...corrected}=event;return corrected;
  }
  return event;
});
const versionBase = String(publishedFeed.version || "feed").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "feed";
function finishEditorial(events){
 const paused=events.map(require('../config/coverage-pauses').apply);
 return require('./lib/editorial-publication').reconcileFullPreviews(paused,readJson('data/editorial-knowledge.v1.json'));
}
if(coverageSport)publishedFeed.events=coverageScope.retainOutsideScope(originalInput.events,finishEditorial(publishedFeed.events),coverageSport,codeForScope);
publishedFeed = {
  ...publishedFeed,
  version: `${versionBase}-${publicationStamp.replace(/[^0-9]/g, "")}`,
  publishedAt: publicationStamp,
};

const publishedErrors = validateFeed(publishedFeed);
if (publishedErrors.length) {
  console.error("Refusing to publish an invalid merged feed:");
  publishedErrors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

let meta = {
  version: "unpublished",
  schemaVersion: "events.v1",
  publishedAt: publicationStamp,
  eventsPath: "/data/events.json",
  activeSports: [],
  briefingWeekKey: "manual",
  usesBundledEvents: false,
};

try {
  meta = readJson(metaOutPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const nextMeta = {
  ...meta,
  version: publishedFeed.version,
  schemaVersion: publishedFeed.schemaVersion,
  publishedAt: publishedFeed.publishedAt,
  eventsPath: "/" + path.relative(process.cwd(), eventsOutPath).replace(/\\/g, "/"),
  activeSports: activeSportsFor(publishedFeed),
  feedHorizon: summarizeFeedHorizon(publishedFeed),
  usesBundledEvents: false,
};

// Canonical fixture/evidence assemblers cannot downgrade a researched full
// preview to a retained two-section seed. Keep scores and source clocks intact.
if(!coverageSport)publishedFeed.events=finishEditorial(publishedFeed.events);
writeJson(eventsOutPath, publishedFeed);
writeJson(metaOutPath, nextMeta);
fs.mkdirSync(path.dirname(bundleOutPath), { recursive: true });
fs.writeFileSync(
  bundleOutPath,
  `/* Generated by scripts/publish-feed.js. Do not edit directly. */\nglobalThis.NOTHINGSPORTS_EVENTS = ${JSON.stringify(publishedFeed.events, null, 2)};\n`
);

console.log(`Published ${publishedFeed.events.length} events from ${inputPath}`);
if (mergeSummary) console.log(`Preservation merge: ${mergeSummary.preserved} retained, ${mergeSummary.overridden} superseded, ${mergeSummary.added} added.`);
console.log(`Updated ${eventsOutPath}`);
console.log(`Updated ${metaOutPath}`);
console.log(`Updated ${bundleOutPath}`);
console.log(`Feed version: ${publishedFeed.version}`);
