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
   if(width===390){
    const n2=await page.evaluate(()=>{
      chatState=createChatState({
        currentRoom:{roomId:'test',roomName:'Long room',status:'open',fixture:{name:'Fixture'},members:[],memberCount:0,viewer:{canPost:true,member:true},readOnly:false},
        profile:{displayName:'Jim',publicProfile:true},
        messages:Array.from({length:20},(_,index)=>({messageId:`long-${index}`,clientId:`client-${index}`,body:index===19?'See https://example.com/watch?game=1':'Long room message '+index,sentAt:new Date(Date.parse('2026-09-14T00:00:00Z')+index*1000).toISOString(),senderName:'Jim',own:true,deliveryState:'sent',reactions:[],attachments:[]})),
      });
      chatState.visibleMessageStart=chatWindowStart(chatState.messages);
      const host=document.getElementById('chatBody');host.replaceChildren(buildChatMessageList(),buildChatComposer());
      const initialCount=host.querySelectorAll('[data-message-id]').length;
      const hasOlder=Boolean(host.querySelector('.chat-load-older'));
      const composer=host.querySelector('#chatRoomComposer');
      const stable=host.querySelector('[data-message-id="long-5"]')||host.querySelector('[data-message-id]');
      stable.dataset.identityProbe='kept';
      mergeChatMessages([{messageId:'long-20',clientId:'client-20',body:'Newest',sentAt:'2026-09-14T00:00:21Z',senderName:'Jim',own:true,deliveryState:'sent',reactions:[],attachments:[]}]);
      refreshChatMessageStream({autoScroll:false,preserveScroll:true});
      const link=host.querySelector('.chat-message-link');
      const preview=host.querySelector('.chat-link-preview');
      host.scrollTop=0;updateChatJumpButton();
      const imageMessages=Array.from({length:7},(_,index)=>({body:'',attachments:[{kind:'image'}],sentAt:new Date(index).toISOString()}));
      return {
        initialCount,hasOlder,
        composerPreserved:composer===host.querySelector('#chatRoomComposer'),
        stablePreserved:Boolean(host.querySelector('[data-identity-probe="kept"]')),
        linkHref:link?.href,linkRel:link?.rel,previewHref:preview?.href,
        reactionIcon:[...host.querySelectorAll('.chat-message-action')].some(button=>button.textContent==='🙂'),
        jumpVisible:document.getElementById('chatNewMessagesBtn').classList.contains('show'),
        imageWindowCount:imageMessages.length-chatWindowStart(imageMessages),
        avatarCount:host.querySelectorAll('.chat-message-avatar').length,
        initials:[...host.querySelectorAll('.chat-message-avatar')].every(avatar=>avatar.textContent.trim()==='JI'),
        groupedContinuations:host.querySelectorAll('.chat-message.group-continuation').length,
        profileAvatarEditor:Boolean(buildPublicProfileAvatarEditor({displayName:'Jim Example'}).element.querySelector('input[type=file]')),
      };
    });
    assert.equal(n2.initialCount,15,'initial scroll-back must render only the latest 15 text messages');
    assert.equal(n2.imageWindowCount,5,'initial scroll-back must render only the latest five image messages');
    assert.equal(n2.hasOlder,true);
    assert.equal(n2.composerPreserved,true,'incremental stream patches must retain the composer node');
    assert.equal(n2.stablePreserved,true,'unchanged message nodes must survive incremental patches');
    assert.equal(n2.linkHref,'https://example.com/watch?game=1');
    assert.match(n2.linkRel,/noopener/);assert.match(n2.linkRel,/noreferrer/);
    assert.equal(n2.previewHref,'https://example.com/watch?game=1');
    assert.equal(n2.reactionIcon,true);assert.equal(n2.jumpVisible,true);
    assert.equal(n2.avatarCount,16,'every visible post must carry its mini public-profile avatar or initials fallback');
    assert.equal(n2.initials,true,'missing pictures must use display-name initials');
    assert(n2.groupedContinuations>=14,'consecutive messages from one sender must be marked as one visual group');
    assert.equal(n2.profileAvatarEditor,true,'Public Profile must expose a profile-picture upload control');
   }
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
