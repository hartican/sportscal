# European standings reconciliation — 28 September 2026

One-off browser review of the rendered official tables compared all 36 clubs in each competition with NS's retained OpenLigaDB-derived standings. It checked rank, played, wins, draws, losses, goals for, goals against, goal difference and points: **648 values across 72 clubs, zero mismatches**. Explicit aliases reconciled UEFA abbreviations with NS club names. Alphabetical display order within equal ranks was not treated as a ranking difference.

Sources: [Champions League table](https://www.uefa.com/uefachampionsleague/standings/) and [Europa League table](https://www.uefa.com/uefaeuropaleague/standings/). The rendered table contained one completed match per club. This verifies the current snapshot, not later fixtures, full-season accuracy or a right to redistribute UEFA data. No new scraper, provider integration or scheduled request was added.

The same 648 fields agreed with the live Football projection at **2026-09-27T17:47:50.455Z**. Its bytes matched the local projection, and all 72 provisional labels remained present. Current application release: `f2b7a7ffa9f12ccb0535b39ca8cb7ed3c7cbb395`, shell 332. No product correction or redeployment is required for this evidence-only work.

## Rules and remaining limits

The existing interim ordering agrees with [UEFA's Champions League explanation](https://www.uefa.com/uefachampionsleague/news/0291-1bd88ae04870-e1e038c319e3-1000--champions-league-league-phase-standings-how-teams-level-on-/) and [Article 18](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-18-Equality-of-points-league-phase-Online). The implementation adds opponent-performance criteria only after all 144 results are complete; unresolved final disciplinary/coefficient ties receive no invented final rank. No final qualification is confirmed. NS's alphabetical ordering uses its own display names, which differ from UEFA abbreviations.

The Europa regulation page was discoverable but its detailed content timed out in the text tool; the numeric comparison uses its rendered official table, not a claim that the complete Europa regulation was independently reviewed. Final-round discipline/coefficient source evidence and full end-of-phase acceptance remain open for both competitions.

Existing `validate-european-football-standings.js` passed: source/table consistency, arithmetic, provider-order independence, away-goal separation, unknown-result behaviour and unresolved final ties. These tests supplement the external comparison; they are not its source of truth.

Counts, reviewed aliases, per-club mismatch results and hashes are retained in `uefa-standings-reconciliation.json` under the 27 September delivery output directory. No full table copy is added to the public repository.
