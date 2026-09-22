# Follow and Feed decisions

## Notifications inbox — 22 September 2026

The unified inbox includes real followed-user ratings, new followers, copied-follows rewards and standalone points, with existing privacy/moderation boundaries. A related social event and its points award appear in one entry. Tapping opens the relevant profile/picks, reward breakdown or fixture; it never follows a person, accepts a chat invitation or admits a fixture automatically. Notification read state is separate from chat unread state. New activity starts at rollout and expires from the inbox after 90 days; underlying follows, ratings and reward records retain their existing retention. Regression: `validate-inbox-database.js` and `validate-inbox-browser.js`.

## AI discovery change — 14 September 2026

Automatic cross-sport athlete entry discovery is removed. It no longer scans account preferences, searches entries, or contributes historical AI athlete snapshots to the Feed. Ordinary source-backed participant follows continue to work. Consensus-tag ingestion is optional and disabled by default; only `DISCOVERY_CONSENSUS_ENABLED=true` enables its six-hour batches. Existing accepted consensus evidence and user ratings remain available when it is disabled. Fixture ingestion, Follow admission, scores, Calendar and NSC do not depend on this opt-in. Regression: `node scripts/validate-autonomous-discovery.js`.

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
| People and alerts | Explicit directed follows on the Nothing Score ladder. Only persisted real 5/5 live votes on eligible fixtures alert; group for five minutes and deliver once per recipient/fixture. | No modelled raters, self-alerts, private identities or notification opt-out overrides. |

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

Preference version 22 makes `eventFamilyDecisions.v1` authoritative. A legacy client patch that removes an ID only from `followedMajorEventIds` is a deliberate exclusion; the server records it before onboarding or cached seeds can be reapplied. Re-adding the ID records an explicit follow. The followed and excluded arrays remain compatibility projections of that decision map.

## Accepted plan clarification — 14 September 2026

The latest accepted repair plan explicitly admits **all published F1 sessions** when F1 is followed. This supersedes the race/qualifying-only wording above; practice is eligible through the explicit competition choice, without becoming an editorial marquee or implying a driver follow. Event-family exclusions and participant mutes retain precedence. Regression: `validate-follow-decisions.js` and `validate-restored-feed-chat-contract.js`.

## F1 Feed session scope and identity — 16 September 2026

This supersedes the 14 September all-session Feed rule. Keep official Practice sessions in the F1 schedule and Inspector, but exclude every Practice/FP1/FP2/FP3 session from Feed, including saved or followed paths. Feed retains qualifying, sprint qualifying, sprints and races. Deduplicate F1 cards by season, Grand Prix and session type rather than provider ID or participant identity; race sessions do not have the two-sided participant identity used by team fixtures. Apply the same identity to server composition, pagination, schedule overlays and installed-browser reconciliation. Regression: `validate-f1-parent-feed.js`, `validate-fixture-visibility.js`, `validate-follow-loading-regression.js` and `validate-pwa-cricket-cache-reconciliation.js`.

The same accepted recovery plan changes followed-user EPIC grouping from 60 seconds to five minutes to meet the MVP infrastructure budget. Delivery remains once per recipient and fixture, and every privacy, opt-out, real-rating and Feed-eligibility check remains mandatory.

## Nothinger Leaderboard and friend picks — 15 September 2026

This explicitly supersedes the earlier live-only, Feed-eligible people-alert restriction. Every new real 5/5 Heat, Live or Impact rating by a followed public account produces a Friends activity entry, regardless of sporting follows. Preserve privacy, moderation and push opt-outs. Group push delivery for five minutes; deduplicate per recipient/rater/fixture/phase, without discarding separate raters or phases. Friends activity offers an explicit Add to Feed action; recommendations alone do not alter ordinary Feed eligibility.

Public sporting follows can be previewed and selected through **See / copy follows → Follow their picks**. Copies add selections; they never replace existing follows or subscribe to future changes. Bulk selection skips exclusions; only individually selected excluded picks may override them. The copied account earns a once-off 20 points per copier/source-person pair when at least one follow is added, regardless of how many sports are copied. That permanent pair history is backfilled from the former per-sport ledger, so unfollowing, refollowing or later copying another sport cannot mint the reward again. First directed person follows earn both accounts one point; existing relationships and refollows earn no backfill. Shared handle links follow their public owner after authentication.

The person being followed receives a social notification when a new directed profile follow is created. They also receive a points notification when another person causes their one-time copied-follows reward. Social alerts default on per installation, retain an explicit opt-out, respect private/moderated identity boundaries, and use a server-only transactional outbox with idempotent delivery. On Nothing Friends, **See / copy follows** is a prominent action directly beside Follow/Following, with an on-screen explanation of the person-wide once-off reward.

