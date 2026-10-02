-- Operator-only, atomic. Refuses rollback after new activity, erasure or function changes.
-- Revert the app through the normal exact-SHA workflow after this verified undo.
do $undo$
declare t text;item record;state_hash text;inv jsonb;begin
 perform pg_advisory_xact_lock(hashtext('sportscal:coverage-repair:v1'));
 perform pg_advisory_xact_lock(hashtextextended('nsc-awards-v2',0));
 select inventory into inv from nothingsports_recovery.coverage_repair_versions where version='rugby-identity.20261002' and completed_at is not null;
 if inv is null then raise exception 'Completed Rugby repair is missing';end if;
 for item in select * from jsonb_each_text(inv->'postState') loop
  execute format('lock table public.%I in share row exclusive mode',item.key);
  execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from public.%I r where event_id in (''rugby-australia-south-africa-2026-09-27'',''fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945'',''fixture:rugby:ra:949625'',''fixture-rugby-ra-949625'')',item.key) into state_hash;
  if state_hash is distinct from item.value then raise exception 'Rugby undo requires newer activity review: %',item.key;end if;
 end loop;
 for item in select * from jsonb_each_text(inv->'functionPostState') loop
  if item.value is distinct from md5(pg_get_functiondef(item.key::regprocedure)) then raise exception 'Rugby undo requires newer function review: %',item.key;end if;
 end loop;
 if (select count(*) from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and table_name<>'@function')<>(inv->>'recoveryRows')::bigint then raise exception 'Rugby undo preimages were erased; never restore erased account data';end if;
 for item in select payload from nothingsports_recovery.coverage_repair_rows where version='rugby-identity.20261002' and table_name='@function' loop execute item.payload->>'definition';end loop;
 -- Scope has no settlement/prediction/participation records. Child-first removal
 -- and parent-first insertion preserve real non-deferrable foreign keys.
 foreach t in array array['nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_reminders','nothingsports_score_votes','nothingsports_score_fixtures'] loop
  execute format('alter table public.%I disable trigger user',t);
 end loop;
 foreach t in array array['nothingsports_friend_activity','nothingsports_inbox','nothingsports_live_rating_alerts','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_reminders','nothingsports_score_votes','nothingsports_score_fixtures'] loop
  execute format('delete from public.%I where event_id=''rugby-australia-south-africa-2026-09-27''',t);
 end loop;
 foreach t in array array['nothingsports_score_fixtures','nothingsports_live_rating_alerts','nothingsports_friend_activity','nothingsports_inbox','nothingsports_nsc_contributions','nothingsports_nsc_points','nothingsports_nsc_prediction_revisions','nothingsports_nsc_rating_history','nothingsports_prediction_rules','nothingsports_reminders','nothingsports_score_votes'] loop
  execute format('insert into public.%I overriding system value select (jsonb_populate_record(null::public.%I,payload)).* from nothingsports_recovery.coverage_repair_rows where version=''rugby-identity.20261002'' and table_name=%L',t,t,t);
  execute format('alter table public.%I enable trigger user',t);
 end loop;
 update nothingsports_recovery.coverage_repair_versions set completed_at=null where version='rugby-identity.20261002';
end $undo$;
