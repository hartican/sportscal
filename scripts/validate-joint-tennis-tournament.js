#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const jointTennis = require("../config/joint-tennis-tournament.js");
const reportingSources = require("../config/cincinnati-reporting-sources.js");
const refresh = require("./refresh-cincinnati-tournament.js");

const ROOT = path.resolve(__dirname, "..");
const DOCUMENT_PATH = path.join(ROOT, "data/canonical/joint-tennis-tournament-2026.json");
const BUNDLE_DOCUMENT_PATH = path.join(ROOT, "data/canonical/joint-tennis-tournament-2026.js");
const FIXTURE_DIR = path.join(ROOT, "feeds/provider-exports/tennis/cincinnati");
const OUTCOME_KEY = /^(?:result|results|score|scores|winner|winnerId|sets|outcome|outcomeSignals|completed)$/i;
const OUTCOME_TEXT = /(?:result|winner|\bwin(?:ning)?\b|won|loss|lost|score|post-match|beat(?:ing)?|defeat(?:ed)?|advanced|streak)/i;

function walkSchedule(value, pathParts = []){
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkSchedule(item, [...pathParts, index]));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, child]) => {
    const isSelectionScore = key === "score" && pathParts.at(-1) === "selection";
    assert(isSelectionScore || !OUTCOME_KEY.test(key), `spoiler-safe schedule leaked ${[...pathParts, key].join(".")}`);
    walkSchedule(child, [...pathParts, key]);
  });
}

function validDate(value, label){
  assert(/^\d{4}-\d{2}-\d{2}$/.test(value || ""), `${label} must be an ISO date`);
  assert.equal(new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10), value, `${label} must be a possible date`);
}

function validDateTime(value, label){
  assert.equal(new Date(value).toISOString(), value, `${label} must be a normalized ISO date-time`);
}

