# ROOT one-use push profile — source only

Setup correction2: prior GitHub run41031267055 failed workflow validation
BEFORE any job/runner/image/container/database work. The job-level NEAR_OUTPUT
used runner.temp where the runner context was unavailable. This profile removes
only that job-level setting and appends NEAR_OUTPUT in the first step using the
real shell $RUNNER_TEMP and ROOT-bound $NEAR_NONCE via $GITHUB_ENV. It preserves
the original first-step allocation timestamp, all core logic and every limit.

The old branch/packet/carrier/run/PR115 stay as dated evidence and must not be
rerun, reused, deleted or forced. The exact new first-use branch/path below are
distinct. ROOT must bind a fresh nonce and separate immutable packet/carrier
after targeted review. This is changed launch setup; no database performance
experiment has run, and no performance or NBL release retry is authorised here.

This supersedes only the launch/registration section of README.md. It does NOT
authorise a push, CI run, default-branch registration, main change, repo-rule
change, native/managed execution or production retry by this worker. The older
manual packet and its manifest 9d51e097 remain unchanged dated preparation.

The launch profile changes the adapter entry guard and adds push-binding.cjs.
It also incorporates the three specifically requested review fixes: interruption
can never retain PASS; native-client.close and final cleanup require confirmed
owned process exits; and original reproduction must show exactly one CTE receipt
scan of 4831 rows at 985 loops (4758535 visits), not the earlier 900-fold floor.
These are shown in the supplied targeted diff. No SQL, original factory/test
assertions, performance sample order/threshold, image/resource limits, deadline,
worker policy, source facts or retry policy changes. The wire marker/error/
command/query parser is byte-identical. Original packet9d51 remains untouched.

## ROOT binding order, before any allocated push

1. Confirm `codex/near-receipt-native-20261030-2` is absent on the remote. This
   profile allows only its first branch-creation push, before all-zero, created
   true, forced/deleted false, and run attempt 1. If it already exists, stop and
   report the binding problem. Do not delete/force/reuse it or broaden filters.
2. ROOT generates and records one random 32-lowercase-hex nonce. Substitute
   `__ROOT_32_HEX_NONCE__` in push-binding.cjs and the workflow template BEFORE
   freezing the packet. Do not use an example/recycled nonce.
3. Put this packet at `scripts/qa/near-receipt-join/` in ROOT's separate test
   capsule checkout, not in main. Keep the workflow template inside the packet;
   do not install the trigger in `.github/workflows` in this packet commit.
   Rebuild manifest.json over every packet file EXCEPT manifest.json itself,
   preserving sourceSha98af9164 and sorted file/sha256/bytes entries. Record the
   resulting manifest SHA256. Commit the frozen packet, record its full 40-hex
   SHA, and make that object available only by ROOT's existing test-capsule
   process. This worker has created neither a Git commit nor a remote ref.
4. In the carrier for the exact target branch, render a copy of the workflow
   template to `.github/workflows/near-receipt-native-20261030-2.yml`, replacing
   `__ROOT_IMMUTABLE_PACKET_SHA40__` with that earlier packet commit and
   `__ROOT_PACKET_MANIFEST_SHA256__` with its post-nonce manifest SHA256. The
   nonce is the same bound value. Do NOT edit the earlier packet to insert its
   own commit SHA; that would create a circular hash. The packet contains the
   template; the carrier contains the rendered trigger. Leave main unchanged.
5. ROOT's targeted reviews compare the three bound literals, packet manifest,
   nonce constant, source98af and action pins. Record the carrier's actual SHA
   before the one authorised ordinary push. Exact workflow/path trigger:
   branch `codex/near-receipt-native-20261030-2`, path only
   `.github/workflows/near-receipt-native-20261030-2.yml`. Do not dispatch manually,
   spoof GITHUB_EVENT_NAME, retry/rerun, change repository rules, or integrate
   this testing workflow into main. Only ROOT allocates the actual execution.

The source template deliberately fails while tokens remain. There is no
default nonce, moving packet ref, branch-name packet checkout or automatic
fallback. The supplied binding helper tests can use synthetic constants without
rendering or running the real adapter.

## Actual runner binding

The job and adapter accept only the genuine `push` context, exact repository,
owner, branch ref/name/type, workflow path/ref and first run. The GitHub push
payload must agree on repository, owner, fork false, created true, before zero,
after/head SHA, and non-forced/non-deleted status. GITHUB_WORKFLOW_SHA must equal
the actual carrier GITHUB_SHA; the workflow therefore comes from the same push.
The carrier SHA cannot be embedded literally in its own workflow without a
circular hash. ROOT records it before push, and the runner binds it to both the
actual GitHub event and workflow SHA.

ROOT's nonce is independently fixed in the earlier immutable packet code and
must match the carrier environment. The carrier's packet commit and manifest
hash are explicit immutable literals. Before any test/output/container work,
push-binding.cjs verifies clean separate checkouts at exactly that packet commit
and product source98af, expected directory roots, the reviewed manifest hash and
every packet file hash. Wrong/manual/moved-source/moved-packet/rerun/unbound
contexts fail before the frozen test body. Only read-only local event/Git/hash
checks precede that body.

No secrets references, production credentials, persistent checkout credentials,
publication or source refresh. Only the temporary contents-read GitHub job token
is used by checkout. Both checkouts explicitly set repository/ref/path and
persist-credentials false. The shared sportscal-production-and-cleanup lane and
cancel-in-progress false remain. ROOT-provided immutable actions are:

- checkout fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09
- setup-node a0853c24544627f65ddf259abe73b1d18a591444
- upload-artifact cf430e030ddbb5b0abf93d22962f4752f3646cd9

The native test still stops on the first unexpected failure/NO_REPRO, requires
both engines and all original qualifications, and reserves cleanup inside its
unchanged 600 seconds. A profile test, YAML/source review or CI start is not
native qualification or permission for a managed install/release retry.
