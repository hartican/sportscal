'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={module:{exports:{}},URL};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/measurement.js'),'utf8'),box);const measurement=box.module.exports;
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const tests=[];
const test=(name,run)=>tests.push({name,run});
function memory(value=null){let saved=value;return {getItem:()=>saved,setItem:(key,next)=>{saved=next;},removeItem:()=>{saved=null;}};}
function fixture({allowed=null,clean=true,sdkEnabled=true}={}){
 const storage=memory(allowed===null?null:JSON.stringify({version:1,allowed})),effects=[];
 let context={url:clean?'https://nothingsport.com/':'https://nothingsport.com/?fbclid=synthetic-private#whats-on',referrer:clean?'':'https://referrer.invalid/private?token=synthetic'};
 const sdk={ready:Promise.resolve(),grant:()=>effects.push('grant'),pageView:()=>effects.push('PageView'),openApp:()=>effects.push('OpenApp'),revoke:()=>effects.push('revoke'),dispose:()=>effects.push('dispose')};
 const api=measurement.createController({storage,context:()=>context,sdkEnabled,createSdk:()=>{effects.push('script');return sdk;},navigate:options=>effects.push({navigate:JSON.parse(JSON.stringify(options))}),onChange:()=>{}});
 return {api,storage,effects,sdk,change:next=>{context={...context,...next};}};
}
test('default and refused choices never start Meta',async()=>{
 for(const allowed of [null,false]){const f=fixture({allowed});await f.api.start();assert.deepEqual(f.effects,[]);assert.equal(f.api.snapshot().active,false);}
});
test('allow persists only consent and requests a clean document before SDK',async()=>{
 const f=fixture({clean:false});await f.api.start();await f.api.choose(true);
 assert.equal(f.storage.getItem(measurement.KEY),'{"version":1,"allowed":true}');
 assert.deepEqual(f.effects,[{navigate:{deny:false}}]);assert.equal(f.api.snapshot().active,false);
});
test('clean consented document starts once and candidate gate remains off',async()=>{
 const f=fixture({allowed:true});await f.api.start();await f.api.start();assert.deepEqual(f.effects,['script','grant','PageView']);
 const gated=fixture({allowed:true,sdkEnabled:false});await gated.api.start();assert.deepEqual(gated.effects,[]);
 const dirty=fixture({allowed:true,clean:false});await dirty.api.start();assert.deepEqual(dirty.effects,[{navigate:{deny:false}}]);
});
test('other hosts stay off without a reload loop',async()=>{
 const f=fixture({allowed:true});f.change({url:'https://preview.invalid/'});await f.api.start();await f.api.choose(true);assert.deepEqual(f.effects,[]);assert.equal(f.api.snapshot().active,false);
});
test('withdrawal fences delayed SDK completion and regrant needs a fresh document',async()=>{
 const f=fixture({allowed:true});let finish;f.sdk.ready=new Promise(resolve=>{finish=resolve;});const pending=f.api.start();await Promise.resolve();
 await f.api.choose(false);finish();await pending;assert.deepEqual(f.effects,['script','revoke','dispose',{navigate:{deny:false}}]);assert.equal(f.storage.getItem(measurement.KEY),'{"version":1,"allowed":false}');
 await f.api.choose(true);assert.deepEqual(f.effects.slice(-1),[{navigate:{deny:false}}]);assert.equal(f.effects.filter(x=>x==='script').length,1);
});
test('withdrawal persists and reloads even when SDK cleanup throws',async()=>{
 const f=fixture({allowed:true});await f.api.start();f.sdk.revoke=()=>{throw Error('Synthetic SDK failure');};f.sdk.dispose=()=>{throw Error('Synthetic cleanup failure');};
 await f.api.choose(false);assert.equal(f.storage.getItem(measurement.KEY),'{"version":1,"allowed":false}');assert.equal(f.api.snapshot().active,false);assert.deepEqual(f.effects.slice(-1),[{navigate:{deny:false}}]);
});
function activation(href='https://nothingsport.app/',patch={}){return {isTrusted:true,defaultPrevented:false,type:'click',button:0,target:{closest:()=>({href,hasAttribute:()=>false})},...patch};}
test('only genuine app-link opens emit one custom event without parameters',async()=>{
 const f=fixture({allowed:true});await f.api.start();const event=activation('https://nothingsport.app/?event=synthetic#match-centre');
 assert.equal(await f.api.openApp(event),true);assert.equal(await f.api.openApp(event),false);assert.equal(await f.api.openApp(activation(undefined,{type:'auxclick',button:1})),true);
 assert.deepEqual(f.effects,['script','grant','PageView','OpenApp','OpenApp']);assert.equal(event.defaultPrevented,false);
 for(const invalid of [activation(undefined,{isTrusted:false}),activation(undefined,{defaultPrevented:true}),activation(undefined,{button:2}),activation(undefined,{type:'keydown'}),activation('https://nothingsport.app.evil.invalid/'),activation('http://nothingsport.app/'),activation('https://user:secret@nothingsport.app/'),activation('https://nothingsport.com/#get-the-app'),activation(undefined,{target:{closest:()=>null}}),activation(undefined,{target:{closest:()=>({href:'https://nothingsport.app/',hasAttribute:()=>true})}})])assert.equal(await f.api.openApp(invalid),false);
 assert.equal(f.effects.filter(x=>x==='OpenApp').length,2);
});
test('withdrawal cancels an activation awaiting its final event state',async()=>{
 const f=fixture({allowed:true});await f.api.start();const pending=f.api.openApp(activation());await f.api.choose(false);assert.equal(await pending,false);assert(!f.effects.includes('OpenApp'));
});
test('changed page queries or referrer never become manual event data',async()=>{
 for(const patch of [{url:'https://nothingsport.com/?email=synthetic&fbclid=synthetic'},{url:'https://nothingsport.com/#private-email-synthetic'},{referrer:'https://private.invalid/?token=synthetic'}]){const f=fixture({allowed:true});await f.api.start();f.change(patch);assert.equal(await f.api.openApp(activation()),false);assert(!f.effects.includes('OpenApp'));assert.equal(f.api.snapshot().active,false);}
});
test('SDK event failures stop the owner without interrupting the link',async()=>{
 const f=fixture({allowed:true});await f.api.start();f.sdk.openApp=()=>{throw Error('Synthetic send failure');};const event=activation();assert.equal(await f.api.openApp(event),false);assert.equal(f.api.snapshot().active,false);assert.equal(event.defaultPrevented,false);
});
test('invalid consent, failed reads and failed write readbacks stay off',async()=>{
 for(const value of ['bad-json','{"version":9,"allowed":true}','{"version":1,"allowed":"true"}']){const f=fixture();f.storage.setItem(measurement.KEY,value);await f.api.start();assert.deepEqual(f.effects,[]);}
 for(const key of ['getItem','setItem']){const f=fixture({allowed:true});f.storage[key]=()=>{throw Error('Synthetic storage failure');};await f.api.start();assert.equal(f.api.snapshot().active,false);assert.deepEqual(f.effects,[]);}
 const f=fixture();await f.api.start();f.storage.setItem=()=>{};await f.api.choose(true);assert.equal(f.api.snapshot().active,false);assert.deepEqual(f.effects,[{navigate:{deny:true}}]);
});
test('failed withdrawal persistence uses a forced-off next document',async()=>{
 const f=fixture({allowed:true});await f.api.start();f.storage.setItem=()=>{throw Error('Synthetic failed refusal write');};await f.api.choose(false);assert.deepEqual(f.effects.slice(-1),[{navigate:{deny:true}}]);
 const next=fixture({allowed:true});next.change({url:'https://nothingsport.com/?privacy=off'});await next.api.start();assert.deepEqual(next.effects,[]);assert.equal(next.storage.getItem(measurement.KEY),'{"version":1,"allowed":false}');
});
test('old durable Allow cannot survive failed refusal without an SDK owner',async()=>{
 for(const mode of ['gate-off','sdk-failed','clean-failed']){
  const f=fixture({allowed:true,sdkEnabled:mode!=='gate-off',clean:mode!=='clean-failed'});
  if(mode==='sdk-failed')f.sdk.ready=Promise.reject(Error('Synthetic SDK startup failure'));
  if(mode==='clean-failed')f.change({attemptedClean:true});
  await f.api.start();const before=f.effects.length;f.storage.setItem=()=>{throw Error('Synthetic transient refusal failure');};await f.api.choose(false);
  assert.deepEqual(f.effects.slice(before),[{navigate:{deny:true}}],mode+' must force off despite no SDK');assert.equal(f.api.snapshot().active,false);assert.equal(f.storage.getItem(measurement.KEY),'{"version":1,"allowed":true}','negative control retains the old durable Allow until the forced-off document');
 }
});
test('late SDK completion rechecks durable consent and context',async()=>{
 for(const change of [f=>f.storage.setItem(measurement.KEY,'{"version":1,"allowed":false}'),f=>f.change({referrer:'https://private.invalid/'}),f=>{f.storage.getItem=()=>{throw Error('Synthetic late storage failure');};}]){
  const f=fixture({allowed:true});let finish;f.sdk.ready=new Promise(resolve=>{finish=resolve;});const pending=f.api.start();await Promise.resolve();change(f);finish();await pending;assert(!f.effects.includes('grant'));assert(!f.effects.includes('PageView'));assert.equal(f.api.snapshot().active,false);
 }
});
test('a failed clean transition does not loop, and old page lifetime can resume controls',async()=>{
 const f=fixture({allowed:true,clean:false});f.change({attemptedClean:true});await f.api.start();assert.deepEqual(f.effects,[]);
 const back=fixture({allowed:true});await back.api.start();back.api.suspend();await back.api.choose(true);assert.deepEqual(back.effects.slice(-1),[{navigate:{deny:false}}]);assert.equal(back.effects.filter(x=>x==='PageView').length,1);
});
test('actual redirect handler uses fixed targets, no storage and no-referrer',async()=>{
 const {measurementReload}=await import('../lib/measurement-reload.mjs');
 for(const [url,target] of [['https://nothingsport.com/privacy/reload?redirect=https://evil.invalid/','/?privacy=resume'],['https://nothingsport.com/privacy/reload?off=1&email=synthetic','/?privacy=off']]){const response=measurementReload(new Request(url));assert.equal(response.status,303);assert.equal(response.headers.get('location'),target);assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),'');}
});
test('actual event parser rejects nested, unknown and duplicate payload fields',async()=>{
 const {eventFields}=require('./verify-measurement-browser.cjs'),base={id:'1149008224326641',ev:'PageView',dl:'https://nothingsport.com/',rl:''};
 const row=(body,type='application/json',url='https://www.facebook.com/tr/')=>({url,headers:{'content-type':type},body});
 for(const payload of [{...base,cd:{customer_id:'synthetic'}},{...base,user_data:{em:'synthetic'}},{...base,unknown:'synthetic'}])assert.throws(()=>eventFields(row(JSON.stringify(payload))),'nested/unknown JSON must not be accepted as a safe event');
 assert.throws(()=>eventFields(row('id=1149008224326641&id=other&ev=PageView&dl=https%3A%2F%2Fnothingsport.com%2F','application/x-www-form-urlencoded')),'duplicate form fields');
 assert.throws(()=>eventFields(row('',undefined,'https://www.facebook.com/tr/?id=1149008224326641&id=other&ev=PageView&dl=https%3A%2F%2Fnothingsport.com%2F')),'duplicate query fields');
 const valid=eventFields(row(new URLSearchParams(base).toString(),'application/x-www-form-urlencoded'));assert.equal(valid.ev,'PageView');assert.equal(valid.id,'1149008224326641');
});
test('request ingress scope survives delayed header and document capture',async()=>{
 const {ingress,captureRequest}=require('./verify-measurement-browser.cjs');let phase='before-consent',withdrawalSeq=null,sequence=0,time=0,headers,document;
 const clock={scope:()=>({phase,withdrawalSeq}),next:()=>++sequence,now:()=>++time};
 const request={url:()=> 'https://www.facebook.com/tr/',method:()=> 'POST',resourceType:()=> 'fetch',postData:()=>'',allHeaders:()=>new Promise(resolve=>{headers=resolve;}),frame:()=>({evaluate:()=>new Promise(resolve=>{document=resolve;})})};
 const initial=ingress(request,clock),pending=captureRequest(request,initial,clock);phase='consented';headers({});await settle();phase='withdrawn';withdrawalSeq=99;document({url:'https://nothingsport.com/',referrer:'',consent:'{"version":1,"allowed":false}'});const result=await pending;
 assert.equal(result.phase,'before-consent','later consent cannot relabel an earlier initiation');assert.equal(result.withdrawalSeq,null);assert.equal(result.documentObservation.completed.phase,'withdrawn');
});
test('a response receipt owns finished settlement before claiming completion',async()=>{
 const {responseReceipt}=require('./verify-measurement-browser.cjs');let finish,done=false,seq=0;const clock={scope:()=>({phase:'consented',withdrawalSeq:null}),next:()=>++seq,now:()=>seq};
 const response={url:()=> 'https://www.facebook.com/tr/',status:()=>200,allHeaders:async()=>({}),finished:()=>new Promise(resolve=>{finish=resolve;})};
 const pending=responseReceipt(response,1,clock).then(value=>{done=true;return value;});await settle();assert.equal(done,false,'headers are not response completion');assert.equal(typeof finish,'function');finish(null);const result=await pending;assert.equal(result.completion.status,'finished');
});
function memoryFiles(){const files=new Map(),dirs=new Set(['/proof']);return {files,dirs,failWrites:false,mkdirSync(name,options={}){if(dirs.has(name)&&!options.recursive)throw Error('EEXIST');dirs.add(name);},writeFileSync(name,value,options={}){if(this.failWrites)throw Error('Synthetic report write failure');if(options.flag==='wx'&&files.has(name))throw Error('EEXIST');files.set(name,value);},renameSync(from,to){if(this.failWrites)throw Error('Synthetic rename failure');assert(files.has(from));files.set(to,files.get(from));files.delete(from);}};}
test('attempt output refuses reuse and preserves a preexisting success receipt',async()=>{
 const {createAttempt}=require('./verify-measurement-browser.cjs'),io=memoryFiles(),file='/proof/old/browser-privacy-report.json';io.dirs.add('/proof/old');io.files.set(file,'{"passed":true,"old":true}');
 assert.throws(()=>createAttempt('/proof/old',{passed:false},io),'existing output must fail before any browser');assert.equal(io.files.get(file),'{"passed":true,"old":true}');
});
test('initial FAIL survives cleanup failure and the first case error stays primary',async()=>{
 const {createAttempt,ownedAttempt}=require('./verify-measurement-browser.cjs'),io=memoryFiles(),report={passed:false,violations:[]},attempt=createAttempt('/proof/new',report,io),file='/proof/new/browser-privacy-report.json';
 assert.equal(JSON.parse(io.files.get(file)).passed,false,'FAIL must exist before any launch');const first=Error('Primary case failed'),close=Error('Secondary browser close failed');
 await assert.rejects(ownedAttempt({attempt,report,execute:async()=>{throw first;},cleanup:async()=>{throw close;},drain:async()=>{}}),error=>error===first);
 const saved=JSON.parse(io.files.get(file));assert.equal(saved.passed,false);assert.equal(saved.firstError.message,first.message);assert(saved.failures.some(f=>f.message===close.message));
});
test('supported scalar event encodings reject multipart, cross-envelope and JSON duplicates',async()=>{
 const {eventFields}=require('./verify-measurement-browser.cjs'),base=[['id','1149008224326641'],['ev','OpenApp'],['dl','https://nothingsport.com/'],['rl','']],url='https://www.facebook.com/tr/';
 const multipart=fields=>'--qa\r\n'+fields.map(([key,value])=>'Content-Disposition: form-data; name="'+key+'"\r\n\r\n'+value).join('\r\n--qa\r\n')+'\r\n--qa--\r\n';
 const row=fields=>({url,headers:{'content-type':'multipart/form-data; boundary=qa'},body:multipart(fields)});assert.equal(eventFields(row(base)).ev,'OpenApp');
 for(const fields of [[...base,['id','other']],[...base,['cd[customer_id]','synthetic']],[...base,['user_data','{"em":"synthetic"}']],[...base,['cd','{"customer_id":"synthetic"}']],[...base,['unknown','synthetic']]])assert.throws(()=>eventFields(row(fields)));
 assert.throws(()=>eventFields({url:url+'?id=1149008224326641',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(base).toString()}));
 assert.throws(()=>eventFields({url,headers:{'content-type':'application/json'},body:'{"id":"1149008224326641","id":"other"}'}));
 assert.equal(eventFields({url:url+'?'+new URLSearchParams(base),headers:{},body:''}).ev,'OpenApp');
});
test('a pre-withdrawal initiation is not relabelled while document capture is delayed',async()=>{
 const {ingress,captureRequest}=require('./verify-measurement-browser.cjs');let phase='consented',withdrawalSeq=null,seq=0,finish;
 const clock={scope:()=>({phase,withdrawalSeq}),next:()=>++seq,now:()=>seq},request={url:()=> 'https://www.facebook.com/tr/',method:()=> 'POST',resourceType:()=> 'fetch',postData:()=>'',allHeaders:async()=>({}),frame:()=>({evaluate:()=>new Promise(resolve=>{finish=resolve;})})};
 const initial=ingress(request,clock),pending=captureRequest(request,initial,clock);await settle();phase='withdrawn';withdrawalSeq=100;finish({consent:'{"version":1,"allowed":false}'});const row=await pending;
 assert.equal(row.phase,'consented');assert.equal(row.withdrawalSeq,null);assert.equal(row.documentObservation.completed.phase,'withdrawn');assert.equal(row.documentObservation.completed.withdrawalSeq,100);assert(Object.isFrozen(initial));
});
test('response failure and a later header read remain distinct from actual settlement',async()=>{
 const {responseReceipt}=require('./verify-measurement-browser.cjs');let phase='consented',seq=0,finish,headers;
 const clock={scope:()=>({phase,withdrawalSeq:phase==='withdrawn'?100:null}),next:()=>++seq,now:()=>seq};
 const response={url:()=> 'https://www.facebook.com/tr/',status:()=>200,allHeaders:()=>new Promise(resolve=>{headers=resolve;}),finished:()=>new Promise(resolve=>{finish=resolve;})};
 const pending=responseReceipt(response,1,clock);await settle();finish(Error('Owned synthetic cancellation'));await settle();phase='withdrawn';headers({});const row=await pending;
 assert.equal(row.headerEvent.phase,'consented');assert.equal(row.completion.phase,'consented');assert.equal(row.completion.status,'failed');assert.equal(row.headerObservation.completed.phase,'withdrawn');
});
test('final report write failure leaves the initial FAIL and never a stale GREEN',async()=>{
 const {createAttempt,ownedAttempt}=require('./verify-measurement-browser.cjs'),io=memoryFiles(),report={passed:false,violations:[]},attempt=createAttempt('/proof/write-fail',report,io);
 await assert.rejects(ownedAttempt({attempt,report,execute:async()=>{io.failWrites=true;},cleanup:async()=>{},drain:async()=>{}}),/report write failure/);
 assert.equal(JSON.parse(io.files.get('/proof/write-fail/browser-privacy-report.json')).passed,false);assert.equal(report.passed,false);assert.equal(report.firstError.stage,'report-write');
});
test('cleanup and observation failures stay failed without re-running the case',async()=>{
 const {createAttempt,ownedAttempt}=require('./verify-measurement-browser.cjs'),io=memoryFiles(),report={passed:false,violations:[]},attempt=createAttempt('/proof/drain-fail',report,io);let executed=0,cleaned=0,drained=0;
 await assert.rejects(ownedAttempt({attempt,report,execute:async()=>{executed++;},cleanup:async()=>{cleaned++;},drain:async()=>{if(++drained===1)throw Error('Owned initial observation failure');}}),/initial observation failure/);
 assert.equal(executed,1);assert.equal(cleaned,1);assert.equal(report.passed,false);assert.equal(JSON.parse(io.files.get('/proof/drain-fail/browser-privacy-report.json')).firstError.stage,'observations-before-cleanup');
 const timedIo=memoryFiles(),timed={passed:false,violations:[]},timedAttempt=createAttempt('/proof/cleanup-timeout',timed,timedIo);
 await assert.rejects(ownedAttempt({attempt:timedAttempt,report:timed,execute:async()=>{},cleanup:()=>new Promise(()=>{}),drain:async()=>{},cleanupTimeoutMs:1}),/cleanup observation timed out/);assert.equal(JSON.parse(timedIo.files.get('/proof/cleanup-timeout/browser-privacy-report.json')).passed,false);
});
test('evidence errors are recorded before removal and every pending observation is bounded',async()=>{
 const {trackEvidence,drainEvidence}=require('./verify-measurement-browser.cjs'),pending=new Set(),errors=[];
 trackEvidence(pending,Promise.reject(Error('Owned capture failure')),error=>errors.push(error.message));await drainEvidence(pending);assert.deepEqual(errors,['Owned capture failure']);assert.equal(pending.size,0);
 const forever=new Set([new Promise(()=>{})]);await assert.rejects(drainEvidence(forever,1),/observation|settle/);
});
test('actual fixture wrapper preserves body failure and bounds rejecting or hanging close',async()=>{
 const {fixtureCase}=require('./verify-measurement-browser.cjs'),first=Error('Original fixture assertion failed'),close=Error('Fixture close failed'),report={violations:[]};let closed=0;
 await assert.rejects(fixtureCase(async()=>({close:async()=>{closed++;throw close;}}),async()=>{throw first;},report),error=>error===first);assert.equal(closed,1);assert(report.violations.some(row=>row.error===close.message));
 const hanging={violations:[]};await assert.rejects(fixtureCase(async()=>({close:()=>new Promise(()=>{})}),async()=>{throw first;},hanging,{closeTimeoutMs:1}),error=>error===first);assert(hanging.violations.some(row=>/timed out/.test(row.error)));
 await assert.rejects(fixtureCase(async()=>({close:async()=>{throw close;}}),async()=>true,{violations:[]}),error=>error===close);
 const brokenReport={get violations(){throw Error('Synthetic reporting fault');}};await assert.rejects(fixtureCase(async()=>({close:async()=>{throw close;}}),async()=>{throw first;},brokenReport),error=>error===first);assert(first.fixtureCleanupFailures.some(row=>row.kind==='fixture-cleanup-report-failed'));
});
async function settle(){for(let i=0;i<30;i++)await Promise.resolve();}
function domFixture({url='https://nothingsport.com/',referrer,allowed=null,view=null,scores=false,website=true}={}){
 const source=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8'),dom=new JSDOM(source,{url,referrer,runScripts:'outside-only'}),w=dom.window,effects=[];
 w.fetch=async target=>{assert.equal(target,'/api/matchday');return {ok:true,json:async()=>({ok:true,events:[{id:'event:fixture:one',name:'Fixture one',sport:'cricket',competition:'Fixture competition',start:new Date(Date.now()+3600000).toISOString(),status:'scheduled',participants:[]}],fetchedAt:new Date().toISOString()})};};
 w.XMLHttpRequest=function(){throw Error('External I/O forbidden');};w.WebSocket=w.Worker=w.XMLHttpRequest;
 w.scrollTo=options=>effects.push({scroll:options.top});w.requestAnimationFrame=fn=>{fn();return 1;};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 if(allowed!==null)w.localStorage.setItem(measurement.KEY,JSON.stringify({version:1,allowed}));
 if(view)w.sessionStorage.setItem('ns-website-privacy-view-v1',view);
 w.localStorage.setItem('ns-website-scores',String(scores));
 if(website)w.eval(fs.readFileSync(path.join(__dirname,'../public/website.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(__dirname,'../public/measurement.js'),'utf8'));
 return {w,effects,close:()=>dom.window.close()};
}
test('actual landing controls are default off, remembered, manageable and mounted once',async()=>{
 const f=domFixture();try{
  const api=f.w.NothingSportMeasurement.mount(f.w);await settle();assert.equal(f.w.document.getElementById('measurement-notice').hidden,false);assert.equal(f.w.fbq,undefined);
  f.w.document.querySelector('[data-measurement-choice="refuse"]').click();await settle();assert.equal(f.w.document.getElementById('measurement-notice').hidden,true);assert.equal(f.w.localStorage.getItem(measurement.KEY),'{"version":1,"allowed":false}');
  f.w.document.querySelector('[data-measurement-manage]').click();assert.equal(f.w.document.getElementById('measurement-notice').hidden,false);assert.equal(f.w.NothingSportMeasurement.mount(f.w),api);
  f.w.document.querySelector('[data-measurement-choice="allow"]').click();await settle();assert.equal(api.snapshot().phase,'candidate');assert.equal(f.w.fbq,undefined);
 }finally{f.close();}
});
test('actual shipped bootstrap stays inert even with consent on canonical origin',async()=>{
 const f=domFixture({allowed:true});try{f.w.eval(fs.readFileSync(path.join(__dirname,'../public/measurement-start.js'),'utf8'));await settle();assert.equal(f.w.fbq,undefined);assert.equal(f.w.document.querySelectorAll('script[src*="facebook"]').length,0);}finally{f.close();}
});
test('browser adapter refuses dirty context and only queues approved public commands',async()=>{
 for(const options of [{url:'https://nothingsport.com/?fbclid=synthetic'},{referrer:'https://private.invalid/?token=synthetic'},{url:'https://preview.invalid/'}]){const f=domFixture({...options,website:false});try{assert.throws(()=>f.w.NothingSportMeasurement.createBrowserSdk(f.w));assert.equal(f.w.fbq,undefined);}finally{f.close();}}
 const f=domFixture({website:false});try{
  const sdk=f.w.NothingSportMeasurement.createBrowserSdk(f.w),script=f.w.document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]');assert(script);assert.equal(script.referrerPolicy,'no-referrer');script.onload();await sdk.ready;sdk.grant();sdk.pageView();sdk.openApp();sdk.revoke();sdk.dispose();
  const commands=JSON.parse(JSON.stringify(f.w.fbq.queue.map(args=>[...args])));assert.deepEqual(commands,[['consent','revoke'],['set','autoConfig',false,'1149008224326641'],['init','1149008224326641'],['consent','grant'],['trackSingle','1149008224326641','PageView'],['trackSingleCustom','1149008224326641','OpenApp'],['consent','revoke']]);
 }finally{f.close();}
});
test('actual UI preserves score/filter/installer state through single-use first-party checkpoint',async()=>{
 const first=domFixture({scores:true});let saved;
 try{await settle();first.w.document.querySelector('[data-range="today"]').click();first.w.document.querySelector('[data-platform="android"]').click();first.w.document.querySelector('[data-step="2"]').click();assert.equal(first.w.NothingSportWebsiteView.checkpoint(),true);saved=first.w.sessionStorage.getItem('ns-website-privacy-view-v1');assert(!/fbclid|referrer|email|token|synthetic-private/.test(saved));}finally{first.close();}
 const second=domFixture({view:saved,scores:true});try{await settle();assert.equal(second.w.sessionStorage.getItem('ns-website-privacy-view-v1'),null);assert.equal(second.w.document.getElementById('scores-toggle').getAttribute('aria-pressed'),'true');assert.equal(second.w.document.querySelector('[data-range="today"]').getAttribute('aria-pressed'),'true');assert.equal(second.w.document.querySelector('[data-platform="android"]').getAttribute('aria-selected'),'true');assert.equal(second.w.document.querySelector('[data-step="2"]').getAttribute('aria-expanded'),'true');}finally{second.close();}
});
test('only the fixed resume marker is removed and a failed transition stays off',async()=>{
 const f=domFixture({url:'https://nothingsport.com/?privacy=resume',allowed:true,website:false});try{f.w.history.replaceState({retained:true},'');const api=f.w.NothingSportMeasurement.mount(f.w);await settle();assert.equal(f.w.location.href,'https://nothingsport.com/');assert.equal(f.w.history.state.retained,true);assert.equal(api.snapshot().active,false);}finally{f.close();}
 const dirty=domFixture({url:'https://nothingsport.com/?privacy=resume&email=synthetic',referrer:'https://private.invalid/',allowed:true,website:false});try{const events=[],api=dirty.w.NothingSportMeasurement.mount(dirty.w,{sdkEnabled:true,createSdk:()=>{throw Error('Must not load SDK');},navigate:value=>events.push(value)});await settle();assert.equal(events.length,0);assert.equal(api.snapshot().active,false);assert(dirty.w.location.search.includes('email='));}finally{dirty.close();}
});
function denyIo(){const restore=[],attempts={network:0,child:0,worker:0};function block(object,key,kind){if(typeof object[key]!=='function')return;const old=object[key];object[key]=()=>{attempts[kind]++;throw Error(kind+' forbidden');};restore.push(()=>{object[key]=old;});}block(globalThis,'fetch','network');for(const name of ['http','https','net','tls','dgram'])for(const key of ['request','get','connect','createConnection','createSocket'])block(require('node:'+name),key,'network');block(require('node:net').Socket.prototype,'connect','network');for(const key of ['exec','execFile','execSync','execFileSync','fork','spawn','spawnSync'])block(require('node:child_process'),key,'child');for(const key of ['Worker','BroadcastChannel'])block(require('node:worker_threads'),key,'worker');return {attempts,restore:()=>restore.reverse().forEach(fn=>fn())};}
async function run(){const guard=denyIo(),selected=process.argv.find(value=>value.startsWith('--case='))?.slice(7);let count=0;try{for(const {name,run} of tests){if(selected&&!name.includes(selected))continue;try{await run();count++;}catch(error){error.message=name+': '+error.message;throw error;}}assert(count>0);assert.deepEqual(guard.attempts,{network:0,child:0,worker:0});console.log(JSON.stringify({passed:true,cases:count,forbiddenAttempts:guard.attempts,nativeExecuted:false}));}finally{guard.restore();}}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
module.exports={run};
