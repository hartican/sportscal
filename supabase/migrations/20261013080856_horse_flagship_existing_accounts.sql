-- Apply only after the checked application release. Atomic frozen registered
-- cohort; retries never recapture accounts or restore later unfollows.
create schema if not exists private;
create table if not exists private.nothingsports_horse_flagship_runs(
 experiment text primary key,captured_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create table if not exists private.nothingsports_horse_flagship_cohort(
 user_id uuid primary key references auth.users(id) on delete cascade,
 prior_preferences jsonb,prior_updated_at timestamptz,created_state boolean not null,
 added boolean not null default false,applied_updated_at timestamptz
);
alter table private.nothingsports_horse_flagship_runs enable row level security;
alter table private.nothingsports_horse_flagship_runs force row level security;
alter table private.nothingsports_horse_flagship_cohort enable row level security;
alter table private.nothingsports_horse_flagship_cohort force row level security;
revoke all on private.nothingsports_horse_flagship_runs,private.nothingsports_horse_flagship_cohort from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.nothingsports_horse_flagship_runs,private.nothingsports_horse_flagship_cohort to service_role;
do $$
declare account record; previous jsonb; revision timestamptz; existed boolean; refused boolean; selected jsonb; sports jsonb; next_preferences jsonb; applied timestamptz; began text;
begin
 insert into private.nothingsports_horse_flagship_runs(experiment) values('flagship-races-20261013') on conflict do nothing returning experiment into began;
 if began is null then return;end if;

 for account in select id from auth.users where not coalesce(is_anonymous,false)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=auth.users.id)
 order by id loop
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('account-erasure:'||account.id::text,0));
  if exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=account.id) or not exists(select 1 from auth.users where id=account.id) then continue;end if;
  -- Create only an absent row, then lock and reread the accepted current state.
  -- A concurrent first sync wins ON CONFLICT rather than being overwritten.
  insert into public.nothingsports_user_state(user_id) values(account.id) on conflict do nothing returning true into existed;
  existed:=not coalesce(existed,false);
  select preferences,updated_at into previous,revision from public.nothingsports_user_state where user_id=account.id for update;
  insert into private.nothingsports_horse_flagship_cohort(user_id,prior_preferences,prior_updated_at,created_state) values(account.id,case when existed then previous else null end,case when existed then revision else null end,not existed);
  refused:=exists(select 1 from jsonb_array_elements(coalesce(previous#>'{preferenceGraph,domainPreferences}','[]')) p where p->>'sportDomainId' in ('sport:horse-racing','horse-racing') and p->>'enabled'='false');
  selected:=coalesce(previous->'selectedSelectorEntityIds','[]');sports:=coalesce(previous->'followedSports','[]');
  if not refused then
   if not selected ? 'sport:horse-racing' then selected:=selected||'"sport:horse-racing"'::jsonb;end if;
   if not sports ? 'horse-racing' then sports:=sports||'"horse-racing"'::jsonb;end if;
  end if;
  next_preferences:=coalesce(previous,'{}')||jsonb_build_object('selectedSelectorEntityIds',selected,'followedSports',sports,'followFirst',coalesce(previous->'followFirst','{}')||jsonb_build_object('horseRacingRollout',jsonb_build_object('version',1,'enabled',not refused,'source','rollout')));
  insert into public.nothingsports_user_state(user_id,preferences,updated_at) values(account.id,next_preferences,clock_timestamp())
  on conflict(user_id) do update set preferences=excluded.preferences,updated_at=greatest(clock_timestamp(),public.nothingsports_user_state.updated_at+interval '1 millisecond')
  returning updated_at into applied;
  update private.nothingsports_horse_flagship_cohort set added=not refused and not coalesce(previous->'selectedSelectorEntityIds','[]') ? 'sport:horse-racing',applied_updated_at=applied where user_id=account.id;
 end loop;
 update private.nothingsports_horse_flagship_runs set completed_at=clock_timestamp() where experiment=began;
end $$;
