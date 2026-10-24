# Public Feed review repairs — 24 October 2026 Sydney

Status: **Working; coherent repair candidate, not Ready or deployed.** ROOT's existing Spec/Standards pair completed review of immutable `95885e63bd93d22980ac7526633c638239c910df` with six unique findings. This record describes the repair of that final list; no second review pair, shared database operation, scheduler, notification replay or production action was started. All feature scope, defaults, permissions and fixed startup limits remain required.

## Reproducible RED controls

The following lightweight commands read the immutable reviewed source with the new tests, without changing checkout files. Each failed before the corresponding repair and still fails with `--reviewed-baseline`:

```bash
node scripts/validate-public-comment-consent.js --reviewed-baseline
node scripts/validate-public-comments-state.js --case=delta --reviewed-baseline
node scripts/validate-public-comments-state.js --case=denial --reviewed-baseline
node scripts/validate-public-comments-state.js --case=cold --reviewed-baseline
node scripts/validate-public-comment-retirement.js --reviewed-baseline
```

Observed failures respectively: stored installation consent `true !== false`; next changes watermark `4 !== 2`; cached protected discussion retained after an account-unavailable403; one ordinary tracked Feed card mounted during delayed media (`1 !== 0`); two retirement writes from a stale selected receipt (`2 !== 0`). The registration test traverses actual index function source, unchanged SDK and actual notification API, with database/transport boundaries mocked. The cold route includes actual index tab/focus functions, card wrapper and seen-observer registration, with the pending shared detailed-card adapter as its test seam.

ROOT separately confirmed that the reviewed split erasure triggers make the **real** dynamic inventory report `public_comments.author_user_id` as unguarded, including zero rows. The updated database regression can reproduce that original SQL against the existing inventory/preflight/operator/workflow after allocation:

```bash
node scripts/validate-public-comments-database.js --reviewed-baseline
```

**This PostgreSQL RED/green run remains held and was not executed by this repair lane.** Do not convert the five light REDs or ROOT's confirmed original failure into a final SQL-engine pass.

## Six repairs and controls

1. **Device OFF bridge.** The real existing registration payload forwards `commentAlertsEnabled` from the current draft/local preferences, using the same default-on rule as adjacent settings. No new sync or registration owner is added. Actual-source tests cover draft OFF while the account remains ON, saved local OFF, absent/default ON, deliberate reenable, legacy omitted-field preservation and global/account/device-permission suppression. A failed account-state save does not prevent a successful installation registration from carrying its OFF value; unavailable registration itself is not claimed acknowledged.

2. **Contiguous deltas.** Only the initial root snapshot establishes the baseline; later page observations cannot advance the processed changes watermark. Actual changes alone advance it. Per-comment versions retain hard-delete tombstones against delayed write acknowledgements, including pre-baseline/delayed older post responses. Multi-parent tests cover both hidden content and hard deletion while another parent's replies carry a newer global revision. A separate synthetic geometry control anchors the discussion's actual scroll owner rather than the underlying page.

3. **Reader access denial.** Explicit account-unavailable/registered-access denial clears cached rows, draft, GIF state and composer, aborts/stops automatic reads and fences late write acknowledgements. Ordinary offline errors retain content and the existing thirty-second retry backoff. Retirement retains the same clear/stop behavior.

4. **Retirement freshness.** One existing selected refresh must return `stale:false` and include the exact canonical thread ID in `checkedIds` before any retirement RPC or source/snapshot observation write. The later fairness follow-up below separately records bounded scheduling attempts. Stale/failed/omitted/unverified receipts defer retirement/source changes without another read; the existing scheduling receipt rotates separately as described below. Healthy matching finals still use the existing shared retirement policy. Tests cover all failure/omission controls and healthy one-/two-ID cases.

5. **Untracked cold-alert navigation.** Alert entry uses the existing notification destination dialog owner and PR37's opt-in full-card adapter. It never calls ordinary tab/focus rendering, mounts/marks a personal Feed slot or persists admission/open/seen/card choices. Full fixture and tray share one scroll container. Async media controls cover exact aliases, account-lifetime change, removed Feed membership and current Results choice. Normal Feed comment expansion remains inline under its existing full card. Native layout and final shared-adapter qualification remain separate gates.

