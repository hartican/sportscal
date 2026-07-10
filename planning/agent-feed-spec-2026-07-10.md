# nothingSport feed and card spec for AGENT

This document is the complete working spec for the AGENT. It replaces shorthand notes and avoids references that require prior chat context. The AGENT should be able to execute work from this document plus the repo itself, without needing other planning documents for interpretation.

## Operating rules for AGENT

- Prefer repo inspection and direct file edits over MCP.
- Limit MCP use unless the user explicitly asks for it.
- Be economical with tokens; keep plans, status notes, and generated copy concise.
- At the end of each implementation pass, always provide bash commands for stage/commit.
- Use `AGENT` as the role label in any handoff text; do not use `MODEL` or `Codex`.
- Preserve existing infra where possible; make additive changes unless the spec explicitly calls for a rename or cleanup.

## Product intent

nothingSport is a spoiler-aware sports watching planner and recommendation product. It is not a scores product. The app should help a user decide what to watch live, what to save for catch-up, and what to ignore, with a bias toward high-stakes events and no-regrets viewing.

Core principles:

- No spoilers by default.
- Compact calendar cards.
- Richer expanded cards where useful.
- Stakes-based ranking and presentation.
- Australian/Sydney-local scheduling.
- Feed-driven content, not hand-edited event cards in `index.html`.

## Current repo state to assume

The repo already has a working JSON feed scaffold, validation script, publish script, helper utilities, schema, incoming template, and a generated `data/events.json` / `data/feed-meta.json` pair. The current feed validates. The app also has inline scripts in `index.html` and a `service-worker.js` that should continue to pass syntax checks after each pass.

## Canonical source and scope assumptions

Use the existing repo feed pipeline as the canonical MVP path.

For the first JSON feed:

- Cover the July block only.
- Do not try to fully cover every sport from the broader one-pager in the first pass.
- After the July-block flow is stable, extend with a scaffold for additional sports, tournaments, and events in later passes.

For future horizon planning:

- The product target remains to preload all sports more than 3 months into the future.
- Marquee annual events should be preloaded 12 months ahead when practical.
- This is a later-phase expansion goal, not a blocker for the first July feed.

## Feed naming and versioning

Current infra still uses mixed version labels such as `daily-feed-...` in template/instructions and `demo-feed-2026-07-10-stage1` in published files.

Instructions:

- Canonical version naming should be used where practical.
- It is acceptable to keep `daily-feed-...` temporarily so current scaffold language does not break.
- Add a clear note in comments/docs to rename this for clarity later because the process is not literally daily.
- Any renaming should be done consistently across template, docs, scripts, and published metadata in a dedicated cleanup pass.
- Do not perform a partial rename that leaves the pipeline internally inconsistent.

## Meaning of `key`

Leave `key` exactly as it is in current infra.

- Do not change `key` semantics in this work.
- Treat it as an existing supported feed/app field tied to current validation and active-sports logic.
- Do not attempt schema or UI refactors based on the earlier idea that `key` should become only a subcategory marker.

## MVP inclusion threshold

For MVP feed generation and staging:

- Ignore events with `expected < 5`.
- Do not keep low-score events merely for completeness in the MVP feed.
- Update instructions, defaults, and stage-generation logic so this threshold is consistently applied.
- Ensure future feed-generation runs do not reintroduce sub-5 events unless the user later asks for full-schedule completeness.

## Time handling

All event card times shown to users must be Australia/Sydney local time.

If an official start time is unknown:

- Use a representative viewing window.
- Flag that clearly in the copy and/or metadata.
- Do not present an invented exact start as if it were confirmed.

If official UTC timestamps exist:

- Preserve them where the schema already supports them.
- Keep the displayed card time in Sydney local format.

## Spoiler policy

The spoiler policy is a hard product rule.

### General rule

- Do not reveal results, winners, advancement, or bracket consequences by default in feed copy intended for standard cards.
- This applies especially to knockout events and especially to football/soccer cards.

