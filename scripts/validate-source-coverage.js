#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),{parseCricketPage,parseRugbyPage}=require("../lib/source-coverage");
const women=require("./fixtures/source-coverage/cricket-australia-asia-cup-women.json");
const matches=require("./fixtures/source-coverage/cricket-australia-matches.json");
const literal=payload=>JSON.stringify(payload).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
const cricket=sample=>parseCricketPage(`window.FIXTURES_DATA = JSON.parse('${literal(sample.FIXTURES_DATA)}')`,sample);
const events=cricket(women),bangladesh=events.find(event=>event.sourceFixtureId==="CA:40954");
assert.equal(bangladesh.date,"2026-09-09");assert.equal(bangladesh.time,"00:30");
assert.equal(bangladesh.competitionScope,"international");
assert(bangladesh.participantIds.includes("team:cricket:bangladesh-women"));
assert.equal(events.find(event=>event.sourceFixtureId==="CA:40960").participantIds.length,0,"TBC is a published fixture slot, not a real team");
assert(cricket(matches).some(event=>event.sourceFixtureId==="CA:40955"&&event.competitionScope==="international"));
for(const [id,expectedTime] of [["949461","01:10"],["949624","07:00"]]){
  const sample=require(`./fixtures/source-coverage/rugby-australia-${id}.json`);
  const html=`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{matchData:{getFixtureItem:sample.getFixtureItem}}}})}</script>`;
  const [event]=parseRugbyPage(html,sample);
  assert.equal(event.date,"2026-09-06");assert.equal(event.time,expectedTime);assert.equal(event.status,"completed");
  assert.equal(event.competitionScope,"international");
  if(id==="949624"){assert.equal(event.id,"rugby-argentina-australia-mendoza-2026-09-06");assert(event.participantIds.includes("team:rugby:wallabies"));}
}
assert.throws(()=>parseCricketPage("<html>Temporary upstream error</html>"));
assert.throws(()=>parseRugbyPage("<html>Temporary upstream error</html>"));
const abandoned=require('./fixtures/source-coverage/cricket-australia-abandoned.json');
const [abandonedFixture]=require('../lib/source-coverage').parseCricketFixtures([abandoned.fixture],abandoned);
assert.equal(abandonedFixture.status,'abandoned','provider completion is not evidence that an abandoned match was played');
const identity=require('../config/fixture-identity'),controls=require('../config/feed-controls'),timing=require('../config/card-timing');
const prior={...abandonedFixture,status:'completed',sourceCheckedAt:'2026-09-30T03:36:03.593Z'};
const [corrected]=identity.mergeOverlays([prior],[abandonedFixture]);
assert.equal(corrected.id,prior.id);assert.equal(corrected.status,'abandoned','a newer explicit abandonment corrects the prior classification');
assert.equal(corrected.scoreDisplay,prior.scoreDisplay);assert.equal(corrected.sourceCheckedAt,abandoned.checkedAt);
const staleLive={...abandonedFixture,status:'live',scoreDisplay:'20/0',sourceCheckedAt:'2026-10-02T02:00:00Z'};
assert.equal(identity.mergeOverlays([corrected],[staleLive])[0].status,'abandoned','a schedule/live overlay cannot reopen an abandoned match');
assert.equal(identity.mergeOverlays([prior],[{...abandonedFixture,sourceCheckedAt:'2026-09-29T00:00:00Z'}])[0].status,'completed','an older observation cannot adjudicate a final');
for(const instant of ['2026-09-28T04:00:00Z','2026-09-28T05:00:00Z','2026-09-28T09:01:00Z']){
 assert.equal(controls.timingState(corrected,new Date(instant)),null,'abandonment is never Starts Soon, Live or Just Finished');
 assert.equal(timing.presentation(corrected,instant).status,'ABANDONED');
 assert.match(timing.presentation(corrected,instant).ariaLabel,/ABANDONED.*Sydney time/);
}
for(const resultType of ['Win','Draw','Tie'])assert.equal(require('../lib/source-coverage').parseCricketFixtures([{...abandoned.fixture,resultType,resultTypeId:resultType}],abandoned)[0].status,'completed');
assert.equal(require('../lib/source-coverage').parseCricketFixtures([{...abandoned.fixture,isCompleted:false,isLive:true}],abandoned)[0].status,'live','unconfirmed result metadata is not abandonment evidence');
console.log("Source coverage: first-party samples, senior/women identities, TBC slots and exact Sydney dates passed.");
