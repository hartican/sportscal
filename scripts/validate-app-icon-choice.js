'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),policy=require('../config/app-icon-choice');
async function main(){
 for(const points of [0,99])assert.equal(policy.capability(points).canChooseIcon,false);
 for(const points of [100,101,500])assert.equal(policy.capability(points).canChooseIcon,true);
 for(const points of [NaN,Infinity,'101',null])assert.equal(policy.capability(points).canChooseIcon,false);
 const server=require('../lib/nothingscore-server'),supa=require('../lib/supabase-server');
 const oldRows=server.rows,oldUser=supa.authenticatedUser;
 let balance=99,queries=0,lastQuery;
 const owner='00000000-0000-4000-8000-000000000101';
 server.rows=async(table,q)=>{assert.equal(table,server.TABLES.points);assert.equal(q.user_id,`eq.${owner}`);assert.equal(q.limit,'100');assert.equal(q.select,'points');queries++;lastQuery=q;return [...Array.from({length:Math.floor(balance/25)},()=>({points:25})),...(balance%25?[{points:balance%25}]:[])];};
 let user={id:owner,is_anonymous:false};supa.authenticatedUser=async()=>user;
 delete require.cache[require.resolve('../lib/nothingscore-handler')];
 const handler=require('../lib/nothingscore-handler');
 async function request(){let payload,status,headers={};await handler({method:'GET',url:'/api/nothingscore?icon=1&user_id=ignored',headers:{authorization:'Bearer local-fixture'}},{setHeader(k,v){headers[k]=v;},status(n){status=n;return this;},json(v){payload=v;return this;}});return{payload,status,headers};}
 try{
  let r=await request();assert.equal(r.status,200);assert.equal(r.payload.canChooseIcon,false);assert.match(r.headers['Cache-Control'],/private, no-store/);
  balance=100;r=await request();assert.equal(r.payload.canChooseIcon,true);assert(!('points'in r.payload));
  user={...user,is_anonymous:true};const before=queries;r=await request();assert.equal(r.status,401);assert.equal(queries,before);
 }finally{server.rows=oldRows;supa.authenticatedUser=oldUser;delete require.cache[require.resolve('../lib/nothingscore-handler')];}
 const {readInlineOwner}=require('./app-shell-test-utils');
 const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sync=readInlineOwner('syncThemeBrandAssets',source);
 const registry=source.match(/const BRAND_ASSETS[\s\S]*?(?=function syncBrandCopy)/)?.[0];assert(registry);
 assert(fs.readFileSync(path.join(root,'config/archive-settings-ui.js'),'utf8').includes('APP_ICON_SETTINGS.menu(body)'));
 assert(fs.readFileSync(path.join(root,'config/fantasy-deadline-ui.js'),'utf8').includes('APP_ICON_SETTINGS.appearance(stack)'));
 const harness=()=>`<!doctype html><html><head><link rel="icon" href="/icons/nothingsport-app-32.png"><link rel="apple-touch-icon" href="/icons/nothingsport-app-180.png"><link rel="manifest" href="/manifest.webmanifest"></head><body><img id="liveIcon" data-brand-asset="icon"><div id="settingsModal" class="show"><main id="body"><div class="settings-menu"><button data-settings-section="appearance">Appearance</button></div></main></div><script>
window.__points=Number(new URL(location.href).searchParams.get('points')||0);window.__owner='fixture';window.__generation=1;window.__hold=false;window.__release=null;
window.serverSyncClient={accountSnapshot:()=>({hasSession:!!window.__owner,accountId:window.__owner,generation:window.__generation}),nothingscoreRequest:async q=>{if(!q.icon)throw Error('Unexpected read');if(window.__hold)await new Promise(resolve=>window.__release=resolve);return {canChooseIcon:window.__points>=100,minimumPoints:100};}};
window.readStorage=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
window.draftPreferences={theme:'night'};window.settingsViewportAnchor={};window.settingsSection='main';window.userPreferences={theme:'night'};window.syncThemeTeamAssets=()=>{};window.syncThemeEventAssets=()=>{};
${registry}${sync}
window.applyThemePreference=()=>syncThemeBrandAssets(true);
window.navigateSettingsSection=()=>{window.settingsSection='appearance';const body=document.getElementById('body');body.replaceChildren();NOTHINGSPORTS_APP_ICON_SETTINGS.appearance(body);};
</script><script src="/config/app-icon-choice.js"></script><script src="/config/app-icon-settings-ui.js"></script><script>applyThemePreference();NOTHINGSPORTS_APP_ICON_SETTINGS.menu(document.getElementById('body'));</script></body></html>`;
 const local=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local');if(url.pathname==='/__icons'){res.setHeader('Content-Type','text/html');res.end(harness());return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.webmanifest')?'application/manifest+json':'image/png');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>local.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${local.address().port}`;
 const pw=require('playwright'),results=[];
 try{for(const name of ['chromium','webkit']){
  const browser=await pw[name].launch({headless:true});
  try{const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
   for(const points of [0,99]){await page.goto(`${origin}/__icons?points=${points}`);const button=page.locator('.app-icon-action');await page.waitForFunction(()=>document.querySelector('.app-icon-action .settings-menu-copy span')?.textContent.includes('100 NothingScore'));assert.equal(await button.getAttribute('aria-disabled'),'true');await button.hover();assert(await page.locator('[role="tooltip"]').isVisible());const box=await button.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);assert.equal(await page.locator('[data-icon-choice]').count(),0);}
   await page.goto(`${origin}/__icons?points=100`);await page.waitForFunction(()=>document.querySelector('.app-icon-action')?.getAttribute('aria-disabled')==='false');await page.locator('.app-icon-action').click();await page.waitForFunction(()=>document.querySelectorAll('[data-icon-choice]').length===8);
   for(const v of policy.VARIANTS){await page.locator(`[data-icon-choice="${v.id}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-icon-choice="${id}"]`)?.getAttribute('aria-pressed')==='true',v.id);assert((await page.locator('#liveIcon').getAttribute('src')).endsWith(`${v.id}-192.png`));assert((await page.locator('link[rel="icon"]').getAttribute('href')).endsWith(`${v.id}-n-32.png`));const manifest=await page.locator('link[rel="manifest"]').getAttribute('href');const value=await (await page.request.get(origin+manifest)).json();assert.equal(value.id,'/');assert.equal(value.start_url,'/');}
   await page.reload();assert((await page.locator('#liveIcon').getAttribute('src')).includes('monochrome-white'));
   await page.waitForFunction(()=>document.querySelector('.app-icon-action')?.getAttribute('aria-disabled')==='false');await page.locator('.app-icon-action').click();await page.waitForFunction(()=>document.querySelectorAll('[data-icon-choice]').length===8);
   await page.evaluate(()=>window.__hold=true);await page.locator('[data-icon-choice="inverted"]').click();await page.waitForFunction(()=>!!window.__release);await page.evaluate(()=>{window.__owner='another-fixture';window.__generation++;window.__points=0;window.__release();});await page.waitForFunction(()=>document.querySelector('.icon-choice-grid')?.dataset.saving==='false');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nsIcon'))),'monochrome-white');
   results.push({engine:name,passed:true,locked:[0,99],unlocked:100,variants:8,persistence:true,staleAccountRejected:true});await context.close();
  }finally{await browser.close();}
 }}finally{await new Promise(resolve=>local.close(resolve));}
 console.log(JSON.stringify({passed:true,serverQueries:queries,boundedLedgerRows:lastQuery.limit,results}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
