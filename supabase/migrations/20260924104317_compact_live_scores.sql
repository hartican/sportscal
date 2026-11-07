create table public.nothingsports_live_scores(
 source_id text references public.nothingsports_fixture_sources on delete cascade,
 fixture_id text,score jsonb not null,content_hash text not null,first_completed_at timestamptz,
 primary key(source_id,fixture_id),foreign key(source_id,fixture_id) references public.nothingsports_fixture_current(source_id,fixture_id) on delete cascade
);
alter table public.nothingsports_live_scores enable row level security;
revoke all on public.nothingsports_live_scores from public,anon,authenticated;
grant all on public.nothingsports_live_scores to service_role;
create function public.nothingsports_publish_compact_scores(p_source_id text,p_token uuid,p_fixtures jsonb,p_scores jsonb,p_hash text,p_interval_ms integer,p_report jsonb default null)
returns bigint language plpgsql security invoker set search_path='' as $$
declare revision bigint;begin
 -- The existing publisher validates and consumes the source lease in this transaction.
 if p_report is null then revision:=public.nothingsports_publish_fixture_source(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms);
 else revision:=public.nothingsports_publish_fixture_source_report(p_source_id,p_token,p_fixtures,p_hash,p_interval_ms,p_report);end if;
 insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at)
 select p_source_id,s->>'id',s,md5(s::text),case when s->>'status' in('completed','finished','final') then clock_timestamp() end from jsonb_array_elements(p_scores) s
 on conflict(source_id,fixture_id) do update set score=nothingsports_live_scores.score||excluded.score,content_hash=md5((nothingsports_live_scores.score||excluded.score)::text),first_completed_at=coalesce(nothingsports_live_scores.first_completed_at,excluded.first_completed_at)
 where nothingsports_live_scores.score is distinct from nothingsports_live_scores.score||excluded.score;
 return revision;
end $$;
create function public.nothingsports_read_match_scores(p_fixture_ids text[])
returns table(source_id text,fixture jsonb,checked_at timestamptz) language sql stable security invoker set search_path='' as $$
 select c.source_id,c.fixture||coalesce(s.score,'{}'::jsonb)||jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at),src.checked_at
 from public.nothingsports_fixture_current c join public.nothingsports_fixture_sources src using(source_id)
 left join public.nothingsports_live_scores s on s.source_id=c.source_id and s.fixture_id=c.fixture_id
 where cardinality(p_fixture_ids) between 1 and 60 and c.identity_keys && p_fixture_ids
 order by src.checked_at,c.fixture_id;
$$;
revoke all on function public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb),public.nothingsports_read_match_scores(text[]) from public,anon,authenticated;
grant execute on function public.nothingsports_publish_compact_scores(text,uuid,jsonb,jsonb,text,integer,jsonb),public.nothingsports_read_match_scores(text[]) to service_role;
-- Existing Feed reads retain scores when the write split is enabled.
create or replace function public.nothingsports_read_current_fixtures(p_fixture_ids text[] default null)
returns table(source_id text,fixture_id text,fixture jsonb,identity_keys text[])
language sql stable security invoker set search_path='' as $$
 select c.source_id,c.fixture_id,c.fixture||coalesce(s.score,'{}'::jsonb)||case when s.first_completed_at is null then '{}'::jsonb else jsonb_build_object('firstConfirmedCompleteAt',s.first_completed_at) end,c.identity_keys
 from public.nothingsports_fixture_current c left join public.nothingsports_live_scores s using(source_id,fixture_id)
 where p_fixture_ids is null or c.identity_keys && p_fixture_ids order by c.source_id,c.fixture_id;
$$;
