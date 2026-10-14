'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const follow=require('../config/follow-first'),review=require('../lib/reviewed-au-viewing').reviewedAuViewing;
const proof=ids=>ids.map(providerId=>({providerId,rightsScope:'fixture',sourceUrl:'https://example.test/official-au-fixture',verifiedAt:'2026-10-14T00:00:00Z',territory:'AU'}));
const fixture={key:'football',status:'upcoming',viewingOptions:proof(['bein','nine','stan','kayo'])},original=JSON.stringify(fixture);
for(const [services,expected] of [[[],['nine','stan','bein','kayo']],[['kayo'],['kayo','nine','stan','bein']],[['bein','stan'],['stan','bein','nine','kayo']],[['nine'],['nine','stan','bein','kayo']],[['unknown','kayo'],['kayo','nine','stan','bein']]])assert.deepEqual(follow.viewingOptions(fixture,services).map(o=>o.providerId),expected);
for(const services of [[],['iihf-tv']])assert.deepEqual(follow.viewingOptions({...fixture,viewingOptions:proof(['iihf-tv','nine','kayo','stan'])},services).map(o=>o.providerId),['nine','stan','kayo','iihf-tv'],'Unknown-priced carriage does not inherit verified-free ordering');
assert.deepEqual(follow.viewingOptions({...fixture,viewingOptions:proof(['stan','nine']).map(o=>o.providerId==='stan'?{...o,accessType:'unknown'}:o)},['stan']).map(o=>o.providerId),['nine','stan'],'Explicit unknown cost does not become a confirmed paid subscription');
assert.equal(JSON.stringify(fixture),original,'Ordering never edits fixture or account preferences');
assert.deepEqual(follow.viewingOptions({...fixture,viewingOptions:proof(['stan','kayo']).map(o=>o.providerId==='kayo'?{...o,accessType:'free'}:o)}).map(o=>o.providerId),['kayo','stan'],'Fixture-specific free access ranks ahead of unsubscribed paid services');
for(const input of [{broadcaster:'Stan Sport'},{broadcasterIds:['stan']},{viewingOptions:[{providerId:'stan'}]},{viewingOptions:proof(['stan']).map(o=>({...o,territory:'GB'}))},{viewingOptions:proof(['stan']).map(o=>({...o,verifiedAt:'2099-01-01T00:00:00Z'}))}])assert.deepEqual(follow.viewingOptions({key:'football',...input}),[],'Provider claims require current AU evidence');
const catalogue=require('../data/coverage/australian-viewing-rights.v1.json');
for(const [name,ids,date,expected,tour,tournamentId] of [
 ['WTA',['competition:wta-tour'],'2026-10-15',['stan','bein'],'WTA','tournament:tennis:wta-wuhan-2026'],
 ['ATP',['competition:atp-tour'],'2026-10-03',['bein','tennis-tv'],'ATP','tournament:tennis:atp-beijing-2026'],
 ['Shield',['competition:cricket:espn:8043'],'2026-10-15',['cricket-australia','kayo']],
 ['One-Day',['competition:cricket:espn:8626'],'2026-10-15',['cricket-australia','kayo']],
 ['BBL',['competition:cricket:espn:8044'],'2026-12-15',['kayo','foxtel']],
 ['Nations',['competition:nations-championship:2026'],'2026-11-28',['stan']]
]){
 const e={id:'fixture:controlled:'+name,key:tour?'tennis':name==='Nations'?'rugby':'cricket',competitionId:ids[0],date,tour,tournamentId,status:'upcoming',roundLabel:'Final'},projected=review(e);
 assert.deepEqual(follow.viewingOptions(projected).map(o=>o.providerId),expected,name+' source-backed scoped viewing');
 const {viewingOptions,broadcaster,broadcastOptions,broadcasterIds,...facts}=projected;assert.deepEqual(facts,e,'Viewing cannot change sporting facts');
 assert.deepEqual(review(projected),projected,'Unchanged review is idempotent');
 if(tour){assert.deepEqual(follow.viewingOptions(review({...e,representedTours:['ATP','WTA']})),[],'Mixed draws cannot inherit single-tour carriage');assert(!follow.viewingOptions(review({...e,roundLabel:'Qualifying'})).some(o=>o.providerId==='tennis-tv'||o.providerId==='stan'),'No invented qualifying access');}
 assert.deepEqual(follow.viewingOptions(review({...projected,date:'2028-10-15'})),[],'Reviewed edition expires');
 assert.deepEqual(follow.viewingOptions({...projected,date:'2028-10-15'}),[],'Cached options cannot bypass current window');
 assert.deepEqual(follow.viewingOptions({...projected,date:'2028-10-15'}),[],'Cached options cannot bypass current window');
}
const scoped=review({id:'fixture:controlled:cache-shape',key:'tennis',competitionId:'competition:wta-tour',date:'2026-10-15',tour:'WTA',tournamentId:'tournament:tennis:wta-wuhan-2026',status:'upcoming',roundLabel:'Final'});
for(const mutation of [{season:2027},{sportId:'sport:football'},{sportDomainId:'sport:football'},{taxonomySportId:'sport:football'}])assert.deepEqual(follow.viewingOptions({...scoped,...mutation}),[],'Changed cached season or sporting identity cannot keep reviewed carriage');
const exactFixture={id:'fixture:controlled:domestic-permalink',key:'cricket',competitionId:'competition:cricket:espn:8043',date:'2026-10-15',status:'upcoming',viewingOptions:[{providerId:'cricket-australia',rightsScope:'fixture',linkScope:'fixture',webUrl:'https://www.cricket.com.au/matches/controlled-source-fixture',sourceUrl:'https://www.cricket.com.au/matches/controlled-source-fixture',verifiedAt:'2026-10-10T00:00:00Z',territory:'AU',accessType:'free'}]};
const exactReviewed=review(exactFixture),exactOptions=follow.viewingOptions(exactReviewed);
assert.deepEqual(exactReviewed.viewingOptions[0],exactFixture.viewingOptions[0],'Independent exact fixture evidence keeps its original destination and observation');
assert.deepEqual(exactOptions.map(o=>o.providerId),['cricket-australia'],'Retain the existing exact-fixture precedence instead of replacing it with broader carriage');
assert.equal(exactOptions[0].webUrl,exactFixture.viewingOptions[0].webUrl);assert.deepEqual(review(exactReviewed),exactReviewed,'Fixture precedence remains idempotent');
const window=scoped.viewingOptions[0].coverageWindow;
for(const broken of [window.slice(0,5),window.map((v,i)=>i===5?'[':v),window.map((v,i)=>i===8?{}:v),window.map((v,i)=>i===10?{}:v),window.map((v,i)=>i===3?null:v),window.map((v,i)=>i===11?{}:v)])
 assert.deepEqual(follow.viewingOptions({...scoped,viewingOptions:scoped.viewingOptions.map(o=>({...o,coverageWindow:broken}))}),[],'Malformed cached coverage fails closed without breaking the card');
