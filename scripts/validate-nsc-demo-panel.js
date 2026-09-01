#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const demo = require("../api/_nsc-modelled-panel");
const nsc = require("../config/nothingscore");
const server = require("../lib/nothingscore-server");
const { safeSignal, validateSnapshot } = require("./snapshot-editorial-nothingscore");
const feed = require("../data/events.json");
const majorEvents = require("../data/major-events.v1.json");
const footballCore = require("../data/football/core-events.json");

const now = new Date("2026-09-13T06:30:00.000Z");
const event = { canonicalEventId:"demo-australia-grand-final", sport:"AFL", competition:"AFL", name:"Australia Grand Final", stakesScore:5, startTimeUtc:"2026-09-13T06:00:00.000Z" };
assert.equal(demo.SCHEMA_VERSION,"nsc-modelled-panel.v2");
assert.equal(demo.PERSONAS.length,6,"the six behavioural personas remain an internal deterministic panel");
assert(demo.PERSONAS.every(persona=>/^cohort-0[1-6]$/.test(persona.id)&&!Object.hasOwn(persona,"displayName")&&!Object.hasOwn(persona,"handle")),"the private panel definition must not retain fictional public identities");
assert.equal(demo.enabled(undefined),false,"missing configuration must be off");
assert.equal(demo.enabled("off"),false);
assert.equal(demo.enabled("internal"),false,"internal cohorts must not leak to public requests");
assert.equal(demo.enabled("internal",{internal:true}),true);
assert.equal(demo.enabled("public"),true);

const heatA=demo.demoRows(event,"heat",now,{mode:"public"}),heatB=demo.demoRows(event,"heat",now,{mode:"public"});
assert.deepEqual(heatA,heatB,"pinned time and event/persona hash must be deterministic");
assert(heatA.length>0);
assert(heatA.every(row=>row.modelled===true&&row.demo===true&&row.persona==="general"&&row.userId.startsWith("modelled:")&&row.audienceCohort),"modelled cohorts must carry ordinary weight and temporary wire compatibility metadata");
assert(heatA.every(row=>!Object.hasOwn(row,"displayName")&&!Object.hasOwn(row,"handle")),"modelled identities must never enter a public snapshot row");
assert(heatA.every(row=>nsc.personaWeight(row.persona)===1),"modelled contributors must never inherit authority weights");
assert.equal(demo.demoRows(event,"heat",now,{mode:"off"}).length,0);
const outlierCorpus=Array.from({length:500},(_,index)=>({canonicalEventId:`outlier-${index}`,sport:index%2?"AFL":"Tennis",name:`Fixture ${index}`,stakesScore:index%5+1}));
const outlierRate=outlierCorpus.flatMap(fixture=>demo.PERSONAS.map(persona=>demo.outlierFor(persona,fixture,"heat"))).filter(Boolean).length/(outlierCorpus.length*demo.PERSONAS.length);
assert(outlierRate>=.07&&outlierRate<=.09,`stable mild outliers should be approximately 8%, received ${(outlierRate*100).toFixed(2)}%`);
assert.deepEqual(server.largestRemainderPercentages([4,1,1]),[67,17,16],"largest-remainder ties must follow the displayed high, middle, low order");
assert.equal(server.largestRemainderPercentages([4,1,1]).reduce((total,value)=>total+value,0),100);
assert.deepEqual(server.largestRemainderPercentages([0,0,0]),[0,0,0]);
const connie=demo.PERSONAS.find(item=>item.id==="cohort-03"),parker=demo.PERSONAS.find(item=>item.id==="cohort-06");
assert.equal(demo.participates(connie,{canonicalEventId:"football-final",sport:"Football",name:"Global final",stakesScore:5}),false,"the AFL/NRL completist must not pad unrelated sports");
assert.equal(demo.participates(parker,{canonicalEventId:"afl-final",sport:"AFL",name:"Grand Final",stakesScore:5}),false,"the athlete-first cohort must stay within tennis, motorsport and surfing");

