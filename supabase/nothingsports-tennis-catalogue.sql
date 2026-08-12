-- nothingSport Phase 2 canonical tennis reference catalogue.
-- Review before applying. Public clients are read-only; ingestion uses the server-side service role.

create table if not exists public.tennis_athletes (
  athlete_id text primary key check (athlete_id ~ '^competitor:tennis:(atp|wta):[a-z0-9-]+$'),
  tour text not null check (tour in ('ATP', 'WTA')),
  display_name text not null check (char_length(display_name) >= 2),
  ranking_singles integer not null check (ranking_singles > 0),
  ranking_points integer check (ranking_points >= 0),
  ranking_doubles integer check (ranking_doubles > 0),
  ranking_snapshot_date date not null,
  nationality_code text not null check (nationality_code ~ '^[A-Z]{3}$'),
  is_australian boolean generated always as (nationality_code = 'AUS') stored,
  active boolean not null default true,
  provider_aliases jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_aliases) = 'object'),
  selection_reasons text[] not null default '{}'::text[],
  source_url text not null check (source_url ~ '^https://'),
  ingestion_mode text not null check (ingestion_mode in ('manual_reviewed_export', 'licensed_api')),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tennis_tournaments (
  tournament_id text primary key check (tournament_id ~ '^tournament:tennis:[a-z0-9-]+$'),
  season integer not null check (season >= 2026),
  tour text not null check (tour in ('ATP', 'WTA', 'BOTH', 'TEAM')),
  represented_tours text[] not null check (cardinality(represented_tours) >= 1),
  name text not null check (char_length(name) >= 3),
  level text not null check (level in ('grand_slam', 'atp_masters_1000', 'wta_1000', 'atp_500', 'wta_500', 'atp_250', 'wta_250', 'atp_finals', 'wta_finals', 'team_competition', 'challenger')),
  competition_id text not null check (competition_id ~ '^competition:[a-z0-9-]+$'),
  event_series_id text check (event_series_id is null or event_series_id ~ '^event-series:[a-z0-9-]+$'),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  city text not null,
  country_code text not null check (country_code ~ '^[A-Z]{3}$'),
  surface text not null check (surface in ('hard', 'clay', 'grass', 'mixed')),
  provider_aliases jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_aliases) = 'object'),
  source_url text not null check (source_url ~ '^https://'),
  ingestion_mode text not null check (ingestion_mode in ('manual_reviewed_export', 'licensed_api')),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists tennis_athletes_tour_rank_idx on public.tennis_athletes (tour, ranking_singles);
create index if not exists tennis_athletes_australian_idx on public.tennis_athletes (is_australian, ranking_singles) where active;
create index if not exists tennis_tournaments_active_window_idx on public.tennis_tournaments (start_date, end_date, level);

alter table public.tennis_athletes enable row level security;
alter table public.tennis_athletes force row level security;
alter table public.tennis_tournaments enable row level security;
alter table public.tennis_tournaments force row level security;

revoke all on table public.tennis_athletes from anon, authenticated;
revoke all on table public.tennis_tournaments from anon, authenticated;
grant select on table public.tennis_athletes to anon, authenticated;
grant select on table public.tennis_tournaments to anon, authenticated;

drop policy if exists "nothingSport tennis athletes are public reference data" on public.tennis_athletes;
create policy "nothingSport tennis athletes are public reference data" on public.tennis_athletes for select to anon, authenticated using (true);

drop policy if exists "nothingSport tennis tournaments are public reference data" on public.tennis_tournaments;
create policy "nothingSport tennis tournaments are public reference data" on public.tennis_tournaments for select to anon, authenticated using (true);

comment on table public.tennis_athletes is 'Read-only canonical ATP/WTA athlete universe. Writes require the trusted server-side service role and a reviewed or licensed provider snapshot.';
comment on table public.tennis_tournaments is 'Read-only normalized tennis tournament universe for deterministic inclusion and froth rules.';
