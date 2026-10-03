# Follow and Feed decisions

## Viewing action status and evidence — 3 October 2026

An explicit match status governs the existing Watch/Replay purpose. A live, scheduled, upcoming, postponed, cancelled, abandoned, suspended or other non-final status cannot become a replay action merely because a partial/placeholder score is present. Legacy score-only records without a supplied status retain their existing result fallback. Re-reading normalized provider options preserves an explicit unverified/unknown replay marker; purpose `replay` and a general dated provider source do not promote that marker. Existing dated replay/both evidence without the newer marker and explicitly verified replay evidence remain usable. Provider URLs, subscriptions, fixture entitlement, permalink evidence, follows, Results and action recording remain unchanged; the recorded Watch/Replay purpose now agrees with the declared match state. Regression: `validate-viewing-action-integrity.js`, included in the existing Australian viewing gate, and actual Feed/Schedule provider controls plus installed/offline normalization checks. Controlled replay-positive inputs are test evidence, not actual provider playback verification.

## UCL stage-calendar presentation — 3 October 2026

The five existing knockout programme records keep their IDs and unconfirmed participants/kickoffs. Follow Schedule shows their separately reviewed UEFA calendar windows with an explicit Madrid-date label; those venue-calendar dates do not become Sydney match dates or start times. Calendar windows order the programme chronologically. An explicitly confirmed exact sporting start takes over the Sydney date display. The existing `sport:champions-league` selector maps exactly to `competition:uefa-champions-league`, and direct Schedule links resolve back to that selector. A missing UCL Code shows unavailable instead of advertising the broader Football schedule. Programme records remain under that existing Code, with no new Events routing, Feed admission, consent, action, rating, retention or reminder rule. Existing source and editorial clocks remain; separate timing provenance dates the calendar review. Regression: `validate-ucl-stage-calendar.js --published` and both-engine actual Schedule/calendar rendering checks.

## WSL venue/calendar delivery — 3 October 2026

The approved rollout adds eleven men’s Championship Tour event windows and preserves the existing mixed Margaret River record, including its ID, result and calendar provenance. WSL is a distinct child of Surfing and begins unfollowed. A broad Surfing follow or derived compatibility fields cannot grant WSL consent; explicit WSL/competition or participant follows are required. Legacy versioned `sport:wsl` aliases remain Surfing selections when upgraded; new WSL selections use preference version 25. Exclusions, seven-day history and twelve-month horizon remain. Published windows have date-only precision; no heats, daily times, future Raglan dates, participants or result provider is invented. Events parents have no rating controls. Regression: `validate-wsl-calendar.js --published`, Follow parity and both-engine venue/upgrade checks.

## SailGP venue/calendar delivery — 3 October 2026

The approved venue rollout ingests reviewed official two-day calendars through the existing cards owner: 13 current-season events plus individually published future weekends within twelve months. Existing seven day IDs, source/result observations and Geneva timing survive; future entries are empty rather than inherited from the 2026 roster. Country panels use existing reviewed palettes or neutral colours; unverified course/venue geometry uses the sailing glyph. Calendar coverage is distinct from result/entry/timing completeness, so the partial explanation remains. Events parents receive no rating controls and no new choice is followed by default. No admission/exclusion/retention/notification rule changes. Regression: `validate-sailgp-calendar.js --published`, existing timing/Follow policy gates and both-engine venue/cache checks.


## Followed drivers on fixture cards — 3 October 2026

F1 and WRC followed participants use one horizontal scrolling row beneath the fixture title. Every name remains reachable by touch and keyboard with a minimum 44px target height; names retain their existing profile action and Follow identity. This changes presentation only, with no pagination, new admission or preference change. Regression: `validate-mobile-presentation-browser.js` in Chromium and WebKit at four widths and both themes.

## SailGP coverage wording — 3 October 2026

Published SailGP race days are a partial window, not complete season coverage. The existing coverage explanation states that season teams may be listed while event-specific entries and future session times may be unconfirmed. Two source-proven Geneva clock corrections keep every fixture/canonical ID, participant reference, follow, exclusion and saved-action key. Results retain their original observation and spoiler policy. No admission, reminder eligibility, retention or opt-in rule changes. Regression: `validate-sailgp-quality.js --published`, Follow policy parity and both-engine source-card/cache checks.

## Explicit tournament phase in Follow and Feed — 3 October 2026

Date-only Golf/Tennis or explicitly marked tournament parents show “In progress” when their published status explicitly says live, ongoing or in progress. This describes the tournament phase; it does not imply a session is live now. Compact, selected, expanded and minimised Follow cards retain the cue, as does Feed. Dates alone cannot create progress. Completed, cancelled, abandoned, postponed, suspended or interrupted status blocks the cue. Keep date ranges, session-time uncertainty and Results privacy.

This repairs a reproduced source-to-screen omission. It changes no Follow admission, Live Now filter, fixture identity, refresh, reminder, rating or personal setting. Regression: `validate-feed-card-presentation.js`, `validate-installed-pwa-upgrade-browser.js`; dated two-engine actual-parent rendering evidence is retained with the CTO delivery report.

## Fantasy deadline evaluation defaults — 2 October 2026

