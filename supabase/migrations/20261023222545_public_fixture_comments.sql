-- Service-owned public fixture discussions. Browser roles use the authenticated API.
set local lock_timeout='2s';
set local statement_timeout='15s';
create table public.nothingsports_public_threads(
 event_id text primary key check(length(event_id) between 1 and 180),fixture jsonb not null,
 revision bigint not null default 0,closed boolean not null default false,checked_at timestamptz not null default now()
);
create table public.nothingsports_public_comments(
 id uuid primary key default gen_random_uuid(),event_id text not null references public.nothingsports_public_threads(event_id),
 author_user_id uuid not null references auth.users(id) on delete cascade,
 parent_id uuid references public.nothingsports_public_comments(id) on delete set null,
 client_id uuid not null,body text not null default '' check(char_length(body)<=500),gif jsonb,
 deleted boolean not null default false,score integer not null default 0,
 created_at timestamptz not null default clock_timestamp(),revision bigint not null,
 unique(author_user_id,client_id),check(deleted or length(trim(body))>0 or gif is not null),
 check(gif is null or (jsonb_typeof(gif)='object' and gif->>'provider'='giphy' and gif->>'contentType'='image/gif'))
);
create index public_comments_rank on public.nothingsports_public_comments(event_id,parent_id,score desc,created_at,id);
create index public_comments_changes on public.nothingsports_public_comments(event_id,revision);
create index public_comments_author on public.nothingsports_public_comments(author_user_id,created_at);
create index public_comments_parent on public.nothingsports_public_comments(parent_id,score desc,created_at,id) where parent_id is not null;
create table public.nothingsports_public_comment_tombstones(
 id uuid primary key,event_id text not null references public.nothingsports_public_threads(event_id),revision bigint not null
);
create index public_comment_tombstone_changes on public.nothingsports_public_comment_tombstones(event_id,revision);
create table public.nothingsports_public_comment_votes(
 comment_id uuid references public.nothingsports_public_comments(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,value smallint not null check(value in(-1,1)),
 primary key(comment_id,user_id)
);
create table public.nothingsports_public_comment_limits(
 user_id uuid primary key references auth.users(id) on delete cascade,
 minute timestamptz not null,posts integer not null default 0,votes integer not null default 0
);
create index public_comment_vote_owner on public.nothingsports_public_comment_votes(user_id);
create table public.nothingsports_public_comment_runs(
 id uuid primary key default gen_random_uuid(),event_id text not null references public.nothingsports_public_threads(event_id),
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 actor_user_id uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null references public.nothingsports_public_comments(id) on delete cascade,
 comment_count integer not null default 1,created_at timestamptz not null default clock_timestamp(),
 claimed_at timestamptz,completed_at timestamptz
);
create index public_comment_runs_due on public.nothingsports_public_comment_runs(created_at,id) where completed_at is null;
create index public_comment_run_recipient on public.nothingsports_public_comment_runs(recipient_user_id);
create index public_comment_run_actor on public.nothingsports_public_comment_runs(actor_user_id);
create table public.nothingsports_public_comment_heads(
 recipient_user_id uuid references auth.users(id) on delete cascade,event_id text references public.nothingsports_public_threads(event_id),
 actor_user_id uuid not null references auth.users(id) on delete cascade,run_id uuid not null references public.nothingsports_public_comment_runs(id) on delete cascade,
 primary key(recipient_user_id,event_id)
);
create table public.nothingsports_public_comment_deliveries(
 run_id uuid references public.nothingsports_public_comment_runs(id) on delete cascade,
 installation_id uuid references public.nothingsports_push_installations(installation_id) on delete cascade,
 status text not null default 'pending' check(status in('pending','sending','sent','failed','uncertain')),
 attempts integer not null default 0,started_at timestamptz,primary key(run_id,installation_id)
);
create index public_comment_head_actor on public.nothingsports_public_comment_heads(actor_user_id);
create index public_comment_delivery_installation on public.nothingsports_public_comment_deliveries(installation_id);
create table public.nothingsports_classic_comments(
 event_id text references public.nothingsports_classic_fixtures(event_id) on delete cascade,
 position smallint not null check(position between 1 and 3),comment_id uuid not null,
 author_user_id uuid not null references auth.users(id) on delete cascade,
 handle text not null,body text not null check(length(trim(body))>0 and char_length(body)<=500),score integer not null,
 captured_at timestamptz not null default clock_timestamp(),primary key(event_id,position)
);
create index classic_comment_author on public.nothingsports_classic_comments(author_user_id);
alter table public.nothingsports_push_installations add column followed_comment_alerts_enabled boolean not null default true;

do $$ declare t text;begin
 foreach t in array array['public_threads','public_comments','public_comment_tombstones','public_comment_votes','public_comment_limits','public_comment_runs','public_comment_heads','public_comment_deliveries','classic_comments'] loop
  execute format('alter table public.%I enable row level security','nothingsports_'||t);
  execute format('alter table public.%I force row level security','nothingsports_'||t);
  execute format('revoke all on public.%I from public,anon,authenticated','nothingsports_'||t);
  execute format('grant select,insert,update,delete on public.%I to service_role','nothingsports_'||t);
 end loop;
end $$;
create trigger public_comments_erasure_insert after insert on public.nothingsports_public_comments for each row execute function private.nothingsports_guard_erasure_write('author_user_id');
-- FK detachment and derived vote totals must drain while either account erases.
-- This exception cannot change author, text, GIF, deletion state or identity.
create trigger public_comments_erasure_update after update on public.nothingsports_public_comments for each row
 when(not((to_jsonb(new)-array['parent_id','score','revision'])=(to_jsonb(old)-array['parent_id','score','revision']) and(new.parent_id is not distinct from old.parent_id or new.parent_id is null)))
 execute function private.nothingsports_guard_erasure_write('author_user_id');
create trigger public_votes_erasure after insert or update on public.nothingsports_public_comment_votes for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger public_limits_erasure after insert or update on public.nothingsports_public_comment_limits for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger public_runs_erasure after insert or update on public.nothingsports_public_comment_runs for each row execute function private.nothingsports_guard_erasure_write('recipient_user_id','actor_user_id');
create trigger public_heads_erasure after insert or update on public.nothingsports_public_comment_heads for each row execute function private.nothingsports_guard_erasure_write('recipient_user_id','actor_user_id');
create trigger classic_comments_erasure after insert or update on public.nothingsports_classic_comments for each row execute function private.nothingsports_guard_erasure_write('author_user_id');

create function private.nothingsports_public_comment_revision() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 update public.nothingsports_public_threads set revision=revision+1 where event_id=new.event_id returning revision into new.revision;
 return new;
end $$;
create trigger public_comment_revision before insert or update on public.nothingsports_public_comments for each row execute function private.nothingsports_public_comment_revision();
create function private.nothingsports_public_comment_removed() returns trigger language plpgsql security invoker set search_path='' as $$
declare revision bigint;begin
 update public.nothingsports_public_threads set revision=nothingsports_public_threads.revision+1 where event_id=old.event_id returning nothingsports_public_threads.revision into revision;
 insert into public.nothingsports_public_comment_tombstones values(old.id,old.event_id,revision) on conflict(id) do update set revision=excluded.revision;
 return null;
end $$;
create trigger public_comment_removed after delete on public.nothingsports_public_comments for each row execute function private.nothingsports_public_comment_removed();
create function private.nothingsports_public_comment_identity_changed() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid:=coalesce(new.user_id,old.user_id);begin
 if tg_table_name='nothingsports_account_erasure_blocks' or not exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=actor) then
  update public.nothingsports_public_comments set score=score where author_user_id=actor;
 end if;return null;