### Very recent event rule

If a Must Watch or similarly prominent event is very recent, roughly within 3 days of completion:

- Do not show who advanced to the next round in the visible default card state.
- Do not expose result-forward titles or selected sentences in the visible default state.
- Provide only spoiler-safe generic event context by default.
- The UI should support an opaque card state with a deliberate reveal flow and spoiler confirmation.
- Save / Add to calendar / Watching / Save for catch-up controls must remain usable even while spoiler content stays hidden.

### Feed-copy rule

The feed pipeline must avoid generating spoiler-prone language that creates recurring regressions.

Examples of language to avoid in default copy:

- explicit winners in recent knockout cards
- `X are through`
- `winner moves onto confirmed opponent` when that reveals an already-decided branch too soon
- result-first naming for recent events unless the product explicitly intends a result card and the UI protects it appropriately

### Current known problem

The current `scripts/build-stage1-feed.js` includes FIFA knockout copy that is result-forward and advancement-forward, including wording such as confirmed advancement and explicit bracket consequences. This must be cleaned up in both the generator and the generated `data/events.json`, and the pipeline must be made safer so future runs do not recreate the problem.

## Card UI and content behaviour

The four main tabs are:

- Calendar
- Never Miss
- Weekly Briefing
- Catch-up

Current state is inconsistent. The target behaviour is:

- All tabs should share a global card design language based on stakes.
- Never Miss is the closest current pattern, but it is not final.
- All tabs should converge toward similar behaviour, including 3-stage expansion on tap.
- Calendar cards should stay compact: no hook copy, just sport glyph, abbreviated event name, and stakes-oriented metadata.
- Expanded states can carry more context where useful, but still remain spoiler-aware.
- Never Miss cards must show day and date clearly.

## Brand/UI copy changes

Update app branding toward:

- App title: `nothingSport`
- Slogan: `nothing short. nothing missed.`

Top bar changes:

- Add an `About nothingSport` ghost button next to T&Cs.
- Add an About screen or panel.
- Use the following About copy as the current source text for implementation:

> nothingSport is part of the Nothing Group: products built to filter noise so people can get more out of their regular schedules without extra cognitive burden. Across the group, `nothing` has come to mean nothing short of expectations, nothing missed, and nothing to onboard.
>
> nothingSport applies that ethos to live sport. It is a spoiler-safe sports filter for people who care about watching sport properly, but do not want to sift through every fixture, feed, and low-stakes event to work out what actually deserves their time.
>
> Think of it like having a sports-obsessed friend with unusually good taste: someone who knows your preferences, keeps track of what matters, and quietly keeps your calendar aligned with the games worth sitting down for.
>
> We would rather you miss the occasional surprise than be buried in choices. nothingSport filters hard, using preset sports and event categories, must-watch logic, and spoiler-safe context so that the important fixtures stand out without spoiling the result.
>
> The result is a calmer, more trustworthy way to follow sport: less scrolling, less second-guessing, fewer missed big games, and a better sense that the best of sport will surface when it matters.

Implementation note:

- Preserve this meaning if the UI needs shorter truncation for small surfaces, but keep this as the canonical About copy in the spec until replaced intentionally.

## HITL review for marquee AI copy

Marquee events need machine-readable human-review support.

Requirements:

- Add fields in schema and utilities for machine-readable review status for marquee AI-generated copy.
- The fields should support a workflow where AI copy can be flagged for review, then marked reviewed and optionally edited by a human.
- Keep this additive and simple; do not overdesign a CMS.
- Update docs so a future operator can find and use this workflow quickly.
- Document where this lives in `feeds/incoming/README.md`.

Minimum intent of the new metadata:

- whether review is required
- whether review is complete
- optional reviewer/editor note or source of override

The exact field names may be chosen to fit the existing schema style, but they must be machine-readable and validated.

## Feed content rules for AGENT

When AGENT generates or transforms event feed content, use these rules.

