'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=process.env.HIGHLIGHTS_NAVIGATION_EVIDENCE_DIR||'/tmp/highlights-navigation';
const fixture=require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026');
assert.equal(fixture.status,'completed');
const panel=fs.readFileSync(path.join(root,'config/venue-panel-ui.js'),'utf8');
const launch=panel.slice(panel.indexOf('function configureProviderLaunch('),panel.indexOf('function viewingAccessLabel('));
assert(launch.startsWith('function configureProviderLaunch('));
const version=JSON.parse(fs.readFileSync(path.join(root,'app-version.json'))).version;
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="app-shell-version" content="'+version+'"><title>Installed highlights navigation rehearsal</title><h1>Fixture</h1><a class="fixture-highlights-link">Watch highlights</a><script src="/config/epic-classics.js"></script><script src="/config/fixture-highlights.js"></script><script>'+launch+';configureProviderLaunch(document.querySelector("a"),NOTHINGSPORTS_FIXTURE_HIGHLIGHTS.viewing('+JSON.stringify(fixture)+'));navigator.serviceWorker.register("/service-worker.js");</script>';
let outcome='unavailable',apiRequests=0,videoOrigin,networkFailure=false;
const videoServer=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Selected video destination</h1>');});
const types={'.js':'application/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  if(networkFailure){req.socket.destroy();return;}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/fixtures'){
    apiRequests++;assert.equal(url.searchParams.get('ids'),fixture.id);
    if(outcome==='unavailable')return require('../lib/youtube-top-result').unavailable({setHeader:(k,v)=>res.setHeader(k,v),status(s){res.statusCode=s;return this;},end:v=>res.end(v)},503,{fixtureId:fixture.id});
    if(outcome==='not-found'){res.writeHead(404,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end('<h1>Waiting for a fixture update</h1>');}
    if(outcome==='redirect'){res.writeHead(302,{Location:videoOrigin+'/selected-video','Cache-Control':'no-store'});return res.end();}
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end('<h1>Highlights response</h1>');
  }
  if(url.pathname==='/selected-video'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<h1>Selected video destination</h1>');}
  if(url.pathname==='/service-worker.js'&&process.env.HIGHLIGHT_WORKER_BASELINE_SHA){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});return res.end(execFileSync('git',['show',process.env.HIGHLIGHT_WORKER_BASELINE_SHA+':service-worker.js'],{cwd:root}));}
  if(url.pathname==='/'||url.pathname==='/index.html'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end(html);}
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
  fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(err?'':bytes);});
});
async function run(){
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>videoServer.listen(0,'127.0.0.1',resolve));videoOrigin='http://127.0.0.1:'+videoServer.address().port;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,runs=[];
  try{for(const engine of ['chromium','webkit']){
    const browser=await pw[engine].launch();
    try{
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);assert.deepEqual(errors,[]);await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
      const before=await page.evaluate(async()=>{localStorage.setItem('navigation-test-choice','retained');return (await caches.match('/index.html')).text();});
      assert.equal(before,html);
      for(const state of ['unavailable','not-found','success','redirect']){
        outcome=state;const count=apiRequests;
        const popupPromise=page.waitForEvent('popup');await page.locator('.fixture-highlights-link').click();const popup=await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
        const body=await popup.locator('body').innerText();await popup.screenshot({path:path.join(out,engine+'-'+state+'.png')});assert(!body.includes('Preparing your Feed'));
        assert.equal(apiRequests,count+1,'One actual resolver navigation per tap');
        assert.match(body,{unavailable:/Highlights unavailable right now/, 'not-found':/Waiting for a fixture update/,success:/Highlights response/,redirect:/Selected video destination/}[state]);
        if(state==='unavailable'){assert.equal(await popup.locator('a').getAttribute('href'),'/?event='+fixture.id);await popup.screenshot({path:path.join(out,engine+'-feedback.png')});}
        const after=await page.evaluate(async()=>({shell:await (await caches.match('/index.html')).text(),choice:localStorage.getItem('navigation-test-choice')}));
        assert(after.shell===before,'Resolver HTML and external redirects never poison the Feed shell');assert.equal(after.choice,'retained');
        runs.push({engine,state,actualTap:true,apiRequests:apiRequests-count,feedShellUnchanged:true,pass:true});await popup.close();
      }
      // Exercise origin failure at the transport boundary: WebKit's offline
      // emulation can reject before dispatching the worker navigation.
      networkFailure=true;await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.title(),'Installed highlights navigation rehearsal');assert.equal(await page.locator('.fixture-highlights-link').count(),1);networkFailure=false;await context.close();
    }finally{await browser.close();}
  }}finally{await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>videoServer.close(resolve))]);}
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({checkedAt:new Date().toISOString(),fixture:fixture.id,scope:'Real contract/provider launch and installed service worker; controlled resolver outcomes; no provider or customer writes',runs},null,2)+'\n');
  console.log('Installed highlights taps: '+runs.length+' Chromium/WebKit error, success and redirect cases; shell cache and offline restart preserved.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
