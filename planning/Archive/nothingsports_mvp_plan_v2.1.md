# nothingSports MVP Development Plan

## Product framing

nothingSports should launch as a **pain med**, not a vitamin. Its first job is to solve a sharp, repeated user pain: sports schedules are fragmented, important events are easy to miss, and browsing multiple apps creates friction, uncertainty, and spoiler risk.[cite:1]

The phase-one product should therefore be framed as a mobile-first, lightweight browser app that acts as a **Never Miss Engine**: it helps the user know what matters, catch it live when possible, and recover the best misses when life gets in the way.[cite:1]

This plan retains useful breadth from the current MVP thinking, but only where that breadth does not introduce major technical debt, inference cost, or unnecessary integration complexity.[cite:1]

## Founder summary

In plain terms, the MVP should do four things well:

1. Rank what is worth watching.
2. Turn that ranking into a reliable calendar alert loop.
3. Provide a weekly no-regrets briefing so the user can scan the week ahead.
4. Offer catch-up paths for major events that were missed live.[cite:1]

The product should not try to become a full streaming hub, account-linking platform, or deep broadcaster-integration layer in phase one. It should first win on decision quality, timing confidence, and low-friction habit formation.[cite:1]

## Product goal

The initial live deployment should be a browser-based MVP with remote JSON feed updates, mobile-first interaction, and local persistence for user preferences and lightweight state. The core output is not raw schedule data; it is an editorially ranked, spoiler-safe viewing rail that answers: **What should I watch, when should I watch it, and what should I catch up on if I miss it?**[cite:1]

The user-facing promise should be:

- Never miss the events that matter to you.
- Never waste time digging through fragmented schedules.
- Never get forced into spoilers just to work out what is worth watching.[cite:1]

## Core principles

### Pain-med principles

The product should explicitly follow Ravikant-style pain-med logic:

- Solve an acute recurring pain before expanding scope.
- Prefer one strong behaviour loop over many weak features.
- Make the product useful on first session, not after a long setup flow.
- Minimise reliance on expensive integrations until the habit and ranking model are proven.[cite:1]

### UX principles

Non-negotiable rules for phase one:

- One visible hierarchy system only: importance heat.[cite:1]
- The first scan must answer “Is this worth my time?” before “Why is this dramatic?”.[cite:1]
- Narrative logic should mostly stay under the hood until the user asks for more detail.[cite:1]
- Spoiler safety should remain default behaviour across feed, reminders, briefings, and catch-up surfaces.[cite:1]
- Every feature should strengthen the Never Miss Engine, the calendar alert loop, or catch-up confidence.[cite:1]

### Technical principles

- Remote content should be file-driven via versioned JSON over HTTPS.[cite:1]
- Front-end logic should be deterministic where possible, with minimal runtime inference.[cite:1]
- LLM usage, if any, should be optional, bounded, and primarily precomputed upstream rather than generated per session.[cite:1]
- Local persistence should store preferences, dismissals, saved items, alert choices, last refresh metadata, and briefing-read state.[cite:1]
- Architecture should favour simple joins and scoring logic over bespoke backend orchestration.[cite:1]

## MVP scope

### In scope

Phase one should include:

- Ranked live feed with compact, selected, and opened card states.[cite:1]
- Two primary feed rails: Top Storylines This Week and Worth Checking Out.[cite:1]
- Remote JSON refresh.[cite:1]
- Sport preference presets, starting with tennis.[cite:1]
- A calendar alert loop for events the user chooses to track.[cite:1]
- A weekly no-regrets briefing view generated from the same ranked feed model.[cite:1]
- A catch-up rail for major missed or replay-worthy events.[cite:1]
- Human-in-the-loop review gates between each major phase.[cite:1]

### Out of scope

Phase one should exclude:

- Deep broadcaster APIs.[cite:1]
- Full streaming account linking.[cite:1]
- Real-time scores, live stats, and spoiler-rich telemetry.[cite:1]
- Complex social features.[cite:1]
- Heavy personalisation models requiring continuous inference.[cite:1]
- Large editorial CMS complexity unless proven necessary after launch.[cite:1]

## Experience model

### Primary rails

The app should be organised around a small set of clear rails:

- **Top Storylines This Week**: score 8 to 10, high-confidence recommendations.[cite:1]
- **Worth Checking Out**: score 7 to 8 by default, with selected 6s boosted by stated enthusiasm.[cite:1]
- **Catch-up Classics**: completed or in-progress events still worth replay, recap, or highlights.[cite:1]
- **Weekly No-Regrets Briefing**: a weekly overview rail or view that surfaces the best upcoming events the user should lock in now.[cite:1]

