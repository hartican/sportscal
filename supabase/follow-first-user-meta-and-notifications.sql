-- Follow-first metadata, guest-capable Web Push installations, and reminders.
-- Apply once to the existing nothingSport project.

alter table public.nothingsports_user_state
  drop constraint if exists nothingsports_user_state_schema_version_check;
alter table public.nothingsports_user_state
  alter column schema_version set default 'user-state.v2';
update public.nothingsports_user_state set schema_version = 'user-state.v2' where schema_version = 'user-state.v1';
alter table public.nothingsports_user_state
  add constraint nothingsports_user_state_schema_version_check
  check (schema_version = 'user-state.v2');

create table if not exists public.nothingsports_user_meta (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  schema_version text not null default 'user-meta.v1' check (schema_version = 'user-meta.v1'),
  revision integer not null default 1 check (revision > 0),
  seed_hash text not null check (seed_hash ~ '^ff_[0-9a-f]{8}$'),
  sports text[] not null default '{}'::text[] check (cardinality(sports) between 1 and 8),
  major_events text[] not null default '{}'::text[] check (cardinality(major_events) <= 8),
  offer_interests text[] not null default '{}'::text[] check (cardinality(offer_interests) <= 4),
  coarse_region jsonb not null default '{}'::jsonb check (jsonb_typeof(coarse_region) = 'object'),
  personalised_offers_consent boolean not null default false,
  consent_updated_at timestamptz,
  source text not null default 'user' check (source in ('signup', 'user', 'admin', 'local')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nothingsports_user_meta enable row level security;
alter table public.nothingsports_user_meta force row level security;
revoke all on table public.nothingsports_user_meta from anon, authenticated;
grant select, insert, update on table public.nothingsports_user_meta to authenticated;

drop policy if exists "nothingsport users read own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users read own metadata" on public.nothingsports_user_meta
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "nothingsport users create own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users create own metadata" on public.nothingsports_user_meta
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "nothingsport users update own metadata" on public.nothingsports_user_meta;
create policy "nothingsport users update own metadata" on public.nothingsports_user_meta
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.protect_nothingsports_offer_consent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.personalised_offers_consent
       and (select auth.uid()) is distinct from new.user_id then
      raise exception 'Personalised offers consent can only be granted by the user';
    end if;
  elsif new.personalised_offers_consent
        and not old.personalised_offers_consent
        and (select auth.uid()) is distinct from new.user_id then
    raise exception 'Personalised offers consent can only be granted by the user';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_nothingsports_offer_consent on public.nothingsports_user_meta;
create trigger protect_nothingsports_offer_consent
before insert or update of personalised_offers_consent on public.nothingsports_user_meta
for each row execute function public.protect_nothingsports_offer_consent();

create table if not exists public.nothingsports_push_installations (
  installation_id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth_key text not null,
  timezone text not null default 'Australia/Sydney',
  user_agent text not null default '',
  permission text not null default 'granted' check (permission in ('granted', 'denied', 'default')),
  chat_alerts_enabled boolean not null default true,
  badges_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.nothingsports_push_installations
  add column if not exists chat_alerts_enabled boolean not null default true,
  add column if not exists badges_enabled boolean not null default true;

create table if not exists public.nothingsports_reminders (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.nothingsports_push_installations (installation_id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  event_id text not null check (char_length(event_id) between 1 and 180),
  title text not null check (char_length(title) between 1 and 180),
  starts_at timestamptz not null,
  remind_at timestamptz not null,
  viewing_url text check (viewing_url is null or viewing_url ~ '^https://'),
  fallback_to_broadcast boolean not null default false,
  dispatched_at timestamptz,
  claimed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, event_id)
);

create index if not exists nothingsports_reminders_due_idx
  on public.nothingsports_reminders (remind_at)
  where dispatched_at is null;
create index if not exists nothingsports_reminders_claim_idx
  on public.nothingsports_reminders (claimed_at, remind_at)
  where dispatched_at is null;
create index if not exists nothingsports_push_installations_user_id_idx
  on public.nothingsports_push_installations (user_id)
  where user_id is not null;
create index if not exists nothingsports_reminders_user_id_idx
  on public.nothingsports_reminders (user_id)
  where user_id is not null;

alter table public.nothingsports_push_installations enable row level security;
alter table public.nothingsports_push_installations force row level security;
alter table public.nothingsports_reminders enable row level security;
alter table public.nothingsports_reminders force row level security;
revoke all on table public.nothingsports_push_installations from anon, authenticated;
revoke all on table public.nothingsports_reminders from anon, authenticated;
grant select, insert, update, delete on table public.nothingsports_push_installations to service_role;
grant select, insert, update, delete on table public.nothingsports_reminders to service_role;

drop policy if exists "deny direct notification installation access" on public.nothingsports_push_installations;
create policy "deny direct notification installation access" on public.nothingsports_push_installations
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct reminder access" on public.nothingsports_reminders;
create policy "deny direct reminder access" on public.nothingsports_reminders
  for all to anon, authenticated using (false) with check (false);

comment on table public.nothingsports_user_meta is 'Idempotent follow-first signup seed and coarse optional offer metadata. Gender and full age brackets are intentionally not collected.';
comment on column public.nothingsports_user_meta.personalised_offers_consent is 'User-controlled consent. The protection trigger rejects grants made outside that user session.';
comment on table public.nothingsports_push_installations is 'Server-only Web Push installations, including secret-authenticated guest installations.';
comment on table public.nothingsports_reminders is 'Server-dispatched 15-minute sporting-start reminders.';
