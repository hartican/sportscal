'use strict';
// Source checks of the exact request audit and pagination used by the native
// harness. No browser, server, database, provider or dependency installation.
const assert = require('node:assert/strict'), crypto = require('node:crypto'), vm = require('node:vm'), cp = require('node:child_process'), fs = require('node:fs');
const fixture = require('./validate-public-feed-browser');
const base = 'http://127.0.0.1:12345';
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const baseline = process.argv.includes('--reviewed-baseline');
const old = baseline ? cp.execFileSync('git', ['show', 'd4c42c3e8a1dae2cc9f0f401fea1c127a8b8c941:scripts/validate-public-feed-browser.js'], {encoding:'utf8'}) : null;
const oldApi = old ? vm.runInNewContext('(' + old.slice(old.indexOf('async function api('), old.indexOf('\nasync function isolate(')) + ')', {assert, crypto, session:() => ({}), gifConfig:() => ({capabilities:{}})}) : null;
const oldAudit = old ? new Function('assert', 'state', 'return (' + old.slice(old.indexOf('async function untouched('), old.indexOf('\nasync function open(')) + ');')(assert, async () => ({})) : null;
const token = owner => 'e30.' + Buffer.from(JSON.stringify({sub:owner})).toString('base64url') + '.synthetic';
const request = (method, body, owner) => ({method:() => method, postDataJSON:() => body, headers:() => ({authorization:'Bearer ' + token(owner)})});
const model = () => Object.assign(fixture.scenario(), {base});
async function invoke(target, method, body, actor = target.owner){
  let response;
  await (oldApi || fixture.api)({request:() => request(method, body, actor), fulfill:async value => { response = value; }}, target, new URL('/api/chat', base));
  return response;
}
const query = (target, values = {}) => { const url = new URL('/api/chat', base); url.search = new URLSearchParams({mode:'public-comments', roomId:target.event.id, ...values}); return url; };

async function mutation(method){
  const target = model();
  const response = await invoke(target, method, {action:'update-preferences', followedSports:['nrl']});
  assert.equal(target.apiWrites.length, 1, method + ' must be recorded even when no POST body path executes');
  if(oldAudit){
    await assert.rejects(oldAudit({evaluate:async () => []}, {}, target, 0), /Every mutating method/, 'Original chat-path exemption must fail the control');
  }else{
    assert.equal(response.status, 405); assert.equal(target.apiWrites[0].method, method); assert.equal(target.apiWrites[0].allowed, false);
    assert.throws(() => fixture.assertAllowedWrites(target), /Every mutating method/);
  }
}

function ownership(){
  const target = model(), row = target.rows[0];
  const validVote = {action:'public-comment-vote', eventId:target.event.id, id:row.id, value:1};
  const audit = (method, body, owner = target.owner, pathname = '/api/chat') => fixture.recordWrite(request(method, body, owner), target, new URL(pathname, base));
  assert(audit('POST', validVote).allowed);
  const media = require('../config/chat-media-ui'), gif = media.normalizedGiphyItem({id:'synthetic-0', title:'Actual picker shape', images:{original:{url:'https://media.giphy.com/media/synthetic/giphy.gif'}, fixed_width:{url:'https://media.giphy.com/media/synthetic/200w.gif'}}});
  assert.equal(gif.contentType, undefined, 'Actual picker input is normalized by the server, not pre-normalized in this audit');
  assert(audit('POST', {action:'public-comment-post', eventId:target.event.id, clientId:crypto.randomUUID(), body:'', gif}).allowed);
  for(const [body, owner] of [[validVote, '33333333-3333-4333-8333-333333333333'], [{...validVote, eventId:'fixture:wrong'}], [{...validVote, value:100}], [{...validVote, preferences:{followedSports:['nrl']}}], [{action:'public-comment-delete', eventId:target.event.id, id:row.id}]]) assert.equal(audit('POST', body, owner).allowed, false);
  assert.equal(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed, false, 'No inferred private membership');
  target.privateMembers.add(target.owner);
  assert(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed);
  target.points = 24;
  assert.equal(audit('POST', {action:'gif-reference', roomId:'synthetic-private', gif:{contentUrl:'https://media.giphy.com/media/synthetic/giphy.gif'}}).allowed, false);
  for(const method of ['PUT', 'PATCH', 'DELETE', 'TRACE']) assert.equal(audit(method, validVote).allowed, false);
  assert.equal(audit('POST', validVote, target.owner, '/api/preferences').allowed, false);
  assert.equal(audit('POST', {action:'password-sign-in', email:'synthetic@example.invalid', password:'synthetic'}, target.owner, '/api/auth').allowed, false);
  assert(target.apiWrites.every(record => record.method && record.currentOwner));
}