The rail model should remain spoiler-safe and ranking-led. This preserves clarity for users and token economy for implementation.[cite:1]

### Card interaction model

The feed should use the existing three-state interaction pattern:

| State | Trigger | Visible content |
|---|---|---|
| Compact | Initial render | Event label, time, participants or stage, contained stakes meter only.[cite:1] |
| Selected | First tap | Compact card plus one short presenter-style sentence only.[cite:1] |
| Opened | Second tap | Full spiel, inclusion explanation, tags, narrative type, broadcaster, venue, reminder controls, and catch-up availability where relevant.[cite:1] |

Implementation rules:

- Remove the default above-the-fold multi-line spiel from compact cards.[cite:1]
- Keep selected-state copy to one line where possible, two lines maximum.[cite:1]
- Open full detail inline to preserve rail context.[cite:1]
- Keep narrative metadata hidden until opened state.[cite:1]

### Visual hierarchy

Visible hierarchy should stay stripped back:

- No visible tier label.[cite:1]
- No visible archetype badges such as rivalry or quest.[cite:1]
- No visible rising-action rails.[cite:1]
- No narrative-colour system separate from importance heat.[cite:1]

Instead:

- Use importance-ranked gradients only.[cite:1]
- Show `stakesScore` out of 5 in a contained bar, meter, or capsule.[cite:1]
- Use warmer treatment for higher-stakes events and quieter tones for lower-stakes events.[cite:1]

## Behaviour loops

### Never Miss Engine

This is the core product loop and should be treated as the main pain-med mechanism:

1. The feed ranks upcoming events.
2. The user identifies one worth watching.
3. The user adds or confirms a reminder.
4. The event enters the calendar alert loop.
5. If missed, the event can still reappear in catch-up or replay surfaces if it remains worth the user’s time.[cite:1]

Success depends on making this loop reliable, lightweight, and habit-forming within the first few sessions.[cite:1]

### Calendar alert loop

The MVP should include reminder and calendar behaviour without becoming a heavy calendaring product.

Human summary:

- Users should be able to mark an event for reminders from the opened card.[cite:1]
- The app should support a lightweight add-to-calendar action and a persistent reminder state.[cite:1]
- Reminder logic should reinforce the “never miss” promise, not overwhelm with notification complexity.[cite:1]

Codex implementation summary:

- Add a reminder control to opened cards with states such as `off`, `calendar_added`, `watching`, and `saved_for_catchup`.[cite:1]
- Generate calendar event payloads from feed event records using deterministic local templates.[cite:1]
- Support `.ics` export and/or webcal subscription path later if already defined elsewhere, but in phase one keep the UI contract simple: Add to calendar, reminder on, reminder saved.[conversation_history:1]
- Persist reminder choices locally keyed by `eventId` and `startTime`.[conversation_history:1]
- Surface reminder status in card chrome without adding extra feed noise.[conversation_history:1]

### Weekly no-regrets briefing

This should be treated as a recurring habit surface, not a separate product.

Human summary:

- Once per week, the user should get a spoiler-safe briefing of the major events ahead that they would regret missing.[conversation_history:1]
- The briefing should help the user pre-commit to reminders and reduce schedule fragmentation anxiety.[conversation_history:1]

Codex implementation summary:

- Build a weekly view from the same ranked event set, filtered to the next 7 days and ordered by recommendation score, then time.[conversation_history:1]
- Group by day with short editorial headings only if already present in feed data or generated upstream.[conversation_history:1]
- Include quick actions for add to calendar, save for catch-up, and dismiss.[conversation_history:1]
- Persist `briefingSeenWeekKey` locally to track whether the user has viewed the current weekly briefing.[conversation_history:1]

### Catch-up Classics

Catch-up should not be treated as a dumping ground. It is the second half of the pain-med promise: even if live viewing fails, the user should still avoid regret.[conversation_history:1]

Human summary:

- Catch-up should highlight only missed events still worth time, not every completed result.[conversation_history:1]
- The experience should remain spoiler-safe and oriented toward replay, recap, or highlights options where available.[cite:1]

Codex implementation summary:

