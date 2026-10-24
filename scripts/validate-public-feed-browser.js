'use strict';
// Native, isolated UI qualification. Requires ROOT's coherent PR37 + Public
// Feed integration; never substitutes an adapter, SDK, picker, fetch or clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');

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
const engineFiles = ['scripts/validate-public-feed-browser.js', 'index.html', 'assets/js/app-shell-runtime.js', 'config/venue-panel-ui.js', 'config/feed-live-scores.js', 'assets/js/public-comments-ui.js', 'config/chat-media-ui.js', 'assets/js/notification-navigation.js'];
const navigationPath = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/assets\/js\/notification-navigation\.js\?v=\d+/)?.[0];

function dependencyCheck(){
  assert.equal(process.version, 'v24.21.0', 'Use the allocated Node24.21.0 runtime');
  assert(navigationPath, 'Actual deferred notification route is required');
  const adapter = fs.readFileSync(path.join(root, 'config/venue-panel-ui.js'), 'utf8');
  assert(adapter.includes('options.onCardStateChange') && adapter.includes('options.cardState'),
    'DEPENDENCY_PENDING: ROOT must combine the real reviewed PR37 cardState/onCardStateChange adapter; no substitute renderer is permitted.');
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
  return {event, rows, revision:rows.length, points:25, owner, anonymous:false, registered:true, publicReads:0, commands:[], apiWrites:[], blocked:[], stubs:[], errors:[], configCalls:0, providerCalls:0, gates:[], configGate:null, providerGate:null, voteGate:null, denial:null};
}

function hold(model, key){
  assert(!model[key], 'Only one held transport at this boundary');
  const gate = {...deferred(), entered:deferred()}; model[key] = gate; model.gates.push(gate); return gate;
}
async function reached(page, gate){
  let timer, closed;
  try{
    await Promise.race([gate.entered.promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('Held transport was not reached within 15 seconds')), 15000);
      closed = () => reject(Error('Page closed before held transport')); page.once('close', closed);
    })]);
  }finally{ clearTimeout(timer); page.off('close', closed); }
}
async function passGate(model, key){
  const gate = model[key]; if(!gate) return null;
  model[key] = null; gate.entered.resolve(); return (await gate.promise) || {};
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
  const request = route.request(), command = request.method() === 'POST' ? request.postDataJSON() : null;
  if(command) model.apiWrites.push({path:url.pathname, action:command.action});
  if(url.pathname === '/api/auth'){
    const current = session(model);
    return route.fulfill({json:{configured:true, user:model.registered ? current.user : null, ...(command ? {session:current} : {})}});
  }
  if(url.pathname === '/api/nothingscore') return route.fulfill({json:{points:model.points, settlements:[], entries:[], privileges:[]}});
  if(url.pathname === '/api/chat'){
    if(url.searchParams.get('mode') === 'gif-config'){
      model.configCalls++; await passGate(model, 'configGate'); return route.fulfill({json:gifConfig(model)});
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
          await passGate(model, 'voteGate');
          const row = model.rows.find(row => row.id === command.id); assert(row);
          row.score += command.value - row.myVote; row.myVote = command.value; row.revision = ++model.revision;
          return route.fulfill({json:{comment:row}});
        }
        if(command.action === 'public-comment-post'){
          const row = {id:crypto.randomUUID(), handle:'@synthetic-reader', own:true, body:command.body || '', gif:command.gif || null, parentId:command.parentId || null, score:0, myVote:0, createdAt:new Date().toISOString(), revision:++model.revision};
          model.rows.push(row); return route.fulfill({json:{comment:row}});
        }
        if(command.action === 'public-comment-delete'){
          const row = model.rows.find(row => row.id === command.id); assert(row); Object.assign(row, {deleted:true, body:'', gif:null, revision:++model.revision});
          return route.fulfill({json:{comment:row}});
        }
        throw Error('Unexpected public command: ' + command.action);
      }
      const after = url.searchParams.get('after'), parent = url.searchParams.get('q');
      const rows = model.rows.filter(row => after ? row.revision > Number(after) : parent ? row.parentId === parent : !row.parentId);
      return route.fulfill({json:{comments:rows, revision:model.revision, hasMore:false, nextCursor:null}});
    }
    return route.fulfill({json:{room:{roomId:'synthetic-private', roomName:'Synthetic private room', fixture:model.event, status:'open', members:[], viewer:{canPost:true, member:true}}, messages:[], rooms:[], profile:{displayName:'Synthetic reader', publicProfile:true}, capabilities:gifConfig(model).capabilities}});
  }
  // An unexpected write fails the eventual personal-state assertion even if
  // the application handles this isolated service-unavailable response.
  return route.fulfill({status:503, json:{error:'Synthetic qualification: service unavailable'}});
}

