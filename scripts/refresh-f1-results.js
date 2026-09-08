#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),feedControls=require('../config/feed-controls');
const publishedSchedule=require('../data/canonical/f1-published-sessions-2026.json');
function applyPublishedSchedule(events){
 const sessions=new Map(publishedSchedule.sessions.map(session=>[session.id,session]));
 return events.map(event=>{const session=sessions.get(event.id);if(!session)return event;const {id,...timing}=session;return {...event,...timing,timingSourceUrl:publishedSchedule.sourceUrl,timingCheckedAt:publishedSchedule.checkedAt};});
}
function text(html){return html.replace(/<span class="md:hidden">[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function resultRows(html){const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1];if(!body)return [];return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1]))).filter(c=>/^(?:\d+|NC|DSQ|DQ|DNF|DNS)$/i.test(c[0])&&c.length>=7&&c[2]);}
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
  const name=ev.name.toLowerCase().replace('italian','italy').replace('australian','australia').replace('british','great britain').replace('canadian','canada').replace('dutch','netherlands').replace('japanese','japan').replace('chinese','china').replace('belgian','belgium').replace('hungarian','hungary').replace('austrian','austria').replace('brazilian','brazil');
  const link=links.find(l=>name.includes(l.split('/').at(-2).replaceAll('-',' ')));if(!link)continue;
  const session=/qualifying/i.test(ev.name)?'qualifying':/sprint/i.test(ev.name)?'sprint-results':/race|grand prix/i.test(ev.name)?'race-result':null;if(!session)continue;
  const url='https://www.formula1.com'+link.replace('race-result',session),rows=resultRows(await fetchPage(url));if(rows.length<10||rows[0][0]!=='1')continue;
  const [position,number,driver,team]=rows[0],outcome=session==='qualifying'?`${driver} took pole for ${ev.name}.`:`${driver} won ${ev.name}.`;
  updates.push({...ev,participantIds:participantsForResults(rows,context),participants:participantsForResults(rows,context).map(id=>{const p=context.participants.find(p=>p.id===id);return {id,name:p.displayName,displayName:p.displayName,countryCode:p.countryCode};}),participantsConfirmed:true,...(url.includes('/italy/')?{venueCountryCode:'IT'}:{}),status:'completed',fixtureResults:{schemaVersion:'fixture-results.v1',columns:session==='qualifying'?['Pos','No','Driver','Car','Q1','Q2','Q3','Laps']:['Pos','No','Driver','Car','Laps','Time / retired','Points'],rows,sourceUrl:url,checkedAt:now.toISOString()},score:rows.slice(0,3).map(r=>`${r[0]}. ${r[2]}`).join(' · '),outcomeText:outcome,recapText:`${outcome} ${rows.slice(0,3).map(r=>`${r[0]}. ${r[2]} (${r[3]})`).join('; ')}.`,resultPublishedAt:ev.resultPublishedAt||now.toISOString(),sourceName:'Formula 1 official session results',sourceUrl:url,sourceCheckedAt:now.toISOString()});
 }
 return updates;
}
async function main(){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path,'utf8'));doc.events=applyPublishedSchedule(doc.events);const updates=await updatesFor(doc.events),map=new Map(updates.map(e=>[e.id,e]));doc.events=doc.events.map(e=>map.get(e.id)||e);fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');console.log(`Official F1 results: ${updates.length} known sessions updated.`);}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={resultRows,updatesFor,participantsForResults,applyPublishedSchedule};
