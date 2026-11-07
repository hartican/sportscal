-- Account intent survives device permission, delivery and later app closure.
alter table public.nothingsports_push_installations add column sporting_reminders_enabled boolean not null default true;
alter table public.nothingsports_reminders add column reminder_origin text not null default 'manual' check(reminder_origin in('manual','automatic')),
 add column timing_precision text not null default 'exact' check(timing_precision in('exact','not-before')),
 add column late_published_at timestamptz,add column delivery_started_at timestamptz;
create table public.nothingsports_reminder_intents(
 user_id uuid not null references auth.users(id) on delete cascade,fixture_id text not null check(length(fixture_id) between 1 and 180),
 aliases jsonb not null default '[]',choice text not null check(choice in('automatic','on','off')),
 enabled boolean not null default false,state_revision timestamptz,chosen_at timestamptz,checked_at timestamptz,primary key(user_id,fixture_id)
);
create table public.nothingsports_reminder_policy_epoch(singleton boolean primary key default true check(singleton),enabled boolean not null default false,activated_at timestamptz);
insert into public.nothingsports_reminder_policy_epoch(singleton) values(true);
alter table public.nothingsports_reminder_policy_epoch enable row level security;
alter table public.nothingsports_reminder_policy_epoch force row level security;
revoke all on public.nothingsports_reminder_policy_epoch from public,anon,authenticated;
grant select,update on public.nothingsports_reminder_policy_epoch to service_role;
create function public.nothingsports_activate_fixture_reminders() returns void language sql security invoker set search_path='' as $$ update public.nothingsports_reminder_policy_epoch set enabled=true,activated_at=clock_timestamp() where singleton and not enabled $$;
revoke all on function public.nothingsports_activate_fixture_reminders() from public,anon,authenticated;
grant execute on function public.nothingsports_activate_fixture_reminders() to service_role;

create table public.nothingsports_reminder_account_checks(user_id uuid primary key references auth.users(id) on delete cascade,checked_at timestamptz not null);
alter table public.nothingsports_reminder_intents enable row level security;
alter table public.nothingsports_reminder_intents force row level security;
alter table public.nothingsports_reminder_account_checks enable row level security;
alter table public.nothingsports_reminder_account_checks force row level security;
revoke all on public.nothingsports_reminder_intents,public.nothingsports_reminder_account_checks from public,anon,authenticated;
grant all on public.nothingsports_reminder_intents,public.nothingsports_reminder_account_checks to service_role;
do $$ declare s record;a record;stamp timestamptz;key text;begin
 for s in select user_id,event_user_state,updated_at from public.nothingsports_user_state where not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=nothingsports_user_state.user_id) loop
  for a in select * from jsonb_each(coalesce(s.event_user_state,'{}')) loop
   if not a.value ? 'reminderRequested' then continue;end if;
   begin stamp:=coalesce((a.value->>'reminderChangedAt')::timestamptz,(a.value->>'lastActionAt')::timestamptz,s.updated_at);exception when others then stamp:=s.updated_at;end;
   key:=coalesce(a.value->>'canonicalEventId',a.value->>'actionKey',a.key);if length(key) not between 1 and 180 then continue;end if;
   insert into public.nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at) values(s.user_id,key,jsonb_build_array(a.key,coalesce(a.value->>'eventId',key)),case when a.value->>'reminderRequested'='true' then 'on' else 'off' end,a.value->>'reminderRequested'='true',stamp)
   on conflict(user_id,fixture_id) do update set choice=excluded.choice,enabled=excluded.enabled,chosen_at=excluded.chosen_at where public.nothingsports_reminder_intents.chosen_at<excluded.chosen_at;
  end loop;
 end loop;
 insert into public.nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at)
 select distinct on(r.user_id,r.event_id) r.user_id,r.event_id,jsonb_build_array(r.event_id),'on',true,r.updated_at from public.nothingsports_reminders r where r.user_id is not null and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id) order by r.user_id,r.event_id,r.updated_at desc
 on conflict(user_id,fixture_id) do nothing;
end $$;

create index nothingsports_reminder_account_order on public.nothingsports_reminder_account_checks(checked_at,user_id);

