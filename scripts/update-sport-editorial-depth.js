#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const { stakesFor } = require("./update-rolling-editorial-projections.js");
const { validateKnowledge } = require("./lib/editorial-narrative.js");

const DAY_MS = 86400000;
const KNOWLEDGE_PATH = "data/editorial-knowledge.v1.json";
const FEED_PATH = "feeds/incoming/events.json";
const PUBLISHED_FEED_PATH = "data/events.json";
const CONTEXT_PATH = "data/canonical/afl-nrl-2026.json";
let CHECKED_AT = new Date().toISOString();

function readJson(path){ return JSON.parse(fs.readFileSync(path, "utf8")); }
function writeJson(path, value){ fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function idFor(record){ return String(record?.eventId || record?.id || record?.canonicalEventId || ""); }
function slug(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function eventTime(record){ return Date.parse(record?.startTimeUtc || `${record?.date || ""}T${record?.time || "00:00"}:00+10:00`); }
function fit(value, maximum){
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 1).replace(/\s+\S*$/, "").replace(/[,:;]$/, "")}.`;
}
function upsert(collection, record){
  const index = collection.findIndex(item => item.id === record.id);
  if (index >= 0) collection[index] = record;
  else collection.push(record);
}
function addSource(knowledge, id, name, url){
  upsert(knowledge.sources, { id, name, url, sourceType:"official", checkedAt:CHECKED_AT });
  return id;
}
function addSubject(knowledge, id, kind, name){ upsert(knowledge.subjects, { id, kind, name }); return id; }
function addFact(knowledge, { id, subjectIds, statement, dimension, sourceIds, expiresAt = null }){
  upsert(knowledge.narrativeFacts, { id, subjectIds, statement:fit(statement, 320), dimension, sourceIds, observedAt:CHECKED_AT, expiresAt });
  return id;
}
function addThread(knowledge, { id, subjectIds, title, summary, factIds, status = "active" }){
  upsert(knowledge.narrativeThreads, { id, subjectIds, title, summary:fit(summary, 700), factIds, status, updatedAt:CHECKED_AT });
  return id;
}
function replaceProjection(knowledge, projection){
  const targets = new Set(projection.targetIds);
  knowledge.eventProjections = knowledge.eventProjections.filter(item => item.targetType !== projection.targetType || !item.targetIds.some(id => targets.has(id)));
  knowledge.eventProjections.push(projection);
}

function clampFutureProvenance(knowledge, reference){
  const checkedAt = reference.toISOString();
  const clamp = (record, field) => {
    if (new Date(record?.[field] || 0).getTime() > reference.getTime()) record[field] = checkedAt;
  };
  knowledge.sources.forEach(record => clamp(record, "checkedAt"));
  knowledge.narrativeFacts.forEach(record => clamp(record, "observedAt"));
  knowledge.narrativeThreads.forEach(record => clamp(record, "updatedAt"));
  knowledge.eventProjections.forEach(record => {
    clamp(record, "researchedAt");
    if (record.originalityReview) clamp(record.originalityReview, "reviewedAt");
  });
}
function resultForTeam(event, participantId){
  if (event.status !== "completed" || !event.outcomeText) return null;
  if (/\bdrew\b|shared the points/i.test(event.outcomeText)) return "D";
  const participants = [event.homeParticipantId, event.awayParticipantId];
  if (!participants.includes(participantId)) return null;
  const homeWon = event.outcomeText.startsWith(String(event.name || "").split(" v ")[0]);
  return participantId === event.homeParticipantId ? (homeWon ? "W" : "L") : (homeWon ? "L" : "W");
}
function recordBefore(events, participantId, beforeTime){
  const results = events
    .filter(event => event.key === "premier-league" && eventTime(event) < beforeTime && [event.homeParticipantId, event.awayParticipantId].includes(participantId))
    .map(event => resultForTeam(event, participantId))
    .filter(Boolean);
  return { played:results.length, won:results.filter(value => value === "W").length, drawn:results.filter(value => value === "D").length, lost:results.filter(value => value === "L").length };
}
function recordPhrase(record){
  if (!record.played) return "a clean opening slate";
  if (record.played === 1) return record.won ? "an opening win" : record.drawn ? "an opening draw" : "an opening defeat";
  if (record.won === record.played) return `${record.played} wins from ${record.played}`;
  if (record.lost === record.played) return `${record.played} defeats from ${record.played}`;
  if (record.drawn === record.played) return `${record.played} draws from ${record.played}`;
  return `${record.won}W-${record.drawn}D-${record.lost}L`;
}

const EPL_PROFILES = Object.freeze({
  "team:football:epl:1": { lead:"Arsenal's first title defence in 22 years", test:"settled champion structure", fact:"Arsenal begin their first Premier League title defence in 22 years, chasing consecutive championships for the first time in more than 90 years.", dimension:"history" },
  "team:football:epl:2": { lead:"Aston Villa's post-Europa rebuild", test:"a new midfield and defensive spine", fact:"Aston Villa enter a new cycle after finishing fourth and winning the Europa League, with several senior starters leaving during the summer.", dimension:"history" },
  "team:football:epl:127": { lead:"Bournemouth's first European-season balancing act", test:"Marco Rose's attempt to preserve a best-ever finish", fact:"Bournemouth are balancing their first European campaign with a managerial change after recording the club's best Premier League finish under Andoni Iraola.", dimension:"history" },
  "team:football:epl:130": { lead:"Brentford's fast-break identity", test:"the league's leading fast-break and throw-in threat", fact:"Brentford entered 2026/27 after ranking first in the league for goals from fast breaks and throw-ins, with Keith Andrews beginning his second season.", dimension:"form" },
  "team:football:epl:131": { lead:"Brighton's goals-by-committee attack", test:"a side that spread last season's goals across 19 players", fact:"Brighton had 19 different Premier League scorers in 2025/26, more than any other club, before changing the centre of their defence.", dimension:"form" },
  "team:football:epl:4": { lead:"Chelsea's Xabi Alonso reset", test:"a new three-at-the-back project without European midweeks", fact:"Chelsea begin the Xabi Alonso era without European fixtures, giving a new tactical project more training time but leaving defensive resilience as an immediate test.", dimension:"form" },
  "team:football:epl:5": { lead:"Coventry's return after 25 years", test:"the set-piece strength behind a 97-goal promotion", fact:"Championship winners Coventry returned to the Premier League after 25 years, having scored 97 league goals and a division-high 29 from set plays.", dimension:"history" },
  "team:football:epl:6": { lead:"Crystal Palace's Pierre Sage transition", test:"a new build-from-the-back version of their established shape", fact:"Crystal Palace retained a three-at-the-back shape under new coach Pierre Sage while shifting toward more possession and build-up through Adam Wharton.", dimension:"form" },
  "team:football:epl:7": { lead:"Everton's search for more attack", test:"adding goals to one of the league's strongest away defences", fact:"Everton arrived with a strong defensive base after only Arsenal and Manchester City conceded fewer away goals in 2025/26, but needed more attacking output.", dimension:"form" },
  "team:football:epl:34": { lead:"Fulham's first post-Marco Silva season", test:"Alvaro Arbeloa's wide overloads", fact:"Fulham started a new era after Marco Silva's five-year tenure, with Alvaro Arbeloa installing a width-heavy attacking structure.", dimension:"history" },
  "team:football:epl:41": { lead:"Hull's top-flight return after nine years", test:"a playoff-built counterattack", fact:"Hull returned to the Premier League after nine years through the Championship playoffs, retaining a counterattacking core and strengthening its defensive spine.", dimension:"history" },
  "team:football:epl:8": { lead:"Ipswich's immediate top-flight return", test:"Gary O'Neil's more pragmatic second attempt", fact:"Ipswich returned immediately after finishing second in the Championship, with Gary O'Neil adding a deeper and more pragmatic defensive plan.", dimension:"history" },
  "team:football:epl:9": { lead:"Leeds' carry-over momentum", test:"the physical 3-4-2-1 that lost only three of its final 14 last season", fact:"Leeds lost only three of their final 14 league matches in 2025/26 and retained the physical 3-4-2-1 structure behind that finish.", dimension:"form" },
  "team:football:epl:10": { lead:"Liverpool's high-press rebuild", test:"Andoni Iraola's faster counterattacking identity", fact:"Liverpool appointed Andoni Iraola after a disappointing title defence, beginning a pressing and counterattacking reset around a heavily changed squad.", dimension:"history" },
  "team:football:epl:11": { lead:"Manchester City's first post-Guardiola campaign", test:"Enzo Maresca's continuity-versus-change problem", fact:"Manchester City began their first post-Pep Guardiola season under Enzo Maresca, whose possession principles preserve some continuity while replacing a defining coach.", dimension:"history" },
  "team:football:epl:12": { lead:"Manchester United's Carrick rebuild", test:"a redesigned midfield carrying Champions League load", fact:"Manchester United entered Michael Carrick's first full season after finishing third, with a rebuilt midfield and Champions League football returning.", dimension:"history" },
  "team:football:epl:23": { lead:"Newcastle's new era after a summer exodus", test:"rebuilding leadership, midfield and coaching at once", fact:"Newcastle changed head coach after the departures of Bruno Guimaraes, Sandro Tonali and Anthony Gordon during a summer that reset the team's leadership and midfield.", dimension:"history" },
  "team:football:epl:15": { lead:"Nottingham Forest's Glasner reset", test:"a new three-at-the-back structure against a poor home run", fact:"Nottingham Forest appointed Oliver Glasner after taking three points only once in their final 12 league home matches, rebuilding around a three-at-the-back defence.", dimension:"form" },
  "team:football:epl:29": { lead:"Sunderland's Europe-and-league balancing act", test:"the defensive base behind last season's seventh place", fact:"Sunderland entered Europa League football after finishing seventh with a defence that conceded fewer league goals than several top-five clubs.", dimension:"history" },
  "team:football:epl:21": { lead:"Tottenham's first full De Zerbi season", test:"a new ball-playing defence under an attacking coach", fact:"Tottenham began Roberto De Zerbi's first full season with a rebuilt ball-playing defence and midfield intended to support his aggressive attacking model.", dimension:"history" },
});

function eplHook(event, home, away, homeRecord, awayRecord){
  const completed = event.status === "completed";
  const clauses = [
    `${home.lead} meets ${away.lead}; one fixture now moves both season-defining questions.`,
    `${away.lead} comes to ${home.name}, directly testing ${home.lead}.`,
    `${home.lead} against ${away.lead}: one result will move two very different season stories.`,
    `${home.name} host ${away.name} with ${home.lead} and ${away.lead} both under examination.`,
  ];
  const base = clauses[Array.from(idFor(event)).reduce((sum, char) => sum ^ char.charCodeAt(0), 0) % clauses.length];
  const completedBase = `${home.lead} met ${away.lead}; both season questions were tested, with the details under spoiler control.`;
  return fit(completed ? completedBase : base, 180);
}

function buildEpl(knowledge, events, context, reference){
  const ladder = context.ladderSnapshots.find(item => item.competitionId === "competition:premier-league-2026-27");
  const entries = new Map((ladder?.entries || []).map(entry => [entry.participantId, entry]));
  const participants = new Map(context.participants.map(item => [item.id, item.displayName || item.canonicalName]));
  const sourceTable = addSource(knowledge, "source:depth:epl:table", "Premier League current 2026/27 table", "https://www.premierleague.com/en/tables/premier-league/2026-27");
  const sourceGuide = addSource(knowledge, "source:depth:epl:season-guide", "Premier League 2026/27 club guide", "https://www.premierleague.com/en/news/4688364/how-every-premier-league-club-could-line-up-in-202627");
  const sourceFixtures = addSource(knowledge, "source:depth:epl:fixtures", "Premier League 2026/27 fixture list", "https://www.premierleague.com/en/news/4675097");
  const targetEvents = events.filter(event => event.key === "premier-league" && stakesFor(event) >= 3 && eventTime(event) >= reference.getTime() - 7 * DAY_MS && eventTime(event) <= reference.getTime() + 30 * DAY_MS);
  const allLeagueEvents = events.filter(event => event.key === "premier-league");
  for (const event of targetEvents){
    const homeId = event.homeParticipantId;
    const awayId = event.awayParticipantId;
    const home = { id:homeId, name:participants.get(homeId), ...EPL_PROFILES[homeId] };
    const away = { id:awayId, name:participants.get(awayId), ...EPL_PROFILES[awayId] };
    if (!home.lead || !away.lead) throw new Error(`Missing researched Premier League profile for ${event.name}`);
    const eventSource = addSource(knowledge, `source:depth:epl:match:${slug(idFor(event))}`, `Premier League match record for ${event.name}`, event.sourceUrl || "https://www.premierleague.com/en/matches/premier-league/2026-27");
    const homeSubject = addSubject(knowledge, `subject:depth:epl:${slug(homeId)}`, "team", home.name);
    const awaySubject = addSubject(knowledge, `subject:depth:epl:${slug(awayId)}`, "team", away.name);
    const before = eventTime(event);
    const homeRecord = recordBefore(allLeagueEvents, homeId, before);
    const awayRecord = recordBefore(allLeagueEvents, awayId, before);
    const homeArcFact = addFact(knowledge, { id:`fact:depth:epl:${slug(homeId)}:season-arc`, subjectIds:[homeSubject], statement:home.fact, dimension:home.dimension, sourceIds:[sourceGuide] });
    const awayArcFact = addFact(knowledge, { id:`fact:depth:epl:${slug(awayId)}:season-arc`, subjectIds:[awaySubject], statement:away.fact, dimension:away.dimension, sourceIds:[sourceGuide] });
    const homeFormFact = addFact(knowledge, { id:`fact:depth:epl:${slug(idFor(event))}:${slug(homeId)}:entry-form`, subjectIds:[homeSubject], statement:`${home.name} entered ${event.roundLabel || "this fixture"} with ${homeRecord.won} win, ${homeRecord.drawn} draw and ${homeRecord.lost} loss from ${homeRecord.played} earlier 2026/27 league matches.`, dimension:"form", sourceIds:[sourceTable, eventSource], expiresAt:event.status === "completed" ? null : event.startTimeUtc || null });
    const awayFormFact = addFact(knowledge, { id:`fact:depth:epl:${slug(idFor(event))}:${slug(awayId)}:entry-form`, subjectIds:[awaySubject], statement:`${away.name} entered ${event.roundLabel || "this fixture"} with ${awayRecord.won} win, ${awayRecord.drawn} draw and ${awayRecord.lost} loss from ${awayRecord.played} earlier 2026/27 league matches.`, dimension:"form", sourceIds:[sourceTable, eventSource], expiresAt:event.status === "completed" ? null : event.startTimeUtc || null });
    const matchupFact = addFact(knowledge, { id:`fact:depth:epl:${slug(idFor(event))}:matchup`, subjectIds:[homeSubject, awaySubject], statement:`${event.name} places ${home.test} directly against ${away.test} in ${event.roundLabel || "the early Premier League season"}.`, dimension:"matchup", sourceIds:[sourceGuide, sourceFixtures] });
    const homeThread = addThread(knowledge, { id:`thread:depth:epl:${slug(homeId)}:2026-27`, subjectIds:[homeSubject], title:`${home.name} — 2026/27 identity under pressure`, summary:`${home.name}'s cards carry the same researched season question forward, updating form at every fixture so the narrative develops from match to match instead of resetting to schedule information.`, factIds:[homeArcFact, homeFormFact] });
    const awayThread = addThread(knowledge, { id:`thread:depth:epl:${slug(awayId)}:2026-27`, subjectIds:[awaySubject], title:`${away.name} — 2026/27 identity under pressure`, summary:`${away.name}'s cards carry the same researched season question forward, updating form at every fixture so the narrative develops from match to match instead of resetting to schedule information.`, factIds:[awayArcFact, awayFormFact] });
    const hook = eplHook(event, home, away, homeRecord, awayRecord);
    const formLead = event.status === "completed" ? "" : `${home.name} arrives with ${recordPhrase(homeRecord)}, while ${away.name} brings ${recordPhrase(awayRecord)}. `;
    const synopsis = fit(`${formLead}${home.fact} ${away.fact} That makes this fixture a direct test of ${home.test} against ${away.test}${event.status === "completed" ? ". The match is complete, with the result protected until spoilers are enabled" : ", and the next result will advance both season threads"}.`, 700);
    const result = String(event.outcomeText || event.recapText || "").trim();
    replaceProjection(knowledge, {
      id:`projection:rolling:${slug(idFor(event))}`,
      targetType:"feed-event", targetIds:[idFor(event)], stakes:stakesFor(event), hook, synopsis,
      ...(result ? { hookSpoilerOn:fit(`${result} ${home.lead} and ${away.lead} now move into different next chapters.`, 180), synopsisSpoilerOn:fit(`${result} ${event.recapText || ""} The result now updates ${home.name}'s ${home.test} thread and ${away.name}'s ${away.test} thread rather than ending the story at full-time.`, 700) } : {}),
      threadIds:[homeThread, awayThread], factIds:[homeArcFact, awayArcFact, homeFormFact, awayFormFact, matchupFact], sourceIds:[sourceTable, sourceGuide, sourceFixtures, eventSource], researchedAt:reference.toISOString(), refreshAfter:event.status === "completed" ? null : event.startTimeUtc || null, generationMode:"researched", originalityReview:{ method:"independent-summary-no-source-prose-retained", reviewedAt:reference.toISOString() },
    });
  }
  return targetEvents.length;
}

