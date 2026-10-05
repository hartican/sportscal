'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const keys=['sourceName','sourceUrl','sourceType','sourceCheckedAt'];
function validate(schedule){
 assert.equal(schedule.schemaVersion,'requested-sports-schedule.v1');assert.equal(schedule.seasonLabel,'2026');
 assert(Array.isArray(schedule.events)&&schedule.events.length,'Retained F1 sessions required');
 const index=new Map();
 for(const event of schedule.events){
  assert(!index.has(event.id),'Duplicate retained F1 session');
  const match=String(event.id).match(/^event:f1:2026:([a-z-]+):[a-z0-9-]+$/),source=schedule.sources?.[event.sourceId];
  assert(match&&event.sportKey==='f1'&&event.competitionId==='competition:formula-one','Invalid retained F1 identity');
  const url=`https://www.formula1.com/en/racing/2026/${match[1]}`;
  assert(event.sourceUrl===url&&source?.url===url&&source.type==='official'&&source.name,'Matching official F1 source required');
  const observed=Date.parse(event.sourceCheckedAt);
  assert(Number.isFinite(observed)&&new Date(observed).toISOString()===event.sourceCheckedAt&&observed<=Date.now(),'Original F1 source observation required');
  index.set(event.id,{event,source});
 }
 return index;
}
function projectSource(event,index){
 const matches=[...new Set([event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].filter(id=>index.has(id)))];
 assert(matches.length<=1,'Ambiguous F1 source identity');
 if(!matches.length||event.sourceUrl)return event;
 const row=index.get(matches[0]);
 // An older schedule cannot source a later reschedule, result or live state.
 if(!['upcoming','scheduled'].includes(event.status))return event;
 if(['name','date','time','startTimeUtc','endTimeUtc','sessionType','competitionId'].some(key=>event[key]!==row.event[key]))return event;
 return {...event,sourceName:row.source.name,sourceUrl:row.event.sourceUrl,sourceType:row.source.type,sourceCheckedAt:row.event.sourceCheckedAt};
}
function qualify(event,{schedule}={}){return projectSource(event,validate(schedule));}
function applyRetained({root:directory=root,schedule}={}){
 schedule=schedule||JSON.parse(fs.readFileSync(path.join(directory,'data/canonical/f1-sessions-2026.json')));const index=validate(schedule);
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(directory,file),before=fs.readFileSync(filename,'utf8'),document=JSON.parse(before);
  const ids=new Set();for(const event of document.events){assert(!ids.has(event.id),'Duplicate retained card identity');ids.add(event.id);}
  const events=document.events.map(event=>projectSource(event,index));
  return {file,filename,before,next:JSON.stringify({...document,events},null,2)+'\n',changed:events.filter((event,i)=>JSON.stringify(event)!==JSON.stringify(document.events[i])).map(event=>event.id)};
 });
 // Both documents and the complete source map validate before either write.
 for(const update of updates)if(update.changed.length)fs.writeFileSync(update.filename,update.next);
 return updates.map(({file,changed})=>({file,changed}));
}
if(require.main===module)try{console.log(JSON.stringify(applyRetained()));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={validate,qualify,applyRetained,keys};
