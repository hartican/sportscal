# UEFA final ranking inputs — source assessment, 3 October 2026

This bounded, read-only review investigated the last two Article 18 inputs for the 2026/27 Champions League and Europa League league phases. Sources were observed on 3 October 2026 Australia/Sydney; the final time check was **2026-10-02 22:21:03 UTC**. No provider refresh, application change, database write, scheduler, account, purchase or publication was performed.

**Result:** the correct historical coefficient source and reference period are now demonstrated. A complete, reviewed 72-club coefficient dataset has not been validated. Whole-club league-phase disciplinary totals remain externally unverified. These findings do not certify either competition or justify resolving the existing final `Pending` ties.

Labels used below: **Verified** means directly observed in an official UEFA source or the named local snapshot; **Inferred** means a reasoned consequence needing implementation validation; **Unverified** means the necessary evidence was not obtained.

## 1. Sporting club coefficient

**Verified — reference period.** The authoritative 2026/27 regulation fixes the five-season club coefficient before the season starts, using **2021/22–2025/26 inclusive**. The association access-list period is different; the ten-season revenue period is also different. [UEFA Annex D.2](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/D.2-Reference-periods-for-rankings-Online?contentId=VAG91Yk8b_GKQP7xOpGXIA)

**Verified — calculation.** The club's applicable coefficient is the greater of its five season coefficients summed and 20% of its association's five-season coefficient. Each season follows that season's regulations. Recalculating all history with the latest bonus rules would therefore be unsafe. [UEFA Annex D.4](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/D.4-Club-coefficient-calculation-Online?contentId=FOOh6RppCk4IepHgN3eyHw)

