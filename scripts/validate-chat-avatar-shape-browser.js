#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');let server;
 let base=process.env.CHAT_AVATAR_QA_URL;
 if(!base){
  server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://local').pathname;
   const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(bytes);});
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 }
 const avatarUrl=base+'/nothingsports-avatar-thumbnails/qa.png';
 const image=await require('sharp')({create:{width:128,height:128,channels:3,background:'#dc467c'}}).png().toBuffer();
 try{
  for(const engine of [chromium,webkit]){
   const browser=await engine.launch({headless:true});
   try{
    for(const width of [320,390,768]){
     const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
     await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
     await page.addInitScript(()=>sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:'h.'+btoa(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111'}))+'.s',refreshToken:'qa',expiresAt:Date.now()+3600000})));
     await page.route('**/api/**',route=>{
      let body;try{body=route.request().postDataJSON();}catch(_){}
      if(body?.action==='profile-avatar-access')return route.fulfill({json:{avatars:[{avatarUrl,profileId:'22222222-2222-4222-8222-222222222222'}]}});
      return route.fulfill({status:503,json:{error:'QA isolation'}});
     });
     await page.route(/\/(?:nothingsports-avatar-thumbnails|other-thumbnail)\//,route=>route.fulfill({contentType:'image/png',body:image}));
     await page.goto(base);await page.waitForFunction(()=>typeof chatMessageElement==='function');
     await page.evaluate(url=>{
      chatState=createChatState({currentRoom:{roomId:'qa',viewer:{canPost:false}}});setChatDrawerOpen(true);
      const host=document.getElementById('chatBody');host.replaceChildren();
      for(const [id,avatarUrl] of [['expandable',url],['ordinary',url.replace('/nothingsports-avatar-thumbnails/','/other-thumbnail/')],['initials',null]]){
       host.append(chatMessageElement({messageId:id,body:'Mobile profile picture shape check',sentAt:'2026-09-22T00:00:00Z',senderName:'Long Display Name',avatarUrl,own:false,deliveryState:'sent',reactions:[],attachments:[]}));
      }
      const member=document.createElement('div');member.className='chat-member-identity';member.append(chatAvatarElement({avatarUrl:url,displayName:'Member Name',className:'chat-member-avatar'}));host.append(member);
     },avatarUrl);
     await page.waitForSelector('.chat-message-avatar[role="button"]', { state: 'attached' });
     // Background auth is isolated in this fixture; reopen after its initial reset.
     await page.evaluate(() => setChatDrawerOpen(true));
     await page.locator('.chat-message-avatar img').first().waitFor();
     const measurements=await page.locator('.chat-avatar').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),img=node.querySelector('img');return{className:node.className,role:node.getAttribute('role'),width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,padding:s.padding,objectFit:img?getComputedStyle(img).objectFit:null};}));
     console.log(`${engine===webkit?'WebKit':'Chromium'} ${width}px`,JSON.stringify(measurements));
     for(const measurement of measurements){assert(Math.abs(measurement.width-measurement.height)<.5,`${measurement.className} must stay square: ${measurement.width} × ${measurement.height}`);if(measurement.objectFit)assert.equal(measurement.objectFit,'cover');if(measurement.className.includes('chat-message-avatar'))assert.equal(measurement.width,16,'inline message avatar keeps a readable size independent of initials font');}
     if(process.env.CHAT_AVATAR_SCREENSHOT_DIR){fs.mkdirSync(process.env.CHAT_AVATAR_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CHAT_AVATAR_SCREENSHOT_DIR,`chat-avatar-${engine===webkit?'webkit':'chromium'}-${width}.png`)});}
     await page.close();
    }
   }finally{await browser.close();}
  }
 }finally{if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