6. **Erasure contract.** Public comments use the exact existing canonical AFTER ROW INSERT OR UPDATE guard identity/type21; the inventory and operator/workflow are unchanged. The guard retains its original isolation/locks/audit-null protection. A table-specific derived-update case requires identical text/GIF/author/deletion/identity fields, unchanged-or-null parent and actual vote total. The post-engine follow-up below replaces its original latest-thread equality with an exact stored-row revision, strictly advancing from OLD and bounded by the thread. Ordinary blocked text or arbitrary-score writes still fail. The database regression loads real existing chat/reminder DDL, original guard/auth-marker/inventory migrations, the feature migration, real direct-guard preflight and real operator/workflow freeze. It covers a nonexistent zero-row sentinel, a zero-comment account and later cascade/deletion controls; later workflow phases remain explicitly unallocated.

## Picker host follow-up — existing owner only

The six-finding revision `6e67b479` revealed that the existing picker was appended to `document.body` while its alert card lived in a native modal dialog. The [HTML modal-inertness rule](https://html.spec.whatwg.org/multipage/interaction.html#modal-dialogs-and-inert-subtrees) makes content outside that dialog inert. ROOT explicitly allocated a narrow follow-up before freezing the final repair delta.

Public Feed now passes its containing dialog into the **same existing media installer**; default private chat still uses `document.body`. No picker markup, provider, upload permission, independent loader, request deadline or 25-point rule is replaced. DOM identity and current host/lifetime fence pending configuration, provider responses/errors, result/close/search/retry callbacks and cleanup. Closed/detached dialogs cannot steal a private picker or fall back onto the body. Cleanup can clear its owned picker after the caller becomes unavailable without touching a replacement. Visible results from earlier pagination remain selectable.

`validate-public-comment-picker.js` evaluates the actual media and public-controller sources. Its default run passes structural dialog descent, actual caller bridging through the existing two media loader paths, private/public/private selection/focus ownership, 24-point rejection, paging, closed/detached host controls, delayed configuration/provider errors, detached old result/close controls and ended public lifetimes. Tests use DOM mocks and a fake provider; this is **not native modal, hit-test, iPhone or real provider proof**.

These six cases reproduce their specific failures against immutable `6e67b479` and pass on the candidate:

```bash
node scripts/validate-public-comment-picker.js --case=descendant --reviewed-baseline
node scripts/validate-public-comment-picker.js --case=bridge --reviewed-baseline
node scripts/validate-public-comment-picker.js --case=config --reviewed-baseline
node scripts/validate-public-comment-picker.js --case=error --reviewed-baseline
node scripts/validate-public-comment-picker.js --case=lifetime --reviewed-baseline
node scripts/validate-public-comment-picker.js --case=privacy --reviewed-baseline
```

The earlier six-finding REDs above, and the real PostgreSQL erasure/inventory/operator/workflow execution, retain their separate status and source bindings. No engine/native/shared operation or version allocation accompanies this follow-up.

## Standards follow-up after `cee38c7e`

ROOT's full `95885e63`→`cee38c7e` delta was Spec-clear, with two remaining Standards cases. The earlier ROOT Node24.21.0 light/startup pass stays bound to `cee38c7e`, not this later candidate. Both new cases have deterministic light RED→GREEN controls:

```bash
node scripts/validate-public-comment-erasure-access.js --reviewed-baseline
node scripts/validate-public-comment-retirement.js --starvation-only --starvation-baseline
```

The first evaluates the actual tray and traverses the unchanged SDK, actual public API handler and real `authenticatedUser` implementation. Mock Auth HTTP returns the real server-owned erasure marker; the actual helper produces403 `account_erasure_in_progress` before SQL. On `cee38c7e` the cached discussion remains visible, so the exact clear assertion fails. The repaired tray recognises that distinct code, clears comments/draft/composer and fences an already-pending SDK write receipt. Real Auth transport failure preserves content/backoff, and a user-editable metadata marker does not acquire authority. HTTP/SQL remain mocked.

The second runs five successive bounded maintenance passes over five threads. The permanently omitted first two repeatedly starve a later final on `cee38c7e`. The repair batch-updates only **the existing `public_threads.checked_at` scheduling-attempt receipt** for at most two selected rows before the one selected-source read. The existing thirty-minute/oldest-first scheduling then reaches the later final; only its exact healthy checked-ID proof permits the existing retirement RPC/shared policy. Unverified descriptors and their source-observation timestamps stay unchanged. Stale, missing, failed and partial read controls still prohibit retirement for unverified IDs and add no source retry.

Database contract disclosure: no new column, table, RPC, grant or DDL change. The sole added backend operation is one bounded batch PATCH of the existing scheduling field per nonempty pass, on the existing maintenance owner/request budget; the two-thread/read budget is unchanged. `checked_at` schedules attempts and is not a sporting/source observation. All mutation bodies in the fairness regression are checked to contain only that receipt, and unverified `fixture` content/source clocks are compared unchanged. This is source/mock proof, not actual database fairness or automatic scheduled retirement.

Both tests join the existing light aggregate; the original six-finding REDs, picker REDs and held real PostgreSQL erasure/inventory/operator/workflow execution remain distinct and unwaived. No heavy/native/shared action, new review pair, publication lane or version allocation accompanies this repair.

## Verification and boundaries

The expanded `node scripts/validate-public-feed.js --light` passes with current source on Node25.9.0. It now includes the consent, multi-parent/late-ACK/access/cold/scroll and retirement regressions. Existing DOM/GIF/private-picker/export, policy/API/delivery/navigation checks remain. `build-public-comments-ui.js` binds the generated optional bundle to current source. Static build/startup and affected existing source gates remain required; ROOT retains the unchanged startup budget despite the necessary registration field.

The final migration/real inventory/operator/workflow test must run sequentially on PostgreSQL18 and17 after ROOT allocates it. Native Chromium/WebKit, final PR37 integration, coherent index/cache/version, hosted freshness/activation and physical-phone delivery remain unverified here. Final allocated qualification uses Node24.21.0. No required gate is weakened or waived; original earlier source/SQL evidence does not qualify this changed migration.

Deliver this full repair as one frozen revision for ROOT's existing review/integration lane. Preserve additive comment/archive data if application callers are rolled back; do not drop tables or replay uncertain deliveries as a rollback shortcut.

## Actual engine failure at `1d2f164d` and bounded revision repair

ROOT ran the actual SQL harness on Node24.21.0 with PGlite0.5.8 (PostgreSQL18). The original `95885e63` inventory baseline failed at the expected real direct-guard check. The candidate `1d2f164d` also failed, separately: inserting an actual account-erasure block invoked the comment identity trigger's bulk `score=score` update, which raised `55000 account_erasure_in_progress` in the canonical guard. PG17 was not run. Retained evidence is `root-1d2f164d-pg18-green.log` and `root-1d2f164d-pg-receipt.json` in the owner's external `public-feed-20261024` evidence folder; that failed candidate is not qualified.

The source diagnosis is the batch revision comparison: the BEFORE owner increments the thread once per row; row AFTER triggers execute at statement end, when earlier rows no longer equal the thread's final revision. This timing also applies to multi-reply FK detachment. See [PostgreSQL17 trigger timing](https://www.postgresql.org/docs/17/trigger-definition.html). The repair retains every immutable-field and actual-vote-total condition and the same combined guard identity/timing, and checks `NEW.revision > OLD.revision`, exact agreement with the currently stored comment row, and `NEW.revision <= thread.revision`. It changes no trigger grant, inventory predicate, insert exception, RPC, schedule, application shell or browser byte.

The real SQL harness adds multiple roots in one thread, another thread, and two replies from a second author to the same parent. It exercises profile/persona revision redaction, direct block insertion, real Auth-marker begin for existing/new blocks, repeat begin, forbidden text/GIF/deletion/score/time/parent edits with complete row/thread rollback, successive overlapping derived-update batches, caller-supplied unchanged/decreasing/future revisions, and late BEFORE-trigger attempts to forge revisions/content/score while the canonical AFTER guard stays installed. Auth deletion must emit root tombstones, clear both blocked peers' parent/score dependencies and retain redaction; actual inventory must still pass afterwards. Successive overlapping batches are not a concurrent-transaction test or hosted Supabase proof.

Keep the old controls distinct, using the current harness against each immutable migration:

```bash
# Original split-trigger inventory failure at 95885e63.
node scripts/validate-public-comments-database.js --reviewed-baseline
# Actual multi-row block insertion failure at 1d2f164d.
node scripts/validate-public-comments-database.js --erasure-baseline
# Repaired current source; requires ROOT's allocated PG18/PG17 execution.
node scripts/validate-public-comments-database.js
PGLITE_MODULE=pglite-pg17 node scripts/validate-public-comments-database.js
```

That first repair was syntax-checked, then reviewed and engine-tested by ROOT as `e5810a91`. It passed bulk block insertion but exposed the separate cascade failure below. It is not the final qualified SQL candidate.

## Overlapping cascade diagnosis and actual PG18/17 qualification

ROOT's subsequent `e5810a91` PostgreSQL18.3 run reproduced both earlier REDs, then failed during actual Auth deletion of the multi-root subject with two blocked peer replies. A newly allocated, bounded local SQL lease allowed one instrumented replay. Test-only error details established the exact public-comment transition: the parent FK detached a peer's parent with `NEW.score=1, NEW.revision=29`, while a later vote cascade had already produced final stored `score=0, revision=32` and actual vote sum0. Protected content/identity fields matched. The diagnostic changed only the error detail, and its diff/log/receipt are retained externally as `owner-e581-cascade-diagnostic.*`; no diagnostic function replacement remains in committed source.

The final repair, frozen as `e14550f6b22091ec63408eaef76ee69d590d9dda`, preserves the canonical guard, timing, inventory and immutable-field checks. It additionally compares the final stored row's protected fields to the queued transition, permits parent identity only to stay unchanged or detach to null, and requires the final stored score to equal actual votes. The transition score must equal that final score, except that an actual non-null-to-null parent detachment may preserve its OLD score while the queued vote cleanup finishes. Revisions must satisfy `OLD < NEW <= final stored <= thread`. There is no blanket blocked-account exemption or trigger-depth bypass. Direct forbidden edits, forged current/future/backward revisions, later BEFORE-trigger content/score forgery and rollback assertions stay installed and passed.

During the six-minute ROOT lease, all eight final commands ran sequentially with existing Node24.21.0 and installed modules, once per unchanged engine/mode. Same-connection engine output confirmed PostgreSQL18.3 (`180003`, PGlite0.5.8) and PostgreSQL17.5 (`170005`, alias0.3.14). For **each** engine:

- `--reviewed-baseline` reproduced the original `95885e63` inventory denial.
- `--erasure-baseline` reproduced `1d2f164d` block-insertion denial.
- `--cascade-baseline` reproduced `e5810a91` overlapping-cascade denial during Auth deletion.
- The unflagged current candidate exited0 and passed the complete actual SQL harness, including grants, inventory/operator freeze, redaction, blocked writes, Auth marker, multi-peer cleanup, hard tombstones, ordinary comments/votes/runs/GIF policy, retirement rollback and immutable yearbook checks.

Each execution has an external `.json`, `.log` and `.diff` under `public-feed-20261024/owner-e14550f6-{pg18,pg17}-{inventory,block,cascade,green}` in the owner's output folder. Receipts contain exact SHA/tree, tracked/untracked status, source hashes, command, runtime, engine version, elapsed time, log hash and exit. The untracked native harness was present but was not imported or executed. The retained instrumented intermediate GREEN is separate from the final uninstrumented qualification. Existing four-and-a-half-GiB entry/three-GiB running reserves,120-second child timeout, six-minute lease and two-MiB output cap were preserved; the lane was released early with no child/DB remaining. No repeated unchanged mode, install, network, browser, VM or managed database operation was performed.

These are real isolated PostgreSQL WASM results, not deployed Supabase, PostgREST, complete nine-phase erasure/storage, customer-account, provider, push or physical-device proof. ROOT's existing pair must review this final SQL delta. Native shared-card/tray/picker integration and phone acceptance remain outstanding, so Public Feed remains Working.
