# Reviewed size exception for the exact 606 payload

Jack approved implementing this bounded exception on 2 November 2026 after
reviewing the measured excess. The approval and proposal identities are retained
in [the fixed record](../../scripts/fixtures/reviewed-feed-size-exception-606.json).
This source change authorises no publication or deployment.

The original normal production run `41362936666` failed its required size gate:
1.32% growth against the unchanged 1.25% limit. Keep that RED as genuine evidence.
Under Node `v24.22.1` / zlib `1.3.2.1-motley-285e94b`, the archived baseline
`e70de9a53543b0894ceaf6dbdff60569d47a9c87` measures 426,115 summed per-file gzip
bytes. Its original whole-byte ceiling is 431,441 bytes. The reviewed payload
measures 431,733 bytes: 292 bytes over that ceiling. It adds 467 gzip bytes over
live 605, with the same seven critical requests. These are static encoder-specific
measurements; no startup slowdown or physical iPhone behaviour is inferred.

The existing `validate-feed-performance.js` entrypoint now runs the focused
exception tests and measures a complete critical path/hash manifest from the
same bytes it compresses. Ordinary payloads still use the original 1.25% rule.
An over-budget payload can use this one source-controlled record only when the
complete seven-file manifest, raw total, request count, app version, baseline
ref/measurement, normal limit and Node/zlib identity match, and gzip is at most
431,733 bytes. There is no CLI/environment switch, rolling allowance, extra
headroom or baseline reset. Invalid or unavailable evidence refuses the exception.

Successful use emits `PASS_WITH_REVIEWED_SIZE_EXCEPTION`, the original ceiling
and the actual excess, after the existing gate assertions complete. It explicitly
says that the normal size rule did not pass. Runtime/build equality, packed
standings, first-page, image, branded-flight and all other existing assertions
remain in place. App, API, account, worker, runtime, style and fixture bytes are
unchanged by this policy-only source change.

Focused verification uses `node scripts/validate-feed-performance-size-exception.js`.
It covers exact acceptance, ordinary under/over-limit behaviour without an
exception, every mutated asset, wrong/missing/extra/duplicate paths, byte/request
overages, and wrong baseline/version/toolchain. The source owner also qualifies
the helper against the genuine baseline/current asset snapshots through the
existing bounded offline test lane. This focused result does not substitute for
the full production gate or for RELEASE's independent review and final metadata
binding. Previous app proofs transfer only where their actual inputs are unchanged.
