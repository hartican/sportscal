'use strict';
// SOURCE/LOCAL diagnostic proposal only. No producer, view or consumer change.
const producer=require('./grouped-fixture-view');
const {SCHEMA}=require('../../lib/fixture-source-groups');
function query(original){
 const candidate=producer.candidate(original);
 const marker="\n SELECT json_build_object('schemaVersion','"+SCHEMA+"'";
 const start=candidate.lastIndexOf(marker),ending='FROM limits l';
 if(start<0||!candidate.endsWith(ending))throw Error('Candidate diagnostic source boundaries differ');
 const body=candidate.slice(0,start),expression=candidate.slice(start).trim().slice('SELECT '.length,-ending.length).trim();
 // Counts/complete are existing scalar columns. The large envelope is built
 // once and retained as text; metadata never reparses it through JSON ->>.
 return `${body},
 diagnostic_frame AS MATERIALIZED(
 SELECT l.complete,l.group_count,l.edge_count,(${expression})::text AS serialized_candidate
 FROM limits l)
 SELECT statement_timestamp() AS observed_at,current_user AS reader_role,
 '${SCHEMA}'::text AS candidate_schema,complete AS candidate_complete,
 group_count AS groups,edge_count AS edges,
 octet_length(serialized_candidate) AS candidate_json_bytes,
 md5(serialized_candidate) AS candidate_json_md5,
 extract(epoch FROM(clock_timestamp()-statement_timestamp()))*1000 AS server_statement_elapsed_ms
 FROM diagnostic_frame`;
}
module.exports={query};
