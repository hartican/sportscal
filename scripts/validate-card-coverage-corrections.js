'use strict';
const assert=require('node:assert/strict'),model=require('../config/feed-card-presentation'),follow=require('../config/follow-first'),policy=require('../config/follow-feed-policy'),cup=require('../lib/presidents-cup'),mc=require('../config/match-centre'),f1=require('../scripts/refresh-f1-sessions');
const payload=(status='IN_PROGRESS',values=[3,2])=>`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{dehydratedState:{queries:[['tournament',{id:'R2026500',formatType:'TEAM_CUP',seasonYear:2026,tournamentStatus:status,roundStatus:'OFFICIAL',currentRound:1}],['cupPlayOverviewLeaderboard',{tournamentId:'R2026500',teams:[{teamId:'USA',totalValue:values[0],projectedValue:25},{teamId:'INTL',totalValue:values[1],projectedValue:5}]}],['cupTournamentLeaderboard',{allRounds:[{roundNum:1,roundDisplayName:'Thursday Four-ball'},{roundNum:2,roundDisplayName:'Friday Foursomes'}]}]].map(([name,data])=>({queryKey:[name],state:{data}}))}}}})}</script>`;
const previous=[{id:'fixture:golf:pga:R2026500',date:'2026-09-24',endDate:'2026-09-27',dateOnly:true}];
const [parent,child]=cup.parse(payload('IN_PROGRESS',[3.5,1.5]),{previous,checkedAt:'2026-09-25T00:00:00Z'});
assert.equal(parent.status,'live');assert.equal(parent.homeScore,3.5);assert.equal(parent.awayScore,1.5);assert(mc.eligible(parent));
const invalid=cup.parse(payload('IN_PROGRESS',[null,2]),{previous:[parent],checkedAt:'2026-09-25T01:00:00Z'})[0];assert.equal(invalid.homeScore,3.5);assert.equal(invalid.scoreCheckedAt,parent.scoreCheckedAt);
const blank=cup.parse(payload('IN_PROGRESS',[null,2]),{previous})[0];assert.equal(blank.homeScore,undefined);
const completed=cup.parse(payload('COMPLETED'),{previous:[parent],checkedAt:'2026-09-27T23:00:00Z'})[0];assert(mc.eligible(completed,Date.parse('2026-09-27T23:59Z')));assert(!mc.eligible(completed,Date.parse('2026-09-28T00:01Z')));
const golf={selectedSelectorEntityIds:['sport:golf'],followedSports:['golf']};
assert(follow.reasonForEvent(parent,golf));assert(!follow.reasonForEvent(child,golf));
const direct={followFirst:{followedMajorEventIds:['presidents-cup']}};
assert(follow.reasonForEvent(parent,direct));assert(follow.reasonForEvent(child,direct));assert(!follow.reasonForEvent(parent,{selectedSelectorEntityIds:['competition:pga-tour']}));
assert(!policy.presidentsCup({...child,name:'Live From the Presidents Cup'}));
for(const [at,expected] of [['2026-09-23T00:00Z',false],['2026-09-24T13:59Z',false],['2026-09-24T14:00Z',true],['2026-09-27T13:59Z',true],['2026-09-27T14:00Z',true]])assert.equal(model.parentCompact(parent,new Date(at)),expected,at);
assert(!model.parentCompact({...parent,status:'upcoming'},new Date('2026-09-28T00:00Z')));
assert(!model.parentCompact(child,new Date('2026-09-25T00:00Z')));assert(!model.parentCompact(completed,new Date('2026-09-27T00:00Z')));
assert.equal(model.displayLabel('team:football:brazil','Brazil'),'Brazil · Canarinho');assert.equal(model.displayLabel('team:football:brazil','Winner of SF'),'Winner of SF');
assert.deepEqual(model.palette({participantIds:['team:football:socceroos','team:football:brazil'],participants:[{id:'team:football:brazil',countryCode:'BR'}]}),['#368566','#c4a42e']);
assert.notEqual(...model.palette({participantIds:['team:football:epl:1','team:football:epl:12']}));
assert.deepEqual(model.palette(parent),['#50535a','#ab8b3e']);
const html='<script type="application/ld+json">'+JSON.stringify({'@type':'SportsEvent',subEvent:[{name:'Race - Azerbaijan Grand Prix',startDate:'2026-09-26T11:00:00Z',endDate:'2026-09-26T13:00:00Z'}]})+'</script>';
const race=f1.parse(html,'azerbaijan','2027-01-01T00:00:00Z')[0];assert.equal(race.status,'upcoming');assert.equal(race.venue,'Baku City Circuit');assert.equal(race.venueCountryCode,'AZ');assert.equal(model.palette({...race,key:'f1'})[0],'#b94554');
console.log('Card corrections: parent boundaries, direct/broad Golf, team totals/halves, projected rejection, round completion, stale score, nickname, palettes and F1 venue/status passed.');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const actionKey=require('../config/event-action-identity').stableKey;
function server(preferences,actions={}){return buildServerFeed({events:[parent,child],userId:'qa',userState:{preferences,event_user_state:actions},now:new Date('2026-09-25T01:00Z')}).events.map(e=>e.id);}
assert.deepEqual(server(golf),[parent.id]);assert(server(direct).includes(child.id));
const excluded={...golf,followFirst:{excludedMajorEventIds:['presidents-cup']}};
assert.deepEqual(server(excluded),[]);assert(!follow.reasonForEvent(parent,excluded));
assert(server({}, {[actionKey(child)]:{addedToFixtures:true,addedFixture:child}}).includes(child.id));
assert.deepEqual(server(excluded,{[actionKey(child)]:{addedToFixtures:true,addedFixture:child}}),[]);
// Feed transport retains dismissed records for restoration; Match Centre excludes them.
assert.equal(buildServerFeed({events:[parent],userId:'qa',userState:{preferences:golf,event_user_state:{[actionKey(parent)]:{dismissed:true}}},now:new Date('2026-09-25T01:00Z'),matchCentreOnly:true}).events.length,0);
(async()=>{
 const {refreshDueSources}=require('../lib/live-fixtures');let published=false,failed=false;
 await refreshDueSources({sources:[{id:'live-presidents-cup',seed:[parent],fetch:args=>cup.refresh({...args,fetchImpl:async()=>{throw Error('offline');}})}],now:new Date('2026-09-25T01:00Z'),store:{claim:async()=>({fixtures:[parent]}),publish:async()=>{published=true;},fail:async()=>{failed=true;}}});
 assert(failed&&!published,'failed source preserves existing snapshot without publishing invented scores');
 console.log('Server/browser Golf admission, exclusion over pins, dismissal and failed-source last-good preservation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
const published=require('../data/events.json').events.filter(e=>e.key==='f1'&&String(e.date).startsWith('2026')&&!/ticket/i.test(e.name));
for(const event of published){assert(event.circuitId&&event.venueCity&&event.venueCountryCode&&!/TBC/i.test(event.venue),event.id);assert.deepEqual(require('../lib/f1-venues').enrich(event),event,'repeated host enrichment is stable');assert(model.palette(event),'every published host has a reviewed palette');}
console.log(`${published.length} published F1 sessions retain circuit/city/country and stable host palettes.`);

assert.deepEqual(require('../config/fixture-identity').followedScheduleCodes(direct,[{id:'sport:golf',slug:'golf'}]).map(c=>c.id),['sport:golf'],'direct Cup follow loads Golf schedule without broad Golf follow');
