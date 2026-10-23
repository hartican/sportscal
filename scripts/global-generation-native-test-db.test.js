'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{options,database,executionReport,OWNED_DATABASE_MARKER_SQL}=require('./global-generation-native-test-db');
const valid=()=>({NS_GENERATION_TEST_OWNED:'disposable-loopback-only',NS_GENERATION_TEST_HOST:'127.0.0.1',NS_GENERATION_TEST_PORT:'55432',NS_GENERATION_TEST_CONTROL:'ns_generation_control_17',NS_GENERATION_TEST_MAJOR:'17',NS_GENERATION_TEST_PASSWORD:'constructed-test-password'});
test('only explicit dedicated owned loopback targets admit before loading pg',()=>{
 const good=valid();assert.equal(options(good).major,17);assert.equal(options({...good,NS_GENERATION_TEST_MAJOR:'18',NS_GENERATION_TEST_CONTROL:'ns_generation_control_18'}).major,18);
 for(const key of Object.keys(good)){const absent={...good};delete absent[key];assert.throws(()=>options(absent),undefined,key);}
 for(const change of [{NS_GENERATION_TEST_HOST:'localhost'},{NS_GENERATION_TEST_HOST:'project.supabase.co'},{NS_GENERATION_TEST_HOST:'::1'},{NS_GENERATION_TEST_PORT:'443'},{NS_GENERATION_TEST_PORT:'65536'},{NS_GENERATION_TEST_CONTROL:'postgres'},{NS_GENERATION_TEST_CONTROL:'customer'},{NS_GENERATION_TEST_MAJOR:'16'},{NS_GENERATION_TEST_OWNED:'yes'},{NS_GENERATION_TEST_PASSWORD:''}])assert.throws(()=>options({...good,...change}));
 assert.equal(options({...good,PGHOST:'remote',DATABASE_URL:'postgres://remote/customer'}).host,'127.0.0.1','General app/env connection targets are ignored');
});
test('absent native allocation refuses before any dependency or network access',async()=>{await assert.rejects(database({}),/AssertionError/);});
test('nonempty or wrong-engine controls refuse before any CREATE/DROP',async()=>{
 const Module=require('node:module'),load=Module._load;
 for(const change of [{db:'postgres'},{role:'service_role'},{owner:'other'},{version:160001},{public_objects:1},{user_schemas:1},{user_relations:1},{user_functions:1},{user_types:1},{app_roles:1}]){
  const sql=[];let ended=false;
  class FakeClient {async connect(){}async end(){ended=true;}async query(q){sql.push(q);return {rows:[{db:'ns_generation_control_17',role:'postgres',owner:'postgres',version:170006,public_objects:0,user_schemas:0,user_relations:0,user_functions:0,user_types:0,app_roles:0,...change}]};}}
  Module._load=function(name,...args){return name==='pg'?{Client:FakeClient}:load.call(this,name,...args);};
  try{await assert.rejects(database(valid()));assert(ended);assert.equal(sql.length,1);assert(!sql.some(q=>/create|drop/i.test(q)));}finally{Module._load=load;}
 }
});