### Required envelope

A feed must remain a JSON object with:

- `schemaVersion`
- `version`
- `publishedAt`
- `sourceNote`
- `events`

### Required event baseline

Each event must preserve the current required baseline already enforced by scripts/schema, including:

- stable `id`
- stable `eventId`
- `sport`
- `key`
- `name`
- `displayTitleCompact`
- `date`
- `time`
- `broadcaster`
- `expected`
- `liveWindow`
- `selectedSentence`
- `fullSpiel`
- `sourceName`
- `sourceUrl`
- `sourceCheckedAt`

### Copy style

- Be concise.
- Be practical.
- Optimise for watch planning, not sports writing flourishes.
- Default to spoiler-safe phrasing.
- For calendar cards, keep copy compact and non-editorial.
- For expanded cards, explain why it matters, viewing commitment, broadcast path, and replay logic without spoiling outcomes.

### Broadcaster/source policy

- Prefer official competition schedules.
- Then official Australian broadcaster schedules.
- Use reputable secondary schedule pages only when official sources do not expose enough structure.
- Do not invent times, venues, teams, or broadcasters.

## Validated commands

The following validation and syntax checks are the currently confirmed baseline and should continue to pass:

```bash
node scripts/validate-feed.js data/events.json
node scripts/validate-feed.js feeds/incoming/events.template.json
node --check scripts/lib/feed-utils.js
node --check scripts/validate-feed.js
node --check scripts/publish-feed.js
node --check scripts/build-stage1-feed.js
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for (const script of scripts) new Function(script); console.log('inline scripts ok:', scripts.length);"
node --check service-worker.js
```

## Daily refresh process

The currently intended refresh flow is:

```bash
cp feeds/incoming/events.template.json feeds/incoming/events.json
# Replace template contents with researched LLM output.
node scripts/validate-feed.js feeds/incoming/events.json
node scripts/publish-feed.js feeds/incoming/events.json
node scripts/validate-feed.js data/events.json
```

Implementation note:

- The README currently describes this as a daily process and as a handoff point for daily refreshes.
- Keep that operational flow working.
- Add wording that the cadence may be less than daily, so the naming is understood as pipeline terminology rather than a literal promise.

## Phased implementation

Work in small passes. Keep each pass internally coherent and easy to review.

### Phase 1: tighten feed rules and docs

Goal:

- make the instructions self-consistent
- encode the MVP threshold
- document AGENT operating rules
- prepare for review-status metadata

Tasks:

- Rewrite the planning/instructions doc so it is self-contained and aligned with this spec.
- Replace ambiguous shorthand and prior-chat references.
- Update language from `MODEL`/`Codex` to `AGENT`.
- Note that MCP use should be limited unless explicitly requested.
- Add stage/commit command guidance to the doc for each pass.
- Update README wording so operators can find validation, publish, HITL review, and future review-status behaviour easily.
- Note that `daily-feed-...` naming is acceptable for now but should later be renamed for clarity.
- Update feed-generation guidance to ignore events below 5/10 for MVP.

Acceptance checks:

- docs are self-contained
- no references like `item 5 accepted as written`
- instructions do not require earlier chat logs to interpret

### Phase 2: schema and utility support for review status

Goal:

- add machine-readable review-status support for marquee AI-generated copy

Tasks:

- Extend `schemas/event-feed.schema.json` with additive fields for review status.
- Extend `scripts/lib/feed-utils.js` and `scripts/validate-feed.js` so the new fields normalize/validate cleanly.
- Keep backwards compatibility with existing events where possible.
- Document the review fields and where to use them in `feeds/incoming/README.md`.

Suggested metadata shape:

- boolean flag that review is required
- boolean flag that review is complete
- optional note/reviewer field

Acceptance checks:

- existing feed still validates after additive changes or can be normalized safely
- new review metadata validates when present
- README clearly says where to find and use this

### Phase 3: spoiler-safe stage builder and staged feed cleanup

