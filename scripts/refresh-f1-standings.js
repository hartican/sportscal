#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
function clean(value){return value.replace(/<span class="md:hidden">[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
function rows(html){const body=html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1]||'';return [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(row=>[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell=>clean(cell[1]))).filter(row=>/^\d+$/.test(row[0]));}
function key(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function update(context, driverRows, teamRows, now = new Date()){
  if(driverRows.length<22 || teamRows.length!==11)throw new Error('Incomplete official F1 standings; preserving previous snapshot');
  const next=structuredClone(context);
  const snapshots=[];
  for(const [kind,table,type] of [['drivers',driverRows,'competitor'],['constructors',teamRows,'team']]){
    const entries=table.map((row,index)=>{
      if(Number(row[0])!==index+1 || !Number.isFinite(Number(row.at(-1))))throw new Error('Invalid official F1 standing');
      const name=row[1];
      let participant=next.participants.find(p=>p.type===type && [p.displayName,p.canonicalName,p.shortName,...(p.metadata?.titleAliases||[])].some(alias=>key(alias)===key(name)));
      if(!participant && type==='team')participant=next.participants.find(p=>p.type===type && key(name).includes(key(p.shortName)));
      if(!participant){
        if(type==='team')throw new Error('Unresolved official F1 constructor '+name);
        const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        participant={id:`competitor:f1:${slug}`,type,sportDomainId:'sport:motorsport',displayName:name,canonicalName:name,countryCode:require('../config/country-flags').alpha2(row[2]),metadata:{standingsOnly:true},sourceUrl:'https://www.formula1.com/en/results/2026/drivers'};
        next.participants.push(participant);
      }
      const team=type==='competitor'?next.participants.find(p=>p.type==='team' && [p.displayName,p.canonicalName,p.shortName].some(alias=>alias && (key(row[3])===key(alias) || key(row[3]).includes(key(alias))))):null;
      if(type==='competitor'&&!team)throw new Error('Unresolved official driver constructor '+row[3]);
      if(team)participant.metadata={...participant.metadata,teamParticipantId:team.id};
      return {participantId:participant.id,rank:index+1,points:Number(row.at(-1)),...(team?{teamName:row[3],teamParticipantId:team.id}:{})};
    });
    const sourceUrl=`https://www.formula1.com/en/results/${context.season}/${kind==='drivers'?'drivers':'team'}`;
    snapshots.push({id:`standings:f1-${kind}-${context.season}:current`,competitionId:`competition:f1-${kind}-${context.season}`,seasonLabel:String(context.season),roundLabel:'Current championship standings',snapshotTimeUtc:now.toISOString(),entries,sourceUrl,source:{provider:'Formula 1',sourceUrl,sourceType:'official',checkedAt:now.toISOString()},metadata:{standingsType:kind}});
  }
  next.ladderSnapshots=snapshots;next.generatedAt=now.toISOString();return next;
}
async function main(){
  const path='data/canonical/f1-context-2026.json',context=JSON.parse(fs.readFileSync(path));
  const tables=await Promise.all(['drivers','team'].map(async kind=>{const response=await fetch(`https://www.formula1.com/en/results/${context.season}/${kind}`,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('F1 standings source '+response.status);return rows(await response.text());}));
  const result=update(context,...tables);fs.writeFileSync(path,JSON.stringify(result,null,2)+'\n');console.log(`F1 standings: ${tables[0].length} drivers and ${tables[1].length} constructors from official current tables.`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={rows,update};
