-- Private live-fixture group chat, phase 1.
-- All browser access is denied. The authenticated Vercel API verifies callers,
-- then uses the existing service-role credential for narrowly scoped commands.

create extension if not exists pgcrypto;

alter table if exists public.nothingsports_push_installations
  add column if not exists chat_alerts_enabled boolean not null default true,
  add column if not exists badges_enabled boolean not null default true;

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
  guest_share_enabled boolean not null default false,
  guest_share_version integer not null default 0 check (guest_share_version >= 0),
  guest_share_nonce text check (
    guest_share_nonce is null or guest_share_nonce ~ '^[A-Za-z0-9_-]{32}$'
  ),
  guest_share_enabled_at timestamptz,
  guest_share_disabled_at timestamptz,
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
  member_kind text not null default 'account' check (member_kind in ('account', 'guest')),
  guest_display_name text check (guest_display_name is null or char_length(guest_display_name) between 2 and 30),
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
  reply_to_message_id uuid references public.nothingsports_chat_messages (id) on delete set null,
  sender_display_name text check (sender_display_name is null or char_length(sender_display_name) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (room_id, sender_id, client_id)
);

-- Rerunning this canonical migration upgrades the production v1 tables in place.
alter table public.nothingsports_chat_rooms
  add column if not exists guest_share_enabled boolean not null default false,
  add column if not exists guest_share_version integer not null default 0,
  add column if not exists guest_share_nonce text,
  add column if not exists guest_share_enabled_at timestamptz,
  add column if not exists guest_share_disabled_at timestamptz;
alter table public.nothingsports_chat_members
  add column if not exists member_kind text not null default 'account',
  add column if not exists guest_display_name text;
alter table public.nothingsports_chat_messages
  add column if not exists reply_to_message_id uuid references public.nothingsports_chat_messages (id) on delete set null,
  add column if not exists sender_display_name text;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_rooms_guest_share_version_check') then
    alter table public.nothingsports_chat_rooms add constraint nothingsports_chat_rooms_guest_share_version_check
      check (guest_share_version >= 0);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_rooms_guest_share_nonce_check') then
    alter table public.nothingsports_chat_rooms add constraint nothingsports_chat_rooms_guest_share_nonce_check
      check (guest_share_nonce is null or guest_share_nonce ~ '^[A-Za-z0-9_-]{32}$');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_rooms_guest_share_state_check') then
    alter table public.nothingsports_chat_rooms add constraint nothingsports_chat_rooms_guest_share_state_check
      check (not guest_share_enabled or (guest_share_nonce is not null and guest_share_enabled_at is not null));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_members_kind_check') then
    alter table public.nothingsports_chat_members add constraint nothingsports_chat_members_kind_check
      check (member_kind in ('account', 'guest'));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_members_guest_name_check') then
    alter table public.nothingsports_chat_members add constraint nothingsports_chat_members_guest_name_check
      check (
        (member_kind = 'account' and guest_display_name is null)
        or
        (member_kind = 'guest' and char_length(guest_display_name) between 2 and 30)
      );
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'nothingsports_chat_messages_sender_name_check') then
    alter table public.nothingsports_chat_messages add constraint nothingsports_chat_messages_sender_name_check
      check (sender_display_name is null or char_length(sender_display_name) between 2 and 80);
  end if;
end;
$$;

create table if not exists public.nothingsports_chat_reactions (
  reaction_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nothingsports_chat_rooms (id) on delete cascade,
  message_id uuid not null references public.nothingsports_chat_messages (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '😢', '👏')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, actor_id, emoji)
);

create table if not exists public.nothingsports_chat_notification_deliveries (
  delivery_id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.nothingsports_chat_messages (id) on delete cascade,
  installation_id uuid not null references public.nothingsports_push_installations (installation_id) on delete cascade,
  attempts integer not null default 0 check (attempts >= 0),
  dispatched_at timestamptz,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, installation_id)
);
alter table public.nothingsports_chat_notification_deliveries
  add column if not exists claimed_at timestamptz;

create table if not exists public.nothingsports_chat_anonymous_session_limits (
  room_id uuid not null references public.nothingsports_chat_rooms (id) on delete cascade,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 10),
  updated_at timestamptz not null default now(),
  primary key (room_id, ip_hash, window_started_at)
);

