#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { peerResults } = require("../lib/nsc-peer-results");
const rows = [
  {user_id:"me",phase:"impact",rating:5},
  {user_id:"a",phase:"impact",rating:1,updated_at:"2026-09-04",tags:["Flat"]},
  {user_id:"a",phase:"impact",rating:3,updated_at:"2026-09-05",tags:["Close","Close"]},
  {user_id:"b",phase:"impact",rating:5,tags:["Close"]},
  {user_id:"demo",phase:"impact",rating:1,demo:true},
  {user_id:"c",phase:"heat",rating:1},
];
const result = peerResults(rows,{viewerId:"me",phase:"impact",detail:true});
assert.equal(result.count,2); assert.equal(result.average,4); assert.equal(result.early,true);
assert.deepEqual(result.tags,[{tag:"Close",count:2}]);
assert.deepEqual(result.comparison,{rating:5,difference:1,sameRatingCount:1});
assert.equal(JSON.stringify(result).includes('user_id'),false);
assert.equal(peerResults(rows,{viewerId:"me",phase:"impact"}).distribution,undefined);
assert.equal(peerResults([],{phase:"impact"}).average,null);
assert.equal(peerResults([rows[0]],{viewerId:"me",phase:"impact"}).count,0);
console.log("PASS real peer averages, latest unique vote, viewer/modelled exclusion, early/empty states and detail privacy");
