# Required SQL checks before the sole publisher

Base: `537ae85b0e5c8029ba6ec850ec91c93df86e9df5` (596). This is a workflow-only
repair, not a change to that application's loading, scores, Follow or settings.

Normal production run `40437584188`, job `121969868362`, exhausted its existing
30-minute job limit before deployment. The retained complete job log ends with
the PG18 grouped-view check passing at 02:46:45 UTC and cancellation at 02:47:54
UTC during the remaining tail. It contains no preceding failed assertion. This
does not establish that the uncompleted checks pass. Do not redispatch the old
snapshot or represent the timeout as a passing release.

## Change and dependency audit

Move exactly seven existing literal invocations into one prerequisite matrix:

| Matrix batch | Unchanged invocations |
| --- | --- |
| canonical-context | `validate-canonical-context-batch.js`, default PG18 and explicit PG17 |
| near-selection | `validate-match-centre-near-selection.js`, default PG18 and explicit PG17 |
| grouped-view | `validate-grouped-fixture-view.js`, default PG18 and explicit PG17 |
| grouped-diagnostic | `validate-grouped-fixture-diagnostic.js`, explicit PG17 |

Each invocation starts its own Node process. `fixture-read-test-baseline.js`
calls `validate-profile-fixture-scope.js`'s `database()`, which constructs a new
`PGlite()` with no persistent directory or service connection. It recreates the
historical schema and verifies the pinned migration/helper contracts from
committed source. Near selection then explicitly installs and verifies its own
coalesced writer through `near-selection-test-database.js`; it does not depend
on another invocation installing it. The grouped view and diagnostic similarly
construct their own databases. Their factories and validators are unchanged.

The only required filesystem output is near selection's original absolute
`$RUNNER_TEMP/near-selection-pg18` or `near-selection-pg17` directory. No later
publisher command reads those directories. Upload them from their owning matrix
job, including on failure. Other output paths are explicit optional environment
variables not set by this workflow. Database facts, roles, test writes and inverses
are confined to each disposable in-memory instance and closed by its validator.

## Preserved safeguards

- All original 258 command occurrences, including the duplicate reminder checks,
  remain: seven in the matrix and 251 in their original publisher order and
  environment. No other validator moves or changes.
- All four matrix instances must succeed through the publisher's unconditional
  `needs: [sql-safety]`. A failed batch blocks deployment. `fail-fast: false`
  retains independent failure evidence; it does not soften failures or retry.
- Workers and publisher independently validate the full requested SHA against
  `origin/main` before detaching at that SHA. Workers use Node 24 and `npm ci`,
  have no production service/hosting keys, and execute only fixed commands.
- Workflow serialization and `cancel-in-progress: false` are unchanged. Every
  job still has the same 30-minute limit; request deadlines, fixture caps,
  assertions, live qualifications, permissions, publication and public checks
  are unchanged. There remains one deployment job.
- Each relocated command has its own named step and an EXIT timing/status log.
  An unsuccessful command preserves its exit code. There is no general runner,
  evaluation of user input, new scheduler, database setting or migration.

## Pure regression check and acceptance boundary

`node scripts/validate-production-sql-batches.js` checks the actual workflow
against the hash-pinned original 258-command manifest. It also pins the original
workflow header and publisher scaffolding so unrelated gates cannot disappear
in the rearrangement. The production publisher runs this additional pure check
before its original 251 commands. Sixteen mutation controls cover lost/duplicate
commands, order, PG versions, evidence paths, missing batches/dependencies,
failure suppression, SHA binding, secret exposure, deadline/concurrency changes
and removal of the live or arrangement gate.

The original serial workflow fails this pure check; the candidate passes. This
check imports no SQL engine, runs no validators and makes no service requests.
Independent YAML parsing and `bash -n` validate the source syntax only. Local
verification is below the allocated 15-second pure-test budget. SQL/native,
installed, hosted, managed and full release checks were not rerun by this owner.

Future intentional safety-list changes require an explicitly reviewed manifest
and pin update; never regenerate the manifest from the candidate automatically.
Four matrix workers add setup overhead and CI runner use. Actual full-workflow
duration remains unmeasured until DEPLOY runs the changed exact-main snapshot.
There is no guarantee that another slow command cannot exhaust the publisher's
unchanged limit; any required failure must still stop that release.

Rollback is the inverse of this workflow/source-only commit, restoring the
original serial check arrangement. It changes no application or database state.
DEPLOY owns both review axes, integration, the next normal production run and
all exact-snapshot deployment/served/runtime acceptance. This draft is Working.