test('stock empty control shape reaches CREATE; unknown catalog counts never admit',async()=>{
 const Module=require('node:module'),load=Module._load;
 for(const omitted of [null,'user_schemas','user_relations','user_functions','user_types']){
  const sql=[];let ended=false;
  class FakeClient {async connect(){}async end(){ended=true;}async query(q){sql.push(q);if(q.startsWith('create database '))throw Error('CONSTRUCTED_STOP_BEFORE_CREATE');const row={db:'ns_generation_control_17',role:'postgres',owner:'postgres',version:170006,public_objects:0,user_schemas:0,user_relations:0,user_functions:0,user_types:0,app_roles:0};if(omitted)delete row[omitted];return {rows:[row]};}}
  Module._load=function(name,...args){return name==='pg'?{Client:FakeClient}:load.call(this,name,...args);};
  try{await assert.rejects(database(valid()),omitted?/Dedicated control/:/CONSTRUCTED_STOP_BEFORE_CREATE/);assert(ended);assert.equal(sql.length,omitted?1:2);assert(!sql.some(q=>q.startsWith('drop database ')));for(const catalog of ['pg_namespace','pg_class','pg_proc','pg_type'])assert(sql[0].includes(catalog));}finally{Module._load=load;}
 }
});
test('native execution reporting is explicit uncounted, never a false zero',()=>{
 assert.deepEqual(executionReport(null),{nativeCalls:0,nativeExecution:'none'});
 assert.deepEqual(executionReport({engine:{kind:'native-postgresql'}}),{nativeCalls:null,nativeExecution:'owned-test-loopback'});
 const source=require('node:fs').readFileSync(__dirname+'/validate-global-read-generation.js','utf8');assert(source.includes("...require('./global-generation-native-test-db').executionReport(native)"));assert(!source.includes('captureReplays:0,nativeCalls:0'));
});

test('actual database comment catalog lookup preserves and refuses ownership markers',async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
  const name=(await db.query('select current_database() name')).rows[0].name;
  const comment=async value=>db.exec((await db.query("select format('comment on database %I is %L',current_database(),$1::text) sql",[value])).rows[0].sql);
  const marker='constructed-owned-marker';await comment(marker);
  const lookup=async target=>(await db.query(OWNED_DATABASE_MARKER_SQL,[target])).rows[0]?.marker;
  assert.equal(await lookup(name),marker,'Adapter must read the actual shared database comment');
  // The former lookup searches the per-database comment catalog and cannot
  // establish database ownership. This is real SQL, not a mocked return value.
  assert.equal((await db.query("select obj_description(oid,'pg_database') marker from pg_database where datname=$1",[name])).rows[0].marker,null);
  await comment('changed-marker');assert.notEqual(await lookup(name),marker);
  await comment(null);assert.equal(await lookup(name),null);
  assert.equal(await lookup('ns_generation_missing_constructed_database'),undefined);
 }finally{await db.close();}
});

test('close drops only the newly owned marked database; changed/null/missing markers refuse',async()=>{
 const Module=require('node:module'),load=Module._load;
 for(const mode of ['owned','changed','null','missing']){
  const sql=[],ended=[];let marker,name;
  class FakeClient {
   constructor(config){this.name=config.database;}
   async connect(){}async end(){ended.push(this.name);}
   async query(q,args){
    sql.push({q,args});
    if(q.startsWith('select current_database()'))return {rows:[{db:'ns_generation_control_17',role:'postgres',owner:'postgres',version:170006,public_objects:0,user_schemas:0,user_relations:0,user_functions:0,user_types:0,app_roles:0}]};
    if(q.startsWith('create database ')){name=q.split(' ')[2];assert.match(name,/^ns_generation_test_17_[a-f0-9]{24}$/);}
    if(q.startsWith('comment on database ')){marker=q.match(/is '([a-f0-9]{48})'$/)[1];assert(q.includes(name));}
    if(q.startsWith('select pg_column_compression'))return {rows:[{c:'lz4'}]};
    if(q===OWNED_DATABASE_MARKER_SQL){assert.deepEqual(args,[name]);return {rows:mode==='missing'?[]:[{marker:mode==='owned'?marker:mode==='null'?null:'changed-marker'}]};}
    return {rows:[]};
   }
  }
  Module._load=function(target,...args){return target==='pg'?{Client:FakeClient}:load.call(this,target,...args);};
  try{
   const db=await database(valid());
   if(mode==='owned'){await db.close();await db.close();assert.deepEqual(sql.filter(x=>x.q.startsWith('drop database ')).map(x=>x.q),['drop database '+name]);}
   else{await assert.rejects(db.close(),/Owned DB marker changed/);assert(!sql.some(x=>x.q.startsWith('drop database ')));}
   assert.deepEqual(ended,[name,'ns_generation_control_17']);
  }finally{Module._load=load;}
 }
});
