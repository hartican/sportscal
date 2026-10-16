-- Private, prospective stakes-to-Impact qualification and bounded delivery.
-- No scheduler, customer preference update or live sporting-data write.
set local lock_timeout='2s';
set local statement_timeout='15s';
create function private.impact_now() returns timestamptz language sql volatile set search_path='' as $$ select clock_timestamp() $$;
create function private.impact_next_tick(at_time timestamptz) returns timestamptz language sql immutable set search_path='' as $$ select date_bin(interval '5 minutes',at_time,'2000-01-01T00:00Z'::timestamptz)+interval '5 minutes' $$;
create function private.impact_next_morning(at_time timestamptz) returns timestamptz language sql immutable set search_path='' as $$ select (((at_time at time zone 'Australia/Sydney')::date+1)+time '10:00') at time zone 'Australia/Sydney' $$;
create table private.impact_epoch(singleton boolean primary key default true check(singleton),started_at timestamptz not null default private.impact_now(),launch_digest_at timestamptz not null default private.impact_next_morning(private.impact_now()));
insert into private.impact_epoch default values;
create table private.impact_qualifications(user_id uuid references auth.users on delete cascade,event_id text not null,ever_five boolean not null,qualified_at timestamptz not null,five_at timestamptz,check(ever_five=(five_at is not null)),primary key(user_id,event_id));
create table private.impact_watches(event_id text primary key,any_five_at timestamptz,added_at timestamptz not null default private.impact_now(),examined_at timestamptz,completed boolean not null default false,completion_at timestamptz,confirmed_at timestamptz,source_checked_at timestamptz,source_url text,aliases text[] not null default '{}',title text);
create table private.impact_accounts(user_id uuid primary key references auth.users on delete cascade,checked_at timestamptz not null);
-- The unique account/day/kind keys are the daily delivery ledger. A digest does
-- not consume that day's immediate slot. Entries are never reused after sending.
create table private.impact_batches(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,sydney_day date not null,kind text not null check(kind in('immediate','digest')),created_at timestamptz not null default private.impact_now(),unique(user_id,sydney_day,kind));
create table private.impact_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,event_id text not null references private.impact_watches,reason_self boolean not null default false,reason_five boolean not null default false,admitted_at timestamptz not null default private.impact_now(),ready_at timestamptz not null,expires_at timestamptz not null,digest_at timestamptz not null,launch_only boolean not null default false,status text not null default 'pending' check(status in('pending','assigned','notified','suppressed')),batch_id uuid references private.impact_batches on delete cascade,expected_state timestamptz,verified_at timestamptz,unique(user_id,event_id));
create index impact_batches_expiry on private.impact_batches(created_at);
create index impact_requests_due on private.impact_requests(user_id,status,digest_at);
create table private.impact_deliveries(batch_id uuid references private.impact_batches on delete cascade,installation_id uuid references public.nothingsports_push_installations on delete cascade,user_id uuid not null references auth.users on delete cascade,status text not null default 'pending' check(status in('pending','sending','sent','failed','uncertain','suppressed')),claim_token uuid,claimed_at timestamptz,delivery_started_at timestamptz,finished_at timestamptz,attempts integer not null default 0,primary key(batch_id,installation_id));
create index impact_watches_check on private.impact_watches(examined_at nulls first,added_at desc,event_id);
do $$ declare t text;begin foreach t in array array['impact_epoch','impact_qualifications','impact_watches','impact_accounts','impact_batches','impact_requests','impact_deliveries'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('alter table private.%I force row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
end loop;end $$;
-- Recipient-owned rows share the existing erasure barrier as well as cascading
-- Auth FKs. Private service RPCs own all mutation; clients cannot insert triggers.
do $$ declare t text;begin foreach t in array array['impact_qualifications','impact_accounts','impact_batches','impact_requests','impact_deliveries'] loop
 execute format('create trigger nothingsports_account_erasure_guard after insert or update on private.%I for each row execute function private.nothingsports_guard_erasure_write(''user_id'')',t);
end loop;end $$;

create function private.impact_canonical(id text) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select event_id from public.nothingsports_classic_aliases where alias=nothingsports_recovery.fixture_alias_v1(id)),nothingsports_recovery.fixture_alias_v1(id));
$$;
create function private.impact_capture_vote() returns trigger language plpgsql security definer set search_path='' as $$
declare canonical text;observed timestamptz;begin
 if new.phase<>'heat' or new.rating<3 or coalesce((to_jsonb(new)->>'demo')::boolean,false) or coalesce((to_jsonb(new)->>'modelled')::boolean,false) then return new;end if;
 if not exists(select 1 from auth.users where id=new.user_id and not coalesce(is_anonymous,false))
 or exists(select 1 from public.nothingsports_nsc_personas where user_id=new.user_id and moderation_flag)
 or exists(select 1 from public.nothingsports_nsc_pilot_members where user_id=new.user_id and suspended) then return new;end if;
 canonical:=private.impact_canonical(new.event_id);observed:=coalesce(new.updated_at,new.submitted_at,new.created_at);
 if canonical is null or observed is null or observed>private.impact_now() then return new;end if;
 insert into private.impact_qualifications values(new.user_id,canonical,new.rating=5,observed,case when new.rating=5 then observed end)
 on conflict(user_id,event_id) do update set ever_five=impact_qualifications.ever_five or excluded.ever_five,five_at=least(impact_qualifications.five_at,excluded.five_at),qualified_at=least(impact_qualifications.qualified_at,excluded.qualified_at);
 insert into private.impact_watches(event_id,any_five_at) values(canonical,case when new.rating=5 then observed end)
 on conflict(event_id) do update set any_five_at=least(impact_watches.any_five_at,excluded.any_five_at);
 return new;
