'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const schedule=require('../data/canonical/nbl-2026-27.json');
const loader=require('./refresh-nbl-schedule');
const output=path.resolve(__dirname,'../data/canonical/nbl-2026-27.json');
const sourceUrl='https://schedule.nbl.com.au/api/calendar/schedule?league=nbl&limit=500&offset=0&year=2026';

async function run(){
 const teams=new Map(schedule.participants.map((p,i)=>[p.id,{name:p.displayName,position:i+1,wins:0,losses:0}]));
 for(const f of schedule.events.filter(e=>e.status==='completed'))for(let i=0;i<2;i++)teams.get(f.participantIds[i])[f.result.homeScore>f.result.awayScore?i===0?'wins':'losses':i===1?'wins':'losses']++;
 const payload={leaguePath:'nbl',year:2026,fallback:false,offset:0,total:165,seasons_meta:[{id:'constructed-season',name:'NBL27',season_type:'regular',match_count:165}],matches:schedule.events.map(f=>({id:f.providerId,season_id:'constructed-season',season_type:'regular',starts_at_ms:Date.parse(f.startTimeUtc),round_label:String(f.roundNumber),phase:f.status==='completed'?'complete':f.status==='live'?'live':'upcoming',home:{...teams.get(f.participantIds[0])},away:{...teams.get(f.participantIds[1])},home_score:f.result?.homeScore,away_score:f.result?.awayScore,venue_name:f.venue,primary_broadcaster:{label:'ESPN'}}))};
 const prior=schedule.events.find(e=>e.status==='completed'&&e.result?.checkedAt);
 assert(prior,'Require retained completed NBL fixture');
 const originals={fetch:global.fetch,exists:fs.existsSync,read:fs.readFileSync,write:fs.writeFileSync,log:console.log,warn:console.warn};
 const cases=[];let active,requests,writes,captured;
 const isOutput=file=>(typeof file==='string'||file instanceof URL)&&path.resolve(String(file))===output;
 global.fetch=async(url,options)=>{assert.equal(url,sourceUrl);assert(options.signal instanceof AbortSignal);assert.equal(++requests,1,'One existing provider request per constructed caller case');return {ok:true,json:async()=>structuredClone(payload)};};
 fs.existsSync=file=>isOutput(file)?true:originals.exists(file);
 fs.readFileSync=(file,...args)=>isOutput(file)?JSON.stringify(active):originals.read(file,...args);
 fs.writeFileSync=(file,body)=>{assert(isOutput(file),'Actual caller must write only its declared canonical output');assert.equal(++writes,1);captured=JSON.parse(body);};
 console.log=()=>{};console.warn=()=>{};
 async function caller(name,edit,{retain=false}={}){
  active=structuredClone(schedule);edit?.(active.events.find(e=>e.id===prior.id),active);
  requests=0;writes=0;captured=null;
  const started=Date.now();await loader.main();const finished=Date.now();
  assert.equal(requests,1);assert.equal(writes,1);assert(captured);
  const result=captured.events.find(e=>e.id===prior.id),old=active.events.find(e=>e.id===prior.id);
  if(retain)assert.equal(result.result.checkedAt,old.result.checkedAt,name+': unchanged final retains its original observation');
  else {assert(Date.parse(result.result.checkedAt)>=started&&Date.parse(result.result.checkedAt)<=finished,name+': genuine new observation');assert.notEqual(result.result.checkedAt,prior.result.checkedAt);}
  assert.equal(captured.standings.length,10);assert.equal(captured.standingsStatus,'current');
  assert.equal(captured.generatedAt,captured.sources['nbl27-schedule'].checkedAt,'Collection clock remains separate');
  assert(captured.standings.every(row=>row.asOf===captured.generatedAt),'Current table verification keeps its own collection clock');
  assert(result.viewingOptions.length>0&&result.viewingOptions.every(option=>option.verifiedAt===captured.generatedAt),'Constructed broadcaster verification is not replaced by an old result observation');
  cases.push(name);return captured;
 }
 try{
  const unchanged=await caller('unchanged canonical final',null,{retain:true});
  const parsed=unchanged.events.find(e=>e.id===prior.id);
  const adapter=require('./sync-requested-sports-to-feed'),patcher=require('./lib/known-fixture-patch');
  const card=adapter.cardForEvent(parsed,unchanged,new Map(unchanged.participants.map(p=>[p.id,p])));
  const first={...card,scoreCheckedAt:prior.result.checkedAt,resultSourceCheckedAt:prior.result.checkedAt};
  const repeated=patcher.patchKnown([first],[card]);assert.equal(repeated.count,0);assert.equal(repeated.events[0].scoreCheckedAt,prior.result.checkedAt);
  assert.deepEqual(loader.build(payload,schedule.generatedAt).standings,loader.build(payload,schedule.generatedAt,schedule.standings,schedule.events).standings,'Prior-event support cannot change table calculation or old API');
  cases.push('standings API and Feed independent-clock preservation');
  await caller('corrected score',e=>{e.result.homeScore+=1;e.result.score='changed';});
  await caller('new final',e=>{e.status='upcoming';delete e.result;});
  for(const field of ['id','providerId','competitionId','season','sourceId','codeId','sportKey'])await caller('changed '+field,e=>{e[field]='unknown:'+field;});
  await caller('changed participant identity',e=>{e.participantIds[0]='unknown:participant';});
  await caller('changed participant order',e=>{e.participantIds.reverse();});
  await caller('changed kickoff',e=>{e.startTimeUtc=new Date(Date.parse(e.startTimeUtc)+60000).toISOString();});
  await caller('changed source inside result',e=>{e.result.sourceId='unknown:result-source';});
  await caller('unknown result field',e=>{e.result.meaningfulFutureField='must not be omitted';});
  await caller('missing prior row',(e,d)=>{d.events=d.events.filter(row=>row.id!==prior.id);});
  await caller('duplicate prior stable ID',(e,d)=>{d.events.push(structuredClone(e));});
  await caller('duplicate prior provider ID',(e,d)=>{d.events.push({...structuredClone(e),id:'unknown:duplicate-provider'});});
  for(const clock of [null,'invalid','2026-02-30T00:00:00.000Z',new Date(Date.parse(prior.startTimeUtc)-1).toISOString(),new Date(Date.now()+86400000).toISOString()])await caller('invalid prior clock '+String(clock),e=>{e.result.checkedAt=clock;});
  await caller('reordered result object keys',e=>{e.result=Object.fromEntries(Object.entries(e.result).reverse());},{retain:true});
 }finally{global.fetch=originals.fetch;fs.existsSync=originals.exists;fs.readFileSync=originals.read;fs.writeFileSync=originals.write;console.log=originals.log;console.warn=originals.warn;}
 console.log('NBL result observations: '+cases.length+' actual-caller controls passed with virtual output and constructed provider responses; no actual network or file writes.');
 return cases;
}
if(require.main===module)run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={run};
