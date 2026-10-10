# A sports-only manual update — 11 October 2026 Sydney

Manual sports updates now skip unrelated profile-picture cleanup. Regular scheduled maintenance keeps its current behaviour. This makes the existing updater suitable for refreshing results and tables within the authorised sports scope; it adds no owner task or spending.

The real workflow previously enabled its cleanup command for manual runs, including failed refreshes. That command deletes expired/replaced objects and cleanup rows. No customer query, cleanup or deletion was performed during this review. The change adds a scheduled-event condition to that one maintenance step. Refresh cadence, sources, encrypted credentials, deadlines, retries, publication, release gates and the single canonical owner remain unchanged.

The existing backend-efficiency release gate evaluates the actual workflow condition across twelve manual/scheduled/unknown-event, enabled/disabled-cadence and passed/failed-refresh combinations. It failed against the original workflow and passes after the scope repair. There is no app-shell, sports-fact or source-clock change in this repair, so unchanged app/browser/cache checks are not repeated. The next actual canonical refresh must pass its normal integration and release gates; manual success will not prove unattended operation.

| Recommendation | Business value and evidence | Effort and dependencies | Cash and owner time | Acceptance |
|---|---|---|---|---|
| Keep manual sports refresh within scope | Prevents an unrelated customer-storage operation; the actual old condition and cleanup implementation establish the issue | Small existing-workflow/test change; no new owner | A$0 new commitment; no recurring decision or task | Manual cleanup disabled; scheduled cleanup unchanged; twelve actual-condition cases pass |
| Refresh current results and tables through the current owner | Restores useful current cards; the dated read-only input check finds six overdue EPL records and F1 Qualifying | Existing quick canonical route, complete source validation and mandatory publication/release proof | Existing service costs; no purchase or operator checklist | Real source-backed updates, IDs and last-good facts retained; exact published production snapshot verified |
| Prove an ordinary scheduled update separately | Reduces future manual intervention | Observe a real scheduled run; investigate any concrete failure within existing budgets | No new schedule or paid tool | Actual unattended success and fresh published facts; manual runs cannot count |

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/manual-sports-refresh-20261011/`. Publication and the subsequent refresh receipt are pending. No sport or Football pilot is newly certified; full quality gates remain 0/17 families and 0/3 pilots.
