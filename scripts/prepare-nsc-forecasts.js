#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),server=require('../lib/nothingscore-server'),crowd=require('../lib/nsc-crowd');
const {allRows}=require('../lib/nsc-rankings');
async function main(){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY&&!process.env.SUPABASE_SECRET_KEY){console.log('Forecast training skipped: no source credentials; retaining prior forecasts.');return;}
 const now=new Date(),rows=await allRows(server.TABLES.contributions,{phase:'eq.impact',select:'event_id,user_id,rating,phase,updated_at'}),grouped=new Map();
 for(const row of rows){if(!grouped.has(row.event_id))grouped.set(row.event_id,[]);grouped.get(row.event_id).push(row);}
 const bySport=new Map();
 for(const [id,votes] of grouped){const event=server.eventFor(id);if(!event||Date.parse(event.endTimeUtc)>=+now)continue;const verdict=crowd.summary(votes,{phase:'impact',now});if(verdict.count<5)continue;const key=event.key||event.sportDomainId;if(!bySport.has(key))bySport.set(key,[]);bySport.get(key).push(verdict.rawAverage);}
 const previous=JSON.parse(fs.readFileSync('data/nsc-forecasts.json','utf8')),fixtures={...previous.fixtures};
 for(const event of new Set(server.eventMap().values())){
 const id=server.canonicalEventId(event.eventId||event.id),samples=bySport.get(event.key||event.sportDomainId)||[];
 if(Date.parse(event.startTimeUtc)<=+now||samples.length<5)continue;
 fixtures[id]={rating:samples.reduce((a,b)=>a+b,0)/samples.length,version:'historical-sport-mean.v1',generatedAt:now.toISOString(),trainingFixtures:samples.length};
 }
 fs.writeFileSync('data/nsc-forecasts.json',JSON.stringify({schemaVersion:'nsc-forecasts.v1',model:'historical-sport-mean.v1',fixtures},null,2)+'\n');
 console.log(`Prepared ${Object.keys(fixtures).length} source-backed enjoyment forecasts; no stakes substitution.`);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
