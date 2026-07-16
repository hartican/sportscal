#!/usr/bin/env node

const { readJson, writeJson } = require("./lib/feed-utils");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const outputPath = process.argv[3] || inputPath;
const sourceUrl = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums";
const sourceCheckedAt = "2026-07-16T08:30:00+10:00";
const defaultCopySpoilerGuard = /\b(?:advanced|beat|defeated|won)\b|\b\d+\s*[-–]\s*\d+\b/i;

function fifaCard(card){
  const completed = Boolean(card.score);
  const safeRound = card.roundLabel || card.round;
  return {
    sport: "Football",
    key: "fifa",
    broadcaster: "SBS On Demand",
    broadcastOptions: ["SBS On Demand"],
    sourceName: "Official FIFA World Cup 2026 schedule and results",
    sourceUrl,
    sourceCheckedAt,
    sourceType: "official",
    liveWindow: card.liveWindow || 3,
    replayEligible: true,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: true,
    narrativeType: completed ? "post-match" : (card.narrativeType || card.round),
    selectedSentence: completed
      ? `A completed ${safeRound} fixture retained as a spoiler-protected replay.`
      : card.selectedSentence,
    fullSpiel: completed
      ? `This ${safeRound} match is retained with its official score, outcome, and a concise match analysis. Those result details stay behind the individual spoiler control until the viewer deliberately reveals them.`
      : card.fullSpiel,
    ...card,
  };
}

function resultCard(id, name, date, time, startTimeUtc, venue, round, score, outcomeText, recapText, extras = {}){
  return fifaCard({
    id,
    eventId: id,
    name,
    displayTitleCompact: name,
    date,
    time,
    startTimeUtc,
    endTimeUtc: new Date(Date.parse(startTimeUtc) + 3 * 60 * 60 * 1000).toISOString(),
    expected: extras.expected || 8,
    venue,
    round,
    roundLabel: extras.roundLabel || round,
    score,
    outcomeText,
    recapText,
    resultLabels: [extras.roundLabel || round, extras.resultLabel || "Completed"],
    ...extras,
  });
}

