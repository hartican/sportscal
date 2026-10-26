'use strict';
// Native, isolated UI qualification. Requires the delivered shared adapter + Public
// Feed integration; never substitutes an adapter, SDK, picker, fetch or clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const commentPolicy = require('../config/public-comments');
const {normalizedGiphyReference} = require('../lib/giphy-provider');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PUBLIC_FEED_OUTPUT || path.join(require('node:os').tmpdir(), 'ns-public-feed-native-' + process.pid));
const engines = (process.env.PUBLIC_FEED_ENGINES || 'chromium,webkit').split(',');
const widths = (process.env.PUBLIC_FEED_WIDTHS || '390,1280').split(',').map(Number);
const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const gifPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const fileHash = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8'}).trim();
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
const diskFree = () => { const stat = fs.statfsSync(root); return stat.bavail * stat.bsize; };
const engineFiles = ['scripts/validate-public-feed-browser.js', 'scripts/validate-public-feed-browser-fixtures.js', 'index.html', 'assets/js/app-shell-runtime.js', 'config/venue-panel-ui.js', 'config/feed-live-score-loader.js', 'config/match-centre.js', 'config/feed-live-scores.js', 'config/selector-taxonomy.js', 'config/public-comments-ui.js', 'assets/js/public-comments-ui.js', 'config/chat-media-ui.js', 'assets/js/notification-navigation.js'];
const navigationPath = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/assets\/js\/notification-navigation\.js\?v=\d+/)?.[0];
const selectorVersion = require('../config/selector-taxonomy').version;

function dependencyCheck(){
  assert.equal(process.version, 'v24.21.0', 'Use the allocated Node24.21.0 runtime');
  assert(navigationPath, 'Actual deferred notification route is required');
  const adapter = fs.readFileSync(path.join(root, 'config/venue-panel-ui.js'), 'utf8');
  assert(adapter.includes('options.onCardStateChange') && adapter.includes('options.cardState'),
    'DEPENDENCY_PENDING: production source must include the reviewed cardState/onCardStateChange adapter; no substitute renderer is permitted.');
  assert(engines.length && engines.every(name => ['chromium', 'webkit'].includes(name)), 'Use chromium and/or webkit');
  assert(widths.length && widths.every(width => Number.isInteger(width) && width >= 320 && width <= 1920), 'Invalid viewport widths');
}