end $$;
create trigger impact_capture_vote after insert or update on public.nothingsports_nsc_contributions for each row execute function private.impact_capture_vote();
-- Only retained accepted submissions/history are backfilled. Missing historical
-- edits and modelled/demo panel rows are never reconstructed.
insert into private.impact_qualifications(user_id,event_id,ever_five,qualified_at,five_at)
select v.user_id,private.impact_canonical(v.event_id),bool_or(v.rating=5),min(v.observed),min(v.observed) filter(where v.rating=5) from (
 select user_id,event_id,phase,rating,recorded_at observed from public.nothingsports_nsc_rating_history h where coalesce(to_jsonb(h)->>'demo','false')<>'true' and coalesce(to_jsonb(h)->>'modelled','false')<>'true'
 union all select user_id,event_id,phase,rating,coalesce(updated_at,submitted_at,created_at) from public.nothingsports_nsc_contributions c where coalesce(to_jsonb(c)->>'demo','false')<>'true' and coalesce(to_jsonb(c)->>'modelled','false')<>'true'
 union all select user_id,event_id,phase,rating,recorded_at from public.nothingsports_score_votes v where coalesce(to_jsonb(v)->>'demo','false')<>'true' and coalesce(to_jsonb(v)->>'modelled','false')<>'true'
) v join auth.users u on u.id=v.user_id and not coalesce(u.is_anonymous,false)
where v.phase='heat' and v.rating>=3 and v.observed<=private.impact_now()
and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=v.user_id)
and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=v.user_id and p.moderation_flag)
and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=v.user_id and p.suspended)
group by v.user_id,private.impact_canonical(v.event_id);
insert into private.impact_watches(event_id,any_five_at) select event_id,min(five_at) from private.impact_qualifications group by event_id;

