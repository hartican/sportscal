alter table public.nothingsports_chat_members
  add column if not exists last_delivered_at timestamptz,
  add column if not exists archived_at timestamptz;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('nothingsports-profile-avatars','nothingsports-profile-avatars',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=1048576,allowed_mime_types=excluded.allowed_mime_types;

alter table public.nothingsports_chat_messages drop constraint if exists nothingsports_chat_messages_message_type_check;
alter table public.nothingsports_chat_messages add constraint nothingsports_chat_messages_message_type_check
  check (message_type in ('text','media','mixed','system'));
alter table public.nothingsports_chat_messages drop constraint if exists nothingsports_chat_messages_body_check;
alter table public.nothingsports_chat_messages add constraint nothingsports_chat_messages_body_check
  check (char_length(body) between 0 and 500 and (message_type in ('media','mixed') or char_length(body) >= 1));

create table if not exists public.nothingsports_chat_invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.nothingsports_chat_rooms(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(room_id,invitee_id)
);

alter table public.nothingsports_chat_invitations enable row level security;
alter table public.nothingsports_chat_invitations force row level security;
revoke all on table public.nothingsports_chat_invitations from public,anon,authenticated;
grant select,insert,update,delete on table public.nothingsports_chat_invitations to service_role;
drop policy if exists "deny direct chat invitation access" on public.nothingsports_chat_invitations;
create policy "deny direct chat invitation access" on public.nothingsports_chat_invitations for all using(false) with check(false);

comment on column public.nothingsports_chat_members.last_delivered_at is 'Latest room message acknowledged as delivered by this active member.';
comment on column public.nothingsports_chat_members.archived_at is 'Viewer-specific removal from the active chat list; reopening clears it.';
comment on table public.nothingsports_chat_invitations is 'Protected pending chat invitations; history is unavailable until acceptance creates membership.';

create or replace function public.nothingsports_chat_resolve_invitation(target_invitation uuid,target_invitee uuid,target_resolution text)
returns table(room_id uuid,status text) language plpgsql security invoker set search_path='' as $$
declare selected public.nothingsports_chat_invitations%rowtype;
begin
  if target_resolution not in ('accepted','rejected') then raise exception 'Invalid invitation resolution'; end if;
  select * into selected from public.nothingsports_chat_invitations where invitation_id=target_invitation and invitee_id=target_invitee for update;
  if selected.invitation_id is null then return; end if;
  perform 1 from public.nothingsports_chat_rooms r where r.id=selected.room_id and r.status='open' for update;
  if not found then return; end if;
  if selected.status='pending' then
    update public.nothingsports_chat_invitations set status=target_resolution,resolved_at=now() where invitation_id=target_invitation;
    if target_resolution='accepted' then
      insert into public.nothingsports_chat_members(room_id,user_id,added_by) values(selected.room_id,target_invitee,selected.inviter_id) on conflict on constraint nothingsports_chat_members_pkey do update set archived_at=null;
    end if;
  elsif selected.status<>target_resolution then return;
  end if;
  return query select selected.room_id,target_resolution;
end $$;

create or replace function public.nothingsports_chat_leave_room(target_room uuid,target_user uuid,target_display_name text,target_client_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.nothingsports_chat_members where room_id=target_room and user_id=target_user for update;
  if not found then return false; end if;
  insert into public.nothingsports_chat_messages(room_id,sender_id,client_id,message_type,body,sender_display_name)
  values(target_room,target_user,target_client_id,'system',format('‘%s’ has dogged the chat.',left(target_display_name,80)),left(target_display_name,80));
  delete from public.nothingsports_chat_members where room_id=target_room and user_id=target_user;
  return true;
end $$;

revoke all on function public.nothingsports_chat_resolve_invitation(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.nothingsports_chat_leave_room(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.nothingsports_chat_resolve_invitation(uuid,uuid,text) to service_role;
grant execute on function public.nothingsports_chat_leave_room(uuid,uuid,text,text) to service_role;

create or replace function public.nothingsports_chat_acknowledge(target_room uuid,target_user uuid,acknowledged_at timestamptz,mark_read boolean)
returns void language sql security invoker set search_path='' as $$
  update public.nothingsports_chat_members set
    last_delivered_at=greatest(last_delivered_at,least(acknowledged_at,now())),
    last_read_at=case when mark_read then greatest(last_read_at,least(acknowledged_at,now())) else last_read_at end,
    archived_at=null
  where room_id=target_room and user_id=target_user;
$$;
revoke all on function public.nothingsports_chat_acknowledge(uuid,uuid,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.nothingsports_chat_acknowledge(uuid,uuid,timestamptz,boolean) to service_role;
