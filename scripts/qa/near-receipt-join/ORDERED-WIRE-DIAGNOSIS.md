# Ordered native wire — source preparation only

ROOT run41034351827, result SHA256
c1d88e2e0a6e6e2d35fd3b80e6f86c056970e7bb46209f77f55e775059eccc15,
is a failed qualification with useful PARTIAL PG17 proof. It reproduced the
exact4831×985 receipt scan and reduced it to one scan, with no temp blocks. Full
ordered985-row/2563003-byte equality passed. ABBA medians829.8194215→273.4989035ms
improved67.0411542%, all sample hashes equal. Five negatives were recorded before
an unlabelled42501. Inverse, functional DB and PG18 were not completed. All16
owned children, exact QA DB/roles and container were cleaned. Do not promote this
to a full native, cold, HTTP, browser, release or phone pass.

The retained loading-narrow-native-prep-20261027/native-client.cjs merges psql's
stderr into stdout INSIDE the container. The later direct constructor removed
that property: two host streams append to the same string as their data events
arrive. Node documents separate stdout/stderr pipes. Treating those independent
events as one ordered command stream is therefore an unsafe assumption.
[Node24.21 child-process documentation](https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/child_process.md).

A pure control using the actual drain method demonstrates the failure class:
deliver the failed-read status marker first, then its delayed error text while
ROLLBACK is active. The read fails generically, and an actually successful
rollback marker is rejected using the delayed42501. Feeding the error and its
marker in one ordered stream instead attributes the denial correctly and leaves
the next rollback clean. This matches a possible explanation of the retained
failure, not proof of its historical byte sequence. Old raw stream timing and
failure phase were not retained; actual ACL correctness remains to be tested.

## Small correction

Restore only a fixed in-container shell wrapper, `exec "$@" 2>&1`, with the entire
existing explicit env/client/Unix-socket argument vector supplied positionally.
SQL still arrives on stdin and is never shell-interpolated. The wrapper has no
SQL, user text or generated command string. Shell exec replaces itself, and fd
duplication restores the retained constructor's single psql output channel.
[Debian bookworm dash manual](https://manpages.debian.org/bookworm/dash/dash.1.en.html).
Host Docker transport failures still fail; this does not suppress them.

ERROR/FATAL/SQLSTATE/marker tests remain strict, including an error paired with a
successful marker. No warning/error stripping, ACL/grant change, omitted role or
skipped denial. Unexpected SQL failures now retain the same bounded512-code-unit
prefix/suffix used for JSON failures, plus observed marker status. Native guard
labels distinguish schema privacy, statement, rollback, refusal assertion,
inverse, fact preservation and reapply. Major test stages are labelled too.
This adds diagnostics, not acceptance or retries.

Pure controls demonstrate reordered-frame contamination and test ordered frames
at every two-chunk boundary. They verify rollback stays clean, errors remain
fatal, diagnostic bounds, static positional wrapper, and phase recording. Prior
protocol/JSON/passfile controls remain. No shell program, Docker, psql, database,
CI, managed service or push was run here; shell syntax was checked only.

ROOT's later workflow decision retains PR117/exact -3 ref/path and allocates a
single future fast-forward from prior carrier06a2c5d73af16e3718d1fc9e5dfa99bfff83b6e3.
The packet fixes that before independently; created/forced/deleted/rerun/replay
contexts are rejected. Fresh ROOT nonce and immutable packet/manifest/carrier are
required after review. See PUSH-BINDING.md. All old failures and packets remain.
