'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const api=require('./lib/surf-calendar-notes'),review=require('../data/canonical/surf-calendar-note-review.v1.json'),feed=require('./lib/feed-utils'),identity=require('../config/fixture-identity'),timing=require('../config/card-timing'),reminder=require('../config/fixture-reminder-policy'),calendar=require('../config/calendar-export');
const root=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x)),document=require('../data/events.json');
const seeds=review.events.map(row=>({id:row.id,eventId:row.id,key:'big-wave',sport:'Big-wave Surfing',name:row.originalName,displayTitleCompact:row.originalName,date:row.originalDate,time:row.originalTime,startTimeUtc:row.originalStart,sourceType:'personal-calendar',sourceTrust:'unverified',sourceUrl:`calendar://nothingsport-manual-seed/${row.id.split('manual-seed-')[1]}`,sourceName:'Imported from nothingsport-manual-seed',sourceCheckedAt:'2026-08-06T09:00:00+10:00',statusCheckedAt:'2026-08-06T09:00:00+10:00',status:'upcoming',timePrecision:'exact',expected:8,liveWindow:5,broadcaster:'ESPN',broadcastOptions:['ESPN'],round:'final',narrativeType:'final',participantIds:[],participantSlots:[],selectedSentence:'Internal seed rule.',fullSpiel:'Imported internal rule.',storyline:{hookSpoilerOff:'Internal seed rule.'}}));
for(const seed of seeds){
 const note=api.qualify(seed);assert(api.isUnconfirmedNote(note));assert.deepEqual(api.qualify(note),note);
 const cached=identity.normalizeCore(seed);assert(!cached.date&&!cached.startTimeUtc);assert(cached.calendarNote.cacheRecovery);assert.equal(cached.sourceCheckedAt,seed.sourceCheckedAt);assert.equal(calendar.knownDate(cached),false);assert.equal(reminder.timing(cached),null);
 assert.equal(note.id,seed.id);assert.equal(note.sourceCheckedAt,seed.sourceCheckedAt);assert.equal(note.statusCheckedAt,seed.statusCheckedAt);assert.equal(note.importedSeedFacts.startTimeUtc,seed.startTimeUtc);
 assert.equal(feed.validateFeed(feed.normalizeFeed({...document,events:[note]})).length,0,'Honest unconfirmed note must publish without a fabricated date');
 assert.equal(reminder.timing(note),null);assert.equal(calendar.knownDate(note),false);assert(!calendar.buildIcs([note]).includes('BEGIN:VEVENT'));
 assert.match(timing.presentation(identity.normalizeCore(note)).fullSchedule,/DATE TBC.*TIME TBC/);
 assert.equal(require('../config/follow-feed-policy').eligibleForFollow(note,{explicitSelection:true}),true,'A retained explicit pin remains eligible');
 const generated={...note,fullSpiel:'An unsourced regenerated preview.',storyline:{hookSpoilerOff:'An unsourced final.'}};const cleaned=feed.normalizeFeed({...document,events:[generated]}).events[0];assert.equal(cleaned.fullSpiel,note.fullSpiel);assert(!cleaned.storyline,'Generated copy cannot turn this note back into a fixture');
 for(const mutation of [{id:'unreviewed-note'},{date:seed.date},{startTimeUtc:seed.startTimeUtc},{expected:8},{sourceTrust:'verified'},{cardKind:'fixture'},{competitionId:'competition:wsl-championship-tour'},{viewingOptions:[{providerId:'espn'}]},{score:'1-0'},{participantIds:['player:invented']}])assert(feed.validateFeed(feed.normalizeFeed({...document,events:[{...note,...mutation}]})).length,'Mixed/unknown note must fail ordinary publication gates');
 const later={...seed,sourceType:'official',sourceTrust:'verified',sourceUrl:'https://www.worldsurfleague.com/',sourceCheckedAt:'2026-10-04T22:16:00.000Z',date:'2026-12-08',startTimeUtc:'2026-12-08T00:00:00.000Z'};assert.deepEqual(api.qualify(later),later,'Later independently verified facts survive');
 assert.throws(()=>api.qualify({...later,sourceCheckedAt:'2099-01-01T00:00:00Z'}));
 assert.deepEqual(api.qualify({...later,status:'completed',score:'Retained final'}),{...later,status:'completed',score:'Retained final'});
 assert.throws(()=>api.qualify({...seed,date:'2027-03-01'}),'Changed unsourced timing needs review');
}
// The real writer and real publication CLI must preserve all other records and rerun bytes.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-surf-notes-'));
try{
 const other={id:'other',key:'tennis',sourceCheckedAt:'2020-01-01T00:00:00Z'};
 for(const file of ['feeds/incoming/events.json','data/events.json']){fs.mkdirSync(path.dirname(path.join(temporary,file)),{recursive:true});fs.writeFileSync(path.join(temporary,file),JSON.stringify({events:[...seeds,other]}));}
 assert(api.applyRetained({root:temporary,selectedIds:api.surfIds}).every(s=>s.changed.length===2));const paths=['feeds/incoming/events.json','data/events.json'].map(f=>path.join(temporary,f)),bytes=paths.map(f=>fs.readFileSync(f,'utf8'));
 assert(api.applyRetained({root:temporary,selectedIds:api.surfIds}).every(s=>s.changed.length===0));assert.deepEqual(paths.map(f=>fs.readFileSync(f,'utf8')),bytes);assert.deepEqual(JSON.parse(bytes[0]).events.at(-1),other);
 const pub=path.join(temporary,'publication.json'),out=path.join(temporary,'published.json');fs.writeFileSync(pub,JSON.stringify({...document,events:seeds.map(api.qualify)}));
 execFileSync(process.execPath,[path.join(root,'scripts/publish-feed.js'),pub,out,path.join(temporary,'meta.json'),path.join(temporary,'bundle.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
 for(const event of JSON.parse(fs.readFileSync(out)).events){assert(api.isUnconfirmedNote(event));assert.equal(event.sourceCheckedAt,seeds.find(s=>s.id===event.id).sourceCheckedAt);}
 const bad=JSON.parse(bytes[1]);bad.events.pop();bad.events.pop();fs.writeFileSync(paths[1],JSON.stringify(bad));assert.throws(()=>api.applyRetained({root:temporary,selectedIds:api.surfIds}));assert.equal(fs.readFileSync(paths[0],'utf8'),bytes[0]);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
if(!process.argv.includes('--unit-only'))for(const file of ['feeds/incoming/events.json','data/events.json']){
 const doc=JSON.parse(fs.readFileSync(path.join(root,file)));for(const id of api.ids){const event=doc.events.find(e=>e.id===id);assert(event);assert.deepEqual(api.qualify(event),event,`${file}: retained note repair missing`);}
}
assert(require('./update-cards').buildSteps({localOnly:true}).some(args=>args[0]==='scripts/lib/reviewed-calendar-notes.js'),'Full owner must retain the shared note review');
const steps=require('./quick-results').projectionSteps(['Surf calendar notes']);assert(steps.some(args=>args[0]==='scripts/publish-feed.js')&&steps.some(args=>args[0]==='scripts/build-code-inspector.js'&&args[1]==='--codes=surf'),'Daily owner must publish the correct Surfing projection');
console.log('Surf notes: strict unknown-date publication, real persistence/CLI, retained IDs/original clocks, no viewing/result/reminder fabrication, unchanged reruns and verified recovery pass.');
require('./validate-reviewed-calendar-notes');