function fixture(){
  const now = Date.now(), id = 'fixture:nrl:synthetic-public-feed-native';
  return {id, eventId:id, canonicalEventId:id, sourceEventIds:['fixture:nrl:synthetic-public-feed-alias'], kind:'fixture', key:'nrl', sport:'Rugby League', competitionName:'Synthetic UI qualification', name:'Synthetic Home v Synthetic Away',
    homeParticipantId:'team:nrl:synthetic-home', awayParticipantId:'team:nrl:synthetic-away', participantIds:['team:nrl:synthetic-home', 'team:nrl:synthetic-away'],
    participants:[{id:'team:nrl:synthetic-home', displayName:'Synthetic Home'}, {id:'team:nrl:synthetic-away', displayName:'Synthetic Away'}],
    date:new Intl.DateTimeFormat('en-CA', {timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit'}).format(now), startTimeUtc:new Date(now - 3600000).toISOString(), status:'live', homeScore:18, awayScore:12,
    statusCheckedAt:new Date(now).toISOString(), scoreCheckedAt:new Date(now).toISOString(), sourceStale:false};
}

function scenario(){
  const event = fixture();
  const rows = Array.from({length:18}, (_, index) => ({id:crypto.randomUUID(), handle:'@synthetic' + index, body:'Public comment ' + index + ' 😀 — ' + 'A readable public discussion. '.repeat(3), parentId:null,
    score:18 - index, myVote:0, own:false, createdAt:new Date(Date.now() - 60000 + index).toISOString(), revision:index + 1}));
  return {event, rows, revision:rows.length, points:25, owner, anonymous:false, registered:true, publicReads:0, commands:[], apiWrites:[], blocked:[], stubs:[], errors:[], console:[], configCalls:0, providerCalls:0, gates:[], configGate:null, providerGate:null, voteGate:null, denial:null,
    commentOwners:new Map(rows.map(row => [row.id, otherOwner])), privateMembers:new Set(), authIntent:null, expectedRejectedWrites:new Set(), reads:[], issuedCursors:new Map(), gateByRequest:new Map()};
}

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
function requestActor(request){
  try{ return JSON.parse(Buffer.from((request.headers().authorization || '').replace(/^Bearer /, '').split('.')[1], 'base64url')).sub || null; }catch{ return null; }
}
function recordWrite(request, model, url){
  const method = request.method().toUpperCase(); if(safeMethods.has(method)) return null;
  let body; try{ body = request.postDataJSON(); }catch{ body = null; }
  const actor = requestActor(request), action = body?.action, row = model.rows.find(row => row.id === body?.id);
  const keys = allowed => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).every(key => allowed.includes(key));
  const signedIn = model.registered && !model.anonymous && actor === model.owner;
  let allowed = false;
  if(method === 'POST' && url.origin === model.base){
    if(url.pathname === '/api/chat' && signedIn){
      if(action === 'public-comment-post'){
        let text, gif; try{ text = commentPolicy.text(body.body); if(body.gif) gif = normalizedGiphyReference(body.gif); }catch{}
        allowed = keys(['action', 'eventId', 'clientId', 'body', 'parentId', 'gif']) && body.eventId === model.event.id && commentPolicy.uuid(body.clientId) && text === body.body && !!(text || body.gif)
          && (!body.parentId || model.rows.some(row => row.id === body.parentId && !row.parentId && !row.removed))
          && (!body.gif || gif && model.points >= 25 && body.gif.provider === 'giphy' && /^https:\/\/media\.giphy\.com\/media\/synthetic\//.test(gif.contentUrl));
      }
      if(action === 'public-comment-vote') allowed = keys(['action', 'eventId', 'id', 'value']) && body.eventId === model.event.id && !!row && !row.removed && [-1, 0, 1].includes(body.value);
      if(action === 'public-comment-delete') allowed = keys(['action', 'eventId', 'id']) && body.eventId === model.event.id && !!row && model.commentOwners.get(row.id) === actor;
      if(action === 'gif-reference') allowed = keys(['action', 'roomId', 'gif']) && body.roomId === 'synthetic-private' && model.privateMembers.has(actor) && model.points >= 25 && /^https:\/\/media\.giphy\.com\/media\/synthetic\//.test(body.gif?.contentUrl || '');
      if(['mark-read', 'mark-delivered'].includes(action)) allowed = keys(['action', 'roomId', 'readAt']) && body.roomId === 'synthetic-private' && model.privateMembers.has(actor);
    }
    if(url.pathname === '/api/auth' && action === 'password-sign-in') allowed = !!model.authIntent && keys(['action', 'email', 'password']) && body.email === model.authIntent.email && body.password === 'synthetic';
  }
  const record = {index:model.apiWrites.length, method, origin:url.origin, path:url.pathname, action, actor, currentOwner:model.owner, eventId:body?.eventId, roomId:body?.roomId, target:body?.id, allowed};
  model.apiWrites.push(record);
  if(allowed && url.pathname === '/api/auth') model.authIntent = null;
  return record;
}
function assertAllowedWrites(model, start = 0){
  assert.deepEqual(model.apiWrites.slice(start).filter(record => !record.allowed && !model.expectedRejectedWrites.has(record.index)), [], 'Every mutating method must match the explicit action, fixture/room and current account owner');
}

function commentPage(model, url, actor){
  const fixtureId = url.searchParams.get('roomId'), parent = url.searchParams.get('q') || null, cursor = url.searchParams.get('before') || null;
  const hasAfter = url.searchParams.has('after'), rawAfter = url.searchParams.get('after'), after = hasAfter ? Number(rawAfter) : null;
  const record = {fixtureId, parent, cursor, after, owner:actor, revision:model.revision, status:200}; model.reads.push(record);
  const reject = (status, code) => { record.status = status; return {status, json:{code, error:code}}; };
  if(!model.registered || model.anonymous || actor !== model.owner) return reject(401, 'account_required');
  if(fixtureId !== model.event.id) return reject(404, 'fixture_not_found');
  if(hasAfter && (!/^\d{1,15}$/.test(rawAfter) || !Number.isSafeInteger(after))) return reject(400, 'invalid_public_comment_request');
  if(hasAfter && (after > model.revision || cursor || parent)) return reject(409, 'public_comment_cursor_changed');
  if(parent && !model.rows.some(row => row.id === parent && !row.parentId && !row.removed)) return reject(400, 'public_comment_invalid_parent');
  let boundary;
  if(cursor){
    if(cursor.length > 1024) return reject(400, 'invalid_public_comment_request');
    try{ boundary = JSON.parse(Buffer.from(cursor, 'base64url').toString()); }catch{ return reject(400, 'invalid_public_comment_request'); }
    const issued = model.issuedCursors.get(cursor);
    if(!issued || issued.owner !== actor || issued.fixtureId !== fixtureId || issued.parent !== parent) return reject(400, 'invalid_public_comment_request');
    if(boundary.revision !== model.revision) return reject(409, 'public_comment_cursor_changed');
  }
  const expose = row => ({...row, own:model.commentOwners.get(row.id) === actor, ...(!row.removed ? {replyCount:model.rows.filter(reply => reply.parentId === row.id && !reply.removed).length} : {})});
  if(hasAfter){
    const all = model.rows.filter(row => row.revision > after).sort((a, b) => a.revision - b.revision), page = all.slice(0, commentPolicy.LIMITS.changes);
    const hasMore = all.length > page.length, revision = hasMore ? page.at(-1).revision : model.revision;
    const parents = model.rows.filter(row => page.some(reply => reply.parentId === row.id) && !page.some(entry => entry.id === row.id));
    Object.assign(record, {count:page.length, hasMore, nextRevision:revision});
    return {json:{comments:[...page, ...parents].map(expose), revision, hasMore, nextCursor:null}};
  }
  const all = model.rows.filter(row => !row.removed && (row.parentId || null) === parent).sort(commentPolicy.compare);
  const start = boundary ? all.findIndex(row => row.id === boundary.id && row.score === boundary.score && row.createdAt === boundary.at) + 1 : 0;
  if(boundary && start === 0) return reject(409, 'public_comment_cursor_changed');
  const page = all.slice(start, start + commentPolicy.LIMITS.page), more = start + page.length < all.length;
  let nextCursor = null;
  if(more){
    const last = page.at(-1); nextCursor = Buffer.from(JSON.stringify({score:last.score, at:last.createdAt, id:last.id, revision:model.revision})).toString('base64url');
    model.issuedCursors.set(nextCursor, {owner:actor, fixtureId, parent});
  }
  const preview = parent ? [] : page.flatMap(row => model.rows.filter(reply => reply.parentId === row.id && !reply.removed).sort(commentPolicy.compare).slice(0, commentPolicy.LIMITS.replyPreview));
  Object.assign(record, {count:page.length, previews:preview.length, nextCursor});
  return {json:{comments:[...page, ...preview].map(expose), revision:model.revision, nextCursor}};
}

function paginatedFixture(model){
  const add = (body, parentId = null) => {
    const row = {id:crypto.randomUUID(), handle:'@paged', body, parentId, score:parentId ? 500 - model.rows.length : -model.rows.length, myVote:0, own:false, createdAt:new Date(Date.now() + model.rows.length).toISOString(), revision:++model.revision};
    model.rows.push(row); model.commentOwners.set(row.id, otherOwner); return row;
  };
  while(model.rows.filter(row => !row.parentId).length < 52) add('Paged root ' + model.rows.length);
  for(let index = 0; index < 57; index++) add('Paged reply ' + index, model.rows[0].id);
  for(let index = 0; index < 4; index++) add('Other parent reply ' + index, model.rows[1].id);
  return add;
}

function hold(model, key){
  assert(!model[key], 'Only one held transport at this boundary');
  const pending = deferred(), gate = {promise:pending.promise, entered:deferred(), terminal:deferred(), routeDone:deferred(), appMarks:[], released:false};
  gate.resolve = value => { gate.released = true; pending.resolve(value); };
  model[key] = gate; model.gates.push(gate); return gate;
}
async function bounded(page, promise, label){
  let timer, closed;
  try{
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(label + ' did not complete within 15 seconds')), 15000);
      closed = () => reject(Error('Page closed before ' + label)); page.once('close', closed);
    })]);
  }finally{ clearTimeout(timer); page.off('close', closed); }
}
async function reached(page, gate){ await bounded(page, gate.entered.promise, 'held transport entry'); }
async function observeOwner(element, name, count = 1){
  const token = crypto.randomUUID();
  await element.evaluate((element, {token, name}) => {
    globalThis.__publicFeedSettlements ||= {};
    const mark = __publicFeedSettlements[token] = {count:0, payload:false};
    element.addEventListener(name, event => { mark.count++; mark.payload ||= event.detail !== undefined; });
  }, {token, name});
  return {token, count, event:name};
}
async function settled(page, gate){
  assert(gate.released && gate.appMarks.length, 'Held response needs explicit release and actual async-owner observation');
  const terminal = await bounded(page, gate.terminal.promise, 'transport delivery/cancellation');
  assert(['delivered', 'cancelled'].includes(terminal.state));
  await bounded(page, gate.routeDone.promise, 'held route completion');
  await page.waitForFunction(marks => marks.every(({token, count}) => globalThis.__publicFeedSettlements?.[token]?.count >= count && !__publicFeedSettlements[token].payload), gate.appMarks);
  const owners = await page.evaluate(marks => marks.map(({token, count, event}) => ({event, expected:count, observed:__publicFeedSettlements[token].count, valueFree:!__publicFeedSettlements[token].payload})), gate.appMarks);
  gate.observed = {transport:terminal, actualOwnerSettlements:owners};
}
async function passGate(model, key, route){
  const gate = model[key]; if(!gate) return null;
  model[key] = null; gate.request = route.request(); model.gateByRequest.set(gate.request, gate); gate.entered.resolve(); return (await gate.promise) || {};
}

