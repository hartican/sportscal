-- Roll back the additive coordination cache after reverting its resolver.
-- Keep every valid selected video and the authoritative daily quota ledger.
drop function public.nothingsports_finish_youtube_lookup(text,text,uuid,text,jsonb,text);
drop function public.nothingsports_withdraw_youtube_lookup(text,text,uuid,text);
drop function public.nothingsports_reserve_youtube_lookup_quota(text,text,uuid,text);
drop function public.nothingsports_claim_youtube_lookup(text,text,uuid);
delete from public.nothingsports_youtube_selections where video_id is null;
alter table public.nothingsports_youtube_selections
  alter column video_id set not null,
  drop column lookup_query_hash,
  drop column lookup_token,
  drop column lookup_until,
  drop column lookup_after,
  drop column lookup_outcome,
  drop column lookup_checked_at,
  drop column lookup_quota_day,
  drop column lookup_search_calls,
  drop column lookup_ordinary_calls;
