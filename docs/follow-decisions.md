# Follow and Feed decisions

Authoritative user decisions, 8 September 2026. Read this before changing Follow, Feed eligibility, discovery, card retention, or related notifications. The approved Restore Feed reliability plan governs this implementation. Update this record and its regression tests when the user changes a decision; do not silently restore superseded behaviour.

| Decision | Behaviour | Examples |
|---|---|---|
| Fixtures only | Feed contains individual sporting fixtures; programme/tournament/finals-week summaries belong in Events. Missing optional enrichment never removes a fixture. | NRL Finals Week 1 is not a fixture; its four games are. A published Grand Final with winner-of slots is a fixture. |
| Explicit participants | At least one followed participant admits their fixtures. Canonical aliases, deliberately followed collections apply only with confirmed participation; confirmed exclusions and explicit mutes win. | Following Alcaraz includes his early rounds. Opponents need not both be followed. |
| AFL and NRL | Followed teams/players plus finals and source-backed marquee fixtures of followed competitions. | AFL means the men's AFL premiership under Aussie Rules Football; NRL means the men's competition. |
| Tennis | Sport/tournament follows admit singles QF/SF/Final and doubles Final. Other rounds require a followed participant. | No early-round exception from Australian nationality, a numeric score or an editorial marquee tag. |
| Women's coverage | Women's cricket, AFLW and NRLW require explicit competition or participant follows. Broad parent follows do not count. | Cricket does not opt into women's internationals; AFL does not opt into AFLW. |
| New coverage | Source discovery never creates user consent. Selected selector IDs and recorded user choices are authoritative; derived followedSports descendants are not independent consent. | A new sport begins unfollowed. Preserve proven explicit choices; unknown provenance must not opt in. |
| Precedence | Explicit fixture/competition/participant exclusions win. Scores, editorial and promoted replay tags never grant eligibility. | A five-star unfollowed fixture stays out of Feed. |
| Timeline | Seven local calendar days of completed fixtures, ongoing events, and up to twelve months ahead. Open at Now; preserve the mixed timeline, lazy loading and staggered detail. | Old source results, ledgers and saved records are retained outside active Feed. |
| Profiles | Card participant names open canonical profiles under Follow with a quick Follow/Following control; Back restores the card position. | Follow on a profile persists across devices. |
| Replays | Completed fixtures with published post-match 5/5 OR personal post-match 5/5 receive Promoted replay. Personal promotion is viewer-specific. Monza 2026 has an explicit editorial 5/5 recommendation, separate from crowd votes. | Promotion never extends active retention or manufactures votes. |
| People and alerts | Explicit directed follows on the Nothing Score ladder. Only persisted real 5/5 live votes on eligible fixtures alert; group for 60 seconds and deliver once per recipient/fixture. | No modelled raters, self-alerts, private identities or notification opt-out overrides. |

## Additional profile decision — 8 September 2026

Tapping a card participant must also expose full results for that particular fixture, including all F1 positions and published times, and the relevant team/athlete standings. Results remain spoiler-controlled; unavailable values are not invented. Home tournament/race/game tags apply only to followed participants, using their sourced home/representing country and venue country, or an explicitly designated home team. No venue-name guessing or birthplace inference.

## Superseded decisions

The women's Cricket inclusion and early-round Tennis marquee/Australian-discovery exceptions in `followed-fixture-reliability-plan.md` and `followed-fixture-reliability-phases-2-4.md` are superseded. Remaining compatible rules, including ranking-independent watch lists, source-backed identity and seven-day retention, continue to apply.

## Executable contract

- `node scripts/validate-follow-decisions.js`: admission, exclusions, migration, gender scope, tennis boundaries, summary rejection, client/server parity.
- `node scripts/validate-follow-policy-parity.js`: broader sport and participation compatibility.
- `node scripts/validate-feed-repair-reconciliation.js`: published finals, tennis stages/editorial, complete F1 results and standings.
- `node scripts/validate-feed-repair-browser.js` and `node scripts/validate-follow-recovery-browser.js`: layout, profiles, quick Follow, home tags, Back restoration and independent loading/retry.
- `node scripts/validate-promoted-replay.js`, `node scripts/validate-user-follows.js`, and `node scripts/validate-live-rating-alerts.js`: replay isolation, directed relationships and protected real-rating delivery. Set `PGLITE_MODULE` to include the database migration/claim tests.
- [Verification record](verification/feed-follow-repair-20260909.md) records acceptance evidence and its limits.

Decision changes must update this table and the relevant tests together. Record the date and what changed rather than deleting decision history.

## Identity clarification — 8 September 2026

National cricket sides have separate men’s and women’s canonical IDs, even when they use the same governing board crest. Existing generic national cricket IDs retain men’s scope; women’s fixtures resolve to the separate `-women` ID. Reserve and under-age team names never alias to senior sides. Completed F1 participation comes from the complete official session classification, including replacement drivers, rather than the current season grid. An event-brand follow without explicitly selected disciplines does not subscribe to every underlying sport.

Regression coverage: `validate-national-team-identities.js`, `validate-follow-decisions.js`, and fixture results reconciliation.