Global and Nothing Friends leaderboards default to points, with an Efficiency sort option. The five additional Global columns are men's NRL, AFL, Cricket and Rugby Union, plus men's and women's Tennis. Other coverage and overall scoring remain unchanged. Friends displays each person's top three sports by Efficiency and its sample size.

At launch, archive existing points/entitlements and start a new scoring epoch, preserving fixture ratings, profiles and follows. Heat earns one point; the latest confirmed pre-start prediction earns another 19 on the first exact Live/Impact match from another real registered user. Success is immutable. Close unmatched predictions 48 hours after confirmed completion. Efficiency is successes divided by resolved predictions with another rater; exclude pending, unrated, cancelled/abandoned and unconfirmed-time predictions. Social and participation points never inflate Efficiency. Legacy settlement jobs cannot restore pre-reset points.

Regressions: `validate-leaderboard-v2-database.js`, `validate-leaderboard-v2-browser.js`, `validate-user-follows.js`, `validate-live-rating-alerts.js`, `validate-notifications.js`, `validate-crowd-foresight.js`.

## Follow interaction responsiveness — 16 September 2026

Team and player Follow controls update locally before any fixture, Feed or cross-device work begins. Local preference persistence remains immediate; server state, schedule reconciliation and personalised Feed rebuilding are coalesced and deferred until scrolling and input are idle. A temporary network failure keeps the local choice and retries through the existing pending-sync path.

Large Follow directories parse away from the main thread where Worker support is available. Football and legacy directories mount at most 40 initial rows, add further rows deliberately, and use off-screen rendering containment. Follow/unfollow must patch the existing row rather than rebuilding the directory. Regression: `validate-follow-interaction-performance.js` and `validate-follow-loading-regression.js`.

## Current-team player inheritance — 16 September 2026

Following a source-backed player in a rostered team sport admits the published fixtures of that player's current official team. This is schedule inheritance only: the card must say it came via the player's current team and must not claim lineup or match participation. An explicit player mute removes that inheritance, an explicit team mute wins over a player follow, and a source-backed transfer moves future inheritance when the roster mapping changes. Direct team follows retain their existing behaviour. Sports without a current sourced player-to-team mapping do not guess one. Regression: `validate-followed-fixture-surfacing.js`.

Explicit selected selector IDs repair contradictory persisted graph flags on the server before fixture resolution and Feed admission. In particular, a checked F1 or AFLW choice cannot remain silently disabled by an older graph projection. Regression: `validate-followed-fixture-surfacing.js`.

### Selected child versus unselected parent — 16 September 2026

An explicitly selected child sport takes precedence over its unselected ancestor's derived disabled flag for that child's fixtures. A stored `sport:motorsport` disabled flag must not veto selected F1, MotoGP or WRC. Apply the same taxonomy-based specificity in the browser, followed-schedule loader and server; never enable the parent or infer follows for siblings. Child/competition exclusions, event-family exclusions, participant mutes and fixture dismissals retain their existing precedence. The F1 incident reproduced with F1 selected and enabled while Motorsport was disabled; previous tests covered the F1 flag alone and missed this parent veto. Regression: `node scripts/validate-f1-parent-feed.js`, required by canonical refresh and production deployment.

## Adaptive Follow grid and entity drill-down — 16 September 2026

The Follow grid shows at most seven sports plus More. It contains only sports the current account follows, so an account with fewer than seven followed sports gets fewer icons rather than filler. Order is personal: count distinct Heat, Live and Impact interactions per fixture phase over the rolling prior 90 days, collapse F1, WRC and MotoGP into Motorsport, then sort by count, most recent interaction and the existing editorial order. Multiple edits or rating buckets in the same fixture phase count once. Rating history changes grid order only; it never admits a Feed card. Every followed sport outside the first seven remains in More.

An explicit F1 follow admits the competitive sessions published by the official Formula 1 race pages: sprint qualifying, sprints, qualifying and races. Practice remains in Schedule/Inspector and stays out of Feed. The NBL Code uses the official NBL27 regular-season schedule and exposes Teams and Players as separate directory views, with Teams first. **Follow their picks** first filters by sport, then drills into sports, competitions, teams, players/athletes, collections, events and individual fixtures. Copying an individual team or athlete uses the existing additive, exclusion-aware copy transaction.