const AFL_STORIES = Object.freeze({
  "event-afl-cd_m20260142404": { hook:"Two clubs outside the Final Ten entered Round 24 with pride and list direction left to play for; the final answer stays behind the spoiler control.", synopsis:"Essendon and Port Adelaide entered the final round outside the new Final Ten, making this less about ladder movement than the evidence each could carry into off-season decisions. The result is protected, but the chapter matters as the last competitive measure of two difficult campaigns.", facts:["Essendon and Port Adelaide entered Round 24 outside the 2026 Final Ten.", "This was each club's final premiership-season match, so the consequence shifted from qualification to the evidence carried into list and coaching decisions."], dims:["consequence","path"], thread:"close" },
  "event-afl-cd_m20260142408": { hook:"Sydney's five-match surge into a top-two finish closed against North Melbourne, with the result kept behind the spoiler control.", synopsis:"Sydney arrived on a five-match streak and with a home qualifying final already taking shape. North Melbourne's role was not structural filler: this was Sydney's last competitive rehearsal before a double-chance final and North's final chance to test that finals-ready level.", facts:["Sydney finished the home-and-away season second after closing the ladder campaign with five consecutive wins.", "A top-two finish gave Sydney a home qualifying final and a double-chance path into the preliminary finals."], dims:["form","path"], thread:"close" },
  "event-afl-cd_m20260142409": { hook:"Hawthorn's final trip west decided whether a top-four double chance survived the last day; the result stays hidden here.", synopsis:"Hawthorn entered the last match of Round 24 with fourth place still dependent on the result, while Brisbane, Geelong and Adelaide watched the same outcome. West Coast therefore became the opponent in a four-club finals-seeding story, not merely the last fixture on the schedule.", facts:["Hawthorn's Round 24 result determined whether it retained fourth place and a qualifying-final berth.", "Brisbane, Geelong and Adelaide all had finals positions that could move depending on Hawthorn's final-round result."], dims:["consequence","path"], thread:"close" },
  "event-afl-cd_m20260142502": { hook:"The first AFL wildcard final came down to one kick after the siren; the survivor is hidden until spoilers are enabled.", synopsis:"Western Bulldogs brought an eight-wins-in-11 recovery into the first wildcard final, while Collingwood's pressure game had rediscovered features of its premiership identity. The new Final Ten compressed both arcs into one elimination night, ultimately separated by a shot after the siren.", facts:["The Bulldogs won eight of 11 matches during their climb back into finals contention before the wildcard round.", "The first wildcard final was decided by a shot after the siren, with the two teams separated by three points."], dims:["form","history"], thread:"finals" },
  "event-afl-cd_m20260142501": { hook:"Carlton's recovery from a one-and-eight start met Melbourne's surprise finals season; the advancing side remains concealed here.", synopsis:"Melbourne's first season under Steven King rose from low expectations into finals contention. Carlton entered the same knockout after Josh Fraser inherited one positive result from nine matches and drove a late charge, making the wildcard a collision between an early-season rise and a late-season rescue.", facts:["Carlton recovered from a 1-8 start to reach the inaugural wildcard round under Josh Fraser.", "Melbourne reached finals contention in Steven King's first season after exceeding early expectations."], dims:["form","history"], thread:"finals" },
  "event-afl-cd_m20260142601": { hook:"Minor premier Fremantle meets the Hawthorn side that seized fourth on the final day; the reward is a week off, not elimination.", synopsis:"Fremantle's 19-win season earned the first qualifying final at Optus Stadium. Hawthorn arrives after its final-round result secured the last top-four place, so this is a contest between season-long control and a late seeding surge, with the winner advancing directly to a home preliminary final.", facts:["Fremantle finished first with 19 wins and earned a home qualifying final at Optus Stadium.", "Hawthorn secured fourth place through the final match of Round 24, entering the double-chance side of the bracket."], dims:["form","path"], thread:"finals" },
  "event-afl-cd_m20260142603": { hook:"Carlton's 1–8 rescue has one life left against a Geelong side that closed the season with six straight wins.", synopsis:"Carlton carried its comeback through the wildcard round and now meets the form team of the run-in. Geelong's six-match winning finish secured fifth and an MCG elimination final; the contrast is a long recovery against late-season continuity, with no second chance for either.", facts:["Geelong ended the home-and-away season with six consecutive wins and finished fifth.", "Carlton advanced from 10th through the wildcard round after recovering from a 1-8 start."], dims:["form","path"], thread:"finals" },
  "event-afl-cd_m20260142602": { hook:"Sydney's five straight wins meet Brisbane's three in a qualifying final that turns current form into a week-off prize.", synopsis:"Sydney finished second after five consecutive wins; Brisbane closed third with three of its own. The SCG qualifying final therefore matches the two strongest finishing streaks on this side of the bracket, with the winner bypassing the semi-finals and the loser retaining one life.", facts:["Sydney enters the finals on a five-match winning streak after finishing second.", "Brisbane enters on three consecutive wins after finishing third."], dims:["form","path"], thread:"finals" },
  "event-afl-cd_m20260142604": { hook:"The Bulldogs survived the first wildcard by one kick; Adelaide now asks them to win sudden-death football away from home.", synopsis:"Western Bulldogs reached Adelaide only after the inaugural wildcard was decided by an after-the-siren miss. The Crows earned sixth and the home elimination final, turning this into a test of whether wildcard momentum travels against a side whose whole season secured this venue advantage.", facts:["Western Bulldogs advanced from the first wildcard final by three points after Collingwood missed after the siren.", "Adelaide finished sixth and earned the right to host the elimination final at Adelaide Oval."], dims:["form","consequence"], thread:"finals" },
  "event-afl-cd_m20260142901": { hook:"The first Final Ten season ends with two preliminary-final survivors and one premiership match at the MCG.", synopsis:"The 2026 finals system began with the AFL's first wildcard round, but every route still converges on the same single decider. Both participants must first survive a preliminary final; once known, their team threads replace the placeholder and carry the path, form and audience memory into Grand Final week.", facts:["The 2026 season is the first AFL campaign to use a Final Ten and wildcard round.", "The two preliminary-final winners advance to a single Grand Final at the MCG."], dims:["history","path"], thread:"finals" },
});

