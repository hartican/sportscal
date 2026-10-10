# Full refresh: loading check repair — 11 October 2026 Sydney

The first full owner check after the WRC rollover repair stopped before publication. The last approved production snapshot remains `b48abc2f710f93c9b6c8a3578a050a3f83ab0110` at this observation. The follow-on module repairs stale release checks and synchronises support-page stylesheet URLs with the existing cached stylesheet. The application cache moves from 483 to 484 for those changed HTML pages; runtime bytes, sports facts, user choices, source deadlines, scheduler and service subscriptions remain unchanged.

## Verified cause and local proof

[Full owner run 38084769538](https://github.com/hartican/sportscal/actions/runs/38084769538) failed at `validate-loading-progress.js`: “Loading Schedule must use the shared loading ring”. The indicator call is already in the deferred `assets/js/fixture-navigation.js` module, mounted through `routeFixture` and present in the versioned offline shell. The old check searched `index.html` alone. Running the unchanged check locally reproduced the same error.

The check now reads that actual mounted module as well as the HTML. It requires the application loader, dispatch call, exact worker URL and valid module syntax. Existing loading milestones, accessibility, delay, minimum visibility and offline requirements remain mandatory. No assertion or loading surface is removed.

The repaired check passes. A private mutation rehearsal rejects five genuinely broken cases: absent Schedule indicator, missing loader, missing offline URL, absent dispatch and invalid module syntax. Source files remain unchanged by that rehearsal. The current-score placement regression also passes. This evidence is local validation, not a recovered full owner run or physical-device proof.

## Source exceptions from the failed full run

The full source phase completed with retained data and reported gaps, before the shared loading check stopped it. It reported two failed coverage sources, six partial sources and fourteen unresolved date/page gaps. Two LPGA pairing pages returned 404; the FIA WRC standings request timed out and kept its previous validated context. The two degraded EPL messages occurred during controlled backup regressions; the real invocation report recorded zero backup calls and UCL primary use. Those test messages do not establish an actual EPL outage. These are separate from the false loading failure and must remain visible in the existing source exception reports. Do not renew unchanged fact dates or call these sources healthy.

## Follow-on full-owner failure and combined repair

[Full owner run 38085443517](https://github.com/hartican/sportscal/actions/runs/38085443517) passed the repaired loading check and stopped before publication at the old major-event marker assertion in `validate-fixtures-contract.js`. The native Events button is in the current shared tournament-marker builder. Its regression now executes the actual major-event and tournament builders, verifies native button type and calls each handler to check its exact destination and route type. No navigation requirement is removed.

Before another provider pass, eleven affected downstream UI contracts were inspected and exercised together. Eight failed on current code: a missing admission stub in the schedule-cache rehearsal; an unmodelled existing recent-day NFL source in its full-builder mock; the newly supported tournament deep-link type; accessible viewing labels now including costs; the already published Baseball catalogue/directory addition; and a calendar test still inferring live play from an elapsed clock. Their checks now match those already approved contracts. Fresh source-confirmed overnight play is required by the calendar scenario; stale unresolved play remains available without claiming fresh live play, and explicit completion closes it. All eleven pass together after repair. Existing source, identity, spoiler, consent and layout requirements remain.

The foundation check found six support pages still pointing at stylesheet version 424 while the cold-install cache holds version 463. Their URLs now match the already bundled stylesheet. A cached-page rehearsal reproduces missing styles on the original Privacy and Terms pages and verifies the repaired pages in Chromium and WebKit when every server request returns 503: eight before/after cases. The first harness incorrectly received the app fallback for an uncached optional admin page; it was narrowed to the actual precached public pages and now verifies page identity. A separate Chromium offline-mode pass confirms both public-page failures and repairs. WebKit offline navigation raised an internal browser error; the server-unavailable rehearsal is separate evidence, not a claim that this exact WebKit offline navigation passed.

Both existing full installed-app upgrade rehearsals pass from exact production `b48abc2f` / cache 483 to candidate 484, preserving fonts, participant calendars, source observations, source-confirmed status, results privacy and reminder OFF. That does not explain or close the previously recorded 482→483 Chromium stall or prove a physical phone. Runtime bytes remain unchanged. Existing shell/cache validation passes. New subscriptions, schedules, source retries, data migrations and customer writes: none.

## Next and limits

Publish the scoped check repair, then invoke the existing canonical full owner once with `quick=false`. It must pass the unchanged remaining card and production release gates before publishing and deploying its exact snapshot. A later ordinary scheduled run remains separate evidence; manual success does not prove it. No new retry, schedule, deletion or profile-picture maintenance is introduced.

Business value: unblock legitimate updates while continuing to reject a missing or broken loading path. New cash commitment: A$0; existing assistant/hosting costs are unpriced. Owner routine: unchanged. Effort: loading and affected current-contract test corrections, plus six support-page URL changes and the required cache-version alignment. Acceptance: local red/green and mutation proof, recovered full owner, normal release result and exact production verification. Whole Football and cross-sport certification remain open.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ordinary-full-refresh-20261011/` contains the complete failed owner log, run identity, source-report artifact, red/green output and mutation result. Browser and physical-phone evidence remain distinct.