Goal:

- remove current spoiler regressions from generated FIFA cards
- prevent recurrence in future stage-builder runs

Tasks:

- Inspect `scripts/build-stage1-feed.js` and remove result-forward and advancement-forward default copy for recent knockout cards.
- Rewrite problematic FIFA titles, selected sentences, and full spiels so they are spoiler-safe by default.
- Update `data/events.json` accordingly.
- Add comments/helpers/guardrails in the stage-builder logic so future runs do not reintroduce these patterns.
- Apply the MVP threshold so sub-5 events are excluded in generated output.

Acceptance checks:

- no recent knockout card leaks advancement by default
- generated copy remains useful without spoiling
- `data/events.json` validates

### Phase 4: UI consistency and spoiler reveal behaviour

Goal:

- move app cards toward one design system and protect spoiler-sensitive events in the interface

Tasks:

- Align Calendar, Never Miss, Weekly Briefing, and Catch-up card structures.
- Keep Calendar compact.
- Add visible day/date to Never Miss cards.
- Implement or scaffold a spoiler-protected opaque state for very recent major events.
- Keep action buttons active even when spoiler details are hidden.
- Add/prepare 3-stage expansion behaviour across tabs.
- Apply branding updates: `nothingSport`, slogan, About button, About content.

Acceptance checks:

- cards feel structurally related across tabs
- spoiler reveal is deliberate
- actions remain accessible on opaque cards
- branding text updates are visible

### Phase 5: future-horizon preload expansion

Goal:

- extend beyond July once the pipeline is stable

Tasks:

- preload all sports more than 3 months ahead where data is practical
- preload marquee events 12 months ahead where annual recurrence is predictable
- ensure next-year marquee cards can appear once current editions finish

Acceptance checks:

- horizon rules are reflected in feed generation and/or source planning
- changes do not break current July-block flow

## Files most likely to change

Primary files:

- `planning/event-card-population-instructions.md`
- `feeds/incoming/README.md`
- `feeds/incoming/events.template.json`
- `schemas/event-feed.schema.json`
- `scripts/lib/feed-utils.js`
- `scripts/validate-feed.js`
- `scripts/publish-feed.js`
- `scripts/build-stage1-feed.js`
- `data/events.json`
- `data/feed-meta.json`

Secondary/UI files may include:

- `index.html`
- `service-worker.js`
- any app-specific JS/CSS files if they exist outside inline blocks

## Pass discipline

For each pass, AGENT should:

1. state the narrow scope
2. make only the files needed for that pass
3. run the relevant validation commands
4. report any unresolved risk briefly
5. finish with bash commands to stage and commit the pass

## Standard validation after a pass

Use the smallest command set that proves the pass. For feed/scaffold passes, this usually means:

```bash
node scripts/validate-feed.js data/events.json
node scripts/validate-feed.js feeds/incoming/events.template.json
node --check scripts/lib/feed-utils.js
node --check scripts/validate-feed.js
node --check scripts/publish-feed.js
node --check scripts/build-stage1-feed.js
node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);for (const script of scripts) new Function(script); console.log('inline scripts ok:', scripts.length);"
node --check service-worker.js
```

## Standard stage/commit pattern

At the end of each pass, AGENT must provide bash commands. Adapt file paths to the actual pass.

```bash
cd "/Users/jackhartican/Documents/AI/Perplexity/Sportscal"
git add <changed-files>
git commit -m "<clear pass-specific message>"
git push origin main
```

## Immediate next pass recommendation

Start with Phase 1 and Phase 2 together only if the review-status schema addition is small and clearly bounded. Otherwise do Phase 1 first, then Phase 2.

Recommended first-pass focus:

- rewrite the planning/instructions doc as self-contained AGENT guidance
- update README with AGENT rules, validation flow, and review-status location note
- add explicit MVP threshold note
- leave UI and stage-builder changes for the following pass unless they are tiny and low-risk
