"use strict";

// A reviewed, identity-bound result capsule, replayed by the two existing
// canonical result writers. Receipt clocks are never actual finish clocks.
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {sourceTrustForEvent} = require("../../config/source-trust");
const fields = Object.freeze([
  "status", "score", "scoreDisplay", "result", "resultStatus", "outcomeText", "recapText",
  "sets", "resultLabels", "homeScore", "awayScore", "winnerParticipantId",
  "loserParticipantId", "eliminatedParticipantIds", "sourceUrl", "sourceName", "sourceType",
  "sourceCheckedAt", "resultSourceUrl", "resultSourceCheckedAt", "statusSourceUrl",
  "statusSourceName", "statusSourceType", "scoreCheckedAt", "statusCheckedAt",
  "scoreFactObservedAt", "statusFactObservedAt", "firstConfirmedCompleteAt", "fixtureObservationSchema",
]);
const clocks = fields.filter(key => key.endsWith("At"));
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const payload = row => Object.fromEntries(fields.filter(key => Object.hasOwn(row,key)).map(key => [key,row[key]]));
const isAcceptedResult = row => !!row?.acceptedResultProjection;
const aliases = row => [...new Set([row?.id,row?.eventId,row?.canonicalId,row?.canonicalEventId,...(row?.sourceEventIds || [])].filter(Boolean))];
const clock = row => Date.parse(row.statusFactObservedAt || row.scoreFactObservedAt || row.statusCheckedAt || row.scoreCheckedAt || row.resultSourceCheckedAt || row.sourceCheckedAt);

function validateAcceptedResult(row){
  const proof = row?.acceptedResultProjection;
  assert.equal(proof?.schemaVersion,"accepted-result-projection.v1","Unknown accepted-result contract");
  assert.match(proof.sourceSha256 || "",/^[a-f0-9]{64}$/,"Accepted result needs retained source evidence hash");
  assert.equal(proof.payloadSha256,hash(payload(row)),"Accepted result payload changed after review");
  assert.equal(row.status,"completed","Only confirmed finals may enter accepted-result projection");
  assert(row.score !== undefined && row.score !== null && row.score !== "","Accepted result needs a score, including zero");
  assert(row.outcomeText && row.recapText,"Accepted result needs sourced outcome and recap");
  assert(Array.isArray(proof.aliases) && proof.aliases.length >= 1 && new Set(proof.aliases).size === proof.aliases.length,"Accepted result aliases must be explicit and unique");
  assert(aliases(row).every(id => proof.aliases.includes(id)),"Unreviewed result alias");
  assert(Array.isArray(proof.participantIds) && proof.participantIds.length >= 2 && proof.participantIds.every(Boolean),"Accepted result needs ordered canonical participants");
  assert.match(proof.fixtureDate || "",/^\d{4}-\d{2}-\d{2}$/,"Accepted result needs a retained fixture date");
  const url = new URL(row.sourceUrl);
  assert.equal(url.protocol,"https:");
  const host = url.hostname.replace(/^www\./,"");
  const sourceClasses = {"espn.com":"reputable","cricket.com.au":"trusted-reporting","mlb.com":"official","statsapi.mlb.com":"official","schedule.nbl.com.au":"official"};
  assert(Object.hasOwn(sourceClasses,host),"Unreviewed accepted-result source host");
  assert.equal(row.sourceType,sourceClasses[host],"Accepted result source class/host mismatch");
  assert(row.sourceName && Number.isFinite(clock(row)),"Accepted result needs original source receipts");
  for(const key of clocks){
    if(!Object.hasOwn(row,key)) continue;
    assert.match(row[key],/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/ ,`${key} must retain a literal source timestamp`);
    assert(Number.isFinite(Date.parse(row[key])) && Date.parse(row[key]) <= Date.now(),`${key} is invalid or in the future`);
  }
  for(const kind of ["score","status"]){
    if(row[`${kind}FactObservedAt`] && row[`${kind}CheckedAt`]) assert(Date.parse(row[`${kind}FactObservedAt`]) <= Date.parse(row[`${kind}CheckedAt`]),`${kind} fact cannot follow its receipt`);
  }
  // An earlier compatible completion receipt may precede a later status tuple.
  if(row.firstConfirmedCompleteAt) assert(Date.parse(row.firstConfirmedCompleteAt) <= Math.max(...clocks.filter(key=>key.endsWith("CheckedAt")).map(key=>Date.parse(row[key])).filter(Number.isFinite)),"Completion receipt must not follow all accepted checks");
  for(const key of ["actualEndTimeUtc","completedAt","resultPublishedAt","lastReviewedAt","endTimeUtc"]){
    assert(!Object.hasOwn(row,key),`Accepted result cannot invent ${key}`);
  }
  return true;
}

