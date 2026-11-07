# Onboarding directory repair, 7 November 2026

## Scope and release boundary

This isolated repair starts at `4bff7ada` (the version 611 Chat/Feed candidate).
The faulty onboarding source is byte-identical to accepted version 610 source
at `e339ecb6`. It does not modify the active overnight checkout, account data,
Follow policy, synchronization guards, sporting records, or any release workflow.
It is not deployed. Version 611 remains reserved to the existing release lane.
Before integrating this repair, the sole publisher must allocate a forward shell
version, regenerate its cache bindings, and run the full required release gates
and installed-app upgrade checks against that exact successor.

## Root cause and changes

- Cold onboarding used `NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam`
  before loading the deferred participant-directory helper. Team-bearing AFL,
  NRL, Cricket, Football, Tennis, F1, WRC and Rugby directories therefore threw
  a ReferenceError and were presented as a loading failure. The repair loads
  the existing helper alongside the requested directory, before classifying it.
- MotoGP contains 23 athletes and no team records, so short-circuit evaluation
  avoided the missing helper. Those riders were the lone working choices in the
  reported set. The heading now says teams and competitors; the existing
  individual-competitor explanation remains.
- Supercars is explicitly a schedule-only directory with no participant records.
  The UI now retains truthful schedule guidance without creating an empty search
  or claiming that a search found no matches. This does not invent or add a
  Supercars team/driver directory.
- The source journey test previously supplied an always-present classifier stub,
  masking the loading defect. It now starts without that helper and loads the
  actual module through the UI request. Ten actual published directory chunks,
  retry, newer-sport, dismissal, account-lifetime and unchanged-follow checks
  supplement the existing journey controls.

## Verification

Before the fix, the cold source test failed with zero supported team controls,
and the generated-app Chromium negative control failed at AFL on the first
onboarding visit. Both failures are retained in local, unpublished logs.

After the fix:

- Existing source journey suite passes, including its account preservation and
  conditional-save controls. New real-directory cases show AFL 18, NRL 23,
  Cricket 20, Football 40 initially, Tennis 8, F1 11, WRC 4, Supercars 0,
  MotoGP 23, and Rugby 40 initially. Longer lists retain Show more.
- The new generated-app browser test passes in Chromium and WebKit, at 390 and
  1280 pixels. Each starts cold, loads all ten choices, selects one AFL team,
  returns Back to sports and forward to teams, verifies the choice remains,
  tests a genuine no-match query, and completes to Feed. No uncaught errors or
  horizontal overflow. Every request is loopback-only; API mutations are
  recorded and fail the test. None occurred.
- Canonical optional-UI and app-shell build checks, shell cache binding,
  app-update version behavior, startup budget, Follow decisions and the source
  journey suite pass. Node 24.22.2 matches the existing release toolchain.
- The performance gate passes with its existing advisory notice: 450,073 gzip
  bytes against 426,115 baseline, 23,958-byte delta, 18,632 bytes above the 1.25%
  advisory buffer. No threshold or policy was changed. Node 25's different
  baseline compression initially failed policy matching; the Node 24 rerun is
  the relevant result, not a relaxed assertion.

## Limits

Desktop WebKit is not a physical iPhone acceptance test. Full release, hosted,
installed-upgrade and device proof remain with the publisher. The public live
version request was blocked by network policy, so this report makes no new live
state claim. Original attached image records were resolved, but their supported
local downloads failed; diagnosis is grounded in the reported symptoms, exact
source and reproduced browser behavior, not an asserted pixel inspection.
The separate `preference_base_changed` guarded hold is not changed or claimed
fixed by this onboarding repair.

Run the targeted browser control with the existing installed Playwright module:

    PLAYWRIGHT_MODULE=<installed-playwright> node scripts/validate-onboarding-directories-browser.js

It starts its own disposable loopback server and supports
`ONBOARDING_SOURCE_ROOT` for a read-only before/after source comparison.
