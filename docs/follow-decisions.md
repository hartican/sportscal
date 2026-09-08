# Follow and Feed decisions

Authoritative user decisions, 8 September 2026. Read this before changing Follow, Feed eligibility, discovery, card retention, or related notifications. The approved Restore Feed reliability plan governs this implementation. Update this record and its regression tests when the user changes a decision; do not silently restore superseded behaviour.

| Decision | Behaviour | Examples |
|---|---|---|
| Fixtures only | Feed contains individual sporting fixtures; programme/tournament/finals-week summaries belong in Events. Missing optional enrichment never removes a fixture. | NRL Finals Week 1 is not a fixture; its four games are. A published Grand Final with winner-of slots is a fixture. |
| Explicit participants | At least one followed participant admits their fixtures. Canonical aliases, deliberately followed collections apply only with confirmed participation; confirmed exclusions and explicit mutes win. | Following Alcaraz includes his early rounds. Opponents need not both be followed. |
| AFL and NRL | Followed teams/players plus finals and source-backed marquee fixtures of followed competitions. | AFL means the men's AFL premiership under Aussie Rules Football; NRL means the men's competition. |
| Tennis | Every round, including QF/SF/Final, requires a followed participant or explicitly followed player collection. Tournament follows grant no match admission. | No early-round exception from Australian nationality, a numeric score or an editorial marquee tag. |
| Women's coverage | Women's cricket, AFLW and NRLW require explicit competition or participant follows. Broad parent follows do not count. | Cricket does not opt into women's internationals; AFL does not opt into AFLW. |
| New coverage | Source discovery never creates user consent. Selected selector IDs and recorded user choices are authoritative; derived followedSports descendants are not independent consent. | A new sport begins unfollowed. Preserve proven explicit choices; unknown provenance must not opt in. |
| Precedence | Explicit event-family/fixture/competition/participant exclusions win. Scores, editorial and promoted replay tags never grant eligibility. | A five-star unfollowed fixture stays out of Feed. |
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

## Follow overload correction — 9 September 2026

The user reported unwanted tennis/cricket fixtures and an unusable Follow directory after the previous release. This supersedes the 8 September automatic Tennis finals exception. A broad Cricket or Rugby follow does not admit all internationals, Australian appearances or domestic finals. Explicit team/player follows and explicit competition selections remain authoritative; collections are never silently removed.

Cricket opens with ten major men's international teams (ICC ODI top-ten cohort, Australia first), six Australian state teams shared by Sheffield Shield and the One Day Cup, then eight BBL teams. Rugby opens with the 24 Rugby World Cup 2027 countries, Australia first, and the 2026 Super Rugby Pacific clubs, including overseas teams. Full source records remain available through deliberate search/gender filtering; they do not populate the default directory or create follows. Source-backed groups are in `data/canonical/follow-directory-curation.v1.json`.

Teams & players must not fetch complete Inspector schedules merely to discover whether standings exist. Tennis directory completion must redraw the current Follow view even if a collection control started the request. Live Feed refresh requests at most the 60 mounted fixture IDs and pauses while Follow is open. Versioned schedule/live caches exclude the former whole-library payload.

Regression commands: `validate-follow-loading-regression.js`, `validate-curated-follow-directories.js`, `validate-follow-decisions.js`, `validate-follow-policy-parity.js`, and `validate-live-fixture-api.js`. `node scripts/update-cards.js --follow-ui --local-only` regenerates Follow/Inspector projections and the runtime from retained canonical sources without invoking an independent refresh path.

Screenshot regression: reserve/women's sides with published participant IDs must never be reinterpreted as senior men's sides by name matching. Unknown Namibia imagery must never borrow the opponent's crest. Women's fixtures outside tennis require explicit participant or competition/code consent; a generic parent follow is insufficient. Preference v21 removes the ambiguous legacy AFLW selection from preference versions before v20 when co-selected by the old AFL parent and no separate AFLW participant/competition choice exists. New explicit AFLW choices and separate participant/competition follows are preserved.

F1 confirmation — 9 September 2026: an explicit F1 follow admits its published race and qualifying fixtures without requiring a separate driver/team follow. Keep the retained Monza replay and upcoming races in Feed. Screenshot/loading regression tests reconcile these F1 fixtures alongside AFL/NRL finals.

## Explicit event unfollow and finals corrections — 9 September 2026

Unfollowing an event family (for example US Open) is an explicit exclusion of all related fixtures from Feed, including fixtures with followed players, collection members or saved Feed pins. Persist that exclusion across migration, reload, cached fallback and server rebuild; old onboarding selections must not re-enable it. Refollowing removes the exclusion and reapplies ordinary eligibility. Preserve each card's ratings, reminders, pins, dismissals and other saved state throughout. A never-followed tournament is not an explicit exclusion. This clarifies the precedence row above; tennis still needs a followed player/collection unless individually pinned.

A saved explicit AFL premiership choice takes precedence over an old derived disabled AFL parent flag. The equivalent NRL premiership child uses the same specificity rule. Explicit child/competition disables, participant mutes and fixture dismissals still win; no women's competition is inherited. Follow schedules must report `In Feed` for automatically eligible fixtures rather than asking users to add those cards again.

A provisional live draw placeholder without a published date/time must never overwrite a confirmed fixture. Published AFL/NRL fixtures form part of the live API's baseline; genuine postponements, cancellations and live results continue to apply. Retain stable fixture IDs and associated user state.

Regression commands: `validate-event-unfollow.js`, `validate-event-unfollow-browser.js`, `validate-finals-parent-follow.js`, `validate-finals-follow-browser.js`, `validate-finals-live-overlay.js` and `validate-live-fixture-api.js`. Rating presentation is covered at 320/390/768/1280px by `validate-rating-flames-browser.js`.

The user explicitly confirmed this is the reusable process for **every card in Events**, not a US Open exception. All event-family Follow controls use the same mutation and eligibility path. Preserve explicit choices for published event families outside the onboarding shortlist; a new event remains unfollowed until chosen. Child fixtures carry their canonical `eventFamilyId`. Ticket cards operate on their parent event family. Regression coverage iterates every published event family, including Cincinnati, Rugby League World Cup, Nations Championship, Australian Open and Australian Grand Prix.
