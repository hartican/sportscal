# Football source feasibility — 27 September 2026

## Initial gap and current status

Before release 322, the Champions League projection contained 13 records including old qualification fixtures and unresolved stage fixtures; the canonical file has no standings rows. At that point Europa League had no approved operational fixture adapter. Release 322 (dfe9cb9) shipped 144 actual league-phase matches for each competition with verified production rendering; 6275d31 subsequently preserved 16 sourced venue records. Neither competition is certified. EPL has 380 published matches and a 20-club canonical table, but these counts alone do not prove accuracy or commercial permission.

## Official reference pages

- [UEFA Champions League fixture list](https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures/) — inspected 27 September; real league-phase matches are published. This contradicts treating bracket context as complete coverage.
- [UEFA Europa League fixture list](https://www.uefa.com/uefaeuropaleague/news/02a8-2174cafa5bb6-82bbc20c9b92-1000--2026-27-europa-league-all-the-league-phase-fixtures/) — inspected 27 September; real fixtures and results are available for reference.
- [UEFA terms](https://www.uefa.com/termsconditions/), section 6.2 — personal viewing permission does not cover a systematic NS fixture database; automated collection is expressly restricted. Public access is not proof of permission. No contact, purchase, signup or new scraping integration was performed.

## Recommended next action

Continue the bounded OpenLigaDB integration now that attribution, refresh recovery and source-to-screen checks have passed. Preserve existing aliases and saved actions. Do not invent clubs, opponents, results or precise start times to fill gaps.

## No-cost candidate: OpenLigaDB

The [official service](https://beta.openligadb.de/) exposes unauthenticated community-maintained data under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Live API responses checked at 11:18 UTC on 27 September contain 144 unique fixtures, 36 clubs and eight matchdays for each of `ucl/2026` and `uel2026/2026`. Each club has eight different opponents, four at home. Three completed results per competition agree with the organiser reference above; this is a sample, not full independent reconciliation.

`normalizeLeague` in `scripts/lib/openligadb-football.js` validates that scope, explicit UTC timestamps, club consistency, full-time result selection and contradictory states before producing provider facts. Elapsed time alone becomes unknown, never an invented live/final result. Source logos and unsupported enrichment are excluded. The reviewed identity map retains 46 existing NS IDs and explicitly maps all 72 clubs; unknown provider/name changes fail closed. Regression: `node scripts/validate-openligadb-football.js`.

The canonical refresh, Football/UCL projections, Follow directory, server Feed resolver and calendar catalogue now consume the reviewed dataset locally. It contains 144 named fixtures per competition; the UCL view also retains 12 historical/stage context records, so 156 records does not mean 156 current league-phase matches. Partial/total failures preserve last-good data and its original freshness. No separate scheduler or high-frequency live source registration is added. Release proof is recorded separately; repository implementation alone is not a shipped claim.

Card and calendar attribution link the complete normalized provider dataset at `data/providers/openligadb/football-2026-27.json`, including identity mappings. Results-off, four responsive widths, Follow consent, the Sydney DST boundary and last-good recovery have local regression coverage.

Australian Europa League viewing is explicitly resolved to [Stan's competition page](https://www.stan.com.au/watch/sport/football/uefa-europa-league), inspected 27 September, correcting the previous generic Paramount+ fallback. It is a competition destination; no direct fixture playback or replay availability is claimed.

## Publication boundary and remaining gates

ODbL permits commercial use subject to its conditions. Publish the independently retrievable provider-fact dataset and machine-readable transformations with attribution and licence links; show attribution on derived cards. Preserve the separation from private preferences and editorial. A folder name alone does not establish a legal exemption for combined derived data. Do not reuse source logos merely because the fixture database is open.

Release 323 standings and release 324 refresh repairs have exact-SHA READY/alias and live-browser proof. Remaining: independent full fixture reconciliation and final tie-break verification, stronger editorial/identity presentation, installed-device checks, measured routine refresh reliability and workload. Provider request limits and uptime guarantees are unverified, so do not add high-frequency live polling. No subscription, signup or purchase is needed for this trial.


## Derived standings — released in 323

Both 36-club tables are derived from the same validated completed matches, adding no provider requests. Points, played, wins/draws/losses and goals were reconciled for all 72 clubs against OpenLigaDB's separate table endpoint; this is same-provider arithmetic validation, not independent accuracy certification. The published ODbL dataset includes these derived rows.

Interim ordering includes points, goal difference, goals, away goals, wins and away wins. Equal tuples share rank; display ordering uses NS names, which can differ from UEFA abbreviations. Final tables additionally consider opponents' collective points, goal difference and goals. Remaining final ties have no asserted rank because disciplinary and coefficient inputs are unavailable. No qualification/elimination labels are generated.

Rules checked 27 September: [UEFA Champions League explanation](https://www.uefa.com/uefachampionsleague/news/0291-1bd88ae04870-e1e038c319e3-1000--champions-league-league-phase-standings-how-teams-level-on-/), [UEFA Europa League explanation](https://www.uefa.com/uefaeuropaleague/news/02a9-219e607cbaee-b25232b1c986-1000--europa-league-league-phase-standings-how-teams-level-on-/). These are rule references, not scraped data feeds. Visible tables are labelled provisional and community-derived, include source/date links and remain behind the existing Results-off reveal control.

## Visible source context — shell 327

European Football Feed and Schedule cards show validated league-phase matchday and an absolute source-check timestamp in Sydney time, alongside the existing provider/licence/dataset links. Unknown or invalid round/date fields are omitted. This is source observation time, not a claim of live scores or independent accuracy. The footer has compact readable styling, 24-pixel link targets and visible keyboard focus. Browser coverage includes both competitions, both surfaces, four widths and day/night; 326→327 cached-shell upgrade preserves preferences and offline fallback. This does not complete editorial, fixture-truth or full competition certification.

## Reference reconciliation — 28 September Sydney

The dated [reference reconciliation](football-reference-reconciliation-2026-09-28.md) compares all 668 fixture identities in release 329: 380 EPL plus 144 each UCL/Europa. European matchdays and all 36 published results agree. EPL list/date/time comparison agrees after an explicitly resolved stale article duplicate and the separate final-day time announcement. EPL is a different publication from the same owner; European completed-match kickoff times and explicit UTC corroboration remain open. This supersedes the earlier three-result sample, not the remaining rights, results, quality or certification gates.
