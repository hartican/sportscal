-- Private live-fixture group chat, phase 1.
-- All browser access is denied. The authenticated Vercel API verifies callers,
-- then uses the existing service-role credential for narrowly scoped commands.

create table if not exists public.nothingsports_chat_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_normalized text not null check (
    email_normalized = lower(btrim(email_normalized))
    and char_length(email_normalized) between 3 and 254
  ),
  display_name text check (display_name is null or char_length(display_name) between 2 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nothingsports_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  canonical_fixture_id text not null check (char_length(canonical_fixture_id) between 1 and 180),
  fixture_snapshot jsonb not null check (jsonb_typeof(fixture_snapshot) = 'object'),
  room_name text not null check (char_length(room_name) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  purge_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and closed_at is null and purge_at is null)
    or
    (status = 'closed' and closed_at is not null and purge_at is not null)
  )
);

create table if not exists public.nothingsports_chat_members (
  room_id uuid not null references public.nothingsports_chat_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid not null references auth.users (id) on delete restrict,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.nothingsports_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nothingsports_chat_rooms (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete restrict,
  client_id text not null check (char_length(client_id) between 8 and 128),
  message_type text not null default 'text' check (message_type = 'text'),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (room_id, sender_id, client_id)
);

create index if not exists nothingsports_chat_rooms_fixture_open_idx
  on public.nothingsports_chat_rooms (canonical_fixture_id, created_at)
  where status = 'open';
create index if not exists nothingsports_chat_rooms_purge_idx
  on public.nothingsports_chat_rooms (purge_at)
  where status = 'closed';
create index if not exists nothingsports_chat_members_user_idx
  on public.nothingsports_chat_members (user_id, room_id);
create index if not exists nothingsports_chat_members_added_by_idx
  on public.nothingsports_chat_members (added_by);
create index if not exists nothingsports_chat_messages_room_created_idx
  on public.nothingsports_chat_messages (room_id, created_at, id);
create index if not exists nothingsports_chat_messages_rate_idx
  on public.nothingsports_chat_messages (room_id, sender_id, created_at desc);
create index if not exists nothingsports_chat_messages_sender_idx
  on public.nothingsports_chat_messages (sender_id);
create index if not exists nothingsports_chat_rooms_created_by_idx
  on public.nothingsports_chat_rooms (created_by);
create index if not exists nothingsports_chat_rooms_closed_by_idx
  on public.nothingsports_chat_rooms (closed_by)
  where closed_by is not null;

create or replace function public.protect_nothingsports_chat_room_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    if new.status <> old.status
       or new.closed_at is distinct from old.closed_at
       or new.purge_at is distinct from old.purge_at then
      raise exception 'Closed chat rooms cannot be reopened or have retention changed';
    end if;
    return new;
  end if;
  if new.status = 'closed' then
    new.closed_at := coalesce(new.closed_at, now());
    new.purge_at := new.closed_at + interval '7 days';
  else
    new.closed_at := null;
    new.closed_by := null;
    new.purge_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_nothingsports_chat_room_lifecycle on public.nothingsports_chat_rooms;
create trigger protect_nothingsports_chat_room_lifecycle
before update of status, closed_at, purge_at on public.nothingsports_chat_rooms
for each row execute function public.protect_nothingsports_chat_room_lifecycle();

create or replace function public.enforce_nothingsports_chat_room_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nothingsports-chat-room-limit:' || new.canonical_fixture_id, 0)
  );
  if (
    select count(*)
    from public.nothingsports_chat_rooms
    where canonical_fixture_id = new.canonical_fixture_id and status = 'open'
  ) >= 10 then
    raise exception 'A fixture may have at most 10 open chat rooms';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nothingsports_chat_room_limit on public.nothingsports_chat_rooms;
create trigger enforce_nothingsports_chat_room_limit
before insert on public.nothingsports_chat_rooms
for each row execute function public.enforce_nothingsports_chat_room_limit();

create or replace function public.enforce_nothingsports_chat_member_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nothingsports-chat-member-limit:' || new.room_id::text, 0)
  );
  if (
    select count(*) from public.nothingsports_chat_members where room_id = new.room_id
  ) >= 25 then
    raise exception 'A chat room may have at most 25 members';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nothingsports_chat_member_limit on public.nothingsports_chat_members;
create trigger enforce_nothingsports_chat_member_limit
before insert on public.nothingsports_chat_members
for each row execute function public.enforce_nothingsports_chat_member_limit();

