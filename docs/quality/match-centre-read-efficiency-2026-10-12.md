# Match Centre: less unnecessary data, complete current matches — 12 October 2026

**Status: locally checked; independent review, publication and live application pending.** The app remains shell 516. No new subscription or owner routine.

Match Centre was loading many calendars and old results that could never appear on its current screen. That makes it easier to hit the existing waiting limit and show a degraded list. This repair selects possible current matches first, then reads only their needed source observations. It keeps correction information, current scores and original dates. The shared display rules remain authoritative.

## Evidence and outcome

The existing public smoke failed twice with degraded membership after the storage repair. Production logs show the same three-second fixture-bundle timeout before that repair at 11:20 UTC and afterward at 11:39 UTC. An old read-only aggregate returned 1,313 rows /3,404,038 text bytes in 1,954.953 ms; another 2.5-second attempt timed out. A later diagnostic returned all five matches, so one warm success did not establish reliable loading.

A frozen public 11:54 UTC bundle, reconstructed with independent fact/verification dates in local PostgreSQL, compares the actual guarded replacement with the existing reader: 1,313 to 84 rows, 3,212,957 to 224,676 compact JSON bytes, about 93% less transfer. All five model-eligible matches remain in the same order; every retained projected row is identical. The reconstruction is separately labelled because the actual raw fixture/score split was not exported.

A read-only inline trial of the final proposed query on live PostgreSQL 17 returned 97 complete rows /290,020 text bytes in 1,224.947 ms under a 2.5-second diagnostic deadline. Different observation times, source activity and text/compact encoding mean these are not controlled causal latency comparisons. No application function was replaced or provider refresh forced for that measurement. Cold/concurrent/hosted and physical-device performance remain unproven.

## Boundaries

The same function/signature, caller rights and empty search path remain. Caller-known identities and aliases always survive for a reschedule, cancellation, missing clock or otherwise out-of-window correction. Newly source-announced current matches need no prior published ID. Effective compact score fields win when present; explicit null withdrawals stay null. Coarse transfer windows of 31/65 minutes leave the existing shared model's thirty-minute/one-hour admission rules unchanged. Play and pause states remain conservative even with old dates or missing clocks. Nonempty unsupported timestamp formats remain for the shared model to qualify; they establish no new time or final. Truly clockless calendars and new unknown-state rows remain available through the unchanged global and selected readers.

Only candidate sources' observation maps are decoded, once each. Returned fixture fields, scores including zero, source links, identities, aliases, dates, parent compaction and original observations remain. Two parallel membership reads, their three-second budgets, bounded selected score reads, complete sentinel, thirty-second scoped cache, last-good recovery and explicit degraded reporting remain. No timeout increase, silent partial result, provider call, source/account write, scheduler, retry, migration of customer state or cached-shell change.

## Checks

Twenty-two new actual-schema/function/store/handler cases run inside the existing current-fixture-bundle release validator, after retaining its prior global, selected, observer and legacy-equivalence cases. They reproduce the old excessive response with 1,200 irrelevant calendar rows and one current match, then check qualified transfer; actual source-only and selected-score paths; play/pause states; twenty-minute and offset starts; uncertainty and alternate ISO formats; known ID/alias corrections; new zero-score finals and independent completion evidence; score status/time overrides and null withdrawal; invalid dates; unchanged fields/fact clocks; cancelled published membership; quiet empty state; actual current overflow; excessive preservation IDs; denied public/allowed service roles; guard refusal/rollback; and restoring/reapplying the old reader without modifying current facts.

The actual CLI-created migration `20261012120600_qualify_match_centre_read_candidates.sql` binds to deployed digest `00ee9b223e92df9c7b34df1924a02697`, with two-second lock/eight-second migration deadlines. Node 24.19.0 /existing PGlite 0.5.8 runs the tests without new dependencies. Normal deployment already runs that validator; no duplicate scheduler/check owner is added. The old definition is saved and narrowly restorable; full off-device recovery remains parked.

## Value, cost and release acceptance

This targets reliable match discovery and less transfer/processing using the current stack. No cash commitment or recurring owner task; existing engineering/runner costs remain unpriced. Evidence supports this measured repair rather than a rewrite or bigger timeout. Acceptance still requires both independent source reviews, scoped GitHub publication, guarded production application, unchanged privileges, healthy complete hosted listing/selected reads and affected browser checks. Keep failed observations rather than retrying until green. No new application bytes means no app/PWA deployment is necessary; confirm the retained READY app separately. Whole-sport, Football, signed-in, physical-phone, repeat-use and normal scheduled-release proof remain separate.

Reports and detailed receipts: `/Users/jackhartican/Documents/AI/Codex/match-centre-read-efficiency-2026-10-12`. [Official database function guidance](https://supabase.com/docs/guides/database/functions).
