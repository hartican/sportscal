'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),seed=require('./fixtures/rugby-seed-evt-100-20261012.json'),notes=require('./lib/reviewed-calendar-notes'),rugby=require('./lib/rugby-seed-note');
const identity=require('../config/fixture-identity'),calendar=require('../config/calendar-export'),reminder=require('../config/fixture-reminder-policy'),actions=require('../config/event-action-identity'),feed=require('./lib/feed-utils');
const clone=value=>structuredClone(value),before=JSON.stringify(seed),note=notes.qualify(seed),cached=identity.normalizeCore(clone(seed));
assert.equal(JSON.stringify(seed),before,'Captured real caller remains unchanged');
for(const event of [note,cached]){
 assert.equal(event.id,seed.id);assert.equal(actions.stableKey(event),actions.stableKey(seed),'Saved actions retain their identity');
 assert(!event.date&&!event.time&&!event.startTimeUtc&&!event.schedulingWindow,'Unconfirmed import cannot retain an appointment');
 assert.equal(event.participantsConfirmed,false);assert.deepEqual(event.participantIds,[]);assert.equal(event.expected,null);assert.equal(event.venue,null);
 assert.equal(event.sourceCheckedAt,seed.sourceCheckedAt);assert.equal(event.statusCheckedAt,seed.statusCheckedAt);
 assert.equal(reminder.timing(event),null);assert.equal(calendar.knownDate(event),false);assert(!calendar.buildIcs([event]).includes('BEGIN:VEVENT'));
 assert(!/Watch via Stan Sport/.test(event.fullSpiel));assert.equal(event.broadcaster,'Australian viewing unconfirmed');assert(!event.result&&!event.score);assert.notEqual(event.status,'cancelled');
 const saved={evt_100:{reminderChoice:'off'}};assert.equal(reminder.intent(event,{},saved).choice,'off','Saved OFF remains authoritative');
}
assert(rugby.isReviewedNote(note));assert(cached.calendarNote.cacheRecovery);assert.equal(note.calendarNote.observedAt,rugby.review.observedAt);assert.equal(note.importedSeedFacts.fullSpiel,seed.fullSpiel,'Unsupported original copy remains inactive import history');
assert.deepEqual(notes.qualify(note),note,'Unchanged rerun cannot advance facts');
const document=require('../data/events.json');assert.deepEqual(feed.validateFeed(feed.normalizeFeed({...document,events:[note]})),[],'Honest note passes the real publication validator');
for(const mutation of [{date:'2026-11-28'},{time:'00:00'},{startTimeUtc:'2026-11-27T13:00:00Z'},{expected:8},{participantIds:seed.participantIds},{fullSpiel:seed.fullSpiel},{statusCheckedAt:'2026-10-11T20:45:56.555Z'},{statusCheckedAt:'2026-10-11T20:45:56.555Z',importedSeedFacts:{...note.importedSeedFacts,statusCheckedAt:'2026-10-11T20:45:56.555Z'}},{calendarNote:{...note.calendarNote,observedAt:'2099-01-01T00:00:00Z'}}])assert(feed.validateFeed(feed.normalizeFeed({...document,events:[{...note,...mutation}]})).length,'Mixed unsupported claims cannot publish');
assert.throws(()=>rugby.validate({...rugby.review,id:'evt_101'}));assert.throws(()=>rugby.validate({...rugby.review,observedAt:'2099-01-01T00:00:00Z'}));
assert.throws(()=>notes.qualify({...seed,date:'2026-11-29'}),'Changed unsourced seed requires review');
assert.deepEqual(notes.qualify({...seed,status:'completed',score:'retained result'}),{...seed,status:'completed',score:'retained result'},'A seed note cannot undo an existing result');
const primary={...seed,sourceType:'official',sourceTrust:'verified',sourceName:'Controlled later primary',sourceUrl:'https://www.rugby.com.au/fixtures',sourceCheckedAt:'2026-10-11T20:46:00Z',startTimeUtc:'2026-11-28T13:00:00Z',timePrecision:'exact',scheduleStatus:'confirmed'};
assert.deepEqual(notes.qualify(primary),primary,'Independent verified fixture recovery remains unchanged');assert(!identity.normalizeCore(primary).calendarNote,'Cached safeguards cannot suppress verified recovery');
assert.throws(()=>notes.qualify({...primary,sourceCheckedAt:'2099-01-01T00:00:00Z'}));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-rugby-note-'));
try{
 // A historical Tennis replay imports the shared updater under a frozen clock.
 // Loading an unrelated source must not apply a later Rugby review. Applying
 // that review before its actual observation must still fail closed.
 execFileSync(process.execPath,['-e',`const assert=require('node:assert/strict');const mock=require('node:test').mock;mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-08T05:00:00Z')});try{const updater=require('./scripts/update-cards');assert.throws(()=>updater.parseOptions(['--live-source=unknown','--live']),/Scoped live/);const api=require('./scripts/lib/rugby-seed-note'),seed=require('./scripts/fixtures/rugby-seed-evt-100-20261012.json');assert.throws(()=>api.qualify(seed),/future source evidence/);}finally{mock.timers.reset();}`],{cwd:root,stdio:'pipe'});
 const files=['feeds/incoming/events.json','data/events.json'].map(file=>path.join(temporary,file)),other={id:'unrelated',time:'17:00',sourceCheckedAt:'2020-01-01T00:00:00Z'};
 for(const file of files){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({...document,events:[clone(seed),other]}));}
 assert(notes.applyRetained({root:temporary,selectedIds:[seed.id]}).every(s=>s.changed.length===1));const bytes=files.map(file=>fs.readFileSync(file));
 assert(notes.applyRetained({root:temporary,selectedIds:[seed.id]}).every(s=>!s.changed.length));for(let i=0;i<files.length;i++)assert(bytes[i].equals(fs.readFileSync(files[i])));
 assert.deepEqual(JSON.parse(bytes[0]).events.at(-1),other,'Unrelated records remain exact');
 const input=path.join(temporary,'input.json'),output=path.join(temporary,'published.json');fs.writeFileSync(input,JSON.stringify({...document,events:[note]}));
 execFileSync(process.execPath,[path.join(root,'scripts/publish-feed.js'),input,output,path.join(temporary,'meta.json'),path.join(temporary,'bundle.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
 const published=JSON.parse(fs.readFileSync(output)).events[0];assert(rugby.isReviewedNote(published));assert.equal(published.id,seed.id);assert.equal(published.sourceCheckedAt,seed.sourceCheckedAt);
 // The actual incoming import omitted statusCheckedAt; the published copy had
 // its original July observation. The real preservation merge retains that
 // old value without turning the organiser review into a new fixture check.
 const incomingSeed=clone(seed);delete incomingSeed.statusCheckedAt;
 const incomingNote=notes.qualify(incomingSeed);assert.equal(incomingNote.importedSeedFacts.statusCheckedAt,undefined);
 fs.writeFileSync(input,JSON.stringify({...document,events:[incomingNote]}));
 execFileSync(process.execPath,[path.join(root,'scripts/publish-feed.js'),input,output,path.join(temporary,'meta.json'),path.join(temporary,'bundle.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
 const mergedNote=JSON.parse(fs.readFileSync(output)).events[0];
 assert(rugby.isReviewedNote(mergedNote),'Real publication must accept the original asymmetric observations');
 assert.equal(mergedNote.sourceCheckedAt,seed.sourceCheckedAt);assert.equal(mergedNote.statusCheckedAt,seed.statusCheckedAt);
 assert.equal(mergedNote.importedSeedFacts.statusCheckedAt,undefined,'Publication cannot invent a date on the incoming import');
 assert.equal(mergedNote.calendarNote.observedAt,rugby.review.observedAt);assert(!calendar.buildIcs([mergedNote]).includes('BEGIN:VEVENT'));
  for(const file of files)fs.writeFileSync(file,JSON.stringify({...document,events:[note]}));
  execFileSync(process.execPath,[path.join(root,'scripts/enrich-storyline-cards.js'),'--write'],{cwd:temporary,stdio:'pipe'});
  for(const file of files)assert.deepEqual(JSON.parse(fs.readFileSync(file)).events[0],note,'Actual editorial owner cannot reinterpret a reviewed note or advance its dates');
 for(const file of files)fs.writeFileSync(file,JSON.stringify({...document,events:[clone(seed),other]}));const first=fs.readFileSync(files[0]),bad=JSON.parse(fs.readFileSync(files[1]));bad.events[0].date='2026-11-29';fs.writeFileSync(files[1],JSON.stringify(bad));
 assert.throws(()=>notes.applyRetained({root:temporary,selectedIds:[seed.id]}));assert(first.equals(fs.readFileSync(files[0])),'Invalid peer cannot partly update the first surface');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log('Rugby seed note: actual retained caller, cached appointment/export rejection, inactive import history, original IDs/dates/OFF, real publication and two-surface persistence, invalid peer and later verified recovery pass.');