function validateDocument(document){
  assert.equal(document?.schemaVersion, jointTennis.SCHEMA_VERSION);
  assert(/^tournament:tennis:joint:/.test(document?.tournament?.tournamentId));
  assert.deepEqual(document.tournament.representedTours, ["ATP", "WTA"]);
  assert.equal(document.tournament.sportId, "sport:tennis");
  validDate(document.tournament.startDate, "tournament startDate");
  validDate(document.tournament.endDate, "tournament endDate");
  assert(document.tournament.startDate <= document.tournament.endDate, "tournament dates must be ordered");
  validDateTime(document.retrievedAt, "retrievedAt");
  assert(jointTennis.CONFIDENCE_STATES.includes(document.freshness.confidence));
  assert(["schedule", "stale_schedule", "overview"].includes(document.freshness.mode));
  assert.equal(document.freshness.staleAfterHours, 24);
  if (document.freshness.lastSuccessfulAt) validDateTime(document.freshness.lastSuccessfulAt, "lastSuccessfulAt");
  assert.deepEqual(document.sourcePages, Object.values(refresh.OFFICIAL_PAGES), "only the three approved Cincinnati publisher pages may seed automatic data");
  assert(document.sourceDocuments.length >= 1);
  document.sourceDocuments.forEach(source => {
    assert(Object.values(refresh.OFFICIAL_PAGES).includes(source.publisherPageUrl), "every source document needs approved publisher-page provenance");
    validDateTime(source.retrievedAt, "source retrievedAt");
    if (source.sourceUrl !== source.publisherPageUrl) refresh.assertApprovedPublishedDocument(source);
    if (source.sha256) assert(/^[a-f0-9]{64}$/.test(source.sha256));
  });
  assert(jointTennis.RESULT_AVAILABILITY_STATUSES.includes(document.resultAvailability.status));
  assert(jointTennis.RESULT_CHECK_STATES.includes(document.resultAvailability.lastCheck));
  validDateTime(document.resultAvailability.checkedAt, "resultAvailability.checkedAt");
  if (document.resultAvailability.sourceUrl) {
    assert(/^https:\/\//.test(document.resultAvailability.sourceUrl), "result availability provenance must use HTTPS");
    assert(["verified", "unverified"].includes(document.resultAvailability.sourceTrust), "result availability must expose its trust class");
  }

  const matches = document.schedule.matches || [];
  const ids = matches.map(match => match.matchId);
  assert.equal(new Set(ids).size, ids.length, "joint tournament match IDs must be unique");
  const sequences = matches.map(match => match.scheduledSequence);
  assert.equal(new Set(sequences).size, sequences.length, "published schedule sequences must be unique");
  if (document.schedule.date) {
    validDate(document.schedule.date, "schedule date");
    assert(document.schedule.date >= document.tournament.startDate && document.schedule.date <= document.tournament.endDate, "schedule date must be inside the tournament window");
  }
  matches.forEach(match => {
    assert(["ATP", "WTA"].includes(match.tour));
    assert(jointTennis.TIMING_TYPES.includes(match.timing.type));
    assert.equal(match.players.length, 2);
    assert.equal(new Set(match.players.map(player => player.playerId)).size, 2);
    match.players.forEach(player => assert.equal(player.isAustralian, player.nationalityCode === "AUS"));
    const expectedId = jointTennis.stableMatchId({ tournamentId: document.tournament.tournamentId, date: document.schedule.date, tour: match.tour, players: match.players });
    assert.equal(match.matchId, expectedId, "stable match IDs must not depend on card rank, court or play order");
    assert.deepEqual(match.selection, jointTennis.scoreMatch(match), "selection scores and reasons must be deterministic");
    (match.narrativeSignals || []).forEach(signal => {
      assert(jointTennis.TRUSTED_NARRATIVE_SOURCES.has(signal.trust));
      assert(!OUTCOME_TEXT.test(`${signal.kind} ${signal.label}`), "outcome-derived narrative signals must not influence pre-match selection");
    });
  });
  walkSchedule(document.schedule);
  walkSchedule(document.matchHistory || []);

  assert(document.schedule.promotedMatchIds.length <= 3);
  document.schedule.promotedMatchIds.forEach(id => assert(ids.includes(id), `promoted match is absent from schedule: ${id}`));
  const promotedMatches = document.schedule.promotedMatchIds.map(id => matches.find(match => match.matchId === id));
  assert.deepEqual(promotedMatches.slice().sort(jointTennis.scheduleOrder).map(match => match.matchId), document.schedule.promotedMatchIds, "promoted matches must display in published court/play order");

  const addressableMatches = Array.from(new Map([
    ...matches,
    ...(document.matchHistory || []),
  ].map(match => [match.matchId, match])).values());
  const addressableById = new Map(addressableMatches.map(match => [match.matchId, match]));
  const resultEntries = Object.entries(document.resultsByMatchId || {});
  resultEntries.forEach(([matchId, result]) => {
    assert(addressableById.has(matchId), `result references unknown match: ${matchId}`);
    assert.equal(result.status, "completed");
    assert(/(?:^|\s)[0-7][-–][0-7](?:\(\d+\))?(?=\s|$)/.test(result.score), "completed result must contain an explicit tennis set score");
    assert(addressableById.get(matchId).players.some(player => player.playerId === result.winnerPlayerId), "winner must be an addressable participant");
    assert(/^https:\/\//.test(result.sourceUrl), "results need HTTPS source provenance");
    assert(["verified", "unverified"].includes(result.sourceTrust), "results need a visible trust class");
    validDateTime(result.retrievedAt, "result retrievedAt");
  });
  assert.equal(document.resultAvailability.status, resultEntries.length ? "available" : "unavailable", "result availability must reflect the separate result map");
  if (document.resultAvailability.lastCheck === "parsed") assert(resultEntries.length > 0, "parsed result status requires at least one source-backed result");
  if (document.resultAvailability.lastCheck === "parsed") assert(document.resultAvailability.sourceUrl, "a parsed result needs source provenance");
  if (["not_checked", "no_parseable_completed_results"].includes(document.resultAvailability.lastCheck)) assert.equal(document.resultAvailability.sourceUrl, null);
  (document.reporting?.items || []).forEach(item => {
    assert(/^reporting:cincinnati:/.test(item.itemId));
    assert(["result", "highlight", "commentary", "preview"].includes(item.kind));
    assert(["verified", "unverified"].includes(item.sourceTrust));
    assert(/^https:\/\//.test(item.sourceUrl));
    assert(Number.isInteger(item.reliabilityRank) && item.reliabilityRank >= 1 && item.reliabilityRank <= 4);
    validDateTime(item.sourceCheckedAt, "reporting sourceCheckedAt");
  });

  if (document.freshness.mode === "overview") {
    assert.equal(matches.length, 0);
    assert.equal(document.schedule.promotedMatchIds.length, 0);
    assert.equal(document.schedule.displayMessage, "Schedule details unavailable");
  } else {
    assert(matches.length > 0);
    assert.equal(document.schedule.displayMessage, "Beta schedule");
  }
  return document;
}

function fixture(name){
  return fs.readFileSync(path.join(FIXTURE_DIR, name));
}

function fakeResponse(body, contentType = "text/html"){
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    ok: true,
    status: 200,
    headers: new Map([["content-type", contentType]]),
    text: async () => buffer.toString("utf8"),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

async function run(){
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas/joint-tennis-tournament.schema.json"), "utf8"));
  assert.equal(schema.properties.schemaVersion.const, jointTennis.SCHEMA_VERSION);
  assert.equal(schema.properties.resultsByMatchId.type, "object", "results must stay outside spoiler-safe schedule records");
  assert(schema.required.includes("resultAvailability"), "every canonical document must state whether verified results are available");
  assert(reportingSources.SOURCES.some(source => source.sourceTrust === "unverified"), "the MVP reporting stack must include automatically scraped unverified reporting");
  assert(reportingSources.SOURCES.some(source => source.id === "cincinnati-rain-oop-mixed" && source.responseFormat === "json" && source.sourceTrust === "verified"), "the public Cincinnati-integrated mixed order of play must be the automated schedule source");
  assert(reportingSources.SOURCES.some(source => source.pageRole === "reporting-api" && /cincinnatiopen\.com\/wp-json\//.test(source.url)), "official Cincinnati editorial reporting must use the public WordPress API");
  assert(reportingSources.SOURCES.some(source => /^espn-cincinnati-/.test(source.id) && source.sourceTrust === "unverified"), "ESPN must remain a labelled fallback rather than official truth");

  const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/tennis-catalogue-2026.json"), "utf8"));
  const cincinnati = refresh.cincinnatiTournament(catalogue);
  assert.equal(cincinnati.startDate, "2026-08-08", "the joint card must be eligible from the first official 2026 order-of-play day, including qualifying");
  assert.equal(refresh.SYDNEY_TIME_ZONE, "Australia/Sydney");
  assert.equal(refresh.sydneyDateKey("2026-08-07T13:59:59.999Z"), "2026-08-07", "the tournament must remain inactive before its opening Sydney calendar day");
  assert.equal(refresh.sydneyDateKey("2026-08-07T14:00:00.000Z"), "2026-08-08", "Sydney midnight must activate the opening tournament day even while UTC is still on the prior date");
  assert.equal(refresh.tournamentLocalDateKey("2026-08-23T14:00:00.000Z", cincinnati), "2026-08-23", "Sydney midnight must not end Cincinnati's still-active final day");
  assert.equal(refresh.tournamentLocalDateKey("2026-08-24T03:59:59.999Z", cincinnati), "2026-08-23", "the final must remain active through the last Cincinnati-local instant");
  assert.equal(refresh.tournamentLocalDateKey("2026-08-24T04:00:00.000Z", cincinnati), "2026-08-24", "the tournament must end at Cincinnati-local midnight after the final");
  assert.equal(refresh.tournamentRefreshIsActive(cincinnati, "2026-08-07T14:00:00.000Z"), true, "the Sydney-morning check may discover the first upcoming Cincinnati OOP on the prior Ohio evening");
  assert.equal(refresh.tournamentRefreshIsActive(cincinnati, "2026-08-24T03:59:59.999Z"), true, "the refresh must remain active through Cincinnati's final local day");
  assert.equal(refresh.tournamentRefreshIsActive(cincinnati, "2026-08-24T04:00:00.000Z"), false, "the refresh must stop after Cincinnati's final local day");
  assert.throws(() => refresh.sydneyDateKey("not-a-date"), /Invalid tournament check time/);
  const pdfBuffer = fixture("order-of-play-2026-08-14.pdf");
  const extracted = refresh.extractPdfText(pdfBuffer);
  assert.match(extracted, /Alex de Minaur/);
  assert.match(extracted, /NOT BEFORE 1:30 PM/);
  const positionedRows = refresh.positionedTextFromPdfContent("1 0 0 1 20 700 Tm (CENTER COURT) Tj 1 0 0 1 220 700 Tm (COURT 3) Tj 1 0 0 1 20 680 Tm (11:00 AM) Tj 1 0 0 1 220 680 Tm (FOLLOWED BY) Tj 1 0 0 1 20 660 Tm (ATP Alex vs Carlos) Tj 1 0 0 1 220 660 Tm (WTA Aryna vs Maya) Tj");
  assert.deepEqual(positionedRows, ["CENTER COURT | COURT 3", "11:00 AM | FOLLOWED BY", "ATP Alex vs Carlos | WTA Aryna vs Maya"], "positioned PDF text must preserve multi-court row order");
  const parsedDocument = refresh.buildDocumentFromPdf({
    pdfBuffer,
    sourceDocument: {
      kind: "order_of_play",
      publisherPageUrl: refresh.OFFICIAL_PAGES.order_of_play,
      sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/order-of-play-2026-08-14.pdf",
    },
    retrievedAt: "2026-08-14T13:00:00.000Z",
    catalogue,
  });
  validateDocument(parsedDocument);
  assert.deepEqual(parsedDocument.resultAvailability, {
    status: "unavailable",
    checkedAt: "2026-08-14T13:00:00.000Z",
    sourceUrl: null,
    lastCheck: "not_checked",
  }, "schedule parsing alone must never imply that results were checked");
  assert.equal(parsedDocument.schedule.matches.length, 4);
  assert.equal(parsedDocument.schedule.promotedMatchIds.length, 3);
  assert.deepEqual(parsedDocument.schedule.matches.map(match => match.timing.type), ["exact", "followed_by", "not_before", "session_only"]);
  assert.deepEqual(parsedDocument.schedule.promotedMatchIds, [
    parsedDocument.schedule.matches[0].matchId,
    parsedDocument.schedule.matches[1].matchId,
    parsedDocument.schedule.matches[2].matchId,
  ], "balanced selection must choose the three strongest matches, then restore official play order");
  const tableParsed = refresh.parseOrderOfPlayText(fixture("order-of-play-table-extract-2026-08-14.txt").toString("utf8"), {
    tournament: refresh.cincinnatiTournament(catalogue),
    catalogue,
  });
  assert.equal(tableParsed.matches.length, 6, "multi-court official PDF extraction must retain each singles cell");
  assert.deepEqual(tableParsed.matches.slice(0, 3).map(match => match.court), ["P&G CENTER COURT", "GRANDSTAND", "COURT 3"]);
  assert.deepEqual(tableParsed.matches.slice(3).map(match => match.courtSequence), [2, 2, 2]);
  assert.deepEqual(tableParsed.matches.slice(3).map(match => match.timing.type), ["followed_by", "not_before", "followed_by"]);
  const columnBlockParsed = refresh.parseOrderOfPlayText(fixture("order-of-play-column-block-extract-2026-08-14.txt").toString("utf8"), {
    tournament: refresh.cincinnatiTournament(catalogue),
    catalogue,
  });
  assert.equal(columnBlockParsed.matches.length, 4, "column-block accessible text must retain every singles match");
  assert.equal(columnBlockParsed.date, "2026-08-14", "the order-of-play heading must beat the tournament date range");
  assert.deepEqual(
    columnBlockParsed.matches.map(match => [match.court, match.courtSequence]),
    [["P&G STADIUM COURT", 1], ["GRANDSTAND", 1], ["P&G STADIUM COURT", 2], ["GRANDSTAND", 2]],
    "column-block PDFs must be restored to row-major court/play order",
  );
  assert.deepEqual(columnBlockParsed.matches.map(match => match.timing.type), ["exact", "exact", "followed_by", "not_before"]);
  const mixedSinglesAndDoubles = refresh.parseOrderOfPlayText([
    "ORDER OF PLAY 14 AUGUST 2026",
    "P&G STADIUM COURT",
    "ATP",
    "[5] HSIEH (TPE) / OSTAPENKO (LAT) or",
    "V",
    "DABROWSKI (CAN) / ROUTLIFFE (NZL)",
    "ATP",
    "Alex de Minaur (AUS)",
    "V",
    "Carlos Alcaraz (ESP)",
  ].join("\n"), {
    tournament: refresh.cincinnatiTournament(catalogue),
    catalogue,
  });
  assert.equal(mixedSinglesAndDoubles.matches.length, 1, "column-block doubles rows must be skipped without discarding the published singles schedule");
  assert.deepEqual(mixedSinglesAndDoubles.matches[0].players.map(player => player.name), ["Alex De Minaur", "Carlos Alcaraz"]);
  const rankings = new Map(catalogue.athletes.map(player => [`${player.tour}:${jointTennis.slug(player.displayName)}`, player]));
  assert.equal(refresh.parseMatchLine("Su-Wei HSIEH TPE Ena SHIBAHARA JPN vs Gabriela DABROWSKI CAN Erin ROUTLIFFE NZL WTA", rankings), null, "doubles rows must not be mistaken for a singles highlight");
  assert(refresh.parseMatchLine("ATP Botic VAN DE ZANDSCHULP (NED) v Tallon GRIEKSPOOR (NED)", rankings), "uppercase surname particles must not be mistaken for a doubles country code");
  const reverified = JSON.parse(JSON.stringify(parsedDocument));
  reverified.retrievedAt = "2026-08-14T14:00:00.000Z";
  reverified.freshness.lastSuccessfulAt = reverified.retrievedAt;
  reverified.sourceDocuments.forEach(source => { source.retrievedAt = reverified.retrievedAt; source.sha256 = "0".repeat(64); });
  reverified.sourceDocuments.push({ kind: "draws", publisherPageUrl: refresh.OFFICIAL_PAGES.draws, sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/revised-draw.pdf", retrievedAt: reverified.retrievedAt });
  assert.equal(refresh.contentSignature(reverified), refresh.contentSignature(parsedDocument), "retrieval and supporting-document metadata alone must not trigger a static output change or release");

  const firstMatch = parsedDocument.schedule.matches[0];
  assert.equal(jointTennis.stableMatchId({ tournamentId: parsedDocument.tournament.tournamentId, date: parsedDocument.schedule.date, tour: firstMatch.tour, players: firstMatch.players.slice().reverse() }), firstMatch.matchId, "player listing direction must not change a match ID");
  assert.equal(jointTennis.stableMatchId({ tournamentId: parsedDocument.tournament.tournamentId, date: parsedDocument.schedule.date, tour: firstMatch.tour, players: firstMatch.players }), firstMatch.matchId, "court and sequence do not contribute to stable IDs");
  assert.equal(jointTennis.stableMatchId({ tournamentId: parsedDocument.tournament.tournamentId, date: "2026-08-15", tour: firstMatch.tour, players: firstMatch.players }), firstMatch.matchId, "a rain delay or next-day reschedule must not break saved match actions");

  const cleanScore = jointTennis.scoreMatch({ ...firstMatch, narrativeSignals: [] });
  const outcomeSignalScore = jointTennis.scoreMatch({ ...firstMatch, narrativeSignals: [{ kind: "result", label: "Won yesterday", trust: "official", weight: 8 }] });
  assert.deepEqual(outcomeSignalScore, cleanScore, "outcome-derived signals must be ignored before selection");
  const trustedStoryScore = jointTennis.scoreMatch({ ...firstMatch, narrativeSignals: [{ kind: "preview", label: "Official featured match", trust: "official", weight: 6 }] });
  assert.equal(trustedStoryScore.components.narrative, 6);
  assert(trustedStoryScore.score > cleanScore.score);

  const completedResult = {
    status: "completed",
    score: "6-4 6-3",
    winnerPlayerId: firstMatch.players[0].playerId,
    sourceUrl: refresh.OFFICIAL_PAGES.draws,
    sourceTrust: "verified",
    sourceName: "Cincinnati Open",
    retrievedAt: "2026-08-14T18:00:00.000Z",
  };
  const withResult = jointTennis.withResults(parsedDocument, { [firstMatch.matchId]: completedResult }, {
    status: "available",
    checkedAt: completedResult.retrievedAt,
    sourceUrl: completedResult.sourceUrl,
    sourceTrust: "verified",
    lastCheck: "parsed",
  });
  validateDocument(withResult);
  assert(withResult.resultsByMatchId[firstMatch.matchId]);
  const hidden = jointTennis.spoilerSafeView(withResult, false);
  assert.equal(hidden.resultsByMatchId, undefined, "results-hidden views must remove the separate result map");
  assert.equal(hidden.resultAvailability, undefined, "results-hidden views must not reveal whether a tracked match has a completed result");
  assert(!JSON.stringify(hidden.schedule).includes("6-4"));
  const shown = jointTennis.spoilerSafeView(withResult, true);
  assert.equal(shown.resultsByMatchId[firstMatch.matchId].score, "6-4 6-3");

  const fourthMatch = parsedDocument.schedule.matches[3];
  const saved = jointTennis.savedMatches(parsedDocument, [firstMatch.matchId, fourthMatch.matchId]);
  assert.deepEqual(saved.map(match => match.matchId), [fourthMatch.matchId], "saved matches outside the rotating top three must remain addressable");

  const stale = refresh.handleRefreshFailure(parsedDocument, { catalogue, now: "2026-08-15T12:00:00.000Z", error: new Error("parse failed") });
  validateDocument(stale);
  assert.equal(stale.freshness.confidence, "Stale");
  assert.equal(stale.freshness.mode, "stale_schedule");
  assert.equal(stale.schedule.matches.length, 4, "last-good data may be retained inside 24 hours");
  const expired = refresh.handleRefreshFailure(parsedDocument, { catalogue, now: "2026-08-15T14:00:01.000Z", error: new Error("parse failed") });
  validateDocument(expired);
  assert.equal(expired.freshness.mode, "overview");
  assert.equal(expired.schedule.displayMessage, "Schedule details unavailable");

  assert.throws(() => refresh.parseScheduleDate("31 FEBRUARY 2026"), error => error.code === "integrity_impossible_date", "impossible source dates must block release instead of degrading silently");
  assert.throws(() => refresh.assertApprovedPublishedDocument({ kind: "order_of_play", publisherPageUrl: refresh.OFFICIAL_PAGES.order_of_play, sourceUrl: "https://www.atptour.com/fallback.pdf" }), /not approved/);
  assert.throws(() => refresh.discoverPublishedDocuments('<a href="https://api-tennis.com/order.pdf">Paid feed</a>', refresh.OFFICIAL_PAGES.order_of_play, "order_of_play"), /not approved/);
  const publishedLinks = refresh.discoverPublishedDocuments(fixture("official-order-of-play-page.html").toString("utf8"), refresh.OFFICIAL_PAGES.order_of_play, "order_of_play");
  assert.equal(publishedLinks.length, 1);
  assert.equal(publishedLinks[0].sourceUrl, "https://cincinnatiopen.com/wp-content/uploads/2026/08/order-of-play-2026-08-14.pdf");
  const completedDrawsHtml = fixture("official-draws-page-with-completed-result.html").toString("utf8");
  const jsonLdResults = refresh.extractOfficialResultsHtml(completedDrawsHtml, {
    document: parsedDocument,
    publisherPageUrl: refresh.OFFICIAL_PAGES.draws,
    retrievedAt: "2026-08-14T18:00:00.000Z",
  });
  assert.deepEqual(Object.keys(jsonLdResults), [firstMatch.matchId]);
  assert.equal(jsonLdResults[firstMatch.matchId].winnerPlayerId, firstMatch.players[0].playerId);
  assert.equal(jsonLdResults[firstMatch.matchId].score, "6-4 6-3");
  const notCompletedHtml = completedDrawsHtml.replace("https://schema.org/EventCompleted", "https://schema.org/EventScheduled");
  assert.deepEqual(refresh.extractOfficialResultsHtml(notCompletedHtml, {
    document: parsedDocument,
    publisherPageUrl: refresh.OFFICIAL_PAGES.draws,
    retrievedAt: "2026-08-14T18:00:00.000Z",
  }), {}, "scheduled or live records must not be promoted to completed results");
  const scorelessHtml = completedDrawsHtml.replace('"score": "6-4 6-3"', '"description": "Completed"');
  assert.deepEqual(refresh.extractOfficialResultsHtml(scorelessHtml, {
    document: parsedDocument,
    publisherPageUrl: refresh.OFFICIAL_PAGES.draws,
    retrievedAt: "2026-08-14T18:00:00.000Z",
  }), {}, "completion without an explicit set score must remain unavailable");
  const conflictingDrawsHtml = completedDrawsHtml.replace("</head>", `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    sport: "Tennis",
    eventStatus: "https://schema.org/EventCompleted",
    competitor: [{ "@type": "Person", name: "Alex De Minaur" }, { "@type": "Person", name: "Carlos Alcaraz" }],
    winner: { "@type": "Person", name: "Carlos Alcaraz" },
    score: "6-0 6-0",
  })}</script></head>`);
  assert.throws(() => refresh.extractOfficialResultsHtml(conflictingDrawsHtml, {
    document: parsedDocument,
    publisherPageUrl: refresh.OFFICIAL_PAGES.draws,
    retrievedAt: "2026-08-14T18:00:00.000Z",
  }), error => error.code === "integrity_conflicting_results", "conflicting first-party result records must block publication");
  assert.throws(() => refresh.extractOfficialResultsHtml(completedDrawsHtml, {
    document: parsedDocument,
    publisherPageUrl: "https://cincinnatiopen.com/score-center/scores/",
    retrievedAt: "2026-08-14T18:00:00.000Z",
  }), /Unapproved Cincinnati publisher page/, "the parser must reject every page outside the three named approved sources");
  const datedChoice = refresh.chooseOrderOfPlayDocument([
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-9.pdf" },
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-14.pdf" },
  ], "2026-08-14T13:00:00.000Z");
  assert.match(datedChoice.sourceUrl, /AUG-14/, "the current published order of play must beat lexicographic filename ordering");
  const sydneyMorningChoice = refresh.chooseOrderOfPlayDocument([
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-13.pdf" },
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-14.pdf" },
  ], "2026-08-13T23:00:00.000Z");
  assert.match(sydneyMorningChoice.sourceUrl, /AUG-14/, "9am Sydney must select the upcoming Cincinnati-local OOP, not the prior Ohio day's sheet");
  const ohioMorningChoice = refresh.chooseOrderOfPlayDocument([
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-14.pdf" },
    { kind: "order_of_play", sourceUrl: "https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-AUG-15.pdf" },
  ], "2026-08-14T13:00:00.000Z");
  assert.match(ohioMorningChoice.sourceUrl, /AUG-14/, "an Ohio-morning check must keep the current local OOP instead of jumping to the adjacent day");

  const pageFixtures = new Map([
    [refresh.OFFICIAL_PAGES.tournament_schedule, fixture("official-tournament-schedule-page.html")],
    [refresh.OFFICIAL_PAGES.order_of_play, fixture("official-order-of-play-page.html")],
    [refresh.OFFICIAL_PAGES.draws, fixture("official-draws-page.html")],
    [publishedLinks[0].sourceUrl, pdfBuffer],
  ]);
  const fetchedUrls = [];
  const fetchImpl = async url => {
    fetchedUrls.push(url);
    if (!pageFixtures.has(url)) throw new Error(`Unexpected fetch in test: ${url}`);
    return fakeResponse(pageFixtures.get(url), /\.pdf$/i.test(url) ? "application/pdf" : "text/html");
  };
  const refreshed = await refresh.refreshCincinnatiTournament({
    fetchImpl,
    now: "2026-08-14T13:00:00.000Z",
    outputPath: path.join(FIXTURE_DIR, "absent-output.json"),
    catalogue,
    reportingSources: [],
  });
  assert.equal(refreshed.status, "success");
  validateDocument(refreshed.document);
  assert.deepEqual(fetchedUrls.slice(0, 3).sort(), Object.values(refresh.OFFICIAL_PAGES).slice().sort());
  assert.equal(fetchedUrls.length, 4, "the schedule seam must fetch the three named pages and the approved order-of-play PDF when reporting fallbacks are disabled for this fixture");
  assert.equal(fetchedUrls.at(-1), publishedLinks[0].sourceUrl, "the refresh may only download a PDF discovered on an approved Cincinnati page");
  assert.equal(refreshed.document.resultAvailability.status, "unavailable");
  assert.equal(refreshed.document.resultAvailability.lastCheck, "no_parseable_completed_results");
  assert.equal(refreshed.document.resultsByMatchId, undefined, "current-style publisher pages must not produce inferred results");

  const unavailableResults = refresh.attachOfficialResults({
    pages: [
      { pageUrl: refresh.OFFICIAL_PAGES.tournament_schedule, html: fixture("official-tournament-schedule-page.html").toString("utf8") },
      { pageUrl: refresh.OFFICIAL_PAGES.order_of_play, html: fixture("official-order-of-play-page.html").toString("utf8") },
      { pageUrl: refresh.OFFICIAL_PAGES.draws, html: fixture("official-draws-page.html").toString("utf8") },
    ],
    document: parsedDocument,
    retainedResults: {},
    now: "2026-08-14T18:00:00.000Z",
  });
  validateDocument(unavailableResults);
  assert.equal(unavailableResults.resultsByMatchId, undefined);
  assert.deepEqual(unavailableResults.resultAvailability, {
    status: "unavailable",
    checkedAt: "2026-08-14T18:00:00.000Z",
    sourceUrl: null,
    lastCheck: "no_parseable_completed_results",
  }, "approved pages with no explicit completed record must report safe unavailability instead of inventing a result");

  const populatedResults = refresh.attachOfficialResults({
    pages: [{ pageUrl: refresh.OFFICIAL_PAGES.draws, html: completedDrawsHtml }],
    document: parsedDocument,
    retainedResults: {},
    now: "2026-08-14T18:00:00.000Z",
  });
  validateDocument(populatedResults);
  assert.equal(populatedResults.resultAvailability.status, "available");
  assert.equal(populatedResults.resultAvailability.lastCheck, "parsed");
  assert.equal(populatedResults.resultAvailability.sourceUrl, refresh.OFFICIAL_PAGES.draws);
  assert.equal(populatedResults.resultsByMatchId[firstMatch.matchId].score, "6-4 6-3");
  assert(!JSON.stringify(populatedResults.schedule).includes("6-4"), "an extracted score must never leak back into schedule fields");

  const publicSource = {
    id: "fixture-report",
    label: "Public match report",
    url: "https://example.com/cincinnati-report",
    pageRole: "results-and-reporting",
    responseFormat: "html",
    sourceTrust: "unverified",
    reliabilityRank: 2,
  };
  const publicResultHtml = `<!doctype html><html><head>
    <meta property="og:title" content="Cincinnati result: ${firstMatch.players[0].name} v ${firstMatch.players[1].name}">
    <meta property="og:url" content="${publicSource.url}">
    <meta property="article:published_time" content="2026-08-14T18:00:00.000Z">
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      sport: "Tennis",
      eventStatus: "https://schema.org/EventCompleted",
      competitor: firstMatch.players.map(player => ({ "@type": "Person", name: player.name })),
      winner: { "@type": "Person", name: firstMatch.players[0].name },
      score: "6-4 6-3",
    })}</script>
  </head></html>`;
  const publicBundle = await refresh.collectPublicReporting({
    fetchImpl: async url => {
      assert.equal(url, publicSource.url);
      return fakeResponse(publicResultHtml);
    },
    sources: [publicSource],
    document: parsedDocument,
    previous: null,
    now: "2026-08-14T18:00:00.000Z",
  });
  assert.equal(publicBundle.reporting.items.length, 1, "public reporting metadata must be retained for tournament drill-down");
  assert.equal(publicBundle.resultsByMatchId[firstMatch.matchId].sourceTrust, "unverified");
  const withPublicReporting = refresh.attachPublicReporting(parsedDocument, publicBundle, "2026-08-14T18:00:00.000Z");
  validateDocument(withPublicReporting);
  assert.equal(withPublicReporting.resultAvailability.sourceTrust, "unverified");
  assert.equal(withPublicReporting.resultsByMatchId[firstMatch.matchId].sourceName, publicSource.label);
  const publicHidden = jointTennis.spoilerSafeView(withPublicReporting, false);
  assert.equal(publicHidden.reporting, undefined, "results, highlights and commentary must remain hidden with spoilers off");
  const officialWins = refresh.attachPublicReporting(withResult, {
    ...publicBundle,
    resultsByMatchId: {
      [firstMatch.matchId]: { ...publicBundle.resultsByMatchId[firstMatch.matchId], score: "0-6 0-6", winnerPlayerId: firstMatch.players[1].playerId },
    },
  }, "2026-08-14T18:30:00.000Z");
  assert.equal(officialWins.resultsByMatchId[firstMatch.matchId].score, "6-4 6-3", "unverified reporting must never overwrite a conflicting verified result");

  const rainOopSource = reportingSources.SOURCES.find(source => source.id === "cincinnati-rain-oop-mixed");
  const rainDrawSource = reportingSources.SOURCES.find(source => source.id === "cincinnati-rain-atp-draws");
  const wordpressSource = reportingSources.SOURCES.find(source => source.id === "cincinnati-recaps-api");
  const rainOopPayload = [{
    date: "2026-08-11",
    seq: "1",
    courts: [{
      id: 1,
      name: "P&G Stadium Court",
      time: "6:10 PM",
      matches: [{
        id: "MS999",
        status: "Completed",
        type: "atp",
        notBefore: { time: "6:10 PM", text: "Starting at", isoTime: "18:10-0400" },
        team: [
          { players: [{ id: "100", first: "Jannik", last: "Sinner", country: "ITA" }], playersKnown: true },
          { players: [{ id: "200", first: "Novak", last: "Djokovic", country: "SRB" }], playersKnown: true },
        ],
        detail: { rnd: "R32" },
        seq: 1,
      }],
    }],
  }];
  const rainDrawPayload = [{
    code: "MS",
    description: "Men's Singles",
    rounds: [{
      id: "R32",
      matches: [{
        id: "MS999",
        drawInfo: {
          result: "A",
          players: {
            A: [{ id: "100", nF: "Jannik", nL: "Sinner", c: "ITA" }],
            B: [{ id: "200", nF: "Novak", nL: "Djokovic", c: "SRB" }],
          },
        },
        detail: { s1A: 6, s1B: 4, s2A: 6, s2B: 3 },
      }],
    }],
  }];
  const wordpressPayload = [{
    id: 9876,
    date_gmt: "2026-08-11T23:30:00",
    link: "https://cincinnatiopen.com/news/sinner-djokovic-cincinnati-recap/",
    title: { rendered: "Sinner and Djokovic light up Cincinnati" },
    categories: [27],
  }];
  const integratedBodies = new Map([
    [rainOopSource.url, JSON.stringify(rainOopPayload)],
    [rainDrawSource.url, JSON.stringify(rainDrawPayload)],
    [wordpressSource.url, JSON.stringify(wordpressPayload)],
  ]);
  const integratedBundle = await refresh.collectPublicReporting({
    fetchImpl: async url => {
      assert(integratedBodies.has(url), "the integrated-source test must fetch only its declared public endpoints");
      return fakeResponse(integratedBodies.get(url), "application/json");
    },
    sources: [rainOopSource, rainDrawSource, wordpressSource],
    document: parsedDocument,
    previous: null,
    now: "2026-08-14T18:00:00.000Z",
  });
  assert.equal(integratedBundle.matchHistory.length, 1, "the combined Rain OOP must populate a non-current tournament day");
  assert.equal(integratedBundle.matchHistory[0].scheduleDate, "2026-08-11");
  assert.equal(integratedBundle.matchHistory[0].round, "round_of_32");
  assert.equal(integratedBundle.reporting.items[0].sourceRecordId, "wp:9876", "WordPress records must retain a stable source ID");
  const integratedMatchId = integratedBundle.matchHistory[0].matchId;
  assert.equal(integratedBundle.resultsByMatchId[integratedMatchId].score, "6-4 6-3");
  assert.equal(integratedBundle.resultsByMatchId[integratedMatchId].sourceRecordId, "MS999");
  const withIntegratedSources = refresh.attachPublicReporting(parsedDocument, integratedBundle, "2026-08-14T18:00:00.000Z");
  validateDocument(withIntegratedSources);
  assert(withIntegratedSources.matchHistory.some(match => match.matchId === integratedMatchId), "Rain day records must remain addressable in the combined tournament card");
  assert.equal(withIntegratedSources.resultAvailability.sourceTrust, "verified");

  const espnSource = reportingSources.SOURCES.find(source => source.id === "espn-cincinnati-men-2026");
  const espnHtml = `<script>window['__espnfitt__'] = ${JSON.stringify({
    page: {
      content: {
        scoreboard: {
          competitions: {
            "181910": {
              id: "181910",
              status: { description: "Final", state: "post", completed: true },
              competitors: [
                { nm: firstMatch.players[0].name, winner: true, lnescrs: [6, 6] },
                { nm: firstMatch.players[1].name, winner: false, lnescrs: [4, 3] },
              ],
            },
          },
        },
      },
    },
  })};</script>`;
  const espnResults = refresh.extractEmbeddedResultsHtml(espnHtml, {
    document: parsedDocument,
    source: espnSource,
    retrievedAt: "2026-08-14T18:00:00.000Z",
  });
  assert.equal(espnResults[firstMatch.matchId].score, "6-4 6-3", "the ESPN parser must use its embedded JSON assignment and compact score keys");
  assert.equal(espnResults[firstMatch.matchId].sourceTrust, "unverified");
  assert.equal(espnResults[firstMatch.matchId].sourceRecordId, "181910");

  let boundaryFetches = 0;
  const boundaryFetch = async () => {
    boundaryFetches += 1;
    throw new Error("offline boundary fixture");
  };
  const beforeOpening = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-07T13:59:59.999Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(beforeOpening.status, "inactive");
  assert.equal(boundaryFetches, 0, "the instant before the opening Sydney day must not fetch");
  const opening = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-07T14:00:00.000Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(opening.status, "overview", "the opening Sydney day must enter the active refresh path");
  assert.equal(boundaryFetches, Object.keys(refresh.OFFICIAL_PAGES).length, "the active opening boundary must check every approved publisher page");
  const finalDay = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-23T13:59:59.999Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(finalDay.status, "overview", "the final Sydney day must remain active");
  assert.equal(boundaryFetches, Object.keys(refresh.OFFICIAL_PAGES).length * 2, "the active closing boundary must check every approved publisher page");
  const afterSydneyClosing = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-23T14:00:00.000Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(afterSydneyClosing.status, "overview", "Sydney midnight must not stop the check while Cincinnati's final day is still live");
  assert.equal(boundaryFetches, Object.keys(refresh.OFFICIAL_PAGES).length * 3, "the final Cincinnati-local day must still check every approved publisher page");
  const lastLocalInstant = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-24T03:59:59.999Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(lastLocalInstant.status, "overview", "the final Cincinnati-local instant must remain active");
  assert.equal(boundaryFetches, Object.keys(refresh.OFFICIAL_PAGES).length * 4);
  const afterClosing = await refresh.refreshCincinnatiTournament({ fetchImpl: boundaryFetch, now: "2026-08-24T04:00:00.000Z", outputPath: path.join(FIXTURE_DIR, "absent-output.json"), catalogue });
  assert.equal(afterClosing.status, "inactive");
  assert.equal(boundaryFetches, Object.keys(refresh.OFFICIAL_PAGES).length * 4, "the first instant after Cincinnati's final local day must not fetch");

  const duplicate = JSON.parse(JSON.stringify(parsedDocument));
  duplicate.schedule.matches.push(JSON.parse(JSON.stringify(duplicate.schedule.matches[0])));
  assert.throws(() => validateDocument(duplicate), /unique/);
  const leaked = JSON.parse(JSON.stringify(parsedDocument));
  leaked.schedule.matches[0].score = "6-0";
  assert.throws(() => validateDocument(leaked), /leaked/);

  const canonical = JSON.parse(fs.readFileSync(DOCUMENT_PATH, "utf8"));
  validateDocument(canonical);
  if (canonical.freshness.mode === "overview") {
    assert.equal(canonical.schedule.matches.length, 0, "an overview fallback must not present representative fixtures as live data");
  } else {
    assert(["schedule", "stale_schedule"].includes(canonical.freshness.mode));
    assert(canonical.schedule.matches.length > 0, "a published official schedule must contain at least one validated match");
    assert(canonical.schedule.promotedMatchIds.length > 0 && canonical.schedule.promotedMatchIds.length <= 3, "a published official schedule must promote up to three matches");
    canonical.schedule.promotedMatchIds.forEach(matchId => {
      assert(canonical.schedule.matches.some(match => match.matchId === matchId), "every promoted match must exist in the official schedule");
    });
  }
  const bundleSource = fs.readFileSync(BUNDLE_DOCUMENT_PATH, "utf8");
  assert.equal(bundleSource, refresh.renderBundle(canonical), "the direct-file tournament bundle must exactly mirror the canonical JSON");
  const bundleContext = {};
  vm.runInNewContext(bundleSource, bundleContext, { filename: BUNDLE_DOCUMENT_PATH });
  assert.deepEqual(
    JSON.parse(JSON.stringify(bundleContext[refresh.BUNDLE_GLOBAL])),
    canonical,
    "the generated tournament bundle must expose the canonical document on the expected browser global",
  );

  console.log("Joint tennis tournament valid: official schedule discovery, source-ranked public reporting, protected verified facts, PDF parsing, stable IDs, spoiler separation and 24-hour fallback.");
}

if (require.main === module) {
  run().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { run, validateDocument };