create function private.impact_enabled(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(p->'followFirst'->'notifications'->>'enabled','true')<>'false' and coalesce(p->'followFirst'->'notifications'->>'liveRatingsEnabled','true')<>'false';
$$;
create function private.impact_rated(recipient uuid,event text,aliases text[]) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.nothingsports_nsc_contributions c where c.user_id=recipient and c.phase='impact' and c.event_id=any(array[event]||coalesce(aliases,'{}')) and coalesce(to_jsonb(c)->>'demo','false')<>'true' and coalesce(to_jsonb(c)->>'modelled','false')<>'true') $$;
create function private.impact_available(r private.impact_requests,at_time timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select r.status<>'suppressed' and w.completed and w.completion_at<=at_time and r.verified_at>=at_time-interval '5 minutes'
 and (not r.launch_only and r.expires_at>at_time or r.digest_at<=at_time and (r.digest_at at time zone 'Australia/Sydney')::date=(at_time at time zone 'Australia/Sydney')::date)
 and s.updated_at=r.expected_state and private.impact_enabled(s.preferences)
 -- A newer conflicting accepted observation requires another canonical check.
 -- Use the existing identity GIN index; never add a source-write trigger.
 and not exists(select 1 from public.nothingsports_fixture_current current where current.identity_keys&&w.aliases and current.updated_at>r.verified_at and coalesce(current.fixture->>'status','') not in('completed','finished','final'))
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=r.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=r.user_id and p.suspended)
 and not private.impact_rated(r.user_id,r.event_id,w.aliases)
 and not exists(select 1 from jsonb_array_elements(s.archived_events) a where coalesce(a->>'canonicalEventId',a->>'eventId',a->>'id')=any(w.aliases))
 and not exists(select 1 from jsonb_each(coalesce(s.event_user_state,'{}')) a where (a.key=any(w.aliases) or a.value->>'canonicalEventId'=r.event_id or a.value->>'eventId'=any(w.aliases)) and (a.value->>'dismissed'='true' or a.value->>'archived'='true' or a.value->>'isPurged'='true'))
 from private.impact_watches w join public.nothingsports_user_state s on s.user_id=r.user_id where w.event_id=r.event_id;
$$;

create function private.impact_inventory() returns jsonb language plpgsql security definer set search_path='' as $$
declare accounts jsonb;fixtures jsonb;ids text[];people uuid[];begin
 delete from private.impact_batches where id in(select id from private.impact_batches where created_at<private.impact_now()-interval '90 days' order by created_at limit 100);
 delete from private.impact_requests where id in(select id from private.impact_requests where ready_at<private.impact_now()-interval '90 days' and batch_id is null order by ready_at limit 100);
 if not exists(select 1 from private.impact_watches) then return jsonb_build_object('accounts','[]'::jsonb,'fixtures','[]'::jsonb);end if;
 select coalesce(array_agg(s.user_id),'{}') into people from (
 select s.user_id from public.nothingsports_user_state s join auth.users u on u.id=s.user_id and not coalesce(u.is_anonymous,false)
 left join private.impact_accounts a on a.user_id=s.user_id
 where not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=s.user_id)
 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=s.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=s.user_id and p.suspended)
 order by a.checked_at nulls first,s.user_id limit 20) s;
 insert into private.impact_accounts select id,private.impact_now() from unnest(people) id on conflict(user_id) do update set checked_at=excluded.checked_at;
 -- Twenty pending identities plus forty rotating watches fit the unchanged
 -- sixty-ID shared selected reader. The public input safety fence stays100.
 select coalesce(array_agg(event_id),'{}') into ids from (
 select distinct event_id from (
 (select event_id from private.impact_requests where user_id=any(people) and status in('pending','assigned','notified') and (expires_at>private.impact_now() or (digest_at at time zone 'Australia/Sydney')::date=(private.impact_now() at time zone 'Australia/Sydney')::date) order by verified_at nulls first limit 20)
 union all
 (select event_id from private.impact_watches where completion_at is null or completion_at>private.impact_now()-interval '8 days' order by examined_at nulls first,added_at desc,event_id limit 40)
 ) q) chosen;
 update private.impact_watches set examined_at=private.impact_now() where event_id=any(ids);
 select coalesce(jsonb_agg(jsonb_build_object('eventId',w.event_id,'anyFive',w.any_five_at is not null,'aliases',w.aliases,'completionAt',w.completion_at,'sourceCheckedAt',w.source_checked_at)),'[]') into fixtures from private.impact_watches w where w.event_id=any(ids);
 select coalesce(jsonb_agg(jsonb_build_object('userId',s.user_id,'preferences',s.preferences,'actions',s.event_user_state,'archivedEvents',s.archived_events,'updatedAt',s.updated_at,'self',coalesce((select jsonb_agg(q.event_id) from private.impact_qualifications q where q.user_id=s.user_id and q.event_id=any(ids)),'[]'))),'[]') into accounts from public.nothingsports_user_state s where s.user_id=any(people);
 return jsonb_build_object('epoch',(select to_jsonb(e) from private.impact_epoch e),'accounts',accounts,'fixtures',fixtures);