The user approved a one-time ON/FPL Classic default for every pre-rollout saved profile, including OFF/None. This supersedes the feature's initial OFF/default-None policy. Automatic enablement is labelled a rollout choice, never user consent. Add rollout version 2; preserve every later explicit OFF/None, reject replayed defaults over recorded choices, and protect markers from older clients. New users receive an unchecked checkbox on the existing startup screen; only Save & start persists their onboarding choice. Resets use the new-user OFF/None defaults. Other competitions remain unselected, and future games are never silently selected.

This is optional presentation on already eligible soccer fixtures. It does not follow EPL, admit fixtures, alter spoilers or grant notification consent. Ongoing FPL evaluation is explicitly operator-enabled, separate from unconfirmed provider licence approval, with readable Settings/About fine print and the existing server kill switch. No account linking or fantasy submissions. Regressions: validate-fantasy-rollout.js, validate-fantasy-deadlines-browser.js and the existing source/API, Follow parity and startup/PWA gates.

## Reviewed Lancashire/Durham provider equivalence — 30 September 2026

CA50/ESPN1116 identify the same men's Lancashire side, and CA40/ESPN924 the same men's Durham side. An existing explicit Follow under either exact ID applies to the same participant; it does not opt into a different competition, gender or reserve side. Updating Follow through either alias replaces the group's prior explicit choice, so an old Unfollow cannot defeat a deliberate refollow. Confirmed participant exclusions match both aliases; ordinary Unfollow retains its existing neutral semantics. Stored preferences are not bulk rewritten. Only the separately reviewed CA39484/ESPN1513451 fixture pair is consolidated; both action aliases remain. Evidence and cutover limits: `docs/quality/cricket-provider-identities.md`. Regressions: `validate-cricket-provider-identities.js`, `validate-cricket-identities-browser.js`, existing server/client Follow parity.


## Sporting schedules, Follow navigation and golfer entries — 25 September 2026

Approved in the grill-me interview and implementation request. This supersedes the earlier rule excluding ordinary golf tournaments from participant-based admission. An explicit golfer follow, or Golf with Follow Australians enabled, admits one source-confirmed tournament card when that golfer is entered. Tee times and playing partners are nested details, added when officially published. Men's and women's fields use the same opt-in; a broad Golf follow alone retains its existing majors/Presidents Cup scope. A golfer follow does not create separate session cards. Published withdrawals and explicit fixture/family/competition exclusions win. Missing fields, reserve lists, past winners and tour membership do not establish an entry. Temporary source failures retain last verified evidence, with its original check time.

Tournament schedules show published contests and one pending-information note, not a card for every hypothetical bracket slot. Followed golfers and Australians are shown first, with the rest of the published pairings expandable. BJK ties retain actual rubber evidence and Results privacy. Other sports retain their existing consent rules; team membership is not proof of an individual playing in a match.

All Follow sports share collapsible navigation with a persistent compact sport/section bar, Filter action and accessible chevron. Open on the current round/event, with Earlier, Later and Jump to current actions instead of a Starting round selector. Browse filters are separate from Feed filters and follow preferences, stored per sport. Rounds, competitions, tournaments, series, countries and participants appear only where the schedule supplies choices.

F1 uses a location composition, host sporting colours and a sourced circuit outline. Licensed geometry is the graphic fallback; no invented circuit shape or unlicensed photograph is required. F1 never uses opposing-team colour halves.

Regressions: `validate-experience-reliability.js`, `validate-experience-browser.js`, existing Follow/server parity, coverage, tournament and Match Centre validators.


## Match Centre fixture navigation — 24 September 2026

Open fixture returns to the main Feed, expands and focuses the selected eligible card, and never uses the marquee-only standalone fixture page. Seed the selected Match Centre record if ordinary Feed pagination has not loaded it. Clear temporary Feed filters only if they hide this target; do not create pins, follows or reminders, change Results, or resurrect dismissals. Regression: `validate-tennis-tie-layout-browser.js`.

## Compact tennis tie presentation — 24 September 2026

Nation-versus-nation Feed ties do not reserve empty player/tournament artwork space. Tighten rating, timing and venue spacing while retaining touch targets, expansion state, Results privacy and existing Follow admission. Match Centre displays available tie totals and rubber sets with their source-side identity, never guesses missing scores. Regression: `validate-tennis-tie-layout-browser.js`.

## Match Centre and versioned anticipation — 24 September 2026

Manual refresh clarification: pull-to-refresh is Match Centre only, triggered on release rather than holding. Refresh uses the same complete eligible membership, with no change to follows, exclusions, dismissals or Feed filtering. Score/status reconciliation is shared with Feed to prevent schedule-only snapshots undoing sourced live state. Regression: `validate-match-observations.js` and `validate-match-centre-refresh-browser.js`.

Match Centre replaces Events when enabled; Major Events stays in Follow. Membership uses the complete personalised Feed eligibility pipeline, not Feed filters or loaded pages. Men's NRL/AFL/cricket/rugby union and both tennis tours are in scope. Show from 30 minutes before start to one hour after confirmed completion; keep interruptions and multi-day breaks. Tennis parents and rubbers are excluded; ties expose rubbers as details. Results remain globally spoiler-controlled; rating/chat stays in the fixture view.

