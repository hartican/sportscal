#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const { projectionForTarget, validateKnowledge } = require("./lib/editorial-narrative");

const DAY_MS = 86400000;
const KNOWLEDGE_PATH = "data/editorial-knowledge.v1.json";
const FEED_PATH = "feeds/incoming/events.json";
const CONTEXT_PATH = "data/canonical/afl-nrl-2026.json";
const F1_PATH = "data/canonical/f1-context-2026.json";
const WRC_PATH = "data/canonical/wrc-context-2026.json";
const REQUESTED_SPORTS_PATH = "data/canonical/fiba-women-sailgp-motogp-2026.json";

function readJson(path){ return JSON.parse(fs.readFileSync(path, "utf8")); }
function writeJson(path, value){ fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function idFor(record){ return String(record?.eventId || record?.id || record?.canonicalEventId || ""); }
function slug(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function eventTime(record){ return Date.parse(record?.startTimeUtc || `${record?.date || ""}T${record?.time || "00:00"}:00+10:00`); }
const {researchDepthFor}=require('./lib/editorial-research-depth');
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
  const circuit=/Italian/.test(event.name||'')?{slug:'italy',fact:'Monza pairs long full-throttle sections with heavy braking into chicanes.'}:/Spanish/.test(event.name||'')?{slug:'spain',fact:'Madring makes its Grand Prix debut in 2026 with a 22-corner layout and a banked Turn 12.'}:null;
  const constructors=context.ladderSnapshots.find(item=>item.competitionId==='competition:f1-constructors-2026');
  const front=constructors?.entries?.[0],second=constructors?.entries?.[1];
  const extraSources=circuit&&front&&second?[{id:'source:rolling:f1:constructors',name:'Formula 1 constructors standings',url:constructors.source.sourceUrl,sourceType:'official',checkedAt:constructors.snapshotTimeUtc},{id:`source:rolling:f1:circuit:${circuit.slug}`,name:'Formula 1 official circuit guide',url:`https://www.formula1.com/en/racing/2026/${circuit.slug}`,sourceType:'official',checkedAt:reference.toISOString()}]:[];
  const consequence = qualifying ? "sets the grid and determines who controls the race start" : "is the points-paying chapter of the weekend";
  return {
    ladder,
    source:ladder.source,
    sourceId,
    extraSources,
    facts:[
      ...(extraSources.length ? [
        {id:'fact:rolling:f1:constructors',subjectIds:['subject:rolling:f1-season'],statement:`${participants.get(front.participantId).displayName} has ${front.points} constructors points to ${participants.get(second.participantId).displayName}'s ${second.points}.`,dimension:'form',sourceIds:[extraSources[0].id],observedAt:constructors.snapshotTimeUtc,expiresAt:null},
        {id:`fact:rolling:f1:circuit:${circuit.slug}`,subjectIds:['subject:rolling:f1-season'],statement:circuit.fact,dimension:'format',sourceIds:[extraSources[1].id],observedAt:reference.toISOString(),expiresAt:null}
      ] : []),
      { id:"fact:rolling:f1:leader", subjectIds:["subject:rolling:f1-leader"], statement:`${leaderName} leads the 2026 drivers' championship with ${leader.points} points, ${leader.points - challenger.points} ahead of ${challengerName}.`, dimension:"form", sourceIds:[sourceId], observedAt:ladder.snapshotTimeUtc, expiresAt:null },
      { id:`fact:rolling:f1:${qualifying ? "qualifying" : "race"}-consequence`, subjectIds:["subject:rolling:f1-season"], statement:`In a Formula 1 weekend, ${qualifying ? "qualifying sets the starting grid and track-position baseline for the race" : "the race awards the championship points that convert weekend pace into the title standings"}.`, dimension:"consequence", sourceIds:[sourceId], observedAt:ladder.snapshotTimeUtc, expiresAt:null },
    ],
    safeHook:fit(`${leaderName} leads by ${leader.points - challenger.points} points into ${event.name}; this session ${consequence}.`, 180),
    safeSynopsis:fit(`${leaderName} holds ${leader.points} points to ${challengerName}'s ${challenger.points} in the official driver standings. ${event.name} now tests that advantage because it ${consequence}, turning the championship gap into an immediate competitive problem rather than background information.`, 700),
    reference,
  };
}
function wrcNarrative(event, context, reference){
  if (event.key !== "wrc") return null;
  const sourceEvent = context.events.find(item => item.id === event.canonicalEventId);
  const ladder = context.ladderSnapshots.find(item => item.competitionId === "competition:wrc-drivers-2026");
  const participants = new Map(context.participants.map(item => [item.id, item]));
  const leader = ladder?.entries?.[0];
  const challenger = ladder?.entries?.[1];
  if (!sourceEvent || !leader || !challenger) return null;
  const leaderName = participants.get(leader.participantId)?.displayName || "the championship leader";
  const challengerName = participants.get(challenger.participantId)?.displayName || "second place";
  const lead = Number(leader.points) - Number(challenger.points);
  const roundsAfter = Math.max(0, context.events.length - sourceEvent.roundNumber);
  const calendarSource = context.sources.find(source => source.provider === "WRC");
  const standingsSource = ladder.source || context.sources.find(source => source.provider === "FIA");
  const broadcastSource = context.sources.find(source => source.provider === "Stan Sport");
  if (!calendarSource || !standingsSource || !broadcastSource) return null;
  const sourceIds = {
    calendar:"source:rolling:wrc:calendar",
    standings:"source:rolling:wrc:driver-standings",
    broadcast:"source:rolling:wrc:stan-sport",
  };
  const sources = [
    { id:sourceIds.calendar, name:"WRC official 2026 calendar", url:calendarSource.sourceUrl, sourceType:"official", checkedAt:calendarSource.checkedAt },
    { id:sourceIds.standings, name:"FIA World Rally Championship driver standings", url:standingsSource.sourceUrl, sourceType:"official", checkedAt:standingsSource.checkedAt },
    { id:sourceIds.broadcast, name:"Stan Sport WRC coverage", url:broadcastSource.sourceUrl, sourceType:"official", checkedAt:broadcastSource.checkedAt },
  ];
  const subjectId = "subject:rolling:wrc:2026";
  const observedAt = ladder.snapshotTimeUtc || standingsSource.checkedAt || reference.toISOString();
  const facts = [
    { id:`fact:rolling:${slug(sourceEvent.id)}:schedule`, statement:`${sourceEvent.displayName} is Round ${sourceEvent.roundNumber} of 14, scheduled from ${sourceEvent.date} to ${sourceEvent.endDate} in ${sourceEvent.country}.`, dimension:"schedule", sourceIds:[sourceIds.calendar] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:standings`, statement:`${leaderName} leads the 2026 WRC drivers' championship on ${leader.points} points, ${lead} ahead of ${challengerName}.`, dimension:"form", sourceIds:[sourceIds.standings] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:path`, statement:`After ${sourceEvent.displayName}, ${roundsAfter} championship round${roundsAfter === 1 ? " remains" : "s remain"} in the official 14-round calendar.`, dimension:"path", sourceIds:[sourceIds.calendar] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:viewing`, statement:`Stan Sport lists live and replay coverage for the 2026 World Rally Championship in Australia.`, dimension:"format", sourceIds:[sourceIds.broadcast] },
  ].map(fact => ({ ...fact, subjectIds:[subjectId], observedAt, expiresAt:null }));
  const hook = `${leaderName} carries a ${lead}-point lead over ${challengerName} into ${sourceEvent.displayName}, Round ${sourceEvent.roundNumber} of 14.`;
  const synopsis = `${sourceEvent.displayName} runs from ${sourceEvent.date} to ${sourceEvent.endDate} in ${sourceEvent.country}. ${leaderName} leads ${challengerName} by ${lead} points in the official FIA driver standings, and ${roundsAfter} round${roundsAfter === 1 ? " remains" : "s remain"} after this one. Stan Sport lists live and replay coverage in Australia.`;
  return { sourceEvent, ladder, sources, facts, subjectId, threadId:"thread:rolling:wrc:2026", hook:fit(hook, 180), synopsis:fit(synopsis, 700), reference };
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
function requestedSportNarrative(event, requestedSports, reference){
  const sourceEvent = (requestedSports?.events || []).find(item => item.id === event.canonicalEventId);
  if (!sourceEvent) return null;
  const config = {
    nrlw:{ label:"2026 NRLW Premiership", subjectKind:"competition", fieldSourceId:"nrlw-hub", contextSourceId:"nrlw-stats", fieldStatement:"The 2026 NRLW Premiership has twelve current clubs in the official competition." },
    "fiba-women":{ label:"2026 FIBA Women's Basketball World Cup", subjectKind:"competition", fieldSourceId:"fiba-teams", contextSourceId:"fiba-broadcast-au", fieldStatement:"Sixteen national teams are listed in the official 2026 FIBA Women's Basketball World Cup field." },
    sailgp:{ label:"2026 SailGP season", subjectKind:"series", fieldSourceId:"sailgp-teams", contextSourceId:"sailgp-broadcast-au", fieldStatement:"Thirteen national F50 teams are listed for the 2026 SailGP season." },
    motogp:{ label:"2026 MotoGP season", subjectKind:"series", fieldSourceId:"motogp-riders", contextSourceId:"motogp-broadcast-au", fieldStatement:"Twenty-two riders are listed in the official 2026 MotoGP field." },
  }[sourceEvent.sportKey];
  if (!config) return null;
  const sourceIds = Array.from(new Set([sourceEvent.sourceId, config.fieldSourceId, sourceEvent.broadcastSourceId, config.contextSourceId, sourceEvent.result?.sourceId].filter(Boolean)));
  const sources = sourceIds.map(sourceId => {
    const source = requestedSports.sources?.[sourceId];
    if (!source) throw new Error(`${sourceEvent.id}: unknown requested-sport editorial source ${sourceId}`);
    return {
      id:`source:rolling:${sourceEvent.sportKey}:${sourceId}`,
      name:source.name,
      url:source.url,
      sourceType:source.type === "reputable" ? "reputable" : "official",
      checkedAt:requestedSports.generatedAt,
    };
  });
  const sourceId = rawId => `source:rolling:${sourceEvent.sportKey}:${rawId}`;
  const timeText = sourceEvent.timeTbc ? "with its start time still to be confirmed" : `at ${sourceEvent.time} Sydney time`;
  const venueText = sourceEvent.venue ? ` at ${sourceEvent.venue}` : "";
  const facts = [
    { id:`fact:rolling:${slug(sourceEvent.id)}:schedule`, statement:`${sourceEvent.name} is scheduled for ${sourceEvent.date} ${timeText}${venueText}.`, dimension:"schedule", sourceIds:[sourceId(sourceEvent.sourceId)] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:field`, statement:config.fieldStatement, dimension:"format", sourceIds:[sourceId(config.fieldSourceId)] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:viewing`, statement:`Australian viewing for ${sourceEvent.name} is listed through ${event.broadcaster}.`, dimension:"format", sourceIds:[sourceId(sourceEvent.broadcastSourceId)] },
    { id:`fact:rolling:${slug(sourceEvent.id)}:consequence`, statement:sourceEvent.context, dimension:"consequence", sourceIds:[sourceId(config.contextSourceId)] },
    ...(sourceEvent.result ? [{
      id:`fact:rolling:${slug(sourceEvent.id)}:result`,
      statement:sourceEvent.result.status === "official"
        ? `${sourceEvent.result.recapText || sourceEvent.result.outcomeText}`
        : `The official results page had not published a verified outcome for ${sourceEvent.name} at the latest check.`,
      dimension:"consequence",
      sourceIds:[sourceId(sourceEvent.result.sourceId)],
    }] : []),
  ].map(fact => ({ ...fact, subjectIds:[`subject:rolling:${sourceEvent.sportKey}:2026`], observedAt:requestedSports.generatedAt, expiresAt:null }));
  const completed = event.status === "completed";
  const spoilerSafeHook = `${sourceEvent.name} is complete; the key moments are protected until you choose to reveal them.`;
  const spoilerSafeSynopsis = `${sourceEvent.name} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`;
  const revealedHook = sourceEvent.result?.status === "official" ? sourceEvent.result.outcomeText : `${sourceEvent.name} is complete; the official outcome is still pending.`;
  const revealedSynopsis = sourceEvent.result?.status === "official" ? sourceEvent.result.recapText : `${sourceEvent.name} is complete, but the official results page had not published a verified outcome at the latest check.`;
  return {
    label:config.label,
    subjectKind:config.subjectKind,
    subjectId:`subject:rolling:${sourceEvent.sportKey}:2026`,
    threadId:`thread:rolling:${sourceEvent.sportKey}:2026`,
    sources,
    facts,
    hook:fit(completed ? spoilerSafeHook : sourceEvent.hook, 180),
    synopsis:fit(completed ? spoilerSafeSynopsis : `${sourceEvent.hook} ${sourceEvent.context}`, 700),
    ...(completed ? { hookSpoilerOn:fit(revealedHook, 180), synopsisSpoilerOn:fit(revealedSynopsis, 700) } : {}),
    reference,
  };
}
function build({ knowledge, feed, context, f1, wrc, requestedSports, reference }){
  const earliest = reference.getTime() - 7 * DAY_MS;
  const latest = reference.getTime() + 30 * DAY_MS;
  const requestedLatest = reference.getTime() + 120 * DAY_MS;
  const requestedEventIds = new Set((requestedSports?.events || []).map(event => event.id));
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
    const eventLatest = requestedEventIds.has(event.canonicalEventId) ? requestedLatest : latest;
    return !unresolvedUnverified && researchDepthFor(event) >= 2 && Number.isFinite(start) && start >= earliest && start <= eventLatest;
  });
  const unsupported = [];
  let generated = 0;
  targets.forEach(event => {
    const existing = projectionForTarget(knowledge, "feed-event", event);
    if (existing && !existing.id.startsWith("projection:rolling:")) return;
    if (existing && existing.id.startsWith("projection:rolling:")){
      const requirement = { 2:[1, 1, 1], 3:[2, 1, 1], 4:[3, 2, 2], 5:[4, 3, 3] }[researchDepthFor(event)];
      const factIndex = new Map((knowledge.narrativeFacts || []).map(fact => [fact.id, fact]));
      const dimensions = new Set((existing.factIds || []).map(id => factIndex.get(id)?.dimension).filter(Boolean));
      const currentSnapshot = event.key === "f1"
        ? f1.ladderSnapshots.find(item => item.competitionId === "competition:f1-drivers-2026")
        : event.key === "wrc"
          ? wrc.ladderSnapshots.find(item => item.competitionId === "competition:wrc-drivers-2026")
          : requestedEventIds.has(event.canonicalEventId)
            ? { snapshotTimeUtc:requestedSports.events.find(item => item.id === event.canonicalEventId)?.result?.checkedAt || requestedSports.generatedAt }
            : context.ladderSnapshots.find(item => item.competitionId === event.competitionId);
      const currentSnapshotAt = Date.parse(currentSnapshot?.snapshotTimeUtc || currentSnapshot?.source?.checkedAt || "");
      const existingResearchedAt = Date.parse(existing.researchedAt || "");
      const isCurrent = !Number.isFinite(currentSnapshotAt)
        || (Number.isFinite(existingResearchedAt) && existingResearchedAt >= currentSnapshotAt);
      if (requirement
        && isCurrent
        && (event.status !== "completed" || Boolean(existing.synopsisSpoilerOn))
        && Number(existing.researchDepth || existing.stakes) >= researchDepthFor(event)
        && (existing.factIds || []).length >= requirement[0]
        && (existing.sourceIds || []).length >= requirement[1]
        && dimensions.size >= requirement[2]){
        delete existing.consequence;
        return;
      }
    }
    const team = teamNarrative(event, context, reference);
    const motor = team ? null : f1Narrative(event, f1, reference);
    const rally = team || motor ? null : wrcNarrative(event, wrc, reference);
    const bracket = team || motor || rally ? null : bracketNarrative(event, reference);
    const tournament = team || motor || rally || bracket ? null : tennisTournamentNarrative(event, knowledge);
    const requestedSport = team || motor || rally || bracket || tournament ? null : requestedSportNarrative(event, requestedSports, reference);
    if (!team && !motor && !rally && !bracket && !tournament && !requestedSport){
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
    let hookSpoilerOn;
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
      if (researchDepthFor(event) >= 5){
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
      motor.extraSources.forEach(source=>upsert(knowledge.sources,source));
      sourceIds = [motor.sourceId,...motor.extraSources.map(source=>source.id)];
      hook = motor.safeHook;
      synopsis = motor.safeSynopsis;
    } else if (rally) {
      rally.sources.forEach(source => upsert(knowledge.sources, source));
      upsert(knowledge.subjects, { id:rally.subjectId, kind:"series", name:"2026 FIA World Rally Championship" });
      rally.facts.forEach(fact => upsert(knowledge.narrativeFacts, fact));
      upsert(knowledge.narrativeThreads, {
        id:rally.threadId,
        subjectIds:[rally.subjectId],
        title:"2026 WRC title pressure",
        summary:"The official calendar, driver standings and Australian viewing source are carried across WRC round cards so each rally explains its place in the championship run-in.",
        factIds:rally.facts.map(fact => fact.id),
        status:"active",
        updatedAt:rally.ladder.snapshotTimeUtc,
      });
      threadIds = [rally.threadId];
      factIds = rally.facts.map(fact => fact.id);
      sourceIds = rally.sources.map(source => source.id);
      hook = rally.hook;
      synopsis = rally.synopsis;
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
    } else if (requestedSport) {
      requestedSport.sources.forEach(source => upsert(knowledge.sources, source));
      upsert(knowledge.subjects, { id:requestedSport.subjectId, kind:requestedSport.subjectKind, name:requestedSport.label });
      requestedSport.facts.forEach(fact => upsert(knowledge.narrativeFacts, fact));
      upsert(knowledge.narrativeThreads, {
        id:requestedSport.threadId,
        subjectIds:[requestedSport.subjectId],
        title:`${requestedSport.label} — current path`,
        summary:`The official schedule, field and Australian viewing sources are carried across ${requestedSport.label} cards so each event explains its sporting consequence without generic filler.`,
        factIds:requestedSport.facts.map(fact => fact.id),
        status:"active",
        updatedAt:requestedSport.reference.toISOString(),
      });
      threadIds = [requestedSport.threadId];
      factIds = requestedSport.facts.map(fact => fact.id);
      sourceIds = requestedSport.sources.map(source => source.id);
      hook = requestedSport.hook;
      synopsis = requestedSport.synopsis;
      hookSpoilerOn = requestedSport.hookSpoilerOn;
      synopsisSpoilerOn = requestedSport.synopsisSpoilerOn;
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
      researchDepth:researchDepthFor(event),
      hook,
      synopsis,
      ...(synopsisSpoilerOn ? {
        hookSpoilerOn:fit(hookSpoilerOn || event.outcomeText || `${event.displayTitleCompact || event.name || "This fixture"} is complete.`, 180),
        synopsisSpoilerOn,
      } : {}),
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
  const generated = build({ knowledge, feed:readJson(FEED_PATH), context:readJson(CONTEXT_PATH), f1:readJson(F1_PATH), wrc:readJson(WRC_PATH), requestedSports:readJson(REQUESTED_SPORTS_PATH), reference });
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Rolling editorial invalid:\n- ${issues.join("\n- ")}`);
  if (write) writeJson(KNOWLEDGE_PATH, knowledge);
  console.log(`${write ? "Updated" : "Validated"} rolling editorial: ${generated} event-specific projections refreshed.`);
}
if (require.main === module){ try { main(); } catch (error){ console.error(error.message); process.exitCode = 1; } }
module.exports = { build, researchDepthFor };
