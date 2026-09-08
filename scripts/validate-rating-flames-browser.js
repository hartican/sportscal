#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{for(const width of [320,390,768,1280]){
 const page=await browser.newPage({viewport:{width,height:844}});await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');await page.waitForFunction(()=>typeof userPreferences!=='undefined'&&!startupCoordinator.isHydrating());
 for(const inDrawer of [false,true])for(const rating of [0,5]){
  const geometry=await page.evaluate(({inDrawer,rating})=>{document.getElementById('flames-test')?.remove();const ev=activeEvents.find(e=>e.key==='f1')||activeEvents[0];const card=document.createElement('div');card.id='flames-test';card.className='event-card';card.style.width='min(100%,360px)';card.style.boxSizing='border-box';card.style.padding='12px';card.appendChild(buildNothingscorePeerResults(ev,{phase:'impact',currentUser:{contribution:{rating}},peerResults:{count:1,average:5,label:'Epic'}},{inDrawer}));document.getElementById('settingsModal').classList.remove('show');document.querySelector('#listView').appendChild(card);const boxes=[...card.querySelectorAll('.nsc-rating-block')].map(b=>{const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,svgWidth:s.width,svgHeight:s.height};});return{boxes,card:card.getBoundingClientRect().toJSON(),disabled:[...card.querySelectorAll('.nsc-rating-block')].every(b=>b.disabled)};},{inDrawer,rating});
  assert.equal(geometry.boxes.length,5);assert(geometry.boxes.every(b=>b.width>=44&&b.height>=44),`${width}px: each flame needs a full touch target`);
  assert(geometry.boxes.every(b=>b.svgWidth>=36&&b.svgHeight>=42),`${width}px: larger visible flames`);
  assert(geometry.boxes.slice(1).every((b,i)=>b.left-geometry.boxes[i].right>=7),`${width}px: separate flames with a clear gap`);
  assert(geometry.boxes.every(b=>b.left>=geometry.card.left&&b.right<=geometry.card.right),`${width}px: controls fit the card`);
  assert.equal(geometry.disabled,rating===5,'sealed post-match ratings remain sealed');
  if(width===390&&rating===5&&!inDrawer)await page.locator('#flames-test').screenshot({path:'/private/tmp/rating-flames-fixed.png'});
 }
 await page.close();console.log(`${width}px rating size, spacing and sealed state passed`);
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
