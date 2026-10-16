'use strict';
const fs=require('node:fs'),path=require('node:path');
const identity=require('../../config/fixture-identity');
const {storylineFor,spoilerSafeRootCopy}=require('./storyline-card-rules');
const ROOT=path.resolve(__dirname,'../..');
const aliases=event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].filter(Boolean).map(identity.canonicalFixtureId);
const text=value=>typeof value==='string'&&value.trim();
const meaning=value=>String(value).toLowerCase().replace(/\bwon\b/g,'win').replace(/[.\s]+/g,' ').trim();
function fail(id,message){throw Error(`Result reconciliation ${id}: ${message}`);}
function instant(value,now,id){if(!text(value)||!Number.isFinite(Date.parse(value))||Date.parse(value)>+now)fail(id,'invalid or future result observation');return value;}
function url(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function resultFor(fixture,now){
 const ca=fixture.key==='cricket'&&fixture.sourceType==='official'&&fixture.sourceName==='Cricket Australia';
 if(ca){
  let source;try{source=new URL(fixture.officialScorecardUrl||fixture.sourceUrl);}catch{}
  if(!source||!['www.cricket.com.au','apiv2.cricket.com.au'].includes(source.hostname)||!url(source.href))fail(fixture.id,'missing official Cricket result source');
  if(source.hostname==='www.cricket.com.au'&&!/^\/matches\/CA(?::|%3A)\d+(?:\/|$)/i.test(source.pathname)||source.hostname==='apiv2.cricket.com.au'&&!/^\/web\/(?:fixtures\/yearfilter|views\/scorecard)$/.test(source.pathname))fail(fixture.id,'unsupported official Cricket result source');
  if(!text(fixture.scoreDisplay))fail(fixture.id,'missing verified result text');
  instant(fixture.sourceCheckedAt,now,fixture.id);
  const observed=instant(fixture.scoreFactObservedAt||fixture.resultSourceCheckedAt||fixture.scoreCheckedAt||fixture.sourceCheckedAt,now,fixture.id);
  if(!Number.isFinite(Date.parse(fixture.startTimeUtc))||Date.parse(observed)<Date.parse(fixture.startTimeUtc))fail(fixture.id,'result observed before sporting start');
  return {score:fixture.scoreDisplay,outcomeText:fixture.scoreDisplay,recapText:`Cricket Australia reports: ${fixture.scoreDisplay.replace(/\.$/,'')}.`,resultSourceName:fixture.sourceName,resultSourceType:'official',resultSourceUrl:source.href,resultSourceCheckedAt:observed,scoreCheckedAt:observed,statusCheckedAt:instant(fixture.statusFactObservedAt||fixture.statusCheckedAt||observed,now,fixture.id)};
 }
 if(!/^official(?:-|$)/.test(fixture.resultSourceType||fixture.sourceType||''))return null;
 if(!['score','outcomeText','recapText'].every(key=>text(fixture[key]))||!url(fixture.resultSourceUrl))return null;
 const observed=instant(fixture.resultSourceCheckedAt,now,fixture.id);
 return Object.fromEntries(['score','outcomeText','recapText','resultSourceName','resultSourceType','resultSourceUrl'].filter(key=>fixture[key]!=null).map(key=>[key,fixture[key]]).concat([['resultSourceCheckedAt',observed],['scoreCheckedAt',observed],['statusCheckedAt',instant(fixture.statusCheckedAt||observed,now,fixture.id)]]));
}
function reconcile(events,fixtures,{aliasRecords=[],now=new Date()}={}){
 if(!Number.isFinite(+now))throw Error('Invalid result reconciliation time');
 // Recorded IDs establish equivalence. Participant/time checks validate an
 // established match; they never discover or admit one.
 const groups=new Map();
 for(const record of [...aliasRecords,...events,...fixtures]){
  const ids=aliases(record),group=new Set(ids.flatMap(id=>[...(groups.get(id)||[id])]));
  for(const id of group)groups.set(id,group);
 }
 const changed=[];
 const next=events.map(event=>{
  if(event.cardKind==='event'||event.cardType==='tournament_overview')return event;
  const ids=new Set(aliases(event).flatMap(id=>[...(groups.get(id)||[id])]));
  const matching=fixtures.filter(f=>f.status==='completed'&&aliases(f).some(id=>ids.has(id)));
  if(!matching.length)return event;
  const complete=event.status==='completed'&&['score','outcomeText','recapText','sourceName','sourceUrl','sourceCheckedAt'].every(key=>Boolean(event[key]));
  // Existing other-sport owners retain their specialised score formats.
  const supported=matching.filter(f=>f.key==='cricket'||!complete).map(f=>({fixture:f,result:resultFor(f,now)})).filter(row=>row.result);
  if(!supported.length){if(!complete&&event.key==='cricket')fail(event.id,'matched final lacks supported official evidence');return event;}
  for(const {fixture,result}of supported){
   const participants=f=>(f.participantIds||[]).map(identity.canonicalParticipantId).sort();
   if(participants(event).length<2||JSON.stringify(participants(event))!==JSON.stringify(participants(fixture))||!Number.isFinite(Date.parse(event.startTimeUtc))||Date.parse(event.startTimeUtc)!==Date.parse(fixture.startTimeUtc))fail(event.id,'recorded alias conflicts with participants or start');
   if(meaning(result.score)!==meaning(supported[0].result.score))fail(event.id,'conflicting verified final results');
   if(complete&&meaning(event.score)!==meaning(result.score))fail(event.id,'verified final conflicts with retained result');
  }
  if(complete)return event;
  const {fixture,result}=supported[0];
  if(fixture.firstConfirmedCompleteAt)instant(fixture.firstConfirmedCompleteAt,now,fixture.id);
  const updated={...event,...result,status:'completed',resultStatus:'official',resultPublishedAt:event.resultPublishedAt||fixture.firstConfirmedCompleteAt||result.resultSourceCheckedAt};
  updated.storyline=storylineFor(updated,now);const safe=spoilerSafeRootCopy(updated,updated.storyline);updated.selectedSentence=safe.hook;updated.fullSpiel=safe.synopsis;
  delete updated.editorialPreview;
  if(updated.editorialNarrative)updated.editorialNarrative={...updated.editorialNarrative,phase:'recap',resultResearchRequired:true};
  changed.push(event.id);return updated;
 });
 return {events:next,changed};
}
function reconcileFiles({root=ROOT,fixtures,aliasRecords,now=new Date()}={}){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 fixtures ||= read('data/follow-sources/coverage.v1.json').events;
 if(!aliasRecords){const directory=path.join(root,'data/code-inspector');aliasRecords=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).flatMap(name=>read('data/code-inspector/'+name).fixtures||[]);}
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(root,file),before=fs.readFileSync(filename),document=JSON.parse(before),result=reconcile(document.events,fixtures,{aliasRecords,now});
  return {filename,before,result,document};
 });
 try{for(const update of updates)if(update.result.changed.length)fs.writeFileSync(update.filename,JSON.stringify({...update.document,events:update.result.events},null,2)+'\n');}
 catch(error){for(const update of updates)fs.writeFileSync(update.filename,update.before);throw error;}
 return {changed:[...new Set(updates.flatMap(update=>update.result.changed))],surfaces:updates.filter(update=>update.result.changed.length).map(update=>path.relative(root,update.filename))};
}
module.exports={reconcile,reconcileFiles};
