#!/usr/bin/env node
"use strict";
// Fixed input/clock, isolated CPU measurements. Never calls a remote service.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const start = performance.now(), cpuStart = process.cpuUsage();
const context = require('../config/sport-context');
const { catalogue } = require('../lib/calendar-catalogue');
const resolver = require('../lib/follow-fixture-resolver');
const pipeline = require('../lib/server-feed-pipeline');
const bundle = context.mergeCanonicalBundles(...['afl-nrl','f1-context','wrc-context','tennis-context','cycling-context','nba-context','cwg-context'].map(name=>require(`../data/canonical/${name}-2026.json`)));
const events = context.applyContextToEvents(catalogue(), bundle);
const cold = {wallMs:performance.now()-start,cpuMs:Object.values(process.cpuUsage(cpuStart)).reduce((a,b)=>a+b,0)/1000,rssMiB:process.memoryUsage().rss/1048576};
const profiles = [
  {name:'empty',preferences:{}},
  {name:'mixed',preferences:{followedSports:['afl','nrl','formula-1'],preferenceGraph:{entityFollows:[{participantId:'team:afl:brisbane',followLevel:'follow'},{participantId:'team:nrl:brisbane-broncos',followLevel:'follow'}]}}},
  {name:'tennis-football',preferences:{preferenceGraph:{entityFollows:[{participantId:'team:premier-league:liverpool',followLevel:'follow'},{participantId:'competitor:tennis:atp:carlos-alcaraz',followLevel:'follow'}]}}},
];
const results=[];
for(const profile of profiles){
  for(const iso of ['2026-09-15T03:00:00Z','2026-10-03T15:59:59Z','2026-10-03T16:00:01Z']){
    const t=performance.now(),cpu=process.cpuUsage();
    const resolved=resolver.resolveUserFollowFixtures({events,userState:profile,copyEvents:false});
    const resolvedAt=performance.now();
    const participants=new Map(bundle.participants.map(p=>[p.id,p]));
    resolved.participants.forEach(p=>participants.set(p.id,{...participants.get(p.id),...p}));
    const feed=pipeline.buildServerFeed({events:resolved.events,userId:profile.name,userState:profile,participants:[...participants.values()],now:new Date(iso),sourceVersion:'benchmark-fixed',sourcePublishedAt:'2026-09-15T00:00:00Z',limit:20,copyEvents:false});
    const serialized=JSON.stringify(feed);
    results.push({profile:profile.name,iso,cpuMs:Object.values(process.cpuUsage(cpu)).reduce((a,b)=>a+b,0)/1000,wallMs:performance.now()-t,resolveMs:resolvedAt-t,composeMs:performance.now()-resolvedAt,sha256:crypto.createHash('sha256').update(serialized).digest('hex'),events:feed.pagination.total,bytes:Buffer.byteLength(serialized)});
  }
}
const report={schemaVersion:'hobby-feed-benchmark.v1',cold,results,rssMiB:process.memoryUsage().rss/1048576};
const output=process.argv[2];
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
