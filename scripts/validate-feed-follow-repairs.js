'use strict';
const assert=require('node:assert/strict'),policy=require('../config/follow-feed-policy'),follow=require('../config/follow-first'),filter=require('../config/feed-view-filter'),ratings=require('../lib/feed-filter-ratings'),horizon=require('./lib/tournament-horizon');
const rows=[{user_id:'me',phase:'heat',rating:2,updated_at:'2026-09-21'},{user_id:'me',phase:'heat',rating:3,updated_at:'2026-09-22'},{user_id:'a',phase:'impact',rating:5},{user_id:'b',phase:'impact',rating:4}];
let snapshot={filterRatings:ratings(rows,'me')};assert.equal(filter.score(snapshot),3);assert(!filter.matches(snapshot,4));snapshot={filterRatings:ratings(rows,'other')};assert.equal(filter.score(snapshot),4.5);assert(filter.matches(snapshot,4));assert(!filter.matches(snapshot,5));assert(!filter.matches({},4));assert(filter.matches({},0));assert.equal(filter.score({filterRatings:ratings([...rows,{user_id:'me',phase:'pulse',rating:5}],'me')}),5);
for(const name of ['Masters Tournament','U.S. Women’s Open','KPMG Women’s PGA Championship','The Amundi Evian Championship','AIG Women’s Open']){
 const event={id:name,key:'golf',name,date:'2026-09-23',kind:'tournament',participantIds:[]};assert(policy.golfMajor(event),name);assert(follow.reasonForEvent(event,{selectedSelectorEntityIds:['sport:golf']}),name);assert(policy.eligibleForFollow(event,{competitionFollow:true}),name);
}
assert(policy.golfMajor({key:'masters',name:'Masters Round 1'}));
const ordinary={id:'golf-ordinary',key:'golf',name:'Bank of Utah Championship',date:'2026-09-23',participantIds:['golfer']};assert(!follow.reasonForEvent(ordinary,{selectedSelectorEntityIds:['sport:golf'],preferenceGraph:{entityFollows:[{participantId:'golfer',followLevel:'follow'}]}}));assert(policy.eligibleForFollow(ordinary,{explicitSelection:true}));assert(!policy.eligibleForFollow(ordinary,{explicitSelection:true,muted:true}));
assert(horizon.inHorizon({startDate:'2026-10-19',endDate:'2026-10-25'},'2026-09-22'));assert(!horizon.inHorizon({startDate:'2026-10-20',endDate:'2026-10-25'},'2026-09-22'));assert(horizon.inHorizon({startDate:'2026-09-20',endDate:'2026-09-23'},'2026-09-22'));
const t={tournamentId:'test',name:'Test',startDate:'2026-09-22',endDate:'2026-10-25'},first=horizon.structure(t,[],{drawSize:32});assert.equal(first.slots.length,31);const slot=first.slots[0],second=horizon.structure(t,[{id:'confirmed',tournamentSlotId:slot.slotId,date:'2026-09-24',time:'12:00',status:'scheduled'}],{drawSize:32});assert.equal(second.slots[0].slotId,slot.slotId);assert.equal(second.slots[0].fixtureId,'confirmed');assert.equal(second.endDate,'2026-10-25');
const published=require('../data/tournament-horizon.v1.json');assert.equal(published.through,horizon.add(published.from,27));for(const event of published.tournaments){assert(horizon.inHorizon(event,published.from));assert(event.slots.length);assert.equal(new Set(event.slots.map(s=>s.slotId)).size,event.slots.length);}
console.log('Feed filters, golf admission, four-week boundaries and stable slot hydration passed.');

const lifecycle=require('../config/editorial-lifecycle');
const complete={status:'completed',name:'Australia v Zimbabwe',outcomeText:'Australia won by one wicket.',recapText:'A narrow finish.'},past={...complete,status:'past'};
const narrative={phase:'recap',resultSignature:lifecycle.signature(complete),hook:'Spoiler-safe context.',synopsis:'Spoiler-safe detail.',hookSpoilerOn:complete.outcomeText,synopsisSpoilerOn:complete.recapText};
assert.equal(lifecycle.signature(past),lifecycle.signature(complete));assert.equal(lifecycle.copy(past,narrative,true).hook,complete.outcomeText);assert.equal(lifecycle.copy(past,narrative,true).synopsis,complete.recapText);assert.equal(lifecycle.copy(past,narrative,false).hook,narrative.hook);

assert.equal(published.from,process.env.TOURNAMENT_REFERENCE_DAY||horizon.day(),'refresh must maintain the current Sydney horizon');
for(const t of published.tournaments){assert(t.formatConfirmed,`${t.name}: research the official format before release`);assert(/^https:\/\//.test(t.formatSourceUrl),`${t.name}: format needs a source`);}
const catalogue=require('../data/canonical/tennis-catalogue-2026.json').tournaments;
for(const t of catalogue.filter(t=>horizon.inHorizon(t,published.from)))assert(published.tournaments.some(p=>p.tournamentId===t.tournamentId),`${t.name}: missing horizon structure`);
const saved=new Map([[slot.slotId,{rating:5,reminder:true}]]),rescheduled=horizon.structure(t,[{id:'confirmed',tournamentSlotId:slot.slotId,date:'2026-09-26',time:'17:30',participantSlots:[{participantId:'confirmed-player',label:'Confirmed player'}]}],{drawSize:32});
assert.equal(rescheduled.slots[0].slotId,slot.slotId);assert.equal(rescheduled.slots[0].date,'2026-09-26');assert.deepEqual(saved.get(rescheduled.slots[0].slotId),{rating:5,reminder:true});

const major={id:'golf-major',key:'golf',name:'Masters Tournament',date:'2026-09-23',kind:'tournament'};
const auGolf={selectedSelectorEntityIds:['sport:golf'],followFirst:{australiansOnlySportIds:['sport:golf']}};
assert(!follow.reasonForEvent(major,auGolf));assert(follow.reasonForEvent({...major,participants:[{id:'golfer',countryCode:'AU'}]},auGolf));
assert(!policy.eligibleForFollow(major,{competitionFollow:true,australiansOnly:true}));
assert(policy.eligibleForFollow(major,{explicitSelection:true,australiansOnly:true}));