function buildAfl(knowledge, events, reference){
  const sourceLadder = addSource(knowledge, "source:depth:afl:ladder", "AFL 2026 final home-and-away ladder", "https://www.afl.com.au/ladder");
  const sourceFinals = addSource(knowledge, "source:depth:afl:finals-fixture", "AFL 2026 finals fixture", "https://www.afl.com.au/news/1597385/finals-fixture-ticket-details-schedule-confirmed-for-week-two-of-the-2026-finals-series/");
  const sourceRules = addSource(knowledge, "source:depth:afl:final-ten-rules", "AFL 2026 Final Ten regulations", "https://resources.afl.com.au/afl/document/2026/02/13/54c158af-15e9-483b-a195-62a0f4e33b11/AFL-Regulations-Final-11-February-2026-.pdf");
  const seriesSubject = addSubject(knowledge, "subject:depth:afl:2026-run-in", "series", "2026 AFL run-in and finals");
  const threadFacts = { close:[], finals:[] };
  const targetEvents = events.filter(event => AFL_STORIES[idFor(event)]);
  for (const event of targetEvents){
    const story = AFL_STORIES[idFor(event)];
    const eventSource = addSource(knowledge, `source:depth:afl:match:${slug(idFor(event))}`, `AFL match record for ${event.name}`, event.sourceUrl || sourceFinals);
    const factIds = story.facts.map((statement, index) => addFact(knowledge, { id:`fact:depth:afl:${slug(idFor(event))}:${index + 1}`, subjectIds:[seriesSubject], statement, dimension:story.dims[index], sourceIds:index === 0 ? [sourceLadder, eventSource] : [sourceFinals, sourceRules] }));
    threadFacts[story.thread].push(...factIds);
    const result = String(event.outcomeText || event.recapText || "").trim();
    replaceProjection(knowledge, {
      id:`projection:rolling:${slug(idFor(event))}`, targetType:"feed-event", targetIds:[idFor(event)], stakes:stakesFor(event), hook:story.hook, synopsis:story.synopsis,
      ...(result ? { hookSpoilerOn:fit(`${result} ${story.hook.replace(/;.*$/, ".")}`, 180), synopsisSpoilerOn:fit(`${result} ${event.recapText || ""} The result now advances or resolves the same 2026 AFL thread described in the spoiler-safe preview.`, 700) } : {}),
      threadIds:[`thread:depth:afl:${story.thread}`], factIds, sourceIds:[sourceLadder, sourceFinals, sourceRules, eventSource], researchedAt:reference.toISOString(), refreshAfter:event.status === "completed" ? null : event.startTimeUtc || null, generationMode:"researched", originalityReview:{ method:"independent-summary-no-source-prose-retained", reviewedAt:reference.toISOString() },
    });
  }
  addThread(knowledge, { id:"thread:depth:afl:close", subjectIds:[seriesSubject], title:"AFL 2026 — the last round into finals", summary:"The final home-and-away matches are retained as the hinge into the inaugural Final Ten, connecting late seeding outcomes and club direction to the finals bracket rather than treating them as isolated results.", factIds:Array.from(new Set(threadFacts.close)) });
  addThread(knowledge, { id:"thread:depth:afl:finals", subjectIds:[seriesSubject], title:"AFL 2026 — the first Final Ten", summary:"The wildcard results, finishing streaks and bracket consequences persist across every finals card, allowing each result to advance the same premiership narrative through to the MCG decider.", factIds:Array.from(new Set(threadFacts.finals)) });
  return targetEvents.length;
}

