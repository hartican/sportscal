'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const source=require('../feeds/provider-exports/tennis/scoreboard-contract.v1.json');
const owner=require('../lib/tennis-scoreboard');
const now=new Date(source.checkedAt),catalogue=require('../data/canonical/tennis-catalogue-2026.json');
const parse=(payload,tour)=>owner.parse(payload,{tour,checkedAt:source.checkedAt,now,catalogue});
const wta=parse(source.payloads.wta,'wta'),atp=parse(source.payloads.atp,'atp');
const wuhanReceipt=require('./fixtures/wta-wuhan-identity-20261009.json'),wuhanClock=new Date(wuhanReceipt.checkedAt);
const parseWuhan=payload=>owner.parse(payload,{tour:'wta',checkedAt:wuhanReceipt.checkedAt,now:wuhanClock,catalogue,requestUrl:wuhanReceipt.sourceUrl});
const wuhan=parseWuhan(wuhanReceipt.payload);
assert.equal(wuhan.editions[0].tournamentId,'tournament:tennis:wta-wuhan-2026','The captured sponsored name must reach the existing approved Wuhan edition');
assert.equal(wuhan.fixtures.length,0,'A real TBD draw slot cannot create a match');assert.equal(wuhan.gaps[0].reason,'unassigned-participant');
const legacyWuhan=structuredClone(wuhanReceipt.payload);legacyWuhan.events[0].name='Wuhan Open';assert.deepEqual(parseWuhan(legacyWuhan),wuhan,'The prior exact name remains supported');
for(const name of ['Dongfeng Voyah China Open','Wuhan Open Doubles','Dongfeng Wuhan Open']){const wrong=structuredClone(wuhanReceipt.payload);wrong.events[0].name=name;assert.throws(()=>parseWuhan(wrong),/edition mismatch/,'Only the two reviewed exact Wuhan names are accepted');}
const wrongDraw=structuredClone(wuhanReceipt.payload);wrongDraw.events[0].groupings[0].grouping.slug='mens-singles';assert.throws(()=>parseWuhan(wrongDraw),/singles collection/,'The sponsor name cannot cross tour/draw identity');
const missingDraw=structuredClone(wuhanReceipt.payload);delete missingDraw.events[0].groupings;assert.throws(()=>parseWuhan(missingDraw),/edition mismatch/,'Partial edition responses remain rejected');
const anotherEdition=structuredClone(wuhanReceipt.payload);anotherEdition.events[0].id='959-2026';assert.throws(()=>parseWuhan(anotherEdition),/edition mismatch/,'Wuhan name cannot be reused for the other reviewed edition');

