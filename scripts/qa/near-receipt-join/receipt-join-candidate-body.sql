
select case when nothingsports_fixture_read_private.near_index_ready()then(
with recursive index_state as materialized(select true as ready),near_seed_keys as materialized(
 select ctx.source_id,ctx.fixture_id from nothingsports_fixture_read_private.fixture_context ctx where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and ctx.identity_keys&&coalesce(p_membership_ids,'{}'::text[])
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('live','in-progress','in_progress','stumps','suspended','interrupted','delayed','rain-delay','break','ongoing')
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('scheduled','upcoming')and n.start_at between statement_timestamp() and statement_timestamp()+interval '31 minutes'
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('scheduled','upcoming')and n.start_kind=2
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('completed','finished','final','cancelled','canceled','abandoned')and n.completion_at>=statement_timestamp()-interval '65 minutes'
 union
 select n.source_id,n.fixture_id from nothingsports_fixture_read_private.near_selection n where cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000 and n.status in('completed','finished','final','cancelled','canceled','abandoned')and n.completion_unqualified
),seeds as materialized(
 select k.source_id,k.fixture_id from near_seed_keys k join public.nothingsports_fixture_sources src using(source_id)
 order by k.source_id,k.fixture_id limit 5001
),initial_keys as materialized(
 select source_id,fixture_id from seeds union
 select source_id,fixture_id from nothingsports_fixture_read_private.near_selection where lookup_uncertain and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000
),lookup as materialized(
 select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
 case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)]else null end as sides,n.lookup_uncertain as uncertain_clock
 from initial_keys k join nothingsports_fixture_read_private.fixture_context ctx using(source_id,fixture_id)
 join nothingsports_fixture_read_private.near_selection n using(source_id,fixture_id)
 cross join lateral(select case when(ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home'else ctx.base_selection->>'home'end home_id,
 case when(ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away'else ctx.base_selection->>'away'end away_id)f
),related_rows(source_id,fixture_id,identity_keys,sides) as (
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from lookup l
  where exists(select 1 from seeds seed where seed.source_id=l.source_id and seed.fixture_id=l.fixture_id)
   or (l.uncertain_clock and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000)
  union
  select l.source_id,l.fixture_id,l.identity_keys,l.sides from related_rows r
  cross join index_state idx
  cross join lateral (
   select ctx.source_id,ctx.fixture_id,ctx.identity_keys,
    case when ctx.sides is not null then array[least(f.home_id,f.away_id),greatest(f.home_id,f.away_id)] else null end as sides
   from nothingsports_fixture_read_private.fixture_tokens seed
   join nothingsports_fixture_read_private.fixture_tokens other on other.kind=seed.kind and other.token=seed.token
   join nothingsports_fixture_read_private.fixture_context ctx on ctx.source_id=other.source_id and ctx.fixture_id=other.fixture_id
   cross join lateral(select
    case when (ctx.score_selection->>'hasHome')::boolean then ctx.score_selection->>'home' else ctx.base_selection->>'home' end home_id,
    case when (ctx.score_selection->>'hasAway')::boolean then ctx.score_selection->>'away' else ctx.base_selection->>'away' end away_id) f
   where idx.ready and seed.source_id=r.source_id and seed.fixture_id=r.fixture_id
   union
   select raw.source_id,raw.fixture_id,raw.identity_keys,raw.sides from lookup raw where not idx.ready and (raw.identity_keys && r.identity_keys or raw.sides=r.sides)
  ) l
  where l.identity_keys && r.identity_keys or l.sides=r.sides
 ), candidates as materialized (
  -- Keep complete context selection and its sentinel, but sort/store keys only.
  select c.source_id,c.fixture_id
  from related_rows r
  join public.nothingsports_fixture_current c using(source_id,fixture_id)
  join public.nothingsports_fixture_sources src using(source_id)
  order by c.source_id,c.fixture_id limit 5001
 ), receipts as materialized (
  select src.source_id,r.key as fixture_id,r.value as receipt
  from public.nothingsports_fixture_sources src
  join (select distinct source_id from candidates) needed using(source_id)
  cross join lateral jsonb_each(case when jsonb_typeof(src.discovery_report->'_fixtureObservations')='object' then src.discovery_report->'_fixtureObservations' else '{}'::jsonb end) r
 ), projected as (
  select c.source_id,c.fixture_id,c.identity_keys,
   public.nothingsports_project_fixture_observations(
    ((fixture-array['editorialNarrative','storyline','fullSpiel','selectedSentence','spiel'])-
     case when fixture->>'kind' in('tournament','major-event','event-card') or fixture->>'cardKind' in('tournament','major-event','event-card') then array['subEvents'] else array[]::text[] end)||
     case when jsonb_typeof(fixture->'storyline')='object' then jsonb_build_object('storyline',
      (fixture->'storyline')-array['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']) else '{}'::jsonb end,
    score,r.receipt,first_completed_at) as fixture
  from candidates selected
  left join receipts r on r.source_id=selected.source_id and r.fixture_id=selected.fixture_id
  cross join lateral (
   -- Parameterised primary-key projection prevents a recursive row estimate
   -- from hashing every wide fixture. OFFSET0 preserves the lookup boundary.
   select base.source_id,base.fixture_id,base.fixture,base.identity_keys,s.score,s.first_completed_at
   from public.nothingsports_fixture_current base
   left join public.nothingsports_live_scores s using(source_id,fixture_id)
   where base.source_id=selected.source_id and base.fixture_id=selected.fixture_id
   offset 0
  ) c
 )
 select jsonb_build_object('schemaVersion','current-fixture-bundle.v1','scope','match-centre',
  'complete',count(*)<=5000 and cardinality(coalesce(p_membership_ids,'{}'::text[]))<=5000,
  'rows',coalesce(jsonb_agg(to_jsonb(projected) order by source_id,fixture_id),'[]'::jsonb)) from projected
)else nothingsports_fixture_read_private.read_near_raw(p_membership_ids)end;
