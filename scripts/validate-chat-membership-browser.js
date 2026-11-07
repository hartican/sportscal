#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   page.on('dialog',dialog=>dialog.accept());
   await page.route('**/api/**',route=>route.fulfill({status:503,body:'{}'}));
   const target=process.env.REPAIR_QA_URL||'http://127.0.0.1:33959';
   await page.route(url=>url.href.replace(/\/$/,'')===target.replace(/\/$/,''),async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:(await response.text()).replace('const serverSyncClient =','let serverSyncClient =')});
   });
   await page.goto(target);
   await page.waitForFunction(()=>typeof renderActiveChats==='function');
   await page.evaluate(()=>{
    const room=(roomId,roomName)=>({roomId,roomName,fixture:{name:'Fremantle v Brisbane Lions'},unreadCount:0});
    window.membershipPayload={isAdmin:true,rooms:[room('joined','Joined room')],archivedRooms:[room('hidden-one','Hidden one'),room('hidden-two','Hidden two')],adminRooms:[room('inspection','Inspection only')],openRoomCount:3};
    window.membershipCalls=[];
    serverPersistence.user={id:'test-account'};
    serverSyncClient={getGuestChatSession:()=>null,chatRequest:async(query,command)=>{
     if(command){window.membershipCalls.push(command);if(command.action==='leave-room'){
      window.membershipPayload.archivedRooms=window.membershipPayload.archivedRooms.filter(room=>room.roomId!==command.roomId);
      window.membershipPayload.openRoomCount--;
     }}
     return window.membershipPayload;
    }};
    chatState=createChatState(window.membershipPayload);setChatDrawerOpen(true);renderActiveChats();
   });
   assert.match(await page.locator('#chatBody').innerText(),/You have 3 open chats, including 2 hidden/);
   assert.equal(await page.getByRole('button',{name:'Leave Hidden one',exact:true}).count(),1);
   await page.getByRole('button',{name:'Select chats',exact:true}).click();
   await page.getByRole('button',{name:'Select all',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>chatState.selectedRoomIds),['joined'],'inspection rooms must never be selectable as memberships');
   await page.getByRole('button',{name:'Cancel',exact:true}).click();
   await page.getByRole('button',{name:'Leave Hidden one',exact:true}).click();
   await page.waitForFunction(()=>chatState.openRoomCount===2);
   assert.match(await page.locator('#chatBody').innerText(),/You have 2 open chats, including 1 hidden/);
   assert.deepEqual(await page.evaluate(()=>window.membershipCalls),[{action:'leave-room',roomId:'hidden-one'}]);
   assert(await page.evaluate(()=>document.getElementById('chatBody').scrollWidth<=document.getElementById('chatBody').clientWidth+1),'chat list must fit viewport');
   await page.evaluate(()=>{chatState=createChatState({isAdmin:true,adminRooms:window.membershipPayload.adminRooms});renderActiveChats();});
   await page.getByText('Admin inspection — not joined',{exact:true}).click();
   assert(await page.getByRole('button',{name:/Inspection only/}).isVisible(),'admin inspection remains available with zero memberships');
   console.log(`Chat membership browser passed at ${width}px`);await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
