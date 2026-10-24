# Temporary installed-offline Linux diagnostic preparation

25 October 2026 Sydney. **Diagnostic branch/PR only. Do not merge this mode into PR47 or main. No app repair or release acceptance is claimed. ROOT alone reviews and starts the one cloud run.**

## Evidence and question

CI40124555984 failed WebKit on the593 candidate d31f1af9b5697502938a09f000d779abe30a6209 (tested merge600391e7, tree784abf7b) at the original installed validator's offline `page.reload`: “WebKit encountered an internal error”. Its artifact12572408869 has four files, without the failed navigation/controller/socket trace. The preserved ZIP digest is85d99d0c5bb934867aeb7c53ae667971659cd8c36318cba07eb318d5f44c2de7.

One allocated local macOS trace completed the same origin-down/cache boundary in20.773s. It recorded three destroyed main-request sockets followed by a200 response from the worker and retained593 shell. It did **not** reproduce the Linux failure and does not override that failed gate. It also exposed successful external public logo loads in the inherited test; that local replay was not fully network isolated. Its browser/server were reaped and port52320 closed. Evidence remains outside Git in `/Users/jackhartican/Documents/AI/Codex/installed-offline-boundary-20261025/`.

This preparation seeks the actual Linux failure signal before deciding a repair. External denial changes the original environment; a new green diagnostic cannot establish what caused the old failure.

## Scope and bounds

Product bytes remain identical to d31: no worker, app, account, cache-version, preference, API, database, scheduler, provider or dependency change. The default unlabelled workflow retains both engines, every original installed assertion and timed-wait call, full resumed-upgrade checks and all account-recovery cases. The new mode is explicit and default OFF.

On this temporary diagnostic PR only, label `pwa-offline-diagnostic` selects one WebKit job in the existing workflow. Its check and artifact names explicitly say NOT RELEASE ACCEPTANCE. It keeps the original592 baseline6aa5979ab440b38765fe1038ab3b1203e354fe40, requires Linux/Node24.21.0/Playwright1.62.1/WebKit2336 with the original cold/default executable setup, denies nonowned browser origins before creating any page, and runs the actual validator through its original offline/cache/native saved-choice assertions. It then stops explicitly before resumed-upgrade/account-recovery phases; these are not claimed passed. No new workflow, job, permission, retry, dependency, gate waiver or timeout increase is introduced.

New observations include exact request identity through response/terminal, `fromServiceWorker`, owned server socket destruction, current cached shell version/digest, controlling/active/waiting/installing worker facts, page/controller lifecycle, original navigation error, page crash and browser disconnection. Snapshot reads have a separate1500ms diagnostic bound and can affect timing; existing test deadlines are unchanged. Internal WebKit target offline flags are not directly read or claimed. No worker instrumentation, product fetch, store or account write is added.

Bounds:1024 activity events,128 critical facts,8 snapshots,512KiB trace; explicit overflow counters. Query values/headers/bodies are omitted. Browser debug uses `pw:browser`, not protocol payload dumps: stderr retains its last256KiB with byte/drop counts, stdout its first64KiB. Read-only runtime metadata records executable/manifest revisions and up to four bundled libsoup file hashes/literal version strings, with a768-entry/depth6 search and32MiB/file read limit; missing data remains unknown. The adapter allows one child run, maximum6minutes plus bounded termination/reaping; no automatic retry. Normal original failures retain their exit/error, even when a snapshot or cleanup observation fails. Cleanup records owned Node/browser PIDs, browser/server closure and loopback port state. The existing always-upload artifact step remains.

The original worker does not handle cross-origin fetches; browser routing explicitly denies those requests and any observed external response fails diagnostic isolation. No production account or credentials are configured. This does not change the shipped app's network policy.

## Qualification

Initial9ce09eb2 passed54 deterministic controls on Node24.21.0 without launching a browser or cloud job. These cover default-OFF inert behavior, explicit mode/runtime refusals, denial of external/lookalike/other-port origins, main-request/response/terminal identity, worker response and crash/disconnect facts, query omission, original-error preservation including failed artifact writes, isolation refusal, event/byte/snapshot overflow, stderr tail retention, server/port cleanup despite browser-close errors, exact original assertion/timed-call source text/order, unchanged product bytes and diagnostic/normal workflow separation. A synthetic bundled-library literal tests read-only version/hash detection; it is not evidence of the Linux runner's actual library.

Three in-memory control mutations each fail as expected: bypass external denial, swallow the original reload error, and mark a diagnostic as release acceptance. Syntax, YAML parsing and `git diff --check` pass. These are controls for the observation mechanism, **not a causal RED for the original Linux failure**. No additional native or cloud run was performed during preparation.

