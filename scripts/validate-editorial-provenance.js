"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {addSource,addFact}=require('./update-sport-editorial-depth');
const {build:buildRolling}=require('./update-rolling-editorial-projections');
const root=path.resolve(__dirname,'..');
const files=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/events.json','data/canonical/afl-nrl-2026.json'];
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ns-editorial-provenance-'));
const read=name=>JSON.parse(fs.readFileSync(path.join(scratch,name)));
const run=reference=>{const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/update-sport-editorial-depth.js'),'--write'],{cwd:scratch,env:{...process.env,NS_EDITORIAL_REFERENCE:reference},encoding:'utf8',timeout:30000});assert.equal(r.status,0,r.stderr);return read(files[0]);};
const source=(doc,id)=>doc.sources.find(s=>s.id===id);
const facts=doc=>doc.narrativeFacts.filter(f=>f.id.startsWith('fact:depth:'));
const core=events=>events.filter(e=>e.key==='premier-league').map(e=>Object.fromEntries(['id','eventId','canonicalEventId','participantIds','homeParticipantId','awayParticipantId','date','time','startTimeUtc','endTimeUtc','status','viewingOptions','homeScore','awayScore','result','canonicalSourceCheckedAt','statusCheckedAt'].map(k=>[k,e[k]])));
try{
 for(const name of files){const target=path.join(scratch,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);}
 const before=read(files[0]),incoming=read(files[1]);
 const officialPath=path.join(scratch,'official-input.json');
 const officialSnapshot=require('../data/canonical/official-card-results-2026.json');
 const officialResult=officialSnapshot.results.find(result=>incoming.events.some(event=>event.id===result.id));
 assert(officialResult,'actual retained fixture must match the historical official-result snapshot');
 const officialEvent={...incoming.events.find(event=>event.id===officialResult.id),status:'upcoming',sourceCheckedAt:null};
 const publicationTime=new Date().toISOString();
 fs.writeFileSync(officialPath,JSON.stringify({...incoming,publishedAt:publicationTime,events:[officialEvent]}));
 const officialRun=cp.spawnSync(process.execPath,[path.join(root,'scripts/sync-official-card-results.js'),officialPath,officialPath],{encoding:'utf8',timeout:30000});
 assert.equal(officialRun.status,0,officialRun.stderr);
 const officialOutput=JSON.parse(fs.readFileSync(officialPath));
 assert.equal(officialOutput.publishedAt,publicationTime,'historical results must not backdate the current Feed retention window');
 assert.equal(officialOutput.events[0].sourceCheckedAt,officialResult.sourceCheckedAt||officialSnapshot.checkedAt,'actual persisted historical results retain their own observation date');
 // Advance from the current retained evidence rather than expiring on a fixed test date.
 const contextBefore=read(files[3]);
 const dates=[Date.now(),...before.sources.map(s=>Date.parse(s.checkedAt)),...incoming.events.map(e=>Date.parse(e.canonicalSourceCheckedAt)),...contextBefore.ladderSnapshots.map(s=>Date.parse(s.source?.checkedAt))].filter(Number.isFinite);
 const basis=Math.max(...dates)+3600000;
 const time=offset=>new Date(basis+offset).toISOString();
 const first=run(time(0));
 for(const id of ['source:depth:epl:season-guide','source:depth:epl:fixtures','source:depth:afl:final-ten-rules','source:depth:cricket:season'])assert.equal(source(first,id).checkedAt,source(before,id).checkedAt,`${id}: assembly must not claim a new page fetch`);
 const table=read(files[3]).ladderSnapshots.find(s=>s.competitionId==='competition:premier-league-2026-27');
 assert.equal(source(first,'source:depth:epl:table').checkedAt,table.source.checkedAt,'table freshness uses its actual retained observation');
 const event=incoming.events.find(e=>e.id==='epl-2026-27-128973');
 const match=source(first,'source:depth:epl:match:epl-2026-27-128973');
 assert.equal(match.url,event.canonicalSourceUrl,'match citation cannot become its editorial table URL');assert.equal(match.checkedAt,event.canonicalSourceCheckedAt);
 assert.deepEqual(core(read(files[1]).events),core(incoming.events),'no canonical facts, activity identities or viewing change');
 for(const event of incoming.events.filter(e=>e.key==='cricket')){const next=read(files[1]).events.find(e=>e.id===event.id);assert.equal(next.sourceCheckedAt,event.sourceCheckedAt,'static Cricket repairs must not impersonate a source fetch');}
 const second=run(time(1));
 assert.deepEqual(second.sources,first.sources,'later clock without another observation leaves source bytes unchanged');
 assert.deepEqual(facts(second),facts(first),'unchanged facts retain their observations');
 for(const p of first.eventProjections.filter(p=>/projection:(rolling|sport-depth):/.test(p.id))){const next=second.eventProjections.find(x=>x.id===p.id);assert.equal(next.researchedAt,p.researchedAt,`${p.id}: unchanged copy retains evidence date`);assert.deepEqual(next.originalityReview,p.originalityReview);}
 const observed=time(2);table.source.checkedAt=observed;table.snapshotTimeUtc=observed;const context=read(files[3]);context.ladderSnapshots=context.ladderSnapshots.map(s=>s.competitionId===table.competitionId?table:s);fs.writeFileSync(path.join(scratch,files[3]),JSON.stringify(context));
 const advanced=run(time(3));assert.equal(source(advanced,'source:depth:epl:table').checkedAt,observed,'an actual newly supplied observation is retained, never the rebuild clock');
 const depthProjections=advanced.eventProjections.filter(p=>p.factIds.some(id=>id.startsWith('fact:depth:epl:'))).map(p=>({id:p.id,hook:p.hook,synopsis:p.synopsis,researchedAt:p.researchedAt}));
 assert(depthProjections.length,'current EPL depth projections are exercised');
 const requested=require('../data/canonical/fiba-women-sailgp-motogp-2026.json');
 const nbl=require('../data/canonical/nbl-2026-27.json');
 buildRolling({knowledge:advanced,feed:read(files[1]),context:read(files[3]),f1:require('../data/canonical/f1-context-2026.json'),wrc:require('../data/canonical/wrc-context-2026.json'),requestedSports:{...requested,generatedAt:[requested.generatedAt,nbl.generatedAt].filter(Boolean).sort().at(-1),sources:{...requested.sources,...nbl.sources},participants:[...requested.participants,...nbl.participants],events:[...requested.events,...nbl.events]},reference:new Date(time(4))});
 for(const p of depthProjections){const next=advanced.eventProjections.find(item=>item.id===p.id);assert.equal(next.hook,p.hook,'final rolling reconciliation cannot downgrade source-current EPL depth');assert.equal(next.synopsis,p.synopsis);assert.equal(next.researchedAt,p.researchedAt,'retaining depth must not fabricate a fresh research date');}
 const k={sources:[{id:'known',name:'Known',url:'https://example.test/facts',sourceType:'official',checkedAt:'2026-09-01T00:00:00.000Z'}],narrativeFacts:[]};const bytes=JSON.stringify(k);
 for(const date of [undefined,'','not-a-date','2026-02-30T00:00:00Z','2999-01-01T00:00:00Z'])assert.throws(()=>addSource(k,'unknown','Unknown','https://example.test/unknown',date),/dated source observation/);
 assert.equal(JSON.stringify(k),bytes,'missing/invalid evidence cannot mutate retained data');
 assert.throws(()=>addFact(k,{id:'fact:missing',subjectIds:[],statement:'Incomplete evidence',dimension:'history',sourceIds:['known','missing']}),/dated source observation/);
 assert.equal(JSON.stringify(k),bytes,'one known citation cannot hide another missing observation');
 addSource(k,'alias','Same observed resource','https://example.test/facts');assert.equal(k.sources[1].checkedAt,k.sources[0].checkedAt);
 const fact={id:'fact:test',subjectIds:['subject:test'],statement:'A dated observation supports this retained statement.',dimension:'history',sourceIds:['known'],expiresAt:null};addFact(k,fact);const initial=k.narrativeFacts[0].observedAt;addFact(k,fact);assert.equal(k.narrativeFacts[0].observedAt,initial);
 addSource(k,'known','Known','https://example.test/facts','2026-09-02T00:00:00.000Z');addFact(k,{...fact,statement:'An actual newer observation supports the corrected statement.'});assert.equal(k.narrativeFacts[0].observedAt,'2026-09-02T00:00:00.000Z');
 console.log('Editorial provenance: actual persistence, unchanged reruns, real table/match dates, canonical Football preservation, missing/invalid/future evidence, shared-resource dates, corrected facts and historical-results retention clocks passed; no network.');
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
