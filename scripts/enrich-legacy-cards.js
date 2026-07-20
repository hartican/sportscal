#!/usr/bin/env node

const { normalizeFeed, readJson, validateFeed, writeJson } = require("./lib/feed-utils");
const { safeCompletedCopy } = require("./lib/storyline-card-rules");

const PLACEHOLDER = "Preserved from the existing nothingSports card set until a newer source supersedes it.";
const SOURCE_CHECKED_AT = "2026-07-16T08:30:00+10:00";

const resultOverrides = {
  evt_78: {
    sourceName: "NFL Super Bowl LX match report",
    sourceUrl: "https://www.nfl.com/news/seahawks-patriots-in-super-bowl-lx-what-we-learned-from-seattle-s-29-13-win",
    sourceType: "official",
    venue: "Levi's Stadium, Santa Clara",
    score: "Seattle Seahawks 29-13 New England Patriots",
    outcomeText: "Seattle won Super Bowl LX; Kenneth Walker III was named MVP.",
    recapText: "Seattle's defence controlled the game with six sacks and three takeaways, while Kenneth Walker III supplied 135 rushing yards to keep the Patriots under pressure.",
    resultLabels: ["Super Bowl LX", "Seattle champions", "Kenneth Walker III MVP"],
  },
  evt_67: {
    sourceName: "PGA TOUR 2026 Masters first-round notes",
    sourceUrl: "https://pgatourmedia.pgatourhq.com/static-assets/page/files/tours/2026/pgatour/masterstournament/roundInfo/R1_Notes.pdf",
    sourceType: "official",
    venue: "Augusta National Golf Club",
    score: "Sam Burns and Rory McIlroy tied for the lead at 5-under (67)",
    outcomeText: "Burns and defending champion McIlroy shared the overnight lead.",
    recapText: "Both leaders opened with 67s. Burns posted his lowest opening round in a major, while McIlroy began his title defence with an eagle and a share of the lead.",
    resultLabels: ["Round 1", "Co-leaders -5"],
  },
  evt_68: {
    sourceName: "PGA TOUR 2026 Masters second-round notes",
    sourceUrl: "https://pgatourmedia.pgatourhq.com/static-assets/page/files/tours/2026/pgatour/masterstournament/roundInfo/R2_Notes.pdf",
    sourceType: "official",
    venue: "Augusta National Golf Club",
    score: "Rory McIlroy led at 12-under (132), six shots clear",
    outcomeText: "McIlroy set the largest 36-hole lead in Masters history.",
    recapText: "A seven-under 65, powered by nine birdies and six in his final seven holes, moved McIlroy six shots clear of Sam Burns and Patrick Reed at the halfway point.",
    resultLabels: ["Round 2", "Leader -12", "Record 36-hole margin"],
  },
  evt_69: {
    sourceName: "PGA TOUR 2026 Masters third-round notes",
    sourceUrl: "https://pgatourmedia.pgatourhq.com/static-assets/page/files/tours/2026/pgatour/masterstournament/roundInfo/R3_Notes.pdf",
    sourceType: "official",
    venue: "Augusta National Golf Club",
    score: "Cameron Young and Rory McIlroy tied at 11-under (205)",
    outcomeText: "Young's 65 erased an eight-shot halfway deficit and created a tie for the final-round lead.",
    recapText: "Moving Day lived up to its name: Young surged from eight behind with a career-low Masters round, while McIlroy's 73 brought the field back into the contest.",
    resultLabels: ["Round 3", "Co-leaders -11"],
  },
  evt_70: {
    sourceName: "PGA TOUR 2026 Masters final-round notes",
    sourceUrl: "https://pgatourmedia.pgatourhq.com/static-assets/page/files/tours/2026/pgatour/masterstournament/roundInfo/R4_Notes.pdf",
    sourceType: "official",
    venue: "Augusta National Golf Club",
    score: "Rory McIlroy won at 12-under (276), one shot ahead of Scottie Scheffler",
    outcomeText: "McIlroy successfully defended the Masters for his sixth major title.",
    recapText: "McIlroy closed with 71 and held off Scheffler's bogey-free 68 by one. The victory made him only the fourth player to win consecutive Masters titles.",
    resultLabels: ["Final round", "Rory McIlroy champion", "Back-to-back titles"],
  },
  evt_71: nbaResult("Knicks 105-95 Spurs", "New York took a 1-0 series lead.", "The Knicks controlled the opener and limited San Antonio to 95 points, establishing the defensive shape of the series."),
  evt_72: nbaResult("Knicks 105-104 Spurs", "New York took a 2-0 series lead.", "A one-point finish gave New York consecutive wins and left San Antonio needing a response when the series shifted venues."),
  evt_73: nbaResult("Spurs 115-111 Knicks", "New York's series lead narrowed to 2-1.", "San Antonio produced its best offensive game of the Finals to win by four and keep the series alive."),
  evt_74: nbaResult("Knicks 107-106 Spurs", "New York moved within one win of the championship at 3-1.", "Another one-point game went New York's way, giving the Knicks three wins in four tightly contested Finals games."),
  evt_75: nbaResult("Knicks 94-90 Spurs", "New York won the NBA Finals 4-1.", "The Knicks closed the series in a lower-scoring Game 5, securing the franchise's first championship since 1973."),
  evt_76: nbaResult("Not played - series ended after Game 5", "Game 6 was not required.", "New York's 4-1 series victory removed the need for the scheduled sixth game; this card remains as an explicit record of the conditional fixture."),
  evt_77: nbaResult("Not played - series ended after Game 5", "Game 7 was not required.", "The Finals ended in five games, so the potential decider was never played. The card is retained to make the original conditional schedule unambiguous."),
  evt_79: {
    sourceName: "Official 24 Hours of Le Mans race start report",
    sourceUrl: "https://www.24h-lemans.com/en/news/2026-24-hours-of-le-mans-the-94th-running-is-underway-60800",
    sourceType: "official",
    venue: "Circuit de la Sarthe, Le Mans",
    score: "62 cars started; Toyota led after the opening hour",
    outcomeText: "The 94th 24 Hours of Le Mans began with Toyota setting the early pace.",
    recapText: "Toyota split the opening strategy across its two cars and emerged at the head of the field after hour one, with BMW close enough to keep the Hypercar contest open.",
    resultLabels: ["Race start", "62 starters", "Toyota early leader"],
  },
  evt_80: {
    sourceName: "Official 2026 24 Hours of Le Mans race report",
    sourceUrl: "https://www.24h-lemans.com/en/news/toyota-take-its-sixth-victory-at-le-mans-60812",
    sourceType: "official",
    venue: "Circuit de la Sarthe, Le Mans",
    score: "#7 Toyota won, 10.9 seconds ahead of #20 BMW",
    outcomeText: "Kamui Kobayashi, Nyck de Vries and Mike Conway delivered Toyota's sixth overall Le Mans victory.",
    recapText: "A disciplined Toyota strategy decided an open Hypercar race. BMW kept the winning #7 car honest to the flag, finishing only 10.9 seconds behind after 24 hours.",
    resultLabels: ["Toyota victory", "#7 Hypercar", "10.9-second margin"],
  },
  evt_8: {
    sourceName: "Wallabies official Australia v Ireland match report",
    sourceUrl: "https://www.wallabies.rugby/news/wallabies-ireland-match-report-scores-reaction-rugby-union-nations-championship-202674",
    sourceType: "official",
    score: "Australia 31-33 Ireland",
    outcomeText: "Ireland completed a late comeback to win by two points in Sydney.",
    recapText: "Australia stayed in the contest to the final kick, but Ireland's late pressure and a decisive closing try overturned the Wallabies' lead in a high-scoring Nations Championship opener.",
    resultLabels: ["Nations Championship", "Ireland by 2"],
  },
  evt_9: {
    sourceName: "2026 Nations Championship results",
    sourceUrl: "https://www.rugby.com.au/news",
    sourceType: "reputable",
    score: "Australia 26-42 France",
    outcomeText: "France overturned a halftime deficit with 30 unanswered second-half points.",
    recapText: "Australia carried a lead into the interval, but France's pace and depth changed the match after halftime. The visitors shut the Wallabies out for the decisive stretch and pulled clear by 16.",
    resultLabels: ["Nations Championship", "France by 16"],
  },
  "rugby-australia-italy-2026-07-18": {
    sourceName: "Official Rugby Australia Wallabies v Italy match centre",
    sourceUrl: "https://www.rugby.com.au/match-centre/114/2026/949577",
    sourceCheckedAt: "2026-07-18T23:03:26+10:00",
    sourceType: "official",
    score: "Australia 57-10 Italy",
    outcomeText: "Australia beat Italy 57-10 in Perth to end Joe Schmidt's Wallabies tenure with a win.",
    recapText: "Australia finished its July Nations Championship home run with a 47-point victory at HBF Park, scoring 57 points and holding Italy to 10 in Joe Schmidt's final Test in charge.",
    resultLabels: ["Nations Championship", "Australia by 47", "Schmidt farewell"],
  },
  evt_18: {
    sourceName: "Official Formula 1 British GP qualifying results",
    sourceUrl: "https://www.formula1.com/en/results/2026/races/1289/united-kingdom/qualifying",
    sourceType: "official",
    venue: "Silverstone Circuit",
    score: "Pole: Kimi Antonelli, 1:28.111",
    outcomeText: "Antonelli qualified ahead of Charles Leclerc and Lewis Hamilton.",
    recapText: "Mercedes took pole through Antonelli, but Ferrari placed both cars in the top three. Oscar Piastri qualified eighth for the highest Australian interest on the grid.",
    resultLabels: ["Qualifying", "Antonelli pole", "Piastri P8"],
  },
  evt_19: {
    sourceName: "Official Formula 1 2026 race results",
    sourceUrl: "https://www.formula1.com/en/results/2026/races",
    sourceType: "official",
    venue: "Silverstone Circuit",
    score: "1 Charles Leclerc; 2 George Russell +0.427s; 3 Lewis Hamilton +0.772s",
    outcomeText: "Leclerc won the British Grand Prix for Ferrari.",
    recapText: "Leclerc converted Ferrari's front-row pace into victory in a compressed finish, with Russell and Hamilton both within eight-tenths at the flag. Piastri's recovery was a secondary storyline after starting eighth.",
    resultLabels: ["Race", "Leclerc winner", "Ferrari victory"],
  },
  evt_20: {
    sourceName: "Official Formula 1 Belgian Grand Prix qualifying report",
    sourceUrl: "https://www.formula1.com/en/latest/article/antonelli-charges-to-pole-position-in-exhilarating-belgian-gp-qualifying.zpGgC6xi6e3QnZEOmi6qS",
    sourceCheckedAt: "2026-07-19T09:14:41+10:00",
    sourceType: "reputable",
    score: "Pole: Kimi Antonelli 1:44.361; 2 Max Verstappen 1:44.678; 3 Lando Norris 1:44.801",
    outcomeText: "Kimi Antonelli took pole at Spa ahead of Max Verstappen, while Lando Norris qualified third but drops to P13 for the race.",
    recapText: "Antonelli led Verstappen in qualifying at Spa. Norris set the third-fastest time but his 10-place power-unit penalty sends him to P13, reshaping the front of the grid for Sunday's race.",
    resultLabels: ["Qualifying", "Antonelli pole", "Norris starts P13"],
  },
  "fifa-third-place-2026": {
    sourceName: "Sky Sports and The Standard match reports (media consensus)",
    sourceUrl: "https://www.skysports.com/football/france-vs-england/549868",
    sourceCheckedAt: "2026-07-19T09:33:58+10:00",
    sourceType: "reputable",
    venue: "Miami Stadium",
    score: "England 6-4 France",
    outcomeText: "England finished third after beating France 6-4 in the bronze final (media-reported consensus).",
    recapText: "Two independent mainstream reports agree on England's 6-4 win. Bukayo Saka scored a hat-trick, with Declan Rice, Ezri Konsa and Jude Bellingham also on the scoresheet; France replied through Kylian Mbappe twice, Bradley Barcola and Ousmane Dembele. FIFA's result feed had not caught up at checking time.",
    resultLabels: ["World Cup bronze final", "England by 2", "Media consensus"],
  },
  evt_57: {
    sourceName: "CyclingNews and L'Équipe stage reports",
    sourceUrl: "https://www.cyclingnews.com/pro-cycling/racing/tour-de-france-tim-merlier-wins-sprint-skirmish-on-stage-12-ahead-of-major-pileup/",
    sourceCheckedAt: "2026-07-19T09:41:04+10:00",
    sourceType: "reputable",
    venue: "Chalon-sur-Saône",
    score: "Stage winner: Tim Merlier",
    outcomeText: "Tim Merlier won Stage 12 in a bunch sprint at Chalon-sur-Saône.",
    recapText: "Merlier claimed his third stage win of the 2026 Tour in the sprint finish, with a late crash affecting the peloton behind him.",
    resultLabels: ["Stage 12", "Tim Merlier winner", "Media consensus"],
  },
  evt_58: {
    sourceName: "Cycling Weekly stage report",
    sourceUrl: "https://www.cyclingweekly.com/racing/tour-de-france/mauro-schmid-outguns-breakaway-partner-to-win-tour-de-france-stage-13",
    sourceCheckedAt: "2026-07-19T09:41:04+10:00",
    sourceType: "reputable",
    venue: "Belfort",
    score: "Stage winner: Mauro Schmid",
    outcomeText: "Mauro Schmid won Stage 13 in Belfort after outsprinting Harold Tejada.",
    recapText: "Schmid and Tejada survived from the breakaway, with Schmid taking the two-up sprint. Tom Pidcock led the chase home in third.",
    resultLabels: ["Stage 13", "Mauro Schmid winner"],
  },
  evt_59: {
    sourceName: "The Guardian and Tour Magazin stage reports",
    sourceUrl: "https://www.theguardian.com/sport/2026/jul/18/pogacar-attacks-on-steepest-climb-to-clinch-another-tour-de-france-stage-win",
    sourceCheckedAt: "2026-07-19T09:41:04+10:00",
    sourceType: "reputable",
    venue: "Le Markstein",
    score: "Stage winner: Tadej Pogačar",
    outcomeText: "Tadej Pogačar won Stage 14 at Le Markstein and extended his Tour lead.",
    recapText: "Pogačar attacked on the final climb to claim his fourth stage win of the 2026 Tour, with the mountain finish reshaping the general-classification gaps.",
    resultLabels: ["Stage 14", "Tadej Pogačar winner", "Media consensus"],
  },
  "nrl-raiders-rabbitohs-2026-07-18": {
    sourceName: "Canberra Raiders match report",
    sourceUrl: "https://www.raiders.com.au/news/2026/07/18/raiders-continue-hot-streak-with-big-win-over-rabbitohs/",
    sourceCheckedAt: "2026-07-19T09:41:04+10:00",
    sourceType: "official",
    venue: "GIO Stadium Canberra",
    score: "Canberra Raiders 34-24 South Sydney Rabbitohs",
    outcomeText: "Canberra made it three straight wins with a 34-24 victory over South Sydney.",
    recapText: "The Raiders built a strong lead, absorbed a Rabbitohs comeback and closed out a ten-point home win in Round 20.",
    resultLabels: ["NRL Round 20", "Canberra by 10"],
  },
  "afl-collingwood-carlton-2026-07-18": {
    sourceName: "AFL media consensus post-match reports",
    sourceUrl: "https://aapnews.aap.com.au/news/collingwood-extend-winning-streak-over-rivals-carlton",
    sourceCheckedAt: "2026-07-19T09:41:04+10:00",
    sourceType: "reputable",
    venue: "Melbourne Cricket Ground",
    score: "Collingwood 14.6 (90) defeated Carlton 10.9 (69)",
    outcomeText: "Collingwood defeated Carlton by 21 points in the MCG clash.",
    recapText: "Collingwood controlled the contest to win 14.6 (90) to 10.9 (69), keeping Carlton at arm's length through the second half.",
    resultLabels: ["AFL Round 19", "Collingwood by 21", "Media consensus"],
  },
};

