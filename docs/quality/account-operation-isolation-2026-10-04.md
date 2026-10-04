# Account operation isolation — 4 October 2026

Candidate scope: after main b9b43a31 / live d29736a3 shell422. Release evidence will be added after the required gates and exact-snapshot deployment.

## Verified defects and repair

Actual application orchestration reproduced a read begun under synthetic A continuing its save under synthetic B after a switch. Actual custom-client tests separately reproduced old Auth refresh success replacing B and old terminal refresh failure clearing B. No production account or database was used.

Bind queued/in-flight profile and onboarding operations to their starting account and page generation; verify fresh profile response identity before application. Bind reset/undo confirmations and acknowledgements to that same scope. Invalidate pending work before sign-out and ignore superseded bootstrap/error/logout outcomes. Keep the approved local copy.

Bind coordinated authentication refresh to its original session lifetime. Preserve same-account refresh sharing, storage lease/Web Locks, existing deadline and one 401 retry. Ignore old success/failure after a new sign-in, preserve a newer job, and do not adopt another persistent identity into a session-only sign-in. No backend authorisation changes: decoded token subject is only a cancellation label.

## Acceptance and limits

Existing required cross-device command: twelve actual conflict regressions plus thirty-six actual orchestration/SDK/recovery cases. Include switched read/write/conflict/error, queued saves, superseded hydration, metadata, sign-out, typed session expiry, wrong-owner reset/undo, stale confirmations, delayed Auth success/failure and overlapping refresh jobs. Controlled synthetic API fixtures use actual frozen SDK and native local persistence in mobile Chromium/WebKit; all service calls remain intercepted.

An old request already dispatched under A can still complete against A; this repair prevents applying it under B or sending subsequent A work with B’s session. It is not real two-device/Auth/RLS/revocation/physical-device proof, a per-account local-cache redesign, whole endpoint certification, customer erasure, or full sports certification. No source or generated sports data, database operation, new provider, scheduler, credential, polling or owner checklist.