For future fixtures assigned `consensus.v1` after activation, keep 1 Heat point and award 19 extra after the 48-hour Impact cutoff for exact agreement with the rounded latest-per-other-person Impact mean. One eligible peer suffices; exclude self, moderated/anonymous accounts and Pulse. Existing predictions keep `anticipation.v2`. No epoch reset. Efficiency remains successes / resolved scored predictions, never participation/social points. Regression: Match Centre model/browser and consensus database validators; rollout gates in `match-centre-rollout.md`.

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

## Socceroos fixtures - 24 September 2026

Senior Socceroos fixtures qualify for an explicit Football follow, including provider-loaded friendlies without an editorial marquee flag. Canonical national identities use Socceroos rather than Australia. Explicit exclusions and participant mutes still win.

## Bathurst and V8 Supercars - 24 September 2026

User explicitly authorises V8 Supercars under Motorsport and default Bathurst 1000 admission for Motorsport followers. Only the 2026 Bathurst race is in scope; no other rounds or sessions. Direct V8 Supercars follows also qualify. Explicit mutes and exclusions still win. This is a scoped exception to the new-coverage opt-in rule.

Bathurst inheritance implementation clarification - 24 September 2026: Motorsport parent selections must load the Supercars schedule as well as qualify its Bathurst fixture for automatic Feed admission. Schedule projections must retain source-backed marquee classification so Follow and Feed use the same eligibility evidence. Explicit exclusions continue to win; this does not opt users into other Supercars rounds.

## Tennis parent cards and contest admission — 24 September 2026

Approved in the 22 September PSD interview and authorised for implementation on 24 September. This supersedes fixture-only Feed exclusion for tennis parents and the tennis singles-finals restriction. Other sports retain their admission rules.

- Explicit tournament/event-family or competition follows admit a stable edition/stage overview. Confirmed participation by an explicitly followed player, collection member or tennis team also admits the parent while relevant participants remain active. Broad Tennis alone does not admit every parent. Preserve the 22 September participant-opt-out migration: ordinary Unfollow does not veto another followed participant; event/competition exclusions and fixture dismissals retain precedence.
- Followed players' matches remain standalone at every round. Explicit tennis-team follows admit nation-versus-nation ties, without inheriting national follows from other sports. Broad Tennis also admits published singles finals and championship team ties. Doubles require followed participants or manual selection; rubbers remain tie detail, never independent Feed cards. Tournament names containing “Finals” do not make each contest a final.
- Known tournaments appear within the existing twelve-month horizon. Credible non-official sources are accepted; provisional timing is labelled. Missing dates remain in Upcoming rather than receiving fictional start times. Active parents stay near Now through the sourced phase end; completed explicitly followed parents use ordinary seven-day retention. A parent admitted solely through participants disappears when none remain active, without deleting match history or saved state.
- Separate distinct sourced stages in different windows. Shared draws at one edition/window use one parent with labelled contest sections. Dates/location changes do not change parent identity.
- Parents expose context, schedules and compact contest rows. Existing standalone contests show In Feed. Adding another contest uses persisted fixture pins, ordinary chronology and no implicit reminder. Ratings, chat and match reminders belong to contests, not overviews.
- Davis Cup 2026 Final 8 is Bologna, 24–29 November venue-local dates; the attachment's Brisbane example is not a data source. Published draw and schedule sources are retained in `data/canonical/tennis-team-contests.v1.json`. Unassigned quarter-final slots retain an explicit date window. Sydney dates may cross midnight.

Regressions: `validate-tennis-feed-normalisation.js`, `validate-tennis-feed-browser.js`, Follow decision/parity, participant unfollow, event exclusions and PWA checks.

## Tournament fixture detail — 24 September 2026

BJK Cup overviews show all published ties and nested singles/doubles match details, including source-backed scores behind existing Results controls. Rubber records never become standalone Feed fixtures. BJK women's team identities remain separate from Davis Cup men's teams and country follows in other sports. Future bracket participants stay spoiler-protected. Existing admission, pins, reminders and rating rules are unchanged. Regression: `validate-tournament-hydration.js`, `validate-bjk-browser.js` and tennis/Follow policy tests.

The existing 28-day provisional structure remains. A seven-day pre-start source-check window plus ongoing tournaments adds factual hydration; it does not replace longer published calendars. Unresolved data gaps are reported in the refresh report only, with no operational warning added to cards.

## Tennis card tournament branding — 25 September 2026

The approved compact Feed polish supersedes the earlier instruction to omit tournament artwork on national ties: show a sourced transparent tournament mark with a readable centred label in the header. Do not reserve an empty hero if no verified mark exists. Reuse the existing scoped schedule link/handler there and remove its duplicate footer link. Admission, tournament follow semantics and navigation state remain unchanged. Regression: `validate-feed-card-polish-browser.js` and `validate-tennis-tie-layout-browser.js`.

## Presidents Cup and ongoing parents — 25 September 2026

