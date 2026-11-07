# Full update: completed-card summaries — 11 October 2026 Sydney

The full update correctly stopped an old preview from being republished on a finished race. The independently checked screen/cache repair is already live at `4a37b6ab`; the rejected sports-data batch remains unpublished. This follow-on changes the shared editorial writer, with no new provider, polling, scheduler, data migration, credential or subscription.

## Cause and scope

[Canonical full run 38086695112](https://github.com/hartican/sportscal/actions/runs/38086695112) refused `events[992]` in its post-editorial AFL/NRL reconciliation because default copy violated the completed-result spoiler contract. The exact captured current projection reproduces the same error for `evt_motogp_2026_indonesia_sprint` at the same published index. Its retained pre-race research mentions a previously reached podium. The writer already builds safe spoiler-OFF Storyline copy, but overwrites `selectedSentence` and `fullSpiel` with the original preview. The cross-sport canonical validator correctly refuses that complete feed; this is not an AFL fixture failure or evidence of a wrong race result.

The shared writer now gives completed root summaries the same lifecycle-controlled copy as the spoiler-OFF card. It keeps the researched preview inside the narrative, retains valid reviewed recaps and source-backed result reveal, and invalidates old recap research after a genuine result correction. Unfinished cards retain their previews. No result regex or publication guard is weakened.

The existing editorial validator gains a deterministic regression before any dataset checks. It exercises completion with retained preview research, Results OFF/ON copy, source clocks, saved choices, reruns, input immutability, upcoming copy, a reviewed protected recap and a corrected result. Its old compatibility assertion incorrectly required every completed root to equal a pre-race hook; completed cards now have to match their protected Storyline hook and synopsis and pass the existing spoiler contract. Unfinished cards still have to publish their researched preview. No gate is bypassed.

## Local verification

- The smallest captured race reproduction and added completion regression failed before the fix. The captured race passes after it.
- A differential pass through the actual writer covers 488 published projections: 103 completed root summaries change, all 242 unfinished outputs are exactly unchanged, and every other field is identical. The old writer rejects exactly the captured MotoGP card; the repaired writer rejects none.
- A private file-write rehearsal executes the real editorial CLI against intercepted in-memory outputs, then the actual AFL/NRL reconciliation and feed/editorial validators. Both 1,787 incoming and 1,788 published IDs retain their order; editorial application changes no fixture facts, source observations or saved choices. Canonical fixture facts match the unmodified reconciler's baseline. No provider calls, source-file writes or customer writes occur.
- Existing editorial locks, projection identity, fixture-editorial resolution and card/multi-day lifecycle checks pass.

The rehearsal's first validator run hit a VM cross-realm assertion artefact and was corrected to execute in the same realm. A later overbroad preservation assertion also counted an unchanged reconciler's intermediate broadcaster changes as writer changes; the final rehearsal checks editorial-only facts against the original feeds and canonical facts against the unchanged reconciler baseline. Both failures remain in the evidence folder. Neither was fixed by changing production data or relaxing the source/identity/result requirements.

The current retained dataset still contains legacy preview root summaries, so running the tightened full editorial gate directly against that pre-refresh dataset is not a green publication proof. The gate passes after the actual writer is applied in the private rehearsal. Actual persisted refresh output and production proof remain pending the normal canonical owner and release checks.

## Acceptance, value and limits

Business value: allow legitimate updates to proceed while keeping Results OFF protected and avoiding misleading pre-race summaries after a confirmed final. Dependencies: existing lifecycle rules, authoritative fixture facts, the canonical owner and normal release gates. Effort: one shared writer correction and its existing validator; no owner checklist. New cash commitment A$0; existing assistant/hosting costs remain unpriced. High confidence in the reproduced writer fault and local correction; actual refreshed publication, deployment and ordinary overnight behaviour remain unverified.

Publish the scoped passing source changes to main, run the existing full owner once with `quick=false`, then validate the exact newly published SHA, READY state, aliases, served artifacts and affected rendering. If generated shell bytes change, the existing cache and installed-app upgrade gates remain required. Source failures retain current exception reporting and last-good behaviour. Manual success does not prove a later scheduled run. No whole-sport or Football MVP approval follows from this repair.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ordinary-full-refresh-20261011/editorial-spoiler-*.log`, `editorial-spoiler-probes.json`, `editorial-spoiler-differential.json`, and `editorial-spoiler-integration.json`; clean screen/cache production proof is under `combined-repair-live/`.

## Real owner follow-up

Full run 38088370081 passed the formerly failing post-editorial canonical reconciliation and reached the later Follow regression check. It stopped there before publication; main remains the input source snapshot 948b23de. This confirms the demonstrated completion-copy failure was removed in the real pipeline, but does not prove all later editorial/release checks, persisted published output or deployment. The new stop is a genuine approved Presidents Cup admission/exclusion implementation defect, documented separately in `presidents-cup-follow-repair-2026-10-11.md`. Ship its clean app fix and preflight remaining full-specific checks before another source pass; do not promote the refused batch.
