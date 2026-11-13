# Connection-only correction — unrun source packet

ROOT run41032332223 failed after29389ms. Its result says the first response began
with a warning and could not be decoded as JSON. No QA database ledger entry,
workload, plan, equality or ABBA evidence exists; PG18 was not reached. Cleanup
confirmed the container and all14 owned host children. Original result SHA256
63a261ea473da571e0981f3e186c2e8a3cf4afc92b935f4d2da602e5c965fac5 remains in
native-qualification-2/artifacts/result.json, not overwritten by this diagnosis.

The old client explicitly set PGPASSFILE=/dev/null and merged stderr/stdout.
The upstream release sources perform password-file lookup during connection
setup. They reject non-regular files with a stderr warning, and reject group/
world-accessible files. PG17 checks stat before opening; PG18 opens then checks
fstat. Both silently ignore an unavailable file and accept an empty regular file
with restrictive mode. This mechanism explains why a Unix-socket connection can
produce text before an otherwise valid query response. [PG17.6 source](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/interfaces/libpq/fe-connect.c),
[PG18.3 source](https://raw.githubusercontent.com/postgres/postgres/REL_18_3/src/interfaces/libpq/fe-connect.c).

PGSERVICEFILE=/dev/null is unchanged. Service-file parsing returns early when no
service is supplied; env-i does not set PGSERVICE and the command supplies no
service parameter. [PG17.6 service parsing](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/interfaces/libpq/fe-connect.c).

This is a source-supported probable cause, not reconstructed runtime proof.
The old artifact retained only the shortened warning prefix, and does not attest
the exact linked libpq package. Server/image pins alone do not establish that
package version. Source bytes for the two release tags were checked over HTTPS;
hashes and raw warning line positions are in parent libpq-passfile-source-review.json.
Web-rendered line numbers differ from raw source; use the recorded hashes/URLs.

## Narrow correction

Before the first client, the future allocated runner exclusively creates
`.nothingsport-native-empty.pgpass` inside that verified owned container's tmpfs
PGDATA, as postgres. Noclobber refuses an existing path; umask077 creates mode600.
Regular/non-symlink/zero-size/actual-UID/mode600 checks must all succeed. Only then
is verified path metadata recorded and used by Client. No password is stored.
If setup fails, there is no fallback; the original owned-container cleanup runs.
The file is destroyed with that tmpfs/container. No host mount or global file.

Strict JSON decoding still fails on known or unrelated warnings. It records only
bounded raw prefix/suffix (512 UTF16 code units each) and total output bytes on
failure. Both normal query and EXPLAIN JSON paths use this diagnostic decoder;
no text is removed to make warnings parse. Original NOTICE handling, SQLSTATE/
ERROR/FATAL/marker checks, first-failure retention and owned child exit rules
remain. SQL and successful decoded values are unchanged.

Pure controls cover valid JSON, known/unrelated/trailing warnings, diagnostic
bounds, unchanged SQLSTATE propagation and refusal before spawn if file metadata
is unverified. File creation is statically checked, not run. Existing protocol
controls and fresh event model remain. No Docker/native/database/CI/push/managed
test occurred here. ROOT alone reviews, binds a fresh nonce/immutable packet and
carrier for exact first-use -3, then may allocate execution. All old packets,
runs, PRs and original SQL/performance/release gates remain.
