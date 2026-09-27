-- Same dispatcher owns bounded schedule reconciliation and delivery. No new job.
alter table public.nothingsports_reminders add column schedule_checked_at timestamptz, add column schedule_state text, add column schedule_starts_at timestamptz;
create index nothingsports_reminder_schedule_scan on public.nothingsports_reminders(schedule_checked_at nulls first,id) where dispatched_at is null and delivery_mode='match-15';
create function public.nothingsports_managed_reminder(event_key text,mode text) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(mode,'match-15')='match-15' and event_key ~ '^(event:premier-league:[0-9]+|fixture:football:openligadb:uefa-(champions|europa)-league:[0-9]+)$'
$$;
create function public.nothingsports_reminder_schedule_eligible(r public.nothingsports_reminders,at_time timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select not public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) or coalesce(r.schedule_state='ready' and r.schedule_starts_at=r.starts_at and r.starts_at>at_time and r.schedule_checked_at between at_time-interval '10 minutes' and at_time,false)
$$;
create function public.nothingsports_reminder_schedule_candidates() returns table(id uuid,event_id text,delivery_mode text,starts_at timestamptz,updated_at timestamptz)
language sql security invoker set search_path='' set statement_timeout='3s' as $$
 select r.id,r.event_id,r.delivery_mode,r.starts_at,r.updated_at from public.nothingsports_reminders r
 where r.dispatched_at is null and r.delivery_mode='match-15' and public.nothingsports_managed_reminder(r.event_id,r.delivery_mode)
 and (r.claimed_at is null or r.claimed_at<clock_timestamp()-interval '10 minutes')
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_push_installations i join public.nothingsports_account_erasure_blocks b on b.user_id=i.user_id where i.installation_id=r.installation_id)
 order by r.schedule_checked_at nulls first,r.id limit 20
$$;
create function public.nothingsports_reconcile_reminder_schedules(updates jsonb) returns integer
language plpgsql security invoker set search_path='' set statement_timeout='3s' as $$
declare item record;r public.nothingsports_reminders;changed integer:=0;checked timestamptz:=clock_timestamp();begin
 if jsonb_typeof(updates) is distinct from 'array' or jsonb_array_length(updates)>20 then raise exception 'Invalid schedule batch';end if;
 if exists(select 1 from jsonb_array_elements(updates) e group by e->>'id' having count(*)>1) then raise exception 'Duplicate schedule candidate';end if;
 for item in select * from jsonb_to_recordset(updates) as x(id uuid,expected_start timestamptz,expected_updated timestamptz,state text,new_start timestamptz) loop
  if item.state is null or item.state not in('ready','unavailable','inactive','unconfirmed','passed') or (item.state='ready' and (item.new_start is null )) then raise exception 'Invalid schedule decision';end if;
  if item.state='ready' and item.new_start<=checked then item.state:='passed';item.new_start:=null;end if;
  select * into r from public.nothingsports_reminders where id=item.id and dispatched_at is null
   and starts_at=item.expected_start and updated_at=item.expected_updated
   and (claimed_at is null or claimed_at<checked-interval '10 minutes') for update skip locked;
  if not found then continue;end if;
  if not public.nothingsports_managed_reminder(r.event_id,r.delivery_mode) then raise exception 'Unreviewed schedule candidate';end if;
  if exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id) or exists(select 1 from public.nothingsports_push_installations i join public.nothingsports_account_erasure_blocks b on b.user_id=i.user_id where i.installation_id=r.installation_id) then continue;end if;
  if item.state<>'ready' or item.new_start is distinct from r.starts_at then
   -- Retract only never-surfaced stale inbox entries; never pretend a seen alert was recalled.
   delete from public.nothingsports_inbox where recipient_user_id=r.user_id and kind='reminder' and event_id=r.event_id and activity_at=r.remind_at and surfaced_at is null and read_at is null;
  end if;
  update public.nothingsports_reminders set schedule_checked_at=checked,schedule_state=item.state,schedule_starts_at=item.new_start,
   starts_at=case when item.state='ready' then item.new_start else starts_at end,
   remind_at=case when item.state='ready' then item.new_start-interval '15 minutes' else remind_at end,
   claimed_at=null,updated_at=checked where id=r.id;
  changed:=changed+1;
 end loop;return changed;
end $$;
revoke all on function public.nothingsports_managed_reminder(text,text),public.nothingsports_reminder_schedule_eligible(public.nothingsports_reminders,timestamptz),public.nothingsports_reminder_schedule_candidates(),public.nothingsports_reconcile_reminder_schedules(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_managed_reminder(text,text),public.nothingsports_reminder_schedule_eligible(public.nothingsports_reminders,timestamptz),public.nothingsports_reminder_schedule_candidates(),public.nothingsports_reconcile_reminder_schedules(jsonb) to service_role;

create or replace function public.nothingsports_claim_due_reminders(
  claim_at timestamptz,
  oldest_due timestamptz,
  stale_before timestamptz,
  batch_limit integer default 100
)
returns setof public.nothingsports_reminders
language sql security invoker set search_path = '' as $$
  with candidates as (
    select reminder.id
    from public.nothingsports_reminders reminder
    where reminder.dispatched_at is null
      and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=reminder.user_id)
      and not exists(select 1 from public.nothingsports_push_installations i join public.nothingsports_account_erasure_blocks b on b.user_id=i.user_id where i.installation_id=reminder.installation_id)
      and public.nothingsports_reminder_schedule_eligible(reminder,clock_timestamp())
      and reminder.remind_at <= claim_at
      and reminder.remind_at >= oldest_due
      and (reminder.claimed_at is null or reminder.claimed_at < stale_before)
    order by reminder.remind_at
    for update skip locked
    limit greatest(1,least(batch_limit,100))
  )
  update public.nothingsports_reminders reminder
     set claimed_at=claim_at,updated_at=claim_at
    from candidates
   where reminder.id=candidates.id
  returning reminder.*;
$$;


create or replace function public.nothingsports_inbox_maintenance() returns void
language plpgsql security invoker set search_path='' as $$ begin
 insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,event_id,title,activity_at)
 select distinct on(user_id,event_id,remind_at) user_id,'reminder','reminder:'||event_id||':'||remind_at,event_id,title,remind_at
 from public.nothingsports_reminders r where public.nothingsports_reminder_schedule_eligible(r,clock_timestamp()) and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id) and user_id is not null and remind_at<=clock_timestamp() and remind_at>clock_timestamp()-interval '1 hour' and remind_at>=(select started_at from public.nothingsports_inbox_epoch)
 on conflict do nothing;
 delete from public.nothingsports_inbox where id in(select id from public.nothingsports_inbox where activity_at<clock_timestamp()-interval '90 days' order by activity_at limit 500);
end $$;
revoke all on function public.nothingsports_inbox_maintenance() from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_maintenance() to service_role;
