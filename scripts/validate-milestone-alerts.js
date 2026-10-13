'use strict';
const assert=require('node:assert/strict');
const rules=require('../lib/milestone-rules'),prefs=require('../config/milestone-preferences');
const detail=require('../lib/cricket-scorecard'),parse=require('../lib/source-coverage').parseCricketFixtures;
const raw=require('./fixtures/cricket-ca39990-scorecard-20261011.json');
rules.validateRecords(require('../data/canonical/cricket-record-watchlist.v1.json'));
const now=Date.now(),stamp=new Date(now).toISOString();
function fixture(runs=84){const card=detail.normalize(raw,{fixtureId:39990,checkedAt:stamp});const e=parse([{...card.fixture,innings:card.innings}],{sourceUrl:detail.url(39990),checkedAt:stamp})[0];e.status='live';e.sourceStale=false;e.cricketPhaseConfirmed=true;e.scoreCheckedAt=stamp;e.statusCheckedAt=stamp;const inning=e.innings.at(-1);inning.batting=inning.batting.map((p,index)=>({...p,runs:index===0?runs:0,isBatting:index===0,notOut:index===0,playerId:p.playerId}));inning.bowling=[{playerId:987,name:'Controlled Bowler',wickets:4}];return e;}
function previous(e,runs,age=120000){const f=structuredClone(e);for(const i of f.innings)i.detailCheckedAt=new Date(now-age).toISOString();f.innings.at(-1).batting[0].runs=runs;f.innings.at(-1).bowling[0].wickets=3;return f;}
const e=fixture(),actor=e.innings.at(-1).batting[0].playerId;
assert.deepEqual(prefs.LIMITS.medium,{match:3,total:6,gap:1200000});
assert.equal(prefs.normalize({enabled:false}).enabled,false);
assert.equal(prefs.normalize({sports:{cricket:{coverage:'off'}}}).sports.cricket.coverage,'off');
assert.equal(prefs.normalize({sports:{cricket:{coverage:'unknown'}}}).sports.cricket.coverage,'medium');
assert(!prefs.allows(prefs.normalize({sports:{cricket:{coverage:'low'}}}),'centuries'));
assert(prefs.allows(prefs.normalize({sports:{cricket:{coverage:'high'}}}),'extraBatting'));
const q=prefs.normalize({quietHours:{enabled:true,start:'22:00',end:'08:00',timezone:'Australia/Sydney'}});assert(prefs.quiet(q,Date.parse('2026-10-13T12:00:00Z')));assert(!prefs.quiet(q,Date.parse('2026-10-13T01:00:00Z')));
assert.equal(rules.detect(fixture(79),{now}).filter(m=>m.family==='centuries').length,0);
const approaching=rules.detect(e,{now}).find(m=>m.family==='centuries');assert.equal(rules.detect({...e,canonicalEventId:'fixture:cricket:espn:other-provider'},{now}).find(m=>m.family==='centuries').eventId,e.id,'A provider alias cannot replace the accepted primary storage identity');assert(approaching);assert.match(approaching.text,/84/);assert(!/likely|will|about to/i.test(approaching.text));
assert.equal(rules.detect({...e,status:'stumps'},{now}).length,0);
assert.equal(rules.detect({...e,sourceStale:true},{now}).length,0);
const stale=structuredClone(e);stale.innings.at(-1).detailCheckedAt=new Date(now-240001).toISOString();assert.equal(rules.detect(stale,{now}).length,0);
const dismissed=structuredClone(e);dismissed.innings.at(-1).batting[0].isBatting=false;assert(!rules.detect(dismissed,{now}).some(m=>m.family==='centuries'));
const reached=fixture(103);assert(!rules.detect(reached,{now}).some(m=>m.family==='centuries'),'First imports never invent recent achievements');
const achievement=rules.detect(reached,{previous:previous(reached,99),now}).find(m=>m.family==='centuries');assert.equal(achievement.stage,'achieved');assert.equal(achievement.momentId,approaching.momentId,'Approach and achievement share one identity');
assert(!rules.detect(reached,{previous:previous(reached,99,360000),now}).some(m=>m.family==='centuries'));
assert.equal(rules.revalidate(approaching,reached,{now}),null,'Passed predictions are discarded');
assert(rules.revalidate(achievement,reached,{now,records:{schemaVersion:'cricket-record-watchlist.v1',records:[]}}));
const changedInnings=structuredClone(reached);changedInnings.innings.push({...changedInnings.innings.at(-1),inningNumber:3,batting:[],bowling:[]});assert(rules.detect(changedInnings,{previous:previous(reached,99),now}).some(m=>m.family==='centuries'&&m.stage==='achieved'),'Verified achievements survive an innings change');
const correction=fixture(98);assert.equal(rules.revalidate(achievement,correction,{now}),null);
for(const [r,w,b,f,expected] of [[18,3,12,'ODI',true],[18,8,90,'ODI',false],[200,2,90,'ODI',false],[50,2,30,'T20',true],[30,3,null,'ODI',false],[30,3,10,'ODI',false],[20,3,null,'Test',true]]){const match=fixture();match.format=f;match.innings.at(-1).inningNumber=f==='Test'?4:2;match.cricketChase={confirmed:true,inningNumber:match.innings.at(-1).inningNumber,runsRemaining:r,wicketsRemaining:w,ballsRemaining:b};assert.equal(Boolean(rules.competitiveChase(match)),expected,JSON.stringify({r,w,b,f}));}
const chaseFixture={...raw.fixture,gameType:'ODI',oversRemaining:'4.2',resultText:'South Africa need 18 runs to win'};const innings=[{inningNumber:2,numberOfWicketsFallen:7,battingTeamId:raw.fixture.homeTeam.id}];assert.equal(detail.chase(chaseFixture,innings).ballsRemaining,26);assert.equal(detail.chase({...chaseFixture,resultText:'South Africa trail by 18 runs'},innings),null,'An innings lead is not a winning target');assert.equal(detail.chase({...chaseFixture,oversRemaining:'4.7'},innings).ballsRemaining,null);
const baseline={reviewed:true,reviewedAt:new Date(now).toISOString(),evidence:{baselineUrl:'https://www.cricket.com.au/controlled-baseline',targetUrl:'https://www.cricket.com.au/controlled-record'},recordId:'controlled-record',fixtureId:e.id,playerId:actor,format:'test',metric:'runs',baseline:9900,target:10000,baselineExcludesFixture:true,baselineCheckedAt:new Date(Date.parse(e.startTimeUtc)-3600000).toISOString(),fixtureStartAt:e.startTimeUtc,expiresAt:new Date(now+3600000).toISOString(),sourceUrl:'https://www.cricket.com.au/controlled-test-evidence',title:'10,000 Test runs'};
const recordFixture=fixture();for(const i of recordFixture.innings.slice(0,-1))i.batting=i.batting.filter(p=>String(p.playerId)!==String(actor));const watch={schemaVersion:'cricket-record-watchlist.v1',records:[baseline]};assert(rules.detect(recordFixture,{now,records:watch}).some(m=>m.family==='records'));

