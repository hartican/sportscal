#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {day,add}=require('./lib/tournament-horizon');
const bjk=require('./refresh-bjk-cup');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const semantic=value=>JSON.stringify(value,(key,v)=>/^(checkedAt|sourceCheckedAt|generatedAt|updatedAt|capturedAt)$/.test(key)?undefined:v);
function eligible(t,today){const start=t.startDate||t.date,end=t.endDate||start;return !!start&&!!end&&!(end<today&&(t.status==='completed'||t.winners?.length))&&!['ticket_sale','season'].includes(t.kind)&&!/^ticket[-:]|tickets on sale/i.test(t.id||t.name||'')&&start<=add(today,7)&&end>=add(today,-7);}
function inventory(today=day()){
 const tournaments=new Map(),schedules=[];
 for(const name of fs.readdirSync('data/follow-schedule').filter(n=>n.endsWith('.json'))){const doc=read('data/follow-schedule/'+name);schedules.push(...(doc.fixtures||[]).map(f=>({...f,code:doc.code.slug||doc.code.id.replace('sport:','')})));}
 function put(t){const id=t.tournamentId||t.id;if(id)tournaments.set(id,{...tournaments.get(id),...t,tournamentId:id});}
 for(const f of schedules)if(f.tournamentId||f.endDate&&f.endDate!==f.date&&!f.participantSlots?.length){const id=f.tournamentId||f.id,previous=tournaments.get(id);put({...f,tournamentId:id,name:f.tournamentName||f.name,startDate:previous?.startDate&&previous.startDate<f.date?previous.startDate:f.date,endDate:[previous?.endDate,f.endDate||f.date].filter(Boolean).sort().at(-1)});}
 for(const t of read('data/canonical/tennis-catalogue-2026.json').tournaments)put({...t,code:'tennis'});
 for(const t of read('data/canonical/pga-tour-schedule.json').tournaments)put({...t,tournamentId:t.id,code:'golf'});
 for(const t of read('data/major-events.v1.json').events){if(t.kind==='ticket_sale'||!t.startDate||!t.endDate)continue;put({...t,code:t.key||t.sportKey||t.sport||'unknown'});}
 return [...tournaments.values()].filter(t=>eligible(t,today)).map(t=>({...t,fixtures:schedules.filter(f=>(f.tournamentId===t.tournamentId||f.parentId===t.tournamentId)&&f.id!==t.tournamentId&&!/tennis-tournament-/.test(f.id)&&!(f.dateOnly&&f.detailsUnavailable))}));
}
// Calendar-only providers are intentionally not advertised as complete draws.
const ADAPTERS={
 bjk:{codes:['tennis'],coverage:'fixtures',files:['data/canonical/tennis-team-contests.v1.json']},
 pga:{codes:['golf'],coverage:'calendar',script:'scripts/refresh-pga-schedule.js',files:['data/canonical/pga-tour-schedule.json']},
 wrc:{codes:['wrc'],coverage:'calendar',script:'scripts/refresh-wrc-context.js',files:['data/canonical/wrc-context-2026.json']},
 coverage:{codes:['cricket','rugby-union'],coverage:'fixtures',script:'scripts/refresh-source-coverage.js',files:['data/follow-sources/coverage.v1.json']},
 official:{codes:['basketball','ice-hockey','hockey','netball'],coverage:'fixtures',script:'scripts/refresh-official-follow-fixtures.js',files:['data/follow-sources/official.v1.json']},
};
function adapterFor(t){
 const id=t.tournamentId||'',code=String(t.code).toLowerCase();
 if(id===bjk.TOURNAMENT)return 'bjk';
 if(/^R\d{7}$/.test(id))return 'pga';
 if(/wrc/.test(code+' '+id))return 'wrc';
 if(/cricket|rugby-union/.test(code))return 'coverage';
 if(/basketball|ice-hockey|netball|^hockey$/.test(code))return 'official';
 return null;
}
function run(script,args=[]){const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',timeout:180000});if(result.error||result.status!==0)throw new Error(result.error?.message||`${script} failed (${result.status})`);}
function assess(t,adapter,status,today=day()){
 const real=(t.fixtures||[]).filter(f=>!['provisional','unconfirmed'].includes(f.status)&&!f.detailsUnavailable);
 const issues=[];
 if(!adapter)issues.push('No supported fixture adapter');
 if(adapter&&ADAPTERS[adapter].coverage==='calendar')issues.push('Provider covers tournament calendar; detailed rounds/sessions require another source');
 if(!real.length)issues.push('No published child fixtures hydrated');
 if(status?.error)issues.push(status.error);
 if(status?.failures?.length)issues.push(...status.failures.map(f=>`${f.source}: ${f.error}`));
 if(adapter==='bjk'&&real.length!==7)issues.push(`Expected seven ties; found ${real.length}`);
 const due=real.filter(f=>f.date<today&&!['completed','cancelled','abandoned','postponed'].includes(f.status));
 if(due.length)issues.push(`${due.length} past fixtures have unresolved results`);
 // Non-BJK adapters do not expose a published expected count. Never infer
 // completeness simply from a non-empty result list.
 if(adapter&&adapter!=='bjk'&&real.length)issues.push('Published fixture completeness is not attested by this adapter');
 return {tournamentId:t.tournamentId,name:t.name,code:t.code,startDate:t.startDate||t.date,endDate:t.endDate,adapter,fixtureCount:real.length,status:issues.length?'partial':'complete',issues};
}
async function refresh({now=new Date(),offline=false,mode='quick',runAdapter=null,inventoryFn=inventory,reportPath=process.env.TOURNAMENT_HYDRATION_REPORT||path.join(os.tmpdir(),'sportscal-tournament-hydration-report.json')}={}){
 const today=day(now),before=inventoryFn(today),statuses={},codes=new Set(),changed=[];
 const adapters=[...new Set(before.map(adapterFor).filter(Boolean))];
 for(const id of adapters){
  const adapter=ADAPTERS[id];
  if(offline){statuses[id]={error:'Offline: source not checked'};continue;}
  const snapshots=new Map((runAdapter?[]:adapter.files).filter(f=>fs.existsSync(f)).map(f=>[f,fs.readFileSync(f)]));
  try{
   let result;
   if(runAdapter)result=await runAdapter(id);
   else if(id==='bjk')result=await bjk.refresh({now});
   else if(mode==='full')result={}; // Full pipeline has already run these sources.
   else {run(adapter.script);result={};}
   statuses[id]=result||{};
   for(const [file,bytes]of snapshots){const after=fs.readFileSync(file);if(semantic(JSON.parse(bytes))===semantic(JSON.parse(after)))fs.writeFileSync(file,bytes);else {changed.push(file);adapter.codes.forEach(c=>codes.add(c));}}
  }catch(e){for(const [file,bytes]of snapshots)fs.writeFileSync(file,bytes);statuses[id]={error:e.message};}
 }
 // Rebuild affected projections once, through their existing builders. This
 // occurs before parent/horizon publication in both canonical entry paths.
 if(codes.size){run('scripts/build-code-inspector.js',[`--codes=${[...codes].join(',')}`]);if(codes.has('tennis'))run('scripts/build-follow-directories.js',['--codes=tennis']);}
 const current=inventoryFn(today),report={schemaVersion:'tournament-hydration-report.v1',checkedAt:now.toISOString(),from:today,through:add(today,7),offline,tournaments:current.map(t=>assess(t,adapterFor(t),statuses[adapterFor(t)],today)),changed,codes:[...codes]};
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(`Tournament hydration: ${report.tournaments.length} in window; ${report.tournaments.filter(t=>t.status==='complete').length} complete; ${report.tournaments.filter(t=>t.status==='partial').length} with reported gaps. Report: ${reportPath}`);
 for(const t of report.tournaments.filter(t=>t.issues.length))console.log(`  ${t.name}: ${t.issues.join('; ')}`);
 return report;
}
if(require.main===module){if(process.argv.includes('--probe'))console.log(JSON.stringify({status:inventory().length?'active':'inactive',tournaments:inventory().map(t=>t.tournamentId)}));else refresh({offline:process.argv.includes('--offline'),mode:process.argv.includes('--full')?'full':'quick'}).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={eligible,inventory,adapterFor,assess,refresh,ADAPTERS};
