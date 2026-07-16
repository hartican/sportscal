#!/usr/bin/env node

const { readJson, writeJson } = require("./lib/feed-utils");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const outputPath = process.argv[3] || inputPath;
const sourceCheckedAt = "2026-07-16T08:30:00+10:00";
const drawsUrl = "https://www.wimbledon.com/en_GB/scores/draws/2026_MS_draw.pdf";

function scheduleUrl(day){
  return `https://www.wimbledon.com/en_GB/scores/2026/schedule/pdf/schedulePDF${day}.pdf`;
}

function wimbledonCard(card){
  const roundLabel = card.roundLabel;
  const sessionCopy = card.timeTbc
    ? "Wimbledon publishes the court session and order of play rather than an exact start for later matches, so this card shows the verified session opening instead of inventing a match time."
    : "The Sydney-local start is taken from Wimbledon's official order of play.";
  return {
    sport: "Tennis",
    key: "wimbledon",
    broadcaster: "Stan Sport",
    broadcastOptions: ["Stan Sport"],
    sourceName: `Official Wimbledon 2026 ${roundLabel} results`,
    sourceUrl: card.sourceUrl || scheduleUrl(card.scheduleDay),
    sourceCheckedAt,
    sourceType: "official",
    venue: "All England Club, Wimbledon",
    liveWindow: 4,
    round: card.round,
    narrativeType: "post-match",
    replayEligible: true,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: true,
    selectedSentence: `A completed Wimbledon ${roundLabel} match retained as a spoiler-protected replay.`,
    fullSpiel: `${sessionCopy} The official score, outcome, and concise match analysis stay behind the individual spoiler control until deliberately revealed.`,
    resultLabels: [roundLabel, "Completed"],
    ...card,
  };
}

function match(id, name, date, time, round, roundLabel, scheduleDay, score, outcomeText, recapText, extras = {}){
  return wimbledonCard({
    id,
    eventId: id,
    name,
    displayTitleCompact: name,
    date,
    time,
    expected: extras.expected || 7,
    round,
    roundLabel,
    scheduleDay,
    score,
    outcomeText,
    recapText,
    ...extras,
  });
}

const sessionFromEight = {
  timeTbc: true,
  displayTimeLabel: "Order of play; session from 8:00pm AEST",
  scheduleNote: "Exact start followed the preceding match on the assigned court.",
};

const sessionFromTen = {
  timeTbc: true,
  displayTimeLabel: "Order of play; show-court session from 10:00pm AEST",
  scheduleNote: "Exact start followed the preceding match on the assigned show court.",
};

