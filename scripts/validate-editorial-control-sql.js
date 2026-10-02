'use strict';
const assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),{sql}=require('./editorial-control-sql');
(async()=>{const db=new PGlite();try{
 await db.exec('create table nothingsports_editorial_maintenance(event_id text primary key,revision integer default 0,held boolean default false,last_error jsonb,last_checked_at timestamptz,staged_copy jsonb,pending_copy jsonb,published_copy jsonb,published_git_sha text);');
 const report={sourceRevision:'a'.repeat(64),operations:[{eventId:'fixture',expectedRevision:0,change:{staged_copy:{hook:"A supporter's preview"},last_checked_at:'2026-10-02T13:00:00Z'}}]};
 await db.exec(sql(report));assert.equal((await db.query('select staged_copy from nothingsports_editorial_maintenance')).rows[0].staged_copy.hook,"A supporter's preview");
 await db.exec("update nothingsports_editorial_maintenance set held=true;");await assert.rejects(()=>db.exec(sql(report)),/changed or held/);
 await db.exec("update nothingsports_editorial_maintenance set held=false,revision=1;");await assert.rejects(()=>db.exec(sql(report)),/changed or held/);
 assert.throws(()=>sql({...report,operations:[{eventId:'fixture',expectedRevision:1,change:{held:false}}]}),/Unsupported/);
 console.log('Editorial connector writes: real Postgres staging, escaped copy, held/revision conflicts and denied control mutation passed.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
