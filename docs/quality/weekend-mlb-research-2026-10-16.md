# Weekend MLB research: 16-19 October 2026

Research only. No applications, source-data changes, SQL, Git, deployment or preference access. Parent owns applications.

Reference clock: **2026-10-15 22:07:47 UTC / Friday 16 October 09:07:47 AEDT**. Sources retrieved during the following research pass. Weekend dates are Australia/Sydney dates, not US game dates. This is a point-in-time report, not an ongoing live check.

## Finding

**Supported:** all six existing card IDs match the requested pairings and game numbers in MLB's current schedule API. No official pairing contradiction was found. The conflicts are stale local timing/status fields, plus conditional future games; do not treat those as invented matchups. [MLB schedule API](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-15&endDate=2026-10-18&hydrate=team).

## Official timing evidence

API retrieval returned HTTP 200 and `totalGames: 6`. Rows below project `gamePk`, `description`, `gameDate` and `status.detailedState`; AEDT is the UTC+11 conversion. Home/away assignments match the existing cards. [Primary API](https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=2026-10-15&endDate=2026-10-18&hydrate=team).

| Exact existing card ID | Game | Official UTC start | Sydney first pitch | API state |
| --- | --- | --- | --- | --- |
| `fixture-mlb-849818` | ALCS 3 | 15 Oct 17:00Z | Fri 16 Oct 04:00 AEDT | Final |
| `fixture-mlb-849810` | NLCS 4 | 16 Oct 00:00Z | Fri 16 Oct 11:00 AEDT | Pre-Game |
| `fixture-mlb-849817` | ALCS 4 | 16 Oct 22:00Z | Sat 17 Oct 09:00 AEDT, subject to contingency below | Scheduled |
| `fixture-mlb-849808` | NLCS 5 | 17 Oct 01:00Z | Sat 17 Oct 12:00 AEDT, if needed | Scheduled |
| `fixture-mlb-849816` | ALCS 5 | 18 Oct 00:00Z | Sun 18 Oct 11:00 AEDT | Scheduled |
| `fixture-mlb-849806` | NLCS 6 | 19 Oct 00:00Z | Mon 19 Oct 11:00 AEDT, if needed | Scheduled |

