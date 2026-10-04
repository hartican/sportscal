'use strict';
const assert=require('node:assert/strict'),view=require('../config/feed-live-scores').presentation;
const now=Date.now(),base={key:'tennis',status:'live',homeParticipantId:'a',awayParticipantId:'b',participants:[{id:'a',displayName:'First'},{id:'b',displayName:'Second'}],scoreCheckedAt:new Date(now).toISOString(),sets:[{home:6,away:4}],games:{home:2,away:1}};
assert.equal(view(base),null,'Results OFF has no score presentation');
assert.equal(view(base,{resultsOn:true,now}).text,'First / Second: 6–4 · Games 2–1');
assert.equal(view(base,{resultsOn:true,now}).status,'Live');
assert.equal(view({...base,scoreCheckedAt:new Date(now+1000).toISOString()},{resultsOn:true,now}).status,'Last available score','future observations cannot claim live');
assert.equal(view({...base,scoreCheckedAt:new Date(now-600000).toISOString()},{resultsOn:true,now}).stale,true);
assert.equal(view({...base,status:'completed'},{resultsOn:true,now}).status,'Finished');
const settled={...base,status:'completed',scoreCheckedAt:'2025-12-31T13:05:00.000Z'};
assert.equal(view(settled,{resultsOn:true,now}).stale,false,'elapsed age cannot require an update to a settled final');
assert.equal(view(settled,{resultsOn:true,now}).checkedAt,settled.scoreCheckedAt,'presentation preserves the original final observation');
assert.equal(view({...settled,stale:true},{resultsOn:true,now}).stale,true,'explicit source degradation remains visible on a final');
assert.equal(view({...base,scoreCheckedAt:new Date(now+1000).toISOString()},{resultsOn:true,now}).checkedAt,null,'future observations cannot be presented as an actual check');
assert.equal(view({...base,fixtureObservationSchema:'fixture-observations.v1',scoreCheckedAt:null},{resultsOn:true,now}).stale,true,'missing live observations remain degraded');
for(const competitionId of ['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league']){
 const finals=require('../data/code-inspector/football.json').fixtures.filter(f=>f.competitionId===competitionId&&f.status==='completed');assert(finals.length>0);
 for(const f of finals){const before=JSON.stringify(f),value=view(f,{resultsOn:true,now});assert.equal(value.status,'Finished');assert.equal(value.stale,Boolean(f.stale));assert.equal(value.checkedAt,f.scoreCheckedAt);assert.equal(JSON.stringify(f),before);assert.equal(view(f),null);}
}
assert.equal(view({...base,cardType:'tennis_parent'},{resultsOn:true,now}),null);
assert.equal(view({key:'nrl',homeScore:0,awayScore:4},{resultsOn:true}).text,'Home 0 · Away 4');
assert.equal(view({key:'cricket',innings:[{team:'Australia',runs:102,wickets:2,overs:18}]},{resultsOn:true}).text,'Australia 102/2 (18 overs)');
assert.equal(view({key:'tennis',name:'Player wins 6-4',status:'live'},{resultsOn:true}),null,'never parse editorial scores');
const actual=require('./fixtures/nhl-live-20261005.json'),canonical={...require('./lib/nhl-results').fixture(actual.game,{checkedAt:actual.capturedAt,now:new Date(actual.capturedAt)}),key:'ice-hockey'};
const hockey=view(canonical,{resultsOn:true,now:Date.parse(actual.capturedAt)});assert.equal(hockey.text,'Winnipeg Jets 0 · Detroit Red Wings 0');assert.equal(hockey.status,'Live');assert.equal(hockey.checkedAt,actual.capturedAt);assert.equal(view(canonical),null);
assert.equal(view({...canonical,status:'upcoming'},{resultsOn:true}),null,'scheduled placeholder pairs cannot become sporting scores');
assert.equal(view({...canonical,homeScore:null,awayScore:null},{resultsOn:true}),null,'an explicitly cleared observation cannot reuse older canonical slots');
assert.equal(view({...canonical,homeScore:3},{resultsOn:true}),null,'partial flat and canonical pairs cannot be combined');
assert.equal(view({...canonical,homeParticipantId:'another-club'},{resultsOn:true}),null,'conflicting participant identity cannot acquire a canonical score');
for(const change of [s=>s.pop(),s=>s[0].score=null,s=>s[0].score=-1,s=>s[0].score=1.2,s=>s[0].participantId=s[1].participantId,s=>s[0].homeAway='home']){const e=structuredClone(canonical);change(e.participantSlots);assert.equal(view(e,{resultsOn:true}),null,'invalid or ambiguous canonical pair stays unavailable');}
assert.equal(view({...canonical,homeScore:4,awayScore:1},{resultsOn:true,now:Date.parse(actual.capturedAt)}).text,'Winnipeg Jets 1 · Detroit Red Wings 4','explicit source flat scores retain priority and named orientation');
console.log('Feed score privacy, source orientation, freshness and sport formats passed.');
