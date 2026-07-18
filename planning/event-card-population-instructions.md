# nothingSport Event Feed Population Instructions

Purpose: give AGENT or a research LLM a strict, self-contained brief for creating spoiler-safe nothingSport event feeds that can be imported without hand-editing `index.html`.

Return format: one JSON object matching `schemas/event-feed.schema.json`. Use `feeds/incoming/events.template.json` as the starting shape.

Operating rules for AGENT:
- Prefer repo inspection and direct file edits over MCP.
- Limit MCP use unless the user explicitly asks for it.
- Keep copy concise and practical.
- Preserve the existing feed pipeline unless a dedicated cleanup pass changes it consistently.
- Treat every incoming research feed as an additive update. Do not delete an existing card merely because it was not included in a new research batch. A newer source may supersede only the same event; `publish-feed.js` enforces this preservation-first merge by default.
- At the end of each implementation pass, provide stage and commit commands for HITL testing.

## Import Flow

For the normal end-to-end card refresh, run:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
node scripts/update-cards.js
```

This applies `feeds/editorial-preview-overrides.json` to both feeds, regenerates Storyline fields, queues future high-stakes cards for research, audits editorial quality and spoilers, and validates both JSON feeds. A failed editorial audit is a required research-and-rewrite stop, not a reason to replace the copy with a generic template.

The lower-level import flow remains available when publishing a new additive feed:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
node scripts/validate-feed.js feeds/incoming/events.json
node scripts/publish-feed.js feeds/incoming/events.json
node scripts/validate-feed.js data/events.json
```

The `daily-feed-...` version prefix is acceptable for the current scaffold, but it is pipeline terminology rather than a literal daily promise. Rename it only in a dedicated cleanup pass that updates template, docs, scripts, and published metadata together.

## Required Feed Envelope

```json
{
  "schemaVersion": "events.v1",
  "version": "daily-feed-YYYY-MM-DD",
  "publishedAt": "YYYY-MM-DDT09:00:00+10:00",
  "sourceNote": "Short note describing what changed and which source families were checked.",
  "events": []
}
```

Rules:
- `version` must be a lowercase slug, for example `daily-feed-2026-07-11`.
- `publishedAt` and `sourceCheckedAt` must be ISO date-time strings.
- Every displayed card time must be Australia/Sydney local time, formatted `HH:MM`.
- If an official UTC start exists, include `startTimeUtc`; otherwise omit it and provide Sydney `date` and `time`.
- If an official start time is unknown, use a representative viewing window and clearly mark the timing as approximate in copy or metadata.

## Required Event Fields

Each event object must include:

```json
{
  "id": "stable-lowercase-id",
  "eventId": "stable-lowercase-id",
  "sport": "Human sport label",
  "key": "f1",
  "name": "Full event name",
  "displayTitleCompact": "Short card title",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "broadcaster": "Primary Australian broadcaster",
  "broadcastOptions": ["Primary Australian broadcaster"],
  "expected": 8,
  "venue": "Venue or null",
  "liveWindow": 3,
  "round": "all",
  "narrativeType": "race",
  "selectedSentence": "One spoiler-safe sentence for selected cards.",
  "fullSpiel": "Spoiler-safe opened-card context, 80-700 chars.",
  "sourceName": "Source label",
  "sourceUrl": "https://source.example",
  "sourceCheckedAt": "YYYY-MM-DDT09:00:00+10:00"
}
```

Leave `key` semantics as they are in the current app and validation utilities. It is a supported feed/app field tied to active-sports logic, not a field to reinterpret during feed population.

Supported `key` values:
- `wimbledon`
- `rugby`
- `fifa`
- `f1`
- `tdf`
- `nrl`
- `afl`
- `cricket`
- `nba`
- `masters`
- `lemans`
- `nfl`
- `ski`

Supported `round` values:
- `all`
- `early`
- `knockout`
- `quarterfinal`
- `semifinal`
- `final`

## Inclusion Threshold

For MVP feed generation and staging, ignore events with `expected < 5`.

Do not keep sub-5 events merely for completeness. A later full-schedule mode can change this rule intentionally, but current feeds should filter hard and focus on useful watch-planning cards.