const pulse=demo.demoRows(event,"pulse",now,{mode:"public"});
assert(pulse.length>heatA.length,"Pulse must provide deterministic five-minute contributions");
assert(pulse.every(row=>Date.parse(row.bucketStart)%nsc.PULSE_BUCKET_MS===0));
const timeline=server.pulseSeries([],pulse);
assert(timeline.length>=2&&timeline.every(row=>Object.hasOwn(row,"realContributors")&&Object.hasOwn(row,"modelledContributors")&&Object.hasOwn(row,"demoContributors")&&Object.hasOwn(row,"modelledScore")));

const twoReal=[1,2].map(number=>({userId:`real-${number}`,rating:4,tags:["Big stakes"],persona:"general"}));
const threeReal=[...twoReal,{userId:"real-3",rating:5,tags:["Big stakes"],persona:"general"}];
const demoAggregate=nsc.aggregateRatings([...twoReal,...heatA]);
const demoCopy=server.crowdEditorial("heat",twoReal,heatA,nsc.aggregateRatings(twoReal),demoAggregate,[],{includesModelled:true});
assert.equal(demoCopy.mode,"demo");
assert.equal(demoCopy.presentationMode,"early");
assert.equal(demoCopy.label,"Early panel");
assert.equal(demoCopy.contributorMix.real,2);
assert.equal(demoCopy.contributorMix.demo,heatA.length);
assert.equal(demoCopy.contributorMix.modelled,heatA.length);
assert.equal(Object.values(demoCopy.percentages).reduce((total,value)=>total+value,0),100,"the three compact bands must total 100%");
assert.match(demoCopy.text,/^\d+% Major or Essential · \d+% Notable · \d+% Routine or Interesting, from \d+ contributors\./);
assert.match(demoCopy.editorialSentence,/^Early panel: \d+% rate it Major or Essential across \d+ displayed responses\./);
const stillEarlyCopy=server.crowdEditorial("heat",threeReal,heatA,nsc.aggregateRatings(threeReal),nsc.aggregateRatings([...threeReal,...heatA]),[],{includesModelled:true});
assert.equal(stillEarlyCopy.presentationMode,"early","the public Early panel must remain mixed even after three genuine contributors");
assert.equal(stillEarlyCopy.contributorCount,threeReal.length+heatA.length);
const realCopy=server.crowdEditorial("heat",threeReal,[],nsc.aggregateRatings(threeReal),nsc.aggregateRatings(threeReal),[],{includesModelled:false});
assert.equal(realCopy.mode,"real","three genuine contributors must promote real-only crowd editorial");
assert.equal(realCopy.presentationMode,"real");
assert.equal(realCopy.contributorCount,3,"modelled cohorts must not enter the real promotion count");
assert.match(realCopy.editorialSentence,/^Community response:/);
assert(!realCopy.text.includes("Australia")&&!realCopy.text.includes("Grand Final"),"crowd prose must not invent or repeat match facts");
assert.equal(server.crowdEditorial("heat",twoReal,[],nsc.aggregateRatings(twoReal),nsc.aggregateRatings(twoReal),[],{includesModelled:false}),null,"retired aggregates require three genuine current-phase contributors");