create or replace function public.enforce_nothingsports_chat_message_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  room_status text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'nothingsports-chat-message-rate:' || new.room_id::text || ':' || new.sender_id::text,
      0
    )
  );
  select status into room_status
  from public.nothingsports_chat_rooms
  where id = new.room_id
  for update;
  if room_status is distinct from 'open' then
    raise exception 'Messages can only be added to an open chat room';
  end if;
  perform 1
  from public.nothingsports_chat_members
  where room_id = new.room_id and user_id = new.sender_id
  for key share;
  if not found then
    raise exception 'Only room members may send messages';
  end if;
  if exists (
    select 1
    from public.nothingsports_chat_messages
    where room_id = new.room_id
      and sender_id = new.sender_id
      and client_id = new.client_id
  ) then
    return new;
  end if;
  if (
    select count(*)
    from public.nothingsports_chat_messages
    where room_id = new.room_id
      and sender_id = new.sender_id
      and created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Chat message rate limit exceeded';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nothingsports_chat_message_rules on public.nothingsports_chat_messages;
create trigger enforce_nothingsports_chat_message_rules
before insert on public.nothingsports_chat_messages
for each row execute function public.enforce_nothingsports_chat_message_rules();

create or replace function public.nothingsports_chat_create_room(
  target_fixture_id text,
  target_fixture_snapshot jsonb,
  target_room_name text,
  target_creator uuid,
  target_members uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_room_id uuid;
  member_id uuid;
begin
  if cardinality(target_members) > 25 then
    raise exception 'A chat room may have at most 25 members';
  end if;
  insert into public.nothingsports_chat_rooms (
    canonical_fixture_id, fixture_snapshot, room_name, created_by
  ) values (
    target_fixture_id, target_fixture_snapshot, target_room_name, target_creator
  ) returning id into created_room_id;

  foreach member_id in array target_members loop
    insert into public.nothingsports_chat_members (room_id, user_id, added_by)
    values (created_room_id, member_id, target_creator)
    on conflict (room_id, user_id) do nothing;
  end loop;
  return created_room_id;
end;
$$;

create or replace function public.nothingsports_chat_active_rooms(
  target_user uuid,
  include_admin_rooms boolean default false
)
returns table (
  room_id uuid,
  canonical_fixture_id text,
  fixture_snapshot jsonb,
  room_name text,
  member_count bigint,
  unread_count bigint,
  last_message_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    r.canonical_fixture_id,
    r.fixture_snapshot,
    r.room_name,
    (select count(*) from public.nothingsports_chat_members all_members where all_members.room_id = r.id),
    case when own_membership.user_id is null then 0 else (
      select count(*)
      from public.nothingsports_chat_messages unread
      where unread.room_id = r.id
        and unread.sender_id <> target_user
        and unread.created_at > own_membership.last_read_at
    ) end,
    (select max(latest.created_at) from public.nothingsports_chat_messages latest where latest.room_id = r.id),
    r.created_at
  from public.nothingsports_chat_rooms r
  left join public.nothingsports_chat_members own_membership
    on own_membership.room_id = r.id and own_membership.user_id = target_user
  where r.status = 'open'
    and (include_admin_rooms or own_membership.user_id is not null)
  order by coalesce(
    (select max(latest.created_at) from public.nothingsports_chat_messages latest where latest.room_id = r.id),
    r.created_at
  ) desc;
$$;

alter table public.nothingsports_chat_profiles enable row level security;
alter table public.nothingsports_chat_profiles force row level security;
alter table public.nothingsports_chat_rooms enable row level security;
alter table public.nothingsports_chat_rooms force row level security;
alter table public.nothingsports_chat_members enable row level security;
alter table public.nothingsports_chat_members force row level security;
alter table public.nothingsports_chat_messages enable row level security;
alter table public.nothingsports_chat_messages force row level security;

revoke all on table public.nothingsports_chat_profiles from public, anon, authenticated;
revoke all on table public.nothingsports_chat_rooms from public, anon, authenticated;
revoke all on table public.nothingsports_chat_members from public, anon, authenticated;
revoke all on table public.nothingsports_chat_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.nothingsports_chat_profiles to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_rooms to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_members to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_messages to service_role;

revoke all on function public.nothingsports_chat_create_room(text, jsonb, text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_active_rooms(uuid, boolean) from public, anon, authenticated;
grant execute on function public.nothingsports_chat_create_room(text, jsonb, text, uuid, uuid[]) to service_role;
grant execute on function public.nothingsports_chat_active_rooms(uuid, boolean) to service_role;

drop policy if exists "deny direct chat profile access" on public.nothingsports_chat_profiles;
create policy "deny direct chat profile access" on public.nothingsports_chat_profiles
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct chat room access" on public.nothingsports_chat_rooms;
create policy "deny direct chat room access" on public.nothingsports_chat_rooms
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct chat member access" on public.nothingsports_chat_members;
create policy "deny direct chat member access" on public.nothingsports_chat_members
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct chat message access" on public.nothingsports_chat_messages;
create policy "deny direct chat message access" on public.nothingsports_chat_messages
  for all to anon, authenticated using (false) with check (false);

comment on table public.nothingsports_chat_profiles is 'Server-only private chat identity. Email is never returned to room members.';
comment on table public.nothingsports_chat_rooms is 'Private fixture chat rooms. Closure is irreversible and purge follows seven days later.';
comment on table public.nothingsports_chat_members is 'Sole member-access relationship for private fixture chat.';
comment on table public.nothingsports_chat_messages is 'Plain-text phase-1 chat messages with idempotent client IDs.';

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
do $$
declare existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'nothingsports-chat-purge-hourly'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;
select cron.schedule(
  'nothingsports-chat-purge-hourly',
  '0 * * * *',
  $job$delete from public.nothingsports_chat_rooms where status = 'closed' and purge_at <= now()$job$
);
