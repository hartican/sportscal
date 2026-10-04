'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const taxonomy=require('../../config/canonical-sports-taxonomy');
function repair(bundle,source=taxonomy){
 assert.equal(bundle.schemaVersion,'canonical-sports.v1','Unexpected canonical bundle');
 assert.equal(bundle.taxonomyVersion,source.schemaVersion,'Unexpected taxonomy version');
 const domains=new Set(bundle.sportDomains.map(d=>d.id));
 const families=new Map(bundle.competitionFamilies.map(f=>[f.id,f]));
 assert.equal(families.size,bundle.competitionFamilies.length,'Duplicate canonical family');
 const knownFamilies=new Map(source.competitionFamilies.map(f=>[f.id,f]));
 const knownCompetitions=new Map(source.competitions.map(c=>[c.id,c]));
 const additions=[];
 for(const competition of bundle.competitions){
  const known=knownCompetitions.get(competition.id),family=knownFamilies.get(competition.competitionFamilyId);
  assert(known&&known.competitionFamilyId===competition.competitionFamilyId&&known.sportDomainId===competition.sportDomainId,`Unreviewed competition relationship: ${competition.id}`);
  assert(family&&family.sportDomainId===competition.sportDomainId&&domains.has(family.sportDomainId),`Unreviewed family relationship: ${competition.id}`);
  const existing=families.get(family.id);
  if(existing){assert.equal(existing.sportDomainId,family.sportDomainId,'Conflicting existing family domain');continue;}
  additions.push(structuredClone(family));families.set(family.id,family);
 }
 return {bundle:additions.length?{...bundle,competitionFamilies:[...bundle.competitionFamilies,...additions]}:bundle,added: additions.map(f=>f.id)};
}
function apply({file=path.resolve(__dirname,'../../data/canonical/afl-nrl-2026.json'),source=taxonomy}={}){
 const original=fs.readFileSync(file),result=repair(JSON.parse(original),source);
 if(result.added.length)fs.writeFileSync(file,JSON.stringify(result.bundle,null,2)+'\n');
 return {added:result.added,changed:result.added.length>0,preservedFactClocks:true};
}
module.exports={repair,apply};