const grouped=structuredClone(recordFixture);const activeInning=grouped.innings.at(-1);activeInning.inningNumber=4;activeInning.batting[0].runs=94;activeInning.batting[1]={...activeInning.batting[1],runs:40,isBatting:true,notOut:true};grouped.cricketChase={confirmed:true,inningNumber:4,runsRemaining:20,wicketsRemaining:2,ballsRemaining:null};
assert.deepEqual(rules.detect(grouped,{now,records:watch}).map(m=>m.family),['records','finishes','bowling','centuries','extraBatting'],'Simultaneous moments use the agreed priority');
const duplicated=structuredClone(e);duplicated.innings.push(duplicated.innings.at(-1));assert.equal(rules.detect(duplicated,{now}).length,0,'Duplicate innings cannot double-count record contributions');
const twoContributions=structuredClone(recordFixture);twoContributions.innings[0].batting.push({...twoContributions.innings.at(-1).batting[0],runs:10,isBatting:false,notOut:false});assert(rules.detect(twoContributions,{now,records:watch}).some(m=>m.family==='records'&&m.value===9994),'Verified innings contributions are each added once');
assert.throws(()=>rules.validateRecords({...watch,records:[{...baseline,baselineExcludesFixture:false}]}),/Unverified/);
assert.throws(()=>rules.validateRecords({...watch,records:Array(6).fill(baseline)}),/Invalid/);
assert(!rules.detect(recordFixture,{now,records:{...watch,records:[{...baseline,expiresAt:new Date(now-1).toISOString()}]}}).some(m=>m.family==='records'));
const account={preferences:{version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:cricket'],followedSports:['cricket'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:cricket',enabled:true}],entityFollows:[]},showSpoilers:false},actions:{}};
assert.equal(rules.recipient(e,account,now),null,'A broad Cricket follow cannot create default Feed alerts');
account.actions[e.id]={addedToFixtures:true,reminderChoice:'off'};assert(rules.recipient(e,account,now),'A manual pin is eligible independently of Remind OFF');
account.actions[e.id].milestoneAlertsMuted=true;assert.equal(rules.recipient(e,account,now),null);delete account.actions[e.id].milestoneAlertsMuted;
const on=rules.recipient(e,account,now);const body=rules.payload(e,[approaching],{showFacts:on.showFacts,now});assert(!body.body.includes('84'));assert(!body.body.includes('century'));assert.match(body.url,/surface=match-centre&moment=/);assert.equal(body.kind,'milestone');assert.equal(Date.parse(body.expiresAt)-now,120000);
assert(!/100|century|won|5 wickets/.test(rules.payload({...e,name:'100 runs, century, won with 5 wickets',displayTitleCompact:'100 runs, century, won with 5 wickets'},[approaching],{showFacts:false,now}).body),'A result-bearing event title cannot leak into a Results OFF payload');
account.preferences.followFirst={notifications:{milestones:{sports:{cricket:{audience:'sport'}}}}};account.actions={};assert(rules.recipient(e,account,now));
account.preferences.preferredSports=[];account.preferences.preferenceGraph.competitionPreferences=[{competitionId:e.competitionId,enabled:false}];assert.equal(rules.recipient(e,account,now),null,'Broader opt-in cannot bypass a competition exclusion');
console.log('Milestone rules: real scorecard shape, controlled transitions, chase filters, reviewed baselines, consent, budgets and spoiler-safe payloads passed.');

