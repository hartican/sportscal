'use strict';
// Called inside the one serial polish pair, using its real loopback handler,
// network boundary, native browser and deadline. These fixtures are constructed.
const assert=require('node:assert/strict');
module.exports=async function cardSize({browser,base,engine,network,scenario,nativeFixture,now,personalState,enterAllSports}){
 const home='team:cricket:australia',away='team:cricket:south-africa';
 const innings=[{inningNumber:1,team:'Australia',participantId:home,runs:350,wicketsCount:10,overs:'90',batting:Array.from({length:11},(_,i)=>({name:'Constructed batter '+i,runs:i+1,balls:20,dismissal:'Bowled'})),bowling:Array.from({length:5},(_,i)=>({name:'Constructed bowler '+i,overs:'18',wickets:2})),fallOfWickets:Array.from({length:10},(_,i)=>({name:'Constructed batter '+i,wicket:i+1,runs:i*25,overs:String(i*8)}))},{inningNumber:2,team:'South Africa',participantId:away,runs:4,wicketsCount:0,overs:'1',batting:[{name:'Constructed opener',runs:4,balls:6,dismissal:'Not out'}]}];
 const cricket=nativeFixture('cricket','size-browser',{name:'Australia v South Africa',format:'Test',homeParticipantId:home,awayParticipantId:away,participantIds:[home,away],participants:[{id:home,displayName:'Australia'},{id:away,displayName:'South Africa'}],innings});
 const racing=nativeFixture('f1','size-racing',{name:'Constructed Grand Prix',sessionType:'race',score:{racing:{schema:'racing.v1',kind:'classification',eventId:'fixture:f1:size-racing',sessionId:'fixture:f1:size-racing',sessionName:'Constructed Grand Prix',phase:'running',status:'live',statusText:'Constructed running field',checkedAt:new Date(now).toISOString(),entries:Array.from({length:22},(_,i)=>({id:'constructed-car:'+i,number:String(i+1),position:i+1,drivers:['Constructed driver '+i],team:'Constructed team '+i,laps:12}))}}});
 scenario.published=[...Array.from({length:3},(_,i)=>nativeFixture('afl','size-neighbour-'+i,{name:'Constructed Home '+i+' v Constructed Away '+i})),cricket,racing];const original=JSON.stringify(scenario.published);
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];let originalError,releaseDetails,detailRequests=0;
 const detailsGate=new Promise(resolve=>{releaseDetails=resolve;});
 try{
  page.on('pageerror',error=>errors.push(error.message));await network.attachContext(page.context());
  // Match Centre requires score-details.js before its tabs can mount. Gate the
  // real deferred full-field read instead; normal startup and loaders run intact.
  await page.route(url=>url.pathname==='/api/match-centre'&&url.searchParams.get('details')==='racing'&&url.searchParams.get('ids')===racing.id,async route=>{detailRequests++;await detailsGate;await route.fallback();});
  await page.addInitScript(({now})=>{
   const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
   localStorage.setItem('ns_preferences_v1',JSON.stringify({version:26,onboardingComplete:true,showSpoilers:true,feedControls:{spoilers:'results_visible'},followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}}));
   // Observe native subscriptions without replacing their delivery or geometry.
   const Native=ResizeObserver;globalThis.qaCardSizeObservers=[];
   globalThis.ResizeObserver=class extends Native{
    constructor(callback){const record={targets:new Set(),deliveries:0,disconnects:0,cards:false};super((...args)=>{record.deliveries++;callback(...args);});this.record=record;qaCardSizeObservers.push(record);}
    observe(target,options){this.record.targets.add(target);this.record.cards||=target.classList.contains('as-fixture');return super.observe(target,options);}
    disconnect(){this.record.targets.clear();this.record.disconnects++;return super.disconnect();}
   };
  },{now});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#startupLaunch').waitFor({state:'hidden'});await page.evaluate(()=>{setTunePromptOpen(false);suppressSessionRatingPrompt();});
  await page.locator('.tabs [data-tab=match-centre]').click();const before=await personalState(page);await enterAllSports(page,5);await page.evaluate(()=>document.fonts.ready);
  const card=page.locator('[data-sports-id="'+cricket.id+'"]');await card.locator('.minimised-card-summary').scrollIntoViewIfNeeded();await card.locator('.minimised-card-summary').click();await card.locator('.fixture-scorecard').waitFor();
  const mounted=await card.elementHandle();
  async function geometry(target=card){return target.evaluate(slot=>{const track=slot.closest('.as-track'),box=track.getBoundingClientRect(),r=slot.getBoundingClientRect(),actions=slot.querySelector('.event-card-primary-actions').getBoundingClientRect(),visible=[...track.children].map(n=>n.getBoundingClientRect()).filter(r=>r.right>box.left+1&&r.left<box.right-1);return {track:box.height,card:r.height,actionsBottom:actions.bottom,trackBottom:box.bottom,visibleMax:Math.max(...visible.map(r=>r.height)),left:track.scrollLeft,rows:slot.querySelectorAll('tr').length,observations:qaCardSizeObservers.filter(o=>[...o.targets].some(t=>t.classList.contains('as-fixture'))).map(o=>({targets:o.targets.size,deliveries:o.deliveries}))};});}
  async function fitted(){await page.waitForFunction(()=>{const track=document.querySelector('.as-track'),box=track.getBoundingClientRect(),visible=[...track.children].map(n=>n.getBoundingClientRect()).filter(r=>r.right>box.left+1&&r.left<box.right-1);return visible.length&&visible.every(r=>r.bottom<=box.bottom+1)&&Math.abs(box.height-Math.max(...visible.map(r=>r.height))-14)<2;},null,{timeout:8000});}
  const choose=card.getByRole('combobox',{name:'Scorecard innings',exact:true});await choose.waitFor();await fitted();const short=await geometry();assert(short.rows>0);assert(short.actionsBottom<=short.trackBottom+1,'Lower controls remain inside the track');
  await choose.selectOption('1');await fitted();const tall=await geometry();assert(tall.track>short.track+200,'The actual innings selector expands the longer scorecard');assert(tall.actionsBottom<=tall.trackBottom+1);
  await choose.selectOption('2');await fitted();const shrunk=await geometry();assert(Math.abs(shrunk.track-short.track)<2,'The short innings removes the extra space');assert.equal(await mounted.evaluate(slot=>slot===document.querySelector('.as-expanded')),true,'Details changes preserve the mounted card');
  await card.locator('..').evaluate(track=>track.scrollTo({left:0,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('.as-track').scrollLeft<2);await fitted();const compact=await geometry();assert(compact.card>compact.visibleMax,'The expanded card is offscreen');
  const deliveries=compact.observations.reduce((n,o)=>n+o.deliveries,0);await choose.evaluate(select=>{select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(before=>qaCardSizeObservers.reduce((n,o)=>n+([...o.targets].some(t=>t.classList.contains('as-fixture'))?o.deliveries:0),0)>before,deliveries);await fitted();const offscreen=await geometry();assert.equal(offscreen.track,compact.track,'Offscreen detail growth leaves compact pages short');
  await card.evaluate(slot=>slot.scrollIntoView({block:'nearest',inline:'start',behavior:'instant'}));await fitted();const returned=await geometry();assert(Math.abs(returned.track-tall.track)<2,'Paging back fits the same expanded innings');assert(returned.actionsBottom<=returned.trackBottom+1);
  const race=page.locator('[data-sports-id="'+racing.id+'"]'),requested=page.waitForRequest(request=>{const url=new URL(request.url());return url.searchParams.get('details')==='racing'&&url.searchParams.get('ids')===racing.id;});
  await race.locator('.minimised-card-summary').scrollIntoViewIfNeeded();await race.locator('.minimised-card-summary').click();await requested;await race.locator('.racing-table-wrap').waitFor({state:'attached'});await fitted();
  const empty=await geometry(race),raceMounted=await race.elementHandle();assert(detailRequests>0);assert.equal(await race.locator('[data-racing-entry-id]').count(),0,'The real full-field read is still pending');releaseDetails();
  await page.waitForFunction(()=>document.querySelectorAll('.as-expanded [data-racing-entry-id]').length===22);await fitted();const arrived=await geometry(race);assert(arrived.track>empty.track+100,'Async full-field arrival grows the existing track');assert(arrived.actionsBottom<=arrived.trackBottom+1,'Deferred details preserve the lower controls');assert.equal(await raceMounted.evaluate(slot=>slot===document.querySelector('.as-expanded')),true);
  await page.getByRole('tab',{name:'Everything',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.all-sports-view'));
  const cleanup=await page.evaluate(()=>qaCardSizeObservers.filter(o=>o.cards&&o.disconnects).map(o=>({targets:o.targets.size,disconnects:o.disconnects})));assert(cleanup.length>0);assert(cleanup.every(o=>o.targets===0),'Leaving All Sports disconnects mounted-card observations');
  assert.deepEqual(await personalState(page),before,'Detail changes and paging preserve saved personal choices');assert.equal(JSON.stringify(scenario.published),original);assert.deepEqual(errors,[]);network.assertIsolated();
  console.log(JSON.stringify({engine,probe:'native Cricket innings and deferred racing size',constructed:true,physicalDeviceProof:false,short,tall,shrunk,compact,offscreen,returned,deferredRacing:{requests:detailRequests,empty,arrived,entries:22},cleanup,sourceFactsPreserved:true,privateChoicesPreserved:true,errors}));
 }catch(error){originalError=error;console.error(JSON.stringify({engine,probe:'dynamic card size failure',error:error.message,errors}));throw error;}
 finally{releaseDetails();try{await page.close();}catch(cleanupError){if(!originalError)throw cleanupError;console.error(JSON.stringify({engine,secondarySizeCleanupError:cleanupError.message}));}}
};
