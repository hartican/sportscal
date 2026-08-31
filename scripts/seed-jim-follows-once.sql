-- One-off, idempotent union of Jack's saved follows into Jim's account.
-- Existing Jim choices win; this never removes or downgrades one of his follows.
with source as (
  select preferences
  from public.nothingsports_user_state
  where user_id = 'a6440949-336f-499a-8568-77f7d5b03c52'::uuid
), target as (
  select user_id, preferences,
    coalesce(preferences->'preferenceGraph'->>'profileId', 'profile:28e3ae22-8db7-4774-af24-b5113910492a') as profile_id
  from public.nothingsports_user_state
  where user_id = '20684f39-f18d-472e-9258-fc3bdb7dca4e'::uuid
  for update
), entities as (
  select coalesce(jsonb_agg(entity order by participant_id), '[]'::jsonb) value
  from (
    select distinct on (participant_id) participant_id, entity
    from (
      select item->>'participantId' participant_id, item entity, 0 priority
      from target, lateral jsonb_array_elements(coalesce(target.preferences->'preferenceGraph'->'entityFollows','[]'::jsonb)) item
      union all
      select item->>'participantId', jsonb_set(item, '{profileId}', to_jsonb(target.profile_id), true), 1
      from source, target, lateral jsonb_array_elements(coalesce(source.preferences->'preferenceGraph'->'entityFollows','[]'::jsonb)) item
    ) candidates where participant_id is not null
    order by participant_id, priority
  ) unique_entities
), sports as (
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) value from (
    select distinct value from (
      select jsonb_array_elements_text(coalesce(target.preferences->'followedSports','[]'::jsonb)) value from target
      union all select jsonb_array_elements_text(coalesce(source.preferences->'followedSports','[]'::jsonb)) from source
    ) all_values
  ) unique_values
), selectors as (
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) value from (
    select distinct value from (
      select jsonb_array_elements_text(coalesce(target.preferences->'selectedSelectorEntityIds','[]'::jsonb)) value from target
      union all select jsonb_array_elements_text(coalesce(source.preferences->'selectedSelectorEntityIds','[]'::jsonb)) from source
    ) all_values
  ) unique_values
), event_families as (
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) value from (
    select distinct value from (
      select jsonb_array_elements_text(coalesce(target.preferences->'followFirst'->'followedMajorEventIds','[]'::jsonb)) value from target
      union all select jsonb_array_elements_text(coalesce(source.preferences->'followFirst'->'followedMajorEventIds','[]'::jsonb)) from source
    ) all_values
  ) unique_values
), collections as (
  select coalesce(jsonb_agg(value order by value), '[]'::jsonb) value from (
    select distinct value from (
      select jsonb_array_elements_text(coalesce(target.preferences->'followFirst'->'collectionFollows','[]'::jsonb)) value from target
      union all select jsonb_array_elements_text(coalesce(source.preferences->'followFirst'->'collectionFollows','[]'::jsonb)) from source
    ) all_values
  ) unique_values
), patched as (
  select target.user_id,
    jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
      target.preferences,
      '{preferenceGraph,entityFollows}', entities.value, true),
      '{followedSports}', sports.value, true),
      '{selectedSelectorEntityIds}', selectors.value, true),
      '{followFirst,followedMajorEventIds}', event_families.value, true),
      '{followFirst,collectionFollows}', collections.value, true) preferences
  from target, entities, sports, selectors, event_families, collections
)
update public.nothingsports_user_state state
set preferences = patched.preferences,
    updated_at = now()
from patched
where state.user_id = patched.user_id;
