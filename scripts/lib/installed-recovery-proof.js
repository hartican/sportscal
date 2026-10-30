'use strict';
// Inert test-only preparation. No product/SDK/helper import or execution.
const crypto=require('node:crypto');
const need=(ok,code)=>{if(!ok)throw Error('recovery-proof:'+code);};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const BOUNDARY='Source-bound native path plus observed natural evaluation and stable public references; private lexical captures unobserved; hidden rebind-and-restore between observations not excluded.';
function secondary(stage){try{if(typeof process!=='undefined')process.stderr.write('Installed recovery secondary '+stage+'\n');}catch{}}
async function drainOwned(tasks,{deadline,primary=null,report={}}={}){
 // No fresh time allocation: finite deadlines are the existing safety phase;
 // otherwise the unchanged external native/whole process owner remains binding.
 const observed=new Map();let first=primary,timer;
 Object.assign(report,{complete:false,batches:0,settled:0,rejected:0,remaining:tasks.size,localDeadline:Number.isFinite(deadline)});
 function remember(error){if(!first)first=error;else if(first!==error)secondary('owned-task');}
 function incomplete(){report.complete=false;report.remaining=tasks.size;if(!first)first=Error('recovery-proof:OWNED_DRAIN_INCOMPLETE');try{Object.defineProperty(first,'installedOwnedDrain',{value:{...report},configurable:true});}catch{secondary('drain-metadata');}return first;}
 try{
  for(;;){
   for(const task of [...tasks])if(!observed.has(task)){
    const entry={done:false,witness:null};observed.set(task,entry);
    entry.witness=Promise.resolve(task).then(()=>{entry.done=true;report.settled++;tasks.delete(task);},error=>{entry.done=true;report.settled++;report.rejected++;tasks.delete(task);remember(error);});
   }
   // Permit already queued settlement handlers to publish/cancel follow-up tasks.
   await Promise.resolve();
   if(Number.isFinite(deadline)&&Date.now()>deadline)throw incomplete();
   if(tasks.size===0){report.complete=true;report.remaining=0;break;}
   if(Number.isFinite(deadline)&&Date.now()>=deadline)throw incomplete();
   const batch=[...observed.values()].filter(e=>!e.done).map(e=>e.witness);report.batches++;
   if(!batch.length)continue;
   const all=Promise.allSettled(batch).then(()=>true);
   let completed;
   if(Number.isFinite(deadline))completed=await Promise.race([all,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(0,deadline-Date.now()));})]);
   else completed=await all;
   clearTimeout(timer);timer=undefined;
   if(!completed)throw incomplete();
   // Loop over the REAL set again, including tasks scheduled during this batch.
  }
 }finally{clearTimeout(timer);}
 if(first)throw first;
 return report;
}
function sourceContract(file){
 const acorn=require('acorn'),parse=s=>acorn.parse(s,{ecmaVersion:'latest'});
 function nodes(tree,predicate){const result=[];(function visit(n){if(!n||typeof n!=='object')return;if(predicate(n))result.push(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);})(tree);return result;}
 const html=file('index.html').toString(),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.includes('async function useSavedAccountPreferences('));need(scripts.length===1,'ONE_INLINE_OWNER');
 const index=scripts[0],helper=file('config/local-preference-recovery.js').toString(),ui=file('config/preference-reset-ui.js').toString();
 const trees=[parse(index),parse(helper),parse(ui)];
 function fn(tree,text,name){const found=nodes(tree,n=>n.type==='FunctionDeclaration'&&n.id?.name===name);need(found.length===1,'ONE_FUNCTION_'+name);return {node:found[0],source:text.slice(found[0].start,found[0].end)};}
 const caller=fn(trees[0],index,'useSavedAccountPreferences'),loader=fn(trees[0],index,'loadDeferredScript'),append=fn(trees[0],index,'appendPreferenceRecoverySettings'),recover=fn(trees[1],helper,'recover'),mount=fn(trees[2],ui,'mount');
 const call=(tree,object,property)=>nodes(tree,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name===object&&n.callee.property.name===property);
 need(caller.node.async&&recover.node.async,'ASYNC_CHAIN');
 need(/const helper\s*=\s*globalThis\.NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY\s*;/.test(caller.source)&&call(caller.node,'helper','recover').length===1,'CAPTURE_THEN_RECOVER');
 const invokes=call(caller.node,'helper','recover')[0];need(invokes.arguments[0]?.type==='ObjectExpression','REAL_RECOVERY_API');
 const properties=invokes.arguments[0].properties;need(properties.some(p=>p.key.name==='commit'&&call(p.value,'PROFILE_STORAGE','recoverPreferences').length===1)&&properties.some(p=>p.key.name==='load'&&call(p.value,'serverSyncClient','loadRecoverySnapshot').length===1),'SNAPSHOT_COMMIT_CHAIN');
 need(caller.source.includes('loadDeferredScript("config/local-preference-recovery.js?v="+')&&loader.source.includes('requests.set(key, request)')&&loader.source.includes('script.onload = () => finish()'),'NATURAL_LOADER_CHAIN');
 need(mount.node.params.some(p=>p.name==='api')&&call(mount.node,'api','useSavedAccountPreferences').length===1&&mount.source.includes("'[data-local-recovery-confirm]'"),'NATIVE_CONFIRM_CHAIN');
 need(call(append.node,'ui','mount').some(n=>n.arguments[1]?.properties?.some(p=>p.key.name==='useSavedAccountPreferences'&&p.shorthand)),'NATIVE_CALLER_SUPPLIED');
 need(call(recover.node,'api','load').length===1&&call(recover.node,'api','commit').length===1,'REAL_SNAPSHOT_AND_COMMIT');
 for(const [tree,name]of [[trees[1],'recover'],[trees[2],'mount']])need(nodes(tree,n=>n.type==='CallExpression'&&n.callee.object?.name==='Object'&&n.callee.property?.name==='freeze'&&n.arguments[0]?.properties?.some(p=>p.key.name===name)).length===1,'FROZEN_EXPORT_'+name);
 const protectedNames=new Set(['useSavedAccountPreferences','loadDeferredScript','NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY','NOTHINGSPORTS_PREFERENCE_RESET_UI','recover','mount']);
 for(const tree of trees){
  for(const n of nodes(tree,n=>n.type==='AssignmentExpression'||n.type==='UpdateExpression')){
   const left=n.left||n.argument,property=left?.property?.name||left?.property?.value;
   const name=left?.type==='Identifier'?left.name:property;
   if(!protectedNames.has(name))continue;
   // Only the real top-level publication of the two frozen module APIs is permitted.
   need(n.type==='AssignmentExpression'&&left.object?.name==='root'&&['NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY','NOTHINGSPORTS_PREFERENCE_RESET_UI'].includes(property)&&n.right.name==='api','UNEXPECTED_SOURCE_REBIND');
  }
  need(nodes(tree,n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&['eval','Function'].includes(n.callee.name)).length===0,'DYNAMIC_SOURCE_CHAIN');
  need(nodes(tree,n=>n.type==='CallExpression'&&n.callee.property?.name==='defineProperty'&&n.arguments.some(a=>a.type==='Literal'&&protectedNames.has(a.value))).length===0,'REDEFINED_SOURCE_CHAIN');
 }
 const resources=[{alias:'ui',path:'config/preference-reset-ui.js',global:'NOTHINGSPORTS_PREFERENCE_RESET_UI',method:'mount',source:mount.source},{alias:'helper',path:'config/local-preference-recovery.js',global:'NOTHINGSPORTS_LOCAL_PREFERENCE_RECOVERY',method:'recover',source:recover.source}].map(r=>{const bytes=file(r.path);need(bytes.length<=65536,'SOURCE_BODY_CAP');return {...r,hash:hash(bytes),bytes:bytes.length};});
 return {resources,caller:caller.source,loader:loader.source,sourceChain:true,boundary:BOUNDARY};
}
function installBrowserProof({contract,version}){
 if(location.href==='about:blank')return;
 const specs=contract.resources,refs=new Map(),records=new Map(),tasks=new Set(),storage=[];
 const toString=Function.prototype.toString;let invalid=false;
 function current(){const s=qaInstalledObservation.snapshot();return {doc:s.doc,version:s.version,seq:s.seq,worker:globalThis.NOTHINGSPORTS_APP_UPDATE?.snapshot?.().workerVersion||null};}
 function check(value){if(!value)throw Error('RECOVERY_PROOF_OBSERVATION');}
 function reference(spec,initial=false){
  const obj=globalThis[spec.global],callable=obj?.[spec.method],caller=typeof useSavedAccountPreferences==='function'?useSavedAccountPreferences:null,loader=typeof loadDeferredScript==='function'?loadDeferredScript:null;
  check(Object.isFrozen(obj)&&typeof callable==='function'&&toString.call(callable)===spec.source&&toString.call(caller)===contract.caller&&toString.call(loader)===contract.loader);
  if(initial){check(!refs.has(spec.alias));refs.set(spec.alias,{obj,callable,caller,loader});}
  else {const old=refs.get(spec.alias);check(old&&old.obj===obj&&old.callable===callable&&old.caller===caller&&old.loader===loader);}
  return true;
 }
 function onResource(event){
  const element=event.target;if(element?.tagName!=='SCRIPT')return;
  let url;try{url=new URL(element.src,location.href);}catch{return;}
  const spec=specs.find(s=>url.pathname==='/'+s.path);if(!spec)return;
  let counted=false;try{
   const eventStamp=qaInstalledObservation.recoveryLoad(event,spec.alias);counted=true;
   const stamp=current();check(window.top===window&&event.isTrusted===true&&event.type==='load'&&url.origin===location.origin&&url.pathname+url.search==='/'+spec.path+'?v='+version&&stamp.version===version&&stamp.worker===version&&!records.has(spec.alias));
   const promise=loadDeferredScript.requests?.get(url.href);check(promise instanceof Promise);
   reference(spec,true);const record={alias:spec.alias,url:url.pathname+url.search,doc:stamp.doc,version,loadSeq:eventStamp.seq,trusted:true,loaded:true,entry:true,settled:false};records.set(spec.alias,record);
   const task=promise.then(()=>{try{check(current().doc===stamp.doc&&current().version===version&&loadDeferredScript.requests.get(url.href)===promise);reference(spec);record.settled=true;}catch{invalid=true;}},()=>{invalid=true;});
   tasks.add(task);task.then(()=>tasks.delete(task),()=>{invalid=true;tasks.delete(task);});
  }catch{invalid=true;if(!counted)try{qaInstalledObservation.recoveryLoad(event,spec.alias);}catch{}}
 }
 document.addEventListener('load',onResource,true);document.addEventListener('error',onResource,true);
 async function cacheProof(spec){
  const matches=[],names=await caches.keys();
  for(let i=0;i<names.length;i++){
   check((await caches.keys()).includes(names[i]));const cache=await caches.open(names[i]);
   for(const key of await cache.keys()){
    const url=new URL(key.url);if(url.pathname!=='/'+spec.path)continue;
    check(url.origin===location.origin&&url.pathname+url.search==='/'+spec.path+'?v='+version);
    const response=await cache.match(key);check(response&&response.ok);
    const reader=response.body.getReader(),chunks=[];let size=0,primary;
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536){await reader.cancel();throw Error('CACHE_BODY_CAP');}chunks.push(part.value);}}
    catch(error){primary=error;}finally{try{reader.releaseLock();}catch(error){primary ||= error;}}
    if(primary)throw primary;
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');check(digest===spec.hash);
    matches.push({cacheAlias:'cache-'+(i+1),url:url.pathname+url.search,hash:digest});
   }
  }
  return {cacheMember:matches.length>0,matches};
 }
 globalThis.qaRecoveryByteProof={
  stamp:current,
  storage(stage){try{const stamp=current();check(['commit','verify','rollback'].includes(stage)&&storage.length<3&&stamp.version===version);for(const spec of specs)reference(spec);storage.push({stage,doc:stamp.doc,expectedSeq:stamp.seq+1,referencesStable:true});}catch{invalid=true;}},
  async complete(){
   await Promise.all([...tasks]);check(!invalid&&records.size===2&&storage.length===3);
   const stamp=current();check(stamp.version===version&&stamp.worker===version);
   const result=[];for(const spec of specs){reference(spec);const record=records.get(spec.alias);check(record?.settled&&record.doc===stamp.doc);result.push({...record,sourceEqual:true,referencesStable:true,hash:spec.hash,cache:await cacheProof(spec)});}
   for(const spec of specs)reference(spec);check(!invalid&&current().doc===stamp.doc&&current().version===version&&current().worker===version);return {doc:stamp.doc,version,resources:result,storage,sourceChain:contract.sourceChain,boundary:contract.boundary,privateCapturesObserved:false};
  },
 };
}
function assertRecoveryProof({proof,wire,events,attempts,handlers,operations,version,contract}){
 need(proof&&proof.version===version&&proof.sourceChain===true&&proof.boundary===BOUNDARY&&proof.privateCapturesObserved===false,'PROOF_BOUNDARY');
 need(contract?.sourceChain===true&&contract.boundary===BOUNDARY&&contract.resources.length===2,'PINNED_SOURCE_CHAIN');
 need(proof.resources.length===2&&wire.length===2,'TWO_NATURAL_RESOURCES');
 for(const r of proof.resources){
  const expected=contract.resources.filter(s=>s.alias===r.alias);need(expected.length===1&&r.url==='/'+expected[0].path+'?v='+version&&r.hash===expected[0].hash,'PINNED_RESOURCE_URL_HASH');
  const w=wire.filter(w=>w.alias===r.alias);need(w.length===1,'ONE_RESOURCE_RESPONSE');const v=w[0];
  need(r.doc===proof.doc&&v.doc===proof.doc&&r.version===version&&v.version===version,'RESOURCE_DOCUMENT_VERSION');
  need(r.loaded&&r.trusted&&r.entry&&r.settled&&r.sourceEqual&&r.referencesStable&&v.complete&&v.status===200&&!v.redirect&&v.requestType==='script','EVALUATED_MATCHING_LOADER');
  need(v.url===r.url&&v.hash===r.hash&&v.bytes===expected[0].bytes&&v.bytes>0&&v.bytes<=65536,'RESOURCE_URL_BODY');
  need(r.cache&&r.cache.cacheMember===(r.cache.matches.length>0)&&r.cache.matches.every(c=>c.url===r.url&&c.hash===r.hash&&/^cache-[1-9]\d*$/.test(c.cacheAlias)),'HONEST_CACHE');
 }
 const clicks=events.filter(e=>e.type==='safety-ui'&&['recovery-open','recovery-confirm'].includes(e.action));
 need(clicks.length===2&&clicks[0].action==='recovery-open'&&clicks[1].action==='recovery-confirm'&&clicks.every(e=>e.doc===proof.doc&&e.trusted&&e.documentVersion===version),'NATIVE_ACTION_JOIN');
 const ui=proof.resources.find(r=>r.alias==='ui'),helper=proof.resources.find(r=>r.alias==='helper');need(ui&&helper&&ui.loadSeq<clicks[0].seq&&helper.loadSeq>clicks[1].seq,'NATURAL_NATIVE_LOAD_ORDER');
 const loads=events.filter(e=>e.type==='lifecycle'&&/^recovery-(ui|helper)-load$/.test(e.event));
 need(loads.length===2&&proof.resources.every(r=>loads.some(e=>e.doc===proof.doc&&e.seq===r.loadSeq&&e.event==='recovery-'+r.alias+'-load'&&e.trusted)),'BROWSER_LOAD_EVENT_JOIN');
 need(proof.storage.length===3&&proof.storage.every((s,i)=>s.doc===proof.doc&&s.referencesStable&&s.stage===['commit','verify','rollback'][i]),'STORAGE_REFERENCE_BOUNDARIES');
 const stages=['native-recovery-write','verification-read-rejected','rollback-write-rejected'];
 need(proof.storage.every((s,i)=>events.some(e=>e.doc===s.doc&&e.seq===s.expectedSeq&&e.type==='safety-storage'&&e.stage===stages[i])),'REAL_STORAGE_FAULT_JOIN');
 const reads=attempts.filter(a=>a.doc===proof.doc&&a.mode==='snapshot-v1'&&a.method==='GET'&&a.seq>helper.loadSeq&&a.seq<proof.storage[0].expectedSeq);
 need(reads.length===1&&reads[0].terminal?.kind==='response'&&reads[0].terminal.status===200&&reads[0].terminal.seq<proof.storage[0].expectedSeq,'REAL_SNAPSHOT_ORDER');
 const op=reads[0].terminal.operation;need(handlers.filter(h=>h.operation===op&&h.method==='GET'&&h.mode==='snapshot-v1'&&h.status===200).length===1&&operations.filter(w=>w.operation===op&&w.path==='/api/user-state'&&w.method==='GET'&&w.status===200&&w.complete).length===1,'REAL_SNAPSHOT_OPERATION_JOIN');
 return {verified:true,boundary:BOUNDARY,privateCapturesObserved:false};
}
function observeNaturalResources({context,state,pending,origin,version,contract}){
 const requests=new Map(),wire=[],owned=new Set();let stopped=false,firstError=null,firstStage=null;
 function fault(error,stage){state.failed=true;if(!firstError){firstError=error;firstStage=stage;}}
 function track(promise){owned.add(promise);pending.add(promise);promise.then(()=>{owned.delete(promise);pending.delete(promise);},error=>{fault(error,'owned-observer');owned.delete(promise);pending.delete(promise);});return promise;}
 function specFor(request){const url=new URL(request.url());return contract.resources.find(s=>url.pathname==='/'+s.path);}
 function onRequest(request){const spec=specFor(request);if(!spec)return;try{
  need(!stopped&&state.safetyActive?.plan.kind==='uncertainty','NATURAL_LOAD_INSIDE_PHASE');need(requests.size<2&&!request.redirectedFrom(),'NO_EXTRA_OR_REDIRECTED_RESOURCE');
  const url=new URL(request.url());need(url.origin===origin&&url.pathname+url.search==='/'+spec.path+'?v='+version&&request.resourceType()==='script','NATURAL_SCRIPT_URL');
  const page=request.frame().page();need(state.pages.has(page),'ACTUAL_RESOURCE_PAGE');
  const stamp=track(page.evaluate(()=>qaRecoveryByteProof.stamp()));requests.set(request,{spec,page,stamp});
 }catch(error){fault(error,'natural-request');}}
 function onResponse(response){const request=response.request(),spec=specFor(request);if(!spec)return;
  track((async()=>{const captured=requests.get(request);need(captured,'OBSERVED_ORIGINAL_REQUEST');const stamp=await captured.stamp;need(stamp.version===version,'REQUEST_CANDIDATE_DOCUMENT');need(response.url()===request.url()&&response.status()===200,'NATURAL_SUCCESSFUL_RESPONSE');
   const failure=await response.finished();need(!failure,'NATURAL_BODY_COMPLETED');const bytes=await response.body();need(bytes.length===spec.bytes&&bytes.length<=65536&&hash(bytes)===spec.hash,'EXACT_SERVED_SCRIPT_BYTES');
   const after=await captured.page.evaluate(()=>qaRecoveryByteProof.stamp());need(after.doc===stamp.doc&&after.version===version,'SAME_RESOURCE_DOCUMENT');
   wire.push({alias:spec.alias,doc:stamp.doc,version,url:new URL(request.url()).pathname+new URL(request.url()).search,status:200,complete:true,hash:hash(bytes),bytes:bytes.length,redirect:false,requestType:request.resourceType()});
  })());
 }
 function onFailure(request){if(specFor(request))fault(Error('recovery-proof:NATURAL_SCRIPT_FAILED'),'natural-request-failed');}
 context.on('request',onRequest);context.on('response',onResponse);context.on('requestfailed',onFailure);
 return {
  finish(page){
   const job=(async()=>{try{const deadline=state.recoveryDeadline;need(Number.isFinite(deadline),'ORIGINAL_RECOVERY_DEADLINE_REQUIRED');await drainOwned(owned,{deadline,primary:firstError});if(firstError)throw firstError;need(!state.failed&&requests.size===2&&wire.length===2,'COMPLETE_NATURAL_SCRIPT_OBSERVERS');need(Date.now()<=deadline,'RECOVERY_PHASE_DEADLINE');const proof=await track(page.evaluate(()=>qaRecoveryByteProof.complete()));if(firstError)throw firstError;need(!state.failed&&Date.now()<=deadline,'OBSERVER_FAULT_OR_PHASE_DEADLINE');return {proof,wire};}catch(error){fault(error,'finish-proof');throw firstError;}})();
   // Own the phase-facing promise too, without adding it to its own awaited set.
   pending.add(job);job.then(()=>pending.delete(job),()=>pending.delete(job));return job;
  },
  status(){return {failed:!!firstError,firstStage,pending:owned.size,boundary:BOUNDARY,privateCapturesObserved:false};},
  detach(){stopped=true;let error;for(const [name,fn]of [['request',onRequest],['response',onResponse],['requestfailed',onFailure]])try{context.off(name,fn);}catch(next){if(!error)error=next;else secondary('detach');}if(error)throw error;},
 };
}
module.exports={sourceContract,installBrowserProof,assertRecoveryProof,observeNaturalResources,drainOwned,secondary,BOUNDARY};
