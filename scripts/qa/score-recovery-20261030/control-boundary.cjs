'use strict';
// Controlled request/Response/filesystem boundaries only. Actual mode rejects
// this preload and runs in the frozen checkout, without these owned stand-ins.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const native={read:fs.readFileSync.bind(fs),write:fs.writeFileSync.bind(fs),exists:fs.existsSync.bind(fs),readdir:fs.readdirSync.bind(fs)};
const p=JSON.parse(native.read(process.env.NS_SCORE_GUARD_POLICY,'utf8'));
if(p.mode!=='owned-control'||p.root===p.sourceRoot||!p.controlBoundary)throw Error('CONTROL_PROFILE_REQUIRED');
const root=path.resolve(p.root),source=path.resolve(p.sourceRoot),caseName=p.controlCase,marker=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!marker||marker.length<32)throw Error('SYNTHETIC_CREDENTIAL_REQUIRED');
const map=file=>{const x=path.resolve(String(file));for(const dir of ['data','feeds','assets/js'])if(x===source+'/'+dir||x.startsWith(source+'/'+dir+'/'))return root+x.slice(source.length);return x;};
fs.readFileSync=function(file,...args){const x=map(file);return native.read(x!==path.resolve(String(file))&&native.exists(x)?x:file,...args);};
fs.readdirSync=function(file,...args){const x=map(file);return native.readdir(x!==path.resolve(String(file))&&native.exists(x)?x:file,...args);};
for(const key of ['writeFileSync','appendFileSync','mkdirSync','mkdtempSync','unlinkSync','rmSync','rmdirSync','chmodSync','chownSync','utimesSync','truncateSync','openSync']){const original=fs[key];fs[key]=function(file,...args){
 if(caseName==='interrupted-rollback'&&key==='writeFileSync'&&map(file)===root+'/data/retained-only.json'&&native.exists(path.join(p.runDir,'first-error.json'))){native.write(map(file),'truncated rollback');for(;;){/* Native supervisor must close and restore the owned group. */}}
 return original.call(this,map(file),...args);
};}
for(const key of ['renameSync','copyFileSync']){const original=fs[key];fs[key]=function(a,b,...args){return original.call(this,map(a),map(b),...args);};}
const counts={constructedFetches:0,readerCancels:0,nativeConnections:0},streams=[];
const fixture=JSON.parse(native.read(p.coverageSport?path.join(__dirname,'rugby-control-fixture.json'):path.join(source,'scripts/fixtures/refresh-cricket-result-20261016.json'),'utf8')).result;
const now=()=>new Date().toISOString();
function row(index=0){
 const f=index===0?{...structuredClone(fixture),sourceCheckedAt:now()}:p.coverageSport?{id:'controlled-rugby-'+index,key:'rugby',name:'Controlled scheduled fixture '+index,status:'scheduled',startTimeUtc:'2026-11-12T03:00:00.000Z',sourceCheckedAt:now(),sourceName:'World Rugby',sourceType:'official',sourceUrl:fixture.sourceUrl}:{id:'fixture:cricket:CA:'+(50000+index),key:'cricket',name:'Controlled scheduled fixture '+index,status:'scheduled',startTimeUtc:'2026-11-12T03:00:00.000Z',sourceCheckedAt:now(),sourceName:'Cricket Australia',sourceType:'official',sourceUrl:'https://www.cricket.com.au/matches/'};
 return {source_id:p.coverageSport?'discovery-rugby-mru':'cricket-ca-current',fixture_id:f.id,fixture:f,identity_keys:[f.id]};
}
function payload(page){
 const paged=['short-pages','eight-full','later-failure','overlap','cumulative-overflow','cumulative-exact'].includes(caseName);
 const length=caseName==='row-overflow'?501:paged?(caseName==='short-pages'&&page===1||caseName==='cumulative-exact'&&page===3?1:500):1;
 const rows=Array.from({length},(_,i)=>row(page*500+i));
 if(caseName==='overlap'&&page===1)rows[0]=row(0);
 if(caseName==='cricket-source')rows[0].source_id='cricket-ca-current';
 if(caseName==='cricket-fixture')rows[0].fixture.key='cricket';
 if(caseName==='private-row')rows[0].user_id='private-account';
 if(caseName==='private-fixture')rows[0].fixture.preferences={follow:'private'};
 if(caseName==='private-nested')rows[0].fixture.participants=[{id:'team:cricket:australia',name:'Australia',access_token:'private-account'}];
 if(caseName==='unknown-field')rows[0].fixture.unreviewedExtra='unknown';
 if(caseName==='wrong-type')rows[0].fixture.name={unexpected:'object'};
 if(caseName.startsWith('secret-')&&caseName!=='secret-key-credential'){
  let secret=marker;
  if(caseName==='secret-percent')secret=[...secret].map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  if(caseName==='secret-base64')secret=Buffer.from(secret).toString('base64');
  if(caseName==='secret-hex-uppercase')secret=Buffer.from(secret).toString('hex').toUpperCase();
  if(caseName==='secret-double-unicode')secret=[...secret].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
  rows[0].fixture.name=secret;
 }
 let text=JSON.stringify(rows);
 if(caseName==='secret-unicode')text=text.replace(marker,[...marker].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''));
 if(caseName==='duplicate-key')text=text.replace('"name":','"name":"shadowed private value","name":');
 if(caseName==='invalid-json')text='{invalid';
 if(caseName==='page-exact'||caseName.startsWith('cumulative-'))text+=' '.repeat(4194304-Buffer.byteLength(text));
 if(caseName==='page-overflow')text+=' '.repeat(4194305-Buffer.byteLength(text));
 return Buffer.from(text);
}
global.fetch=async(input,options)=>{
 counts.constructedFetches++;const page=Number(new URL(input).searchParams.get('offset'))/500;
 if(caseName==='fd-exports'){
  fs.writeSync(1,marker.slice(0,12));fs.writeSync(1,marker.slice(12)+'\n');
  const escaped=JSON.stringify([...marker].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''));
  fs.writeSync(2,escaped.slice(0,37));fs.writeSync(2,escaped.slice(37)+'\n');
 }
 if(caseName==='fd-file-secret'){
  const fd=fs.openSync(path.join(root,'data/events.js'),'w');try{fs.writeSync(fd,marker.slice(0,12));fs.writeSync(fd,marker.slice(12));}finally{fs.closeSync(fd);}
  throw Error('controlled stop after descriptor boundary');
 }
 if(caseName==='stdio-secret'){process.stdout.write(marker.slice(0,10));process.stdout.write(marker.slice(10)+'\n');process.stderr.write(JSON.stringify({note:[...marker].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')})+'\n');}
 if(caseName==='headers-timeout')return new Promise(()=>{});
 if(caseName==='fetch-error-secret')throw Error(marker);
 const status=caseName==='auth401'?401:caseName==='auth403'?403:caseName==='redirect'?302:caseName==='later-failure'&&page===1?503:200;
 let body=caseName==='invalid-utf8'?Buffer.from([255]):payload(page);
 if(status!==200)body=Buffer.from(marker);
 const headers={'content-type':'application/json','content-length':String(caseName==='partial-length'?body.length+1:body.length)};
 if(caseName==='header-secret')headers['content-type']=marker;
 let response;
 if(caseName==='body-timeout')response=new Response(new ReadableStream({start(c){c.enqueue(Buffer.from('['));},cancel(){counts.readerCancels++;}}),{status,headers});
 else if(caseName==='stream-error-secret')response=new Response(new ReadableStream({pull(c){c.error(Error(marker));},cancel(){counts.readerCancels++;}}),{status,headers});
 else response=new Response(body,{status,headers});
 if(caseName==='parse-deadline'){
  const perf=require('node:perf_hooks').performance,original=perf.now.bind(perf),parse=JSON.parse;let matching=0,advance=0;
  Object.defineProperty(perf,'now',{configurable:true,value:()=>original()+advance});
  JSON.parse=function(text,...args){const result=parse.call(this,text,...args);if(typeof text==='string'&&text===body.toString()&&++matching===2)advance=10001;return result;};
 }
 streams.push(response.body);return response;
};
// Mutate only the existing public request boundary, after the guard's outer
// source-call admission. Its native fetch boundary must refuse each change.
const server=require(path.join(source,'lib/supabase-server')),request=server.supabaseServiceRequest;
server.supabaseServiceRequest=function(url,options){
 if(caseName==='bad-origin')options={...options,environment:{...process.env,SUPABASE_URL:'https://outside.invalid'}};
 if(caseName==='bad-rpc')url='/rest/v1/private_accounts';
 if(caseName==='bad-filter')url=url.replace(p.coverageSport?'discovery-rugby-mru':'cricket-ca-current','private-account-source');
 if(caseName==='bad-order')url=url.replace('source_id.asc,fixture_id.asc','fixture_id.desc');
 if(caseName==='bad-offset')url=url.replace('offset=0','offset=500');
 if(caseName==='bad-limit')url=url.replace('limit=500','limit=501');
 if(caseName==='bad-method')options={...options,method:'GET'};
 if(caseName==='bad-body')options={...options,body:{p_fixture_ids:['private-account']}};
 if(caseName==='bad-header')options={...options,headers:{Authorization:'Bearer wrong'}};
 return request.call(this,url,options);
};
module.exports={mapPath:map,summary:()=>({...counts,streamsLocked:streams.filter(s=>s?.locked).length}),rawRead:native.read,
 corruptCapture:()=>{if(caseName==='late-capture-corruption')native.write(path.join(p.runDir,'page-00.raw'),'controlled integrity fault\n');},
};
