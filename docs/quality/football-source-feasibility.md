# Football source feasibility — 27 September 2026

## Verified gap

Current Champions League projection contains 13 records including old qualification fixtures and unresolved stage fixtures; the canonical file has no standings rows. Europa League has no approved operational fixture adapter. Neither competition is certified. EPL has 380 published matches and a 20-club canonical table, but these counts alone do not prove accuracy or commercial permission.

## Official reference pages

- [UEFA Champions League fixture list](https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures/) — inspected 27 September; real league-phase matches are published. This contradicts treating bracket context as complete coverage.
- [UEFA Europa League fixture list](https://www.uefa.com/uefaeuropaleague/news/02a8-2174cafa5bb6-82bbc20c9b92-1000--2026-27-europa-league-all-the-league-phase-fixtures/) — inspected 27 September; real fixtures and results are available for reference.
- [UEFA terms](https://www.uefa.com/termsconditions/), section 6.2 — personal viewing permission does not cover a systematic NS fixture database; automated collection is expressly restricted. Public access is not proof of permission. No contact, purchase, signup or new scraping integration was performed.

## Recommended next action

Proceed with a bounded OpenLigaDB adapter trial, keeping it outside the live Feed until attribution, refresh recovery and source-to-screen checks pass. Preserve existing aliases and saved actions. Do not invent clubs, opponents, results or precise start times to fill gaps.

## No-cost candidate: OpenLigaDB

The [official service](https://beta.openligadb.de/) exposes unauthenticated community-maintained data under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Live API responses checked at 11:18 UTC on 27 September contain 144 unique fixtures, 36 clubs and eight matchdays for each of `ucl/2026` and `uel2026/2026`. Each club has eight different opponents, four at home. Three completed results per competition agree with the organiser reference above; this is a sample, not full independent reconciliation.

`normalizeLeague` in `scripts/lib/openligadb-football.js` validates that scope, explicit UTC timestamps, club consistency, full-time result selection and contradictory states before producing provider facts. Elapsed time alone becomes unknown, never an invented live/final result. Source logos and unsupported enrichment are excluded. The reviewed identity map retains 46 existing NS IDs and explicitly maps all 72 clubs; unknown provider/name changes fail closed. Regression: `node scripts/validate-openligadb-football.js`.

This is implemented parsing and identity preparation, **not production coverage**. Research responses and normalized candidates live under the dated delivery-report directory outside the served repository. No refresh scheduler or production source registration has been added yet.

## Publication boundary and remaining gates

ODbL permits commercial use subject to its conditions. Publish the independently retrievable provider-fact dataset and machine-readable transformations with attribution and licence links; show attribution on derived cards. Preserve the separation from private preferences and editorial. A folder name alone does not establish a legal exemption for combined derived data. Do not reuse source logos merely because the fixture database is open.

Remaining: canonical refresh registration with last-good recovery, public attribution/download boundary, full fixture reconciliation, Australian viewing evidence, Feed and Schedule consent/spoiler/timezone checks, real responsive rendering, and workload measurement. Provider request limits and uptime guarantees are unverified, so do not add high-frequency live polling. No subscription, signup or purchase is needed for this trial.
