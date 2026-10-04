#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const reviewedTiming=require('../lib/reviewed-session-timing');

const ROOT = path.resolve(__dirname, "..");
const TARGETS = ["data/canonical/afl-nrl-2026.json", "feeds/incoming/events.json", "data/follow-sources/coverage.v1.json", "data/canonical/official-card-results-2026.json", "data/major-events.v1.json"];
const read = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const write = (relative, value) => fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`);
const identity = record => record?.id || record?.eventId || record?.canonicalEventId;
const aliases = override => new Set([override.id, override.canonicalId].filter(Boolean));
const recordAliases = record => [record?.id, record?.eventId, record?.canonicalEventId, ...(record?.sourceEventIds || [])].filter(Boolean);
const matches = (record, override) => recordAliases(record).some(id => aliases(override).has(id));

function publicFields(override){
  const next = { ...override };
  for(const key of ["canonicalId", "ids", "broadcastSourceUrl", "scheduleSourceUrl"]) delete next[key];
  return next;
}
function mergeRecord(record, override, checkedAt){
  if(record.customClassification && override.sourceType==='official'){
    const {customClassification,...rest}=record;
    record={...rest,importedCalendarClassification:customClassification};
  }
  const sourceRefs = [...new Set([...(record.sourceRefs || []), record.sourceUrl, override.sourceUrl, override.broadcastSourceUrl, override.scheduleSourceUrl].filter(Boolean))];
  const merged = {
    ...record,
    ...publicFields(override),
    id:record.id,
    eventId:record.eventId || record.id,
    canonicalEventId:record.canonicalEventId || override.canonicalId || record.id,
    sourceCheckedAt:override.sourceUrl === record.sourceUrl && Date.parse(record.sourceCheckedAt) > Date.parse(override.sourceCheckedAt || checkedAt) ? record.sourceCheckedAt : override.sourceCheckedAt || checkedAt,
    sourceType:"official",
    sourceTrust:"verified",
    sourceRefs,
    scheduleStatus:override.startTimeUtc ? "confirmed" : record.scheduleStatus,
    timePrecision:override.startTimeUtc ? "exact" : override.timePrecision || record.timePrecision,
    stakesScore:record.stakesScore || 5,
  };
  return retainNewerReviewedEditorial(record, merged);
}
function retainNewerReviewedEditorial(record, merged){
  // A dated sporting correction can carry seed editorial. Reapplying unchanged
  // facts must not undo a later, already published review. A sporting change
  // still invalidates that older prose; fetch clocks never count as research.
  const reviewed=Date.parse(record.editorialNarrative?.researchedAt||'');
  const incomingReviewed=Date.parse(merged.editorialNarrative?.researchedAt||'');
  const facts=['name','date','time','timePrecision','startTimeUtc','endTimeUtc','actualEndTimeUtc','venue','competitionId','season','participantIds','participants','participantsConfirmed','teamMatchContext','standingsContext','eventType','sessionType','cardKind','round','roundNumber','roundLabel','stage','status','scheduleStatus','score','scoreDisplay','canonicalResultScoreline','result','resultLabels','homeScore','awayScore','outcomeText','recapText','fixtureResults'];
  // Feed's upcoming and the canonical adapter's scheduled denote the same
  // unresolved phase. Live/postponed/completed are never equivalent to these.
  const fact=(event,key)=>key==='status'&&['scheduled','upcoming'].includes(event[key])?'scheduled':['participants','participantIds'].includes(key)&&event[key]===undefined?[]:event[key];
  const now=Date.now();
  if(Number.isFinite(reviewed)&&reviewed<=now&&reviewed>(Number.isFinite(incomingReviewed)&&incomingReviewed<=now?incomingReviewed:0)&&record.editorialNarrative?.sourceIds?.length&&facts.every(key=>JSON.stringify(fact(record,key))===JSON.stringify(fact(merged,key)))){
    for(const field of ['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt']){
      if(Object.hasOwn(record,field))merged[field]=record[field];else delete merged[field];
    }
    if(record.storyline)merged.storyline={...merged.storyline,...Object.fromEntries(['researchDepth','arcStage','hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn','lastReviewedAt'].filter(key=>Object.hasOwn(record.storyline,key)).map(key=>[key,record.storyline[key]]))};
  }
  return merged;
}
function fixtureSeed(override, checkedAt){
  return mergeRecord({
    id:override.id,
    eventId:override.id,
    canonicalEventId:override.canonicalId || override.id,
    status:"scheduled",
    cardKind:"fixture",
    liveWindow:3,
    expected:8,
    stakesScore:5,
    storyline:{ stakes:5, intensity:5, arcStage:"preview" },
  }, override, checkedAt);
}
function normalizeCompletedTiming(record, {child=false} = {}){
  if(record.status === "completed" && record.storyline && record.storyline.arcStage !== "recap"){
    const safe = `${record.name || record.displayName || 'This event'} is complete. Reveal results for the outcome.`;
    const result = record.outcomeText || record.scoreDisplay || record.score;
    // Events children publish copy in Storyline only. Feed's root copy fields
    // are deliberately outside the strict child schema.
    if(result) record = {...record,...(!child?{selectedSentence:safe,fullSpiel:safe}:{}),storyline:{...record.storyline,arcStage:"recap",hookSpoilerOff:safe,synopsisSpoilerOff:safe,hookSpoilerOn:result,synopsisSpoilerOn:record.recapText || result}};
  }
  if(record.status !== "completed" || record.endTimeUtc || !record.startTimeUtc) return record;
  const start = Date.parse(record.startTimeUtc);
  if(!Number.isFinite(start)) return record;
  const hours = Math.max(0.5, Number(record.liveWindow) || 3);
  return { ...record, endTimeUtc:new Date(start + hours * 3600000).toISOString(), endTimeBasis:"scheduled-live-window" };
}
function applyArray(records, overrides, checkedAt, { upsert=false, child=false } = {}){
  const next = records.map(record => {
    const override = overrides.find(item => matches(record, item));
    return normalizeCompletedTiming(override ? mergeRecord(record, override, checkedAt) : record,{child});
  });
  if(upsert) for(const override of overrides) if(!next.some(record => matches(record, override))) next.push(fixtureSeed(override, checkedAt));
  return next;
}
function applyEvidence({ check=false, root=ROOT } = {}){
  const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
  const write=(relative,value)=>fs.writeFileSync(path.join(root,relative),`${JSON.stringify(value,null,2)}\n`);
  const evidence = read("data/canonical/current-card-evidence-2026.json");
  const timings=reviewedTiming.validate(evidence.timingOverrides||[]);
  // Reviewed results are final facts, not merely score text on upcoming cards.
  evidence.resultOverrides = evidence.resultOverrides.map(result => ({ ...result, status:"completed" }));
  const documents = Object.fromEntries(TARGETS.map(file => [file, read(file)]));
  const canonical = documents[TARGETS[0]];
  canonical.events = applyArray(applyArray(canonical.events || [], evidence.fixtureOverrides, evidence.checkedAt), evidence.resultOverrides, evidence.checkedAt).map(record=>{
    const source={...record};
    for(const key of ['storyline','cardVariant','archived'])delete source[key];
    return source;
  });
  const feed = documents[TARGETS[1]];
  feed.events = applyArray(applyArray(feed.events || [], evidence.fixtureOverrides, evidence.checkedAt, { upsert:true }), evidence.resultOverrides, evidence.checkedAt);
  const coverage = documents[TARGETS[2]];
  coverage.events = applyArray(coverage.events || [], evidence.resultOverrides, evidence.checkedAt);
  for(const group of evidence.broadcastOverrides) coverage.events = (coverage.events || []).map(record => group.ids.includes(identity(record)) ? mergeRecord(record, group, evidence.checkedAt) : record);
  const results = documents[TARGETS[3]];
  const byId = new Map((results.results || []).map(record => [record.id, record]));
  for(const override of evidence.resultOverrides) byId.set(override.id, { ...(byId.get(override.id) || { id:override.id }), ...publicFields(override) });
  results.results = [...byId.values()];
  results.checkedAt = evidence.checkedAt;
  const majorEvents = documents[TARGETS[4]];
  majorEvents.events = (majorEvents.events || []).map(event => ({
    ...event,
    subEvents:applyArray(event.subEvents || [], evidence.resultOverrides, evidence.checkedAt,{child:true}),
  }));
  feed.events=reviewedTiming.apply(feed.events,timings,{required:true});
  coverage.events=reviewedTiming.apply(coverage.events,timings);

  if(check){
    for(const override of evidence.fixtureOverrides){
      const record = feed.events.find(item => matches(item, override));
      assert(record, `${override.name} must exist in the incoming Feed`);
      for(const key of ["date", "time", "startTimeUtc", "venue", "broadcaster"]) assert.equal(record[key], override[key], `${override.name} ${key}`);
      if(Array.isArray(override.participantIds))assert.deepEqual(record.participantIds, override.participantIds, `${override.name} participants`);
    }
    for(const override of evidence.resultOverrides){
      const record = feed.events.find(item => matches(item, override))
        || majorEvents.events.flatMap(event => event.subEvents || []).find(item => matches(item, override))
        || coverage.events.find(item => matches(item, override));
      assert(record, `${override.id} must exist in Feed or detailed Event fixtures`);
      assert.equal(record.score, override.score, `${override.id} score`);
      assert(record.endTimeUtc || (record.dateOnly===true && /^\d{4}-\d{2}-\d{2}$/.test(record.endDate)), `${override.id} must have a stable completion boundary or explicit date-only window`);
    }
    for(const group of evidence.broadcastOverrides) for(const id of group.ids) assert.equal(coverage.events.find(record => identity(record) === id)?.broadcaster, group.broadcaster, `${id} broadcaster`);
    console.log("Current card evidence is fully applied.");
    return;
  }
  for(const file of TARGETS) write(file, documents[file]);
  applySelectedTimings({root});
  console.log("Applied reviewed fixtures, results, completion timing and broadcaster evidence.");
}

function applySelectedResults(ids,{root=ROOT}={}){
  const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
  const write=(relative,value)=>fs.writeFileSync(path.join(root,relative),`${JSON.stringify(value,null,2)}\n`);
  assert(ids.length&&new Set(ids).size===ids.length,'Unique reviewed result IDs are required');
  const evidence=read('data/canonical/current-card-evidence-2026.json');
  const selected=ids.map(id=>{
    const row=evidence.resultOverrides.find(row=>row.id===id);
    assert(row && row.sourceCheckedAt && row.sourceUrl && row.sourceName, `${id}: dated result evidence is required`);
    assert(/^https:\/\//.test(row.sourceUrl)&&Number.isFinite(Date.parse(row.sourceCheckedAt))&&Date.parse(row.sourceCheckedAt)<=Date.now(),`${id}: valid source observation is required`);
    assert(row.score&&row.outcomeText&&row.recapText,`${id}: a reviewed final requires its score and factual summary`);
    return {...row,status:'completed'};
  });
  const files=['feeds/incoming/events.json','data/events.json'];
  const updates=files.map(file=>{
    const document=read(file);
    for(const row of selected)assert.equal(document.events.filter(record=>matches(record,row)).length,1,`${row.id}: exactly one retained fixture is required in ${file}`);
    document.events=document.events.map(record=>{
      const override=selected.find(row=>matches(record,row));
      if(!override)return record;
      const next=normalizeCompletedTiming(mergeRecord(record,override,override.sourceCheckedAt));
      if(next.resultStatus==='pending')delete next.resultStatus;
      delete next.resultAvailabilityEvidence;
      return next;
    });
    return {file,document};
  });
  const file='data/canonical/official-card-results-2026.json',results=read(file),byId=new Map(results.results.map(row=>[row.id,row]));
  for(const row of selected)byId.set(row.id,{...byId.get(row.id),...publicFields(row)});
  results.results=[...byId.values()];
  const canonicalFile='data/canonical/afl-nrl-2026.json',canonical=read(canonicalFile);
  for(const row of selected)assert(canonical.events.filter(record=>matches(record,row)).length<=1,`${row.id}: canonical identity must be unique`);
  canonical.events=canonical.events.map(record=>{
    const row=selected.find(row=>matches(record,row));if(!row)return record;
    const next=normalizeCompletedTiming(mergeRecord(record,row,row.sourceCheckedAt));
    for(const key of ['storyline','cardVariant','archived'])delete next[key];
    return next;
  });
  for(const update of updates)write(update.file,update.document);
  write(canonicalFile,canonical);
  write(file,results);
  console.log(`Applied ${selected.length} reviewed result(s); unrelated fixtures, editorial and observations retained.`);
}
function applySelectedTimings({root=ROOT}={}){
  const evidence=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/current-card-evidence-2026.json'),'utf8'));
  const rows=reviewedTiming.validate(evidence.timingOverrides||[]);
  if(!rows.length)return;
  const targets=['data/canonical/fiba-women-sailgp-motogp-2026.json','feeds/incoming/events.json','data/events.json','data/follow-sources/coverage.v1.json'];
  // Validate every retained document before any write; a partial/missing identity
  // must not leave the public projections with different schedule facts.
  const updates=targets.map(file=>{
    const filename=path.join(root,file),bytes=fs.readFileSync(filename,'utf8'),doc=JSON.parse(bytes);
    doc.events=reviewedTiming.apply(doc.events,rows,{required:file!=='data/follow-sources/coverage.v1.json'});
    return {filename,bytes,next:JSON.stringify(doc,null,2)+'\n'};
  });
  for(const {filename,bytes,next} of updates)if(bytes!==next)fs.writeFileSync(filename,next);
  console.log(`Applied ${rows.length} reviewed session timing(s); results, participation and original source dates retained.`);
}
function restorePublishedEditorial(baselineSha,ids,{root=ROOT}={}){
  assert(/^[a-f0-9]{40}$/.test(baselineSha),'A full previously verified published SHA is required');
  assert(ids.length&&new Set(ids).size===ids.length,'Unique fixture IDs are required');
  const {execFileSync}=require('node:child_process');
  execFileSync('git',['merge-base','--is-ancestor',baselineSha,'HEAD'],{cwd:ROOT});
  // Read and validate both surfaces before writing either. Restore only copy
  // already present at the operator's verified release, never queued drafts.
  const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
    const previous=JSON.parse(execFileSync('git',['show',`${baselineSha}:${file}`],{cwd:ROOT,maxBuffer:32*1024*1024}));
    const filename=path.join(root,file),bytes=fs.readFileSync(filename,'utf8'),doc=JSON.parse(bytes);
    for(const id of ids){
      const old=previous.events.find(event=>event.id===id),current=doc.events.find(event=>event.id===id);
      assert(old&&current,`${id}: fixture must exist in both snapshots (${file})`);
      assert(old.editorialNarrative?.sourceIds?.length&&Number.isFinite(Date.parse(old.editorialNarrative.researchedAt)),`${id}: reviewed baseline is required`);
      const next=retainNewerReviewedEditorial(old,structuredClone(current));
      assert(JSON.stringify(next.editorialNarrative)===JSON.stringify(old.editorialNarrative)||Date.parse(current.editorialNarrative?.researchedAt)>=Date.parse(old.editorialNarrative.researchedAt),`${id}: changed sporting facts prevent restoring an older preview (${file})`);
      doc.events[doc.events.indexOf(current)]=next;
    }
    return {filename,bytes,next:JSON.stringify(doc,null,2)+'\n'};
  });
  for(const {filename,bytes,next}of updates)if(bytes!==next)fs.writeFileSync(filename,next);
  console.log(`Restored already published editorial for ${ids.length} selected fixture(s); facts, identities, source observations and unrelated cards retained.`);
}
if(require.main === module){
  const scope=process.argv.find(arg=>arg.startsWith('--ids='));
  const baseline=process.argv.find(arg=>arg.startsWith('--restore-published='));
  if(baseline){assert(scope,'Published editorial repair requires --ids=');restorePublishedEditorial(baseline.slice('--restore-published='.length),scope.slice(6).split(','));}
  else if(process.argv.includes('--timing-only'))applySelectedTimings();
  else if(scope)applySelectedResults(scope.slice(6).split(','));else applyEvidence({ check:process.argv.includes("--check") });
}
module.exports = { restorePublishedEditorial, applySelectedResults, applySelectedTimings, applyEvidence, normalizeCompletedTiming, mergeRecord, retainNewerReviewedEditorial };