-- A synced offline choice is accepted only at its own action time. Unrelated
-- activity does not refresh that time or override a newer reminder decision.
create function public.nothingsports_sync_reminder_choices() returns trigger language plpgsql security definer set search_path='' as $$
declare a record;key text;stamp timestamptz;existing public.nothingsports_reminder_intents;begin
 if exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=new.user_id) then return new;end if;
 for a in select * from jsonb_each(coalesce(new.event_user_state,'{}')) loop
  if a.value->>'reminderChoice' is null and a.value ? 'reminderRequested' and (tg_op='INSERT' or (old.event_user_state->a.key->>'reminderRequested') is distinct from (a.value->>'reminderRequested')) then
   a.value:=a.value||jsonb_build_object('reminderChoice',case when a.value->>'reminderRequested'='true' then 'on' else 'off' end,'reminderChangedAt',a.value->>'lastActionAt');
  end if;
  if a.value->>'reminderChoice' not in('on','off') then continue;end if;
  if (a.value->>'reminderChangedAt') is null then continue;end if;
  begin stamp:=(a.value->>'reminderChangedAt')::timestamptz;exception when others then continue;end;
  if stamp>clock_timestamp()+interval '5 minutes' then continue;end if;
  select * into existing from public.nothingsports_reminder_intents i where i.user_id=new.user_id and (i.fixture_id=a.key or i.aliases ? a.key) order by i.chosen_at desc nulls last limit 1;
  key:=coalesce(existing.fixture_id,a.value->>'canonicalEventId',a.key);
  if existing.chosen_at is not null and stamp<existing.chosen_at then
   new.event_user_state:=jsonb_set(new.event_user_state,array[a.key],a.value||jsonb_build_object('reminderChoice',existing.choice,'reminderRequested',existing.choice='on','reminderChangedAt',existing.chosen_at));continue;
  end if;
  insert into public.nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at)
   values(new.user_id,key,coalesce(existing.aliases,jsonb_build_array(a.key)),a.value->>'reminderChoice',a.value->>'reminderChoice'='on',stamp)
   on conflict(user_id,fixture_id) do update set choice=excluded.choice,enabled=excluded.enabled,chosen_at=excluded.chosen_at;
  if a.value->>'reminderChoice'='off' then
   update public.nothingsports_reminders set schedule_state='off',claimed_at=null,updated_at=clock_timestamp()
    where user_id=new.user_id and dispatched_at is null and (event_id=key or coalesce(existing.aliases,'[]') ? event_id);
  end if;
 end loop;return new;
end $$;
create trigger nothingsports_reminder_choices before insert or update of event_user_state on public.nothingsports_user_state for each row execute function public.nothingsports_sync_reminder_choices();
revoke all on function public.nothingsports_sync_reminder_choices() from public,anon,authenticated;

create function public.nothingsports_set_reminder_choice(target_user uuid,fixture_key text,fixture_aliases jsonb,enabled boolean) returns void
language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare row public.nothingsports_user_state;stamp timestamptz:=clock_timestamp();begin
 if exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=target_user) then raise exception 'Account unavailable';end if;
 if length(fixture_key) not between 1 and 180 or jsonb_typeof(fixture_aliases)<>'array' or jsonb_array_length(fixture_aliases)>30 then raise exception 'Invalid fixture';end if;
 select * into row from public.nothingsports_user_state where user_id=target_user for update;
 if not found then raise exception 'Saved account state required';end if;
 stamp:=greatest(stamp,row.updated_at+interval '1 millisecond');
 insert into public.nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,chosen_at)
 values(target_user,fixture_key,fixture_aliases,case when enabled then 'on' else 'off' end,enabled,stamp)
 on conflict(user_id,fixture_id) do update set aliases=excluded.aliases,choice=excluded.choice,enabled=excluded.enabled,chosen_at=excluded.chosen_at;
 update public.nothingsports_user_state set event_user_state=jsonb_set(coalesce(event_user_state,'{}'),array[fixture_key],coalesce(event_user_state->fixture_key,'{}')||jsonb_build_object('actionKey',fixture_key,'canonicalEventId',fixture_key,'reminderRequested',enabled,'reminderChoice',case when enabled then 'on' else 'off' end,'reminderChangedAt',stamp,'lastActionAt',stamp)),updated_at=stamp where user_id=target_user;
 if not enabled then update public.nothingsports_reminders set schedule_state='off',claimed_at=null,updated_at=stamp where user_id=target_user and dispatched_at is null and (event_id=fixture_key or fixture_aliases ? event_id);end if;
