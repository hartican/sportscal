#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ingestion=require('./refresh-motogp-sessions'),art=require('../config/venue-artwork'),policy=require('../config/follow-feed-policy'),presentation=require('../config/feed-card-presentation');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const schedule=read('data/canonical/fiba-women-sailgp-motogp-2026.json');
const records=schedule.events.filter(e=>e.sportKey==='motogp');
const now=new Date(schedule.generatedAt),year=Number(ingestion.local(now.toISOString()).date.slice(0,4));
const calendars=[year,year+1].map(y=>read(`feeds/provider-exports/motogp/calendar-${y}.v1.json`));
const expected=calendars.flatMap(d=>ingestion.eventsFor(d,schedule.participants.filter(p=>p.sportKey==='motogp'),now));
assert.deepEqual(records.map(e=>e.id).sort(),expected.map(e=>e.id).sort(),'official calendar reconciliation must cover every session/window exactly once');
for(const event of expected){
 const actual=records.find(e=>e.id===event.id);
 for(const key of ['date','time','startTimeUtc','endDate','venueConfigurationId','sessionType'])assert.equal(actual[key],event[key],`${event.id}: ${key}`);
 assert.equal(policy.feedEligibleSession({...event,key:'motogp'}),!['practice','practice-1','practice-2','warmup'].includes(event.sessionType));
 if(event.timeTbc){assert.equal(event.startTimeUtc,undefined);assert.equal(event.timePrecision,'date-only');assert(event.endDate);assert.deepEqual(event.participantIds,[]);}
 if(event.sessionType==='qualifying'&&!event.timeTbc)assert.equal(event.sourceSessionIds.length,2);
}
for(const document of calendars){
 const generated=expected.filter(e=>e.season===String(document.year));
 const weekends=new Set(generated.map(e=>e.weekendId));
 if(document.year===year)assert.equal(weekends.size,document.weekends.length);
 for(const weekend of weekends)assert.deepEqual(generated.filter(e=>e.weekendId===weekend&&!policy.isPractice(e)).map(e=>e.sessionType).sort(),['qualifying','race','sprint']);
 // Provider order changes do not change qualifying identity or timing.
 const corrected=structuredClone(document);if(corrected.weekends[0].sessions.length){corrected.weekends[0].sessions.forEach(x=>{x.date_start=new Date(Date.parse(x.date_start)+60000).toISOString();x.date_end=new Date(Date.parse(x.date_end)+60000).toISOString();});assert.deepEqual(ingestion.eventsFor(corrected,[],now).map(e=>e.id),ingestion.eventsFor(document,[],now).map(e=>e.id),'source corrections retain IDs');}
 const reversed={...document,weekends:document.weekends.map(w=>({...w,sessions:[...w.sessions].reverse()}))};
 const a=ingestion.eventsFor(reversed,[],now).filter(e=>e.sessionType==='qualifying');
 const b=ingestion.eventsFor(document,[],now).filter(e=>e.sessionType==='qualifying');
 assert.deepEqual(a,b);
 const partial=structuredClone(document);partial.weekends[0].sessions=partial.weekends[0].sessions.filter(s=>s.shortname!=='Q2');
 if(document.weekends[0].sessions.some(s=>s.shortname==='Q2'))assert.throws(()=>ingestion.eventsFor(partial,[],now),/incomplete combined qualifying/);
}
const manifest=read('assets/identities/motogp/asset-manifest.json');
for(const a of manifest.assets.filter(a=>a.mappingStatus==='verified-venue')){assert(!a.attachment,'mapped current artwork uses native sourced vectors');assert(a.vectorExtraction&&a.sourceUrl.endsWith('.svg'));const crypto=require('node:crypto'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),source=fs.readFileSync(path.join(root,a.sourceFile),'utf8'),vector=fs.readFileSync(path.join(root,a.path),'utf8');assert.equal(hash(source),a.sourceSha256);const d=vector.match(/<path\b[^>]*\bd="([^"]+)"/)[1];assert.equal(hash(d),a.vectorExtraction.pathSha256);assert(source.includes('d="'+d+'"'),'official source path remains byte-exact');assert.equal(a.vectorExtraction.candidateCount,1,'one verified main race route');assert(vector.includes('matrix('+a.vectorExtraction.matrix.join(' ')+')'));}
for(const asset of manifest.assets){
 const svg=fs.readFileSync(path.join(root,asset.path),'utf8');assert.match(svg,/<path\b/);assert.doesNotMatch(svg,/<image\b|data:image|<script\b/i);assert.match(svg,/viewBox=/);
 assert.match(asset.sourceUrl,/^https:\/\/(?:www.flaticon.com\/free-icon\/|photos.motogp.com\/|commons.wikimedia.org\/wiki\/)/);assert(asset.author&&asset.modifications&&asset.licenseUrl);
 if(asset.path.includes('/circuits/'))assert.equal(asset.presentation,'track-outline');
 if(asset.mappingStatus==='verified-venue')assert.equal(art.motogp[asset.venueConfigurationId],asset.id);
}
for(const event of records){
 assert.equal(require('../config/venue-registry').resolve(event.venue,{...event,key:'motogp'}).audited,true,'verified venue metadata must resolve in the shared registry');
 const resolved=art.resolve({...event,key:'motogp'});assert(fs.existsSync(path.join(root,resolved.path)));
 if(event.venue==='Bugatti Circuit')assert.match(resolved.path,/bugatti/);
 assert.equal(art.resolve({...event,key:'motogp',venueConfigurationVerified:false}).kind,'fallback');
}
for(const code of ['ARG']){
 const w=calendars.flatMap(d=>d.weekends).find(w=>w.shortname===code);
 assert.equal(art.resolve({key:'motogp',venueConfigurationVerified:true,venueConfigurationId:w.circuit.trackId}).kind,'fallback',`${code} must not receive an unverified/different layout`);
}
for(const w of calendars[0].weekends){
 assert(art.motogp[w.circuit.trackId],`${w.shortname}: current-season configuration needs artwork`);
}
assert.equal(art.motogp['50941f7f-e112-4404-8dcf-5fb2c47e9617'],'goiania');
const raw=calendars[0].weekends.map(w=>({...w,kind:'GP',circuit:{...w.circuit,iso_code:w.country,tracks:[{id:w.circuit.trackId,is_active:w.shortname!=='BRA',lenght:w.circuit.lengthMetres,assets:{simple:{path:w.circuit.mapSourceUrl}}}]}}));
assert.equal(ingestion.snapshot(raw,2026,now.toISOString()).weekends.find(w=>w.shortname==='BRA').circuit.configurationVerified,true);
for(const mutation of [r=>r.circuit.id+='-changed',r=>r.circuit.tracks[0].id+='-changed',r=>r.circuit.tracks[0].lenght=4000,r=>r.circuit.tracks[0].assets.simple.path+='?changed']){
 const changed=structuredClone(raw);mutation(changed.find(w=>w.shortname==='BRA'));
 assert.equal(ingestion.snapshot(changed,2026,now.toISOString()).weekends.find(w=>w.shortname==='BRA').circuit.configurationVerified,false,'reviewed inactive-layout override must reject a changed source/configuration');
}
assert.equal(ingestion.snapshot(raw,2028,now.toISOString()).weekends.find(w=>w.shortname==='BRA').circuit.configurationVerified,false,'override cannot grant future-season consent');
assert.deepEqual(presentation.palette({key:'motogp'}),['#526174','#384657']);
assert.equal(presentation.circuitAsset({key:'f1',venue:'Silverstone Circuit'}),'assets/identities/f1/circuits/gb-1948.svg');
for(const file of ['feeds/incoming/events.json','data/events.json']){
 const cards=read(file).events.filter(e=>e.key==='motogp');
 const ids=new Set(cards.map(c=>c.id));assert.equal(ids.size,cards.length,'no duplicate card IDs');
 for(const event of records)assert.equal(cards.filter(c=>c.canonicalEventId===event.id).length,1,`${file}: ${event.id}`);
 for(const slug of ['san-marino','austria','japan','indonesia','australia','malaysia','qatar','portugal','valencia'])assert(cards.some(c=>c.id===`evt_motogp_2026_${slug.replaceAll('-','_')}`),'established identity must remain stable');
}
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-motogp-test-'));
 try{
  const sourceDirectory=path.join(tmp,'sources'),schedulePath=path.join(tmp,'schedule.json');fs.mkdirSync(sourceDirectory);fs.writeFileSync(schedulePath,JSON.stringify(schedule));
  for(const doc of calendars)fs.writeFileSync(path.join(sourceDirectory,`calendar-${doc.year}.v1.json`),JSON.stringify(doc));
  const result=await ingestion.refresh({schedulePath,sourceDirectory,now,fetchImpl:async()=>{throw Error('test source unavailable');}});
  assert.equal(result.complete,false);assert.equal(result.failures.length,2);
  assert.deepEqual(JSON.parse(fs.readFileSync(schedulePath)).events,schedule.events,'source failure must preserve verified schedule data');
  const currentRaw=raw.map((w,i)=>({...w,broadcasts:calendars[0].weekends[i].sessions.map(s=>({...s,type:'SESSION',category:{acronym:'MGP'}}))}));
  await ingestion.refresh({schedulePath,sourceDirectory,now,fetchImpl:async url=>{if(url.endsWith(String(year+1)))throw Error('future edition unavailable');return {ok:true,json:async()=>currentRaw};}});
  const partial=JSON.parse(fs.readFileSync(schedulePath));
  assert.deepEqual(partial.events.filter(e=>e.sportKey!=='motogp'||e.season===String(year+1)),schedule.events.filter(e=>e.sportKey!=='motogp'||e.season===String(year+1)),'partial source failure preserves the failed edition and every other sport exactly');
  console.log(`MotoGP pilot: ${records.length} official session/window records, ${manifest.assets.length} SVGs, stable IDs, practice exclusion, timetable uncertainty and failed-source preservation passed.`);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
