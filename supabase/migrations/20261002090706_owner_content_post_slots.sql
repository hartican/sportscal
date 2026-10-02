-- One fixture can own independent preview and day-of post tasks. Campaign IDs
-- remain the stable unique identity; existing drafts, versions and exports stay.
alter table public.nothingsports_marquee_campaigns
  drop constraint if exists nothingsports_marquee_campaigns_event_id_key;
create index if not exists nothingsports_marquee_campaigns_event_idx
  on public.nothingsports_marquee_campaigns(event_id);
