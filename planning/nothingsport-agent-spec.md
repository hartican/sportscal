# NothingSport AGENT Spec

## Product intent
NothingSport should remain a spoiler-safe sports planner and event tracker, with a selective editorial layer that helps users decide what matters without turning the product into a recap feed.[file:1] The experience should preserve chronological usability, restrained card treatment for ordinary events, and stronger emphasis only where significance clearly warrants it.[file:1]

## Primary navigation
Use four primary tabs only:
- Calendar
- Never Miss
- Watch Later
- Archived

Archived may be icon-only in the tab bar.[conversation_history:1]

## Core principles
- Keep the product spoiler-safe by default.[file:1]
- Keep the canonical event timeline chronological in Calendar and for past events generally.[file:1][conversation_history:1]
- Use selective highlighting rather than broad visual inflation, so routine fixtures do not compete with defining events.[file:1]
- Keep derived significance, user state, spoiler state, and event facts separate in the model.[file:1]
- Do not surface any event with stakes below 3/5 in any feed.[conversation_history:1]

## Event model
Maintain separate state domains.

### 1. System event state
- Coming Up = event has not yet run.
- PAST = event has already run.[conversation_history:1]

### 2. User action state
For Coming Up events, available actions are:
- Add to Must Watch
- Archive[conversation_history:1]

For PAST events, available actions are:
- Watch Later
- Rate
- Archive[conversation_history:1]

Notes:
- Rate replaces Seen.[conversation_history:1]
- Archive replaces Dismiss / Remove.[conversation_history:1]
- Archive implies the user has effectively accepted spoilers for that event.[conversation_history:1]

### 3. Visibility bucket
- Calendar = all eligible non-archived events over a broader time horizon.[conversation_history:1]
- Never Miss = curated upcoming recommendation surface.[conversation_history:1]
- Watch Later = user-saved queue for future or past events they plan to watch later.[conversation_history:1]
- Archived = removed-from-feed storage area.[conversation_history:1]

### 4. Spoiler state
Support:
- Global spoiler toggle in Settings.
- Per-event spoiler override.[conversation_history:1]

This must work both ways:
- If global spoilers are off, a user can reveal spoilers for a specific event.[conversation_history:1]
- If global spoilers are on, a user can hide spoilers for a specific event.[conversation_history:1]

## Card-level rules
At card level 0, display a compact status tag:
- Coming Up for future events.
- PAST for completed events.[conversation_history:1]

Remove these expanded-card text boxes entirely:
- Why this is here
- Calendar
- Replay[conversation_history:1]

Expanded cards should feel lighter and less over-explained, relying on ranking, metadata, and concise card copy rather than verbose utility blocks.[file:1][conversation_history:1]

## Local game tagging
Add a LOCAL GAME tag for events at venues the user marks as local in Settings.[conversation_history:1]

Requirements:
- Allow multiple local venue selections.[conversation_history:1]
- Seed defaults with GIO Stadium and Manuka Oval.[conversation_history:1]
- Offer additional frequently shown venues as optional additions.[conversation_history:1]
- When an event is marked LOCAL GAME, place a Tickets link with a ticket emoji next to the date on card level 0.[conversation_history:1]
- The Tickets link should point to the preferred ticketing webpage for that event.[conversation_history:1]

## Spoiler policy
Spoilers include:
- Scores
- Outcomes
- Recap copy
- Thumbnails
- Ratings
- Labels[conversation_history:1]

Behavior rules:
- Rating a PAST event reveals spoilers for that event.[conversation_history:1]
- Archiving a PAST event also reveals spoilers for that event, because Archive implies the user has seen it or no longer cares about protecting that result.[conversation_history:1]
- Rating or Archiving an event may reveal next-round matchup implications in sudden-death knockout structures affected by that event.[conversation_history:1]
- In those revealed next-round matchups, only display the rated / archived side of the matchup and keep the opponent hidden until that later match is also rated, removed, or otherwise legitimately revealed by the user’s spoiler settings.[conversation_history:1]

## Feed thresholds
Use deterministic stakes thresholds.

### Global minimum threshold
- Stakes below 3/5 must not appear anywhere in any feed.[conversation_history:1]

### Worth Checking Out threshold
- Stakes of 3/5 qualify for Worth Checking Out.[conversation_history:1]

### Top Storylines threshold
- Stakes of 4/5 or above are promoted to Top Storylines.[conversation_history:1]

## Tab behavior

### Calendar
Calendar is the broad all-events view.

Rules:
- Show eligible non-archived events chronologically over a longer time horizon.[conversation_history:1]
- Do not split Calendar into Top Storylines This Week versus Worth Checking Out.[conversation_history:1]
- Calendar is the clean planning surface where users can view everything in one place.[conversation_history:1]

### Never Miss
Never Miss is the curated recommendation tab.

Rules:
- Main recommendation horizon is the next 7 days only.[conversation_history:1]
- Keep events chronological within each section.[conversation_history:1]
- Use these sections in order:
  - Top Storylines This Week
  - Worth Checking Out
  - Around the Corner[conversation_history:1]

Section logic:
- Top Storylines This Week contains events in the next 7 days with stakes 4/5 or above.[conversation_history:1]
- Worth Checking Out contains events in the next 7 days with stakes exactly 3/5.[conversation_history:1]
- Around the Corner contains events with stakes 4/5 or above that fall outside the 7-day window but within 30 days.[conversation_history:1]

Weekly Briefing should not exist. Its role is absorbed into Never Miss.[conversation_history:1]

### Watch Later
Watch Later replaces Catch Up.

Rules:
- Use Watch Later as the saved queue for events the user wants to watch later, whether future or past.[conversation_history:1]
- A user can manually add eligible PAST events to Watch Later.[conversation_history:1]
- Completed events perceived above 8/10 should be suggested for Watch Later.[conversation_history:1]

