'use strict';
// Preparation-only pure predicates for the EXISTING guard/supervisor to reuse.
// This module opens no socket, authorises no caller and starts no process. It
// cannot be substituted for the missing native HTTPS/CI integration or tests.
const SHA='c34bc991643c7f68ba856eec143d76c66ce4fb63';
const KEYS=['feeds/incoming/events.json','data/events.json'];
const URLS=Object.freeze(Array.from({length:4},(_,page)=>'https://footballapi.pulselive.com/football/fixtures?'+new URLSearchParams({comps:'1',comp:'1',compSeasons:'841',page:String(page),pageSize:'100',altIds:'true'})).concat('https://footballapi.pulselive.com/football/standings?compSeasons=841&comps=1&comp=1&altIds=true&page=0&pageSize=100'));
const HEADERS=Object.freeze({Accept:'application/json',Origin:'https://www.premierleague.com','User-Agent':'nothingsport-premier-league/1.0'});
const TIME=20000,FIXTURE=884736,TABLE=147456,TOTAL=3686400;
const FAILURE_CODES=Object.freeze(['EPL_NETWORK','EPL_SOURCE_DEADLINE','EPL_SOURCE_BYTES','EPL_SOURCE_JSON','EPL_SOURCE_HTTP','EPL_SOURCE_ENCODING','EPL_SOURCE_PARTIAL','EPL_UTF8','EPL_FIXTURE_COLLECTION','EPL_TABLE_ADMISSION','EPL_RESOURCE_INCOMPLETE','EPL_RESOURCE_DEADLINE','EPL_BODY_CAP','EPL_CLOSURE','EPL_PRIVACY','EPL_NATIVE_CONTAINMENT','EPL_CHILD_FAILURE','EPL_ROLLBACK_FAILURE']);
const fail=code=>{throw Object.assign(Error(code),{code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function exactKeys(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort());}
function selector(arg,p){
 if(typeof arg!=='string'||!arg.startsWith('--epl-updated-ids=')||Buffer.byteLength(arg)>65536)fail('EPL_SELECTOR');
 let value;try{const text=arg.slice('--epl-updated-ids='.length);require('./protocol.cjs').rejectDuplicateKeys(text);value=JSON.parse(text);}catch{fail('EPL_SELECTOR');}
 if(!exactKeys(value,KEYS))fail('EPL_SELECTOR');
 for(const file of KEYS){
  const ids=value[file],allowed=new Set(p.surfaceIds[file]);
  if(!Array.isArray(ids)||ids.length>380||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!allowed.has(id)||!p.surfaceBindings[file][id]))fail('EPL_SELECTOR');
 }
 return value;
}
const PREFIX=[['scripts/build-canonical-context-bundle.js'],['scripts/validate-premier-league-context.js']];
const TAIL=[['scripts/build-code-inspector.js','--codes=football'],['scripts/build-app-shell-runtime.js'],['scripts/apply-current-card-evidence.js','--check'],['scripts/validate-current-card-coverage.js'],['scripts/validate-feed-coverage-resilience.js'],['scripts/validate-feed.js','data/events.json'],['scripts/validate-crowd-foresight.js'],['scripts/build-follow-directories.js'],['scripts/build-follow-directories.js','--check']];
const PUB=['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'];
function childSequence(sequence,p){
 if(!Array.isArray(sequence))fail('EPL_CHILD_SEQUENCE');
 if(!sequence.length)return 'unchanged';
 const normalized=sequence.map(args=>{
  if(!Array.isArray(args)||args.some(a=>typeof a!=='string'))fail('EPL_CHILD_SEQUENCE');
  if(args[0]===PUB[0]){if(args.length!==7||!same(args.slice(0,6),PUB))fail('EPL_CHILD_SEQUENCE');selector(args[6],p);return [...PUB,'<validated-per-surface-ids>'];}
  return args;
 });
 const publish=[...PREFIX,[...PUB,'<validated-per-surface-ids>'],['scripts/qa-storyline-spoilers.js',KEYS[0]],['scripts/qa-storyline-spoilers.js',KEYS[1]],['scripts/build-paged-feed.js'],...TAIL];
 if(same(normalized,[...PREFIX,...TAIL]))return 'table-only';
 if(same(normalized,publish))return 'fixture-and-optional-table';
 fail('EPL_CHILD_SEQUENCE');
}
function policy(p){
 if(p.sourceGitSha!==SHA||p.runtimeReady!==false||p.status!=='UNALLOCATED_PREPARATION_CONTRACT_ONLY_NOT_EXECUTABLE_NATIVE_POLICY')fail('EPL_POLICY');
 if(!same(p.entryArgv,['scripts/update-cards.js','--quick','--source=epl','--local-only'])||!same(p.sourceArgv,['scripts/quick-results.js','--source=epl']))fail('EPL_ROUTE');
 if(p.wholeSeconds!==180||p.minimumSecondsBeforeLaunch!==160||p.minimumFreeBytes!==4831838208||p.maximumNewDiskBytes!==728303893||p.maxRollbackBytes!==268435456||p.maxFileBytes!==33554432||p.nodeVersion!=='v24.21.0')fail('EPL_RESOURCE_POLICY');
 if(!same(p.allocation,{status:'UNALLOCATED',nonce:null,notBefore:null,expiresAt:null})&&!same(p.allocation,{expiresAt:null,nonce:null,notBefore:null,status:'UNALLOCATED'}))fail('EPL_UNALLOCATED');
 if(p.credentialEnvironmentNames.length||p.environmentKeys.some(k=>/SUPABASE|API_TOKEN|SECRET|PASSWORD/.test(k)))fail('EPL_KEYLESS');
 if(Object.keys(p.rollbackInventory).length!==429||p.writeFiles.length!==161||new Set(p.writeFiles).size!==161||p.runtimeOutputs.length!==8||new Set(p.runtimeOutputs).size!==8)fail('EPL_INVENTORY');
 if(Object.values(p.rollbackInventory).reduce((sum,row)=>sum+row.bytes,0)>p.maxRollbackBytes)fail('EPL_ROLLBACK_CAP');
 for(const file of p.writeFiles)if(!p.rollbackInventory[file]||!Number.isSafeInteger(p.writeCaps[file])||p.writeCaps[file]<=0||p.writeCaps[file]>p.maxFileBytes||p.writeCaps[file]<p.rollbackInventory[file].bytes)fail('EPL_WRITE_POLICY');
 if(!same(Object.keys(p.surfaceIds).sort(),[...KEYS].sort()))fail('EPL_BASELINE_IDS');
 for(const file of KEYS)if(p.surfaceIds[file].length!==380||new Set(p.surfaceIds[file]).size!==380||Object.keys(p.surfaceBindings[file]).length!==380)fail('EPL_BASELINE_IDS');
 return true;
}
class Resources{
 constructor(){this.seen=new Set();this.active=null;this.closed=[];this.totalWire=0;this.totalDecoded=0;this.fixtureFailed=false;this.tableStarted=false;}
 request(index,{sourceOwner,caller,url,method='GET',headers},at){
  if(!sourceOwner||caller!=='scripts/lib/epl-source-json.js'||method!=='GET'||url!==URLS[index]||!same(headers,HEADERS)||!Number.isInteger(index)||index<0||index>4||!Number.isFinite(at))fail('EPL_REQUEST_SCOPE');
  if(this.active||this.seen.has(index)||this.seen.size>=5||this.tableStarted||index<4&&(this.fixtureFailed||index!==this.seen.size)||index===4&&!this.seen.has(0))fail('EPL_REQUEST_ORDER');
  this.seen.add(index);if(index===4)this.tableStarted=true;
  this.active={index,started:at,wire:0,decoded:0,headers:false,cap:index===4?TABLE:FIXTURE};
 }
 time(at){if(!this.active||!Number.isFinite(at)||at<this.active.started||at-this.active.started>=TIME)fail('EPL_RESOURCE_DEADLINE');}
 headers(status,encoding,at){this.time(at);if(this.active.headers||status!==200||!['identity','gzip','deflate','br'].includes(encoding))fail('EPL_RESPONSE');this.active.headers=true;}
 bytes(kind,count,at){
  this.time(at);if(!this.active.headers||!['wire','decoded'].includes(kind)||!Number.isSafeInteger(count)||count<0)fail('EPL_BYTES');
  const total=kind==='wire'?'totalWire':'totalDecoded';this.active[kind]=Math.min(this.active.cap+1,this.active[kind]+count);this[total]=Math.min(TOTAL+1,this[total]+count);
  if(this.active[kind]>this.active.cap||this[total]>TOTAL)fail('EPL_BODY_CAP');
 }
 finish({bodyComplete,jsonParsed,sourceAdmitted,readerClosed,requestClosed},at){
  this.time(at);if(!this.active.headers||![bodyComplete,jsonParsed,sourceAdmitted,readerClosed,requestClosed].every(v=>v===true))fail('EPL_RESOURCE_INCOMPLETE');
  const r=this.active;this.closed.push({resource:r.index,state:'complete',wireBytes:r.wire,decodedBytes:r.decoded,elapsedMs:at-r.started});this.active=null;
 }
 failure(code,at){
  if(!this.active||!Number.isFinite(at)||at<this.active.started||!FAILURE_CODES.includes(code))fail('EPL_FAILURE_RECEIPT');
  const r=this.active;if(r.index<4)this.fixtureFailed=true;this.closed.push({resource:r.index,state:'failed',code,wireBytes:r.wire,decodedBytes:r.decoded,elapsedMs:Math.max(0,Math.min(TIME,at-r.started))});this.active=null;
 }
 closure({sourceOwners,readersOpen,requestsOpen,writeDescriptorsOpen,processGroupClosed}){if(this.active||sourceOwners!==1||readersOpen!==0||requestsOpen!==0||writeDescriptorsOpen!==0||processGroupClosed!==true)fail('EPL_CLOSURE');return {requests:this.seen.size,wireBytes:this.totalWire,decodedBytes:this.totalDecoded,resources:this.closed};}
}
function protectedBundle(before,after,participantIds,officialSourceUrl){
 const selected=new Set(participantIds),comp='competition:premier-league-2026-27';
 const keep=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['generatedAt','sources','participants','ladderSnapshots'].includes(key)));
 if(!same(keep(before),keep(after))||!same(before.participants.filter(e=>!selected.has(e.id)),after.participants.filter(e=>!selected.has(e.id)))||!same(before.ladderSnapshots.filter(e=>e.competitionId!==comp),after.ladderSnapshots.filter(e=>e.competitionId!==comp))||!same(before.sources.filter(e=>!(e.provider==='Premier League'&&e.sourceUrl===officialSourceUrl)),after.sources.filter(e=>!(e.provider==='Premier League'&&e.sourceUrl===officialSourceUrl))))fail('EPL_SHARED_FACTS_CHANGED');
 return true;
}
const publicReceipt=value=>{
 if(!exactKeys(value,['resource','state','wireBytes','decodedBytes','elapsedMs','code'])&&!exactKeys(value,['resource','state','wireBytes','decodedBytes','elapsedMs']))fail('EPL_EXPORT');
 if(!Number.isInteger(value.resource)||value.resource<0||value.resource>4||!['failed','complete'].includes(value.state)||['wireBytes','decodedBytes'].some(k=>!Number.isSafeInteger(value[k])||value[k]<0||value[k]>(value.resource===4?TABLE:FIXTURE)+(value.state==='failed'?1:0))||!Number.isFinite(value.elapsedMs)||value.elapsedMs<0||value.elapsedMs>TIME||(value.state==='failed'?!FAILURE_CODES.includes(value.code):Object.hasOwn(value,'code')))fail('EPL_EXPORT');
 return {...value};
};
module.exports={SHA,KEYS,URLS,HEADERS,FAILURE_CODES,TIME,FIXTURE,TABLE,TOTAL,PREFIX,TAIL,PUB,selector,childSequence,policy,Resources,protectedBundle,publicReceipt};
