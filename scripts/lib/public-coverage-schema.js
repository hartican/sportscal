'use strict';
// Closed public sporting shapes from source-coverage/coverage-discovery,
// cricket-scorecard/current-results and the deployed observation projector.
// Unknown fields fail the whole export: this is not a lossy JSON scrubber.
const identity=require('../../config/fixture-identity');
const contract=require('./live-coverage-read-contract');
const fail=code=>{throw Error('PUBLIC_COVERAGE_'+code);};
const string=(v,max=500)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f\x7f]/.test(v))fail('FIELD_TYPE');};
const text=v=>string(v),longText=v=>string(v,2000),boolean=v=>{if(typeof v!=='boolean')fail('FIELD_TYPE');};
const number=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)fail('FIELD_TYPE');};
const integer=v=>{number(v);if(!Number.isSafeInteger(v))fail('FIELD_TYPE');};
const identifier=v=>{string(v,200);if(!/^[a-z0-9_:.-]+$/i.test(v))fail('IDENTITY');};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('CLOCK');};
function instant(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))fail('CLOCK');return Date.parse(v);}
const nullable=check=>v=>{if(v!==null)check(v);};
const list=(check,max=32)=>v=>{if(!Array.isArray(v)||v.length>max)fail('FIELD_TYPE');v.forEach(check);};
function object(schema){return v=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!Object.hasOwn(schema,k)))fail('PRIVATE_OR_UNKNOWN_FIELD');for(const [k,x]of Object.entries(v))schema[k](x);};}
const queryValues={
 ...Object.fromEntries('fixtureId competitionId limit pageSize page offset year'.split(' ').map(k=>[k,/^\d{1,9}$/])),
 jsconfig:/^eccn:true$/,format:/^json$/,isCompleted:/^(?:true|false)$/,isInningInclude:/^(?:true|false)$/,
 startDate:/^\d{4}-\d\d-\d\d$/,endDate:/^\d{4}-\d\d-\d\d$/,dates:/^\d{8}(?:-\d{8})?$/,
 sport:/^(?:mru|wru|mrs|wrs)$/,states:/^[A-Z0-9]+(?:,[A-Z0-9]+)*$/,sort:/^(?:asc|desc)$/,region:/^[a-z]{2}$/i,lang:/^[a-z]{2}$/i,calendar:/^\d{4}$/,
};
function url(v){
 string(v,1500);let u;try{u=new URL(v);}catch{fail('SOURCE_URL');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash)fail('SOURCE_URL');
 for(const [k,x]of u.searchParams)if(!Object.hasOwn(queryValues,k)||!queryValues[k].test(x))fail('SOURCE_URL');
}
const ids=list(identifier),texts=list(text),clock=nullable(instant),urls=list(url);
const fields=(keys,check)=>Object.fromEntries(keys.split(' ').map(k=>[k,check]));
const participant=object({...fields('id',identifier),...fields('name displayName role teamKind genderCategory',text),countryCode:nullable(text),aliases:texts,sourceIds:object({espn:identifier,worldRugby:identifier,cricketAustralia:identifier})});
const slot=object({slot:integer,participantId:nullable(value=>{if(value!=='')identifier(value);}),label:text,logoUrl:nullable(v=>{string(v);if(!/^assets\/[a-z0-9_./-]+$/i.test(v))url(v);})});
const viewing=object({...fields('providerId reviewId',identifier),...fields('rightsScope linkScope territory liveOrReplay accessType label name type',text),...fields('webUrl sportUrl sourceUrl url',url),...fields('verifiedAt checkedAt sourceCheckedAt',instant)});
const batting=object({...fields('playerId battingOrder sourceOrder runs balls fours sixes',nullable(integer)),strikeRate:nullable(number),...fields('name dismissalType dismissal bowledBy dismissedBy',nullable(text)),...fields('isBatting notOut didNotBat',boolean)});
const bowling=object({...fields('playerId maidens runs wickets wides noBalls',nullable(integer)),economy:nullable(number),name:nullable(text),overs:nullable(text)});
const wicket=object({name:nullable(text),wicket:nullable(integer),runs:nullable(integer),overs:nullable(text)});
const innings=object({
 ...fields('id day balls ballsRemaining fixtureId inningNumber battingTeamId bowlingTeamId runsScored numberOfWicketsFallen totalExtras byesRuns legByesRuns wideBalls noBalls penalties overnightRuns overnightWickets',integer),
 ...fields('currentRunRate requiredRunRate',number),...fields('team participantId oversBowled duckworthLewisOvers',nullable(text)),
 ...fields('isDeclared isFollowOn isForfeited detailStale',boolean),batting:list(batting,22),bowling:list(bowling,22),wickets:list(wicket,10),fallOfWickets:list(wicket,10),
 extras:object(fields('total byes legByes wides noBalls penalties',nullable(number))),detailCheckedAt:instant,detailSourceUrl:url,
});
const schema={
 ...fields('id eventId canonicalEventId sourceFixtureId competitionId discoverySourceId homeParticipantId awayParticipantId',identifier),sourceEventIds:ids,participantIds:ids,
 ...fields('key sportKey sport sportDomainId name displayTitleCompact competitionName competitionScope gender discipline sourceName sourceType sourceCoverage sourceStatus fixtureObservationSchema',text),
 ...fields('venue roundLabel statusText format matchFormat playingFormat time',nullable(text)),...fields('scoreDisplay cricketBalance outcomeText recapText result',nullable(longText)),
 ...fields('sourceUrl officialScorecardUrl matchDaySourceUrl',url),...fields('restartSourceUrl',nullable(url)),
 ...fields('date endDate startDate',date),...fields('startTimeUtc endTimeUtc restartTimeUtc actualEndTimeUtc completedAt',clock),
 ...fields('sourceCheckedAt canonicalSourceCheckedAt statusCheckedAt scoreCheckedAt statusFactObservedAt scoreFactObservedAt firstConfirmedCompleteAt livePlayObservedAt cricketPhaseCheckedAt cricketDetailAttemptedAt restartSourceCheckedAt resultPublishedAt',clock),
 ...fields('homeScore awayScore matchDay numberOfDays round roundNumber liveWindow',nullable(integer)),
 ...fields('dateOnly isInternational isSenior sourceStale cricketPhaseConfirmed timeTbc startTimeTbc',boolean),
 ...fields('timePrecision schedulePrecision scheduleStatus endTimeBasis',text),status:text,
 participants:list(participant,2),participantSlots:list(slot,2),participantCountryCodes:texts,representativeCountryCodes:texts,
 broadcaster:text,broadcasterIds:ids,broadcastOptions:list(viewing),broadcasts:list(viewing),viewingOptions:list(viewing),
 timingProvenance:object({...fields('kind precision',text),...fields('checkedAt',instant),sourceUrl:url,...fields('sourceLocalDate sourceLocalEndDate',date)}),
 sourceTime:object({label:text,millis:v=>{if(!Number.isSafeInteger(v))fail('CLOCK');},gmtOffset:v=>{if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>24)fail('CLOCK');}}),
 schedulingWindow:nullable(object({startsOn:date,endsOn:date,timeZone:text})),
 consensusTags:list(object({label:text,method:text,confidence:v=>{number(v);if(v>1)fail('FIELD_TYPE');},sourceUrls:urls})),
 innings:list(innings,4),
 cricketChase:nullable(object({confirmed:boolean,inningNumber:integer,runsRemaining:integer,wicketsRemaining:integer,ballsRemaining:nullable(integer)})),
 pauseObservation:nullable(object({status:text,reason:text,observedAt:instant})),
};
const statuses=new Set(['scheduled','upcoming','live','in_progress','in-progress','ongoing','stumps','rain-delay','break','suspended','interrupted','completed','finished','final','cancelled','abandoned','postponed','withdrawn']);
function validateRow(row,capturedAt){
 object({source_id:identifier,fixture_id:identifier,fixture:object(schema),identity_keys:ids})(row);
 if(!row.fixture||!row.fixture_id||!row.source_id||!row.identity_keys)fail('REQUIRED_FIELD');
 const f=row.fixture;
 if(!contract.SOURCES.includes(row.source_id))fail('SOURCE_OR_DUPLICATE');
 for(const k of ['id','key','sportDomainId','name','status','sourceUrl','participants','participantIds'])if(f[k]===undefined)fail('REQUIRED_FIELD');
 const canonical=identity.canonicalFixtureId(row.fixture_id),aliases=[f.id,f.eventId,f.canonicalEventId,...(f.sourceEventIds||[]),...(row.identity_keys||[])];
 if(!row.identity_keys?.includes(row.fixture_id)||new Set(row.identity_keys).size!==row.identity_keys.length||aliases.some(a=>a!==undefined&&identity.canonicalFixtureId(a)!==canonical))fail('ALIAS_UNQUALIFIED');
 const cricket=row.source_id.includes('cricket');
 if(cricket?(f.key!=='cricket'||f.sportDomainId!=='sport:cricket'):(!['rugby','rugby-union'].includes(f.key)||f.sportDomainId!=='sport:rugby-union'))fail('SOURCE_SPORT');
 if(!statuses.has(f.status))fail('STATUS');
 if(!f.sourceCheckedAt&&!f.canonicalSourceCheckedAt)fail('CLOCK');
 // Nulls remain unknown. Only observation clocks (not future appointments) are bounded.
 for(const [k,v]of Object.entries(f))if(v!=null&&(/(?:CheckedAt|ObservedAt)$/.test(k)||['firstConfirmedCompleteAt','completedAt','actualEndTimeUtc','resultPublishedAt'].includes(k))&&instant(v)>capturedAt+300000)fail('CLOCK');
 function observed(value){
  if(!value||typeof value!=='object')return;
  for(const [k,v]of Object.entries(value)){
   if(v!=null&&(/(?:CheckedAt|ObservedAt)$/.test(k)||['checkedAt','verifiedAt','observedAt'].includes(k))&&instant(v)>capturedAt+300000)fail('CLOCK');
   if(v&&typeof v==='object')observed(v);
  }
 }
 observed(f);
 const start=f.startTimeUtc==null?null:instant(f.startTimeUtc),end=f.endTimeUtc==null?null:instant(f.endTimeUtc);
 if(start==null){if(!f.date||!['unknown','date-only','tbc','follows','estimated'].includes(f.timePrecision))fail('CLOCK');}
 if(start!=null&&end!=null&&end<start||f.endDate&&f.date&&f.endDate<f.date)fail('CLOCK');
 if(new Set(f.participantIds).size!==f.participantIds.length||f.participants.length!==f.participantIds.length||JSON.stringify(f.participants.map(p=>p.id))!==JSON.stringify(f.participantIds))fail('SIDES');
 if(f.participants.length===2){if(f.participants.some((p,i)=>p.role&&p.role!==['home','away'][i]))fail('SIDES');if(f.homeParticipantId!==f.participantIds[0]||f.awayParticipantId!==f.participantIds[1])fail('SIDES');}
 else{
  if(f.homeScore!=null||f.awayScore!=null||[f.homeParticipantId,f.awayParticipantId].some(id=>id&&!f.participantIds.includes(id))||f.homeParticipantId&&f.awayParticipantId)fail('SIDES');
  for(const p of f.participants)if(p.role&&p.id!==f[p.role==='home'?'homeParticipantId':'awayParticipantId'])fail('SIDES');
 }
 if(f.participantSlots){
  if(new Set(f.participantSlots.map(p=>p.slot)).size!==f.participantSlots.length||f.participantSlots.some(p=>![1,2].includes(p.slot)||p.participantId&&!f.participantIds.includes(p.participantId)))fail('SIDES');
 }
 if((f.homeScore!=null)!==(f.awayScore!=null))fail('SCORE');
 if(f.innings?.length){
  if(!cricket||new Set(f.innings.map(i=>i.inningNumber)).size!==f.innings.length)fail('SCORE');
  for(const i of f.innings){
   if(['inningNumber','runsScored','numberOfWicketsFallen','oversBowled','participantId'].some(k=>i[k]==null))fail('SCORE');
   if(!/^\d{1,3}(?:\.[0-5])?$/.test(i.oversBowled))fail('SCORE');
   if(!Number.isInteger(i.inningNumber)||i.inningNumber<1||i.inningNumber>4||i.numberOfWicketsFallen>10||i.participantId&&!f.participantIds.includes(i.participantId))fail('SCORE');
  }
 }
 return row;
}
module.exports={validateRow,instant,object,fail,fixtureFields:Object.keys(schema)};
