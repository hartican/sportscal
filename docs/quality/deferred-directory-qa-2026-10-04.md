# Canonical refresh: deferred directory validation — 4 October 2026

**Outcome:** three existing canonical checks now inspect the mounted Follow module as well as the inline application. Their sporting, flag, identity, directory, search, admission and offline requirements are retained. The same three checks now run earlier in the existing production validation step. No application, API, sporting data, source date, shell version or scheduler changes.

## Reproduced failure and repair

The actual scheduled [canonical refresh 37146184945](https://github.com/hartican/sportscal/actions/runs/37146184945) ran from main `0cdcd9d5a547e4bb1570e21a0c96595aa61b9614` on 3 October UTC. It reached shell generation and stopped at `validate-country-flags.js` before publication. It searched `index.html` for directory flag rendering, although that code is in the existing deferred `assets/js/follow-presentation-ui.js`. Adjacent Football and Australian team/player validators had the same stale inline-source boundary. All three original failures were reproduced locally against the unchanged app/data.

The repair uses the existing `readFollowApplicationSource()` helper. It verifies the real loader URL, invocation, exact versioned offline-cache reference and parseable deferred module before returning its source with the inline application. Country-flag assertions now distinguish tournament rendering from the directory; the other two validators retain their existing assertions against the combined source. No expected result, sporting rule, freshness limit or fixture count was relaxed. [Shared helper](../../scripts/app-shell-test-utils.js), [flag check](../../scripts/validate-country-flags.js), [Football check](../../scripts/validate-football-directory.js), [Australian directories](../../scripts/validate-team-player-directories.js).

Running these three existing checks in the normal production validation step makes a release catch this drift before the next source refresh. It adds three local validation commands to the same job, rather than another scheduler or manual checklist. The canonical owner and all later gates remain unchanged. This does not claim that every other canonical validator has been replayed or that the next overnight refresh is already successful.

## Verification and preservation

| Evidence | Result | Practical limit |
|---|---|---|
| Original baseline | Three original committed validators reproduce their exact stale-source failures against the current unchanged application/data | The hosted scheduled run directly demonstrated the first failure; the other two were adjacent local reproductions |
| Affected checks | Repaired flags, Football and Australian directories pass; canonical-owner contract, exact shell build, athlete profiles and card polish pass | Static wiring and data/asset contracts, not a new physical rendering or installed-phone test |
| Normal local release | All 137 commands from the existing release safety step pass in 133,428 ms | Current local runtime only; no attributable token, hosting-cost or rework saving measured |
| Scope | Four source/workflow files changed; no prior published application path changed | Reports and evidence are separate; no provider refresh or generated data was included |
| Existing live app | Fresh read-only control-plane proof at 2026-10-03T19:17:49.538Z retains READY 2f2707f2526de1409609dfd7e4922685be3e57bd, correct project and all three aliases | This is preservation of the prior live release, not a new deployment or new served-byte/browser proof |
| Unattended recovery | The repaired checks are prepared for the existing release/refresh owners | Require a later ordinary scheduled completion and any resulting exact publication proof. No job was manually dispatched to simulate it |

The six original served hashes, cloud 134 checks and the preceding 68/68 reminder-guard proof remain dated in their own delivery record; they are not relabelled as results for this QA-only snapshot. The ignored `supabase/.temp/` state is preserved. No cache epoch or app redeployment is necessary for checker-only changes.

## Recommended course and value

| Recommendation | Business value and evidence | Effort/dependencies | Cash and owner time | Acceptance and reason |
|---|---|---|---|---|
| Publish this scoped QA repair on main | Removes three reproduced false failures that can prevent new fixtures/results reaching users | Completed small correction using the existing helper; 137 normal local commands pass | A$0 new spend, no recurring owner action; three existing checks run earlier | Preserve every original check, actual module/cache binding and last-good app/data; act now |
| Let the existing scheduled owner prove recovery | Avoid needless repeated source requests and a duplicate app deployment | Await the next ordinary run; investigate only a new failure or material source change | Existing job/cadence; exception-based review | Actual completed refresh plus exact published snapshot/READY/alias/served proof if app data changes; not yet achieved |
| Keep Football final-input and rights gates explicit | The separate UEFA review finds 66 candidate club matches, six gaps and restrictive website terms | Permitted source, complete identities/discipline and final reconciliation needed | No subscription, scraper, outreach or decision now | Keep unresolved ties Pending and certification at 0/3 pilots; source discovery is not integration |

The full CTO programme stays active at **0/16 certified sport families**, with an at-least-13/16 destination. Independent recovery, physical acceptance, Australian playback, source permission and real cohort repeat-use proof remain open. Passwords/iCloud attempts stay parked as requested. [UEFA feasibility](uefa-coefficient-feasibility-2026-10-04.md), [single current queue](../cto-delivery-plan.md).
