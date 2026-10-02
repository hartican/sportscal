'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {reviewedAuViewing:review}=require('../lib/reviewed-au-viewing'),follow=require('../config/follow-first');
const audit=require('../data/coverage/australian-viewing-rights.v1.json');
const rugby=require('../data/follow-schedule/rugby-union.json').fixtures,cricket=require('../data/follow-schedule/cricket.json').fixtures;
const providers=f=>follow.viewingOptions(review(f)).map(p=>p.providerId);
const home=rugby.find(f=>f.id==='rugby-australia-south-africa-2026-09-27');
assert.deepEqual(providers(home),['nine-tv','nine','stan'],'verified free access before subscription');
for(const f of rugby.filter(f=>f.date>='2026-10-01'&&f.date<'2026-11-01'&&f.participantIds.includes('team:rugby:wallabies')&&f.participantIds.includes('team:rugby:all-blacks'))){
 assert.deepEqual(providers(f),['nine-tv','nine','stan'],'both reviewed Bledisloe representations retain viewing without changing IDs');
}
const superAus=rugby.find(f=>f.id.includes('e492d961'));
assert.deepEqual(providers(superAus),['youtube','stan'],'reviewed final offers free organiser coverage before subscription');
const finalOptions=follow.viewingOptions(review(superAus));
assert.equal(finalOptions[0].url,'https://www.youtube.com/@rugbycomau');
assert.equal(finalOptions[0].linkScope,'sport','channel is not a promised fixture playback permalink');
assert.equal(finalOptions[1].verifiedAt,'2026-10-02T05:17:58.761Z','new option does not re-date unchanged Stan evidence');
assert.deepEqual(providers({...superAus,participantIds:['team:rugby:reds','team:rugby:waratahs']}),['stan'],'exact reviewed finalists bound free coverage');
assert.deepEqual(providers({...superAus,startTimeUtc:'2026-10-04T06:30:00Z',date:'2026-10-04'}),['stan'],'free final evidence expires on its reviewed local date');
const normalized=require('../config/fixture-identity').normalizeCore(superAus);
assert.equal(normalized.venue,'Scotch College Playing Fields, Swanbourne, Perth');
assert.equal(normalized.venueProvenance.checkedAt,'2026-10-02T08:24:48.810Z');
for(const field of ['id','startTimeUtc','status','statusCheckedAt','scoreCheckedAt'])assert.equal(normalized[field],superAus[field],'venue review does not refresh sporting observations');
const unknown=rugby.find(f=>f.competitionName==='Top 14 2027');
assert.deepEqual(providers({...unknown,broadcaster:'Stan Sport',viewingOptions:['Stan Sport']}),[],'catalogue absence is unverified, never invented Stan rights');
assert.equal(review(unknown).broadcaster,'Australian viewing unconfirmed');
for(const mutation of [{competitionId:superAus.competitionId+'-reserves'},{startTimeUtc:null,date:null},{startTimeUtc:'2027-10-03T00:00:00Z',date:'2027-10-03'}])assert.deepEqual(providers({...superAus,...mutation}),[],'exact identity and dated season required');
assert.deepEqual(providers({...superAus,startTimeUtc:null,date:'2026-09-31'}),[],'invalid civil dates cannot normalise into a valid rights window');
assert.deepEqual(providers({...superAus,startTimeUtc:'2026-10-31T13:30:00Z',date:'2026-11-01'}),[],'Australian window ends on local midnight, including daylight saving');
for(const id of ['1525659','1525660','1525661']){
 const f=cricket.find(f=>f.id==='fixture:cricket:espn:'+id);assert(f);
 for(const status of ['upcoming','live','completed']){
  const options=follow.viewingOptions(review({...f,status}));assert.deepEqual(options.map(o=>o.providerId),['kayo','foxtel']);
  assert(options.every(o=>o.territory==='AU'&&o.sourceUrl==='https://www.cricket.com.au/matches/series/CA:4568'&&o.verifiedAt&&o.replayVerified===false&&o.linkScope==='sport'));
 }
 for(const mutation of [{format:'ODI',matchFormat:'ODI'},{participantIds:['team:cricket:australia','team:cricket:india']},{startTimeUtc:'2027-10-09T00:00:00Z',date:'2027-10-09'},{startTimeUtc:null,date:null}])assert.deepEqual(providers({...f,...mutation}),[],'Tests do not confer rights on another format, participant or season');
 const enriched=review(f);assert.deepEqual(review(enriched),enriched,'unchanged rerun preserves original evidence time');
 assert.equal(review({...enriched,date:'2027-10-09',startTimeUtc:'2027-10-09T00:00:00Z'}).viewingOptions.length,0,'our dated metadata expires after reschedule');
 const sporting=({viewingOptions,broadcaster,broadcastOptions,broadcasterIds,...rest})=>rest;
 assert.deepEqual(sporting(enriched),sporting(f),'no fixture fact, source observation or activity key changes');
}
const warmup=cricket.find(f=>f.id==='fixture:cricket:espn:1525658');assert.deepEqual(providers(warmup),[],'no broadcast extrapolation to warmup');
const foreign={...unknown,viewingOptions:[{providerId:'seven',rightsScope:'fixture',sourceUrl:'https://example.test/official-fixture',verifiedAt:'2026-09-25T00:00:00Z'}]};assert.deepEqual(providers(foreign),['seven'],'separate verified fixture evidence survives');
assert.deepEqual(follow.viewingOptions({key:'cricket',competitionId:'competition:cricket:4567'}),[],'undated fixtures do not inherit time-bounded ODI rights');
assert.deepEqual(follow.viewingOptions({key:'cricket',competitionId:'competition:cricket:4567',startTimeUtc:'2027-09-24T00:00:00Z'}),[],'UTC-only observations obey season bounds');
assert.deepEqual(follow.viewingOptions({key:'netball',competitionId:'competition:netball',startTimeUtc:'2027-09-01T00:00:00Z'}).map(o=>o.providerId),['stan','nine'],'other dated rights use actual UTC timing');
for(const rule of audit.reviewedWindows){assert(Number.isFinite(Date.parse(rule.verifiedAt)));assert(Date.parse(rule.notBefore)<Date.parse(rule.notAfter));assert(/^https:\/\//.test(rule.sourceUrl));assert(rule.fixtureIds?.length||rule.competitionIds?.length);}
if(process.argv.includes('--published')){
 const strip=options=>options.map(({reviewId,...o})=>o);
 for(const folder of ['code-inspector','follow-schedule'])for(const code of ['rugby-union','cricket'])for(const f of require(`../data/${folder}/${code}.json`).fixtures){
  assert.deepEqual(strip(f.viewingOptions),strip(review(f).viewingOptions),`${folder}/${code}/${f.id}: source evidence survives actual projection`);
  if(f.id===superAus.id){assert.equal(f.venue,normalized.venue,'actual final projection carries host venue');assert.equal(f.venueProvenance.checkedAt,normalized.venueProvenance.checkedAt);}
 }
 const feed=require('../data/events.json').events;
 for(const f of feed.filter(f=>f.key==='rugby'||f.viewingOptions?.some(o=>o.reviewId==='au-viewing-20261002')))assert.deepEqual(f.viewingOptions,review(f).viewingOptions,'published cards retain evidence and original dates');
}
console.log('Reviewed AU viewing: free/paid ordering, exact competitions, three Tests, warmup exclusion, expiry, original facts/dates, honest replay and both projections passed.');