end $$;

create function public.nothingsports_reminder_accounts(target_user uuid default null) returns table(user_id uuid,preferences jsonb,actions jsonb,updated_at timestamptz,intents jsonb)
language sql security invoker set search_path='' set statement_timeout='3s' as $$
 select s.user_id,s.preferences,s.event_user_state,s.updated_at,coalesce((select jsonb_agg(jsonb_build_object('fixtureId',i.fixture_id,'aliases',i.aliases,'choice',i.choice,'enabled',i.enabled,'chosenAt',i.chosen_at)) from public.nothingsports_reminder_intents i where i.user_id=s.user_id),'[]')
 from public.nothingsports_user_state s left join public.nothingsports_reminder_account_checks c using(user_id)
 where (target_user is null or s.user_id=target_user) and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=s.user_id)
 order by c.checked_at nulls first,s.user_id limit 20
$$;

create function public.nothingsports_reconcile_reminder_accounts(packets jsonb) returns integer
language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare p record;f record;s public.nothingsports_user_state;i public.nothingsports_reminder_intents;stamp timestamptz:=clock_timestamp();changed integer:=0;alerts boolean;begin
 if jsonb_typeof(packets)<>'array' or jsonb_array_length(packets)>20 then raise exception 'Invalid account batch';end if;
 for p in select * from jsonb_to_recordset(packets) x(user_id uuid,expected_updated timestamptz,items jsonb) loop
  if jsonb_typeof(p.items)<>'array' or jsonb_array_length(p.items)>100 then raise exception 'Invalid fixture batch';end if;
  select * into s from public.nothingsports_user_state where user_id=p.user_id and updated_at=p.expected_updated for update skip locked;
  if not found or exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=p.user_id) then continue;end if;
  alerts:=coalesce(s.preferences#>>'{followFirst,notifications,enabled}','true')<>'false' and coalesce(s.preferences#>>'{followFirst,notifications,sportingRemindersEnabled}','true')<>'false';
  for f in select * from jsonb_to_recordset(p.items) x(fixture_id text,aliases jsonb,choice text,enabled boolean,title text,starts_at timestamptz,precision text) loop
   if f.choice not in('automatic','on','off') or f.precision not in('exact','not-before') or length(f.fixture_id) not between 1 and 180 then raise exception 'Invalid decision';end if;
   if exists(select 1 from public.nothingsports_reminders r where r.user_id=p.user_id and (r.event_id=f.fixture_id or f.aliases ? r.event_id) and r.claimed_at>=stamp-interval '10 minutes' and r.dispatched_at is null) then continue;end if;
   select * into i from public.nothingsports_reminder_intents where user_id=p.user_id and fixture_id=f.fixture_id;
   if i.choice in('on','off') and i.choice<>f.choice then continue;end if;
   insert into public.nothingsports_reminder_intents(user_id,fixture_id,aliases,choice,enabled,state_revision,checked_at)
   values(p.user_id,f.fixture_id,f.aliases,f.choice,f.enabled,p.expected_updated,stamp) on conflict(user_id,fixture_id) do update set aliases=excluded.aliases,choice=excluded.choice,enabled=excluded.enabled,state_revision=excluded.state_revision,checked_at=excluded.checked_at where (public.nothingsports_reminder_intents.aliases,public.nothingsports_reminder_intents.choice,public.nothingsports_reminder_intents.enabled,public.nothingsports_reminder_intents.state_revision) is distinct from (excluded.aliases,excluded.choice,excluded.enabled,excluded.state_revision);
   if f.enabled and alerts and f.starts_at>stamp then
    -- Old aliases carry their receipt forward. Neither rescheduling nor a second
    -- surface may create another delivery for a fixture already dispatched.
    update public.nothingsports_reminders r set event_id=f.fixture_id where r.user_id=p.user_id and f.aliases ? r.event_id and r.event_id<>f.fixture_id and not exists(select 1 from public.nothingsports_reminders n where n.installation_id=r.installation_id and n.event_id=f.fixture_id);
    insert into public.nothingsports_reminders(installation_id,user_id,event_id,title,starts_at,remind_at,delivery_mode,viewing_url,reminder_origin,timing_precision,schedule_checked_at,schedule_state,schedule_starts_at,late_published_at)
    select d.installation_id,p.user_id,f.fixture_id,left(f.title,180),f.starts_at,f.starts_at-interval '15 minutes','match-15',null,case when f.choice='automatic' then 'automatic' else 'manual' end,f.precision,stamp,'ready',f.starts_at,case when f.starts_at-interval '15 minutes'<stamp then stamp end
    from public.nothingsports_push_installations d where d.user_id=p.user_id and d.permission='granted' and d.sporting_reminders_enabled
    on conflict(installation_id,event_id) do update set title=excluded.title,starts_at=excluded.starts_at,remind_at=excluded.remind_at,reminder_origin=excluded.reminder_origin,timing_precision=excluded.timing_precision,schedule_checked_at=stamp,schedule_state='ready',schedule_starts_at=excluded.starts_at,late_published_at=coalesce(public.nothingsports_reminders.late_published_at,excluded.late_published_at),updated_at=stamp
     where public.nothingsports_reminders.dispatched_at is null and public.nothingsports_reminders.delivery_started_at is null and (public.nothingsports_reminders.claimed_at is null or public.nothingsports_reminders.claimed_at<stamp-interval '10 minutes') and (public.nothingsports_reminders.starts_at,public.nothingsports_reminders.schedule_state,public.nothingsports_reminders.timing_precision,public.nothingsports_reminders.reminder_origin) is distinct from (excluded.starts_at,'ready',excluded.timing_precision,excluded.reminder_origin);
   -- Fold receipts from any second surface before removing its delivery row.
    update public.nothingsports_reminders r set delivery_started_at=coalesce(r.delivery_started_at,(select min(a.delivery_started_at) from public.nothingsports_reminders a where a.installation_id=r.installation_id and f.aliases ? a.event_id)),dispatched_at=coalesce(r.dispatched_at,(select min(a.dispatched_at) from public.nothingsports_reminders a where a.installation_id=r.installation_id and f.aliases ? a.event_id)) where r.user_id=p.user_id and r.event_id=f.fixture_id;
    delete from public.nothingsports_reminders r where r.user_id=p.user_id and f.aliases ? r.event_id and r.event_id<>f.fixture_id;
   else
    update public.nothingsports_reminders set schedule_state='held',schedule_checked_at=stamp,schedule_starts_at=null,claimed_at=null,updated_at=stamp where user_id=p.user_id and (event_id=f.fixture_id or f.aliases ? event_id) and dispatched_at is null and schedule_state is distinct from 'held' and (claimed_at is null or claimed_at<stamp-interval '10 minutes');
   end if;
   changed:=changed+1;
  end loop;
  insert into public.nothingsports_reminder_account_checks values(p.user_id,stamp) on conflict(user_id) do update set checked_at=excluded.checked_at;
 end loop;return changed;
end $$;
revoke all on function public.nothingsports_set_reminder_choice(uuid,text,jsonb,boolean),public.nothingsports_reminder_accounts(uuid),public.nothingsports_reconcile_reminder_accounts(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_set_reminder_choice(uuid,text,jsonb,boolean),public.nothingsports_reminder_accounts(uuid),public.nothingsports_reconcile_reminder_accounts(jsonb) to service_role;

-- All newly verified sporting reminders share the freshness gate. This also
-- holds legacy client-supplied timing until the canonical catalogue reviews it.
create or replace function public.nothingsports_managed_reminder(event_key text,mode text) returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.nothingsports_reminder_policy_epoch where enabled) or coalesce(mode,'match-15')='match-15' and event_key ~ '^(event:premier-league:[0-9]+|fixture:football:openligadb:uefa-(champions|europa)-league:[0-9]+)$' $$;
create or replace function public.nothingsports_reminder_schedule_eligible(r public.nothingsports_reminders,at_time timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select (not public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) and r.schedule_state is null) or (coalesce(r.schedule_state='ready' and r.schedule_starts_at=r.starts_at and r.starts_at>at_time and r.schedule_checked_at between at_time-interval '10 minutes' and at_time,false)
 and exists(select 1 from public.nothingsports_push_installations d where d.installation_id=r.installation_id and d.permission='granted' and d.sporting_reminders_enabled and d.user_id is not distinct from r.user_id)
 and (r.user_id is null or exists(select 1 from public.nothingsports_user_state s where s.user_id=r.user_id and coalesce(s.preferences#>>'{followFirst,notifications,enabled}','true')<>'false' and coalesce(s.preferences#>>'{followFirst,notifications,sportingRemindersEnabled}','true')<>'false'))
 and (r.user_id is null or not exists(select 1 from public.nothingsports_reminder_intents i where i.user_id=r.user_id and i.fixture_id=r.event_id and (not i.enabled or i.choice='off' or i.choice='automatic' and exists(select 1 from public.nothingsports_user_state s where s.user_id=r.user_id and (i.state_revision is distinct from s.updated_at or coalesce(s.preferences#>>'{followFirst,notifications,autoRemindersEnabled}','true')='false'))))))
$$;

create or replace function public.nothingsports_reminder_schedule_candidates() returns table(id uuid,event_id text,delivery_mode text,starts_at timestamptz,updated_at timestamptz)
language sql security invoker set search_path='' set statement_timeout='3s' as $$
 select r.id,r.event_id,r.delivery_mode,r.starts_at,r.updated_at from public.nothingsports_reminders r
 where r.dispatched_at is null and r.delivery_mode='match-15' and (public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) or r.schedule_state is not null) and r.schedule_state is distinct from 'off'
 and (r.claimed_at is null or r.claimed_at<clock_timestamp()-interval '10 minutes')
 and not exists(select 1 from public.nothingsports_reminder_intents i where i.user_id=r.user_id and i.fixture_id=r.event_id and not i.enabled)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_push_installations d join public.nothingsports_account_erasure_blocks b on b.user_id=d.user_id where d.installation_id=r.installation_id)
 order by case when r.remind_at between clock_timestamp()-interval '1 hour' and clock_timestamp()+interval '5 minutes' then 0 else 1 end,r.schedule_checked_at nulls first,r.id limit 20
$$;

-- Admission and canonical fixture receipts survive a crash after provider contact.
create function public.nothingsports_begin_fixture_reminder(reminder_id uuid,expected_claim timestamptz) returns boolean
language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare r public.nothingsports_reminders;begin
 select * into r from public.nothingsports_reminders where id=reminder_id and claimed_at=expected_claim and dispatched_at is null and delivery_started_at is null for update;
 if not found or not public.nothingsports_reminder_schedule_eligible(r,clock_timestamp()) or exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id) then return false;end if;
 update public.nothingsports_reminders set delivery_started_at=clock_timestamp() where id=r.id;return true;
end $$;
revoke all on function public.nothingsports_begin_fixture_reminder(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.nothingsports_begin_fixture_reminder(uuid,timestamptz) to service_role;
create or replace function public.nothingsports_claim_due_reminders(claim_at timestamptz,oldest_due timestamptz,stale_before timestamptz,batch_limit integer default 10) returns setof public.nothingsports_reminders
language sql security invoker set search_path='' set statement_timeout='3s' as $$
 with candidates as (
 select r.id from public.nothingsports_reminders r where r.dispatched_at is null and r.delivery_started_at is null
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_push_installations d join public.nothingsports_account_erasure_blocks b on b.user_id=d.user_id where d.installation_id=r.installation_id)
 and public.nothingsports_reminder_schedule_eligible(r,clock_timestamp()) and r.remind_at<=claim_at and r.remind_at>=oldest_due and (r.claimed_at is null or r.claimed_at<stale_before)
 order by r.remind_at,r.id for update skip locked limit greatest(1,least(batch_limit,10)))
 update public.nothingsports_reminders r set claimed_at=claim_at,updated_at=claim_at from candidates where r.id=candidates.id returning r.*
$$;