## Future Horizon Rules

The July block remains the canonical MVP proving path. Once that flow validates, feeds should expand toward:

- all supported sports preloaded more than 3 months ahead where official or broadcaster data is practical
- annual marquee events preloaded up to 12 months ahead when dates and broadcast assumptions are reliable
- next-edition marquee placeholders added only when they can stay spoiler-safe after the current edition finishes

`data/feed-meta.json` records `feedHorizon` after publish/build so AGENT can quickly check first date, last date, sports coverage, and whether the standard 3-month preload target is currently covered. Treat `feedHorizon.status: "scaffolded"` as planning metadata, not proof that every future sport is fully researched.

## Card Copy Rules

### Journalistic pre-event requirement

Every upcoming card with `storyline.stakes >= 4` inside the 10-day editorial window must read like current pre-event sports commentary, not deterministic schedule information. This requirement is sport-agnostic and applies to existing and newly added sports.

Before a high-stakes preview can pass:

- research current official competition, governing-body, team or broadcaster reporting
- identify one clear editorial angle and at least two event-specific context signals, such as recent form, tournament path, team selection, injury, championship standings, session result, grid penalty, course profile, tactical matchup or title history
- save the final copy and its evidence in `feeds/editorial-preview-overrides.json`
- set `editorialPreview.status` to `journalistic`, include the angle and `contextSignals`, and record the exact source URL and check time
- refresh session-dependent copy after its prerequisite, such as Formula 1 qualifying or a preceding Tour stage

Reject copy that could be pasted unchanged onto another fixture. A venue, start time, broadcaster, generic stakes or phrases such as “points and strategy”, “terrain and general-classification impact” and “finals pressure” do not constitute an editorial preview.

High-stakes cards more than 10 days away should carry `editorialPreview.status: "research-required"` and `needsPreviewRefresh: true`. Do not pad them early with speculative prose. `node scripts/update-cards.js` adds this queue state automatically and will fail once a queued card enters the editorial window without a researched override.

`displayTitleCompact`:
- 80 characters or fewer.
- Prefer named matchups or stage names: `Norway vs England - Quarterfinal`, `Stage 15 - Plateau de Solaison`.
- For calendar cards, keep titles compact and non-editorial.

`selectedSentence`:
- 20-180 characters.
- One sentence only.
- Explain why a normal user would care.
- For a high-stakes card in the editorial window, lead with its current tension, not its date, venue or broadcast logistics.
- Do not reveal results, winners, advancement, or bracket consequences by default.

`fullSpiel`:
- 80-700 characters.
- Explain why the event matters, viewing commitment, broadcast path, and replay logic.
- For a high-stakes card in the editorial window, explain the source-backed form, selection, standings, route or tactical facts that create that tension. Viewing logistics may support the analysis but cannot replace it.
- Stay spoiler-safe unless the product intentionally creates a protected result card.

Avoid default-card language such as:
- explicit winners in recent knockout cards
- `X are through`
- `winner moves onto confirmed opponent`
- result-first titles for recent events

If a Must Watch or similarly prominent event finished within roughly 3 days, keep visible default copy generic and spoiler-safe. Save, calendar, watching, and catch-up controls must remain usable even if spoiler details are hidden by the UI.

## Scoring Rules

`expected` is 1-10:
- `10`: global final, championship decider, iconic mountain/race stage, or once-per-year flagship.
- `9`: semifinal/final, major title-contender matchup, high-stakes decider, major Australian interest.
- `8`: strong knockout, major stage, marquee rivalry, meaningful race/session.
- `7`: good specialist watch, clear replay value, or strong weekly briefing candidate.
- `6`: relevant but optional.
- `5`: lowest MVP inclusion tier; include only with a clear planning reason.
- `1-4`: exclude from MVP feeds.

Default booleans:
- `replayEligible`: true for expected >= 7, unless the event is live-only.
- `highlightEligible`: true for expected >= 6.
- `briefingEligible`: true for expected >= 7.
- `catchupEligible`: true for expected >= 7.

## HITL Review Metadata

