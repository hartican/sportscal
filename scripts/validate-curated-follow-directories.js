'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
for(const [key,counts,first] of [['cricket',[12,8],'team:cricket:australia'],['rugby',[24,11],'team:rugby:wallabies']]){const d=require(`../data/follow-directory/${key}.v1.json`);assert.deepEqual(d.browseGroups?.map(g=>g.memberIds.length),counts);assert.equal(d.browseGroups[0].memberIds[0],first);for(const id of d.browseGroups.flatMap(g=>g.memberIds))assert(d.records.some(r=>r.id===id),id);}
for(const key of ['rugby','tennis']){
 const event={id:'unfollowed',key,name:'Unfollowed A v B',date:'2026-09-10',round:'Round 1',isInternational:true,competitionScope:'international',competitionId:'competition:test',participantIds:['team:test:a','team:test:b']};
 assert.equal(follow.reasonForEvent(event,{followedSports:[key]}),null,key+' ordinary fixture needs participants');
 assert(follow.reasonForEvent(event,{preferenceGraph:{entityFollows:[{participantId:'team:test:a',followLevel:'follow'}]}}));
 assert(follow.reasonForEvent({...event,round:key==='tennis'?'Quarter-final':'Final'},{followedSports:[key]}),'finals admitted within followed sport');
}
const cricket={id:'retained-international',key:'cricket',format:'Test',name:'Australia v England',participantIds:['team:cricket:australia','team:cricket:england']};
assert.equal(follow.reasonForEvent(cricket,{followedSports:['cricket']}),null);
assert(follow.reasonForEvent(cricket,{preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}}));
console.log('Curated Cricket/Rugby directories and strict followed participant admission passed.');

const catalogue=require('../config/team-follow-catalogue');
const source=require('./fixtures/reported-follow-provider-records.json');
for(const id of ['fixture:cricket:espn:1552021', 'fixture:cricket:espn:1535537', 'fixture:cricket:CA:40955', 'fixture:cricket:CA:24494', 'fixture:cricket:espn:1535536', 'fixture:cricket:espn:1535538', 'fixture:cricket:espn:1552908', 'fixture:cricket:espn:1535539', 'fixture:cricket:espn:1552909', 'fixture:cricket:espn:1552915', 'fixture:rugby:wr:5147ecd2-57bc-4d17-af31-4b30c53fee9c', 'fixture:rugby:wr:c6694a4f-ec95-4f16-94b4-c6509721151d']){const e=source.find(e=>e.id===id);assert(e,id);assert.deepEqual(catalogue.participantIdsForEvent(e),e.participantIds);const reason=follow.reasonForEvent({...e,participantIds:catalogue.participantIdsForEvent(e)},{followedSports:['cricket','rugby'],preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}}); const final=require('../config/follow-feed-policy').isFinalsOrKnockout(e); assert.equal(Boolean(reason),Boolean(e.key==='rugby'&&final),'reported fixture follows participant or confirmed finals rule: '+id);}
const sides=require('../config/card-identities').matchupSidesForEvent(source.find(e=>e.id==='fixture:cricket:CA:40955'),require('../config/national-team-identities').participants);assert(sides[0]?.participant?.id!=='team:cricket:south-africa','unknown Namibia mark cannot borrow opponent crest');

for(const key of ['football','rugby','nba','cricket'])assert.equal(follow.reasonForEvent({id:'women-final',key,name:'Women final',gender:'women',round:'Final',participantIds:['team:women:a','team:women:b']},{followedSports:[key]}),null,'parent sport does not opt into women: '+key);
const migrate=require('../config/discovery-catalogue').migratePreferences;assert(!migrate({version:19,selectedSelectorEntityIds:['sport:afl-premiership','sport:aflw','sport:nrl']}).selectedSelectorEntityIds.includes('sport:aflw'));assert(migrate({version:21,selectedSelectorEntityIds:['sport:afl-premiership','sport:aflw']}).selectedSelectorEntityIds.includes('sport:aflw'));

assert(migrate({version:20,selectedSelectorEntityIds:['sport:afl-premiership','sport:aflw']}).selectedSelectorEntityIds.includes('sport:aflw'),'explicit choices made after the first repair remain authoritative');