const wimbledonCards = [
  match("evt_0", "Kasatkina vs Osaka - Women's R3", "2026-07-03", "22:00", "early", "Third round", 12, "Naomi Osaka d Daria Kasatkina 6-1 6-3", "Osaka reached the fourth round in straight sets.", "Osaka imposed the cleaner scoreline throughout, conceding only four games and completing the match without needing a deciding set.", { expected: 8, sourceUrl: scheduleUrl(12) }),
  match("evt_1", "De Minaur vs Svajda - Men's R3 🇦🇺", "2026-07-04", "20:00", "early", "Third round", 13, "Alex de Minaur d Zachary Svajda 6-3 6-2 6-2", "De Minaur reached the fourth round in straight sets.", "The Australian improved his control after the opening set and conceded only four games across the final two, completing an efficient straight-sets win.", { expected: 9, sourceUrl: drawsUrl }),

  match("wimbledon-r4-djokovic-safiullin-2026", "Djokovic vs Safiullin - Men's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Novak Djokovic d Roman Safiullin 7-6(6) 6-3 3-6 6-3", "Djokovic reached the quarterfinals in four sets.", "The opening tie-break established Djokovic's advantage. Safiullin forced a fourth set, but Djokovic restored control and closed the match before a decider.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-r4-osaka-sabalenka-2026", "Osaka vs Sabalenka - Women's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Naomi Osaka d Aryna Sabalenka 6-2 7-6(2)", "Osaka eliminated the top seed in straight sets.", "Osaka controlled the first set and then dominated the second-set tie-break, turning a marquee fourth-round meeting into a straight-sets result.", { expected: 10, ...sessionFromEight }),
  match("wimbledon-r4-sinner-mochizuki-2026", "Sinner vs Mochizuki - Men's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Jannik Sinner d Shintaro Mochizuki 6-3 7-6(0) 6-3", "Sinner reached the quarterfinals in straight sets.", "Sinner allowed no momentum swing: the middle-set tie-break ended without a point conceded and the top seed completed the match in three.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-r4-pegula-jovic-2026", "Pegula vs Jovic - Women's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Jessica Pegula d Iva Jovic 4-6 6-3 6-1", "Pegula recovered from a set down to reach the quarterfinals.", "Jovic took the opener, but Pegula reversed the match across the next two sets and conceded only one game in the decider.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-r4-auger-aliassime-davidovich-fokina-2026", "Auger-Aliassime vs Davidovich Fokina - Men's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Felix Auger-Aliassime d Alejandro Davidovich Fokina 6-7(4) 7-6(6) 6-3 6-7(2) 6-1", "Auger-Aliassime reached the quarterfinals after five sets.", "Three tie-break sets kept the contest volatile before Auger-Aliassime finally separated himself, conceding only one game in the fifth.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-r4-gauff-bencic-2026", "Gauff vs Bencic - Women's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Coco Gauff d Belinda Bencic 4-6 6-3 6-4", "Gauff recovered from a set down to reach the quarterfinals.", "Bencic claimed the opening set, but Gauff steadied the match and found the decisive margin in a close third set.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-r4-muchova-krejcikova-2026", "Muchova vs Krejcikova - Women's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Karolina Muchova d Barbora Krejcikova 7-5 5-7 6-3", "Muchova reached the quarterfinals in three sets.", "The first two sets split by identical 7-5 margins before Muchova created the clearer gap in the decider.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-r4-struff-hurkacz-2026", "Struff vs Hurkacz - Men's R4", "2026-07-05", "20:00", "knockout", "Fourth round", 14, "Jan-Lennard Struff d Hubert Hurkacz 3-6 6-7(5) 7-6(2) 7-5 4-2 ret.", "Struff progressed after Hurkacz retired in the fifth set.", "Hurkacz led by two sets, but Struff forced a decider through a tie-break and a late fourth-set break. The match ended by retirement with Struff leading the fifth.", { expected: 8, resultLabels: ["Fourth round", "Retirement"], ...sessionFromEight }),

  match("wimbledon-r4-paolini-eala-2026", "Paolini vs Eala - Women's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Jasmine Paolini d Alexandra Eala 6-4 4-6 6-3", "Paolini reached the quarterfinals in three sets.", "Eala levelled the match in the second set, but Paolini recovered the initiative and made the decisive break stand in the third.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-r4-fery-dimitrov-2026", "Fery vs Dimitrov - Men's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Arthur Fery d Grigor Dimitrov 7-5 3-6 4-6 6-4 7-6(7)", "Fery reached the quarterfinals after a fifth-set tie-break.", "Fery came back from two sets to one down and held his nerve in the deciding tie-break, extending the home wildcard's run into the last eight.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-r4-cobolli-de-minaur-2026", "Cobolli vs De Minaur - Men's R4 🇦🇺", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Flavio Cobolli d Alex de Minaur 7-5 7-6(4) 6-3", "Cobolli ended De Minaur's tournament in straight sets.", "The opening set was decided late and the second in a tie-break. Cobolli then maintained the pressure to prevent an Australian recovery.", { expected: 10, ...sessionFromEight }),
  match("wimbledon-r4-noskova-keys-2026", "Noskova vs Keys - Women's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Linda Noskova d Madison Keys 6-4 7-6(2)", "Noskova reached the quarterfinals in straight sets.", "Noskova protected the first-set margin and dominated the second-set tie-break, closing the match without allowing a decider.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-r4-fritz-bublik-2026", "Fritz vs Bublik - Men's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Taylor Fritz d Alexander Bublik 7-6(1) 6-4 6-4", "Fritz reached the quarterfinals in straight sets.", "Fritz dominated the opening tie-break and found one-set margins in each of the next two, denying Bublik a route back into the match.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-r4-kostyuk-krueger-2026", "Kostyuk vs Krueger - Women's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Marta Kostyuk d Ashlyn Krueger 6-4 6-4", "Kostyuk reached the quarterfinals in straight sets.", "Kostyuk repeated the same controlled margin in both sets, preventing Krueger from extending the contest.", { expected: 7, ...sessionFromEight }),
  match("wimbledon-r4-mertens-bouzkova-2026", "Mertens vs Bouzkova - Women's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Elise Mertens d Marie Bouzkova 6-4 6-4", "Mertens reached the quarterfinals in straight sets.", "Mertens produced matching 6-4 sets, preserving the key service and return margins long enough to avoid a decider.", { expected: 7, ...sessionFromEight }),
  match("wimbledon-r4-zverev-lehecka-2026", "Zverev vs Lehecka - Men's R4", "2026-07-06", "20:00", "knockout", "Fourth round", 15, "Alexander Zverev d Jiri Lehecka 6-4 7-5 3-6 7-6(6)", "Zverev completed the suspended match and reached the quarterfinals.", "Play was suspended at one set in the fourth before completion on 7 July. Lehecka forced the extra session, but Zverev won the closing tie-break.", { expected: 9, resultLabels: ["Fourth round", "Completed 7 July"], ...sessionFromEight }),

  match("wimbledon-qf-gauff-pegula-2026", "Gauff vs Pegula - Women's Quarterfinal", "2026-07-07", "20:00", "quarterfinal", "Quarterfinal", 16, "Coco Gauff d Jessica Pegula 4-6 6-3 6-3", "Gauff recovered from a set down to reach the semifinals.", "Pegula made the stronger start, but Gauff levelled and repeated the 6-3 margin in the decider to complete the comeback.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-qf-djokovic-auger-aliassime-2026", "Djokovic vs Auger-Aliassime - Men's Quarterfinal", "2026-07-07", "20:00", "quarterfinal", "Quarterfinal", 16, "Novak Djokovic d Felix Auger-Aliassime 7-6(10) 3-6 6-3 6-7(4) 7-6(4)", "Djokovic reached the semifinals after five sets.", "Two of the five sets required tie-breaks, including the decider. Djokovic survived the extended opening breaker and finally separated the match in the last one.", { expected: 10, ...sessionFromEight }),
  match("wimbledon-qf-sinner-struff-2026", "Sinner vs Struff - Men's Quarterfinal", "2026-07-07", "20:00", "quarterfinal", "Quarterfinal", 16, "Jannik Sinner d Jan-Lennard Struff 7-5 7-6(4) 6-3", "Sinner reached the semifinals in straight sets.", "Sinner won the tight points in the first two sets, then created a clearer margin in the third to finish without extending the match.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-qf-muchova-osaka-2026", "Muchova vs Osaka - Women's Quarterfinal", "2026-07-07", "20:00", "quarterfinal", "Quarterfinal", 16, "Karolina Muchova d Naomi Osaka 7-6(4) 6-4", "Muchova reached the semifinals in straight sets.", "Muchova took the opening tie-break and then protected a single-break margin in the second, ending Osaka's notable run in two sets.", { expected: 10, ...sessionFromEight }),
  match("wimbledon-qf-kostyuk-paolini-2026", "Kostyuk vs Paolini - Women's Quarterfinal", "2026-07-08", "20:00", "quarterfinal", "Quarterfinal", 17, "Marta Kostyuk d Jasmine Paolini 6-3 6-2", "Kostyuk reached the semifinals in straight sets.", "Kostyuk increased her control from the first set to the second, conceding only five games across a compact quarterfinal.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-qf-fery-cobolli-2026", "Fery vs Cobolli - Men's Quarterfinal", "2026-07-08", "20:00", "quarterfinal", "Quarterfinal", 17, "Arthur Fery d Flavio Cobolli 6-4 7-6(4) 6-0", "Fery reached the semifinals in straight sets.", "Fery won a tight opening set and tie-break before accelerating through a one-sided third, extending the British wildcard's run into the last four.", { expected: 9, ...sessionFromEight }),
  match("wimbledon-qf-noskova-mertens-2026", "Noskova vs Mertens - Women's Quarterfinal", "2026-07-08", "20:00", "quarterfinal", "Quarterfinal", 17, "Linda Noskova d Elise Mertens 6-3 7-5", "Noskova reached the semifinals in straight sets.", "Noskova established the early advantage and then closed a tighter second set late, completing the quarterfinal without a decider.", { expected: 8, ...sessionFromEight }),
  match("wimbledon-qf-zverev-fritz-2026", "Zverev vs Fritz - Men's Quarterfinal", "2026-07-08", "20:00", "quarterfinal", "Quarterfinal", 17, "Alexander Zverev d Taylor Fritz 6-4 6-4 6-2", "Zverev reached the semifinals in straight sets.", "Zverev repeated a one-break margin in the first two sets and widened it in the third, completing the most direct men's quarterfinal result.", { expected: 9, ...sessionFromEight }),

  match("wimbledon-sf-muchova-gauff-2026", "Muchova vs Gauff - Women's Semifinal", "2026-07-09", "22:00", "semifinal", "Semifinal", 18, "Karolina Muchova d Coco Gauff 6-2 1-6 7-6(10)", "Muchova reached the Wimbledon final after a deciding tie-break.", "The first two sets swung sharply in opposite directions. Muchova then won an extended deciding tie-break to settle the semifinal at its narrowest point.", { expected: 10, ...sessionFromTen }),
  match("wimbledon-sf-noskova-kostyuk-2026", "Noskova vs Kostyuk - Women's Semifinal", "2026-07-09", "22:00", "semifinal", "Semifinal", 18, "Linda Noskova d Marta Kostyuk 6-4 6-4", "Noskova reached the Wimbledon final in straight sets.", "Noskova maintained matching margins in both sets, staying composed through the semifinal pressure to book her place in the final.", { expected: 9, ...sessionFromTen }),
  match("wimbledon-sf-zverev-fery-2026", "Zverev vs Fery - Men's Semifinal", "2026-07-10", "22:00", "semifinal", "Semifinal", 19, "Alexander Zverev d Arthur Fery 7-6(0) 6-2 6-4", "Zverev reached the Wimbledon final in straight sets.", "Fery reached a tie-break in the opener, but Zverev shut it out and controlled the next two sets to end the wildcard's run.", { expected: 9, ...sessionFromTen }),
  match("wimbledon-sf-sinner-djokovic-2026", "Sinner vs Djokovic - Men's Semifinal", "2026-07-10", "22:00", "semifinal", "Semifinal", 19, "Jannik Sinner d Novak Djokovic 6-4 6-4 6-4", "Sinner reached the Wimbledon final in straight sets.", "Sinner found the same decisive margin in every set, preventing Djokovic from extending a semifinal that remained competitive but consistently tilted one way.", { expected: 10, ...sessionFromTen }),
  match("wimbledon-final-noskova-muchova-2026", "Noskova vs Muchova - Women's Final", "2026-07-12", "01:00", "final", "Women's final", 20, "Linda Noskova d Karolina Muchova 6-2 5-7 6-3", "Noskova won the 2026 Wimbledon women's singles title.", "Noskova made the faster start, absorbed Muchova's second-set response and re-established control in the decider to claim the championship.", { expected: 10, startTimeUtc: "2026-07-11T15:00:00Z", endTimeUtc: "2026-07-11T18:00:00Z" }),
  match("wimbledon-final-sinner-zverev-2026", "Sinner vs Zverev - Men's Final", "2026-07-13", "01:00", "final", "Men's final", 21, "Jannik Sinner d Alexander Zverev 6-7(7) 7-6(2) 6-3 6-4", "Sinner won the 2026 Wimbledon men's singles title.", "After losing the opening tie-break, Sinner dominated the second-set breaker and then created the clearer margins across the final two sets to secure the title.", { expected: 10, startTimeUtc: "2026-07-12T15:00:00Z", endTimeUtc: "2026-07-12T19:00:00Z" }),
];

function rewriteWimbledonCards(feed){
  const retained = feed.events.filter(event => event.key !== "wimbledon");
  const events = retained.concat(wimbledonCards)
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  return {
    ...feed,
    version: "nothingsport-history-2026-07-16",
    publishedAt: sourceCheckedAt,
    sourceNote: "Official Wimbledon singles results from the retained third-round cards through every fourth-round, quarterfinal, semifinal and final match.",
    events,
  };
}

if (require.main === module){
  const feed = rewriteWimbledonCards(readJson(inputPath));
  writeJson(outputPath, feed);
  console.log(`Rewrote Wimbledon cards in ${outputPath}: ${wimbledonCards.length} singles events, ${feed.events.length} total.`);
}

module.exports = { rewriteWimbledonCards, wimbledonCards };