async function pagination(){
  const target = model(); fixture.paginatedFixture(target);
  if(oldApi){
    let response; await oldApi({request:() => request('GET', null, target.owner), fulfill:async value => { response = value; }}, target, query(target));
    assert(response.json.comments.filter(row => !row.parentId).length <= 25, 'Original unbounded root response must fail the control'); return;
  }
  const read = values => fixture.commentPage(target, query(target, values), target.owner);
  const roots = [], rootTokens = []; let cursor, pages = 0;
  do{
    const result = read(cursor ? {before:cursor} : {}); assert(!result.status); assert(result.json.comments.filter(row => !row.parentId).length <= 25);
    roots.push(...result.json.comments.filter(row => !row.parentId).map(row => row.id)); cursor = result.json.nextCursor; if(cursor) rootTokens.push(cursor); assert(++pages <= 3);
  }while(cursor);
  assert.equal(pages, 3); assert.equal(roots.length, 52); assert.equal(new Set(roots).size, 52);
  const replies = [], replyTokens = []; cursor = null; pages = 0;
  do{
    const result = read({q:target.rows[0].id, ...(cursor ? {before:cursor} : {})}); assert(!result.status); assert(result.json.comments.length <= 25);
    replies.push(...result.json.comments.map(row => row.id)); cursor = result.json.nextCursor; if(cursor) replyTokens.push(cursor); assert(++pages <= 3);
  }while(cursor);
  assert.equal(replies.length, 57); assert.equal(new Set(replies).size, 57);
  assert.equal(read({q:target.rows[0].id, before:rootTokens[0]}).status, 400);
  assert.equal(read({q:target.rows[1].id, before:replyTokens[0]}).status, 400);
  assert.equal(read({before:rootTokens[0] + 'tampered'}).status, 400);
  assert.equal(read({before:'x'.repeat(1025)}).status, 400);
  assert.equal(read({after:'-1'}).status, 400); assert.equal(read({after:String(target.revision + 1)}).status, 409);
  let after = 0, changes = [], batches = 0;
  do{ const result = read({after:String(after)}).json; assert(result.comments.length <= 102); assert(result.revision > after); changes.push(...result.comments); after = result.revision; assert(++batches <= 2); if(!result.hasMore) break; }while(true);
  assert.equal(batches, 2); assert.equal(new Set(changes.map(row => row.id)).size, target.rows.length);
  target.revision++; assert.equal(read({before:rootTokens[0]}).status, 409);
  assert.equal(fixture.commentPage(target, query(target), 'wrong-owner').status, 401);
  assert.equal(fixture.commentPage(target, query(target, {roomId:'fixture:other'}), target.owner).status, 404);
}

