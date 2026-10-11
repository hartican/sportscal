# Hockey update dates — 11 October 2026

The next full update stopped because the hockey table appeared to have been published after the app had checked it. The live site kept its previous good data. A fresh public read now passes the same check. The earlier response was not saved, so its cause remains unknown.

The small change makes a repeat failure explain all three dates: the league's publication, our completed table read, and later processing. It changes no scores, dates, acceptance rule or user setting. This improves diagnosis; it does not claim to fix the external mismatch.

## Evidence and diagnosis

- Full owner [38118582159](https://github.com/hartican/sportscal/actions/runs/38118582159), source `a8f26832fe21a3e5723c344e7c2573db1feebfa2`, failed at 06:38:49 UTC in the existing shared NHL standings parser with `table published after observation`. No new sports batch was published. The WRC standings timeout remains a separate retained-source exception.
- The parser separately rejects a publication after the processing clock, then rejects a publication after the original table-read clock. This failure reached the second check. Exact source/read values are absent from the old error; neither source skew nor runner skew is proved.
- One completed read of the [existing official NHL table](https://api-web.nhle.com/v1/standings/now), following its explicit redirect to the dated resource, finished at **06:41:48.085 UTC**. Its publication was **06:41:45 UTC**, 3.085 seconds earlier, with 32 current-season rows. The unchanged parser accepts all 32. Twenty-eight rows differ from the retained match totals and remain explicitly stale in this private comparison; this was not a full league refresh or production publication.
- The first native reader did not follow the HTTP 307 and saved an empty body. That observer error and headers are retained. The completed observation followed the explicit redirect with TLS verification and a 20-second deadline; there was no source retry or guessed endpoint.

Ranked explanations were a clock mismatch, an incorrectly early observation, and mixed responses. A deterministic controlled replay reproduces the exact old rejection with publication one millisecond after the table observation, while processing happens ten seconds later. The actual full owner records the table time **after** its completed response; a separate regression advances later club reads and confirms they cannot renew that earlier table time. Another complete-response regression accepts a publication during the request and retains independent table/club observations. These tests rule out those specific caller mistakes in the reviewed code, not an unrecorded historical runner or provider fault.

## Scoped implementation and validation

`scripts/lib/nhl-results.js` adds independently labelled, validated UTC clocks to this existing error. The publication/observation/validation checks are unchanged, including the one-millisecond rejection. Invalid clocks still fail before formatting. `scripts/validate-nhl-results.js` adds the direct rejection and the actual complete full-owner timing scenarios to its existing gate. No new gate, report schema, provider request, retry, scheduler, database change, cached shell, subscription or owner routine is added.

The new diagnostic assertion fails against the old message and passes after the change. The complete existing NHL results/live checks, backend-efficiency check and refresh-resilience check pass locally. They retain IDs, original source dates, unchanged file bytes, finals, zero scores, corrections and last-good failure behaviour. Public source reads and private controlled tests do not establish a new live release, full-owner recovery, ordinary overnight reliability or actual-phone use. The complete normal release checks remain required.

## Recommended next action

Publish the passing scoped diagnostic, then run one fresh full update through the existing owner. Verify the exact published snapshot and live release if it succeeds; use the newly specific error before another repair or rerun if it fails. Observe an ordinary scheduled publication separately. Do not relax the timestamp rule or invent a clock adjustment from this evidence.

Business value: a recurring source failure becomes actionable without another owner decision or a broad investigation. Effort: a small diagnostic and two existing-owner timing scenarios. Dependencies: existing official source, canonical owner and release safeguards. New cash commitment **A$0**; assistant, runner and hosting usage remain unpriced. Owner time: no new routine. Acceptance: valid data is unchanged; late publications still fail closed with the three actual clocks; source/fixture observations remain independent; normal checks and exact release proof pass. Confidence is high in the diagnostic and tested boundaries; the earlier external cause remains unverified. Defer tolerance, retries, source replacement and a rewrite until evidence justifies them.

Football stays first. Full approval remains **0/17 carried families and 0/3 Football pilots**, targeting at least **14/17 families**. These are complete-checklist counts, not broken-sport counts. The checked Shanghai viewing repair remains live; the prepared baseball, tennis and racing background still needs a successful full publication.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/nhl-table-observation-20261011`, including the dated source/hash/headers, actual parser replay, old-message rejection, failing/passing regression logs and affected checks. The previous full result gap and confirmed AFLW final are retained separately in `aflw-result-recovery-20261011` and `shanghai-viewing-recovery-20261011`. No historical source observation is renewed by this diagnosis.
