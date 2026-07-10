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
5. Validate it:

```bash
node scripts/validate-feed.js feeds/incoming/events.json
```

6. Publish it into the app:

```bash
node scripts/publish-feed.js feeds/incoming/events.json
```

7. Run the app-level smoke checks:

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