const tourWinners = [
  [46, "Team Visma | Lease a Bike", "Visma won the opening team time trial and Jonas Vingegaard took the first yellow jersey."],
  [47, "Isaac del Toro", "Del Toro won the hilly finish in Barcelona while Vingegaard retained the overall lead."],
  [48, "Tadej Pogacar", "Pogacar won the first mountain stage to Les Angles and moved into yellow."],
  [49, "Mads Pedersen", "Pedersen won the hilly run to Foix as Tobias Halland Johannessen Traeen moved into the race lead."],
  [50, "Olav Kooij", "Kooij won the flat sprint into Pau."],
  [51, "Tadej Pogacar", "Pogacar won the summit finish at Gavarnie-Gedre and returned to the overall lead."],
  [52, "Tim Merlier", "Merlier won the Bordeaux sprint."],
  [53, "Tim Merlier", "Merlier completed back-to-back sprint wins in Bergerac."],
  [54, "Mathieu van der Poel", "Van der Poel won the hilly stage into Ussel."],
  [55, "Tadej Pogacar", "Pogacar attacked on the Col de Pertus and won by 32 seconds for his third stage victory of the Tour."],
  [56, "Soren Waerenskjold", "Waerenskjold won the flat stage into Nevers."],
];

tourWinners.forEach(([number, winner, analysis]) => {
  resultOverrides[`evt_${number}`] = {
    sourceName: `Official Tour de France Stage ${number - 45} result`,
    sourceUrl: `https://www.letour.fr/en/stage-${number - 45}`,
    sourceType: "official",
    venue: "Tour de France 2026",
    score: `Stage winner: ${winner}`,
    outcomeText: analysis,
    recapText: analysis,
    resultLabels: [`Stage ${number - 45}`, `${winner} winner`],
  };
});

