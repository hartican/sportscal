'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {reviewedAuViewing:review}=require('../lib/reviewed-au-viewing'),follow=require('../config/follow-first');
const audit=require('../data/coverage/australian-viewing-rights.v1.json');
const rugby=require('../data/follow-schedule/rugby-union.json').fixtures,cricket=require('../data/follow-schedule/cricket.json').fixtures;
const providers=f=>follow.viewingOptions(review(f)).map(p=>p.providerId);
const aflwFinal=require('../data/canonical/afl-nrl-2026.json').events.find(f=>f.id==='event:aflw:cd_m20262641601');assert(aflwFinal);
const viewedAflw=review(aflwFinal),aflwOptions=follow.viewingOptions(viewedAflw);
assert.deepEqual(aflwOptions.map(p=>p.providerId),['seven','kayo','foxtel'],'The exact AFLW final keeps free access first and its separately announced paid options');
assert.equal(aflwOptions[0].webUrl,'https://7plus.com.au/aflw','Use the provider AFLW destination, not its general homepage');
assert.equal(aflwOptions[0].accessType,'free');
for(const option of aflwOptions){assert.equal(option.rightsScope,'fixture');assert.equal(option.linkScope,'sport');assert.equal(option.replayVerified,false);assert.equal(option.permalinkVerifiedAt,null);assert.equal(option.verifiedAt,'2026-10-09T10:51:48.755Z','Reuse the actual announcement observation, not a new sporting source check');}
const withoutViewing=({viewingOptions,broadcaster,broadcastOptions,broadcasterIds,...rest})=>rest;
assert.deepEqual(withoutViewing(viewedAflw),withoutViewing(aflwFinal),'Viewing cannot create a clock, finalist, host, result or reminder');
assert.deepEqual(review(viewedAflw),viewedAflw,'An unchanged review is idempotent');
for(const mutation of [{id:'another-aflw-final',eventId:'another',canonicalEventId:'another',sourceEventIds:[]},{competitionId:'competition:afl'},{roundLabel:'Preliminary Final'},{date:'2026-11-28'},{date:'2026-11-26'},{date:null},{date:'2026-11-31'},{startTimeUtc:'2026-11-27T13:00:00Z',date:'2026-11-27'}]){
 const changed=review({...aflwFinal,...mutation});assert(!(changed.viewingOptions||[]).some(o=>o.reviewId==='au-viewing-20261002'),'Another identity, stage or Australian day cannot inherit this final review');
}
assert(!(review({...viewedAflw,date:'2026-11-28'}).viewingOptions||[]).some(o=>o.reviewId==='au-viewing-20261002'),'Our review expires after a reschedule, including persisted options');
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
const golfDocument=require('../data/canonical/pga-tour-schedule.json'),golf=require('../lib/golf-fixtures').fixtures(golfDocument);
assert.deepEqual(follow.viewingOptions({key:'golf',competitionId:'competition:pga-tour',name:'PGA TOUR'}).map(o=>o.providerId),['kayo','foxtel'],'actual PGA rights remain available');
for(const competitionId of ['competition:lpga-tour','competition:unknown-lpga-tour','competition:korn-ferry-tour'])assert.deepEqual(follow.viewingOptions({key:'golf',competitionId,name:'Tournament'}),[],'shared name substrings never confer another tour rights');
const sporting=({viewingOptions,broadcaster,broadcastOptions,broadcasterIds,...rest})=>rest;
for(const id of ['2026068','2026070']){
 const f=golfDocument.lpga.find(f=>f.id==='fixture:golf:lpga:'+id);assert(f);
 const enriched=review(f),options=follow.viewingOptions(enriched);
 assert.deepEqual(options.map(o=>o.providerId),['kayo','foxtel'],'reviewed LPGA competition has both AU subscription destinations');
 assert(options.every(o=>o.rightsScope==='competition'&&o.linkScope==='sport'&&o.territory==='AU'&&o.accessType==='subscription'&&o.replayVerified===false),'general carriage never implies a round permalink, free playback or replay');
 assert.equal(options[0].sourceUrl,'https://kayosports.com.au/help/s/article/What-content-is-available-as-part-of-your-Kayo-subscription');
 assert.equal(options[1].sourceUrl,'https://www.foxtel.com.au/watch/golf.html');
 assert.deepEqual(sporting(enriched),sporting(f),'viewing enrichment preserves all golf IDs, entries, groups, facts and original observations');
 assert.deepEqual(golf.find(row=>row.id===f.id).viewingOptions,enriched.viewingOptions,'shared golf catalogue serves identical reviewed evidence');
 assert.deepEqual(review(enriched),enriched,'review is idempotent');
 for(const mutation of [{competitionId:'competition:korn-ferry-tour'},{date:'2026-11-01'},{date:'2027-10-01'},{date:null}])assert.deepEqual(providers({...enriched,...mutation}),[],'review expires or rejects a different competition/date');
 const completed=follow.viewingOptions(review({...f,status:'completed'}));assert(completed.every(o=>o.liveOrReplay==='replay'&&!o.replayVerified),'a later final only offers checking replay availability');
}
for(const id of ['fixture:golf:pga:H2026166','fixture:golf:lpga:2026076','fixture:golf:lpga:2026063']){
 const f=golf.find(f=>f.id===id);assert(f);assert.deepEqual(providers(f),[],'LPGA windows do not extrapolate to Korn Ferry, other dates or past finals');
}
const foreign={...unknown,viewingOptions:[{providerId:'seven',rightsScope:'fixture',sourceUrl:'https://example.test/official-fixture',verifiedAt:'2026-09-25T00:00:00Z'}]};assert.deepEqual(providers(foreign),['seven'],'separate verified fixture evidence survives');
assert.deepEqual(follow.viewingOptions({key:'cricket',competitionId:'competition:cricket:4567'}),[],'undated fixtures do not inherit time-bounded ODI rights');
assert.deepEqual(follow.viewingOptions({key:'cricket',competitionId:'competition:cricket:4567',startTimeUtc:'2027-09-24T00:00:00Z'}),[],'UTC-only observations obey season bounds');
assert.deepEqual(follow.viewingOptions({key:'netball',competitionId:'competition:netball',startTimeUtc:'2027-09-01T00:00:00Z'}).map(o=>o.providerId),['stan','nine'],'other dated rights use actual UTC timing');
// Real retained NHL rows, including zero-score final; viewing never changes facts.
const hockey=require('../data/code-inspector/ice-hockey.json').fixtures;
const nhl=hockey.filter(f=>f.competitionId==='competition:nhl');
const regular=nhl.filter(f=>f.roundLabel==='Regular season'),preseason=nhl.filter(f=>f.roundLabel==='Preseason');
assert.equal(regular.length,1344);assert.equal(preseason.length,65);
const nhlFixture=regular.find(f=>f.id==='fixture:nhl:2026020035');assert(nhlFixture);
for(const f of regular){
 const enriched=review(f),options=follow.viewingOptions(enriched);
 assert.deepEqual(options.map(o=>o.providerId),['disney'],'reviewed current NHL regular season has AU destination');
 assert(options.every(o=>o.url==='https://www.disneyplus.com/en-au/welcome/espn-sports'&&o.rightsScope==='competition'&&o.linkScope==='sport'&&o.territory==='AU'&&o.accessType==='subscription'&&!o.replayVerified));
 assert.equal(options[0].verifiedAt,'2026-10-04T14:47:13.000Z','source review date is fixed, not a refreshed fixture date');
 assert.equal(options[0].liveOrReplay,f.status==='completed'?'replay':'live');
 assert.deepEqual(sporting(enriched),sporting(f),'all NHL sporting IDs, facts and original clocks survive');
 assert.deepEqual(review(enriched),enriched,'unchanged NHL enrichment is idempotent');
 assert.deepEqual(follow.viewingOptions(f).map(o=>o.providerId),['disney'],'browser resolver handles retained source rows without a competing refresh');
}
for(const f of preseason)assert.deepEqual(providers(f),[],'regular-season evidence does not confer preseason access');
const reviewedNhl=review(nhlFixture);
for(const mutation of [
 {competitionId:'competition:chl'},{competitionId:'competition:nhl-reserves'},{roundLabel:'Preseason'},{roundLabel:null},
 {id:'fixture:nhl:2027020035',canonicalEventId:'fixture:nhl:2027020035',sourceEventIds:['fixture:nhl:2027020035']},
 {id:'unknown',canonicalEventId:'unknown',sourceEventIds:[]},
 {startTimeUtc:'2027-04-11T14:00:00Z',date:'2027-04-12'},
 {startTimeUtc:'2026-09-28T13:59:59Z',date:'2026-09-28'},
 {startTimeUtc:null,date:null},{startTimeUtc:'invalid',date:'2026-10-05'}
]){
 const changed={...reviewedNhl,...mutation};
 // CHL's separately reviewed destination is preserved; expired NHL never restores Disney.
 assert(!follow.viewingOptions(review(changed)).some(o=>o.providerId==='disney'),'exact NHL competition, phase, source season and date bound access');
 assert(!follow.viewingOptions(changed).some(o=>o.providerId==='disney'),'old cached competition options cannot bypass current scope');
}
const independentlyReviewed={...preseason[0],viewingOptions:[{providerId:'seven',rightsScope:'fixture',sourceUrl:'https://example.test/official-nhl-fixture',verifiedAt:'2026-10-01T00:00:00Z'}]};
assert.deepEqual(providers(independentlyReviewed),['seven'],'independent fixture evidence survives NHL fallback');
const nhlRule=audit.reviewedWindows.find(r=>r.competitionIds?.includes('competition:nhl'));
const nhlRights=follow.COMPETITION_VIEWING_RIGHTS['competition:nhl:2026-27'];
assert(nhlRule&&nhlRights);assert.equal(nhlRights.fixtureIdPattern,nhlRule.fixtureIdPattern);assert.equal(nhlRights.roundLabel,nhlRule.roundLabel);
for(const rule of audit.reviewedWindows){assert(Number.isFinite(Date.parse(rule.verifiedAt)));assert(Date.parse(rule.notBefore)<Date.parse(rule.notAfter));assert(/^https:\/\//.test(rule.sourceUrl));assert(rule.fixtureIds?.length||rule.competitionIds?.length);}
const beijingId='fixture:tennis:atp-beijing-2026:f:djokovic-de-minaur';
const beijing=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.find(f=>f.id===beijingId);assert(beijing);
const beijingOptions=follow.viewingOptions(review({...beijing,broadcaster:'Stan Sport',viewingOptions:[{providerId:'stan',rightsScope:'fixture',sourceUrl:'https://example.test/old-incorrect-rights',verifiedAt:'2026-10-01T00:00:00Z'}]}));
assert.deepEqual(beijingOptions.map(o=>o.providerId),['bein','tennis-tv'],'the exact Beijing ATP final replaces incorrect Stan rights');
assert.equal(beijingOptions[0].webUrl,'https://connect-au.beinsports.com/en/events/158518?Title=Beijing+Final');
assert.equal(beijingOptions[1].webUrl,'https://www.tennistv.com/live?id=4582948');
assert(beijingOptions.every(o=>o.rightsScope==='fixture'&&o.linkScope==='fixture'&&o.territory==='AU'&&!o.replayVerified));
assert.deepEqual(sporting(review(beijing)),sporting(beijing),'viewing leaves Beijing source clocks, live status and reminder identity unchanged');
for(const mutation of [{competitionId:'competition:tennis:wta-beijing-2026'},{roundLabel:'Semifinal'},{participantIds:['athlete:tennis:novak-djokovic','unknown']},{date:'2027-10-06',startTimeUtc:'2027-10-06T11:00:00Z'}])assert.deepEqual(providers({...review(beijing),...mutation}),[],'Beijing final rights do not leak to WTA, another round, person or edition');
if(process.argv.includes('--published'))for(const folder of ['code-inspector','follow-schedule']){const f=require(`../data/${folder}/tennis.json`).fixtures.find(f=>(f.canonicalEventId||f.id)===beijingId);assert(f);assert.deepEqual(follow.viewingOptions(f).map(o=>o.providerId),['bein','tennis-tv']);assert(['live','completed'].includes(f.status),'The named final retains explicit observed play or its subsequently published final');if(f.status==='completed')assert(f.score&&f.winnerParticipantId,'The observed final has a result');}
const japanId='fixture:tennis:atp-tokyo-2026:f:alcaraz-lehecka';
const japan=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.find(f=>f.id===japanId);assert(japan);
const japanOptions=follow.viewingOptions(review(japan));assert.deepEqual(japanOptions.map(o=>o.providerId),['bein','tennis-tv']);
assert.equal(japanOptions[0].webUrl,'https://connect-au.beinsports.com/en/events/158530?Title=Tokyo+Final');
assert.equal(japanOptions[1].webUrl,'https://www.tennistv.com/live?id=4582945');
assert(japanOptions.every(o=>o.rightsScope==='fixture'&&o.linkScope==='fixture'&&o.territory==='AU'&&o.accessType==='subscription'&&!o.replayVerified));
assert.deepEqual(review(review(japan)),review(japan),'unchanged Japan review retains bytes and source dates');
assert.deepEqual(sporting(review(japan)),sporting(japan),'viewing cannot renew timing or change live, score or action facts');
for(const mutation of [{competitionId:'competition:tennis:atp-beijing-2026'},{participantIds:['competitor:tennis:atp:carlos-alcaraz','competitor:tennis:atp:novak-djokovic']},{roundLabel:'Semifinal'},{date:'2027-10-06',startTimeUtc:'2027-10-06T09:00:00Z'}])assert.deepEqual(providers({...review(japan),...mutation}),[],'Japan final viewing requires the exact edition, participants, round and date');
assert(follow.viewingOptions(review({...japan,status:'completed'})).every(o=>!o.replayVerified),'live carriage is not proof of final replay playback');
if(process.argv.includes('--published')){
 for(const folder of ['code-inspector','follow-schedule']){
  const f=require(`../data/${folder}/tennis.json`).fixtures.find(f=>(f.canonicalEventId||f.id)===japanId);assert(f);assert.deepEqual(follow.viewingOptions(f).map(o=>o.providerId),['bein','tennis-tv'],'Japan options reach both canonical fixture projections');
 }
 const parent=require('../data/tennis-feed-parents.v1.json').parents.find(f=>f.id==='tennis-parent:japan-open-tennis-championships:2026:main');assert.deepEqual(follow.viewingOptions(parent).map(o=>o.providerId),['bein','tennis-tv'],'Japan parent has honest edition/provider links');
 const overview=require('../data/event-overviews.v1.json').events.find(f=>f.tournamentId==='tournament:tennis:atp-tokyo-2026');assert.deepEqual(follow.viewingOptions(overview).map(o=>o.providerId),['bein','tennis-tv'],'Events keeps the same reviewed edition options');
}
if(process.argv.includes('--published')){
 const strip=options=>options.map(({reviewId,...o})=>o);
 for(const folder of ['code-inspector','follow-schedule'])for(const code of ['rugby-union','cricket'])for(const f of require(`../data/${folder}/${code}.json`).fixtures){
  assert.deepEqual(strip(f.viewingOptions),strip(review(f).viewingOptions),`${folder}/${code}/${f.id}: source evidence survives actual projection`);
  if(f.id===superAus.id){assert.equal(f.venue,normalized.venue,'actual final projection carries host venue');assert.equal(f.venueProvenance.checkedAt,normalized.venueProvenance.checkedAt);}
 }
 for(const folder of ['code-inspector','follow-schedule'])for(const id of ['2026068','2026070']){
  const f=require(`../data/${folder}/golf.json`).fixtures.find(f=>f.id==='fixture:golf:lpga:'+id);assert(f);
  assert.deepEqual(f.viewingOptions,review(f).viewingOptions,`${folder}/golf: reviewed competition evidence reaches the published projection`);
  assert.deepEqual(follow.viewingOptions(f).map(o=>o.providerId),['kayo','foxtel']);
 }
 for(const folder of ['code-inspector','follow-schedule']){
  const fixtures=require(`../data/${folder}/ice-hockey.json`).fixtures.filter(f=>f.competitionId==='competition:nhl');
  assert.equal(fixtures.length,1409);
  for(const f of fixtures){assert.deepEqual(f.viewingOptions,review(f).viewingOptions,`${folder}/${f.id}: NHL review survives canonical projection`);assert.equal(follow.viewingOptions(f).some(o=>o.providerId==='disney'),f.roundLabel==='Regular season');}
 }
 const feed=require('../data/events.json').events;
 for(const f of feed.filter(f=>f.key==='rugby'||f.viewingOptions?.some(o=>o.reviewId==='au-viewing-20261002')))assert.deepEqual(f.viewingOptions,review(f).viewingOptions,'published cards retain evidence and original dates');
}
console.log('Reviewed AU viewing: free/paid ordering, exact competitions, three Tests, two LPGA windows, 1344 NHL regular-season fixtures and 65 preseason exclusions, expiry, original facts/dates, honest replay and both projections passed.');