A broad Football follow alone does not admit an ordinary domestic fixture such as Internazionale v Udinese. Admission still requires an explicit participating team/player (including the accepted current-team inheritance), a qualifying explicit competition/event decision, or a manual fixture pin. Regression: `validate-adaptive-follow-grid.js`, `validate-adaptive-follow-grid-browser.js`, `validate-follow-decisions.js`, `validate-followed-fixture-surfacing.js`, and `validate-leaderboard-v2-browser.js`.

## Profile picture expansion — 21 September 2026

A profile picture has a public 128px thumbnail and a private 512px expanded image. Only the owner and accounts **the owner follows** can expand it; following the owner does not grant access. Each expanded-image request rechecks the directed relationship, profile visibility and moderation. Hidden profiles remain owner-only; deleted or moderated profiles cannot expand. Public thumbnails are versioned and cacheable; expanded images are authenticated, never public URLs, and never persistently cached. Uploads accept common raster formats up to 6,000,000 bytes, retain compressed derivatives only, and strip metadata. Regression: `validate-profile-avatars.js`, `validate-profile-avatar-database.js`, `validate-profile-avatar-browser.js`.

## Participant unfollow and Australian presentation — 22 September 2026

This supersedes the earlier whole-fixture participant-mute veto. Ordinary participant Unfollow records `unfollow`: it opts that participant out of direct, collection and current-team inheritance, but another followed participant still admits their shared fixture. Historical `mute` values had no provenance distinguishing deliberate hiding from the ordinary Follow toggle; the user approved treating all those ambiguous values as participant opt-outs. Existing fixture dismissals, event-family and competition exclusions retain precedence. Preference version 23 and preference-graph.v8 apply the migration on both server and browser, including legacy-client patches. Refollowing clears the participant opt-out.

Australian teams and athletes appear first in matchup presentation across sports using sourced country identity. Official participant IDs, home/away roles, score associations and classifications are unchanged. Both/neither Australian preserve source order. Editorial covers every currently published Australian cricket international, including separately followed women's sides; it never grants admission.

Regressions: `validate-participant-unfollow.js`, `audit-participant-admission.js`, `validate-australian-presentation.js`, and `validate-australia-international-editorial.js`, plus existing Follow, sync, exclusions and installed-PWA tests.

### 2026-09-22 — Women's T20 detail coverage paused

Until further notice, women's T20 cricket retains fixture identity, timing and Follow admission but excludes editorial, venue, broadcaster and results details. This supersedes the earlier all-Australian-internationals editorial scope; women's ODI and Test coverage remain included. Apply the pause to refreshed projections and cached/browser fixtures, including provider aliases. Regression: `scripts/validate-coverage-pauses.js`.

## Unified Schedule navigation and Feed controls — 22 September 2026

Every Feed card exposes its most specific sourced sport/competition/tournament schedule inside the main Follow screen. Schedule is the default on sport entry. Sport and applicable Australian controls sit above shared section tabs. Feed-origin Back restores the originating Feed state; Notifications owns only its intentional destinations. Event-page bulk selection operates on unique event families through the existing authoritative decision map; selecting editions never creates separate family choices.

Golf is an explicit exception to fixture-only tournament exclusion: published golf tournament cards can be manually added with unconfirmed tee times. A Golf follow automatically admits recognised men's and women's majors only. Ordinary golf events do not auto-enter via player, competition or event follows. Explicit event/competition exclusions and dismissals retain precedence.

The floating Feed filter intersects the already eligible Feed with one sport and a 4+/5-flame threshold. Use the viewer's highest current Heat/Live/Impact rating; only without any personal rating use the highest real peer phase average. Never round up for admission, include modelled votes or change follows. Filters persist locally and do not change Schedule scope.

Tournament hydration uses a rolling 28-day Sydney calendar window, including ongoing tournaments and full tournaments crossing its end. Unconfirmed draw structures remain explicitly provisional and cannot imply a followed player's participation. Source-confirmed identities replace provisional slot contents without rewriting saved actions.

Regression: `validate-feed-follow-repairs.js`, `validate-feed-follow-navigation-browser.js`, `validate-inbox-loading.js`, existing Follow policy, Results/editorial, inbox and PWA checks.

## Feed card presentation — 22 September 2026

The approved [Feed card visual design](feed-card-visual-design.md) adds prominent Sydney sporting-start/status badges during MVP and separates presentation areas for later artwork. Featured imagery never changes canonical participants, eligibility, saved actions or spoilers. The three future artwork families and licensing pipeline remain outside MVP. Regression: `validate-card-timing.js` and `validate-card-timing-browser.js`.
