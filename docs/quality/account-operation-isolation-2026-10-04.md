# Account operation isolation — 4 October 2026

Status: Shipped. Exact app `78168e8e66a82c17a97aa96f57246930ccc0c26e` / shell423 is published and live after [normal production 37171736869](https://github.com/hartican/sportscal/actions/runs/37171736869); independent verification at 2026-10-04T02:45:40.468Z confirms READY `dpl_8yoUi3hbynneU9ssgoJ7cngRDxpk`, correct project, release metadata and three aliases. Scope starts after main b9b43a31 / live d29736a3 shell422.

## Verified defects and repair

Actual application orchestration reproduced a read begun under synthetic A continuing its save under synthetic B after a switch. Actual custom-client tests separately reproduced old Auth refresh success replacing B and old terminal refresh failure clearing B. No production account or database was used.

Bind queued/in-flight profile and onboarding operations to their starting account and page generation; verify fresh profile response identity before application. Bind reset/undo confirmations and acknowledgements to that same scope. Invalidate pending work before sign-out and ignore superseded bootstrap/error/logout outcomes. Keep the approved local copy.

Bind coordinated authentication refresh to its original session lifetime. Preserve same-account refresh sharing, storage lease/Web Locks, existing deadline and one 401 retry. Ignore old success/failure after a new sign-in, preserve a newer job and its session-generation-scoped coordination lease, and do not adopt another persistent identity into a session-only sign-in. No backend authorisation changes: decoded token subject is only a cancellation label.

## Acceptance and limits

Existing required cross-device command: twelve actual conflict regressions plus thirty-seven actual orchestration/SDK/recovery cases. Include switched read/write/conflict/error, queued saves, superseded hydration, metadata, sign-out, typed session expiry, wrong-owner reset/undo, stale confirmations, delayed Auth success/failure and overlapping refresh jobs. Controlled synthetic API fixtures use actual frozen SDK and native local persistence in mobile Chromium/WebKit; all service calls remain intercepted.

An old request already dispatched under A can still complete against A; this repair prevents applying it under B or sending subsequent A work with B’s session. It is not real two-device/Auth/RLS/revocation/physical-device proof, a per-account local-cache redesign, whole endpoint certification, customer erasure, or full sports certification. No source or generated sports data, database operation, new provider, scheduler, credential, polling or owner checklist.

## Dated release closeout

The stable local 138-command run completed in 137.957 seconds; normal cloud 138-command and protected-input checks passed. Forty-nine actual conflict/account/client/recovery cases, ten local/ten hosted mobile Chromium/WebKit real-client/native-storage scenarios and both genuine-worker 422→423 upgrade/offline/resume rehearsals passed. Every API response in the affected browser fixtures was intercepted; no real account, two-device, Auth/RLS, physical phone or customer-state proof is claimed. Native club/provider/theme choices and Results OFF remain; upgrade preserves follow/mute/unfollow and Remind OFF.

Sixteen served hashes match the immutable transformed release inventory: six changed inputs, 1,333 unchanged, none removed. Three raw private sources remain excluded and all six function copies remain. All 349 tracked data files preserve exact bytes and original observations. Stable tracked-source fingerprint: `ecbdfa8cc655469760cf3927e5e0521d9e47f926f71d5d7dcc8783154be61f6f`; the scoped publication manifest also hashes both newly added files. Required test compatibility updates retain existing onboarding semantics and errors. The first eleven-command partial run and unstable synthetic logout-click attempt are disclosed in `diagnostic-limits.json`; no required gate was waived. Local/browser/cloud runtimes are measured evidence, not a cloud latency, token invoice, cash saving or retention claim.
