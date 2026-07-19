# Incoming Feed Workflow

This folder is the handoff point for researched event feed refreshes.

The existing template still uses `daily-feed-...` version names. Treat that as pipeline terminology for now, not a literal daily cadence. Rename it only in a dedicated cleanup pass that updates template, docs, scripts, and published metadata together.

AGENT operating rules:

- Prefer repo inspection and direct file edits over MCP.
- Limit MCP use unless the user explicitly asks for it.
- Keep feed copy concise, practical, and spoiler-safe by default.
- At the end of each implementation pass, provide bash commands for stage/commit.

Refresh process:

1. Give `planning/event-card-population-instructions.md` to a research LLM.
2. Ask it to return one JSON feed.
3. Save that JSON as `feeds/incoming/events.json`.
4. Confirm MVP threshold and spoiler rules:
   - exclude events with `expected < 5`
   - use Australia/Sydney local `date` and `time`
   - avoid default-card result, winner, advancement, or bracket-consequence spoilers
5. Normalise card lifecycle/copy and run the editorial, spoiler and schema QA suite:

```bash
node scripts/update-cards.js
```

This command keeps completed result facts in `score`, `outcomeText` and `recapText`, keeps `selectedSentence` and `fullSpiel` safe for spoiler-OFF fallbacks, derives `storyline.arcStage` from lifecycle, and checks both incoming and published feeds. Do not bypass this step for result updates.

6. Validate the incoming file explicitly:

```bash
node scripts/validate-feed.js feeds/incoming/events.json
```

Validation and publishing reject mixed spoiler modes, including result-bearing default fields or a completed card left at `storyline.arcStage: "preview"`.

7. Publish it into the app:

```bash
node scripts/publish-feed.js feeds/incoming/events.json
```

Publishing is preservation-first. Existing cards remain in `data/events.json`; an incoming card replaces one only when it has the same stable ID, or it is a newer source-backed match for the same sport, participants and event window. Use `--replace` only when you have deliberately prepared a complete replacement feed.

To rebuild the canonical incoming feed with the cards bundled in the app before publishing a research refresh:

```bash
node scripts/restore-bundled-events.js feeds/incoming/events.json
node scripts/publish-feed.js feeds/incoming/events.json
```

8. Run the app-level smoke checks:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for (const script of scripts) new Function(script); console.log('inline scripts ok:', scripts.length);"
node --check service-worker.js
node scripts/validate-feed.js data/events.json
```

8. Review locally with HITL browser testing:

```bash
python3 -m http.server 8002 --bind 127.0.0.1
open http://127.0.0.1:8002/
```

The app's `Refresh feed` button reads `data/feed-meta.json`, follows `eventsPath`, and imports `data/events.json` into local storage.

## Personal calendar import

Use `calendar-events.template.json` as the simple hand-entry/import shape. It accepts the small, portable subset that Google Calendar, Apple Calendar or Outlook exports can provide: a stable calendar ID, title, start/end time, location and optional URL, broadcaster, expected score and explicit category override.

The categoriser is deterministic. `sportKey` wins whenever you provide it. Otherwise `scripts/import-calendar-events.js` tests title, description and location against its ordered rule list. If no rule matches, it fails rather than guessing; add a supported `sportKey` to that record. `eventType` similarly overrides the deterministic type rule. The importer records the matching rule on the output card so every classification is auditable.

1. Copy the template to `feeds/incoming/calendar-events.json` and enter/paste calendar details.
2. Build a merged feed, keeping the current researched cards:

```bash
node scripts/import-calendar-events.js feeds/incoming/calendar-events.json feeds/incoming/events.json feeds/incoming/events.with-calendar.json
```

3. Validate and publish the merged result:

```bash
node scripts/validate-feed.js feeds/incoming/events.with-calendar.json
node scripts/publish-feed.js feeds/incoming/events.with-calendar.json
```

Personal-calendar cards use a `calendar://` provenance URL when an event has no public URL. They stay local to the import file; the importer does not connect to or send data to a calendar service.

## Future Horizon

The July block is the current MVP proving path. After that flow is stable, feed refreshes should extend toward all supported sports more than 3 months ahead, with annual marquee events planned up to 12 months ahead when reliable dates and broadcast assumptions exist.

`node scripts/publish-feed.js <feed>` writes `feedHorizon` into `data/feed-meta.json` with first/last event dates, per-sport coverage, days ahead, and whether the standard 3-month preload window is covered. Use it as a quick operator check before HITL review; it does not replace source verification.

## HITL Review

Marquee AI-generated copy uses machine-readable human-review metadata. Add `copyReview` on events where `selectedSentence` or `fullSpiel` needs a human review gate.

Use this shape:

```json
"copyReview": {
  "reviewRequired": true,
  "reviewComplete": false,
  "note": "Marquee AI-generated selectedSentence and fullSpiel need HITL review before publish."
}
```

When a human has reviewed or edited the copy, update the same object:

```json
"copyReview": {
  "reviewRequired": true,
  "reviewComplete": true,
  "reviewer": "JH",
  "note": "Edited fullSpiel for spoiler-safe wording.",
  "overrideSource": "HITL browser review"
}
```

`node scripts/validate-feed.js <feed>` validates the field and prints pending review counts when review is required. Do not add ad hoc review fields outside `copyReview`.

## Stage and Commit Pattern

Use pass-specific paths, but keep the command shape simple:

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add <changed-files>
git commit -m "<clear pass-specific message>"
```
