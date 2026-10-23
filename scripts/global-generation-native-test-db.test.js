'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{options,database}=require('./global-generation-native-test-db');
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
 for(const change of [{db:'postgres'},{role:'service_role'},{owner:'other'},{version:160001},{public_objects:1},{app_roles:1}]){
  const sql=[];let ended=false;
  class FakeClient {async connect(){}async end(){ended=true;}async query(q){sql.push(q);return {rows:[{db:'ns_generation_control_17',role:'postgres',owner:'postgres',version:170006,public_objects:0,app_roles:0,...change}]};}}
  Module._load=function(name,...args){return name==='pg'?{Client:FakeClient}:load.call(this,name,...args);};
  try{await assert.rejects(database(valid()));assert(ended);assert.equal(sql.length,1);assert(!sql.some(q=>/create|drop/i.test(q)));}finally{Module._load=load;}
 }
});