const formulaRows=[
  {userId:"formula-1",rating:5,tags:["Rivalry","Big stakes"],updatedAt:"2026-09-01T00:00:00Z"},
  {userId:"formula-2",rating:5,tags:["Rivalry","Big stakes"]},
  {userId:"formula-3",rating:4,tags:["Rivalry"]},
  {userId:"formula-4",rating:4,tags:[]},
  {userId:"formula-5",rating:3,tags:[]},
  {userId:"formula-6",rating:2,tags:[]},
  {userId:"formula-1",rating:1,tags:["Box office"],updatedAt:"2026-08-31T00:00:00Z"},
];
const formulaAggregate=nsc.aggregateRatings(formulaRows);
const formulaCopy=server.crowdEditorial("heat",formulaRows,[],formulaAggregate,formulaAggregate,[],{includesModelled:false});
assert.equal(formulaCopy.text,"67% Major or Essential · 17% Notable · 16% Routine or Interesting, from 6 contributors. Rivalry leads at 50%; Big stakes follows at 33%.","compact crowd copy must use the fixed deterministic percentage template and unique-contributor denominator");
assert.deepEqual(formulaCopy.leadingTags,[{tag:"Rivalry",count:3,percentage:50},{tag:"Big stakes",count:2,percentage:33}]);
const distribution=server.distribution(threeReal,heatA,[...threeReal,...heatA]);
assert.equal(distribution.reduce((total,row)=>total+row.displayPercent,0),100);
assert(distribution.every(row=>["rating","realCount","modelledCount","demoCount","realPercent","modelledPercent","demoPercent","displayPercent"].every(key=>Object.hasOwn(row,key))));

const boundaryNow=new Date("2026-08-31T00:00:00.000Z"),boundary=new Date("2026-06-02T00:00:00.000Z").toISOString();
const activeContributions=[
  {user_id:"one",phase:"heat",rating:4,submitted_at:boundary,updated_at:boundary},
  {user_id:"one",phase:"impact",rating:5,submitted_at:"2026-08-01T00:00:00.000Z",updated_at:"2026-08-01T00:00:00.000Z"},
  {user_id:"two",phase:"pulse",rating:3,submitted_at:null,updated_at:"2026-08-30T00:00:00.000Z"},
  {user_id:"three",phase:"heat",rating:3,submitted_at:"2026-08-30T00:00:00.000Z",updated_at:"2026-08-30T00:00:00.000Z"},
  {user_id:"four",phase:"heat",rating:5,submitted_at:"2026-06-01T23:59:59.999Z",updated_at:"2026-06-01T23:59:59.999Z"},
];
const approvedPilots=[
  {user_id:"one",approved:true,suspended:false},{user_id:"two",approved:true,suspended:false},
  {user_id:"three",approved:true,suspended:true},{user_id:"four",approved:true,suspended:false},
];
assert.equal(server.activeRealContributors90d(activeContributions,approvedPilots,boundaryNow),2,"90-day counting must include the exact boundary, deduplicate accounts and exclude suspended accounts");

const timedLegacy=server.eventWithTiming({date:"2026-08-19",time:"20:00",liveWindow:3});
assert.equal(timedLegacy.startTimeUtc,"2026-08-19T10:00:00.000Z","legacy Sydney fixture clocks must enter the correct NSC phase");
assert.equal(nsc.phaseFor(server.eventTiming(timedLegacy),new Date("2026-08-19T09:59:59.000Z")),"heat");
assert.equal(nsc.phaseFor({
  ...server.eventTiming(timedLegacy),
  session:{status:"active",effectiveStartAt:timedLegacy.startTimeUtc,effectiveEndAt:timedLegacy.endTimeUtc},
},new Date("2026-08-19T10:30:00.000Z")),"pulse");
assert.equal(nsc.phaseFor(server.eventTiming(timedLegacy),new Date("2026-08-19T13:00:00.000Z")),"impact");

