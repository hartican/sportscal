# nothingSport phased implementation handoff for Codex

## Purpose

This document is a phased implementation handoff for **Codex** to build nothingSport incrementally. It translates the current project direction into a practical delivery plan with explicit boundaries, architecture decisions, data contracts, UI rules, and verification checkpoints.

nothingSport should behave like a smart, spoiler-safe sports streaming filter: it should surface only the live or upcoming events that matter, explain why they matter, show where to watch them, and confidently show nothing when there is nothing worth the user’s time.[cite:1][cite:2]

## Product definition

nothingSport is not a generic fixtures app, scores app, or news feed. The core product job is to help a user decide, quickly and without spoilers, whether there is something worth watching **right now**, **later today**, or **this week**.[cite:1]

The product should prioritize:

- Spoiler-safe event discovery.
- Strong filtering by followed sports, leagues, teams, and event classes.
- A ranked feed rather than a flat calendar dump.
- Clear broadcast and streaming availability.
- Narrative and stakes-aware presentation for high-signal events only.[cite:1][cite:2]

The product should avoid:

- Post-match framing in primary feed surfaces.
- Dense fixture lists with no hierarchy.
- Treating routine fixtures and defining moments as visually equivalent.
- Overusing dramatic language for ordinary events.[cite:1]

## Core UX rules

The feed is the product. Calendar views, schedule views, and filters exist to support the feed, but the default experience should answer: “What should I be watching?”[cite:1]

Every surfaced event should answer these questions in one screen:

1. What is on?
2. When does it start in the user’s timezone?
3. Why is it worth attention?
4. Where can it be watched?
5. How urgent is it relative to everything else on the schedule?[cite:1][cite:2]

Primary UX constraints:

- No spoilers in titles, subtitles, summaries, or artwork.
- No scores, winners, result verbs, or retrospective framing in the main discovery flow.
- Narrative copy must be anticipatory, never recap-oriented.
- Empty state is a feature: if no event clears the quality threshold, show nothing useful rather than filler.[cite:1]

## System architecture

Build the system in layers with strict boundaries.

### 1. Canonical event layer

This layer stores factual event truth only:

- Sport
- Competition
- Participants
- Start time
- Venue
- Round/stage
- Broadcast/streaming providers
- Region availability
- Status (`scheduled`, `live`, `ended`, `cancelled`)
- User follow relationships and preference state

This layer must remain free of editorial interpretation.[cite:1]

### 2. Enrichment layer

This layer computes or stores interpretation fields such as:

- significance score
- user relevance score
- watchability score
- storyline metadata
- stakes classification
- intensity tier
- confidence / source attribution

This layer may combine deterministic rules, heuristics, and later editorial overrides, but it must not mutate canonical event facts.[cite:1]

### 3. Rendering layer

This layer decides how an event appears:

- hidden
- plain row
- compact card
- standard card
- marquee card

Rendering should depend on significance, user relevance, and context, not on ad hoc component logic scattered around the app.[cite:1]

## Recommended event model

Start with one durable event object and one nested enrichment block.

```ts
export interface NSParticipant {
  id: string;
  name: string;
  shortName?: string;
  kind: 'team' | 'athlete';
  role?: 'home' | 'away' | 'seeded' | 'challenger' | 'other';
}

export interface NSBroadcastOption {
  providerId: string;
  providerName: string;
  region: string;
  platform: 'tv' | 'streaming' | 'app' | 'web';
  deepLink?: string;
  requiresSubscription?: boolean;
}

export interface NSStoryline {
  archetype?: 'monster' | 'ragsToRiches' | 'quest' | 'voyageReturn' | 'rivalry' | 'rebirth' | 'comedy';
  arcStage?: 'inciting' | 'rising' | 'climax' | 'resolution';
  stakes?: 'low' | 'medium' | 'high' | 'critical';
  narrativeHook?: string;
  intensity?: 1 | 2 | 3 | 4 | 5;
  intensitySource?: 'computed' | 'manual';
  confidence?: number;
  lastReviewedAt?: string;
}

export interface NSEnrichment {
  significanceScore: number; // 0-100
  userRelevanceScore: number; // 0-100
  watchabilityScore: number; // 0-100
  finalFeedScore: number; // 0-100
  reasons: string[];
  storyline?: NSStoryline;
}

export interface NSEvent {
  id: string;
  sport: string;
  competition: string;
  stage?: string;
  round?: string;
  startTime: string;
  endTime?: string;
  timezone: string;
  venue?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  participants: NSParticipant[];
  broadcastOptions: NSBroadcastOption[];
  regionAvailability: string[];
  enrichment?: NSEnrichment;
}
```

