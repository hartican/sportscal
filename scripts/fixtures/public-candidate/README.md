# Constructed NBL replay input

`nbl-public-input.json` is a constructed test projection rebuilt from the
retained165-game directory and table. It is neither a captured provider
response nor a new observation. Fixed replay clock: `2026-10-22T16:43:40.438Z`,
the retained directory's original observation.

SHA256: `205da7e9c1a7ac5c61834a327987606d6ef3623c49c1df041443bc6bc9784563`.

It exercises the existing parser and scoped canonical orchestration under
response substitution. It does not establish current standings or freshness.
Never promote its replay bundle or relabel it as fresh provider evidence.


# Retained coverage service-response input

`coverage-service-response.json` holds four public sporting rows extracted from
an already saved local qualification response (`b389c638...` in its metadata).
It is test input, not a new service/provider read or evidence of current data.
It includes the complete retained CA39991 innings, date-only World Rugby,
a completed Rugby score and a separately dated reviewed provider alias. All
source, sporting fact and original completion timestamps are unchanged.
The explicit23October replay clock is a test clock. The old alias observation
is deliberately stale at that clock; no refreshed observation is fabricated.
Constructed viewing/large-page variants exist only inside the temporary tests.
