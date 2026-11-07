# Remaining match-loading delay — 16 October 2026

The owner's iPhone buttons feel quicker after reopening. This confirms the perceived button improvement; the separate intermittent first Match Centre lookup remains open.

Two bounded read-only probes succeeded on the unchanged live reader. The first public request completed in 2,975 ms with healthy membership and no currently displayed matches. A separate call through the actual store returned 45 sources and 186 candidate fixture rows in 2,947 ms. Candidate rows are not the visible match count. Neither success erases the earlier failed three-second reads, and neither establishes a cold-server or physical-phone timing.

Selected Supabase edge logs attribute 2,011 ms to the public request's near-fixture reader, compared with 122 ms for source health. The separate store probe reports 1,742 ms and 27 ms respectively. The useful next investigation is the near reader's selection work. Making requests sequential, shrinking the visible response or optimising the already fast parser has no demonstrated benefit here. Local body transfer adds time but is not a Vercel measurement.

The reader remains MD5 `d98d88497311a8d06a31556004df30a2`, SQL/STABLE/SECURITY INVOKER, empty search path and service-only. No database definition, fact, deadline, retry, scheduler, account or provider operation changed in this diagnostic. The larger personal/history reader stays off. Previously rejected experiments remain rejected; no reliable new speed gain is claimed.

**Next acceptance:** a bounded selection prototype must retain complete output, identity closure, protected rows, original clocks, invalid/missing-data fallback, role denial and existing limits before an actual full-response cloud trial. Local/warmed/inline timings alone cannot authorise adoption. Stop an experiment that has no useful causal gain rather than extending the deadline or retrying until green.

**Value:** isolates the remaining wait without risking match accuracy. **New cash:** A$0 committed; assistant/runtime cost unpriced. **Owner burden:** no new routine or decision. **Status:** investigation narrowed, fix still open. App remains 55417c31/shell 549 during this diagnostic.

Runnable probes, responses and selected edge timings are saved in `/Users/jackhartican/Documents/AI/Codex/match-loading-boundary-20261016`. This is bounded sampling of two requests, not a latency percentile, whole-sport or physical-device certificate.
