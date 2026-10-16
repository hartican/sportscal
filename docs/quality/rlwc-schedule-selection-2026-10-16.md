# World Cup Schedule fact selection — 16 October 2026

Status: isolated source repair on published `3d8911fd`; not deployed. The existing writing/results owner retains main, deployment, production database and provider work. This module does not include the separately frozen viewing repair or reserve an app version.

The ordinary production NRL Schedule opened Australia–New Zealand under its old `major-match:rlwc-2026:australia-new-zealand` identity, without Finished or highlights. The published NRL Inspector and Follow schedule already contain the source-confirmed 24–22 final, exact old alias, both participant IDs, competition/edition, Round 1, kickoff and original 15 October observations. No source refresh is needed. Dated production evidence: `aus-nz-playable-link-20261016/native-nrl-opener-554.json` in the normal output folder.

The actual Schedule caller selected a scheduled major-child copy through its semantic Feed lookup, replacing the richer final row it already held. The pure major-child constructor has no final evidence and correctly stays scheduled. Keep that constructor and the publisher/media guards unchanged.

At `buildCodeInspectorFixture`, use the existing source-row fallback when a scheduled/upcoming major child is explicitly named by the source's alias list and matches its known sport, competition, date, participants and exact start. The source must already be terminal. Known round, stage, season, gender and event-type contradictions prevent this new path. Existing completed canonical results and loaded exact canonical records retain their priority. This does not infer a result, clock or qualification, or migrate an action. It preserves the source IDs, scores, round and original observations; existing alias resolution retains saved choices.

The existing `validate-rlwc-result-fallback.js` gate first reproduces the actual caller selecting the wrong scheduled record, then checks the correction, complete source values, zero-score handling, wrong context, unchanged canonical priority, existing saved-action lookup, immutable inputs and the unchanged publisher fences. Its dated input is frozen under `scripts/fixtures/rlwc-schedule-alias-20261016.json`, so later Feed retirement cannot break the regression. Normal browser rendering and final release acceptance are recorded separately; a passing pure selection test alone is not customer-route proof.

Business value: the existing match shows its sourced final and can expose its already reviewed official highlights destination. New cash commitment: A$0; existing assistant/runner costs remain unpriced. New owner decision or routine: none. Scope is one selection boundary, with no source/data/provider/database/scheduler/Follow/admission/reminder/media-policy change. Acceptance requires the original failed observation, meaningful source and native browser checks, unchanged budgets and the publishing owner's exact combined release proof. Football, whole-sport and physical-phone certification remain separate.

Detailed local evidence: `/Users/jackhartican/Documents/AI/Codex/rlwc-schedule-facts-20261016`.


## Startup-size follow-up

The combined37e1b77e release was stopped before deployment by normal workflow38885658217:431,595 compressed critical bytes against the unchanged426,115-byte baseline, or1.2860% growth above the1.25% cap. No limit or baseline was changed.

Move the exact alias/result/context decision into the existing lazy, already cached `config/major-events.js` identity owner. The actual Schedule caller invokes that predicate; all seven known-field contradiction checks, explicit alias, sport/competition/date, participant/start identity and terminal-result conditions remain. Keep the constructor and media rules unchanged. The existing module URL and its worker cache entry both move to555; this adds no module or startup request, changes no sporting record and reserves no separate app version. Readable source remains in the module.

On Node24.21.0 the exact combined source now measures431,385 compressed critical bytes, saving210 and returning growth to1.2367553%, within the intact1.25% limit. Critical requests remain eight. The unchanged145-asset/3MiB precache gate also passes. The comparison concerns critical code bytes, not measured phone timing, total transfer, tokens or cash savings.

Five affected source/cache gates pass. The result regression now tests every known contradiction and missing-value case. Eight local Chromium/WebKit browser cases pass again on the extracted guard, covering ordinary Schedule navigation and the controlled stale-child case with Results OFF/ON. A Chromium554-to555 installed/offline rehearsal additionally verifies the complete exact cached module hash and exercises its guard; the publishing owner must still repeat the actual final combined Chromium/WebKit matrix and normal release/hosted proof. No production delivery is claimed here.

Receipts: `/Users/jackhartican/Documents/AI/Codex/rlwc-startup-compression-20261016`. The earlier source test's helper reused its native JSON/screenshot output names during this follow-up. Its original pass log and recorded receipt hash remain historical evidence; the new follow-up receipt is saved in this separate folder and is not relabelled as the earlier file.