- Use a replay-eligibility flag and availability metadata in event records.[cite:1]
- Compute a replay score from recommendation score and age-decay rules.[cite:1]
- Partition catch-up content by freshness bands, then rank within each band by replay score.[cite:1]
- Support labels such as `Replay worth it`, `Highlights enough`, or `Safe to skip` only if already supplied upstream or rule-derived without extra inference cost.[conversation_history:1]

## Data model

### Minimum remote files

The MVP should use a versioned remote file model with at least:

- `feed-meta.json`[cite:1]
- `events.json`[cite:1]
- `entities.json`[cite:1]
- `relationships.json`[cite:1]

### Recommended file responsibilities

| File | Purpose |
|---|---|
| `feed-meta.json` | Version, publish timestamp, schema version, checksum, active sports, briefing week key.[cite:1] |
| `events.json` | Core event records, times, stages, scores for recommendation logic, spoiler-safe display strings, replay flags, venue, broadcaster, reminder metadata.[cite:1] |
| `entities.json` | Teams, players, competitions, tournaments, leagues, broadcasters, venues.[cite:1] |
| `relationships.json` | Event-to-entity mappings, rivalry or storyline associations, competition ladders, user-relevance tags where precomputed.[cite:1] |

### Event schema guidance

Each event record should aim to include:

- `eventId`
- `sport`
- `competitionId`
- `startTimeUtc`
- `endTimeUtc` if known
- `status` such as `upcoming`, `live`, `completed`
- `displayTitleCompact`
- `displaySubtitle`
- `selectedSentence`
- `fullSpiel`
- `stakesScore` from 1 to 5
- `recommendationScore` from 0 to 10
- `importanceBand`
- `narrativeType` hidden until opened state
- `broadcastOptions`
- `venueId`
- `replayEligible`
- `highlightEligible`
- `replayWindowEnd`
- `briefingEligible`
- `catchupEligible`
- `userReasonTemplateKeys`
- `calendarTemplate`
- `updatedAt`

This schema should stay compact and deterministic. Avoid freeform per-session generation where fixed strings or upstream-prepared text will do.[cite:1]

## Local persistence

The browser app should use local persistence only for lightweight user state.

Recommended local keys:

- `ns_preferences_v1`
- `ns_followed_sports_v1`
- `ns_event_actions_v1`
- `ns_hidden_items_v1`
- `ns_last_feed_version_v1`
- `ns_last_refresh_at_v1`
- `ns_briefing_seen_v1`
- `ns_saved_catchup_v1`

Recommended event action object:

```json
{
  "eventId": "evt_123",
  "reminderState": "calendar_added",
  "savedForCatchup": true,
  "dismissed": false,
  "lastActionAt": "2026-07-09T17:00:00Z"
}
```

If another document already defines local persistence patterns, Codex should follow that existing convention rather than inventing a second state model.[conversation_history:1]

## Ranking and rules

### Recommendation scoring

The recommendation score should remain hidden, composite, and rules-led. It should blend:

- Visible stakes.[cite:1]
- Hidden narrative momentum.[cite:1]
- User enthusiasm boosts.[cite:1]
- Time proximity where relevant to reminders and briefing ordering.[conversation_history:1]

The UI should display confidence and stakes indirectly, not expose raw scoring maths unless required for debugging.[cite:1]

### Enthusiasm settings

Preferences Step 3 should use the existing enthusiasm framing sport by sport:

- Like.[cite:1]
- Froth.[cite:1]
- Let me choose.[cite:1]

For tennis, keep the agreed defaults:

- Like: both tours, singles only, quarterfinals plus.[cite:1]
- Froth: both tours, singles and doubles, all rounds.[cite:1]
- Let me choose: manual control of gender, type, and round.[cite:1]

Equivalent structures should later be extended to cycling, football, cricket, and basketball using the same label system for consistency.[cite:1]

### Inclusion explanations

Opened cards should explain why the user is seeing an item.

Examples:

- Included because you set Tennis to Froth.[cite:1]
- Boosted because this is a semifinal.[cite:1]
- Worth checking out because this stage could reshape general classification.[cite:1]

This is important both for trust and for reducing the sense of opaque algorithmic output.[cite:1]

### Replay decay logic

Catch-up ranking should use the existing replay-score logic:

\[
replayScore = recommendationScore \times decayMultiplier(ageDays, stakesScore)
\]

A practical decay function remains:

\[
decayMultiplier = e^{-ageDays / halfLife}
\]

Suggested half-life table:

| Stakes | Half-life |
|---|---|
| 5/5 | 7 days[cite:1] |
| 4/5 | 5 days[cite:1] |
| 3/5 | 3 days[cite:1] |
| 2/5 | 2 days[cite:1] |
| 1/5 | 1 day[cite:1] |

This behaviour preserves freshness while still rescuing major missed events.[cite:1]

## Delivery phases

### Phase 0 — Normalisation pass

Goal: tighten the current concept into one coherent implementation language before build starts.

Human summary:

- Normalise labels to the existing hierarchy and rail model.[cite:1]
- Keep the strongest concepts from prior discussion: Never Miss Engine, rules, calendar alert loop, flow and rail, weekly no-regrets briefing, Catch-up Classics.[conversation_history:1]
- Remove duplicate naming and ornamental feature ideas that do not strengthen the core pain-med loop.[conversation_history:1]

Codex pass:

- Freeze label set for rails, card states, reminder states, and enthusiasm settings.[conversation_history:1]
- Freeze event schema v1 and local storage key names.[conversation_history:1]
- Freeze score bands used for Top Storylines, Worth Checking Out, and Catch-up Classics.[cite:1]

HITL gate:

- Founder review of naming consistency, rail logic, and scope discipline before UI build begins.[conversation_history:1]

### Phase 1 — Core feed and rail deployment

Goal: ship the live mobile-first browser app with a ranked spoiler-safe feed and remote refresh.

Human summary:

- This is the first deployable product slice.[cite:1]
- It should already feel useful on day one, even before calendar and catch-up are fully fleshed out.[conversation_history:1]

Codex pass:

- Build rail-based home view with Top Storylines This Week and Worth Checking Out.[cite:1]
- Implement compact, selected, and opened card states.[cite:1]
- Remove default spiels from compact cards.[cite:1]
- Add contained stakes meter and heat-ranked backgrounds.[cite:1]
- Add refresh flow that fetches remote feed files, compares `feed-meta.json` version or checksum, and updates local cache only when changed.[cite:1]
- Persist last successful version and timestamp locally.[conversation_history:1]

HITL gate:

- Review 12 sample cards across 4 sports and at least 3 stakes levels on mobile and desktop.[cite:1]
- Approve only if scan speed, brevity, and opened-state depth feel right.[cite:1]

### Phase 2 — Preferences and explanation layer

Goal: make ranking feel personal, legible, and trustworthy without increasing complexity too much.

Human summary:

- Start with tennis preferences because that logic is already most defined.[cite:1]
- The goal is not endless settings; it is meaningful control with low friction.[cite:1]

Codex pass:

- Implement Preferences Step 3 with Like, Froth, and Let me choose for tennis first.[cite:1]
- Add inclusion explanation block to opened cards.[cite:1]
- Re-rank the feed after preference changes using rules, not generative inference.[cite:1]
- Store preferences locally and reapply after refresh.[conversation_history:1]

HITL gate:

- Review one full tennis preference flow.[cite:1]
- Compare a 20-event feed before and after enthusiasm changes.[cite:1]
- Confirm the explanations feel intelligent rather than robotic.[cite:1]

### Phase 3 — Calendar alert loop

Goal: operationalise the Never Miss Engine with lightweight reminder behaviour.

Human summary:

- This is the moment where the product moves from smart feed to dependable utility.[conversation_history:1]
- It directly targets the fragmented-schedule pain.[conversation_history:1]

Codex pass:

- Add reminder actions to opened cards.[conversation_history:1]
- Generate deterministic calendar payloads from event metadata.[conversation_history:1]
- Mark reminder state locally and reflect it in the UI.[conversation_history:1]
- Add lightweight saved/reminded filtering if already cheap to implement.[conversation_history:1]

HITL gate:

- Test reminder flow across at least 10 events with mixed time zones and event types.[conversation_history:1]
- Verify no duplicate reminders appear after feed refresh.[conversation_history:1]
- Confirm the interaction remains spoiler-safe and uncluttered.[conversation_history:1]

### Phase 4 — Weekly no-regrets briefing

Goal: create a recurring pre-commitment ritual that reduces regret before the week starts.

Human summary:

- The weekly briefing should be a planning companion, not a newsletter clone.[conversation_history:1]
- It should help the user lock in the week’s must-watch events in a few minutes.[conversation_history:1]

Codex pass:

