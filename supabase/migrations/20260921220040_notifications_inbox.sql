-- Account inbox: independent of installation delivery and conversation receipts.
-- Version matches the applied nothingSport-recovery migration.
create table public.nothingsports_inbox_epoch (singleton boolean primary key default true check(singleton),started_at timestamptz not null default clock_timestamp());
insert into public.nothingsports_inbox_epoch default values;
alter table public.nothingsports_inbox_epoch enable row level security;
revoke all on public.nothingsports_inbox_epoch from public,anon,authenticated;
grant select on public.nothingsports_inbox_epoch to service_role;
create table public.nothingsports_inbox (
 id uuid primary key default gen_random_uuid(),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('chat','invitation','added','profile_followed','follows_copied','points','rating','reminder','system')),
 source_key text not null,
 actor_user_id uuid references auth.users(id) on delete set null,
 room_id uuid references public.nothingsports_chat_rooms(id) on delete cascade,
 event_id text, phase text, points integer not null default 0,
 message_count integer not null default 0,
 group_open boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 activity_at timestamptz not null default clock_timestamp(),
 version integer not null default 1,
 read_at timestamptz, surfaced_at timestamptz,
 title text, detail text,
 unique(recipient_user_id,source_key)
);
create index nothingsports_inbox_page on public.nothingsports_inbox(recipient_user_id,activity_at desc,id desc);
create index nothingsports_inbox_unread on public.nothingsports_inbox(recipient_user_id) where read_at is null;
create index nothingsports_inbox_expiry on public.nothingsports_inbox(activity_at);
create unique index nothingsports_inbox_chat_group on public.nothingsports_inbox(recipient_user_id,room_id) where group_open;
alter table public.nothingsports_inbox enable row level security;
alter table public.nothingsports_inbox force row level security;
revoke all on public.nothingsports_inbox from public,anon,authenticated;
grant select,insert,update,delete on public.nothingsports_inbox to service_role;

create function public.nothingsports_inbox_source() returns trigger
language plpgsql security invoker set search_path='' as $$
declare j jsonb:=to_jsonb(new); m record; k text; recipient uuid; actor uuid; pts integer:=0; source text;begin
 if tg_table_name='nothingsports_chat_messages' then
  if new.message_type='system' then return new;end if;
  -- Serialize against the receipt update to avoid reopening an already-read group.
  for m in select * from public.nothingsports_chat_members where room_id=new.room_id and user_id<>new.sender_id and member_kind='account' order by user_id for update loop
   if new.created_at<=m.last_read_at then continue;end if;
   insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,actor_user_id,room_id,message_count,group_open,activity_at,created_at)
   values(m.user_id,'chat','chat:'||new.id,new.sender_id,new.room_id,1,true,new.created_at,new.created_at)
   on conflict(recipient_user_id,room_id) where group_open do update
   set message_count=nothingsports_inbox.message_count+1,actor_user_id=excluded.actor_user_id,
       activity_at=greatest(nothingsports_inbox.activity_at,excluded.activity_at),version=nothingsports_inbox.version+1,read_at=null;
  end loop;
  return new;
 elsif tg_table_name='nothingsports_chat_members' then
  if tg_op='UPDATE' then
   if new.last_read_at>old.last_read_at then
    -- Messages read before their notification is viewed need no redundant item.
    -- This also covers quiet rooms using the established 30-second polling cadence.
    delete from public.nothingsports_inbox where recipient_user_id=new.user_id and room_id=new.room_id and group_open and activity_at<=new.last_read_at and surfaced_at is null;
    update public.nothingsports_inbox set group_open=false where recipient_user_id=new.user_id and room_id=new.room_id and group_open and activity_at<=new.last_read_at;
   end if;return new;
  end if;
  if new.member_kind<>'account' or new.user_id=new.added_by then return new;end if;
  -- Accepted invitations already have their own story.
  if exists(select 1 from public.nothingsports_chat_invitations where room_id=new.room_id and invitee_id=new.user_id) then return new;end if;
  insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,actor_user_id,room_id)
  values(new.user_id,'added','member:'||new.room_id||':'||new.joined_at,new.added_by,new.room_id) on conflict do nothing;return new;
 elsif tg_table_name='nothingsports_chat_invitations' then
  if new.status<>'pending' then return new;end if;
  insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,actor_user_id,room_id)
  values(new.invitee_id,'invitation','invitation:'||new.invitation_id,new.inviter_id,new.room_id) on conflict do nothing;return new;
 elsif tg_table_name='nothingsports_social_notifications' then
  k:=new.kind;recipient:=new.recipient_user_id;actor:=new.actor_user_id;pts:=new.points;source:='social:'||new.id;
 elsif tg_table_name='nothingsports_nsc_points' then
  if new.action_key in ('followed_by_person','picks_copied') then return new;end if;
  k:='points';recipient:=new.user_id;pts:=new.points;source:='points:'||new.ledger_id;
 elsif tg_table_name='nothingsports_friend_activity' then
  k:='rating';recipient:=new.recipient_user_id;actor:=new.rater_user_id;source:='rating:'||new.id;
 end if;
 if recipient is not null then
  insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,actor_user_id,event_id,phase,points,detail)
  values(recipient,k,source,actor,j->>'event_id',j->>'phase',pts,case when k='points' then j->>'action_key' end) on conflict do nothing;
 end if;return new;