const node=tag=>({tag,children:[],attributes:{},append(...nodes){this.children.push(...nodes);},appendChild(n){this.children.push(n);return n;},setAttribute(k,v){this.attributes[k]=String(v);},addEventListener(){}});
let options;const context={document:{createElement:node},userPreferences:{followFirst:{subscriptions:[]}},FOLLOW_FIRST:{viewingOptions:()=>options},buildViewingProviderMark:()=>node('mark')};
const read=require('./app-shell-test-utils').readCardFunction;
vm.runInNewContext(['configureProviderLaunch','viewingAccessLabel','appendEventQuickActions'].map(read).join('\n'),context);
for(const [items,count] of [[[],0],[[{...follow.VIEWING_PROVIDERS.stan,liveOrReplay:'replay',replayVerified:false}],0],[[{...follow.VIEWING_PROVIDERS.stan,liveOrReplay:'replay',replayVerified:true}],1]]){options=items;const host=node('host');context.appendEventQuickActions(host,{key:'football'},{reminder:false,chat:false});assert.equal(host.children[0].children.length,count);if(count)assert.equal(host.children[0].children[0].children[0].attributes['aria-label'],'Replay on Stan Sport · Subscription');}
const cardSource=fs.readFileSync('config/venue-panel-ui.js','utf8'),about=fs.readFileSync('config/fantasy-deadline-ui.js','utf8');assert(!cardSource.includes('nsc-rating-help'));assert(!cardSource.includes('Start time unconfirmed'));assert(!cardSource.includes('Australian viewing unconfirmed'));assert(about.includes('About Anticipation/Electricity/Impact ratings'));assert(about.includes('8× weight'));assert(about.includes('EPIC Hall of Fame'));
assert(catalogue.reviewedWindows.some(r=>r.id==='wta-tour-2026-au'));
assert(fs.readFileSync('.github/workflows/sportscal-production.yml','utf8').includes('          node scripts/validate-clean-feed-viewing.js\n'),'The ordinary production workflow runs this contract');
console.log('Clean Feed/viewing: account ordering, AU evidence, dated edition/tour/qualifying boundaries, expiry, idempotency, sporting preservation and real renderer empty/replay actions passed.');
