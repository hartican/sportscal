-- One-time registered-account cohort. Never reapplied on login or preference reset.
create schema if not exists private;
create table if not exists private.nothingsports_tennis_journey_runs (
 experiment text primary key, captured_at timestamptz not null default clock_timestamp()
);
create table if not exists private.nothingsports_tennis_journey_cohort (
 user_id uuid primary key references auth.users(id) on delete cascade,
 prior_preferences jsonb, added_ids jsonb not null default '[]', applied_at timestamptz not null default clock_timestamp()
);
alter table private.nothingsports_tennis_journey_runs enable row level security;
alter table private.nothingsports_tennis_journey_runs force row level security;
alter table private.nothingsports_tennis_journey_cohort enable row level security;
alter table private.nothingsports_tennis_journey_cohort force row level security;
revoke all on private.nothingsports_tennis_journey_runs,private.nothingsports_tennis_journey_cohort from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.nothingsports_tennis_journey_runs,private.nothingsports_tennis_journey_cohort to service_role;
do $$
declare account record; previous jsonb; graph jsonb; follows jsonb; additions jsonb; player text; slug text; began text;
begin
 insert into private.nothingsports_tennis_journey_runs(experiment) values('five-players-20261002') on conflict do nothing returning experiment into began;
 if began is null then return; end if;
 for account in select id from auth.users where not coalesce(is_anonymous,false)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=auth.users.id) order by id loop
  -- Existing timestamps make concurrent API patches conflict rather than overwrite.
  select preferences into previous from public.nothingsports_user_state where user_id=account.id for update;
  insert into private.nothingsports_tennis_journey_cohort(user_id,prior_preferences) values(account.id,previous);
  graph:=coalesce(previous->'preferenceGraph','{}'); follows:=coalesce(graph->'entityFollows','[]'); additions:='[]';
  foreach player in array array['competitor:tennis:atp:carlos-alcaraz','competitor:tennis:atp:jannik-sinner','athlete:tennis:novak-djokovic','athlete:tennis:alex-de-minaur','competitor:tennis:wta:aryna-sabalenka'] loop
   slug:=regexp_replace(player,'^(athlete:tennis:|competitor:tennis:(atp|wta):)','');
   -- A follow, priority, unfollow or mute under either canonical alias wins.
   if not exists(select 1 from jsonb_array_elements(follows) f where regexp_replace(f->>'participantId','^(athlete:tennis:|competitor:tennis:(atp|wta):)','')=slug) then
    follows:=follows||jsonb_build_array(jsonb_build_object('participantId',player,'followLevel','follow','profileId',coalesce(graph->>'profileId','profile:local')));
    additions:=additions||jsonb_build_array(player);
   end if;
  end loop;
  graph:=graph||jsonb_build_object('schemaVersion',coalesce(graph->>'schemaVersion','preference-graph.v8'),'profileId',coalesce(graph->>'profileId','profile:local'),'entityFollows',follows);
  insert into public.nothingsports_user_state(user_id,preferences,updated_at)
   values(account.id,coalesce(previous,'{}')||jsonb_build_object('preferenceGraph',graph),clock_timestamp())
   on conflict(user_id) do update set preferences=excluded.preferences,updated_at=greatest(clock_timestamp(),public.nothingsports_user_state.updated_at+interval '1 millisecond');
  update private.nothingsports_tennis_journey_cohort set added_ids=additions where user_id=account.id;
 end loop;
end $$;
