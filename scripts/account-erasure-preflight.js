#!/usr/bin/env node
'use strict';
// Operator-only SQL generator. No network, credentials, writes or deletion mode.
const fs=require('node:fs');
const SCHEMA_QUERY=`select ns.nspname as schema_name,c.relname as table_name,a.attname as column_name,
 case con.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'r' then 'RESTRICT' when 'a' then 'NO ACTION' when 'd' then 'SET DEFAULT' end as delete_rule
 from pg_constraint con join pg_class c on c.oid=con.conrelid
 join pg_namespace ns on ns.oid=c.relnamespace
 join pg_attribute a on a.attrelid=c.oid and a.attnum=con.conkey[1]
 where con.contype='f' and con.confrelid='auth.users'::regclass
 and ns.nspname='public' and cardinality(con.conkey)=1
 order by 1,2,3`;
const identifier=value=>{if(typeof value!=='string'||!/^[a-z_][a-z0-9_]*$/.test(value))throw Error('Unsafe schema identifier');return `"${value}"`;};
function buildPreflight(rows,userId){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId||''))throw Error('Expected exact account UUID');
 if(!Array.isArray(rows)||!rows.length)throw Error('Fresh direct-reference schema rows are required');
 const seen=new Set();
 const parts=rows.map(row=>{
  if(row.schema_name!=='public')throw Error('Only public direct account references are supported');
  const table=identifier(row.table_name),column=identifier(row.column_name);
  if(!['CASCADE','SET NULL','RESTRICT','NO ACTION','SET DEFAULT'].includes(row.delete_rule))throw Error('Unknown deletion rule');
  const label=`public.${row.table_name}.${row.column_name}`;if(seen.has(label))throw Error('Duplicate schema reference');seen.add(label);
  return `select '${label}' as reference,'${row.delete_rule}' as deletion_rule,count(*)::bigint as matching_rows from public.${table} where ${column}='${userId}'::uuid`;
 });
 return `-- Partial inventory only: direct Auth foreign keys. Counts overlap; do not sum as unique records.
-- JSON/text identities, indirect relations, Storage, caches and logs require separate review.
-- Zero counts do not certify erasure. No destructive SQL is generated.
begin read only;
set local statement_timeout='10s';
set local lock_timeout='1s';
select exists(select 1 from auth.users where id='${userId}'::uuid) as account_exists;
${parts.join('\nunion all\n')}\norder by deletion_rule,reference;
rollback;\n`;
}
module.exports={SCHEMA_QUERY,buildPreflight};
if(require.main===module){
 try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--schema-query')process.stdout.write(SCHEMA_QUERY+';\n');
  else if(args.length===4&&args[0]==='--schema'&&args[2]==='--user')process.stdout.write(buildPreflight(JSON.parse(fs.readFileSync(args[1],'utf8')),args[3]));
  else throw Error('Usage: node scripts/account-erasure-preflight.js --schema-query | --schema fresh-schema.json --user UUID');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
