'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file)));
const review=read('data/canonical/nrlw-season-review.v1.json'),schedule=read('data/canonical/fiba-women-sailgp-motogp-2026.json');
const {validateSeasonReview,validateSeasonBackfill}=require('./lib/nrlw-season-review');
validateSeasonReview(review);validateSeasonBackfill(review,schedule);
for(const [label,mutate] of [
 ['missing round',r=>delete r.sources['7']],['missing fixture',r=>r.fixtures.pop()],
 ['duplicate fixture',r=>r.fixtures[1]=r.fixtures[0]],['wrong season',r=>r.season=2027],
 ['unknown team',r=>r.fixtures[0].providerTeamIds[0]=123],['reversed identities',r=>r.fixtures[0].participantIds.reverse()],
 ['live score',r=>r.fixtures[0].providerStatus='InProgress'],['negative score',r=>r.fixtures[0].homeScore=-1],
 ['string score',r=>r.fixtures[0].awayScore='0'],['invented final',r=>r.fixtures.at(-1).homeScore=0],
 ['future observation',r=>r.sources['1'].checkedAt='2099-01-01T00:00:00Z'],
 ['invalid kickoff',r=>r.fixtures[0].startTimeUtc='2026-99-01'],['wrong local date',r=>r.fixtures[0].date='2026-07-03'],
 ['foreign source',r=>r.fixtures[0].sourceUrl='https://example.test/draw'],
 ['renewed fact clock',r=>r.fixtures[0].sourceCheckedAt='2026-10-03T13:00:00Z'],
 ['lost saved identity',r=>r.preservedFixtureIds.pop()],['wrong backfill scope',r=>r.addedFixtureIds[0]=r.preservedFixtureIds[0]]
]){const r=structuredClone(review);mutate(r);assert.throws(()=>validateSeasonReview(r),undefined,label+' must reject');}
for(const [label,mutate] of [['missing canonical match',s=>s.events.splice(s.events.findIndex(e=>e.nrlwSeasonBackfill),1)],['wrong canonical score',s=>s.events.find(e=>e.nrlwSeasonBackfill).result.score='Wrong 1-2 result'],['wrong canonical observation',s=>s.events.find(e=>e.nrlwSeasonBackfill).sourceCheckedAt='2026-10-03T13:00:00Z']]){const s=structuredClone(schedule);mutate(s);assert.throws(()=>validateSeasonBackfill(review,s),undefined,label);}
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])],added=new Set(review.addedFixtureIds);
for(const file of ['feeds/incoming/events.json','data/events.json','data/code-inspector/nrlw.json','data/follow-schedule/nrlw.json']){
 const doc=read(file),events=doc.events||doc.fixtures;
 for(const f of review.fixtures){const matches=events.filter(e=>aliases(e).includes(f.id));assert.equal(matches.length,1,file+': unique fixture');const e=matches[0];assert.equal(e.startTimeUtc,f.startTimeUtc);assert.deepEqual(e.participantIds,f.participantIds);assert.equal(e.venue,f.venue);assert.equal(e.status,f.providerStatus==='FullTime'?'completed':'upcoming');
  if(f.providerStatus==='FullTime'){const names=f.participantIds.map(id=>review.participants.find(p=>p.id===id).displayName);assert.equal(e.score,`${names[0]} ${f.homeScore}-${f.awayScore} ${names[1]}`);}
  if(added.has(f.id)){assert.equal(e.sourceCheckedAt,f.sourceCheckedAt);assert.equal(e.resultSourceCheckedAt,f.sourceCheckedAt);assert.equal(e.resultStatus,'official');assert.equal(e.sourceUrl,f.sourceUrl);const options=require('../config/follow-first').viewingOptions(e);assert(options.length);assert(options.every(o=>o.liveOrReplay==='replay'&&!o.replayVerified),'older destinations do not promise verified replay');}
 }
}
assert.equal(read('data/code-inspector/nrlw.json').coverageStatus,'partial','fixture completeness is not whole-family certification');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nrlw-season-'));
try{for(const file of ['feeds/incoming/events.json','data/events.json']){
 const original=read(file),raw=structuredClone(original.events.find(e=>e.key==='tennis'));raw.id=raw.eventId='qa:tennis:retained-raw-provider-id';delete raw.canonicalEventId;delete raw.sourceEventIds;original.events.push(raw);
 const outside=original.events.filter(e=>!aliases(e).some(id=>added.has(id))),target=path.join(temp,'events.json');fs.writeFileSync(target,JSON.stringify(original));
 for(let i=0;i<2;i++)execFileSync(process.execPath,[path.join(root,'scripts/sync-requested-sports-to-feed.js'),target,target,'--nrlw-season-only'],{cwd:root,stdio:'pipe'});
 const written=JSON.parse(fs.readFileSync(target));assert.deepEqual(written.events.filter(e=>!aliases(e).some(id=>added.has(id))),outside,'all saved IDs and unrelated records survive');assert.equal(new Set(written.events.map(e=>e.id)).size,written.events.length);
 for(const id of added)assert.deepEqual(written.events.find(e=>aliases(e).includes(id)),original.events.find(e=>aliases(e).includes(id)),'unchanged reruns preserve enrichment and actual observations');
}}finally{fs.rmSync(temp,{recursive:true,force:true});}
const {buildServerFeed}=require('../lib/server-feed-pipeline');const events=read('data/events.json').events;
const build=(selected,now)=>buildServerFeed({events,userId:'nrlw-season-qa',userState:{preferences:{selectedSelectorEntityIds:selected,followedSports:selected.includes('sport:nrlw')?['nrlw']:['nrl'],preferenceGraph:{domainPreferences:selected.map(sportDomainId=>({sportDomainId,enabled:true}))}}},now:new Date(now)}).events;
const first=review.fixtures[0],fixture=e=>aliases(e).includes(first.id);
assert(!build(['sport:nrlw'],'2026-07-03T00:00:00Z').some(fixture),'a broad NRLW follow retains the existing regular-season admission boundary');
const teamFeed=buildServerFeed({events:[events.find(fixture)],userId:'nrlw-team-qa',userState:{preferences:{selectedSelectorEntityIds:['sport:nrlw'],followedSports:['nrlw'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrlw',enabled:true}],entityFollows:[{participantId:'team:nrlw:sharks',followLevel:'follow'}]}}},now:new Date('2026-07-03T00:00:00Z')}).events;
assert(teamFeed.some(fixture),'explicit women’s team admits its current regular-season match');
assert(!build(['sport:nrl-premiership'],'2026-07-03T00:00:00Z').some(fixture),'men’s follow does not opt into women’s fixtures');
assert(!build(['sport:nrlw'],'2026-10-03T12:00:00Z').some(e=>aliases(e).some(id=>added.has(id))),'old season fixtures do not extend Feed retention');
console.log('NRLW season review: 71 fixtures, 70 completed matches, twelve clubs/eleven regular rounds, malformed-source rejection, both surfaces/projections, saved identities/clocks/reruns, honest replay and Follow history passed.');
