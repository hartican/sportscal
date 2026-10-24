'use strict';
const assert=require('node:assert/strict'),m=require('../config/multisession-events'),follow=require('../config/follow-first'),policy=require('../config/follow-feed-policy'),reminders=require('../config/fixture-reminder-policy'),automatic=require('../lib/automatic-reminders'),catalogue=require('../lib/reminder-fixtures'),cricket=require('../config/cricket-coverage'),rugby=require('../config/rugby-coverage');
const source=require('./lib/multisession-sports').validate();
assert.equal(source.events.filter(e=>e.key==='supercars').length,26);
assert.equal(source.events.filter(e=>e.cardType==='golf_session'&&m.group(e)).length,12);
for(const family of ['players-championship','australian-open-golf','australian-pga']){
  const rounds=source.events.filter(e=>e.eventFamilyId===family);assert.equal(rounds.length,4);
  assert(rounds.every(e=>e.timeTbc&&!e.startTimeUtc&&!e.time));
  assert(!follow.reasonForEvent(rounds[0],{selectedSelectorEntityIds:['sport:golf'],followedSports:['golf']}));
  assert(follow.reasonForEvent(rounds[0],{followFirst:{followedMajorEventIds:[family]}}),'explicit headline selection admits its rounds');
}
const rugbyFixtures=require('../data/code-inspector/rugby-union.json').fixtures;
for(const c of rugby.competitions){const fixtures=rugbyFixtures.filter(e=>e.competitionId===c.id);assert(fixtures.length,c.label+' has published fixtures');assert(fixtures.every(rugby.allowed));assert(!follow.reasonForEvent({...fixtures[0],round:'Grand Final'},{followedSports:['rugby']}),'new competition starts unfollowed');}
assert(!rugby.allowed({key:'rugby',competitionId:'competition:challenge-cup',competitionName:'EPCR Challenge Cup',competitionScope:'domestic'}));
assert(rugby.allowed({key:'rugby',isInternational:true,gender:'women'}));
for(const format of ['Sheffield Shield','Australian Domestic One-Day Competition'])assert(cricket.allowed({key:'cricket',format,participantIds:['team:cricket:espn-387','team:cricket:espn-584']}));
assert(!cricket.allowed({key:'cricket',format:'T20',participantIds:['team:cricket:england-women','team:cricket:india-women']}));
const retained={preferenceGraph:{entityFollows:[{participantId:'team:cricket:retired-women',followLevel:'follow'}],competitionPreferences:[{competitionId:cricket.policy.retiredCompetitionIds[0],enabled:false}]}};
assert.deepEqual(cricket.preferences(retained).preferenceGraph,retained.preferenceGraph);
const palette=require('../config/follow-sport-palette'),taxonomy=require('../config/selector-taxonomy'),sports=palette.palette(taxonomy.nodes);
assert.equal(new Set(sports.map(e=>e.id)).size,sports.length);assert(sports.every(e=>!e.id.endsWith('-women')&&!['sport:aflw','sport:nrlw','sport:nbl'].includes(e.id)));
assert(sports.every(e=>e.glyph!=='sport:multi-sport'),'surfaced sports have specific icons');
assert.equal(palette.genderEntity(sports.find(e=>e.id==='sport:tennis'),'women',taxonomy.byId).id,'sport:tennis-women');
const now=new Date('2026-10-24T00:00:00Z'),fixture={id:'event:f1:2026:qa:race',key:'f1',name:'QA GP · Race',sessionType:'race',date:'2026-10-24',startTimeUtc:'2026-10-24T01:00:00Z',scheduleStatus:'confirmed',status:'upcoming',timePrecision:'exact',sourceUrl:'https://organiser.example/schedule',sourceCheckedAt:'2026-10-23T01:00:00Z'},prefs={selectedSelectorEntityIds:['sport:f1'],followedSports:['f1'],followFirst:{notifications:{sessionPresets:{'competition:formula-one':{enabled:true,sessionTypes:['race','sprint']}}}}};
assert(reminders.automatic(fixture,prefs,{},+now));assert.equal(reminders.timing(fixture,+now).remindAt,'2026-10-24T00:45:00.000Z');
assert(!reminders.automatic({...fixture,status:'cancelled'},prefs,{},+now));assert(!reminders.automatic({...fixture,timePrecision:'date-only',timeTbc:true,startTimeUtc:null},prefs,{},+now));assert(!reminders.automatic(fixture,{...prefs,followFirst:{notifications:{...prefs.followFirst.notifications,enabled:false}}},{},+now));
assert.equal(reminders.intent(fixture,prefs,{[fixture.id]:{reminderChoice:'off'}},{},+now).enabled,false);
assert.equal(automatic.decisions({preferences:prefs,actions:{},intents:[]},catalogue.index([fixture]),now).length,1);
const closure=m.withSchedules([fixture,{...fixture,id:'event:f1:2026:qa:qualifying',sessionType:'qualifying',startTimeUtc:'2026-10-25T01:00:00Z'}]);
assert.equal(m.project([closure[0]]).length,2,'one paginated event carries the complete admitted schedule');assert.equal(m.project([closure[0]],{eligible:e=>e.sessionType!=='qualifying'}).length,1,'current cached exclusions still win');
const selected=Array.from({length:100},(_,i)=>({...fixture,id:`event:f1:2026:manual-${i}:race`}));
const actions=Object.fromEntries(selected.map(e=>[e.id,{reminderChoice:'on'}]));
const budget=automatic.decisions({preferences:prefs,actions,intents:[]},catalogue.index([...selected,fixture]),now);
assert.equal(budget.length,100);assert(budget.every(item=>item.choice==='on'),'presets cannot displace existing reminder choices');
const old=automatic.decisions({preferences:prefs,actions:{},intents:[]},catalogue.index([fixture]),now)[0],changed=automatic.decisions({preferences:prefs,actions:{},intents:[]},catalogue.index([{...fixture,startTimeUtc:'2026-10-24T02:00:00Z'}]),now)[0];
assert.equal(old.fixture_id,changed.fixture_id);assert.notEqual(old.starts_at,changed.starts_at);
for(const event of require('../data/code-inspector/golf.json').fixtures.filter(e=>e.cardType==='golf_session'&&m.group(e)))assert(policy.scheduleVisible(event,{}),'selected golf rounds are discoverable in Schedule');
const directory=require('../data/follow-directory/rugby.v1.json'),artwork=require('../data/canonical/rugby-artwork.v1.json');
for(const c of directory.competitions){assert(c.logoUrl);assert(c.memberIds.length>=({ 'champions-cup':24,'top-14':14,'prem-rugby':10,urc:16,'currie-cup':8,npc:14 }[c.family]));assert(c.memberIds.every(id=>directory.records.find(r=>r.id===id)?.logoUrl),'all participating clubs have crests');}
const fs=require('node:fs'),crypto=require('node:crypto');
for(const asset of artwork.assets){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(asset.path)).digest('hex'),asset.sha256);assert(asset.sourceUrl&&asset.rights);}
assert.equal(palette.categories(sports.find(e=>e.id==='sport:nba'),'men',taxonomy.byId).find(e=>e.id==='sport:nbl')?.label,'NBL','Basketball retains competition drilldown');
console.log('PASS golf consent/rounds, Supercars capture, rugby scope, recoverable retirement, state formats, palette, reminder timing/OFF and paginated closure');
(async()=>{
 const practice=require('../data/code-inspector/f1.json').fixtures.find(m.practice);
 for(const phase of ['heat','pulse','impact']){
  await assert.rejects(require('../lib/nsc-rewards').submit('disposable-local-user',practice.id,phase,4,practice,now),e=>e.status===409&&e.code==='practice_unrated');
  await assert.rejects(require('../lib/nothingscore-handler')._test.ratingAction({eventId:practice.id,phase,rating:4},{id:'disposable-local-user'},null,now),e=>e.status===409&&e.code==='practice_unrated');
 }
 console.log('PASS practice rejected by both rating entry points before transport');
})().catch(error=>{console.error(error);process.exitCode=1;});
