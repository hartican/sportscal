# Nothingsport Product Spec Brief

## Purpose

This brief compiles the canonical product direction established in this session for Nothingsport (NS), using later refinements as authoritative where they supersede earlier ideas. NS is a smart sports streaming filter built to answer two linked user questions: **what is worth watching now, and what else is on that I might care about?** The product must preserve a clutter-free, spoiler-safe decision feed while earning enough trust to become the canonical front door for live sports checking, ideally replacing a patchwork of official league, broadcaster, and streaming apps for many users.[cite:1][cite:2][cite:3]

The core design tension is **trust versus clutter**. NS should curate what matters, but it must not create fear that relevant fixtures are being hidden. The product therefore separates a high-signal decision layer from a complete coverage layer, while allowing sport-specific contexts to temporarily widen the aperture for users who want full fixture awareness.[cite:1][cite:2]

## Product Vision

Nothingsport should become the **single trusted front door for live sport**: a place where a user can open one app, understand whether anything is worth their time, verify that nothing important is missing, see where to watch, and optionally drop into social viewing around a live event.[cite:1][cite:2][cite:3]

A concise product principle for this direction is:

> **Nothingsport curates what to watch, but never hides what is on.**

This principle reconciles the product’s editorial promise with the real behaviour of users like Jim, who do not want to watch every NRL or AFL fixture but do want assurance that every fixture is available somewhere in the product so they do not have to cross-check the official apps.[cite:2][cite:3]

## Core Experience Model

### 1. Decision feed and coverage view

NS should have two distinct but connected modes:

- **Decision feed**: the curated home feed that surfaces only the most worthwhile events, using spoiler-safe preview framing and significance ranking rather than exhaustive listing.[cite:1][cite:2]
- **Coverage view**: a complete fixture layer within sport-specific contexts, allowing users to inspect all events in a competition or round without polluting the main feed.[cite:2][cite:3]

The home feed remains the product’s editorial centre of gravity. It should not be diluted into a fixtures dump. At the same time, each sport should have a full-fixtures layer so that a user can confirm who is playing, what round is on, and whether a lower-priority event still matters to them personally.[cite:2][cite:3]

### 2. Trust design: coverage, judgement, control

Trust should be treated as a designed system made of three promises:

- **Coverage**: users believe the product contains every fixture they may care about for supported sports.[cite:2][cite:3]
- **Judgement**: users believe the home feed is intelligently selective, not merely incomplete.[cite:1][cite:2]
- **Control**: users can always widen from curated to complete views when they want to inspect a sport more deeply.[cite:2][cite:3]

This is what allows NS to become the canonical front door rather than a recommendation sidecar.[cite:2]

### 3. Card bridge into sport completeness

The main feed should use summary cards as the bridge between curation and completeness. A representative pattern is:

- Main feed card: `NRL this round`
- Subtext: `2 worth watching · 6 other fixtures`
- Tap action: expands into the relevant round view
- Sport hub top tabs: `Worth Watching`, `All Fixtures`, `Standings`, `Results/Replays`

This gives users confidence that more exists without forcing that volume into the primary feed.[cite:2][cite:3]

### 4. Sport focus completeness override

When the user intentionally focuses on a sport, NS should temporarily widen the feed for that sport. This is especially relevant for NRL and AFL, where fixture awareness matters even when viewing intent is selective. The sport focus override should temporarily behave like a “froth” state for that selected sport, displaying all fixtures for that context until the user changes focus.[cite:3]

The key nuance is that this override should be **contextual and reversible**, not global. The home feed stays curated, while selected sport contexts become exhaustive.[cite:2][cite:3]

## Ranking and data model

The product should maintain a clean separation between canonical event truth and interpretation layers. This matches the preferred architecture already discussed in adjacent project materials, where the event record stays factual and the significance layer decides what treatment an event receives.[cite:1]

Recommended logical layers:

- **Canonical event layer**: sport, competition, teams/players, start time, venue, broadcaster, round, and user follow state.[cite:1]
- **Curation / significance layer**: inferred stakes, rivalry, title implications, narrative hook, intensity, and watchability score.[cite:1]
- **Rendering layer**: decides whether an event appears as a plain row, a compact card, a marquee card, a summary card, or only inside a full-fixture view.[cite:1]

Two output scores should be treated separately:

- **Curated feed score**: ranks events by significance, user affinity, and practical watchability.[cite:1][cite:2]
- **Completeness list score**: prioritises chronology and discoverability inside all-fixtures contexts, with little or no hard filtering beyond explicit user hides.[cite:2]

