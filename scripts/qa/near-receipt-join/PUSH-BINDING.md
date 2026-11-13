# ROOT one exact fast-forward update — source only

ROOT's latest workflow decision supersedes first-creation-only launch wording
in historical packets. Keep draft PR117, exact existing branch
`codex/near-receipt-native-20261030-3` and workflow path
`.github/workflows/near-receipt-native-20261030-3.yml`. Do not create another test
PR/branch, delete/recreate/force that ref, or rerun the old job. No default-branch
registration or repo-rule change. This worker prepares source only.

Independent expected prior carrier, fixed in both packet code and workflow:
`1404cd81abcc86c430f81a1bbeebb2205edf75a0`.

## ROOT binding order after targeted review

1. ROOT verifies the remote exact ref still points at that prior carrier. If it
   differs, stop; do not substitute a moving/new before value or force the ref.
2. ROOT generates and records a fresh random32-hex nonce; replace only nonce
   tokens in packet binding code/workflow template. Put the reviewed packet at
   scripts/qa/near-receipt-join in ROOT's isolated test capsule. Rebuild its
   manifest over every packet file except manifest.json, and record its SHA256.
3. Parent the new immutable packet commit on the prior carrier. Then parent the
   final carrier on that packet. In only the carrier's active workflow render
   the earlier immutable packet commit and its post-nonce manifest SHA256 into
   the two tokens. Never insert a packet commit's own SHA into itself. Keep the
   template frozen inside the packet; do not edit it after recording its SHA.
4. ROOT reviews literals, records packet/manifest/carrier hashes, and alone
   allocates one ordinary fast-forward push of the final carrier to that same
   branch. No worker push, CI call, Docker/native/managed access, unchanged
   performance/NBL retry or product release is authorised by preparation.

The genuine push must have created=false, before exactly the fixed prior carrier,
forced/deleted=false, run_attempt1, after/head/workflow-SHA agreement, exact
repository/owner/ref/path, and fresh ROOT nonce. Actual workflow SHA equals the
pushed carrier; ROOT records that SHA before pushing (embedding it in its own
file would be circular). The independently fixed before prevents another
ordinary push from replaying this allocation; reruns are explicitly refused.

The carrier points to a separate immutable packet snapshot and source98af9164.
Before any output/test/container work, the packet checks actual event,
independently bound nonce, exact clean packet/source Git heads/directory roots,
reviewed manifest hash and every packet file hash. No moving ref or fallback,
GITHUB_EVENT_NAME override, warning/error stripping or weakened guard.
An unbound template cannot run.

Corrected NEAR_OUTPUT remains set by the first step's real RUNNER_TEMP and
NEAR_NONCE through GITHUB_ENV after the unchanged allocation timestamp. No
job-level runner context. Same contents-read permission, no secrets references,
both checkouts persist-credentials=false, shared sportscal-production-and-cleanup
concurrency and cancel-in-progress=false. ROOT's immutable actions remain:

- checkout fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09
- setup-node a0853c24544627f65ddf259abe73b1d18a591444
- upload-artifact cf430e030ddbb5b0abf93d22962f4752f3646cd9

See ORDERED-WIRE-DIAGNOSIS.md for the narrow wire/diagnostic correction. Source
controls are not a successful native test. All old packets, failures and partial
proof remain immutable. Original SQL, full equality, both engines, permissions,
inverse/functional/20%/5s1s/600s60s and normal release/hosted/device gates remain
required. ROOT alone allocates the changed test and publishes.
