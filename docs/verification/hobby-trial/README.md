# Sportscal Hobby optimisation and seven-day trial

Implementation date: 15 September 2026. No plan upgrade authorised or performed.

## Measurement baseline

The fixed-clock workload traverses the same 5,561-event catalogue for empty, mixed and tennis/football profiles on 15 September and either side of the October Sydney DST transition. It measures composition without the new response cache, so a cache hit is not being compared with an old full rebuild.

- Total warm CPU across nine cases: 76.2% lower. All nine complete response hashes match, including order, totals and editorial content.
- Cold module-load CPU: approximately unchanged (384 to 387 ms); wall time 538 to 334 ms. Local process RSS after the workload: 593 to 307 MiB. These are local measurements, not production billing or latency promises.
- Uploaded-source manifest: 125,033,694 to 94,239,418 bytes, a 24.6% reduction. The 40% target was not reached; required calendar datasets, fallback scripts and installed-PWA assets were retained.
- Traced feed function dependencies: 57,752,327 to 39,350,190 bytes, a 31.9% reduction. Sum across traced functions: 191,600,140 to 148,458,862 bytes (22.5%). These are uncompressed dependency traces, not Vercel's final stored/compressed bundle accounting. Existing optional `ws`/`supports-color` trace warnings are unchanged; every staged API module loads successfully.
- The accepted package-growth baseline is 94,300,000 bytes. Releases warn above 110%. Every retained source file is verified against its Git blob; safe JSON compaction is separately recorded by output SHA-256.

Detailed benchmark results and the initial deletion inventory are alongside this file. Full deployment manifests and release/cleanup results are retained as GitHub Actions artifacts for 14 days.

## Safeguards

- Saved Sportscal native retention: preview, cancelled and failed 1 day; production 7 days (the smallest preset above 72 hours), native keep-count 10.
- Custom cleanup enforces 72-hour production and 24-hour other thresholds after successful releases and every six hours. Live, one verified rollback, aliased deployments and active builds are excluded. Every deletion uses an explicit ID, with revalidation immediately before deletion and a production-target check after each batch of ten. An alias/production change aborts or excludes the candidate. External changes can still race API operations; deployment and cleanup jobs share one serialisation group.
- Initial inventory: 208 deployment records. Deleted 181 eligible records; preserved 27. This is not proof of reclaimed storage. No repository data was deleted. Deleted deploy URLs are no longer usable; retained Git commits can be redeployed, and platform recovery availability must be checked before promising restoration.
- All normal manual and canonical scheduled release entrypoints dispatch the same GitHub Actions production job. Same-SHA healthy production is a no-op; existing builds are awaited; verified READY builds are reused. Intentional rebuilds require the logged `rebuild` input. Git-triggered Vercel deployments remain disabled.
- Personalised cache: authenticated current state before lookup, deployment/data/live revision and pagination in key, 100 entries/32 MiB/30 seconds maximum, earlier event/lifecycle/day expiry, private responses and ETags. Client requests are coalesced and obsolete user/state/page responses rejected.

## Verification boundaries

Passing: feed correctness and Follow parity; cache authentication/isolation/expiry/eviction; duplicate client requests, ETags, failure retries and sign-out invalidation; authenticated startup; fixture API and backend budgets; staged dependency closure and API module loads.

Installed-PWA relaunch upgrade, later resume update, preference preservation, required-asset failure protection and offline fallback pass. A separate direct `registration.update()` test while the historical app remains open stalls with a waiting worker. No worker/update-coordinator logic was changed by this optimisation; this open-app path is not claimed verified. Actual device verification remains separate from a browser simulation.

Pre-existing baseline failures: the broad verifier's About wording assertion and the finals-live-overlay expected-count assertion. Both reproduce on the untouched baseline; this pass does not alter those product behaviours.

## Daily observations and decision

At 15 September pre-release recheck, last-30-day team usage was CPU 3h24m/4h (85.27%), deployment storage 15.68GB/10GB, invocations about49K. Sportscal accounted for CPU 3h22m (84.20% of team allowance), storage14.75GB and about48K invocations. Storage had not yet settled after deletion. These rolling totals do not reset on deployment.

Vercel automatically configures usage notifications; custom spend thresholds require Pro. Verify account delivery preferences separately. The daily Codex follow-up supplements these with 70%,85%,95% threshold warnings and projected exhaustion within seven days, suppressing repeated unchanged warnings. Sources: https://vercel.com/docs/pricing/manage-and-optimize-usage and https://vercel.com/docs/deployment-retention.

Record each day: observation time, usage window, team CPU/storage/invocations, Sportscal share, last24h CPU/invocations, error count, feed p50/p95 and sample size, release SHA, cleanup outcome and data freshness. Use actual daily windows, not differences between rolling30-day totals, which can fall as older usage expires. Mark inaccessible metrics unknown rather than zero. Export relevant short log windows immediately; never save tokens or personal feed bodies.

After seven days, remain on Hobby only if the measured rate projects below3 CPU-hours/30days, storage settles below7GB, duplicates stop and correctness/responsiveness pass. Review Pro sooner if projected exhaustion is within7days, storage remains near its limit after accounting settles or performance is unacceptable. Upgrading remains a separate decision. Do not spend another large optimisation pass merely chasing the unmet package-size target.
