# Full refresh: loading check repair — 11 October 2026 Sydney

The first full owner check after the WRC rollover repair stopped before publication. The last approved production snapshot remains `b48abc2f710f93c9b6c8a3578a050a3f83ab0110` at this observation. This module repairs a stale release check; it changes no application code, sports facts, cache version, user choices, source deadlines, scheduler or service subscription.

## Verified cause and local proof

[Full owner run 38084769538](https://github.com/hartican/sportscal/actions/runs/38084769538) failed at `validate-loading-progress.js`: “Loading Schedule must use the shared loading ring”. The indicator call is already in the deferred `assets/js/fixture-navigation.js` module, mounted through `routeFixture` and present in the versioned offline shell. The old check searched `index.html` alone. Running the unchanged check locally reproduced the same error.

The check now reads that actual mounted module as well as the HTML. It requires the application loader, dispatch call, exact worker URL and valid module syntax. Existing loading milestones, accessibility, delay, minimum visibility and offline requirements remain mandatory. No assertion or loading surface is removed.

The repaired check passes. A private mutation rehearsal rejects five genuinely broken cases: absent Schedule indicator, missing loader, missing offline URL, absent dispatch and invalid module syntax. Source files remain unchanged by that rehearsal. The current-score placement regression also passes. This evidence is local validation, not a recovered full owner run or physical-device proof.

## Source exceptions from the failed full run

The full source phase completed with retained data and reported gaps, before the shared loading check stopped it. It reported two failed coverage sources, six partial sources and fourteen unresolved date/page gaps. Two LPGA pairing pages returned 404; the Premier League primary was degraded and the validated delayed backup retained facts; the FIA WRC standings request timed out and kept its previous validated context. These are separate from the false loading failure and must remain visible in the existing source exception reports. Do not renew unchanged fact dates or call these sources healthy.

## Next and limits

Publish the scoped check repair, then invoke the existing canonical full owner once with `quick=false`. It must pass the unchanged remaining card and production release gates before publishing and deploying its exact snapshot. A later ordinary scheduled run remains separate evidence; manual success does not prove it. No new retry, schedule, deletion or profile-picture maintenance is introduced.

Business value: unblock legitimate updates while continuing to reject a missing or broken loading path. New cash commitment: A$0; existing assistant/hosting costs are unpriced. Owner routine: unchanged. Effort: one small test correction. Acceptance: local red/green and mutation proof, recovered full owner, normal release result and exact production verification. Whole Football and cross-sport certification remain open.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ordinary-full-refresh-20261011/` contains the complete failed owner log, run identity, source-report artifact, red/green output and mutation result. Browser and physical-phone evidence remain distinct.
