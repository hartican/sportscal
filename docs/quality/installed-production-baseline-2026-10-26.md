# Bind installed-upgrade tests to the deployed starting version

Run40243896790 used unshipped PR base879/version595 as its installed baseline
while candidate app/worker595 bytes were identical. The validator deliberately
seeded two legacy records into that same current595 cache, then required the
upgrade to remove them. Both engines failed the cached:false assertion, before
the later transport reload/core-update controls. Preserve those failed results;
the earlier WebKit internal-error cause remains unproven. Do not bump a version,
delete the seeded records manually or relax any assertion to make this green.

## Pure local resolver; publisher supplies the factual record

`node scripts/resolve-installed-production-baseline.js` is inert without args.
Explicit `--resolve` reads only local Git/files, taking the COMMITTED fixed
`.github/installed-production-baseline.json` from actual HEAD. It rejects a
missing, symlink/executable, malformed or over16KiB record and ignores an
uncommitted replacement. It takes `NS_INSTALLED_PR_BASE_SHA` from ROOT's workflow
binding to the actual pull_request.base.sha; there is no CLI record path/URL,
SHA override, cloud read, secret, ancestry fallback or PR-base-as-live default.

The schema is exact, with unknown fields rejected:

| Field | Required value/type |
| --- | --- |
| schemaVersion | `installed-production-baseline.v1` |
| preparedForBaseSha | Lowercase40hex actual PR base |
| baselineSha | Lowercase40hex deployed source commit |
| baselineVersion | Digit-only canonical string, at most16 digits |
| deployment | Exact keys id, state, releaseGitSha, origin, checkedAt |
| deployment.id | `dpl_` plus1–80 alphanumeric characters |
| deployment.state | `READY` |
| deployment.releaseGitSha | Exact baselineSha |
| deployment.origin | `https://nothingsport.app`, the captured primary |
| deployment.checkedAt | Actual publisher check timestamp in UTC ISO format |
| files | Exact keys index.html, service-worker.js, app-version.json |
| Each files entry | Exact keys gitSha256, servedSha256, servedBytes, status, checkedAt |
| gitSha256 | SHA256 of RAW committed Git file bytes |
| servedSha256 / servedBytes | Actual body hash/byte count, matching the computed deployed form |
| status / checkedAt | Actual200 and actual body-check UTC timestamp |

Deployment and all three body timestamps must be nonfuture and at most24h old.
Changing the PR base requires publisher preparation again. ROOT must also
refresh the facts when production/deployment or relevant served inputs change;
the age/base tests cannot detect a newer deployment by themselves.

The resolver verifies baseline/base Git commits exist as exact commit objects,
baseline is an ancestor of the actual PR base, and that base is an ancestor of
the actual candidate HEAD. Record version must equal the baseline Git
app-version.json version and be STRICTLY OLDER than the candidate Git version.
Versions compare as BigInt, not rounded floating-point values. Source/proof
hashes and counts bind all three files to that exact baseline.

Transform semantics follow the BASELINE's committed
config/deployment-manifest.json and the existing materializer's rule: identity
for index/worker; JSON compaction only when compactJson is enabled and the JSON
file is not in preserveBytes. Missing or unsupported policy fails. Actual594
preserves app-version.json, whose raw bytes already happen to be compact; never
infer the transform from matching hashes alone or let the record choose it.

Only after validation does the resolver append `baseline_sha=<40hex>` to the
existing regular, non-symlink GITHUB_OUTPUT file. It creates no output path and
prints only aggregate validation metadata, not hashes/URLs/IDs/source content.
Failures print a fixed allowlisted code, without raw Git stderr, paths or error
contents. Invalid inputs cannot change the output. Default invocation does not
read the record, environment or Git.

## What this record does and does not attest

DEPLOY owns the factual record and current verification. ROOT's accepted
immutable deployment receipt40145997021 binds source1e025e/version594; its
current READY lookup reports the same deployment ID and fresh three-body hashes
match that source. Current Vercel lookup metadata redacts the SHA, so the record's
releaseGitSha is DEPLOY's binding across those retained proofs. It is not a
claim that the resolver independently saw a current cloud SHA field. The
resolver checks a committed preparation statement and local source agreement;
it does not authenticate cloud responses or establish current live freshness.
No factual record or production evidence is authored by this worker.

## ROOT-only wiring and acceptance

ROOT adds the record, prepares it for the actual PR base, and wires the existing
normal workflow. Run the pure `node scripts/validate-installed-production-baseline.js`
and the explicit resolver before the context/baseline-dependent browser steps.
Use validated GITHUB_OUTPUT baseline_sha consistently in context.json and
PWA_BASELINE_SHA; do not keep using pull_request.base.sha as installed baseline.
The existing full installed, All Sports and40 recovery cases, denyproxy,
deadlines/assertions,253 release gates and sole publisher remain unchanged.
ROOT alone owns workflow/path filters, one reviewed changed-source Linux run,
publication and exact-SHA release acceptance. This slice changes no harness,
worker, runtime, source cache, app version, scheduler or permission.

Pure tests use disposable synthetic Git/file records only: live594/unshipped
main595/candidate595, stale/wrong base, absent/wrong commit/ancestry/tag, equal
version, bad hashes/proof metadata/schema, preserved and compact JSON, missing/
unsupported policy, committed-only record, output privacy/no invalid writes,
symlinks, Git failure redaction and default inert. No browser, DNS, service,
provider, database, customer, CI run, factual record or deployment is involved.
Passing these tests is source preparation, not installed or live acceptance.
