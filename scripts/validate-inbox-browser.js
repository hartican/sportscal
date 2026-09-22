'use strict';
const assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function main(){
 const browser=await chromium.launch({headless:true});
 try{for(const width of [320,390,430,768,1280]){
  const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('Inbox refresh'))console.log(m.text());});
  const account='11111111-1111-4111-8111-111111111111',token='x.'+Buffer.from(JSON.stringify({sub:account})).toString('base64url')+'.x';
  const seen=[],items=Array.from({length:25},(_,i)=>({id:`22222222-2222-4222-8222-${String(i).padStart(12,'0')}`,kind:i===0?'chat':'points',points:1,version:1,read:false,at:new Date(Date.now()-i*60000).toISOString(),messageCount:3,roomName:'Australia v India',sender:'Amy',preview:'Australia won by 8 wickets',detail:'heat_rating'}));
  await page.addInitScript(({token})=>{localStorage.setItem('ns_auth_persistent_session_v1',JSON.stringify({accessToken:token,refreshToken:'test',expiresAt:Date.now()+3600000}));},{token});
  await page.route('**/api/**',async route=>{
   if(route.request().url().includes('/api/inbox')){
    if(route.request().method()==='POST'){seen.push(...route.request().postDataJSON().seen);return route.fulfill({json:{ok:true}});}
    return route.fulfill({json:{items,unreadCount:25,nextCursor:null}});
   }
   if(route.request().url().includes('/api/auth'))return route.fulfill({json:{configured:true,user:{id:account},session:{access_token:token,refresh_token:'test',expires_in:3600}}});
   if(route.request().url().includes('/api/nothingscore'))return route.fulfill({json:{points:25,settlements:[],entries:[],privileges:[]}});
   return route.fulfill({status:503,json:{error:'Test fixture: service offline'}});
  });
  await page.goto(process.env.INBOX_QA_URL||'http://127.0.0.1:33966');await page.waitForFunction(()=>typeof notificationsInbox!=='undefined');
  await page.evaluate(()=>{document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(x=>x.classList.remove('show'));});
  const geometry=await page.evaluate(()=>Object.fromEntries(['settingsBtn','calendarSyncBtn','shareAppBtn','notificationsBtn'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
  assert(Math.abs(geometry.settingsBtn.y-geometry.shareAppBtn.y)<5);assert(geometry.settingsBtn.x<geometry.calendarSyncBtn.x&&geometry.calendarSyncBtn.x<geometry.shareAppBtn.x);
  assert(geometry.notificationsBtn.width>=44);assert(geometry.settingsBtn.height>=44);
  await page.evaluate(({token})=>serverSyncClient.signIn('test@example.test','test'),{token});
  await page.evaluate(()=>history.replaceState({appRoute:'notifications',inbox:true},''));
  await page.locator('#notificationsBtn').click();try{await page.waitForSelector('.notification-row',{timeout:5000});}catch(e){console.log(await page.evaluate(()=>({owner:serverSyncClient.sessionSubject(),method:typeof serverSyncClient.inboxRequest,html:document.getElementById('notificationsInbox').outerHTML})),errors);throw e;}await page.waitForTimeout(450);
  const rect=await page.locator('#notificationsInbox').boundingBox();assert.equal(rect.height,844);assert.equal(Math.round(rect.width),width<=640?width:480);
  assert((await page.locator('.notification-row').first().innerText()).includes('3 new messages'));assert(!(await page.locator('.notification-row').first().innerText()).includes('won by'));
  assert(seen.length>0&&seen.length<25,'only visible notifications marked read');
  await page.evaluate(()=>{userPreferences.showSpoilers=true;});await page.evaluate(()=>notificationsInbox.refresh());
  assert((await page.locator('.notification-row').first().innerText()).includes('Australia won'));
  await page.locator('.notifications-body').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(450);assert(seen.length>5);
  if(width===390){
   await page.screenshot({path:'/tmp/ns-notifications-inbox-open.png'});
   const previous=await page.locator('.notifications-body').evaluate(e=>e.scrollTop);
   await page.locator('.notification-row').last().click();await page.waitForSelector('.calendar-dialog[open]');
   assert((await page.locator('.calendar-dialog[open]').innerText()).includes('25 points'));
   await page.getByRole('button',{name:'Back to notifications'}).click();await page.waitForSelector('#notificationsInbox[open]');
   assert(Math.abs(await page.locator('.notifications-body').evaluate(e=>e.scrollTop)-previous)<5,'Back restores inbox position');
   await page.evaluate(()=>serverSyncClient.signOut());await page.waitForTimeout(100);
   assert.equal(await page.locator('.notification-row').count(),0,'sign out clears private inbox');
   assert((await page.locator('#notificationsInbox').innerText()).includes('Sign in'));
  }
  await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await page.locator('#notificationsInbox').evaluate(e=>e.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'notificationsBtn');
  if(width===390)await page.screenshot({path:'/tmp/ns-notifications-inbox-mobile.png'});
  assert.equal(errors.filter(x=>/notifications|inbox/i.test(x)).length,0,errors.join('\n'));await page.close();
 }
 console.log('Inbox browser: five widths, header alignment, modal geometry, visible read batching, preview spoiler rules and focus passed.');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
