'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),owner='11111111-1111-4111-8111-111111111111',friend='22222222-2222-4222-8222-222222222222';
const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
(async()=>{
 const server=http.createServer((request,response)=>{const file=path.resolve(root,'.'+new URL(request.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){response.writeHead(404).end();return;}fs.readFile(file,(error,body)=>{if(error){response.writeHead(404).end();return;}response.setHeader('Content-Type',({'js':'application/javascript','json':'application/json','css':'text/css','html':'text/html','svg':'image/svg+xml'})[path.extname(file).slice(1)]||'application/octet-stream');response.end(body);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true, ...(process.env.PWA_EXECUTABLE_PATH?{executablePath:process.env.PWA_EXECUTABLE_PATH}:{})});
 try{
 for(const width of [320,390,768,1280])for(const theme of ['day','night']){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[],commands=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>sessionStorage.setItem('ns_chat_draft_v2:old-room','retired draft'));
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.postDataJSON?.()||{};let status=200,result={};
   if(url.pathname==='/api/auth')result=request.method()==='GET'?{configured:true}:{session:{access_token:token,refresh_token:'test-only',expires_in:3600,user:{id:owner,email:'qa@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z'}}};
   else if(url.searchParams.has('people'))result={entries:[{profileId:friend,name:'Sam',handle:'sam',following:url.searchParams.get('audience')==='following',canFollow:true}],nextCursor:null};
   else if(url.searchParams.has('picks'))result={items:[{id:'sport:cricket',label:'Cricket',kind:'selector',sport:'cricket',following:false,excluded:false},{id:'sport:tennis',label:'Tennis',kind:'selector',sport:'tennis',following:false,excluded:true}]};
   else if(url.searchParams.has('activity'))result={entries:[],nextCursor:null};
   else if(body.action==='copy-picks'){commands.push(body);result={added:body.items.length};}
   else if(body.action==='follow-user'){commands.push(body);result={following:body.following};}
   else if(url.searchParams.has('viewer'))result={viewer:{signedIn:true,profile:{handle:'qa',displayName:'QA'}}};
   else {status=503;result={error:'Test fixture: optional API unavailable'};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto(origin+'/?chatRoom=retired',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof openNothingscoreDrawer==='function'&&typeof NOTHINGSPORTS_YURTERS==='undefined');
  await page.evaluate(theme=>{closeSettings();userPreferences.theme=theme;applyThemePreference(theme);openNothingscoreDrawer();},theme);
  await page.getByText('Sam',{exact:true}).waitFor();
  assert.equal(await page.locator('#nothingscoreTitle').textContent(),'YURTERS');
  assert.equal(await page.locator('.yurters-tabs [aria-selected="true"]').textContent(),'Find Yurters');
  assert.equal(await page.locator('#chatDrawer,#activeChatsBtn').count(),0);
  assert.equal(new URL(page.url()).searchParams.has('chatRoom'),false);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ns_chat_draft_v2:old-room')),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390&&theme==='night'){
   await page.evaluate(async()=>{await serverSyncClient.signIn({email:'qa@example.invalid',password:'test-only-password'});serverPersistence.user={id:'11111111-1111-4111-8111-111111111111'};serverPersistence.state='signedIn';syncCurrentServerState=async()=>{};reconcileCurrentServerState=async()=>{};await NOTHINGSPORTS_YURTERS.render();});
   assert.equal(await page.locator('.yurters-tabs [aria-selected="true"]').textContent(),'Following');
   await page.getByRole('button',{name:'See / copy follows',exact:true}).click();
   await page.getByRole('button',{name:'Select visible picks',exact:true}).click();
   const checks=page.locator('.nsc-picks-list input');assert.equal(await checks.nth(0).isChecked(),true);assert.equal(await checks.nth(1).isChecked(),false);
   await checks.nth(1).check();await page.getByRole('button',{name:'Follow their picks',exact:true}).click();await page.getByText('2 picks added.',{exact:true}).waitFor();
   assert.deepEqual(commands.at(-1).overrideIds,['sport:tennis']);assert.equal(commands.at(-1).items.length,2);
   assert(!/points|efficiency|reward/i.test(await page.locator('#nothingscoreBody').innerText()));
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.evaluate(()=>openSettings({section:'notifications'}));await page.locator('#socialAlertsEnabled').waitFor();
   assert.equal(await page.locator('#chatAlertsEnabled,#testChatSoundBtn').count(),0);
   assert(!/bonus points|incoming chat/i.test(await page.locator('#settingsBody').innerText()));
  }
  assert.deepEqual(errors,[],width+' '+theme+' has no browser exceptions');
  await page.close();
 }
 console.log('sySTRATEGY browser: guest/account YURTERS, selected additive copy/exclusions, retired links and four widths/two themes passed.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