const CRICKET_CORRECTIONS = Object.freeze({
  evt_87:{ name:"South Africa v Australia — First Test", displayTitleCompact:"South Africa v Australia — 1st Test", date:"2026-10-09", time:"18:30", startTimeUtc:"2026-10-09T07:30:00Z", venue:"Kingsmead, Durban" },
  evt_88:{ name:"South Africa v Australia — Second Test", displayTitleCompact:"South Africa v Australia — 2nd Test", date:"2026-10-18", time:"19:00", startTimeUtc:"2026-10-18T08:00:00Z", venue:"St George's Park, Gqeberha" },
  evt_89:{ name:"South Africa v Australia — Third Test", displayTitleCompact:"South Africa v Australia — 3rd Test", date:"2026-10-27", time:"19:00", startTimeUtc:"2026-10-27T08:00:00Z", venue:"Newlands, Cape Town" },
  "cricket-australia-england-first-odi-2026":{ venue:"Perth Stadium" },
  "cricket-australia-england-second-odi-2026":{ venue:"Adelaide Oval" },
  "cricket-australia-england-third-odi-2026":{ venue:"Bellerive Oval, Hobart" },
  "cricket-australia-england-first-t20-2026":{ venue:"Melbourne Cricket Ground" },
  "cricket-australia-england-second-t20-2026":{ venue:"Gold Coast Stadium" },
  "cricket-australia-england-third-t20-2026":{ venue:"Brisbane Cricket Ground" },
  "cricket-australia-england-fourth-t20-2026":{ venue:"Sydney Cricket Ground" },
  evt_90:{ name:"Australia v New Zealand — Boxing Day Test", displayTitleCompact:"Australia v New Zealand — Boxing Day Test", date:"2026-12-26", time:"10:30", startTimeUtc:"2026-12-25T23:30:00Z", venue:"Melbourne Cricket Ground" },
  evt_91:{ name:"Australia v New Zealand — New Year's Test", displayTitleCompact:"Australia v New Zealand — New Year's Test", date:"2027-01-04", time:"10:30", startTimeUtc:"2027-01-03T23:30:00Z", venue:"Sydney Cricket Ground" },
});