**Verified — usable public historical view.** Browser observation of the [official club ranking page](https://www.uefa.com/nationalassociations/uefarankings/club/) showed:

| Selection | Observed URL | Displayed season columns | Consequence |
| --- | --- | --- | --- |
| Default Season 2026/27 | `?year=2027` | 22/23, 23/24, 24/25, 25/26, 26/27 | Contains current-season points; wrong reference period for this input |
| Selected Season 2025/26 | `?year=2026` | 21/22, 22/23, 23/24, 24/25, 25/26 | Matches Annex D.2 |

The correct view displayed **Last updated: 04/07/2026 00:22**; the page did not identify a time zone. Small numeric spot checks were Bayern München **147.500**, Real Madrid **144.500**, Liverpool **130.000** and Leverkusen **105.000**. Their displayed five-season values sum to those totals. The default view instead showed Bayern **129.500**, demonstrating the material season difference. These are evidence examples, not a copied full table. [Historical official table](https://www.uefa.com/nationalassociations/uefarankings/club/?year=2026)

**Verified — bounded coverage.** The historical view initially exposed ten rows; one click on its visible “View full rankings” control exposed rows 11–20. Sixteen of the first twenty club names are plausible matches to the current NS UCL/Europa rosters. That is a candidate-coverage observation, not validation of sixteen canonical identity mappings. No repeated expansion, full crawl or complete roster lookup was attempted. The page displayed separate `Pts` and `NA` columns; interpreting the latter for a production import still needs its explicit field definition, particularly when the association minimum exceeds a club's own points. [Historical official table](https://www.uefa.com/nationalassociations/uefarankings/club/?year=2026)

**Verified — local identity gap.** The inspected `data/providers/openligadb/football-2026-27.json` contains 72 unique NS club IDs. Team fields are `providerId`, `sourceName`, `participantId` and `name`; `providerId` belongs to OpenLigaDB. No UEFA club ID, coefficient or disciplinary field was found in this normalized snapshot. UEFA's displayed abbreviations differ from NS names: examples requiring explicit review include Bayern München/Bayern Munich, Paris/Paris Saint-Germain, Inter/Internazionale, Roma/AS Roma, B. Dortmund/Borussia Dortmund, Atleti/Atlético Madrid and Leverkusen/Bayer Leverkusen. Do not join on rank, row order or fuzzy name alone. [Local data](../../data/providers/openligadb/football-2026-27.json), [official historical names](https://www.uefa.com/nationalassociations/uefarankings/club/?year=2026)

**Unverified.** Values and association-minimum treatment for every one of the 72 clubs; official stable club identifiers and the complete one-to-one map; a documented first-party export/API contract; reuse/redistribution permission; availability or correction behaviour of this historical view over time. Public browser accessibility does not establish those permissions or contracts.

## 2. League-phase disciplinary points

**Verified — Champions League rule.** Article 18.01 puts discipline after opponent performance and before the coefficient. It covers **players and team officials in all league-phase matches**: yellow **1**, direct red **3**, two-yellow expulsion **3**. Player-only counts are insufficient; qualifying, play-off and knockout cards are outside this scope. [2026/27 UCL Article 18](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-18-Equality-of-points-league-phase-Online)

**Inferred — normalization boundary.** A two-yellow expulsion is one three-point outcome per recipient/match, rather than two yellows plus a red totalling five. A separate yellow plus a direct red suggests four by arithmetic; no official worked example or source schema was obtained. Require distinct direct-red/second-yellow semantics and documented counter overlap before using `yellowCount + 3 * redCount`. [Rule being interpreted](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-18-Equality-of-points-league-phase-Online)

**Verified — access result.** The supplied [UCL team-statistics URL](https://www.uefa.com/uefachampionsleague/statistics/teams/) was inaccessible through the text tool and rendered UEFA's own **Error 404** page in the browser. It yielded no disciplinary rows, coverage definition, match/club IDs or update timestamp. This proves that this URL was unusable in this review; it does not prove that UEFA publishes no disciplinary data elsewhere.

**Verified — Europa rule, subsequent parent read.** The delegated Annex D fetch timed out. A separate 3 October parent read then obtained the official [2026/27 Europa Article 18](https://documents.uefa.com/r/Regulations-of-the-UEFA-Europa-League-2026/27/Article-18-Equality-of-points-league-phase-Online), edition 2026/27, enforced 29 July 2026. Its final two criteria also include players and team officials, the same card weights and club coefficients after opponent performance. The earlier September access limitation remains historical; this new read closes rule-text access, not the missing numerical data or Europa Annex D validation.

**Unverified — required data evidence.** No official numeric discipline total was validated for any club. Still needed are completed-match coverage, team-official inclusion, recipient/match identity, direct-red/second-yellow semantics, corrections and rescinded-card policy, finality, source timestamps and permitted access. Missing data must remain unknown; it must not become zero. A clean-player statistic does not imply a clean bench. Fines, suspensions and other disciplinary decisions are not substitutes for the specified card total.

## 3. Feasible implementation boundary and recommendation

**Verified — current local state.** Each competition snapshot has 36 clubs, 144 league-phase fixtures and 18 completed results, checked at **2026-10-02T21:08:58.108Z**. `scripts/lib/european-football-standings.js` uses opponent performance only when all 144 fixtures are complete, and leaves remaining final ties with `rank: null` and `rankPending: true`. It intentionally does not invent the two missing inputs. [Local snapshot](../../data/providers/openligadb/football-2026-27.json), [derivation](../../scripts/lib/european-football-standings.js)

Recommended sequence:

1. **Coefficient source discovery can be closed now.** Use the observed historical selection `?year=2026`, locked to the five explicit seasons and 2026/27 target competition season. Before accepting values, review all 72 identities, the association minimum, the complete roster and the source's access/reuse boundary. Retain source URL, retrieval time, source update time with its unknown zone, reviewed identity and exact decimal value. Prefer an approved fixed snapshot over polling a rolling ranking page. Store thousandths exactly if implementation proceeds.
2. **Disciplinary evidence remains the external blocker.** Obtain a permitted official or contractually documented source that explicitly covers players and team officials. Require either UEFA-confirmed whole-club totals or complete match-level events with documented card semantics. Reconcile every completed league-phase match and corrections; include a source-supported two-yellow example and a team-official example. A new scraper or inferred endpoint is not supported by this assessment.
3. **Only then close final ranking acceptance.** Compare computed discipline totals and fixed coefficients with official final league-phase positions for all clubs, including a tie that reaches each input. Resolve missing or conflicting records before release. Coefficient equality itself may require Annex D's equal-coefficient rules or an official ranking decision; do not assume an alphabetical fallback. Continue to show `Pending` whenever the required preceding input is unknown. [UEFA's coefficient explanation, D.8–D.9](https://www.uefa.com/nationalassociations/uefarankings/club/)

This review demonstrates a feasible coefficient route, rather than a ready coefficient import. Neither complete numeric gap has been closed. Even verified input values would not by themselves certify the underlying community fixture dataset, official qualification outcomes or physical-device rendering.

## Probe boundary

The delegated investigation used approximately ten purposeful source/UI probes: UCL Article 18; UEFA's coefficient explanation; the inaccessible statistics URL; UCL D.2 and D.4; the linked Europa Annex D; browser confirmation of the statistics 404; the default coefficient view; the historical season selection; and one ranking expansion with row-layout inspection. Follow-up reads checked the same sources, not additional endpoint variants. One subsequent parent read obtained the Europa Article 18 text, as distinguished above. The review stopped after these bounded checks. No private state, credentials, guessed API URL, exhaustive crawl or whole-table republication was used.
