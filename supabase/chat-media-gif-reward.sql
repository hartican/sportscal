-- Targeted extension for transient fixture-chat media and private saved copies.
create extension if not exists pgcrypto;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid='public.nothingsports_chat_rooms'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.nothingsports_chat_rooms drop constraint %I', constraint_name); end loop;
end;
$$;
alter table public.nothingsports_chat_rooms add constraint nothingsports_chat_rooms_status_check
  check (status in ('open','closing','closed'));
alter table public.nothingsports_chat_rooms add constraint nothingsports_chat_rooms_lifecycle_check
  check ((status in ('open','closing') and closed_at is null and purge_at is null) or (status='closed' and closed_at is not null and purge_at is not null));

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid='public.nothingsports_chat_messages'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%message_type%'
  loop execute format('alter table public.nothingsports_chat_messages drop constraint %I', constraint_name); end loop;
end;
$$;
alter table public.nothingsports_chat_messages add constraint nothingsports_chat_messages_message_type_check
  check (message_type in ('text','media','mixed'));

create table if not exists public.nothingsports_chat_attachments (
  attachment_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nothingsports_chat_rooms(id) on delete cascade,
  message_id uuid references public.nothingsports_chat_messages(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('image','gif','audio','pdf','file')),
  file_name text not null check (char_length(file_name) between 1 and 120),
  content_type text not null check (char_length(content_type) between 3 and 120),
  byte_size bigint not null check (byte_size between 1 and 26214400),
  storage_bucket text not null default 'nothingsports-chat-transient',
  object_path text not null unique,
  status text not null default 'pending' check (status in ('pending','ready','saved')),
  ready_at timestamptz,
  saved_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.nothingsports_saved_game_media (
  saved_media_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_attachment_id uuid references public.nothingsports_chat_attachments(attachment_id) on delete set null,
  room_id uuid references public.nothingsports_chat_rooms(id) on delete set null,
  event_id text,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size between 1 and 26214400),
  storage_bucket text not null default 'nothingsports-saved-game-media',
  object_path text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists nothingsports_chat_attachments_room_idx on public.nothingsports_chat_attachments(room_id,message_id,status);
create index if not exists nothingsports_chat_attachments_message_idx on public.nothingsports_chat_attachments(message_id) where message_id is not null;
create index if not exists nothingsports_chat_attachments_uploader_idx on public.nothingsports_chat_attachments(uploader_id,created_at desc);
create index if not exists nothingsports_saved_game_media_owner_idx on public.nothingsports_saved_game_media(owner_id,event_id,created_at desc);
create index if not exists nothingsports_saved_game_media_source_idx on public.nothingsports_saved_game_media(source_attachment_id) where source_attachment_id is not null;
create index if not exists nothingsports_saved_game_media_room_idx on public.nothingsports_saved_game_media(room_id) where room_id is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('nothingsports-chat-transient','nothingsports-chat-transient',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
('nothingsports-saved-game-media','nothingsports-saved-game-media',false,26214400,array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/wav','audio/ogg','application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.protect_nothingsports_chat_room_lifecycle() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.status='closed' then
    if new.status<>old.status or new.closed_at is distinct from old.closed_at or new.purge_at is distinct from old.purge_at then
      raise exception 'Closed chat rooms cannot be reopened or have retention changed';
    end if;
    return new;
  end if;
  if new.status='closed' then
    new.closed_at:=coalesce(new.closed_at,now());
    new.purge_at:=new.closed_at+interval '7 days';
    new.guest_share_enabled:=false;
    new.guest_share_disabled_at:=coalesce(new.guest_share_disabled_at,new.closed_at);
    delete from public.nothingsports_chat_anonymous_signup_tickets where room_id=old.id;
  elsif new.status='open' then
    new.closed_at:=null; new.closed_by:=null; new.purge_at:=null;
  else
    new.closed_at:=null; new.purge_at:=null; new.guest_share_enabled:=false;
    new.guest_share_disabled_at:=coalesce(new.guest_share_disabled_at,now());
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

alter table public.nothingsports_chat_attachments enable row level security;
alter table public.nothingsports_chat_attachments force row level security;
alter table public.nothingsports_saved_game_media enable row level security;
alter table public.nothingsports_saved_game_media force row level security;
revoke all on table public.nothingsports_chat_attachments from public,anon,authenticated;
revoke all on table public.nothingsports_saved_game_media from public,anon,authenticated;
grant select,insert,update,delete on table public.nothingsports_chat_attachments to service_role;
grant select,insert,update,delete on table public.nothingsports_saved_game_media to service_role;
drop policy if exists "deny direct chat attachment access" on public.nothingsports_chat_attachments;
create policy "deny direct chat attachment access" on public.nothingsports_chat_attachments for all to anon,authenticated using(false) with check(false);
drop policy if exists "deny direct saved game media access" on public.nothingsports_saved_game_media;
create policy "deny direct saved game media access" on public.nothingsports_saved_game_media for all to anon,authenticated using(false) with check(false);
comment on table public.nothingsports_chat_attachments is 'Private transient chat media removed when its room closes unless the uploader saves a private copy.';
comment on table public.nothingsports_saved_game_media is 'Private account-owned game media explicitly saved by its original uploader.';
