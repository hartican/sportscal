-- Signed-in fixture-chat creation, a race-safe three-open-chat membership
-- ceiling, and privacy-safe public-profile lookup for invitations.

drop trigger if exists enforce_nothingsports_chat_room_limit on public.nothingsports_chat_rooms;
drop function if exists public.enforce_nothingsports_chat_room_limit();

create or replace function public.enforce_nothingsports_chat_member_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.member_kind = 'account' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('nothingsports-chat-open-user-limit:' || new.user_id::text, 0)
    );
    if (
      select count(*)
      from public.nothingsports_chat_members existing
      join public.nothingsports_chat_rooms room on room.id = existing.room_id
      where existing.user_id = new.user_id and room.status = 'open'
    ) >= 3 then
      raise exception 'An account may participate in at most 3 open chats';
    end if;
  end if;
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

create or replace function public.nothingsports_chat_search_profiles(
  target_query text,
  target_limit integer default 10
)
returns table (
  account_id uuid,
  display_name text,
  handle text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profile.user_id, profile.display_name, profile.handle
  from public.nothingsports_nsc_profiles profile
  where profile.visibility = 'visible'
    and char_length(btrim(coalesce(target_query, ''))) >= 3
    and (
      lower(profile.display_name) like '%' || lower(btrim(target_query)) || '%'
      or lower(profile.handle) like '%' || lower(btrim(target_query)) || '%'
    )
  order by
    case when lower(profile.handle) = lower(btrim(target_query)) then 0 else 1 end,
    lower(profile.display_name),
    profile.user_id
  limit least(greatest(coalesce(target_limit, 10), 1), 10);
$$;

revoke all on function public.nothingsports_chat_search_profiles(text, integer) from public, anon, authenticated;
grant execute on function public.nothingsports_chat_search_profiles(text, integer) to service_role;

comment on function public.nothingsports_chat_search_profiles(text, integer) is
  'Server-only chat invitation search over visible public display names and handles; emails are never returned to ordinary users.';