This ensures completeness never hijacks the logic of the home feed, while the home feed remains explainable and selective.[cite:1][cite:2]

## Preference learning system

### 1. Swipes as primary tuning input

Swiping is the core implicit preference mechanism. A swipe itself is already a fine-tuning act and should update the preference graph immediately. The product should not over-ask the user to restate the same preference explicitly after every swipe.[cite:4]

Startup should use an abbreviated swipe calibration over marquee events and the top 10 major sports only. The product should prefer recognisable event and player anchors over generic taxonomic categories. For example, it should show `Wimbledon` before `Tennis`, and only then deepen into adjacent events, players, and contexts as the user provides signal.[cite:4]

### 2. Fine-tuning page

The first qualifying dislike or swipe-left should introduce the existence of the tuning feature and offer a path to a dedicated fine-tuning page. That page should use a card-array model inspired by broad-to-specific preference sorting, with increasing granularity from major sports and marquee events into competitions, players, national affinities, local stars, and related event families.[cite:4]

The page should autosave continuously. Partial completion is still useful, and every interaction should update preferences immediately. The user can re-access this page at any time from the top bar menu.[cite:4]

### 3. Tune overlay cadence

The `Tune Now / Not now` overlay should not appear after every swipe. It should be an intermittent, decaying nudge. The canonical cadence from this session is:

- Always show on the **first** qualifying dislike swipe.[cite:4]
- Skip on the **second** qualifying dislike swipe.[cite:4]
- After that, decay frequency as swipe count rises.[cite:4]
- If the user has already meaningfully refined their algorithm in the fine-tuning page, reduce tuning-overlay frequency dramatically.[cite:4]
- In most cases, go straight from swipe learning back into the feed or into the rating overlay instead of doubling up prompts.[cite:4]

Meaningful fine-tuning should be defined behaviourally, for example through a threshold of multiple ranking/sorting interactions, multi-branch refinement, repeat voluntary visits, or multiple tuning sessions.[cite:4]

### 4. Five-star rating signal

Post-event or archived-card star ratings should remain as a separate signal from swipes. Swipes indicate expected interest; star ratings indicate whether the event actually delivered value or spectacle. This distinction should remain explicit in the model so the system can learn not just what looked appealing beforehand, but what was genuinely satisfying afterwards.[cite:4]

A one-tap star-rating opportunity should often replace the archived card in the feed. Unrated cards can be archived away after a bounded number of later sessions so the feed does not become clogged with stale feedback requests.[cite:4]

## Social layer

The social feature should be tightly event-anchored rather than a generic social network. The intended flow is:

`Mark event as Watching Now` → jump to event-specific **public feed** → optional **private watch-party chat** for friends.[cite:5]

Canonical product rules from the earlier session materials:

- **Public event feed**: scoped strictly to the event, moderated, structured more like a focused Facebook group or Reddit thread than a free-for-all timeline.[cite:5]
- **Private chat**: encrypted, unmoderated, and intended for impunity among friends, while telemetry collection remains de-identified and detached from user identity.[cite:6]
- **Promoted prompts**: framed as if a group organiser asked them, allowing event-level data gathering on spectacle, key moments, or player impressions without making the product feel surveillant.[cite:6]
- **Watch link surfaced at top**: a canonical watch destination remains visible while users are in the social context.[cite:5]
- **Push invites**: users in a group can ping followers or friends to join a live watch party.[cite:5]

This social layer should be positioned as a selective enrichment feature for high-signal live events first, not an everywhere layer sprayed across all fixtures.[cite:1][cite:5][cite:6]

## MVP scope

The MVP should focus on the minimum product that proves NS can deliver curated judgement plus dependable coverage while staying operationally manageable and technically reliable.

### MVP goals

- Make the home feed obviously more useful than a raw fixture list.[cite:1][cite:2]
- Make supported sports feel complete enough that users do not need to cross-check multiple apps, especially for NRL and AFL.[cite:2][cite:3]
- Start learning preferences from behaviour without requiring a heavy onboarding flow.[cite:4]
- Keep the significance engine rule-based, interpretable, and bounded to a small number of high-signal sports and competitions.[cite:1]

### MVP product features

#### Home

