# Match Centre first-open repair — 9 October 2026

The first opening of Everything sometimes waits several seconds. Fresh-browser traces measured 4.9–6.4 seconds, mostly waiting for the server; a later cached visit took about 0.3 seconds. Server cold starts were not controlled. The small local catalogue-loading prototype saved only about thirty milliseconds and was rejected.

The scoped repair uses already-projected fresh score/status observations after assembling the local fallback. The initial overlapping-read version passed release gates but failed fresh public membership checks, returning only two saved cards. Withdraw that ordering conservatively; the exact cause remains unconfirmed, and the corrected single-RPC check returned a complete 2,136-row, 5.94 MB bundle within its 2.5-second statement limit. The earlier aggregate diagnostic could repeat its RPC and cannot establish single-query latency. Missing or old information still gets the same bounded selected check. A separately reviewed repair on main also makes new live-source matches remain readable when their scores are polled before the next daily catalogue update.

## Verified locally

- Actual database SQL, store and handler return identical compact scores, source sides, clocks and provenance through listing and selected polling. Fresh listing uses two parallel database reads with no duplicate score query; polling uses one selected read.
- Model regression covers source-only matches, aliases, unknown/unrequested rows, sixty-ID limits, lower-tier tennis exclusion, partial and failed reads, old/future/degraded snapshots, old or missing observation clocks, zero scores, paused/final states and restart-specific freshness.
- Both browser engines passed twelve combined phone/desktop, light/dark display cases, including hidden results, expansion, filtering and retained state. Pull-to-refresh and navigation checks are recorded separately.
- Existing sporting facts, catalogue, personal rules, reminders, schedules, browser assets and database schema are unchanged.

Publication, normal release and independent hosted evidence remain pending until the delivery receipt confirms them. Removing a duplicate request does not establish that every first opening meets a phone performance target. No whole-sport certification is claimed.

Detailed retained evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/public-catalogue-startup-20261009`.

The normal release now includes at most two public read-only functional checks after deployment proof: healthy Everything membership and a bounded selected-score read for the displayed identities. Empty quiet windows are valid. A degraded saved list cannot pass this gate. No source refresh, customer read, retry or credential is added; cold-server and phone performance remain separate.