## Feed logic

The feed should be score-based, thresholded, and user-aware. The app should not display all events by default; it should display events that clear a minimum bar for both general significance and personal relevance.[cite:1]

A practical first-pass score model:

```ts
finalFeedScore =
  significanceScore * 0.45 +
  userRelevanceScore * 0.35 +
  watchabilityScore * 0.20;
```

Suggested inputs:

| Score | Inputs |
|---|---|
| significanceScore | finals status, knockout stakes, title implications, rivalry status, ranking gap, tournament round, event prestige |
| userRelevanceScore | followed sport, followed league, followed team/athlete, historical engagement, saved reminders, preferred watch windows |
| watchabilityScore | available provider, local timezone convenience, event imminence, live-now bonus, exclusive/high-friction penalty |

Suggested thresholds:

- 80+: marquee placement.
- 65–79: standard feed card.
- 45–64: compact card or secondary rail.
- Below 45: hidden by default unless directly searched.

These thresholds should be configuration values, not hard-coded UI assumptions.

## Storyline rules

Storyline is a selective enrichment system, not a default decoration layer. High-intensity narrative treatment should appear only when the event actually carries meaningful stakes or context.[cite:1]

Implementation rules:

- `narrativeHook` must always be pre-event and spoiler-safe.
- `archetype` should be assigned only when confidence is high.
- Routine events may have no storyline block at all.
- Intensity 1–2 should dominate the system; intensity 4–5 should be rare and earned.
- User-facing labels may be simpler than internal taxonomy, for example “Rivalry”, “Must Watch”, or “Record Chase”.[cite:1]

Example acceptable hook:

> A season-defining clash with finals implications and very little margin for error.

Example unacceptable hook:

> After last week’s collapse, they must bounce back.

The second example leaks retrospective framing and should not appear in the main discovery feed.

## Data sourcing assumptions

The current project material already emphasizes key 2026 event classes and likely AU viewing contexts such as the Masters, Australian Test cricket, NBA Finals, Super Bowl, Le Mans, NRL Finals, and Wallabies fixtures.[cite:2] The first implementation should optimize for these high-signal event types rather than pretending to support every sport equally on day one.[cite:1][cite:2]

Initial data scope should support:

- Event metadata.
- Region-aware watch options.
- Localized start times.
- Tournament/stage context.
- Enough contextual inputs to compute stakes and urgency.

Do not block the first build on perfect global coverage. A narrow but trustworthy catalog is more valuable than a broad low-confidence one.[cite:1]

## Phase 1 — Foundations

Goal: establish the durable domain model and a minimal ingest-to-render pipeline.

Deliver:

- Type definitions for canonical event and enrichment models.
- Seed dataset covering a small set of flagship event classes.
- One normalization pipeline that converts raw source records into `NSEvent`.
- Timezone-safe formatting utilities.
- Spoiler-safety utility layer to validate titles and summaries.
- Provider / broadcaster mapping model for AU-first availability.

Codex tasks:

1. Create `/lib/domain/events.ts` for core types.
2. Create `/lib/domain/scoring.ts` for score interfaces and constants.
3. Create `/lib/data/normalizers/` for source-to-canonical transforms.
4. Create `/lib/safety/spoilers.ts` with helper guards and test cases.
5. Seed local JSON fixtures for development.

Acceptance criteria:

- Events render from canonical data only.
- No UI component depends on raw upstream payload shape.
- Local event times render correctly in Australia/Sydney.
- Safety tests fail when obvious score/result language appears.

## Phase 2 — Ranked feed MVP

Goal: ship the first useful product surface.

Deliver:

- Home feed with sections for `Live Now`, `Starting Soon`, and `Worth Your Time This Week`.
- Score-based ranking pipeline.
- Hidden-by-default behavior for low-signal events.
- Compact and standard event card variants.
- Empty state that confidently says there is nothing worth surfacing.

Codex tasks:

1. Build a feed assembler that groups and ranks events by temporal bucket.
2. Implement `finalFeedScore` calculation with config-driven weights.
3. Build `EventCardCompact` and `EventCardStandard` components.
4. Add explanation chips such as `Final`, `Rivalry`, `Live`, `Starts in 25m`, `On Kayo`.
5. Add snapshot tests for sorting and threshold behavior.

Acceptance criteria:

- Two users with different follows can see different feed ordering for the same schedule.
- Events below threshold are omitted from primary feed surfaces.
- Cards explain why an event is shown without requiring taps.
- The feed remains spoiler-safe when events transition from scheduled to live.

