'use strict';
// Review-only cases, never imported by a refresh or public content loader.
// Sporting fields come from the existing frozen capture/current catalogue.
const fs=require('node:fs'),path=require('node:path');
const policy=require('../../config/cricket-editorial-policy');
const now='2026-10-20T04:25:20.000Z';
const checks=['support','attribution','phase','spoilers','duplication','style'];
function source(url,name,publisher,author,originId,publishedAt,reportingType='journalism'){
  return {url,name,publisher,author,originId,publishedAt,updatedAt:null,reportingType,sourceType:reportingType==='journalism'?'reputable':'official',accessible:true,checkedAt:now,retrievedAt:'2026-10-20'};
}
const sources=[
  source('https://www.dawn.com/news/2038333','Reuters match report, 19 October','Dawn','Reuters','reuters','2026-10-19'),
  source('https://www.theguardian.com/sport/2026/oct/19/scott-boland-shines-against-south-africa-but-rain-dominates-again','Geoff Lemon match report','The Guardian','Geoff Lemon','guardian','2026-10-19T17:46:00.000Z'),
  source('https://www.thestar.com.my/sport/cricket/2026/10/15/cricket-australia-open-minded-about-batting-order-green-still-to-prove-fitness-for-second-test-coach','Reuters selection reporting, 15 October','The Star','Ian Ransom / Reuters','reuters','2026-10-15T02:24:00.000Z'),
  source('https://www.abc.net.au/news/2026-10-18/renshaw-to-stay-at-number-five-as-aussies-delay-naming-test-side/107280234','AAP selection update, 18 October','ABC','AAP','aap','2026-10-17T20:02:00.000Z'),
];
function base(event,evidenceMode,phase){return {id:event.id,title:event.name,hook:'',formCopy:'',synopsis:'',closingCopy:'',editorialPolicyVersion:policy.version,evidenceMode,editorialPhase:phase,researchedAt:now,validUntil:event.startTimeUtc,researchDepth:5,sources:[],sourceObservations:[],facts:[],paragraphClaims:{},editorialReview:{verdict:'pass',reviewedAt:now,checks,draftPassId:'draft-1',passId:'review-1'},researchUsage:{searches:0,articleReads:0,drafts:1,reviews:1,corrections:0,reusedPlanningSources:true}};}
function samples(){
  const root=path.resolve(__dirname,'../..'),feed=JSON.parse(fs.readFileSync(path.join(root,'data/events.json'))).events;
  const capture=require('./cricket-score-address-20261020.json');
  const current={...structuredClone(capture.published),...structuredClone(capture.rows[0].fixture)};
  const currentEntry=base(current,'synthesis','ongoing');
  Object.assign(currentEntry,{hook:'Boland dismissed Ackerman and Rickelton, ending the latter’s partnership with Bavuma.',coverageThrough:'2026-10-19T17:46:00.000Z',validUntil:'2026-10-20T17:46:00.000Z',sources:sources.slice(0,2).map(s=>s.url),sourceObservations:structuredClone(sources.slice(0,2)),facts:[{claimId:'boland-partnership',claimType:'fact',dimension:'form',statement:'Boland dismissed Ackerman and Rickelton, ending the latter’s partnership with Bavuma.',sourceIndexes:[0,1],support:[{sourceIndex:0,basisId:'reuters-match-report-20261019',excerpt:'inducing an edge from debutant opener Marques Ackerman'},{sourceIndex:1,basisId:'lemon-match-observation-20261019',excerpt:'Matt Renshaw at first slip'}]}]});
  currentEntry.paragraphClaims.hook=[{text:currentEntry.hook,claimIds:['boland-partnership']}];
  const preview=structuredClone(feed.find(e=>e.id==='fixture:cricket:espn:1525661'));
  const previewEntry=base(preview,'synthesis','preview');
  Object.assign(previewEntry,{hook:'On 15 October, McDonald said Australia could change its batting order to suit the surface. Steve Waugh argued that Renshaw should remain at number five.',synopsis:'Before the second Test, Cummins expected Renshaw to remain at five and confirmed Green was still unavailable.',sources:sources.slice(2).map(s=>s.url),sourceObservations:structuredClone(sources.slice(2)),facts:[
    {claimId:'mcdonald-flexibility',claimType:'opinion',attribution:'McDonald',dimension:'matchup',statement:'McDonald said Australia could change its batting order according to the opposition and surface.',sourceIndexes:[0],support:[{sourceIndex:0,basisId:'mcdonald-interview-20261015',excerpt:'we\'re really open-minded to what our batting order can look like'}]},
    {claimId:'waugh-continuity',claimType:'opinion',attribution:'Steve Waugh',dimension:'matchup',statement:'Steve Waugh argued that Renshaw should remain at number five.',sourceIndexes:[0],support:[{sourceIndex:0,basisId:'waugh-interview-20261015',excerpt:'Renshaw should stay at number five'}]},
    {claimId:'cummins-update',claimType:'fact',attribution:'Cummins',dimension:'form',statement:'Before the second Test, Cummins expected Renshaw to remain at five and confirmed Green was unavailable.',sourceIndexes:[1],support:[{sourceIndex:1,basisId:'cummins-interview-20261017',excerpt:'Cummins also confirmed Cameron Green remained sidelined with an abdominal strain'}]},
  ]});
  previewEntry.paragraphClaims={hook:[{text:'On 15 October, McDonald said Australia could change its batting order to suit the surface.',claimIds:['mcdonald-flexibility']},{text:'Steve Waugh argued that Renshaw should remain at number five.',claimIds:['waugh-continuity']}],synopsis:[{text:previewEntry.synopsis,claimIds:['cummins-update']}]};
  const sparse=structuredClone(feed.find(e=>e.id==='cricket-australia-england-first-odi-2026'));
  const sparseEntry={...base(sparse,'withheld','preview'),validUntil:'2026-10-21T04:25:20.000Z',withheldReason:'No current, fixture-specific journalistic evidence was gathered within this approved sample. Earlier selection reporting does not establish the November ODI context.'};
  for(const entry of [currentEntry,previewEntry,sparseEntry])entry.editorialReview.contentSha256=require('../lib/cricket-editorial-evidence').reviewFingerprint(entry);
  return {now,cases:[{kind:'attached-test',event:current,entry:currentEntry,note:'Retained structured snapshot, not a live score fetch. Reporting cutoff uses the Guardian publication timestamp, not an inferred match clock.'},{kind:'pre-match',event:preview,entry:previewEntry,note:'Dated background for the upcoming third Test; neither the third-Test XI nor current fitness is asserted.'},{kind:'sparse-evidence',event:sparse,entry:sparseEntry,note:'Withheld is a valid outcome; the actual fixture remains visible.'}]};
}
module.exports={samples,sources,now};
