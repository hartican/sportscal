const fs = require("fs");
const {
  activeSportsFor,
  readJson,
  summarizeFeedHorizon,
  writeJson,
} = require("./lib/feed-utils");

const html = fs.readFileSync("index.html", "utf8");
const match = html.match(/const EVENTS = (\[[\s\S]*?\]);\n\nconst SPORT_META/);

if (!match) {
  throw new Error("EVENTS block not found in index.html");
}

const events = JSON.parse(match[1]);
const sourceCheckedAt = "2026-07-10T08:30:00+10:00";
const qfSource = "https://www.sbnation.com/soccer/1122036/world-cup-2026-quarterfinals-schedule-scores";
const bracketSource = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/match-schedule";
const finalSource = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026";
const seedSource = "https://github.com/hartican/sportscal";
const MVP_MIN_EXPECTED = 5;
const FIFA_SPOILER_GUARD = /\b(\d+\s*-\s*\d+|are through|confirmed semifinalist|confirmed opponent|moved into|winner moves|moves onto|feeds directly|direct path to the final|quarterfinal result)\b/i;

function selectedSentenceForSeed(event) {
  if (event.expected >= 9) return "One of the clearest appointment-viewing picks in the seeded demo feed.";
  if (event.expected >= 7) return "A solid briefing candidate while this sport awaits full source refresh.";
  return "A lower-priority seeded event that still clears the MVP watch threshold.";
}

function fullSpielForSeed(event) {
  const venue = event.venue ? ` at ${event.venue}` : "";
  return `${event.name}${venue} remains in the demo feed as seed data until a researched feed refresh replaces it. Treat the time, broadcaster, and stakes as provisional, and use the feed instructions to verify this card from current official or broadcaster sources.`;
}

function copyReview(note) {
  return {
    reviewRequired: true,
    reviewComplete: false,
    note,
  };
}

function assertSpoilerSafeFifa(events) {
  const leaks = events
    .filter(event => event.key === "fifa")
    .filter(event => FIFA_SPOILER_GUARD.test([
      event.name,
      event.displayTitleCompact,
      event.selectedSentence,
      event.fullSpiel,
    ].join(" | ")));

  if (leaks.length) {
    throw new Error("FIFA spoiler guard failed: " + leaks.map(event => event.id).join(", "));
  }
}

