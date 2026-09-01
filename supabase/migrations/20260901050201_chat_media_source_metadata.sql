alter table public.nothingsports_chat_attachments
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.nothingsports_saved_game_media
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.nothingsports_chat_attachments enable row level security;
alter table public.nothingsports_chat_attachments force row level security;
alter table public.nothingsports_saved_game_media enable row level security;
alter table public.nothingsports_saved_game_media force row level security;

revoke all on table public.nothingsports_chat_attachments from public, anon, authenticated;
revoke all on table public.nothingsports_saved_game_media from public, anon, authenticated;
grant select, insert, update, delete on table public.nothingsports_chat_attachments to service_role;
grant select, insert, update, delete on table public.nothingsports_saved_game_media to service_role;

comment on column public.nothingsports_chat_attachments.source_metadata is
  'Service-written provider, source-page, licence and attribution metadata for imported media.';

comment on column public.nothingsports_saved_game_media.source_metadata is
  'Immutable copy of service-validated source provenance retained when a user saves chat media.';
