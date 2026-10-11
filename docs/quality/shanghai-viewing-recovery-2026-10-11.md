# Shanghai viewing repair — 11 October 2026

The Shanghai viewing repair is confirmed live. A dated Australian beIN guide supports paid viewing for this edition; the repair adds that guidance without changing sporting facts or saved user choices. It closes the full sports update's latest demonstrated gap. One successful fresh full update and later ordinary overnight proof remain open.

## What changes for people

- Supported Shanghai match and Schedule cards can show beIN with a clear **Subscription** label and a working public destination.
- The guidance applies to the 2026 Shanghai edition, rather than every tennis event. Competition carriage does not promise every court, a specific match stream or a replay.
- Unknown starts remain **Time TBC**. Turning Results off still hides the scores. Following and reminder choices remain unchanged.
- Feed tournament markers retain their existing expandable presentation. The viewing option does not turn a calendar marker into a direct match stream.

## Evidence and scope

**Verified:** Canonical full update [38113457093](https://github.com/hartican/sportscal/actions/runs/38113457093), source `ae9f5553`, passed 27 required descriptions, the location check and the corrected cricket test. Its later Australian-viewing gate rejected `Rolex Shanghai Masters — ATP Masters 1000`. The rejected batch was not published.

The exact tournament producer, using the retained official catalogue, recreates that missing option under `7cf5705f`; see `before-replay.json`. This reconstructs the rejected card, not the complete discarded data batch.

**Verified:** [beIN's Australian 2026 tennis guide](https://www.beinsports.com/en-au/tennis/articles/how-to-watch-the-2026-tennis-season-in-australia-2026-02-04) lists ATP Masters 1000 Shanghai on 7 October. The actual source observation is **2026-10-11T05:19:19.930Z**. The unauthenticated [beIN CONNECT destination](https://connect-au.beinsports.com/en) returned HTTP 200. Source and destination observations, response hashes and scope limits are saved alongside this report.

The existing catalogue supplies a 7–18 October edition window. Its old calendar source date is retained separately. This repair does not claim that the calendar was freshly verified: the ATP overview could not be read during this check. No promotional price, subscription purchase, commercial data permission or authenticated playback is asserted.

## Implementation boundaries

Files: `data/coverage/australian-viewing-rights.v1.json`, `lib/reviewed-au-viewing.js`, `scripts/validate-reviewed-au-viewing.js`, and the new `scripts/validate-shanghai-au-viewing.js`.

The dated window requires an exact Shanghai 2026 tournament identity, compatible competition, Tennis sport, compatible declared ATP tour/season and an in-window sporting date. Contradictory and malformed identities cannot inherit it. Existing unrelated windows keep their original observations and behaviour. Independently sourced, valid fixture-specific access takes precedence over this general competition guidance.

The existing publisher and Schedule projector apply the same rule. The existing canonical updater remains the sole refresh owner. There is no new provider call, scheduler, polling loop, database change, credential, subscription or browser-shell edit. The shell builder confirms that the cached shell is unchanged; an upgrade rehearsal is therefore unnecessary for this module.

## Verification

- The retained catalogue, actual failed-card producer, actual tournament parent, all **77** retained Shanghai fixtures and the real Schedule projection pass edition, identity, date and access checks.
- Every sporting field and original source clock remains unchanged through the viewing helper. The composed Schedule is compared with the same composition before its viewing layer, preserving legitimate independent timing evidence as well as all IDs and ordering.
- Negative controls cover other sports/competitions/tours/years, conflicting and malformed identities, invalid/out-of-window dates, future or invalid observations and untrusted source URLs. Independently sourced fixture access and expiry are tested separately.
- The real Feed publication command persists the option in private temporary files, preserves every existing ID and order, retains original facts and dates, and remains stable on rerun. The unchanged complete Australian-viewing audit checks all retained Feed pages plus that privately published new card: **1,093 cards, 21 sports and 34 resolver scenarios** pass.
- The affected Code/Schedule and API checks pass. Controlled outage messages in those tests are simulations, not new production failures.
- **64** local card cases pass: Chromium and WebKit, 320/390-pixel widths, Feed/Schedule, Results off/on, and four actual/composed input shapes. Eight source-backed score-table privacy pairs pass. Both engines also pass focused Schedule navigation and a real click to an isolated provider popup. Inputs and saved choices remain unchanged, paid captions fit, and no horizontal overflow appears.

These browser checks use disposable preferences, blocked account APIs and private source projections. They are not live publication, physical-phone use, installed-app acceptance, subscription access or video playback. Release checks and production proof are recorded separately after completion.

All **178/178** current normal release safety checks pass locally on main base `8a8c521c` plus this scoped change. The runner also verifies that every candidate source/data input remains unchanged throughout. No check is waived or filtered. Normal cloud release and exact production proof remain pending.

The first cloud request, [38116344225](https://github.com/hartican/sportscal/actions/runs/38116344225), also passed all 178 checks and shared input preflights. An additional fresh-publication rehearsal then exposed a test assumption: the producer's card was required to be absent from the starting document. That would fail once a successful canonical update had saved it. The request was cancelled before its public verification, while deployment was starting; it is not a verified release. The corrected test now exercises both first appearance and retained appearance, with full-document real publication and stable reruns. Both the current document and a controlled document already containing the actual producer's card pass. Application rules are unchanged by this test correction; the final snapshot still requires a complete normal release.

## Confirmed delivery

The corrected published snapshot **`d21b6cf121ef8b513a7c8bd4fdc86345d91de05f`** passed complete normal [production run 38116842050](https://github.com/hartican/sportscal/actions/runs/38116842050), including all 178 safety checks, live preflights and public verification. Exact Vercel **`dpl_9HdQPbcnvLvP4U5Gu6JSANVLETEf`** is READY at `sportscal-1pa32qhxc-harticans-projects.vercel.app`, with all three production aliases independently checked. Shell **492** remains unchanged.

Fourteen served core/sport artifacts and the additional public viewing-review file match the exact sealed deployment inventory. Five deployed function copies each of the new review and helper match the published, correctly transformed bytes. The verification uses Vercel's official [deployment-file listing](https://vercel.com/docs/rest-api/deployments/list-deployment-files); source claims and production behaviour remain separate.

A real ordinary selected-fixture request returns Shanghai's original canonical identity and the dated beIN option. Both hosted browser engines then pass four 320/390-pixel cases comprising **eight** native Feed/Schedule card-builder checks using that actual response. Paid captions, destination, hidden set scores, original input and saved preferences pass. APIs are blocked inside the disposable browser contexts; this is hosted component rendering, not normal Feed admission, signed-in acceptance, playback, an installed app or a physical phone.

The earlier cancelled request did reach READY after cancellation (`eab9e807`, `dpl_3hZcDwbkUovofWNPJ9E7gdP8ndBU`). Cancellation did not stop the already-started cloud deployment. It lacked completed public verification and is superseded by the fully passing exact release above. No failed fresh card batch was replayed.

Evidence: `live/production-proof.json`, `live/viewing-package-proof.json`, `live/selected-fixture-read.json`, `live/hosted-browser.json`, final workflow receipt and preserved first-request/correction evidence alongside the saved Markdown/HTML report. Local checks took 251.61 seconds in one measured run; the slowest entrypoint was the canonical updater validator at 62.695 seconds. These are local elapsed times, not bills or promised savings; no safeguard is shortened or removed.

## Recommendation and acceptance

| Item | Assessment |
| --- | --- |
| Business value | Remove a demonstrated full-update blocker and replace missing viewing guidance with a clear paid destination. Help tennis users find where to watch without sacrificing accuracy |
| Evidence/confidence | High for the dated broadcaster claim, exact scope and private writer/UI behaviour. Live rendering and full-update recovery remain unverified until their release receipts |
| Effort | Small, bounded repair and existing checks. No infrastructure overhaul or new operating system |
| Dependencies | Passing normal release checks, the exact published release, one successful canonical full update, then a later ordinary overnight update |
| Cash cost | A$0 new commitment. Existing assistant, runner and hosting costs are not newly priced; the user's optional viewing subscription is not purchased |
| Owner-time impact | No new routine, approval question or support task |
| Acceptance | Scope and source clocks preserved; private publication, complete viewing audit and small-screen checks pass; normal release passes and exact production is verified; the next canonical update passes this gate and reaches its own verified publication |
| Why act now | This specific gap stops the existing update. Reuse the reviewed broadcaster and current pipeline rather than introducing new coverage or a second refresh path |

## Programme position and next action

Full update recovery and later overnight proof remain open. Prepared baseball, tennis and racing background still needs a successful canonical publication before it is claimed live. Football stays first after recovery. This repair does not approve Tennis or complete the Football MVP: **0/17** whole-family approvals, **0/3** Football pilots, target **14/17** remain unchanged.

A single failed full run's timing evidence is saved in `../cricket-context-check-20261011/update-stage-timings.json`. It identifies checks worth measuring later, but does not establish billed model/runner cost or justify weakening safeguards. A clean local deployment-package rehearsal passed in 2.7 seconds; different hardware and input conditions prevent attributing the slower cloud interval to that package. Finish update recovery before a bounded optimisation experiment.