## Review correction: record process groups independently of leaders

SPEC identified a P2 cleanup gap in9ce09eb2. An actual-source VM replay with syscall doubles proves its cleanup reports exit0 while both recorded leaders are absent and a recorded browser group still exists. Old source probes only positive leader PIDs, so it skips TERM/KILL. The original frozen9ce receipts are retained; this is a correction to the diagnostic adapter, not an app or Linux-failure diagnosis.

The bounded repair probes each **recorded owned group** with negative-ID signal0, independently of its positive leader. The certificates remain only our detached Node child and the pinned Playwright launcher's detached `<launched>` PID; the existing ROOT native proctor uses the same group-presence contract. Invalid IDs, PID1, the adapter's own PID and uncertain/permission results cannot mean clean. Only a group actually present before cleanup receives TERM; KILL is allowed only after a sent TERM and a still-present group. A group appearing after observed absence is not signalled as though ownership persisted. No process search, unknown group or broad signal is introduced.

Before/after-TERM/final group and leader states and exact actions are recorded in `runner-lifecycle.json.ownedGroups`. Only confirmed absence at every phase, with no forced action, permits a clean diagnostic exit. Forced cleanup rejects success even if descendants are removed. Existing250ms cleanup intervals, six-minute bound, runtime, worker/app bytes, workflow, original assertions and step deadlines remain unchanged.

`node scripts/validate-installed-offline-diagnostic.js` now passes81 guards (54 retained+27 cleanup controls), including dead-leader/live-group TERM and KILL, stubborn survivors, permission/intermediate uncertainty, positive leader outside a vanished group, reappearing groups, invalid certificates and the actual adapter's zero-child-exit→failed-cleanup exit mapping. The matching actual-source GREEN replay removes the simulated group with bounded TERM/KILL and returns exit1 as required. All signals/process states here are syscall doubles; no native/cloud/browser execution or real process signal was used. Source-only P2 delta: adapter, guard tests and this record. ROOT holds dispatch for exact-delta re-review.

## ROOT-only invocation

This draft is stacked on `codex/sync-loading-release-20261025` at exact d31 to keep its diff instrumentation-only; it never writes that branch. Before dispatch, verify that base, frozen diagnostic head, source/patch hashes and original product hashes match the handover. Do not merge the diagnostic PR, put its label on47, update its head after dispatch or launch another workflow.

The existing workflow listens to PR `ready_for_review`; adding a label alone does not start it. ROOT, **after review**, checks whether the label exists, creates it only if absent, then adds it while this PR is still draft and marks this PR ready exactly once:

```sh
gh label list --repo hartican/sportscal --search pwa-offline-diagnostic
# Only if absent:
gh label create pwa-offline-diagnostic --repo hartican/sportscal --description 'Temporary offline boundary diagnostic; never release acceptance' --color 8B5CF6
gh pr edit DIAGNOSTIC_PR_NUMBER --repo hartican/sportscal --add-label pwa-offline-diagnostic
gh pr ready DIAGNOSTIC_PR_NUMBER --repo hartican/sportscal
```

Expected job: `OFFLINE DIAGNOSTIC - NOT RELEASE ACCEPTANCE (webkit)`. Expected artifact: `OFFLINE-DIAGNOSTIC-NOT-ACCEPTANCE-<frozen-head>-webkit`, containing `offline-boundary/{frozen-runtime.json,offline-boundary.json,pw-browser-stderr.log,stdout.log,runner-lifecycle.json}` plus the original workflow setup/context files. The check is deliberately distinct from normal installed-upgrade acceptance. Download the artifact promptly; the existing retention is one day. Do not use `gh run rerun` to hunt for green.

Read the actual failure/lifecycle/reset/cache signals before proposing any app or test-runtime repair. A pass leaves the old failure unexplained. Any later runtime comparison needs a separate evidence-bound control and all normal release gates on the final candidate.

## Research leads, not a diagnosis

Official [Playwright issue42803](https://github.com/microsoft/playwright/issues/42803) describes a Linux network-process failure involving the bundled libsoup version. Official [PR42894](https://github.com/microsoft/playwright/pull/42894) applies configured offline state when WebKit page targets initialise. Neither source proves the Nothing Sport failure. Keep1.62.1 for the first trace; no blind runtime upgrade or speculative app repair is included.

Rollback is closing this temporary PR without merging and retaining its evidence. PR47/main, customer state, current-choice/OFF/unfollow and receipt/ACK guards remain untouched. Stop at Ready for ROOT review/dispatch.
