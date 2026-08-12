# nothingSports trust-first MVP plan

## Summary

Use the [Product Chief brief](/Users/jackhartican/Documents/AI/Perplexity/Sportscal/planning-sportscal/nothingsport-product-chief-spec.md:1) as the product authority and deliver one independently releasable phase at a time:

1. Stabilise the existing in-flight work.
2. Build complete NRL/AFL sport hubs.
3. Bridge the curated feed to those hubs.
4. Instrument the signed-in pilot.
5. Add swipe learning and calibration.
6. Add fine-tuning and five-star ratings.
7. Operate ongoing measurement and release-readiness checks.

Current evidence:

- The published feed has 304 cards and canonical data has 218 AFL and 204 NRL fixtures.
- Current/next-round coverage is complete: 18 AFL and 16 NRL fixtures, with zero overdue supported results.
- All 184 due published cards have source-backed results.
- Sport hubs, summary cards, learning, Tune, five-star ratings, account persistence and cross-device merging have focused validation.
- Signed-in product measurement is append-only, fixed-choice, opt-out and independently usable without a fixed-duration trial.
- Desktop and 390×844 layouts have no horizontal overflow or console warnings in local shell 79 browser checks.

## Phased implementation

### Phase 0 — Green, safe baseline

- Preserve the current taxonomy, enrichment and generated-feed work; do not restore, stash or overwrite it.
- Fix the event-domain/preference regression affecting Commonwealth Games and focused NRL/AFL coverage.
- Add a local-only option to the canonical `scripts/update-cards.js` flow so refreshes can be tested without committing, pushing or deploying. Keep it as the sole cards, fixtures and standings refresh path.
- Remove release behaviour that suppresses Vercel auto-updates.
- Refresh canonical data and resolve every currently due result through the canonical flow.
- Expose the actual feed generation time in the UI; do not imply that an on-entry browser refresh contacts upstream sporting sources.
- Stop when the complete validator suite is green, result completeness is zero, and focused NRL/AFL views contain every eligible published fixture.

Release boundary: one baseline commit containing only the reviewed in-flight expansion and its stabilisation. Leave unrelated planning/archive files untouched.

### Phase 1 — NRL/AFL sport hubs

- Keep `Feed` and global `Standings` as the primary navigation.
- Selecting Rugby League or AFL from the pinned filter replaces the feed list with an in-place sport hub. Selecting `All sports` returns to the curated feed and restores its scroll position.
- Give each hub these internal tabs:
  - `Worth Watching`
  - `All Fixtures`
  - `Standings`
  - `Results/Replays`
- Direct sport-filter entry defaults to `All Fixtures`. The contextual selection is not persisted as a global Froth change.
- `All Fixtures` initially displays the current and next rounds together. Provide previous/next controls and a round picker covering the supported season.
- Determine the current round as the earliest round containing an unfinished fixture; if the season has no unfinished fixtures, use the latest completed round.
- Build fixture rows from canonical event truth, merging existing card enrichment at render time. Do not create a second persisted fixture collection.
- Respect explicit mutes, but display how many fixtures are hidden and provide a temporary `Show hidden` control.
- Reuse the existing standings renderer, scoped to the selected sport.
- Keep Results spoiler-safe when Results are off. Show scores only when enabled; show replay providers without inventing replay URLs.

Release boundary: hubs work independently before adding anything new to the home feed.

### Phase 2 — Curated-to-complete trust bridge

- Add derived `NRL this round` and `AFL this round` summary cards to the all-sports list feed for followed supported sports.
- Generate summary cards at render time; they are not canonical events and cannot be archived, swiped or rated.
- Show:
  - number of current-round fixtures meeting the existing curated-feed rules;
  - remaining visible fixtures;
  - an additional hidden-by-user count when applicable.
- Use `Next round` wording during an off-week or before a season starts.
- Tapping a summary card opens the matching sport hub at `All Fixtures`, focused on that round plus the following round.
- Do not add summary cards to Month View or focused sport hubs.

Release boundary: a user can move from calm curation to complete NRL/AFL coverage in one tap.

### Phase 3 — First-party pilot measurement

- Add an authenticated, append-only `product_events` table and a batch `POST /api/product-events` endpoint.
- The request contract is `product-events.v1` with at most 20 events per request:
  - `clientEventId`
  - `eventName`
  - `occurredAt`
  - `sessionId`
  - `surface`
  - optional sport, competition and canonical-event IDs
  - a small allowlisted properties object