- Create a weekly briefing screen or rail sourced from the next 7 days of ranked events.[conversation_history:1]
- Group by day and preserve spoiler-safe copy.[conversation_history:1]
- Add direct actions to remind, save, or dismiss.[conversation_history:1]
- Persist whether the current week’s briefing has been seen.[conversation_history:1]

HITL gate:

- Review one populated week with at least 15 events across multiple sports.[conversation_history:1]
- Check whether the output feels decisive, calm, and low-friction.[conversation_history:1]

### Phase 5 — Catch-up Classics and replay rescue

Goal: close the loop so missed live events do not automatically become regret.

Human summary:

- This phase completes the promise that the app protects time, not just attention.[conversation_history:1]
- It should still remain selective and spoiler-safe.[cite:1]

Codex pass:

- Add Catch-up Classics rail.[conversation_history:1]
- Apply replay score and age-decay logic.[cite:1]
- Use replay and highlights availability metadata where present.[cite:1]
- Auto-remove items that decay below threshold or expire from replay availability.[cite:1]

HITL gate:

- Validate seeded set with a massive final, a medium event from yesterday, a minor event from today, and a preferred mid-importance event from four days ago.[cite:1]
- Adjust decay constants only after human review of output ordering.[cite:1]

## Deployment sequence

For immediate deployment, implementation should proceed in this order:

1. Normalise labels, schema, and local state contracts.
2. Ship the core feed rails and three-state cards.
3. Add remote JSON refresh and local cache versioning.
4. Add tennis preferences and inclusion explanations.
5. Add calendar alert loop actions.
6. Add weekly no-regrets briefing.
7. Add Catch-up Classics with replay decay.[cite:1][conversation_history:1]

This order keeps the build disciplined:

- First fix scanability and clarity.[cite:1]
- Then add trust and relevance.[cite:1]
- Then operationalise the never-miss behaviour loop.[conversation_history:1]
- Then add regret-reduction layers for planning and catch-up.[conversation_history:1]

## Codex implementation notes

### Build posture

Codex should treat this as a lightweight front-end application with deterministic client-side rules and remote JSON refresh, not a backend-heavy platform.[cite:1]

### Token economy rules

To reduce implementation overhead and inference cost:

- Prefer fixed schema fields over freeform content generation.[cite:1]
- Prefer upstream-prepared short copy and spiel strings over runtime LLM generation.[cite:1]
- Prefer rules-based ranking adjustments over natural-language reasoning in the client.[cite:1]
- Reuse the same event record across feed, briefing, reminder, and catch-up surfaces.[conversation_history:1]
- Avoid introducing separate parallel objects for calendar, replay, and briefing unless necessary.[conversation_history:1]

### UI contract rules

- One card system, many rails.[cite:1]
- One scoring model, many outputs.[conversation_history:1]
- One preference model, extended sport by sport.[cite:1]
- One reminder model, reused across feed and briefing.[conversation_history:1]
- One spoiler-safe copy contract across all surfaces.[conversation_history:1]

## Success criteria

The MVP should be considered successful if it proves all of the following:

- Users can quickly identify which events matter.[cite:1]
- Users can set reminders without leaving the product confused.[conversation_history:1]
- The weekly briefing makes upcoming viewing feel manageable rather than fragmented.[conversation_history:1]
- Catch-up surfaces rescue genuinely important misses without turning into clutter.[cite:1][conversation_history:1]
- The architecture remains lightweight enough to update by remote files and simple client logic.[cite:1]

## Exit criteria for phase one

Phase one is complete when:

- The live mobile-first browser app is deployed.[conversation_history:1]
- Remote feed refresh works reliably.[cite:1]
- Feed rails and three-state cards feel stable.[cite:1]
- Tennis enthusiasm settings work end to end.[cite:1]
- Reminder actions are usable and persistent.[conversation_history:1]
- Weekly no-regrets briefing is live.[conversation_history:1]
- Catch-up Classics is live with basic replay decay.[conversation_history:1][cite:1]
- HITL review has signed off each phase pass.[cite:1][conversation_history:1]

## Final direction

The right phase-one deployment is not “all sports infrastructure in one”. It is a clear, spoiler-safe, mobile-first Never Miss Engine that solves schedule fragmentation first, then layers in reminders, weekly planning, and selective catch-up without losing simplicity.[cite:1][conversation_history:1]

That keeps the product aligned with the strongest pain-med logic: remove a repeated frustration sharply enough that the user trusts the app to become their default sports decision layer.[conversation_history:1]
