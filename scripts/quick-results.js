#!/usr/bin/env node
'use strict';
// Invoked by update-cards --quick. Uses canonical adapters; never loads ladders.
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
const canonical=require('./refresh-canonical-sports');
const tennis=require('./refresh-us-open-events');
const pl=require('./refresh-premier-league-cards');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const {storylineFor,spoilerSafeRootCopy}=require('./lib/storyline-card-rules');
const KEYS=['status','scheduleStatus','startTimeUtc','endTimeUtc','time','date','score','scoreDisplay','result','outcomeText','recapText','homeScore','awayScore','resultPublishedAt','sessionStartTimeUtc','sequenceInSession','timePrecision','sourceName','sourceUrl','sourceCheckedAt'];
function semantic(value){return JSON.stringify(value,(key,v)=>['checkedAt','updatedAt','lastReviewedAt','sourceCheckedAt','statusUpdatedAt','resultPublishedAt'].includes(key)?undefined:v);}
function patchKnown(events,updates){
 let count=0;const byId=new Map(updates.map(e=>[e.id || e.eventId,e]));
 const result=events.map(ev=>{const update=byId.get(ev.id || ev.eventId);if(!update)return ev;const next={...ev};for(const key of KEYS)if(Object.hasOwn(update,key))next[key]=update[key];if(semantic(next)!==semantic(ev)){if(next.status==='completed'&&next.storyline){next.storyline=storylineFor(next);const safe=spoilerSafeRootCopy(next,next.storyline);next.selectedSentence=safe.hook;next.fullSpiel=safe.synopsis;delete next.editorialPreview;}count++;return next;}return ev;});
 return {events:result,count};
}
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Origin:'https://www.afl.com.au',Referer:'https://www.afl.com.au/'}});if(!response.ok)throw new Error(`${response.status} ${url}`);return response.json();}
function run(file,...args){const result=spawnSync(process.execPath,[file,...args],{stdio:'inherit'});if(result.status!==0)throw new Error(`${file} failed`);}
async function refresh({now=new Date(),offline=false}={}){
 const changes=[],failures=[],bundlePath='data/canonical/afl-nrl-2026.json',bundle=read(bundlePath);
 const near=ev=>{const start=Date.parse(ev.startTimeUtc||'');return Number.isFinite(start)&&Math.abs(start-+now)<=7*86400000;};
 const existing=bundle.events.filter(near),created=new Map(bundle.events.map(e=>[e.id,e.createdAt])),updates=[];
 if(!offline){
 for(const code of ['afl','aflw'])try{
   const relevant=existing.filter(e=>e.id.startsWith(`event:${code}:`));if(!relevant.length)continue;
   const seasons=await json(`https://aflapi.afl.com.au/afl/v2/competitions/${code==='afl'?1:3}/compseasons?pageSize=20`);
   const season=seasons.compSeasons.find(s=>s.name.startsWith(String(now.getFullYear())));if(!season)throw new Error('Season unavailable');
   for(const round of new Set(relevant.map(e=>e.roundNumber))){const response=await json(`https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=${season.id}&roundNumber=${round}&pageSize=50`);if(!Array.isArray(response.matches))throw new Error('Malformed matches');updates.push(...response.matches.map(m=>canonical.buildAflEvent(m,now.toISOString(),created,code==='aflw'?{code,competitionId:'competition:aflw-2026',discoverySportId:'sport:aflw'}:{}).event));}
 }catch(error){failures.push(`${code}: ${error.message}`);}
 try{if(existing.some(e=>e.id.startsWith('event:nrl:'))){const response=await json('https://mc.championdata.com/data/12999/fixture.json');if(!Array.isArray(response.fixture?.match))throw new Error('Malformed NRL fixtures');updates.push(...response.fixture.match.map(m=>canonical.buildNrlEvent(m,now.toISOString(),created).event));}}catch(error){failures.push(`nrl: ${error.message}`);}
 }
 const patched=patchKnown(bundle.events,updates.filter(near));if(patched.count){write(bundlePath,{...bundle,events:patched.events});changes.push(`AFL/NRL ${patched.count}`);}
 const majorPath='data/major-events.v1.json',major=read(majorPath),us=major.events.find(e=>e.id==='major:us-open-2026'||/US Open 2026/.test(e.name));
 if(!offline&&us&&us.startDate<=now.toISOString().slice(0,10)&&us.endDate>=now.toISOString().slice(0,10))try{
   const snapshot=await tennis.fetchOfficialSnapshot({quick:true,now,cached:read('feeds/provider-exports/tennis/us-open-2026-official-schedule.json')});tennis.fixturesFromSnapshot(snapshot);
   const next=tennis.mergeCatalogue(major,snapshot);
   // Only persist semantic fixture changes, not fetch timestamps.
   const clean=value=>JSON.stringify(value,(key,v)=>['statusUpdatedAt','capturedAt','updatedAt','checkedAt','generatedAt'].includes(key)?undefined:v);
   if(clean(next)!==clean(major)){write(majorPath,next);write('feeds/provider-exports/tennis/us-open-2026-official-schedule.json',snapshot);changes.push('US Open schedule/results');}
 }catch(error){failures.push(`tennis: ${error.message}`);}
 if(!offline)try{
   const doc=read('feeds/incoming/events.json'),known=doc.events.filter(e=>e.key==='premier-league'&&near(e));
   if(known.length){const fixtures=await pl.loadFixtures();const cards=fixtures.map(f=>pl.cardForFixture(f,now.toISOString()));const result=patchKnown(doc.events,cards.filter(near));if(result.count){write('feeds/incoming/events.json',{...doc,events:result.events});changes.push(`Premier League ${result.count}`);}}
 }catch(error){failures.push(`Premier League: ${error.message}`);}
 if(!offline)try{const doc=read('feeds/incoming/events.json'),updates=await require('./refresh-f1-results').updatesFor(doc.events,now),patched=patchKnown(doc.events,updates);if(patched.count){write('feeds/incoming/events.json',{...doc,events:patched.events});changes.push(`F1 ${patched.count}`);}}catch(error){failures.push(`F1: ${error.message}`);}
 if(changes.length||process.argv.includes('--rebuild')){
   run('scripts/enrich-storyline-cards.js','--write');
   run('scripts/sync-canonical-fixtures-to-feed.js',bundlePath,'feeds/incoming/events.json','feeds/incoming/events.json');
   run('scripts/refresh-major-events-from-canonical.js');
   run('scripts/select-result-editorial.js');
   run('scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--replace');
   run('scripts/build-follow-fixtures.js');run('scripts/build-paged-feed.js');run('scripts/build-code-inspector.js');
   run('scripts/validate-feed-coverage-resilience.js');run('scripts/validate-feed.js','data/events.json');run('scripts/validate-crowd-foresight.js');
 }
 if(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY)run('scripts/settle-nsc-foresight.js');
 console.log(JSON.stringify({mode:'quick',changed:changes,failures,aiCalls:0}));
 if(failures.length&&!changes.length&&!offline)throw new Error('Quick sources failed; preserved last-known-good data.');
 return {changes,failures};
}
async function atomicRefresh(options){
 const files=new Map();function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isDirectory())collect(name);else if(/\.(json|js)$/.test(name))files.set(name,fs.readFileSync(name));}}
 collect('data');collect('feeds');
 try{return await refresh(options);}catch(error){const after=new Map(files);files.clear();collect('data');collect('feeds');for(const name of files.keys())if(!after.has(name))fs.unlinkSync(name);for(const [name,content] of after)fs.writeFileSync(name,content);throw error;}
}
if(require.main===module)atomicRefresh({offline:process.argv.includes('--offline')}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={patchKnown,refresh,KEYS};
