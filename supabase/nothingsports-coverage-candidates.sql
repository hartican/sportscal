-- nothingSport Phase 3 broadcaster coverage review queue.
-- Review before applying. Client roles have no access; trusted ingestion uses the server-side service role.

create table if not exists public.coverage_candidates (
  candidate_id text primary key check (candidate_id ~ '^coverage:[a-z0-9]+$'),
  report_id text not null check (report_id ~ '^coverage-report:[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  title text not null check (char_length(title) >= 1),
  match_status text not null check (match_status in ('matched', 'new', 'ambiguous')),
  coverage_reason text not null check (coverage_reason in ('existing_followed_sport', 'major_event', 'australian_participant', 'top_50_tennis', 'broadcaster_featured', 'community_signal')),
  priority text not null check (priority in ('high', 'normal', 'low')),
  suggested_action text not null check (suggested_action in ('publish', 'review', 'ignore')),
  canonical_event_id text,
  match_confidence numeric(4, 3) not null check (match_confidence between 0 and 1),
  taxonomy_status text not null check (taxonomy_status in ('resolved', 'sport_only', 'unresolved')),
  taxonomy_node_id text check (taxonomy_node_id is null or taxonomy_node_id ~ '^(sport|discipline|competition|event-series):[a-z0-9-]+$'),
  broadcasts_au jsonb not null default '[]'::jsonb check (jsonb_typeof(broadcasts_au) = 'array'),
  blockers text[] not null default '{}'::text[],
  source_evidence jsonb not null check (jsonb_typeof(source_evidence) = 'array' and jsonb_array_length(source_evidence) >= 1),
  candidate_payload jsonb not null check (jsonb_typeof(candidate_payload) = 'object'),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coverage_candidate_decisions (
  candidate_id text primary key references public.coverage_candidates(candidate_id) on delete cascade,
  decision text not null check (decision in ('publish', 'review', 'ignore')),
  reviewed_by text not null check (char_length(reviewed_by) >= 2),
  reviewed_at timestamptz not null,
  note text check (note is null or char_length(note) <= 1000),
  canonical_event jsonb check (canonical_event is null or jsonb_typeof(canonical_event) = 'object'),
  decision_payload jsonb not null check (jsonb_typeof(decision_payload) = 'object'),
  check (
    decision <> 'publish'
    or (
      decision_payload ->> 'matchStatus' = 'matched'
      and (decision_payload #>> '{match,confidence}')::numeric >= 0.92
    )
    or (
      decision_payload ->> 'matchStatus' = 'new'
      and canonical_event is not null
      and canonical_event ->> 'sourceType' = 'official'
      and canonical_event ->> 'sourceUrl' ~ '^https://'
      and canonical_event ? 'startTimeUtc'
    )
  )
);

create index if not exists coverage_candidates_report_action_idx on public.coverage_candidates (report_id, suggested_action, match_status);
create index if not exists coverage_candidates_observed_at_idx on public.coverage_candidates (observed_at desc);

alter table public.coverage_candidates enable row level security;
alter table public.coverage_candidates force row level security;
alter table public.coverage_candidate_decisions enable row level security;
alter table public.coverage_candidate_decisions force row level security;

revoke all on table public.coverage_candidates from anon, authenticated;
revoke all on table public.coverage_candidate_decisions from anon, authenticated;
grant select, insert, update, delete on table public.coverage_candidates to service_role;
grant select, insert, update, delete on table public.coverage_candidate_decisions to service_role;

comment on table public.coverage_candidates is 'Private broadcaster-discovery evidence and deterministic catalogue matches. Client roles have no access.';
comment on table public.coverage_candidate_decisions is 'Private editorial publish, review or ignore decisions. Publish is additionally guarded by application validation.';