### Archived
Archived is the only place archived events should live.

Rules:
- Any archived event must be removed from Calendar, Never Miss, and Watch Later.[conversation_history:1]
- To reverse Archive, the user must visit Archived and reinstate the event to Calendar.[conversation_history:1]

## Past events
Past events must remain chronological.

Rules:
- Do not reorder past events based on revised quality, catch-up value, or retrospective interest.[conversation_history:1]
- Visually dull past-event cards down relative to upcoming cards.[conversation_history:1]
- If a PAST event is especially worth revisiting, allow a restrained secondary highlight while preserving chronological placement.[conversation_history:1][file:1]

## Existing card rewrites
Rewrite cards for existing events when updated information becomes available, especially FIFA World Cup matchups and card spiels.[conversation_history:1][file:2]

Rules:
- Rewrites must stay spoiler-safe by default.[file:1][conversation_history:1]
- Use updated fixture and context information where it can be shown without unnecessary spoiler leakage.[conversation_history:1][file:2]
- Do not turn rewritten cards into recap cards by default.[conversation_history:1][file:1]
- For completed events, recalculate significance using pre-event stakes plus post-event perceived quality.[conversation_history:1]

## Retrospective quality and rating logic
For completed events, support a retrospective quality layer.

Rules:
- Factor post-event perceived quality into the event’s significance assessment.[conversation_history:1]
- If a completed event is perceived above 8/10, suggest it for Watch Later.[conversation_history:1]
- This retrospective layer may influence badges, prompts, and recommendation modules, but it must not change the chronological ordering of past events.[conversation_history:1]

## Action logic by event state

### Coming Up event actions
Available actions:
- Add to Must Watch
- Archive[conversation_history:1]

Behavior:
- Archive removes the event from all active feeds and moves it to Archived.[conversation_history:1]
- Add to Must Watch should increase its prominence where relevant, without breaking chronological order in Calendar.[conversation_history:1]

### PAST event actions
Available actions:
- Watch Later
- Rate
- Archive[conversation_history:1]

Behavior:
- Watch Later adds the event to the Watch Later tab.[conversation_history:1]
- Rate reveals spoilers for that event and can support retrospective scoring / rating UI.[conversation_history:1]
- Archive removes the event from all active feeds and moves it to Archived.[conversation_history:1]

## Calendar export
Never Miss should be exportable to calendar files / calendar workflows.

Requirements:
- Provide checkboxes to include or exclude:
  - Top Storylines This Week
  - Worth Checking Out
  - Around the Corner[conversation_history:1]
- Export should include only the sections selected by the user.[conversation_history:1]

Future pipeline only:
- Never Miss and Around the Corner may later become push and email surfaces, but do not build that now.[conversation_history:1]

## Feedback form
Repurpose Suggest Additions into a feedback form that opens the SMS composer.[conversation_history:1]

Requirements:
- Open the device SMS composer with recipient prefilled as 0437041326.[conversation_history:1]
- Prefill the message body.[conversation_history:1]
- Use fixed AEST / AEDT date-time formatting in the message.[conversation_history:1]
- Include standard categories such as:
  - Add a sport
  - Add a competition
  - Bug report
  - General feedback
  - Feature request[conversation_history:1]

Message structure:
- Meta header
- Timestamp
- Selected category
- User message
- Footer indicating the message was sent from NothingSport[conversation_history:1]

## Pipeline note
Do not build this now, but preserve as a future improvement:
- If a user archives an event without rating it, log that action locally in an Archived file.[conversation_history:1]
- That local file should later be uploadable and reviewable to improve personalization and recommendation quality.[conversation_history:1]

## Implementation notes
- Preserve strict separation between canonical event facts, derived significance metadata, user state, spoiler preferences, and rendering state.[file:1]
- Use rule-based enrichment first, rather than over-automating narrative interpretation.[file:1]
- Keep ordinary schedule surfaces functional and restrained, with stronger emphasis reserved for high-value events only.[file:1]

## Acceptance checklist
- Four-tab structure exists: Calendar, Never Miss, Watch Later, Archived.[conversation_history:1]
- Weekly Briefing is removed.[conversation_history:1]
- Status tags show Coming Up or PAST at card level 0.[conversation_history:1]
- Coming Up cards show only Add to Must Watch and Archive actions.[conversation_history:1]
- PAST cards show only Watch Later, Rate, and Archive actions.[conversation_history:1]
- Archived events disappear from all tabs except Archived.[conversation_history:1]
- Reinstating from Archived returns the event to Calendar.[conversation_history:1]
- Global and per-event spoiler controls both work, in both directions.[conversation_history:1]
- Spoiler categories include scores, outcomes, recap copy, thumbnails, ratings, and labels.[conversation_history:1]
- Local venue settings support multiple stadiums and seed GIO Stadium plus Manuka Oval.[conversation_history:1]
- LOCAL GAME tag and Tickets link appear correctly on card level 0.[conversation_history:1]
- Never Miss sections obey thresholds exactly: Top Storylines = 4/5+, Worth Checking Out = 3/5, Around the Corner = 4/5+ within 30 days but outside 7 days.[conversation_history:1]
- Events below 3/5 do not appear in any feed.[conversation_history:1]
- Past events remain chronological and visually subdued.[conversation_history:1]
- Existing card rewrites update key events, especially FIFA World Cup matchups, without default spoiler leakage.[conversation_history:1][file:2]
- Completed events above 8/10 are suggested for Watch Later without reordering past feeds.[conversation_history:1]
- Feedback form opens a prefilled SMS composer using fixed AEST / AEDT formatting.[conversation_history:1]
