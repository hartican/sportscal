# Release-owned application loading check

This source-only change adds a read-only performance gate to the existing
Sportscal production publisher. It runs after that step's existing shared
publication and erasure checks, before project preparation or deployment, using
only the Supabase URL/secret already scoped to that step. It adds no job,
workflow, permission, credential, data endpoint, provider collection or scheduler.
The existing 252 safety commands remain; one memory-only validator makes 253.

`verify-near-app-adapter.js` is inert by default. Its explicit `--live-read`
entry requires the manual production workflow, main ref, repository/job and
matching input SHA/GITHUB_SHA/clean local HEAD/origin-main. It derives the genuine
current public catalogue membership using the existing model, preserving all
published identity aliases and a genuine empty membership. It reads no accounts,
preferences, private follows or notifications.

The qualifier reuses the existing application's `createSnapshotStore` and
`supabaseServiceRequest`. Each of two sequential ordinary reads makes only the
existing concurrent health and Match Centre bundle calls. Each read preserves
the normal five-second policy and must finish all delivery, text/JSON parsing,
validation, projection and consumer work within 4,000 ms. No legacy fallback,
third request, retry or replacement empty input can pass. Both complete bodies
must have successful JSON transport observations and be at most 4 MiB. The full
bundle must be complete and every bundle source/fixture identity must survive
health/consumer projection; a genuinely empty bundle and health are valid.

An absolute sixty-second outer window, abort signal, six-second remaining
admission requirement and completion-expiry checks bound the two-read protocol.
A deadline cancels its owned requests and cannot become a late PASS. The normal
release artifact directory receives one exclusively claimed bounded receipt,
including failure/in-flight timing evidence. Reports contain only safe phase
observations, status/fixed failure code, counts and parsed-value hashes. They
contain no keys, response payloads, source/fixture IDs or raw error messages.
No new library or native process/framework is introduced.

The first label means the first OWN application-adapter read at that release
stage. ROOT's earlier functional SQL has already touched buffers; HTTP pooling
may choose another backend. These are not cold-server, first-ever stored RPC,
same-backend warm, literal wire hash or dual-body-download claims. Full ordered
SERVER byte equality remains ROOT's separate same-statement D9/current check.
Managed source-first <=256 preparation, original7 facts/catalogue/history-header/
sequence preservation, near readiness and 450 MB capacity remain separate ROOT
gates before publication. The gate does not perform DDL or source preparation.

A failed performance check stops before deployment. Main publication is not
production acceptance; ROOT retains exact guarded inverse/recovery decisions.
After passing deployment, the existing public/security/served/hosted/repeated20
and physical-device gates remain distinct. This module needs ZERO provider/card
refresh and does not resume any paused automation.

The memory validator reuses ROOT's ten actual parser/store/protocol cases and
adds CI-boundary, default-inert, outer abort, failure privacy and workflow-order
controls. ROOT alone reviews, integrates, publishes and runs the live gate.
Rollback of this CI-only slice is its scoped source commit; do not remove the
gate to describe a failing deployment as passed or confuse that with the guarded
near-schema inverse. No live performance measurement has occurred in this chat.
