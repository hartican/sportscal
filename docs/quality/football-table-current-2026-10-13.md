# Football tables — current accuracy and ordinary update proof

**13 October 2026 · read-only checkpoint · verified live app 906aece6 / version 521**

The live Premier League table agrees with a fresh official table for all 20 clubs and all nine compared fields. The three Football tables also agree with the completed scores published in NS: 60 league finals, 18 Champions League finals and 18 Europa League finals. No app correction is needed for this snapshot.

| Check | Scope | Compared values | Differences |
| --- | --- | ---: | ---: |
| Official Premier League table against the live NS table | All 20 clubs; rank, played, wins, draws, losses, goals for/against/difference and points | 180 | 0 |
| Published tables against published completed scores | All 92 competition rows across EPL and the two UEFA league phases; seven sporting totals | 644 | 0 |

The official response passed the existing strict competition, season, complete-club, numerical and league-total validation. Both sources cover 120 club appearances in the Premier League, representing 60 completed matches. UEFA tables remain explicitly provisional; today's totals check does not independently renew organiser ranks, disciplinary/coefficient decisions or final qualification. Clubs that appear in more than one competition count as separate table rows.

The public Football document was read at 02:14:15.754897 UTC and matches the sealed deployment bytes of the already verified live snapshot. The official table response completed at 02:14:16.469613 UTC. This audit timestamp is separate from the published tables' 12 October 22:43:24.652 UTC observation. No fixture fact or application check date was renewed.

## Ordinary publication closes the earlier open check

The existing scheduled run [38318171575](https://github.com/hartican/sportscal/actions/runs/38318171575) completed successfully and published 25de50e185f1072ec7d251cbe442a18094230693. Its normal child release [38318444793](https://github.com/hartican/sportscal/actions/runs/38318444793) also succeeded. That snapshot is included in current live app 906aece6, and all 92 table rows are unchanged between the scheduled publication and the freshly read live document. This proves the dated ordinary update; it does not promise every later unattended run succeeds. The earlier table module's next ordinary-publication check can be closed.

The UEFA collection checks are dated 12 October, while unchanged individual fixture facts retain their 4 October observation. A collection/table check must not relabel old individual facts as newly changed. Three unrelated source exceptions remain with the existing ordinary-run evidence; this checkpoint does not repair or conceal them.

## Recommendation and acceptance

Keep the existing shared table comparison and stale warning, and use the existing canonical update owner. Advance the remaining Football presentation and commercially permitted source work. Repeat a source comparison when the underlying competition advances or evidence disagrees; do not add another recurring manual review.

**Business value:** verifies that users' table positions and recorded results now agree, and closes a previously unresolved ordinary-update check. **Evidence:** two bounded read-only requests, sealed live-file hash, the existing official parser, complete fixture scope and successful scheduled-publication receipts. **Effort:** checkpoint complete; no new app module or deployment is required. **Dependencies:** existing complete season/league-phase collections, validated scores and one canonical owner. **New cash:** A$0 committed; existing assistant/runner cost remains unpriced. **Owner time:** no new account, decision or routine. **Acceptance:** complete 20-club official agreement, all 92 sporting totals agree, exact live bytes and dated ordinary publication, with unchanged facts and explicit limits. **Why act/defer:** close this evidence gap now; defer rewrites, inferred replacement rankings and extra schedulers because current evidence does not justify them.

Sources: [official Premier League table](https://www.premierleague.com/en/tables/premier-league/2026-27) and its [existing public table resource](https://footballapi.pulselive.com/football/standings?compSeasons=841&comps=1&comp=1&altIds=true&page=0&pageSize=100). The ordinary web page returned navigation without table values; the complete validated official JSON response supplies this comparison. Raw response bodies stay in the private output folder, not the repository.

Receipts: `read-receipts.json`, `table-comparison.json`, `ordinary-table-publication.json`, `compare-tables.cjs` and its log. The initial observer expected the provider's stage slug instead of the existing published label; that failure and the corrected observer are retained separately. No sporting-source refresh, automatic retry, scheduler/customer write, purchase or deployment was made. Physical-phone, paid playback, commercial permission and genuine repeat visits remain open. Whole-programme approval counts stay 0/3 Football pilots and 0/18 carried families.