function validateAcceptedSet(rows){
  const reviewed=rows.filter(isAcceptedResult);
  for(const row of reviewed){
    validateAcceptedResult(row);
    for(const other of rows)if(other!==row)assert(!aliases(other).some(id=>row.acceptedResultProjection.aliases.includes(id)),"Ambiguous accepted result identity");
  }
  return true;
}

function mergeAcceptedResult(record,row){
  validateAcceptedResult(row);
  const proof = row.acceptedResultProjection;
  assert(aliases(record).some(id=>proof.aliases.includes(id)),"Accepted result identity mismatch");
  assert.deepEqual(record.participantIds,proof.participantIds,"Accepted result participant identity/order mismatch");
  assert.equal(record.date,proof.fixtureDate,"Accepted result fixture date mismatch");
  const oldScore = record.score ?? record.scoreDisplay;
  const oldClock = clock(record), incomingClock = clock(row);
  if(record.status === "completed" && oldScore !== undefined && oldScore !== null && oldScore !== ""){
    if(Number.isFinite(oldClock) && oldClock > incomingClock) return record;
    assert.equal(String(oldScore),String(row.score),"Accepted result conflicts with an existing final");
    for(const key of ["winnerParticipantId","loserParticipantId","eliminatedParticipantIds","sets","homeScore","awayScore"]){
      if(Object.hasOwn(record,key)&&Object.hasOwn(row,key))assert.deepEqual(record[key],row[key],`Accepted result conflicts with existing final ${key}`);
    }
  }
  const next = {...record,...clone(payload(row))};
  if(Object.hasOwn(row,'homeScore') || Object.hasOwn(row,'awayScore')){
    for(const [key,index] of [['homeParticipantId',0],['awayParticipantId',1]]){
      if(record[key])assert.equal(record[key],proof.participantIds[index],'Numeric result side conflicts with retained identity');
      next[key]=proof.participantIds[index];
    }
  }
  next.sourceTrust = sourceTrustForEvent({sourceType:row.sourceType}).trust;
  next.sourceRefs = [...new Set([...(record.sourceRefs || []),record.sourceUrl,row.sourceUrl,row.resultSourceUrl,row.statusSourceUrl].filter(Boolean))];
  if(!record.endTimeUtc || record.endTimeBasis === "scheduled-live-window"){
    next.endTimeUtc = null;
    delete next.endTimeBasis;
  }
  if(record.status === "completed" && record.firstConfirmedCompleteAt && row.firstConfirmedCompleteAt && Date.parse(record.firstConfirmedCompleteAt)<Date.parse(row.firstConfirmedCompleteAt)) next.firstConfirmedCompleteAt=record.firstConfirmedCompleteAt;
  // Keep original preview/review dates and Results-OFF copy; completion is a
  // state transition, not evidence that fresh editorial research occurred.
  if(record.storyline){
    next.storyline={...record.storyline,arcStage:"recap",hookSpoilerOn:row.outcomeText,synopsisSpoilerOn:row.recapText};
    delete next.storyline.on;
  }
  if(!Object.hasOwn(row,"resultStatus") && next.resultStatus === "pending") delete next.resultStatus;
  delete next.resultAvailabilityEvidence;
  delete next.acceptedResultProjection;
  return next;
}

function validateAcceptedProjection(record,row){
  validateAcceptedResult(row);
  const proof=row.acceptedResultProjection;
  assert(aliases(record).some(id=>proof.aliases.includes(id)),"Accepted projection identity mismatch");
  assert.deepEqual(record.participantIds,proof.participantIds,"Accepted projection participant identity/order mismatch");
  assert.equal(record.date,proof.fixtureDate,"Accepted projection fixture date mismatch");
  assert.equal(record.status,"completed","Accepted final was not persisted");
  for(const key of fields){
    if(Object.hasOwn(row,key) && key!=="firstConfirmedCompleteAt") assert.deepEqual(record[key],row[key],`Accepted result ${key} drifted`);
  }
  if(row.firstConfirmedCompleteAt){
    assert(Number.isFinite(Date.parse(record.firstConfirmedCompleteAt)) && Date.parse(record.firstConfirmedCompleteAt)<=Date.parse(row.firstConfirmedCompleteAt),"Accepted earliest completion receipt is missing or later");
  }
  assert(!Object.hasOwn(record,"acceptedResultProjection"),"Internal accepted-result capsule leaked into a card");
  assert(record.endTimeBasis !== "scheduled-live-window","Presentation window is not a confirmed finish");
  return true;
}

module.exports={fields,payload,hash,isAcceptedResult,validateAcceptedSet,validateAcceptedResult,mergeAcceptedResult,validateAcceptedProjection};