async function seenState(){
  const html=fs.readFileSync('index.html','utf8'),declaration=html.match(/const surfaceSeenEvents = new WeakMap\(\);/)?.[0];
  assert(declaration,'Read the actual current owner declaration, not a substitute Map');
  const element={id:'visible'},slot={id:'detached-slot'},extra={id:'public-only'},elements=[element],forwarded=[];
  const context={document:{querySelectorAll:()=>elements},userPreferences:{showSpoilers:false},eventActions:{},cardViewStates:{},eventSpoilerState:{},sessionOpenedEventIds:new Set(),feedCardSlots:new Map([[1,{slot,event:{id:'fixture:child'},mounted:false}]]),activeTab:'feed',
    setCardState(...args){forwarded.push(args);return 'actual-return';},updateEventAction(){},recordEventFeedAction(){},surfacePresentationForEvent:()=>({isNew:true}),getSurfaceSeenObserver:()=>({observe(){forwarded.push('observed');}})};
  vm.createContext(context);vm.runInContext(declaration,context);context.element=element;context.slot=slot;context.extra=extra;
  vm.runInContext("surfaceSeenEvents.set(element,{id:'visible-before'});surfaceSeenEvents.set(slot,{id:'detached-before'});",context);
  const observe=html.slice(html.indexOf('function observeNewSurfaceItem('),html.indexOf('\nfunction latestEventFeedbackDirection('));vm.runInContext(observe,context);
  if(process.argv.includes('--snapshot-baseline')){
    const reviewed=cp.execFileSync('git',['show','382e7055606a091f37e64ba8dfc5f05441e99703:scripts/validate-public-feed-browser.js'],{encoding:'utf8'});
    const oldState=vm.runInContext('('+reviewed.slice(reviewed.indexOf('async function state(page){'),reviewed.indexOf('\nasync function untouched('))+')',context);
    await oldState({evaluate:fn=>vm.runInContext('('+fn.toString()+')()',context)});return;
  }
  vm.runInContext('('+fixture.installPersonalStateObserver.toString()+')()',context);
  const snapshot=()=>JSON.stringify(context.__publicFeedSnapshot()),before=snapshot();
  elements.push(extra);elements.shift();assert.equal(snapshot(),before,'DOM insertion/removal cannot renumber captured keys or lose detached state');
  assert(context.__publicFeedSnapshot().seen.includes('detached-before'));
  assert.equal(context.setCardState('fixture:child','opened'),'actual-return');assert.deepEqual(forwarded[0],['fixture:child','opened']);
  context.observeNewSurfaceItem(extra,{id:'new-real-observation'});
  assert(context.__publicFeedWrites.includes('observeNewSurfaceItem'));assert(context.__publicFeedWrites.includes('surfaceSeenEvents.set'));assert.notEqual(snapshot(),before);
  assert.equal(vm.runInContext('surfaceSeenEvents.get(extra).id',context),'new-real-observation','The original WeakMap write is forwarded, never suppressed');
  assert.equal(vm.runInContext('surfaceSeenEvents.delete(slot)',context),true);assert(context.__publicFeedWrites.includes('surfaceSeenEvents.delete'));
  assert.equal(vm.runInContext('surfaceSeenEvents.has(slot)',context),false);
  const count=context.__publicFeedWrites.length;vm.runInContext('new WeakMap().set(extra,{id:"peer"})',context);assert.equal(context.__publicFeedWrites.length,count,'Peer WeakMaps are untouched');
}

