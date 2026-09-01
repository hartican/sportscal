# Supercharged Sports Discovery — Codex Handoff

## Overview

This document converts the current findings into an implementation-ready handoff for the Supercharged Sports Discovery session. It focuses on feed taxonomy fixes, filter visibility logic, Cincinnati Open card restructuring, sport-specific coverage gating, duplicate-control removal, and top-bar compression. [cite:9][cite:10]

## Feed taxonomy changes

The current feed filter mixes parent categories, subcategories, and event brands in the same layer, which breaks hierarchy and adds noise to browsing. The taxonomy should be normalised into category, subcategory, and event-tag levels so chips reflect structure rather than branding. [cite:9]

### Required hierarchy

| Current item | Correct treatment | Notes |
|---|---|---|
| Motorsport | Parent category | Parent for F1 and Rally. |
| F1 | Subcategory under Motorsport | Keep as a selectable child. |
| Rally | Subcategory under Motorsport | Keep as a selectable child. |
| Goodwood Festival | Event tag, not a category | Classify under Special Events and Motorsport. |
| Le Mans | Event tag, not a category | Classify under Special Events and Motorsport. |
| Extreme | Parent category | Parent for MTB. |
| MTB / Downhill MTB | Subcategory under Extreme | Rename consistently if needed. |
| Surfing | Parent category | Parent for Big-wave Surfing. |
| Big-wave Surfing | Subcategory under Surfing | Do not surface as a separate parent. |
| Snowsports | Parent category | Parent for Alpine / Freestyle Skiing. |
| Alpine / Freestyle Skiing | Subcategory under Snowsports | Keep nested. |

### Implementation notes

- Build the taxonomy as `category > subcategory > eventTag`.
- Do not surface event brands such as Goodwood Festival or Le Mans as first-class filter chips.
- Allow overlap tagging so one event can belong to both Special Events and its sport parent when needed.

## Feed filter visibility logic

The filter should only show categories and subcategories with more than 10 future events. If a subcategory exceeds the threshold, the parent should not appear unless it also has more than 10 direct future events that are not already represented by visible children. [cite:9]

### Required logic

1. Compute `futureEventCount` for every category and subcategory.
2. Show a subcategory chip only when `futureEventCount > 10`.
3. Compute `directFutureEventCount` for each parent after subtracting events already covered by visible child chips.
4. Show a parent category only when `directFutureEventCount > 10`.
5. Hide sparse branches entirely, even if they exist in the static taxonomy.

### Pseudocode

```ts
for (const node of taxonomy) {
  node.futureEventCount = countFutureEvents(node);
}

for (const parent of categories) {
  const visibleChildren = parent.children.filter(child => child.futureEventCount > 10);
  const coveredEventIds = new Set(visibleChildren.flatMap(child => child.futureEventIds));
  const directFutureEvents = parent.futureEventIds.filter(id => !coveredEventIds.has(id));

  parent.show = directFutureEvents.length > 10;

  for (const child of parent.children) {
    child.show = child.futureEventCount > 10;
  }
}
```

This supports the product goal of showing only what is worth the user’s attention, rather than exposing low-signal taxonomy branches by default. [cite:9]

## Cincinnati Open card changes

The Cincinnati Open should move away from separate ATP and WTA cards when matches start on the same day at the same venue. The official tournament schedule is structured around shared day and night sessions at the venue, and the order-of-play sources show ATP and WTA matches mixed across multiple courts on the same date. [cite:9][cite:10]

### Trusted source approach

Use this fallback order for schedule enrichment:

1. Official Cincinnati Open tournament schedule for day/night session boundaries. [cite:10]
2. Official or ProTennisLive order-of-play PDFs for court-by-court sequencing, start times, and `not before` markers. [cite:9]
3. Secondary trusted sources such as BBC or Olympics pages only for round/date confirmation when needed. [cite:7][cite:11]

### Card-model changes

Replace separate male and female cards with a merged venue-day or venue-session model:

- One Cincinnati Open card per `venue + localDate + sessionBlock`.
- Nested sections for Day Session and Night Session when both exist. [cite:10]
- Inside each session, group matches by court using the order of play. [cite:9]
- Show player-level timing as one of: exact start time, `not before`, `followed by`, or session-only fallback. [cite:9]
- Only split into separate cards when the sessions occur on different dates or materially different venues.

### Recommended data shape

```ts
interface EventCardGroup {
  eventGroupKey: string; // e.g. cincinnati-open|venue|2026-08-14|day
  cardTitle: string;
  venue: string;
  localDate: string;
  sessionBlock: 'day' | 'night' | 'all-day';
  mergedTours: Array<'ATP' | 'WTA'>;
  timingConfidence: 'exact' | 'ordered-sequence' | 'session-only';
  subitems: Array<{
    court: string;
    sequenceType: 'scheduled' | 'not-before' | 'followed-by' | 'session';
    approxStart?: string;
    players: string[];
    tour: 'ATP' | 'WTA';
  }>;
}
```

### Update-cards logic

`update-cards` should be edited so that tennis card generation:

- fetches or parses one shared session model first,
- merges ATP and WTA matches by venue and date,
- attaches court session context to each player matchup,
- preserves uncertainty when only sequence data exists,
- avoids duplicate cards for the same venue-day footprint. [cite:9][cite:10]

## NRL and AFL complete coverage gating

Complete-coverage cards for NRL and AFL should only appear when the user’s froth level is High or above, or when either sport is explicitly selected in the feed filter. This reduces blanket domestic coverage noise for lower-intent browsing and keeps broad coverage aligned with clear user appetite. [cite:9]

### Required rule

```ts
const showFullCoverage =
  userFrothLevel >= 'high' ||
  selectedSports.has('NRL') ||
  selectedSports.has('AFL');
```

If `showFullCoverage` is false, only high-signal editorial or must-watch cards for those sports should remain eligible.

## Duplicate controls

The lower control row currently repeats functions that already exist in the top bar, specifically Spoiler results and Services owned. These duplicate dropdowns should be removed from the lower controls area to reduce clutter and avoid repeated decision points in the same viewport. [cite:9]

### Remove

- `Spoilers` dropdown in the lower rail.
- `Services owned` dropdown in the lower rail.

### Keep

- Single authoritative versions in the top bar or global settings pattern.

## Top-bar compression

The current header consumes too much vertical space before the feed starts. The screenshot shows a tall stack containing logo, tagline, timestamp, utility actions, tabs, and then a full filter rail before the first meaningful card. [image:1]

### Recommended layout

Refactor the header into two compact rows:

1. **Row one:** logo, compact timestamp, primary actions.
2. **Row two:** Feed / Standings tabs and a collapsed filter-summary trigger.

### Specific changes

- Reduce logo block height and visual padding.
- Demote the tagline to a single muted line.
- Move timestamp inline with the brand row.
- Convert About, Settings, and Soundtrack into icon buttons or an overflow menu.
- Keep Calendar Sync as the primary high-visibility action.
- Replace the always-open filter rail with a summary trigger such as `All sports • Following • Low froth` that expands on demand.

This should cut dead space, bring the first card higher on the page, and support faster “what matters now” scanning. [image:1]

## Engineering checklist

- Refactor feed taxonomy to category, subcategory, and event-tag layers.
- Reclassify Goodwood Festival and Le Mans as event tags under Special Events plus Motorsport.
- Nest MTB under Extreme, Big-wave Surfing under Surfing, and Alpine / Freestyle Skiing under Snowsports.
- Build visible filter chips from live future-event counts, not static config alone.
- Merge Cincinnati ATP/WTA cards by venue, date, and session block.
- Parse court session timing from trusted order-of-play sources and expose timing confidence.
- Gate NRL/AFL complete coverage cards behind high froth or explicit sport selection.
- Remove duplicate Spoilers and Services owned controls from the lower rail.
- Compress the top bar into a two-row layout with collapsible filters.
