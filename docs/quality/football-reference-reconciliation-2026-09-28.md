# Football fixture reconciliation — 28 September 2026

The reviewed production snapshot contains **668 reconciled fixture identities**: 380 EPL, 144 Champions League and 144 Europa League. No provider-data correction was required. This closes the season-list comparison task for this snapshot, not full competition certification.

| Competition | Team pair and date | Matchday | Published results | Kickoff comparison |
|---|---:|---:|---:|---:|
| EPL | 380/380 | Not independently compared | Not checked | 380/380 listed times agree, including past fixtures |
| Champions League | 144/144 | 144/144 | 18/18 | 126/126 in Central European local time |
| Europa League | 144/144 | 144/144 | 18/18 | 126/126 in Central European local time |

EPL uses a separate official publication from its runtime API, not independent ownership. OpenLigaDB's European fixtures were compared with organiser publications. Reviewed aliases account for abbreviated club names. Both production JSON files returned HTTP 200 and exactly matched local SHA-256 digests. The evidence JSON identifies the released commit, scope, counts, aliases, source URLs and file digests.

## Reference disagreement resolved

The EPL article contains 381 rows because Liverpool–Brighton appears on both 24 and 25 October. Liverpool's own ticket page confirms 25 October at 14:00; NS already has that time. The stale duplicate was excluded explicitly. A separate league announcement confirms the final round's 16:00 kickoff rather than the article's generic weekend default. No database entry was altered to fit a contradictory reference.

Sources: [EPL season list](https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season), [fixture release and final-day time](https://www.premierleague.com/en/news/4675508), [Liverpool match page](https://www.liverpoolfc.com/tickets/match/liverpool-v-brighton-and-hove-albion-english-premier-league-20261025).

## European scope

All listed league-phase pairs, dates and matchdays match; all published outcomes match. Upcoming times agree using Europe/Paris daylight saving. The organiser articles label times CET, so this is a local-time reconciliation rather than independent explicit UTC evidence. The articles omit completed-match kickoff times; those 36 historical start times remain unverified by this comparison.

Sources: [Champions League reference](https://www.uefa.com/uefachampionsleague/news/02a8-2174c9e9019d-f909a77bd77a-1000--2026-27-champions-league-all-the-league-phase-fixtures/), [Europa League reference](https://www.uefa.com/uefaeuropaleague/news/02a8-2174cafa5bb6-82bbc20c9b92-1000--2026-27-europa-league-all-the-league-phase-fixtures/).

## Remaining acceptance

This evidence is dated and bound to release f218c4a6210c76e270cfb6ae3ac281d5719bd7b2, shell 329. Future fixture changes require fresh evidence. EPL results/standings, European historical kickoff and explicit UTC confirmation, commercial rights, viewing destinations, editorial quality and physical-device behavior remain separate gates. Long-range published times can change. Zero of three pilot competitions is fully certified; zero of sixteen carried sport families is fully certified.

The audit added no network ingestion path, scheduler, subscription or production data change. It retains comparison outcomes, not a copied article corpus. Production remains the already verified release 329; a documentation-only evidence update does not require another deployment.

Evidence: `football-reference-reconciliation-2026-09-28.json`.
