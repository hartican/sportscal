#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {discover}=require('../lib/autonomous-discovery');
const url='https://www.nuerburgring-langstrecken-serie.de/language/en/entry-list';
const athlete={id:'competitor:f1:george-russell',displayName:'George Russell',sportKey:'f1',countryCode:'GB'};
const fixture={id:'fixture:nls:2026:8',name:'NLS Round 8',key:'motorsport',date:'2026-09-12',competitionId:'competition:nls-2026',competitionName:'NLS'};
const candidate={participantId:athlete.id,eventId:fixture.id,newFixture:null,matchedName:athlete.displayName,participationStatus:'confirmed',participationKind:'race',evidence:[{url,publishedAt:'2026-09-08',eventDate:fixture.date,eventName:fixture.name,publisherGroup:'nls'}]};
async function main(){
 const calls=[];
 const fetchImpl=async(input,options)=>{
  calls.push({input,options});
  if(input==='https://api.openai.com/v1/responses')return {ok:true,json:async()=>({status:'completed',output:[{type:'web_search_call',action:{sources:[{url}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({participations:[candidate],consensus:[]})}]}]})};
  assert.equal(input,url);return new Response('<article>NLS Round 8 entry list for 12 September 2026. George Russell will race at NLS Round 8.</article>',{headers:{'content-type':'text/html'}});
 };
 const result=await discover({mode:'athletes',athletes:[athlete],fixtures:[fixture],fetchImpl,environment:{OPENAI_API_KEY:'test-only'},now:new Date('2026-09-08')});
 assert.equal(result.length,1);assert.equal(result[0].participationEvidence[0].participantId,athlete.id);
 assert.equal(result.coverage.accepted,1);assert.equal(result.coverage.status,'checked');
 const body=JSON.parse(calls[0].options.body);assert.equal(body.store,false);assert(body.max_tool_calls<=4);assert(!calls[0].options.body.includes('user_id'));
 assert(!JSON.stringify(result).includes('<article>'),'source bodies must never be persisted');
 await assert.rejects(discover({mode:'athletes',athletes:[athlete],fixtures:[fixture],environment:{},fetchImpl}),error=>error.code==='ai_not_configured');
 console.log('Autonomous discovery: real protocol seam, verified entry, bounded search, no article persistence and missing-key failure passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
