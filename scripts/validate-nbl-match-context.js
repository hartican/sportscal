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
// Exercise the real primary adapter -> card -> quick patch -> projection seam.
// These observations are controlled replays, never written to sporting data.
{
const schedule=require('../data/canonical/nbl-2026-27.json');
const controls=require('../config/feed-controls'),timing=require('../config/card-timing');
const fixture=schedule.events.find(f=>f.status==='upcoming')||schedule.events.at(-1);
const now=new Date(Date.parse(fixture.startTimeUtc)+30*60000);
for(const status of ['upcoming','scheduled','unknown','live','in_progress','in-progress','ongoing'])for(const observed of [null,'invalid',new Date(+now-31*60000).toISOString(),new Date(+now+60000).toISOString()]){
 const event={...fixture,status,statusCheckedAt:observed,statusSource:null,timingSource:null};
 const before=JSON.stringify(event);
 assert.equal(controls.timingState(event,now)?.key,'awaiting-update',`${status}/${observed}: elapsed time or stale observation is not live play`);
 assert.equal(timing.presentation(event,now).status,'Awaiting match update');
 assert.equal(JSON.stringify(event),before,'display preserves original facts and dates');
}
for(const status of ['completed','finished','final'])assert.equal(timing.presentation({...fixture,status,statusCheckedAt:null},now).status,'FINISHED','confirmed finals remain terminal');
for(const status of ['cancelled','canceled','postponed','suspended','abandoned'])assert.equal(controls.timingState({...fixture,status},now),null,'non-playing observations are not live');
assert.equal(controls.timingState(fixture,new Date(Date.parse(fixture.startTimeUtc)-30*60000)).key,'starts-soon');
const {build}=require('./refresh-nbl-schedule'),{cardForEvent}=require('./sync-requested-sports-to-feed');
const {normalizeFixture}=require('./build-code-inspector'),identity=require('../config/fixture-identity');
const names=new Map(schedule.participants.map(p=>[p.id,p.displayName]));
const source={leaguePath:'nbl',year:2026,fallback:false,offset:0,total:165,seasons_meta:[{id:'status-rehearsal',name:'NBL27',season_type:'regular',match_count:165}],matches:schedule.events.map(f=>({id:f.providerId,season_id:'status-rehearsal',season_type:'regular',starts_at_ms:Date.parse(f.startTimeUtc),round_label:String(f.roundNumber),phase:f.id===fixture.id?'live':f.status==='completed'?'complete':'upcoming',home:{name:names.get(f.participantIds[0])},away:{name:names.get(f.participantIds[1])},home_score:f.result?.homeScore,away_score:f.result?.awayScore}))};
function observedCard(at){const document=build(source,at),event=document.events.find(f=>f.id===fixture.id);return cardForEvent(event,document,new Map(document.participants.map(p=>[p.id,p])));}
const live=observedCard(now.toISOString()),old={...live,status:'upcoming',statusCheckedAt:schedule.generatedAt,sourceCheckedAt:schedule.generatedAt};
const patched=patchKnown([old],[live]);assert.equal(patched.count,1);
assert.equal(patched.events[0].statusCheckedAt,now.toISOString(),'a real primary status change carries its actual observation through quick persistence');
assert.equal(patched.events[0].id,old.id);assert.equal(patched.events[0].canonicalEventId,fixture.id);assert.deepEqual(patched.events[0].participantIds,old.participantIds);
const projected=normalizeFixture(identity.mergeOverlays([],[patched.events[0]])[0],'sport:nbl');
assert.equal(projected.statusCheckedAt,now.toISOString(),'Schedule retains the same primary observation');
for(const event of [patched.events[0],projected])for(const age of [0,30*60000])assert.equal(timing.presentation(event,new Date(+now+age)).status,'LIVE','fresh explicit primary status remains live at both boundaries');
const later=new Date(+now+31*60000),repeated=patchKnown(patched.events,[observedCard(later.toISOString())]);
assert.equal(repeated.count,0,'metadata-only source checks preserve saved facts without a new publication');
assert.deepEqual(repeated.events,patched.events,'unchanged reruns retain original fact/observation dates');
const final={...patched.events[0],status:'completed',score:'80-70',resultSourceCheckedAt:now.toISOString()};
assert.equal(patchKnown([final],[{...final,statusCheckedAt:later.toISOString(),sourceCheckedAt:later.toISOString(),resultSourceCheckedAt:later.toISOString()}]).count,0,'an unchanged NBL final must not republish merely because its source was checked again');
assert.equal(timing.presentation(repeated.events[0],later).status,'Awaiting match update','saved status expires without a newer published observation; no live polling is implied');
assert.equal(timing.presentation({...projected,status:'live'},new Date(+now+48*3600000)).status,'Awaiting match update','retained live status cannot last for days');
const finalMatch=source.matches.find(m=>m.id===fixture.providerId);finalMatch.phase='complete';finalMatch.home_score=0;finalMatch.away_score=80;
const confirmed=patchKnown(patched.events,[observedCard(later.toISOString())]);assert.equal(confirmed.count,1);
assert.equal(confirmed.events[0].status,'completed');assert.equal(confirmed.events[0].score,'0-80','zero is a valid explicit provider score');
const finalProjection=normalizeFixture(identity.mergeOverlays(confirmed.events,[{...live,statusCheckedAt:new Date(+later+60000).toISOString(),sourceCheckedAt:new Date(+later+60000).toISOString()}])[0],'sport:nbl');
assert.equal(timing.presentation(finalProjection,later).status,'FINISHED','a later stale live observation cannot reopen the confirmed final');
assert.equal(finalProjection.score,'0-80','terminal reconciliation retains the confirmed score');
}
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
console.log('NBL records/status: temporal boundaries, invalid results, deduplication, primary-to-persistence-to-Schedule freshness, terminal states and unchanged reruns passed.');
