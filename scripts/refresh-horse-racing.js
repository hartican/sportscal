"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const policy=require('../config/horse-coverage');
async function refresh({root=path.resolve(__dirname,'..')}={}){
 const review=JSON.parse(fs.readFileSync(path.join(root,'feeds/provider-exports/horse-racing/marquee-calendar.v1.json')));
 assert(review.schemaVersion==='horse-features-reviewed-calendar.v1'&&review.entries.every(policy.isCup)&&new Set(review.entries.map(e=>e.id)).size===review.entries.length,'Only individually reviewed Melbourne Cup editions are permitted');
 const events=review.entries.filter(e=>e.date).map(e=>{
  assert(/^20\d\d-\d\d-\d\d$/.test(e.date)&&/^https:\/\//.test(e.sourceUrl),'Verified edition date required');
  return policy.project({...e,sportKey:'horse-racing',eventFamilyId:'melbourne-cup',parentEventId:'melbourne-cup-carnival',weekendId:'carnival:melbourne-cup-carnival:'+e.date.slice(0,4),season:e.date.slice(0,4),sourceId:e.id,sourceName:'Official race organiser calendar',sourceType:'official',sourceCheckedAt:review.checkedAt,venue:e.meeting,venueCountryCode:'AU',dateOnly:!e.startTimeUtc,timeTbc:!e.startTimeUtc,calendarProvenance:{sourceUrl:e.sourceUrl,checkedAt:review.checkedAt}});
 });
 const sources=Object.fromEntries(events.map(e=>[e.id,{name:'Official race organiser calendar',url:e.sourceUrl,type:'official',checkedAt:review.checkedAt}]));
 const coverage={checkedAt:review.checkedAt,featureCount:events.length,publishedDateCount:events.length,policy:'melbourne-cup-basics-only',failures:[]};
 fs.writeFileSync(path.join(root,'data/canonical/horse-features.v1.json'),JSON.stringify({schemaVersion:'horse-features.v1',sources,participants:[],events,pending:[],coverage},null,2)+'\n');
 return coverage;
}
module.exports={refresh};