const fifa = [
  {
    id: "fifa-qf-france-morocco-2026",
    sport: "Football",
    key: "fifa",
    name: "France vs Morocco - Quarterfinal",
    displayTitleCompact: "France vs Morocco - Quarterfinal",
    date: "2026-07-10",
    time: "06:00",
    broadcaster: "SBS On Demand",
    expected: 8,
    venue: "Boston Stadium, Foxborough",
    liveWindow: 3,
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "A recent World Cup quarterfinal kept in spoiler-safe catch-up framing.",
    fullSpiel: "This is a recent knockout fixture with replay value, so the default card avoids the result and bracket consequence. Treat it as a catch-up option for users who want the quarterfinal context without seeing who advanced.",
    copyReview: copyReview("Recent knockout copy must stay spoiler-safe until HITL review confirms the reveal flow."),
    sourceName: "SB Nation World Cup quarterfinals schedule and scores",
    sourceUrl: qfSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-qf-spain-belgium-2026",
    sport: "Football",
    key: "fifa",
    name: "Spain vs Belgium - Quarterfinal",
    displayTitleCompact: "Spain vs Belgium - Quarterfinal",
    date: "2026-07-11",
    time: "05:00",
    broadcaster: "SBS On Demand",
    expected: 9,
    venue: "Los Angeles Stadium",
    liveWindow: 3,
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "A title-contender quarterfinal with enough stakes to plan the morning around.",
    fullSpiel: "Spain and Belgium meet in a high-signal World Cup quarterfinal. The card is useful without naming downstream opponents: strong matchup, knockout pressure, and a Sydney-friendly early-morning appointment slot.",
    copyReview: copyReview("Marquee knockout preview copy should be checked for spoiler-safe bracket wording."),
    sourceName: "SB Nation World Cup quarterfinals schedule and scores",
    sourceUrl: qfSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-qf-norway-england-2026",
    sport: "Football",
    key: "fifa",
    name: "Norway vs England - Quarterfinal",
    displayTitleCompact: "Norway vs England - Quarterfinal",
    date: "2026-07-12",
    time: "07:00",
    broadcaster: "SBS On Demand",
    expected: 9,
    venue: "Miami Stadium",
    liveWindow: 3,
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "England meet Haaland's Norway with a semifinal spot at stake.",
    fullSpiel: "Norway vs England is built for a no-regrets card: star power, knockout stakes, and a Sunday morning Sydney slot. Keep the opened-card framing on why to watch, not on downstream bracket consequences.",
    copyReview: copyReview("Marquee knockout preview copy should be checked for spoiler-safe bracket wording."),
    sourceName: "SB Nation World Cup quarterfinals schedule and scores",
    sourceUrl: qfSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-qf-argentina-switzerland-2026",
    sport: "Football",
    key: "fifa",
    name: "Argentina vs Switzerland - Quarterfinal",
    displayTitleCompact: "Argentina vs Switzerland - Quarterfinal",
    date: "2026-07-12",
    time: "11:00",
    broadcaster: "SBS On Demand",
    expected: 9,
    venue: "Kansas City Stadium",
    liveWindow: 3,
    round: "quarterfinal",
    narrativeType: "quarterfinal",
    selectedSentence: "Argentina's title defence hits a disciplined Switzerland in the last quarterfinal.",
    fullSpiel: "Argentina vs Switzerland completes the quarterfinal set. It is a strong demo event because the late Sunday morning Sydney timing makes it easy to plan around, while the default copy avoids downstream bracket spoilers.",
    copyReview: copyReview("Marquee knockout preview copy should be checked for spoiler-safe bracket wording."),
    sourceName: "SB Nation World Cup quarterfinals schedule and scores",
    sourceUrl: qfSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-sf-1-2026",
    sport: "Football",
    key: "fifa",
    name: "World Cup Semifinal 1 - QF winners",
    displayTitleCompact: "World Cup Semifinal 1",
    date: "2026-07-15",
    time: "04:00",
    broadcaster: "SBS On Demand",
    expected: 10,
    venue: "Dallas Stadium",
    liveWindow: 3,
    round: "semifinal",
    narrativeType: "semifinal",
    selectedSentence: "A midweek World Cup semifinal slot that needs advance planning in Sydney.",
    fullSpiel: "The first World Cup semifinal is an appointment-viewing card without needing visible default spoilers. Keep the card focused on timing, broadcast path, and knockout stakes until the user deliberately reveals bracket detail.",
    copyReview: copyReview("Semifinal placeholder must not reveal recent quarterfinal advancement by default."),
    sourceName: "FIFA World Cup 26 match schedule",
    sourceUrl: bracketSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-sf-2-2026",
    sport: "Football",
    key: "fifa",
    name: "World Cup Semifinal 2 - QF winners",
    displayTitleCompact: "World Cup Semifinal 2",
    date: "2026-07-16",
    time: "04:00",
    broadcaster: "SBS On Demand",
    expected: 10,
    venue: "Atlanta Stadium",
    liveWindow: 3,
    round: "semifinal",
    narrativeType: "semifinal",
    selectedSentence: "The second semifinal is another early-morning fixture worth saving ahead.",
    fullSpiel: "The second semifinal stays bracket-safe until the quarterfinals settle. It remains useful as a planning card because the Sydney timing, broadcast path, and final-week stakes are enough to decide whether to watch live or save replay.",
    copyReview: copyReview("Semifinal placeholder must not reveal recent quarterfinal advancement by default."),
    sourceName: "FIFA World Cup 26 match schedule",
    sourceUrl: bracketSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-third-place-2026",
    sport: "Football",
    key: "fifa",
    name: "World Cup Third-Place Playoff",
    displayTitleCompact: "World Cup Third-Place Playoff",
    date: "2026-07-19",
    time: "07:00",
    broadcaster: "SBS On Demand",
    expected: 6,
    venue: "Miami Stadium",
    liveWindow: 3,
    round: "final",
    narrativeType: "final",
    selectedSentence: "Useful for completists, but lower priority than the semifinals and final.",
    fullSpiel: "The third-place playoff is kept in the feed for World Cup completists and replay discovery. It is not a Never Miss card unless the user is in full World Cup mode.",
    sourceName: "FIFA World Cup 26 match schedule",
    sourceUrl: bracketSource,
    sourceCheckedAt,
  },
  {
    id: "fifa-final-2026",
    sport: "Football",
    key: "fifa",
    name: "FIFA World Cup Final",
    displayTitleCompact: "FIFA World Cup Final",
    date: "2026-07-20",
    time: "05:00",
    broadcaster: "SBS On Demand",
    expected: 10,
    venue: "New York New Jersey Stadium",
    liveWindow: 4,
    round: "final",
    narrativeType: "final",
    selectedSentence: "The biggest remaining event in the demo calendar.",
    fullSpiel: "The World Cup final is the anchor card for this feed: global stakes, clear broadcast path, and a Monday 5:00am Sydney time slot that users need advance warning for.",
    sourceName: "FIFA World Cup 26",
    sourceUrl: finalSource,
    sourceCheckedAt,
  },
];

