'use strict';
// WebKit reports a rejected worker respondWith(fetch) as two page errors.
// Classify only the observed exact pair with independent, single-use proof
// of this owned GET failing at both the server and browser transport boundary.
function classify({engine,origin,workerVerified,allowedIds,errors,requests,server}){
 const expected=[],unexpected=[],usedRequests=new Set(),usedServer=new Set();let owned;
 try{owned=new URL(origin);}catch{}
 const environment=engine==='webkit'&&workerVerified===true&&Boolean(owned)&&owned.origin===origin&&owned.protocol==='http:'&&owned.hostname==='127.0.0.1'&&Boolean(owned.port)&&!owned.username&&!owned.password;
 const ids=new Set(Array.isArray(allowedIds)?allowedIds:[]),phase=record=>record?.unreachable===true&&['return:offline-document','return:offline-feature'].includes(record.stage);
 function allowed(path){
  try{
   const url=new URL(path,origin);if(!path.startsWith('/')||url.href!==origin+path||url.hash)return false;
   if(path==='/app-version.json')return true;
   if(url.pathname!=='/api/match-centre'||url.searchParams.get('view')!=='all-sports')return false;
   const q=url.searchParams;
   if(q.size===5&&['view','membership','range','limit','cursor'].every(key=>q.has(key)))return q.get('membership')==='everything'&&q.get('range')==='today'&&q.get('limit')==='50'&&q.get('cursor')==='0';
   if(q.size!==2||!q.has('ids'))return false;
   const selected=q.get('ids').split(',');return selected.length>0&&selected.length<=60&&new Set(selected).size===selected.length&&selected.every(id=>/^[-a-z0-9_:]{1,200}$/i.test(id)&&ids.has(id));
  }catch{return false;}
 }
 for(let index=0;index<errors.length;index++){
  const first=errors[index],second=errors[index+1],prefix=owned&&'/'+owned.host;
  let path;
  if(environment&&first?.name==='FetchEvent.respondWith received an error'&&first.message==='TypeError: Load failed'&&first.stack===''&&phase(first)
   &&second?.name==='Fetch API cannot load http'&&second.stack===''&&phase(second)&&first.stage===second.stage&&typeof second.message==='string'&&second.message.startsWith(prefix+'/')&&second.message.endsWith('.'))path=second.message.slice(prefix.length,-1);
  const receipt=(record,used,recordIndex)=>!used.has(recordIndex)&&record.method==='GET'&&record.path===path&&phase(record)&&record.stage===first.stage;
  const requestIndex=path&&allowed(path)?requests.findIndex((record,i)=>receipt(record,usedRequests,i)&&record.error==='FetchEvent.respondWith received an error: TypeError: Load failed'):-1;
  const serverIndex=requestIndex>=0?server.findIndex((record,i)=>receipt(record,usedServer,i)):-1;
  if(requestIndex>=0&&serverIndex>=0){usedRequests.add(requestIndex);usedServer.add(serverIndex);expected.push({errorIndices:[index,index+1],path,stage:first.stage,requestIndex,serverIndex});index++;}
  else unexpected.push({index,error:first,reason:'No exact worker-transport pair with single-use owned failure evidence'});
 }
 return {expected,unexpected};
}
// An absent optional script cannot load while the browser is explicitly offline.
// New WebKit exposes this caught load failure as a separate page-error pair.
// This is a different proof from return-visit origin cutoffs; never reuse or
// broaden that server/request classifier for the emulated-offline case.
function classifyOptionalModule({engine,origin,workerVerified,offlineVerified,moduleAbsentVerified,modulePath,originModuleRequests,moduleResponses,errors,requests}){
 const expected=[],unexpected=[],used=new Set();let owned;
 try{owned=new URL(origin);}catch{}
 const stage='first-use:feature',phase=x=>x?.stage===stage&&x.unreachable===true;
 const environment=engine==='webkit'&&workerVerified===true&&offlineVerified===true&&moduleAbsentVerified===true&&originModuleRequests===0&&moduleResponses===0
  &&owned?.origin===origin&&owned.protocol==='http:'&&owned.hostname==='127.0.0.1'&&Boolean(owned.port)&&!owned.username&&!owned.password
  &&/^\/assets\/js\/all-sports-ui\.js\?v=\d+$/.test(modulePath);
 const failed=requests.filter(x=>x.path===modulePath);
 const exactRequests=failed.length===2&&failed.every(x=>x.method==='GET'&&phase(x)&&x.error==='FetchEvent.respondWith received an error: TypeError: Load failed');
 for(let index=0;index<errors.length;index++){
  const first=errors[index],second=errors[index+1];
  const pair=environment&&exactRequests&&errors.length===4&&first?.name==='FetchEvent.respondWith received an error'&&first.message==='TypeError: Load failed'&&first.stack===''&&phase(first)
   &&second?.name==='Cannot load http'&&second.message==='/'+owned.host+modulePath+'.'&&second.stack===''&&phase(second);
  const requestIndex=pair?requests.findIndex((x,i)=>!used.has(i)&&failed.includes(x)):-1;
  if(requestIndex>=0){used.add(requestIndex);expected.push({errorIndices:[index,index+1],path:modulePath,stage,requestIndex,evidence:'verified-offline-absent-optional-script'});index++;}
  else unexpected.push({index,error:first,reason:'No exact optional-script pair with offline, absent-cache and single-use failed-GET proof'});
 }
 return{expected,unexpected};
}
module.exports={classify,classifyOptionalModule};
