#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),journeys=require('../config/tennis-journeys');
const ROOT=path.resolve(__dirname,'..'),input='feeds/provider-exports/tennis/journeys-reviewed.v1.json',output='data/tennis-journeys.v1.json';
function validate(doc){
 if(doc.schemaVersion!=='tennis-journey-register.v1'||doc.players.length!==5||!Array.isArray(doc.editions))throw Error('Invalid tennis journey register');
 const ids=new Set(),sources=new Map(doc.sources.map(s=>[s.id,s])),players=new Map(doc.players.map(p=>[p.id,p]));
 const checkSources=refs=>{if(!refs?.length||refs.some(id=>!sources.has(id)))throw Error('Missing journey provenance');};
 for(const source of doc.sources){if(!/^https:\/\//.test(source.url)||!/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt)||source.verifiedAt>doc.reviewedAt)throw Error('Invalid journey source');}
 for(const e of doc.editions){
  if(ids.has(e.id)||!e.id.startsWith('tennis-edition:')||e.season!==Number(e.id.split(':').at(-1)))throw Error('Duplicate or unstable journey edition');ids.add(e.id);
  if(e.fixtures||e.startTimeUtc||e.status||e.participantIds)throw Error('Journey context must not become a fixture');
  const tours=new Set(),people=new Set();
  for(const w of e.tourWindows){if(tours.has(w.tour)||!['ATP','WTA'].includes(w.tour)||!/^tournament:tennis:/.test(w.tournamentId)||!/^\d{4}-\d{2}-\d{2}$/.test(w.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(w.endDate)||w.endDate<w.startDate)throw Error('Invalid tour window');tours.add(w.tour);checkSources(w.sourceIds);}
  for(const p of e.participation){
   if(people.has(p.playerId)||!players.has(p.playerId)||!['confirmed','very_likely','conditional','withdrawn'].includes(p.status)||!p.reason||p.verifiedAt>doc.reviewedAt)throw Error('Invalid player participation');people.add(p.playerId);checkSources(p.sourceIds);
   if(e.tourWindows.length&&!tours.has(players.get(p.playerId).tour))throw Error('Participation has no tour window');
   if(p.status==='confirmed'&&(!/^official_(entry|participation|qualification)$/.test(p.evidenceKind)||!p.sourceIds.some(id=>['entry','participation','qualification'].includes(sources.get(id).scope))))throw Error('Calendar cannot prove a player entry');
   if(p.status==='withdrawn'&&!p.sourceIds.some(id=>sources.get(id).scope==='withdrawal'))throw Error('Withdrawal needs official evidence');
   if(e.category==='500'&&!['confirmed','withdrawn'].includes(p.status))throw Error('Smaller events need confirmed participation');
  }
 }
 const reviews=new Set();
 if(doc.coverageReviews!==undefined&&!Array.isArray(doc.coverageReviews))throw Error('Invalid coverage reviews');
 for(const review of doc.coverageReviews||[]){
  const edition=doc.editions.find(e=>e.id===review.editionId),key=review.editionId+'|'+review.tour;
  if(!edition?.tourWindows.some(w=>w.tour===review.tour)||reviews.has(key)||!Number.isFinite(Date.parse(review.checkedAt))||review.checkedAt.slice(0,10)>doc.reviewedAt||review.nsCoverage!=='unavailable'||!['partial-match-order','session-only','publication-pending'].includes(review.publication)||!/^https:\/\//.test(review.scheduleUrl)||!review.evidenceUrls?.length||review.evidenceUrls.some(u=>!/^https:\/\//.test(u))||review.completeDrawVerified!==false||review.completeIndividualTimingVerified!==false||review.reuseCleared!==false)throw Error('Coverage gaps cannot certify an ingestion source');
  reviews.add(key);
 }
 return doc;
}
function build(day=new Date().toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}),doc=JSON.parse(fs.readFileSync(path.join(ROOT,input)))){
 validate(doc);const window={from:day,through:journeys.through(day)};
 return {...doc,schemaVersion:'tennis-journeys.v1',window,contextOnly:true,windowEditionIds:journeys.editions(doc,day).map(e=>e.id)};
}
if(require.main===module){const text=JSON.stringify(build(process.env.TENNIS_JOURNEY_REFERENCE_DAY||undefined),null,2)+'\n',file=path.join(ROOT,output);if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Tennis journey projection is stale');}else fs.writeFileSync(file,text);console.log('Reviewed tennis journey calendar: rolling twelve months, one edition and separate tour windows; no fixtures generated.');}
module.exports={build,validate};
