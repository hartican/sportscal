'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const source=require('./refresh-wrc-context'),lib=require('./lib/wrc-context');
const root=path.resolve(__dirname,'..'),file=path.join(root,'data/canonical/wrc-context-2026.json'),before=fs.readFileSync(file),context=JSON.parse(before);
let interruptedResponse;
const server=http.createServer((req,res)=>{
 if(req.url==='/interrupted'){res.writeHead(200,{'content-type':'text/html'});res.write('<!doctype html><title>WRC Calendar</title>');interruptedResponse=res;return;}
 if(req.url==='/missing'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>WRC Calendar</title><p>No fixture data supplied.</p>');return;}
 if(req.url.startsWith('/status/')){res.writeHead(Number(req.url.split('/').at(-1)));res.end('Unavailable');return;}
 res.end('Complete public response');
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 const nativeFetch=globalThis.fetch;let headersObserved=false;
 try{
  globalThis.fetch=async(...args)=>{const response=await nativeFetch(...args);headersObserved=true;setTimeout(()=>interruptedResponse.destroy(),20);return response;};
  await assert.rejects(source.fetchText(url+'/interrupted'),error=>{assert(headersObserved,'the real HTTP headers must arrive before the interruption');assert(error instanceof source.SourceError,'a post-header body failure must enter the existing source-error boundary');assert(error.transient);assert.equal(source.preservedContextAfterCoreFailure(error,context),context);return true;});
 }finally{globalThis.fetch=nativeFetch;}
 const originalArgv=process.argv,originalWarn=console.warn,warnings=[];let ownerRequests=0;
 try{
  process.argv=[process.execPath,path.join(root,'scripts/refresh-wrc-context.js')];console.warn=message=>warnings.push(String(message));
  globalThis.fetch=async(_requestedUrl,options)=>{ownerRequests++;const response=await nativeFetch(url+'/interrupted',options);setTimeout(()=>interruptedResponse.destroy(),20);return response;};
  await source.main();assert.equal(ownerRequests,1,'the actual owner must not retry or continue source calls after a core transport failure');assert(warnings.some(message=>message.includes('preserved the last validated WRC context')));assert(fs.readFileSync(file).equals(before),'actual transport-degraded owner preserves every last-good byte and source date');
 }finally{process.argv=originalArgv;console.warn=originalWarn;globalThis.fetch=nativeFetch;}
 assert.equal(await source.fetchText(url+'/ok'),'Complete public response');
 for(const [status,transient]of [[503,true],[429,true],[403,false],[404,false]])await assert.rejects(source.fetchText(url+'/status/'+status),error=>{assert(error instanceof source.SourceError);assert.equal(error.transient,transient);if(transient)assert.equal(source.preservedContextAfterCoreFailure(error,context),context);else assert.throws(()=>source.preservedContextAfterCoreFailure(error,context));return true;});
 const missing=await source.fetchText(url+'/missing');assert.throws(()=>lib.parseWrcCalendar(missing),/prerender data was not found/,'a complete malformed response remains a hard parser failure');
 const diagnostic=source.calendarResponseDiagnostic(missing);assert.equal(diagnostic.bytes,Buffer.byteLength(missing));assert.equal(diagnostic.sha256,crypto.createHash('sha256').update(missing).digest('hex'));assert.equal(diagnostic.prerenderPresent,false);assert(!JSON.stringify(diagnostic).includes('No fixture data supplied'),'diagnostics expose no raw body');
 const result=cp.spawnSync(process.execPath,['scripts/refresh-wrc-context.js','--calendar-file','scripts/fixtures/wrc-classification-pending.html','--revision-file','scripts/fixtures/wrc-calendar-revision.html'],{cwd:root,encoding:'utf8',timeout:5000});assert.equal(result.status,1);assert.match(result.stderr,/WRC calendar response diagnostic:/);assert.match(result.stderr,/prerender data was not found/);assert(fs.readFileSync(file).equals(before),'actual failed owner leaves last-good bytes and all source clocks intact');
 const directory=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ns-wrc-failure-proof-'));
 try{
  const reportFile=path.join(directory,'wrc-source-failure.json');
  const captured=cp.spawnSync(process.execPath,['scripts/refresh-wrc-context.js','--calendar-file','scripts/fixtures/wrc-classification-pending.html','--revision-file','scripts/fixtures/wrc-calendar-revision.html'],{cwd:root,encoding:'utf8',timeout:5000,env:{...process.env,WRC_SOURCE_FAILURE_REPORT:reportFile}});
  assert.equal(captured.status,1,'saving a rejected public response must not waive the parser gate');
  assert(fs.existsSync(reportFile),'the failed actual owner saves a bounded diagnostic when configured');
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8')),body=fs.readFileSync(path.join(root,'scripts/fixtures/wrc-classification-pending.html'));
  assert.equal(report.schemaVersion,'wrc-source-failure.v1');assert.equal(report.sourceKind,'local-fixture');assert.equal(report.sourceUrl,null,'local fixtures must not pretend to be fresh official responses');
  assert.equal(report.bytes,body.length);assert.equal(report.sha256,crypto.createHash('sha256').update(body).digest('hex'));assert.equal(report.prerenderPresent,false);assert.equal(report.truncated,false);assert(Buffer.from(report.bodyBase64,'base64').equals(body));
  assert.equal(fs.statSync(reportFile).mode&0o777,0o600);assert(fs.readFileSync(file).equals(before));
  const large='x'.repeat(200000),largeFile=path.join(directory,'large.json');
  const saved=source.saveRejectedCalendarResponse(large,{file:largeFile,sourceKind:'public-response',checkedAt:'2026-10-11T01:00:00Z'});assert.equal(saved.state,'saved');
  const largeReport=JSON.parse(fs.readFileSync(largeFile,'utf8'));assert.equal(largeReport.sourceUrl,lib.CALENDAR_URL);assert.equal(largeReport.capturedBytes,128*1024);assert.equal(largeReport.bytes,200000);assert(largeReport.truncated);assert.equal(Buffer.from(largeReport.bodyBase64,'base64').length,128*1024);assert(fs.statSync(largeFile).size<180000,'diagnostic storage is bounded');
  assert.equal(source.saveRejectedCalendarResponse(large,{file:directory}).state,'unavailable','a diagnostic write failure cannot replace the source rejection');
  assert.equal(source.saveRejectedCalendarResponse(large,{file:''}).state,'disabled');
  const occupied=path.join(directory,'occupied.json'),existingTemporary=occupied+'.'+process.pid+'.tmp';fs.writeFileSync(existingTemporary,'owned by another writer');assert.equal(source.saveRejectedCalendarResponse(large,{file:occupied}).state,'unavailable');assert.equal(fs.readFileSync(existingTemporary,'utf8'),'owned by another writer','a diagnostic failure cannot remove a file it did not create');
  assert.deepEqual(Object.keys(largeReport).sort(),['schemaVersion','checkedAt','sourceKind','sourceUrl','bytes','sha256','prerenderPresent','capturedBytes','truncated','bodyBase64'].sort(),'no request headers, environment, error text, credentials or customer files enter the report');
  const writeFailure=cp.spawnSync(process.execPath,['scripts/refresh-wrc-context.js','--calendar-file','scripts/fixtures/wrc-classification-pending.html','--revision-file','scripts/fixtures/wrc-calendar-revision.html'],{cwd:root,encoding:'utf8',timeout:5000,env:{...process.env,WRC_SOURCE_FAILURE_REPORT:directory}});assert.equal(writeFailure.status,1);assert.match(writeFailure.stderr,/prerender data was not found/);assert.match(writeFailure.stderr,/rejected calendar capture: unavailable/);assert(fs.readFileSync(file).equals(before));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log('WRC source boundary: interrupted body, strict source/parser failures, actual failed-owner byte retention and bounded optional public-response capture passed; no provider, database or scheduler requests.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{server.closeAllConnections();server.close();});
