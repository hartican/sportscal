-- Private account archives and editorial evidence. Browser table/RPC access is denied.
create table public.nothingsports_fixture_curators(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('chief_admin','curator')),
 assigned_by uuid references auth.users(id) on delete set null, assigned_at timestamptz not null default now()
);
create unique index nothingsports_one_chief_curator on public.nothingsports_fixture_curators(role) where role='chief_admin';
create table public.nothingsports_curator_audit(
 id bigint generated always as identity primary key,actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,before_role text,after_role text,recorded_at timestamptz not null default now()
);
create table public.nothingsports_classic_fixtures(
 event_id text primary key,fixture jsonb not null default '{}',first_five_at timestamptz,
 first_five_phase text check(first_five_phase in ('heat','pulse','impact')),
 updated_at timestamptz not null default now(),check(jsonb_typeof(fixture)='object')
);
create table public.nothingsports_classic_aliases(
 alias text primary key,event_id text not null
);
create index on public.nothingsports_classic_aliases(event_id);
create table public.nothingsports_personal_classics(
 user_id uuid references auth.users(id) on delete cascade,event_id text references public.nothingsports_classic_fixtures(event_id),
 qualified_at timestamptz not null,qualified_phase text not null check(qualified_phase in ('heat','pulse','impact')),
 removed_at timestamptz,revision integer not null default 0,primary key(user_id,event_id)
);
create index on public.nothingsports_personal_classics(user_id,qualified_at desc,event_id);
create table public.nothingsports_classic_editorial(
 event_id text references public.nothingsports_classic_fixtures(event_id),phase text check(phase in ('heat','pulse','impact')),
 milestone text check(milestone in ('first-five','final','correction')),
 content_hash text,copy jsonb not null,source_urls jsonb not null default '[]',published_sha text,
 captured_at timestamptz not null default now(),primary key(event_id,phase,milestone,content_hash)
);
create table public.nothingsports_classic_reviews(
 user_id uuid references auth.users(id) on delete cascade,year integer check(year between 1900 and 2200),
 selection jsonb not null default '[]',caption text not null default '',revision integer not null default 0,
 invited_at timestamptz,seen_at timestamptz,updated_at timestamptz not null default now(),primary key(user_id,year),
 check(jsonb_typeof(selection)='array'),check(octet_length(selection::text)<=100000),check(length(caption)<=4000)
);
create table public.nothingsports_classic_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,year_review_enabled boolean not null default true
);
create table public.nothingsports_editorial_backlog(
 event_id text primary key,tier smallint not null check(tier between 3 and 5),published_ns_score smallint not null default 0 check(published_ns_score between 0 and 5),editorial_eligible boolean not null default true,qualified_at timestamptz not null default now(),
 status text not null default 'awaiting-result' check(status in ('awaiting-result','due','researching','staged','published','deferred')),
 fixture jsonb not null default '{}',observations jsonb not null default '{}',result_signature text,facts_signature text,published_signature text,staged_copy jsonb,
 held boolean not null default false,last_error jsonb,attempt_day date,attempt_units smallint,
 revision integer not null default 0,updated_at timestamptz not null default now()
);
create index on public.nothingsports_editorial_backlog(status,tier desc,qualified_at,event_id);
create table public.nothingsports_editorial_daily_budget(day date primary key,spent smallint not null default 0 check(spent between 0 and 12));
create table public.nothingsports_year_review_deliveries(
 user_id uuid references auth.users(id) on delete cascade,year integer,
 installation_id uuid references public.nothingsports_push_installations(installation_id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','uncertain','suppressed')),
 attempts smallint not null default 0,updated_at timestamptz not null default now(),primary key(user_id,year,installation_id)
);
do $$ declare t text; begin
 foreach t in array array['fixture_curators','curator_audit','classic_fixtures','classic_aliases','personal_classics','classic_editorial','classic_reviews','classic_settings','editorial_backlog','editorial_daily_budget','year_review_deliveries'] loop
 execute format('alter table public.%I enable row level security','nothingsports_'||t);
 execute format('alter table public.%I force row level security','nothingsports_'||t);
 execute format('revoke all on public.%I from public,anon,authenticated','nothingsports_'||t);
 execute format('grant all on public.%I to service_role','nothingsports_'||t);
 end loop;
end $$;
grant usage,select on sequence public.nothingsports_curator_audit_id_seq to service_role;


-- Historical qualification survives; NS effort uses current picks, not their old maximum.
create function private.nothingsports_refresh_epic_tier(canonical text) returns void
language plpgsql security definer set search_path='' as $$ declare current_ns integer; community_max integer; genuine_max integer; level integer; eligible boolean; begin
 with latest as(
 select distinct on(c.user_id,c.phase) c.user_id,c.phase,c.rating from public.nothingsports_nsc_contributions c
 join public.nothingsports_fixture_curators n on n.user_id=c.user_id
 join auth.users u on u.id=c.user_id and not coalesce(u.is_anonymous,false)
 where (c.event_id=canonical or exists(select 1 from public.nothingsports_classic_aliases a where a.alias=c.event_id and a.event_id=canonical)) and c.updated_at<=now()
 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=c.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=c.user_id and p.suspended)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=c.user_id)
 order by c.user_id,c.phase,c.updated_at desc,c.event_id)
 select coalesce(max(rating),0) into current_ns from latest;
 select coalesce(max(e.rating) filter(where not exists(select 1 from public.nothingsports_fixture_curators n where n.user_id=e.user_id)),0),coalesce(max(e.rating),0) into community_max,genuine_max from(
 select user_id,event_id,rating,recorded_at observed from public.nothingsports_nsc_rating_history
 union all select user_id,event_id,rating,updated_at from public.nothingsports_nsc_contributions) e
 join auth.users u on u.id=e.user_id and not coalesce(u.is_anonymous,false)
 where e.rating>=4 and e.observed<=now() and (e.event_id=canonical or exists(select 1 from public.nothingsports_classic_aliases a where a.alias=e.event_id and a.event_id=canonical))

 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=e.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=e.user_id and p.suspended)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=e.user_id);
 select greatest(3,published_ns_score,current_ns,community_max),published_ns_score>=3 or current_ns>=3 or genuine_max>=4 into level,eligible from public.nothingsports_editorial_backlog where event_id=canonical;
 if level is null then return;end if;
 update public.nothingsports_editorial_backlog set tier=level,editorial_eligible=eligible,revision=revision+1,updated_at=now(),
 status=case when not eligible and status<>'published' then 'deferred' when eligible and not editorial_eligible and status<>'published' then case when fixture->>'completed'='true' then 'due' else 'awaiting-result' end when level>tier and fixture->>'completed'='true' and status='published' and coalesce((staged_copy->>'tier')::integer,0)<level then 'due' else status end,
 last_error=case when not eligible and status<>'published' then jsonb_build_object('reason','No current NS 3+ pick or genuine 4+ history qualifies this retained job.','nextAction','Retain the history; reconsider only when a qualifying rating or published NS pick arrives.') when eligible and last_error->>'reason'='No current NS 3+ pick or genuine 4+ history qualifies this retained job.' then null else last_error end
 where event_id=canonical and (tier<>level or editorial_eligible<>eligible or not eligible and status not in ('published','deferred'));