function session(model){
  const accessToken = 'e30.' + Buffer.from(JSON.stringify({sub:model.owner})).toString('base64url') + '.synthetic';
  return {access_token:accessToken, refresh_token:'synthetic-only', expires_in:3600, user:{id:model.owner, isAnonymous:model.anonymous}};
}
function gifConfig(model){
  return {provider:'giphy', capabilities:{canUseGifs:model.points >= 25, lifetimeNscPoints:model.points, gifMinimumPoints:25},
    clientConfig:{apiKey:'synthetic-no-provider-credential', searchEndpoint:'https://api.giphy.com/v1/gifs/search', trendingEndpoint:'https://api.giphy.com/v1/gifs/trending'}};
}
async function api(route, model, url){
  const request = route.request(), write = recordWrite(request, model, url);
  if(write && !write.allowed) return route.fulfill({status:405, json:{error:'Forbidden qualification write', code:'qa_forbidden_write'}});
  const command = request.method() === 'POST' ? request.postDataJSON() : null;
  if(url.pathname === '/api/auth'){
    const current = session(model);
    return route.fulfill({json:{configured:true, user:model.registered ? current.user : null, ...(command ? {session:current} : {})}});
  }
  if(url.pathname === '/api/nothingscore') return route.fulfill({json:{points:model.points, settlements:[], entries:[], privileges:[]}});
  if(url.pathname === '/api/chat'){
    if(url.searchParams.get('mode') === 'gif-config'){
      model.configCalls++; await passGate(model, 'configGate', route); return route.fulfill({json:gifConfig(model)});
    }
    if(command?.action === 'gif-reference'){
      model.commands.push(command);
      return route.fulfill({json:{attachment:{attachmentId:crypto.randomUUID(), kind:'gif', contentType:'image/gif', url:command.gif.contentUrl, status:'ready'}}});
    }
    if(url.searchParams.get('mode') === 'public-comments' || command?.action?.startsWith('public-comment-')){
      if(!command) model.publicReads++;
      if(model.denial) return route.fulfill({status:model.denial.status, json:{error:model.denial.message, code:model.denial.code}});
      if(command){
        model.commands.push(command);
        if(command.action === 'public-comment-vote'){
          await passGate(model, 'voteGate', route);
          const row = model.rows.find(row => row.id === command.id); assert(row);
          row.score += command.value - row.myVote; row.myVote = command.value; row.revision = ++model.revision;
          return route.fulfill({json:{comment:row}});
        }
        if(command.action === 'public-comment-post'){
          const row = {id:crypto.randomUUID(), handle:'@synthetic-reader', own:true, body:command.body || '', gif:command.gif ? normalizedGiphyReference(command.gif) : null, parentId:command.parentId || null, score:0, myVote:0, createdAt:new Date().toISOString(), revision:++model.revision};
          model.rows.push(row); model.commentOwners.set(row.id, requestActor(request)); return route.fulfill({json:{comment:row}});
        }
        if(command.action === 'public-comment-delete'){
          const row = model.rows.find(row => row.id === command.id); assert(row); Object.assign(row, {deleted:true, body:'', gif:null, revision:++model.revision});
          return route.fulfill({json:{comment:row}});
        }
        throw Error('Unexpected public command: ' + command.action);
      }
      return route.fulfill(commentPage(model, url, requestActor(request)));
    }
    if(url.searchParams.get('roomId') === 'synthetic-private') model.privateMembers.add(requestActor(request));
    return route.fulfill({json:{room:{roomId:'synthetic-private', roomName:'Synthetic private room', fixture:model.event, status:'open', members:[], viewer:{canPost:true, member:true}}, messages:[], rooms:[], profile:{displayName:'Synthetic reader', publicProfile:true}, capabilities:gifConfig(model).capabilities}});
  }
  // An unexpected write fails the eventual personal-state assertion even if
  // the application handles this isolated service-unavailable response.
  return route.fulfill({status:503, json:{error:'Synthetic qualification: service unavailable'}});
}

async function isolate(page, model, base){
  model.base = base;
  page.on('requestfinished', request => { const gate = model.gateByRequest.get(request); if(gate){ gate.state = 'delivered'; gate.terminal.resolve({state:'delivered'}); } });
  page.on('requestfailed', request => { const gate = model.gateByRequest.get(request); if(gate){ gate.state = 'cancelled'; gate.terminal.resolve({state:'cancelled', error:request.failure()?.errorText}); } });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    try{
      if(url.origin === base){
        if(url.pathname.startsWith('/api/')) return await api(route, model, url);
        const write = recordWrite(route.request(), model, url);
        if(write) return await route.fulfill({status:405, json:{code:'qa_forbidden_write'}});
        return await route.continue();
      }
      if(!safeMethods.has(route.request().method().toUpperCase())) recordWrite(route.request(), model, url);
      if(url.origin === 'https://api.giphy.com' && ['/v1/gifs/search', '/v1/gifs/trending'].includes(url.pathname)){
        model.providerCalls++; model.stubs.push(url.origin + url.pathname);
        const response = await passGate(model, 'providerGate', route) || {};
        if(response.error) return await route.fulfill({status:503, headers:{'Access-Control-Allow-Origin':'*'}, json:{error:'Synthetic provider error'}});
        const offset = Number(url.searchParams.get('offset') || 0), title = response.title || (offset ? 'Second synthetic GIF' : 'Current synthetic GIF');
        return await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'}, json:{data:[{id:'synthetic-' + offset, title, images:{original:{url:'https://media.giphy.com/media/synthetic/giphy.gif', width:'120', height:'120'}, fixed_width:{url:'https://media.giphy.com/media/synthetic/200w.gif', width:'120', height:'120'}}}], pagination:{count:1, total_count:2, offset}}});
      }
      if(url.origin === 'https://media.giphy.com' && /^\/media\/synthetic\/(?:giphy|200w)\.gif$/.test(url.pathname)){
        model.stubs.push(url.origin + url.pathname); return await route.fulfill({contentType:'image/gif', body:gifPixel});
      }
      model.blocked.push(url.origin + url.pathname); return await route.abort('blockedbyclient');
    }catch(error){
      // Aborted/closed requests are expected when the actual picker disposes
      // its AbortController. Never replace fetch or ignore another route error.
      if(page.isClosed() || model.gateByRequest.get(route.request())?.state === 'cancelled' || route.request().failure()) return;
      throw error;
    }finally{
      model.gateByRequest.get(route.request())?.routeDone.resolve();
    }
  });
}

