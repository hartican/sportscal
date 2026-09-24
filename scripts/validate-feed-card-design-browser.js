'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.REPAIR_QA_URL||'http://127.0.0.1:33976';
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
for(const width of [320,390,768,1280])for(const theme of ['day','night']){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,json:{}}));
 await page.goto(base);await page.waitForFunction(()=>typeof composeFeedCard==='function'&&!startupCoordinator.isHydrating());
 await page.evaluate(({theme})=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));document.documentElement.dataset.theme=theme;activeTab='feed';activeView='list';document.querySelectorAll('main>section').forEach(n=>{if(n.id!=='listView')n.style.display='none'});document.querySelector('#listView').style.display='';}, {theme});
 for(const compact of [false,true]){
  const count=await page.evaluate(async compact=>{
   const data=(await(await fetch('data/events.json')).json()).events;
   const nrl=data.find(e=>e.key==='nrl'&&e.date==='2026-09-25');
   const sample=[nrl,...['afl','tennis','golf','f1'].map(key=>data.find(e=>e.key===key&&!NOTHINGSPORTS_TENNIS_FEED.isParent(e)))];
   if(sample.some(e=>!e))throw Error('Missing fixture family');
   const variants=[...sample,...Object.entries({live:{status:'live'},completed:{status:'completed'},postponed:{status:'postponed'},cancelled:{status:'cancelled'},unknown:{timeTbc:true},estimated:{timePrecision:'estimated'},follows:{timePrecision:'follows'},range:{dateOnly:true,date:'2026-09-25',endDate:'2026-09-28'},missing:{name:'Unresolved entrants',participants:[],participantIds:[],homeParticipantId:null,awayParticipantId:null},long:{name:'A tournament session with a deliberately long descriptive fixture name',key:'golf',participants:[],participantIds:[]}}).map(([id,changes])=>({...nrl,...changes,id:'qa-'+id,eventId:'qa-'+id,canonicalEventId:'qa-'+id,scheduleStatus:changes.status||'scheduled'}))];
   const list=document.querySelector('#listView');list.replaceChildren();const h=document.createElement('div');h.className='date-heading';h.textContent=fmtDateHeading('2026-09-25');list.append(h);
   window.designQa=variants;
   for(const ev of variants){setCardState(ev,compact?'compact':'selected');const card=buildEventCard(ev);card.dataset.designQa='true';list.append(card);}
   return variants.length;
  },compact);
  await page.waitForTimeout(150);
  const values=await page.locator('[data-design-qa]').evaluateAll(cards=>cards.map(card=>{
   const rect=n=>n.getBoundingClientRect().toJSON();
   const badge=card.querySelector('.fixture-timing-badge');
   const canvas=document.createElement('canvas').getContext('2d');
   const rgb=value=>{canvas.fillStyle=value;canvas.fillRect(0,0,1,1);return [...canvas.getImageData(0,0,1,1).data].slice(0,3);};
   const luminance=value=>value.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const style=getComputedStyle(card),surface=rgb(style.backgroundColor),tints=['--fixture-left','--fixture-right'].map(k=>rgb(style.getPropertyValue(k)));
   const contrast=[...card.querySelectorAll('.fixture-timing-badge,.fixture-stage-label,.fixture-standing,.fixture-venue')].flatMap(n=>tints.map(tint=>{const a=luminance(rgb(getComputedStyle(n).color)),b=luminance(surface.map((v,i)=>v*.87+tint[i]*.13));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}));
   return {contrast,text:card.innerText,box:rect(card),fallback:card.classList.contains('is-fixture-fallback'),badge:badge&&rect(badge),stages:card.querySelectorAll('.fixture-stage-label').length,flames:[...card.querySelectorAll('.nsc-rating-block')].map(rect),providers:[...card.querySelectorAll('.fixture-access .provider-link')].map(n=>({box:rect(n),name:n.getAttribute('aria-label')})),controls:[...card.querySelectorAll('.event-card-controls,.event-card-disclosure')].map(rect)};
  }));
  assert.equal(values.length,count);
  for(const value of values){
   assert(value.contrast.every(r=>r>=4.5),`${width}/${theme}: text contrast ${Math.min(...value.contrast)}`);
   assert(!value.fallback,`${width}/${theme}: no fallback`);assert(value.badge,'time present');assert(value.stages<=1,'one stage');
   assert(!/Watch(?: now)? on|Marquee|sportsbet|\$1\.63/.test(value.text),'no betting/prefix/Marquee');
   assert.equal(value.flames.length,5);
   for(const b of [...value.flames,...value.providers.map(p=>p.box)]){assert(b.width>=43.9&&b.height>=43.9,'44px targets');assert(b.left>=value.box.left-1&&b.right<=value.box.right+1,`${width}: controls fit`);}
   for(const b of value.controls)assert(value.badge.right<=b.left||value.badge.left>=b.right||value.badge.bottom<=b.top||value.badge.top>=b.bottom,'timing clear of controls');
  }
  assert.equal(values[0].providers.length,4,'all four NRL providers');assert(values[0].text.includes('3RD')&&values[0].text.includes('4TH'),'rankings below names');assert(values[0].text.includes('Suncorp Stadium, Brisbane'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow');
  if(process.env.QA_SCREENSHOT_DIR&&width===390&&!compact){for(let i=0;i<5;i++)await page.locator('[data-design-qa]').nth(i).screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/family-${i}-${theme}.png`});}
  const card=page.locator('[data-design-qa]').first();await card.locator('.fixture-more').click();await page.waitForTimeout(80);
  const updated=page.locator(`[data-event-id="major-match-nrl-finals-2026-preliminary-final-2"]`);assert.equal(await updated.getAttribute('data-card-state'),'opened');assert(await updated.locator('.fixture-more').evaluate(n=>n===document.activeElement),'More restores focus');assert((await updated.innerText()).includes('Isaiya Katoa'),'expanded copy');
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await updated.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/nrl-${width}-${theme}-${compact?'compact-expanded':'full'}.png`});}
  console.log(`${width}px ${theme} ${compact?'compact':'full'}: ${count} fixture cases, ratings/provider targets, no overflow, More/focus passed`);
 }
 assert.deepEqual(errors,[]);await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