end $$;
revoke all on function private.nothingsports_refresh_epic_tier(text) from public,anon,authenticated;
grant execute on function private.nothingsports_refresh_epic_tier(text) to service_role;

create function private.nothingsports_capture_classic_vote() returns trigger
language plpgsql security definer set search_path='' as $$
declare canonical text; observed timestamptz; ns boolean; level integer;
begin
 if not exists(select 1 from auth.users u where u.id=new.user_id and not coalesce(u.is_anonymous,false))
 or exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=new.user_id and p.moderation_flag)
 or exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=new.user_id and p.suspended) then return new; end if;
 canonical:=coalesce((select event_id from public.nothingsports_classic_aliases where alias=new.event_id),new.event_id);
 observed:=coalesce(new.updated_at,now());
 if observed>now() then return new; end if;
 ns:=exists(select 1 from public.nothingsports_fixture_curators where user_id=new.user_id);
 level:=case when new.rating>=4 or ns and new.rating>=3 then new.rating else null end;
 if level is not null then
 insert into public.nothingsports_editorial_backlog(event_id,tier,qualified_at) values(canonical,level,observed)
 on conflict(event_id) do update set status=case when excluded.tier>nothingsports_editorial_backlog.tier and nothingsports_editorial_backlog.fixture->>'completed'='true' then 'due' else nothingsports_editorial_backlog.status end,revision=nothingsports_editorial_backlog.revision+case when excluded.tier>nothingsports_editorial_backlog.tier then 1 else 0 end,tier=greatest(nothingsports_editorial_backlog.tier,excluded.tier),qualified_at=least(nothingsports_editorial_backlog.qualified_at,excluded.qualified_at);
 end if;
 if new.rating=5 then
 insert into public.nothingsports_classic_fixtures(event_id,first_five_at,first_five_phase) values(canonical,observed,new.phase)
 on conflict(event_id) do update set first_five_at=least(nothingsports_classic_fixtures.first_five_at,excluded.first_five_at),first_five_phase=case when excluded.first_five_at<nothingsports_classic_fixtures.first_five_at then excluded.first_five_phase else nothingsports_classic_fixtures.first_five_phase end;
 insert into public.nothingsports_personal_classics(user_id,event_id,qualified_at,qualified_phase) values(new.user_id,canonical,observed,new.phase)
 on conflict(user_id,event_id) do update set qualified_phase=case when excluded.qualified_at<nothingsports_personal_classics.qualified_at then excluded.qualified_phase else nothingsports_personal_classics.qualified_phase end,qualified_at=least(nothingsports_personal_classics.qualified_at,excluded.qualified_at);
 end if;
 perform private.nothingsports_refresh_epic_tier(canonical);
 return new;
end $$;
revoke all on function private.nothingsports_capture_classic_vote() from public,anon,authenticated;
create trigger nothingsports_capture_classic_vote after insert or update on public.nothingsports_nsc_contributions for each row execute function private.nothingsports_capture_classic_vote();

-- A stale whole-account patch can never undo a permanent personal purge.
create function private.nothingsports_preserve_card_purges() returns trigger
language plpgsql set search_path='' as $$ declare item record; current_value jsonb;
begin
 for item in select key,value from jsonb_each(coalesce(old.event_user_state,'{}')) where value->>'isPurged'='true' loop
 current_value:=coalesce(new.event_user_state->item.key,'{}');
 new.event_user_state:=jsonb_set(coalesce(new.event_user_state,'{}'),array[item.key],((item.value||current_value)-'addedFixture'-'snapshot')||jsonb_strip_nulls(jsonb_build_object('actionKey',item.value->'actionKey','canonicalEventId',item.value->'canonicalEventId','eventId',item.value->'eventId','id',item.value->'id','sourceEventId',item.value->'sourceEventId','sourceEventIds',item.value->'sourceEventIds'))||jsonb_build_object('isPurged',true,'purgedAt',item.value->'purgedAt','saved',false,'watchLater',false,'archived',false,'addedToFixtures',false),true);
 end loop;
 return new;
end $$;
revoke all on function private.nothingsports_preserve_card_purges() from public,anon,authenticated;
create trigger nothingsports_preserve_card_purges before update on public.nothingsports_user_state for each row execute function private.nothingsports_preserve_card_purges();

