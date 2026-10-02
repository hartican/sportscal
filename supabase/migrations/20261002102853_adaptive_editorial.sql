-- Private control plane: no ratings, user IDs or preferences in public artifacts.
create table public.nothingsports_editorial_maintenance(
  event_id text primary key,
  revision integer not null default 0,
  held boolean not null default false,
  requested boolean not null default false,
  last_checked_at timestamptz,
  pending_copy jsonb,
  staged_copy jsonb,
  published_copy jsonb,
  published_git_sha text,
  last_error jsonb,
  history jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(history)='array'),
  check(published_git_sha is null or published_git_sha ~ '^[a-f0-9]{40}$')
);
alter table public.nothingsports_editorial_maintenance enable row level security;
alter table public.nothingsports_editorial_maintenance force row level security;
revoke all on public.nothingsports_editorial_maintenance from public,anon,authenticated;
grant all on public.nothingsports_editorial_maintenance to service_role;
-- Auth metadata is read only inside an unexposed, fixed-search-path definer.
-- The single-owner exception is disabled if the owner role becomes ambiguous.
create function private.nothingsports_editorial_signals(target_groups jsonb)
returns table(event_id text,mean numeric,count bigint,five_count bigint,owner_five boolean)
language sql security definer set search_path='' as $$
  with owner as(select id from auth.users where raw_app_meta_data->>'role'='admin'
    and (select count(*) from auth.users where raw_app_meta_data->>'role'='admin')=1),
  aliases as(select g.event_id,jsonb_array_elements_text(g.aliases) as alias
    from jsonb_to_recordset(target_groups) as g(event_id text,aliases jsonb)
    where jsonb_array_length(target_groups)<=100),
  latest as(select distinct on(a.event_id,c.user_id) a.event_id,c.user_id,c.rating
    from public.nothingsports_nsc_contributions c
    join aliases a on a.alias=c.event_id
    left join public.nothingsports_nsc_pilot_members p on p.user_id=c.user_id
    join auth.users u on u.id=c.user_id and not coalesce(u.is_anonymous,false)
    where c.phase='heat' and c.updated_at<=now() and not coalesce(p.suspended,false)
    order by a.event_id,c.user_id,c.updated_at desc,c.contribution_id desc)
  select v.event_id,avg(v.rating)::numeric,count(*),count(*) filter(where v.rating=5),
    bool_or(v.rating=5 and v.user_id in(select id from owner))
  from latest v group by v.event_id;
$$;
revoke all on function private.nothingsports_editorial_signals(jsonb) from public,anon,authenticated;
grant execute on function private.nothingsports_editorial_signals(jsonb) to service_role;
create function public.nothingsports_editorial_signals(target_groups jsonb)
returns table(event_id text,mean numeric,count bigint,five_count bigint,owner_five boolean)
language sql security invoker set search_path='' as $$ select * from private.nothingsports_editorial_signals(target_groups); $$;
revoke all on function public.nothingsports_editorial_signals(jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_editorial_signals(jsonb) to service_role;
-- Explicit coverage request, not a user rating or a change to Feed admission.
insert into public.nothingsports_editorial_maintenance(event_id,requested) values('epl-2026-27-128980',true);
