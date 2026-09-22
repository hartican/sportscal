#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const lifecycle=require('../config/editorial-lifecycle');
const tournaments=require('../config/tournament-schedule');
const pga=require('./refresh-pga-schedule');
const {buildQueue}=require('./build-editorial-research-queue');
const {capture,safeSignal,researchCandidates}=require('./snapshot-editorial-nothingscore');
(async()=>{
 const preview={hook:'Can Australia win in Harare?',synopsis:'The teams will meet for a place in the final.',hookSpoilerOn:'Old result',synopsisSpoilerOn:'Old recap'};
 const event={name:'Australia v Zimbabwe',status:'completed',outcomeText:'Australia won by one wicket.',recapText:'Ellis finished the chase.'};
 assert.equal(lifecycle.copy(event,preview,true).hook,event.outcomeText);
 assert.equal(lifecycle.copy(event,preview,true).synopsis,event.recapText);
 assert(!JSON.stringify(lifecycle.copy(event,preview,false)).includes('one wicket'));
 const stale={...preview,phase:'recap',resultSignature:lifecycle.signature({...event,outcomeText:'Wrong winner'})};
 assert.equal(lifecycle.copy(event,stale,true).synopsis,event.recapText,'result corrections invalidate cached recaps');
 assert.equal(lifecycle.distinct('Australia won by one wicket. Ellis finished the chase.',[event.outcomeText]),'Ellis finished the chase.');
 assert.equal(lifecycle.distinct('Australia won the match by one wicket.',[event.outcomeText]),'','substantive repeat removed');
 const golf=require('../data/canonical/pga-tour-schedule.json');
 for(const year of [2026,2027]){const season=golf.tournaments.filter(t=>t.season===year);assert(season.length>=35);assert.equal(season.filter(t=>t.major).length,4);}
 assert(golf.tournaments.filter(t=>t.status==='completed').every(t=>t.winners.length));
 assert(golf.tournaments.filter(t=>t.status!=='completed').every(t=>!t.winners.length),'defending champions are not results');
 assert.deepEqual(pga.dateRange('Jan 29 - Feb 1',2026),{startDate:'2026-01-29',endDate:'2026-02-01'});
 const inspector=require('../data/code-inspector/golf.json').fixtures;
 for(const t of golf.tournaments){const records=inspector.filter(f=>f.tournamentId===t.id);assert.equal(records.length,1,t.id+' one canonical schedule entry');if(t.status==='completed')assert.match(records[0].outcomeText,/won/);}
 const catalogue=require('../data/canonical/tennis-catalogue-2026.json').tournaments;
 const sections=tournaments.sections(catalogue,'2026-09-22');assert.equal(sections.length,5);
 assert.equal(new Set(catalogue.filter(t=>t.level==='grand_slam').map(tournaments.family)).size,4);
 assert.equal(tournaments.family({name:'WTA Finals Indian Wells'}),'wta-finals');
 for(const section of sections){assert(section.current.every(t=>t.endDate>='2026-09-22'&&t.startDate<='2026-12-22'));assert(section.later.every(t=>t.startDate>'2026-12-22'));}
 for(const name of ['Davis','Billie','United'])assert(catalogue.some(t=>t.name.includes(name)));
 const groups=tournaments.groups(require('../data/code-inspector/tennis.json').fixtures,catalogue);
 assert(groups.some(g=>/us-open-2026/.test(g.id)));assert(groups.some(g=>/wimbledon-2026/.test(g.id)));
 for(const g of groups)assert(g.fixtures.every(f=>String(f.date).slice(0,4)===String(g.startDate).slice(0,4)));
 const base={id:'test-five',name:'Test fixture',date:'2026-09-25',key:'football',status:'scheduled'};
 const queue=(record,signals=[])=>buildQueue({knowledge:{eventProjections:[]},feed:{events:[record]},majorEvents:{events:[]},signals:{signals},reference:new Date('2026-09-22T00:00:00Z')}).entries[0];
 assert.equal(queue(base,[{sourceEventId:base.id,fiveStarPhases:['heat']}]).priority,'five-star');
 assert.equal(queue({...base,editorialPreviewRecommendation:{rating:5}}).priority,'five-star');
 assert.equal(queue(base,[{sourceEventId:base.id,anticipation:{score:5,support:1}}]).priority,'five-star');
 assert.equal(queue(base,[{sourceEventId:base.id,anticipation:{score:5,support:0}}]).fiveStarSignal,false);
 assert.equal(queue({...base,status:'completed'},[{sourceEventId:base.id,fiveStarPhases:['impact']}]).editorialPhase,'post-match');
 assert.equal(queue({...base,expected:10,stakesScore:5}).fiveStarSignal,false,'classification is not a real vote');
 const candidatePages=[];const candidates=await researchCandidates(async(table,options)=>{candidatePages.push(options);assert.equal(table,'nothingsports_nsc_contributions');assert.equal(options.rating,'eq.5');return options.offset===0?Array.from({length:1000},(_,i)=>({event_id:`candidate-${i}`})):[{event_id:'candidate-last'}];});assert.equal(candidates.length,1001);assert.equal(candidatePages[1].offset,1000);
 const external=buildQueue({knowledge:{eventProjections:[]},feed:{events:[]},catalogue:[base],majorEvents:{events:[]},signals:{signals:[{sourceEventId:base.id,fiveStarPhases:['heat']}]},reference:new Date('2026-09-22')}).entries[0];assert.equal(external.coverage,'queued-research');assert.equal(external.priority,'five-star');
 assert.equal(queue({...base,status:'completed'},[{sourceEventId:base.id,impact:{score:5,support:0}}]).fiveStarSignal,false);
 const calls=[];const snapshot=await capture({snapshotsImpl:async(ids,options)=>{calls.push(ids);assert(options.editorialResearch);return ids.map(eventId=>({eventId,fiveStarPhases:['heat'],userId:'must-not-leak'}));}});
 assert(calls.length>1&&calls.every(ids=>ids.length<=50));assert.equal(snapshot.signals.length,calls.flat().length);assert(!JSON.stringify(snapshot).includes('must-not-leak'));
 const signals=safeSignal({eventId:'test',fiveStarPhases:['heat','fake','heat']},new Date().toISOString());assert.deepEqual(signals.fiveStarPhases,['heat']);
 const feed=[...require('../feeds/incoming/events.json').events,...require('../lib/calendar-catalogue').catalogue()];
 for(const [id,expected]of [['1530203',/59 runs/],['1530204',/84 runs/],['1530205',/one wicket/],['major-match-nrl-finals-2026-semi-final-2',/12[–-]10/],['event-aflw-cd_m20262640606',/seven points/]]){const f=feed.find(f=>f.id.endsWith(id));assert(f,id);const on=lifecycle.copy(f,f.editorialNarrative,true),off=lifecycle.copy(f,f.editorialNarrative,false);assert.match(on.hook,expected);if(id.startsWith('153020'))assert.match(require('../config/card-results').scoreLine(f,f.name,{outcome:f.outcomeText}),/^Australia defeated Zimbabwe/);assert(!expected.test(off.hook+off.synopsis));assert(!/will meet|question is|selection opportunities remain/i.test(on.synopsis));}
 const narrative=require('./lib/editorial-narrative'),knowledge=require('../data/editorial-knowledge.v1.json'),original=feed.find(e=>e.id==='fixture:cricket:espn:1530205');
 const projection=knowledge.eventProjections.find(p=>p.targetIds.includes(original.id));let changed={...original,outcomeText:'Zimbabwe won by two wickets.',recapText:'A corrected result from the official source.'};
 for(let i=0;i<2;i++){changed=narrative.applyToFeedEvent(changed,projection,narrative.indexesFor(knowledge));assert(changed.editorialNarrative.resultResearchRequired);assert.equal(lifecycle.copy(changed,changed.editorialNarrative,true).synopsis,changed.recapText);}
 console.log('Coverage repairs: result lifecycle, duplication, PGA completeness, tennis editions/categories, private real-five-star priority and all-batch capture passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
