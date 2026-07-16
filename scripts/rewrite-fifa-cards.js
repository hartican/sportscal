#!/usr/bin/env node

const { readJson, writeJson } = require("./lib/feed-utils");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const outputPath = process.argv[3] || inputPath;
const sourceUrl = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums";
const sourceCheckedAt = "2026-07-16T21:00:00+10:00";
const defaultCopySpoilerGuard = /\b(?:advanced|beat|defeated|won)\b|\b\d+\s*[-–]\s*\d+\b/i;

function review(note){
  return {
    reviewRequired: true,
    reviewComplete: false,
    note,
  };
}

function fifaCard(card){
  return {
    sport: "Football",
    key: "fifa",
    broadcaster: "SBS On Demand",
    broadcastOptions: ["SBS On Demand"],
    sourceName: "Official FIFA World Cup 2026 match schedule",
    sourceUrl,
    sourceCheckedAt,
    sourceType: "official",
    liveWindow: 3,
    replayEligible: true,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: true,
    ...card,
  };
}

const fifaCards = [
  fifaCard({
    id: "fifa-r32-australia-egypt-2026",
    eventId: "fifa-r32-australia-egypt-2026",
    name: "Australia vs Egypt - Round of 32",
    displayTitleCompact: "Australia vs Egypt - Round of 32",
    date: "2026-07-04",
    time: "12:30",
    startTimeUtc: "2026-07-04T02:30:00Z",
    endTimeUtc: "2026-07-04T05:30:00Z",
    expected: 9,
    venue: "Dallas Stadium",
    round: "knockout",
    narrativeType: "knockout",
    selectedSentence: "Australia's knockout match stays available in spoiler-safe replay framing.",
    fullSpiel: "Australia's Round of 32 fixture is retained as a high-stakes replay card. The default card names the fixture but keeps the score, shootout outcome, and downstream bracket consequences behind the deliberate spoiler reveal.",
    score: "1-1 (Egypt won 4-2 on penalties)",
    outcomeText: "Egypt advanced after a penalty shootout.",
    resultLabels: ["Round of 32", "Penalty shootout"],
    copyReview: review("Australian knockout rewrite sourced from FIFA; confirm tone before publishing."),
  }),
  fifaCard({
    id: "fifa-qf-france-morocco-2026",
    eventId: "fifa-qf-france-morocco-2026",
    name: "France vs Morocco - Quarterfinal",
    displayTitleCompact: "France vs Morocco - Quarterfinal",
    date: "2026-07-10",
    time: "06:00",
    startTimeUtc: "2026-07-09T20:00:00Z",
    endTimeUtc: "2026-07-09T23:00:00Z",
    expected: 8,
    venue: "Boston Stadium",
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "A recent World Cup quarterfinal kept in spoiler-safe replay framing.",
    fullSpiel: "This recent knockout fixture has genuine replay value, so the default card avoids the result and bracket consequence. Reveal the protected details only when you are ready to see how the first quarterfinal shaped the last four.",
    score: "France 2-0 Morocco",
    outcomeText: "France advanced to the semifinals.",
    resultLabels: ["Quarterfinal", "Completed"],
    copyReview: review("Recent knockout copy must stay spoiler-safe until human review confirms the reveal flow."),
  }),
  fifaCard({
    id: "fifa-qf-spain-belgium-2026",
    eventId: "fifa-qf-spain-belgium-2026",
    name: "Spain vs Belgium - Quarterfinal",
    displayTitleCompact: "Spain vs Belgium - Quarterfinal",
    date: "2026-07-11",
    time: "05:00",
    startTimeUtc: "2026-07-10T19:00:00Z",
    endTimeUtc: "2026-07-10T22:00:00Z",
    expected: 9,
    venue: "Los Angeles Stadium",
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "A title-contender quarterfinal with enough quality to justify a protected replay.",
    fullSpiel: "Spain and Belgium brought title-contender stakes to the second quarterfinal. The default card preserves the matchup and replay value without exposing the winner or the downstream semifinal pairing.",
    score: "Spain 2-1 Belgium",
    outcomeText: "Spain advanced to the semifinals.",
    resultLabels: ["Quarterfinal", "Completed"],
    copyReview: review("Marquee knockout copy should be checked for spoiler-safe bracket wording."),
  }),
  fifaCard({
    id: "fifa-qf-norway-england-2026",
    eventId: "fifa-qf-norway-england-2026",
    name: "Norway vs England - Quarterfinal",
    displayTitleCompact: "Norway vs England - Quarterfinal",
    date: "2026-07-12",
    time: "07:00",
    startTimeUtc: "2026-07-11T21:00:00Z",
    endTimeUtc: "2026-07-12T00:00:00Z",
    expected: 9,
    venue: "Miami Stadium",
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "Star power and knockout pressure make this a strong spoiler-safe replay candidate.",
    fullSpiel: "Norway versus England combined a heavyweight forward matchup with semifinal stakes. The result and bracket consequence remain protected until the user reveals, rates, or archives the event.",
    score: "England 2-1 Norway (after extra time)",
    outcomeText: "England advanced to the semifinals.",
    resultLabels: ["Quarterfinal", "Extra time"],
    copyReview: review("Marquee knockout copy should be checked for spoiler-safe bracket wording."),
  }),
  fifaCard({
    id: "fifa-qf-argentina-switzerland-2026",
    eventId: "fifa-qf-argentina-switzerland-2026",
    name: "Argentina vs Switzerland - Quarterfinal",
    displayTitleCompact: "Argentina vs Switzerland - Quarterfinal",
    date: "2026-07-12",
    time: "11:00",
    startTimeUtc: "2026-07-12T01:00:00Z",
    endTimeUtc: "2026-07-12T04:00:00Z",
    expected: 9,
    venue: "Kansas City Stadium",
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "The final quarterfinal remains a high-value replay without exposing the last-four bracket.",
    fullSpiel: "Argentina versus Switzerland completed the quarterfinal set in a Sydney-friendly replay window. Default copy stays focused on the matchup and stakes, with the result and semifinal consequence protected.",
    score: "Argentina 3-1 Switzerland (after extra time)",
    outcomeText: "Argentina advanced to the semifinals.",
    resultLabels: ["Quarterfinal", "Extra time"],
    copyReview: review("Marquee knockout copy should be checked for spoiler-safe bracket wording."),
  }),
  fifaCard({
    id: "fifa-sf-1-2026",
    eventId: "fifa-sf-1-2026",
    name: "France vs Spain - Semifinal",
    displayTitleCompact: "World Cup Semifinal 1",
    spoilerSafeTitle: "World Cup Semifinal 1",
    date: "2026-07-15",
    time: "05:00",
    startTimeUtc: "2026-07-14T19:00:00Z",
    endTimeUtc: "2026-07-14T22:00:00Z",
    expected: 10,
    venue: "Dallas Stadium",
    round: "semifinal",
    narrativeType: "semifinal",
    selectedSentence: "A recent World Cup semifinal kept opaque until its quarterfinal branches are revealed.",
    fullSpiel: "The first semifinal is protected as a recent knockout event. Timing, broadcast path, and stakes remain useful by default; participants and the final implication appear only as the relevant source matches are legitimately revealed.",
    matchupParticipants: [
      { name: "France", sourceEventId: "fifa-qf-france-morocco-2026" },
      { name: "Spain", sourceEventId: "fifa-qf-spain-belgium-2026" },
    ],
    outcomeText: "Spain advanced to the World Cup final.",
    resultLabels: ["Semifinal", "Completed"],
    copyReview: review("Recent semifinal participants must stay hidden until their source quarterfinals are revealed."),
  }),
  fifaCard({
    id: "fifa-sf-2-2026",
    eventId: "fifa-sf-2-2026",
    name: "England vs Argentina - Semifinal",
    displayTitleCompact: "World Cup Semifinal 2",
    spoilerSafeTitle: "World Cup Semifinal 2",
    date: "2026-07-16",
    time: "05:00",
    startTimeUtc: "2026-07-15T19:00:00Z",
    endTimeUtc: "2026-07-15T22:00:00Z",
    expected: 10,
    venue: "Atlanta Stadium",
    round: "semifinal",
    narrativeType: "semifinal",
    selectedSentence: "Today's second semifinal stays bracket-safe until the user reveals its source matches.",
    fullSpiel: "The second semifinal remains useful as a protected appointment or replay card without exposing the preceding quarterfinal outcomes. Reveal the relevant branches deliberately when you are ready for the matchup detail.",
    matchupParticipants: [
      { name: "England", sourceEventId: "fifa-qf-norway-england-2026" },
      { name: "Argentina", sourceEventId: "fifa-qf-argentina-switzerland-2026" },
    ],
    copyReview: review("Same-day semifinal participants must stay hidden until their source quarterfinals are revealed."),
  }),
  fifaCard({
    id: "fifa-third-place-2026",
    eventId: "fifa-third-place-2026",
    name: "World Cup Third-Place Playoff",
    displayTitleCompact: "World Cup Third-Place Playoff",
    spoilerSafeTitle: "World Cup Third-Place Playoff",
    date: "2026-07-19",
    time: "07:00",
    startTimeUtc: "2026-07-18T21:00:00Z",
    endTimeUtc: "2026-07-19T00:00:00Z",
    expected: 6,
    venue: "Miami Stadium",
    round: "final",
    narrativeType: "final",
    selectedSentence: "Useful for tournament completists, but lower priority than the final.",
    fullSpiel: "The third-place playoff remains in the calendar for World Cup completists. Its matchup is deliberately generic until both semifinal outcomes are safe to reveal, while the confirmed Sydney time and broadcast path stay useful.",
    matchupParticipants: [
      { name: "France", sourceEventId: "fifa-sf-1-2026" },
      { name: "Semifinal 2 runner-up", sourceEventId: "fifa-sf-2-2026" },
    ],
    copyReview: review("Update the second participant after an official semifinal result is available."),
  }),
  fifaCard({
    id: "fifa-final-2026",
    eventId: "fifa-final-2026",
    name: "FIFA World Cup Final",
    displayTitleCompact: "FIFA World Cup Final",
    spoilerSafeTitle: "FIFA World Cup Final",
    date: "2026-07-20",
    time: "05:00",
    startTimeUtc: "2026-07-19T19:00:00Z",
    endTimeUtc: "2026-07-19T23:00:00Z",
    expected: 10,
    venue: "New York New Jersey Stadium",
    liveWindow: 4,
    round: "final",
    narrativeType: "final",
    selectedSentence: "The tournament's defining appointment, kept bracket-safe until the semifinals are revealed.",
    fullSpiel: "The World Cup final is the anchor card for the remaining calendar: global stakes, a clear SBS broadcast path, and a Monday 5:00am Sydney start. The matchup remains protected until the source semifinals are legitimately revealed.",
    matchupParticipants: [
      { name: "Spain", sourceEventId: "fifa-sf-1-2026" },
      { name: "Semifinal 2 winner", sourceEventId: "fifa-sf-2-2026" },
    ],
    copyReview: review("Update the second finalist after an official semifinal result is available."),
  }),
];

function rewriteFifaCards(feed){
  const leaks = fifaCards.filter(event => defaultCopySpoilerGuard.test([
    event.displayTitleCompact,
    event.spoilerSafeTitle,
    event.selectedSentence,
    event.fullSpiel,
  ].filter(Boolean).join(" | ")));
  if (leaks.length){
    throw new Error(`Default FIFA copy failed the spoiler guard: ${leaks.map(event => event.id).join(", ")}`);
  }
  const retained = feed.events.filter(event => event.key !== "fifa");
  const events = retained.concat(fifaCards)
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  return {
    ...feed,
    version: "nothingsport-phase3-2026-07-16",
    publishedAt: sourceCheckedAt,
    sourceNote: "Source-backed NothingSport feed with spoiler-safe FIFA knockout rewrites and preserved multi-sport coverage.",
    events,
  };
}

if (require.main === module){
  const feed = rewriteFifaCards(readJson(inputPath));
  writeJson(outputPath, feed);
  console.log(`Rewrote FIFA cards in ${outputPath}: ${fifaCards.length} current tournament events, ${feed.events.length} total.`);
}

module.exports = { fifaCards, rewriteFifaCards };
