#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function audit({contract=require('../config/quality/coverage-contract.json'),manifest=require('../data/code-inspector/manifest.json'),read=slug=>require(`../data/code-inspector/${slug}.json`)}={}){
 const owners=new Map();
 for(const family of contract.families)for(const code of family.codes){assert(!owners.has(code),`Duplicate family assignment: ${code}`);owners.set(code,family.id);}
 for(const code of manifest.codes)assert(owners.has(code.slug),`Unreviewed new Code: ${code.slug}`);
 const families=contract.families.map(family=>{
  const unique=new Map(),competitionMap=new Map();
  for(const slug of family.codes)for(const fixture of read(slug).fixtures||[]){
   const id=fixture.id;assert(id,`${slug}: missing fixture ID`);
   if(!unique.has(id))unique.set(id,fixture);
  }
  assert(family.carried||unique.size===0,`${family.id}: new fixtures require an explicit carried-family decision`);
  for(const fixture of unique.values()){
   const id=fixture.competitionId||'unclassified';
   const row=competitionMap.get(id)||{id,fixtures:0,inDeclaredWindow:0,undated:0,missingParticipantIdentity:0,missingSource:0,unknown:false};
   row.fixtures++;
   const timestamp=Date.parse(`${fixture.date}T00:00:00Z`);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(fixture.date||'')||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==fixture.date)row.undated++;
   else if(fixture.date>=contract.window.from&&fixture.date<=contract.window.through)row.inDeclaredWindow++;
   if(!fixture.participantIds?.length)row.missingParticipantIdentity++;
   if(!fixture.sourceUrl&&!fixture.canonicalSourceUrl)row.missingSource++;
   competitionMap.set(id,row);
  }
  for(const pilot of contract.pilotCompetitions.filter(p=>p.family===family.id))if(!competitionMap.has(pilot.id))competitionMap.set(pilot.id,{id:pilot.id,fixtures:0,inDeclaredWindow:0,undated:0,missingParticipantIdentity:0,missingSource:0,unknown:true});
  const competitions=[...competitionMap.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(row=>{
   const pilot=contract.pilotCompetitions.some(p=>p.family===family.id&&p.id===row.id);
   const inScope=pilot||row.inDeclaredWindow>0||row.undated>0;
   const scope=row.unknown?'missing-pilot':row.inDeclaredWindow>0?'declared-window':row.undated>0?'undated':pilot?'missing-window-fixtures':'retained-outside-window';
   const proof=contract.certifications.find(c=>c.competitionId===row.id&&c.window?.from===contract.window.from&&c.window?.through===contract.window.through);
   const certified=inScope&&row.inDeclaredWindow>0&&row.undated===0&&!!proof&&row.id!=='unclassified'&&contract.requiredGates.every(g=>proof.gates?.[g]?.status==='pass'&&proof.gates[g].evidence?.length)&&/^[a-f0-9]{40}$/.test(proof.releaseSha||'')&&Number.isFinite(Date.parse(proof.liveVerifiedAt));
   return {...row,inScope,scope,status:!inScope?'outside-window':certified?'certified':'unverified',gates:proof?.gates||Object.fromEntries(contract.requiredGates.map(g=>[g,{status:'unverified'}]))};
  });
  return {...family,uniqueProjectionFixtures:unique.size,competitions,status:competitions.some(c=>c.inScope)&&competitions.filter(c=>c.inScope).every(c=>c.status==='certified')?'certified':'unverified'};
 });
 const carried=families.filter(f=>f.carried),passed=carried.filter(f=>f.status==='certified');
 return {version:contract.version,window:contract.window,families,pilotCompetitions:contract.pilotCompetitions,summary:{carriedFamilies:carried.length,certifiedFamilies:passed.length,requiredFamilies:Math.ceil(carried.length*contract.minimumCarriedFamilyPassRate),pilotCertified:contract.pilotCompetitions.filter(p=>families.find(f=>f.id===p.family)?.competitions.find(c=>c.id===p.id)?.status==='certified').length,pilotTotal:contract.pilotCompetitions.length},limitations:['Structural inventory is not independent source reconciliation.','Retained competitions outside the declared window remain listed but do not expand the current-window certification scope; pilots and undated records remain in scope.','Fixture IDs deduplicate overlapping Code projections; cross-provider alias reconciliation remains a gate.','Missing identity counts include individual/multi-entry sports and need sport-specific review.','An empty Inspector does not remove a carried family or prove no fixtures exist.']};
}
if(require.main===module){const report=audit();const out=process.argv[2];if(out){fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report.summary));}
module.exports={audit};
