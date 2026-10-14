'use strict';
// Private reports contain account-independent editorial controls. This emits SQL
// for the existing release owner; it never connects or mutates the database.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
function sql(report){
 assert(/^[a-f0-9]{64}$/.test(report.sourceRevision)&&Array.isArray(report.operations));
 const literal=value=>"'"+JSON.stringify(value).replace(/'/g,"''")+"'::jsonb",lines=['begin;'];
 if(report.sha){assert(/^[a-f0-9]{40}$/.test(report.sha));const ids=new Set(report.operations.map(o=>o.eventId)),records=report.records||[],transaction=records.filter(r=>ids.has(r.eventId)),ordinary=records.filter(r=>!ids.has(r.eventId));lines.push('select public.nothingsports_commit_epic_publication('+literal(report.operations)+','+literal(transaction)+');');for(let i=0;i<ordinary.length;i+=100)lines.push('select public.nothingsports_record_classic_fixtures('+literal(ordinary.slice(i,i+100))+');');lines.push('commit;');return lines.join('\n')+'\n';}
 for(const operation of report.operations){assert(/^[A-Za-z0-9_:./-]{1,180}$/.test(operation.eventId)&&Number.isInteger(operation.revision));assert.equal(operation.change.revision,operation.revision+1);assert(Object.keys(operation.change).every(k=>['revision','status','staged_copy','published_signature','last_error'].includes(k)));const event="'"+operation.eventId+"'";
  lines.push(`do $$begin if not exists(select 1 from public.nothingsports_editorial_backlog where event_id=${event} and revision=${operation.revision} and not held and editorial_eligible for update) then raise exception 'epic_revision_conflict';end if;end $$;`);
 }
 // Lock and verify revisions before snapshot insertion can update metadata.
 for(let i=0;i<(report.records||[]).length;i+=100)lines.push('select public.nothingsports_record_classic_fixtures('+literal(report.records.slice(i,i+100))+');');
 for(const operation of report.operations){const changes=Object.entries(operation.change).map(([k,v])=>k+'='+((k==='staged_copy'||k==='last_error')?(v===null?'null':literal(v)):typeof v==='number'?String(v):v===null?'null':"'"+String(v).replace(/'/g,"''")+"'"));lines.push(`update public.nothingsports_editorial_backlog set ${changes.join(',')},updated_at=now() where event_id='${operation.eventId}';`);}
 lines.push('commit;');return lines.join('\n')+'\n';
}
if(require.main===module){const file=process.argv[2];assert(path.isAbsolute(file));assert.equal(fs.statSync(file).mode&0o077,0,'Private report permissions required.');process.stdout.write(sql(JSON.parse(fs.readFileSync(file,'utf8'))));}
module.exports={sql};
