-- nothingSports MVP server-truth store.
-- Run this once in the existing Supabase project's SQL editor.

create table if not exists public.nothingsports_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  schema_version text not null default 'user-state.v1'
    check (schema_version = 'user-state.v1'),
  profile jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile) = 'object'),
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  event_user_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_user_state) = 'object'),
  event_spoiler_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_spoiler_state) = 'object'),
  archived_events jsonb not null default '[]'::jsonb
    check (jsonb_typeof(archived_events) = 'array'),
  ratings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(ratings) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.nothingsports_user_state enable row level security;
alter table public.nothingsports_user_state force row level security;

revoke all on table public.nothingsports_user_state from anon;
revoke all on table public.nothingsports_user_state from authenticated;
grant select, insert, update on table public.nothingsports_user_state to authenticated;

drop policy if exists "nothingSports users can read their own state"
  on public.nothingsports_user_state;
create policy "nothingSports users can read their own state"
  on public.nothingsports_user_state
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "nothingSports users can create their own state"
  on public.nothingsports_user_state;
create policy "nothingSports users can create their own state"
  on public.nothingsports_user_state
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "nothingSports users can update their own state"
  on public.nothingsports_user_state;
create policy "nothingSports users can update their own state"
  on public.nothingsports_user_state
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.nothingsports_user_state is
  'Server truth for nothingSports preferences, saved cards, Catch Up watched state, spoiler choices and ratings.';
