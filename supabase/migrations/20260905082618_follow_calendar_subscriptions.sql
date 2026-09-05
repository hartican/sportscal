create table public.nothingsports_calendar_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  included_ids text[] not null default '{}',
  excluded_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint calendar_token_format check (token ~ '^[a-f0-9]{64}$'),
  constraint calendar_selection_size check (cardinality(included_ids) <= 10000 and cardinality(excluded_ids) <= 10000)
);
alter table public.nothingsports_calendar_subscriptions enable row level security;
revoke all on public.nothingsports_calendar_subscriptions from anon;
grant select, insert, update, delete on public.nothingsports_calendar_subscriptions to authenticated;
grant all on public.nothingsports_calendar_subscriptions to service_role;
create policy calendar_owner on public.nothingsports_calendar_subscriptions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
