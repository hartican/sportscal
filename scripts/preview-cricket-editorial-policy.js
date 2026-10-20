'use strict';
// Offline review/test harness. It never runs canonical refresh or publication.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),policy=require('../config/cricket-editorial-policy');
const samples=require('./fixtures/cricket-editorial-policy-20261020').samples;
const {apply}=require('./apply-fixture-research');
function buildSamples(){
  const packet=samples();
  packet.cases=packet.cases.map(sample=>{
    const knowledge={schemaVersion:'editorial-knowledge.v2',updatedAt:packet.now,subjects:[],sources:[],narrativeFacts:[],narrativeThreads:[],audienceMemories:[],eventProjections:[]};
    const result=apply(knowledge,{events:[structuredClone(sample.event)]},{events:[]},{entries:[sample.entry]},[],{now:new Date(packet.now)});
    return {...sample,event:result.feed.events[0],knowledge};
  });
  return packet;
}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function main(){
  const index=process.argv.indexOf('--output');
  const output=path.resolve(index>=0?process.argv[index+1]:'/Users/jackhartican/Documents/AI/Codex/cricket-editorial-policy-20261020');
  assert(output!==root&&!output.startsWith(root+path.sep),'Review output belongs outside the checkout.');
  fs.mkdirSync(output,{recursive:true});
  const packet=buildSamples(),before=process.hrtime.bigint();
  let initialSampleApproved=false;
  try{require('./lib/cricket-editorial-evidence').assertPublicationApproved(packet.cases.map(sample=>sample.entry));initialSampleApproved=true;}
  catch(error){if(!/Initial cricket sample approval is pending/.test(error.message))throw error;}
  packet.approval={initialSampleApproved,productionAcceptance:'not established by this local preview',withheldExample:'Fallback structure only; not a researched finding that ODI reporting was unavailable'};
  const runtime=require('./build-app-shell-runtime').build(),buildMs=Number(process.hrtime.bigint()-before)/1e6;
  const metrics=require('./validate-feed-performance').criticalAssetMetrics(),stored=fs.readFileSync(path.join(root,'assets/js/app-shell-runtime.js'));
  const criticalGzip=metrics.gzipBytes-zlib.gzipSync(stored).length+zlib.gzipSync(runtime).length;
  const baseline=require('./validate-feed-performance').criticalAssetMetrics({ref:'e70de9a53543b0894ceaf6dbdff60569d47a9c87'});
  const limit=Math.floor(baseline.gzipBytes*1.0125);
  assert(criticalGzip<=limit,`Candidate compressed startup ${criticalGzip} exceeds unchanged ${limit} cap.`);
  const lifecycle=require('../config/editorial-lifecycle'),start=process.hrtime.bigint();
  for(let i=0;i<20000;i++)for(const sample of packet.cases)lifecycle.copy(sample.event,sample.event.editorialNarrative,true,new Date(packet.now));
  const localResolverMs=Number(process.hrtime.bigint()-start)/1e6;
  packet.cost={scope:'Added app/service work; existing local browser asset requests excluded',newNetworkRequests:0,newDatabaseReads:0,newModelApiCalls:0,newResearchSearches:0,newArticleReads:0,reusedPlanningSourceUrls:4,externalModelTokens:null,cashCostAUD:null,buildMs,localResolver:{calls:60000,totalMs:localResolverMs,microsecondsPerCall:localResolverMs/60},criticalGzip,unchangedGzipCap:limit,criticalRequests:metrics.requestCount,runtimeGzipDelta:zlib.gzipSync(runtime).length-zlib.gzipSync(stored).length};
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://local').pathname;
    if(name==='/assets/js/app-shell-runtime.js'){res.setHeader('Content-Type','text/javascript');res.end(runtime);return;}
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    try{const bytes=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port,{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  packet.browser=[];let blockedExternal=0;
  try{for(const [engine,type]of Object.entries({chromium,webkit})){
    const browser=await type.launch(engine==='chromium'?{channel:'chrome'}:{});
    try{for(const width of [390,1280]){
      const page=await browser.newPage({viewport:{width,height:1100},serviceWorkers:'block'}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base){blockedExternal++;return route.abort();}if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{}});return route.continue();});
      await page.addInitScript(version=>{localStorage.setItem('ns_preferences_v1',JSON.stringify({onboardingComplete:true,theme:'night'}));localStorage.setItem('ns_selector_release_ack_v1',JSON.stringify(version));},require('../config/selector-taxonomy').version);
      await page.goto(base);await page.waitForFunction(()=>typeof buildEventCard==='function'&&typeof buildEventWhyItMatters==='function'&&startupFunnelFinished&&!startupCoordinator.isHydrating(),{timeout:45000});
      for(const theme of ['night','day']){
        const proof=await page.evaluate(({cases,theme})=>{
          document.getElementById('startupLaunch')?.remove();document.querySelectorAll('.modal-backdrop').forEach(n=>n.classList.remove('show'));
          userPreferences.onboardingComplete=true;startupPostLoadHandled=true;userPreferences.theme=theme;closeSettings({restoreTheme:false,restoreViewport:false});closeSelectorOptInPrompt({restoreViewport:false});
          activeTab='feed';activeView='list';userPreferences.showSpoilers=true;userPreferences.feedControls={...userPreferences.feedControls,spoilers:'show'};applyThemePreference(theme);
          const list=document.getElementById('listView');list.replaceChildren();
          const checks=[];
          for(const sample of cases){
            const event=sample.event;setCardState(event,'opened');
            const card=buildEventCard(event);list.appendChild(card);
            const text=card.querySelector('.editorial-l0-hook'),copy=text?.textContent||'';
            if(text?.querySelector('.editorial-l0-hook-label'))throw Error('Cricket editorial contains a section label.');
            if(sample.entry.evidenceMode==='withheld'&&text)throw Error('Withheld case rendered filler.');
            const expected=[sample.entry.hook,sample.entry.formCopy,sample.entry.synopsis,sample.entry.closingCopy].filter(Boolean);
            for(const paragraph of expected)if(!copy.includes(paragraph))throw Error('Missing researched paragraph: '+sample.kind);
            userPreferences.showSpoilers=false;
            const off=buildEventWhyItMatters(event);
            if(sample.entry.editorialPhase==='ongoing'&&off)throw Error('Results OFF reveals current reporting.');
            userPreferences.showSpoilers=true;
            for(let i=0;i<3;i++){setCardState(event,'selected');buildEventWhyItMatters(event);setCardState(event,'opened');const again=buildEventWhyItMatters(event);if((again?.textContent||'')!==copy)throw Error('Repeated expansion changed editorial.');}
            const eventCard=buildEventCard(event,{mode:'events'});if((eventCard.querySelector('.editorial-l0-hook')?.textContent||'')!==copy)throw Error('Events and Feed differ.');
            const width=card.getBoundingClientRect().width,paragraphs=[...(text?.querySelectorAll('p')||[])];
            if(paragraphs.some(p=>p.scrollWidth>p.clientWidth+1))throw Error('Editorial paragraph overflow.');
            checks.push({kind:sample.kind,paragraphs:paragraphs.length,copy,width,sectionLabels:0,resultsOffSuppressed:sample.entry.editorialPhase==='ongoing'?!off:null});
          }
          return checks;
        },{cases:packet.cases.map(({kind,event,entry})=>({kind,event,entry})),theme});
        const file=`${engine}-${width}-${theme}.png`;
        const visibleState=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,modals:[...document.querySelectorAll('.modal-backdrop.show')].map(n=>({id:n.id,display:getComputedStyle(n).display})),pref:userPreferences.theme}));
        assert.equal(visibleState.theme,theme,'The actual requested theme must remain applied.');
        await page.evaluate(theme=>{userPreferences.onboardingComplete=true;userPreferences.theme=theme;closeSettings({restoreTheme:false,restoreViewport:false});closeSelectorOptInPrompt({restoreViewport:false});applyThemePreference(theme);},theme);
        await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme&&![...document.querySelectorAll('.modal-backdrop.show')].some(n=>getComputedStyle(n).display!=='none'),theme,{timeout:5000});
        await page.evaluate(()=>{const list=document.getElementById('listView');for(const n of document.querySelectorAll('body *'))if(!n.contains(list)&&!list.contains(n)&&['fixed','sticky'].includes(getComputedStyle(n).position)){n.dataset.previewDisplay=n.style.display;n.style.display='none';}});
        await page.locator('#listView img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode().catch(()=>{});})));
        await page.locator('#listView').screenshot({path:path.join(output,file)});
        await page.evaluate(()=>{for(const n of document.querySelectorAll('[data-preview-display]')){n.style.display=n.dataset.previewDisplay;delete n.dataset.previewDisplay;}});
        await page.context().setOffline(true);
        const replay=await page.evaluate(cases=>{
          const restored=JSON.parse(JSON.stringify(cases));
          for(const sample of restored){
            const event=sample.event;setCardState(event,'opened');
            const node=buildEventWhyItMatters(event),text=node?.textContent||'';
            const expected=[sample.entry.hook,sample.entry.formCopy,sample.entry.synopsis,sample.entry.closingCopy].filter(Boolean).join('');
            if(text!==expected)throw Error('Offline JSON replay differs.');
          }
          const old=restored[0].event;old.editorialNarrative={hook:'Old selection speculation',synopsis:'Old preview context',formCopy:'Neither is a confirmed selection.',closingCopy:'Moving its pieces.'};old.fullSpiel='Old fallback';old.selectedSentence='Old fallback';
          if(buildEventWhyItMatters(old)||storylineCopyForDisplay(old).hook||eventSpielForDisplay(old))throw Error('Legacy cache/cold pin resurrected preview copy.');
          return {offlineJsonReplay:true,legacyFallbackSuppressed:true};
        },packet.cases.map(({kind,event,entry})=>({kind,event,entry})));
        await page.context().setOffline(false);
        packet.browser.push({engine,width,theme,...replay,proof,screenshot:file,pageErrors:[...errors]});
        assert.equal(errors.length,0,'Application page errors: '+errors.join('; '));
        console.log(engine+' '+width+' '+theme+': three actual cards, Feed/Events, Results and repeated expansion passed.');
      }
      await page.close();
    }}finally{await browser.close();}
  }}finally{await new Promise(resolve=>server.close(resolve));}
  packet.blockedExternalRequests=blockedExternal;
  fs.writeFileSync(path.join(output,'sample-evidence.json'),JSON.stringify(packet,null,2)+'\n');
  const body=packet.cases.map(sample=>`<article><h2>${esc(sample.event.name)}</h2><p>${esc(sample.note)}</p>${policy.fields.map(field=>sample.entry[field]?`<p class="copy">${esc(sample.entry[field])}</p>`:'').join('')}${sample.entry.evidenceMode==='withheld'?`<p><strong>Editorial withheld.</strong> ${esc(sample.entry.withheldReason)}</p>`:''}<details><summary>Evidence ledger</summary><p>Mode: ${esc(sample.entry.evidenceMode)} · phase: ${esc(sample.entry.editorialPhase)} · valid until ${esc(sample.entry.validUntil)}</p>${sample.entry.sourceObservations.map(source=>`<p><a href="${esc(source.url)}">${esc(source.name)}</a> · ${esc(source.author)} · published ${esc(source.publishedAt)} · retrieved ${esc(source.retrievedAt)}</p>`).join('')}<pre>${esc(JSON.stringify(sample.entry.paragraphClaims,null,2))}</pre></details></article>`).join('');
  const images=packet.browser.map(run=>`<figure><figcaption>${esc(run.engine)} · ${run.width}px · ${esc(run.theme)} · Results ON; fixed app chrome hidden for the card capture</figcaption><a href="${run.screenshot}"><img src="${run.screenshot}" loading="lazy" alt="Actual cricket card samples"></a></figure>`).join('');
  fs.writeFileSync(path.join(output,'review.html'),`<!doctype html><html lang="en-AU"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cricket editorial sample review</title><style>body{max-width:1000px;margin:36px auto;padding:0 20px;font:17px/1.55 system-ui;color:#17212b;background:#f7f8fa}article{padding:24px;background:white;margin:24px 0;border:1px solid #d8dee4;border-radius:12px}.copy{font-size:19px}pre{white-space:pre-wrap;font-size:13px}img{max-width:100%;border:1px solid #ccd2d9}figure{margin:24px 0}a{color:#0057a0}</style><h1>Cricket editorial sample review</h1><p><strong>${initialSampleApproved?"Local candidate; sample structure approved, production acceptance pending.":"Local candidate; sample approval pending."}</strong> Retained journalistic evidence was checked during planning on 20 October. No additional source fetch, provider refresh or production write was performed. The attached Test uses the retained sporting snapshot. The withheld ODI is a fallback example, not a researched finding that current reporting was unavailable. These images are local browser evidence; production and phone acceptance remain separate.</p>${body}<h2>Measured local cost</h2><pre>${esc(JSON.stringify(packet.cost,null,2))}</pre><p>Detailed claim support, source provenance and browser checks: <a href="sample-evidence.json">sample-evidence.json</a>.</p><h2>Actual application rendering</h2>${images}</html>`);
  console.log(JSON.stringify({output,cost:packet.cost,browserRuns:packet.browser.length}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={buildSamples};
