'use strict';
// Prepare atomic compare-and-swap statements for the authorised Supabase connector.
const fs=require('node:fs'),assert=require('node:assert/strict');
function sql(report){
  assert(/^[a-f0-9]{64}$/.test(report.sourceRevision));
  assert(Array.isArray(report.operations));
  for(const op of report.operations){
    assert(typeof op.eventId==='string'&&!['evt_84','major-match:nrl-finals-2026:grand-final'].includes(op.eventId),'Protected or invalid fixture.');
    assert(Number.isInteger(op.expectedRevision)&&op.expectedRevision>=0);
    const allowed=['last_error','last_checked_at','staged_copy','pending_copy','published_copy','published_git_sha'];
    assert(Object.keys(op.change).every(k=>allowed.includes(k)),'Unsupported maintenance operation.');
  }
  const data=JSON.stringify(report.operations).replace(/'/g,"''");
  return `do $editorial$ declare op jsonb; current_row public.nothingsports_editorial_maintenance; next_row public.nothingsports_editorial_maintenance; begin
for op in select value from jsonb_array_elements('${data}'::jsonb) loop
insert into public.nothingsports_editorial_maintenance(event_id) values(op->>'eventId') on conflict do nothing;
select * into current_row from public.nothingsports_editorial_maintenance where event_id=op->>'eventId' for update;
if current_row.revision <> (op->>'expectedRevision')::integer or current_row.held then raise exception 'Editorial revision changed or held: %',op->>'eventId'; end if;
next_row := jsonb_populate_record(current_row,op->'change');
update public.nothingsports_editorial_maintenance set last_error=next_row.last_error,last_checked_at=next_row.last_checked_at,staged_copy=next_row.staged_copy,pending_copy=next_row.pending_copy,published_copy=next_row.published_copy,published_git_sha=next_row.published_git_sha where event_id=current_row.event_id;
end loop; end $editorial$;`;
}
if(require.main===module)console.log(sql(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))));
module.exports={sql};