end $$;
revoke all on function public.nothingsports_inbox_source() from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_source() to service_role;
create trigger inbox_messages after insert on public.nothingsports_chat_messages for each row execute function public.nothingsports_inbox_source();
create trigger inbox_members after insert or update of last_read_at on public.nothingsports_chat_members for each row execute function public.nothingsports_inbox_source();
create trigger inbox_invitations after insert on public.nothingsports_chat_invitations for each row execute function public.nothingsports_inbox_source();
create trigger inbox_social after insert on public.nothingsports_social_notifications for each row execute function public.nothingsports_inbox_source();
create trigger inbox_points after insert on public.nothingsports_nsc_points for each row execute function public.nothingsports_inbox_source();
create trigger inbox_ratings after insert on public.nothingsports_friend_activity for each row execute function public.nothingsports_inbox_source();

-- Existing dispatcher owns due reminders and bounded retention cleanup.
create function public.nothingsports_inbox_maintenance() returns void
language plpgsql security invoker set search_path='' as $$ begin
 insert into public.nothingsports_inbox(recipient_user_id,kind,source_key,event_id,title,activity_at)
 select distinct on(user_id,event_id,remind_at) user_id,'reminder','reminder:'||event_id||':'||remind_at,event_id,title,remind_at
 from public.nothingsports_reminders where user_id is not null and remind_at<=clock_timestamp() and remind_at>clock_timestamp()-interval '1 hour' and remind_at>=(select started_at from public.nothingsports_inbox_epoch)
 on conflict do nothing;
 delete from public.nothingsports_inbox where id in(select id from public.nothingsports_inbox where activity_at<clock_timestamp()-interval '90 days' order by activity_at limit 500);
end $$;
revoke all on function public.nothingsports_inbox_maintenance() from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_maintenance() to service_role;

create function public.nothingsports_inbox_read(target_user uuid,seen jsonb) returns void
language sql security invoker set search_path='' as $$
 update public.nothingsports_inbox i set read_at=clock_timestamp(),surfaced_at=coalesce(surfaced_at,clock_timestamp())
 from jsonb_to_recordset(seen) as s(id uuid,version integer)
 where i.id=s.id and i.version=s.version and i.recipient_user_id=target_user;
$$;
revoke all on function public.nothingsports_inbox_read(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_read(uuid,jsonb) to service_role;

create function public.nothingsports_inbox_page(target_user uuid,before_time timestamptz default null,before_id uuid default null,summary_only boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
 with eligible as (
  select i.* from public.nothingsports_inbox i
  where i.recipient_user_id=target_user and i.activity_at>clock_timestamp()-interval '90 days'
  and (i.kind not in('chat','added') or exists(select 1 from public.nothingsports_chat_members m where m.room_id=i.room_id and m.user_id=target_user and m.member_kind='account'))
  and (i.kind<>'invitation' or exists(select 1 from public.nothingsports_chat_invitations v where v.room_id=i.room_id and v.invitee_id=target_user))
  and (i.kind<>'rating' or exists(select 1 from public.nothingsports_nsc_profiles p where p.user_id=i.actor_user_id and p.visibility='visible' and not exists(select 1 from public.nothingsports_nsc_personas n where n.user_id=p.user_id and n.moderation_flag)))
 ), page as (
  select * from eligible where not summary_only and (before_time is null or (activity_at,id)<(before_time,before_id)) order by activity_at desc,id desc limit 26
 ), projected as (
 select i.activity_at,i.id,jsonb_build_object(
  'id',i.id,'kind',i.kind,'version',i.version,'read',i.read_at is not null,'at',i.activity_at,
  'roomId',i.room_id,'eventId',i.event_id,'phase',i.phase,'points',i.points,'messageCount',i.message_count,
  'actor',case when p.visibility='visible' and not coalesce(n.moderation_flag,false) then p.display_name else 'A Nothinger' end,
  'profileId',case when p.visibility='visible' and not coalesce(n.moderation_flag,false) then p.profile_id end,
  'title',i.title,'detail',i.detail,'roomName',r.room_name,
  'invitationState',(select v.status from public.nothingsports_chat_invitations v where v.room_id=i.room_id and v.invitee_id=target_user limit 1),
  'preview',case when i.kind='chat' then msg.body end,
  'sender',case when i.kind='chat' then msg.sender_display_name end,
  'available',case when i.kind='chat' then msg.id is not null else true end
 ) item
 from page i
 left join public.nothingsports_nsc_profiles p on p.user_id=i.actor_user_id
 left join public.nothingsports_nsc_personas n on n.user_id=p.user_id
 left join public.nothingsports_chat_rooms r on r.id=i.room_id
 left join lateral(select cm.id,cm.body,cm.sender_display_name from public.nothingsports_chat_messages cm
  where cm.room_id=i.room_id and cm.sender_id<>target_user and cm.message_type<>'system' and cm.created_at>=i.created_at and cm.created_at<=i.activity_at
  order by cm.created_at desc,cm.id desc limit 1) msg on i.kind='chat'
 ) select jsonb_build_object('unreadCount',(select count(*) from eligible where read_at is null),'items',coalesce((select jsonb_agg(item order by activity_at desc,id desc) from projected),'[]'::jsonb));
$$;
revoke all on function public.nothingsports_inbox_page(uuid,timestamptz,uuid,boolean) from public,anon,authenticated;
grant execute on function public.nothingsports_inbox_page(uuid,timestamptz,uuid,boolean) to service_role;