- Curated decision feed only.[cite:1][cite:2]
- Summary cards for supported sports and rounds, especially `NRL this round` / `AFL this round` bridge cards.[cite:2]
- Card subtext that exposes hidden completeness, for example `2 worth watching · 6 other fixtures`.[cite:2]
- Plain-language significance framing such as `Must Watch`, `Rivalry`, or `Record Chase`, with spoiler-safe copy.[cite:1]

#### Sport views

- Sport hubs with tabs for `Worth Watching`, `All Fixtures`, `Standings`, and optionally `Results/Replays` where supported.[cite:2]
- Sport focus override to temporarily widen into all fixtures for the selected sport, especially NRL/AFL.[cite:3]
- Immediate refresh when a sport override is activated so the view is current.[cite:3]

#### Preference learning

- Lightweight startup swipe calibration across top 10 sports / marquee anchors.[cite:4]
- First-swipe Tune overlay introduction, then decaying cadence thereafter.[cite:4]
- Fine-tuning page with autosaving card-array sorting.[cite:4]
- One-tap star ratings on archived or past-event cards.[cite:4]

#### Social (MVP-lite)

- `Watching Now` entry point on selected live events.[cite:5]
- Event-scoped public room for major live events only.[cite:5]
- Basic private watch-party chat only if technically feasible without destabilising core feed work; otherwise defer private chat body to V2 and keep only room primitives in MVP.[cite:5][cite:6]

### MVP technical approach

- Rule-based significance scoring first, not AI-first enrichment.[cite:1]
- Start with a narrow set of high-signal sports or event classes where stakes are easiest to infer and explain, such as marquee tennis, NBA playoffs/finals, NRL finals, Wallabies Tests, major cricket Tests, and similar high-value event classes.[cite:1]
- Reuse a single event object and add optional enrichment rather than designing separate parallel record systems.[cite:1]
- Keep strong schema boundaries between factual data, preference state, and narrative/significance interpretation.[cite:1]

### MVP limiting factors

#### Technical limits

- **Data completeness**: fixture, broadcast-rights, and result/replay coverage are hard dependencies; unreliable upstream data will undermine trust fast.[cite:2][cite:3]
- **Scoring confidence**: rule-based significance scoring is strongest on marquee events and weaker on routine fixtures, especially across many sports.[cite:1]
- **Live social complexity**: moderated public rooms, encrypted private chat, push invites, and de-identified telemetry together create high coordination and compliance complexity for an MVP.[cite:5][cite:6]
- **Operational moderation burden**: public event feeds need moderation rules and tooling before broad rollout.[cite:5]
- **Cross-sport breadth**: trying to support all sports equally in MVP will dilute both quality and trust.[cite:1]

#### User limits

- Users may not yet trust curation enough to stop cross-checking official apps.[cite:2]
- Completist users may interpret omission in the home feed as absence from the product unless completeness affordances are explicit.[cite:2]
- Too many prompts around swiping, tuning, and rating can make learning feel like labour.[cite:4]
- Users may not understand the distinction between a curated feed and a coverage view unless the UI names and transitions are very clear.[cite:2]

## V2 scope

V2 should deepen personalisation, confidence, and social density only after the MVP proves that NS can reliably act as the front door for watch decisions and fixture checks.

### V2 goals

- Improve personal relevance through denser, longer-term behavioural learning.[cite:4]
- Expand the significance model to more sports and contexts while preserving restraint.[cite:1]
- Turn social behaviour into useful event-level intelligence without violating privacy expectations.[cite:5][cite:6]
- Increase replacement value versus official apps by deepening coverage, social proof, and watch-planning utility.[cite:2][cite:5]

### V2 product features

- More sophisticated preference graph linking sports, events, players, teams, national affinities, local stars, tours, and related competitions.[cite:4]
- Better adaptive tuning cadence based on confidence, recency, explicit refinement, and inferred stability of preferences.[cite:4]
- Stronger post-event rating flows and potentially richer spectacle / pulse scoring for marquee events.[cite:4][cite:6]
- Expanded sport-hub completeness and better replay/results integration where rights and data permit.[cite:2][cite:3]
- Full private watch-party experience with public/private room switching, follower pings, and richer group tools.[cite:5]
- Opt-in, de-identified, event-level crowd-sourced prompts to gather real-time sentiment and spectacle data around marquee matches.[cite:6]
- Shared recommendations or “mates watched / recommended” surfaces as a selective extension of the event model.[cite:1]

### V2 technical evolution