## Phase 3 — Storyline enrichment

Goal: add editorial intelligence without breaking trust.

Deliver:

- Nested `storyline` enrichment support.
- Rule-based stakes and intensity assignment.
- Marquee card component for rare high-priority events.
- One rail such as `Top Storylines This Week` or `Must Watch`.

Codex tasks:

1. Add a deterministic enrichment engine that derives stakes, arc stage, and intensity from event context.
2. Build `NarrativePreviewCard` with `compact`, `standard`, and `marquee` modes.
3. Add a hook formatter that enforces anticipatory copy patterns.
4. Add manual override support for selected flagship events.
5. Add visual regression coverage to ensure routine and marquee events remain clearly separated.

Acceptance criteria:

- Narrative fields are optional and never required for base event rendering.
- High-intensity cards appear only for events above a strict threshold.
- Narrative hooks are anticipatory and spoiler-safe.
- Marquee surfaces feel exceptional rather than common.[cite:1]

## Phase 4 — Personalization and controls

Goal: make the filter genuinely user-shaped.

Deliver:

- Follow management for sports, leagues, teams, and athletes.
- Hidden content rules for sports/leagues the user does not care about.
- User weighting controls such as “more finals”, “less routine league matches”, “prefer local evening windows”.
- Saved reminders / watchlist.

Codex tasks:

1. Create a simple preference model with sane defaults.
2. Feed preferences into `userRelevanceScore` calculation.
3. Add onboarding or settings flows that can be skipped and edited later.
4. Add persistence for follows and hidden entities.
5. Add event explanation strings that reflect user-specific reasons, for example `Because you follow Wallabies`.

Acceptance criteria:

- Personalization changes feed ranking in visible, intuitive ways.
- Users can aggressively suppress sports or competitions they never want surfaced.
- Explanation text reflects both event significance and user preference context.

## Phase 5 — Watch utility layer

Goal: close the loop from discovery to viewing.

Deliver:

- Provider-specific watch CTAs.
- Deep-link handling where available.
- Reminder setting and calendar export.
- Region and subscription-aware fallback logic.

Codex tasks:

1. Build watch action components that prefer the best available provider.
2. Add provider priority logic by region and platform.
3. Add reminder creation hooks and optional calendar export payloads.
4. Add event detail screen for secondary metadata without bloating feed cards.
5. Track CTA impressions and opens for ranking feedback.

Acceptance criteria:

- Every surfaced event has either a clear watch path or a clear explanation of missing availability.
- Feed cards do not become overloaded with tertiary metadata.
- Event detail screens remain spoiler-safe.

## Phase 6 — Editorial and operations

Goal: make the system maintainable and tunable.

Deliver:

- Admin or config-driven overrides for significance, narrative tags, and provider corrections.
- Feature flags for new sports and surfaces.
- Logging and evaluation dashboard for feed quality.
- QA fixtures for critical sports moments and edge cases.

Codex tasks:

1. Build a lightweight override JSON or internal admin model.
2. Add per-sport scoring profiles.
3. Log ranking inputs and selected outputs for inspection.
4. Create regression fixture packs for finals, rivalry matches, overnight events, and null-result quiet days.
5. Add a test harness for “nothing to show” behavior.

Acceptance criteria:

- Feed decisions can be inspected and explained.
- Editors or maintainers can correct high-profile events without code changes.
- The product behaves well on sparse days, not just busy calendars.

## Suggested repo shape

```txt
/src
  /app
  /components
    /feed
    /cards
    /event-detail
    /settings
  /lib
    /domain
    /data
      /normalizers
      /providers
    /feed
    /storyline
    /safety
    /time
    /preferences
  /content
    /seed-events
    /overrides
  /tests
    /fixtures
    /unit
    /integration
```

## Non-negotiable implementation rules

- Never leak scores or outcomes into discovery surfaces.
- Never let raw source schemas leak into UI components.
- Never make storyline mandatory for ordinary events.
- Never default to “show everything”; ranking and omission are product features.
- Never let marquee styling become common enough that it loses meaning.[cite:1]

## Definition of done for MVP

The MVP is complete when the app can ingest a controlled set of sports events, rank them for an Australian user, hide low-signal noise, show watch options, and present a spoiler-safe home feed that feels selective rather than exhaustive.[cite:1][cite:2]

A successful MVP should make a user feel that the app already knows the difference between a routine fixture and something they genuinely should not miss.[cite:1]
