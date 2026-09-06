#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),feedControls=require('../config/feed-controls');
function text(html){return html.replace(/<span class="md:hidden">[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function resultRows(html){const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1];if(!body)return [];return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1]))).filter(c=>/^\d+$/.test(c[0])&&c.length>=7&&c[2]);}
async function fetchText(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`F1 source ${r.status}`);return r.text();}
async function updatesFor(events,now=new Date(),fetchPage=fetchText){
 const known=events.filter(e=>e.key==='f1'&&feedControls.eventStart(e)&&Math.abs(feedControls.eventStart(e)-now)<7*86400000&&feedControls.eventStart(e)<=now);if(!known.length)return [];
 const index=await fetchPage(`https://www.formula1.com/en/results/${now.getUTCFullYear()}/races`),links=[...new Set([...index.matchAll(/href="(\/en\/results\/\d{4}\/races\/\d+\/[^/"?]+\/race-result)"/g)].map(m=>m[1]))],updates=[];
 for(const ev of known){
  const name=ev.name.toLowerCase().replace('italian','italy').replace('australian','australia').replace('british','great britain').replace('canadian','canada').replace('dutch','netherlands').replace('japanese','japan').replace('chinese','china').replace('belgian','belgium').replace('hungarian','hungary').replace('austrian','austria').replace('brazilian','brazil');
  const link=links.find(l=>name.includes(l.split('/').at(-2).replaceAll('-',' ')));if(!link)continue;
  const session=/qualifying/i.test(ev.name)?'qualifying':/sprint/i.test(ev.name)?'sprint-results':/race|grand prix/i.test(ev.name)?'race-result':null;if(!session)continue;
  const url='https://www.formula1.com'+link.replace('race-result',session),rows=resultRows(await fetchPage(url));if(rows.length<10||rows[0][0]!=='1')continue;
  const [position,number,driver,team]=rows[0],outcome=session==='qualifying'?`${driver} took pole for ${ev.name}.`:`${driver} won ${ev.name}.`;
  updates.push({...ev,status:'completed',score:rows.slice(0,3).map(r=>`${r[0]}. ${r[2]}`).join(' · '),outcomeText:outcome,recapText:`${outcome} ${rows.slice(0,3).map(r=>`${r[0]}. ${r[2]} (${r[3]})`).join('; ')}.`,resultPublishedAt:ev.resultPublishedAt||now.toISOString(),sourceName:'Formula 1 official session results',sourceUrl:url,sourceCheckedAt:now.toISOString()});
 }
 return updates;
}
async function main(){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path,'utf8')),updates=await updatesFor(doc.events),map=new Map(updates.map(e=>[e.id,e]));doc.events=doc.events.map(e=>map.get(e.id)||e);if(updates.length)fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');console.log(`Official F1 results: ${updates.length} known sessions updated.`);}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={resultRows,updatesFor};
