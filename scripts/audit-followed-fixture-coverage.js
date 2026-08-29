#!/usr/bin/env node

"use strict";

const baseFeed = require("../data/events.json");
const sportContext = require("../config/sport-context");
const canonicalSports = require("../data/canonical/afl-nrl-2026.json");
const f1Context = require("../data/canonical/f1-context-2026.json");
const tennisContext = require("../data/canonical/tennis-context-2026.json");
const cyclingContext = require("../data/canonical/cycling-context-2026.json");
const nbaContext = require("../data/canonical/nba-context-2026.json");
const cwgContext = require("../data/canonical/cwg-context-2026.json");
const cardLifecycle = require("../config/card-lifecycle");
const { readSnapshot } = require("../lib/follow-snapshot");
const { buildServerFeed, normalizeEvent, shouldEnrichEvent, sydneyDateKey } = require("../lib/server-feed-pipeline");
const { eventMatchesEntities, expandedFollowEntityIds, resolveUserFollowFixtures } = require("../lib/follow-fixture-resolver");

const NO_CURRENT_FIXTURE = new Set([
  "team:rugby:brumbies",
  "team:cwg:australia",
]);

function activeFollows(profile){
  return profile.entityFollows.filter(follow => ["follow", "priority"].includes(follow.followLevel));
}

function stableEventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function profileState(profile){
  return {
    preferences:{
      preferenceGraph:{
        domainPreferences:[],
        competitionPreferences:[],
        entityFollows:profile.entityFollows,
      },
    },
  };
}

function retainedFixture(event, now){
  return cardLifecycle.lifecycleState(event, { now }).state !== "expired";
}

function buildCompleteFeed(options){
  const eventIds = new Set();
  const cardIds = new Set();
  let cursor = 0;
  let pageCount = 0;
  let firstPage = null;
  do{
    const page = buildServerFeed({ ...options, cursor, limit:1000 });
    if (!firstPage) firstPage = page;
    page.events.forEach(event => eventIds.add(stableEventId(event)));
    page.derivedCardCache.derivedCards.forEach(card => cardIds.add(stableEventId(card)));
    cursor = page.pagination.nextCursor;
    pageCount += 1;
    if (pageCount > 100) throw new Error("Follow fixture audit pagination did not terminate");
  }while (cursor != null);
  return { eventIds, cardIds, firstPage, pageCount };
}

function auditProfile(profile, { now = new Date(), baseEvents = baseFeed.events } = {}){
  const reference = now instanceof Date ? now : new Date(now);
  const userState = profileState(profile);
  const resolved = resolveUserFollowFixtures({ events:baseEvents, userState });
  const allEntityIds = expandedFollowEntityIds(userState);
  const normalized = resolved.events.map(event => normalizeEvent(event, reference));
  const completeFeed = buildCompleteFeed({
    events:resolved.events,
    userId:`audit-${profile.profileHash}`,
    userState,
    participants:resolved.participants,
    now:reference,
  });
  const { eventIds:feedEventIds, cardIds } = completeFeed;
  const firstPage = buildServerFeed({
    events:resolved.events,
    userId:`audit-${profile.profileHash}`,
    userState,
    participants:resolved.participants,
    now:reference,
    limit:20,
  });
  const firstPageIds = new Set(firstPage.events.map(stableEventId));
  const classifications = activeFollows(profile).map(follow => {
    const directState = { preferences:{ preferenceGraph:{ entityFollows:[follow], domainPreferences:[], competitionPreferences:[] } } };
    const resolvedIds = expandedFollowEntityIds(directState);
    const fixtures = normalized.filter(event => retainedFixture(event, reference) && eventMatchesEntities(event, resolvedIds));
    const eligible = fixtures.filter(event => shouldEnrichEvent(event, userState.preferences, {}, resolvedIds));
    if (eligible.length && eligible.some(event => feedEventIds.has(stableEventId(event)))){
      const activeFixtures = eligible.filter(event => {
        const state = cardLifecycle.lifecycleState(event, { now:reference }).state;
        return state === "active" || state === "saved";
      });
      const missingActiveCard = activeFixtures.some(event => !cardIds.has(stableEventId(event)));
      if (missingActiveCard) return { entityId:follow.participantId, status:"published_fixture_missing", fixtureCount:fixtures.length, reason:"active_card_missing" };
      return { entityId:follow.participantId, status:"surfaced", fixtureCount:eligible.length };
    }
    if (fixtures.length) return { entityId:follow.participantId, status:"published_fixture_missing", fixtureCount:fixtures.length };
    return {
      entityId:follow.participantId,
      status:"no_current_fixture",
      classificationReason:NO_CURRENT_FIXTURE.has(follow.participantId)
        ? "known_empty_window"
        : "no_retained_fixture",
      fixtureCount:0,
    };
  });
  const sameDayFollowed = normalized.filter(event => (
    retainedFixture(event, reference)
    && eventMatchesEntities(event, allEntityIds)
    && sydneyDateKey(event.startTimeUtc) === sydneyDateKey(reference)
    && shouldEnrichEvent(event, userState.preferences, {}, allEntityIds)
  ));
  const missingSameDay = sameDayFollowed.filter(event => !firstPageIds.has(stableEventId(event)));
  return {
    profileHash:profile.profileHash,
    followedEntities:classifications.length,
    surfaced:classifications.filter(item => item.status === "surfaced").length,
    noCurrentFixture:classifications
      .filter(item => item.status === "no_current_fixture")
      .map(item => ({ entityId:item.entityId, reason:item.classificationReason })),
    failures:classifications.filter(item => item.status === "published_fixture_missing"),
    sameDayFixtures:sameDayFollowed.length,
    missingSameDay:missingSameDay.map(stableEventId),
    firstPageEvents:firstPage.events.length,
    personalisedPages:completeFeed.pageCount,
  };
}

function main(){
  const snapshot = readSnapshot();
  const context = sportContext.mergeCanonicalBundles(canonicalSports, f1Context, tennisContext, cyclingContext, nbaContext, cwgContext);
  const contextualEvents = sportContext.applyContextToEvents(baseFeed.events, context);
  const results = snapshot.profiles.map(profile => auditProfile(profile, { baseEvents:contextualEvents }));
  results.forEach(result => {
    console.log(`Profile ${result.profileHash}: ${result.surfaced}/${result.followedEntities} followed entities surfaced; ${result.sameDayFixtures} same-day fixtures on the initial page.`);
    if (result.noCurrentFixture.length){
      const labels = result.noCurrentFixture.map(item => `${item.entityId} (${item.reason})`);
      console.log(`Profile ${result.profileHash} no_current_fixture: ${labels.join(", ")}`);
    }
  });
  const failures = results.flatMap(result => [
    ...result.failures.map(failure => `${result.profileHash}:${failure.entityId}:${failure.reason || "not_in_personalised_feed"}`),
    ...result.missingSameDay.map(eventId => `${result.profileHash}:${eventId}:not_on_initial_page`),
  ]);
  if (failures.length) throw new Error(`Follow fixture audit failed: ${failures.join(", ")}`);
  console.log(`Anonymised follow fixture audit passed for ${results.length} profiles.`);
}

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exit(1); }
}

module.exports = { NO_CURRENT_FIXTURE, auditProfile, profileState };
