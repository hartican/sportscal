-- Run after nothingsports-product-events.sql in the Supabase SQL editor.
-- Requires at least two Auth users. The transaction always rolls back.

begin;

select set_config(
  'nothingsports.verify_user_a',
  coalesce((select id::text from auth.users order by created_at limit 1), ''),
  true
);
select set_config(
  'nothingsports.verify_user_b',
  coalesce((select id::text from auth.users order by created_at offset 1 limit 1), ''),
  true
);

do $$
begin
  if current_setting('nothingsports.verify_user_a', true) = ''
    or current_setting('nothingsports.verify_user_b', true) = '' then
    raise exception 'Two Auth users are required to verify product_events RLS isolation.';
  end if;
  if has_table_privilege('authenticated', 'public.product_events', 'select')
    or has_table_privilege('authenticated', 'public.product_events', 'update')
    or has_table_privilege('authenticated', 'public.product_events', 'delete') then
    raise exception 'product_events must remain append-only for authenticated users.';
  end if;
  if not has_table_privilege('authenticated', 'public.product_events', 'insert') then
    raise exception 'authenticated users require INSERT on product_events.';
  end if;
end $$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('nothingsports.verify_user_a'),
  true
);
set local role authenticated;

insert into public.product_events (
  user_id,
  client_event_id,
  event_name,
  occurred_at,
  session_id,
  surface,
  properties
) values (
  current_setting('nothingsports.verify_user_a')::uuid,
  'verify-rls-own-row',
  'opportunity_exposed',
  now(),
  'verify-session-a',
  'curated_feed',
  '{"presentation":"card","position":0}'::jsonb
);

do $$
begin
  begin
    insert into public.product_events (
      user_id,
      client_event_id,
      event_name,
      occurred_at,
      session_id,
      surface,
      properties
    ) values (
      current_setting('nothingsports.verify_user_b')::uuid,
      'verify-rls-other-row',
      'opportunity_exposed',
      now(),
      'verify-session-a',
      'curated_feed',
      '{}'::jsonb
    );
    raise exception 'RLS isolation failed: user A inserted a row owned by user B.';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

select
  'product_events RLS isolation verified' as verification,
  current_setting('nothingsports.verify_user_a')::uuid as user_a,
  current_setting('nothingsports.verify_user_b')::uuid as user_b;

rollback;