end $$;
create trigger public_comment_profile_change after update or delete on public.nothingsports_nsc_profiles for each row execute function private.nothingsports_public_comment_identity_changed();
create trigger public_comment_persona_change after insert or update or delete on public.nothingsports_nsc_personas for each row execute function private.nothingsports_public_comment_identity_changed();
create trigger public_comment_erasure_change after insert or delete on public.nothingsports_account_erasure_blocks for each row execute function private.nothingsports_public_comment_identity_changed();
create function private.nothingsports_public_vote_total() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 update public.nothingsports_public_comments c set score=(select coalesce(sum(v.value),0) from public.nothingsports_public_comment_votes v where v.comment_id=c.id) where c.id=coalesce(new.comment_id,old.comment_id);
 return null;
end $$;
create trigger public_vote_total after insert or update or delete on public.nothingsports_public_comment_votes for each row execute function private.nothingsports_public_vote_total();

create function private.nothingsports_public_comment_json(c public.nothingsports_public_comments,viewer uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'parentId',c.parent_id,'body',case when not c.deleted and p.visibility='visible' and not coalesce(n.moderation_flag,false) and b.user_id is null then c.body else '' end,
 'gif',case when not c.deleted and p.visibility='visible' and not coalesce(n.moderation_flag,false) and b.user_id is null then c.gif end,
 'handle',case when not c.deleted and p.visibility='visible' and not coalesce(n.moderation_flag,false) and b.user_id is null then '@'||p.handle end,
 'deleted',c.deleted or coalesce(p.visibility<>'visible',true) or coalesce(n.moderation_flag,false) or b.user_id is not null,
 'own',c.author_user_id=viewer,'score',c.score,'myVote',coalesce((select value from public.nothingsports_public_comment_votes where comment_id=c.id and user_id=viewer),0),
 'createdAt',c.created_at,'revision',c.revision,'replyCount',(select count(*) from public.nothingsports_public_comments r where r.parent_id=c.id))
 from (select 1) one left join public.nothingsports_nsc_profiles p on p.user_id=c.author_user_id left join public.nothingsports_nsc_personas n on n.user_id=c.author_user_id left join public.nothingsports_account_erasure_blocks b on b.user_id=c.author_user_id;