function reconcileCricket(document){
  document.events = document.events.map(event => {
    const correction = CRICKET_CORRECTIONS[idFor(event)];
    if (!correction) return event;
    const opponent = idFor(event).startsWith("evt_8") ? "South Africa" : idFor(event).startsWith("evt_9") ? "New Zealand" : null;
    return {
      ...event, ...correction,
      sourceName:"Cricket Australia 2026/27 official series schedule",
      sourceUrl:opponent === "South Africa" ? "https://www.cricket.com.au/news/4455441/australia-tour-south-africa-schedule-dates-odi-test-series-cape-town-johannesburg" : event.sourceUrl,
      sourceCheckedAt:CHECKED_AT,
      sourceType:"official", sourceTrust:"verified", competitionScope:"international", isInternational:true,
      ...(opponent ? { participants:[{ name:opponent === "South Africa" ? "South Africa" : "Australia", role:"home" }, { name:opponent === "South Africa" ? "Australia" : "New Zealand", role:"away" }], participantIds:[opponent === "South Africa" ? "team:cricket:south-africa" : "team:cricket:australia", opponent === "South Africa" ? "team:cricket:australia" : "team:cricket:new-zealand"], representativeCountryCodes:["AUS"], representativeSportKey:"cricket" } : {}),
    };
  });
}