end $$;

create function private.impact_reconcile(packets jsonb,observations jsonb) returns void language plpgsql security definer set search_path='' as $$
declare o record;p record;f record;s public.nothingsports_user_state%rowtype;w private.impact_watches%rowtype;ts timestamptz:=private.impact_now();launch timestamptz;epoch timestamptz;own boolean;five boolean;is_launch boolean;bid uuid;day date;begin
 if jsonb_typeof(packets)<>'array' or jsonb_array_length(packets)>20 or jsonb_typeof(observations)<>'array' or jsonb_array_length(observations)>100 then raise exception 'impact_inventory_overflow';end if;
 select started_at,launch_digest_at into epoch,launch from private.impact_epoch;
 for o in select * from jsonb_to_recordset(observations) as x(event_id text,aliases text[],completed boolean,completion_at timestamptz,source_checked_at timestamptz,source_url text,title text) order by event_id loop
 if cardinality(o.aliases)>100 or length(o.title)>180 or o.source_checked_at>ts or o.completion_at>ts or o.source_url not like 'https://%' then raise exception 'invalid_impact_observation';end if;
 update private.impact_watches set aliases=array(select distinct unnest(aliases||array[event_id]||coalesce(o.aliases,'{}')||coalesce((select array_agg(a.alias) from public.nothingsports_classic_aliases a where a.event_id=o.event_id),'{}'))),title=o.title,examined_at=ts,completed=coalesce(o.completed,false) and o.completion_at is not null and o.source_checked_at is not null and o.source_url is not null,completion_at=case when o.completed then least(completion_at,o.completion_at) else completion_at end,confirmed_at=case when o.completed then least(confirmed_at,o.source_checked_at) else confirmed_at end,source_checked_at=o.source_checked_at,source_url=o.source_url where event_id=o.event_id and (source_checked_at is null or o.source_checked_at>=source_checked_at);
 end loop;
 for p in select * from jsonb_to_recordset(packets) as x(user_id uuid,expected_updated timestamptz,eligible_ids text[],checked_ids text[]) order by user_id loop
 if cardinality(p.eligible_ids)>100 or cardinality(p.checked_ids)>100 or not p.eligible_ids<@p.checked_ids then raise exception 'invalid_impact_account_scope';end if;
 select * into s from public.nothingsports_user_state where user_id=p.user_id for update;
 if not found or s.updated_at is distinct from p.expected_updated or exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=p.user_id) then continue;end if;
 update private.impact_requests r set status='suppressed' where r.user_id=p.user_id and r.event_id=any(p.checked_ids) and r.status<>'suppressed' and (not r.event_id=any(p.eligible_ids) or not private.impact_enabled(s.preferences) or private.impact_rated(p.user_id,r.event_id,(select fw.aliases from private.impact_watches fw where fw.event_id=r.event_id)));
 for w in select * from private.impact_watches where event_id=any(p.eligible_ids) and completed and completion_at<=ts loop
 if not private.impact_enabled(s.preferences) then continue;end if;
 own:=exists(select 1 from private.impact_qualifications q where q.user_id=p.user_id and q.event_id=w.event_id);five:=w.any_five_at is not null;
 if not own and not five then continue;end if;
 if private.impact_rated(p.user_id,w.event_id,w.aliases) then continue;end if;
 is_launch:=w.completion_at<epoch and w.completion_at>=epoch-interval '7 days' and ts<launch+interval '1 day';
 if w.completion_at<ts-interval '24 hours' and not is_launch then continue;end if;
 insert into private.impact_requests(user_id,event_id,reason_self,reason_five,ready_at,expires_at,digest_at,launch_only,expected_state,verified_at)
 values(p.user_id,w.event_id,own,five,case when is_launch then launch else private.impact_next_tick(w.confirmed_at) end,w.completion_at+interval '24 hours',case when is_launch then launch else private.impact_next_morning(ts) end,is_launch,s.updated_at,ts)
 on conflict(user_id,event_id) do update set reason_self=impact_requests.reason_self or excluded.reason_self,reason_five=impact_requests.reason_five or excluded.reason_five,expected_state=excluded.expected_state,verified_at=ts;
 end loop;
 -- Refresh already-admitted rows even during the extra morning grace period.
 update private.impact_requests set expected_state=s.updated_at,verified_at=ts where user_id=p.user_id and event_id=any(p.eligible_ids) and status<>'suppressed';
 day:=(ts at time zone 'Australia/Sydney')::date;
 perform pg_advisory_xact_lock(hashtextextended('impact-day:'||p.user_id::text||':'||day::text,0));
 -- An unstarted previous-day immediate cannot spend yesterday's allowance
 -- today. Preserve its original digest date and never repeat a started send.
 update private.impact_requests r set status='pending',batch_id=null from private.impact_batches b
 where r.batch_id=b.id and b.user_id=p.user_id and b.kind='immediate' and b.sydney_day<day and r.status in('assigned','notified')
 and not exists(select 1 from private.impact_deliveries d where d.batch_id=b.id and (d.delivery_started_at is not null or d.status in('sent','uncertain')));
 update private.impact_deliveries d set status='suppressed' from private.impact_batches b
 where d.batch_id=b.id and b.user_id=p.user_id and b.sydney_day<day and d.delivery_started_at is null and d.status in('pending','sending');
 if not exists(select 1 from private.impact_batches where user_id=p.user_id and sydney_day=day and kind='immediate') then
 select r.id into bid from private.impact_requests r where r.user_id=p.user_id and r.status='pending' and not r.launch_only and (r.admitted_at at time zone 'Australia/Sydney')::date=day and r.ready_at<=ts and r.expires_at>ts and private.impact_available(r,ts) order by ready_at,event_id limit 1 for update;
 if found then
 insert into private.impact_batches(user_id,sydney_day,kind) values(p.user_id,day,'immediate') returning id into bid;
 update private.impact_requests set status='assigned',batch_id=bid where id=(select r.id from private.impact_requests r where r.user_id=p.user_id and r.status='pending' and not r.launch_only and (r.admitted_at at time zone 'Australia/Sydney')::date=day and r.expires_at>ts and private.impact_available(r,ts) order by ready_at,event_id limit 1);
 end if;end if;
 if not exists(select 1 from private.impact_batches where user_id=p.user_id and sydney_day=day and kind='digest') and exists(select 1 from private.impact_requests r where r.user_id=p.user_id and r.status='pending' and r.digest_at<=ts and (r.digest_at at time zone 'Australia/Sydney')::date=day and private.impact_available(r,ts)) then
 insert into private.impact_batches(user_id,sydney_day,kind) values(p.user_id,day,'digest') returning id into bid;
 update private.impact_requests r set status='assigned',batch_id=bid where r.user_id=p.user_id and r.status='pending' and r.digest_at<=ts and (r.digest_at at time zone 'Australia/Sydney')::date=day and private.impact_available(r,ts);
 end if;
 insert into private.impact_deliveries(batch_id,installation_id,user_id)
 select b.id,i.installation_id,p.user_id from private.impact_batches b join public.nothingsports_push_installations i on i.user_id=b.user_id and i.permission='granted' and i.live_ratings_enabled
 where b.user_id=p.user_id and b.sydney_day=day and exists(select 1 from private.impact_requests r where r.batch_id=b.id and r.status='assigned' and private.impact_available(r,ts)) and not exists(select 1 from private.impact_deliveries d where d.batch_id=b.id and d.delivery_started_at is not null)
 on conflict do nothing;
 insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,event_id,phase,title,detail)
 select p.user_id,'impact_request','impact:'||r.event_id,r.event_id,'impact','Rate the Impact',watched.title from private.impact_requests r join private.impact_watches watched using(event_id) where r.user_id=p.user_id and private.impact_available(r,ts) on conflict do nothing;
 end loop;