- More automated enrichment once rule systems are trusted, while retaining editorial override for flagship events.[cite:1]
- Better coverage of narrative hooks, rivalry classification, and significance tiers beyond the initial pilot sports.[cite:1]
- Stronger trust instrumentation around missed-event reporting, false positives, and confidence scoring.[cite:1][cite:2]
- More robust moderation, privacy, and telemetry infrastructure for social data products.[cite:5][cite:6]

## North-star metric framework

The key north-star metric from this session is:

### Trusted Sports Decision Rate (TSDR)

\[
\text{TSDR} =
\frac{\text{weekly active users who make a watch decision or fixture check in NS}}
{\text{weekly active users with at least one tracked live-sport opportunity}}
\]

This metric captures the core job-to-be-done better than raw sessions: it measures whether NS is actually becoming the place where users decide what to watch and verify what is on.[cite:2]

### Quantitative metrics

Key supporting measures:

| Objective | Metric | Definition |
|---|---|---|
| Become first check | Trusted Sports Decision Rate | Weekly users making a watch decision or fixture check in NS |
| Replace app-hopping | External cross-check rate | Share of users still checking official/broadcaster apps before deciding |
| Preserve trust | Fixture coverage confidence | User confidence that every fixture they care about is available in NS |
| Preserve curation | Feed relevance rate | Positive actions per surfaced curated card |
| Avoid clutter | Meaningful-card density | Meaningful actions per viewed feed card |
| Prevent misses | Regret rate | Users reporting a missed event they would have watched |
| Improve learning | Personalisation lift | Positive-action rate after 10+ interactions versus first 10 |
| Encourage explicit refinement | Fine-tune conversion | Users opening tuning after prompt / prompt exposures |
| Protect from prompt fatigue | Prompt-dismissal burden | Dismissals, exits, or repeated ignores after tuning or rating prompts |
| Serve completists | Full-fixture adoption | Use of `All Fixtures` within followed sports |
| Drive payoff capture | Spectacle-rating completion | Share of eligible archived cards that receive ratings |
| Social usefulness | Watching Now entry rate | Share of eligible live-event viewers entering the social layer |
| Social density | Event room participation | Unique participants per event room |
| Coverage quality | Supported-fixture completeness | Supported fixtures with correct participants, times, and watch destinations |

### Qualitative measures

NS should also be evaluated through recurring qualitative questions:

- Do users trust NS enough not to cross-check other sports apps?[cite:2]
- Do users feel that the feed is calm rather than busy?[cite:2]
- Can users tell quickly what is worth watching?[cite:1][cite:2]
- Can completist users find every fixture they care about in one or two taps?[cite:2][cite:3]
- Do swiping, tuning, and rating feel useful rather than repetitive?[cite:4]
- Do social rooms feel event-focused and additive rather than noisy or generic?[cite:5]

### Cohorts

Metrics should always be segmented by user type:

- Curator: wants only must-watch events.[cite:2]
- Hybrid: wants curation plus occasional schedule checking.[cite:2]
- Completist: wants all fixtures for selected sports such as NRL/AFL.[cite:2][cite:3]
- Team-first: follows teams closely.[cite:1]
- Event-first: follows majors, finals, and marquee clashes.[cite:1][cite:3]
- Player-first: follows athletes across tours and events.[cite:4]
- New user, personalised user, established user cohorts by interaction volume.[cite:4]

## Key implementation principles

- Keep **later refinements canonical** when they conflict with earlier explorations.[cite:1][cite:2][cite:4]
- Preserve the distinction between **curated judgement** and **dependable coverage**.[cite:1][cite:2]
- Use significance and narrative treatment **selectively**, never across every routine fixture.[cite:1]
- Treat swipes as the default learning primitive; explicit tuning and ratings are accelerators, not mandatory chores.[cite:4]
- Make completeness explicit enough that users trust the product, but not so omnipresent that the home feed collapses into clutter.[cite:2]
- Build social around canonical events, not generic follow graphs.[cite:5]

## Immediate recommendation to Product Chief

For the next build phase, NS should prioritise proving one thing: that it can become the **trusted single front door** for a user’s live-sport decisions without sacrificing the editorial calm that makes the product distinctive. This means the MVP should focus ruthlessly on a curated decision feed, explicit but contained coverage views for NRL/AFL-style completist use cases, lightweight behavioural learning through swipes and ratings, and only a narrow, event-anchored social layer where it clearly strengthens the product.[cite:1][cite:2][cite:3][cite:4][cite:5][cite:6]
