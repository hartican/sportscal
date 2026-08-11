-- nothingSports closed-pilot product measurement.
-- Run once in the existing Supabase project's SQL editor before enabling the pilot.

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