Marquee AI-generated copy should use machine-readable human review metadata. Add `copyReview` when `selectedSentence` or `fullSpiel` needs a human review gate.

```json
"copyReview": {
  "reviewRequired": true,
  "reviewComplete": false,
  "note": "Marquee AI-generated selectedSentence and fullSpiel need HITL review before publish."
}
```

When reviewed, set `reviewComplete` to `true` and include at least one of `reviewer`, `note`, or `overrideSource`.

## Source Rules

Prefer sources in this order:
1. Official competition schedule or governing body.
2. Official Australian broadcaster schedule.
3. Reputable schedule/results pages only when official pages do not expose enough structure.

Every event needs:
- `sourceName`: human-readable source name.
- `sourceUrl`: exact URL used.
- `sourceCheckedAt`: when the source was checked.

Do not invent teams, venues, broadcasters, or times. If a matchup is not set, use bracket-safe wording such as `Semifinal 2 - QF winners` and explain only the non-spoiling watch-planning context.

## Sport-Specific Guidance

F1:
- Include qualifying, sprint, and race only when useful.
- Use `narrativeType`: `qualifying`, `sprint`, `race`.
- Australian broadcaster usually maps to Kayo/Foxtel only if evidenced.

Tour de France:
- Prioritise mountain stages, time trials, opening stage, final stage, and high-profile sprint stages.
- Use `narrativeType`: `mountain`, `time-trial`, `sprint`, `hilly`, `ceremonial`.
- `liveWindow` should usually be 3-5 hours.

Rugby:
- Prioritise Wallabies Tests, Bledisloe, Lions/World Cup-tier fixtures, and finals.
- Use `narrativeType`: `test`, `series`, `final`, `rivalry`.

Wimbledon:
- Include Australian contenders, quarterfinals onward, singles finals, and unusually strong doubles stories.
- Set `round`, and where possible add `gender` as `men`, `women`, or `unknown`; `eventType` as `singles` or `doubles`.

Cricket:
- Include Day 1 for Tests, final sessions/deciders where dates are known, ICC knockouts, Boxing Day Tests, and New Year Tests.
- `liveWindow` can be 8 hours for Tests.

NRL:
- Include finals, preliminary finals, Grand Final, and State of Origin if added later.

NBA:
- Include Finals games and potential deciders only.
- Australian time must be Sydney local time.

Masters:
- Include all four rounds, with higher scores for Round 3 and Final Round.

Le Mans:
- Include start, key overnight/restart windows if available, and finish.

NFL:
- Include Super Bowl and potentially conference championships if the app scope expands.

Ski:
- Include World Cup finals, downhill, super-G, and high-profile Australian-relevant events.

## Output Checklist

Before returning JSON:
- Validate every event has a unique `id` and `eventId`.
- Confirm all `date` and `time` fields are Sydney local time.
- Confirm every source URL is real and specific.
- Confirm no event with `expected < 5` is included.
- Keep all default copy spoiler-safe.
- Confirm every high-stakes card inside 10 days has `editorialPreview.status: "journalistic"`, at least two context signals and an exact current source.
- Run `node scripts/update-cards.js`; do not call the card update complete while its editorial audit fails.
- Run or ask the implementer to run `node scripts/validate-feed.js feeds/incoming/events.json`.

## Pass Commands

At the end of a documentation pass:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add planning/event-card-population-instructions.md feeds/incoming/README.md feeds/incoming/events.template.json
git commit -m "Document nothingSport feed rules"
```

At the end of a schema pass:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add schemas/event-feed.schema.json scripts/lib/feed-utils.js scripts/validate-feed.js feeds/incoming/README.md feeds/incoming/events.template.json
git commit -m "Add feed review metadata support"
```

At the end of a generated-feed pass:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add scripts/build-stage1-feed.js data/events.json data/feed-meta.json
git commit -m "Make stage one feed spoiler safe"
```

At the end of a horizon metadata pass:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add scripts/lib/feed-utils.js scripts/publish-feed.js scripts/build-stage1-feed.js data/feed-meta.json planning/event-card-population-instructions.md feeds/incoming/README.md
git commit -m "Add feed horizon metadata"
```