function seedBrowserFixture({registered, token, owner, anonymous, selectorVersion}){
  localStorage.setItem('ns_preferences_v1', JSON.stringify({version:27, onboardingComplete:true, showSpoilers:true, followedSports:[], selectedSelectorEntityIds:[], feedControls:{spoilers:'results_visible'}, fantasyDeadlines:{enabled:false}, followFirst:{notifications:{enabled:false, autoRemindersEnabled:false}, refinement:{promptedAt:'2026-10-24'}}}));
  // Existing "Not now" acknowledgement, not a discovery selection or Follow.
  localStorage.setItem('ns_selector_release_ack_v1', JSON.stringify(selectorVersion));
  if(registered) sessionStorage.setItem('ns_auth_session_v1', JSON.stringify({accessToken:token, refreshToken:'synthetic-only', expiresAt:Date.now() + 3600000}));
  globalThis.__publicFeedFixtureAccount = {owner, anonymous};
}
async function boot(browser, base, model, width, query = ''){
  const context = await browser.newContext({viewport:{width, height:844}, hasTouch:true, serviceWorkers:'block'});
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => model.errors.push(error.message));
  page.on('console', message => {
    if(['error', 'warning'].includes(message.type())) model.console.push({type:message.type(), text:message.text()});
    if(message.text().startsWith('Fixture card fallback')) model.errors.push(message.text());
  });
  try{
  await context.tracing.start({screenshots:true, snapshots:true, sources:true});
  await isolate(page, model, base);
  await page.addInitScript(seedBrowserFixture, {registered:model.registered, token:session(model).access_token, owner:model.owner, anonymous:model.anonymous, selectorVersion});
  await page.goto(base + '/' + query, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => typeof buildEventCard === 'function' && typeof buildDetailedEventCard === 'function' && startupFunnelFinished && !startupCoordinator.isHydrating());
  await page.locator('#startupLaunch').waitFor({state:'hidden'});
  await page.evaluate(async ({event, registered, owner, anonymous, cold, navigationPath}) => {
    setTunePromptOpen(false); suppressSessionRatingPrompt(); closeSettings({restoreTheme:false});
    // Disposable account, sporting input and Feed admission are fixtures, not
    // replacements of authentication, rendering, card state or network code.
    serverPersistence.user = registered ? {id:owner, isAnonymous:anonymous} : null;
    activeTab = 'feed'; activeEvents = [event]; liveFixtureEvents = [];
    feedCardSlots.clear(); initialFeedCardIds.clear();
    globalThis.__publicFeedSlot = buildFeedCardSlot(event); // detached; never observed/mounted
    globalThis.__publicFeedHost = document.createElement('div');
    __publicFeedHost.id = 'public-feed-native-host'; document.body.append(__publicFeedHost);
    if(cold){ userPreferences.showSpoilers = false; userPreferences.feedControls.spoilers = 'strict'; }
  }, {event:model.event, registered:model.registered, owner:model.owner, anonymous:model.anonymous, cold:!!query});
  await page.evaluate(installPersonalStateObserver);
  await page.evaluate(async ({cold, navigationPath}) => {
    if(cold) await loadDeferredScript(navigationPath);
    else await loadDeferredScript('assets/js/public-comments-ui.js?v=1');
  }, {cold:!!query, navigationPath});
  return {page, context};
  }catch(error){
    const label=browser.browserType().name()+'-'+width+'-boot-failure';
    await page.screenshot({path:path.join(output,label+'.png')}).catch(()=>{});
    await context.tracing.stop({path:path.join(output,label+'.zip')}).catch(()=>{});
    await context.close(); throw error;
  }
}

function installPersonalStateObserver(){
  globalThis.__publicFeedWrites = [];
  for(const name of ['setCardState', 'updateEventAction', 'recordEventFeedAction', 'observeNewSurfaceItem']){
    const original = globalThis[name]; if(typeof original !== 'function') throw Error('Missing actual state owner: ' + name);
    globalThis[name] = function(...args){ __publicFeedWrites.push(name); return original.apply(this, args); };
  }
  if(Object.prototype.toString.call(surfaceSeenEvents) !== '[object WeakMap]') throw Error('Expected the actual surface-seen WeakMap owner');
  // WeakMaps cannot be enumerated. Retain real key identities, including
  // detached slots, and forward every mutation on the original owner.
  const seenKeys = new Set([...document.querySelectorAll('*'), ...[...feedCardSlots.values()].map(item => item.slot)]);
  for(const name of ['set', 'delete']){
    const original = surfaceSeenEvents[name];
    surfaceSeenEvents[name] = function(...args){ __publicFeedWrites.push('surfaceSeenEvents.' + name); seenKeys.add(args[0]); return original.apply(this, args); };
  }
  globalThis.__publicFeedSnapshot = () => ({preferences:JSON.stringify(userPreferences), actions:JSON.stringify(eventActions), cards:JSON.stringify(cardViewStates), spoilers:JSON.stringify(eventSpoilerState),
    opened:JSON.stringify([...sessionOpenedEventIds]), seen:JSON.stringify([...seenKeys].map((element, index) => [index, surfaceSeenEvents.has(element), surfaceSeenEvents.get(element)])),
    mounted:[...feedCardSlots.values()].map(item => [item.event.id, item.mounted]), activeTab});
  globalThis.__publicFeedInitialPersonal = __publicFeedSnapshot();
}
async function state(page){
  return page.evaluate(() => __publicFeedSnapshot());
}
async function untouched(page, before, model, writeStart){
  assert.deepEqual(await state(page), before, 'Discussion must preserve personal Feed, card, seen, Results and follow choices');
  assert.deepEqual(await page.evaluate(() => __publicFeedWrites), [], 'Discussion must not call personal card/engagement/seen owners');
  assertAllowedWrites(model, writeStart);
}
async function fullFixtureLayout(tray){
  const layout = await tray.evaluate(tray => {
    const card = tray.closest('.event-card'), main = card?.querySelector('.event-main'), box = tray.getBoundingClientRect(), cardBox = card?.getBoundingClientRect();
    const siblings = card ? [...card.children].filter(node => node !== tray && !['absolute', 'fixed'].includes(getComputedStyle(node).position)) : [];
    return {fullCard:card?.dataset.cardState === 'opened' && !card.classList.contains('is-fixture-fallback') && !!main,
      belowDetails:siblings.every(node => node.getBoundingClientRect().bottom <= box.top + 1),
      fullWidth:!!cardBox && box.width >= cardBox.width - 40,
      insideCard:!!cardBox && box.left >= cardBox.left && box.right <= cardBox.right + 1,
      contentFits:tray.scrollWidth <= tray.clientWidth + 1};
  });
  assert.deepEqual(layout, {fullCard:true, belowDetails:true, fullWidth:true, insideCard:true, contentFits:true}, 'Comments must remain readable below the actual full fixture, including inside clipped cards');
}
async function open(page, event){
  await page.evaluate(id => NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(id), event.id);
  await page.locator('dialog.public-comments-destination[open] .public-comment').first().waitFor({state:'attached'});
  await page.locator('dialog.public-comments-destination h3').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('dialog.public-comments-destination .event-card').getAttribute('data-card-state'), 'opened', 'Actual shared adapter must consume local opened state');
  await fullFixtureLayout(page.locator('dialog.public-comments-destination .public-comments'));
}
async function inline(page, event){
  await page.evaluate(event => {
    const draw = next => __publicFeedHost.replaceChildren(buildEventCard(event, {mode:'schedule', cardState:next, onCardStateChange:draw}));
    draw('opened');
  }, event);
  await page.locator('#public-feed-native-host .fixture-public-comments').click();
  await page.locator('#public-feed-native-host .public-comment').first().waitFor({state:'attached'});
  await fullFixtureLayout(page.locator('#public-feed-native-host .public-comments'));
}
async function pointer(locator, touch){
  await locator.scrollIntoViewIfNeeded();
  const observed=await locator.evaluate(element => { const r=element.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),describe=node=>node?{tag:node.tagName,id:node.id,className:String(node.className)}:null;return{reachable:!!hit&&(element===hit||element.contains(hit)),target:describe(element),rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:describe(hit),modals:[...document.querySelectorAll('dialog[open],.modal-backdrop.show')].map(describe)}; });
  assert(observed.reachable, 'Native hit target must reach the control: '+JSON.stringify(observed));
  if(touch) await locator.tap(); else await locator.click();
}
async function privateRoom(page){
  await page.evaluate(async () => { setChatDrawerOpen(true); await openChatRoom('synthetic-private'); });
  await page.locator('#chatRoomComposer [data-chat-gif-trigger]').waitFor({state:'visible'});
}
const picker = page => page.locator('#chatGifPicker.show');
async function privateGif(page, touch){ await privateRoom(page); await pointer(page.locator('#chatRoomComposer [data-chat-gif-trigger]'), touch); await picker(page).locator('.chat-gif-result').first().waitFor({state:'visible'}); }
async function publicGif(page, touch){ await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await picker(page).locator('.chat-gif-result').first().waitFor({state:'visible'}); }

