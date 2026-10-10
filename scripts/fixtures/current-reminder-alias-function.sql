CREATE OR REPLACE FUNCTION nothingsports_recovery.fixture_alias_v1(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select coalesce($aliases${"evt_87": "fixture:cricket:espn:1525659", "evt_88": "fixture:cricket:espn:1525660", "evt_89": "fixture:cricket:espn:1525661", "fixture-rugby-ra-949625": "rugby-australia-south-africa-2026-09-27", "fixture-rugby-ra-949627": "rugby-australia-new-zealand-2026-10-17", "fixture:rugby:ra:949625": "rugby-australia-south-africa-2026-09-27", "fixture:rugby:ra:949627": "rugby-australia-new-zealand-2026-10-17", "fixture:cricket:CA:40593": "fixture:cricket:espn:1525658", "fixture-cricket-espn-1525658": "fixture:cricket:espn:1525658", "fixture-cricket-espn-1525659": "fixture:cricket:espn:1525659", "fixture-cricket-espn-1525660": "fixture:cricket:espn:1525660", "fixture-cricket-espn-1525661": "fixture:cricket:espn:1525661", "fixture-rugby-wr-e3cbae12-66b3-4835-b1ce-4014b63055c8": "rugby-australia-new-zealand-2026-10-17", "fixture-rugby-wr-e826488f-b2e2-42f0-8649-1bafd6567945": "rugby-australia-south-africa-2026-09-27", "fixture:rugby:wr:ac4f516c-300d-4f4b-85ea-514f0be5ddf6": "rugby-new-zealand-australia-2026-10-10", "fixture:rugby:wr:e3cbae12-66b3-4835-b1ce-4014b63055c8": "rugby-australia-new-zealand-2026-10-17", "fixture:rugby:wr:e826488f-b2e2-42f0-8649-1bafd6567945": "rugby-australia-south-africa-2026-09-27"}$aliases$::jsonb->>value,value);
$function$

