'use strict';
const assert=require('node:assert/strict'),{classify,classifyOptionalModule}=require('./lib/all-sports-offline-errors');
const origin='http://127.0.0.1:34567',ids=['fixture:nrl:one','fixture:nrl:two'];
const membership='/api/match-centre?view=all-sports&membership=everything&range=today&limit=50&cursor=0',selected='/api/match-centre?view=all-sports&ids='+encodeURIComponent(ids.join(','));
let controls=0;
function input(path='/app-version.json',stage='return:offline-document'){
 return {engine:'webkit',origin,workerVerified:true,allowedIds:ids,
  errors:[{name:'FetchEvent.respondWith received an error',message:'TypeError: Load failed',stack:'',stage,unreachable:true},{name:'Fetch API cannot load http',message:'/127.0.0.1:34567'+path+'.',stack:'',stage,unreachable:true}],
  requests:[{method:'GET',path,error:'FetchEvent.respondWith received an error: TypeError: Load failed',stage,unreachable:true}],server:[{method:'GET',path,stage,unreachable:true}]};
}
function pass(value,count){const before=JSON.stringify(value),result=classify(value);assert.equal(result.expected.length,count);assert.deepEqual(result.unexpected,[]);assert.equal(JSON.stringify(value),before,'Classification cannot delete or edit evidence');controls++;}
function refuse(mutate,value=input()){mutate(value);const before=JSON.stringify(value),result=classify(value);assert(result.unexpected.length>0,'Unproven errors must remain RED');assert.equal(JSON.stringify(value),before);controls++;}
pass({...input(),errors:[]},0);pass(input(),1);pass(input(membership,'return:offline-feature'),1);pass(input(selected,'return:offline-feature'),1);
const twice=input();twice.errors.push(...structuredClone(twice.errors));twice.requests.push(...structuredClone(twice.requests));twice.server.push(...structuredClone(twice.server));pass(twice,2);
for(const mutate of [
 v=>v.engine='chromium',v=>v.workerVerified=false,v=>v.origin='http://127.0.0.1:34568',v=>v.origin='http://example.com:34567',
 v=>v.errors[0].name='TypeError',v=>v.errors[1].name='Error',v=>v.errors[0].message='TypeError: other',v=>v.errors[1].message='/127.0.0.1:34568/app-version.json.',
 v=>v.errors[0].stack='at app.js:1',v=>v.errors[1].stack='at app.js:2',v=>delete v.errors[0].stack,v=>v.errors[1].stack=null,
 v=>v.errors[0].unreachable=false,v=>v.errors[1].unreachable=false,v=>v.errors[0].stage='return:feature',v=>v.errors[1].stage='first-use:feature',
 v=>v.requests=[],v=>v.server=[],v=>v.requests[0].method='POST',v=>v.server[0].method='POST',
 v=>v.requests[0].path='/api/account',v=>v.server[0].path='/api/account',v=>v.requests[0].stage='return:feature',v=>v.server[0].stage='return:feature',
 v=>v.requests[0].unreachable=false,v=>v.server[0].unreachable=false,v=>v.requests[0].error='cancelled',
 v=>v.errors.push(structuredClone(v.errors[0])),v=>v.errors.reverse(),v=>v.errors.pop(),v=>v.errors.shift(),
 v=>v.errors.push(...structuredClone(v.errors)),v=>{v.errors.push(...structuredClone(v.errors));v.requests.push(...structuredClone(v.requests));},
 v=>{v.errors.push(...structuredClone(v.errors));v.server.push(...structuredClone(v.server));},
 v=>v.errors.push({name:'Error',message:'unrelated',stack:'',stage:'return:offline-feature',unreachable:true}),
])refuse(mutate);
for(const path of ['/api/account','/app-version.json?x=1','/api/match-centre?view=all-sports&ids=fixture%3Anrl%3Aunknown',selected+'&private=1',selected+'&ids=fixture%3Anrl%3Aone',membership.replace('today','48'),membership.replace('cursor=0','cursor=50'),membership.replace('membership=everything','membership=followed'),'/api/match-centre?view=all-sports&ids='+encodeURIComponent(ids[0]+','+ids[0]),'/api/match-centre?view=all-sports&ids='])refuse(()=>{},input(path,'return:offline-feature'));
console.log('All Sports offline error classification: '+controls+' pure/fault controls PASS; raw evidence preserved, no browser/network.');
const captured=require('./fixtures/all-sports-offline-webkit-164-first-use.json');
const optional=()=>({engine:'webkit',origin:captured.origin,workerVerified:true,offlineVerified:true,moduleAbsentVerified:true,modulePath:'/assets/js/all-sports-ui.js?v=595',originModuleRequests:0,moduleResponses:0,errors:structuredClone(captured.errors),requests:structuredClone(captured.requests)});
let optionalControls=0;
const original=optional();assert.throws(()=>assert.deepEqual(original.errors,[]),'The retained raw first-use error receipt fails the original assertion');optionalControls++;
const unchanged=JSON.stringify(original),accepted=classifyOptionalModule(original);assert.equal(accepted.expected.length,2);assert.deepEqual(accepted.unexpected,[]);assert.equal(JSON.stringify(original),unchanged);optionalControls++;
for(const change of [
 v=>v.engine='chromium',v=>v.workerVerified=false,v=>v.offlineVerified=false,v=>v.moduleAbsentVerified=false,v=>v.originModuleRequests=1,v=>v.originModuleRequests=2,v=>v.moduleResponses=1,
 v=>v.origin='http://127.0.0.1:36306',v=>v.modulePath='/assets/js/all-sports-ui.js?v=596',v=>v.modulePath='/assets/js/other.js?v=595',v=>v.modulePath='/assets/js/all-sports-ui.js?v=595&extra=1',
 v=>v.errors[0].name='TypeError',v=>v.errors[1].name='Fetch API cannot load http',v=>v.errors[0].message='Other',v=>v.errors[0].stack='at app.js:1',v=>v.errors[1].stack='at app.js:2',
 v=>v.errors[0].stage='return:offline-feature',v=>v.errors[1].unreachable=false,v=>v.errors[1].message+='?',v=>v.errors.reverse(),v=>v.errors.pop(),
 v=>v.requests=v.requests.filter(x=>x.path!==v.modulePath),v=>v.requests.find(x=>x.path===v.modulePath).method='POST',v=>v.requests.find(x=>x.path===v.modulePath).unreachable=false,
 v=>v.requests.find(x=>x.path===v.modulePath).stage='return:offline-feature',v=>v.requests.find(x=>x.path===v.modulePath).error='Other',
 v=>v.requests.splice(v.requests.findIndex(x=>x.path===v.modulePath),1),v=>v.requests.push(structuredClone(v.requests.find(x=>x.path===v.modulePath))),
 v=>{const extra=structuredClone(v.requests.find(x=>x.path===v.modulePath));extra.error='Other transport failure';v.requests.push(extra);},
 v=>v.errors.push({name:'Error',message:'Real application failure',stack:'at app.js:1',stage:'first-use:feature',unreachable:true}),
]){const value=optional();change(value);const raw=JSON.stringify(value);assert(classifyOptionalModule(value).unexpected.length,'Every missing or contrary proof must remain RED');assert.equal(JSON.stringify(value),raw);optionalControls++;}
const noErrors=optional();noErrors.errors=[];assert.deepEqual(classifyOptionalModule(noErrors),{expected:[],unexpected:[]});optionalControls++;
console.log('All Sports first-use optional-script classification: '+optionalControls+' actual-receipt/pure/fault controls PASS; both raw errors and failed-GET receipts retained. Not browser acceptance.');