async function admissionLifetime(){
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><body></body>'),html=fs.readFileSync('index.html','utf8'),frames=[],observed=[],removed=[];let notify,mounts=0;
  const context={document:dom.window.document,innerHeight:844,serverPersistence:{},userPreferences:{feedControls:{}},
    setTunePromptOpen(){},suppressSessionRatingPrompt(){},closeSettings(){},cardStateForEvent:()=> 'selected',mainFeedFixtureSemanticKey:event=>event.id,spoilerSafeDisplayTitle:event=>event.name,
    buildEventCard(){mounts++;throw Error('A hidden admission placeholder must not mount an ordinary Feed card');},
    requestAnimationFrame:callback=>frames.push(callback),IntersectionObserver:class{constructor(callback){notify=callback;}observe(slot){observed.push(slot);}unobserve(slot){removed.push(slot);}}};
  vm.createContext(context);
  const start=html.indexOf('const feedCardSlots = new Map();'),end=html.indexOf('\nfunction appendFeedPageToCurrentList(',start);assert(start>=0&&end>start);vm.runInContext(html.slice(start,end),context);
  Object.assign(context,{EVENT_ACTION_IDENTITY:require('../config/event-action-identity'),NOTHINGSPORTS_REMINDER_POLICY:require('../config/fixture-reminder-policy'),NOTHINGSPORTS_FIXTURE_IDENTITY:require('../config/fixture-identity'),CARD_LIFECYCLE:require('../config/card-lifecycle'),NOTHINGSPORTS_EPIC:require('../config/epic-classics'),NOTHINGSPORTS_CALENDAR:require('../config/calendar-export'),eventActions:{},archivedEventRefs:[],followDirectoryChunks:[]});
  vm.runInContext(html.slice(html.indexOf('function eventActionKey('),html.indexOf('\nfunction enrichmentContextForEvent(')),context);
  vm.runInContext(html.slice(html.indexOf('function followCollectionsById(){'),html.indexOf('\nfunction ensureFollowCollectionDirectories(')),context);
  const venue=fs.readFileSync('config/venue-panel-ui.js','utf8');vm.runInContext(venue.slice(venue.indexOf('function eventMeetsDerivedRetention('),venue.indexOf('\nfunction eventIsAutoArchived(')),context);
  const ui=fs.readFileSync('config/public-comments-ui.js','utf8'),admitted=ui.slice(ui.indexOf('  const admitted=()=>'),ui.indexOf('\n  if(!admitted())'));assert(admitted.includes('feedCardSlots.values()'));vm.runInContext(admitted,context);
  // Exact clocks captured in the failed f38 native fixture, without redating
  // it or changing either the application clock or the native scenario.
  const event={...fixture.scenario().event,date:'2026-10-27',startTimeUtc:'2026-10-26T12:01:06.867Z',statusCheckedAt:'2026-10-26T13:01:06.867Z',scoreCheckedAt:'2026-10-26T13:01:06.867Z'};context.identity=context.NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(event.id);context.clockFixture=event;
  function clockAdmission(expected){for(const instant of ['2026-10-26T12:59:59.999Z','2026-10-26T13:00:00.001Z']){context.reference=new Date(instant);context.nowAEST=()=>context.reference;assert.equal(vm.runInContext('eventMeetsDerivedRetention(clockFixture,reference)',context),true,'Actual retention caller retains this unchanged live fixture on both sides of Sydney midnight');assert.equal(vm.runInContext('Boolean(admitted())',context),expected,'Actual route admission depends on the retained slot/actions, not Sydney midnight');}}
  let seed=fixture.installAdmittedFixture.toString();
  if(process.argv.includes('--admission-baseline')){
    const oldBoot=cp.execFileSync('git',['show','f38c51a138fdf415107cf7805b3251fe66427054:scripts/validate-public-feed-browser.js'],{encoding:'utf8'}),start=oldBoot.indexOf('await page.evaluate(async ({event, registered, owner, anonymous, cold, navigationPath}) => {')+'await page.evaluate('.length,end=oldBoot.indexOf('}, {event:model.event, registered:model.registered',start)+1;
    assert(start>0&&end>start);seed=oldBoot.slice(start,end);
  }
  try{
    context.peerEvent={id:'fixture:other',name:'Existing observed fixture'};const peer=vm.runInContext('buildFeedCardSlot(peerEvent)',context);dom.window.document.body.append(peer);while(frames.length)frames.shift()();assert.equal(observed[0],peer);
    await vm.runInContext('('+seed+')',context)({event,registered:true,owner:'synthetic',anonymous:false,cold:false});
    const slot=context.__publicFeedSlot;assert(vm.runInContext('feedCardSlots.has(__publicFeedSlot)',context),'Seed initially registers the exact canonical fixture');
    clockAdmission(true);
    while(frames.length)frames.shift()();
    // The real callback always runs its detached-slot cleanup, even when an
    // unrelated observed card, rather than this slot, triggered delivery.
    notify([{target:peer,isIntersecting:false}]);
    assert(vm.runInContext('feedCardSlots.has(__publicFeedSlot)',context),'Actual Feed observer cleanup must retain the test admission before opening comments');
    clockAdmission(true);
    assert(slot.isConnected);assert.equal(slot.parentElement.hidden,true);assert.equal(observed.length,2);assert.equal(observed[1],slot);
    notify([{target:slot,isIntersecting:false}]);assert.equal(mounts,0);assert.equal(vm.runInContext('feedCardSlots.get(__publicFeedSlot).mounted',context),false);assert.equal(slot.querySelector('.event-card'),null);assert.equal(slot.querySelectorAll('.feed-card-placeholder').length,1);
    context.identity='fixture:unknown';assert.equal(vm.runInContext('Boolean(admitted())',context),false,'Unknown fixtures remain denied');context.identity=context.NOTHINGSPORTS_FIXTURE_IDENTITY.canonicalFixtureId(event.id);const actionKey=context.EVENT_ACTION_IDENTITY.stableKey(event);context.eventActions[actionKey]={dismissed:true};clockAdmission(false);delete context.eventActions[actionKey];clockAdmission(true);
    const expired={...event,status:'completed',date:'2026-10-01',startTimeUtc:'2026-10-01T01:00:00.000Z',actualEndTimeUtc:'2026-10-01T03:00:00.000Z',statusCheckedAt:'2026-10-01T03:01:00.000Z',scoreCheckedAt:'2026-10-01T03:01:00.000Z'};context.expiredFixture=expired;for(const instant of ['2026-10-26T12:59:59.999Z','2026-10-26T13:00:00.001Z']){context.reference=new Date(instant);assert.equal(vm.runInContext('eventMeetsDerivedRetention(expiredFixture,reference)',context),false,'Actual expired-final refusal remains on both sides of midnight');}
    slot.remove();notify([{target:slot,isIntersecting:false}]);assert.equal(vm.runInContext('feedCardSlots.has(__publicFeedSlot)',context),false,'Actual detachment still removes admission; cleanup is neither bypassed nor suppressed');clockAdmission(false);assert(removed.includes(slot));assert.equal(mounts,0);
  }finally{dom.window.close();}
}

