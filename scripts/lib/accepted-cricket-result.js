'use strict';
// One reviewed official result receipt. No provider discovery or identity cutover.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const receipt=require('../fixtures/cricket-ca39991-final-receipt-20261023.json');
const SHA='c0981f979ecefc82865a1e051e5966327930b90537fdfb3406bdfe1e518adb74';
const OBSERVED='2026-10-22T21:20:19.513Z';
const SOURCE='https://apiv2.cricket.com.au/web/views/scorecard?fixtureId=39991&jsconfig=eccn%3Atrue&format=json';
const PRIOR_SOURCE='https://apiv2.cricket.com.au/web/fixtures/yearfilter?isCompleted=true&limit=13&isInningInclude=true&jsconfig=eccn%3Atrue&format=json';
const PRIOR_SHA='21a7eda85dc2243c45f31b242a681781efd56347a6cb9f5bda1690dbe8d7cde1';
let priorEvidence;
function prior(){
 if(!priorEvidence){
  const bytes=fs.readFileSync(path.join(__dirname,'../fixtures/cricket-ca39991-retained-facts-20261023.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),PRIOR_SHA,'Retained official Cricket facts changed');
  const saved=JSON.parse(bytes);assert.equal(saved.rows.length,2);
  for(const row of saved.rows){assert.equal(row.total_matching_rows,2);assert.equal(row.source_id,'cricket-ca-current');assert.equal(row.fixture_id,'fixture:cricket:CA:39991');}
  const current=saved.rows.find(row=>row.relation==='current').public_result_facts,score=saved.rows.find(row=>row.relation==='score').public_result_facts;
  assert.equal(current.status,'completed');assert.equal(score.status,'completed');assert.equal(current.sourceUrl,PRIOR_SOURCE);
  assert.equal(current.sourceName,'Cricket Australia');assert.equal(current.sourceType,'official');assert.equal(current.startTimeUtc,'2026-10-18T08:00:00.000Z');assert.equal(current.competitionId,'competition:cricket:4568');
  assert.deepEqual(current.participantIds,['team:cricket:south-africa','team:cricket:australia']);
  assert.equal(score.scoreDisplay,'South Africa win by an innings and 31 runs');
  assert.equal(current.scoreFactObservedAt,score.scoreCheckedAt);assert.equal(current.statusFactObservedAt,score.statusCheckedAt);
  assert.equal(current.firstConfirmedCompleteAt,'2026-10-22T14:02:02.904168+00:00');
  assert.equal(saved.rows.find(row=>row.relation==='score').stored_first_completed_at,'2026-10-22 14:02:02.904168+00');
  priorEvidence={current,score};
 }return priorEvidence;
}
const aliases=row=>[row?.id,row?.eventId,row?.canonicalId,row?.canonicalEventId,...(row?.sourceEventIds||[])].filter(Boolean);
const applies=row=>row?.acceptedResultProjection?.sourceSha256===SHA||aliases(row).some(id=>receipt.aliases.includes(id));
let captured;
function source(){
 if(!captured){
  const bytes=fs.readFileSync(path.join(__dirname,'../fixtures/cricket-ca39991-final-20261023.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),SHA,'Official Cricket captured body changed');
  const payload=JSON.parse(bytes),f=payload.fixture;
  assert.equal(payload.responseError,false);assert.equal(payload.dataSupport?.isReliableData,true);
  assert.equal(f?.id,39991);assert.equal(f.competition?.id,4568);assert.equal(f.gameType,'Test');
  assert.equal(f.homeTeam?.id,21);assert.equal(f.awayTeam?.id,23);
  assert.equal(Date.parse(f.startDateTime),Date.parse(receipt.startTimeUtc));
  assert.equal(f.isCompleted,true);assert.equal(f.isInProgress,false);assert.equal(f.isLive,false);assert.equal(f.gameStatus,'Result');
  assert.equal(f.resultTypeId,'HomeWin');assert.equal(f.homeTeam.isMatchWinner,true);assert.equal(f.awayTeam.isMatchWinner,false);
  assert.equal(receipt.sourceSha256,SHA);assert.equal(receipt.sourceUrl,SOURCE);
  assert.equal(receipt.checkedAt,OBSERVED);assert.equal(receipt.bodyCompletedAt,OBSERVED);
  assert.equal(receipt.canonicalId,'fixture:cricket:espn:1525660');
  assert.deepEqual(receipt.aliases,['fixture-cricket-espn-1525660','fixture:cricket:espn:1525660','evt_88']);
  assert.deepEqual(receipt.participantIds,['team:cricket:south-africa','team:cricket:australia']);
  assert.deepEqual(receipt.competitionIds,['competition:cricket:espn:24203','competition:cricket:4568']);
  captured=f;
 }
 return captured;
}
function validate(row,record){
 const f=source(),proof=row.acceptedResultProjection;
 assert.equal(proof.sourceSha256,SHA,'Official Cricket needs the exact captured response');
 assert.deepEqual(proof.aliases,receipt.aliases,'Unreviewed official Cricket action aliases');
 assert.deepEqual(proof.participantIds,receipt.participantIds);assert.equal(proof.fixtureDate,receipt.fixtureDate);
 assert.equal(row.key,'cricket');assert.equal(row.date,receipt.fixtureDate);assert.equal(row.id,receipt.aliases[0]);
 if(row.canonicalId!==undefined)assert.equal(row.canonicalId,receipt.canonicalId);assert.equal(row.canonicalEventId,receipt.canonicalId);
 assert.deepEqual(row.sourceEventIds,receipt.aliases);assert.deepEqual(row.participantIds,receipt.participantIds);
 assert.equal(row.startTimeUtc,receipt.startTimeUtc);assert.equal(row.competitionId,receipt.competitionIds[0]);
 for(const key of ['score','scoreDisplay','outcomeText'])assert.equal(row[key],f.resultText,'Official Cricket '+key+' differs from raw result');
 assert.equal(row.recapText,'Cricket Australia reports: '+f.resultText+'.');
 assert.equal(row.winnerParticipantId,receipt.participantIds[0]);assert.equal(row.resultStatus,'official');
 assert.equal(row.sourceUrl,SOURCE,'Actual new scorecard contact URL');
 for(const key of ['resultSourceUrl','statusSourceUrl'])assert.equal(row[key],PRIOR_SOURCE,'Original fact source URL mismatch');
 for(const key of ['sourceName','statusSourceName'])assert.equal(row[key],'Cricket Australia');
 for(const key of ['sourceType','statusSourceType'])assert.equal(row[key],'official');
 const old=prior();assert.equal(row.sourceCheckedAt,OBSERVED,'Actual new body receipt remains separate');
 for(const key of ['scoreFactObservedAt','statusFactObservedAt','firstConfirmedCompleteAt'])assert.equal(row[key],old.current[key],'Preserve original literal sporting fact/completion '+key);
 assert.equal(row.scoreCheckedAt,old.score.scoreCheckedAt);assert.equal(row.statusCheckedAt,old.score.statusCheckedAt);assert.equal(row.resultSourceCheckedAt,old.current.sourceCheckedAt);
 for(const key of receipt.missingHistoricalClocks)assert(!Object.hasOwn(row,key),'Official Cricket cannot invent '+key);
 if(record){
  assert(aliases(record).some(id=>receipt.aliases.includes(id)),'Official Cricket fixture identity changed');
  assert.equal(record.key,'cricket');assert(receipt.competitionIds.includes(record.competitionId),'Official Cricket competition changed');
  assert.equal(Date.parse(record.startTimeUtc),Date.parse(receipt.startTimeUtc),'Official Cricket start changed');
  assert.deepEqual(record.participantIds,receipt.participantIds,'Official Cricket participants changed');
  const old=record.score??record.scoreDisplay;
  if(record.status==='completed'&&old!=null&&old!==''){
   assert.equal(old,row.score,'Official Cricket conflicts with retained final');
   if(record.winnerParticipantId)assert.equal(record.winnerParticipantId,row.winnerParticipantId,'Official Cricket winner conflicts');
   for(const key of originalKeys)if(Number.isFinite(Date.parse(record[key])))assert(qualifiesObservation(record,row,key),'Original Cricket '+key+' needs its own source attribution; never relabel it silently');
  }
 }
 return true;
}
const originalKeys=['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt','scoreFactObservedAt','statusFactObservedAt'];
function sameOfficialFinal(record,row){
 return record.status==='completed'&&(record.score??record.scoreDisplay)===row.score&&(!record.winnerParticipantId||record.winnerParticipantId===row.winnerParticipantId);
}
const ownSource=(record,key,fallback)=>Object.hasOwn(record,key)?record[key]:record[fallback];
function qualifiesObservation(record,row,key){
 if(!sameOfficialFinal(record,row))return false;
 const prefix=key.startsWith('status')?'statusSource':'resultSource';
 return [SOURCE,PRIOR_SOURCE].includes(ownSource(record,prefix+'Url','sourceUrl'))
  &&ownSource(record,prefix+'Name','sourceName')==='Cricket Australia'
  &&ownSource(record,prefix+'Type','sourceType')==='official';
}
function originalClock(record,row,key){
 if(!originalKeys.includes(key)||!qualifiesObservation(record,row,key))return false;
 const at=Date.parse(record[key]);
 return typeof record[key]==='string'&&Number.isFinite(at)&&at>=Date.parse(receipt.startTimeUtc)&&at<=Date.parse(row[key]);
}
function originalSource(record,row,key){
 if(!['resultSourceUrl','statusSourceUrl'].includes(key))return false;
 const kind=key.startsWith('status')?'status':'score';
 return qualifiesObservation(record,row,kind+'CheckedAt')&&Date.parse(record[kind+'FactObservedAt'])<Date.parse(row[kind+'FactObservedAt'])&&[SOURCE,PRIOR_SOURCE].includes(record[key]);
}
function preserveObservations(record,row,next,validateClock){
 // Reapply the bound original facts after generic newer-tuple fencing. A later
 // same-final poll cannot replace the captured earlier sporting observation.
 for(const key of ['sourceUrl','sourceName','sourceType','sourceCheckedAt','resultSourceUrl','statusSourceUrl','statusSourceName','statusSourceType',...originalKeys])next[key]=row[key];
 if(sameOfficialFinal(record,row))for(const kind of ['score','status']){
  const keys=kind==='score'?['scoreFactObservedAt','scoreCheckedAt','resultSourceCheckedAt']:['statusFactObservedAt','statusCheckedAt'];
  for(const key of keys)if(record[key]!=null){
   assert(qualifiesObservation(record,row,key),'Original Cricket '+key+' has mixed or unsupported attribution');
   validateClock(record[key],'retained '+key);assert(Date.parse(record[key])>=Date.parse(receipt.startTimeUtc),'Original Cricket observation precedes start');
  }
  if(Date.parse(record[kind+'FactObservedAt'])<Date.parse(row[kind+'FactObservedAt'])){
   for(const key of keys)if(record[key]!=null)next[key]=record[key];
   const prefix=kind==='score'?'resultSource':'statusSource';
   next[prefix+'Url']=ownSource(record,prefix+'Url','sourceUrl');
   if(kind==='status'){next.statusSourceName=ownSource(record,'statusSourceName','sourceName');next.statusSourceType=ownSource(record,'statusSourceType','sourceType');}
  }
 }
 for(const kind of ['score','status'])assert(Date.parse(next[kind+'FactObservedAt'])<=Date.parse(next[kind+'CheckedAt']),'Original Cricket fact follows receipt');
 return next;
}
module.exports={applies,validate,originalClock,originalSource,preserveObservations};
