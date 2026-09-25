#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
function audit(){
 const codes=require('../data/code-inspector/manifest.json').codes;
 return {checkedAt:new Date().toISOString(),scope:'Published local fixture evidence; directory membership alone does not establish an appearance.',sports:codes.map(code=>{
  const fixtures=JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',code.chunkPath))).fixtures||[];
  const athletes=f=> (f.participants||[]).filter(p=>/^(athlete|competitor):/.test(p.id||''));
  const actual=fixtures.filter(f=>!f.detailsUnavailable&&!/placeholder/.test(f.cardType||''));
  return {code:code.id,label:code.label,fixtures:fixtures.length,publishedParticipants:actual.filter(f=>f.participantIds?.length).length,individualParticipants:actual.filter(f=>athletes(f).length).length,confirmedEntryCards:actual.filter(f=>f.participantsConfirmed&&f.entries?.length).length,nestedAppearances:actual.reduce((n,f)=>n+(f.appearances?.length||0),0),exactStarts:actual.filter(f=>f.startTimeUtc).length,withSource:actual.filter(f=>/^https:\/\//.test(f.sourceUrl||'')).length,coverage:code.coverageStatus};
 })};
}
if(require.main===module){const report=audit();const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
module.exports={audit};
