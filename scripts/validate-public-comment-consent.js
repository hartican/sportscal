'use strict';
// Actual mounted registration source -> unchanged SDK -> actual notification API.
// Database/transport boundaries are mocked; no browser, PGlite or real send runs.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const sdk=require('../config/server-sync'),alerts=require('../lib/public-comment-alerts');
const apiPath=require.resolve('../api/notifications'),serverPath=require.resolve('../lib/supabase-server');
const html=process.argv.includes('--reviewed-baseline')?require('node:child_process').execFileSync('git',['show','95885e63bd93d22980ac7526633c638239c910df:index.html'],{encoding:'utf8'}):fs.readFileSync('index.html','utf8'),start=html.indexOf('function pushInstallationCredentials(){'),end=html.indexOf('\nasync function disablePushInstallation(',start);
assert(start>=0&&end>start);const source=html.slice(start,end);
const user={id:crypto.randomUUID()},installationId=crypto.randomUUID(),secret='synthetic-consent-secret-abcdefghijklmnopqrstuvwxyz';
const accessToken='e.'+Buffer.from(JSON.stringify({sub:user.id})).toString('base64url')+'.x',secretHash=crypto.createHash('sha256').update(secret).digest('hex');
const subscription={endpoint:'https://push.invalid/consent-test',keys:{p256dh:'synthetic',auth:'synthetic'}};
let installation=null,bodies=[],paths=[];
const serviceRequest=async(path,options={})=>{
 paths.push(path);
 if(path.startsWith('/rest/v1/nothingsports_push_installations?on_conflict=')){installation={...installation,...options.body};return null;}
 if(path.includes('nothingsports_push_installations?installation_id=eq.'))return installation?[{...installation}]:[];
 if(path.includes('nothingsports_push_installations?endpoint=eq.'))return[];
 throw Error('Unexpected registration database request');
};
function response(){return{statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;}};}
const priorServer=require.cache[serverPath],priorApi=require.cache[apiPath];
require.cache[serverPath]={...priorServer,exports:{...priorServer.exports,authenticatedUser:async token=>token===accessToken?user:null,supabaseServiceRequest:serviceRequest}};delete require.cache[apiPath];
const handler=require(apiPath);
async function api(command){const res=response();await handler({method:'POST',url:'/api/notifications',body:command,headers:{authorization:'Bearer '+accessToken}},res);assert.equal(res.statusCode,200);return res.body;}
function preferences(value){return{followFirst:{notifications:{enabled:true,...(value===undefined?{}:{commentAlertsEnabled:value})}}};}
async function register({local,draft=null,existing=true}={}){
 installation=existing===null?null:{installation_id:installationId,user_id:user.id,secret_hash:secretHash,permission:'granted',followed_comment_alerts_enabled:existing};bodies=[];paths=[];
 const client=sdk.createClient({storage:{getItem:key=>key===sdk.SESSION_STORAGE_KEY?JSON.stringify({accessToken,refreshToken:'synthetic-refresh',expiresAt:Date.now()+3600000}):null,setItem(){},removeItem(){}},persistentStorage:{getItem:()=>null},fetchImpl:async(url,options)=>{assert.equal(url,'/api/notifications');const body=JSON.parse(options.body);bodies.push(body);const result=await api(body);return{ok:true,status:200,json:async()=>result};}});
 const registration={pushManager:{getSubscription:async()=>({toJSON:()=>subscription})}};
 const context={console,Intl,Date,Promise,Uint8Array,Notification:{permission:'granted',requestPermission(){throw Error('Must not prompt');}},navigator:{userAgent:'Synthetic desktop',serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration)}},installedServiceWorkerRegistration:null,PushManager(){},userPreferences:preferences(local),draftPreferences:draft===null?null:preferences(draft),PUSH_INSTALLATION_STORAGE_KEY:'synthetic-installation',readStorage:()=>({installationId,secret}),writeStorage(){throw Error('Unexpected storage mutation');},serverSyncClient:client,fetch:async()=>({ok:true,json:async()=>({configured:true,publicKey:'synthetic-existing-subscription'})})};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);await context.ensurePushInstallation({requestPermission:false});return{payload:bodies.at(-1),context};
}
async function deviceDelivery({accountOn=true,commentOn=true}={}){
 const actor=crypto.randomUUID(),run={id:crypto.randomUUID(),event_id:'fixture:consent',recipient_user_id:user.id,actor_user_id:actor,claimed_at:new Date().toISOString()};let providerCalls=0;
 const request=async(path)=>{
  if(path.endsWith('nothingsports_claim_public_comment_runs'))return[run];
  if(path.includes('nothingsports_nsc_profiles?'))return[{handle:'followed'}];
  if(path.includes('nothingsports_nsc_personas?'))return[];
  if(path.includes('nothingsports_user_follows?'))return[{followed_user_id:actor}];
  if(path.includes('nothingsports_user_state?'))return[{preferences:{followFirst:{notifications:{enabled:accountOn,commentAlertsEnabled:commentOn}}}}]; // Account sync can still say ON.
  if(path.endsWith('nothingsports_public_comment_installations'))return installation?.permission==='granted'&&installation.followed_comment_alerts_enabled?[installation]:[];
  if(path.includes('nothingsports_inbox?')||path.includes('nothingsports_public_comment_runs?')||path.includes('nothingsports_public_comment_deliveries?'))return[];
  throw Error('Unexpected delivery request');
 };
 const result=await alerts.dispatch({request,api:{eventFor:()=>({id:run.event_id})},eligible:()=>true,send:async()=>{providerCalls++;},environment:{}});assert.equal(result.error,undefined);assert.equal(providerCalls,0,'device OFF prevents provider contact even with an unsynchronised account ON');
}
async function main(){
 try{
  let value=await register({local:true,draft:false,existing:true});assert.equal(installation.followed_comment_alerts_enabled,false,'draft comment OFF must disable this installation while the synced account still says ON');assert.equal(value.payload.commentAlertsEnabled,false);assert(!paths.some(path=>path.includes('user_state')),'device consent does not wait for or create another account-sync path');await deviceDelivery();
  value=await register({local:false,existing:true});assert.equal(value.payload.commentAlertsEnabled,false);assert.equal(installation.followed_comment_alerts_enabled,false,'saved local OFF is forwarded too');
  value=await register({local:undefined,existing:null});assert.equal(value.payload.commentAlertsEnabled,true);assert.equal(installation.followed_comment_alerts_enabled,true,'new accounts keep the agreed default ON');
  value=await register({local:false,draft:true,existing:false});assert.equal(value.payload.commentAlertsEnabled,true);assert.equal(installation.followed_comment_alerts_enabled,true,'deliberate draft ON can reenable this device');await deviceDelivery({accountOn:false});await deviceDelivery({commentOn:false});
  installation.followed_comment_alerts_enabled=false;await api({action:'register',installationId,secret,subscription});assert.equal(installation.followed_comment_alerts_enabled,false,'legacy omitted field must retain an existing OFF');
  installation=null;await api({action:'register',installationId,secret,subscription});assert.equal(installation.followed_comment_alerts_enabled,true,'legacy first registration retains default ON');installation.permission='denied';await deviceDelivery();
  const sql=fs.readFileSync('supabase/migrations/20261023222545_public_fixture_comments.sql','utf8');assert(sql.includes("i.permission='granted' and i.followed_comment_alerts_enabled"),'service installation selector must retain device permission and comment consent');
  console.log('Public comment consent: actual registration/SDK/API preserves draft/local OFF despite stale account ON, default ON, deliberate reenable, legacy OFF and device delivery suppression. Database boundary remains mocked.');
 }finally{if(priorApi)require.cache[apiPath]=priorApi;else delete require.cache[apiPath];require.cache[serverPath]=priorServer;}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