function nbaResult(score, outcomeText, recapText){
  return {
    sourceName: "Official NBA 2026 Finals schedule and results",
    sourceUrl: "https://www.nba.com/news/2026-nba-playoffs-schedule",
    sourceType: "official",
    venue: "2026 NBA Finals",
    score,
    outcomeText,
    recapText,
    resultLabels: ["NBA Finals", score.startsWith("Not played") ? "Not required" : "Completed"],
  };
}

function isPast(event){
  return `${event.date}T${event.time}` < "2026-07-16T08:30";
}

function previewCopy(event){
  const title = event.displayTitleCompact || event.name;
  const venue = event.venue ? ` at ${event.venue}` : "";
  const broadcast = event.broadcaster ? ` Watch via ${event.broadcaster}.` : "";
  const templates = {
    f1: /qualifying/i.test(event.name)
      ? ["Grid-setting session with direct consequences for the race.", `${title}${venue} sets the grid and the strategic shape of the Grand Prix weekend.${broadcast}`]
      : ["A championship race with points, strategy, and Australian interest in play.", `${title}${venue} is the points-paying centrepiece of the weekend, with tyre life, pit timing, and track position likely to decide the result.${broadcast}`],
    tdf: ["A Tour stage worth tracking for its terrain, breakaway chances, and general-classification impact.", `${title} brings a distinct route profile to the 2026 Tour. Follow the stage for the day's winner, jersey changes, and any time gaps among the overall contenders.${broadcast}`],
    nrl: ["A finals appointment with the season narrowing and elimination pressure rising.", `${title}${venue} belongs in the calendar because every result reshapes the premiership path. Team details and the exact matchup should be refreshed when the finals bracket is confirmed.${broadcast}`],
    cricket: ["An Australian Test appointment with series context and a full-day viewing window.", `${title}${venue} opens a new Test chapter. The card keeps the Sydney-local start, broadcast path, and series context together while the official squads and match conditions develop.${broadcast}`],
    rugby: ["A Wallabies Test with selection, form, and international stakes.", `${title}${venue} is a meaningful checkpoint in Australia's 2026 program. Track the confirmed venue, team news, and broadcast path as match week approaches.${broadcast}`],
    ski: ["A World Cup race where speed, conditions, and season standings converge.", `${title}${venue} is retained as a marquee winter-sport appointment. Exact start lists and conditions should be checked against the official FIS programme closer to race day.${broadcast}`],
    nba: ["A potential NBA Finals game retained until the series length is known.", `${title}${venue} is conditional on the series still being alive. The card will convert to a confirmed matchup or a clear not-played record once the preceding result is official.${broadcast}`],
    masters: ["A Masters round with leaderboard movement and major-championship pressure.", `${title}${venue} tracks the day's Augusta leaderboard, cut or contention story, and the route to the green jacket.${broadcast}`],
    lemans: ["A key viewing window in the 24 Hours of Le Mans.", `${title}${venue} marks one of the endurance race's defining moments, with class battles and the overall Hypercar contest carried through the full day-night cycle.${broadcast}`],
    nfl: ["The NFL championship game and the season's final result.", `${title}${venue} is the NFL season's decisive event, combining the championship matchup, broadcast path, and post-game result in one card.${broadcast}`],
    wimbledon: ["A Wimbledon singles match with progression through the draw at stake.", `${title}${venue} remains a useful replay or preview card, with the official score and draw consequence added when verified.${broadcast}`],
  };
  return templates[event.key] || [
    `${title} is scheduled as a relevant ${event.sport} appointment.`,
    `${title}${venue} remains on the calendar with its Sydney-local time and broadcast path. Confirmed participants and result detail will be added from the governing body's source.${broadcast}`,
  ];
}

