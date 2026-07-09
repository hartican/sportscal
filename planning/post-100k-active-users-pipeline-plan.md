# Post-100k-active-users Pipeline Plan

## Purpose
This document captures the split between the long-term nothingSports vision and the stripped-back MVP direction. The post-100k-active-users product can evolve toward a deeper recommendation and scheduling layer, while the MVP should remain a standalone, spoiler-safe sports planning product that does not depend on streaming-service integrations to function.

## Post-100k-active-users direction
Once the product has meaningful user scale, nothingSports can expand from a smart sports guide into a richer recommendation and scheduling layer. The longer-term concept is a personalised sports recommendation layer with a newsroom brain and a calendar spine: spoiler-safe, narrative-led, preference-aware, and capable of helping users decide what to watch, why it matters, when to watch, and where to find it.

### Product shape after scale
- Connect user streaming services and use them as input signals, not as the core product dependency.
- Connect to the user calendar for AI-assisted viewing organisation.
- Suggest full match, mini-match, or highlights options depending on schedule pressure and personal preferences.
- Ask for confirmation before locking anything into the user schedule.
- Prefer delayed or catch-up viewing when the user opts in, so matches may fit into tighter time windows and users can skip through breaks where the underlying service allows it.
- Keep the experience spoiler-safe and focused on high-quality viewing rather than endless browsing.
- Continue filtering out low-value clutter such as irrelevant early rounds, unfollowed teams, filler studio programming, and shoulder-content noise.

### Editorial and narrative layer after scale
- Reuse Storyline/Narrative Cards as a selective narrative enrichment layer rather than as the whole product.
- Use AI to generate broad event-level narrative framing, hooks, and archetype suggestions.
- Keep a human journalist/copywriter in the loop for marquee cards and major events.
- Human review should do two jobs: sanity-check that the AI framing is accurate and useful, and add a short expandable background explainer on why the event matters.
- Only surface premium written narrative context when it is relevant to that user’s stated interests, followed sports, favourite athletes, or preferred storyline types.
- Keep a hard boundary between factual event data and editorial interpretation.

## MVP direction
The MVP should not try to become the seamless central media hub. That is too integration-heavy, rights-dependent, and partnership-dependent for an early-stage standalone product.

Instead, the MVP should behave more like a smart TV guide for serious sports viewers:
- standalone and useful without streaming-service account integrations;
- preference-aware and spoiler-safe;
- focused on planning and deciding, not playback;
- able to tell the user what not to miss, a little about the event, and why it matters.

### MVP positioning
A smart, spoiler-safe sports viewing guide that knows your preferences and helps you plan what to watch. It highlights the events that matter, explains the narrative behind them, and points you toward how to watch — without trying to own the player or the broadcast itself.

### MVP should include
- Personal preference setup: favourite sports, teams, athletes, competition stages, broadcaster access if the user wants to set it.
- Spoiler-safe event feed and schedule.
- Filtering that removes noise such as seed rounds, unfollowed teams, analysis shows, and low-priority events.
- Must-watch logic based on expected spectacle and relevance.
- Narrative preview cards for selected events, using the Storyline/Narrative Cards approach as a differentiator.
- Brief event context: what it is, why it matters, and why this user may care.
- Generic “how to watch” guidance or outbound links where appropriate.
- Calendar-style planning UI inside the product, without AI-organised scheduling.
- Broadcaster-aware metadata where known, but not hard dependency on platform integrations.

### MVP should not include
- A built-in or unified media player.
- Seamless playback across services.
- Deep streaming-account integrations as a requirement for the core experience.
- Reliance on large broadcast-rights or distribution deals.
- AI-powered calendar automation that reads the user’s schedule and proposes viewing windows.
- Automatic scheduling into a user calendar.
- Overly ambitious “all sport, all services, all workflows” scope.

## Strategic split
### What the MVP proves
- Users want a spoiler-safe, preference-aware sports planning product.
- Narrative framing increases interest and helps users decide what to watch.
- A “smart guide” can create value before any heavy media integration exists.
- Users will return for trust, curation, and planning even if playback happens elsewhere.

### What comes later
After product-market fit and scale, the business can add:
- streaming-service linking;
- smarter watch-mode recommendations such as full/mini/highlights;
- delayed-viewing optimisation;
- opt-in calendar intelligence;
- deeper editorial workflow with AI + human review;
- richer personalised scheduling and recommendation systems.

## Product principle
Early on, nothingSports should win by being the best guide, not by trying to become the broadcaster. The product should help users decide, plan, and care before it tries to control playback.