const next=wta.fixtures.find(f=>f.tennisProviderMatchId==='184351');
assert(next&&next.participantIds.includes('competitor:tennis:wta:karolina-muchova'),'Automatically discover the next published Muchova match');
assert(next.participantIds.includes('competitor:tennis:wta:nikola-bartunkova'));
assert.equal(next.startTimeUtc,null,'Publisher provisional clocks are not official reminder times');
assert.equal(next.timePrecision,'unresolved');
assert(require('./quick-results').projectionSteps(['Current tennis source discovery']).some(s=>s[0]==='scripts/publish-feed.js'),'Ordinary quick refresh publishes discovered fixtures');
assert(require('./update-cards').buildSteps({localOnly:true}).some(s=>s[0]==='scripts/refresh-tennis-scoreboard.js'),'Full refresh discovers fixtures');
const prefs={version:27,onboardingComplete:true,selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]},followFirst:{collectionFollows:['collection:tennis:womens-top-10'],notifications:{enabled:false,sportingRemindersEnabled:false,autoRemindersEnabled:false}}};
const pipeline=require('../lib/server-feed-pipeline');const build=state=>pipeline.buildServerFeed({events:[next],userId:'qa-auto-tennis',userState:state,now,limit:50});const contains=r=>r.events.some(e=>(e.canonicalEventId||e.id)===next.id);
assert(contains(build({preferences:prefs})),'Newly discovered fixtures automatically enter the existing collection Feed');assert(!contains(build({preferences:{}})),'Discovery does not establish a follow');
assert(contains(build({preferences:{...prefs,followFirst:{...prefs.followFirst,excludedMajorEventIds:['china-open']}}})),'Event unfollow retains independently followed player fixtures');
assert(!contains(pipeline.buildServerFeed({events:[next],userId:'qa-auto-tennis',userState:{preferences:prefs,event_user_state:{[next.id]:{dismissed:true}}},now,limit:50,athletesOnly:true})),'Dismissal wins over discovery');
assert.equal(require('../config/fixture-reminder-policy').timing(next),null);
assert(next.estimatedStartTimeUtc);assert.equal(next.expected,null,'Published facts do not invent a Heat prediction');assert(!Object.hasOwn(next,'stakesScore'));
const suspended=structuredClone(source.payloads.wta);const interrupted=suspended.events[0].groupings[0].competitions.find(c=>c.id==='184349');interrupted.status.type={...interrupted.status.type,name:'STATUS_SUSPENDED',completed:false};const interruptedFixture=parse(suspended,'wta').fixtures.find(f=>f.tennisProviderMatchId==='184349');assert.equal(interruptedFixture.status,'suspended');assert(!interruptedFixture.result,'Interrupted play has no final result');assert.equal(require('./lib/feed-utils').validateFeed({...require('../data/events.json'),events:[interruptedFixture]}).length,0,'An exact sourced interruption remains publishable');
const oldReverse={...next,id:'legacy-next',canonicalEventId:'legacy-next',homeParticipantId:next.awayParticipantId,awayParticipantId:next.homeParticipantId,participantIds:[...next.participantIds].reverse(),participants:[...next.participants].reverse()};const liveNext={...next,status:'live',sets:[{home:3,away:2}],score:'3–2'};const reversed=owner.merge([oldReverse],[liveNext],{now})[0];assert.deepEqual(reversed.sets.map(s=>[s.home,s.away]),[[2,3]]);assert(!reversed.result,'Side reversal cannot turn a live score into a final result');
const final=wta.fixtures.find(f=>f.tennisProviderMatchId==='184349');assert.equal(final.status,'completed');
const reverseFinal={...final,id:'legacy-reversed-final',canonicalEventId:'legacy-reversed-final',name:'Naomi Osaka v Karolina Muchova',status:'live',homeParticipantId:final.awayParticipantId,awayParticipantId:final.homeParticipantId,participantIds:[...final.participantIds].reverse(),participants:[...final.participants].reverse()};const oriented=owner.merge([reverseFinal],[final],{now})[0];assert.equal(oriented.name,reverseFinal.name);assert.equal(oriented.score,'5–7, 6–1, 6–7');assert(oriented.recapText.includes(oriented.score),'Title, score and result summary agree with retained side order');
assert.equal(final.winnerParticipantId,'competitor:tennis:wta:karolina-muchova');
assert.deepEqual(final.sets.map(s=>[s.home,s.away]),[[7,5],[1,6],[7,6]]);
assert(atp.gaps.some(g=>g.reason==='unassigned-participant'),'TBD draw slots cannot create fixtures');
assert(!atp.fixtures.some(f=>f.participantIds.some(p=>/tbd|bye/i.test(p))));
const reviewed=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events;
const muchova=reviewed.find(e=>e.id==='fixture:tennis:wta-beijing-2026:r16:muchova-osaka');
const merged=owner.merge([muchova],wta.fixtures,{now});const updated=merged.find(f=>f.canonicalEventId===muchova.id);
assert.equal(updated.competitionId,muchova.competitionId,'Publisher updates preserve retained competition identity and viewing scope');assert.equal(updated.status,'completed');assert.equal(updated.id,muchova.id);assert.equal(updated.startTimeUtc,muchova.startTimeUtc);assert.equal(updated.sourceCheckedAt,muchova.sourceCheckedAt,'A result check cannot renew the official schedule observation');
assert(updated.sourceEventIds.includes(final.id));
assert.equal(owner.merge(merged,wta.fixtures,{now}).find(f=>f.id===updated.id).scoreCheckedAt,updated.scoreCheckedAt,'Unchanged final replays preserve fact clocks');
const bad=structuredClone(source.payloads.wta);bad.events[0].groupings[0].competitions.find(c=>c.id==='184349').competitors[0].winner=true;
assert.throws(()=>parse(bad,'wta'),/winner/);
const corrupt=structuredClone(source.payloads.wta);corrupt.events[0].groupings[0].competitions.find(c=>c.id==='184349').competitors[1].linescores[2].value=0;assert.throws(()=>parse(corrupt,'wta'),/winner/);
const unknown=structuredClone(source.payloads.wta);unknown.events[0].groupings[0].competitions[0].status.type.name='STATUS_UNREVIEWED';assert.throws(()=>parse(unknown,'wta'),/state/);
assert.throws(()=>owner.parse(source.payloads.wta,{tour:'wta',checkedAt:'2099-01-01T00:00:00Z',now,catalogue}),/observation/);
assert.throws(()=>owner.parse(source.payloads.wta,{tour:'wta',checkedAt:source.checkedAt,now:new Date(+now+6*3600000+1),catalogue}),/stale observation/,'A successful fetch cannot renew a stale source timestamp');
(async()=>{
 // The synthetic response and freshness check must share the contract clock.
 // Real wall time would eventually expire this fixture and reject every mock.
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-tennis-source-')),realNow=Date.now;
 Date.now=()=>+now;try{
  for(const file of ['data/events.json','feeds/incoming/events.json']){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify({...require('../data/events.json'),events:[muchova]}));}
  let calls=0;const futureDate=new Date(+now+7*86400000).toISOString().slice(0,10).replace(/-/g,'');const fetchImpl=async url=>{calls++;return {ok:true,status:200,headers:new Headers({date:source.checkedAt}),json:async()=>url.includes('/wta/')&&url.includes('dates='+futureDate)?wuhanReceipt.payload:source.payloads[url.includes('/atp/')?'atp':'wta']};};
  const result=await owner.refresh({root,now,fetchImpl,catalogue});assert.equal(calls,4);assert.equal(result.failures.length,0,'The actual four-resource owner accepts the sponsored future Wuhan response');assert(result.editions.some(e=>e.tournamentId==='tournament:tennis:wta-wuhan-2026'));assert(result.gaps.some(g=>g.id==='185344'&&g.reason==='unassigned-participant'));assert(result.changed);assert(JSON.parse(fs.readFileSync(path.join(root,'data/events.json'))).events.some(e=>e.tennisProviderMatchId==='184351'));
  const later=new Date(+now+60000);const unchanged=owner.merge(merged,owner.parse(source.payloads.wta,{tour:'wta',checkedAt:later.toISOString(),now:later,catalogue}).fixtures,{now:later}).find(f=>f.id===updated.id);assert.equal(unchanged.scoreCheckedAt,updated.scoreCheckedAt,'Repeated source checks cannot renew unchanged official result clocks');
  const settled=owner.merge([updated],[{...final,status:'live',score:'0–0'}],{now})[0];assert.equal(settled.status,'completed','A provider replay cannot reopen a final');
  const before=fs.readFileSync(path.join(root,'data/events.json'),'utf8');await owner.refresh({root,now,fetchImpl:async()=>{throw Error('Unavailable');},catalogue});assert.equal(fs.readFileSync(path.join(root,'data/events.json'),'utf8'),before,'Outages preserve last-good fixtures');
 }finally{Date.now=realNow;fs.rmSync(root,{recursive:true,force:true});}
 console.log('Tennis discovery, ordered results, identity/clock preservation, provisional times, placeholders and source failures verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