$$;

create function public.nothingsports_public_comments(target_user uuid,target_fixture text,command jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.nothingsports_public_threads;c public.nothingsports_public_comments;par public.nothingsports_public_comments;h public.nothingsports_public_comment_heads;
 actor record;v integer;run uuid;action text:=command->>'action';items jsonb;preview jsonb;cursor jsonb:=command->'cursor';next_cursor jsonb;epoch timestamptz:=date_trunc('minute',clock_timestamp());
begin
 if action not in('page','changes','post','vote','delete') then raise exception 'invalid_public_comment_action';end if;
 if target_user is null or exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=target_user) then raise exception 'public_comment_account_unavailable';end if;
 if exists(select 1 from public.nothingsports_nsc_personas where user_id=target_user and moderation_flag) then raise exception 'public_comment_account_unavailable';end if;
 if action in('post','vote','delete') then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('public-comment-actor:'||target_user,0));
  if action='post' then
   select * into c from public.nothingsports_public_comments where author_user_id=target_user and client_id=(command->>'clientId')::uuid;
   if found then
    if c.event_id<>target_fixture or c.body<>coalesce(command->>'body','') or c.gif is distinct from nullif(command->'gif','null'::jsonb) or c.parent_id is distinct from (command->>'parentId')::uuid then raise exception 'public_comment_id_conflict';end if;
    return jsonb_build_object('comment',private.nothingsports_public_comment_json(c,target_user),'replayed',true);
   end if;
   insert into public.nothingsports_public_threads(event_id,fixture) values(target_fixture,command->'fixture') on conflict do nothing;
  end if;
 end if;
 select * into t from public.nothingsports_public_threads where event_id=target_fixture for update;
 if not found then return jsonb_build_object('comments','[]'::jsonb,'revision',0,'nextCursor',null);end if;
 if t.closed then raise exception 'public_comments_retired';end if;
 if action in('page','changes') then
  if coalesce((command->>'after')::bigint,0)>t.revision then raise exception 'public_comment_cursor_changed';end if;
  if cursor is not null and (cursor->>'revision')::bigint<>t.revision then raise exception 'public_comment_cursor_changed';end if;
  if action='changes' then
   select coalesce(jsonb_agg(x.item order by x.revision),'[]'::jsonb) into items from(
    select * from(
     select pc.revision,private.nothingsports_public_comment_json(pc,target_user) item from public.nothingsports_public_comments pc where pc.event_id=target_fixture and pc.revision>coalesce((command->>'after')::bigint,0)
     union all select dead.revision,jsonb_build_object('id',dead.id,'revision',dead.revision,'removed',true) from public.nothingsports_public_comment_tombstones dead where dead.event_id=target_fixture and dead.revision>coalesce((command->>'after')::bigint,0)
    ) changes order by revision limit 101)x;
   v:=jsonb_array_length(items);if v>100 then items:=items-100;end if;
   select coalesce(jsonb_agg(private.nothingsports_public_comment_json(p,target_user)),'[]'::jsonb) into preview from public.nothingsports_public_comments p where p.id in(select (entry->>'parentId')::uuid from jsonb_array_elements(items) entry where entry->>'parentId' is not null);
   return jsonb_build_object('comments',items||preview,'revision',case when v>100 then (items->99->>'revision')::bigint else t.revision end,'hasMore',v>100);
  end if;
  with page as(select * from public.nothingsports_public_comments pc where pc.event_id=target_fixture and pc.parent_id is not distinct from (command->>'parentId')::uuid
   and (cursor is null or pc.score<(cursor->>'score')::integer or(pc.score=(cursor->>'score')::integer and(pc.created_at,pc.id)>((cursor->>'at')::timestamptz,(cursor->>'id')::uuid)))
   order by score desc,created_at,id limit 26)
  select coalesce(jsonb_agg(private.nothingsports_public_comment_json(p,target_user) order by score desc,created_at,id),'[]'::jsonb) into items from page p;
  if jsonb_array_length(items)>25 then
   next_cursor:=jsonb_build_object('score',items->24->'score','at',items->24->'createdAt','id',items->24->'id','revision',t.revision);items:=items-25;
  end if;
  if command->>'parentId' is null then
   select coalesce(jsonb_agg(private.nothingsports_public_comment_json(r,target_user)),'[]'::jsonb) into preview from jsonb_array_elements(items) p
   cross join lateral(select * from public.nothingsports_public_comments where parent_id=(p->>'id')::uuid order by score desc,created_at,id limit 3)r;
  end if;
  return jsonb_build_object('comments',items||coalesce(preview,'[]'::jsonb),'revision',t.revision,'nextCursor',next_cursor);
 end if;
 insert into public.nothingsports_public_comment_limits(user_id,minute) values(target_user,epoch) on conflict(user_id) do update set minute=excluded.minute,posts=case when nothingsports_public_comment_limits.minute=epoch then nothingsports_public_comment_limits.posts else 0 end,votes=case when nothingsports_public_comment_limits.minute=epoch then nothingsports_public_comment_limits.votes else 0 end;
 if action='post' then
  if not exists(select 1 from public.nothingsports_nsc_profiles where user_id=target_user and visibility='visible' and length(handle)>0) then raise exception 'public_comment_handle_required';end if;
  if(nullif(command->'gif','null'::jsonb))is not null and coalesce((select sum(greatest(points,0)) from public.nothingsports_nsc_points where user_id=target_user),0)<25 then raise exception 'public_comment_gif_locked';end if;
  if(command->>'parentId')is not null then
   select * into par from public.nothingsports_public_comments where id=(command->>'parentId')::uuid;
   if not found or par.event_id<>target_fixture or par.parent_id is not null or par.deleted then raise exception 'public_comment_invalid_parent';end if;
  end if;
  update public.nothingsports_public_comment_limits set posts=posts+1 where user_id=target_user and posts<30;if not found then raise exception 'public_comment_rate_limit';end if;
  insert into public.nothingsports_public_comments(event_id,author_user_id,parent_id,client_id,body,gif,revision) values(target_fixture,target_user,(command->>'parentId')::uuid,(command->>'clientId')::uuid,coalesce(command->>'body',''),nullif(command->'gif','null'::jsonb),0) returning * into c;
  for actor in select f.follower_user_id from public.nothingsports_user_follows f where f.followed_user_id=target_user and f.follower_user_id<>target_user and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id=f.follower_user_id) order by f.follower_user_id loop
   select * into h from public.nothingsports_public_comment_heads where recipient_user_id=actor.follower_user_id and event_id=target_fixture;
   if found and h.actor_user_id=target_user then
    update public.nothingsports_public_comment_runs set comment_count=comment_count+1 where id=h.run_id;
   else
    insert into public.nothingsports_public_comment_runs(event_id,recipient_user_id,actor_user_id,comment_id) values(target_fixture,actor.follower_user_id,target_user,c.id) returning id into run;
    insert into public.nothingsports_public_comment_heads(recipient_user_id,event_id,actor_user_id,run_id) values(actor.follower_user_id,target_fixture,target_user,run)
    on conflict(recipient_user_id,event_id) do update set actor_user_id=excluded.actor_user_id,run_id=excluded.run_id;
   end if;
  end loop;
 else
  select * into c from public.nothingsports_public_comments where id=(command->>'id')::uuid and event_id=target_fixture;
  if not found or c.deleted or exists(select 1 from public.nothingsports_account_erasure_blocks where user_id=c.author_user_id) then raise exception 'public_comment_not_found';end if;
  if action='delete' then
   if c.author_user_id<>target_user then raise exception 'public_comment_not_owned';end if;
   update public.nothingsports_public_comments set deleted=true,body='',gif=null where id=c.id returning * into c;
  else
   v:=(command->>'value')::integer;if v not in(-1,0,1) or v is null then raise exception 'public_comment_invalid_vote';end if;
   update public.nothingsports_public_comment_limits set votes=votes+1 where user_id=target_user and votes<120;if not found then raise exception 'public_comment_rate_limit';end if;
   if v=0 then delete from public.nothingsports_public_comment_votes where comment_id=c.id and user_id=target_user;
   else insert into public.nothingsports_public_comment_votes(comment_id,user_id,value) values(c.id,target_user,v) on conflict(comment_id,user_id) do update set value=excluded.value;end if;
   select * into c from public.nothingsports_public_comments where id=c.id;
  end if;
 end if;
 return jsonb_build_object('comment',private.nothingsports_public_comment_json(c,target_user));
