#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),feedControls=require('../config/feed-controls');
const publishedSchedule=require('../data/canonical/f1-published-sessions-2026.json');
function applyPublishedSchedule(events){
 const sessions=new Map(publishedSchedule.sessions.map(session=>[session.id,session]));
 return events.map(require("../lib/f1-venues").enrich).map(event=>{const session=sessions.get(event.id);if(!session)return event;const {id,...timing}=session;return {...event,...timing,timingSourceUrl:publishedSchedule.sourceUrl,timingCheckedAt:publishedSchedule.checkedAt};});
}
function text(html){return html.replace(/<span class="md:hidden">[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function resultRows(html, expectedColumns=7){
 const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1];if(!body)return [];
 const rows=[...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)]
  .map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1])))
  .filter(c=>c.length);
 // Reject a malformed table in full; filtering one row can silently lose a driver.
 if(rows.some(c=>! /^(?:\d+|NC|DSQ|DQ|DNF|DNS|RT)$/i.test(c[0])||c.length!==expectedColumns||!c[2]))return [];
 return rows;
}
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
function fixtureStart(event){return feedControls.eventStart(event)||new Date(`${event.date}T${event.time||'00:00'}:00+10:00`);}
function eligibleSessions(events,now){
 return events.filter(event=>event.key==='f1'&&Number.isFinite(+fixtureStart(event))&&+fixtureStart(event)<=+now&&+now-fixtureStart(event)<7*86400000&&!['cancelled','postponed','abandoned'].includes(event.status)&&sessionFor(event.name)&&(!sessionFor(event.name).path.startsWith('practice/')||+now>=+fixtureStart(event)+90*60000));
}
function resourcePlan(events,now){
 if(now.getUTCFullYear()!==2026)throw Error('F1 bounded source year has not been reviewed');
 const sessions=new Map();
 for(const event of eligibleSessions(events,now)){
  const identity=String(event.canonicalEventId||'').match(/^event:f1:2026:([a-z]+(?:-[a-z]+)*):(race|qualifying|sprint|sprint-qualifying|practice-[123])$/);
  const kind=sessionFor(event.name).path;
  const expected=identity?.[2]==='race'?'race-result':identity?.[2]==='sprint'?'sprint-results':identity?.[2]?.replace(/^practice-([123])$/,'practice/$1');
  if(!identity||kind!==expected)throw Error('F1 existing session identity disagrees with its source route');
  sessions.set(identity[1]+':'+kind,{slug:identity[1],kind});
 }
 if(sessions.size>5)throw Error('F1 existing-session resource plan exceeds five sessions');
 return [...sessions.values()];
}
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
  const drivers=context.participants.filter(p=>p.type==='competitor' && [p.displayName,p.canonicalName,...(p.metadata?.titleAliases||[])].some(name=>key(name)===key(row[2])));
  const teams=context.participants.filter(p=>p.type==='team' && [p.displayName,p.canonicalName,p.shortName].some(name=>name && (key(name)===key(row[3]) || key(row[3]).includes(key(name)))));
  if(drivers.length!==1||teams.length!==1)throw new Error('Unresolved or ambiguous official F1 result participant '+row[2]);
  return [drivers[0].id,teams[0].id];
 });
 return [...new Set(participants.flat())];
}
async function updatesFor(events,now=new Date(),fetchPage,context=require('../data/canonical/f1-context-2026.json'),{budget:suppliedBudget,report}={}){
 const reviewed=require('./lib/f1-reviewed-classifications');
 const bounded=Boolean(suppliedBudget||!fetchPage);
 const known=eligibleSessions(events,now).filter(event=>{if(!bounded||reviewed.forEvent(event))return true;if(report)report.deferrals.push(reviewed.deferral(event));return false;});if(!known.length)return [];
 const budget=suppliedBudget||(fetchPage?null:require('./lib/f1-source-budget').createBudget({sessions:resourcePlan(known,now)}));
 const retainedFinals=new WeakSet();
 const readPage=(url,consume)=>budget?budget.read(url,consume):Promise.resolve(fetchPage(url)).then(consume);
 try{
 const links=await readPage(`https://www.formula1.com/en/results/${now.getUTCFullYear()}/races`,index=>[...new Set([...index.matchAll(/href="(\/en\/results\/\d{4}\/races\/\d+\/[^/"?]+\/race-result)"/g)].map(m=>m[1]))]),updates=[];
 for(const ev of known){
  const name=ev.name.toLowerCase().replace('italian','italy').replace('spanish','spain').replace('australian','australia').replace('british','great britain').replace('canadian','canada').replace('dutch','netherlands').replace('japanese','japan').replace('chinese','china').replace('belgian','belgium').replace('hungarian','hungary').replace('austrian','austria').replace('brazilian','brazil');
  const link=links.find(l=>budget?l.split('/').at(-2)===ev.canonicalEventId.split(':')[3]:name.includes(l.split('/').at(-2).replaceAll('-',' ')));if(!link){if(report)report.deferrals.push({...reviewed.deferral(ev),reason:'Reviewed GP is absent from the official index'});continue;}
  const session=sessionFor(ev.name);if(!session||['cancelled','postponed','abandoned'].includes(ev.status))continue;
  // Practice result tables can populate during the session. Allow a conservative publication delay.
  if(session.path.startsWith('practice/') && +now < +fixtureStart(ev)+90*60000)continue;
  const url='https://www.formula1.com'+link.replace('race-result',session.path);
  const witness=bounded?reviewed.forEvent(ev):null;if(report?.deferrals.some(row=>row.canonicalEventId===ev.canonicalEventId&&row.reason==='Official session HTTP response unavailable; no retry'))continue;if(witness&&url!==witness.url)throw Error('F1 index-derived GP/session URL disagrees with reviewed identity');
  try{await readPage(url,html=>{const rows=resultRows(html,session.columns.length),fetchedAt=budget?.summary().observations.find(row=>row.url===url)?.observedAt||now.toISOString();
  if(rows.length===0&&session.path==='race-result'&&explicitlyUnavailableRace(html,ev,url)){
   updates.push({...ev,resultStatus:'pending',resultSourceUrl:url,resultSourceCheckedAt:fetchedAt});return;
  }
  if(witness){const reason=reviewed.check(witness,url,html,rows,session.columns.length);if(reason){if(report)report.deferrals.push({...reviewed.deferral(ev),reason});return;}
   try{participantsForResults(rows,context);}catch(error){if(report)report.deferrals.push({...reviewed.deferral(ev),reason:'Unbound or ambiguous official result participant'});return;}
  }
  if(rows.length<10||rows[0][0]!=='1'||new Set(rows.map(row=>row[1])).size!==rows.length||new Set(rows.map(row=>row[2])).size!==rows.length)return;
  const [position,number,driver,team]=rows[0],outcome=`${driver} ${session.verb} ${ev.name}.`;
  // The fetch clock is not a new final observation when the complete official
  // table is unchanged. Repair legacy pre-session clocks only from this table's
  // own retained observation, never a schedule announcement or collection date.
  const validObservation=value=>Number.isFinite(Date.parse(value))&&Date.parse(value)>=+fixtureStart(ev)&&Date.parse(value)<=Date.parse(fetchedAt);
  const sameFinal=ev.status==='completed'&&ev.fixtureResults?.sourceUrl===url
   &&JSON.stringify(ev.fixtureResults.columns)===JSON.stringify(session.columns)
   &&JSON.stringify(ev.fixtureResults.rows)===JSON.stringify(rows);
  if(bounded&&sameFinal){retainedFinals.add(ev);updates.push(ev);return;}
  const observed=sameFinal&&[ev.scoreCheckedAt,ev.fixtureResults.checkedAt].find(validObservation)||fetchedAt;
  updates.push({...ev,participantIds:participantsForResults(rows,context),participants:participantsForResults(rows,context).map(id=>{const p=context.participants.find(p=>p.id===id);return {id,name:p.displayName,displayName:p.displayName,countryCode:p.countryCode};}),participantsConfirmed:true,...(url.includes('/italy/')?{venueCountryCode:'IT'}:{}),status:'completed',resultStatus:'official',resultSourceUrl:url,resultSourceCheckedAt:observed,scoreCheckedAt:observed,fixtureResults:{schemaVersion:'fixture-results.v1',columns:session.columns,rows,sourceUrl:url,checkedAt:observed},score:rows.slice(0,3).map(r=>`${r[0]}. ${r[2]}`).join(' · '),outcomeText:outcome,recapText:`${outcome} ${rows.slice(0,3).map(r=>`${r[0]}. ${r[2]} (${r[3]})`).join('; ')}.`,resultPublishedAt:ev.resultPublishedAt||observed,sourceName:'Formula 1 official session results',sourceUrl:url,sourceCheckedAt:observed});
  });}catch(error){if(!error.f1CardLocal||!report)throw error;report.deferrals.push({...reviewed.deferral(ev),reason:'Official session HTTP response unavailable; no retry'});}
 }
 const projected=updates.map(event=>{
  if(retainedFinals.has(event)||!event.storyline||event.resultStatus==='pending')return event;
  const {storylineFor,spoilerSafeRootCopy}=require('./lib/storyline-card-rules');
  const storyline=storylineFor(event),safe=spoilerSafeRootCopy(event,storyline);
  const next={...event,storyline,selectedSentence:safe.hook,fullSpiel:safe.synopsis};
  delete next.editorialPreview;
  return next;
 });
 budget?.check();return projected;
 }finally{if(!suppliedBudget)budget?.close();}
}
async function main(){const report=await require('./quick-results').atomicRefresh({},{refreshOperation:()=>require('./lib/f1-scoped-refresh').refresh()});console.log(JSON.stringify(report));}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={sessionFor,resultRows,updatesFor,participantsForResults,applyPublishedSchedule,eligibleSessions,resourcePlan};
