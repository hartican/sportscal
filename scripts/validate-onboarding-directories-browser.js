#!/usr/bin/env node
'use strict';
// Disposable loopback-only generated-app QA. No live accounts or provider writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.ONBOARDING_SOURCE_ROOT||path.join(__dirname,'..'));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
const sports=[['afl','AFL'],['nrl','NRL'],['cricket','Cricket'],['football','Football'],['tennis','Tennis Men'],['f1','Formula 1'],['wrc','WRC'],['supercars','V8 Supercars'],['motogp','MotoGP'],['rugby','Rugby Union']];
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const engine of (process.env.ONBOARDING_QA_ENGINE?[process.env.ONBOARDING_QA_ENGINE]:['chromium','webkit'])){
      const browser=await playwright[engine].launch({headless:true});
      try{
        for(const width of [390,1280]){
          const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],mutations=[];
          page.on('pageerror',error=>errors.push(error.message));
          await page.route('**/*',route=>{
            const req=route.request(),url=new URL(req.url());
            if(url.hostname!=='127.0.0.1')return route.abort();
            if(url.pathname.startsWith('/api/')){if(!['GET','HEAD'].includes(req.method()))mutations.push({method:req.method(),path:url.pathname});return route.fulfill({status:503,json:{error:'Isolated onboarding QA'}});}
            return route.continue();
          });
          await page.goto(base);await page.locator('#startupSportsGrid').waitFor();
          assert.equal(await page.evaluate(()=>typeof globalThis.NOTHINGSPORTS_PARTICIPANT_DIRECTORY),'undefined','cold startup must not assume Follow already loaded its helper');
          for(const [,label] of sports)await page.locator('#startupSportsGrid').getByLabel(label,{exact:true}).check();
          await page.getByRole('button',{name:'Choose teams',exact:true}).click();
          const choices=page.locator('#onboardingTeamChoices'),counts={};
          for(const [sport] of sports){
            await page.locator('#onboardingSportChoices [data-sport="'+sport+'"]').click();
            await page.waitForFunction(()=>document.getElementById('onboardingTeamChoices')?.getAttribute('aria-busy')==='false');
            assert(!/could not load/i.test(await choices.innerText()),sport+' must load on cold onboarding');
            counts[sport]=await choices.locator('input[type=checkbox]').count();
            if(sport==='supercars'){
              assert.equal(counts[sport],0);assert.equal(await choices.locator('input[type=search]').count(),0);
              assert(!/No matches/.test(await choices.innerText()));assert.match(await choices.innerText(),/schedule/i);
            }else assert(counts[sport]>0,sport+' must offer choices');
            if(sport==='motogp')assert.match(await choices.innerText(),/individual competitors/);
          }
          // Selection persists through back/forward without adding unrelated follows.
          await page.locator('#onboardingSportChoices [data-sport=afl]').click();
          await page.waitForFunction(()=>document.getElementById('onboardingTeamChoices')?.getAttribute('aria-busy')==='false');
          const before=await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph.entityFollows));
          const first=choices.locator('input[type=checkbox]').first();await first.check();
          const selected=await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph.entityFollows));assert.notEqual(selected,before);
          await page.locator('#settingsBackBtn').click();await page.locator('#startupSportsGrid').waitFor();
          await page.getByRole('button',{name:'Choose teams',exact:true}).click();
          await page.waitForFunction(()=>document.getElementById('onboardingTeamChoices')?.getAttribute('aria-busy')==='false');
          assert.equal(await choices.locator('input[type=checkbox]').first().isChecked(),true);
          assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph.entityFollows)),selected);
          await choices.locator('input[type=search]').fill('no such fixture team 700000');assert.match(await choices.innerText(),/No matches/);
          await page.getByRole('button',{name:'Show my Feed',exact:true}).click();
          await page.waitForFunction(()=>!document.getElementById('settingsModal').classList.contains('show'));
          assert.equal(await page.evaluate(()=>userPreferences.onboardingComplete),true);
          assert.equal(await page.evaluate(()=>JSON.stringify(userPreferences.preferenceGraph.entityFollows)),selected);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          assert.deepEqual(errors,[]);assert.deepEqual(mutations,[],'guest onboarding must not attempt account mutations');
          console.log(JSON.stringify({engine,width,counts,coldHelperLoaded:true,selectionRetained:true,guestComplete:true,liveRequests:0}));
          await page.close();
        }
      }finally{await browser.close();}
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
