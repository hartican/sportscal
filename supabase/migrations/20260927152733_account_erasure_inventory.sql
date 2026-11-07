set local lock_timeout='2s';
set local statement_timeout='15s';
-- Exact-account, counts-only inventory for the resumable operator workflow.
create function private.nothingsports_account_erasure_inventory(target_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='10s' as $$
declare item record;n bigint;refs jsonb:='[]';shape jsonb:='[]';email_value text;unsupported integer;unknown_objects bigint;
begin
 if target_user_id is null then raise exception 'account_required';end if;
 select email into email_value from auth.users where id=target_user_id;
 select count(*) into unsupported from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace
 where k.contype='f' and k.confrelid='auth.users'::regclass and ns.nspname='public' and cardinality(k.conkey)<>1;
 for item in
  select ns.nspname schema_name,c.relname table_name,a.attname column_name,k.confdeltype delete_action,
   exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgfoid='private.nothingsports_guard_erasure_write()'::regprocedure and t.tgenabled in('O','A') and t.tgtype=21 and position(quote_literal(a.attname) in pg_get_triggerdef(t.oid))>0) guarded
  from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace
  join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1]
  where k.contype='f' and k.confrelid='auth.users'::regclass and ns.nspname='public' and cardinality(k.conkey)=1
  order by ns.nspname,c.relname,a.attname
 loop
  execute format('select count(*) from %I.%I where %I=$1',item.schema_name,item.table_name,item.column_name) into n using target_user_id;
  shape:=shape||jsonb_build_array(to_jsonb(item));
  refs:=refs||jsonb_build_array(to_jsonb(item)||jsonb_build_object('matching_rows',n));
 end loop;
 select count(*) into unknown_objects from storage.objects o
 where (o.owner_id=target_user_id::text or split_part(o.name,'/',1)=target_user_id::text)
 and (o.bucket_id not in ('nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars','nothingsports-chat-transient','nothingsports-saved-game-media') or split_part(o.name,'/',1)<>target_user_id::text);
 return jsonb_build_object(
  'schemaVersion','erasure-inventory.v1','checkedAt',clock_timestamp(),
  'accountExists',exists(select 1 from auth.users where id=target_user_id),
  'schemaFingerprint',md5(shape::text||pg_get_functiondef('private.nothingsports_guard_erasure_write()'::regprocedure)),
  'unsupportedReferences',unsupported,'unknownStorageObjects',unknown_objects,'references',refs,
  'indirect',jsonb_build_object(
   'reward_eligibility_arrays',(select count(*) from public.nothingsports_nsc_reward_campaigns where target_user_id=any(eligible_user_ids)),
   'email_subscriptions',case when email_value is null then null else (select count(*) from public.nothingsports_marquee_subscribers where email_normalized=lower(trim(email_value))) end,
   'avatar_cleanup_paths',(select count(*) from public.nothingsports_avatar_cleanup where split_part(object_path,'/',1)=target_user_id::text),
   'known_storage_paths',(select count(*) from storage.objects where split_part(name,'/',1)=target_user_id::text and bucket_id in ('nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars','nothingsports-chat-transient','nothingsports-saved-game-media')),
   'uploaded_chat_attachments',(select count(*) from public.nothingsports_chat_attachments where uploader_id=target_user_id),
   'other_people_replies',(select count(*) from public.nothingsports_chat_messages reply join public.nothingsports_chat_messages original on original.id=reply.reply_to_message_id where original.sender_id=target_user_id and reply.sender_id is distinct from target_user_id),
   'other_people_memberships_in_owned_rooms',(select count(*) from public.nothingsports_chat_members m join public.nothingsports_chat_rooms r on r.id=m.room_id where r.created_by=target_user_id and m.user_id is distinct from target_user_id),
   'saved_media_owner_mismatch',(select count(*) from public.nothingsports_saved_game_media s join public.nothingsports_chat_attachments a on a.attachment_id=s.source_attachment_id where a.uploader_id=target_user_id and s.owner_id is distinct from target_user_id),
   'reminders_via_installation',(select count(*) from public.nothingsports_reminders r join public.nothingsports_push_installations i on i.installation_id=r.installation_id where i.user_id=target_user_id),
   'notification_send_attempts',(select count(*) from public.nothingsports_notification_send_leases where target_user_id=any(account_ids)),
   'inflight_notification_sends',(select count(*) from public.nothingsports_notification_send_leases where target_user_id=any(account_ids) and finished_at is null)
  )
 );
end $$;
revoke all on function private.nothingsports_account_erasure_inventory(uuid) from public,anon,authenticated;
grant execute on function private.nothingsports_account_erasure_inventory(uuid) to service_role;
create function public.nothingsports_account_erasure_inventory(target_user_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.nothingsports_account_erasure_inventory(target_user_id)$$;
revoke all on function public.nothingsports_account_erasure_inventory(uuid) from public,anon,authenticated;
grant execute on function public.nothingsports_account_erasure_inventory(uuid) to service_role;
