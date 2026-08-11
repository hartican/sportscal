-- Rolling first-fourteen-day nothingSports trust-pilot readout.
-- Run as a Supabase project administrator. product_events has no authenticated SELECT grant.

with pilot_bounds as (
  select min(occurred_at) filter (
    where event_name = 'opportunity_exposed'
      and properties ->> 'pilotVersion' = 'trust-pilot.v1'
  ) as pilot_started_at
  from public.product_events
), bounds as (
  select
    pilot_started_at,
    least(now(), pilot_started_at + interval '14 days') as pilot_ended_at,
    pilot_started_at + interval '14 days' <= now() as pilot_complete
  from pilot_bounds
), window_events as (
  select event.*
  from public.product_events event
  cross join bounds
  where bounds.pilot_started_at is not null
    and event.occurred_at >= bounds.pilot_started_at
    and event.occurred_at < bounds.pilot_started_at + interval '14 days'
), pulse_ranked as (
  select
    event.*,
    date_trunc('week', event.occurred_at at time zone 'Australia/Sydney')::date as week_start,
    row_number() over (
      partition by event.user_id, date_trunc('week', event.occurred_at at time zone 'Australia/Sydney')::date
      order by event.occurred_at desc, event.id desc
    ) as pulse_rank
  from window_events event
  where event.event_name = 'weekly_pulse'
), pulse_answers as (
  select *
  from pulse_ranked
  where pulse_rank = 1
), latest_cohort as (
  select distinct on (user_id)
    user_id,
    case
      when properties ->> 'pilotCohort' in ('curator', 'hybrid', 'completist')
        then properties ->> 'pilotCohort'
      else 'unclassified'
    end as cohort
  from pulse_answers
  order by user_id, occurred_at desc, id desc
), user_metrics as (
  select
    event.user_id,
    coalesce(latest_cohort.cohort, 'unclassified') as cohort,
    bool_or(event.event_name = 'opportunity_exposed') as had_opportunity,
    bool_or(event.event_name in ('fixture_check', 'watch_decision')) as made_decision,
    bool_or(event.event_name = 'fixture_check') as checked_full_fixtures,
    count(*) filter (where event.event_name = 'opportunity_exposed') as opportunity_exposures,
    count(*) filter (
      where event.event_name in ('fixture_check', 'watch_decision')
        or (event.event_name = 'swipe' and event.properties ->> 'direction' = 'positive')
        or (event.event_name = 'rating' and (
          event.properties ->> 'action' = 'rated'
          or event.properties ? 'score'
        ))
    ) as meaningful_actions,
    count(*) filter (
      where (event.event_name = 'tune_prompt' and event.properties ->> 'action' = 'shown')
        or (event.event_name = 'rating' and event.properties ->> 'action' = 'shown')
    ) as prompts_shown,
    count(*) filter (
      where (event.event_name = 'tune_prompt' and event.properties ->> 'action' = 'dismissed')
        or (event.event_name = 'rating' and event.properties ->> 'action' = 'dismissed')
    ) as prompts_dismissed,
    count(*) filter (
      where event.event_name = 'rating' and event.properties ->> 'action' = 'shown'
    ) as rating_prompts_shown,
    count(*) filter (
      where event.event_name = 'rating'
        and event.surface = 'curated_feed'
        and (
        event.properties ->> 'action' = 'rated'
        or event.properties ? 'score'
      )
    ) as ratings_completed
  from window_events event
  left join latest_cohort using (user_id)
  group by event.user_id, coalesce(latest_cohort.cohort, 'unclassified')
), cohort_names as (
  select cohort
  from (values ('all'), ('curator'), ('hybrid'), ('completist'), ('unclassified')) cohorts(cohort)
), behaviour_by_cohort as (
  select
    cohort_names.cohort,
    count(*) filter (where user_metrics.had_opportunity) as exposed_users,
    count(*) filter (where user_metrics.had_opportunity and user_metrics.made_decision) as decision_users,
    count(*) filter (where user_metrics.had_opportunity and user_metrics.checked_full_fixtures) as fixture_check_users,
    coalesce(sum(user_metrics.opportunity_exposures), 0) as opportunity_exposures,
    coalesce(sum(user_metrics.meaningful_actions), 0) as meaningful_actions,
    coalesce(sum(user_metrics.prompts_shown), 0) as prompts_shown,
    coalesce(sum(user_metrics.prompts_dismissed), 0) as prompts_dismissed,
    coalesce(sum(user_metrics.rating_prompts_shown), 0) as rating_prompts_shown,
    coalesce(sum(user_metrics.ratings_completed), 0) as ratings_completed
  from cohort_names
  left join user_metrics
    on cohort_names.cohort = 'all' or cohort_names.cohort = user_metrics.cohort
  group by cohort_names.cohort
), pulse_with_cohort as (
  select
    pulse_answers.*,
    coalesce(latest_cohort.cohort, 'unclassified') as cohort
  from pulse_answers
  left join latest_cohort using (user_id)
), pulse_by_cohort as (
  select
    cohort_names.cohort,
    count(distinct pulse_with_cohort.user_id) as pulse_users,
    count(pulse_with_cohort.id) as pulse_responses,
    count(*) filter (where pulse_with_cohort.properties ->> 'crossCheck' = 'multiple') as multiple_cross_checks,
    count(*) filter (where pulse_with_cohort.properties ->> 'missedFixtures' in ('one', 'multiple')) as missed_fixtures,
    count(*) filter (where pulse_with_cohort.properties ->> 'feedClutter' = 'about_right') as about_right_feed,
    count(*) filter (where pulse_with_cohort.properties ->> 'trustConfidence' in ('medium', 'high')) as positive_trust
  from cohort_names
  left join pulse_with_cohort
    on cohort_names.cohort = 'all' or cohort_names.cohort = pulse_with_cohort.cohort
  group by cohort_names.cohort
)
select
  bounds.pilot_started_at,
  bounds.pilot_ended_at,
  coalesce(floor(extract(epoch from (bounds.pilot_ended_at - bounds.pilot_started_at)) / 86400), 0)::integer as days_observed,
  coalesce(bounds.pilot_complete, false) as pilot_complete,
  behaviour.cohort,
  behaviour.exposed_users,
  pulse.pulse_users,
  round(100.0 * behaviour.decision_users / nullif(behaviour.exposed_users, 0), 1) as tsdr_percent,
  round(100.0 * behaviour.fixture_check_users / nullif(behaviour.exposed_users, 0), 1) as full_fixture_adoption_percent,
  round(100.0 * pulse.multiple_cross_checks / nullif(pulse.pulse_responses, 0), 1) as multiple_cross_check_percent,
  round(100.0 * pulse.missed_fixtures / nullif(pulse.pulse_responses, 0), 1) as missed_fixture_percent,
  round(100.0 * pulse.about_right_feed / nullif(pulse.pulse_responses, 0), 1) as about_right_feed_percent,
  round(100.0 * pulse.positive_trust / nullif(pulse.pulse_responses, 0), 1) as positive_trust_percent,
  round(100.0 * behaviour.meaningful_actions / nullif(behaviour.opportunity_exposures, 0), 1) as meaningful_action_rate_percent,
  round(100.0 * behaviour.prompts_dismissed / nullif(behaviour.prompts_shown, 0), 1) as prompt_dismissal_percent,
  round(100.0 * behaviour.ratings_completed / nullif(behaviour.rating_prompts_shown, 0), 1) as spectacle_rating_completion_percent
from behaviour_by_cohort behaviour
join pulse_by_cohort pulse using (cohort)
cross join bounds
order by case behaviour.cohort
  when 'all' then 0
  when 'curator' then 1
  when 'hybrid' then 2
  when 'completist' then 3
  else 4
end;
