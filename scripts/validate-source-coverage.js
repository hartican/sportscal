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
console.log("Source coverage: first-party samples, senior/women identities, TBC slots and exact Sydney dates passed.");
