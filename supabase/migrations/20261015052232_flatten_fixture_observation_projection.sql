set local lock_timeout='2s';
set local statement_timeout='8s';
do $guard$
begin
 if md5(pg_get_functiondef('public.nothingsports_project_fixture_observations(jsonb,jsonb,jsonb,timestamptz)'::regprocedure))<>'b09eb3d35a5b865df061ae9d8d2d4d0f' then
  raise exception 'Observation projector differs from reviewed baseline; optimisation refused';
 end if;
end $guard$;
-- Merge the small score/observation patch first, then copy an object fixture once.
-- Preserve the original operation order for non-object inputs.
CREATE OR REPLACE FUNCTION public.nothingsports_project_fixture_observations(base jsonb, score jsonb, receipt jsonb, first_complete timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select case when jsonb_typeof(base)='object' and (score is null or jsonb_typeof(score)='object')
 then base||(coalesce(score,'{}'::jsonb)||jsonb_build_object(
  'fixtureObservationSchema','fixture-observations.v1',
  'scoreFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')),
  'scoreCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'s'),public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'t'),public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')))||
  case when first_complete is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',first_complete) end)
 else base||coalesce(score,'{}'::jsonb)||jsonb_build_object(
  'fixtureObservationSchema','fixture-observations.v1',
  'scoreFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusFactObservedAt',coalesce(public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')),
  'scoreCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'s'),public.nothingsports_fixture_observation_time(score->>'scoreCheckedAt'),public.nothingsports_fixture_observation_time(base->>'scoreCheckedAt')),
  'statusCheckedAt',coalesce(public.nothingsports_fixture_observation_time(receipt->>'t'),public.nothingsports_fixture_observation_time(score->>'statusCheckedAt'),public.nothingsports_fixture_observation_time(base->>'statusCheckedAt')))||
  case when first_complete is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',first_complete) end end;
$function$;
