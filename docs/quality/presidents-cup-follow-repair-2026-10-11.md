# Presidents Cup Follow repair — 11 October 2026 Sydney

The fourth full update passed the repaired completed-card reconciliation, then caught a genuine Follow regression. A Golf follower could lose the Presidents Cup overview. This module restores the already approved scope, retains exclusions and prepares the smallest clean app release. It does not publish the failed sports-refresh batch or certify Golf/Football.

## Verified cause and behaviour

[Full owner run 38088370081](https://github.com/hartican/sportscal/actions/runs/38088370081), input `948b23de86afa2342db7e22aeae34d886dd8adac`, failed `validate-card-coverage-corrections.js` before publication. The exact local check reproduces it. The [25 September decision](../follow-decisions.md) explicitly admits the Cup overview through a Golf follow; a direct Cup follow additionally admits sourced competitive sessions. The later tracked-golfer decision retains this scope.

Both the browser evaluator and server enrichment sent every multi-day marker through tennis admission, including a recognised Cup overview. The overview is a valid golf exception, with published source facts, and is not a tennis parent. Preferences still contain the Golf selection. Narrowly exempting that recognised Cup parent restores the existing Cup-specific evaluator; all other generic marker routing is unchanged.

The original regression then revealed that an explicitly saved competitive Cup child could survive a Cup exclusion. The shared exclusion policy previously applied family exclusions only to aggregate overviews. It now also applies them to recognised Cup competitive children. Existing source eligibility, active-timeline, dismissal/archive and explicit exclusion checks remain before server saved-card admission. No sporting fact, clock, source, identity, opt-in or notification is created or changed.

The module changes the two admission surfaces and the shared exclusion predicate, extends the existing regression, and regenerates the runtime with aligned shell/cache 485. The runtime is 548,541 bytes across the existing 65 modules. Sports data remains identical to the last approved app; the earlier completed-editorial writer repair is published source for the next canonical refresh, not newly refreshed sporting data in this app release.

## Verification and limits

- Red at the original Golf-overview assertion; intermediate checks independently expose the server route and exclusion-over-saved-child defect. Final original/extended regression passes, without removing an assertion.
- Follow decision, browser/server policy parity, authenticated server-feed and tracked-golfer scope checks pass. The server-feed checks retain sourced finals, missing-observation handling and original clocks; these controlled checks are not actual customer writes.
- Runtime generation, aligned app-version and static shell/cache checks pass. The initially guessed validator filename did not exist; the actual app-update/generated-shell validators were then executed and passed. No failed gate was treated as success.
- Existing full installed-app upgrade rehearsals pass in Chromium/WebKit from exact production 4a37b6ab/cache 484 to candidate 485, including already-open-page migration and the existing saved-choice, offline and recovery controls. Their first observation of cached 484 before migration is expected; they prove the completed transition, not an immediate first-launch version or physical phone.
- Four separate cached-reader cases in Chromium/WebKit verify the actual compiled runtime, exact cached runtime bytes, Golf overview/direct-session boundaries, exclusion precedence, unchanged fixture input and unchanged saved choices, both with the local server available and returning 503. The first private harness incorrectly looked for a standalone Follow script; the actual contracts are inside the generated runtime, and that mounted/cached artifact is now verified. This is not a source outage observation, installed-upgrade substitute, signed-in hosted account, playback or phone proof.

## Acceptance and recommendation

Business value: restore dependable Golf/Cup following and make “exclude this event” reliable for saved Cup cards, while unblocking a legitimate full update. Evidence and confidence: high for the deterministic faults, approved rule and tested local correction. Effort: two bounded routing guards, shared exclusion predicate, regression and generated shell; no owner checklist. Dependencies: existing sourced Cup fixtures, shared eligibility/retention and normal production gates. New cash commitment A$0; existing assistant and hosting costs remain unpriced. No new subscription, competition, source call, scheduler, retry, migration or customer write.

Publish and deploy only this passing clean app snapshot through the normal owner, verify its exact SHA, READY state, aliases, sealed artifacts and affected hosted reader. Then preflight remaining full-specific checks together before another provider pass. A recovered full owner and later ordinary overnight publication remain open. Preserve the four failed refresh identities and their source exceptions. The independently verified European table checkpoint and 0/17-family / 0/3-Football approval counts remain unchanged.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ordinary-full-refresh-20261011/coverage-contract-*.log`, `coverage-contract-probes.json`, `cup-*.log`, `cup-cached-browser.json` and `editorial-full-owner-final.json`. Production evidence will be saved in `cup-follow-live/`.
