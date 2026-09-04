alter table public.nothingsports_chat_attachments
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists external_url text,
  add column if not exists external_preview_url text,
  alter column storage_bucket drop not null,
  alter column object_path drop not null;

alter table public.nothingsports_chat_attachments
  drop constraint if exists nothingsports_chat_attachments_location_check;
alter table public.nothingsports_chat_attachments
  drop constraint if exists nothingsports_chat_attachments_byte_size_check;

alter table public.nothingsports_chat_attachments
  add constraint nothingsports_chat_attachments_byte_size_check check (
    (external_url is null and byte_size between 1 and 26214400)
    or (external_url is not null and byte_size = 0)
  );

alter table public.nothingsports_chat_attachments
  add constraint nothingsports_chat_attachments_location_check check (
    (
      external_url is null
      and external_preview_url is null
      and storage_bucket is not null
      and object_path is not null
    )
    or
    (
      kind = 'gif'
      and status = 'ready'
      and storage_bucket is null
      and object_path is null
      and char_length(external_url) between 1 and 4096
      and char_length(external_preview_url) between 1 and 4096
      and external_url ~* '^https://([a-z0-9-]+\.)*giphy\.(com|net)/[^[:space:]]*$'
      and external_preview_url ~* '^https://([a-z0-9-]+\.)*giphy\.(com|net)/[^[:space:]]*$'
      and source_metadata ->> 'provider' = 'giphy'
      and nullif(source_metadata ->> 'providerId', '') is not null
    )
  );

alter table public.nothingsports_chat_attachments enable row level security;
alter table public.nothingsports_chat_attachments force row level security;

revoke all on table public.nothingsports_chat_attachments from public, anon, authenticated;
grant select, insert, update, delete on table public.nothingsports_chat_attachments to service_role;

comment on column public.nothingsports_chat_attachments.external_url is
  'Service-validated direct GIPHY media URL. Provider media is referenced, never copied or proxied.';

comment on column public.nothingsports_chat_attachments.external_preview_url is
  'Service-validated direct GIPHY preview URL used by chat clients without media proxying or caching.';