const cases = [
  ['forbidden methods, chat actions and wrong owners cannot escape the write audit', async ({page, model}) => {
    const token = session(model).access_token;
    for(const [method, command, auth] of [
      ...['PUT', 'PATCH', 'DELETE'].map(method => [method, {action:'public-comment-vote', eventId:model.event.id, id:model.rows[0].id, value:1}, token]),
      ['POST', {action:'update-preferences', followedSports:['nrl']}, token],
      ['POST', {action:'public-comment-vote', eventId:model.event.id, id:model.rows[0].id, value:1}, 'e30.' + Buffer.from(JSON.stringify({sub:otherOwner})).toString('base64url') + '.synthetic'],
      ['POST', {action:'public-comment-delete', eventId:model.event.id, id:model.rows[0].id}, token],
    ]){
      const start = model.apiWrites.length;
      const status = await page.evaluate(async ({method, command, auth}) => (await fetch('/api/chat', {method, headers:{'Content-Type':'application/json', Authorization:'Bearer ' + auth}, body:JSON.stringify(command)})).status, {method, command, auth});
      assert.equal(status, 405); assert.equal(model.apiWrites.length, start + 1); assert.equal(model.apiWrites[start].method, method); assert.equal(model.apiWrites[start].allowed, false);
      assert.throws(() => assertAllowedWrites(model, start), /Every mutating method/);
      model.expectedRejectedWrites.add(start); // exact deliberate negative only
    }
  }],
  ['actual root/reply continuation controls, scoped cursors and bounded changes', async ({page, model, touch}) => {
    const add = paginatedFixture(model), before = await state(page), start = model.apiWrites.length;
    await open(page, model.event);
    const dialog = page.locator('dialog.public-comments-destination'), more = dialog.getByRole('button', {name:'Load more comments', exact:true});
    assert.equal(model.reads.find(read => read.after === null && !read.parent).count, 25);
    for(const count of [50, 52]){
      await pointer(more, touch);
      await page.waitForFunction(count => [...document.querySelectorAll('dialog.public-comments-destination .public-comment')].filter(row => row.parentElement.closest('.public-comment') === null).length === count, count);
    }
    assert.equal(await more.isVisible(), false);
    const parent = dialog.locator('[data-comment="' + model.rows[0].id + '"]'), replies = parent.locator('.public-comment-replies').first(), next = parent.getByRole('button', {name:'View more replies', exact:true});
    assert.equal(await replies.locator('.public-comment').count(), 3, 'Actual initial reply preview remains bounded');
    for(const count of [25, 50, 57]){ await pointer(next, touch); await page.waitForFunction(({id, count}) => document.querySelector('[data-comment="' + id + '"] .public-comment-replies').children.length === count, {id:model.rows[0].id, count}); }
    assert.equal(await next.isVisible(), false);
    const roots = model.reads.filter(read => read.after === null && !read.parent && read.status === 200), replyPages = model.reads.filter(read => read.parent === model.rows[0].id && read.status === 200);
    assert.deepEqual(roots.map(read => read.count), [25, 25, 2]); assert.deepEqual(replyPages.map(read => read.count), [25, 25, 7]);
    assert(roots.slice(1).every((read, index) => read.cursor === roots[index].nextCursor)); assert(replyPages.slice(1).every((read, index) => read.cursor === replyPages[index].nextCursor));
    for(const [query, expected] of [
      [{before:roots[0].nextCursor, q:model.rows[0].id}, 400], [{before:replyPages[0].nextCursor, q:model.rows[1].id}, 400],
      [{before:'x'.repeat(1025)}, 400], [{after:'-1'}, 400], [{after:String(model.revision + 1)}, 409],
    ]){
      const response = await page.evaluate(async query => { try{ await serverSyncClient.chatRequest(query); return 200; }catch(error){ return error.status; } }, {mode:'public-comments', roomId:model.event.id, ...query});
      assert.equal(response, expected);
    }
    const baseline = model.revision, inserted = [];
    for(let index = 0; index < 101; index++) inserted.push(add('Bounded live delta ' + index));
    await dialog.getByText(inserted.at(-1).body, {exact:true}).waitFor({state:'attached'});
    const deltas = model.reads.filter(read => read.after >= baseline && read.status === 200 && read.count);
    assert(deltas.some(read => read.count === 100 && read.hasMore)); assert(deltas.every(read => read.count <= 100));
    const first = deltas.find(read => read.hasMore); assert(deltas.some(read => read.after === first.nextRevision), 'Actual mounted tray drains from the last processed bounded delta');
    const stale = await page.evaluate(async query => { try{ await serverSyncClient.chatRequest(query); return 200; }catch(error){ return error.status; } }, {mode:'public-comments', roomId:model.event.id, before:roots[0].nextCursor});
    assert.equal(stale, 409); await untouched(page, before, model, start);
  }],
  ['inline replies, text, emoji and vote changes', async ({page, model, touch}) => {
    const before = await state(page), start = model.apiWrites.length;
    await inline(page, model.event);
    const tray = page.locator('#public-feed-native-host .public-comments'), first = tray.locator('[data-comment="' + model.rows[0].id + '"]');
    assert.equal(await tray.locator('input[type=file]').count(), 0);
    assert(await page.locator('#public-feed-native-host .feed-live-score').count() > 0, 'Results ON control must contain the actual rendered live score');
    for(const [name, value] of [['Upvote comment', 1], ['Downvote comment', -1], ['Downvote comment', 0]]){
      await pointer(first.getByRole('button', {name, exact:true}), touch);
      await page.waitForFunction(({id, value}) => {
        const row = document.querySelector('[data-comment="' + id + '"]'), up = row?.querySelector('[aria-label="Upvote comment"]'), down = row?.querySelector('[aria-label="Downvote comment"]');
        return up && !up.disabled && up.getAttribute('aria-pressed') === String(value === 1) && down.getAttribute('aria-pressed') === String(value === -1);
      }, {id:model.rows[0].id, value});
      assert.equal(model.commands.filter(command => command.action === 'public-comment-vote').at(-1).value, value);
      await first.getByRole('button', {name:'Upvote comment', exact:true}).waitFor({state:'visible'});
    }
    await pointer(first.getByRole('button', {name:'Reply', exact:true}), touch);
    const text = tray.getByRole('textbox', {name:'Write a public comment'});
    await text.fill('Reply 😀 <script>synthetic text only</script>');
    await pointer(tray.getByRole('button', {name:'Post comment', exact:true}), touch);
    await tray.getByText('Reply 😀 <script>synthetic text only</script>', {exact:true}).waitFor();
    assert.equal(model.commands.filter(command => command.action === 'public-comment-post').at(-1).parentId, model.rows[0].id);
    const reply = tray.locator('[data-comment="' + model.rows.at(-1).id + '"]');
    await pointer(reply.getByRole('button', {name:'Reply', exact:true}), touch);
    await text.fill('Reply to a reply 😀'); await pointer(tray.getByRole('button', {name:'Post comment', exact:true}), touch);
    await tray.getByText('Reply to a reply 😀', {exact:true}).waitFor();
    assert.equal(model.commands.filter(command => command.action === 'public-comment-post').at(-1).parentId, model.rows[0].id);
    assert.equal(await tray.locator('.public-comment-replies .public-comment-replies .public-comment').count(), 0, 'Replying to a reply stays at one level');
    assert.equal(await tray.locator('script').count(), 0);
    assert(!(await tray.innerText()).includes(owner), 'Public authors are shown by handles, without internal account IDs');
    await untouched(page, before, model, start);
  }],
  ['private/public/private native picker ownership, paging and focus', async ({page, model, touch}) => {
    await privateGif(page, touch);
    assert.equal(await picker(page).evaluate(element => element.parentElement === document.body), true);
    await pointer(picker(page).locator('.chat-gif-result').first(), touch);
    await page.waitForFunction(() => chatState.pendingAttachments.some(item => item.status === 'ready'));
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-chat-gif-trigger')), true);
    await page.evaluate(() => setChatDrawerOpen(false));
    const before = await state(page), start = model.apiWrites.length, privateCount = model.commands.filter(command => command.action === 'gif-reference').length;
    await open(page, model.event); await publicGif(page, touch);
    assert.equal(await picker(page).evaluate(element => element.closest('dialog')?.open), true, 'Picker must live inside the actual topmost native dialog');
    assert.equal(await page.locator('#chatGifPicker').count(), 1);
    assert.equal(await picker(page).getByRole('link', {name:'Powered by GIPHY'}).count(), 1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chatGifSearchInput');
    await page.keyboard.type('clutch'); await page.keyboard.press('Enter');
    await picker(page).locator('.chat-gif-result').first().waitFor({state:'visible'});
    await pointer(picker(page).getByRole('button', {name:'Load more', exact:true}), touch);
    await page.waitForFunction(() => document.querySelectorAll('#chatGifResults .chat-gif-result').length === 2);
    await pointer(picker(page).locator('.chat-gif-result').first(), touch);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Write a public comment');
    assert.equal(model.commands.filter(command => command.action === 'gif-reference').length, privateCount, 'Public selection cannot use private attachments');
    await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'Post comment', exact:true}), touch);
    await page.waitForFunction(() => document.querySelector('.public-comment img'));
    assert(model.commands.some(command => command.action === 'public-comment-post' && command.gif?.provider === 'giphy'));
    await page.keyboard.press('Escape'); await page.locator('dialog.public-comments-destination').waitFor({state:'detached'});
    await untouched(page, before, model, start);
    await privateGif(page, touch); await pointer(picker(page).locator('.chat-gif-result').first(), touch);
    await page.waitForFunction(() => chatState.pendingAttachments.filter(item => item.status === 'ready').length >= 1);
    assert.equal(model.commands.filter(command => command.action === 'gif-reference').length, privateCount + 1);
  }],
  ['24 lifetime points prevent public and private provider contact', async ({page, model, touch}) => {
    model.points = 24; await open(page, model.event);
    const calls = model.providerCalls;
    await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch);
    await page.locator('.public-comments-status').filter({hasText:/25 NSC points/}).waitFor();
    assert.equal(model.providerCalls, calls); assert.equal(await picker(page).count(), 0);
    await page.keyboard.press('Escape'); await privateRoom(page);
    await pointer(page.locator('#chatRoomComposer [data-chat-gif-trigger]'), touch);
    assert.equal(model.providerCalls, calls); assert.equal(await picker(page).count(), 0);
  }],
  ['real shared adapter collapses and reopens an alias destination without saving card state', async ({page, model, touch}) => {
    const before = await state(page), start = model.apiWrites.length;
    await open(page, {...model.event, id:model.event.sourceEventIds[0]});
    const dialog = page.locator('dialog.public-comments-destination');
    await pointer(dialog.locator('.fixture-more'), touch);
    await page.waitForFunction(() => document.querySelector('dialog.public-comments-destination .event-card')?.dataset.cardState === 'selected');
    assert.equal(await dialog.locator('.public-comments').count(), 0);
    await pointer(dialog.locator('.fixture-more'), touch);
    await page.waitForFunction(() => document.querySelector('dialog.public-comments-destination .event-card')?.dataset.cardState === 'opened');
    await dialog.locator('.public-comment').first().waitFor({state:'attached'});
    await untouched(page, before, model, start);
  }],
  ['one native scroll owner, Results OFF, live reorder and focus', async ({page, model}) => {
    await page.evaluate(() => { userPreferences.showSpoilers = false; userPreferences.feedControls.spoilers = 'strict'; });
    const before = await state(page), start = model.apiWrites.length;
    await open(page, model.event);
    const dialog = page.locator('dialog.public-comments-destination');
    assert.equal(await dialog.locator('.feed-live-score').count(), 0);
    const layout = await dialog.locator('.public-comments').evaluate(tray => {
      const dialog = tray.closest('dialog'), card = tray.closest('.event-card'), ancestors = [];
      for(let node = tray; node && node !== dialog; node = node.parentElement) ancestors.push(getComputedStyle(node).overflowY);
      return {insideFullCard:!!card && card.dataset.cardState === 'opened', independentlyScrolling:ancestors.some(value => /^(auto|scroll)$/.test(value)), overflow:dialog.scrollHeight > dialog.clientHeight};
    });
    assert.deepEqual(layout, {insideFullCard:true, independentlyScrolling:false, overflow:true});
    const position = () => dialog.evaluate(dialog => ({scroll:dialog.scrollTop, card:dialog.querySelector('.event-card').getBoundingClientRect().top, comments:dialog.querySelector('.public-comments').getBoundingClientRect().top, window:scrollY}));
    const a = await position(); const bounds = await dialog.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.wheel(0, 350);
    await page.waitForFunction(old => document.querySelector('dialog.public-comments-destination').scrollTop > old, a.scroll);
    const b = await position(); assert.equal(b.window, a.window); assert(Math.abs((b.card - a.card) - (b.comments - a.comments)) < 2);
    const row = dialog.locator('[data-comment="' + model.rows[6].id + '"]'); await row.scrollIntoViewIfNeeded();
    const up = row.getByRole('button', {name:'Upvote comment', exact:true}); await up.focus();
    const y = (await row.boundingBox()).y;
    const added = {...model.rows[0], id:crypto.randomUUID(), body:'Live inserted top comment', score:999, revision:++model.revision}; model.rows.push(added);
    await dialog.getByText(added.body, {exact:true}).waitFor({state:'attached'});
    assert(Math.abs((await row.boundingBox()).y - y) <= 3, 'Actual dialog scroll anchor must survive a live higher-ranked insert');
    assert.equal(await up.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.querySelector('[data-comment="' + id + '"] [aria-label="Upvote comment"]').getAttribute('aria-pressed') === 'true', model.rows[6].id);
    assert.equal(await up.evaluate(element => element === document.activeElement), true);
    const removed = model.rows[2].id; model.rows = model.rows.filter(row => row.id !== removed);
    model.rows.push({id:removed, removed:true, revision:++model.revision});
    await dialog.locator('[data-comment="' + removed + '"]').waitFor({state:'detached'});
    assert.equal(await up.evaluate(element => element === document.activeElement), true, 'A live hard-delete delta cannot replace the focused vote control');
    await untouched(page, before, model, start);
  }],
  ['late provider success/error cannot overwrite a reopened picker', async ({page, model, touch}) => {
    await open(page, model.event);
    for(const fail of [false, true]){
      const held = hold(model, 'providerGate');
      held.appMarks.push(await observeOwner(await page.locator('.public-comments').elementHandle(), 'ns-public-comment-gif-settled', 2));
      await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, held);
      held.appMarks.push(await observeOwner(await picker(page).elementHandle(), 'ns-chat-gif-search-settled'));
      const oldClose = await page.locator('#closeChatGifPickerBtn').elementHandle();
      await pointer(page.locator('#closeChatGifPickerBtn'), touch);
      await publicGif(page, touch);
      held.resolve(fail ? {error:true} : {title:'Old sensitive provider result'});
      await settled(page, held);
      assert.equal(await picker(page).locator('img').first().getAttribute('alt'), 'Current synthetic GIF');
      assert(!(await picker(page).innerText()).includes('Old sensitive'));
      // Detached controls have no native hit target; this intentionally invokes
      // the stale callback, separately from the live native input assertions.
      await oldClose.evaluate(element => element.click());
      assert.equal(await picker(page).count(), 1);
      await pointer(page.locator('#closeChatGifPickerBtn'), touch);
    }
    const failure = hold(model, 'providerGate');
    failure.appMarks.push(await observeOwner(await page.locator('.public-comments').elementHandle(), 'ns-public-comment-gif-settled'));
    await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, failure);
    failure.appMarks.push(await observeOwner(await picker(page).elementHandle(), 'ns-chat-gif-search-settled')); failure.resolve({error:true});
    await settled(page, failure);
    await pointer(page.locator('#chatGifPickerStatus').getByRole('button', {name:'Retry', exact:true}), touch);
    await picker(page).locator('.chat-gif-result').first().waitFor({state:'visible'});
  }],
  ['pending configuration and closed/detached public lifetimes', async ({page, model, touch}) => {
    for(const ending of ['close', 'detach', 'account']){
      await open(page, model.event); const held = hold(model, 'configGate'), providerBefore = model.providerCalls;
      held.appMarks.push(await observeOwner(await page.locator('.public-comments').elementHandle(), 'ns-public-comment-gif-settled'));
      await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, held);
      if(ending === 'close') await page.keyboard.press('Escape');
      if(ending === 'detach') await page.locator('dialog.public-comments-destination').evaluate(dialog => dialog.remove());
      if(ending === 'account'){
        model.owner = otherOwner;
        model.authIntent = {email:'synthetic@example.invalid'};
        try{ await page.evaluate(async () => { await serverSyncClient.signIn('synthetic@example.invalid', 'synthetic'); serverPersistence.user = {id:serverSyncClient.sessionSubject(), isAnonymous:false}; }); }
        finally{ model.authIntent = null; }
      }
      await privateGif(page, touch); const current = model.providerCalls;
      held.resolve(); await settled(page, held);
      assert.equal(model.providerCalls, current, 'Ended public config must not initiate another provider request'); assert(current > providerBefore);
      assert.equal(await picker(page).evaluate(element => element.parentElement === document.body), true);
      await pointer(picker(page).locator('.chat-gif-result').first(), touch);
      await page.evaluate(() => { setChatDrawerOpen(false); NOTHINGSPORTS_PUBLIC_COMMENTS_UI.reset(); closeNotificationDestination(); });
    }
  }],
  ['explicit denial clears cached UI and fences late vote acknowledgement', async ({page, model, touch}) => {
    await open(page, model.event);
    const text = page.getByRole('textbox', {name:'Write a public comment'}); await text.fill('Sensitive unsent draft'); const oldInput = await text.elementHandle();
    const held = hold(model, 'voteGate'); held.appMarks.push(await observeOwner(await page.locator('.public-comments').elementHandle(), 'ns-public-comment-write-settled'));
    await pointer(page.locator('.public-comment').first().getByRole('button', {name:'Upvote comment', exact:true}), touch); await reached(page, held);
    model.denial = {status:403, code:'account_erasure_in_progress', message:'Account erasure in progress'};
    await page.locator('.public-comments-status').filter({hasText:'Account erasure in progress'}).waitFor();
    assert.equal(await page.locator('.public-comment-composer, .public-comment').count(), 0); assert.equal(await oldInput.evaluate(element => element.value), '');
    const reads = model.publicReads; held.resolve(); await settled(page, held);
    assert.equal(model.publicReads, reads); assert.equal(await page.locator('.public-comment-composer, .public-comment').count(), 0);
  }],
  ['offline read failure retains draft and backs off', async ({page, model}) => {
    await open(page, model.event);
    const text = page.getByRole('textbox', {name:'Write a public comment'}); await text.fill('Retained offline draft');
    model.denial = {status:503, code:'synthetic_offline', message:'Synthetic offline'};
    await page.locator('.public-comments-status').filter({hasText:'Synthetic offline'}).waitFor();
    const reads = model.publicReads; await page.waitForTimeout(1200);
    assert.equal(await text.inputValue(), 'Retained offline draft'); assert.equal(await page.locator('.public-comment').count(), 18); assert.equal(model.publicReads, reads, 'No one-second retry after failure');
  }],
  ['cold discussion uses actual deferred route with current Results and no personal mutation', async ({page, model}) => {
    // The URL was present on cold boot, before the actual Feed slot existed.
    const current = await page.evaluate(() => __publicFeedInitialPersonal), start = model.apiWrites.length;
    await page.evaluate(() => { if(new URL(location.href).searchParams.has('discussion')) focusPendingNotificationEvent(); });
    await page.locator('dialog.public-comments-destination .public-comments').waitFor({state:'attached'});
    assert.equal(await page.locator('dialog.public-comments-destination .feed-live-score').count(), 0);
    assert.equal(await page.evaluate(() => new URL(location.href).searchParams.has('discussion')), false);
    await untouched(page, current, model, start);
  }],
  ['removed Feed membership cannot open a public alert', async ({page, model}) => {
    const before = await state(page);
    await page.evaluate(() => feedCardSlots.clear());
    await assert.rejects(page.evaluate(id => NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(id), model.event.id), /no longer in your Feed/);
    assert.equal(await page.locator('dialog.public-comments-destination').count(), 0);
    assert.deepEqual(await page.evaluate(() => __publicFeedWrites), []);
    assert.equal((await state(page)).actions, before.actions);
  }],
];