end $$;

create function private.impact_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 with due as(select d.batch_id,d.installation_id from private.impact_deliveries d join private.impact_batches b on b.id=d.batch_id where b.sydney_day=(private.impact_now() at time zone 'Australia/Sydney')::date and (d.status='pending' or d.status='sending' and d.delivery_started_at is null and d.claimed_at<private.impact_now()-interval '10 minutes') and d.delivery_started_at is null and d.attempts<3 and exists(select 1 from private.impact_requests r where r.batch_id=d.batch_id and private.impact_available(r,private.impact_now())) order by d.batch_id,d.installation_id limit 2 for update of d skip locked), claimed as(update private.impact_deliveries d set status='sending',claim_token=gen_random_uuid(),claimed_at=private.impact_now(),attempts=attempts+1 from due where d.batch_id=due.batch_id and d.installation_id=due.installation_id returning d.*)
 select coalesce(jsonb_agg(to_jsonb(c)),'[]') into result from claimed c;return result;
end $$;
create function private.impact_begin(batch uuid,installation uuid,token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.impact_deliveries%rowtype;b private.impact_batches%rowtype;items jsonb;begin
 select * into d from private.impact_deliveries where batch_id=batch and installation_id=installation for update;
 if not found or d.status<>'sending' or d.claim_token is distinct from token or d.delivery_started_at is not null then return null;end if;
 select * into b from private.impact_batches where id=batch;
 if b.user_id is distinct from d.user_id then return null;end if;
 if b.sydney_day is distinct from (private.impact_now() at time zone 'Australia/Sydney')::date then update private.impact_deliveries set status='suppressed' where batch_id=batch and installation_id=installation;return null;end if;
 if not exists(select 1 from public.nothingsports_push_installations where installation_id=installation and user_id=d.user_id and permission='granted' and live_ratings_enabled) then update private.impact_deliveries set status='suppressed' where batch_id=batch and installation_id=installation;return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('eventId',r.event_id,'title',w.title) order by r.ready_at,r.event_id),'[]') into items from private.impact_requests r join private.impact_watches w using(event_id) where r.batch_id=batch and private.impact_available(r,private.impact_now());
 if jsonb_array_length(items)=0 then update private.impact_deliveries set status='suppressed' where batch_id=batch and installation_id=installation;return null;end if;
 update private.impact_deliveries set delivery_started_at=private.impact_now() where batch_id=batch and installation_id=installation;
 update private.impact_requests set status='notified' where batch_id=batch and status='assigned';
 return jsonb_build_object('userId',d.user_id,'kind',b.kind,'day',b.sydney_day,'items',items);
