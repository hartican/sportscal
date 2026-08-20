#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const SPORT_HUBS = require("../config/sport-hubs");

const SCHEMA_VERSION = "pilot-readiness.v1";
const RESULT_GRACE_HOURS = 6;
const MAX_SNAPSHOT_AGE_HOURS = 15;
const SUPPORTED_SPORTS = Object.freeze(["afl", "nrl"]);

function parseTimestamp(value){
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function ageHours(timestamp, now){
  const parsed = parseTimestamp(timestamp);
  if (parsed === null) return null;
  return (now.getTime() - parsed) / 3_600_000;
}

function roundedHours(value){
  return value === null ? null : Math.round(value * 100) / 100;
}

function hasWatchDestination(fixture){
  return (Array.isArray(fixture?.broadcasters) ? fixture.broadcasters : []).some(provider => (
    provider?.live === true
    && typeof provider?.broadcasterName === "string"
    && provider.broadcasterName.trim()
    && /^https:\/\//.test(String(provider?.deeplinkUrl || ""))
  ));
}

function isUnresolvedOfficialPlaceholder(fixture, participantsById){
  if (!fixture || fixture.scheduleStatus !== "tbc" || fixture.startTimeUtc !== null) return false;
  if (fixture?.source?.sourceType !== "official") return false;
  if (!/^(?:\d+(?:st|nd|rd|th))\s+v\s+(?:\d+(?:st|nd|rd|th))$/i.test(String(fixture.displayName || "").trim())) return false;
  if (!/finals?/i.test(String(fixture.roundLabel || ""))) return false;
  const participants = [fixture.homeParticipantId, fixture.awayParticipantId]
    .map(participantId => participantsById.get(participantId));
  return participants.length === 2 && participants.every(participant => (
    participant
    && String(participant.teamCode || participant.shortName || "").trim().toUpperCase() === "TBD"
  ));
}

function fixtureIssues(fixture, participantIds){
  const issues = [];
  if (!fixture?.id) issues.push("missing canonical event ID");
  if (!fixture?.displayName) issues.push("missing display name");
  if (!Number.isInteger(Number(fixture?.roundNumber))) issues.push("missing round number");
  if (fixture?.scheduleStatus !== "confirmed") issues.push("start time is not confirmed");
  if (parseTimestamp(fixture?.startTimeUtc) === null) issues.push("missing or invalid start time");
  if (!fixture?.homeParticipantId || !participantIds.has(fixture.homeParticipantId)) issues.push("missing canonical home participant");
  if (!fixture?.awayParticipantId || !participantIds.has(fixture.awayParticipantId)) issues.push("missing canonical away participant");
  if (fixture?.homeParticipantId && fixture.homeParticipantId === fixture.awayParticipantId) issues.push("home and away participants are identical");
  if (!hasWatchDestination(fixture)) issues.push("missing live watch destination");
  return issues;
}

function completedResultIsPresent(fixture){
  const status = String(fixture?.status || fixture?.result?.status || "");
  if (["cancelled", "abandoned"].includes(status)) return true;
  return status === "completed"
    && fixture?.result?.status === "completed"
    && typeof fixture?.result?.scorelineText === "string"
    && fixture.result.scorelineText.trim().length > 0;
}

function buildReadinessReport({ canonical, feedMeta, now = new Date() } = {}){
  if (!canonical || !Array.isArray(canonical.events) || !Array.isArray(canonical.participants)){
    throw new TypeError("A canonical-sports bundle with events and participants is required.");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date.");

  const participantsById = new Map(canonical.participants
    .filter(participant => participant?.id)
    .map(participant => [participant.id, participant]));
  const participantIds = new Set(participantsById.keys());
  const issues = [];
  const sports = {};
  let supportedFixtureCount = 0;
  let completeFixtureCount = 0;
  let deferredPlaceholderCount = 0;
  const deferredPlaceholders = [];

  for (const sportKey of SUPPORTED_SPORTS){
    const fixtures = SPORT_HUBS.canonicalFixturesForSport(canonical, sportKey);
    const currentRound = SPORT_HUBS.currentRoundNumber(fixtures);
    const rounds = SPORT_HUBS.roundWindow(fixtures, currentRound, 2);
    const roundWindowFixtures = SPORT_HUBS.fixturesForRoundWindow(fixtures, currentRound, 2);
    const sportDeferredPlaceholders = roundWindowFixtures
      .filter(fixture => isUnresolvedOfficialPlaceholder(fixture, participantsById))
      .map(fixture => ({
        id: fixture.id || null,
        roundNumber: Number(fixture.roundNumber),
        displayName: fixture.displayName || null,
        reason: "awaiting participants and official scheduling",
      }));
    const deferredIds = new Set(sportDeferredPlaceholders.map(fixture => fixture.id));
    const windowFixtures = roundWindowFixtures.filter(fixture => !deferredIds.has(fixture.id));
    const views = SPORT_HUBS.buildFixtureViews(windowFixtures, {
      participants: canonical.participants,
      feedCards: [],
    });
    const fixtureReports = windowFixtures.map(fixture => {
      const problems = fixtureIssues(fixture, participantIds);
      const view = views.find(candidate => candidate.canonicalEvent?.id === fixture.id);
      if (!view) problems.push("cannot render through the sport-hub canonical view");
      else{
        if (view.event.name !== fixture.displayName) problems.push("rendered title differs from canonical truth");
        if (view.event.startTimeUtc !== fixture.startTimeUtc) problems.push("rendered start time differs from canonical truth");
        if (!view.liveProviders.length) problems.push("rendered row has no live provider");
      }
      if (problems.length) issues.push(`${sportKey.toUpperCase()} ${fixture.id || "unknown fixture"}: ${problems.join("; ")}`);
      return {
        id: fixture.id || null,
        roundNumber: Number(fixture.roundNumber),
        complete: problems.length === 0,
        issues: problems,
      };
    });
    const complete = fixtureReports.filter(fixture => fixture.complete).length;
    supportedFixtureCount += fixtureReports.length;
    completeFixtureCount += complete;
    deferredPlaceholderCount += sportDeferredPlaceholders.length;
    deferredPlaceholders.push(...sportDeferredPlaceholders.map(fixture => ({ sport: sportKey, ...fixture })));
    sports[sportKey] = {
      currentRound,
      roundNumbers: rounds.map(round => round.roundNumber),
      fixtureCount: fixtureReports.length,
      completeFixtureCount: complete,
      coveragePercent: fixtureReports.length ? Math.round(complete * 10_000 / fixtureReports.length) / 100 : 0,
      deferredPlaceholderCount: sportDeferredPlaceholders.length,
      deferredPlaceholders: sportDeferredPlaceholders,
      fixtures: fixtureReports,
    };
    if (!fixtureReports.length) issues.push(`${sportKey.toUpperCase()} has no current/next-round fixture window.`);
  }

  const resultCutoff = now.getTime() - RESULT_GRACE_HOURS * 3_600_000;
  const dueSupportedFixtures = canonical.events.filter(fixture => (
    SPORT_HUBS.isSupportedSport(fixture?.sportDomainId)
    && parseTimestamp(fixture?.startTimeUtc) !== null
    && parseTimestamp(fixture.startTimeUtc) <= resultCutoff
  ));
  const overdueResults = dueSupportedFixtures
    .filter(fixture => !completedResultIsPresent(fixture))
    .map(fixture => ({
      id: fixture.id || null,
      sport: String(fixture.sportDomainId || "").replace(/^sport:/, ""),
      startTimeUtc: fixture.startTimeUtc || null,
      status: fixture.status || null,
    }));
  overdueResults.forEach(fixture => issues.push(`${fixture.sport.toUpperCase()} ${fixture.id}: result is overdue.`));

  const canonicalAgeHours = ageHours(canonical.generatedAt, now);
  const feedAgeHours = ageHours(feedMeta?.publishedAt, now);
  if (canonicalAgeHours === null || canonicalAgeHours < 0 || canonicalAgeHours > MAX_SNAPSHOT_AGE_HOURS){
    issues.push(`Canonical snapshot must be no more than ${MAX_SNAPSHOT_AGE_HOURS} hours old.`);
  }
  if (feedAgeHours === null || feedAgeHours < 0 || feedAgeHours > MAX_SNAPSHOT_AGE_HOURS){
    issues.push(`Published feed must be no more than ${MAX_SNAPSHOT_AGE_HOURS} hours old.`);
  }

  const coveragePercent = supportedFixtureCount
    ? Math.round(completeFixtureCount * 10_000 / supportedFixtureCount) / 100
    : 0;
  return {
    schemaVersion: SCHEMA_VERSION,
    checkedAt: now.toISOString(),
    ready: issues.length === 0 && coveragePercent === 100 && overdueResults.length === 0,
    supportedFixtureCoveragePercent: coveragePercent,
    supportedFixtureCount,
    completeFixtureCount,
    deferredPlaceholderCount,
    deferredPlaceholders,
    dueSupportedFixtureCount: dueSupportedFixtures.length,
    overdueResultCount: overdueResults.length,
    overdueResults,
    snapshot: {
      canonicalGeneratedAt: canonical.generatedAt || null,
      canonicalAgeHours: roundedHours(canonicalAgeHours),
      feedPublishedAt: feedMeta?.publishedAt || null,
      feedAgeHours: roundedHours(feedAgeHours),
      maximumAgeHours: MAX_SNAPSHOT_AGE_HOURS,
    },
    sports,
    issues,
  };
}

function parseOptions(argv = process.argv.slice(2)){
  const options = {
    canonicalPath: "data/canonical/afl-nrl-2026.json",
    feedMetaPath: "data/feed-meta.json",
    now: new Date(),
    jsonOnly: false,
  };
  argv.forEach(argument => {
    if (argument === "--json") options.jsonOnly = true;
    else if (argument.startsWith("--canonical=")) options.canonicalPath = argument.slice("--canonical=".length);
    else if (argument.startsWith("--feed-meta=")) options.feedMetaPath = argument.slice("--feed-meta=".length);
    else if (argument.startsWith("--now=")) options.now = new Date(argument.slice("--now=".length));
    else throw new Error(`Unknown option: ${argument}`);
  });
  if (!Number.isFinite(options.now.getTime())) throw new Error("--now must be a valid timestamp.");
  return options;
}

function readJson(filePath){
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function main(){
  const options = parseOptions();
  const report = buildReadinessReport({
    canonical: readJson(options.canonicalPath),
    feedMeta: readJson(options.feedMetaPath),
    now: options.now,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ready){
    if (!options.jsonOnly) process.stderr.write(`Pilot readiness failed with ${report.issues.length} issue(s).\n`);
    process.exitCode = 1;
  }else if (!options.jsonOnly){
    process.stdout.write(`Pilot readiness passed: ${report.supportedFixtureCount} current/next-round AFL and NRL fixtures are complete, snapshots are fresh, and no supported result is overdue.\n`);
  }
}

if (require.main === module) main();

module.exports = {
  MAX_SNAPSHOT_AGE_HOURS,
  RESULT_GRACE_HOURS,
  SCHEMA_VERSION,
  SUPPORTED_SPORTS,
  buildReadinessReport,
  completedResultIsPresent,
  fixtureIssues,
  isUnresolvedOfficialPlaceholder,
  parseOptions,
};
