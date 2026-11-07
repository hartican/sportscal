# Dependable Match Centre checks — 11 October 2026

The latest full update now carries the previously missing AFLW results correctly and passes the result checks. It then stopped at a Match Centre test that accidentally included current database data in a fixed sample. The test expected 15 cards on its second page and received 16. The rejected batch remains unpublished.

The scoped repair gives each test its own controlled sports data. It changes no app behaviour, match facts, source rules, database settings or release requirements. This reduces avoidable failed updates and unnecessary database reads during testing. It does not resolve the separately observed production database timeout.

## Evidence and limits

- Existing full owner [38120413885](https://github.com/hartican/sportscal/actions/runs/38120413885), source `0eeb740309b6c3fb7688052ef0aa29e894545662`, failed at **07:18:40 UTC** in `scripts/validate-match-centre.js`, with **16 !== 15**. The preceding default snapshot read reported a 3-second database timeout. Its discarded response does not identify the extra fixture.
- Before that failure, the actual owner recorded the same AFLW collection hash as the saved local complete-round comparison, zero playing records and zero incomplete finals. It projected **two newly completed cards per Feed surface**. Both unchanged result gates passed: **928 incoming and 927 published due cards, zero missing results**. Different totals reflect that run's inputs and retention; this does not certify every historical card or the whole sport.
- A private preload supplied an extra eligible fixture at the uncontrolled default snapshot boundary. The original test reproduced the exact **16 !== 15** failure and invoked that boundary twice. The corrected test passes with **zero default snapshot calls and zero external request attempts**. This proves a test isolation defect; it does not reconstruct the failed owner's discarded database response.
- Ordinary Match Centre validation, snapshot-scope validation and backend-efficiency validation pass. A bounded review of the six other factory-using checks found explicit snapshot controls for listing cases; selected-ID cases do not enter that listing read. This sampling does not certify all tests.

## Scoped change

`scripts/validate-match-centre.js` supplies an empty, healthy snapshot by default for its controlled cases. Cases that test real snapshot behaviour keep their explicit supplied samples. The complete-outage case now explicitly fails both read boundaries and asserts `membershipStale:true` alongside the existing no-cache assertion.

Existing page counts, limits, deadlines, fixture identity, freshness, source overlays, completed-match handling and stale-data assertions remain. No gate is removed or relaxed. Production handler and cached shell files remain unchanged. A failed intermediate candidate showed that an explicitly healthy membership snapshot is different from a complete outage; the final test models the complete outage accurately without changing production caching.

## Recommended next action

Publish this small test repair and run the existing full update once. Publish and deploy only the resulting fully passing snapshot through the normal release gates. Investigate any further failure at its demonstrated boundary before another broad run. Check ordinary overnight operation separately.

Business value: more dependable updates, less rework, and fewer test reads against production. Effort: one test boundary repair and affected checks, completed locally. Dependencies: the existing canonical owner and unchanged release gates. New cash commitment **A$0**; existing assistant, runner and hosting usage remains unpriced. Owner time: no new decision or routine. Acceptance: the controlled extra-fixture reproduction fails before and passes after; all affected assertions remain; the actual owner clears this gate; any fresh public batch has exact production proof. Confidence is high in the local diagnosis and repair; full-owner recovery and the production timeout's cause remain unverified.

No app deployment is needed merely for this test change. The app's last verified live snapshot is `d21b6cf1`, shell 492. Prepared baseball, tennis and racing descriptions still need a successful fresh publication. Football remains first, with **0/17 carried families and 0/3 Football pilots fully approved**, targeting at least **14/17 families**. These count complete approval checklists, not broken sports.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/match-centre-check-isolation-20261011` contains the before/after reproduction, controlled-read counts, intermediate-candidate observation and affected check logs. The sibling `aflw-result-recovery-20261011` contains the terminal full-owner metadata/log and source comparison. No rejected batch is replayed or published.
