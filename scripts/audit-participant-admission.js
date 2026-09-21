#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const policy=require('../config/follow-feed-policy');
const follow=require('../config/follow-first');
const identity=require('../config/fixture-identity');
const {catalogue}=require('../lib/calendar-catalogue');
const {buildServerFeed,normalizeEvent}=require('../lib/server-feed-pipeline');
const now=new Date('2026-09-22T00:00:00Z');
const report={asOf:now.toISOString(),scope:'Published source catalogue within active retention; independent participant follows, before and after opponent unfollow. No source completeness claim.',sports:{},failures:[],skipped:{nonFixture:0,outsideTimeline:0,noParticipants:0,practice:0}};
for(const sourceEvent of catalogue()){
 const event=normalizeEvent(sourceEvent,now);
 if(!policy.sportingFixture(event)){report.skipped.nonFixture++;continue;}
 if(!policy.feedEligibleSession(event)){report.skipped.practice++;continue;}
 if(!identity.retainedInActiveTimeline(event,now)){report.skipped.outsideTimeline++;continue;}
 const ids=policy.participantIds(event).filter(id=>! /^(?:winner|loser|tbc|tbd|placeholder|slot):/i.test(id));
 if(!ids.length){report.skipped.noParticipants++;continue;}
 const sport=policy.sportKey(event),row=report.sports[sport] ||= {fixtures:0,participantCases:0,baselineMissing:0,opponentUnfollowMissing:0,policyMismatch:0};row.fixtures++;
 for(const id of ids){
  row.participantCases++;
  for(const opponentUnfollow of [false,true]){
   const preferences={preferenceGraph:{entityFollows:ids.filter(x=>x===id||opponentUnfollow).map(participantId=>({participantId,followLevel:participantId===id?'follow':'mute'}))}};
   const server=buildServerFeed({events:[event],userId:'audit',userState:{preferences},now}).events.length>0;
   const shared=Boolean(follow.reasonForEvent(event,preferences));
   if(!server){row[opponentUnfollow?'opponentUnfollowMissing':'baselineMissing']++;report.failures.push({sport,id:event.id,participant:id,opponentUnfollow,server,shared});}
   if(server!==shared)row.policyMismatch++;
  }
 }
}
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,failures:report.failures.slice(0,8)},null,2));
if(process.argv.includes('--check')&&report.failures.length)process.exitCode=1;
