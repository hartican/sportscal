-- Nullable for a rolling release: old selections remain stored, but the new
-- policy refuses rows lacking independently checked upload/duration metadata.
alter table public.nothingsports_youtube_selections
  add column published_at timestamptz,
  add column duration_seconds integer check (duration_seconds between 1 and 1200);
comment on column public.nothingsports_youtube_selections.published_at is
  'YouTube video upload time; selection/cache freshness cannot renew this date.';
-- Existing service-only grants, RLS and the atomic quota authority are unchanged.