Explicit Golf sport followers automatically receive the Presidents Cup overview only. Direct Presidents Cup family/competition follows additionally admit sourced competitive sessions; no direct follow is silently created. Existing exclusions, dismissals and pins retain precedence. Unrelated golfer/tour follows do not opt in, and other golf admission remains unchanged. “Live From” and other studio programmes are not fixtures. Golf’s Major Events directory includes the direct-follow control.

Parent overviews remain full before/on day one and default to a compact title/status row on subsequent active local calendar dates. Underlined titles open scoped Follow schedules; a separate 44px chevron expands inline. Explicit expansion and child cards are preserved. Existing completed retention is unchanged.

Match Centre includes the Presidents Cup overview’s USA–International totals between sessions while authoritative tournament status is active, and for one hour after confirmed completion. Results OFF hides scores. Round completion alone cannot complete the overview. Regressions: validate-card-coverage-corrections.js and validate-card-coverage-browser.js.

## Laver Cup - 27 September 2026

London 2026 published singles/doubles use existing canonical athlete/collection follows and exclusions. Tournament overview stays in Events/Schedule; these round-robin contests gain no admission from broad Tennis alone. Completed matches retain the ordinary seven-day window. No user preferences are changed.

## Football projection classification — 27 September 2026

Football Code membership uses an explicit canonical sport ID when present; legacy records use exact Football/Soccer/FIFA/Premier League aliases. Substring matches such as American Football must not enter Football. Preserve Follow consent, saved fixtures and American Football coverage. Regression: `validate-football-classification.js --published`.

Rebuild an existing Code projection without fetching unrelated sports through `node scripts/update-cards.js --code-projections --codes=football -p`. This is a projection rebuild from current canonical facts, not proof that sources, results or standings were refreshed. Current card/result gates still govern publication; a local projection pass cannot waive them.

## Football schedule context — 27 September 2026

Entering Football with no saved category opens All Football, rather than implicitly selecting Champions League. Saved explicit categories and user follows remain unchanged. EPL fixtures retain the official matchweek, season and competition display name; earlier publications recover the exact sourced matchweek label without deriving rounds from dates. The existing canonical EPL table is projected into Follow with its observation time, games played, wins, draws, losses and points. Standings remain hidden with Results off until the existing explicit reveal confirmation is accepted; this does not change Results or follows.

Regression: `validate-football-schedule.js` and `validate-football-schedule-browser.js`. This is partial EPL repair, not certification of source accuracy, viewing rights, UCL or Europa League coverage.

## Fixture-specific free viewing — 27 September 2026

The shared provider registry recognises `ten` as 10 Streaming, an Australian free service. Existing sourced fixture options remain authoritative: the 25 September Socceroos–Brazil fixture exposes 10 Streaming and Paramount+, while 29 September remains Paramount+-only. Do not add 10 as a generic national-team competition entitlement. The destination is the provider homepage, not a claimed direct match stream. Retain dated source evidence; availability of a replay is separate from the historical live broadcast right.

Evidence: official Socceroos viewing guide checked 27 September, `https://socceroos.com.au/news/how-watch-australia-vs-brazil-international-friendlies-2026`. Regression: `validate-football-viewing.js` and the Feed/Schedule links in `validate-football-schedule-browser.js`.

Viewing evidence clarification: fixture-level broadcast entitlement does not imply a direct match URL. Only an explicit link scope or fixture URL establishes that. Completed status alone does not establish a replay; without dated replay/both evidence, the provider action says “Check replay availability.” Existing verified replay actions and provider destinations remain usable. The shared Australian viewing and provider regression suites cover this distinction.

## European club fixtures — 27 September 2026

The free-source trial adds named Champions League and Europa League league-phase fixtures to the existing Football schedule. Preserve 46 existing club IDs; new directory records do not create follows. Existing Liverpool follow admits its seven remaining league-phase fixtures at the 27 September reference clock; broad Football alone does not admit club fixtures. Explicit mutes and normal timeline retention still apply. Shared card and calendar attribution preserves source provenance. This is coverage expansion under existing consent rules, not a new opt-in decision. Regression: `validate-openligadb-football.js` and `validate-european-football-browser.js`.

## Measurement alignment — 28 September 2026

Ordinary Unfollow remains neutral in discovery measurement as well as product behaviour. Negative feedback counts only explicitly discovery-classified negative swipes; unknown recommendation provenance, archive and ordinary unfollow do not establish annoyance. Existing categorical events remain retained. No preference, eligibility or consent rule changes. Versioned operator exports prevent legacy unfollow-inclusive aggregates from silently driving tuning. Regression: `validate-pilot-readout-sql.js` and `validate-discovery-measurement.js`.

## NBL fixture viewing — 28 September 2026

Preserve the official NBL schedule's explicit 9Now label per fixture; a Saturday date alone does not grant free coverage. ESPN-labelled NBL27 fixtures retain Disney+, Kayo and Foxtel as Australian alternatives, with the league's current viewing guide as platform evidence. The provider destination remains a general service link; historical live rights do not establish a replay. Withdrawn fixture options must propagate through the existing quick refresh. Follow admission, preferences and subscription purchases are unchanged. Regression: `validate-nbl-viewing.js` and `validate-nbl-viewing-browser.js`.

## Fixture profile return and Results enforcement — 30 September 2026