const kept = events
  .filter(event => event.key !== "fifa")
  .filter(event => Number(event.expected) >= MVP_MIN_EXPECTED)
  .map(event => ({
    ...event,
    eventId: event.eventId || event.id,
    selectedSentence: event.selectedSentence || selectedSentenceForSeed(event),
    fullSpiel: event.fullSpiel || fullSpielForSeed(event),
    sourceName: event.sourceName || "Bundled Sportscal seed data",
    sourceUrl: event.sourceUrl || seedSource,
    sourceCheckedAt: event.sourceCheckedAt || "2026-07-09T00:00:00+10:00",
  }));

const outputEvents = kept.concat(fifa)
  .filter(event => Number(event.expected) >= MVP_MIN_EXPECTED)
  .map((event, index) => ({
    ...event,
    eventId: event.eventId || event.id || "event_" + index,
  }));

assertSpoilerSafeFifa(outputEvents);

const output = {
  schemaVersion: "events.v1",
  version: "demo-feed-2026-07-10-stage1",
  publishedAt: "2026-07-10T08:30:00+10:00",
  sourceNote: "Stage 1 feed import file. FIFA knockout entries use spoiler-safe default copy; other sports retain bundled seed data for later staged enrichment. MVP staging excludes events below expected 5.",
  events: outputEvents,
};

let meta = {
  version: "unpublished",
  schemaVersion: "events.v1",
  publishedAt: output.publishedAt,
  eventsPath: "/data/events.json",
  activeSports: [],
  briefingWeekKey: "manual",
  usesBundledEvents: false,
};

try {
  meta = readJson("data/feed-meta.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const nextMeta = {
  ...meta,
  version: output.version,
  schemaVersion: output.schemaVersion,
  publishedAt: output.publishedAt,
  eventsPath: "/data/events.json",
  activeSports: activeSportsFor(output),
  feedHorizon: summarizeFeedHorizon(output, { basisDate: "2026-07-10" }),
  usesBundledEvents: false,
};

writeJson("data/events.json", output);
writeJson("data/feed-meta.json", nextMeta);
console.log("wrote data/events.json events:", output.events.length);
console.log("wrote data/feed-meta.json horizon:", nextMeta.feedHorizon.lastEventDate);