- The server derives `user_id`; clients cannot supply or override it. Deduplicate on user plus client event ID.
- Permit only fixed events such as `opportunity_exposed`, `fixture_check`, `watch_decision`, `swipe`, `rating`, `tune_prompt` and `tune_session`. Store no free text, social content, precise location or contact information.
- Enable and force RLS, grant authenticated insert only, and require `auth.uid() = user_id` in the insert policy. This follows Supabase’s current guidance for exposed tables and authenticated insert policies. [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- The normal app remains usable without telemetry. Signed-in measurement participation starts automatically with a clear disclosure and opt-out; signed-out and opted-out use sends nothing.
- Define TSDR operationally:
  - denominator: distinct pilot users/weeks with `opportunity_exposed`;
  - numerator: those users with at least one `fixture_check` or `watch_decision`.
- Add fixed-choice weekly pulse questions for cross-checking, missed fixtures and feed clutter; do not collect free-text answers.

Release boundary: verify event insertion, RLS isolation and the weekly TSDR query before introducing learning interactions.

### Phase 4 — Swipe calibration and immediate learning

- Offer an optional final onboarding step after Sports and Viewing.
- Show up to ten recognisable sport, event or player anchors, selected from supported canonical entities and marquee-event configuration.
- Support right/left gestures plus visible `More like this`, `Less like this` and `Skip` buttons, with keyboard access.
- Extend the preference graph to `preference-graph.v4` with a bounded learning section containing:
  - target type and ID;
  - positive or negative value;
  - calibration/feed source;
  - timestamp;
  - dislike and tuning-prompt counters.
- Positive and negative signals adjust curated ranking immediately but never alter canonical truth or remove fixtures from `All Fixtures`.
- A left swipe on a curated event dismisses it for the current session only. Summary cards and complete fixture rows are not swipeable.
- Persist signals locally immediately and queue existing server-state synchronisation.
- Use deterministic Tune prompt cadence at dislike counts 1, 4, 10, 25 and 50, then every 50. Never show it on the second dislike.

Release boundary: calibration is skippable, partial progress remains useful, and ranking changes survive reload/sign-in.

### Phase 5 — Fine-tuning and five-star payoff

- Add a persistent `Tune` entry in Settings/top-bar navigation.
- Build autosaving card arrays progressing through:
  - broad sports and marquee events;
  - competitions and teams;
  - players and specific event families.
- Each interaction updates the preference graph immediately; leaving midway loses nothing.
- Define meaningful tuning as either:
  - eight interactions across at least two domains; or
  - two completed tuning sessions.
- After meaningful tuning, suppress automatic prompts until another 100 qualifying dislikes and at least 30 days have passed.
- Replace the current 1–10 rating control with five one-tap stars while preserving stored compatibility: one star maps to 2/10, through five stars mapping to 10/10. Existing odd scores remain readable as half-star display values.
- Treat swipes as expected-interest signals and ratings as actual-spectacle signals.
- Show an eligible post-event rating prompt at most once per session. Auto-hide an unrated prompt after three later sessions.
- Never stack a Tune prompt and rating prompt in the same interaction.

Release boundary: fine-tuning, swipe learning and ratings remain distinguishable, persisted and fatigue-controlled.

### Phase 6 — Ongoing measurement and operational readiness

- Operate the existing canonical update pipeline at least twice daily during active NRL/AFL rounds and after major match windows.
- Require 100% supported current/next-round fixture coverage and zero overdue results before each pilot release.
- Produce an on-demand report covering weekly TSDR, full-fixture adoption, cross-checking, missed fixtures, feed density, prompt burden and trust confidence by curator, hybrid and completist cohort.
- Group pulse reporting by explicit survey version. A new pulse release is created only by changing `WEEKLY_PULSE_SURVEY_VERSION`; it is never inferred from a calendar week.
- Treat sample sizes as descriptive. They do not block MVP completion or automatically recommend social investment.
- Keep `watch_decision` available for a future genuine Watch or Remind action. Passive card opens and swipes are not watch decisions; fixture checks are the currently implemented TSDR action.

## Verification and release rules

For every phase:

- Add focused unit/verifier coverage for its new state transitions and schemas.
- Run the complete NS validator suite, canonical/feed coverage checks, result completeness and `git diff --check`.
- Browser-test desktop and 390×844 mobile layouts, persistence/reload, direct-file fallback, hosted/API behaviour, accessibility controls, horizontal overflow and console health.
- Bump and verify the service-worker shell version for visible app changes.
- Stop at the phase boundary and report changed files, deferred scope and local proof separately from GitHub/Vercel proof.
- Stage only explicitly intended files while the checkout remains dirty. Never stage the entire worktree.
- Do not claim a push or production release without successful push, deployment and live-browser evidence.

## Assumptions and explicit deferrals

- Completed cards stay active for seven days, remain automatically recoverable from day 7 through day 14, then disappear unless explicitly preserved.
- A manual Archive or Save action preserves a card indefinitely until the user chooses Reinstate/remove. Existing explicit Archive records migrate without data loss.
- NRL and AFL are the only complete-coverage sports in this MVP.
- `All Fixtures` defaults to current plus next round, while season-wide navigation remains available.
- The first MVP includes trust and learning, not social.
- Public rooms, private chat, encryption, moderation, invitations and social telemetry are deferred until after the pilot.
- AI-first significance scoring, automated narrative enrichment and broader all-sport completeness remain V2 work.
- No fixed-duration live user trial is part of MVP completion.
- The current long future-card horizon remains accepted temporarily. A later lifecycle phase should limit routine events to roughly two or three weeks while preserving longer lead times for marquee events involving tickets, travel or accommodation.
- Booking integrations and event-anchored social features remain future work.
- Global Standings, spoiler behaviour, Calendar Sync, existing preference architecture and the curated all-sports feed remain intact unless a phase explicitly changes them.
