"use strict";
const fs=require('node:fs'),path=require('node:path');
const document=structuredClone(require('../data/canonical/athlete-participation.v1.json'));
require('../lib/athlete-participation').materializeParticipation(document);
const enrichments=require('../data/discovery/enrichment.v1.json').events;
const registry=new Map(require('../lib/discovery-sources').athleteRegistry().map(athlete=>[athlete.id,athlete]));
for(const id of new Set(enrichments.flatMap(event=>(event.participationEvidence||[]).map(entry=>entry.participantId)))){
  let athlete=document.athletes.find(athlete=>athlete.id===id);
  if(!athlete&&registry.has(id)){athlete={...registry.get(id),history:[]};document.athletes.push(athlete);}
  if(athlete)athlete.history.push(...require('../lib/athlete-participation').participationHistory(enrichments,id));
}
const file=path.join(__dirname,'../data/canonical/athlete-participation.v1.js');
const content=`globalThis.NOTHINGSPORTS_ATHLETE_PARTICIPATION=${JSON.stringify(document)};\n`;
if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content){
  if(process.argv.includes('--check'))throw new Error('Athlete participation browser snapshot is stale');
  fs.writeFileSync(file,content);
}
console.log('Athlete participation: verified entries and browser history snapshot ready.');
