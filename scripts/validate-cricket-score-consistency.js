'use strict';
const assert=require('node:assert/strict'),model=require('../config/match-centre'),view=require('../config/feed-live-scores').presentation;
const checkedAt='2026-10-20T09:20:00.000Z',now=Date.parse(checkedAt),detail=require('../lib/cricket-scorecard');
// Screenshot-shaped test controls on a retained provider schema, not an
// incident payload or evidence that either reported total was correct.
function fixture(){
 const raw=require('./lib/milestone-fixtures').source(),i=raw.fixture.innings.at(-1),p=i.batsmen.find(p=>p.isBatting);
 p.runsScored+=173-i.runsScored;i.runsScored=173;i.numberOfWicketsFallen=6;i.oversBowled='59.5';raw.fixture.resultText='South Africa 6-175';
 const card=detail.normalize(raw,{fixtureId:raw.fixture.id,checkedAt});
 return {...require('../lib/source-coverage').parseCricketFixtures([{...card.fixture,innings:card.innings}],{sourceUrl:detail.url(raw.fixture.id),checkedAt})[0],status:'live',sourceStale:false,scoreCheckedAt:checkedAt,statusCheckedAt:checkedAt,cricketBalance:card.balance};
}
const e=fixture(),before=JSON.stringify(e),options={resultsOn:true,now},snapshot=model.compact(e);
assert.equal(snapshot.score.innings.at(-1).runs,173);
assert.equal(snapshot.cricketBalance,null,'Match Centre must withhold the contradictory score-only sentence');
assert(!view(e,options).summary.includes('175'),'Feed uses the same numeric innings without the second conflicting total');
assert.equal(view(e,{...options,resultsOn:false}),null);
assert.equal(JSON.stringify(e),before,'Source numbers, provider prose and independent clocks stay unchanged');
for(const balance of ['South Africa 6-173','South Africa Men 173/6','South Africa trail Australia by 175 runs','South Africa require 175 runs to win','South Africa won by 175 runs','Rain delay: South Africa 6-175','Australia 6-175','Unknown XI 6-175','South Africana 6-175']){
 assert.equal(model.compact({...e,cricketBalance:balance}).cricketBalance,balance,'Keep consistent scores, other teams, unknown names and substantive source wording: '+balance);
}
for(const balance of ['South Africa Men 6–175','South Africa Men 175/6','south africa 6-175','South Africa 5-173']){
 assert.equal(model.compact({...e,cricketBalance:balance}).cricketBalance,null,balance);
}
assert.equal(model.compact({...e,innings:[...e.innings].reverse()}).cricketBalance,null,'Highest identified innings wins independently of array order');
const incomplete=structuredClone(e);delete incomplete.innings.at(-1).numberOfWicketsFallen;
assert.equal(model.compact(incomplete).cricketBalance,e.cricketBalance,'An unavailable numeric total cannot disprove source wording');
const women={...e,gender:'women',participants:e.participants.map(p=>({...p,name:p.name.replace('Men','Women')})),innings:e.innings.map(i=>({...i,team:i.team.replace('Men','Women')}))};
assert.equal(model.compact(women).cricketBalance,e.cricketBalance,'An unconfirmed genderless alias cannot resolve a women team');
assert.equal(model.compact({...women,cricketBalance:'South Africa Women 6-175'}).cricketBalance,null);
const ambiguous={...e,participants:e.participants.map(p=>({...p,aliases:['XI']})),cricketBalance:'XI 6-175'};
assert.equal(model.compact(ambiguous).cricketBalance,ambiguous.cricketBalance,'A shared alias cannot establish the batting side');
// Whole-string recognition must precede the existing180-character display cap.
const longAlias='S'.repeat(174),longBalance=longAlias+' 6-175 after a rain delay';
const longNarrative={...e,cricketBalance:longBalance,participants:e.participants.map(p=>p.id===snapshot.score.innings.at(-1).participantId?{...p,aliases:[longAlias]}:p)};
assert.equal(model.compact(longNarrative).cricketBalance,longBalance.slice(0,180),'Truncation must not turn substantive prose into a contradictory score-only sentence');
assert.equal(model.compact({...longNarrative,cricketBalance:longAlias+' 6-175'}).cricketBalance,null,'A genuinely whole long score-only statement still uses the consistency guard');
assert.equal(longNarrative.cricketBalance,longBalance,'Original provider wording remains unchanged');
const later=new Date(now+60000).toISOString(),paused=model.compact({...e,status:'suspended',cricketBalance:null});
const statusOnly={...model.compact({...e,status:'suspended',innings:[],scoreCheckedAt:null,statusCheckedAt:later}),cricketBalance:e.cricketBalance};
const retained=model.observation(paused,statusOnly);
assert.equal(retained.score.innings.at(-1).runs,173);assert.equal(retained.scoreCheckedAt,checkedAt);
assert.equal(retained.cricketBalance,null,'A status-only receipt cannot reintroduce conflicting prose beside a retained score');
const cached={...snapshot,cricketBalance:e.cricketBalance};
assert.equal(model.observation(null,cached).cricketBalance,null,'Older compact cache payloads use the same display guard');
assert.equal(JSON.stringify(e),before);
console.log('Cricket score consistency: actual normalizer → compact/observation → shared presentation; 173/175, identity, privacy, source preservation and status-only retention passed.');
module.exports={fixture};