create function public.nothingsports_classic_mutation(target_user uuid,command jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare action text:=command->>'action'; current_revision integer; affected integer; item text; role_before text; target uuid; pick jsonb; purged_ids jsonb:='[]';
begin
 if action='remove' or action='save' then
 select revision into current_revision from public.nothingsports_personal_classics where user_id=target_user and event_id=command->>'eventId' for update;
 if current_revision is null then raise exception 'classic_not_found'; end if;
 if command->>'revision' is null or current_revision<>(command->>'revision')::integer then raise exception 'classic_revision_conflict'; end if;
 update public.nothingsports_personal_classics set removed_at=case when action='remove' then now() else null end,revision=revision+1 where user_id=target_user and event_id=command->>'eventId';
 return jsonb_build_object('updated',true,'revision',current_revision+1);
 elsif action='review-save' or action='review-seen' then
 insert into public.nothingsports_classic_reviews(user_id,year) values(target_user,(command->>'year')::integer) on conflict do nothing;
 select revision into current_revision from public.nothingsports_classic_reviews where user_id=target_user and year=(command->>'year')::integer for update;
 if action='review-seen' then update public.nothingsports_classic_reviews set seen_at=now() where user_id=target_user and year=(command->>'year')::integer and seen_at is null;return jsonb_build_object('updated',found,'claimed',found);end if;
 if command->>'revision' is null or current_revision<>(command->>'revision')::integer then raise exception 'classic_revision_conflict'; end if;
 if jsonb_typeof(command->'selection')<>'array' then raise exception 'invalid_review_selection';end if;
 for pick in select value from jsonb_array_elements(command->'selection') loop
 if not exists(select 1 from public.nothingsports_personal_classics c join public.nothingsports_classic_fixtures f using(event_id) where c.user_id=target_user and c.removed_at is null and c.event_id=pick->>'eventId' and (f.fixture->>'year')::integer=(command->>'year')::integer and f.fixture->>'completed'='true') then raise exception 'review_fixture_not_owned_or_completed';end if;
 if length(coalesce(pick->>'note',''))>1000 then raise exception 'review_note_too_long';end if;
 end loop;
 update public.nothingsports_classic_reviews set selection=command->'selection',caption=coalesce(command->>'caption',''),revision=revision+1,updated_at=now() where user_id=target_user and year=(command->>'year')::integer;
 return jsonb_build_object('updated',true,'revision',current_revision+1);
 elsif action='notifications' then
 insert into public.nothingsports_classic_settings(user_id,year_review_enabled) values(target_user,(command->>'enabled')::boolean) on conflict(user_id) do update set year_review_enabled=excluded.year_review_enabled;
 return jsonb_build_object('updated',true);
 elsif action='purge' then
 perform 1 from public.nothingsports_user_state where user_id=target_user for update;affected:=0;
 for item in select jsonb_array_elements_text(command->'ids') loop
 update public.nothingsports_user_state set event_user_state=jsonb_set(event_user_state,array[item],(coalesce(event_user_state->item,'{}')-'addedFixture'-'snapshot')||jsonb_build_object('isPurged',true,'purgedAt',now(),'saved',false,'watchLater',false,'archived',false,'addedToFixtures',false),true),updated_at=now() where user_id=target_user and (event_user_state->item->>'dismissed'='true' or event_user_state->item->>'isDismissed'='true');
 if found then affected:=affected+1;purged_ids:=purged_ids||jsonb_build_array(item);end if;
 end loop;
 return jsonb_build_object('updated',true,'purgedCount',affected,'purgedIds',purged_ids);
 else raise exception 'invalid_classic_action';end if;
end $$;
revoke all on function public.nothingsports_classic_mutation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_classic_mutation(uuid,jsonb) to service_role;

create function private.nothingsports_assign_fixture_curator(actor uuid,target uuid,enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$ declare before_role text; event record; begin
 if not exists(select 1 from public.nothingsports_fixture_curators where user_id=actor and role='chief_admin') then raise exception 'chief_admin_required';end if;
 if not exists(select 1 from auth.users where id=target and not coalesce(is_anonymous,false)) then raise exception 'registered_account_required';end if;
 select role into before_role from public.nothingsports_fixture_curators where user_id=target for update;
 if before_role='chief_admin' then raise exception 'chief_admin_cannot_be_reassigned';end if;
 if enabled then
 insert into public.nothingsports_fixture_curators(user_id,role,assigned_by) values(target,'curator',actor) on conflict(user_id) do update set role='curator',assigned_by=actor,assigned_at=now();
 else delete from public.nothingsports_fixture_curators where user_id=target;end if;
 insert into public.nothingsports_nsc_personas(user_id,persona,assigned_by,assigned_at) values(target,case when enabled then 'curator' else 'general' end,actor,now()) on conflict(user_id) do update set persona=excluded.persona,assigned_by=actor,assigned_at=now();
 insert into public.nothingsports_curator_audit(actor_id,target_id,before_role,after_role) values(actor,target,before_role,case when enabled then 'curator' else null end);
 if enabled then perform private.nothingsports_backfill_classics(target);end if;
 for event in select distinct coalesce(a.event_id,c.event_id) event_id from public.nothingsports_nsc_contributions c left join public.nothingsports_classic_aliases a on a.alias=c.event_id where c.user_id=target loop perform private.nothingsports_refresh_epic_tier(event.event_id);end loop;
 return jsonb_build_object('updated',true);
end $$;
revoke all on function private.nothingsports_assign_fixture_curator(uuid,uuid,boolean) from public,anon,authenticated;
create function public.nothingsports_assign_fixture_curator(actor uuid,target uuid,enabled boolean) returns jsonb language sql security invoker set search_path='' as $$ select private.nothingsports_assign_fixture_curator(actor,target,enabled); $$;
revoke all on function public.nothingsports_assign_fixture_curator(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.nothingsports_assign_fixture_curator(uuid,uuid,boolean),private.nothingsports_assign_fixture_curator(uuid,uuid,boolean) to service_role;

create unique index nothingsports_classic_final_milestone on public.nothingsports_classic_editorial(event_id,phase) where milestone='final';
create unique index nothingsports_classic_first_preview on public.nothingsports_classic_editorial(event_id,phase) where milestone='first-five';

-- Ratings can arrive while the initial alias catalogue is being registered.
-- Reconcile provisional archive IDs without reviving a removed personal entry
-- or dropping its earlier writing, curation or outstanding research.
create function private.nothingsports_reconcile_classic_aliases() returns void language plpgsql security invoker set search_path='' as $$
declare mapping record;
begin
 for mapping in select f.event_id old_id,a.event_id new_id from (select event_id from public.nothingsports_classic_fixtures union select event_id from public.nothingsports_editorial_backlog) f join public.nothingsports_classic_aliases a on a.alias=f.event_id where f.event_id<>a.event_id loop
 insert into public.nothingsports_classic_fixtures(event_id,fixture,first_five_at,first_five_phase)
 select mapping.new_id,fixture,first_five_at,first_five_phase from public.nothingsports_classic_fixtures where event_id=mapping.old_id
 on conflict(event_id) do update set fixture=case when nothingsports_classic_fixtures.fixture='{}'::jsonb then excluded.fixture else nothingsports_classic_fixtures.fixture end,first_five_phase=case when excluded.first_five_at<nothingsports_classic_fixtures.first_five_at then excluded.first_five_phase else nothingsports_classic_fixtures.first_five_phase end,first_five_at=least(nothingsports_classic_fixtures.first_five_at,excluded.first_five_at);
 insert into public.nothingsports_personal_classics(user_id,event_id,qualified_at,qualified_phase,removed_at,revision)
 select user_id,mapping.new_id,qualified_at,qualified_phase,removed_at,revision from public.nothingsports_personal_classics where event_id=mapping.old_id
 on conflict(user_id,event_id) do update set qualified_phase=case when excluded.qualified_at<nothingsports_personal_classics.qualified_at then excluded.qualified_phase else nothingsports_personal_classics.qualified_phase end,qualified_at=least(nothingsports_personal_classics.qualified_at,excluded.qualified_at),removed_at=coalesce(nothingsports_personal_classics.removed_at,excluded.removed_at),revision=greatest(nothingsports_personal_classics.revision,excluded.revision)+1;
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at)
 select mapping.new_id,phase,'correction',content_hash,copy,source_urls,published_sha,captured_at from public.nothingsports_classic_editorial old_copy where event_id=mapping.old_id and milestone='final' and exists(select 1 from public.nothingsports_classic_editorial c where c.event_id=mapping.new_id and c.phase=old_copy.phase and c.milestone='final' and c.content_hash<>old_copy.content_hash) on conflict do nothing;
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at)
 select mapping.new_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at from public.nothingsports_classic_editorial where event_id=mapping.old_id on conflict do nothing;
 update public.nothingsports_classic_editorial c set content_hash=o.content_hash,copy=o.copy,source_urls=o.source_urls,published_sha=o.published_sha,captured_at=o.captured_at from public.nothingsports_classic_editorial o where c.event_id=mapping.new_id and o.event_id=mapping.old_id and c.phase=o.phase and c.milestone='first-five' and o.milestone='first-five' and o.captured_at<c.captured_at;
 insert into public.nothingsports_editorial_backlog(event_id,tier,published_ns_score,editorial_eligible,qualified_at,status,fixture,observations,result_signature,facts_signature,published_signature,staged_copy,held,last_error,attempt_day,attempt_units)
 select mapping.new_id,tier,published_ns_score,editorial_eligible,qualified_at,status,fixture,observations,result_signature,facts_signature,published_signature,staged_copy,held,last_error,attempt_day,attempt_units from public.nothingsports_editorial_backlog where event_id=mapping.old_id
 on conflict(event_id) do update set published_ns_score=greatest(nothingsports_editorial_backlog.published_ns_score,excluded.published_ns_score),tier=greatest(nothingsports_editorial_backlog.tier,excluded.tier),qualified_at=least(nothingsports_editorial_backlog.qualified_at,excluded.qualified_at),held=nothingsports_editorial_backlog.held or excluded.held,staged_copy=coalesce(nothingsports_editorial_backlog.staged_copy,excluded.staged_copy),status=case when nothingsports_editorial_backlog.status='awaiting-result' then excluded.status else nothingsports_editorial_backlog.status end,revision=nothingsports_editorial_backlog.revision+1;
 update public.nothingsports_classic_reviews r set selection=(select coalesce(jsonb_agg(pick order by position),'[]') from (select distinct on(pick->>'eventId') pick,position from (select case when value->>'eventId'=mapping.old_id then jsonb_set(value,'{eventId}',to_jsonb(mapping.new_id)) else value end pick,ordinality position from jsonb_array_elements(r.selection) with ordinality) replaced order by pick->>'eventId',position) deduplicated),revision=revision+1 where selection @>jsonb_build_array(jsonb_build_object('eventId',mapping.old_id));
 delete from public.nothingsports_personal_classics where event_id=mapping.old_id;
 delete from public.nothingsports_classic_editorial where event_id=mapping.old_id;
 delete from public.nothingsports_editorial_backlog where event_id=mapping.old_id;
 delete from public.nothingsports_classic_fixtures where event_id=mapping.old_id;
 end loop;
end $$;
revoke all on function private.nothingsports_reconcile_classic_aliases() from public,anon,authenticated;
grant execute on function private.nothingsports_reconcile_classic_aliases() to service_role;
create function public.nothingsports_record_classic_fixtures(records jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; part jsonb; held_value boolean; fixture_alias text; id text; previous public.nothingsports_classic_editorial; count_records integer:=0; ns integer;
begin
 if jsonb_typeof(records)<>'array' or jsonb_array_length(records)>100 or octet_length(records::text)>1000000 then raise exception 'classic_batch_too_large';end if;
 for item in select value from jsonb_array_elements(records) loop
 id:=item->>'eventId';if id is null or length(id)>180 then raise exception 'invalid_classic_fixture';end if;
 for fixture_alias in select jsonb_array_elements_text(coalesce(item->'aliases','[]')) loop
 insert into public.nothingsports_classic_aliases(alias,event_id) values(fixture_alias,id) on conflict(alias) do nothing;
 if exists(select 1 from public.nothingsports_classic_aliases a where a.alias=fixture_alias and a.event_id<>id) then raise exception 'classic_alias_conflict';end if;
 end loop;
 perform private.nothingsports_reconcile_classic_aliases();
 ns:=coalesce((item->>'nsScore')::integer,0);
 held_value:=coalesce((item->>'held')::boolean,(select held from public.nothingsports_editorial_maintenance where event_id=id));
 if ns>=3 then insert into public.nothingsports_editorial_backlog(event_id,tier,qualified_at) values(id,least(ns,5),coalesce((item->>'observedAt')::timestamptz,now())) on conflict(event_id) do update set status=case when excluded.tier>nothingsports_editorial_backlog.tier and nothingsports_editorial_backlog.fixture->>'completed'='true' then 'due' else nothingsports_editorial_backlog.status end,revision=nothingsports_editorial_backlog.revision+case when excluded.tier>nothingsports_editorial_backlog.tier then 1 else 0 end,tier=greatest(nothingsports_editorial_backlog.tier,excluded.tier);end if;
 update public.nothingsports_editorial_backlog set published_ns_score=least(greatest(ns,0),5) where event_id=id and published_ns_score<>least(greatest(ns,0),5);
 perform private.nothingsports_refresh_epic_tier(id);
 if ns=5 then insert into public.nothingsports_classic_fixtures(event_id,first_five_at,first_five_phase) values(id,now(),'heat') on conflict do nothing;end if;
 update public.nothingsports_editorial_backlog set fixture=item->'fixture',status=case when status='staged' and staged_copy->>'resultSignature' is distinct from item->>'resultSignature' then 'due' when status='researching' or status='staged' then status when (item->'fixture'->>'completed')='true' and (published_signature is distinct from item->>'resultSignature' or coalesce((staged_copy->>'tier')::integer,0)<tier) then 'due' when status='published' then status else 'awaiting-result' end,result_signature=item->>'resultSignature',facts_signature=item->>'factsSignature',held=coalesce(held_value,held),revision=revision+1,updated_at=now() where event_id=id and (fixture is distinct from item->'fixture' or result_signature is distinct from item->>'resultSignature' or held is distinct from coalesce(held_value,held) or (status='published' and coalesce((staged_copy->>'tier')::integer,0)<tier));
 if exists(select 1 from public.nothingsports_classic_fixtures where event_id=id) then
 update public.nothingsports_classic_fixtures set fixture=case when item->'fixture' ? 'highlights' or not fixture ? 'highlights' then item->'fixture' else item->'fixture'||jsonb_build_object('highlights',fixture->'highlights') end,updated_at=now() where event_id=id and fixture is distinct from item->'fixture';
 for part in select value from jsonb_array_elements(coalesce(item->'copies','[]')) loop
 if part->>'milestone'='first-five' then
 if not exists(select 1 from public.nothingsports_classic_fixtures f where f.event_id=id and (f.first_five_at>=now()-interval '5 minutes' or coalesce((part->'copy'->>'researchedAt')::timestamptz,(part->'copy'->>'observedAt')::timestamptz)>='1900-01-01'::timestamptz and coalesce((part->'copy'->>'researchedAt')::timestamptz,(part->'copy'->>'observedAt')::timestamptz)<=f.first_five_at)) then continue;end if;
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at) values(id,part->>'phase','first-five',part->>'hash',part->'copy',coalesce(part->'sourceUrls','[]'),item->>'publishedSha',now()) on conflict(event_id,phase) where milestone='first-five' do nothing;
 else
 select * into previous from public.nothingsports_classic_editorial where event_id=id and phase=part->>'phase' and milestone='final';
 if previous.content_hash is not null and previous.content_hash<>part->>'hash' and coalesce((previous.copy->>'finalized')::boolean,false) then
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha) values(id,part->>'phase','correction',previous.content_hash,previous.copy,previous.source_urls,previous.published_sha) on conflict do nothing;
 end if;
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at) values(id,part->>'phase','final',part->>'hash',part->'copy',coalesce(part->'sourceUrls','[]'),item->>'publishedSha',now()) on conflict(event_id,phase) where milestone='final' do update set content_hash=excluded.content_hash,copy=excluded.copy,source_urls=excluded.source_urls,published_sha=excluded.published_sha,captured_at=excluded.captured_at where nothingsports_classic_editorial.content_hash<>excluded.content_hash;
 end if;
 end loop;
 end if;
 perform private.nothingsports_refresh_epic_tier(id);
 count_records:=count_records+1;
 end loop;
 return jsonb_build_object('recorded',count_records);
