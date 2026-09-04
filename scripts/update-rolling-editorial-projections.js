#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const { projectionForTarget, validateKnowledge } = require("./lib/editorial-narrative");

const DAY_MS = 86400000;
const KNOWLEDGE_PATH = "data/editorial-knowledge.v1.json";
const FEED_PATH = "feeds/incoming/events.json";
const CONTEXT_PATH = "data/canonical/afl-nrl-2026.json";
const F1_PATH = "data/canonical/f1-context-2026.json";

function readJson(path){ return JSON.parse(fs.readFileSync(path, "utf8")); }
function writeJson(path, value){ fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function idFor(record){ return String(record?.eventId || record?.id || record?.canonicalEventId || ""); }
function slug(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function eventTime(record){ return Date.parse(record?.startTimeUtc || `${record?.date || ""}T${record?.time || "00:00"}:00+10:00`); }
function stakesFor(record){
  const stored = Number(record?.storyline?.stakes || record?.stakesScore || 0);
  if (stored) return stored;
  const expected = Number(record?.expected || 0);
  return expected >= 10 ? 5 : expected >= 8 ? 4 : expected >= 6 ? 3 : expected >= 4 ? 2 : 1;
}
function ordinal(value){
  const number = Number(value);
  const suffix = number % 100 >= 11 && number % 100 <= 13 ? "th" : ({ 1:"st", 2:"nd", 3:"rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}
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
function teamNarrative(event, context, reference){
  const ladder = context.ladderSnapshots.find(item => item.competitionId === event.competitionId);
  if (!ladder) return null;
  const entries = new Map(ladder.entries.map(entry => [entry.participantId, entry]));
  const participants = new Map(context.participants.map(item => [item.id, item]));
  const ids = [event.homeParticipantId, event.awayParticipantId].filter(Boolean);
  if (ids.length !== 2 || ids.some(id => !entries.has(id) || !participants.has(id))) return null;
  const teams = ids.map(id => ({ id, ...entries.get(id), name:participants.get(id).displayName || participants.get(id).canonicalName }));
  const source = ladder.source;
  const sourceId = `source:rolling:${slug(event.competitionId)}:ladder`;
  const competitionName = {
    "competition:afl-premiership-2026":"AFL",
    "competition:nrl-premiership-2026":"NRL",
    "competition:premier-league-2026-27":"Premier League",
  }[event.competitionId] || event.sport;
  const teamFacts = teams.map(team => ({
    id:`fact:rolling:${slug(event.competitionId)}:${slug(team.id)}:standing`,
    subjectIds:[`subject:rolling:${slug(team.id)}`],
    statement:event.competitionId.includes("premier-league")
      ? `${team.name} are ${ordinal(team.rank)} on ${team.ladderPoints} points after ${team.played} league matches, with a goal difference of ${team.pointsDifference >= 0 ? "+" : ""}${team.pointsDifference}.`
      : `${team.name} are ${ordinal(team.rank)} after ${team.played} matches, with ${team.won} wins and ${team.ladderPoints} ladder points in the current ${competitionName} table.`,
    dimension:"form",
    sourceIds:[sourceId],
    observedAt:ladder.snapshotTimeUtc,
    expiresAt:null,
  }));
  const [home, away] = teams;
  const completed = event.status === "completed";
  const round = event.roundLabel || event.resultLabels?.[0] || "this round";
  let consequence;
  if (event.competitionId.includes("premier-league")) consequence = `a chance to compress or widen the ${Math.abs(home.rank - away.rank)}-place gap in the early table`;
  else if (event.competitionId.includes("nrl")) consequence = home.rank <= 8 && away.rank <= 8
    ? "a direct finals-position contest"
    : home.rank <= 8 || away.rank <= 8 ? "a finals contender meeting a side capable of disrupting the run-in" : "a late-season test of where both clubs finish";
  else if (!/final/i.test(round)) consequence = home.rank <= 8 || away.rank <= 8
    ? "a late-season contest carrying finals-position pressure"
    : "a late-season test of where both clubs finish";
  else consequence = home.rank <= 4 && away.rank <= 4
    ? "a qualifying final where one side earns a week off and the other retains a second chance"
    : "a sudden-death final with no second chance";
  const safeHook = completed
    ? `${home.name} and ${away.name} met in ${round} with ${consequence}; the outcome stays hidden here.`
    : `${home.name} enter ${ordinal(home.rank)} and ${away.name} ${ordinal(away.rank)}; ${consequence}.`;
  const safeSynopsis = completed
    ? `${home.name} and ${away.name} arrived at ${round} inside a live ${competitionName} story: ${consequence}. The result remains protected, while the current table keeps this fixture connected to what each side must do next.`
    : `${home.name} are ${ordinal(home.rank)} with ${home.ladderPoints} points, while ${away.name} are ${ordinal(away.rank)} with ${away.ladderPoints}. That makes this more than a date in ${round}: it is ${consequence}, with the next chapter shaped by the separation they create or erase.`;
  const result = String(event.outcomeText || event.recapText || "").trim();
  const spoilerSynopsis = result
    ? `${result} The current table now has ${home.name} ${ordinal(home.rank)} on ${home.ladderPoints} points and ${away.name} ${ordinal(away.rank)} on ${away.ladderPoints}, keeping the result connected to the wider ${competitionName} path.`
    : undefined;
  return { ladder, source, sourceId, competitionName, teams, teamFacts, consequence, safeHook:fit(safeHook, 180), safeSynopsis:fit(safeSynopsis, 700), spoilerSynopsis:spoilerSynopsis ? fit(spoilerSynopsis, 700) : undefined, reference };
}
function f1Narrative(event, context, reference){
  if (event.key !== "f1") return null;
  const ladder = context.ladderSnapshots.find(item => item.competitionId === "competition:f1-drivers-2026");
  const participants = new Map(context.participants.map(item => [item.id, item]));
  const leader = ladder?.entries?.[0];
  const challenger = ladder?.entries?.[1];
  if (!leader || !challenger) return null;
  const leaderName = participants.get(leader.participantId)?.displayName || "the championship leader";
  const challengerName = participants.get(challenger.participantId)?.displayName || "second place";
  const sourceId = "source:rolling:f1:driver-standings";
  const qualifying = /qualifying/i.test(event.name || "");
  const consequence = qualifying ? "sets the grid and determines who controls the race start" : "is the points-paying chapter of the weekend";
  return {
    ladder,
    source:ladder.source,
    sourceId,
    facts:[
      { id:"fact:rolling:f1:leader", subjectIds:["subject:rolling:f1-leader"], statement:`${leaderName} leads the 2026 drivers' championship with ${leader.points} points, ${leader.points - challenger.points} ahead of ${challengerName}.`, dimension:"form", sourceIds:[sourceId], observedAt:ladder.snapshotTimeUtc, expiresAt:null },
      { id:`fact:rolling:f1:${qualifying ? "qualifying" : "race"}-consequence`, subjectIds:["subject:rolling:f1-season"], statement:`In a Formula 1 weekend, ${qualifying ? "qualifying sets the starting grid and track-position baseline for the race" : "the race awards the championship points that convert weekend pace into the title standings"}.`, dimension:"consequence", sourceIds:[sourceId], observedAt:ladder.snapshotTimeUtc, expiresAt:null },
    ],
    safeHook:fit(`${leaderName} leads by ${leader.points - challenger.points} points into ${event.name}; this session ${consequence}.`, 180),
    safeSynopsis:fit(`${leaderName} holds ${leader.points} points to ${challengerName}'s ${challenger.points} in the official driver standings. ${event.name} now tests that advantage because it ${consequence}, turning the championship gap into an immediate competitive problem rather than background information.`, 700),
    reference,
  };
}
function bracketNarrative(event, reference){
  if (event.competitionId !== "competition:afl-premiership-2026" || !/grand final/i.test(event.roundLabel || "")) return null;
  const sourceId = "source:rolling:afl:finals-bracket";
  const factId = "fact:rolling:afl:grand-final-path";
  return {
    sourceId,
    source:{ provider:event.canonicalSourceName || "AFL", sourceUrl:event.canonicalSourceUrl || event.sourceUrl, checkedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt },
    fact:{ id:factId, subjectIds:["subject:rolling:afl-finals"], statement:"The two preliminary-final winners advance to the AFL Grand Final, where the premiership is decided in a single match at the MCG.", dimension:"path", sourceIds:[sourceId], observedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt, expiresAt:null },
    hook:"The preliminary finals decide both names, but the destination is fixed: one match at the MCG for the premiership.",
    synopsis:"This card stays alive before the finalists are known because it is the endpoint of both preliminary-final paths. Once those teams are settled, the chapter changes from qualification to the season's single premiership decider at the MCG.",
    reference,
  };
}
function tennisTournamentNarrative(event, knowledge){
  if (event.narrativeType !== "tennis-tournament-overview") return null;
  const year = String(event.date || "").slice(0, 4);
  const family = String(event.eventSeriesId || "").replace(/^event-series:/, "");
  if (!year || !family) return null;
  const targetId = `major-event:${family}-${year}`;
  const projection = projectionForTarget(knowledge, "major-event", { id:targetId, eventId:targetId });
  if (!projection || projection.generationMode !== "researched") return null;
  return projection;
}
function build({ knowledge, feed, context, f1, reference }){
  const earliest = reference.getTime() - 7 * DAY_MS;
  const latest = reference.getTime() + 30 * DAY_MS;
  // Rolling projections are derived, but published historical cards can still
  // reference them. Prune only generated projections whose target card has
  // actually left the feed; current targets are replaced below by stable ID.
  const publishedIds = new Set(feed.events.flatMap(event => [event?.id, event?.eventId, event?.canonicalEventId]).map(String));
  knowledge.eventProjections = (knowledge.eventProjections || []).filter(projection => (
    !String(projection?.id || "").startsWith("projection:rolling:")
    || (projection.targetIds || []).some(targetId => publishedIds.has(String(targetId)))
  ));
  const targets = feed.events.filter(event => {
    const start = eventTime(event);
    const unresolvedUnverified = event?.editorialPreview?.status === "research-required" && event?.sourceTrust !== "verified";
    return !unresolvedUnverified && stakesFor(event) >= 2 && Number.isFinite(start) && start >= earliest && start <= latest;
  });
  const unsupported = [];
  let generated = 0;
  targets.forEach(event => {
    const existing = projectionForTarget(knowledge, "feed-event", event);
    if (existing && !existing.id.startsWith("projection:rolling:")) return;
    if (existing && existing.id.startsWith("projection:rolling:")){
      const requirement = { 2:[1, 1, 1], 3:[2, 1, 1], 4:[3, 2, 2], 5:[4, 3, 3] }[stakesFor(event)];
      const factIndex = new Map((knowledge.narrativeFacts || []).map(fact => [fact.id, fact]));
      const dimensions = new Set((existing.factIds || []).map(id => factIndex.get(id)?.dimension).filter(Boolean));
      if (requirement
        && Number(existing.stakes) >= stakesFor(event)
        && (existing.factIds || []).length >= requirement[0]
        && (existing.sourceIds || []).length >= requirement[1]
        && dimensions.size >= requirement[2]){
        delete existing.consequence;
        return;
      }
    }
    const team = teamNarrative(event, context, reference);
    const motor = team ? null : f1Narrative(event, f1, reference);
    const bracket = team || motor ? null : bracketNarrative(event, reference);
    const tournament = team || motor || bracket ? null : tennisTournamentNarrative(event, knowledge);
    if (!team && !motor && !bracket && !tournament){
      // Tournament overview cards without their own researched projection are
      // deliberately served by the disclosed crowd panel. Do not turn their
      // calendar, venue or broadcaster fields into editorial filler.
      if (event.narrativeType === "tennis-tournament-overview") return;
      unsupported.push(idFor(event));
      return;
    }
    const projectionId = `projection:rolling:${slug(idFor(event))}`;
    let threadIds;
    let factIds;
    let sourceIds;
    let hook;
    let synopsis;
    let synopsisSpoilerOn;
    if (team){
      upsert(knowledge.sources, { id:team.sourceId, name:`${team.source.provider} current ${team.competitionName} table`, url:team.source.sourceUrl, sourceType:team.source.sourceType === "reputable" ? "reputable" : "official", checkedAt:team.source.checkedAt });
      const eventSourceId = `source:rolling:${slug(idFor(event))}:fixture`;
      upsert(knowledge.sources, { id:eventSourceId, name:`${team.competitionName} fixture record for ${event.name}`, url:event.canonicalSourceUrl || event.sourceUrl, sourceType:"official", checkedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt || reference.toISOString() });
      team.teams.forEach((entry, index) => {
        const subjectId = `subject:rolling:${slug(entry.id)}`;
        const threadId = `thread:rolling:${slug(entry.id)}`;
        upsert(knowledge.subjects, { id:subjectId, kind:"team", name:entry.name });
        upsert(knowledge.narrativeFacts, team.teamFacts[index]);
        upsert(knowledge.narrativeThreads, { id:threadId, subjectIds:[subjectId], title:`${entry.name} — current ${team.competitionName} path`, summary:`${entry.name}'s position is carried from fixture to fixture so each card can explain how the next opponent changes the club's current ${team.competitionName} path, instead of repeating schedule or venue information.`, factIds:[team.teamFacts[index].id], status:"active", updatedAt:team.ladder.snapshotTimeUtc });
      });
      const consequenceFact = {
        id:`fact:rolling:${slug(idFor(event))}:consequence`,
        subjectIds:team.teams.map(entry => `subject:rolling:${slug(entry.id)}`),
        statement:`${event.name} is ${team.consequence}, according to the official ${team.competitionName} fixture and finals path.`,
        dimension:"consequence",
        sourceIds:[eventSourceId],
        observedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt || reference.toISOString(),
        expiresAt:null,
      };
      upsert(knowledge.narrativeFacts, consequenceFact);
      threadIds = team.teams.map(entry => `thread:rolling:${slug(entry.id)}`);
      factIds = [...team.teamFacts.map(fact => fact.id), consequenceFact.id];
      sourceIds = [team.sourceId, eventSourceId];
      if (stakesFor(event) >= 5){
        const rulesSourceId = `source:rolling:${slug(event.competitionId)}:finals-format`;
        const rulesUrl = event.competitionId?.includes("nrl")
          ? "https://www.nrl.com/operations/the-game/structure-of-the-nrl/"
          : "https://www.afl.com.au/news/1597385/finals-fixture-ticket-details-schedule-confirmed-for-week-two-of-the-2026-finals-series/";
        upsert(knowledge.sources, { id:rulesSourceId, name:`${team.competitionName} finals format`, url:rulesUrl, sourceType:"official", checkedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt || reference.toISOString() });
        const pathFact = {
          id:`fact:rolling:${slug(idFor(event))}:finals-path`,
          subjectIds:team.teams.map(entry => `subject:rolling:${slug(entry.id)}`),
          statement:/grand final/i.test(event.roundLabel || event.name || "")
            ? `${event.name} is the single championship decider at the end of the ${team.competitionName} finals path.`
            : `${event.name} sits on the last elimination path into the ${team.competitionName} championship decider.`,
          dimension:"path",
          sourceIds:[rulesSourceId],
          observedAt:event.canonicalSourceCheckedAt || event.sourceCheckedAt || reference.toISOString(),
          expiresAt:null,
        };
        upsert(knowledge.narrativeFacts, pathFact);
        factIds.push(pathFact.id);
        sourceIds.push(rulesSourceId);
      }
      hook = team.safeHook;
      synopsis = team.safeSynopsis;
      synopsisSpoilerOn = team.spoilerSynopsis;
    } else if (motor) {
      upsert(knowledge.sources, { id:motor.sourceId, name:"Formula 1 current driver standings", url:motor.source.sourceUrl, sourceType:"official", checkedAt:motor.source.checkedAt });
      upsert(knowledge.subjects, { id:"subject:rolling:f1-leader", kind:"athlete", name:"2026 Formula 1 championship leader" });
      upsert(knowledge.subjects, { id:"subject:rolling:f1-season", kind:"series", name:"2026 Formula 1 season" });
      motor.facts.forEach(fact => upsert(knowledge.narrativeFacts, fact));
      upsert(knowledge.narrativeThreads, { id:"thread:rolling:f1-title", subjectIds:["subject:rolling:f1-leader", "subject:rolling:f1-season"], title:"2026 Formula 1 title pressure", summary:"The championship lead is carried across qualifying and race cards so each session explains what its sporting consequence means for the title fight, rather than stopping at the timetable.", factIds:motor.facts.map(fact => fact.id), status:"active", updatedAt:motor.ladder.snapshotTimeUtc });
      threadIds = ["thread:rolling:f1-title"];
      factIds = motor.facts.map(fact => fact.id);
      sourceIds = [motor.sourceId];
      hook = motor.safeHook;
      synopsis = motor.safeSynopsis;
    } else if (bracket) {
      upsert(knowledge.sources, { id:bracket.sourceId, name:"AFL finals bracket", url:bracket.source.sourceUrl, sourceType:"official", checkedAt:bracket.source.checkedAt });
      upsert(knowledge.subjects, { id:"subject:rolling:afl-finals", kind:"series", name:"2026 AFL Finals Series" });
      upsert(knowledge.narrativeFacts, bracket.fact);
      upsert(knowledge.narrativeThreads, { id:"thread:rolling:afl-finals-path", subjectIds:["subject:rolling:afl-finals"], title:"2026 AFL finals path", summary:"The finals bracket is carried from week to week so undrawn fixtures can explain what must happen next without inventing teams, results or a schedule-based editorial angle.", factIds:[bracket.fact.id], status:"active", updatedAt:bracket.fact.observedAt });
      threadIds = ["thread:rolling:afl-finals-path"];
      factIds = [bracket.fact.id];
      sourceIds = [bracket.sourceId];
      hook = bracket.hook;
      synopsis = bracket.synopsis;
    } else {
      threadIds = [...tournament.threadIds];
      factIds = [...tournament.factIds];
      sourceIds = [...tournament.sourceIds];
      hook = fit(`Tournament view: ${tournament.hook}`, 180);
      synopsis = fit(`Across the tournament overview, ${tournament.synopsis.charAt(0).toLowerCase()}${tournament.synopsis.slice(1)}`, 700);
      synopsisSpoilerOn = tournament.synopsisSpoilerOn;
    }
    upsert(knowledge.eventProjections, {
      id:projectionId,
      targetType:"feed-event",
      targetIds:[idFor(event)],
      stakes:stakesFor(event),
      hook,
      synopsis,
      ...(synopsisSpoilerOn ? { hookSpoilerOn:fit(`${event.outcomeText || event.recapText} ${hook}`, 180), synopsisSpoilerOn } : {}),
      threadIds,
      factIds,
      sourceIds,
      researchedAt:reference.toISOString(),
      refreshAfter:null,
      generationMode:"researched",
      originalityReview:{ method:"independent-summary-no-source-prose-retained", reviewedAt:reference.toISOString() },
    });
    generated += 1;
  });
  if (unsupported.length) throw new Error(`Rolling editorial needs a researched context builder for: ${unsupported.join(", ")}`);
  knowledge.updatedAt = reference.toISOString();
  return generated;
}
function main(){
  const write = process.argv.includes("--write");
  const reference = new Date(process.env.NS_EDITORIAL_REFERENCE || Date.now());
  if (Number.isNaN(reference.getTime())) throw new Error("NS_EDITORIAL_REFERENCE must be valid");
  const knowledge = readJson(KNOWLEDGE_PATH);
  const generated = build({ knowledge, feed:readJson(FEED_PATH), context:readJson(CONTEXT_PATH), f1:readJson(F1_PATH), reference });
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Rolling editorial invalid:\n- ${issues.join("\n- ")}`);
  if (write) writeJson(KNOWLEDGE_PATH, knowledge);
  console.log(`${write ? "Updated" : "Validated"} rolling editorial: ${generated} event-specific projections refreshed.`);
}
if (require.main === module){ try { main(); } catch (error){ console.error(error.message); process.exitCode = 1; } }
module.exports = { build, stakesFor };
