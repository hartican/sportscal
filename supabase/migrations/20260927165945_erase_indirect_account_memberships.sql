set local lock_timeout='2s';
set local statement_timeout='15s';
-- Indirect identities use the same per-account lock as the direct write barrier.
create function private.nothingsports_guard_reward_eligibility()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; prior uuid[]:='{}';
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';end if;
 if tg_op='UPDATE' then prior:=old.eligible_user_ids;end if;
 if array_position(new.eligible_user_ids,null) is not null then raise exception 'reward_account_required';end if;
 -- Removing eligibility never needs to re-admit the remaining accounts.
 for actor in select distinct value from unnest(new.eligible_user_ids) value where not(value=any(prior)) order by value loop
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('account-erasure:'||actor::text,0));
  if not exists(select 1 from auth.users where id=actor) then raise exception 'reward_account_missing';end if;
  if exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=actor) then raise exception using errcode='55000',message='account_erasure_in_progress';end if;
 end loop;
 return new;
end $$;
revoke all on function private.nothingsports_guard_reward_eligibility() from public,anon,authenticated;
create trigger nothingsports_guard_reward_eligibility before insert or update of eligible_user_ids on public.nothingsports_nsc_reward_campaigns
for each row execute function private.nothingsports_guard_reward_eligibility();

create function private.nothingsports_guard_verified_email_subscription()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';end if;
 for actor in select id from auth.users where email_confirmed_at is not null and lower(trim(email))=lower(trim(new.email_normalized)) order by id loop
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('account-erasure:'||actor::text,0));
  if exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=actor) then raise exception using errcode='55000',message='account_erasure_in_progress';end if;
 end loop;
 return new;
end $$;
revoke all on function private.nothingsports_guard_verified_email_subscription() from public,anon,authenticated;
create trigger nothingsports_guard_verified_email_subscription before insert or update on public.nothingsports_marquee_subscribers
for each row execute function private.nothingsports_guard_verified_email_subscription();

create function private.nothingsports_erase_indirect_account_memberships()
returns trigger language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='account_erasure_guard_requires_read_committed';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account-erasure:'||old.id::text,0));
 update public.nothingsports_nsc_reward_campaigns set eligible_user_ids=array_remove(eligible_user_ids,old.id) where old.id=any(eligible_user_ids);
 if old.email_confirmed_at is not null and nullif(trim(old.email),'') is not null then
  delete from public.nothingsports_marquee_subscribers where email_normalized=lower(trim(old.email));
 end if;
 return old;
end $$;
revoke all on function private.nothingsports_erase_indirect_account_memberships() from public,anon,authenticated;
create trigger nothingsports_erase_indirect_account_memberships before delete on auth.users
for each row execute function private.nothingsports_erase_indirect_account_memberships();
