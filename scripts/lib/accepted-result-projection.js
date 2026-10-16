"use strict";

// A reviewed, identity-bound result capsule, replayed by the two existing
// canonical result writers. Receipt clocks are never actual finish clocks.
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {isDeepStrictEqual} = require("node:util");
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
const statusFields = new Set(['status','statusSourceUrl','statusSourceName','statusSourceType','statusCheckedAt','statusFactObservedAt']);
const scoreFields = fields.filter(key=>!statusFields.has(key)&&key!=='firstConfirmedCompleteAt');
const resultFactFields = ['score','scoreDisplay','result','resultStatus','outcomeText','recapText','sets','resultLabels','homeScore','awayScore','winnerParticipantId','loserParticipantId','eliminatedParticipantIds'];
const clock = row => Date.parse(row.statusFactObservedAt || row.scoreFactObservedAt || row.statusCheckedAt || row.scoreCheckedAt || row.resultSourceCheckedAt || row.sourceCheckedAt);
function validDay(year,month,day){
  return year>=1&&month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate();
}
function validateClock(value,key){
  const match=String(value).match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,6})?(Z|([+-])(\d\d):(\d\d))$/);
  assert(match, key+' must retain a literal source timestamp');
  const [,year,month,day,hour,minute,second,zone,,offsetHour,offsetMinute]=match;
  assert(validDay(+year,+month,+day)&&+hour<24&&+minute<60&&+second<60,key+' has an impossible calendar clock');
  assert(zone==='Z'||(+offsetHour<=14&&+offsetMinute<60&&(+offsetHour<14||+offsetMinute===0)),key+' has an impossible timezone offset');
  assert(Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now(),key+' is invalid or in the future');
}
function newerTuple(previous,incoming,kind){
  const oldFact=Date.parse(previous[kind+'FactObservedAt']),newFact=Date.parse(incoming[kind+'FactObservedAt']);
  if(Number.isFinite(oldFact)||Number.isFinite(newFact))return Number.isFinite(oldFact)&&(!Number.isFinite(newFact)||oldFact>newFact);
  const checked=value=>Date.parse(value[kind+'CheckedAt']||value.resultSourceCheckedAt||value.sourceCheckedAt);
  return Number.isFinite(checked(previous))&&checked(previous)>checked(incoming);
}
function validateIdentities(row,proof){
  const ids=new Set(proof.participantIds);
  assert.equal(ids.size,proof.participantIds.length,'Accepted participants must be distinct');
  for(const key of ['winnerParticipantId','loserParticipantId'])if(row[key]!=null)assert(ids.has(row[key]),key+' is not a retained participant');
  if(row.winnerParticipantId&&row.loserParticipantId)assert.notEqual(row.winnerParticipantId,row.loserParticipantId,'Winner cannot also be loser');
  if(Object.hasOwn(row,'eliminatedParticipantIds')){
    assert(Array.isArray(row.eliminatedParticipantIds),'Eliminated identities must be an array');
    assert(row.eliminatedParticipantIds.every(id=>ids.has(id)&&id!==row.winnerParticipantId),'Eliminated identities conflict with retained participants/winner');
  }
  for(const [key,index]of [['homeParticipantId',0],['awayParticipantId',1]])if(row[key]!=null)assert.equal(row[key],proof.participantIds[index],'Accepted numeric side identity mismatch');
  if(Object.hasOwn(row,'homeScore')||Object.hasOwn(row,'awayScore')){
    assert([row.homeScore,row.awayScore].every(value=>Number.isSafeInteger(value)&&value>=0),'Accepted numeric scores need a complete non-negative integer pair');
    if(row.winnerParticipantId)assert.equal(row.winnerParticipantId,row.homeScore===row.awayScore?null:proof.participantIds[row.homeScore>row.awayScore?0:1],'Accepted winner disagrees with observed numeric sides');
  }
}

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
  const [year,month,day]=proof.fixtureDate.split('-').map(Number);
  assert(validDay(year,month,day),'Accepted result fixture date is impossible');
  validateIdentities(row,proof);
  const url = new URL(row.sourceUrl);
  assert.equal(url.protocol,"https:");
  const host = url.hostname.replace(/^www\./,"");
  const sourceClasses = {"espn.com":"reputable","cricket.com.au":"trusted-reporting","mlb.com":"official","statsapi.mlb.com":"official","schedule.nbl.com.au":"official"};
  assert(Object.hasOwn(sourceClasses,host),"Unreviewed accepted-result source host");
  assert.equal(row.sourceType,sourceClasses[host],"Accepted result source class/host mismatch");
  assert(row.sourceName && Number.isFinite(clock(row)),"Accepted result needs original source receipts");
  for(const key of clocks){
    if(!Object.hasOwn(row,key)) continue;
    validateClock(row[key],key);
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
  const hasFinal=record.status==='completed'&&oldScore!==undefined&&oldScore!==null&&oldScore!=='';
  const retainScore=hasFinal&&newerTuple(record,row,'score');
  const retainStatus=record.status==='completed'&&newerTuple(record,row,'status');
  let compatible=true;
  if(hasFinal){
    compatible=String(oldScore)===String(row.score);
    for(const key of ['winnerParticipantId','loserParticipantId','eliminatedParticipantIds','sets','homeScore','awayScore']){
      if(Object.hasOwn(record,key)&&Object.hasOwn(row,key)&&!isDeepStrictEqual(record[key],row[key]))compatible=false;
    }
    if(!retainScore)assert(compatible,'Accepted result conflicts with an existing final');
  }
  const next = {...record,...clone(payload(row))};
  // Fact freshness is independent. A status observation cannot freshen an old
  // score tuple, nor can a later score poll erase the first completion receipt.
  for(const [retain,keys]of [[retainScore,scoreFields],[retainStatus,[...statusFields]]])if(retain){
    for(const key of keys)if(Object.hasOwn(record,key)){
      if(clocks.includes(key))validateClock(record[key],key);
      next[key]=clone(record[key]);
    }
  }
  validateIdentities(next,proof);
  if(Object.hasOwn(row,'homeScore') || Object.hasOwn(row,'awayScore')){
    for(const [key,index] of [['homeParticipantId',0],['awayParticipantId',1]]){
      if(record[key])assert.equal(record[key],proof.participantIds[index],'Numeric result side conflicts with retained identity');
      next[key]=proof.participantIds[index];
    }
  }
  next.sourceTrust = sourceTrustForEvent({sourceType:next.sourceType}).trust;
  next.sourceRefs = [...new Set([...(record.sourceRefs || []),record.sourceUrl,row.sourceUrl,row.resultSourceUrl,row.statusSourceUrl].filter(Boolean))];
  if(!record.endTimeUtc || record.endTimeBasis === "scheduled-live-window"){
    next.endTimeUtc = null;
    delete next.endTimeBasis;
  }
  if(hasFinal&&record.firstConfirmedCompleteAt){
    validateClock(record.firstConfirmedCompleteAt,'retained firstConfirmedCompleteAt');
    if(!compatible||!row.firstConfirmedCompleteAt||Date.parse(record.firstConfirmedCompleteAt)<Date.parse(row.firstConfirmedCompleteAt))next.firstConfirmedCompleteAt=record.firstConfirmedCompleteAt;
  }
  if(hasFinal&&!compatible&&!record.firstConfirmedCompleteAt)delete next.firstConfirmedCompleteAt;
  // Keep original preview/review dates and Results-OFF copy; completion is a
  // state transition, not evidence that fresh editorial research occurred.
  if(record.storyline){
    next.storyline={...record.storyline,arcStage:"recap",hookSpoilerOn:next.outcomeText,synopsisSpoilerOn:next.recapText};
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
  validateIdentities(record,proof);
  for(const key of clocks)if(Object.hasOwn(record,key))validateClock(record[key],key);
  const retainedNewerFact=kind=>Number.isFinite(Date.parse(record[kind+'FactObservedAt']))&&(!Number.isFinite(Date.parse(row[kind+'FactObservedAt']))||Date.parse(record[kind+'FactObservedAt'])>Date.parse(row[kind+'FactObservedAt']));
  for(const key of fields){
    if(!Object.hasOwn(row,key)||key==='firstConfirmedCompleteAt')continue;
    if(clocks.includes(key)){
      validateClock(record[key],key);
      const kind=statusFields.has(key)?'status':'score';
      assert(retainedNewerFact(kind)||Date.parse(record[key])>=Date.parse(row[key]),'Accepted result '+key+' regressed');
    }else if(/^(?:source|resultSource|statusSource)(?:Url|Name)$/.test(key)&&!isDeepStrictEqual(record[key],row[key])){
      const kind=statusFields.has(key)?'status':'score';
      assert(retainedNewerFact(kind),'Accepted source metadata lacks a newer corresponding fact');
      if(key.endsWith('Url')){
        const retained=new URL(record[key]),accepted=new URL(row[key]);
        assert.equal(retained.protocol,'https:');
        assert.equal(retained.origin,accepted.origin,'Retained result provider changed');
        assert.equal(retained.pathname,accepted.pathname,'Retained result source identity changed');
        for(const [name,value]of accepted.searchParams)assert.equal(retained.searchParams.get(name),value,'Retained result source key changed');
      }else assert(typeof record[key]==='string'&&record[key].trim(),'Retained source attribution is empty');
    }else assert.deepEqual(record[key],row[key],'Accepted result '+key+' drifted');
  }
  for(const kind of ['score','status'])if(record[kind+'FactObservedAt']&&record[kind+'CheckedAt'])assert(Date.parse(record[kind+'FactObservedAt'])<=Date.parse(record[kind+'CheckedAt']),kind+' fact follows retained receipt');
  if(row.firstConfirmedCompleteAt){
    validateClock(record.firstConfirmedCompleteAt,'firstConfirmedCompleteAt');
    assert(Number.isFinite(Date.parse(record.firstConfirmedCompleteAt)) && Date.parse(record.firstConfirmedCompleteAt)<=Date.parse(row.firstConfirmedCompleteAt),"Accepted earliest completion receipt is missing or later");
  }
  assert(!Object.hasOwn(record,"acceptedResultProjection"),"Internal accepted-result capsule leaked into a card");
  assert(record.endTimeBasis !== "scheduled-live-window","Presentation window is not a confirmed finish");
  return true;
}

module.exports={fields,payload,hash,isAcceptedResult,validateAcceptedSet,validateAcceptedResult,mergeAcceptedResult,validateAcceptedProjection};
