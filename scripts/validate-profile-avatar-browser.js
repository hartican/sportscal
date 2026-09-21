#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),sharp=require('sharp');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 let uploaded=0,failUpload=false;
 const root=process.cwd();
 const server=http.createServer((req,res)=>{if(req.url==='/avatar-signed'){uploaded=0;req.on('data',chunk=>{uploaded+=chunk.length;});req.on('end',()=>{res.writeHead(failUpload?500:200,{'Content-Type':'application/json'});res.end('{}');});return;}const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(bytes);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const thumb=await sharp({create:{width:128,height:128,channels:3,background:'#ca40ee'}}).webp().toBuffer();
 const full=await sharp({create:{width:512,height:512,channels:3,background:'#ca40ee'}}).webp().toBuffer();
 const pictureUrl=base+'/nothingsports-avatar-thumbnails/test.webp';
 try{
 for(const [engine,width] of [[chromium,1280],[webkit,390]]){
  const browser=await engine.launch({headless:true,...(engine===webkit&&process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})});
  try{
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});const page=await context.newPage();
   let allow=true,expandCount=0;uploaded=0;failUpload=false;
   await page.addInitScript(()=>{
    const token='header.'+btoa(JSON.stringify({sub:'11111111-1111-4111-8111-111111111111'}))+'.signature';
    sessionStorage.setItem('ns_auth_session_v1',JSON.stringify({accessToken:token,refreshToken:'test-refresh',expiresAt:Date.now()+3600000}));
    window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revoked.push(url);revoke(url);};
   });
   await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());let body={};try{body=req.postDataJSON()||{};}catch(_){}
    if(url.pathname==='/api/nothingscore'){
     if(url.searchParams.has('avatarExpanded')){expandCount++;return route.fulfill({status:allow?200:403,contentType:allow?'image/webp':'application/json',body:allow?full:JSON.stringify({error:'Access revoked.'}),headers:{'Cache-Control':'private, no-store'}});}
     if(body.action==='profile-avatar-access')return route.fulfill({json:{avatars:allow?[{avatarUrl:pictureUrl,profileId:'22222222-2222-4222-8222-222222222222'}]:[]}});
     if(body.action==='profile-avatar-prepare')return route.fulfill({json:{uploadId:'33333333-3333-4333-8333-333333333333',uploadUrl:base+'/avatar-signed'}});
     if(body.action==='profile-avatar-complete')return route.fulfill({json:{avatarUrl:pictureUrl}});
    }
    return route.fulfill({status:503,json:{error:'QA isolation'}});
   });
   await page.route('**/nothingsports-avatar-thumbnails/**',route=>route.fulfill({contentType:'image/webp',body:thumb}));
   await page.goto(base);await page.waitForFunction(()=>typeof buildPublicProfileAvatarEditor==='function');
   await page.evaluate(url=>{
    document.querySelectorAll('.modal,.overlay').forEach(n=>n.remove());const host=document.createElement('div');host.id='avatar-qa';host.style='position:fixed;inset:0;z-index:999999;padding:20px;background:#101016;overflow:auto';
    const avatar=chatAvatarElement({avatarUrl:url,displayName:'Test Owner',className:'public-profile-avatar-preview'});avatar.id='qa-avatar';
    window.qaEditor=buildPublicProfileAvatarEditor({displayName:'Test Owner'});host.append(avatar,qaEditor.element);document.body.append(host);
   },pictureUrl);
   await page.waitForSelector('#qa-avatar[role=button]');assert.equal(expandCount,0,'expanded image is fetched only when opened');
   await page.locator('#qa-avatar').focus();await page.keyboard.press('Enter');await page.waitForSelector('.profile-avatar-dialog img');
   assert.equal(expandCount,1);assert.equal(await page.locator('.profile-avatar-dialog img').getAttribute('width'),'512');
   await page.keyboard.press('Escape');await page.waitForSelector('.profile-avatar-dialog',{state:'detached'});
   assert.equal(await page.evaluate(()=>document.activeElement.id),'qa-avatar');assert((await page.evaluate(()=>window.revoked)).some(x=>x.startsWith('blob:')));
   allow=false;await page.locator('#qa-avatar').click();await page.getByText('Access revoked.').waitFor();assert.equal(await page.locator('.profile-avatar-dialog img').count(),0);await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.evaluate(url=>{const stranger=chatAvatarElement({avatarUrl:url,displayName:'Stranger',className:'public-profile-avatar-preview'});stranger.id='qa-stranger';document.getElementById('avatar-qa').append(stranger);},pictureUrl);
   await page.waitForTimeout(250);assert.equal(await page.locator('#qa-stranger').getAttribute('role'),null);
   const input=page.locator('#avatar-qa input[type=file]');assert.match(await input.getAttribute('accept'),/\.heic.*\.tiff/);
   await input.setInputFiles({name:'iphone.heic',mimeType:'image/heic',buffer:fs.readFileSync('scripts/fixtures/avatars/libheif-example.heic')});
   await page.evaluate(()=>{
    const original=NOTHINGSPORTS_APP_UPDATE;window.avatarUploadHolds=0;
    window.NOTHINGSPORTS_APP_UPDATE={...original,holdWrite(){window.avatarUploadHolds++;const done=original.holdWrite();return ()=>{window.avatarUploadHolds--;done();};}};
   });
   const result=await page.evaluate(()=>qaEditor.upload());assert.equal(result.avatarUrl,pictureUrl);assert(uploaded>0);assert.equal(await page.evaluate(()=>window.avatarUploadHolds),0);
   failUpload=true;const failed=await page.evaluate(async()=>{try{await qaEditor.upload();return '';}catch(e){return e.message;}});assert.match(failed,/upload failed/);assert.equal(await input.evaluate(n=>n.files.length),1,'retry retains selected file');assert.equal(await input.isEnabled(),true);assert.equal(await page.evaluate(()=>window.avatarUploadHolds),0);
   await input.setInputFiles({name:'too-big.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(6000001)});
   assert.match(await page.evaluate(async()=>{try{await qaEditor.upload();return '';}catch(e){return e.message;}}),/6 MB/);
   if(process.env.AVATAR_SCREENSHOT_DIR){fs.mkdirSync(process.env.AVATAR_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.AVATAR_SCREENSHOT_DIR,`profile-avatar-${width}.png`)});}
   console.log(`${engine===webkit?'WebKit mobile':'Chromium desktop'}: upload, retry, formats, size, lazy expansion, denial, keyboard focus and blob cleanup passed.`);
  }finally{await browser.close();}
 }
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
