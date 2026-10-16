#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const {
  fixtureSourceMetadata,
  applyToFeedEvent,
  applyToMajorEvent,
  editorialNarrativeFor,
  indexesFor,
  projectionTargetIds,
  projectionRecordIndex,
  projectionForTarget,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");
const majorEventContract = require("../config/major-events.js");
const competitionClassification = require("../config/competition-classification.js");

const WRITE = process.argv.includes("--write");
const MAJOR_ONLY = process.argv.includes("--major-events-only");
const KNOWLEDGE_PATH = path.resolve("data/editorial-knowledge.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const PUBLISHED_FEED_PATH = path.resolve("data/events.json");
const MAJOR_EVENTS_PATH = path.resolve("data/major-events.v1.json");

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

function projectionConforms(event, projection, indexes){
  const actual = event.editorialNarrative;
  if (!actual) return false;
  const expected = editorialNarrativeFor(projection, indexes);
  const completed = event.status === "completed" && event.key !== "horse-racing" && event.sportKey !== "horse-racing";
  // A fixture review and a research observation are different clocks. Do not
  // backdate a reviewed card merely because the same research is reapplied.
  const observationKeys = new Set(["researchedAt", "refreshAfter", ...(completed ? ["hookSpoilerOn", "synopsisSpoilerOn"] : [])]);
  if (Object.keys(expected).some(key => !observationKeys.has(key) && !isDeepStrictEqual(actual[key], expected[key]))) return false;
  for (const key of ["formCopy", "closingCopy", "consequence", "sentiment", ...(completed ? [] : ["hookSpoilerOn", "synopsisSpoilerOn"])]){
    if (!isDeepStrictEqual(actual[key], expected[key])) return false;
  }
  if (event.editorialPreview?.sourceUrl !== indexes.sources.get(projection.sourceIds[0])?.url) return false;
  const projected = applyToFeedEvent(event, projection, indexes);
  for (const key of ['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn','arcStage','researchDepth']){
    if (event.storyline?.[key] !== projected.storyline?.[key]) return false;
  }
  if (!completed) return event.selectedSentence === projection.hook && event.fullSpiel === projection.synopsis;
  const lifecycle = require('../config/editorial-lifecycle');
  if (actual.resultResearchRequired || actual.resultSignature !== lifecycle.signature(event)) return false;
  const resultCopy = projected.editorialNarrative;
  for (const key of ["hookSpoilerOn", "synopsisSpoilerOn", "phase"]){
    if (actual[key] !== resultCopy[key]) return false;
  }
  return event.selectedSentence === event.storyline?.hookSpoilerOff
    && event.fullSpiel === event.storyline?.synopsisSpoilerOff
    && require('./lib/storyline-card-rules').spoilerContractIssues(event).length === 0;
}

function laterReview(current, researched){
  return Number.isFinite(Date.parse(current)) && (!Number.isFinite(Date.parse(researched)) || Date.parse(current) >= Date.parse(researched)) ? current : researched;
}

function reconcileFeedEvent(event, projection, indexes){
  if (require('../config/editorial-maintenance').protectedFixture(event) || projectionConforms(event, projection, indexes)) return event;
  const projected = applyToFeedEvent(event, projection, indexes);
  // Reconciliation owns commentary, not sporting facts, result evidence,
  // source observations, Follow state or already staged post-match writing.
  return {
    ...event,
    selectedSentence:projected.selectedSentence,
    fullSpiel:projected.fullSpiel,
    editorialNarrative:projected.editorialNarrative,
    editorialPreview:projected.editorialPreview,
    lastReviewedAt:laterReview(event.lastReviewedAt, projected.lastReviewedAt),
    storyline:{
      ...projected.storyline,
      lastReviewedAt:laterReview(event.storyline?.lastReviewedAt, projected.storyline?.lastReviewedAt),
    },
  };
}

function main(){
  const knowledge = readJson(KNOWLEDGE_PATH);
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Editorial knowledge invalid:\n- ${issues.join("\n- ")}`);
  const locks=require('../config/editorial-locks');
  const retained=[...readJson(FEED_PATH).events,...readJson(PUBLISHED_FEED_PATH).events];
  const retainedOrder=new WeakMap(retained.map((event,index)=>[event,index]));
  const retainedByIdentity=projectionRecordIndex([...retained].reverse());
  knowledge.eventProjections=knowledge.eventProjections.map(projection=>{
    if(projection.targetType!=='feed-event')return projection;
    const event=projection.targetIds.map(id=>retainedByIdentity.get(id)).filter(Boolean).sort((a,b)=>retainedOrder.get(a)-retainedOrder.get(b))[0];
    return event ? locks.projection(event,projection) : projection;
  });
  const indexes = indexesFor(knowledge);

  function applyFeed(document){
    let applied = 0;
    document.events = document.events.map(event => {
      if (require('../config/editorial-maintenance').protectedFixture(event)) return event;
      const projection = projectionForTarget(knowledge, "feed-event", event);
      if (!projection){
        const narrative = event.editorialNarrative;
        const primarySource = indexes.sources.get(narrative?.sourceIds?.[0]);
        if (!narrative?.hook || !narrative?.synopsis || !primarySource) return event;
        const completed = event.status === 'completed' && event.key !== 'horse-racing' && event.sportKey !== 'horse-racing';
        const copy = completed ? require('../config/editorial-lifecycle').copy(event,narrative,false) : narrative;
        if (event.selectedSentence === copy.hook && event.fullSpiel === copy.synopsis && event.editorialPreview?.sourceUrl === primarySource.url && require('./lib/storyline-card-rules').spoilerContractIssues(event).length === 0) return event;
        const threadTitle = indexes.threads.get(narrative.threadIds?.[0])?.title || "Finals path";
        return {
          ...event,
          selectedSentence:copy.hook,
          fullSpiel:copy.synopsis,
          ...fixtureSourceMetadata(event,primarySource),
          lastReviewedAt:laterReview(event.lastReviewedAt,narrative.researchedAt),
          editorialPreview:{
            status:"journalistic",
            angle:threadTitle,
            contextSignals:Array.from(new Set(["event-specific", ...(narrative.dimensions || []).map(value => `narrative:${value}`)])),
            sourceName:primarySource.name,
            sourceUrl:primarySource.url,
            sourceCheckedAt:primarySource.checkedAt,
            needsPreviewRefresh:false,
          },
        };
      }
      applied += 1;
      return reconcileFeedEvent(event, projection, indexes);
    });
    return applied;
  }
  const feed = readJson(FEED_PATH);
  const publishedFeed = readJson(PUBLISHED_FEED_PATH);
  const fixtureIdsArgument=process.argv.find(arg=>arg.startsWith('--fixture-ids='));
  const fixtureIds=fixtureIdsArgument?new Set(fixtureIdsArgument.slice('--fixture-ids='.length).split(',').filter(Boolean)):null;
  if(fixtureIds&&!MAJOR_ONLY)throw new Error('Scoped fixture projection requires --major-events-only.');
  const scopedKeys=fixtureIds?new Set([...feed.events,...publishedFeed.events].filter(event=>fixtureIds.has(event.id)).map(event=>majorEventContract.fixtureSemanticKey(event)).filter(Boolean)):null;
  const feedApplied = applyFeed(feed);
  applyFeed(publishedFeed);

  const majorEvents = readJson(MAJOR_EVENTS_PATH);
  let majorApplied = 0;
  let childApplied = 0;
  majorEvents.events = majorEvents.events.map(record => {
    const projection = fixtureIds?null:projectionForTarget(knowledge, "major-event", record);
    const projectedParent = projection ? applyToMajorEvent(record, projection, indexes) : record;
    if (projection) majorApplied += 1;
    if (!Array.isArray(projectedParent.subEvents)) return projectedParent;
    return {
      ...projectedParent,
      subEvents:projectedParent.subEvents.map(subEvent => {
        if(scopedKeys){
          const fixture=majorEventContract.fixtureFromSubEvent(subEvent,projectedParent);
          if(!fixture||!scopedKeys.has(majorEventContract.fixtureSemanticKey(fixture)))return subEvent;
        }
        const resolved = majorEventContract.editorialRecordForSubEvent(
          subEvent,
          projectedParent,
          [...feed.events, ...publishedFeed.events],
        );
        const narrative = resolved?.editorialNarrative;
        if (!narrative) return subEvent;
        childApplied += 1;
        return {
          ...subEvent,
          editorialNarrative:narrative,
          storyline:{
            ...(subEvent.storyline || {}),
            stakes:Number(subEvent.stakesScore || projectedParent.stakesScore || 5),
            hookSpoilerOff:narrative.hook,
            hookSpoilerOn:narrative.hook,
            synopsisSpoilerOff:narrative.synopsis,
            synopsisSpoilerOn:narrative.synopsis,
            arcStage:"preview",
          },
        };
      }),
    };
  });

  const expectedFeed = new Set(knowledge.eventProjections.filter(item => item.targetType === "feed-event").flatMap(item => item.targetIds));
  const expectedMajor = new Set(knowledge.eventProjections
    .filter(item => item.targetType === "major-event")
    .flatMap(item => item.targetIds)
    .filter(id => competitionClassification.belongsInEvents(id)));
  const catalogueEvents=[...(require('../data/follow-sources/coverage.v1.json').events || []),...require('../data/tennis-feed-parents.v1.json').parents];
  const foundFeed = new Set([...feed.events,...publishedFeed.events,...catalogueEvents].flatMap(projectionTargetIds).filter(id => expectedFeed.has(id)));
  const foundMajor = new Set(majorEvents.events.map(record => record.id).filter(id => expectedMajor.has(id)));
  const missing = [...expectedFeed].filter(id => !foundFeed.has(id)).concat([...expectedMajor].filter(id => !foundMajor.has(id)));
  if (missing.length) throw new Error(`Editorial projections reference missing targets: ${missing.join(", ")}`);

  if (WRITE){
    if (!MAJOR_ONLY){
      writeJson(KNOWLEDGE_PATH, knowledge);
      writeJson(FEED_PATH, feed);
      writeJson(PUBLISHED_FEED_PATH, publishedFeed);
    }
    writeJson(MAJOR_EVENTS_PATH, majorEvents);
  }
  console.log(`${WRITE ? "Applied" : "Would apply"} ${MAJOR_ONLY ? 0 : feedApplied} feed, ${majorApplied} major-event and ${childApplied} fixture-child editorial projections.`);
}

function applyScopedFeed(ids, root = process.cwd()){
  if (!Array.isArray(ids) || !ids.length || ids.length > 60 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_:./-]+$/.test(id))) throw new Error('Provide one to sixty distinct reviewed fixture IDs.');
  const knowledge = readJson(path.join(root,'data/editorial-knowledge.v1.json'));
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error('Editorial knowledge invalid: '+issues.join('; '));
  const indexes = indexesFor(knowledge), locks = require('../config/editorial-locks');
  const permitted = new Set(['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline']);
  const updated = new Set();
  // Prepare both documents before the first write. A bad alias, missing source,
  // protected fixture or spoiler conflict cannot leave a partial semantic patch.
  const plans = ['feeds/incoming/events.json','data/events.json'].map(relative => {
    const file = path.join(root,relative), document = readJson(file), chosen = new Set();
    for (const id of ids){
      const matches = document.events.filter(event => projectionTargetIds(event).includes(id));
      if (matches.length !== 1) throw new Error('Unknown or ambiguous editorial projection fixture: '+id);
      chosen.add(matches[0]);
    }
    const events = document.events.map(event => {
      if (!chosen.has(event)) return event;
      if (require('../config/editorial-maintenance').protectedFixture(event)) throw new Error('Protected editorial fixture: '+event.id);
      const projection = projectionForTarget(knowledge,'feed-event',event);
      if (!projection) throw new Error('No declared editorial projection for '+event.id);
      const next = reconcileFeedEvent(event,locks.projection(event,projection),indexes);
      for (const key of new Set([...Object.keys(event),...Object.keys(next)])){
        if (!permitted.has(key) && !isDeepStrictEqual(next[key],event[key])) throw new Error('Editorial repair changed sporting/source metadata: '+key);
      }
      const spoilers = require('./lib/storyline-card-rules').spoilerContractIssues(next);
      if (spoilers.length) throw new Error('Editorial repair is not spoiler safe: '+spoilers.join('; '));
      if (!isDeepStrictEqual(next,event)) updated.add(event.id);
      return next;
    });
    return {file,document:{...document,events},changed:!isDeepStrictEqual(events,document.events)};
  });
  for (const plan of plans.filter(plan => plan.changed)){
    const temporary = plan.file+'.editorial-projection-'+process.pid+'.tmp';
    try { writeJson(temporary,plan.document); fs.renameSync(temporary,plan.file); }
    finally { fs.rmSync(temporary,{force:true}); }
  }
  return {changed:updated.size,updatedIds:[...updated],sourceRequests:0,scope:'existing-declared-editorial-projections'};
}

module.exports = { projectionConforms, reconcileFeedEvent, applyScopedFeed };

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exitCode = 1; }
}
