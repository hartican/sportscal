# NBA fixture actions use the same retained schedule as Follow

The reported case is Philadelphia 76ers v Chicago Bulls on 3 November 2026,
11:30 AEDT / 00:30 UTC, canonical ID `fixture:nba:0022600163`. Jack reported
temporarily unavailable ratings and an initial reminder toggle that subsequently
rolled back with a server-sync error. Reminder saving and delivery were not
confirmed by that initial toggle.

On exact live-606 source `64d70b2d`, the disposable regression reproduced a shared
lookup gap: the NBA fixture is already in the official Follow source and is used
by the Feed resolver, but the ratings server's complete `eventFor` lookup and the
reminder catalogue both omit it. The same test resolves an Australian Championship
fixture through the real browser's canonical ID, makes its disposable rating RPC,
and completes an acknowledged reminder with local intent and schedule records.
The NBA acknowledgement is explicitly unrun when its fixture is missing.

The correction includes the existing `data/follow-sources/official.v1.json` in
both action catalogues. Calendar deduplication still favours its earlier published
records. Reminder merging still favours the existing published/inspector records,
which follow the newly admitted official rows. Existing selected overlays and
normalisers remain responsible for source clocks, identities, precision and
status. No new source observation, provider, sport permission, inferred start or
result, scoring policy, account writer, schema or scheduler is introduced.

The first correction resolved both lookups and all 1,266 NBA identities but left
NBA reminder acknowledgement explicitly unrun: the raw official row omitted
`timePrecision`, and the existing overlay leaves base rows unnormalised. The
shared adapter now uses the existing Feed normaliser for the published UTC start,
without changing its value or source-observation clock. Explicit TBC/date-only/
unverified flags remain unknown. The regression requires actual supported timing
and all three final acknowledgement/rollback results; a skipped NBA save cannot
pass as complete.

The focused regression is registered in the existing
`validate-nothingscore-submissions.js` gate. It executes actual cold lookups,
API fixture resolution, rating-call metadata and the browser's optimistic/reminder
functions. It waits for the final acknowledgement: successful disposable saves
retain the toggle and intent/schedule records; an injected service failure rolls
the toggle back and leaves those stores empty. It also checks every retained
official NBA rating identity/participant/start, existing Australian participants
and kickoff, unknown identities, postponed/elapsed status and blocked reminder
precision/verification. RPC/storage are disposable local doubles, not hosted
database or physical-device proof.

Earlier test-control failures used an old Australian fixture alias, while the
browser submits `canonicalEventId`. A subsequent incomplete test package stopped
at a missing module. Those runs are retained as inconclusive/setup failures. The
closed-closure pre-fix run, which uses actual browser IDs for both games, is the
first demonstrated NBA lookup RED. Its full JSON fixture preserves parsed values,
array and object insertion order, with only whitespace encoding changed; JS
source is byte-identical to Git. This is semantic fixture proof, not a claim that
test JSON bytes are the production files.

Calendar subscriptions and shared canonical membership also consume the calendar
catalogue. RELEASE must assess those consumers and remaining normal gates on the
final candidate. The separate Tonga/Socceroos missing-fixture repairs remain with
UPDATE; their data and lazy-asset cache/version binding must be integrated without
overwriting either owner's changes. No source fix or local test establishes the
current private phone session, live SQL acknowledgement, reminder delivery, or
the cause of any additional service failure. Physical acceptance remains partial.
