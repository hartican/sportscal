# Viewing evidence review — 11 October 2026

The old viewing-source review correctly stopped a full sports update. A new, bounded manual review now uses selected dates from [Stan’s official public guide](https://www.stan.com.au/watch/sport). A separate bug is fixed: a listing with a date but no confirmed clock now keeps its time unknown instead of inventing midnight.

## Effect for people

This removes one full-update blocker and protects people from false times. It does not add matches, viewing options or competitions to their cards. Existing scores, fixture times, participants, saved choices and reminders stay unchanged.

## Evidence and limits

- Reviewed at 2026-10-10T23:30:09Z (11 October Sydney), using the approved `reviewed_export` contract. No page scraper, undocumented endpoint, credentials, subscription or scheduler was added.
- The selected sample contains eight competition-date listings and one studio programme, covering printed dates 11–18 October. The page’s displayed clock text did not establish a timezone in the reviewed content. No UTC times or individual participants were inferred. The late-night Premier League listing was withheld because the individual match and midnight rollover were unclear.
- The eight listings remain review candidates. None qualifies for publication. The studio programme is excluded. Seven other AU source adapters still have no approved discovery input; this is not evidence of complete Australian rights or working playback.
- Historical snapshots remain intact. New observations have their own date and checksum. Old facts were not relabelled as fresh.
- `node scripts/update-cards.js -p --broadcaster-review` uses the same scanner, freshness check and discovery regression as the full owner. Mixed refresh routes reject before dispatch. The existing full route and nine-day gate remain unchanged.
- A new regression first reproduced the invented midnight, then passed after correction for both an existing catalogue and an empty catalogue. The existing stale-source, exact-match, ambiguous-match, review/approval and protected-fixture checks continue to pass.
- Real canonical persistence produced eight date-only candidates, zero invented clocks and zero publishable candidates. Public/incoming fixtures, compact Follow fixtures, app version, HTML shell and service worker were byte-identical before and after the route.

## Remaining programme

This bounded recheck advances the earlier assessed sample from 90/92 to 91/92. It is not a new complete 92-check batch or a successful full refresh. The remaining venue check must be resolved against source evidence. Full-owner recovery, ordinary scheduled publication, physical-phone use and Football acceptance remain separate. No sport certification changes: 0/17 families and 0/3 Football pilots approved, with a target of at least 14/17 families.

## Delivery and operating cost

Local validation is complete. GitHub publication and production proof will be recorded after the normal release gates. Cash cost: $0 added. No owner decision or routine is added. The scoped review avoids a long provider refresh while retaining the canonical refresh owner and failure checks.

Detailed red/green logs, source-review receipt, persistence comparison and final release proof are saved under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-evidence-refresh-20261011`.
