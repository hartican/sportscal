#!/usr/bin/env node
'use strict';
// Synthetic API responses only: never authenticates or writes guest activity.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT_DIR;
const seed=require('../data/marquee-candidates.v1.json').candidates.find(c=>c.readyForExport&&c.participation.enabled);
const now=Date.now(),candidate=structuredClone(seed);
candidate.participation.ratingWindow={opensAt:new Date(now-60000).toISOString(),closesAt:new Date(now+86400000).toISOString()};
const publicFixture=require('../api/participation')._test.publicFixture;
const fixture=publicFixture(candidate,now,{...candidate.drafts.live,animationPreset:'subtle'});
const cases=[['default','/live',''],['event','/fixture/'+encodeURIComponent(candidate.eventId),'eventId'],['campaign','/live?campaign='+encodeURIComponent(candidate.campaignId),'campaign'],['query-event','/participate.html?eventId='+encodeURIComponent(candidate.eventId),'eventId'],['tbc','/fixture/time-tbc','eventId'],['missing','/fixture/unavailable','eventId']];
async function run(base){
  const checks=[];
  for(const [engine,label] of [[chromium,'chromium'],[webkit,'webkit']]){
    const browser=await engine.launch(label==='chromium'?{channel:'chrome'}:{});
    try{for(const width of [320,1280])for(const [name,route,selector] of cases){
      const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[],requests=[],rawReads=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/data\/(marquee-candidates|comms-sources|editorial-maintenance-sources)\.v1\.json/.test(r.url()))rawReads.push(r.url());});
      const aggregate={joinedCount:0,ratingCount:0,averageRating:null,currentDevice:{joined:false,rating:null}};
      await page.route('**/api/participation**',async r=>{
        const request=r.request(),u=new URL(request.url());requests.push({method:request.method(),query:Object.fromEntries(u.searchParams),body:request.postDataJSON()});
        if(name==='missing'){await r.fulfill({status:404,json:{error:'No live fixture is currently available.'}});return;}
        if(request.method()==='POST'){
          const body=request.postDataJSON();assert.equal(body.eventId,candidate.eventId);assert.equal(body.campaignId,candidate.campaignId);
          if(body.action==='join'){aggregate.joinedCount=1;aggregate.currentDevice.joined=true;}
          else{assert.equal(body.action,'rate');aggregate.ratingCount=1;aggregate.averageRating=body.rating;aggregate.currentDevice.rating=body.rating;}
        }
        const f=structuredClone(fixture);if(name==='tbc'){f.participationEnabled=false;f.startTimeUtc=null;f.endTimeUtc=null;f.eventUrl='/';}
        await r.fulfill({json:{schemaVersion:'marquee-participation.v1',fixture:f,aggregate}});
      });
      if(name==='default')await page.route('**/assets/marquee/**',r=>r.fulfill({status:404,body:''}));
      await page.goto(base+route,{waitUntil:'domcontentloaded'});
      if(name==='missing')await page.getByRole('heading',{name:'Fixture unavailable'}).waitFor();
      else{
        await page.getByRole('heading',{name:fixture.title,exact:true,level:2}).waitFor();
        if(name==='tbc'){
          assert(await page.getByRole('button',{name:'Start time TBC'}).isDisabled());assert.equal(await page.locator('.rating:visible').count(),0);assert.equal(await page.locator('.privacy:visible').count(),0);
        }else{
          await page.getByRole('button',{name:'Join this fixture',exact:true}).click();await page.getByRole('button',{name:'Joined',exact:true}).waitFor();
          await page.getByRole('button',{name:'5 stars',exact:true}).click();await page.getByText('Rating saved.',{exact:true}).waitFor();
          assert.equal(await page.locator('[data-rating="5"]').getAttribute('class'),'star selected');
          await page.getByRole('button',{name:'3 stars',exact:true}).click();await page.getByText('Rating saved.',{exact:true}).waitFor();
          assert.equal(await page.locator('[data-rating="3"]').getAttribute('class'),'star selected');
          await page.emulateMedia({reducedMotion:'reduce'});const animations=await page.locator('.ns-live-hero>img,.ns-live-fallback').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).animationName));assert(animations.every(v=>v==='none'));
        }
      }
      assert.equal(requests[0].method,'GET');assert.deepEqual(Object.keys(requests[0].query),selector?[selector]:[]);
      if(name==='event'||name==='query-event')assert.equal(requests[0].query.eventId,candidate.eventId);
      if(name==='campaign')assert.equal(requests[0].query.campaign,candidate.campaignId);
      assert.deepEqual(rawReads,[],'Public fixture navigation must not download an owner source');
      assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Public fixture must fit the viewport');
      if(out&&name==='default')await page.screenshot({path:path.join(out,label+'-'+width+'.png'),fullPage:false});
      checks.push({engine:label,width,name,route,requests:requests.length,rawSourceRequests:0,syntheticApi:true,noProductionWrites:true});await page.close();
    }}finally{await browser.close();}
  }
  const report={checkedAt:new Date().toISOString(),base,cases:checks,physicalDevice:false,realGuestParticipation:false};
  if(out)fs.writeFileSync(path.join(out,'public-fixture-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({cases:checks.length,base,syntheticApi:true,realGuestParticipation:false}));
}
async function main(){
  if(out)fs.mkdirSync(out,{recursive:true});
  if(process.env.QA_BASE_URL)return run(process.env.QA_BASE_URL);
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),name=url.pathname;
    const relative=name==='/live'||name.startsWith('/fixture/')?'participate.html':name.replace(/^\//,'');
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