const women={...e,gender:'women',participantIds:['team:cricket:australia-women','team:cricket:england-women'],homeParticipantId:'team:cricket:australia-women',awayParticipantId:'team:cricket:england-women',competitionId:'competition:cricket-women-test'};
const parentOnly={preferences:{version:26,onboardingComplete:true,selectedSelectorEntityIds:['sport:cricket'],followedSports:['cricket'],followFirst:{notifications:{milestones:{sports:{cricket:{audience:'sport'}}}}}},actions:{}};
assert.equal(rules.recipient(women,parentOnly,now),null,'Broader parent-sport opt-in cannot provide separate women consent');
const muted=structuredClone(parentOnly);muted.actions[e.id]={addedToFixtures:true};muted.preferences.preferenceGraph={entityFollows:[{participantId:e.participantIds[0],followLevel:'mute'}]};assert.equal(rules.recipient(e,muted,now),null,'A participant mute overrides a manual pin and broader opt-in');

const warmup={...fixture(),format:'ODI',name:'Australia v South Africa warm-up',cricketChase:{confirmed:true,inningNumber:2,runsRemaining:18,wicketsRemaining:2,ballsRemaining:null}};assert.equal(rules.format(warmup),'odi');assert.equal(rules.competitiveChase(warmup),null,'A warm-up label cannot bypass the limited-over balls/rate filter');assert.equal(rules.format({...warmup,format:'Unsupported format'}),null);