Implementation of the existing profile-return and spoiler decisions: use the fixture's canonical Football Code for EPL aliases; show only the relevant competition's standings behind the current Results setting or a profile-local reveal. Closing a profile restores the originating route, participant control and card position, including late Feed redraws, until the next user interaction. It never recreates dismissed/excluded fixtures or changes Follow/Results consent. Regression and scope: `docs/quality/football-profile-journey.md`, `scripts/validate-football-profile-browser.js`.

## 30 September 2026 — coverage repair (supersedes earlier conflicting rules)

Within an explicitly followed sport/category, source-confirmed finals series qualify regardless of team/competition follow or audience. Tennis singles qualify from quarter-finals; national-team knockout ties qualify, with rubbers nested. Doubles retain participant/manual admission. Competition names containing Finals and golf final rounds are not knockout evidence. Explicit exclusions, mutes and dismissals win; ordinary Unfollow stays neutral.

Women have separate sport choices, follows, filters, schedules and rankings. Only the unfiltered main Feed may interleave explicitly followed categories chronologically. Other surfaces retain one selected category. Combined tennis tournament overviews may differentiate draws; rankings remain separate. Remove unnecessary Men display suffixes without changing canonical gender.

Cricket follows use format then team: Tests, ODIs, T20Is and BBL. Retain twelve national sides (Australia, England, India, New Zealand, South Africa, Pakistan, Sri Lanka, West Indies, Bangladesh, Afghanistan, Ireland, Zimbabwe), BBL and its eight clubs. No player or round browsing. Women's coverage is Australia Tests, all Women's Ashes formats and Australia's ODI/T20 World Cup matches; this boundary overrides finals admission and the earlier women's T20 detail pause. Remove out-of-scope follows for every account with a repeatable versioned migration and recovery snapshot; preserve saved activity and necessary opponent/score identities. Enforce the same boundary on ingestion, server preference writes and old client caches.

Events and Match Centre are independent navigation destinations. Events contains followed-sport tournament/series/race overviews and scoped schedules. Match Centre uses the complete eligible personalised Feed, all sports, 30 minutes before start to one hour after confirmed completion, including multi-day breaks. Membership does not remove Feed cards. Retained cards render immediately while refresh runs; scores and status share an observation, terminal results survive stale live data. Keep existing scheduler ownership and request budgets.

Regression contracts: scripts/validate-coverage-repair.js, scripts/validate-cricket-coverage.js, existing Follow client/server parity and Match Centre contracts. Production and physical installed-PWA verification remain release gates without historical waivers.

30 September implementation clarification: preference version 24 preserves an explicit participant mute. Older clients used mute for ordinary Unfollow; their records migrate to neutral Unfollow. Discovery and graph migration must preserve the current version and its mute meaning. Missing worthwhile research remains queued and must not block a valid fixture; explicitly locked owner previews still require their researched copy. Withheld previews publish no fallback prose.

## 1 October 2026 — approval to deploy the coverage repair candidate

After reviewing the candidate and the explicit notice that physical installed-PWA acceptance remained outstanding, the owner instructed: “Look good. Deploy it”. Release PR #23 with its passing automated/browser gates. This is fresh approval for this candidate, not a historical waiver or evidence that physical-device testing passed. Keep physical installed-PWA acceptance recorded as unverified; all database recovery, GitHub SHA, READY deployment, production alias and live-render verification requirements remain in force.

## Programme reconciliation — 1 October 2026

Implementation clarification, with no new follow rule: NRL finals-week summaries no longer appear as individual Schedule fixtures; their historical source records and saved-action identities remain untouched. Actual matches, including both preliminary finals and the Grand Final alias, remain. Legacy daily tennis overviews are omitted from Schedule when the sourced catalogue can generate their stable parent, preventing an obsolete daily summary beside the real ties. The newer independent Events projection retains those programme records as overview metadata.

The stable Final 8 tennis parent is completed only when its entire seven-tie bracket is present with official sourced results, unique slots/identities and known winners. No clock-only completion or parent winner text is added. Parent identity, source details, all ties/rubbers, explicit follows/exclusions and the ordinary seven-day completed retention remain unchanged. Unsupported or partial formats stay unconfirmed. Source evidence is retained on the parent; no account or scheduler work is added.

Regressions: `validate-programme-reconciliation.js --published`, `validate-tennis-feed-normalisation.js` and `validate-programme-browser.js`. The browser check exercises the actual Results confirmation control rather than overwriting a legacy preference field.

## Team tennis parent categories — 1 October 2026

Implementation of the 30 September women’s category decision: a team tournament parent inherits an explicit women/men category only when every attached contest has the same confirmed category. Missing/mixed evidence remains unknown; an explicit parent category is preserved. BJK’s seven women’s ties and Davis Cup’s men’s ties keep their parent IDs, follows, exclusions, completion and saved actions. The unfiltered Feed may interleave admitted parents; filtered Feed respects the existing separate sport choices. No name-based gender guess or new admission/polling rule is introduced. The actual filter journey also reproduced an undefined banner-colour variable for a category without its own colour; its fallback now resolves the selected sport ID explicitly. Shell 343 carries that focused-view repair. Regression: `validate-programme-reconciliation.js --published` and the actual category filter in `validate-programme-browser.js`.