function resultCopy(event, result){
  const safe = safeCompletedCopy(event);
  return { selectedSentence: safe.hook, fullSpiel: safe.synopsis };
}

function enrichEvent(event){
  const result = resultOverrides[event.id] || resultOverrides[event.eventId];
  if (result){
    return {
      ...event,
      ...result,
      ...resultCopy(event, result),
      sourceCheckedAt: result.sourceCheckedAt || SOURCE_CHECKED_AT,
      status: "completed",
      editorialPreview: undefined,
      round: event.round || "all",
      narrativeType: "post-match",
    };
  }

  const [selectedSentence, fullSpiel] = previewCopy(event);
  return {
    ...event,
    selectedSentence: event.selectedSentence === PLACEHOLDER ? selectedSentence : event.selectedSentence,
    fullSpiel: /remains available from the existing nothingSports card set/i.test(event.fullSpiel || "") ? fullSpiel : event.fullSpiel,
    sourceCheckedAt: event.sourceCheckedAt || SOURCE_CHECKED_AT,
    narrativeType: isPast(event) ? "result-pending" : (event.narrativeType || event.round || "preview"),
  };
}

const melbourneCards = [
  {
    id: "f1-australian-gp-2027-date-watch",
    eventId: "f1-australian-gp-2027-date-watch",
    sport: "F1",
    key: "f1",
    name: "2027 Australian Grand Prix - date confirmation watch",
    displayTitleCompact: "2027 Australian GP - date TBC",
    date: "2027-03-07",
    time: "15:00",
    displayDateLabel: "Date TBC - 2027",
    timeTbc: true,
    broadcaster: "Kayo Sports",
    broadcastOptions: ["Kayo Sports"],
    expected: 10,
    venue: "Albert Park Grand Prix Circuit, Melbourne",
    liveWindow: 4,
    round: "final",
    narrativeType: "calendar-exception",
    selectedSentence: "A deliberate horizon exception for Melbourne's 2027 Formula 1 return; the official race date is still to be confirmed.",
    fullSpiel: "Formula 1 and the Australian Grand Prix Corporation confirm that the championship returns to Albert Park in 2027, but the final 2027 race date is not yet published. This planning card sits beyond the standard feed window on purpose and links directly to the official ticket waitlist instead of presenting an unverified date as fact.",
    sourceName: "Official Formula 1 2027 Australian GP ticket waitlist",
    sourceUrl: "https://ticketing.formula1.com/australia/",
    sourceCheckedAt: SOURCE_CHECKED_AT,
    sourceType: "official",
    ticketUrl: "https://ticketing.formula1.com/australia/",
    ticketSaleStatus: "waitlist-open-date-not-announced",
    horizonException: true,
    calendarExportEligible: false,
    replayEligible: false,
    highlightEligible: false,
    briefingEligible: true,
    catchupEligible: false,
  },
  {
    id: "f1-australian-gp-2027-ticket-watch",
    eventId: "f1-australian-gp-2027-ticket-watch",
    sport: "F1",
    key: "f1",
    name: "2027 Australian Grand Prix ticket-release watch",
    displayTitleCompact: "Melbourne GP tickets - sale week TBC",
    date: "2026-07-20",
    time: "09:00",
    broadcaster: "Official ticket alert",
    broadcastOptions: ["Official Formula 1 ticketing"],
    expected: 8,
    venue: "Albert Park Grand Prix Circuit, Melbourne",
    liveWindow: 24,
    round: "all",
    narrativeType: "ticket-sale-watch",
    selectedSentence: "The 2027 Melbourne ticket sale week is still unannounced; join the official waitlist now for the release alert.",
    fullSpiel: "This week-long alert is the honest ticketing signal currently supported by the official sources. Formula 1 lists the 2027 Australian Grand Prix with a Join the waitlist action, while the Australian Grand Prix Corporation offers registration for release updates. The older grandstand page displays a 2025 sale date and is not treated as a reliable 2027 on-sale date.",
    sourceName: "Official Formula 1 Australian GP ticket waitlist",
    sourceUrl: "https://ticketing.formula1.com/australia/",
    sourceCheckedAt: SOURCE_CHECKED_AT,
    sourceType: "official",
    ticketUrl: "https://www.grandprix.com.au/tickets/register-your-interest",
    ticketSaleStatus: "waitlist-open-date-not-announced",
    horizonException: true,
    replayEligible: false,
    highlightEligible: false,
    briefingEligible: true,
    catchupEligible: false,
  },
];

function enrichLegacyCards(feed, additions = []){
  const withoutMelbourneCards = feed.events.filter(event => !melbourneCards.some(card => card.eventId === event.eventId));
  const events = withoutMelbourneCards.map(enrichEvent).concat(melbourneCards, additions)
    .sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`));
  return normalizeFeed({
    ...feed,
    version: "nothingsport-history-2026-07-16",
    publishedAt: SOURCE_CHECKED_AT,
    sourceNote: "Source-backed historical results, completed legacy card copy, and a transparent 2027 Melbourne ticket watch.",
    events,
  });
}

if (require.main === module){
  const inputPath = process.argv[2] || "feeds/incoming/events.json";
  const outputPath = process.argv[3] || inputPath;
  const output = enrichLegacyCards(readJson(inputPath));
  const errors = validateFeed(output);
  if (errors.length) throw new Error(errors.join("\n"));
  writeJson(outputPath, output);
  console.log(`Enriched ${output.events.length} cards in ${outputPath}.`);
}

module.exports = {
  PLACEHOLDER,
  enrichLegacyCards,
  enrichEvent,
  melbourneCards,
  resultOverrides,
};