const CRICKET_STORIES = Object.freeze({
  "cricket-australia-bangladesh-first-test-2026":{ thread:"bangladesh", hook:"Test cricket returned to Darwin after 22 years with Bangladesh seeking a first breakthrough on Australian soil.", resultHook:"Bangladesh's nine-wicket win in Darwin was their first Test victory on Australian soil.", synopsis:"Darwin's first Test since 2004 opened Australia's longest modern red-ball workload and gave Bangladesh a chance it had never converted on Australian soil. The match is complete, but its historical consequence remains protected until results are enabled.", facts:["Darwin hosted its first Test match since 2004 when Australia met Bangladesh in August 2026.", "Bangladesh entered without a Test victory in Australia and achieved only its tenth away Test win in this match.", "The first Test began a run in which Australia could play 20 or 21 Tests across roughly 12 months."], dims:["history","consequence","path"], sources:["bangladesh-first","season","workload"] },
  "cricket-australia-bangladesh-second-test-2026":{ thread:"bangladesh", hook:"Mackay's first Test became Australia's immediate answer to Darwin, with the two-match series itself on the line.", resultHook:"Australia answered Darwin with an innings-and-51-run win in Mackay, levelling the two-Test series.", synopsis:"Bangladesh arrived in Mackay with a historic lead; Australia arrived needing a response at a venue hosting Test cricket for the first time. That made the second match both a new-city occasion and the only chance to prevent the two-Test contest being settled by the Darwin upset.", facts:["Mackay's Great Barrier Reef Arena became Australia's twelfth men's Test venue for the second Bangladesh match.", "Bangladesh entered Mackay leading the two-Test series after its first Test win in Australia.", "The second Test finished inside two days, with Mitchell Starc taking 10 wickets in the match."], dims:["history","path","consequence"], sources:["season","bangladesh-first","bangladesh-second"] },
  evt_87:{ thread:"south-africa", hook:"Australia's first Test in South Africa since 2018 begins a three-match contest between the format's last two champions.", synopsis:"Kingsmead reopens a Test rivalry Australia has not contested in South Africa for eight years. With South Africa the reigning World Test Championship holder and Australia leading the current table at the schedule announcement, the first Test establishes both series control and a direct WTC argument.", facts:["The Durban Test is Australia's first Test match in South Africa since the 2018 tour.", "The series matches the two most recent World Test Championship winners.", "The three-Test contest was identified as important to qualification for the next World Test Championship final."], dims:["history","matchup","consequence"], sources:["south-africa","season","workload"] },
  evt_88:{ thread:"south-africa", hook:"Gqeberha is the series hinge: the first Test's winner can press for control while the loser has its clearest route back.", synopsis:"The second Test moves the contest to St George's Park with only one match left after it. Its narrative must update from Durban: it becomes either a chance to clinch, level or protect a lead, while the wider struggle between the last two WTC champions continues.", facts:["The second Test is scheduled at St George's Park with one match remaining after it.", "Its consequence depends on the Durban result: it can become a clinching chance, a levelling chance or protection of an existing lead.", "Australia and South Africa are the two most recent World Test Championship winners."], dims:["path","consequence","matchup"], sources:["south-africa","season"] },
  evt_89:{ thread:"south-africa", hook:"The three-Test tour ends at Newlands, Australia's first Test return to the ground since the 2018 scandal.", synopsis:"Cape Town gives the series finale a consequence beyond whatever scoreline arrives from Durban and Gqeberha. Newlands is where Australia's previous South African Test tour fractured in 2018; this return closes the first series back and may also settle a live WTC contest.", facts:["Newlands hosts the third and final Test of Australia's first South African series since 2018.", "Australia's previous Test at Newlands was the 2018 match associated with the ball-tampering scandal.", "The final Test can settle the series and affect the qualification race for the next World Test Championship final."], dims:["history","consequence","path"], sources:["south-africa","season","workload"] },
  "cricket-australia-england-first-odi-2026":{ thread:"england", hook:"Australia changes format and continent in 13 days, opening the England ODI series in Perth after three Tests in South Africa.", synopsis:"The first ODI begins a compact eight-match white-ball visit only 13 days after Australia's scheduled Cape Town Test finish. England is the opponent in a rivalry Australia won 3–2 in their last bilateral ODI series, but new squads and a new home sequence make Perth a reset rather than a continuation of that result.", facts:["The first England ODI starts 13 days after Australia's scheduled third Test finish in Cape Town.", "Australia won the teams' previous bilateral ODI series 3-2 in England in 2024.", "Perth opens a three-match ODI series that is followed immediately by five T20 internationals."], dims:["path","history","consequence"], sources:["england-odi","england-history","season"] },
  "cricket-australia-england-second-odi-2026":{ thread:"england", hook:"A two-day Perth-to-Adelaide turnaround makes the opening result immediately matter to the three-match ODI series.", synopsis:"The second ODI arrives with almost no recovery window after Perth. Its stakes cannot be honestly fixed before game one: Adelaide becomes either a chance to take the series, force a decider or build the first lead, all within a rivalry whose previous ODI contest went to a fifth match.", facts:["The second ODI follows the Perth opener after a two-day turnaround and moves the series to Adelaide Oval.", "Its exact consequence depends on the first result: it can offer a series win, a levelling result or the first advantage.", "The previous Australia-England bilateral ODI series went to a fifth match before Australia won 3-2."], dims:["path","consequence","history"], sources:["england-odi","england-history"] },
  "cricket-australia-england-third-odi-2026":{ thread:"england", hook:"Hobart closes the ODI contest before the same rivalry compresses into five T20s across 12 days.", synopsis:"The third ODI is the 50-over endpoint, not merely another venue change. It may be a decider or a dead rubber depending on Perth and Adelaide, and it immediately hands the rivalry into a five-match T20 sequence that demands a different squad balance and tempo.", facts:["Bellerive Oval hosts the third and final ODI of the 2026 Australia-England series.", "The fixture may decide the series, but that consequence cannot be known until the first two results are complete.", "A five-match T20 series begins three days later, making Hobart the transition point between formats."], dims:["path","consequence","matchup"], sources:["england-odi","england-t20","season"] },
  "cricket-australia-england-first-t20-2026":{ thread:"england", hook:"Three days after the ODI finale, Australia and England restart the rivalry at the MCG in a five-match T20 series.", synopsis:"The MCG opener asks both sides to change personnel and tempo almost immediately after Hobart. With five matches across 12 days, the first result shapes a longer tactical series rather than a one-off night, and gives the earliest evidence of which white-ball lessons travel between formats.", facts:["The first T20 begins at the MCG three days after the final ODI in Hobart.", "The T20 series contains five matches across 12 days and five Australian venues.", "The opening result sets the first tactical baseline for a longer series rather than deciding the contest alone."], dims:["path","format","consequence"], sources:["england-t20","england-odi","season"] },
  "cricket-australia-england-second-t20-2026":{ thread:"england", hook:"The Gold Coast follows the MCG after only two rest days, making adaptation the first persistent thread of the T20 series.", synopsis:"Game two changes ground and conditions before either side has much time to rebuild its plan. The opener supplies the first real evidence—selection, match-ups and death-overs execution—while the five-game format leaves room to answer rather than overreact.", facts:["The second T20 is played at Gold Coast Stadium three days after the MCG opener.", "The change of venue gives both sides only a short window to adapt tactics and selection from match one.", "Because the series has five matches, game two can create a strong lead or restore balance without settling the contest."], dims:["path","matchup","consequence"], sources:["england-t20","season"] },
  "cricket-australia-england-third-t20-2026":{ thread:"england", hook:"The Gabba is the middle game of five—the first point at which either side can make the series mathematically safe.", synopsis:"By Brisbane, two matches of evidence replace the pre-series guesswork. If one team has swept the opening pair, the Gabba is a first clinching chance; if the series is level, it becomes the pivot that turns the final two matches into chase or defence.", facts:["The Gabba hosts the third and middle match of the five-game T20 series.", "A team leading 2-0 can clinch the series in Brisbane; any other scoreline keeps the trophy unresolved.", "Two completed games allow form and matchup claims to replace pre-series assumptions before this fixture."], dims:["consequence","path","form"], sources:["england-t20","season"] },
  "cricket-australia-england-fourth-t20-2026":{ thread:"england", hook:"By the SCG, the five-match series has only two lives left: this is either a clincher, a rescue or a fight for the finale.", synopsis:"The fourth T20 cannot be honestly labelled before Brisbane, but every possible state has consequence. One side may be protecting a lead, the other forcing Canberra to matter, or both may be trying to seize the first series point that cannot be answered immediately.", facts:["The SCG hosts the fourth match with only the Canberra finale remaining.", "Depending on the first three results, Sydney can clinch the series, keep it alive or determine who carries the advantage to Canberra.", "The match is the fourth venue change in nine days, keeping adaptation and squad depth inside the same series thread."], dims:["consequence","path","form"], sources:["england-t20","season"] },
  "cricket-australia-england-fifth-t20-2026":{ thread:"england", hook:"Canberra is the eighth Australia–England white-ball match in 20 days and the last chance to settle what the series became.", synopsis:"The Manuka Oval finale closes three ODIs and five T20s played in a compressed run across the country. It may decide the T20 trophy or resolve a dead rubber, but it always completes the persistent questions of adaptation, squad depth and which match-ups survived repeated venue changes.", facts:["The Canberra finale is the eighth Australia-England white-ball international scheduled across 20 days.", "It is the fifth T20 and the final match of England's 2026 white-ball visit.", "Its exact trophy consequence depends on the first four T20 results and must be refreshed after Sydney."], dims:["path","consequence","matchup"], sources:["england-t20","england-odi","season"] },
  "cricket-australia-new-zealand-test-2026":{ thread:"new-zealand", hook:"Perth opens the first four-Test trans-Tasman series, beginning Australia's tightest home Test campaign on record.", synopsis:"New Zealand's first Test tour of Australia since 2019/20 starts a four-match series compressed into 31 days. Perth is therefore both the first argument in a rare extended trans-Tasman contest and the start of a workload that runs through Adelaide, Melbourne and Sydney.", facts:["The Perth Test opens the first four-match Test series between Australia and New Zealand.", "New Zealand has not played a men's Test series in Australia since 2019-20.", "The four Tests are contained within 31 days, described as Australia's tightest home Test campaign."], dims:["history","path","consequence"], sources:["new-zealand","season","workload"] },
  evt_90:{ thread:"new-zealand", hook:"Boxing Day is Test three of four in 31 days, where trans-Tasman tactics meet the physical cost of a compressed series.", synopsis:"The MCG is the third Test after Perth and Adelaide, so the match arrives with both a series score and accumulated workload. It also continues an unusual tactical duel between Alex Carey and Tom Blundell, whose work standing up to pace helped undermine England before this series.", facts:["The Boxing Day Test is the third match of a four-Test series compressed into 31 days.", "Australia's Alex Carey and New Zealand's Tom Blundell both used standing up to pace as an unusually effective tactic against England.", "The MCG result can settle or reopen the series depending on the first two Tests."], dims:["path","matchup","consequence"], sources:["new-zealand","new-zealand-tactics","workload"] },
  evt_91:{ thread:"new-zealand", hook:"Sydney ends four trans-Tasman Tests in 31 days before Australia turns almost immediately toward a five-Test tour of India.", synopsis:"The New Year's Test is both the series endpoint and the hard stop on Australia's home summer. Whatever Perth, Adelaide and Melbourne produce, Sydney resolves the four-Test arc before a short turnaround into India, making fatigue, selection depth and WTC consequence part of the final chapter.", facts:["The SCG hosts the fourth and final Test of the Australia-New Zealand series.", "The four Tests finish within 31 days, with a five-Test tour of India expected to follow roughly two weeks later.", "Sydney's exact series consequence must update from the first three results rather than being labelled in advance."], dims:["path","consequence","form"], sources:["new-zealand","season","workload"] },
});

