"use strict";
const official=require("../data/follow-sources/official.v1.json");
const identity=require("../config/fixture-identity");

function project(event){
  const fixture=identity.normalizeCore(event);
  // Use the existing Feed projection of a published UTC start, while keeping
  // explicit source uncertainty blocked instead of granting exact-time actions.
  if(event.timeTbc===true||event.startTimeTbc===true||event.dateOnly===true||event.timingVerified===false)fixture.timePrecision="unknown";
  return fixture;
}
function fixtures(){return (official.events||[]).map(project);}
module.exports={fixtures,project};