end $$;
create function private.impact_finish(batch uuid,installation uuid,token uuid,outcome text) returns void language plpgsql security definer set search_path='' as $$ begin
 if outcome not in('sent','failed','uncertain','suppressed','pending') then raise exception 'invalid_impact_delivery_outcome';end if;
 update private.impact_deliveries set status=case when outcome='pending' and attempts>=3 then 'failed' else outcome end,finished_at=private.impact_now(),delivery_started_at=case when outcome in('pending','failed','suppressed') then null else delivery_started_at end where batch_id=batch and installation_id=installation and claim_token=token and status='sending';
end $$;
alter table public.nothingsports_inbox drop constraint nothingsports_inbox_kind_check;
alter table public.nothingsports_inbox add constraint nothingsports_inbox_kind_check check(kind in('chat','invitation','added','profile_followed','follows_copied','points','rating','reminder','system','impact_request'));
create function private.impact_inbox_eligible(recipient uuid,event text) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.impact_requests r where r.user_id=recipient and r.event_id=event and private.impact_available(r,private.impact_now())) $$;
-- Extend the existing private inbox eligibility without changing its interface,
-- cursor, conversation receipts or other kinds. Fail instead of overwriting drift.
do $$ declare def text;needle text:=$n$and (i.kind<>'rating' or$n$;begin
 def:=pg_get_functiondef('public.nothingsports_inbox_page(uuid,timestamptz,uuid,boolean)'::regprocedure);
 if position(needle in def)=0 then raise exception 'impact_inbox_definition_changed';end if;
 def:=replace(def,needle,$n$and (i.kind<>'impact_request' or private.impact_inbox_eligible(i.recipient_user_id,i.event_id))
  and (i.kind<>'rating' or$n$);
 execute def;
end $$;
create function private.impact_page(target_user uuid,target_event text default null,target_day date default null) returns jsonb language sql stable security definer set search_path='' as $$
 with candidates as(select r.*,w.title from private.impact_requests r join private.impact_watches w using(event_id)
 where r.user_id=target_user and r.status<>'suppressed' and w.completed and (target_event is null or r.event_id=private.impact_canonical(target_event))
 and (target_day is null or exists(select 1 from private.impact_batches b where b.id=r.batch_id and b.user_id=target_user and b.kind='digest' and b.sydney_day=target_day))
 and (not r.launch_only and r.expires_at>private.impact_now() or r.digest_at<=private.impact_now() and (r.digest_at at time zone 'Australia/Sydney')::date=(private.impact_now() at time zone 'Australia/Sydney')::date)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=r.user_id)
 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=r.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=r.user_id and p.suspended)
 and not private.impact_rated(r.user_id,r.event_id,w.aliases)
 order by r.ready_at desc,r.id limit 100)
 select jsonb_build_object('account',(select jsonb_build_object('userId',s.user_id,'preferences',s.preferences,'actions',s.event_user_state,'archivedEvents',s.archived_events,'updatedAt',s.updated_at) from public.nothingsports_user_state s where s.user_id=target_user and private.impact_enabled(s.preferences)),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'kind','impact_request','eventId',r.event_id,'phase','impact','title','Rate the Impact','detail',r.title,'at',r.ready_at,'version',1,'read',false) order by r.ready_at desc,r.id) from candidates r),'[]'));
