'use strict';
// Actual shared action owner and UMD formatter in real browser engines.
// Controlled destination only: this must never contact YouTube or the API.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {cricket,now,direct}=require('./validate-highlight-search-fallback');
const contract=require('../config/fixture-highlights'),root=path.resolve(__dirname,'..');
const panel=fs.readFileSync(path.join(root,'config/venue-panel-ui.js'),'utf8');
const owner=panel.slice(panel.indexOf('function configureProviderLaunch('),panel.indexOf('function renderEventIdentityMark('));
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Highlights action rehearsal</title><div id="fixture"></div><script src="/config/epic-classics.js"></script><script src="/config/fixture-highlights.js"></script><script>'+`
  Date.now=()=>${+now};
  var activeTab='feed',userPreferences={followFirst:{}};
  var FOLLOW_FIRST={viewingOptions:()=>[],VIEWING_PROVIDERS:{youtube:{label:'YouTube'}}};
  function buildViewingProviderMark(){const mark=document.createElement('span');mark.textContent='YouTube';return mark;}
  function recordCodeAffinity(){throw Error('Highlights must not write affinity');}
  ${owner}
  function render(event){const host=document.querySelector('#fixture');host.replaceChildren();appendEventQuickActions(host,event,{reminder:false,chat:false,highlightsOnly:true});}
  localStorage.setItem('saved-choice','unchanged');
  render(${JSON.stringify(cricket)});
</script>`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
  if(!['/config/epic-classics.js','/config/fixture-highlights.js'].includes(url.pathname)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':'application/javascript'});res.end(fs.readFileSync(path.join(root,url.pathname)));
});
async function main(){
  const runs=[];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{for(const mode of ['desktop','safari','home-screen']){
    const engine=mode==='desktop'?'chromium':'webkit',browser=await pw[engine].launch();
    try{
      const context=await browser.newContext(mode==='desktop'?{viewport:{width:1280,height:900}}:{...pw.devices['iPhone 13']});
      if(mode==='home-screen')await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));
      let external=0,api=0;const destinations=[];
      await context.route('https://www.youtube.com/**',r=>{external++;destinations.push(r.request().url());return r.fulfill({contentType:'text/html',body:'<h1>Controlled YouTube destination</h1>'});});
      await context.route('**/api/**',r=>{api++;return r.abort();});
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      for(const patch of [{},{name:'A&B / São Paulo #1? v O’Connor + 50% <team>',competitionName:'Cup & mode=evil'},{matchDay:3}]){
        const event={...cricket,...patch};await page.evaluate(event=>render(event),event);
        const link=page.locator('.fixture-highlights-link');assert.equal(await link.count(),1);assert.match(await link.innerText(),/Search YouTube/);assert.match(await link.getAttribute('aria-label'),/Search YouTube/);assert.equal(await link.getAttribute('href'),contract.searchResultsUrl(event,now));assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);
        let destination;
        if(mode==='desktop'){
          const opened=page.waitForEvent('popup');await link.click();destination=await opened;
        }else{
          // Local WebKit exposes no popup/request for YouTube, even from a
          // plain anchor; the native handoff is unobserved. Capture after the
          // real handler, prevent default, then replay the exact URL through
          // controlled navigation. This is not native-handoff proof.
          await link.evaluate(node=>node.addEventListener('click',e=>{globalThis.capturedSearch={prevented:e.defaultPrevented,href:node.href};e.preventDefault();},{once:true}));
          await link.tap();const captured=await page.evaluate(()=>globalThis.capturedSearch);assert.equal(captured.prevented,false,'the actual shared handler permits navigation');assert.equal(captured.href,contract.searchResultsUrl(event,now));
          destination=await context.newPage();await destination.goto(captured.href);
        }
        await destination.waitForLoadState('domcontentloaded');assert.equal(destination.url(),contract.searchResultsUrl(event,now));assert.equal(await destination.locator('h1').innerText(),'Controlled YouTube destination');await destination.close();
      }
      const f1={...cricket,key:'f1',codeId:'sport:f1',name:'Mexico City GP',stage:'Race',highlights:direct};await page.evaluate(event=>render(event),f1);const verified=page.locator('.fixture-highlights-link');assert.match(await verified.innerText(),/Watch highlights/);assert.match(await verified.getAttribute('href'),/^\/api\/fixtures\?mode=highlight&ids=/,'direct F1 retains its existing protected route');
      assert.equal(api,0,'fallback taps never enter a resolver or spend quota');assert.equal(external,3);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('saved-choice')),'unchanged');
      runs.push({mode,engine,searchActions:external,navigation:mode==='desktop'?'actual-popup':'actual-click-handler-and-exact-URL-replay',apiRequests:api,encodedDestinations:destinations,directF1Preserved:true,pass:true});await context.close();
    }finally{await browser.close();}
  }}finally{await new Promise(resolve=>server.close(resolve));}
  if(process.env.HIGHLIGHTS_EVIDENCE_DIR){fs.mkdirSync(process.env.HIGHLIGHTS_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.HIGHLIGHTS_EVIDENCE_DIR,'search-fallback-browser.json'),JSON.stringify({scope:'Local component with real shared owner; three Chromium popup clicks, six emulated iPhone/standalone WebKit click-handler and URL replays. Local WebKit native YouTube handoff is unobserved; physical Home Screen remains untested. No live YouTube claim.',runs},null,2)+'\n');}
  console.log('Highlights actions: three Chromium popup clicks, six iPhone/standalone WebKit click-handler and URL replays, zero API requests; direct F1 route and saved choices preserved. Native iPhone handoff remains separate.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
