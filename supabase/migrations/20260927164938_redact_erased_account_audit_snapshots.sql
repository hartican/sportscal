set local lock_timeout='2s';
set local statement_timeout='15s';
create or replace function private.nothingsports_guard_erasure_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;actors uuid[]:='{}';column_name text;null_only boolean:=false;
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';
 end if;
 -- FK SET NULL actions must be able to detach attribution during Auth deletion,
 -- even when another column in the same row still references that account.
 if tg_op='UPDATE' then
  null_only:=(to_jsonb(new)-tg_argv)=(to_jsonb(old)-tg_argv) and to_jsonb(new)<>to_jsonb(old);
  -- Auth FK detachment may also erase this subject's copied audit snapshots.
  -- Only this table, a removed target, empty snapshots and otherwise unchanged
  -- content qualify; arbitrary edits still pass through the erasure barrier.
  if tg_table_schema='public' and tg_table_name='nothingsports_nsc_admin_audit'
     and to_jsonb(old)->>'target_user_id' is not null
     and to_jsonb(new)->>'target_user_id' is null
     and to_jsonb(new)->'before_state'='{}'::jsonb
     and to_jsonb(new)->'after_state'='{}'::jsonb then
   null_only:=(to_jsonb(new)-tg_argv-array['before_state','after_state'])
             =(to_jsonb(old)-tg_argv-array['before_state','after_state']);
  end if;
  foreach column_name in array tg_argv loop
   if (to_jsonb(new)->column_name) is distinct from (to_jsonb(old)->column_name)
      and (to_jsonb(new)->>column_name) is not null then null_only:=false;end if;
  end loop;
  if null_only then return new;end if;
 end if;
 foreach column_name in array tg_argv loop
  actor:=(to_jsonb(new)->>column_name)::uuid;
  if actor is not null then actors:=array_append(actors,actor);end if;
 end loop;
 for actor in select distinct a from unnest(actors) a order by a loop
  -- The shared transaction lock drains already-accepted writes before begin returns.
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('account-erasure:'||actor::text,0));
  if exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=actor) then
   raise exception using errcode='55000',message='account_erasure_in_progress';
  end if;
 end loop;
 return new;
end $$;

create function private.nothingsports_redact_detached_audit_subject()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.before_state:='{}'::jsonb;
 new.after_state:='{}'::jsonb;
 return new;
end $$;
revoke all on function private.nothingsports_redact_detached_audit_subject() from public,anon,authenticated;
create trigger nothingsports_redact_detached_audit_subject
before update of target_user_id on public.nothingsports_nsc_admin_audit
for each row when (old.target_user_id is not null and new.target_user_id is null)
execute function private.nothingsports_redact_detached_audit_subject();
