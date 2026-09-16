#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   await page.route('**/api/**',route=>route.fulfill({status:503,body:'{}'}));
   await page.goto(process.env.REPAIR_QA_URL||'http://127.0.0.1:33958');
   await page.waitForFunction(()=>typeof chatMessageElement==='function'&&typeof chatState!=='undefined');
   await page.evaluate(()=>{
    chatState=createChatState({currentRoom:{roomId:'test',viewer:{canPost:false}}});
    setChatDrawerOpen(true);
    const host=document.getElementById('chatBody');host.replaceChildren();
    for(const deliveryState of ['sent','delivered','read'])host.appendChild(chatMessageElement({messageId:deliveryState,body:'Test message',sentAt:'2026-09-14T00:30:00Z',senderName:'Jim',own:true,deliveryState,reactions:[],attachments:[]}));
   });
   const result=await page.evaluate(()=>({
    drawer:(()=>{const r=document.querySelector('#chatDrawer').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})(),
    rows:[...document.querySelectorAll('.chat-message-status')].map(row=>{const time=row.querySelector('time'),ticks=row.querySelector('.chat-receipt'),a=time.getBoundingClientRect(),b=ticks.getBoundingClientRect();return {time:time.textContent,date:time.dateTime,ticks:ticks.textContent,label:ticks.getAttribute('aria-label'),aligned:Math.abs(a.y-b.y)<4,separated:b.x>=a.right};}),
   }));
   assert.equal(result.drawer.width,width);assert.equal(result.drawer.height,844);assert.equal(result.drawer.x,0);assert.equal(result.drawer.y,0);
   assert.deepEqual(result.rows.map(row=>row.ticks),['✓','✓✓','✓✓']);
   assert(result.rows.every(row=>row.time&&row.aligned&&row.separated&&row.date==='2026-09-14T00:30:00Z'));
   if(width<=390){
    const keyboardFit=await page.evaluate(()=>{
      document.documentElement.style.setProperty('--chat-viewport-height','420px');
      document.documentElement.style.setProperty('--chat-viewport-top','96px');
      const composer=document.createElement('form');composer.className='chat-room-composer';const input=document.createElement('textarea');input.value='Hello';composer.appendChild(input);document.getElementById('chatBody').appendChild(composer);input.focus();input.scrollIntoView({block:'nearest'});
      const drawer=document.getElementById('chatDrawer').getBoundingClientRect();const field=input.getBoundingClientRect();return {drawerTop:drawer.top,drawerBottom:drawer.bottom,fieldBottom:field.bottom};
    });
    assert.equal(keyboardFit.drawerTop,96);assert.equal(keyboardFit.drawerBottom,516);assert(keyboardFit.fieldBottom<=keyboardFit.drawerBottom,'composer must remain above the simulated keyboard');
   }
   console.log(`${width}px full-screen chat and timestamp/receipt alignment passed`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
