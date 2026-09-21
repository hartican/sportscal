-- Bytes live in Storage; these server-only rows track ownership and bounded cleanup.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('nothingsports-avatar-originals','nothingsports-avatar-originals',false,6000000,null),
 ('nothingsports-avatar-thumbnails','nothingsports-avatar-thumbnails',true,32000,array['image/webp']),
 ('nothingsports-avatar-expanded','nothingsports-avatar-expanded',false,200000,array['image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table public.nothingsports_avatar_assets(
 user_id uuid primary key references auth.users(id) on delete cascade,
 version uuid not null unique, thumbnail_path text not null, expanded_path text not null,
 thumbnail_bytes integer not null check(thumbnail_bytes between 1 and 32000),
 expanded_bytes integer not null check(expanded_bytes between 1 and 200000),
 thumbnail_width integer not null default 128 check(thumbnail_width=128),
 expanded_width integer not null default 512 check(expanded_width=512),
 updated_at timestamptz not null default now()
);
create table public.nothingsports_avatar_uploads(
 upload_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 base_version uuid, byte_size integer not null check(byte_size between 1 and 6000000),
 original_path text not null, status text not null default 'pending' check(status in('pending','processing','complete','failed')),
 created_at timestamptz not null default now(), claimed_at timestamptz
);
create index on public.nothingsports_avatar_uploads(user_id,created_at);
create table public.nothingsports_avatar_cleanup(
 bucket text not null check(bucket in('nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars')),
 object_path text not null, not_before timestamptz not null default now(), attempts integer not null default 0,
 primary key(bucket,object_path)
);
create index on public.nothingsports_avatar_cleanup(not_before);
alter table public.nothingsports_avatar_assets enable row level security;
alter table public.nothingsports_avatar_uploads enable row level security;
alter table public.nothingsports_avatar_cleanup enable row level security;
revoke all on public.nothingsports_avatar_assets,public.nothingsports_avatar_uploads,public.nothingsports_avatar_cleanup from public,anon,authenticated;
grant all on public.nothingsports_avatar_assets,public.nothingsports_avatar_uploads,public.nothingsports_avatar_cleanup to service_role;

create function public.nothingsports_publish_avatar(actor uuid, upload uuid, thumb_bytes integer, full_bytes integer, public_url text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare pending public.nothingsports_avatar_uploads; previous public.nothingsports_avatar_assets; object_name text;
begin
 perform 1 from public.nothingsports_nsc_profiles where user_id=actor and visibility <> 'deleted' for update;
 if not found then raise exception 'profile_unavailable'; end if;
 select * into pending from public.nothingsports_avatar_uploads where upload_id=upload and user_id=actor for update;
 if not found then raise exception 'upload_unavailable'; end if;
 select * into previous from public.nothingsports_avatar_assets where user_id=actor;
 if pending.status='complete' then return previous.version=upload; end if;
 if pending.status<>'processing' or pending.created_at < now()-interval '23 hours' then raise exception 'upload_unavailable'; end if;
 if previous.version is distinct from pending.base_version then raise exception 'avatar_changed_retry'; end if;
 object_name := actor::text||'/'||upload::text||'.webp';
 if previous.version is not null then
  insert into public.nothingsports_avatar_cleanup(bucket,object_path) values
   ('nothingsports-avatar-thumbnails',previous.thumbnail_path),('nothingsports-avatar-expanded',previous.expanded_path)
   on conflict(bucket,object_path) do update set not_before=now();
 end if;
 insert into public.nothingsports_avatar_assets(user_id,version,thumbnail_path,expanded_path,thumbnail_bytes,expanded_bytes)
 values(actor,upload,object_name,object_name,thumb_bytes,full_bytes)
 on conflict(user_id) do update set version=excluded.version,thumbnail_path=excluded.thumbnail_path,expanded_path=excluded.expanded_path,thumbnail_bytes=excluded.thumbnail_bytes,expanded_bytes=excluded.expanded_bytes,updated_at=now();
 update public.nothingsports_nsc_profiles set avatar_url=public_url,updated_at=now() where user_id=actor;
 update public.nothingsports_avatar_uploads set status='complete' where upload_id=upload;
 delete from public.nothingsports_avatar_cleanup where object_path=object_name and bucket in('nothingsports-avatar-thumbnails','nothingsports-avatar-expanded');
 update public.nothingsports_avatar_cleanup set not_before=now() where bucket='nothingsports-avatar-originals' and object_path=pending.original_path;
 return true;
end $$;
revoke all on function public.nothingsports_publish_avatar(uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.nothingsports_publish_avatar(uuid,uuid,integer,integer,text) to service_role;

-- Deletion also covers Auth account deletion via the assets cascade.
create schema if not exists private;
create function private.nothingsports_queue_avatar_deletion() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.nothingsports_avatar_cleanup(bucket,object_path) values
 ('nothingsports-avatar-thumbnails',old.thumbnail_path),('nothingsports-avatar-expanded',old.expanded_path)
 on conflict(bucket,object_path) do update set not_before=now();
 return old;
end $$;
revoke all on function private.nothingsports_queue_avatar_deletion() from public,anon,authenticated;
create trigger avatar_asset_deleted after delete on public.nothingsports_avatar_assets for each row execute function private.nothingsports_queue_avatar_deletion();

-- Production preflight on 2026-09-21 found zero legacy avatars/objects.
-- Refuse to silently strand legacy pictures if another environment differs.
do $$ begin
 if exists(select 1 from public.nothingsports_nsc_profiles where avatar_url is not null)
 or exists(select 1 from storage.objects where bucket_id='nothingsports-profile-avatars') then
  raise exception 'Migrate existing profile pictures before retiring the legacy public bucket';
 end if;
end $$;
update storage.buckets set public=false where id='nothingsports-profile-avatars';

create function private.nothingsports_delete_profile_avatar() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.visibility='deleted' then
  delete from public.nothingsports_avatar_assets where user_id=new.user_id;
  new.avatar_url:=null;
 end if;
 return new;
end $$;
revoke all on function private.nothingsports_delete_profile_avatar() from public,anon,authenticated;
create trigger profile_avatar_deleted before update of visibility on public.nothingsports_nsc_profiles for each row execute function private.nothingsports_delete_profile_avatar();
