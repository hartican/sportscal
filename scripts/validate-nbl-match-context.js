'use strict';
const assert=require('node:assert/strict');
const {nblMatchContext}=require('./lib/nbl-match-context');
const participants=[{id:'a',displayName:'Alpha'},{id:'b',displayName:'Beta'},{id:'c',displayName:'Gamma'}];
const options={season:'2026-27',checkedAt:'2026-09-27T12:00:00Z',participants};
const make=(id,start,ids,scores,extra={})=>({id,competitionId:'competition:nbl',season:'2026-27',stage:'regular season',status:'completed',startTimeUtc:start,participantIds:ids,result:{status:'official',homeScore:scores[0],awayScore:scores[1]},...extra});
const previous=make('earlier','2026-09-20T12:00:00Z',['a','c'],[90,80]);
const fixture=make('target','2026-09-25T12:00:00Z',['a','b'],[70,80]);
const events=[previous,fixture,make('later','2026-09-26T12:00:00Z',['b','a'],[60,80]),make('other-season','2026-09-19T12:00:00Z',['a','b'],[90,80],{season:'2025-26'}),make('other-competition','2026-09-19T12:00:00Z',['a','b'],[90,80],{competitionId:'competition:other'}),make('preseason','2026-09-19T12:00:00Z',['a','b'],[90,80],{stage:'preseason'}),make('unfinished','2026-09-21T12:00:00Z',['a','b'],[90,80],{status:'live'})];
const context=nblMatchContext(events,fixture,options);
assert.deepEqual(context.teams,[{participantId:'a',name:'Alpha',played:1,won:1,lost:0},{participantId:'b',name:'Beta',played:0,won:0,lost:0}]);
assert.equal(nblMatchContext([previous],fixture,{...options,checkedAt:'2026-09-19T12:00:00Z'}).teams[0].played,0,'observations cannot contain future results');
assert.throws(()=>nblMatchContext([previous,previous],fixture,options),/Duplicate/);
for(const scores of [[90,90],[-1,90],[90.5,80],[null,80]])assert.throws(()=>nblMatchContext([make('bad',previous.startTimeUtc,['a','b'],scores)],fixture,options),/confirmed/);
const {patchKnown}=require('./quick-results');
assert.equal(patchKnown([{id:'a'}],[{id:'a',teamMatchContext:context,season:'2026-27'}]).count,1);
assert.equal(patchKnown([{id:'a',teamMatchContext:context}],[{id:'a',teamMatchContext:{...context,checkedAt:'2026-09-28T12:00:00Z'}}]).count,0,'observation-only checks do not churn feed');
if(process.argv.includes('--published')){
 const schedule=require('../data/canonical/nbl-2026-27.json');
 const cards=require('../data/events.json');
 const expected=new Map(schedule.events.map(f=>[f.id,nblMatchContext(schedule.events,f,{season:schedule.seasonLabel,checkedAt:schedule.generatedAt,participants:schedule.participants})]));
 assert.equal(expected.size,165);
 for(const fixtures of [Array.isArray(cards)?cards:cards.events,...['code-inspector','follow-schedule'].map(folder=>require(`../data/${folder}/nbl.json`).fixtures)]){
  const key=f=>f.canonicalEventId||f.id;
  const nbl=fixtures.filter(f=>expected.has(key(f)));assert.equal(nbl.length,165);
  for(const f of nbl){assert.deepEqual(f.teamMatchContext,{...expected.get(key(f)),checkedAt:f.sourceCheckedAt});assert(Number.isFinite(Date.parse(f.sourceCheckedAt))&&Date.parse(f.sourceCheckedAt)<=Date.parse(schedule.generatedAt));assert.equal(f.teamMatchContext.checkedAt,f.sourceCheckedAt);assert.equal(f.season,schedule.seasonLabel);}
 }
}
console.log('NBL pre-game records: temporal/competition boundaries, invalid results, deduplication and published projections passed.');
