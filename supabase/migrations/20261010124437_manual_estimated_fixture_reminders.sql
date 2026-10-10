-- Manual provisional timing under the existing dispatcher; no account backfill,
-- new owner, consent mutation or reset of a provider/delivery receipt.
set local lock_timeout='2s';
set local statement_timeout='15s';
alter table public.nothingsports_reminders drop constraint nothingsports_reminders_timing_precision_check;
alter table public.nothingsports_reminders add constraint nothingsports_reminders_timing_precision_check check(timing_precision in('exact','not-before','estimated') and (timing_precision<>'estimated' or reminder_origin='manual'));
CREATE OR REPLACE FUNCTION public.nothingsports_reconcile_reminder_accounts(packets jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
declare p record;f record;s public.nothingsports_user_state;i public.nothingsports_reminder_intents;stamp timestamptz:=clock_timestamp();changed integer:=0;alerts boolean;begin
 if jsonb_typeof(packets)<>'array' or jsonb_array_length(packets)>20 then raise exception 'Invalid account batch';end if;
 for p in select * from jsonb_to_recordset(packets) x(user_id uuid,expected_updated timestamptz,items jsonb) loop
  if jsonb_typeof(p.items)<>'array' or jsonb_array_length(p.items)>100 then raise exception 'Invalid fixture batch';end if;
  select * into s from public.nothingsports_user_state where user_id=p.user_id and updated_at=p.expected_updated for update skip locked;
  if not found or exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=p.user_id) then continue;end if;
  alerts:=coalesce(s.preferences#>>'{followFirst,notifications,enabled}','true')<>'false' and coalesce(s.preferences#>>'{followFirst,notifications,sportingRemindersEnabled}','true')<>'false';
  for f in select * from jsonb_to_recordset(p.items) x(fixture_id text,aliases jsonb,choice text,enabled boolean,title text,starts_at timestamptz,precision text) loop
   if f.choice not in('automatic','on','off') or f.precision not in('exact','not-before','estimated') or (f.precision='estimated' and f.choice<>'on') or length(f.fixture_id) not between 1 and 180 then raise exception 'Invalid decision';end if;
   -- bledisloe-reminder-identity-v1
 f.fixture_id:=nothingsports_recovery.fixture_alias_v1(f.fixture_id);
 if f.fixture_id='rugby-australia-new-zealand-2026-10-17' then f.starts_at:='2026-10-17T05:00:00Z'::timestamptz;f.precision:='exact';f.aliases:=(select jsonb_agg(distinct item) from jsonb_array_elements_text(coalesce(f.aliases,'[]'::jsonb)||'["rugby-australia-new-zealand-2026-10-17", "fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8", "fixture-rugby-wr-e3cbae12-66b3-4835-b1ce-4014b63055c8", "fixture:rugby:ra:949627", "fixture-rugby-ra-949627"]'::jsonb) a(item));end if;
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
    update public.nothingsports_reminders set schedule_state='held',schedule_checked_at=stamp,schedule_starts_at=null,claimed_at=null,updated_at=stamp where user_id=p.user_id and (event_id=f.fixture_id or f.aliases ? event_id) and dispatched_at is null and delivery_started_at is null and schedule_state is distinct from 'held' and (claimed_at is null or claimed_at<stamp-interval '10 minutes');
   end if;
   changed:=changed+1;
  end loop;
  insert into public.nothingsports_reminder_account_checks values(p.user_id,stamp) on conflict(user_id) do update set checked_at=excluded.checked_at;
 end loop;return changed;
end $function$
;
-- Add origin to the same bounded scan. Older dispatchers ignore the new columns.
drop function public.nothingsports_reminder_schedule_candidates();
CREATE OR REPLACE FUNCTION public.nothingsports_reminder_schedule_candidates()
 RETURNS TABLE(id uuid, event_id text, delivery_mode text, starts_at timestamp with time zone, updated_at timestamp with time zone, reminder_origin text, timing_precision text)
 LANGUAGE sql
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
 select r.id,r.event_id,r.delivery_mode,r.starts_at,r.updated_at,r.reminder_origin,r.timing_precision from public.nothingsports_reminders r
 where r.dispatched_at is null and r.delivery_started_at is null and r.delivery_mode='match-15' and (public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) or r.schedule_state is not null) and r.schedule_state is distinct from 'off'
 and (r.claimed_at is null or r.claimed_at<clock_timestamp()-interval '10 minutes')
 and not exists(select 1 from public.nothingsports_reminder_intents i where i.user_id=r.user_id and i.fixture_id=r.event_id and not i.enabled)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_push_installations d join public.nothingsports_account_erasure_blocks b on b.user_id=d.user_id where d.installation_id=r.installation_id)
 order by case when r.remind_at between clock_timestamp()-interval '1 hour' and clock_timestamp()+interval '5 minutes' then 0 else 1 end,r.schedule_checked_at nulls first,r.id limit 20
