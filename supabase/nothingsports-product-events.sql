-- nothingSports closed-pilot product measurement.
-- Rerun in the existing Supabase project's SQL editor whenever the fixed
-- product-event allowlist changes.

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_event_id text not null
    check (char_length(client_event_id) between 8 and 128),
  event_name text not null
    check (event_name in (
      'opportunity_exposed',
      'fixture_check',
      'watch_decision',
      'feed_action',
      'preference_change',
      'feed_control_change',
      'swipe',
      'rating',
      'tune_prompt',
      'tune_session',
      'weekly_pulse'
    )),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  session_id text not null
    check (char_length(session_id) between 8 and 128),
  surface text not null
    check (surface in (
      'curated_feed',
      'round_summary',
      'sport_hub',
      'fixture_list',
      'event_card',
      'settings',
      'weekly_pulse',
      'onboarding',
      'calibration',
      'tune',
      'archive'
    )),
  sport text,
  competition_id text,
  canonical_event_id text,
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object')
    check (octet_length(properties::text) <= 512),
  constraint product_events_user_client_event_unique
    unique (user_id, client_event_id),
  constraint product_events_sport_shape
    check (sport is null or (char_length(sport) between 1 and 32 and sport ~ '^[a-z0-9][a-z0-9-]*$')),
  constraint product_events_competition_id_length
    check (competition_id is null or char_length(competition_id) between 1 and 160),
  constraint product_events_canonical_event_id_length
    check (canonical_event_id is null or char_length(canonical_event_id) between 1 and 160)
);

