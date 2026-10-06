'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const api=require('./lib/reviewed-calendar-notes'),feed=require('./lib/feed-utils'),identity=require('../config/fixture-identity'),reminder=require('../config/fixture-reminder-policy'),calendar=require('../config/calendar-export');
const root=path.resolve(__dirname,'..'),document=require('../data/events.json'),clone=x=>JSON.parse(JSON.stringify(x));
const ids=['calendar-nothingsport-manual-seed-goodwood-festival-of-speed-2027','calendar-nothingsport-manual-seed-uci-downhill-mtb-world-cup-2026'];
const seeds=ids.map(id=>{const event=clone(document.events.find(e=>e.id===id));return event.importedSeedFacts?{...event,...event.importedSeedFacts,calendarNote:undefined,importedSeedFacts:undefined,cardKind:undefined}:event;});
for(const seed of seeds){
 const note=api.qualify(seed);
 assert.equal(note.cardKind,'calendar-note','Imported clock must become a reviewed calendar note');
 assert(!note.date&&!note.startTimeUtc&&!note.endTimeUtc,'No imported appointment may remain');
 assert.equal(note.expected,null);assert.equal(reminder.timing(note),null);assert.equal(calendar.knownDate(note),false);
 assert(!calendar.buildIcs([note]).includes('BEGIN:VEVENT'));
 assert.equal(feed.validateFeed(feed.normalizeFeed({...document,events:[note]})).length,0);
 assert.deepEqual(api.qualify(note),note);
 if(seed.id===ids[0])assert.deepEqual(note.calendarNote.localDateWindow,{from:'2027-07-15',through:'2027-07-18',timeZone:'Europe/London'});
 else {assert.equal(note.venue,null);assert.equal(note.calendarNote.identityStatus,'unmatched');assert(!note.calendarNote.localDateWindow);}
 assert.equal(note.sourceCheckedAt,seed.sourceCheckedAt);assert.equal(note.statusCheckedAt,seed.statusCheckedAt);
 assert.equal(note.importedSeedFacts.startTimeUtc,seed.importedSeedFacts?.startTimeUtc||seed.startTimeUtc);
 for(const change of [{id:'unreviewed-note'},{startTimeUtc:'2027-07-10T00:00:00Z'},{date:'2027-07-10'},{score:'1-0'},{expected:7},{participantIds:['invented']},{viewingOptions:[{providerId:'sky'}]},{calendarNote:{...note.calendarNote,sourceUrl:'https://unreviewed.example'}}])assert(feed.validateFeed(feed.normalizeFeed({...document,events:[{...note,...change}]})).length,'Mixed unsupported notes must fail publication');
 const cached=identity.normalizeCore({...seed,calendarNote:undefined,importedSeedFacts:undefined});
 assert(!cached.date&&!cached.startTimeUtc);assert(cached.calendarNote.cacheRecovery);assert.equal(cached.sourceCheckedAt,seed.sourceCheckedAt);
 const later={...seed,calendarNote:undefined,sourceTrust:'verified',sourceType:'official',sourceUrl:seed.id===ids[0]?'https://www.goodwood.com/':'https://www.ucimtbworldseries.com/',sourceCheckedAt:'2026-10-04T23:52:00.000Z'};
 assert.deepEqual(api.qualify(later),later,'Later verified facts must survive');
}
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-notes-'));
try{
 const oldSurf=api.surfIds.map(id=>clone(document.events.find(e=>e.id===id))),other={id:'unrelated',date:'2027-01-01',time:'12:00',sourceCheckedAt:'2020-01-01T00:00:00Z'};
 const files=['feeds/incoming/events.json','data/events.json'].map(file=>path.join(temporary,file));
 for(const file of files){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({...document,events:[...oldSurf,...seeds,other]}));}
 assert(api.applyRetained({root:temporary}).every(s=>s.changed.length===2));const bytes=files.map(f=>fs.readFileSync(f,'utf8'));
 assert(api.applyRetained({root:temporary}).every(s=>s.changed.length===0));assert.deepEqual(files.map(f=>fs.readFileSync(f,'utf8')),bytes);
 assert.deepEqual(JSON.parse(bytes[0]).events.slice(0,2),oldSurf,'Existing Surf/WSL boundaries must remain exact');assert.deepEqual(JSON.parse(bytes[0]).events.at(-1),other);
 const input=path.join(temporary,'input.json'),output=path.join(temporary,'published.json');fs.writeFileSync(input,JSON.stringify({...document,events:[...oldSurf,...seeds.map(api.qualify)]}));
 execFileSync(process.execPath,[path.join(root,'scripts/publish-feed.js'),input,output,path.join(temporary,'meta.json'),path.join(temporary,'bundle.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
 for(const event of JSON.parse(fs.readFileSync(output)).events)assert(api.isReviewedNote(event),'Actual publication retains strict note semantics');
 const invalid=JSON.parse(bytes[1]);invalid.events[2]={...invalid.events[2],startTimeUtc:'2027-07-10T00:00:00.000Z'};fs.writeFileSync(files[1],JSON.stringify(invalid));
 assert.throws(()=>api.applyRetained({root:temporary}));assert.equal(fs.readFileSync(files[0],'utf8'),bytes[0],'Invalid peer document cannot partly write the first surface');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
if(!process.argv.includes('--unit-only'))for(const file of ['feeds/incoming/events.json','data/events.json']){
 const events=JSON.parse(fs.readFileSync(path.join(root,file))).events;for(const id of api.ids){const event=events.find(e=>e.id===id);assert(event);assert.deepEqual(api.qualify(event),event,'Persistent shared qualification is current');}
}
if(!process.argv.includes('--unit-only'))for(const slug of ['surf','motorsport'])for(const note of require('../data/code-inspector/'+slug+'.json').fixtures.filter(f=>f.calendarNote)){assert.equal(note.expected,null,'Calendar projections cannot invent zero stakes');assert.equal(note.timePrecision,'unknown');}
const quick=require('./quick-results').projectionSteps(['Reviewed calendar notes']);assert(quick.some(s=>s[0]==='scripts/publish-feed.js')&&quick.some(s=>s[0]==='scripts/build-code-inspector.js'&&JSON.stringify(s.find(a=>a.startsWith('--codes='))?.slice(8).split(',').sort())===JSON.stringify(['motorsport','surf'])),'Daily owner must retain both existing note projections');
console.log('Reviewed manual notes: actual imported records, truthful local calendar window/unmatched identity, source dates, privacy and clock rejection pass.');