$$;
-- No private table is exposed through PostgREST. Service-only wrappers retain
-- invoker security and use a fixed empty search path.
create function public.nothingsports_impact_inventory() returns jsonb language sql security invoker set search_path='' as $$ select private.impact_inventory() $$;
create function public.nothingsports_impact_reconcile(packets jsonb,observations jsonb) returns void language sql security invoker set search_path='' as $$ select private.impact_reconcile(packets,observations) $$;
create function public.nothingsports_impact_claim() returns jsonb language sql security invoker set search_path='' as $$ select private.impact_claim() $$;
create function public.nothingsports_impact_begin(batch uuid,installation uuid,token uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.impact_begin(batch,installation,token) $$;
create function public.nothingsports_impact_finish(batch uuid,installation uuid,token uuid,outcome text) returns void language sql security invoker set search_path='' as $$ select private.impact_finish(batch,installation,token,outcome) $$;
create function public.nothingsports_impact_page(target_user uuid,target_event text default null,target_day date default null) returns jsonb language sql security invoker set search_path='' as $$ select private.impact_page(target_user,target_event,target_day) $$;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname=any(array['impact_now','impact_next_tick','impact_next_morning','impact_canonical','impact_capture_vote','impact_enabled','impact_rated','impact_available','impact_inventory','impact_reconcile','impact_claim','impact_begin','impact_finish','impact_inbox_eligible','impact_page'])) or (n.nspname='public' and p.proname=any(array['nothingsports_impact_inventory','nothingsports_impact_reconcile','nothingsports_impact_claim','nothingsports_impact_begin','nothingsports_impact_finish','nothingsports_impact_page'])) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
end loop;end $$;
grant usage on schema private to service_role;

notify pgrst, 'reload schema';