const majorParent=majorEvents.events.find(record=>record.kind!=="ticket_sale"&&record.subEvents?.length);
const ticketAlert=majorEvents.events.find(record=>record.kind==="ticket_sale");
assert(server.eventFor(majorParent.id),"major Events parents must be registered for crowd snapshots");
assert(server.eventFor(majorParent.subEvents[0].id),"unmatched Events children must be registered under their stable IDs");
assert.equal(server.eventFor(ticketAlert.id),null,"ticket-sale alerts must never enter Nothingscore");
const tbcChild=server.eventFor("major-match:nrl-finals-2026:qualifying-final-1");
assert(tbcChild,"TBC Events children must remain eligible for crowd context");
assert.deepEqual(server.snapshotTiming(tbcChild),{startTimeUtc:null,endTimeUtc:null},"a TBC child must not invalidate its whole Events snapshot batch");
const legacyFeed=feed.events.find(record=>record.date&&record.time&&!record.startTimeUtc);
assert(server.eventFor(legacyFeed.id)?.startTimeUtc,"legacy Feed fixtures must be normalised before phase selection");
const lazyFootball=footballCore.events.find(record=>!feed.events.some(event=>event.id===record.id));
assert(server.eventFor(lazyFootball.canonicalEventId),"lazy football cards must be registered under the same canonical ID the reader requests");

const snapshot={canonicalEventId:event.canonicalEventId,phase:"impact",aggregates:{heat:nsc.aggregateRatings(threeReal),pulse:null,impact:{...nsc.aggregateRatings(threeReal),contributorMix:{real:3,demo:6,total:9}}},contributors:heatA,crowdEditorial:demoCopy};
const safe=safeSignal(snapshot,now.toISOString());
const document={schemaVersion:"editorial-nothingscore-snapshot.v1",capturedAt:now.toISOString(),source:"test",signals:[safe]};
assert.deepEqual(validateSnapshot(document),[]);
assert.equal(JSON.stringify(safe).includes("demo:"),false,"editorial memory must contain no demo or real identity");
assert.equal(safe.impact.uniqueContributorCount,3,"privacy-safe audience memory must retain the real aggregate only");

const html=fs.readFileSync("index.html","utf8"),serverSource=fs.readFileSync("lib/nothingscore-server.js","utf8"),demoSource=fs.readFileSync("api/_nsc-modelled-panel.js","utf8"),visualSource=fs.readFileSync("config/nsc-visual.js","utf8");
assert.equal(fs.existsSync("config/nsc-demo-panel.js"),false,"modelled panel definitions must not remain in the public config directory");
assert.equal(fs.existsSync("lib/nsc-modelled-panel.js"),false,"modelled panel definitions must not remain in the public static library directory");
assert(fs.existsSync("api/_nsc-modelled-panel.js"),"the model must use Vercel's underscore-prefixed private API utility convention");
assert.match(serverSource,/Early panel · includes modelled responses\./);
assert.doesNotMatch(html,/Independent context/);
assert.doesNotMatch(html,/nsc-demo-badge|>Demo</,"modelled personas must never appear as named public contributors");
assert.match(html,/dataset\.modelledExposure/);
assert.match(html,/loadDeferredScript\("config\/nsc-visual\.js\?v=216"\)/,"the graph renderer must stay off the critical startup path");
assert.match(visualSource,/createElementNS\("http:\/\/www\.w3\.org\/2000\/svg"/);
assert.match(visualSource,/Accessible data for/);
assert.match(visualSource,/Community responses/);
assert.match(visualSource,/Modelled responses/);
assert.match(html,/How do you think it’ll go\?/);
assert.doesNotMatch(html,/name:"Anticipation"|>Anticipation</,"the public reader must use the agreed pre-fixture wording");
assert.match(html,/function openSportRoundSummary[\s\S]*openCodeInspector/);
assert.doesNotMatch(html,/function openSportRoundSummary[\s\S]{0,600}setActiveFeedFilter/,"round summaries must not turn Feed into a one-sport view");
assert.doesNotMatch(demoSource,/supabase|auth|telemetry|awardPoints/i,"demo definitions must not write identities, telemetry or progression");
assert.match(demoSource,/persona:"general", modelled:true, demo:true/);

console.log(`Demo crowd validation passed: ${demo.PERSONAS.length} cohorts, deterministic ${heatA.length} pre-fixture contributors and ${timeline.length} Pulse buckets.`);
