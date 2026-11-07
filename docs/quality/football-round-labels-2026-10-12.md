# Football round choices — 12 October 2026

The live Schedule contains the matches, but three different round-one choices all say “Matchday, round 1”. The Premier League, Champions League and Europa League cannot be distinguished until a choice is opened. The competition, season and stage were already available in the heading's hover title, which is insufficient on a phone.

Use that existing published context in the native round picker and visible group heading. This is a two-line presentation repair. Group identities, ordering, selected windows, fixture IDs, source facts, follows, result protection and reminders stay under their existing owners.

## Evidence and verification

- Verified against production shell 512 in Chromium and WebKit at 320 pixels: identical labels open three different competition groups with 10, 18 and 18 cards respectively.
- The expanded existing `validate-football-round-repair.js` exercises the actual Schedule renderer. It fails before the repair (one visible name for five competition/season/stage combinations) and passes after it. Existing chronological ordering and client/server UEFA admission assertions also pass.
- Four controlled browser checks pass: Chromium and WebKit at 320 and 390 pixels, with genuine anonymous public data and only the candidate Schedule asset substituted. All 62 available choices have distinct visible names, the chosen heading agrees, and no overflow, page error or attempted account write occurs.
- Prepublication browser substitution is not proof that the repair is live. Cache, integrated release checks, publication and exact production rendering remain required with the incoming shell update. Physical-phone, signed-in and full Football approval remain separate.

Evidence is saved in `/Users/jackhartican/Documents/AI/Codex/football-current-screen-review-2026-10-12`: `round-picker-live.json`, `round-renderer-red.log`, `round-renderer-green.log`, `round-picker-candidate.json` and `round-code-inspector-check.log`.

## Recommendation

Ship with the next passing presentation update. Users can choose the intended league with less trial and error. Effort is small: the repair and regression use existing context and the existing canonical gate. It adds no service, request, recurring administration or subscription. Assistant/runner time is not priced. Owner involvement is zero for implementation; the already pending real-phone check remains separate. Accept when the integrated cached shell and exact hosted version preserve distinct choices, selected round, results protection and no mobile overflow. Do not expand competition coverage for this repair.

## Investigation limits

The first two attempts at the new small DOM fixture missed test dependencies (`dataset`, then preferences); these are observer setup errors, not product defects. Only the subsequent visible-label assertion establishes the regression. Direct observation and a minimal repeatable renderer failure identify the omission, so further speculative source or identity investigations were unnecessary. Fixture availability and sporting accuracy are not newly certified by this check.

## Published and live acceptance

Delivered in exact snapshot 754565819affe25965bd6dd12660817d58f10bc1, shell 513. Normal release and full installed-update checks pass. Four genuine production journeys across Chromium/WebKit at 320/390 pixels confirm all 62 choices are distinct, visible headings match selections, and EPL/UCL/UEL round-one groups retain 10/18/18 cards. No overflow, page error or attempted account write. The existing plan for all 690 retained Football records and its 62 groups is unchanged; only the visible context is exposed. Evidence: round-picker-513.json/.cjs/.log and the exact production proof in the card-context-release folder. Physical-phone and full Football approval remain separate.
