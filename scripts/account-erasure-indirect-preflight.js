#!/usr/bin/env node
'use strict';
// Counts only. No network or deletion mode; failures mean incomplete evidence.
function buildIndirectPreflight(userId) {
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '')) throw Error('Expected exact account UUID');
 const id=userId.toLowerCase();
 const checks=[
 ['reward_eligibility_arrays','review',`select count(*) from public.nothingsports_nsc_reward_campaigns where t.id=any(eligible_user_ids)`],
 ['email_subscriptions','review',`select case when t.email is null then null else (select count(*) from public.nothingsports_marquee_subscribers where email_normalized=lower(trim(t.email))) end`],
 ['avatar_cleanup_paths','review',`select count(*) from public.nothingsports_avatar_cleanup where bucket in ('nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars') and split_part(object_path,'/',1)=t.id::text`],
 ['known_storage_paths','review',`select count(*) from storage.objects where bucket_id in ('nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars','nothingsports-chat-transient','nothingsports-saved-game-media') and split_part(name,'/',1)=t.id::text`],
 ['uploaded_chat_attachments','review',`select count(*) from public.nothingsports_chat_attachments where uploader_id=t.id`],
 ['other_people_replies','preserve',`select count(*) from public.nothingsports_chat_messages reply join public.nothingsports_chat_messages original on original.id=reply.reply_to_message_id where original.sender_id=t.id and reply.sender_id is distinct from t.id`],
 ['other_people_memberships_in_owned_rooms','preserve',`select count(*) from public.nothingsports_chat_members m join public.nothingsports_chat_rooms r on r.id=m.room_id where r.created_by=t.id and m.user_id is distinct from t.id`],
 ['saved_media_owner_mismatch','stop_if_nonzero',`select count(*) from public.nothingsports_saved_game_media s join public.nothingsports_chat_attachments a on a.attachment_id=s.source_attachment_id where a.uploader_id=t.id and s.owner_id is distinct from t.id`],
 ['reminders_via_installation','review',`select count(*) from public.nothingsports_reminders r join public.nothingsports_push_installations i on i.installation_id=r.installation_id where i.user_id=t.id`],
 ];
 return `-- Partial indirect inventory, not a deletion list or erasure certificate.
-- Counts overlap. Preserve other people's content. Null means unverified.
-- Run before Auth deletion: detached installations/email cannot be recovered by UUID alone.
-- JSON identities, unlinked device hashes, logs, caches and unknown paths remain unverified.
begin read only;
set local statement_timeout='10s';
set local lock_timeout='1s';
with target as (select '${id}'::uuid id, (select email from auth.users where id='${id}'::uuid) email),
checks as (
${checks.map(([label,action,query])=>`select '${label}' check_name,'${action}' disposition,(${query})::bigint matching_rows from target t`).join('\nunion all\n')}
)
select check_name,disposition,matching_rows,exists(select 1 from auth.users where id='${id}'::uuid) account_exists from checks order by check_name;
rollback;
`;
}
module.exports={buildIndirectPreflight};
if(require.main===module){try{const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--user')throw Error('Usage: node scripts/account-erasure-indirect-preflight.js --user UUID');process.stdout.write(buildIndirectPreflight(args[1]));}catch(error){console.error(error.message);process.exitCode=1;}}