async function isolate(page, model, base){
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    try{
      if(url.origin === base){
        if(url.pathname.startsWith('/api/')) return await api(route, model, url);
        return await route.continue();
      }
      if(url.origin === 'https://api.giphy.com' && ['/v1/gifs/search', '/v1/gifs/trending'].includes(url.pathname)){
        model.providerCalls++; model.stubs.push(url.origin + url.pathname);
        const response = await passGate(model, 'providerGate') || {};
        if(response.error) return await route.fulfill({status:503, json:{error:'Synthetic provider error'}});
        const offset = Number(url.searchParams.get('offset') || 0), title = response.title || (offset ? 'Second synthetic GIF' : 'Current synthetic GIF');
        return await route.fulfill({json:{data:[{id:'synthetic-' + offset, title, images:{original:{url:'https://media.giphy.com/media/synthetic/giphy.gif', width:'120', height:'120'}, fixed_width:{url:'https://media.giphy.com/media/synthetic/200w.gif', width:'120', height:'120'}}}], pagination:{count:1, total_count:2, offset}}});
      }
      if(url.origin === 'https://media.giphy.com' && /^\/media\/synthetic\/(?:giphy|200w)\.gif$/.test(url.pathname)){
        model.stubs.push(url.origin + url.pathname); return await route.fulfill({contentType:'image/gif', body:gifPixel});
      }
      model.blocked.push(url.origin + url.pathname); return await route.abort('blockedbyclient');
    }catch(error){
      // Aborted/closed requests are expected when the actual picker disposes
      // its AbortController. Never replace fetch or ignore another route error.
      if(page.isClosed() || /already handled|Target.*closed|cancelled|canceled|aborted|Invalid InterceptionId/i.test(error.message)) return;
      throw error;
    }
  });
}

async function boot(browser, base, model, width, query = ''){
  const context = await browser.newContext({viewport:{width, height:844}, hasTouch:true, serviceWorkers:'block'});
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(30000);
  page.on('pageerror', error => model.errors.push(error.message));
  try{
  await isolate(page, model, base);
  await page.addInitScript(({registered, token, owner, anonymous}) => {
    localStorage.setItem('ns_preferences_v1', JSON.stringify({version:27, onboardingComplete:true, showSpoilers:true, followedSports:[], selectedSelectorEntityIds:[], feedControls:{spoilers:'results_visible'}, fantasyDeadlines:{enabled:false}, followFirst:{notifications:{enabled:false, autoRemindersEnabled:false}, refinement:{promptedAt:'2026-10-24'}}}));
    if(registered) sessionStorage.setItem('ns_auth_session_v1', JSON.stringify({accessToken:token, refreshToken:'synthetic-only', expiresAt:Date.now() + 3600000}));
    globalThis.__publicFeedFixtureAccount = {owner, anonymous};
  }, {registered:model.registered, token:session(model).access_token, owner:model.owner, anonymous:model.anonymous});
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
    globalThis.__publicFeedWrites = [];
    for(const name of ['setCardState', 'updateEventAction', 'recordEventFeedAction', 'observeNewSurfaceItem']){
      const original = globalThis[name]; if(typeof original !== 'function') throw Error('Missing actual state owner: ' + name);
      globalThis[name] = function(...args){ __publicFeedWrites.push(name); return original.apply(this, args); };
    }
    if(cold){ userPreferences.showSpoilers = false; userPreferences.feedControls.spoilers = 'strict'; }
    globalThis.__publicFeedInitialPersonal = {preferences:JSON.stringify(userPreferences), actions:JSON.stringify(eventActions), cards:JSON.stringify(cardViewStates), spoilers:JSON.stringify(eventSpoilerState), opened:JSON.stringify([...sessionOpenedEventIds]), seen:JSON.stringify([...surfaceSeenEvents]), mounted:[...feedCardSlots.values()].map(item => [item.event.id, item.mounted]), activeTab};
    if(cold) await loadDeferredScript(navigationPath);
    else await loadDeferredScript('assets/js/public-comments-ui.js?v=1');
  }, {event:model.event, registered:model.registered, owner:model.owner, anonymous:model.anonymous, cold:!!query, navigationPath});
  return {page, context};
  }catch(error){ await context.close(); throw error; }
}

