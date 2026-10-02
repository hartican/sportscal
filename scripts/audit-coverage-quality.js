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
function audit({contract=require('../config/quality/coverage-contract.json'),manifest=require('../data/code-inspector/manifest.json'),read=slug=>require(`../data/code-inspector/${slug}.json`),now=new Date()}={}){
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
   const row=competitionMap.get(id)||{id,fixtures:0,inDeclaredWindow:0,undated:0,missingParticipantIdentity:0,invalidFootballIdentity:0,missingSource:0,projectionConflicts:0,unknown:false,records:[]};
   row.fixtures++;
   const views=copies.get(fixture.id);
   row.records.push(...views);
   if(conflicts.has(fixture.id))row.projectionConflicts++;
   if(views.some(f=>!validDate(f.date)))row.undated++;
   if(views.some(f=>validDate(f.date)&&f.date>=contract.window.from&&f.date<=contract.window.through))row.inDeclaredWindow++;
   if(views.some(f=>!f.participantIds?.length))row.missingParticipantIdentity++;
   if(family.id==='football'&&views.some(f=>!Array.isArray(f.participantIds)||f.participantIds.length!==2||f.participantIds.some(p=>typeof p!=='string'||!p.trim())||new Set(f.participantIds).size!==2))row.invalidFootballIdentity++;
   if(views.some(f=>!webUrl(f.sourceUrl)&&!webUrl(f.canonicalSourceUrl)))row.missingSource++;
   competitionMap.set(id,row);
  }
  for(const pilot of contract.pilotCompetitions.filter(p=>p.family===family.id))if(!competitionMap.has(pilot.id))competitionMap.set(pilot.id,{id:pilot.id,fixtures:0,inDeclaredWindow:0,undated:0,missingParticipantIdentity:0,invalidFootballIdentity:0,missingSource:0,projectionConflicts:0,unknown:true,records:[]});
  const competitions=[...competitionMap.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
   const pilot=contract.pilotCompetitions.find(p=>p.family===family.id&&p.id===row.id);
   const inScope=pilot||row.inDeclaredWindow>0||row.undated>0;
   const scope=row.unknown?'missing-pilot':row.inDeclaredWindow>0?'declared-window':row.undated>0?'undated':pilot?'missing-window-fixtures':'retained-outside-window';
   const proofs=contract.certifications.filter(c=>c.competitionId===row.id&&c.window?.from===contract.window.from&&c.window?.through===contract.window.through);
   const proof=proofs.length===1?proofs[0]:null;
   const digest=projectionDigest(row.records),distinct=[...new Map(row.records.map(f=>[f.id,f])).values()];
   const seasonFixtures=pilot?.season?distinct.filter(f=>f.season===pilot.season).length:null;
   const leaguePhaseFixtures=pilot?.season?distinct.filter(f=>f.season===pilot.season&&f.stage==='League phase').length:null;
   const failures=[];
   if(inScope){
    if(row.inDeclaredWindow===0)failures.push('no-window-fixtures');
    if(row.undated)failures.push('undated-fixtures');
    if(row.id==='unclassified')failures.push('unclassified-competition');
    if(row.missingSource)failures.push('missing-source');
    if(row.invalidFootballIdentity)failures.push('invalid-football-identity');
    if(row.projectionConflicts)failures.push('conflicting-projections');
    if(pilot?.expectedSeasonFixtures!==undefined&&seasonFixtures!==pilot.expectedSeasonFixtures)failures.push('season-fixture-count');
    if(pilot?.expectedLeaguePhaseFixtures!==undefined&&leaguePhaseFixtures!==pilot.expectedLeaguePhaseFixtures)failures.push('league-phase-fixture-count');
    if(!proof)failures.push(proofs.length>1?'ambiguous-certification':'missing-certification');
    else{
     if(!Number.isInteger(proof.expectedFixtures)||proof.expectedFixtures<1||proof.expectedFixtures!==row.fixtures)failures.push('unreconciled-fixture-count');
     if(proof.projectionDigest!==digest)failures.push('unreviewed-projection');
     if(!contract.requiredGates.every(g=>proof.gates?.[g]?.status==='pass'&&Array.isArray(proof.gates[g].evidence)&&proof.gates[g].evidence.length>0&&proof.gates[g].evidence.every(evidenceExists)))failures.push('incomplete-gate-evidence');
     if(!/^[a-f0-9]{40}$/.test(proof.releaseSha||''))failures.push('invalid-release-sha');
     const liveAt=Date.parse(proof.liveVerifiedAt);
     if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(proof.liveVerifiedAt||'')||!validDate(proof.liveVerifiedAt?.slice(0,10))||!Number.isFinite(liveAt)||liveAt>new Date(now).getTime())failures.push('invalid-live-verification-time');
    }
   }
   const {records,...inventory}=row;
   return {...inventory,seasonFixtures,leaguePhaseFixtures,expectedSeasonFixtures:pilot?.expectedSeasonFixtures,expectedLeaguePhaseFixtures:pilot?.expectedLeaguePhaseFixtures,projectionDigest:digest,inScope:!!inScope,scope,status:!inScope?'outside-window':failures.length===0?'certified':'unverified',certificationFailures:failures,gates:proof?.gates||Object.fromEntries(contract.requiredGates.map(g=>[g,{status:'unverified'}]))};
  });
  return {...family,uniqueProjectionFixtures:unique.size,competitions,status:competitions.some(c=>c.inScope)&&competitions.filter(c=>c.inScope).every(c=>c.status==='certified')?'certified':'unverified'};
 });
 const carried=families.filter(f=>f.carried),passed=carried.filter(f=>f.status==='certified');
 return {version:contract.version,window:contract.window,families,pilotCompetitions:contract.pilotCompetitions,summary:{carriedFamilies:carried.length,certifiedFamilies:passed.length,requiredFamilies:Math.ceil(carried.length*contract.minimumCarriedFamilyPassRate),pilotCertified:contract.pilotCompetitions.filter(p=>families.find(f=>f.id===p.family)?.competitions.find(c=>c.id===p.id)?.status==='certified').length,pilotTotal:contract.pilotCompetitions.length},limitations:['Structural inventory is not independent source reconciliation.','Retained competitions outside the declared window remain listed but do not expand the current-window certification scope; pilots and undated records remain in scope.','Fixture IDs deduplicate overlapping Code projections; conflicting copies block certification, while cross-provider alias reconciliation remains a gate.','Missing identity counts include individual/multi-entry sports and need sport-specific review; Football requires two distinct identities.','An empty Inspector does not remove a carried family or prove no fixtures exist.','Certification binds the reviewed projection and reconciled counts; check-only clock changes do not invalidate it.','Evidence references are checked for syntax/local existence, not independently verified truth, permission or live release ownership.']};
}
if(require.main===module){const report=audit();const out=process.argv[2];if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report.summary));}
module.exports={audit,projectionDigest};