function discoveryFixture(){
  const html=fs.readFileSync('index.html','utf8'),key=html.match(/selectorReleaseAcknowledgement: "([^"]+)"/)?.[1],taxonomy=require('../config/selector-taxonomy'),values=new Map(),sessionValues=new Map();let opened=0;
  assert(key,'Use the actual application storage key');
  const context={console,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v))},sessionStorage:{setItem:(k,v)=>sessionValues.set(k,String(v))},STORAGE_KEYS:{selectorReleaseAcknowledgement:key},SELECTOR_TAXONOMY:taxonomy,userPreferences:{onboardingComplete:true},
    selectorOptInViewportAnchor:null,pendingSelectorPromptIds:new Set(),captureViewportRenderAnchor:()=>({}),renderSelectorOptInPrompt:()=>opened++,restoreViewportAnchorAfterLayout(){},document:{getElementById:()=>({classList:{contains:()=>false,add(){}},setAttribute(){}}),body:{classList:{add(){}}}}};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function readStorage('),html.indexOf('\nfunction writeStorage(')),context);
  vm.runInContext(html.slice(html.indexOf('function openSelectorOptInPrompt(){'),html.indexOf('\ndocument.getElementById("skipSelectorOptInBtn")')),context);
  let seed=fixture.seedBrowserFixture.toString();
  if(process.argv.includes('--discovery-baseline')){
    const oldBoot=cp.execFileSync('git',['show','0284a0a2c6ddab50ab903522a226a75ae37857e5:scripts/validate-public-feed-browser.js'],{encoding:'utf8'}),start=oldBoot.indexOf('await page.addInitScript(')+'await page.addInitScript('.length,end=oldBoot.indexOf('}, {registered:model.registered',start)+1;
    assert(start>0&&end>start);seed=oldBoot.slice(start,end);
  }
  vm.runInContext('('+seed+')',context)({registered:false,token:'synthetic',owner:'synthetic',anonymous:false,selectorVersion:taxonomy.version});
  context.userPreferences=JSON.parse(values.get('ns_preferences_v1'));
  const before=JSON.stringify(context.userPreferences);
  assert.equal(vm.runInContext('openSelectorOptInPrompt()',context),false,'Existing Not now metadata must prevent the unrelated discovery modal, without changing the real predicate');
  assert.equal(opened,0);assert.equal(JSON.parse(values.get(key)),taxonomy.version);assert.equal(sessionValues.size,0,'This does not register a signed-out account');
  assert.equal(context.userPreferences.followedSports.length,0);assert.equal(context.userPreferences.selectedSelectorEntityIds.length,0);assert.equal(context.userPreferences.followFirst.notifications.enabled,false);
  values.delete(key);assert.equal(vm.runInContext('openSelectorOptInPrompt()',context),true,'Actual unacknowledged prompt still opens');assert.equal(opened,1);assert.equal(JSON.stringify(context.userPreferences),before,'Neither control manufactures a Follow or changes OFF choices');
}

async function main(){
  for(const method of ['POST', 'PUT', 'PATCH', 'DELETE']) if(!selected || selected === method){ await mutation(method); console.log('Native fixture write audit: ' + method + ' passed.'); }
  if(!selected && !baseline){ ownership(); console.log('Native fixture write ownership/target/permission controls passed.'); }
  if(!selected || selected === 'pagination'){ await pagination(); console.log('Native fixture scoped root/reply pages and bounded deltas passed.'); }
  if(!baseline && (!selected || selected === 'seen')){ await seenState(); console.log('Actual WeakMap owner: stable keys, detached values, real mutations and forwarding controls passed.'); }
  if(!baseline && (!selected || selected === 'discovery')){ discoveryFixture(); console.log('Actual discovery predicate: acknowledged test fixture stays clear, unacknowledged control opens, empty/OFF/account choices unchanged.'); }
  if(!baseline && (!selected || selected === 'admission')){ await admissionLifetime(); console.log('Actual Feed slot/admission/retention: cleanup race reproduced, connected unmounted fixture retained across Sydney midnight, expired/unknown/dismissed/detached controls denied.'); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
