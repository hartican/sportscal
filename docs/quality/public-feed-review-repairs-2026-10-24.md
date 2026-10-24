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

4. **Retirement freshness.** One existing selected refresh must return `stale:false` and include the exact canonical thread ID in `checkedIds` before any retirement RPC or check-clock write. Stale/failed/omitted/unverified receipts defer without effects or another read. Healthy matching finals still use the existing shared retirement policy. Tests cover all failure/omission controls and healthy one-/two-ID cases.

5. **Untracked cold-alert navigation.** Alert entry uses the existing notification destination dialog owner and PR37's opt-in full-card adapter. It never calls ordinary tab/focus rendering, mounts/marks a personal Feed slot or persists admission/open/seen/card choices. Full fixture and tray share one scroll container. Async media controls cover exact aliases, account-lifetime change, removed Feed membership and current Results choice. Normal Feed comment expansion remains inline under its existing full card. Native layout and final shared-adapter qualification remain separate gates.

6. **Erasure contract.** Public comments use the exact existing canonical AFTER ROW INSERT OR UPDATE guard identity/type21; the inventory and operator/workflow are unchanged. The guard retains its original isolation/locks/audit-null protection. A table-specific derived-update case requires identical text/GIF/author/deletion/identity fields, unchanged-or-null parent, actual vote total and the current thread revision; ordinary blocked text or arbitrary-score writes still fail. This permits required blocked-peer vote/FK cleanup while preserving the dynamic inventory contract. The database regression now loads real existing chat/reminder DDL, original guard/auth-marker/inventory migrations, the feature migration, real direct-guard preflight and real operator/workflow freeze. It covers a nonexistent zero-row sentinel, a zero-comment account and later cascade/deletion controls; later workflow phases remain explicitly unallocated.

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

## Verification and boundaries

The expanded `node scripts/validate-public-feed.js --light` passes with current source on Node25.9.0. It now includes the consent, multi-parent/late-ACK/access/cold/scroll and retirement regressions. Existing DOM/GIF/private-picker/export, policy/API/delivery/navigation checks remain. `build-public-comments-ui.js` binds the generated optional bundle to current source. Static build/startup and affected existing source gates remain required; ROOT retains the unchanged startup budget despite the necessary registration field.

The final migration/real inventory/operator/workflow test must run sequentially on PostgreSQL18 and17 after ROOT allocates it. Native Chromium/WebKit, final PR37 integration, coherent index/cache/version, hosted freshness/activation and physical-phone delivery remain unverified here. Final allocated qualification uses Node24.21.0. No required gate is weakened or waived; original earlier source/SQL evidence does not qualify this changed migration.

Deliver this full repair as one frozen revision for ROOT's existing review/integration lane. Preserve additive comment/archive data if application callers are rolled back; do not drop tables or replay uncertain deliveries as a rollback shortcut.