**Time contingency:** if Milwaukee completes a sweep, ALCS Game 4 shifts to 20:00 ET: Saturday 11:00 AEDT / 17 October 00:00Z. [MLB broadcast schedule, Friday paragraph](https://www.mlb.com/news/2026-mlb-playoff-and-world-series-schedule).

Do not interpret an API `Scheduled` row or pregame 0-0 display as proof that a conditional game will occur or has begun. Occurrence and a published clock are separate facts.

## Results evidence: internal handoff only

**Never copy this section into protected preview fields.**

- ALCS Game 3 is final: Cleveland 3, Tampa Bay 2. [Official Game 3 wrap](https://www.mlb.com/gameday/rays-vs-guardians/2026/10/15/849818/final/wrap).
- Current series positions: Cleveland 2-1; Milwaukee 3-0. NLCS Games 5/6 remain conditional. [MLB postseason bracket](https://www.mlb.com/postseason).
- **Inference, not a new result:** with both AL clubs already having a win after three games, neither can finish the series in four. ALCS Game 5 is therefore required, barring a later schedule disruption. This explains the local conditional-flag conflict; it is not spoiler-safe card prose.

## Participant-focused context that avoids current-series results

These are concise factual building blocks, not claims about guaranteed lineups. Reuse by identifier in the card decisions below. Do not add current streaks, pitching assignments or health assurances without a game-specific source.

| Context ID | Supported fact / usable angle | Primary evidence and boundary |
| --- | --- | --- |
| A1 | Tampa Bay's Junior Caminero faces the organisation that traded him away in November 2021. | [MLB Rays feature, 11 October 2026](https://www.mlb.com/rays/news/junior-caminero-facing-team-that-traded-him-to-rays-in-2026-alcs), opening paragraphs. Personal history, not a revenge motive or a prediction. |
| A2 | Opposing third basemen Junior Caminero and Jose Ramirez are close friends; Caminero looks up to Cleveland's veteran. | [MLB ALCS friendship feature](https://www.mlb.com/rays/news/junior-caminero-jose-ramirez-friendship-alcs-2026), friendship and admiration passages. No head-to-head performance claim. |
| A3 | Cleveland's Gavin Williams, Chase DeLauter and Travis Bazzana illustrate the club's first-round draft development. | [MLB development feature](https://www.mlb.com/news/gavin-williams-chase-delauter-travis-bazzana-guardians-2026-success), opening discussion. Season background, not evidence of present form, availability or a later-game start. |
| N1 | Shane Drohan opens Milwaukee's bullpen game. | [Current NLCS Game 4 FAQ](https://www.mlb.com/brewers/news/brewers-dodgers-nl-championship-series-game-4-starting-lineups-and-pitching-matchup), starting-pitcher section. Applies to Game 4 only. |
| N2 | Los Angeles swept Milwaukee in the 2025 NLCS. | Same [Game 4 FAQ](https://www.mlb.com/brewers/news/brewers-dodgers-nl-championship-series-game-4-starting-lineups-and-pitching-matchup), previous-season comparison. Historical rematch context, not this year's result. |
| N3 | Chourio holds Milwaukee's career postseason home-run record. | Same [Game 4 FAQ](https://www.mlb.com/brewers/news/brewers-dodgers-nl-championship-series-game-4-starting-lineups-and-pitching-matchup), hitter discussion. Avoid recounting the individual current-series scoring play. |
| N4 | Jake Bauers' patient at-bats feature in MLB's account; Los Angeles is the two-time defending champion. | [MLB 2026 NLCS Game 3 report](https://www.mlb.com/news/brewers-win-nlcs-game-3-2026), opening paragraphs. Extract participant characteristics only, not the report's result-bearing headline or comeback sequence. |

**Editorial interpretation:** A1/A2 provide a specific human matchup; A3 provides Cleveland's development story. N1 provides a tactical Game 4 angle; N2 provides rematch history; N3/N4 provide named Milwaukee contributors against the defending champions. These are options, not six interchangeable generic World Series-path summaries.

## Exact card-local decisions and deferrals

Local fields below were read from this worktree's `data/events.json`. They are observations of the saved feed, not official evidence. No field was changed.

### `fixture-mlb-849818`: Cleveland Guardians v Tampa Bay Rays, ALCS Game 3

- Local snapshot: `upcoming`, Friday 09:00 AEDT, `startTimeUtc=2026-10-15T22:00:00.000Z`.
- **DEFER the entire pregame refresh: `past-first-pitch / official-final`.** Both the stored start and the earlier official start precede the reference clock. Do not backfill a new preview using knowledge obtained after play.
- A1-A3 are background only here, not permission to rewrite this past card. Parent may separately reconcile stale status/timing through its authorised path. Keep outcomes behind the existing spoiler contract.

### `fixture-mlb-849810`: Los Angeles Dodgers v Milwaukee Brewers, NLCS Game 4

- Local snapshot: Friday 12:00 AEDT / `2026-10-16T01:00:00.000Z`; official first pitch is one hour earlier.
- **Partial deferral: `stale-kickoff`.** Any application must use the official 11:00 AEDT cutoff, not the saved noon cutoff. This timing issue does not invalidate the matchup or independently sourced context.
- Pregame angle before that cutoff: **N1 + N4**; N2 is optional historical context. Do not add elimination, sweep or series-lead language to protected copy.
- **Defer unestablished opposing-starter and health specifics.** This pass established the Milwaukee plan, not a complete verified pitcher-versus-pitcher preview. Recheck at application time; if first pitch has passed, defer the preview entirely.

### `fixture-mlb-849817`: Cleveland Guardians v Tampa Bay Rays, ALCS Game 4

- Local snapshot: Saturday 09:00 AEDT, confirmed. Nominal timing matches the API, but the official contingency prevents treating it as unconditional.
- Pregame angle: **A1**, with **A3** as Cleveland-side supporting context. Do not claim an announced lineup or assign Williams to this game.
- **Partial deferral: `kickoff-contingency / starter-unestablished`.** Parent must resolve the scheduling branch before publishing a definitive clock. Do not silently select a branch based on a protected NLCS result. The nominal 09:00 AEDT start is the conservative preview cutoff until reconciled.

### `fixture-mlb-849808`: Los Angeles Dodgers v Milwaukee Brewers, NLCS Game 5

- Local snapshot: Saturday date only, no clock, `scheduleStatus=conditional`.
- Official clock is available, but occurrence is not yet established. **Partial deferral: `if-needed / pregame-state-pending`.** Preserve conditional wording; do not imply this game has been secured.
- If played, use **N2 + N3** as result-neutral rematch/participant context. Do not invent what Game 4 changed, who is under elimination pressure, or either starter.
- Stop preview application at Saturday 12:00 AEDT, or sooner if the game is cancelled. A later result can invalidate this fixture without invalidating independent ALCS cards.

### `fixture-mlb-849816`: Cleveland Guardians v Tampa Bay Rays, ALCS Game 5

- Local snapshot: Sunday date only, no clock, `scheduleStatus=conditional`.
- **No whole-card research deferral.** A clock and required occurrence are supported; the saved flags are stale. Parent owns any canonical repair, outside this task.
- Pregame angle: **A2**, optionally **A3**. This gives a different focus from A1 on the preceding card.
- **Partial deferral: `game-4-dependent-stakes / starter-unestablished`.** No clincher, must-win, current-series tally, rest advantage or pitching assignment is established for this game's eventual pregame state. Keep those out; stop preview application at Sunday 11:00 AEDT.

### `fixture-mlb-849806`: Milwaukee Brewers v Los Angeles Dodgers, NLCS Game 6

- Local snapshot: Monday date only, no clock, `scheduleStatus=conditional`.
- **Partial deferral: `if-needed / dependent-games-unresolved`.** Do not state that the series is returning to Milwaukee. Require official continuation confirmation before dropping conditional wording; published timing alone is insufficient.
- If played, use **N3 + N4** for participant focus; N2 remains optional history. Do not recycle a Game 4 starter or construct a series state from the game number.
- No confirmed Game 6 starters, fresh health assessment or Game 5-dependent stakes were established in this bounded pass. Preview cutoff is Monday 11:00 AEDT if the fixture survives.

## Unavailable / inconsistent evidence and limits

- **Inconsistent local fields, not inconsistent official pairings:** Game 3's stored status/start, Game 4 NLCS's stored start, and the later cards' missing clocks. ALCS Game 5's conditional flag is additionally outdated. The current MLB API, bracket and schedule reporting agree on the requested clubs.
- **Official API semantic limitation:** scheduled future rows coexist with MLB's explicit conditional bracket markers. Keep the latter; do not promote placeholders into guaranteed games.
- **Source availability:** the browser fetch of `https://www.mlb.com/schedule/2026-10-15` returned an internal retrieval error. The official schedule API succeeded; the bracket and schedule article were readable. No claim relies on the failed page.
- **Not established, rather than disproved:** game-specific ALCS Games 4/5 and NLCS Games 5/6 starting pitchers, final lineups, new injuries and eventual pregame series states. No substitute secondary-source claims were used.
- **Wrong-year trap:** search also returned 2025 Dodgers-Brewers NLCS Game 4/Ohtani reports. They are not 2026 starter, performance or result evidence. The historical N2 fact is explicitly year-labelled; no 2025 Game 4 result was transplanted into these cards.
- No Australian broadcast availability was researched or inferred from US broadcast listings. No odds, betting narratives or preferences were accessed.
- Deferrals above are card-local. In particular, the completed ALCS Game 3 and conditional NLCS fixtures do not block independent, still-pregame, source-backed cards.

Only this findings file was created. No feed refresh, implementation, tests, SQL, Git or deployment was performed.