async function accessCase(browser, base, width, anonymous){
  const model = scenario(); model.registered = anonymous; model.anonymous = anonymous;
  const {page, context} = await boot(browser, base, model, width);
  const label=browser.browserType().name()+'-'+width+'-'+(anonymous?'anonymous':'signed-out');
  try{
    await page.evaluate(event => { const draw = next => __publicFeedHost.replaceChildren(buildEventCard(event, {mode:'schedule', cardState:next, onCardStateChange:draw})); draw('opened'); }, model.event);
    await pointer(page.locator('#public-feed-native-host .fixture-public-comments'), width < 768);
    assert.equal(await page.locator('.public-comments').count(), 0); assert.equal(model.publicReads, 0);
    await page.evaluate(id => NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(id), model.event.id);
    assert.equal(await page.locator('dialog.public-comments-destination').count(), 0); assert.equal(model.publicReads, 0);
    assert.deepEqual(model.errors, []); assertAllowedWrites(model);
    await page.screenshot({path:path.join(output,label+'.png')});
    return {console:model.console};
  }catch(error){await page.screenshot({path:path.join(output,label+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.tracing.stop({path:path.join(output,label+'.zip')}).catch(()=>{});await context.close();}
}

async function main(){
  fs.mkdirSync(output, {recursive:true});
  const receipt = {sha:git('rev-parse', 'HEAD'), tree:git('rev-parse', 'HEAD^{tree}'), dirty:git('status', '--porcelain'), node:process.version, platform:process.platform, arch:process.arch,
    files:Object.fromEntries(engineFiles.map(name => [name, fileHash(name)])), cases:[], complete:false,
    plannedCases:engines.flatMap(engine => widths.flatMap(width => ['signed-out denied', 'anonymous account denied', ...cases.map(([name]) => name)].map(name => ({engine, width, name})))),
    limits:'Synthetic account/API/GIPHY only. Native desktop engines with touch emulation; not hosted SQL, real provider, installed PWA, push tap or physical phone evidence. No product function replacement; forwarding state-owner spies only.'};
  let server;
  try{
    dependencyCheck(); if(process.argv.includes('--preflight')){ receipt.preflightOnly = true; return; }
    assert(diskFree() >= 4.5 * 1024 ** 3, 'ROOT entry reserve requires 4.5GiB free');
    const allocated = Date.parse(process.env.PUBLIC_FEED_DEADLINE || ''), deadline = Math.min(Date.now() + 600000, Number.isFinite(allocated) ? allocated : Infinity);
    const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright', pw = require(playwrightModule);
    const packageFile = path.join(path.dirname(require.resolve(playwrightModule)), 'package.json');
    receipt.playwright = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, 'utf8')).version : 'package receipt required'; receipt.browserVersions = {};
    server = http.createServer((request, response) => {
      const pathname = new URL(request.url, 'http://local').pathname;
      if(!['GET', 'HEAD'].includes(request.method) || pathname.startsWith('/api/')){ response.writeHead(503); response.end('{}'); return; }
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
      const relative = path.relative(root, file), parts = relative.split(path.sep);
      if(!file.startsWith(root + path.sep) || parts.some(part => part.startsWith('.')) || (parts.length > 1 && !['assets', 'styles', 'config', 'data'].includes(parts[0])) || !/\.(html|js|json|css|svg|woff2?|gif|png|jpe?g|webp|ico|webmanifest|mp3)$/.test(file) || !fs.existsSync(file) || !fs.statSync(file).isFile()){ response.writeHead(404); response.end(); return; }
      const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.gif':'image/gif', '.png':'image/png', '.webp':'image/webp', '.webmanifest':'application/manifest+json'}[path.extname(file)] || 'application/octet-stream';
      response.writeHead(200, {'Content-Type':mime, 'Cache-Control':'no-store'}); response.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = 'http://127.0.0.1:' + server.address().port;
    for(const engine of engines){
      assert(Date.now() < deadline, 'ROOT allocation expired');
      const executablePath = engine === 'chromium' ? process.env.PUBLIC_FEED_CHROMIUM_PATH : process.env.PUBLIC_FEED_WEBKIT_PATH;
      const channel = engine === 'chromium' ? process.env.PUBLIC_FEED_CHROMIUM_CHANNEL : null;
      const browser = await pw[engine].launch({headless:true, ...(executablePath ? {executablePath} : {}), ...(channel ? {channel} : {})});
      receipt.browserVersions[engine] = browser.version();
      let failure; const watchdog = setInterval(() => { if(Date.now() > deadline || diskFree() < 3 * 1024 ** 3){ failure = Error('ROOT runtime reserve/allocation exceeded'); void browser.close(); } }, 1000);
      try{
        for(const width of widths){
          for(const anonymous of [false, true]){ const observed = await accessCase(browser, base, width, anonymous); receipt.cases.push({engine, width, name:anonymous ? 'anonymous account denied' : 'signed-out denied', passed:true, ...observed}); }
          for(const [name, run] of cases){
            assert(!failure && Date.now() < deadline, 'ROOT allocation expired');
            const model = scenario(), query = name.startsWith('cold discussion') ? '?discussion=' + encodeURIComponent(model.event.id) : '';
            const {page, context} = await boot(browser, base, model, width, query), errors = model.errors;
            const label = engine + '-' + width + '-' + receipt.cases.length;
            try{
              await run({page, model, touch:width < 768});
              for(const gate of model.gates) await settled(page, gate);
              assert.deepEqual(errors, []); assertAllowedWrites(model);
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal page overflow');
              await page.screenshot({path:path.join(output, label + '.png')});
              const result = {engine, width, name, passed:true, publicReads:model.publicReads, writes:model.apiWrites, continuations:model.reads, heldOperations:model.gates.map(gate => gate.observed), providerStubs:model.providerCalls, offOriginDenied:[...new Set(model.blocked)], errors, console:model.console}; receipt.cases.push(result); console.log(JSON.stringify(result));
            }catch(error){
              receipt.cases.push({engine, width, name, passed:false, error:error.message, publicReads:model.publicReads, continuations:model.reads, errors, console:model.console, commands:model.commands, blocked:model.blocked});
              await page.screenshot({path:path.join(output, label + '-failure.png')}).catch(() => {}); throw error;
            }finally{
              for(const gate of model.gates) gate.resolve(); await context.tracing.stop({path:path.join(output, label + '.zip')}).catch(() => {}); await context.close();
            }
          }
        }
        if(failure) throw failure;
      }finally{ clearInterval(watchdog); await browser.close(); }
    }
    receipt.complete = engines.join(',') === 'chromium,webkit' && widths.join(',') === '390,1280';
    console.log(receipt.complete ? 'Public Feed native synthetic UI matrix passed; hosted/provider/phone gates remain separate.' : 'Selected Public Feed native cases passed; full default matrix remains required.');
  }catch(error){ receipt.failure = error.message; throw error; }
  finally{
    if(server){ server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
}
if(require.main === module) main().catch(error => { console.error(error); process.exitCode = error.message?.startsWith('DEPENDENCY_PENDING') ? 2 : 1; });
module.exports = {scenario, api, recordWrite, assertAllowedWrites, commentPage, paginatedFixture, installPersonalStateObserver, seedBrowserFixture};
