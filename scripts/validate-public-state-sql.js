'use strict';
// One disposable PG17 functional qualification. No managed connection/provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PGlite}=require('pglite-pg17');
const root=path.resolve(__dirname,'..'),baselineSha='f7203908b2548e9d5a250b8c60a8e7f9775ed050';
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const md5=b=>crypto.createHash('md5').update(b).digest('hex');
const template=fs.readFileSync(path.join(__dirname,'capture-public-state.sql'),'utf8');
assert.equal(template.split('__CAPTURE_SOURCE_SHA__').length,2);
const baseline=fs.readFileSync(path.join(__dirname,'fixtures/public-state-capture-f7203908.sql'),'utf8');
assert.equal(digest(baseline),'a648a08d840971b22ff6eb181e63b8ec001c78af048e2c2b91e8fe8316bab86c');
const sql=template.replace('__CAPTURE_SOURCE_SHA__',sha),receiver=path.join(__dirname,'receive-public-state.py');
const baselineSql=baseline.replace('__CAPTURE_SOURCE_SHA__',baselineSha);
const proof={sourceGitSha:sha,baselineGitSha:baselineSha,baselineSqlSha256:digest(baseline),sourceSqlSha256:digest(template),renderedSqlSha256:digest(sql),receiverSha256:digest(fs.readFileSync(receiver)),cases:[],equivalence:[],ok:false,networkRequests:0,
 limits:['Constructed in-memory PostgreSQL17.5/WASM, not managed17.6/native/platform equivalence','No current accepted capture, physical performance or whole40MiB MCP delivery proof']};