async function state(page){
  return page.evaluate(() => ({preferences:JSON.stringify(userPreferences), actions:JSON.stringify(eventActions), cards:JSON.stringify(cardViewStates), spoilers:JSON.stringify(eventSpoilerState),
    opened:JSON.stringify([...sessionOpenedEventIds]), seen:JSON.stringify([...surfaceSeenEvents]), mounted:[...feedCardSlots.values()].map(item => [item.event.id, item.mounted]), activeTab}));
}
async function untouched(page, before, model, writeStart){
  assert.deepEqual(await state(page), before, 'Discussion must preserve personal Feed, card, seen, Results and follow choices');
  assert.deepEqual(await page.evaluate(() => __publicFeedWrites), [], 'Discussion must not call personal card/engagement/seen owners');
  assert.deepEqual(model.apiWrites.slice(writeStart).filter(write => write.path !== '/api/chat'), [], 'Discussion must not issue account/preference/notification writes');
}
async function open(page, event){
  await page.evaluate(id => NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(id), event.id);
  await page.locator('dialog.public-comments-destination[open] .public-comment').first().waitFor({state:'attached'});
  await page.locator('dialog.public-comments-destination h3').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('dialog.public-comments-destination .event-card').getAttribute('data-card-state'), 'opened', 'Actual shared adapter must consume local opened state');
}
async function inline(page, event){
  await page.evaluate(event => {
    const draw = next => __publicFeedHost.replaceChildren(buildEventCard(event, {mode:'schedule', cardState:next, onCardStateChange:draw}));
    draw('opened');
  }, event);
  await page.locator('#public-feed-native-host .fixture-public-comments').click();
  await page.locator('#public-feed-native-host .public-comment').first().waitFor({state:'attached'});
}
async function pointer(locator, touch){
  await locator.scrollIntoViewIfNeeded();
  assert(await locator.evaluate(element => { const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (element === hit || element.contains(hit)); }), 'Native hit target must reach the control');
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
      await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, held);
      const oldClose = await page.locator('#closeChatGifPickerBtn').elementHandle();
      await pointer(page.locator('#closeChatGifPickerBtn'), touch);
      await publicGif(page, touch);
      held.resolve(fail ? {error:true} : {title:'Old sensitive provider result'});
      await page.waitForTimeout(100);
      assert.equal(await picker(page).locator('img').first().getAttribute('alt'), 'Current synthetic GIF');
      assert(!(await picker(page).innerText()).includes('Old sensitive'));
      // Detached controls have no native hit target; this intentionally invokes
      // the stale callback, separately from the live native input assertions.
      await oldClose.evaluate(element => element.click());
      assert.equal(await picker(page).count(), 1);
      await pointer(page.locator('#closeChatGifPickerBtn'), touch);
    }
    const failure = hold(model, 'providerGate');
    await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, failure); failure.resolve({error:true});
    await pointer(page.locator('#chatGifPickerStatus').getByRole('button', {name:'Retry', exact:true}), touch);
    await picker(page).locator('.chat-gif-result').first().waitFor({state:'visible'});
  }],
  ['pending configuration and closed/detached public lifetimes', async ({page, model, touch}) => {
    for(const ending of ['close', 'detach', 'account']){
      await open(page, model.event); const held = hold(model, 'configGate'), providerBefore = model.providerCalls;
      await pointer(page.locator('.public-comment-composer').getByRole('button', {name:'GIF', exact:true}), touch); await reached(page, held);
      if(ending === 'close') await page.keyboard.press('Escape');
      if(ending === 'detach') await page.locator('dialog.public-comments-destination').evaluate(dialog => dialog.remove());
      if(ending === 'account'){
        model.owner = otherOwner;
        await page.evaluate(async () => { await serverSyncClient.signIn('synthetic@example.invalid', 'synthetic'); serverPersistence.user = {id:serverSyncClient.sessionSubject(), isAnonymous:false}; });
      }
      await privateGif(page, touch); const current = model.providerCalls;
      held.resolve(); await page.waitForTimeout(100);
      assert.equal(model.providerCalls, current, 'Ended public config must not initiate another provider request'); assert(current > providerBefore);
      assert.equal(await picker(page).evaluate(element => element.parentElement === document.body), true);
      await pointer(picker(page).locator('.chat-gif-result').first(), touch);
      await page.evaluate(() => { setChatDrawerOpen(false); NOTHINGSPORTS_PUBLIC_COMMENTS_UI.reset(); closeNotificationDestination(); });
    }
  }],
  ['explicit denial clears cached UI and fences late vote acknowledgement', async ({page, model, touch}) => {
    await open(page, model.event);
    const text = page.getByRole('textbox', {name:'Write a public comment'}); await text.fill('Sensitive unsent draft'); const oldInput = await text.elementHandle();
    const held = hold(model, 'voteGate'); await pointer(page.locator('.public-comment').first().getByRole('button', {name:'Upvote comment', exact:true}), touch); await reached(page, held);
    model.denial = {status:403, code:'account_erasure_in_progress', message:'Account erasure in progress'};
    await page.locator('.public-comments-status').filter({hasText:'Account erasure in progress'}).waitFor();
    assert.equal(await page.locator('.public-comment-composer, .public-comment').count(), 0); assert.equal(await oldInput.evaluate(element => element.value), '');
    const reads = model.publicReads; held.resolve(); await page.waitForTimeout(1200);
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
  try{
    await page.evaluate(event => { const draw = next => __publicFeedHost.replaceChildren(buildEventCard(event, {mode:'schedule', cardState:next, onCardStateChange:draw})); draw('opened'); }, model.event);
    await pointer(page.locator('#public-feed-native-host .fixture-public-comments'), width < 768);
    assert.equal(await page.locator('.public-comments').count(), 0); assert.equal(model.publicReads, 0);
    await page.evaluate(id => NOTHINGSPORTS_PUBLIC_COMMENTS_UI.openFixture(id), model.event.id);
    assert.equal(await page.locator('dialog.public-comments-destination').count(), 0); assert.equal(model.publicReads, 0);
    assert.deepEqual(model.errors, []);
  }finally{ await context.close(); }
}

async function main(){
  fs.mkdirSync(output, {recursive:true});
  const receipt = {sha:git('rev-parse', 'HEAD'), tree:git('rev-parse', 'HEAD^{tree}'), dirty:git('status', '--porcelain'), node:process.version, platform:process.platform, arch:process.arch,
    files:Object.fromEntries(engineFiles.map(name => [name, fileHash(name)])), cases:[], complete:false,
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
          for(const anonymous of [false, true]){ await accessCase(browser, base, width, anonymous); receipt.cases.push({engine, width, name:anonymous ? 'anonymous account denied' : 'signed-out denied', passed:true}); }
          for(const [name, run] of cases){
            assert(!failure && Date.now() < deadline, 'ROOT allocation expired');
            const model = scenario(), query = name.startsWith('cold discussion') ? '?discussion=' + encodeURIComponent(model.event.id) : '';
            const {page, context} = await boot(browser, base, model, width, query), errors = model.errors;
            const label = engine + '-' + width + '-' + receipt.cases.length; await context.tracing.start({screenshots:true, snapshots:true, sources:true});
            try{
              await run({page, model, touch:width < 768}); assert.deepEqual(errors, []);
              assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal page overflow');
              await page.screenshot({path:path.join(output, label + '.png')});
              const result = {engine, width, name, passed:true, publicReads:model.publicReads, providerStubs:model.providerCalls, offOriginDenied:[...new Set(model.blocked)], errors}; receipt.cases.push(result); console.log(JSON.stringify(result));
            }catch(error){
              receipt.cases.push({engine, width, name, passed:false, error:error.message, errors, commands:model.commands, blocked:model.blocked});
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
main().catch(error => { console.error(error); process.exitCode = error.message?.startsWith('DEPENDENCY_PENDING') ? 2 : 1; });
