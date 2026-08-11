-- Weekly Trusted Sports Decision Rate (Australia/Sydney pilot week).
-- Run as a Supabase project administrator; product users have no SELECT grant.

with user_weeks as (
  select
    user_id,
    date_trunc('week', occurred_at at time zone 'Australia/Sydney')::date as week_start,
    bool_or(event_name = 'opportunity_exposed') as had_opportunity,
    bool_or(event_name in ('fixture_check', 'watch_decision')) as made_decision
  from public.product_events
  where event_name in ('opportunity_exposed', 'fixture_check', 'watch_decision')
  group by user_id, date_trunc('week', occurred_at at time zone 'Australia/Sydney')::date
), weekly_tsdr as (
  select
    week_start,
    count(*) filter (where had_opportunity) as denominator_users,
    count(*) filter (where had_opportunity and made_decision) as numerator_users
  from user_weeks
  group by week_start
)
select
  week_start,
  denominator_users,
  numerator_users,
  round(100.0 * numerator_users / nullif(denominator_users, 0), 1) as tsdr_percent
from weekly_tsdr
order by week_start desc;

-- Fixed-choice weekly pulse cross-check.
select
  date_trunc('week', occurred_at at time zone 'Australia/Sydney')::date as week_start,
  properties ->> 'crossCheck' as cross_check,
  properties ->> 'missedFixtures' as missed_fixtures,
  properties ->> 'feedClutter' as feed_clutter,
  count(distinct user_id) as users
from public.product_events
where event_name = 'weekly_pulse'
group by
  date_trunc('week', occurred_at at time zone 'Australia/Sydney')::date,
  properties ->> 'crossCheck',
  properties ->> 'missedFixtures',
  properties ->> 'feedClutter'
order by week_start desc, users desc;
