#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
// Verification clocks can advance without changing the reviewed experience.
// Fact observation times, results, identity, viewing and editorial remain bound.
const checkClocks=new Set(['checkedAt','sourceCheckedAt','statusCheckedAt','resultSourceCheckedAt','lastCheckedAt','verifiedAt','liveVerifiedAt']);
function stableProjection(value){
 if(Array.isArray(value))return value.map(stableProjection);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!checkClocks.has(k)).sort().map(k=>[k,stableProjection(value[k])]));
 return value;
}
function fixtureProjection({codeId,preferenceDomainId,...fixture}){
 const projection=stableProjection(fixture);
 if(Array.isArray(projection.sourceEventIds))projection.sourceEventIds=[...new Set(projection.sourceEventIds)].sort();
 return projection;
}
function projectionDigest(fixtures){
 const copies=[...new Set(fixtures.map(f=>JSON.stringify(fixtureProjection(f))))].sort();
 return crypto.createHash('sha256').update(JSON.stringify(copies)).digest('hex');
}
function conflictingProjection(a,b){
 const left=fixtureProjection(a),right=fixtureProjection(b);
 // A child may expose additional reviewed detail. Absence is not a contrary
 // fact; all copies are still included in the certification fingerprint.
 return Object.keys(left).some(k=>Object.hasOwn(right,k)&&JSON.stringify(left[k])!==JSON.stringify(right[k]));
}
function webUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
function evidenceExists(ref){
 if(typeof ref!=='string'||!ref.trim())return false;
 if(webUrl(ref))return true; // Reference syntax only; no network or truth claim.
 if(path.isAbsolute(ref))return false;
 try{const resolved=fs.realpathSync(path.resolve(root,ref));return resolved.startsWith(root+path.sep)&&fs.statSync(resolved).isFile()&&fs.statSync(resolved).size>0;}catch{return false;}
}
function validDate(date){const t=Date.parse(`${date}T00:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===date;}
function calendarContextFailures(fixture,review,now,family){
 const failures=[],window=fixture.schedulingWindow,provenance=fixture.timingProvenance;
 if(!review)return ['unreviewed-calendar-context'];
 if(review.family!==family)failures.push('context-family');
 if(fixture.competitionId!==review.competitionId)failures.push('context-competition');
 if(!Array.isArray(review.evidence)||!review.evidence.length||!review.evidence.every(evidenceExists))failures.push('context-review');
 if(!validDate(window?.startsOn)||!validDate(window?.endsOn)||window.startsOn>window.endsOn)failures.push('context-window');
 try{new Intl.DateTimeFormat('en',{timeZone:window?.timeZone});if(!window?.timeZone)throw new Error('missing');}catch{failures.push('context-time-zone');}
 const utcProgramme=review.sourceDateConvention==='utc-programme';
 if(utcProgramme){
  const stamp=provenance?.sourceStartTimeUtc;
  const validUtc=typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(stamp)&&validDate(stamp.slice(0,10))&&Number.isFinite(Date.parse(stamp))&&new Date(stamp).toISOString().replace('.000Z','Z')===stamp.replace('.000Z','Z');
  if(!validUtc||stamp.slice(0,10)!==review.sourceDate||provenance.sourceDateLabel!==review.sourceDate||fixture.displayDateLabel!==review.displayDateLabel||window?.startsOn!==review.sourceDate||window?.endsOn!==review.sourceDate||window?.timeZone!=='UTC'||provenance.timeZone!=null&&provenance.timeZone!=='UTC')failures.push('context-programme-date');
 }
 if(provenance?.precision!=='competition-stage-calendar'||!utcProgramme&&provenance.timeZone!==window?.timeZone||provenance?.sourceUrl!==review.sourceUrl||fixture.sourceUrl!==review.sourceUrl)failures.push('context-source');
 const observed=Date.parse(provenance?.observedAt);
 if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(provenance?.observedAt||'')||!validDate(provenance?.observedAt?.slice(0,10))||!Number.isFinite(observed)||observed>new Date(now).getTime())failures.push('context-observation');
 if([fixture.name,fixture.displayDateLabel,provenance?.sourceDateLabel].some(value=>typeof value!=='string'||!value.trim()))failures.push('context-label');
 // A reviewed calendar is never a substitute for a timed or scored match.
 // Keep the raw identity/date diagnostics, and fail contradictory claims.
 const matchFields=['date','time','startTimeUtc','endTimeUtc','actualStartTimeUtc','homeScore','awayScore','score','scoreDisplay','outcomeText','resultSourceUrl','winnerParticipantId'];
 if(matchFields.some(key=>fixture[key]!=null&&fixture[key]!=='')||['participantIds','participantSlots','participants'].some(key=>!Array.isArray(fixture[key])||fixture[key].length)||fixture.status!=='upcoming')failures.push('context-match-facts');
 return failures;
}
function audit({contract=require('../config/quality/coverage-contract.json'),manifest=require('../data/code-inspector/manifest.json'),read=slug=>require(`../data/code-inspector/${slug}.json`),now=new Date()}={}){
 const calendarCompetitions=new Map();
 for(const competition of contract.reviewedCalendarCompetitions||[]){
  assert(typeof competition.id==='string'&&competition.id.trim(),'Calendar competition requires an explicit identity');
  assert(contract.families.some(f=>f.id===competition.family&&f.carried),'Calendar competition must belong to a carried family');
  assert(!contract.pilotCompetitions.some(p=>p.id===competition.id),'Calendar competition cannot alter a pilot');
  assert(!calendarCompetitions.has(competition.id),'Duplicate reviewed calendar competition');
  assert(Number.isInteger(competition.minimumMatchFixtures)&&competition.minimumMatchFixtures>0,'Calendar competition requires its reviewed minimum match count');
  assert(Array.isArray(competition.evidence)&&competition.evidence.length&&competition.evidence.every(evidenceExists),'Calendar competition requires review evidence');
  calendarCompetitions.set(competition.id,competition);
 }
 const calendarReviews=new Map();
 for(const review of contract.reviewedCalendarContexts||[]){
  assert(webUrl(review.sourceUrl),'Calendar review requires a public source reference');
  const owner=contract.pilotCompetitions.find(p=>p.id===review.competitionId)||calendarCompetitions.get(review.competitionId);
  assert(owner,'Calendar review must belong to an explicitly reviewed pilot or carried calendar competition');
  assert(review.family==null||review.family===owner.family,'Calendar review family must match its declared competition');
  assert(Array.isArray(review.recordIds)&&review.recordIds.length>0&&review.recordIds.every(id=>typeof id==='string'&&!!id.trim()),'Calendar review requires explicit record IDs');
  assert(review.sourceDateConvention==null||review.sourceDateConvention==='utc-programme','Unknown calendar source date convention');
  if(review.sourceDateConvention==='utc-programme')assert(review.recordIds.length===1&&validDate(review.sourceDate)&&typeof review.displayDateLabel==='string'&&review.displayDateLabel.trim(),'UTC programme review requires one explicit ID, reviewed source date and display label');
  for(const id of review.recordIds){assert(!calendarReviews.has(id),`Duplicate reviewed calendar ID: ${id}`);calendarReviews.set(id,{...review,family:owner.family});}
 }
 for(const competition of calendarCompetitions.values())assert([...calendarReviews.values()].some(r=>r.competitionId===competition.id),'Calendar competition requires explicit reviewed records');
 const blankRow=id=>({id,fixtures:0,nonCalendarRecords:0,calendarContexts:0,inDeclaredWindow:0,calendarContextsInDeclaredWindow:0,undated:0,undatedFixtures:0,missingParticipantIdentity:0,invalidFootballIdentity:0,invalidFootballMatchIdentity:0,missingSource:0,projectionConflicts:0,calendarContextFailures:[],missingReviewedCalendarContexts:[],unknown:false,records:[]});
 const owners=new Map();
 for(const family of contract.families)for(const code of family.codes){assert(!owners.has(code),`Duplicate family assignment: ${code}`);owners.set(code,family.id);}
 for(const code of manifest.codes)assert(owners.has(code.slug),`Unreviewed new Code: ${code.slug}`);
 const families=contract.families.map(family=>{
  const unique=new Map(),competitionMap=new Map(),conflicts=new Set(),copies=new Map();
  for(const slug of family.codes)for(const fixture of read(slug).fixtures||[]){
   const id=fixture.id;assert(id,`${slug}: missing fixture ID`);
   const existing=copies.get(id)||[];
   if(existing.some(copy=>conflictingProjection(copy,fixture)))conflicts.add(id);
   copies.set(id,[...existing,fixture]);
   if(!unique.has(id))unique.set(id,fixture);
  }
  assert(family.carried||unique.size===0,`${family.id}: new fixtures require an explicit carried-family decision`);
  for(const fixture of unique.values()){
   const id=fixture.competitionId||'unclassified';
   const row=competitionMap.get(id)||blankRow(id);
   const declaredOwner=calendarCompetitions.get(id);
   if(declaredOwner&&declaredOwner.family!==family.id)row.calendarContextFailures.push({id:fixture.id,failures:['context-family']});
   row.fixtures++;
   const views=copies.get(fixture.id);
   const review=calendarReviews.get(fixture.id),isCalendar=!!review;
   if(isCalendar){
    row.calendarContexts++;
    const failures=[...new Set(views.flatMap(f=>calendarContextFailures(f,review,now,family.id)))];
    if(failures.length)row.calendarContextFailures.push({id:fixture.id,failures});
    if(views.some(f=>validDate(f.schedulingWindow?.startsOn)&&validDate(f.schedulingWindow?.endsOn)&&f.schedulingWindow.startsOn<=contract.window.through&&f.schedulingWindow.endsOn>=contract.window.from))row.calendarContextsInDeclaredWindow++;
   }else{
    row.nonCalendarRecords++;
    if(views.some(f=>f.timingProvenance?.precision==='competition-stage-calendar'))row.calendarContextFailures.push({id:fixture.id,failures:['unreviewed-calendar-context']});
   }
   row.records.push(...views);
   if(conflicts.has(fixture.id))row.projectionConflicts++;
   if(views.some(f=>!validDate(f.date)))row.undated++;
   if(!isCalendar&&views.some(f=>!validDate(f.date)))row.undatedFixtures++;
   if(views.some(f=>validDate(f.date)&&f.date>=contract.window.from&&f.date<=contract.window.through))row.inDeclaredWindow++;
   if(views.some(f=>!f.participantIds?.length))row.missingParticipantIdentity++;
   if(family.id==='football'&&views.some(f=>!Array.isArray(f.participantIds)||f.participantIds.length!==2||f.participantIds.some(p=>typeof p!=='string'||!p.trim())||new Set(f.participantIds).size!==2)){
    row.invalidFootballIdentity++;
    if(!isCalendar)row.invalidFootballMatchIdentity++;
   }
   if(views.some(f=>!webUrl(f.sourceUrl)&&!webUrl(f.canonicalSourceUrl)))row.missingSource++;
   competitionMap.set(id,row);
  }
  for(const pilot of contract.pilotCompetitions.filter(p=>p.family===family.id))if(!competitionMap.has(pilot.id))competitionMap.set(pilot.id,{...blankRow(pilot.id),unknown:true});
  for(const competition of calendarCompetitions.values())if(competition.family===family.id&&!competitionMap.has(competition.id))competitionMap.set(competition.id,{...blankRow(competition.id),unknown:true});
  for(const [recordId,review]of calendarReviews){
   if(review.family!==family.id)continue;
   const row=competitionMap.get(review.competitionId);
   if(row&&unique.get(recordId)?.competitionId!==review.competitionId)row.missingReviewedCalendarContexts.push(recordId);
  }
  const competitions=[...competitionMap.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
   const pilot=contract.pilotCompetitions.find(p=>p.family===family.id&&p.id===row.id);
   const calendarCompetition=calendarCompetitions.get(row.id);
   const inScope=pilot||calendarCompetition||row.inDeclaredWindow>0||row.calendarContextsInDeclaredWindow>0||row.undated>0;
   const scope=row.unknown?(pilot?'missing-pilot':'missing-reviewed-calendar'):row.inDeclaredWindow>0?'declared-window':row.calendarContextsInDeclaredWindow>0?'calendar-window':row.undated>0?'undated':pilot?'missing-window-fixtures':'retained-outside-window';
   const proofs=contract.certifications.filter(c=>c.competitionId===row.id&&c.window?.from===contract.window.from&&c.window?.through===contract.window.through);
   const proof=proofs.length===1?proofs[0]:null;
   const digest=projectionDigest(row.records),distinct=[...new Map(row.records.map(f=>[f.id,f])).values()];
   const seasonFixtures=pilot?.season?distinct.filter(f=>!calendarReviews.has(f.id)&&f.season===pilot.season).length:null;
   const leaguePhaseFixtures=pilot?.season?distinct.filter(f=>!calendarReviews.has(f.id)&&f.season===pilot.season&&f.stage==='League phase').length:null;
   const failures=[];
   if(inScope){
    if(row.inDeclaredWindow===0)failures.push('no-window-fixtures');
    if(calendarCompetition&&row.nonCalendarRecords<calendarCompetition.minimumMatchFixtures)failures.push('minimum-match-fixtures');
    if(row.undatedFixtures)failures.push('undated-fixtures');
    if(row.id==='unclassified')failures.push('unclassified-competition');
    if(row.missingSource)failures.push('missing-source');
    if(row.invalidFootballMatchIdentity)failures.push('invalid-football-identity');
    if(row.calendarContextFailures.length)failures.push('invalid-calendar-context');
    if(row.missingReviewedCalendarContexts.length)failures.push('missing-reviewed-calendar-context');
    if(row.projectionConflicts)failures.push('conflicting-projections');
    if(pilot?.expectedSeasonFixtures!==undefined&&seasonFixtures!==pilot.expectedSeasonFixtures)failures.push('season-fixture-count');
    if(pilot?.expectedLeaguePhaseFixtures!==undefined&&leaguePhaseFixtures!==pilot.expectedLeaguePhaseFixtures)failures.push('league-phase-fixture-count');
    if(!proof)failures.push(proofs.length>1?'ambiguous-certification':'missing-certification');
    else{
     if(!Number.isInteger(proof.expectedFixtures)||proof.expectedFixtures<1||proof.expectedFixtures!==row.fixtures)failures.push('unreconciled-fixture-count');
     if(row.calendarContexts&&(proof.expectedCalendarContexts!==row.calendarContexts||proof.expectedMatchFixtures!==row.nonCalendarRecords))failures.push('unreconciled-record-kinds');
     if(proof.projectionDigest!==digest)failures.push('unreviewed-projection');
     if(!contract.requiredGates.every(g=>proof.gates?.[g]?.status==='pass'&&Array.isArray(proof.gates[g].evidence)&&proof.gates[g].evidence.length>0&&proof.gates[g].evidence.every(evidenceExists)))failures.push('incomplete-gate-evidence');
     if(!/^[a-f0-9]{40}$/.test(proof.releaseSha||''))failures.push('invalid-release-sha');
     const liveAt=Date.parse(proof.liveVerifiedAt);
     if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(proof.liveVerifiedAt||'')||!validDate(proof.liveVerifiedAt?.slice(0,10))||!Number.isFinite(liveAt)||liveAt>new Date(now).getTime())failures.push('invalid-live-verification-time');
    }
   }
   const {records,...inventory}=row;
   return {...inventory,...(family.id==='football'?{matchRecords:row.nonCalendarRecords}:{}),seasonFixtures,leaguePhaseFixtures,expectedSeasonFixtures:pilot?.expectedSeasonFixtures,expectedLeaguePhaseFixtures:pilot?.expectedLeaguePhaseFixtures,...(calendarCompetition?{minimumMatchFixtures:calendarCompetition.minimumMatchFixtures}:{}),projectionDigest:digest,inScope:!!inScope,scope,status:!inScope?'outside-window':failures.length===0?'certified':'unverified',certificationFailures:failures,gates:proof?.gates||Object.fromEntries(contract.requiredGates.map(g=>[g,{status:'unverified'}]))};
  });
  return {...family,uniqueProjectionFixtures:unique.size,competitions,status:competitions.some(c=>c.inScope)&&competitions.filter(c=>c.inScope).every(c=>c.status==='certified')?'certified':'unverified'};
 });
 const carried=families.filter(f=>f.carried),passed=carried.filter(f=>f.status==='certified');
 return {version:contract.version,window:contract.window,families,pilotCompetitions:contract.pilotCompetitions,summary:{carriedFamilies:carried.length,certifiedFamilies:passed.length,requiredFamilies:Math.ceil(carried.length*contract.minimumCarriedFamilyPassRate),pilotCertified:contract.pilotCompetitions.filter(p=>families.find(f=>f.id===p.family)?.competitions.find(c=>c.id===p.id)?.status==='certified').length,pilotTotal:contract.pilotCompetitions.length},limitations:['Structural inventory is not independent source reconciliation.','Retained competitions outside the declared window remain listed but do not expand the current-window certification scope; pilots and undated records remain in scope.','Fixture IDs deduplicate overlapping Code projections; conflicting copies block certification, while cross-provider alias reconciliation remains a gate.','The legacy fixtures field counts all retained records. matchRecords excludes only explicitly reviewed calendar IDs; no generic stage, empty participant list or missing date grants that exemption. Other sports still need sport-specific match/session/programme review.','Raw undated and identity counts remain visible for reviewed calendars; separate match diagnostics and validated calendar failures control structural acceptance. Calendars never count towards season/league-phase fixture totals or establish full-season coverage.','Missing identity counts include individual/multi-entry sports and need sport-specific review; Football matches require two distinct identities.','An empty Inspector does not remove a carried family or prove no fixtures exist.','Certification binds every reviewed projection and reconciled record-kind count; check-only clock changes do not invalidate it.','Evidence references are checked for syntax/local existence, not independently verified truth, permission or live release ownership.']};
}
if(require.main===module){const report=audit();const out=process.argv[2];if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report.summary));}
module.exports={audit,projectionDigest};