let db,temp,network=0,stage='initialisation';const began=Date.now(),fetchBefore=global.fetch;
global.fetch=async()=>{network++;throw Error('Functional window denies network');};
const disk=()=>{const s=fs.statfsSync(root);assert(Number(s.bavail)*Number(s.bsize)>=8*1024**3,'Disk must retain8GiB available');assert(Date.now()-began<165000,'Functional window exhausted');};
async function reset(){await db.exec('TRUNCATE public.nothingsports_fixture_current,public.nothingsports_live_scores,public.nothingsports_fixture_sources;');}
async function source(){await db.exec("INSERT INTO public.nothingsports_fixture_sources(source_id,revision,failure_count) VALUES('qa',1,0);");}
async function runQuery(label,{refused=false,text=sql}={}){
 disk();stage=label;const started=Date.now(),result=await db.exec(text);
 const packets=result.flatMap(r=>r.rows||[]).filter(r=>Object.hasOwn(r,'capture_packet'));
 assert.equal(packets.length,1,'One statement returns one complete packet');const packet=packets[0].capture_packet;
 assert.equal(packet.status,refused?'refused':'ready');
 if(refused){assert.deepEqual(packet.parts,[]);assert.equal(packet.manifest_text,'');}
 proof.cases.push({name:label,status:packet.status,elapsedMs:Date.now()-started});return packet;
}
function equivalent(before,after){
 assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort());
 assert.equal(after.status,before.status);
 // Compare every raw line AND complete part bytes/descriptors: no parsed fact normalization.
 assert.deepEqual(after.parts,before.parts);
 for(let i=0;i<before.parts.length;i++){
  const left=Buffer.from(before.parts[i].data_base64,'base64'),right=Buffer.from(after.parts[i].data_base64,'base64');
  assert(left.equals(right),'Complete part bytes changed');
  assert.deepEqual(right.toString('utf8').split('\n'),left.toString('utf8').split('\n'),'Raw line bytes changed');
 }
 for(const packet of [before,after])assert.equal(md5(packet.manifest_text),packet.manifest_md5,'Manifest byte binding');
 const normalized=text=>{
  if(!text)return text;
  assert.equal((text.match(/"sourceGitSha": "[a-f0-9]{40}"/g)||[]).length,1);
  assert.equal((text.match(/"snapshotAt": "[^"]+"/g)||[]).length,1);
  return text.replace(/"sourceGitSha": "[a-f0-9]{40}"/,'"sourceGitSha": "<tooling-source>"')
   .replace(/"snapshotAt": "[^"]+"/,'"snapshotAt": "<statement-time>"');
 };
 assert.equal(normalized(after.manifest_text),normalized(before.manifest_text),'Manifest facts changed');
}
async function pair(label,{refused=false}={}){
 const before=await runQuery(label+' frozen f720',{refused,text:baselineSql});
 const after=await runQuery(label+' frame-only',{refused});equivalent(before,after);
 proof.equivalence.push({name:label,status:after.status,rawLineAndPartBytesIdentical:true,
  manifestIdenticalExcept:['sourceGitSha','snapshotAt'],parts:after.parts.length,
  partBytes:after.parts.reduce((sum,p)=>sum+p.bytes,0),partSha256:after.parts.map(p=>digest(Buffer.from(p.data_base64,'base64')))});
 return after;
}
function sensitivity(packet){
 // Rebind hashes after each deliberate fact edit, so checksum failure cannot mask it.
 function changed(edit){
  const next=structuredClone(packet),manifest=JSON.parse(next.manifest_text);
  assert.equal(next.parts.length,1,'Sensitivity fixture has one complete part');
  let text=next.manifest_text;
  for(const p of next.parts){
   const raw=Buffer.from(p.data_base64,'base64').toString('utf8'),altered=edit(raw);
   const bytes=Buffer.byteLength(altered),checksum=md5(altered);
   text=text.replace('"bytes": '+p.bytes,'"bytes": '+bytes).replace('"md5": "'+p.md5+'"','"md5": "'+checksum+'"');
   p.bytes=bytes;p.md5=checksum;p.data_base64=Buffer.from(altered).toString('base64');
  }
  text=text.replace('"partBytes": '+manifest.partBytes,'"partBytes": '+next.parts.reduce((sum,p)=>sum+p.bytes,0));
  const lines=next.parts.flatMap(p=>Buffer.from(p.data_base64,'base64').toString('utf8').split('\n').slice(0,-1));
  text=text.replace('"orderedRowsMd5": "'+manifest.orderedRowsMd5+'"',
   '"orderedRowsMd5": "'+md5(lines.map(line=>md5(line+'\n')).join(''))+'"');
  next.manifest_text=text;next.manifest_md5=md5(text);return next;
 }
 equivalent(packet,changed(raw=>raw)); // Rebinding alone must not introduce a spurious difference.
 for(const [name,from,to] of [
  ['decimal scale','1.230000','1.23'],['large integer','9007199254740993','9007199254740992'],
  ['source microseconds','2026-10-27T00:00:00.123456','2026-10-27T00:00:00.123457'],
  ['alias order','alias:z", "alias:日", "alias:a','alias:a", "alias:日", "alias:z'],
  ['SQL-null flag','"fixture_is_sql_null": true','"fixture_is_sql_null": false'],
  ['receipt presence','"receipt_key_present": true','"receipt_key_present": false']]){
  assert(packet.parts.some(p=>Buffer.from(p.data_base64,'base64').toString('utf8').includes(from)),name+' witnessed');
  assert.throws(()=>equivalent(packet,changed(raw=>raw.replace(from,to))),assert.AssertionError,name+' must not normalize');
  proof.cases.push({name:'equivalence rejects rebound '+name,status:'deliberate-difference-rejected'});
 }
 const altered=structuredClone(packet);
 // Preserve original formatting; alter only a manifest fact and rebind its MD5.
 altered.manifest_text=altered.manifest_text.replace('"receiptKeys": 2','"receiptKeys": 3');
 assert.notEqual(altered.manifest_text,packet.manifest_text);
 altered.manifest_md5=md5(altered.manifest_text);
 assert.throws(()=>equivalent(packet,altered),assert.AssertionError);
 proof.cases.push({name:'equivalence rejects rebound manifest fact',status:'deliberate-difference-rejected'});
}
function consume(packet,label,{expired=false}={}){
 const directory=path.join(temp,label),deadline=(Date.now()+ (expired?-1000:20000))/1000;
 const wire=JSON.stringify(packet); // Constructed local test only; operator uses incremental chunks.
 const result=cp.spawnSync('python3',[receiver,'--output',directory,'--source-sha',sha,'--deadline',String(deadline),'--input-bytes',String(Buffer.byteLength(wire))],
  {cwd:root,input:wire,encoding:'utf8',timeout:25000,maxBuffer:1024*1024,
   env:{PATH:process.env.PATH,LANG:'en_AU.UTF-8',PYTHONDONTWRITEBYTECODE:'1'}});
 assert.ifError(result.error);assert.equal(result.status,expired?1:0,result.stderr);
 if(expired){assert(!fs.existsSync(directory));assert(result.stderr.includes('CAPTURE_DEADLINE'));return;}
 const receipt=JSON.parse(result.stdout);assert.equal(receipt.state,'validated-public-reference-only');assert.equal(receipt.readerContextAccepted,false);
 for(const part of packet.parts)assert.equal(digest(fs.readFileSync(path.join(directory,part.name))),receipt.files.find(f=>f.name===part.name).sha256);
 proof.cases.push({name:label,status:receipt.state,parts:packet.parts.length,decodedBytes:receipt.decodedBytes});
}
(async()=>{
 try{
  disk();temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-public-state-pg17-')));
  db=await PGlite.create('memory://');const version=(await db.query("SELECT current_setting('server_version_num') AS n,version() AS version")).rows[0];
  assert.equal(Number(version.n),170005);proof.engine=version;
  await db.exec(`CREATE TABLE public.nothingsports_fixture_current(source_id text,fixture_id text,identity_keys text[],fixture jsonb,content_hash text,updated_at timestamptz,PRIMARY KEY(source_id,fixture_id));
   CREATE TABLE public.nothingsports_live_scores(source_id text,fixture_id text,score jsonb,content_hash text,first_completed_at timestamptz,PRIMARY KEY(source_id,fixture_id));
   CREATE TABLE public.nothingsports_fixture_sources(source_id text PRIMARY KEY,revision bigint,fixtures jsonb,checked_at timestamptz,next_due_at timestamptz,failure_count integer,discovery_report jsonb,lease_token uuid,lease_until timestamptz);`);
  stage='seed literal precision/null/receipt fields';
  await db.exec(`INSERT INTO public.nothingsports_fixture_current VALUES
   ('qa','fixture:qa',ARRAY['alias:z','alias:日','alias:a'],'{"id":"fixture:qa","big":9007199254740993,"decimal":1.230000,"name":"日","sourceCheckedAt":"2026-10-27T00:00:00.123456Z"}','core','2026-10-27T00:00:00.123456Z'),
   ('qa','fixture:sql-null',NULL,NULL,'sql-null',NULL),('qa','fixture:json-null',ARRAY[]::text[],'null','json-null',NULL);
   INSERT INTO public.nothingsports_live_scores VALUES
   ('qa','fixture:qa','{"big":9007199254740993,"decimal":1.230000}','score','2026-10-27T00:00:00.123456Z'),
   ('qa','fixture:sql-null',NULL,'sql-null',NULL),('qa','fixture:json-null','null','json-null',NULL);
   INSERT INTO public.nothingsports_fixture_sources VALUES
   ('qa',9007199254740993,'[{"id":"EXCLUDED_SOURCE_FIXTURES"}]','2026-10-27T00:00:00.123456Z',NULL,2,
    '{"_fixtureObservations":{"fixture:qa":{"s":"2026-10-27T00:00:00.123456Z","t":null}},"rawError":"EXCLUDED_RAW_REPORT","_highlightQuota":"EXCLUDED_QUOTA"}',
    '11111111-1111-4111-8111-111111111111','2026-10-28T00:00:00Z'),
   ('qb',2,NULL,NULL,NULL,0,'{"_fixtureObservations":null}',NULL,NULL),('qc',3,NULL,NULL,NULL,0,'{}',NULL,NULL),
   ('qd',4,NULL,NULL,NULL,0,NULL,NULL,NULL),('qe',5,NULL,NULL,NULL,0,'null',NULL,NULL);`);
  const unchanged=async()=> (await db.query("SELECT md5(string_agg(v::text,'' ORDER BY kind,id)) AS hash FROM (SELECT 'c'kind,source_id||fixture_id id,to_jsonb(c)v FROM public.nothingsports_fixture_current c UNION ALL SELECT 's',source_id||fixture_id,to_jsonb(s) FROM public.nothingsports_live_scores s UNION ALL SELECT 'm',source_id,to_jsonb(m) FROM public.nothingsports_fixture_sources m)x")).rows[0].hash;
  const before=await unchanged(),base=await pair('exact SQL precision/null/receipt capture');assert.equal(await unchanged(),before,'Read-only capture changes no stored row');
  const raw=Buffer.concat(base.parts.map(p=>Buffer.from(p.data_base64,'base64'))).toString('utf8');
  for(const literal of ['9007199254740993','1.230000','2026-10-27T00:00:00.123456','alias:z", "alias:日", "alias:a'])assert(raw.includes(literal),literal);
  for(const excluded of ['EXCLUDED_SOURCE_FIXTURES','EXCLUDED_RAW_REPORT','EXCLUDED_QUOTA','11111111-1111-4111-8111-111111111111','lease_token'])assert(!raw.includes(excluded),excluded);
  assert(raw.includes('"score_is_sql_null": true')&&raw.includes('"score_is_sql_null": false'));
  assert(raw.includes('"receipt_key_present": false')&&raw.includes('"receipt_key_present": true'));
  sensitivity(base);
  consume(base,'actual-sql-to-static-stdin');consume(base,'expired-actual-packet',{expired:true});proof.cases.push({name:'expired actual packet',status:'deadline-refused-no-output'});
  // The original five-second statement setting stays exact. This is not a timer benchmark.
  await reset();await pair('empty stored graph');
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture) SELECT 'qa','fixture:'||i,ARRAY['alias:'||i],jsonb_build_object('padding',repeat('x',1048576)) FROM generate_series(1,6)i;");
  const packedBefore=await unchanged(),packed=await pair('whole-row cumulative packing >4MiB');assert.equal(await unchanged(),packedBefore);
  assert(packed.parts.length>1);assert(packed.parts.every(p=>p.bytes<=4194304));consume(packed,'packed-static-stdin');
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) SELECT 'qa','fixture:'||i,'{}' FROM generate_series(1,10001)i;");
  await pair('count10001 refuses before values',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) VALUES('qa','large',jsonb_build_object('padding',repeat('x',4194304)));");
  await pair('row-byte overflow refuses',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) VALUES('qa','a-large',jsonb_build_object('padding',repeat('x',4193000))),('qa','b-small','{}');");
  await pair('conservative skew exceeds16bins and refuses',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) SELECT 'qa','fixture:'||i,jsonb_build_object('padding',repeat('x',2097152)) FROM generate_series(1,20)i;");
  await pair('whole40MiB plus framing refuses',{refused:true});
  disk();assert.equal(network,0);proof.ok=true;
 }catch(error){proof.failure={stage,code:error.code||null,message:String(error.message).slice(0,350)};process.exitCode=1;}
 finally{
  if(db){try{await db.close();proof.engineClosed=true;}catch(error){proof.engineClosed=false;proof.cleanupError=String(error.message).slice(0,150);proof.ok=false;process.exitCode=1;}}
  if(temp){fs.rmSync(temp,{recursive:true,force:true});proof.ownedTempRemoved=!fs.existsSync(temp);}
  global.fetch=fetchBefore;proof.networkRequests=network;proof.elapsedMs=Date.now()-began;console.log(JSON.stringify(proof,null,2));
 }
})();