create table if not exists public.nothingsports_chat_anonymous_signup_tickets (
  ticket_hash text primary key check (ticket_hash ~ '^[0-9a-f]{64}$'),
  room_id uuid not null references public.nothingsports_chat_rooms (id) on delete cascade,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  check (expires_at > issued_at and expires_at <= issued_at + interval '5 minutes')
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
create index if not exists nothingsports_chat_messages_reply_idx
  on public.nothingsports_chat_messages (reply_to_message_id)
  where reply_to_message_id is not null;
create index if not exists nothingsports_chat_messages_rate_idx
  on public.nothingsports_chat_messages (room_id, sender_id, created_at desc);
create index if not exists nothingsports_chat_messages_sender_idx
  on public.nothingsports_chat_messages (sender_id);
create index if not exists nothingsports_chat_rooms_created_by_idx
  on public.nothingsports_chat_rooms (created_by);
create index if not exists nothingsports_chat_rooms_closed_by_idx
  on public.nothingsports_chat_rooms (closed_by)
  where closed_by is not null;
create index if not exists nothingsports_chat_reactions_room_updated_idx
  on public.nothingsports_chat_reactions (room_id, updated_at, reaction_id);
create index if not exists nothingsports_chat_reactions_message_active_idx
  on public.nothingsports_chat_reactions (message_id, emoji)
  where active;
create index if not exists nothingsports_chat_reactions_actor_idx
  on public.nothingsports_chat_reactions (actor_id);
create index if not exists nothingsports_chat_notification_pending_idx
  on public.nothingsports_chat_notification_deliveries (claimed_at, created_at)
  where dispatched_at is null;
create index if not exists nothingsports_chat_anonymous_session_limits_cleanup_idx
  on public.nothingsports_chat_anonymous_session_limits (window_started_at);
create index if not exists nothingsports_chat_anonymous_signup_tickets_cleanup_idx
  on public.nothingsports_chat_anonymous_signup_tickets (expires_at);
create index if not exists nothingsports_chat_anonymous_signup_tickets_room_idx
  on public.nothingsports_chat_anonymous_signup_tickets (room_id);
create index if not exists nothingsports_chat_notification_installation_idx
  on public.nothingsports_chat_notification_deliveries (installation_id);

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
    new.guest_share_enabled := false;
    new.guest_share_disabled_at := coalesce(new.guest_share_disabled_at, new.closed_at);
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where room_id = old.id;
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
  reply_room_id uuid;
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
  if new.reply_to_message_id is not null then
    select room_id into reply_room_id
    from public.nothingsports_chat_messages
    where id = new.reply_to_message_id;
    if reply_room_id is null or reply_room_id is distinct from new.room_id then
      raise exception 'Replies must target a message in the same chat room';
    end if;
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

create or replace function public.enforce_nothingsports_chat_reaction_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  message_room_id uuid;
  room_status text;
begin
  select room_id into message_room_id
  from public.nothingsports_chat_messages
  where id = new.message_id;
  if message_room_id is null or message_room_id is distinct from new.room_id then
    raise exception 'Reactions must target a message in the same chat room';
  end if;
  select status into room_status
  from public.nothingsports_chat_rooms
  where id = new.room_id;
  if room_status is distinct from 'open' then
    raise exception 'Reactions can only be changed in an open chat room';
  end if;
  perform 1
  from public.nothingsports_chat_members
  where room_id = new.room_id and user_id = new.actor_id;
  if not found then
    raise exception 'Only room members may react';
  end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.room_id is distinct from old.room_id
       or new.message_id is distinct from old.message_id
       or new.actor_id is distinct from old.actor_id
       or new.emoji is distinct from old.emoji then
      raise exception 'Reaction identity cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nothingsports_chat_reaction_rules on public.nothingsports_chat_reactions;
create trigger enforce_nothingsports_chat_reaction_rules
before insert or update on public.nothingsports_chat_reactions
for each row execute function public.enforce_nothingsports_chat_reaction_rules();

create or replace function public.enforce_nothingsports_chat_notification_recipient()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sender uuid;
  recipient uuid;
begin
  select sender_id into sender from public.nothingsports_chat_messages where id = new.message_id;
  select user_id into recipient from public.nothingsports_push_installations where installation_id = new.installation_id;
  if sender is not null and recipient is not null and sender = recipient then
    raise exception 'Message senders cannot receive their own chat notification';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nothingsports_chat_notification_recipient on public.nothingsports_chat_notification_deliveries;
create trigger enforce_nothingsports_chat_notification_recipient
before insert or update of message_id, installation_id on public.nothingsports_chat_notification_deliveries
for each row execute function public.enforce_nothingsports_chat_notification_recipient();

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

create or replace function public.nothingsports_chat_unread_totals(target_users uuid[])
returns table (
  user_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select requested.user_id,
    coalesce(sum(
      case when open_room.id is null then 0 else (
        select count(*)
        from public.nothingsports_chat_messages unread
        where unread.room_id = membership.room_id
          and unread.sender_id <> requested.user_id
          and unread.created_at > membership.last_read_at
      ) end
    ), 0)::bigint as unread_count
  from (
    select distinct supplied.user_id
    from unnest(coalesce(target_users, '{}'::uuid[])) supplied(user_id)
    where supplied.user_id is not null
  ) requested
  left join public.nothingsports_chat_members membership
    on membership.user_id = requested.user_id
  left join public.nothingsports_chat_rooms open_room
    on open_room.id = membership.room_id and open_room.status = 'open'
  group by requested.user_id;
$$;

drop function if exists public.nothingsports_chat_authorize_anonymous_session(uuid, integer, text, text);
create or replace function public.nothingsports_chat_authorize_anonymous_session(
  target_room uuid,
  target_version integer,
  target_nonce text,
  target_ip_hash text,
  target_ticket_hash text
)
returns table (outcome text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_room public.nothingsports_chat_rooms%rowtype;
  current_window timestamptz := date_trunc('hour', clock_timestamp());
  issued_time timestamptz;
  accepted_count integer;
begin
  if target_ip_hash is null or target_ip_hash !~ '^[0-9a-f]{64}$'
     or target_ticket_hash is null or target_ticket_hash !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text;
    return;
  end if;
  select * into current_room
  from public.nothingsports_chat_rooms
  where id = target_room
  for share;
  if not found
     or current_room.status <> 'open'
     or not current_room.guest_share_enabled
     or current_room.guest_share_version <> target_version
     or current_room.guest_share_nonce is distinct from target_nonce then
    return query select 'invalid'::text;
    return;
  end if;
  insert into public.nothingsports_chat_anonymous_session_limits
    (room_id, ip_hash, window_started_at, request_count, updated_at)
  values (target_room, target_ip_hash, current_window, 1, clock_timestamp())
  on conflict (room_id, ip_hash, window_started_at) do update
    set request_count = public.nothingsports_chat_anonymous_session_limits.request_count + 1,
        updated_at = excluded.updated_at
    where public.nothingsports_chat_anonymous_session_limits.request_count < 10
  returning request_count into accepted_count;
  if accepted_count is null then
    return query select 'rate_limited'::text;
    return;
  end if;
  issued_time := clock_timestamp();
  insert into public.nothingsports_chat_anonymous_signup_tickets
    (ticket_hash, room_id, issued_at, expires_at)
  values
    (target_ticket_hash, target_room, issued_time, issued_time + interval '5 minutes');
  return query select 'authorized'::text;
end;
$$;

create or replace function public.nothingsports_before_user_created(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  signup_ticket text;
  signup_ticket_hash text;
  authorized_room uuid;
begin
  if event #>> '{user,is_anonymous}' is distinct from 'true' then
    return '{}'::jsonb;
  end if;

  signup_ticket := event #>> '{user,user_metadata,chat_signup_ticket}';
  if signup_ticket is null or signup_ticket !~ '^[A-Za-z0-9_-]{43}$' then
    return pg_catalog.jsonb_build_object(
      'error', pg_catalog.jsonb_build_object(
        'http_code', 403,
        'message', 'Anonymous chat signup is not authorized.'
      )
    );
  end if;

  signup_ticket_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(signup_ticket, 'UTF8')),
    'hex'
  );
  delete from public.nothingsports_chat_anonymous_signup_tickets
  where ticket_hash = signup_ticket_hash
    and expires_at > clock_timestamp()
  returning room_id into authorized_room;

  if authorized_room is null then
    return pg_catalog.jsonb_build_object(
      'error', pg_catalog.jsonb_build_object(
        'http_code', 403,
        'message', 'Anonymous chat signup is not authorized.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

create or replace function public.nothingsports_chat_join_shared_room(
  target_room uuid,
  target_version integer,
  target_nonce text,
  target_user uuid,
  target_member_kind text,
  target_guest_display_name text default null
)
returns table (outcome text, existing_member boolean, member_count bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_room public.nothingsports_chat_rooms%rowtype;
  current_member public.nothingsports_chat_members%rowtype;
  current_count bigint;
begin
  if target_member_kind not in ('account','guest')
     or (target_member_kind = 'account' and target_guest_display_name is not null)
     or (target_member_kind = 'guest' and char_length(coalesce(target_guest_display_name,'')) not between 2 and 30) then
    raise exception 'Invalid shared chat member identity';
  end if;
  select * into current_room
  from public.nothingsports_chat_rooms
  where id = target_room
  for update;
  if not found then
    return query select 'invalid'::text, false, 0::bigint;
    return;
  end if;
  if current_room.status <> 'open' then
    return query select 'closed'::text, false, 0::bigint;
    return;
  end if;
  if not current_room.guest_share_enabled
     or current_room.guest_share_version <> target_version
     or current_room.guest_share_nonce is distinct from target_nonce then
    return query select 'invalid'::text, false, 0::bigint;
    return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nothingsports-chat-member-limit:' || target_room::text, 0)
  );
  select * into current_member
  from public.nothingsports_chat_members
  where room_id = target_room and user_id = target_user
  for update;
  if found then
    if current_member.member_kind = 'guest' and target_member_kind = 'guest'
       and current_member.guest_display_name is distinct from target_guest_display_name then
      update public.nothingsports_chat_members
      set guest_display_name = target_guest_display_name
      where room_id = target_room and user_id = target_user;
    end if;
    select count(*) into current_count from public.nothingsports_chat_members where room_id = target_room;
    return query select 'existing'::text, true, current_count;
    return;
  end if;
  select count(*) into current_count from public.nothingsports_chat_members where room_id = target_room;
  if current_count >= 25 then
    return query select 'full'::text, false, current_count;
    return;
  end if;
  insert into public.nothingsports_chat_members
    (room_id, user_id, added_by, member_kind, guest_display_name)
  values
    (target_room, target_user, target_user, target_member_kind, target_guest_display_name);
  return query select 'joined'::text, false, current_count + 1;
end;
$$;

create or replace function public.nothingsports_chat_configure_guest_share(
  target_room uuid,
  target_enabled boolean,
  target_rotate boolean default false,
  target_nonce text default null
)
returns setof public.nothingsports_chat_rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_room public.nothingsports_chat_rooms%rowtype;
begin
  select * into current_room
  from public.nothingsports_chat_rooms
  where id = target_room
  for update;
  if not found then raise exception 'Chat room not found'; end if;
  if current_room.status <> 'open' then raise exception 'Closed chats cannot be shared'; end if;

  if target_enabled then
    if not current_room.guest_share_enabled or target_rotate then
      if target_nonce is null or target_nonce !~ '^[A-Za-z0-9_-]{32}$' then
        raise exception 'A valid guest share nonce is required';
      end if;
      delete from public.nothingsports_chat_anonymous_signup_tickets
      where room_id = target_room;
      update public.nothingsports_chat_rooms
      set guest_share_enabled = true,
          guest_share_version = guest_share_version + 1,
          guest_share_nonce = target_nonce,
          guest_share_enabled_at = now(),
          guest_share_disabled_at = null,
          updated_at = now()
      where id = target_room;
    end if;
  else
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where room_id = target_room;
    update public.nothingsports_chat_rooms
    set guest_share_enabled = false,
        guest_share_disabled_at = now(),
        updated_at = now()
    where id = target_room;
    delete from public.nothingsports_chat_members
    where room_id = target_room and member_kind = 'guest';
  end if;
  return query select * from public.nothingsports_chat_rooms where id = target_room;
end;
$$;

create or replace function public.nothingsports_chat_claim_notification_delivery(
  target_message uuid,
  target_installation uuid,
  target_claimed_at timestamptz,
  target_stale_before timestamptz
)
returns setof public.nothingsports_chat_notification_deliveries
language sql
security invoker
set search_path = ''
as $$
  update public.nothingsports_chat_notification_deliveries
  set claimed_at = target_claimed_at,
      updated_at = target_claimed_at
  where message_id = target_message
    and installation_id = target_installation
    and dispatched_at is null
    and (claimed_at is null or claimed_at < target_stale_before)
  returning *;
$$;

alter table public.nothingsports_chat_profiles enable row level security;
alter table public.nothingsports_chat_profiles force row level security;
alter table public.nothingsports_chat_rooms enable row level security;
alter table public.nothingsports_chat_rooms force row level security;
alter table public.nothingsports_chat_members enable row level security;
alter table public.nothingsports_chat_members force row level security;
alter table public.nothingsports_chat_messages enable row level security;
alter table public.nothingsports_chat_messages force row level security;
alter table public.nothingsports_chat_reactions enable row level security;
alter table public.nothingsports_chat_reactions force row level security;
alter table public.nothingsports_chat_notification_deliveries enable row level security;
alter table public.nothingsports_chat_notification_deliveries force row level security;
alter table public.nothingsports_chat_anonymous_session_limits enable row level security;
alter table public.nothingsports_chat_anonymous_session_limits force row level security;
alter table public.nothingsports_chat_anonymous_signup_tickets enable row level security;
alter table public.nothingsports_chat_anonymous_signup_tickets force row level security;

revoke all on table public.nothingsports_chat_profiles from public, anon, authenticated;
revoke all on table public.nothingsports_chat_rooms from public, anon, authenticated;
revoke all on table public.nothingsports_chat_members from public, anon, authenticated;
revoke all on table public.nothingsports_chat_messages from public, anon, authenticated;
revoke all on table public.nothingsports_chat_reactions from public, anon, authenticated;
revoke all on table public.nothingsports_chat_notification_deliveries from public, anon, authenticated;
revoke all on table public.nothingsports_chat_anonymous_session_limits from public, anon, authenticated;
revoke all on table public.nothingsports_chat_anonymous_signup_tickets from public, anon, authenticated, supabase_auth_admin;
grant select, insert, update, delete on table public.nothingsports_chat_profiles to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_rooms to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_members to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_messages to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_reactions to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_notification_deliveries to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_anonymous_session_limits to service_role;
grant select, insert, update, delete on table public.nothingsports_chat_anonymous_signup_tickets to service_role;
grant usage on schema public to supabase_auth_admin;
grant select, delete on table public.nothingsports_chat_anonymous_signup_tickets to supabase_auth_admin;

revoke all on function public.nothingsports_chat_create_room(text, jsonb, text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_active_rooms(uuid, boolean) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_unread_totals(uuid[]) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_authorize_anonymous_session(uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_join_shared_room(uuid, integer, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_configure_guest_share(uuid, boolean, boolean, text) from public, anon, authenticated;
revoke all on function public.nothingsports_chat_claim_notification_delivery(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.nothingsports_chat_create_room(text, jsonb, text, uuid, uuid[]) to service_role;
grant execute on function public.nothingsports_chat_active_rooms(uuid, boolean) to service_role;
grant execute on function public.nothingsports_chat_unread_totals(uuid[]) to service_role;
grant execute on function public.nothingsports_chat_authorize_anonymous_session(uuid, integer, text, text, text) to service_role;
grant execute on function public.nothingsports_chat_join_shared_room(uuid, integer, text, uuid, text, text) to service_role;
grant execute on function public.nothingsports_chat_configure_guest_share(uuid, boolean, boolean, text) to service_role;
grant execute on function public.nothingsports_chat_claim_notification_delivery(uuid, uuid, timestamptz, timestamptz) to service_role;

revoke all on function public.nothingsports_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.nothingsports_before_user_created(jsonb) to supabase_auth_admin;

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
drop policy if exists "deny direct chat reaction access" on public.nothingsports_chat_reactions;
create policy "deny direct chat reaction access" on public.nothingsports_chat_reactions
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct chat notification delivery access" on public.nothingsports_chat_notification_deliveries;
create policy "deny direct chat notification delivery access" on public.nothingsports_chat_notification_deliveries
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct anonymous chat session limit access" on public.nothingsports_chat_anonymous_session_limits;
create policy "deny direct anonymous chat session limit access" on public.nothingsports_chat_anonymous_session_limits
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "deny direct anonymous signup ticket access" on public.nothingsports_chat_anonymous_signup_tickets;
create policy "deny direct anonymous signup ticket access" on public.nothingsports_chat_anonymous_signup_tickets
  for all to anon, authenticated using (false) with check (false);
drop policy if exists "auth hook reads anonymous signup tickets" on public.nothingsports_chat_anonymous_signup_tickets;
create policy "auth hook reads anonymous signup tickets" on public.nothingsports_chat_anonymous_signup_tickets
  for select to supabase_auth_admin using (true);
drop policy if exists "auth hook consumes anonymous signup tickets" on public.nothingsports_chat_anonymous_signup_tickets;
create policy "auth hook consumes anonymous signup tickets" on public.nothingsports_chat_anonymous_signup_tickets
  for delete to supabase_auth_admin using (true);

comment on table public.nothingsports_chat_profiles is 'Server-only private chat identity. Email is never returned to room members.';
comment on table public.nothingsports_chat_rooms is 'Private fixture chat rooms. Closure is irreversible and purge follows seven days later.';
comment on table public.nothingsports_chat_members is 'Sole member-access relationship for private fixture chat.';
comment on table public.nothingsports_chat_messages is 'Plain-text phase-1 chat messages with idempotent client IDs.';
comment on table public.nothingsports_chat_reactions is 'Server-only fixed-palette chat reactions. Inactive rows are polling tombstones.';
comment on table public.nothingsports_chat_notification_deliveries is 'Idempotent privacy-safe chat push delivery ledger; senders are excluded.';
comment on table public.nothingsports_chat_anonymous_session_limits is 'Server-only per-room anonymous-session counters keyed by an HMAC of the Vercel client IP; raw IP addresses are never stored.';
comment on table public.nothingsports_chat_anonymous_signup_tickets is 'One-use, five-minute anonymous Auth tickets. Only SHA-256 hashes are stored; raw bearer tickets never enter the database.';
comment on function public.nothingsports_before_user_created(jsonb) is 'Supabase Before User Created hook: ordinary accounts pass, anonymous users require and consume a server-issued chat signup ticket.';

-- pg_cron is a managed Supabase extension and must be enabled for the project
-- before this migration runs. Do not try to install it from the migration role:
-- Supabase owns the extension's grant lifecycle.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron must be enabled before applying private fixture chat';
  end if;
end;
$$;
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
  $job$
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where expires_at <= now();
    delete from public.nothingsports_chat_rooms
    where status = 'closed' and purge_at <= now()
  $job$
);

do $$
declare existing_job bigint;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'nothingsports-chat-anonymous-auth-cleanup-daily'
  loop
    perform cron.unschedule(existing_job);
  end loop;
end;
$$;
select cron.schedule(
  'nothingsports-chat-anonymous-auth-cleanup-daily',
  '23 3 * * *',
  $job$
    delete from public.nothingsports_chat_anonymous_signup_tickets
    where expires_at <= now();
    delete from public.nothingsports_chat_anonymous_session_limits
    where window_started_at < now() - interval '2 days';
    with orphaned_anonymous as materialized (
      select anonymous_user.id
      from auth.users anonymous_user
      where anonymous_user.is_anonymous is true
        and anonymous_user.created_at < now() - interval '30 days'
        and not exists (
          select 1 from public.nothingsports_chat_members member
          where member.user_id = anonymous_user.id
        )
        and not exists (
          select 1 from public.nothingsports_chat_messages message
          where message.sender_id = anonymous_user.id
        )
    ), removed_installations as (
      delete from public.nothingsports_push_installations installation
      using orphaned_anonymous orphan
      where installation.user_id = orphan.id
      returning installation.installation_id
    )
    delete from auth.users anonymous_user
    using orphaned_anonymous orphan
    where anonymous_user.id = orphan.id
  $job$
);
