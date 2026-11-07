# European Football UTC reconciliation — 30 September 2026

## Verified outcome

All 288 league-phase fixtures in the current production snapshot agree with explicit organiser UTC kickoff timestamps: 144 Champions League and 144 Europa League. Each competition includes 18 completed matches and 126 upcoming matches. All 288 participant pairings, matchdays, UTC instants and Sydney date/time values reconcile with zero differences. This closes the historical-kickoff and explicit-UTC evidence gap for this dated snapshot. It does not certify either competition in full.

## Method and source

A read-only browser inspection of the official AEK Athens–LASK match page exposed the public match-data response with `kickOffTime.dateTime` ending in `Z`. The organiser fixture-list page exposed paginated season/competition queries. Six bounded list requests (three pages of 50/50/44 per competition) checked the September 2026–January 2027 league phases, with explicit competition IDs 1/14 and season year 2027. All 144 unique match IDs per competition were required. Club-name aliases are recorded explicitly, not fuzzy-matched, and each organiser pairing resolves to exactly one distinct NS fixture. Date/time comparisons use UTC instants and the Australia/Sydney time zone, covering European and Australian daylight-saving changes. The local venue offset in the source is not added to an already-UTC timestamp.

Sources: [UEFA match page](https://www.uefa.com/uefachampionsleague/match/2049558--aek-athens-vs-lask/), [Champions League fixture list](https://www.uefa.com/uefachampionsleague/fixtures-results/), [Europa League fixture list](https://www.uefa.com/uefaeuropaleague/fixtures-results/). Exact source query URLs, aliases and per-fixture comparisons are retained in `uefa-utc-reconciliation-2026-09-30.json` in the delivery folder. Only selected public match facts are retained, not an article, video or full API corpus. This is a one-off audit, not a new scheduled source integration or commercial permission.

## Production proof

At 2026-09-30T01:11:45.049Z, production was READY deployment `dpl_EvF5T4nNfAMqpm5qCqj67zg8LTPH`, exact release `47410f5f1ffd81fc7375b38f451ccd791b0dc887`. The public OpenLigaDB-derived file returned HTTP 200 and semantically matched the checked local file. Public SHA-256: `9b5e2079222e502f4d3bb1949a4519957d02232adf075993d9836078c2ebc226`. No fixture correction or runtime change was needed; this evidence-only update is published to GitHub without another deployment.

## Value, cost and remaining gates

Business value: resolves the risk that ambiguous CET labelling concealed incorrect Australian fixture times. Effort: a bounded read-only reconciliation. Additional cash and recurring request cost: zero. Owner action: none. Acceptance: complete 144-match sets in each competition, unique pairings, zero UTC/matchday/Sydney differences and matching production dataset. Confidence: high for the checked snapshot; future rescheduling is not covered.

The older 28 September report remains an accurate record of its narrower check; this document supersedes its open historical/UTC item. Final-round discipline/coefficient tie-breaks, fixture-specific viewing/replay evidence, physical installed-device acceptance, operational recovery and commercial permissions remain open. Zero of three Football pilots and zero of sixteen carried families are fully certified. Do not replace these remaining gates with the narrower timestamp success.
