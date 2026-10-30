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
const typedOfficialResult=f=>['score','outcomeText','recapText'].every(key=>text(f[key]))&&url(f.resultSourceUrl);
const rawRugbyResult=f=>identity.sportKey(f)==='rugby'&&!typedOfficialResult(f);
function resultObservations(fixture,now){
 const score=Object.hasOwn(fixture,'scoreFactObservedAt')?fixture.scoreFactObservedAt:Object.hasOwn(fixture,'scoreCheckedAt')?fixture.scoreCheckedAt:fixture.resultSourceCheckedAt;
 const status=Object.hasOwn(fixture,'statusFactObservedAt')?fixture.statusFactObservedAt:fixture.statusCheckedAt;
 const result=Object.hasOwn(fixture,'resultSourceCheckedAt')?fixture.resultSourceCheckedAt:score;
 const start=Date.parse(fixture.startTimeUtc),valid=value=>text(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)>=start&&Date.parse(value)<=+now;
 const checked=Date.parse(fixture.sourceCheckedAt||fixture.canonicalSourceCheckedAt);
 if(!Number.isFinite(start)||![score,status,result].every(valid)||fixture.firstConfirmedCompleteAt!=null&&!valid(fixture.firstConfirmedCompleteAt)||!Number.isFinite(checked)||checked>+now+5*60000)return null;
 return {score,status,result};
}
function rugbyResult(fixture,now){
 const unavailable=reason=>({unavailable:reason});
 let source;try{source=new URL(fixture.sourceUrl);}catch{}
 const provider=fixture.sourceFixtureId;
 if(fixture.sourceName!=='World Rugby'||fixture.sourceType!=='official'||!source||!url(source.href)||source.hostname!=='api.wr-rims-prod.pulselive.com'||source.port||source.pathname!=='/rugby/v3/match'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(provider||'')||identity.canonicalFixtureId('fixture:rugby:wr:'+provider)!==identity.canonicalFixtureId(fixture.id))return unavailable('Unverified World Rugby source or provider identity');
 if(fixture.status!=='completed'||fixture.sourceStatus!=='C')return unavailable('World Rugby terminal completion unconfirmed');
 const sides=[fixture.homeParticipantId,fixture.awayParticipantId].map(identity.canonicalParticipantId),participants=(fixture.participantIds||[]).map(identity.canonicalParticipantId);
 if(sides.some(id=>!id)||new Set(sides).size!==2||JSON.stringify(sides)!==JSON.stringify(participants))return unavailable('World Rugby ordered sides unresolved');
 if(![fixture.homeScore,fixture.awayScore].every(score=>Number.isSafeInteger(score)&&score>=0))return unavailable('World Rugby numeric score incomplete');
 const score=`${fixture.homeScore}–${fixture.awayScore}`;
 if(fixture.scoreDisplay!=null&&fixture.scoreDisplay!==score||fixture.score!=null&&fixture.score!==score)return unavailable('World Rugby score display conflicts with numeric sides');
 const observed=resultObservations(fixture,now);
 if(!observed)return unavailable('World Rugby original result/status observations incomplete');
 return {score,homeScore:fixture.homeScore,awayScore:fixture.awayScore,outcomeText:score,recapText:`World Rugby reports: ${score}.`,resultSourceName:'World Rugby',resultSourceType:'official',resultSourceUrl:source.href,resultSourceCheckedAt:observed.result,scoreCheckedAt:observed.score,statusCheckedAt:observed.status};
}
function resultFor(fixture,now,{strictSourceEvidence=false}={}){
 if(strictSourceEvidence&&rawRugbyResult(fixture))return rugbyResult(fixture,now);
 const ca=fixture.key==='cricket'&&fixture.sourceType==='official'&&fixture.sourceName==='Cricket Australia';
 if(ca){
  const reject=message=>{if(strictSourceEvidence)return {unavailable:message};fail(fixture.id,message);};
  let source;try{source=new URL(fixture.officialScorecardUrl||fixture.sourceUrl);}catch{}
  if(!source||!['www.cricket.com.au','apiv2.cricket.com.au'].includes(source.hostname)||!url(source.href))return reject('missing official Cricket result source');
  if(source.hostname==='www.cricket.com.au'&&!/^\/matches\/CA(?::|%3A)\d+(?:\/|$)/i.test(source.pathname)||source.hostname==='apiv2.cricket.com.au'&&!/^\/web\/(?:fixtures\/yearfilter|views\/scorecard)$/.test(source.pathname))return reject('unsupported official Cricket result source');
  if(!text(fixture.scoreDisplay))return reject('missing verified result text');
  if(strictSourceEvidence){
   const observed=resultObservations(fixture,now);
   if(!observed)return reject('Cricket original result/status observations incomplete');
   return {score:fixture.scoreDisplay,outcomeText:fixture.scoreDisplay,recapText:`Cricket Australia reports: ${fixture.scoreDisplay.replace(/\.$/,'')}.`,resultSourceName:fixture.sourceName,resultSourceType:'official',resultSourceUrl:source.href,resultSourceCheckedAt:observed.result,scoreCheckedAt:observed.score,statusCheckedAt:observed.status};
  }
  instant(fixture.sourceCheckedAt,now,fixture.id);
  const observed=instant(fixture.scoreFactObservedAt||fixture.resultSourceCheckedAt||fixture.scoreCheckedAt||fixture.sourceCheckedAt,now,fixture.id);
  if(!Number.isFinite(Date.parse(fixture.startTimeUtc))||Date.parse(observed)<Date.parse(fixture.startTimeUtc))fail(fixture.id,'result observed before sporting start');
  return {score:fixture.scoreDisplay,outcomeText:fixture.scoreDisplay,recapText:`Cricket Australia reports: ${fixture.scoreDisplay.replace(/\.$/,'')}.`,resultSourceName:fixture.sourceName,resultSourceType:'official',resultSourceUrl:source.href,resultSourceCheckedAt:observed,scoreCheckedAt:observed,statusCheckedAt:instant(fixture.statusFactObservedAt||fixture.statusCheckedAt||observed,now,fixture.id)};
 }
 if(!/^official(?:-|$)/.test(fixture.resultSourceType||fixture.sourceType||''))return null;
 if(!['score','outcomeText','recapText'].every(key=>text(fixture[key]))||!url(fixture.resultSourceUrl))return null;
 if(strictSourceEvidence){
  const observed=resultObservations(fixture,now);
  if(!observed)return {unavailable:'Original result/status observations incomplete'};
  return {...Object.fromEntries(['score','outcomeText','recapText','resultSourceName','resultSourceType','resultSourceUrl'].filter(key=>fixture[key]!=null).map(key=>[key,fixture[key]])),resultSourceCheckedAt:observed.result,scoreCheckedAt:observed.score,statusCheckedAt:observed.status};
 }
 const observed=instant(fixture.resultSourceCheckedAt,now,fixture.id);
 return Object.fromEntries(['score','outcomeText','recapText','resultSourceName','resultSourceType','resultSourceUrl'].filter(key=>fixture[key]!=null).map(key=>[key,fixture[key]]).concat([['resultSourceCheckedAt',observed],['scoreCheckedAt',observed],['statusCheckedAt',instant(fixture.statusCheckedAt||observed,now,fixture.id)]]));
}
function assertRetainedCoverage(base,fixture,result){
 const participants=f=>(f.participantIds||[]).map(identity.canonicalParticipantId).sort();
 if(participants(base).length===2&&JSON.stringify(participants(base))!==JSON.stringify(participants(fixture)))fail(fixture.id,'result conflicts with retained coverage participants');
 const start=Date.parse(base.startTimeUtc);
 if(Number.isFinite(start)&&start!==Date.parse(fixture.startTimeUtc))fail(fixture.id,'result conflicts with retained coverage start');
 if(identity.sportKey(fixture)==='rugby'){
  const sides=f=>[f.homeParticipantId||f.participantIds?.[0],f.awayParticipantId||f.participantIds?.[1]].map(identity.canonicalParticipantId);
  if(sides(base).every(Boolean)&&JSON.stringify(sides(base))!==JSON.stringify(sides(fixture)))fail(fixture.id,'result conflicts with retained coverage sides');
 }
 if(base.status!=='completed')return;
 for(const key of ['homeScore','awayScore'])if(Number.isSafeInteger(base[key])&&result[key]!=null&&base[key]!==result[key])fail(fixture.id,'result conflicts with retained coverage score');
 const prior=typeof base.score==='string'?base.score:base.scoreDisplay;
 if(text(prior)&&meaning(prior)!==meaning(result.score))fail(fixture.id,'result conflicts with retained coverage final');
}
function aliasGroups(records){
 const groups=new Map();
 for(const record of records){
  const ids=aliases(record),group=new Set(ids.flatMap(id=>[...(groups.get(id)||[id])]));
  for(const id of group)groups.set(id,group);
 }
 return groups;
}
function reconcile(events,fixtures,{aliasRecords=[],now=new Date(),strictSourceEvidence=false}={}){
 if(!Number.isFinite(+now))throw Error('Invalid result reconciliation time');
 // Recorded IDs establish equivalence. Participant/time checks validate an
 // established match; they never discover or admit one.
 const groups=aliasGroups([...aliasRecords,...events,...fixtures]);
 const changed=[],deferred=[];
 const next=events.map(event=>{
  if(event.cardKind==='event'||event.cardType==='tournament_overview')return event;
  const ids=new Set(aliases(event).flatMap(id=>[...(groups.get(id)||[id])]));
  const matching=fixtures.filter(f=>f.status==='completed'&&aliases(f).some(id=>ids.has(id)));
  if(!matching.length)return event;
  const complete=event.status==='completed'&&['score','outcomeText','recapText','sourceName','sourceUrl','sourceCheckedAt'].every(key=>Boolean(event[key]));
  // Existing other-sport owners retain their specialised score formats.
  const candidates=matching.filter(f=>f.key==='cricket'||strictSourceEvidence&&rawRugbyResult(f)||!complete).map(f=>({fixture:f,result:resultFor(f,now,{strictSourceEvidence})}));
  for(const {fixture,result}of candidates)if(result?.unavailable||!result&&!complete)deferred.push({id:event.id,fixtureId:fixture.id,reason:result?.unavailable||'Unsupported official result evidence'});
  const supported=candidates.filter(row=>row.result&&!row.result.unavailable);
  if(!supported.length){if(!strictSourceEvidence&&!complete&&event.key==='cricket')fail(event.id,'matched final lacks supported official evidence');return event;}
  for(const {fixture,result}of supported){
   const participants=f=>(f.participantIds||[]).map(identity.canonicalParticipantId).sort();
   if(participants(event).length<2||JSON.stringify(participants(event))!==JSON.stringify(participants(fixture))||!Number.isFinite(Date.parse(event.startTimeUtc))||Date.parse(event.startTimeUtc)!==Date.parse(fixture.startTimeUtc))fail(event.id,'recorded alias conflicts with participants or start');
   if(rawRugbyResult(fixture)||strictSourceEvidence&&identity.sportKey(fixture)==='rugby'){
    const sides=f=>[f.homeParticipantId||f.participantIds?.[0],f.awayParticipantId||f.participantIds?.[1]].map(identity.canonicalParticipantId);
    if(JSON.stringify(sides(event))!==JSON.stringify(sides(fixture)))fail(event.id,'verified Rugby result conflicts with retained sides');
   }
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
 return {events:next,changed,deferred};
}
function reconcileFiles({root=ROOT,fixtures,aliasRecords,now=new Date(),strictSourceEvidence=false}={}){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 fixtures ||= read('data/follow-sources/coverage.v1.json').events;
 if(!aliasRecords){const directory=path.join(root,'data/code-inspector');aliasRecords=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).flatMap(name=>read('data/code-inspector/'+name).fixtures||[]);}
 const updates=['feeds/incoming/events.json','data/events.json'].map(file=>{
  const filename=path.join(root,file),before=fs.readFileSync(filename),document=JSON.parse(before),result=reconcile(document.events,fixtures,{aliasRecords,now,strictSourceEvidence});
  return {filename,before,result,document};
 });
 try{for(const update of updates)if(update.result.changed.length)fs.writeFileSync(update.filename,JSON.stringify({...update.document,events:update.result.events},null,2)+'\n');}
 catch(error){for(const update of updates)fs.writeFileSync(update.filename,update.before);throw error;}
 return {changed:[...new Set(updates.flatMap(update=>update.result.changed))],surfaces:updates.filter(update=>update.result.changed.length).map(update=>path.relative(root,update.filename)),deferred:[...new Map(updates.flatMap(update=>update.result.deferred).map(row=>[JSON.stringify(row),row])).values()]};
}
module.exports={reconcile,reconcileFiles,aliasGroups,resultFor,assertRetainedCoverage,rawRugbyResult,rugbyResult};
