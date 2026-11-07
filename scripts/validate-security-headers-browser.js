'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {expected}=require('./validate-security-headers');
const servers=[];
async function origin(){
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost');
    response.writeHead(200,{'Content-Type':'text/html',...(url.pathname==='/child'?expected:{})});
    response.end(url.pathname==='/child'?'<p id="loaded">Protected document loaded</p>':'<iframe src="'+String(url.searchParams.get('target')||'/child').replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></iframe>');
  });
  servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return 'http://127.0.0.1:'+server.address().port;
}
(async()=>{
  let browser;
  try{
    const first=await origin(),second=await origin();browser=await chromium.launch();
    const page=await browser.newPage({serviceWorkers:'block'});
    await page.goto(first+'/');
    await page.frameLocator('iframe').locator('#loaded').waitFor();
    for(const target of [first+'/child',...(process.env.QA_BASE_URL?[process.env.QA_BASE_URL]:[])]){
      const refused=page.waitForEvent('console',{predicate:message=>/frame-ancestors|X-Frame-Options/i.test(message.text()),timeout:15000});
      await page.goto(second+'/?target='+encodeURIComponent(target));
      await refused;
      assert(!page.frames().some(frame=>frame!==page.mainFrame()&&frame.url()===target),'cross-origin protected document must not load');
    }
    console.log('Browser enforcement: same-origin embedding works; cross-origin framing is blocked'+(process.env.QA_BASE_URL?' on the public site.':'.'));
  }finally{await browser?.close();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));}
})().catch(error=>{console.error(error);process.exitCode=1;});