## Stakes rating presentation — 2 October 2026

Fixture cards and fixture detail present the existing viewing ratings as Low, Mid, High, Huge and Epic stakes. Five monochrome beef-steak glyphs occupy a centred 220px row: each 44px touch target contains a 30 × 20px glyph with 14px visible spacing. Personal labels use the full wording; the crowd label sits beside its numerical average rather than duplicating an adjective tag. Heat, Pulse and Impact values, editability, rewards, Feed admission and Events parent-card rules remain unchanged. Regression: `validate-rating-flames-browser.js` covers stakes presentation, accessibility, geometry and saving/recovery.

## Follow journeys experiment — 2 October 2026

Owner-approved one-time migration adds Alcaraz, Sinner, Djokovic, De Minaur and Sabalenka to all existing registered accounts. Preserve explicit participant opt-outs/mutes and event/competition exclusions. Future accounts retain ordinary onboarding; later unfollows and preference resets never reapply the experiment. Canonical NS identities and aliases are authoritative, not the brief’s example provider codes.

Automatic reminders apply across sports only to sourced knockout/final fixtures containing followed participants, including early main-draw tennis rounds and timed nested Event fixtures. Qualifying, group stages, tennis 250/500s, warm-ups and exhibitions are excluded from automatic ON. Manual known-time reminders remain available. Explicit fixture OFF, global auto OFF and push opt-outs win. Parent dates, session starts, play order and estimated times never create automatic reminders. The same canonical fixture shares one reminder across surfaces. This policy is implemented in phase 2; phase 1 changes follows and fine print only.

Results OFF hides scores/outcomes, but tournament/Event progression and upcoming opponents remain visible. The advancement-clue notice belongs in Settings > About > Results and spoilers, with no Feed warning. Coverage requires actual published fixtures; a calendar entry establishes neither participation nor a match. Regression: validate-tennis-journey-migration.js plus existing Follow and user-state contracts.

### Phase 2 implementation — 2 October 2026

Fixture reminders use config/fixture-reminder-policy.js across the server, Feed and nested Event fixtures. Only actual future fixtures with sourced exact/not-before instants can schedule. Automatic intent requires a followed participating athlete/team and a sourced knockout stage, including early tennis rounds. Qualifying, 250/500, warm-ups, exhibitions and group stages remain excluded from tennis automatic intent. Tournament names and parent/session dates cannot establish eligibility. Manual intent may select otherwise excluded fixtures with valid timing. Global auto OFF and fixture OFF persist; sporting/system and installation opt-outs gate delivery independently. Saving an automatically eligible card cannot turn its derived intent into a manual choice.

Account intent lives separately from installation delivery. Authenticated interfaces resolve canonical fixture aliases and source facts on the server, ignoring submitted titles/times. Dedicated and nested surfaces share a delivery receipt. New timing updates unsent reminders; delivered/uncertain receipts are not reset. Offline choices carry their own change timestamp so a stale device cannot restore ON over a newer OFF.

Regression contracts: validate-automatic-reminders.js, validate-automatic-reminders-browser.js, validate-reminder-dispatch-capacity.js and the existing notification, Follow, persistence, spoiler and upgrade gates. A passing rehearsal is not observed ATP/WTA coverage or installed-phone delivery.

### Phase 3 journey calendar — 2 October 2026

The approved experiment adds a rolling twelve-month contextual calendar in the existing Tennis Schedule. A single edition retains separate published ATP/WTA date windows and existing canonical tournament aliases. Confirmed entries/qualification, very-likely product expectations, conditional participation and verified withdrawals carry separate provenance and check dates. Smaller events require confirmed participation. Unknown entry or withdrawal claims are recorded in the seed audit, not upgraded to facts. Team qualification never establishes individual selection. Calendar context is not admitted to Feed, does not establish live status and cannot create a match or reminder.

Only effective followed players appear; later unfollows and tournament/competition exclusions remain effective. Journey data is one shared deferred file loaded on opening its disclosure, with source/check information inside edition details. Existing Results help remains the sole advancement-clue notice. Regressions: validate-tennis-journeys.js and validate-tennis-journeys-browser.js, plus Follow, reminder, spoiler and installed-PWA gates.


### 2026-10-02 — MotoGP venue pilot

An explicit MotoGP follow admits one combined Q1/Q2 card, Sprint and Grand Prix per published weekend. Practice and warm-up remain in Schedule and cannot enter Feed, including through a participant follow or pin. Existing exclusions and seven-day Feed history remain authoritative. Published future weekends without a session timetable retain their full date window and an unconfirmed session day/time; no start is inferred. The current rider field is not carried into an unconfirmed future season. New competition choices never imply consent. Events parents have venue artwork and no rating controls. Regression: `scripts/validate-motogp-venue-pilot.js` and `scripts/validate-follow-policy-parity.js`.

## Live scores on Feed — 2 October 2026

