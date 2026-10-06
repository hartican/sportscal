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
function explicitlyUnavailableRace(html,event,url){
 const identity=String(event.canonicalEventId||'').match(/^event:f1:(\d{4}):([a-z-]+):race$/);
 const path=url.match(/^https:\/\/www\.formula1\.com\/en\/results\/(\d{4})\/races\/\d+\/([a-z-]+)\/race-result$/);
 if(!identity||!path||identity[1]!==path[1]||identity[2]!==path[2]||!['upcoming','scheduled','live','in_progress'].includes(event.status)||event.fixtureResults?.rows?.length)return false;
 const heading=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'').toLowerCase();
 const body=text(html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]||'');
 return heading.startsWith('formula 1 ')&&heading.includes(identity[2].replaceAll('-',' '))&&heading.endsWith(identity[1]+' - race result')&&/^(?:Error\s*)?No results available$/i.test(body);
}
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
  const url='https://www.formula1.com'+link.replace('race-result',session.path),html=await fetchPage(url),rows=resultRows(html,session.columns.length);
  if(rows.length===0&&session.path==='race-result'&&explicitlyUnavailableRace(html,ev,url)){
   updates.push({...ev,resultStatus:'pending',resultSourceUrl:url,resultSourceCheckedAt:now.toISOString()});continue;
  }
  if(rows.length<10||rows[0][0]!=='1'||new Set(rows.map(row=>row[1])).size!==rows.length||new Set(rows.map(row=>row[2])).size!==rows.length)continue;
  const [position,number,driver,team]=rows[0],outcome=`${driver} ${session.verb} ${ev.name}.`;
  // The fetch clock is not a new final observation when the complete official
  // table is unchanged. Repair legacy pre-session clocks only from this table's
  // own retained observation, never a schedule announcement or collection date.
  const validObservation=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=+fixtureStart(ev)&&Date.parse(value)<=+now;
  const sameFinal=ev.status==='completed'&&ev.fixtureResults?.sourceUrl===url
   &&JSON.stringify(ev.fixtureResults.columns)===JSON.stringify(session.columns)
   &&JSON.stringify(ev.fixtureResults.rows)===JSON.stringify(rows);
  const observed=sameFinal&&[ev.scoreCheckedAt,ev.fixtureResults.checkedAt].find(validObservation)||now.toISOString();
  updates.push({...ev,participantIds:participantsForResults(rows,context),participants:participantsForResults(rows,context).map(id=>{const p=context.participants.find(p=>p.id===id);return {id,name:p.displayName,displayName:p.displayName,countryCode:p.countryCode};}),participantsConfirmed:true,...(url.includes('/italy/')?{venueCountryCode:'IT'}:{}),status:'completed',resultStatus:'official',resultSourceUrl:url,resultSourceCheckedAt:observed,scoreCheckedAt:observed,fixtureResults:{schemaVersion:'fixture-results.v1',columns:session.columns,rows,sourceUrl:url,checkedAt:observed},score:rows.slice(0,3).map(r=>`${r[0]}. ${r[2]}`).join(' · '),outcomeText:outcome,recapText:`${outcome} ${rows.slice(0,3).map(r=>`${r[0]}. ${r[2]} (${r[3]})`).join('; ')}.`,resultPublishedAt:ev.resultPublishedAt||now.toISOString(),sourceName:'Formula 1 official session results',sourceUrl:url,sourceCheckedAt:observed});
 }
 return updates.map(event=>{
  if(!event.storyline||event.resultStatus==='pending')return event;
  const {storylineFor,spoilerSafeRootCopy}=require('./lib/storyline-card-rules');
  const storyline=storylineFor(event),safe=spoilerSafeRootCopy(event,storyline);
  const next={...event,storyline,selectedSentence:safe.hook,fullSpiel:safe.synopsis};
  delete next.editorialPreview;
  return next;
 });
}
async function main(){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path,'utf8'));doc.events=applyPublishedSchedule(doc.events);const updates=await updatesFor(doc.events),patched=require('./lib/known-fixture-patch').patchKnown(doc.events,updates);doc.events=patched.events;fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');console.log(`Official F1 results: ${patched.count} known sessions updated; unchanged observations retain original dates.`);}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={sessionFor,resultRows,updatesFor,participantsForResults,applyPublishedSchedule};
