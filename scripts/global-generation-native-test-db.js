'use strict';
// Dev-only adapter for this module's unchanged disposable-database interface.
// No URL, inherited PG target, TLS, remote host, existing app DB or auto-start.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
function options(env=process.env){
 assert.equal(env.NS_GENERATION_TEST_OWNED,'disposable-loopback-only');
 const major=Number(env.NS_GENERATION_TEST_MAJOR),port=Number(env.NS_GENERATION_TEST_PORT);
 assert([17,18].includes(major));assert(Number.isInteger(port)&&port>=1024&&port<=65535);
 assert.equal(env.NS_GENERATION_TEST_HOST,'127.0.0.1');
 assert.equal(env.NS_GENERATION_TEST_CONTROL,'ns_generation_control_'+major);
 assert(typeof env.NS_GENERATION_TEST_PASSWORD==='string'&&env.NS_GENERATION_TEST_PASSWORD.length>=16);
 return {major,host:'127.0.0.1',port,control:env.NS_GENERATION_TEST_CONTROL,password:env.NS_GENERATION_TEST_PASSWORD};
}
async function database(env=process.env){
 const o=options(env),{Client}=require('pg'),name='ns_generation_test_'+o.major+'_'+crypto.randomBytes(12).toString('hex'),marker=crypto.randomBytes(24).toString('hex');
 const config=database=>({host:o.host,port:o.port,user:'postgres',password:o.password,database,ssl:false,options:'',application_name:'ns-generation-disposable-test',connectionTimeoutMillis:3000,statement_timeout:6000,lock_timeout:1000,query_timeout:9000,idle_in_transaction_session_timeout:15000});
 const admin=new Client(config(o.control));let client,created=false,closed=false;
 async function close(){
  if(closed)return;closed=true;
  try{if(client)await client.end();}finally{
   try{if(created){const r=await admin.query('select obj_description(oid,\'pg_database\') marker from pg_database where datname=$1',[name]);assert.equal(r.rows[0]?.marker,marker,'Owned DB marker changed; refuse drop');await admin.query('drop database '+name);created=false;}}finally{await admin.end();}
  }
 }
 try{
  await admin.connect();
  const r=(await admin.query("select current_database() db,current_user role,current_setting('server_version_num')::int version,(select pg_get_userbyid(datdba)from pg_database where datname=current_database()) owner,(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') public_objects,(select count(*)::int from pg_roles where rolname in('anon','authenticated','service_role')) app_roles")).rows[0];
  assert.equal(r.db,o.control);assert.equal(r.role,'postgres');assert.equal(r.owner,'postgres');assert.equal(Math.floor(r.version/10000),o.major);assert.equal(r.public_objects,0,'Dedicated control DB must be empty');assert.equal(r.app_roles,0,'Dedicated cluster cannot contain app roles');
  // No IF NOT EXISTS or reuse. Only this newly created unpredictable database
  // can receive schema writes or be removed by close(). The control is read-only.
  await admin.query('create database '+name+' template template0');created=true;
  await admin.query("comment on database "+name+" is '"+marker+"'");
  client=new Client(config(name));await client.connect();
  await client.query("create temporary table qa_codec_probe(p json compression lz4);insert into qa_codec_probe select json_build_object('probe',repeat('lz4-probe-',2000));");
  const codec=(await client.query('select pg_column_compression(p) c from qa_codec_probe')).rows[0].c;assert.equal(codec,'lz4','Native engine must support actual LZ4 compression');await client.query('drop table qa_codec_probe');
  return {exec:sql=>client.query(sql),query:(sql,args)=>client.query(sql,args),close,engine:{kind:'native-postgresql',major:o.major,version:r.version,lz4:true,ownedDisposableDatabase:true,loopbackOnly:true}};
 }catch(e){try{await close();}catch(cleanup){e.cleanupError=cleanup.message;}throw e;}
}
module.exports={options,database};
