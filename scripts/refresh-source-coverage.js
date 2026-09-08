"use strict";
// Only invoked through update-cards. Parsers are also shared by server live mode.
const fs=require("node:fs"),path=require("node:path");
const {coverageSources}=require("../lib/source-coverage");
const {mergeFixtureSnapshot}=require("../lib/fixture-snapshot");
const OUTPUT=path.join(__dirname,"../data/follow-sources/coverage.v1.json");
async function refreshCoverage({now=new Date(),sources=coverageSources()}={}){
  const prior=JSON.parse(fs.readFileSync(OUTPUT,"utf8")),results=[];
  for(let offset=0;offset<sources.length;offset+=2)results.push(...await Promise.allSettled(sources.slice(offset,offset+2).map(source=>source.fetch({now,previous:prior.events}))));
  const events=mergeFixtureSnapshot(prior.events,[...require('../data/follow-sources/verified-fixtures.v1.json').events,...results.flatMap(result=>result.status==="fulfilled"?result.value:[])]).events;
  const participants=new Map((prior.participants||[]).map(record=>[record.id,record]));
  for(const event of events)for(const participant of event.participants||[]){
    if(!participant.id)continue;
    participants.set(participant.id,{...participants.get(participant.id),...participant,type:"team",displayName:participant.name,sportDomainId:event.sportDomainId,
      leagueId:event.competitionId,competitionScope:event.competitionScope,sourceRefs:[event.sourceUrl],sourceCheckedAt:event.sourceCheckedAt});
  }
  const sourceStatus=sources.map((source,index)=>({id:source.id,status:results[index].status==="fulfilled"?(results[index].value.coverage?.failures.length?'partial':'ok'):"failed",checkedAt:now.toISOString(),...(results[index].value?.coverage?{coverage:results[index].value.coverage}:{})}));
  if(results.every(result=>result.status==="rejected"))throw new Error("Coverage sources failed; existing fixtures preserved");
  const competitions=[...new Map(events.map(event=>[event.competitionId,{id:event.competitionId,name:event.competitionName,sport:event.key,scope:event.competitionScope,gender:event.gender}])).values()];
  const document={schemaVersion:"source-coverage.v1",generatedAt:now.toISOString(),coverageStatus:sourceStatus.every(source=>source.status==='ok')?'published-source-window-checked':'partial',coverageBasis:'Published source calendars, not unpublished draws or every worldwide competition',competitions,events,participants:[...participants.values()],sources:sourceStatus};
  fs.writeFileSync(OUTPUT,JSON.stringify(document,null,2)+"\n");
  const failed=sourceStatus.filter(source=>source.status==='failed').length,partial=sourceStatus.filter(source=>source.status==='partial');
  console.log(`Coverage sources: ${events.length} known fixtures, ${participants.size} participant identities; ${failed} failed sources, ${partial.length} partial sources, ${partial.reduce((sum,source)=>sum+(source.coverage?.failures.length||0),0)} unresolved date/page gaps. Last-good fixtures retained.`);
  return document;
}
module.exports={refreshCoverage};
if(require.main===module)refreshCoverage().catch(error=>{console.error(error.message);process.exitCode=1;});
