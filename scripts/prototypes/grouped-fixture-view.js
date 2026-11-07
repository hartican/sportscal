'use strict';
// SOURCE/LOCAL PROTOTYPE ONLY. Not imported by any refresh or migration owner.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const ORIGINAL='fbc28299a5bf25428b286adc5ee2e0da';
const md5=value=>crypto.createHash('md5').update(value).digest('hex');
const target='public.nothingsports_current_global_fixture_bundle';
function originalSource(original){
 if(md5(original)!==ORIGINAL)throw Error('Original global view differs');
 return original.trim().replace(/;$/,'');
}
function guard(hash){
 if(!/^[0-9a-f]{32}$/.test(hash))throw Error('Invalid view guard');
 const baseline=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261022100230_header_gated_fixture_components.sql'),'utf8').split('create or replace view ')[0];
 if(!baseline.includes(ORIGINAL))throw Error('Missing original private view guard');
 return baseline.replace(ORIGINAL,hash);
}
function candidate(original){
 const source=originalSource(original),start=source.indexOf('WITH calendar_windows AS MATERIALIZED'),split=source.match(/,\s*candidates AS MATERIALIZED\s*\(/),tailStart=source.indexOf('source_receipts AS MATERIALIZED');
 const final=source.match(/\n\s*SELECT json_build_object\('schemaVersion', 'current-fixture-bundle.v1'/);
 if(start<0||!split||tailStart<split.index||!final||final.index<tailStart)throw Error('Global source boundaries differ');
 const prefix=source.slice(start,split.index),projection=source.slice(tailStart,final.index);
 return `${prefix},
 group_keys AS MATERIALIZED(SELECT DISTINCT fixture_id FROM scope_keys ORDER BY fixture_id LIMIT 5001),
 limited_edges AS MATERIALIZED(SELECT source_id,fixture_id FROM scope_keys ORDER BY source_id,fixture_id LIMIT 10001),
 edge_keys AS MATERIALIZED(SELECT source_id,fixture_id,row_number()OVER(ORDER BY source_id,fixture_id)-1 AS ordinal FROM limited_edges),
 counts AS MATERIALIZED(SELECT(SELECT count(*)FROM group_keys)group_count,(SELECT count(*)FROM edge_keys)edge_count),
 limits AS MATERIALIZED(SELECT *,group_count<=5000 AND edge_count<=10000 AND NOT EXISTS(SELECT 1 FROM edge_keys GROUP BY fixture_id HAVING count(*)>16)AS complete FROM counts),
 candidates AS MATERIALIZED(SELECT e.source_id,e.fixture_id FROM edge_keys e WHERE(SELECT complete FROM limits)),
 ${projection}
 SELECT json_build_object('schemaVersion','fixture-source-groups.v1','complete',l.complete,'groupCount',l.group_count,'edgeCount',l.edge_count,'groups',coalesce((
 SELECT json_agg(json_build_object('fixture_id',g.fixture_id,'edges',g.edges)ORDER BY g.fixture_id)FROM(
 SELECT p.fixture_id,json_agg(json_build_object('source_id',p.source_id,'ordinal',e.ordinal,'identity_keys',p.identity_keys,'fixture',p.fixture)ORDER BY e.ordinal)edges
 FROM projected p JOIN edge_keys e USING(source_id,fixture_id)GROUP BY p.fixture_id)g),'[]'::json))FROM limits l`;
}
function forward(original){
 const source=originalSource(original),grouped=candidate(original);
 return `${guard(ORIGINAL)}
CREATE OR REPLACE VIEW ${target} WITH(security_invoker=true)AS
SELECT CASE WHEN current_user='service_role' AND(CASE WHEN coalesce(nullif(current_setting('request.headers',true),''),'{}') IS JSON OBJECT
 THEN nullif(current_setting('request.headers',true),'')::jsonb->>'x-ns-fixture-source-groups'='v1' ELSE false END)
 THEN(${grouped})ELSE(${source})END AS bundle;`;
}
function inverse(original,candidateMd5){return `${guard(candidateMd5)}\nCREATE OR REPLACE VIEW ${target} WITH(security_invoker=true)AS ${originalSource(original)};\n${guard(ORIGINAL)}`;}
module.exports={ORIGINAL,md5,candidate,forward,inverse};