$function$
;
CREATE OR REPLACE FUNCTION public.nothingsports_reconcile_reminder_schedules(updates jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
 SET statement_timeout TO '3s'
AS $function$
declare item record;r public.nothingsports_reminders;changed integer:=0;checked timestamptz:=clock_timestamp();begin
 if jsonb_typeof(updates) is distinct from 'array' or jsonb_array_length(updates)>20 then raise exception 'Invalid schedule batch';end if;
 if exists(select 1 from jsonb_array_elements(updates) e group by e->>'id' having count(*)>1) then raise exception 'Duplicate schedule candidate';end if;
 for item in select * from jsonb_to_recordset(updates) as x(id uuid,expected_start timestamptz,expected_updated timestamptz,state text,new_start timestamptz,new_precision text) loop
  if item.state is null or item.state not in('ready','unavailable','inactive','unconfirmed','passed') or (item.state='ready' and (item.new_start is null )) then raise exception 'Invalid schedule decision';end if;
  if item.new_precision is not null and item.new_precision not in('exact','not-before','estimated') then raise exception 'Invalid timing precision';end if;
  if item.state='ready' and item.new_start<=checked then item.state:='passed';item.new_start:=null;end if;
  select * into r from public.nothingsports_reminders where id=item.id and dispatched_at is null and delivery_started_at is null
   and starts_at=item.expected_start and updated_at=item.expected_updated
   and (claimed_at is null or claimed_at<checked-interval '10 minutes') for update skip locked;
  if not found then continue;end if;
  if item.new_precision='estimated' and r.reminder_origin<>'manual' then raise exception 'Estimated timing requires manual intent';end if;
  if not public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) then raise exception 'Unreviewed schedule candidate';end if;
  if exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id) or exists(select 1 from public.nothingsports_push_installations i join public.nothingsports_account_erasure_blocks b on b.user_id=i.user_id where i.installation_id=r.installation_id) then continue;end if;
  if item.state<>'ready' or item.new_start is distinct from r.starts_at then
   -- Retract only never-surfaced stale inbox entries; never pretend a seen alert was recalled.
   delete from public.nothingsports_inbox where recipient_user_id=r.user_id and kind='reminder' and event_id=r.event_id and activity_at=r.remind_at and surfaced_at is null and read_at is null;
  end if;
  update public.nothingsports_reminders set schedule_checked_at=checked,schedule_state=item.state,schedule_starts_at=item.new_start,
   starts_at=case when item.state='ready' then item.new_start else starts_at end,
   remind_at=case when item.state='ready' then item.new_start-interval '15 minutes' else remind_at end,
   timing_precision=case when item.state='ready' then coalesce(item.new_precision,timing_precision) else timing_precision end,
   claimed_at=null,updated_at=checked where id=r.id;
  changed:=changed+1;
 end loop;return changed;
end $function$
;
revoke all on function public.nothingsports_reminder_schedule_candidates(),public.nothingsports_reconcile_reminder_accounts(jsonb),public.nothingsports_reconcile_reminder_schedules(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_reminder_schedule_candidates(),public.nothingsports_reconcile_reminder_accounts(jsonb),public.nothingsports_reconcile_reminder_schedules(jsonb) to service_role;

