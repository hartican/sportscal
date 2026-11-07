'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const identity=require('../lib/epl-provider-identities'),source=require('../data/events.json');
const primary=identity.validatePrimaryCollection(source.events),cases=require('./fixtures/epl-provider-identity-20261013.json').fixtures;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-epl-identity-publication-'));
const factFields=['id','eventId','canonicalEventId','competitionId','season','name','displayTitleCompact','participantIds','participants','homeParticipantId','awayParticipantId','date','time','startTimeUtc','endTimeUtc','timePrecision','timeTbc','scheduleStatus','status','statusText','statusCheckedAt','statusFactObservedAt','scoreCheckedAt','scoreFactObservedAt','sourceName','sourceUrl','sourceType','sourceCheckedAt','canonicalSourceCheckedAt','resultSourceCheckedAt','firstConfirmedCompleteAt','homeScore','awayScore','score','outcomeText','viewingOptions','broadcaster','selectedSentence','fullSpiel','footballMatchContext'];
function publish(){const run=cp.spawnSync(process.execPath,[require.resolve('./publish-feed'),path.join(directory,'incoming.json'),path.join(directory,'events.json'),path.join(directory,'meta.json'),path.join(directory,'events.js'),'--preserve-known'],{cwd:directory,encoding:'utf8'});assert.equal(run.status,0,run.stdout+'\n'+run.stderr);return JSON.parse(fs.readFileSync(path.join(directory,'events.json')));}
try{
 fs.mkdirSync(path.join(directory,'data'));fs.copyFileSync(require.resolve('../data/editorial-knowledge.v1.json'),path.join(directory,'data/editorial-knowledge.v1.json'));
 fs.writeFileSync(path.join(directory,'incoming.json'),JSON.stringify(source));
 fs.writeFileSync(path.join(directory,'events.json'),JSON.stringify(source));
 // Compare viewing with an ordinary publication from the same source. The
 // current viewing owner may legitimately add a reviewed programme link.
 const control=identity.validatePrimaryCollection(publish().events);
 fs.writeFileSync(path.join(directory,'incoming.json'),JSON.stringify({...source,events:[...source.events,...cases.map(x=>x.secondary)]}));
 const published=publish(),events=identity.validatePrimaryCollection(published.events);
 for(const event of events){const old=primary.find(x=>x.id===event.id),ordinary=control.find(x=>x.id===event.id);for(const field of factFields)assert.deepEqual(event[field],['viewingOptions','broadcaster'].includes(field)?ordinary[field]:old[field],field+' cannot change from adding identity metadata');for(const id of identity.aliasesForId(event.id))assert(event.sourceEventIds.includes(id),'the real persisted feed must retain every reviewed link/action identity');}
 assert(!published.events.some(x=>cases.some(c=>x.canonicalEventId===c.secondary.canonicalEventId)),'the actual publication retires the captured old calendar rows');
 assert.deepEqual(publish().events,published.events,'unchanged publication retains the exact fixture records and original observations');
 // Reuse the real Inspector builder, in a disposable output directory. Source
 // modules/inputs stay read-only; companion deployment output is not requested.
 const key=require.resolve('../data/events.json'),cached=require.cache[key],previous=cached.exports;
 try{cached.exports=published;delete require.cache[require.resolve('./build-code-inspector')];require('./build-code-inspector').build({outputDir:path.join(directory,'inspector')});const projection=JSON.parse(fs.readFileSync(path.join(directory,'inspector/football.json'))).fixtures.filter(x=>x.competitionId===identity.COMPETITION);assert.equal(projection.length,380);assert.equal(new Set(projection.map(x=>x.id)).size,380);for(const event of projection){const old=primary.find(x=>x.canonicalEventId===event.canonicalEventId);assert(old,'Inspector keeps the official fixture identity');for(const id of identity.aliasesForId(old.id))assert(event.sourceEventIds.includes(id),'Inspector retains reviewed identities for older actions');for(const field of ['startTimeUtc','timePrecision','sourceCheckedAt'])assert.deepEqual(event[field],old[field],field+' remains original in the actual Inspector projection');}}
 finally{cached.exports=previous;delete require.cache[require.resolve('./build-code-inspector')];}
 console.log('Actual EPL publication/Inspector persistence: complete 380 primary IDs, seven retained calendar corrections, all aliases, original sporting/presentation fields and clocks, unchanged rerun; no provider or production write.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