The approved Athletes repair moves shared source-oriented live scores onto collapsed and expanded Feed fixture cards with Results ON. Results OFF removes score content and accessible score labels. Existing final results are not duplicated; freshness and terminal observations remain authoritative. Match Centre stays until Athletes is delivered. Sporting refresh operates independently of Fantasy Deadlines, whose enrichment remains opt-in. Regression: validate-feed-live-scores.js and validate-feed-live-scores-browser.js.

## 2 October 2026 — followed drivers presentation

The followed-driver and team links beneath racing fixture titles use one horizontally scrolling row. Keep every followed name and its profile action, 44px touch height, keyboard access and visible focus. Remove pagination and wrapping; this changes presentation only and does not grant or remove follows. Applies to F1, MotoGP, WRC, Motorsport and Cycling. Regression: `validate-mobile-presentation-browser.js`.

## Athletes destination and linked profiles — 2 October 2026

The approved repair replaces Match Centre navigation with Athletes: Feed, Events, Athletes, Follow. Legacy Match Centre destinations lead to Feed, whose cards retain shared live scores. Athletes lists every effective individual follow across supported sports, with the five tennis experiment players featured; teams do not inherit individual follows. No migration or future-account onboarding change is repeated. Canonical names on collapsed/expanded Feed, Event and nested fixture cards open their shared existing profile content inside Athletes, while teams keep their Follow destination. Placeholders and editorial prose cannot create an identity link. Back restores the source card, browsing/filter/expansion state, scroll and focus; dismissed/unfollowed fixtures cannot be recreated by navigation. Opening a profile match may temporarily reveal it without persisting a filter change.

The athlete feed scope reuses authenticated server Follow eligibility and canonical fixtures, independently of mounted Feed pages or temporary filters. Public local preferences use a bounded POST without private account reads. Basic verified identity remains available when rich profiles are missing. Results OFF removes statistics, outcome biography/history and recent results. Advancement clues and upcoming opponents retain the existing rule and sole Results-help notice. Generic labels use Athletes, with player/driver/rider/golfer terminology by sport. Reminder intent, explicit OFF and device permission/installation readiness remain separate; no new permission prompt accompanies navigation. Regression: validate-athletes.js, validate-athletes-browser.js, validate-follow-first.js and existing Follow/reminder/spoiler/cache/upgrade contracts.

## Verified current context and honest tennis gaps — 3 October 2026

The free-only repair distinguishes a confirmed current tournament entry/participation from a published individual fixture. When no available fixture exists, Athletes may show confirmed current participation and labelled tournament dates, with a direct official schedule link where reviewed. Expectations cannot establish current participation, and an expired tournament edition cannot remain the current schedule destination. Event/competition exclusions remain effective. A removed fixture is explained as removed rather than misreported as unavailable source coverage. Sourced fixtures remain openable when timing is unresolved; the existing shared reminder policy still holds invalid or unverified clocks. Exact/not-before, unresolved, verified publication pending, unavailable NS coverage and explicitly stale evidence have separate wording. Parent dates, session starts and play order never create reminder clocks. No Feed banner, spoiler notice or additional alert category is added. Regression: validate-athletes.js, validate-athletes-browser.js and validate-tennis-journeys.js.

## 3 October 2026 — Grand Tour stage coverage and independent consent

The approved venue rollout adds the published men’s Giro and Vuelta stage calendars and published future Tour stages. Separate Tour de France, Giro d’Italia and La Vuelta choices begin unfollowed; broad Cycling, derived sport keys and discovery do not opt into them. Version 26 preserves the pre-existing versioned `sport:tdf` alias as Cycling before treating new explicit child selections independently. Preserve direct rider follows, fixture pins, exclusions and neutral Unfollow. Unfollowing a child retains an explicit Cycling parent and never selects siblings. Existing Tour action/canonical IDs, clocks, results and runtime rider/jersey context remain intact.

Current 2026 calendars contain 21 stages each; rest days are Schedule information. Tour 2027 has three published stages. Giro/Vuelta 2027 have edition dates only, represented by Events metadata with no synthetic sporting or rating cards. Parents never borrow the first stage’s route. Calendar-only additions do not infer start times, entries, results, Australian viewing or routes from another edition. Regression: `validate-grand-tour-calendars.js`, `validate-grand-tour-venue-browser.js` and the installed-browser upgrade rehearsal.

## 3 October 2026 — Published men’s major rounds

The approved venue rollout publishes four round cards for each men’s major. The four independent Major Events choices begin unfollowed. Explicit Golf, a direct major family or a recognised major competition follow admits those rounds using the existing major rule. Retained championship-window identities stay available for manual pins and source-confirmed golfer/Australian entries; broad Golf avoids a duplicate fifth card. Golfer follows do not create round cards, and an empty field does not establish participation. Existing women’s coverage, ordinary tournaments, Presidents Cup rules, exclusions, reminders and saved identities remain intact. Tee times stay unconfirmed; a published round date never creates an exact clock. Regression: `validate-golf-major-calendars.js`, `validate-golf-major-venue-browser.js` and installed-browser upgrade rehearsals.

## Dakar venue rollout — 3 October 2026

