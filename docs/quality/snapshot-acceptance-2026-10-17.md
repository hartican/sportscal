# Nothing Sport v564: production acceptance repaired

17 October 2026, Australia/Sydney. **Accepted app 564: `96e24610c8bfb5b886e0ada302aec67623016a31`.** [Successful workflow 38994553358](https://github.com/hartican/sportscal/actions/runs/38994553358) · [Live site](https://nothingsport.vercel.app).

Match Centre and profiles can load complete current data without a large saved Feed holding up ready responses. Sporting facts, saved choices, the A-League repair and the World Cup saved-card correction are preserved. Audit retained the single publishing lane.

## What caused the failures

Two costs combined. The database repeated selection and participant-integrity work. Its recursive estimate also selected a wide full-fixture hash before narrowing the matches, spilling work to temporary storage. The guarded SQL repair prepares unchanged scalar selection/integrity inputs once, selects narrow keys first and loads complete records at final projection. Global and selected readers remain unchanged. All result fields, explicit nulls, zero scores, IDs, source clocks, context and five integrity checks remain protected.

Production 563 then revealed a second bottleneck: a normal Feed spent 10.29 seconds checking eligibility and 2.84 seconds resolving fixtures. A concurrent profile's five-second shared-read timer fired after 16.94 seconds. Same-runtime starvation is an inference from the overlapping logs, not a confirmed shared-instance trace. A local actual-handler replay reproduced the matching cause: 700 saved actions within 339 KB delayed a five-second snapshot to 6368 ms and stale. The repair indexes saved-action aliases/semantic matches once per request, avoids redundant Follow expansion and yields between 16-row batches so ready I/O and deadlines can run. The complete normal Feed response remains byte-identical. No permanent/private cross-account cache or extra database/source request was added.

The verifier now reports actual degraded snapshot membership before checking healthy-path timing, so a timeout is no longer obscured by “must retain merge timing”. Regression coverage retains fail-closed stale membership, meaningful error details and healthy timing completeness. No retry or gate was removed.

## Approved loading behaviour

The owner separately approved **five seconds total for interactive Match Centre/profile shared reads**, with immediate accessible loading feedback and existing scores retained. Parsing, projection and compatibility fallback share the budget; it is not a guarantee for the whole HTTP request. Global/default/selected/background/reminder reads stay at three seconds. Earlier three-second failures remain failed. This approval and the actual query/CPU repairs are separate changes, both disclosed.

An affected Safari check also caught idle preparation requesting an older Match Centre UI than direct navigation, initialising its private state twice. The two existing paths and installed cache now share one exact URL; a red/green browser regression and static binding check guard the repair. No second loader/state owner was added.

## Acceptance evidence

| Gate | Final result |
|---|---|
| Normal exact-SHA workflow | 38994553358: success, all 224 safety commands plus shared-input, deployment, public acceptance and security gates |
| Actual SQL regressions |99 checks: complete ordered equality, null/zero/clocks, context, five integrity checks, corruption, capacity, permissions and guarded restoration |
| CPU/choice regression |85 checks over 6573 catalogue records and 200 saved actions; ordering, timestamp ties, purge/direct/semantic precedence, lazy error order, immutable choices and interleaved accounts |
| Actual route concurrency |700 controlled saved actions/339,144 bytes, unchanged pair of shared reads, healthy profile finishes before large Feed, complete normal Feed output agrees |
| Fresh production protocol |Four rounds 40 seconds apart, 16 requests, stop-first-failure/no retries. Membership snapshot 1,246–2,038 ms, participant phases 761–1,269 ms, compact selected reads 50–189 ms |
| Measured headroom |Every interactive phase ≤4,000 ms within 5,000 ms; every selected phase <2,500 ms within 3,000 ms. No stale membership accepted |
| Exact production |READY/releaseGitSha, three aliases, 13 served hashes and configured function properties agree with published SHA |
| Security headers |All seven required routes passed in the normal workflow |
| A-League live rendering |Eight Chrome/WebKit cases,320/1280 widths and both themes: all 12 searchable clubs and156 Schedule fixtures, isolated Follow/reload retained |
| Changed runtime/UI |Fresh563→564 installed/offline rehearsals in both engines; Match Centre, refresh, profile and accessible delayed-loading browser suites passed at final SHA |
| Database boundary |Fresh metadata-only inspection confirms expected four function fingerprints, stable/invoker/empty search path/postgres ownership and effective service-only execution |

The fresh reads include an actually selected listed fixture, with source-observation staleness recorded separately. API success does not certify every sporting fact as current. Healthy quiet profiles can return zero matches. Four rounds are bounded evidence, not load testing, guaranteed cold-server performance or physical-iPhone proof. Exact token, runner, billing and customer performance savings were not measured.

## Failed evidence retained

- Original38975943569: fixture-bundle504 at 22:36:46 UTC,3073 ms against 3000 ms; another participant timeout 22:48:09. Real failure, obscured by the verifier's later assertion.
- First repair38985021841: normal green, but fresh round2 failed3004ms; held. The installed next-query3s preflight also failed57014. One8s diagnostic explained the actual plan; it was never production acceptance.
- Approved5s installed preflight returned 423 complete rows / 1,368,316 bytes in 3226 ms. This was a read preflight, not end-to-end reliability proof.
- 38990411036 stopped before deployment because functional transport mocks still expected3s on approved5s interactive calls. Corrected mocks retain exact 5 s interactive / 3 s default/global/compact and real stalled-body cancellation coverage. No product gate was waived.
- 38991228496 deployed563 and passed the normal gate, but fresh round 2 request 7 failed before 15 s headers. Its runtime evidence led to the CPU/cooperative repair. It remains held, not relabelled accepted.

All failed receipts remain in attempt-1, attempt-2-predeploy and attempt-3-live563. One earlier local reporting-path/command-sequencing error is retained in attempt3's manifest; no dirty source entered that published commit. This candidate was frozen from a clean isolated checkout, with dependent publication steps stopping on failure.

## Preserved journeys and open limits

The original-profile World Cup saved card opened the official destination and advancing desktop footage at 562 (about 1.73→50.92 seconds; no app highlight-resolver request). Its four original files remain hash-verified, separately dated. Schedule/media bytes are unchanged. The runtime/shell changed, so the old whole-shell proof is not relabelled564; new controlled installed/browser checks cover the retained behaviour. Fresh original-profile 564 playback, physical iPhone, uninterrupted playback and new authenticated cross-device sync remain unverified. Earlier 561 signed-in A-League proof remains separately dated; the new hosted cases use disposable contexts and injected API failures.

No new source refresh, provider allowance, scheduler, migration beyond the two guarded query repairs, account write, service purchase or subscription was introduced. The original dirty checkout was preserved. Spec and Standards independently report CLEAR for the CPU delta; earlier SQL review's minor duplicated predicate remains a nonblocking maintenance judgement.

## Value and next owner

**Business value:** fewer avoidable degraded loads, retained trusted scores and truthful release failures. **Effort:** bounded query/verifier/loading and Feed-processing changes, without a rewrite. **Dependencies/acceptance:** unchanged semantics/privacy, source reviews, normal 224-command workflow, security 7, fresh 16 reads and A-League 12/156. **New purchases:** A$0; existing usage costs are unmeasured. **Owner time:** no new recurring tracker or decision. **Why act now:** the observed failure blocked release acceptance; a larger rewrite or new service lacks supporting evidence.

Audit coordinated with “Plan cross-sport fixture reminders” as read-only adviser and kept sole repair/publication ownership. “Diagnose recurring failures” remains on its separate ENOBUFS refresh-wrapper repair and subsequent canonical-refresh verification; it is not part of this app snapshot. Whole-sport approval remains0/18families and0/3Football pilots. This closes the failed-release repair only.

Evidence: [Release identity](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/production-proof.json) · [Fresh live reads](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/repeated-reads.json) · [Final browser proof](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/affected-browser-564.json) · [Security headers](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/pipeline/security-headers.json) · [Retained saved-card proof](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/retained-worldcup-and-coverage.json) · [Spec review](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/spec-cpu.md) · [Standards review](/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-acceptance-20261017/standards-cpu.md). Also: profile-round2-runtime-evidence.json, feed-profile-baseline.json/repaired.json, feed-cpu-baseline-activity.json/repaired-activity.json, final-installed-metadata.json, frozen-candidate.json and both pwa-563-564 logs.
