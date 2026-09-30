#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),feedControls=require('../config/feed-controls');
const publishedSchedule=require('../data/canonical/f1-published-sessions-2026.json');
function applyPublishedSchedule(events){
 const sessions=new Map(publishedSchedule.sessions.map(session=>[session.id,session]));
 return events.map(require("../lib/f1-venues").enrich).map(event=>{const session=sessions.get(event.id);if(!session)return event;const {id,...timing}=session;return {...event,...timing,timingSourceUrl:publishedSchedule.sourceUrl,timingCheckedAt:publishedSchedule.checkedAt};});
}
function text(html){return html.replace(/<span class="md:hidden">[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function resultRows(html, expectedColumns=7){const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1];if(!body)return [];return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1]))).filter(c=>/^(?:\d+|NC|DSQ|DQ|DNF|DNS)$/i.test(c[0])&&c.length===expectedColumns&&c[2]);}
function sessionFor(name){
 if(/sprint\s+(?:qualifying|shootout)/i.test(name))return {path:'sprint-qualifying',columns:['Pos','No','Driver','Car','SQ1','SQ2','SQ3','Laps'],verb:'took sprint pole for'};
 const practice=name.match(/practice\s*([123])/i);
 if(practice)return {path:'practice/'+practice[1],columns:['Pos','No','Driver','Car','Time / Gap','Laps'],verb:'was fastest in'};
 if(/practice/i.test(name))return null;
 if(/qualifying/i.test(name))return {path:'qualifying',columns:['Pos','No','Driver','Car','Q1','Q2','Q3','Laps'],verb:'took pole for'};
 if(/sprint/i.test(name))return {path:'sprint-results',columns:['Pos','No','Driver','Car','Laps','Time / retired','Points'],verb:'won'};
 if(/race|grand prix/i.test(name))return {path:'race-result',columns:['Pos','No','Driver','Car','Laps','Time / retired','Points'],verb:'won'};
 return null;
}
async function fetchText(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`F1 source ${r.status}`);return r.text();}
function participantsForResults(rows, context){
 const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const participants=rows.map(row=>{
  const driver=context.participants.find(p=>p.type==='competitor' && [p.displayName,p.canonicalName,...(p.metadata?.titleAliases||[])].some(name=>key(name)===key(row[2])));
  const team=context.participants.find(p=>p.type==='team' && [p.displayName,p.canonicalName,p.shortName].some(name=>name && (key(name)===key(row[3]) || key(row[3]).includes(key(name)))));
  if(!driver || !team)throw new Error('Unresolved official F1 result participant '+row[2]);
  return [driver.id,team.id];
 });
 return [...new Set(participants.flat())];
}
async function updatesFor(events,now=new Date(),fetchPage=fetchText,context=require('../data/canonical/f1-context-2026.json')){
 const fixtureStart=e=>feedControls.eventStart(e)||new Date(`${e.date}T${e.time||'00:00'}:00+10:00`);
 const known=events.filter(e=>e.key==='f1'&&Number.isFinite(+fixtureStart(e))&&Math.abs(fixtureStart(e)-now)<7*86400000&&fixtureStart(e)<=now);if(!known.length)return [];
 const index=await fetchPage(`https://www.formula1.com/en/results/${now.getUTCFullYear()}/races`),links=[...new Set([...index.matchAll(/href="(\/en\/results\/\d{4}\/races\/\d+\/[^/"?]+\/race-result)"/g)].map(m=>m[1]))],updates=[];
 for(const ev of known){
  const name=ev.name.toLowerCase().replace('italian','italy').replace('spanish','spain').replace('australian','australia').replace('british','great britain').replace('canadian','canada').replace('dutch','netherlands').replace('japanese','japan').replace('chinese','china').replace('belgian','belgium').replace('hungarian','hungary').replace('austrian','austria').replace('brazilian','brazil');
  const link=links.find(l=>name.includes(l.split('/').at(-2).replaceAll('-',' ')));if(!link)continue;
  const session=sessionFor(ev.name);if(!session||['cancelled','postponed','abandoned'].includes(ev.status))continue;
  // Practice result tables can populate during the session. Allow a conservative publication delay.
  if(session.path.startsWith('practice/') && +now < +fixtureStart(ev)+90*60000)continue;
  const url='https://www.formula1.com'+link.replace('race-result',session.path),rows=resultRows(await fetchPage(url),session.columns.length);if(rows.length<10||rows[0][0]!=='1'||new Set(rows.map(row=>row[1])).size!==rows.length||new Set(rows.map(row=>row[2])).size!==rows.length)continue;
  const [position,number,driver,team]=rows[0],outcome=`${driver} ${session.verb} ${ev.name}.`;
  updates.push({...ev,participantIds:participantsForResults(rows,context),participants:participantsForResults(rows,context).map(id=>{const p=context.participants.find(p=>p.id===id);return {id,name:p.displayName,displayName:p.displayName,countryCode:p.countryCode};}),participantsConfirmed:true,...(url.includes('/italy/')?{venueCountryCode:'IT'}:{}),status:'completed',fixtureResults:{schemaVersion:'fixture-results.v1',columns:session.columns,rows,sourceUrl:url,checkedAt:now.toISOString()},score:rows.slice(0,3).map(r=>`${r[0]}. ${r[2]}`).join(' · '),outcomeText:outcome,recapText:`${outcome} ${rows.slice(0,3).map(r=>`${r[0]}. ${r[2]} (${r[3]})`).join('; ')}.`,resultPublishedAt:ev.resultPublishedAt||now.toISOString(),sourceName:'Formula 1 official session results',sourceUrl:url,sourceCheckedAt:now.toISOString()});
 }
 return updates.map(event=>{
  if(!event.storyline)return event;
  const {storylineFor,spoilerSafeRootCopy}=require('./lib/storyline-card-rules');
  const storyline=storylineFor(event),safe=spoilerSafeRootCopy(event,storyline);
  const next={...event,storyline,selectedSentence:safe.hook,fullSpiel:safe.synopsis};
  delete next.editorialPreview;
  return next;
 });
}
async function main(){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path,'utf8'));doc.events=applyPublishedSchedule(doc.events);const updates=await updatesFor(doc.events),map=new Map(updates.map(e=>[e.id,e]));doc.events=doc.events.map(e=>map.get(e.id)||e);fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');console.log(`Official F1 results: ${updates.length} known sessions updated.`);}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={sessionFor,resultRows,updatesFor,participantsForResults,applyPublishedSchedule};
