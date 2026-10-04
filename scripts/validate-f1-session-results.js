#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {sessionFor,resultRows,updatesFor}=require('./refresh-f1-results');
const context={participants:Array.from({length:10},(_,i)=>({id:`driver:${i}`,type:'competitor',displayName:`Driver ${i}`})).concat({id:'team:one',type:'team',displayName:'Team One'})};
const table=(width=6,duplicate=false)=>'<tbody>'+Array.from({length:10},(_,i)=>'<tr>'+[String(i+1),String(duplicate?1:i+1),`Driver ${i}`,'Team One','1:43.922','21','0',''].slice(0,width).map(v=>`<td>${v}</td>`).join('')+'</tr>').join('')+'</tbody>';
const now=new Date('2026-09-30T00:00:00Z');
const fixture={id:'practice',key:'f1',name:'Azerbaijan GP · Practice 3',date:'2026-09-25',time:'18:30',startTimeUtc:'2026-09-25T08:30:00Z',status:'upcoming'};
async function verify(){
 assert.equal(sessionFor('Practice'),null);
 assert.equal(resultRows(table(),6).length,10);
 assert.equal(resultRows(table()).length,0);
 assert.equal(resultRows(table(7),6).length,0);
 const sprintCalls=[];
 const sprint=await updatesFor([{...fixture,name:'Azerbaijan GP · Sprint Qualifying'}],now,async url=>{sprintCalls.push(url);return url.endsWith('/races')?'<a href="/en/results/2026/races/1295/azerbaijan/race-result">Race</a>':table(8);},context);
 assert.match(sprintCalls[1],/sprint-qualifying$/);assert.match(sprint[0].outcomeText,/took sprint pole/);assert.equal(sprint[0].fixtureResults.columns[4],'SQ1');
 const calls=[];
 const fetchPage=async url=>{calls.push(url);return url.endsWith('/races')?'<a href="/en/results/2026/races/1295/azerbaijan/race-result">Race</a>':table();};
 const result=await updatesFor([fixture],now,fetchPage,context);
 assert.equal(result.length,1);assert.equal(result[0].status,'completed');assert.match(result[0].outcomeText,/was fastest in/);assert.equal(result[0].fixtureResults.columns.length,6);assert.match(calls[1],/practice\/3$/);assert.equal(result[0].id,fixture.id);assert.equal(require('../config/card-results').scoreLine(result[0],fixture.name,{score:result[0].score}),result[0].score);
 const patched=require('./quick-results').patchKnown([fixture],result);assert.equal(patched.count,1);assert.deepEqual(patched.events[0].fixtureResults,result[0].fixtureResults);assert.deepEqual(patched.events[0].participantIds,result[0].participantIds);assert.equal(require('./quick-results').patchKnown(patched.events,result).count,0);
 for(const status of ['cancelled','postponed','abandoned'])assert.equal((await updatesFor([{...fixture,status}],now,fetchPage,context)).length,0);
 assert.equal((await updatesFor([fixture],new Date('2026-09-25T09:00:00Z'),fetchPage,context)).length,0);
 for(const html of [table(7),table(6,true),'<tbody></tbody>'])assert.equal((await updatesFor([fixture],now,async url=>url.endsWith('/races')?'<a href="/en/results/2026/races/1295/azerbaijan/race-result">Race</a>':html,context)).length,0);
 await assert.rejects(updatesFor([fixture],now,fetchPage,{participants:[]}),/Unresolved/);
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
 const published=require('../data/events.json'),actual=published.events.find(e=>e.id==='evt_f1_2026_azerbaijan_practice_3');
 assert(actual?.fixtureResults?.sourceUrl,'actual published official practice result required');
 const retained={...actual,status:'completed',sourceUrl:actual.fixtureResults.sourceUrl,sourceCheckedAt:actual.fixtureResults.checkedAt||actual.statusCheckedAt};
 assert(Number.isFinite(Date.parse(retained.sourceCheckedAt)),'retained result observation must be genuine');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-f1-last-good-'));
 try{
  const file=path.join(root,'events.json');fs.writeFileSync(file,JSON.stringify({...published,events:[retained]}));
  const run=()=>cp.execFileSync(process.execPath,[path.join(__dirname,'sync-requested-sports-to-feed.js'),file],{cwd:path.join(__dirname,'..'),stdio:'pipe'});
  run();const after=JSON.parse(fs.readFileSync(file)).events.find(e=>e.id===retained.id);
  for(const key of ['id','canonicalEventId','startTimeUtc','participantIds','status','fixtureResults','score','outcomeText','sourceUrl','sourceCheckedAt','statusCheckedAt'])assert.deepEqual(after?.[key],retained[key],'real schedule writer cannot revoke result field '+key);
  const bytes=JSON.stringify(after);run();const rerun=JSON.parse(fs.readFileSync(file)).events.filter(e=>e.id===retained.id);assert.equal(rerun.length,1,'actual writer rerun cannot duplicate the retained fixture');assert.equal(JSON.stringify(rerun[0]),bytes,'unchanged retained result rerun is byte-stable');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 console.log('F1 session results: practice shape, identity, wording, timing, cancellation and malformed-source guards passed.');
}
// Exercise routing independently from source parsing.
for(const [name,path] of [['Practice 1','practice/1'],['Practice 2','practice/2'],['Practice 3','practice/3'],['Sprint Qualifying','sprint-qualifying'],['Sprint Shootout','sprint-qualifying'],['Qualifying','qualifying'],['Sprint','sprint-results'],['Grand Prix Race','race-result']])assert.equal(sessionFor(name).path,path);
verify().catch(error=>{console.error(error);process.exitCode=1;});