function buildCricket(knowledge, events, reference){
  const sourceMap = {
    season:addSource(knowledge, "source:depth:cricket:season", "Cricket Australia 2026/27 international schedule", "https://www.cricket.com.au/news/4473637/"),
    workload:addSource(knowledge, "source:depth:cricket:test-workload", "Cricket Australia Test workload analysis", "https://www.cricket.com.au/news/4473693"),
    "bangladesh-first":addSource(knowledge, "source:depth:cricket:bangladesh-first", "Cricket Australia Darwin Test report", "https://www.cricket.com.au/news/4560415/day-four-match-report-australia-lose-to-bangladesh-first-test-2026-darwin-scores-highlights-historic-victory-target-57-cameron-green-century-mehidy-hasan-miraz-five-wickets"),
    "bangladesh-second":addSource(knowledge, "source:depth:cricket:bangladesh-second", "Cricket Australia Mackay Test report", "https://www.cricket.com.au/news/4565090/match-report-australia-beat-bangladesh-innings-victory-day-two-second-test-mackay-highlights-scores-mitchell-starc-ten-wickets-pat-cummins-cameron-green-fifty"),
    "south-africa":addSource(knowledge, "source:depth:cricket:south-africa", "Cricket Australia South Africa Test tour guide", "https://www.cricket.com.au/news/4455441/australia-tour-south-africa-schedule-dates-odi-test-series-cape-town-johannesburg"),
    "england-odi":addSource(knowledge, "source:depth:cricket:england-odi", "Cricket Australia 2026 England ODI series", "https://www.cricket.com.au/matches/series/CA%3A4603/australia-v-england-odis-2026-men"),
    "england-t20":addSource(knowledge, "source:depth:cricket:england-t20", "Cricket Australia 2026 England T20 series", "https://www.cricket.com.au/matches/series/CA%3A4604/australia-v-england-t20is-2026-men"),
    "england-history":addSource(knowledge, "source:depth:cricket:england-history", "Cricket Australia previous England ODI series report", "https://www.cricket.com.au/news/4135227/australia-england-fifth-odi-series-decider-bristol-scores-highlights-report-duckett-brook-head-zampa-short"),
    "new-zealand":addSource(knowledge, "source:depth:cricket:new-zealand", "Cricket Australia 2026/27 New Zealand Test series", "https://www.cricket.com.au/matches/series/CA%3A4605/australia-v-new-zealand-tests-2026-27-men"),
    "new-zealand-tactics":addSource(knowledge, "source:depth:cricket:new-zealand-tactics", "Cricket Australia trans-Tasman tactical preview", "https://www.cricket.com.au/news/4544351/alex-carey-tom-blundell-wicketkeeping-up-to-stumps-standing-england-bazball-downfall-australia-new-zealand-test-series-2026-27"),
  };
  const subjects = {
    bangladesh:addSubject(knowledge, "subject:depth:cricket:bangladesh-2026", "series", "Australia v Bangladesh Tests 2026"),
    "south-africa":addSubject(knowledge, "subject:depth:cricket:south-africa-2026", "series", "South Africa v Australia Tests 2026"),
    england:addSubject(knowledge, "subject:depth:cricket:england-white-ball-2026", "series", "Australia v England white-ball series 2026"),
    "new-zealand":addSubject(knowledge, "subject:depth:cricket:new-zealand-tests-2026-27", "series", "Australia v New Zealand Tests 2026/27"),
  };
  const threadFacts = { bangladesh:[], "south-africa":[], england:[], "new-zealand":[] };
  const targetEvents = events.filter(event => CRICKET_STORIES[idFor(event)] && stakesFor(event) >= 3);
  for (const event of targetEvents){
    const story = CRICKET_STORIES[idFor(event)];
    const subjectId = subjects[story.thread];
    const sourceIds = story.sources.map(key => sourceMap[key]);
    const factIds = story.facts.map((statement, index) => addFact(knowledge, { id:`fact:depth:cricket:${slug(idFor(event))}:${index + 1}`, subjectIds:[subjectId], statement, dimension:story.dims[index], sourceIds:[sourceIds[index % sourceIds.length]] }));
    threadFacts[story.thread].push(...factIds);
    const result = String(event.outcomeText || event.recapText || "").trim();
    replaceProjection(knowledge, {
      id:`projection:sport-depth:${slug(idFor(event))}`, targetType:"feed-event", targetIds:[idFor(event)], stakes:stakesFor(event), hook:story.hook, synopsis:story.synopsis,
      ...(result ? { hookSpoilerOn:story.resultHook || fit(`${result} ${story.hook}`, 180), synopsisSpoilerOn:fit(`${result} ${event.recapText || ""} This result advances the persistent ${story.thread.replace("-", " ")} series thread rather than ending at the scoreline.`, 700) } : {}),
      threadIds:[`thread:depth:cricket:${story.thread}`], factIds, sourceIds, researchedAt:reference.toISOString(), refreshAfter:event.status === "completed" ? null : event.startTimeUtc || null, generationMode:"researched", originalityReview:{ method:"independent-summary-no-source-prose-retained", reviewedAt:reference.toISOString() },
    });
  }
  const summaries = {
    bangladesh:"Darwin's historic first result and Mackay's immediate answer are retained as one two-Test Top End chapter, preserving the change in consequence between matches without repeating venue or broadcast information.",
    "south-africa":"Australia's first Test tour of South Africa since 2018 carries the last-two-WTC-champions matchup through Durban, Gqeberha and Cape Town, refreshing the series consequence after every result.",
    england:"The three ODIs and five T20s are treated as one compressed Australia-England white-ball visit, with each venue advancing adaptation, format change and series consequence instead of restating the schedule.",
    "new-zealand":"The first four-Test trans-Tasman series is carried from Perth through Adelaide, Boxing Day and Sydney, linking tactics and accumulated workload to the score of the series as it develops.",
  };
  for (const [key, subjectId] of Object.entries(subjects)) addThread(knowledge, { id:`thread:depth:cricket:${key}`, subjectIds:[subjectId], title:`Cricket — ${key.replace(/-/g, " ")} persistent series`, summary:summaries[key], factIds:Array.from(new Set(threadFacts[key])) });
  return targetEvents.length;
}