end $$;
revoke all on function public.nothingsports_record_classic_fixtures(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_record_classic_fixtures(jsonb) to service_role;

-- Publication commits archive copies and their control receipt together. A
-- curator hold or a newer result aborts the complete transaction before writes.
create function public.nothingsports_commit_epic_publication(operations jsonb,records jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; affected integer:=0;
begin
 if jsonb_typeof(operations)<>'array' or jsonb_array_length(operations)>100 then raise exception 'invalid_epic_publication';end if;
 for item in select value from jsonb_array_elements(operations) loop
 perform 1 from public.nothingsports_editorial_backlog where event_id=item->>'eventId' and revision=(item->>'revision')::integer and not held and editorial_eligible for update;
 if not found then raise exception 'epic_revision_conflict';end if;
 if item->'change'->>'status'='published' and not exists(select 1 from public.nothingsports_editorial_backlog where event_id=item->>'eventId' and status='staged' and result_signature=item->'change'->>'published_signature' and staged_copy->>'resultSignature'=result_signature) then raise exception 'epic_result_changed';end if;
 end loop;
 perform public.nothingsports_record_classic_fixtures(records);
 for item in select value from jsonb_array_elements(operations) loop
 update public.nothingsports_editorial_backlog set status=coalesce(item->'change'->>'status',status),published_signature=coalesce(item->'change'->>'published_signature',published_signature),last_error=item->'change'->'last_error',revision=(item->>'revision')::integer+1,updated_at=now() where event_id=item->>'eventId';affected:=affected+1;
 end loop;
 return jsonb_build_object('committed',affected);
end $$;
revoke all on function public.nothingsports_commit_epic_publication(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_commit_epic_publication(jsonb,jsonb) to service_role;

create function private.nothingsports_backfill_classics(only_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record; canonical text; qualifies_ns boolean; n integer:=0;
begin
 for item in select user_id,event_id,phase,rating,observed from (
 select user_id,event_id,phase,rating,recorded_at observed from public.nothingsports_nsc_rating_history
 union all select user_id,event_id,phase,rating,updated_at from public.nothingsports_nsc_contributions) e
 where (only_user is null or user_id=only_user) and rating>=3 and observed<=now() and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=e.user_id) and exists(select 1 from auth.users u where u.id=e.user_id and not coalesce(u.is_anonymous,false))
 and not exists(select 1 from public.nothingsports_nsc_personas p where p.user_id=e.user_id and p.moderation_flag)
 and not exists(select 1 from public.nothingsports_nsc_pilot_members p where p.user_id=e.user_id and p.suspended)
 order by observed asc loop
 canonical:=coalesce((select event_id from public.nothingsports_classic_aliases where alias=item.event_id),item.event_id);
 qualifies_ns:=exists(select 1 from public.nothingsports_fixture_curators where user_id=item.user_id);
 if item.rating>=4 or qualifies_ns then
 insert into public.nothingsports_editorial_backlog(event_id,tier,qualified_at) values(canonical,item.rating,item.observed) on conflict(event_id) do update set status=case when excluded.tier>nothingsports_editorial_backlog.tier and nothingsports_editorial_backlog.fixture->>'completed'='true' then 'due' else nothingsports_editorial_backlog.status end,revision=nothingsports_editorial_backlog.revision+case when excluded.tier>nothingsports_editorial_backlog.tier then 1 else 0 end,tier=greatest(nothingsports_editorial_backlog.tier,excluded.tier),qualified_at=least(nothingsports_editorial_backlog.qualified_at,excluded.qualified_at);
 end if;
 if item.rating=5 then
 insert into public.nothingsports_classic_fixtures(event_id,first_five_at,first_five_phase) values(canonical,item.observed,item.phase) on conflict(event_id) do update set first_five_phase=case when excluded.first_five_at<nothingsports_classic_fixtures.first_five_at then excluded.first_five_phase else nothingsports_classic_fixtures.first_five_phase end,first_five_at=least(nothingsports_classic_fixtures.first_five_at,excluded.first_five_at);
 insert into public.nothingsports_personal_classics(user_id,event_id,qualified_at,qualified_phase) values(item.user_id,canonical,item.observed,item.phase) on conflict(user_id,event_id) do update set qualified_phase=case when excluded.qualified_at<nothingsports_personal_classics.qualified_at then excluded.qualified_phase else nothingsports_personal_classics.qualified_phase end,qualified_at=least(nothingsports_personal_classics.qualified_at,excluded.qualified_at);
 end if;
 n:=n+1;
 end loop;
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,published_sha,captured_at) select c.event_id,c.phase,'correction',c.content_hash,c.copy,c.source_urls,c.published_sha,c.captured_at from public.nothingsports_classic_editorial c join public.nothingsports_classic_fixtures f using(event_id) where c.milestone='first-five' and coalesce((c.copy->>'researchedAt')::timestamptz,(c.copy->>'observedAt')::timestamptz,c.captured_at)>f.first_five_at+interval '5 minutes' on conflict do nothing;
 delete from public.nothingsports_classic_editorial c using public.nothingsports_classic_fixtures f where c.event_id=f.event_id and c.milestone='first-five' and coalesce((c.copy->>'researchedAt')::timestamptz,(c.copy->>'observedAt')::timestamptz,c.captured_at)>f.first_five_at+interval '5 minutes';
 for canonical in select event_id from public.nothingsports_editorial_backlog loop perform private.nothingsports_refresh_epic_tier(canonical);end loop;
 update public.nothingsports_editorial_backlog set last_error=jsonb_build_object('reason','Historical fixture detail or verified completion is unavailable.','nextAction','Recover the retained source; never reconstruct missing original writing.') where fixture='{}'::jsonb and last_error is null;
 return jsonb_build_object('evidenceRows',n,'classics',(select count(*) from public.nothingsports_personal_classics),'backlog',(select count(*) from public.nothingsports_editorial_backlog));
end $$;
revoke all on function private.nothingsports_backfill_classics(uuid) from public,anon,authenticated;
create function public.nothingsports_backfill_classics() returns jsonb language sql security invoker set search_path='' as $$ select private.nothingsports_backfill_classics(); $$;
revoke all on function public.nothingsports_backfill_classics() from public,anon,authenticated;
grant execute on function public.nothingsports_backfill_classics(),private.nothingsports_backfill_classics(uuid) to service_role;

-- Claims spend research effort even when research later defers; repeat claims
-- for the same day resume their existing work instead of spending again.
create function public.nothingsports_claim_epic_editorial(claim_day date) returns setof public.nothingsports_editorial_backlog
language plpgsql security invoker set search_path='' as $$ declare row public.nothingsports_editorial_backlog; remaining integer; cost integer;
begin
 if claim_day<>(now() at time zone 'Australia/Sydney')::date then raise exception 'editorial_claim_wrong_day';end if;
 insert into public.nothingsports_editorial_daily_budget(day) values(claim_day) on conflict do nothing;
 select 12-spent into remaining from public.nothingsports_editorial_daily_budget where day=claim_day for update;
 for row in select * from public.nothingsports_editorial_backlog where not held and editorial_eligible and status in ('due','deferred','researching') and fixture->>'completed'='true' order by tier desc,qualified_at,event_id for update loop
 if row.attempt_day=claim_day then if row.status='researching' then return next row;end if;continue;end if;
 cost:=case row.tier when 5 then 4 when 4 then 2 else 1 end;
 if cost>remaining then continue;end if;
 update public.nothingsports_editorial_backlog set status='researching',attempt_day=claim_day,attempt_units=cost,revision=revision+1,updated_at=now() where event_id=row.event_id returning * into row;
 update public.nothingsports_editorial_daily_budget set spent=spent+cost where day=claim_day;
 remaining:=remaining-cost;return next row;
 end loop;
end $$;
revoke all on function public.nothingsports_claim_epic_editorial(date) from public,anon,authenticated;
grant execute on function public.nothingsports_claim_epic_editorial(date) to service_role;

-- Archive the already accepted source publication; no viewer-side writes,
-- provider request, extra scheduler or new full source/revision history.
create function private.nothingsports_capture_classic_observation() returns trigger
language plpgsql set search_path='' as $$
declare facts jsonb; score_facts jsonb; fixture_id text; canonical text; published_source text; observed text; live_body text; preserved jsonb; last_day text;
begin
 if tg_table_name='nothingsports_fixture_current' then
 facts:=new.fixture;fixture_id:=new.fixture_id;
 select score into score_facts from public.nothingsports_live_scores s where s.fixture_id=new.fixture_id;
 else
 score_facts:=new.score;fixture_id:=new.fixture_id;
 select fixture into facts from public.nothingsports_fixture_current f where f.fixture_id=new.fixture_id;
 end if;
 if facts is null then return new;end if;
 -- Sporting phase and dates belong to the accepted fixture. A score-only row
 -- cannot complete a postponed or still-unconfirmed fixture.
 if tg_table_name='nothingsports_fixture_current' then facts:=(coalesce(score_facts,'{}')-'actualEndTimeUtc'-'completedAt'-'firstConfirmedCompleteAt')||facts;
 else facts:=((facts||coalesce(score_facts,'{}'))-'actualEndTimeUtc'-'completedAt'-'firstConfirmedCompleteAt')||jsonb_strip_nulls(jsonb_build_object('status',facts->'status','date',facts->'date','endDate',facts->'endDate','actualEndTimeUtc',facts->'actualEndTimeUtc','completedAt',facts->'completedAt','firstConfirmedCompleteAt',facts->'firstConfirmedCompleteAt'));end if;
 canonical:=coalesce((select a.event_id from public.nothingsports_classic_aliases a where a.alias=fixture_id),fixture_id);
 facts:=facts||jsonb_strip_nulls((select jsonb_build_object('actualEndTimeUtc',coalesce(facts->'actualEndTimeUtc',c.fixture->'actualEndTimeUtc',b.fixture->'actualEndTimeUtc',b.observations->'actualEndTimeUtc'),'completedAt',coalesce(facts->'completedAt',c.fixture->'completedAt',b.fixture->'completedAt',b.observations->'completedAt'),'firstConfirmedCompleteAt',coalesce(facts->'firstConfirmedCompleteAt',c.fixture->'firstConfirmedCompleteAt',b.fixture->'firstConfirmedCompleteAt',b.observations->'firstConfirmedCompleteAt')) from (select canonical event_id) identity left join public.nothingsports_classic_fixtures c using(event_id) left join public.nothingsports_editorial_backlog b using(event_id)));
 if not exists(select 1 from public.nothingsports_classic_fixtures where event_id=canonical) and not exists(select 1 from public.nothingsports_editorial_backlog where event_id=canonical) then return new;end if;
 preserved:=jsonb_strip_nulls(jsonb_build_object('id',canonical,'name',facts->'name','status',facts->'status','date',facts->'date','endDate',facts->'endDate','startTimeUtc',facts->'startTimeUtc','endTimeUtc',facts->'endTimeUtc','actualEndTimeUtc',facts->'actualEndTimeUtc','completedAt',facts->'completedAt','firstConfirmedCompleteAt',facts->'firstConfirmedCompleteAt','sourceUrl',facts->'sourceUrl','sourceCheckedAt',facts->'sourceCheckedAt','statusCheckedAt',facts->'statusCheckedAt','statusSourceUrl',facts->'statusSourceUrl','scoreDisplay',facts->'scoreDisplay','score',facts->'score','homeScore',facts->'homeScore','awayScore',facts->'awayScore','outcomeText',facts->'outcomeText'));
 update public.nothingsports_editorial_backlog set observations=preserved,updated_at=now() where event_id=canonical and observations is distinct from preserved;
 if not exists(select 1 from public.nothingsports_classic_fixtures where event_id=canonical) then return new;end if;
 published_source:=coalesce(facts->>'statusSourceUrl',facts->'statusSource'->>'sourceUrl',facts->>'sourceUrl');
 observed:=coalesce(facts->>'statusCheckedAt',facts->>'scoreCheckedAt',facts->>'sourceCheckedAt');
 if facts->>'status' in ('live','inprogress','in_progress','in-progress','ongoing','stumps','break','rain-delay') and published_source like 'https://%' and observed is not null and observed::timestamptz<=now() and observed::timestamptz>now()-interval '30 minutes' and coalesce(facts->>'stale','false')<>'true' and coalesce(facts->>'sourceStale','false')<>'true' then
 update public.nothingsports_classic_editorial set copy=copy||'{"finalized":true}'::jsonb where event_id=canonical and phase='heat' and milestone='final' and copy->>'finalized' is distinct from 'true';
 live_body:=concat_ws(' · ',case when jsonb_typeof(facts->'scoreDisplay')='string' then facts->>'scoreDisplay' when jsonb_typeof(facts->'score')='string' then facts->>'score' end,coalesce(facts->>'matchStatusText',facts->>'statusText'));
 if live_body<>'' then
 preserved:=jsonb_build_object('hook','How it is unfolding','body',live_body,'observedAt',observed,'finalized',false,'spoiler',true);
 insert into public.nothingsports_classic_editorial(event_id,phase,milestone,content_hash,copy,source_urls,captured_at) values(canonical,'pulse','final',md5(live_body||published_source),preserved,jsonb_build_array(published_source),now()) on conflict(event_id,phase) where milestone='final' do update set content_hash=excluded.content_hash,copy=excluded.copy,source_urls=excluded.source_urls,captured_at=excluded.captured_at where nothingsports_classic_editorial.content_hash<>excluded.content_hash;
 end if;
 elsif facts->>'status' in ('completed','finished','final') then
 update public.nothingsports_classic_editorial set copy=copy||'{"finalized":true}'::jsonb where event_id=canonical and phase in ('heat','pulse') and milestone='final' and copy->>'finalized' is distinct from 'true';
 last_day:=null;
 for observed in select jsonb_array_elements_text(jsonb_build_array(facts->'actualEndTimeUtc',facts->'completedAt',facts->'firstConfirmedCompleteAt')) loop
 if observed is not null and observed~'T.*(Z|[+-]\d{2}:\d{2})$' and observed::timestamptz<=now()
 and (facts->>'startTimeUtc' is null or observed::timestamptz>=(facts->>'startTimeUtc')::timestamptz)
 and (coalesce(facts->>'date',facts->>'startDate') is null or to_char(observed::timestamptz at time zone 'Australia/Sydney','YYYY-MM-DD')>=coalesce(facts->>'date',facts->>'startDate')) then
 last_day:=to_char(observed::timestamptz at time zone 'Australia/Sydney','YYYY-MM-DD');exit;end if;
 end loop;
 last_day:=coalesce(last_day,facts->>'endDate',facts->>'date');
 if last_day is not null and (last_day !~ '^\d{4}-\d{2}-\d{2}$' or to_char(last_day::date,'YYYY-MM-DD')<>last_day) then last_day:=null;end if;
 update public.nothingsports_classic_fixtures set fixture=fixture||jsonb_strip_nulls(jsonb_build_object('status',facts->'status','completed',true,'actualEndTimeUtc',facts->'actualEndTimeUtc','completedAt',facts->'completedAt','firstConfirmedCompleteAt',facts->'firstConfirmedCompleteAt','finalDate',last_day,'year',case when last_day~'^\d{4}-\d{2}-\d{2}$' then substring(last_day,1,4)::integer end)),updated_at=now() where event_id=canonical;
 end if;
 return new;
exception when others then
 -- Optional archive observation must never roll back accepted sporting data.
 begin update public.nothingsports_editorial_backlog set last_error=jsonb_build_object('reason','Accepted source observation could not be archived.','nextAction','Reconcile the accepted current fixture through the canonical EPIC owner.'),updated_at=now() where event_id=canonical;exception when others then null;end;
 raise warning 'EPIC observation deferred: %',sqlstate;return new;
end $$;
revoke all on function private.nothingsports_capture_classic_observation() from public,anon,authenticated;
do $$ begin
 if to_regclass('public.nothingsports_fixture_current') is not null and to_regclass('public.nothingsports_live_scores') is not null then
 create trigger nothingsports_capture_classic_current after insert or update on public.nothingsports_fixture_current for each row execute function private.nothingsports_capture_classic_observation();
 create trigger nothingsports_capture_classic_score after insert or update on public.nothingsports_live_scores for each row execute function private.nothingsports_capture_classic_observation();
 end if;
end $$;

-- Retain the existing preview RPC shape, replacing the sole-admin assumption
-- with the two explicit NS curator picks. It remains a private real-vote aggregate.
create or replace function private.nothingsports_editorial_signals(target_groups jsonb)
returns table(event_id text,mean numeric,count bigint,five_count bigint,owner_five boolean)
language sql security definer set search_path='' as $$
 with aliases as(select g.event_id,jsonb_array_elements_text(g.aliases) alias from jsonb_to_recordset(target_groups) g(event_id text,aliases jsonb) where jsonb_array_length(target_groups)<=100),
 latest as(select distinct on(a.event_id,c.user_id) a.event_id,c.user_id,c.rating from public.nothingsports_nsc_contributions c join aliases a on a.alias=c.event_id join auth.users u on u.id=c.user_id and not coalesce(u.is_anonymous,false)
 left join public.nothingsports_nsc_personas p on p.user_id=c.user_id left join public.nothingsports_nsc_pilot_members m on m.user_id=c.user_id
 where c.phase='heat' and c.updated_at<=now() and not coalesce(p.moderation_flag,false) and not coalesce(m.suspended,false) order by a.event_id,c.user_id,c.updated_at desc)
 select v.event_id,sum(v.rating*case when n.user_id is null then 1 else 8 end)::numeric/sum(case when n.user_id is null then 1 else 8 end),count(*),count(*) filter(where v.rating=5),bool_or(v.rating=5 and n.user_id is not null) from latest v left join public.nothingsports_fixture_curators n on n.user_id=v.user_id group by v.event_id;
$$;
revoke all on function private.nothingsports_editorial_signals(jsonb) from public,anon,authenticated;
grant execute on function private.nothingsports_editorial_signals(jsonb) to service_role;

create function public.nothingsports_referenced_classics(after_event text default '',page_limit integer default 100)
returns table(event_id text,fixture jsonb) language sql security invoker set search_path='' as $$
 select f.event_id,f.fixture from public.nothingsports_classic_fixtures f where f.event_id>after_event
 and exists(select 1 from public.nothingsports_personal_classics p where p.event_id=f.event_id and p.removed_at is null)
 order by f.event_id limit least(greatest(page_limit,1),500);
$$;
revoke all on function public.nothingsports_referenced_classics(text,integer) from public,anon,authenticated;
grant execute on function public.nothingsports_referenced_classics(text,integer) to service_role;
create function public.nothingsports_hydrate_classic_highlights(p_event_id text,p_record jsonb) returns boolean language plpgsql security invoker set search_path='' as $$ begin
 if p_record is not null and (jsonb_typeof(p_record)<>'object' or octet_length(p_record::text)>10000) then raise exception 'invalid_classic_highlights';end if;
 update public.nothingsports_classic_fixtures set fixture=jsonb_set(fixture,'{highlights}',coalesce(p_record,'null'),true),updated_at=now() where event_id=p_event_id and fixture->'highlights' is distinct from coalesce(p_record,'null');return found;
end $$;
revoke all on function public.nothingsports_hydrate_classic_highlights(text,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_hydrate_classic_highlights(text,jsonb) to service_role;
create function public.nothingsports_classic_years(target_user uuid) returns integer[] language sql security invoker set search_path='' as $$
 select coalesce(array_agg(distinct (f.fixture->>'year')::integer order by (f.fixture->>'year')::integer desc),'{}')
 from public.nothingsports_personal_classics p join public.nothingsports_classic_fixtures f using(event_id)
 where p.user_id=target_user and p.removed_at is null and f.fixture->>'completed'='true' and f.fixture->>'year'~'^\d{4}$';
$$;
revoke all on function public.nothingsports_classic_years(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_classic_years(uuid) to service_role;

-- The existing dispatcher is the sole owner. Its optional annual producer is
-- inactive outside 27–31 December and never overwrites inbox maintenance.
create function private.nothingsports_year_review_at(moment timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare local_clock timestamp:=moment at time zone 'Australia/Sydney'; review_year integer; recipient record; n integer:=0;
begin
 review_year:=extract(year from local_clock);
 if review_year<2026 or local_clock<make_timestamp(review_year,12,27,9,0,0) or local_clock>=make_timestamp(review_year+1,1,1,0,0,0) then return jsonb_build_object('prepared',0);end if;
 for recipient in select distinct p.user_id from public.nothingsports_personal_classics p join public.nothingsports_classic_fixtures f using(event_id)
 join auth.users u on u.id=p.user_id and not coalesce(u.is_anonymous,false)
 left join public.nothingsports_classic_settings cfg on cfg.user_id=p.user_id
 left join public.nothingsports_user_state state on state.user_id=p.user_id
 where p.removed_at is null and f.fixture->>'completed'='true' and f.fixture->>'year'=review_year::text
 and coalesce(cfg.year_review_enabled,true) and coalesce((state.preferences#>>'{followFirst,notifications,enabled}')::boolean,true)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=p.user_id)
 and (not exists(select 1 from public.nothingsports_classic_reviews r where r.user_id=p.user_id and r.year=review_year and r.invited_at is not null) or exists(select 1 from public.nothingsports_push_installations i where i.user_id=p.user_id and i.permission='granted' and not exists(select 1 from public.nothingsports_year_review_deliveries d where d.user_id=p.user_id and d.year=review_year and d.installation_id=i.installation_id)))
 order by p.user_id limit 20
 loop
 insert into public.nothingsports_classic_reviews(user_id,year,invited_at) values(recipient.user_id,review_year,moment) on conflict(user_id,year) do update set invited_at=coalesce(nothingsports_classic_reviews.invited_at,excluded.invited_at);
 insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,title,detail) values(recipient.user_id,'system','system:year-review:'||review_year,'Review your classic fixtures · '||review_year,'Your year of NS is ready to curate and share.') on conflict(recipient_user_id,source_key) do nothing;
 insert into public.nothingsports_year_review_deliveries(user_id,year,installation_id)
 select recipient.user_id,review_year,i.installation_id from public.nothingsports_push_installations i where i.user_id=recipient.user_id and i.permission='granted' on conflict do nothing;
 n:=n+1;
 end loop;
 return jsonb_build_object('prepared',n,'year',review_year);
end $$;
revoke all on function private.nothingsports_year_review_at(timestamptz) from public,anon,authenticated,service_role;
create function private.nothingsports_prepare_year_reviews() returns jsonb language sql security definer set search_path='' as $$select private.nothingsports_year_review_at(now());$$;
revoke all on function private.nothingsports_prepare_year_reviews() from public,anon,authenticated;
grant execute on function private.nothingsports_prepare_year_reviews() to service_role;
create function public.nothingsports_prepare_year_reviews() returns jsonb language sql security invoker set search_path='' as $$select private.nothingsports_prepare_year_reviews();$$;
revoke all on function public.nothingsports_prepare_year_reviews() from public,anon,authenticated;
grant execute on function public.nothingsports_prepare_year_reviews() to service_role;

-- Personal and role writes share the established account-erasure barrier.
-- Retained shared fixture/editorial rows contain no account references.
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_fixture_curators for each row execute function private.nothingsports_guard_erasure_write('user_id','assigned_by');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_curator_audit for each row execute function private.nothingsports_guard_erasure_write('actor_id','target_id');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_personal_classics for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_classic_reviews for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_classic_settings for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard after insert or update on public.nothingsports_year_review_deliveries for each row execute function private.nothingsports_guard_erasure_write('user_id');
