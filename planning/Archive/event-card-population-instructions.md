# Sportscal Event Card Population Instructions

Purpose: give another LLM a strict brief for filling Sportscal event cards with current, sourced event data that can be imported without hand-editing `index.html`.

Return format: one JSON file matching `schemas/event-feed.schema.json`. Use `feeds/incoming/events.template.json` as the starting shape.

Import command after the JSON is returned:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
node scripts/validate-feed.js feeds/incoming/events.json
node scripts/publish-feed.js feeds/incoming/events.json
```

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
- Every time shown in cards must be Australia/Sydney local time, formatted `HH:MM`.
- If an official UTC start exists, include `startTimeUtc`; otherwise omit it and provide Sydney `date` and `time`.

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

Supported `key` values:
- `wimbledon`
- `rugby`
- `fifa`
- `f1`
- `tdf`
- `nrl`
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

## Card Copy Rules

`displayTitleCompact`:
- 80 characters or fewer.
- Prefer named matchups or stage names: `Norway vs England - Quarterfinal`, `Stage 15 - Plateau de Solaison`.

`selectedSentence`:
- 20-180 characters.
- One sentence only.
- No result spoilers for upcoming events.
- Explain why a normal user would care.

`fullSpiel`:
- 80-700 characters.
- Spoiler-safe unless the event is already complete and the card title clearly marks it as a result.
- Include the practical viewing angle: live, replay, highlights, early morning, long window, or high stakes.

## Scoring Rules

`expected` is 1-10:
- `10`: global final, championship decider, iconic mountain/race stage, or once-per-year flagship.
- `9`: semifinal/final, major title contender matchup, high-stakes decider, major Australian interest.
- `8`: strong knockout, major stage, marquee rivalry, meaningful race/session.
- `7`: good specialist watch, clear replay value, or strong weekly briefing candidate.
- `6`: relevant but optional.
- `1-5`: only include if the sport needs schedule completeness.

Default booleans:
- `replayEligible`: true for expected >= 7, unless the event is live-only.
- `highlightEligible`: true for expected >= 6.
- `briefingEligible`: true for expected >= 7.
- `catchupEligible`: true for expected >= 7.

## Source Rules

Prefer sources in this order:
1. Official competition schedule or governing body.
2. Official broadcaster schedule for Australia.
3. Reputable live schedule/results pages only when official pages do not expose matchups clearly.

Every event needs:
- `sourceName`: human-readable source name.
- `sourceUrl`: exact URL used.
- `sourceCheckedAt`: when the LLM checked it.

Do not invent teams, venues, broadcasters, or times. If a matchup is not set, use bracket-safe wording such as `Semifinal 2 - QF winners` and explain the bracket path in `fullSpiel`.

## Sport-Specific Guidance

F1:
- Include qualifying/sprint/race only when useful for the demo.
- Use `narrativeType`: `qualifying`, `sprint`, `race`.
- Australian broadcaster usually maps to Kayo/Foxtel only if evidenced.

Tour de France:
- Prioritise mountain stages, time trials, opening stage, final stage, and high-profile sprint stages.
- Use `narrativeType`: `mountain`, `time-trial`, `sprint`, `hilly`, `ceremonial`.
- `liveWindow` should usually be 3-5 hours.

Rugby:
- Prioritise Wallabies Tests, Bledisloe, Lions/World Cup-tier fixtures, finals.
- Use `narrativeType`: `test`, `series`, `final`, `rivalry`.

Wimbledon:
- Include Australian contenders, quarterfinals onward, singles finals, and unusually strong doubles stories.
- Set `round`, and where possible add `gender` as `men`, `women`, or `unknown`; `eventType` as `singles` or `doubles`.

Cricket:
- Include Day 1 for Tests, final sessions/deciders where dates are known, ICC knockouts, Boxing Day/New Year Tests.
- `liveWindow` can be 8 hours for Tests.

NRL:
- Include finals, preliminary finals, Grand Final, State of Origin if added later.

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
- Keep all copy spoiler-safe unless the card title says result.
- Run or ask the implementer to run `node scripts/validate-feed.js feeds/incoming/events.json`.
