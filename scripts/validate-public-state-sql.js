'use strict';
// One disposable PG17 functional qualification. No managed connection/provider.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const {PGlite}=require('pglite-pg17');
const root=path.resolve(__dirname,'..'),sha='5fdc5aad42aac5f3cf96c5671ab001cb56184cb0';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const template=fs.readFileSync(path.join(__dirname,'capture-public-state.sql'),'utf8');
assert.equal(template.split('__CAPTURE_SOURCE_SHA__').length,2);
const sql=template.replace('__CAPTURE_SOURCE_SHA__',sha),receiver=path.join(__dirname,'receive-public-state.py');
const proof={sourceSqlSha256:digest(template),renderedSqlSha256:digest(sql),receiverSha256:digest(fs.readFileSync(receiver)),cases:[],ok:false,networkRequests:0,
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
function consume(packet,label,{expired=false}={}){
 const directory=path.join(temp,label),deadline=(Date.now()+ (expired?-1000:20000))/1000;
 const result=cp.spawnSync('python3',[receiver,'--output',directory,'--source-sha',sha,'--deadline',String(deadline)],
  {cwd:root,input:JSON.stringify(packet),encoding:'utf8',timeout:25000,maxBuffer:1024*1024,
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
   ('qb',2,NULL,NULL,NULL,0,'{"_fixtureObservations":null}',NULL,NULL),('qc',3,NULL,NULL,NULL,0,'{}',NULL,NULL);`);
  const unchanged=async()=> (await db.query("SELECT md5(string_agg(v::text,'' ORDER BY kind,id)) AS hash FROM (SELECT 'c'kind,source_id||fixture_id id,to_jsonb(c)v FROM public.nothingsports_fixture_current c UNION ALL SELECT 's',source_id||fixture_id,to_jsonb(s) FROM public.nothingsports_live_scores s UNION ALL SELECT 'm',source_id,to_jsonb(m) FROM public.nothingsports_fixture_sources m)x")).rows[0].hash;
  const before=await unchanged(),base=await runQuery('exact SQL precision/null/receipt capture');assert.equal(await unchanged(),before,'Read-only capture changes no stored row');
  const raw=Buffer.concat(base.parts.map(p=>Buffer.from(p.data_base64,'base64'))).toString('utf8');
  for(const literal of ['9007199254740993','1.230000','2026-10-27T00:00:00.123456','alias:z", "alias:日", "alias:a'])assert(raw.includes(literal),literal);
  for(const excluded of ['EXCLUDED_SOURCE_FIXTURES','EXCLUDED_RAW_REPORT','EXCLUDED_QUOTA','11111111-1111-4111-8111-111111111111','lease_token'])assert(!raw.includes(excluded),excluded);
  assert(raw.includes('"score_is_sql_null": true')&&raw.includes('"score_is_sql_null": false'));
  assert(raw.includes('"receipt_key_present": false')&&raw.includes('"receipt_key_present": true'));
  consume(base,'actual-sql-to-static-stdin');consume(base,'expired-actual-packet',{expired:true});proof.cases.push({name:'expired actual packet',status:'deadline-refused-no-output'});
  // Stricter timeout is fault injection only; the operator SQL remains5s.
  stage='SQL deadline fault';
  try{await db.exec(sql.replace("statement_timeout = '5s'","statement_timeout = '1ms'"));proof.sqlTimeoutObservation={triggered:false,qualified:false,note:'Tiny query completed; timer expiry mechanism not proved. Actual expired receiver packet refusal is tested separately.'};}
  catch(error){assert(error.code==='57014'||/statement timeout/.test(error.message),error.message);proof.sqlTimeoutObservation={triggered:true,qualified:true,code:error.code,scope:'Constructed local WASM only'};}
  finally{await db.exec('ROLLBACK;');}
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture) SELECT 'qa','fixture:'||i,ARRAY['alias:'||i],jsonb_build_object('padding',repeat('x',1048576)) FROM generate_series(1,6)i;");
  const packed=await runQuery('whole-row cumulative packing >4MiB');assert(packed.parts.length>1);assert(packed.parts.every(p=>p.bytes<=4194304));consume(packed,'packed-static-stdin');
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) SELECT 'qa','fixture:'||i,'{}' FROM generate_series(1,10001)i;");
  await runQuery('count10001 refuses before values',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) VALUES('qa','large',jsonb_build_object('padding',repeat('x',4194304)));");
  await runQuery('row-byte overflow refuses',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) VALUES('qa','a-large',jsonb_build_object('padding',repeat('x',4193000))),('qa','b-small','{}');");
  await runQuery('conservative skew exceeds16bins and refuses',{refused:true});
  await reset();await source();
  await db.exec("INSERT INTO public.nothingsports_fixture_current(source_id,fixture_id,fixture) SELECT 'qa','fixture:'||i,jsonb_build_object('padding',repeat('x',2097152)) FROM generate_series(1,20)i;");
  await runQuery('whole40MiB plus framing refuses',{refused:true});
  disk();assert.equal(network,0);proof.ok=true;
 }catch(error){proof.failure={stage,code:error.code||null,message:String(error.message).slice(0,350)};process.exitCode=1;}
 finally{
  if(db){try{await db.close();proof.engineClosed=true;}catch(error){proof.engineClosed=false;proof.cleanupError=String(error.message).slice(0,150);proof.ok=false;process.exitCode=1;}}
  if(temp){fs.rmSync(temp,{recursive:true,force:true});proof.ownedTempRemoved=!fs.existsSync(temp);}
  global.fetch=fetchBefore;proof.networkRequests=network;proof.elapsedMs=Date.now()-began;console.log(JSON.stringify(proof,null,2));
 }
})();