-- CREATE TABLE IF NOT EXISTS leaves older generated CHECK constraints unchanged.
-- Replace only the two fixed-contract constraints so this script is safe to
-- rerun when new allowlisted event names or surfaces are introduced.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any(con.conkey)
    where con.conrelid = 'public.product_events'::regclass
      and con.contype = 'c'
      and att.attname = 'event_name'
  loop
    execute format('alter table public.product_events drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = any(con.conkey)
    where con.conrelid = 'public.product_events'::regclass
      and con.contype = 'c'
      and att.attname = 'surface'
  loop
    execute format('alter table public.product_events drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.product_events
  add constraint product_events_event_name_check
  check (event_name in (
    'opportunity_exposed',
    'fixture_check',
    'watch_decision',
    'feed_action',
    'preference_change',
    'feed_control_change',
    'swipe',
    'rating',
    'tune_prompt',
    'tune_session',
    'weekly_pulse'
  ));

alter table public.product_events
  add constraint product_events_surface_check
  check (surface in (
    'curated_feed',
    'round_summary',
    'sport_hub',
    'fixture_list',
    'event_card',
    'settings',
    'weekly_pulse',
    'onboarding',
    'calibration',
    'tune',
    'archive'
  ));

-- Keep direct Data API inserts inside the same categorical contract enforced by
-- api/product-events.js. Legacy event properties remain optional for backward
-- compatibility; new action properties are required. Unknown keys and arbitrary
-- property strings are rejected in Postgres too.
alter table public.product_events
  drop constraint if exists product_events_properties_contract_check;

alter table public.product_events
  add constraint product_events_properties_contract_check
  check (
    case event_name
      when 'opportunity_exposed' then
        properties - array['pilotVersion', 'presentation', 'position', 'feedBucket', 'recommendationClass', 'coldStart'] = '{}'::jsonb
        and (not properties ? 'pilotVersion' or properties ->> 'pilotVersion' in ('trust-pilot.v1'))
        and (not properties ? 'presentation' or properties ->> 'presentation' in ('card', 'round_summary'))
        and (not properties ? 'position' or jsonb_typeof(properties -> 'position') = 'number')
        and (not properties ? 'feedBucket' or properties ->> 'feedBucket' in ('new', 'pinned', 'seen', 'upcoming', 'past'))
        and (not properties ? 'recommendationClass' or properties ->> 'recommendationClass' in ('direct', 'adjacent', 'discovery'))
        and (not properties ? 'coldStart' or jsonb_typeof(properties -> 'coldStart') = 'boolean')
      when 'fixture_check' then
        properties - array['entry', 'roundNumber'] = '{}'::jsonb
        and (not properties ? 'entry' or properties ->> 'entry' in ('round_summary', 'sport_filter', 'hub_tab', 'round_picker', 'fixture_row'))
        and (not properties ? 'roundNumber' or jsonb_typeof(properties -> 'roundNumber') = 'number')
      when 'watch_decision' then
        properties - array['decision'] = '{}'::jsonb
        and (not properties ? 'decision' or properties ->> 'decision' in ('watch', 'skip', 'remind', 'calendar'))
      when 'feed_action' then
        properties - array['action', 'recommendationClass', 'coldStart'] = '{}'::jsonb
        and properties ->> 'action' in ('open', 'save', 'reminder', 'reminder_removed', 'watched', 'archive', 'reinstate')
        and properties ->> 'recommendationClass' in ('direct', 'adjacent', 'discovery')
        and jsonb_typeof(properties -> 'coldStart') = 'boolean'
      when 'preference_change' then
        properties - array['action', 'targetType', 'coldStart'] = '{}'::jsonb
        and properties ->> 'action' in ('follow', 'unfollow')
        and properties ->> 'targetType' in ('sport', 'competition', 'team', 'player', 'event_family')
        and jsonb_typeof(properties -> 'coldStart') = 'boolean'
      when 'feed_control_change' then
        properties - array['control', 'value', 'coldStart'] = '{}'::jsonb
        and properties ->> 'control' in ('froth', 'scope', 'availability', 'timing', 'stakes', 'spoilers')
        and properties ->> 'value' in (
          'low', 'balanced', 'high', 'maximum',
          'following', 'for_you', 'explore',
          'any', 'free', 'included', 'ppv',
          'live_now', 'tonight', 'this_week', 'overnight',
          'everything', 'important', 'must_watch',
          'strict', 'standard', 'results_visible'
        )
        and case properties ->> 'control'
          when 'froth' then properties ->> 'value' in ('low', 'balanced', 'high', 'maximum')
          when 'scope' then properties ->> 'value' in ('following', 'for_you', 'explore')
          when 'availability' then properties ->> 'value' in ('any', 'free', 'included', 'ppv')
          when 'timing' then properties ->> 'value' in ('any', 'live_now', 'tonight', 'this_week', 'overnight')
          when 'stakes' then properties ->> 'value' in ('everything', 'important', 'must_watch')
          when 'spoilers' then properties ->> 'value' in ('strict', 'standard', 'results_visible')
          else false
        end
        and jsonb_typeof(properties -> 'coldStart') = 'boolean'
      when 'swipe' then
        properties - array['direction', 'targetType', 'recommendationClass', 'coldStart'] = '{}'::jsonb
        and (not properties ? 'direction' or properties ->> 'direction' in ('positive', 'negative', 'skip'))
        and (not properties ? 'targetType' or properties ->> 'targetType' in ('sport', 'competition', 'team', 'player', 'event', 'event_family'))
        and (not properties ? 'recommendationClass' or properties ->> 'recommendationClass' in ('direct', 'adjacent', 'discovery'))
        and (not properties ? 'coldStart' or jsonb_typeof(properties -> 'coldStart') = 'boolean')
      when 'rating' then
        properties - array['action', 'score'] = '{}'::jsonb
        and (not properties ? 'action' or properties ->> 'action' in ('shown', 'dismissed', 'rated'))
        and (not properties ? 'score' or jsonb_typeof(properties -> 'score') = 'number')
      when 'tune_prompt' then
        properties - array['action', 'dislikeCount'] = '{}'::jsonb
        and (not properties ? 'action' or properties ->> 'action' in ('shown', 'accepted', 'dismissed'))
        and (not properties ? 'dislikeCount' or jsonb_typeof(properties -> 'dislikeCount') = 'number')
      when 'tune_session' then
        properties - array['action', 'interactionCount'] = '{}'::jsonb
        and (not properties ? 'action' or properties ->> 'action' in ('started', 'completed', 'exited'))
        and (not properties ? 'interactionCount' or jsonb_typeof(properties -> 'interactionCount') = 'number')
      when 'weekly_pulse' then
        properties - array['surveyVersion', 'pilotCohort', 'crossCheck', 'missedFixtures', 'feedClutter', 'trustConfidence'] = '{}'::jsonb
        and (not properties ? 'surveyVersion' or properties ->> 'surveyVersion' in ('weekly-pulse.v1'))
        and (not properties ? 'pilotCohort' or properties ->> 'pilotCohort' in ('curator', 'hybrid', 'completist'))
        and (not properties ? 'crossCheck' or properties ->> 'crossCheck' in ('never', 'once', 'multiple'))
        and (not properties ? 'missedFixtures' or properties ->> 'missedFixtures' in ('none', 'one', 'multiple'))
        and (not properties ? 'feedClutter' or properties ->> 'feedClutter' in ('too_sparse', 'about_right', 'too_busy'))
        and (not properties ? 'trustConfidence' or properties ->> 'trustConfidence' in ('low', 'medium', 'high'))
      else false
    end
  );

create index if not exists product_events_user_occurred_at_idx
  on public.product_events (user_id, occurred_at desc);

create index if not exists product_events_tsdr_idx
  on public.product_events (occurred_at, user_id)
  where event_name in ('opportunity_exposed', 'fixture_check', 'watch_decision');

alter table public.product_events enable row level security;
alter table public.product_events force row level security;

revoke all on table public.product_events from anon;
revoke all on table public.product_events from authenticated;
revoke all on sequence public.product_events_id_seq from anon;
revoke all on sequence public.product_events_id_seq from authenticated;

grant insert on table public.product_events to authenticated;
grant usage on sequence public.product_events_id_seq to authenticated;

drop policy if exists "nothingSports pilot users can append their own product events"
  on public.product_events;
create policy "nothingSports pilot users can append their own product events"
  on public.product_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

comment on table public.product_events is
  'Append-only, fixed-contract measurement for the signed-in nothingSports trust pilot. No free text or social content.';
