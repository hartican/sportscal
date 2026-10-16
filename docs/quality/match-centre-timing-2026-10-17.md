# Match Centre timing evidence — 17 October 2026

Status: private diagnostic preparation, not a loading fix or production deployment. Current accepted application is88d2e3b0/app558; documentation baseline87b8c23b. No database rewrite is proposed.

## Evidence and decision

One bounded read of existing logs on the exact558 deployment found the mandatory public GET /api/match-centre200 response. The previous /api/feed search did not include this route. The new route record contains no duration or application diagnostic, so neither proves fast loading nor absence of timeouts. No site, provider, match-reader or database request was generated.

The already-completed production workflow provides a5.082679-second envelope between the preceding verification report timestamp and the quiet-window Match Centre success log. It includes child startup/report output, HTTP, server work and client body parsing. It is not HTTP-only or a database/cold/phone measurement. The check returned zero fixtures and performed no selected-score read.

A fresh local Node24.21.0 process uses the complete current6417-record published catalogue and actual handler, with snapshot/score transport isolated. The first observation measured about0.81seconds total, including0.63seconds catalogue work and an extra diagnostic-only supported-count filter. It is not production equivalence or evidence that network/database latency caused the remaining wait. The initial observation is preserved.

Existing Feed timing is bypassed by the Match Centre route. Add phase timings in the existing public handler, then collect them from the existing mandatory release read. This obtains useful real request evidence with no extra endpoint call, polling, retry, provider quota, database write or owner routine. It does not claim a speed improvement.

## Required contract

- Preserve complete response bodies, status, cache headers, identity/selection, source/result/fact dates, privacy and last-good/degraded behaviour. Only the standard Server-Timing response header and bounded diagnostics are added.
- Measure catalogue preparation, membership preparation, awaited snapshot, merge, selection, selected score read and projection using a separate monotonic timer. Domain/fact clocks remain unchanged.
- Record only fixed phase names/numeric durations, constant route mode, fixture count and degraded flags. Never log query values, fixture/account IDs, source payloads, scores, sporting dates, credentials or error messages.
- Emit at most one additional handler diagnostic for a valid slow or degraded origin response; healthy totals below2000ms stay quiet. This is a logging threshold, not a response deadline or changed budget. Logging failure must not affect the response. Existing lower-level failure logging remains separate.
- Origin timing excludes platform startup, response encoding and network. Cached public replies may carry their earlier origin timings; neither these values nor a first route invocation certify cold database state.
- Keep the existing fifteen-second release observation deadline, two parallel three-second snapshot RPCs, selected sixty-ID batches, caches/fallbacks and one refresh owner. No SQL, migration, source, scheduler, customer state, reminder, setting or service change.
- The existing public release checker measures each of its already-authorised HTTP reads through body completion. Capture only the fixed numeric origin phases; ignore unrelated header fields. Retain membershipStale refusal, full displayed/selected identity and official-scorecard checks, and honest empty quiet-window acceptance. Missing required origin timing fails once without retry.

## Verification

The actual-handler diagnostic test failed before instrumentation and passes after it. It covers slow healthy/quiet healthy/degraded/selected states, zero scores, original clocks, no extra request, no private fields and unavailable logging. The existing29-handler-case replay produces byte-equivalent complete response bodies and existing headers before/after; Server-Timing is the sole header addition. The release checker test proves exactly one empty-window read or the existing membership+selected two reads, a closed numeric timing receipt and missing-header failure without retry. The existing Match Centre gate invokes these tests. Independent Spec review found that the release checker required snapshot timing but omitted required preparation/merge timings. A new individual-omission regression first reproduced that gap; the corrected checker now rejects each missing membership phase once, while selected reads require only their own phases.

Collect bounded independent source-review findings before freezing the expensive final pass. Then run affected/API/privacy/budget checks and the unchanged normal exact-SHA release. Browser/PWA assets are unchanged, so retain prior hash-bound558 update/offline and viewing proof; this does not renew physical-phone acceptance. Save actual release timing as an observation, not a universal improvement.

Evidence: /Users/jackhartican/Documents/AI/Codex/match-loading-observation-20261017. All failed/preparation observations are retained. No new purchase or recurring owner task. Loading remains open until actual evidence supports a repair and dependable behaviour.
