# Value-free preference difference diagnostic — 24 October 2026

## Acceptance truth and recommendation

The actual iPhone retry on589/589 still reports `verify / preference_base_changed / guarded_hold`, pending receipt, incompatible base, matching owner/generation and no save response. The marker-only repair's hosted proof passed, but did not resolve this phone. The v1 record contains no field distinction, so it cannot establish whether the remaining mismatch is automatic state, normalization or a genuine newer preference. Do not exclude more fields or guess intent.

Add only a value-free difference summary to the existing explicitly copied diagnostic. Existing v1 fields/format and all sync decisions stay unchanged. No extra request, storage read/write, retry, endpoint, normalization/migration or preference projection rule is introduced. This is instrumentation for the next targeted diagnosis, not a sync-policy fix or customer recovery.

## Bounded source inventory

All app preference saves pass through `savePreferences` (index4098 at589), which normalizes and atomically saves local sections. Only the explicit deliberate Follow/settings path records an owned intent; non-view-only/non-deferred saves can queue the existing serial sync. View-only saves do not immediately queue, but their in-memory fields remain inputs to later payload construction.

| Source path/function at589 | Fields/family it can change | Meaning/limit |
| --- | --- | --- |
| loadPreferences / mergePreferences (3933–4095) | version, selector/taxonomy/sports, graph pointers/defaults, broadcasters, fantasy rollout/defaults, Feed, pilot/rating prompt normalization | Startup/local normalization; no new receipt. Preserve exact semantic comparison until evidence discriminates. |
| registerOpen / RATING_SYSTEM.startSession (4598–4605) | refinement open/session counters, rating session state | Existing named counters are already projected out; other state is not blanket ignored. |
| ensureDefaultPilotMeasurementParticipation (4639–4649), registerWeeklyPulseAppOpen (4685–4701) | pilot participationStartedAt and daily/survey promptState | Automatic writes share an object with actual measurement enabled/submission choices. No whole-object exclusion. |
| dismissWeeklyPulsePrompt / pulse form / measurement checkbox | pilot prompt dismissal, submitted survey marker, enabled/participation choice | Human decisions coexist with timing/bookkeeping. |
| hydrateUserMetaSeed (5197–5213) | startup metadata, sports/events/location and seed marker | Automatic hydration can also carry real choices. Only the already proven marker exclusion is in force. |
| recordCodeAffinity → recordCodeInteraction (8348), inspector open/expand callers | followFirst.codeInteractions | Interaction affinity is persisted and compared; its exact causal field must be observed before changing comparison. |
| ensureFollowCollectionDirectories → freezeCollections (12153–12170) | collection representation and derived entity follows | Automatic representation conversion; no guessed additions/removals are authorised here. |
| startup tune prompt (17736–17742), delayed swipe prompt | refinement.promptedAt | Already excluded. Explicit deferred/completed refinements remain compared. |
| curated swipe/undo (9640–9800) | feedback, graph learning, coaching, first-swipe/prompt bookkeeping | Actual feedback/learning choices mixed with automatic timing. |
| granted automatic geolocation watch (17884–17902) | followFirst.location and startupMeta location/hash | Automatic location refresh; manual mode/location and consent are real choices. No coordinates copied. |
| explicit Feed, standings, subscriptions, onboarding and Follow/settings controls | genuine preferences across their named families | Keep existing protection, including OFF/empty/unfollow and unknown fields. |
| currentServerStatePayload / setServerStateBaseline / applyServerState / bootstrap | merges accepted baseline with current prefs, normalizes account hydration, retains local browse/compact, reuses original receipt on hold | Existing owner/generation/CAS and exact base logic remain; a latest app baseline can coexist with an older pending receipt. |
| user-state GET/PUT and server sanitizer | raw row read, existing conditional patch, server sanitization/coverage normalization, narrow marker safeguard | No backend change in this diagnostic. |

Line numbers are source pointers, not a claim about which path ran on the phone. The same fixed category can contain automatic and deliberate state. Unknown fields remain unknown; the diagnostic never decides which side to retain.

## Copied schema and ownership

The additive `preferenceDifferences` field is null when unavailable, otherwise:

- `baseToRemote`: fixed families differing between the attempt receipt's accepted preference base and the returned same-owner preferences.
- `localEdits`: fixed families differing between that base and that attempt's recorded local snapshot.
- `localToRemote`: direct recorded-snapshot/remote differences; this is not the result of applying the intent patch or a conflict/merge decision.
- `receiptBaseMatchesAccepted`: boolean only when the existing app baseline belongs to the same captured account/generation, otherwise null.

Names are selected only from the code-owned category list: format, appearance, selection, viewing, location, fantasy, feed, standings, coaching, onboarding, measurement, ratingPrompt, localView, bookkeeping, entities, domains, competitions, learning, metadata, internationalFilters, eventDecisions, collections, activity, subscriptions, notifications, refinement, feedback and unknown. Arbitrary paths/keys, IDs, counts, values, hashes, timestamps or raw errors cannot enter this field. Existing public shell/worker/timing fields remain as before.

Partition comparisons use the existing PROFILE_STORAGE preference-decision comparator, so its named bookkeeping exclusions remain exact; no second exclusion policy is invented. Empty/unmapped shape differences receive the fixed unknown bucket. Output is rebuilt and filtered in fixed category order, including malicious/unrecognized category inputs; raw input objects are neither mutated nor retained by the recorder.

The two existing verify hooks pass their exact original receipt as one additional synchronous diagnostic argument. This avoids extra storage reads and avoids accidentally reporting a newer R2 while the guard verifies R1. Wrong-owner payloads are never classified. Only the safe summary is retained in the existing one-attempt in-memory record; account/attempt/lifetime and clipboard-completion fencing remain. Copy still requires the existing deliberate button. No new UI or telemetry.

## Evidence and release boundary

The actual-seam test is RED using the served589 v1 diagnostic/helper: an automatic affinity update and a genuine theme change both reach the same guarded hold with no distinguishing summary. The new summary separates those families while preserving actual error, branch, calls, device state and exact receipt bytes. Further tests cover ignored metadata, unknown fields/shapes, sentinel keys/values, prototype-shaped keys, R1 versus a newly recorded R2, wrong-owner suppression, recorder sanitization and explicit-copy behavior.

The existing account-awareness release command runs this test through the existing diagnostic suite; no workflow command is removed. Prior15 sync equivalence,2 actual persisted-byte,6 delayed clipboard/lifetime, bounded-read and privacy controls remain. Node24.21 generated helper, startup/precache and critical budget evidence accompany the handover. Shared seams: two optional index verify hooks, existing deferred diagnostic/helper/runtime and matching5715 cache URLs. Worker leaves shell589 for ROOT's allocation and exact combined measurement.

ROOT owns the one final Spec/Standards pair, final release gates and publication. No worker browser/native/DB/production operation, customer state query/write, source job, account reset/restoration, storage clearing, sign-out, guessed follows, automation or restart. Do not repeat the phone request until the useful diagnostic is deployed. The actual phone issue and native/Feed acceptance remain open.