const fifaCards = [
  resultCard("fifa-group-australia-turkiye-2026", "Australia vs Türkiye - Group D", "2026-06-14", "14:00", "2026-06-14T04:00:00Z", "BC Place Vancouver", "early", "Australia 2-0 Türkiye", "Australia opened its campaign with three points.", "Australia handled the opening-game pressure, kept Türkiye scoreless and established a strong platform in Group D.", { expected: 9, roundLabel: "Group D" }),
  resultCard("fifa-group-usa-australia-2026", "USA vs Australia - Group D", "2026-06-20", "05:00", "2026-06-19T19:00:00Z", "Seattle Stadium", "early", "USA 2-0 Australia", "The hosts took the Group D points in Seattle.", "The United States used home support and a clean sheet to halt Australia's early momentum, leaving qualification to be settled in the final group match.", { expected: 9, roundLabel: "Group D" }),
  resultCard("fifa-group-paraguay-australia-2026", "Paraguay vs Australia - Group D", "2026-06-26", "12:00", "2026-06-26T02:00:00Z", "San Francisco Bay Area Stadium", "early", "Paraguay 0-0 Australia", "Australia progressed after a scoreless final group match.", "A disciplined defensive performance delivered the point Australia needed. The goalless draw closed the group stage and sent the Socceroos into the knockouts.", { expected: 9, roundLabel: "Group D" }),
  resultCard("fifa-r32-australia-egypt-2026", "Australia vs Egypt - Round of 32", "2026-07-04", "04:00", "2026-07-03T18:00:00Z", "Dallas Stadium", "knockout", "1-1 (Egypt won 4-2 on penalties)", "Egypt progressed after the penalty shootout.", "Australia stayed level through regulation and extra time, but Egypt converted the decisive shootout kicks to end the Socceroos' tournament in the Round of 32.", { expected: 10, roundLabel: "Round of 32", resultLabel: "Penalty shootout" }),

  resultCard("fifa-r16-paraguay-france-2026", "Paraguay vs France - Round of 16", "2026-07-05", "07:00", "2026-07-04T21:00:00Z", "Philadelphia Stadium", "knockout", "Paraguay 0-1 France", "France reached the quarterfinals.", "France found the only goal in a tight knockout match and protected the lead, ending Paraguay's run without allowing the contest to open up.", { roundLabel: "Round of 16" }),
  resultCard("fifa-r16-canada-morocco-2026", "Canada vs Morocco - Round of 16", "2026-07-05", "03:00", "2026-07-04T17:00:00Z", "Houston Stadium", "knockout", "Canada 0-3 Morocco", "Morocco reached the quarterfinals.", "Morocco paired a clean sheet with three goals to control the tie, absorbing the hosts' energy before turning the match decisively in their favour.", { roundLabel: "Round of 16" }),
  resultCard("fifa-r16-brazil-norway-2026", "Brazil vs Norway - Round of 16", "2026-07-06", "06:00", "2026-07-05T20:00:00Z", "New York New Jersey Stadium", "knockout", "Brazil 1-2 Norway", "Norway eliminated Brazil and reached the quarterfinals.", "Norway delivered one of the round's major upsets, matching Brazil's technical threat and taking the chances that carried them into the last eight.", { expected: 9, roundLabel: "Round of 16" }),
  resultCard("fifa-r16-mexico-england-2026", "Mexico vs England - Round of 16", "2026-07-06", "10:00", "2026-07-06T00:00:00Z", "Mexico City Stadium", "knockout", "Mexico 2-3 England", "England survived a five-goal match to reach the quarterfinals.", "England came through a volatile knockout game in Mexico City. Mexico kept the hosts in the contest, but England's third goal proved decisive.", { expected: 9, roundLabel: "Round of 16" }),
  resultCard("fifa-r16-portugal-spain-2026", "Portugal vs Spain - Round of 16", "2026-07-07", "05:00", "2026-07-06T19:00:00Z", "Dallas Stadium", "knockout", "Portugal 0-1 Spain", "Spain reached the quarterfinals with a clean sheet.", "A single goal separated the Iberian rivals. Spain controlled enough of the match to protect the margin and close out a high-pressure knockout tie.", { expected: 9, roundLabel: "Round of 16" }),
  resultCard("fifa-r16-usa-belgium-2026", "USA vs Belgium - Round of 16", "2026-07-07", "10:00", "2026-07-07T00:00:00Z", "Seattle Stadium", "knockout", "USA 1-4 Belgium", "Belgium ended the hosts' campaign and reached the quarterfinals.", "Belgium's attacking quality produced the round's widest knockout margin, with four goals overcoming the energy of a home crowd in Seattle.", { expected: 9, roundLabel: "Round of 16" }),
  resultCard("fifa-r16-argentina-egypt-2026", "Argentina vs Egypt - Round of 16", "2026-07-08", "02:00", "2026-07-07T16:00:00Z", "Atlanta Stadium", "knockout", "Argentina 3-2 Egypt", "Argentina reached the quarterfinals after a five-goal contest.", "Egypt continued its knockout run with two goals, but Argentina's third strike settled an open match and secured the reigning champions' place in the last eight.", { expected: 9, roundLabel: "Round of 16" }),
  resultCard("fifa-r16-switzerland-colombia-2026", "Switzerland vs Colombia - Round of 16", "2026-07-08", "06:00", "2026-07-07T20:00:00Z", "BC Place Vancouver", "knockout", "0-0 (Switzerland won 4-3 on penalties)", "Switzerland progressed through the penalty shootout.", "Neither side found a goal through regulation and extra time. Switzerland held their nerve from the spot to claim the final quarterfinal place.", { roundLabel: "Round of 16", resultLabel: "Penalty shootout" }),

  resultCard("fifa-qf-france-morocco-2026", "France vs Morocco - Quarterfinal", "2026-07-10", "06:00", "2026-07-09T20:00:00Z", "Boston Stadium", "quarterfinal", "France 2-0 Morocco", "France reached the semifinals.", "France combined two goals with a clean sheet to end Morocco's run, controlling the decisive phases and earning the first place in the last four.", { roundLabel: "Quarterfinal" }),
  resultCard("fifa-qf-spain-belgium-2026", "Spain vs Belgium - Quarterfinal", "2026-07-11", "05:00", "2026-07-10T19:00:00Z", "Los Angeles Stadium", "quarterfinal", "Spain 2-1 Belgium", "Spain reached the semifinals.", "Spain survived sustained Belgian pressure in a high-quality quarterfinal, making a narrow lead stand to secure a last-four meeting with France.", { expected: 9, roundLabel: "Quarterfinal" }),
  resultCard("fifa-qf-norway-england-2026", "Norway vs England - Quarterfinal", "2026-07-12", "07:00", "2026-07-11T21:00:00Z", "Miami Stadium", "quarterfinal", "Norway 1-2 England (after extra time)", "England reached the semifinals after extra time.", "Norway extended its breakthrough run into extra time, where England found the decisive goal and completed another demanding knockout win.", { expected: 9, roundLabel: "Quarterfinal", resultLabel: "Extra time" }),
  resultCard("fifa-qf-argentina-switzerland-2026", "Argentina vs Switzerland - Quarterfinal", "2026-07-12", "11:00", "2026-07-12T01:00:00Z", "Kansas City Stadium", "quarterfinal", "Argentina 3-1 Switzerland (after extra time)", "Argentina reached the semifinals after extra time.", "Switzerland forced the reigning champions beyond 90 minutes, but Argentina pulled clear in extra time to complete the semifinal line-up.", { expected: 9, roundLabel: "Quarterfinal", resultLabel: "Extra time" }),

  resultCard("fifa-sf-1-2026", "France vs Spain - Semifinal", "2026-07-15", "05:00", "2026-07-14T19:00:00Z", "Dallas Stadium", "semifinal", "France 0-2 Spain", "Spain reached the World Cup final.", "Mikel Oyarzabal converted a first-half penalty and Pedro Porro added the second after the break. Spain frustrated France at one end and punished them at the other.", {
    expected: 10,
    roundLabel: "Semifinal",
    displayTitleCompact: "World Cup Semifinal 1",
    spoilerSafeTitle: "World Cup Semifinal 1",
    matchupParticipants: [
      { name: "France", sourceEventId: "fifa-qf-france-morocco-2026" },
      { name: "Spain", sourceEventId: "fifa-qf-spain-belgium-2026" },
    ],
    sourceName: "Official FIFA France v Spain match report",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/france-spain-match-report-highlights",
  }),
  resultCard(
    "fifa-sf-2-2026",
    "England vs Argentina - Semifinal",
    "2026-07-16",
    "05:00",
    "2026-07-15T19:00:00Z",
    "Atlanta Stadium",
    "semifinal",
    "England 1-2 Argentina",
    "Argentina reached the World Cup final against Spain; England move to the third-place playoff against France.",
    "Gordon put England ahead after half-time, but Argentina's late pressure told. Fernandez levelled from distance and Martinez completed the comeback in the 92nd minute, with Messi involved in both goals.",
    {
    displayTitleCompact: "World Cup Semifinal 2",
    spoilerSafeTitle: "World Cup Semifinal 2",
    expected: 10,
    liveWindow: 4,
    roundLabel: "Semifinal",
    fullSpiel: "England led through Anthony Gordon, but Argentina turned the semifinal around in the final minutes. Enzo Fernandez equalised in the 85th minute before Lautaro Martinez headed the stoppage-time winner from Lionel Messi's cross.",
    sourceName: "AP and Sky Sports match reports",
    sourceUrl: "https://apnews.com/article/world-cup-england-argentina-score-2ae6a218ae88248db6565ffd13f60d38",
    sourceCheckedAt: "2026-07-16T23:41:39+10:00",
    sourceType: "reputable",
    matchupParticipants: [
      { name: "England", sourceEventId: "fifa-qf-norway-england-2026" },
      { name: "Argentina", sourceEventId: "fifa-qf-argentina-switzerland-2026" },
    ],
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
    selectedSentence: "The bronze match remains useful for tournament completists, with its pairing protected.",
    fullSpiel: "The third-place playoff stays in the calendar with its confirmed Sydney time and broadcast path. Its full pairing remains protected until both semifinal outcomes are official and deliberately revealed.",
    matchupParticipants: [
      { name: "France", sourceEventId: "fifa-sf-1-2026" },
      { name: "England", sourceEventId: "fifa-sf-2-2026" },
    ],
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
    selectedSentence: "The tournament's defining appointment remains bracket-safe until the semifinals are revealed.",
    fullSpiel: "The World Cup final is the anchor card for the remaining calendar: global stakes, a clear SBS broadcast path, and a Monday 5:00am Sydney start. The full matchup remains protected until both source semifinals are official and deliberately revealed.",
    matchupParticipants: [
      { name: "Spain", sourceEventId: "fifa-sf-1-2026" },
      { name: "Argentina", sourceEventId: "fifa-sf-2-2026" },
    ],
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
    version: "nothingsport-history-2026-07-16",
    publishedAt: sourceCheckedAt,
    sourceNote: "Source-backed historical results, complete World Cup coverage from Australia's campaign and the Round of 16 onward, and spoiler-safe live bracket cards.",
    events,
  };
}

if (require.main === module){
  const feed = rewriteFifaCards(readJson(inputPath));
  writeJson(outputPath, feed);
  console.log(`Rewrote FIFA cards in ${outputPath}: ${fifaCards.length} tournament events, ${feed.events.length} total.`);
}

module.exports = { fifaCards, rewriteFifaCards };