Dakar is a separate Motorsport child and competition. Its new choice begins unfollowed; broad Motorsport, WRC and source discovery do not grant Dakar consent. Explicit competition/sport choices and manual pins use existing exclusions and retention. Published prologue and competitive-stage dates receive sporting cards; rest days are Schedule notes with no rating or fixture actions. The overall edition route belongs only on Events parents. Unverified stage geometry uses the attributed rally-raid fallback; calendar-only dates cannot imply class entries, results or viewing rights. Existing mixed competition coverage remains mixed.

Regression: `validate-dakar-calendars.js`, `validate-dakar-venue-browser.js`, shared server/client policy parity and both installed-browser upgrade rehearsals.

## Le Mans venue rollout — 3 October 2026

The existing independent Le Mans Major Events choice remains authoritative and begins off for users who have not selected it. An explicit Le Mans event-family follow admits published qualifying, Hyperpole and the separate Start/Finish cards. Broad Motorsport discovery does not grant consent; family/competition exclusions still win. Practice and warm-up remain Schedule only, even when individually pinned. No other WEC round or new results/live provider is added. Preserve evt_79/evt_80 and all saved references and results; apply only the reviewed timing and venue overlay. Use the full 13.626 km Circuit de la Sarthe, distinct from Bugatti. Future visible TBC text overrides structured-data placeholders; finish is clearly approximate from the confirmed start plus 24 hours. Events parents have no rating controls. Regressions: validate-lemans-calendar.js, both-engine venue and installed-browser upgrade checks.

## Follow favourites and restored Match Centre — 3 October 2026

The owner-approved three-release plan supersedes the 2 October Athletes navigation replacement. Navigation is Feed, Events, Match Centre, Follow. Follow opens on My athletes & teams; Browse sports is a sibling, with adaptive Players/Drivers/Riders/Golfers/Athletes & Teams labels and separate individual/Teams tabs, individuals first where supported. Cricket remains team-only. Direct team follows never imply individual follows. The five existing tennis experiment identities are reused without another migration. Shared profiles open under Follow, next appearance first; Back restores the origin, and legacy Athletes links resolve there. Deeper profile history/form/statistics and worldwide local-hero identities are future work. Release 1 restores the existing Feed-derived Match Centre; Everything/Followed is delivered in release 3. Regression: validate-athletes.js, validate-athletes-browser.js, validate-follow-first.js.

### 2026-10-03 — Release 2 participant schedules

Participant schedule reads use the existing Feed endpoint's bounded athletes scope, optionally one canonical participant, without requiring a Follow or Feed admission. The landing fetches one page and explicit continuation; profiles request only their participant. Explicit exclusions, dismissal, archive and account changes retain precedence. Individual tennis automatic Feed admission uses reminder event/stage scope independently of notification preferences and timing availability; 250/500, qualifying, group stages, warm-ups and exhibitions stay manual. Existing event/finals/team paths remain. Profiles show Enable alerts through existing device setup, permission only after a tap, and preserve notification OFFs. Basic source-linked profiles avoid downloading detailed history.

The reviewed China Open first-court 3 October de Minaur–Halys match is admitted individually with exact published 11 am Beijing timing, court, source and genuine check clock. Whole-tournament certification is unnecessary. Other showcase players retain the verified entry/context and explicit next-match gaps. A retained export never advances source clocks on rebuild.

### 2026-10-03 — Release 3 shared Match Centre

Everything is the default Match Centre view, sourced from the shared published NS catalogue without personal follows, filters, dismissals or preferences. Followed reuses the complete personalised Feed eligibility query, including explicit manual pins, without depending on mounted pages. Both use the established thirty-minute pre-start/one-hour confirmed-completion window and preserve interruptions, multi-day breaks, unresolved status and canonical alias reconciliation. Elapsed time never manufactures completion; past scheduled starts say awaiting status. Compact rows expand inline, retain expansion on refresh and switch, respect Results OFF and source score-side identity, and expose sourced incidents/innings/sets/rubbers and official links where available. Add to Feed uses existing pin commands without opponent follows; excluded and Schedule-only sessions preserve their admission restrictions.

Regression: validate-match-centre.js, validate-match-centre-browser.js, validate-follow-favourites-browser.js, validate-follow-policy-parity.js, validate-automatic-reminders.js.

Further 3 October organiser checks: the Tokyo order of play independently verifies Alcaraz–Arnaldi, Round of 16, Colosseum, not before 12:30 pm local. The China WTA draw independently verifies Sabalenka–Bartunkova, Round of 32, with individual day/court/time unpublished. A confirmed undated next pairing remains profile-visible using its labelled tournament context for retention; neither tournament dates nor the draw create a start or reminder clock. Djokovic's quarterfinal context records the undecided opponent separately, without a fabricated fixture.

Offline first-use correction: when the deferred favourites interface cannot load, its shell fallback retains My athletes & teams, Browse sports and Retry. The already cached directory remains reachable without altering follows or notification choices. Installed-browser regression follows the new favourites landing before opening Browse sports.

Chromium/WebKit installed-browser rehearsal passes the 400-to-402 upgrade and offline first-use Browse route, with persisted preferences and no consent changes. The returning-user fixture acknowledges the existing taxonomy notice before testing normal navigation; initial old-navigation and modal-intercept failures are recorded separately. This is automated browser evidence, not physical phone or push receipt proof.