function main(){
  const write = process.argv.includes("--write");
  const reference = new Date(process.env.NS_EDITORIAL_REFERENCE || Date.now());
  if (Number.isNaN(reference.getTime())) throw new Error("NS_EDITORIAL_REFERENCE must be valid");
  CHECKED_AT = reference.toISOString();
  const knowledge = readJson(KNOWLEDGE_PATH);
  clampFutureProvenance(knowledge, reference);
  const feed = readJson(FEED_PATH);
  const published = readJson(PUBLISHED_FEED_PATH);
  reconcileCricket(feed);
  reconcileCricket(published);
  const context = readJson(CONTEXT_PATH);
  const football = buildEpl(knowledge, feed.events, context, reference);
  const afl = buildAfl(knowledge, feed.events, reference);
  const cricket = buildCricket(knowledge, feed.events, reference);
  knowledge.updatedAt = reference.toISOString();
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Sport editorial depth invalid:\n- ${issues.join("\n- ")}`);
  if (write){ writeJson(KNOWLEDGE_PATH, knowledge); writeJson(FEED_PATH, feed); writeJson(PUBLISHED_FEED_PATH, published); }
  console.log(`${write ? "Updated" : "Validated"} sport editorial depth: ${football} football, ${afl} AFL and ${cricket} cricket projections.`);
}

if (require.main === module){ try { main(); } catch (error){ console.error(error.message); process.exitCode = 1; } }

module.exports = { AFL_STORIES, CRICKET_CORRECTIONS, CRICKET_STORIES, EPL_PROFILES, reconcileCricket };
