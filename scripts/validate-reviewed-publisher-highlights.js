'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const contract=require('../config/fixture-highlights');
const fixture=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
const now=new Date('2026-10-16T02:00:00Z');
const url='https://www.rlwc2026.com/videos/australia-v-new-zealand---round-1-2026';
async function main(){
  const original=JSON.stringify(fixture),action=contract.viewing(fixture,now);
  assert.equal(action?.webUrl,url,'The actual completed AUS–NZ card must open its evidenced playable publisher clip without a YouTube search');
  assert.equal(action.providerId,'rlwc');assert.equal(action.label,'RLWC2026');assert.equal(action.logoPath,null);assert.equal(action.highlightsLabel,'Watch highlights');assert.equal(action.accessType,'free');assert(!action.highlightsTopResult&&!action.highlightsSearch);
  const receipt=contract.reviewedPublisher(fixture,now);assert.equal(receipt.publishedAt,'2026-10-15T23:03:49.043Z');assert.equal(receipt.durationSeconds,296.44);assert(Object.isFrozen(receipt)&&Object.isFrozen(receipt.participantIds));
  for(const patch of [{canonicalEventId:'another-fixture'},{competitionId:'competition:nrl:2026'},{date:'2026-10-16'},{roundNumber:2},{season:'2025'},{gender:'women'},{eventType:'wheelchair'},{participantIds:['team:nrl:kangaroos','team:nrl:warriors']},{participantIds:[]},{participantIds:{}},{status:'live'},{status:'cancelled'},{actualStartTimeUtc:'2026-10-16T00:00:00Z'}])assert.notEqual(contract.viewing({...fixture,...patch},now)?.providerId,'rlwc','Changed context cannot reuse the exact publisher record: '+JSON.stringify(patch));
  for(const patch of [{publishedAt:null},{publishedAt:'2022-10-15T23:03:49.043Z'},{publishedAt:new Date(+now+1).toISOString()},{verifiedAt:null},{verifiedAt:new Date(+now+1).toISOString()},{durationSeconds:0},{durationSeconds:10800},{url:'https://attacker.example/video'},{url:url+'?redirect=elsewhere'},{language:'es'},{kind:'full-replay'}])assert(!contract.publisherMatches({...receipt,...patch},fixture,now),'Invalid/expired publisher evidence must fail: '+JSON.stringify(patch));
  assert.equal(contract.reviewedPublisher(fixture,new Date('2026-10-15T20:00:00Z')),null,'A clip cannot be used before its actual publication');
  assert.equal(contract.viewing(fixture,new Date('2026-10-23T23:03:49.044Z')),null,'An expired upload cannot revive the retired fixture');
  const ordinary={...fixture,id:'fixture:test:other',eventId:'fixture:test:other',canonicalEventId:'fixture:test:other'};
  assert.match(contract.viewing(ordinary,now).webUrl,/^\/api\/fixtures\?mode=highlight&ids=/,'Other fixtures retain their generic route');
  const browser={};vm.runInNewContext(fs.readFileSync('config/epic-classics.js','utf8'),browser);vm.runInNewContext(fs.readFileSync('config/fixture-highlights.js','utf8'),browser);
  assert.deepEqual(JSON.parse(JSON.stringify(browser.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS.viewing(fixture,now))),action,'Node and browser use the same exact destination/guards');
  assert.equal(JSON.stringify(fixture),original,'Publisher routing cannot modify sporting facts or saved choices');
  console.log('Reviewed publisher highlights: exact official AUS–NZ clip, unchanged generic route, real publication/runtime, context/expiry/unsafe-evidence fences and Node/browser parity passed; zero live API requests.');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
