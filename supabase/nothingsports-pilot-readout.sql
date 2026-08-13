-- On-demand nothingSports measurement readout.
-- Run as a Supabase project administrator. product_events has no authenticated SELECT grant.

with measurement_events as (
  select event.*
  from public.product_events event
), pulse_ranked as (
  select
    event.*,
    coalesce(nullif(event.properties ->> 'surveyVersion', ''), 'weekly-pulse.v1') as survey_version,
    row_number() over (
      partition by event.user_id, coalesce(nullif(event.properties ->> 'surveyVersion', ''), 'weekly-pulse.v1')
      order by event.occurred_at desc, event.id desc
    ) as pulse_rank
  from measurement_events event
  where event.event_name = 'weekly_pulse'
), pulse_answers as (
  select *
  from pulse_ranked
  where pulse_rank = 1
), survey_versions as (
  select distinct survey_version from pulse_answers
  union
  select 'weekly-pulse.v1'
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
), user_week as (
  select
    event.user_id,
    date_trunc('week', event.occurred_at at time zone 'Australia/Sydney')::date as week_start,
    bool_or(event.event_name = 'opportunity_exposed') as had_opportunity,
    bool_or(event.event_name in ('fixture_check', 'watch_decision')) as made_decision
  from measurement_events event
  where event.event_name in ('opportunity_exposed', 'fixture_check', 'watch_decision')
  group by event.user_id, date_trunc('week', event.occurred_at at time zone 'Australia/Sydney')::date
), weekly_tsdr as (
  select jsonb_agg(jsonb_build_object(
    'weekStart', week_start,
    'denominator', denominator,
    'numerator', numerator,
    'tsdrPercent', round(100.0 * numerator / nullif(denominator, 0), 1)
  ) order by week_start) as values
  from (
    select
      week_start,
      count(*) filter (where had_opportunity) as denominator,
      count(*) filter (where had_opportunity and made_decision) as numerator
    from user_week
    group by week_start
  ) weekly
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
        or (event.event_name = 'rating' and (event.properties ->> 'action' = 'rated' or event.properties ? 'score'))
    ) as meaningful_actions,
    count(*) filter (
      where (event.event_name = 'tune_prompt' and event.properties ->> 'action' = 'shown')
        or (event.event_name = 'rating' and event.properties ->> 'action' = 'shown')
    ) as prompts_shown,
    count(*) filter (
      where (event.event_name = 'tune_prompt' and event.properties ->> 'action' = 'dismissed')
        or (event.event_name = 'rating' and event.properties ->> 'action' = 'dismissed')
    ) as prompts_dismissed,
    count(*) filter (where event.event_name = 'rating' and event.properties ->> 'action' = 'shown') as rating_prompts_shown,
    count(*) filter (
      where event.event_name = 'rating'
        and event.surface = 'curated_feed'
        and (event.properties ->> 'action' = 'rated' or event.properties ? 'score')
    ) as ratings_completed
  from measurement_events event
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
  left join user_metrics on cohort_names.cohort = 'all' or cohort_names.cohort = user_metrics.cohort
  group by cohort_names.cohort
), pulse_by_survey_and_cohort as (
  select
    survey_versions.survey_version,
    cohort_names.cohort,
    count(distinct pulse_answers.user_id) as pulse_users,
    count(pulse_answers.id) as pulse_responses,
    count(*) filter (where pulse_answers.properties ->> 'crossCheck' = 'multiple') as multiple_cross_checks,
    count(*) filter (where pulse_answers.properties ->> 'missedFixtures' in ('one', 'multiple')) as missed_fixtures,
    count(*) filter (where pulse_answers.properties ->> 'feedClutter' = 'about_right') as about_right_feed,
    count(*) filter (where pulse_answers.properties ->> 'trustConfidence' in ('medium', 'high')) as positive_trust
  from survey_versions
  cross join cohort_names
  left join pulse_answers
    on pulse_answers.survey_version = survey_versions.survey_version
    and (cohort_names.cohort = 'all' or cohort_names.cohort = coalesce((
      select latest_cohort.cohort from latest_cohort where latest_cohort.user_id = pulse_answers.user_id
    ), 'unclassified'))
  group by survey_versions.survey_version, cohort_names.cohort
), measurement_bounds as (
  select min(occurred_at) as measurement_started_at, now() as measurement_generated_at
  from measurement_events
), classified_events as (
  select
    event.*,
    coalesce(latest_cohort.cohort, 'unclassified') as cohort
  from measurement_events event
  left join latest_cohort using (user_id)
), discovery_by_cohort as (
  select
    cohort_names.cohort,
    count(*) filter (
      where event.event_name = 'opportunity_exposed'
        and event.properties ->> 'recommendationClass' = 'discovery'
    ) as discovery_exposures,
    count(*) filter (
      where event.event_name = 'feed_action'
        and event.properties ->> 'recommendationClass' = 'discovery'
        and event.properties ->> 'action' = 'open'
    ) as discovery_opens,
    count(*) filter (
      where event.event_name = 'feed_action'
        and event.properties ->> 'recommendationClass' = 'discovery'
        and event.properties ->> 'action' = 'save'
    ) as discovery_saves,
    count(*) filter (
      where event.event_name = 'feed_action'
        and event.properties ->> 'recommendationClass' = 'discovery'
        and event.properties ->> 'action' = 'reminder'
    ) as discovery_reminders,
    count(*) filter (
      where event.event_name = 'feed_action'
        and event.properties ->> 'recommendationClass' = 'discovery'
        and event.properties ->> 'action' = 'watched'
    ) as discovery_watch_throughs,
    count(*) filter (
      where (
        event.event_name = 'swipe'
        and event.properties ->> 'recommendationClass' = 'discovery'
        and event.properties ->> 'direction' = 'negative'
      ) or (
        event.event_name = 'preference_change'
        and event.properties ->> 'action' = 'unfollow'
      )
    ) as discovery_negative_actions,
    count(*) filter (
      where event.event_name = 'opportunity_exposed'
        and event.properties ->> 'coldStart' = 'true'
    ) as cold_start_exposures,
    count(distinct event.sport) filter (
      where event.event_name = 'opportunity_exposed'
        and event.properties ->> 'coldStart' = 'true'
        and event.sport is not null
    ) as cold_start_distinct_sports
  from cohort_names
  left join classified_events event
    on cohort_names.cohort = 'all' or cohort_names.cohort = event.cohort
  group by cohort_names.cohort
), discovery_exposure_by_sport as (
  select
    sport,
    count(*) as discovery_exposures
  from measurement_events
  where event_name = 'opportunity_exposed'
    and properties ->> 'recommendationClass' = 'discovery'
    and sport is not null
  group by sport
), negative_actions_by_sport as (
  select
    sport,
    count(*) as negative_actions
  from measurement_events
  where sport is not null
    and (
      (
        event_name = 'swipe'
        and properties ->> 'recommendationClass' = 'discovery'
        and properties ->> 'direction' = 'negative'
      ) or (
        event_name = 'preference_change'
        and properties ->> 'action' = 'unfollow'
      )
    )
  group by sport
), negative_feedback_by_sport as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'sport', negative.sport,
    'negativeActions', negative.negative_actions,
    'ratePercent', round(100.0 * negative.negative_actions / nullif(exposure.discovery_exposures, 0), 1)
  ) order by negative.negative_actions desc, negative.sport), '[]'::jsonb) as values
  from negative_actions_by_sport negative
  left join discovery_exposure_by_sport exposure using (sport)
), discovery_exposure_by_competition as (
  select
    competition_id,
    count(*) as discovery_exposures
  from measurement_events
  where event_name = 'opportunity_exposed'
    and properties ->> 'recommendationClass' = 'discovery'
    and competition_id is not null
  group by competition_id
), negative_actions_by_competition as (
  select
    competition_id,
    count(*) as negative_actions
  from measurement_events
  where competition_id is not null
    and (
      (
        event_name = 'swipe'
        and properties ->> 'recommendationClass' = 'discovery'
        and properties ->> 'direction' = 'negative'
      ) or (
        event_name = 'preference_change'
        and properties ->> 'action' = 'unfollow'
      )
    )
  group by competition_id
), negative_feedback_by_competition as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'competitionId', negative.competition_id,
    'negativeActions', negative.negative_actions,
    'ratePercent', round(100.0 * negative.negative_actions / nullif(exposure.discovery_exposures, 0), 1)
  ) order by negative.negative_actions desc, negative.competition_id), '[]'::jsonb) as values
  from negative_actions_by_competition negative
  left join discovery_exposure_by_competition exposure using (competition_id)
)
select
  bounds.measurement_started_at,
  bounds.measurement_generated_at,
  pulse.survey_version,
  behaviour.cohort,
  behaviour.exposed_users,
  pulse.pulse_users,
  coalesce(weekly_tsdr.values, '[]'::jsonb) as weekly_tsdr,
  round(100.0 * behaviour.decision_users / nullif(behaviour.exposed_users, 0), 1) as tsdr_percent,
  round(100.0 * behaviour.fixture_check_users / nullif(behaviour.exposed_users, 0), 1) as full_fixture_adoption_percent,
  round(100.0 * pulse.multiple_cross_checks / nullif(pulse.pulse_responses, 0), 1) as multiple_cross_check_percent,
  round(100.0 * pulse.missed_fixtures / nullif(pulse.pulse_responses, 0), 1) as missed_fixture_percent,
  round(100.0 * pulse.about_right_feed / nullif(pulse.pulse_responses, 0), 1) as about_right_feed_percent,
  round(100.0 * pulse.positive_trust / nullif(pulse.pulse_responses, 0), 1) as positive_trust_percent,
  round(100.0 * behaviour.meaningful_actions / nullif(behaviour.opportunity_exposures, 0), 1) as meaningful_action_rate_percent,
  round(100.0 * behaviour.prompts_dismissed / nullif(behaviour.prompts_shown, 0), 1) as prompt_dismissal_percent,
  round(100.0 * behaviour.ratings_completed / nullif(behaviour.rating_prompts_shown, 0), 1) as spectacle_rating_completion_percent,
  'active'::text as instrumentation_status,
  discovery.discovery_exposures,
  discovery.discovery_opens,
  discovery.discovery_saves,
  discovery.discovery_reminders,
  discovery.discovery_watch_throughs,
  discovery.discovery_negative_actions,
  discovery.cold_start_exposures,
  discovery.cold_start_distinct_sports,
  negative_feedback_by_sport.values as negative_feedback_by_sport,
  negative_feedback_by_competition.values as negative_feedback_by_competition
from behaviour_by_cohort behaviour
join pulse_by_survey_and_cohort pulse using (cohort)
join discovery_by_cohort discovery using (cohort)
cross join measurement_bounds bounds
cross join weekly_tsdr
cross join negative_feedback_by_sport
cross join negative_feedback_by_competition
order by pulse.survey_version, case behaviour.cohort
  when 'all' then 0
  when 'curator' then 1
  when 'hybrid' then 2
  when 'completist' then 3
  else 4
end;
