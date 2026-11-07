-- Database portion of erasure quiescence. No account is blocked by this migration.
-- Storage grants, external delivery and indirect JSON identities require separate handling.
set local lock_timeout='2s';
set local statement_timeout='15s';
create schema if not exists private;
create table public.nothingsports_account_erasure_blocks (
 user_id uuid primary key,
 started_at timestamptz not null default clock_timestamp()
);
comment on table public.nothingsports_account_erasure_blocks is 'Service-only erasure barrier; survives Auth deletion until scoped reconciliation. Contains no content or credentials.';
alter table public.nothingsports_account_erasure_blocks enable row level security;
alter table public.nothingsports_account_erasure_blocks force row level security;
revoke all on public.nothingsports_account_erasure_blocks from public,anon,authenticated;
grant all on public.nothingsports_account_erasure_blocks to service_role;

create function private.nothingsports_guard_erasure_write()
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
revoke all on function private.nothingsports_guard_erasure_write() from public,anon,authenticated;

create function private.nothingsports_begin_account_erasure(target_user_id uuid)
returns timestamptz language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare started timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';
 end if;
 if target_user_id is null then raise exception 'account_required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-erasure:'||target_user_id::text,0));
 select started_at into started from public.nothingsports_account_erasure_blocks where user_id=target_user_id;
 if started is not null then return started;end if;
 if not exists(select 1 from auth.users where id=target_user_id) then raise exception 'account_not_found';end if;
 insert into public.nothingsports_account_erasure_blocks(user_id) values(target_user_id) returning started_at into started;
 return started;
end $$;
revoke all on function private.nothingsports_begin_account_erasure(uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.nothingsports_begin_account_erasure(uuid) to service_role;
create function public.nothingsports_begin_account_erasure(target_user_id uuid)
returns timestamptz language sql security invoker set search_path='' as $$
 select private.nothingsports_begin_account_erasure(target_user_id);
$$;
revoke all on function public.nothingsports_begin_account_erasure(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_begin_account_erasure(uuid) to service_role;

-- Cover every current direct Auth reference, including service-owned writes and
-- both directions of relationships. A new Auth-referencing table needs this guard.
do $$
declare item record;
begin
 for item in
  select n.nspname,c.relname,string_agg(distinct quote_literal(a.attname),',' order by quote_literal(a.attname)) as arguments
  from pg_constraint k join pg_class c on c.oid=k.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  cross join lateral unnest(k.conkey) as key(attnum)
  join pg_attribute a on a.attrelid=c.oid and a.attnum=key.attnum
  where k.contype='f' and k.confrelid='auth.users'::regclass and n.nspname='public'
  group by n.nspname,c.relname order by n.nspname,c.relname
 loop
  execute format('create trigger nothingsports_account_erasure_guard after insert or update on %I.%I for each row execute function private.nothingsports_guard_erasure_write(%s)',item.nspname,item.relname,item.arguments);
 end loop;
end $$;