end $$;

create function public.nothingsports_claim_public_comment_runs(claim_at timestamptz,stale_before timestamptz,batch_limit integer default 2) returns setof public.nothingsports_public_comment_runs language sql security invoker set search_path='' as $$
 with selected as(select r.id from public.nothingsports_public_comment_runs r where r.completed_at is null and(r.claimed_at is null or r.claimed_at<stale_before)
 and not exists(select 1 from public.nothingsports_account_erasure_blocks b where b.user_id in(r.recipient_user_id,r.actor_user_id))
 order by r.created_at,r.id limit least(2,greatest(0,batch_limit)) for update skip locked)
 update public.nothingsports_public_comment_runs r set claimed_at=claim_at from selected s where r.id=s.id returning r.*;
$$;

create function public.nothingsports_retire_public_comments(target_fixture text,verified_fixture jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.nothingsports_public_threads;final_day date;today date:=(clock_timestamp() at time zone 'Australia/Sydney')::date;
begin
 select * into t from public.nothingsports_public_threads where event_id=target_fixture for update;
 if not found or t.closed then return jsonb_build_object('retired',false);end if;
 update public.nothingsports_public_threads set checked_at=clock_timestamp(),fixture=verified_fixture where event_id=target_fixture;
 if verified_fixture->>'retirementEligible' is distinct from 'true' or verified_fixture->>'finalDate' is null then return jsonb_build_object('retired',false);end if;
 final_day:=(verified_fixture->>'finalDate')::date;
 if final_day>=today-7 then return jsonb_build_object('retired',false);end if;
 if exists(select 1 from public.nothingsports_personal_classics where event_id=target_fixture) then
  insert into public.nothingsports_classic_comments(event_id,position,comment_id,author_user_id,handle,body,score)
  select target_fixture,row_number() over(order by c.score desc,c.created_at,c.id)::smallint,c.id,c.author_user_id,'@'||p.handle,c.body,c.score
  from public.nothingsports_public_comments c join public.nothingsports_nsc_profiles p on p.user_id=c.author_user_id and p.visibility='visible'
  where c.event_id=target_fixture and not c.deleted and length(trim(c.body))>0 and not exists(select 1 from public.nothingsports_nsc_personas n where n.user_id=c.author_user_id and n.moderation_flag)
  order by c.score desc,c.created_at,c.id limit 3;
 end if;
 delete from public.nothingsports_public_comment_heads where event_id=target_fixture;
 delete from public.nothingsports_public_comment_runs where event_id=target_fixture;
 delete from public.nothingsports_public_comments where event_id=target_fixture;
 delete from public.nothingsports_public_comment_tombstones where event_id=target_fixture;
 update public.nothingsports_public_threads set closed=true,fixture='{}'::jsonb,revision=revision+1 where event_id=target_fixture;
 return jsonb_build_object('retired',true);
end $$;

create function public.nothingsports_public_comment_installations(target_run uuid) returns setof public.nothingsports_push_installations language sql stable security invoker set search_path='' as $$
 select i.* from public.nothingsports_push_installations i join public.nothingsports_public_comment_runs r on i.user_id=r.recipient_user_id
 where r.id=target_run and i.permission='granted' and i.followed_comment_alerts_enabled
 and not exists(select 1 from public.nothingsports_public_comment_deliveries d where d.run_id=r.id and d.installation_id=i.installation_id and d.status in('sent','failed','uncertain'))
 order by i.installation_id limit 6;
$$;

do $$ declare fn record;begin
 for fn in select n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) args from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where p.proname in('nothingsports_public_comment_revision','nothingsports_public_comment_removed','nothingsports_public_comment_identity_changed','nothingsports_public_vote_total','nothingsports_public_comment_json','nothingsports_public_comments','nothingsports_claim_public_comment_runs','nothingsports_retire_public_comments','nothingsports_public_comment_installations') loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',fn.nspname,fn.proname,fn.args);
  execute format('grant execute on function %I.%I(%s) to service_role',fn.nspname,fn.proname,fn.args);
 end loop;
end $$;
