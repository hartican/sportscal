#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const follow=require("../config/follow-first");
const social=require("../lib/nsc-social");
const f1=require("../data/canonical/f1-sessions-2026.json");
const nbl=require("../data/canonical/nbl-2026-27.json");
const nblDirectory=require("../data/canonical/nbl-directory.v1.json");

const interUdinese={
  eventId:"fixture:serie-a:inter-udinese:2026-09-15",
  key:"football",
  sportDomainId:"sport:football",
  competitionId:"competition:serie-a",
  cardKind:"fixture",
  participantIds:["team:football:inter-milan","team:football:udinese"],
};
const broadFootball=follow.migratePreferences({
  followedSports:["football"],
  selectedSelectorEntityIds:["sport:football"],
});
assert.equal(follow.reasonForEvent(interUdinese,broadFootball),null,"a broad football follow must not admit Inter v Udinese");
const interFollow=follow.migratePreferences({
  preferenceGraph:{entityFollows:[{participantId:"team:football:inter-milan",followLevel:"follow"}]},
});
assert.equal(follow.reasonForEvent(interUdinese,interFollow)?.entityKind,"team","an explicit Inter follow admits the fixture");

assert.equal(nbl.events.length,165,"the official NBL27 regular season must publish all 165 games");
assert(nbl.events.every(event=>event.participantIds?.length===2&&event.startTimeUtc),"every NBL game needs teams and a scheduled start");
assert((nblDirectory.teams||[]).length>=10,"the NBL directory needs its team list");
assert((nblDirectory.players||[]).length>0,"the NBL directory needs players separately from teams");

assert.equal(f1.events.length,50,"the current official F1 race pages must publish all 50 future sessions");
const sessionTypes=new Set(f1.events.map(event=>event.sessionType));
assert([...sessionTypes].some(type=>/^Practice/i.test(type)),"F1 practices must be published");
assert([...sessionTypes].some(type=>/Qualifying/i.test(type)),"F1 qualifying sessions must be published");
assert(sessionTypes.has("Race"),"F1 races must be published");

const events=new Map([
  ["f1-a",{key:"f1"}],
  ["f1-b",{key:"f1"}],
  ["nbl-a",{key:"basketball",codeId:"sport:nbl"}],
]);
const affinity=social.ratingAffinityFromRows([
  {event_id:"f1-a",phase:"heat",updated_at:"2026-09-15T10:00:00Z"},
  {event_id:"f1-a",phase:"heat",updated_at:"2026-09-15T11:00:00Z"},
  {event_id:"f1-a",phase:"pulse",updated_at:"2026-09-15T12:00:00Z"},
  {event_id:"f1-b",phase:"impact",updated_at:"2026-09-14T10:00:00Z"},
  {event_id:"nbl-a",phase:"heat",updated_at:"2026-09-15T13:00:00Z"},
],id=>events.get(id));
assert.deepEqual(affinity.map(item=>[item.sportId,item.count]),[["sport:motorsport",3],["sport:nbl",1]],"grid ranking counts each fixture phase once and rolls F1 into Motorsport");

const html=fs.readFileSync("index.html","utf8");
assert(html.includes("rankedFollowGridSports")&&html.includes(".slice(0,7)"),"Follow must rank no more than seven followed sports");
assert(html.includes('sportKey === "nbl" ? "team"'),"NBL defaults to its separate Teams view");
const ui=fs.readFileSync("assets/js/nsc-rankings-ui.js","utf8");
assert(ui.includes("Players & athletes")&&ui.includes("Teams")&&ui.includes("Pick type"),"copy-follows must drill into teams and athletes");
const migration=fs.readFileSync("supabase/migrations/20260916054309_rating_affinity_index.sql","utf8");
assert(migration.includes("user_id,updated_at desc")&&migration.includes("event_id,phase"),"the bounded affinity query needs its user/time index");

console.log("Adaptive Follow grid, strict football admission, F1 sessions, NBL schedule and entity drill-downs passed.");
