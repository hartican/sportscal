-- New authentication checks reject the account as soon as its barrier commits.
set local lock_timeout='2s';
set local statement_timeout='15s';
create or replace function private.nothingsports_begin_account_erasure(target_user_id uuid)
returns timestamptz language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare started timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';
 end if;
 if target_user_id is null then raise exception 'account_required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-erasure:'||target_user_id::text,0));
 select started_at into started from public.nothingsports_account_erasure_blocks where user_id=target_user_id;

 if started is null and not exists(select 1 from auth.users where id=target_user_id) then raise exception 'account_not_found';end if;
 if started is null then
  insert into public.nothingsports_account_erasure_blocks(user_id) values(target_user_id) returning started_at into started;
 end if;
 -- This is server-owned metadata, never the user-editable user_metadata object.
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('nothingsport_erasure_started_at',started)
 where id=target_user_id;
 return started;
end $$;
