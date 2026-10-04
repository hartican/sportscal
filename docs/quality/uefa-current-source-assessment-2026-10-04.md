# UEFA current-source assessment — 4 October 2026

**Current outcome: all 288 league-phase fixtures and all 36 completed scorelines agree with the organiser.** The parent completed a bounded comparison of six previously observed public UEFA query pages, separate from an initially incomplete delegated pass. This is one-off source evidence, with no new integration, scheduled request or commercial permission.

## Verified current facts

Six HTTP 200 responses were collected from **2026-10-04T07:04:15.374Z** to **2026-10-04T07:04:19.774Z**. Each competition returns validated page lengths 50/50/44, 144 unique organiser identities, 36 named non-placeholder clubs, eight distinct matchdays of 18 matches, eight opponents/four home matches per club, competition IDs 1/14 and season year 2027. All 288 previously reviewed organiser-to-NS IDs still match; 22 retained name aliases reconcile exact source display names with existing canonical labels. No fuzzy matching or new identity mapping is used.

| Competition | Matches | Explicit finals | Upcoming | Compared facts | Disagreements |
| --- | ---: | ---: | ---: | ---: | ---: |
| Champions League | 144 | 18 | 126 | 1,044 | 0 |
| Europa League | 144 | 18 | 126 | 1,044 | 0 |

The comparison checks home/away identities, matchday, UTC instant, Sydney date/time and explicit status for every match (seven fields × 288), plus both scores for all 36 finals (72 fields): **2,088 facts**. For completed league-phase records, the provider explicitly says `FINISHED`; regular and total scores are identical nonnegative integers, and the source kickoff predates the observation. No aggregate, elapsed-time or standings inference supplies a score. The remaining explicit source status is `UPCOMING`. Source UTC strings are converted with `Australia/Sydney` IANA rules; Sydney conversion is a calculation from the source instant, not a separately printed organiser timezone label.

| Source scope | Response records | Exact reviewed query |
| --- | ---: | --- |
| UCL | 50 | [0 offset](https://match.uefa.com/v5/matches?competitionId=1&fromDate=2026-09-01&limit=50&offset=0&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |
| UCL | 50 | [50 offset](https://match.uefa.com/v5/matches?competitionId=1&fromDate=2026-09-01&limit=50&offset=50&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |
| UCL | 44 | [100 offset](https://match.uefa.com/v5/matches?competitionId=1&fromDate=2026-09-01&limit=50&offset=100&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |
| Europa | 50 | [0 offset](https://match.uefa.com/v5/matches?competitionId=14&fromDate=2026-09-01&limit=50&offset=0&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |
| Europa | 50 | [50 offset](https://match.uefa.com/v5/matches?competitionId=14&fromDate=2026-09-01&limit=50&offset=50&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |
| Europa | 44 | [100 offset](https://match.uefa.com/v5/matches?competitionId=14&fromDate=2026-09-01&limit=50&offset=100&order=ASC&phase=ALL&seasonYear=2027&toDate=2027-01-31&utcOffset=0) |

These exact public query URLs were already observed in the [30 September reconciliation](uefa-utc-reconciliation-2026-09-30.md); today's reads renew their agreement evidence only. The [official UCL fixtures page](https://www.uefa.com/uefachampionsleague/fixtures-results/) timed out through the web fetcher. The [official Europa fixtures page](https://www.uefa.com/uefaeuropaleague/fixtures-results/) returned its navigation shell without match facts. Those page reads do not prove scores; the successful organiser match responses above supply the comparison.

## Investigation and timing limits

The delegated pass started its captured clock at **06:52:39 UTC**, after setup, and completed its initial artifact at **07:04:46.182198 UTC**: at least 12 minutes 7 seconds. It attempted zero current organiser calls and reported no HTTP/tool failure. It used its time for skill/memory, previous source mappings and local continuity, then was asked to close. Its incomplete observations and note are preserved separately. Do not claim that pass met the twelve-minute timebox or verified current scores.

A written parent hypothesis/acceptance brief then bounded the same six existing queries to three minutes, serial 15-second deadlines and no retries. Collection took roughly five seconds; all selected-fact comparisons were complete by **07:06:07 UTC**, within that extension. An initial private audit assertion expected `SCHEDULED`; the captured actual field is `UPCOMING`, so only the private comparison was corrected. No production status policy changed. The overall source investigation did not meet the initial timebox; the bounded extension does not erase that cost.

## Unverified and unchanged boundaries

No current official-table ranks, actual live/interrupted/abandoned states, final discipline/coefficient decisions, authenticated playback/replay, device behaviour, source/artwork reuse permission or future knockout coverage was checked. A known organiser score is not commercial clearance. These observations do not renew NS source clocks: current records retain **2026-10-04T05:49:21.558Z**. No sporting fact, mapping, source code, database, customer account, scheduler, credentials or deployment changed. Full certification stays **0/3 Football pilots and 0/16 carried families**, target at least 13/16.

Evidence under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/uefa-acceptance-20261004`: `official-observations.json`, `official-current-comparison.json`, private source-query/compare scripts, `source-pass-brief.md`, six private raw response files, and the original `uefa-current-source-observations-2026-10-04.json` / `delegated-source-assessment-before-parent-comparison.md`. Full response bodies stay outside the repository/application; the published note links selected-fact evidence and precise source queries. A$0 new services or owner tasks; model/token/cash savings are unmeasured.
