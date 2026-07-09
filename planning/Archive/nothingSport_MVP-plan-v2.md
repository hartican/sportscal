# nothingSports MVP Development Plan

## Product Goal

nothingSports should launch as a standalone, spoiler-safe sports guidance product that helps users decide what to watch, what to ignore, and what to catch on replay, without relying on deep broadcaster integration or heavy calendar automation on day one. This matches the existing strategy: win first as the smartest guide, not as the streaming hub.[1]

The front-end interaction model should now be based on a three-state card flow:

- **Compact state**: default card view, with no above-the-fold spiel block.
- **Selected state**: first tap reveals one short presenter-style sentence only.
- **Opened state**: second tap reveals the full spiel, inclusion metrics, tags, narrative type, and supporting detail.[1]

## Core Principles

The product should feel like a knowledgeable sports presenter who knows the user personally, but also like a calm assistant protecting the user’s time and attention. This fits the broader nothingSports direction of breaking the slot-machine loop by surfacing only high-value viewing, tailored to user tastes and context.[1]

Non-negotiable UX rules:

- Use **one visible hierarchy system only**: importance heat.
- Keep narrative logic under the hood until the user explicitly asks for more.
- Ensure the first scan answers: **“Is this worth my time?”** before **“Why is this dramatic?”**[1]

## Phase 1 — Core Feed and Card Refactor

### Feed Structure

Ship two ranked sections:

- **Top Storylines This Week**: events with recommendation scores of 8–10.
- **Worth Checking Out**: events with scores of 7–8 by default, plus selected 6s if the user’s enthusiasm setting for that sport is high enough.[1]

Sort both sections in descending order by recommendation score, with the highest-importance event positioned top left. Recommendation score should remain a hidden composite built from visible stakes, hidden narrative momentum, and user-preference boosts, so the interface stays simple while the engine stays smart.[1]

### Card Interaction Model

Replace the current card behaviour with a strict three-state interaction pattern.

| State | Trigger | Visible content |
|---|---|---|
| Compact | Initial render | Event label, time, participants or stage, contained stakes meter only. [1] |
| Selected | First tap | Compact card plus one short sentence only. [1] |
| Opened | Second tap | Full spiel, inclusion metrics, user-match reasons, tags, narrative type, broadcaster, venue, and support details. [1] |

Implementation rules:

- Remove the above-the-fold multi-line spiel from the default card state.
- Keep the selected-state sentence to one line where possible, two lines maximum.
- Open the full card inline rather than navigating away, so the user keeps feed context.[1]

### Card Visual System

Keep the visible hierarchy unified and stripped back:

- No Tier label.
- No visible Quest, Rivalry, or other archetype badge.
- No visible rising action / climax rail.
- No narrative-based background colour system.[1]

Instead:

- Use importance-ranked card gradients only.
- Show `stakesScore` out of 5 in a visually contained bar or capsule.
- Use warmer gradients for higher stakes and quieter tones for lower stakes.
- Keep narrative type hidden until the opened state.[1]

### Copy System

Selected-state copy should behave like a compact presenter sting rather than a paragraph. Opened-state copy should provide richer editorial context and explain why the event appears in the user’s feed.[1]

Examples of the intended short-sentence style:

- “Arthur Fery keeps the dream run alive.”[2][3]
- “Rafa v Fed Express – the rivalry continues.”[4][5]

Arthur Fery’s Wimbledon run has been described in current coverage as a fairytale surge into the latter rounds, which is the right model for selected-state shorthand.  Federer–Nadal remains one of the defining rivalries in tennis history, with Nadal leading the head-to-head 24–16, making it a useful reference model for hidden narrative metadata and occasional shorthand copy.[3][5][2][4]

### HITL Gate

Before Phase 1 is locked, run Human In The Loop review on:

- 12 sample cards across 4 sports.
- At least 3 stakes levels.
- Compact, selected, and opened states on desktop and mobile.

Approve only after checking:

- Default scan speed.
- Sentence brevity.
- Whether the opened-state detail feels earned rather than dumped.[1]

## Phase 2 — Preferences, Inclusion Logic, and Refresh Feed

### Preferences Overhaul

In Preferences Step 3, apply the new **Set your enthusiasm** model sport by sport:

- **Like**
- **Froth**
- **Let me choose**[1]

For tennis, keep the agreed defaults:

- **Like** → Both, Singles only, Quarterfinals+
- **Froth** → Both, Both, All
- **Let me choose** → manual control of Gender, Type, and Round.[1]

Apply equivalent sport-specific structures elsewhere:

- **Cycling** → Race, stage type, general classification relevance.
- **Football** → Competition, team, stage.
- **Cricket** → Format, team, match phase.
- **Basketball** → League, team, stage.[1]

### Inclusion Explanation

Opened cards should include a clear explanation of why they are being shown to the user, for example:

- “Included because you set Tennis to Froth.”
- “Boosted because this is a semifinal.”
- “Boosted because you follow British underdog storylines.”
- “Worth checking out because this stage could reshape general classification.”[1]

This matters because it makes the product feel personally intelligent rather than opaque.[1]

### Refresh Feed

Rename **Suggest additions** to **Refresh feed** and treat it as a fetch-and-rerank action. The MVP implementation should pull remote feed files over HTTPS, compare version metadata, and update only when the upstream feed has changed.[1]

Minimum file structure:

- `feed-meta.json`
- `events.json`
- `entities.json`
- `relationships.json`[1]

The short presenter sentence and full spiel should be generated from relational joins across event, entity, and relationship records. This preserves narrative continuity without needing a heavy editorial backend.[1]

### HITL Gate

Before Phase 2 rollout, review:

- One full sport preference flow, starting with Tennis.
- A 20-event ranking output before and after enthusiasm changes.
- One refresh scenario where new events enter, old events drop, and card order reshuffles.[1]

## Phase 3 — Replay List and Decay Logic

### Replay List Purpose

Add a replay list designed around **never-miss insurance**, with recent additions prioritised but importance still dominating within freshness bands. This supports the core pain-med value: if an event was truly worth the user’s time, the app should still rescue it after live play.[1]

Replay list rules:

- Include only completed or in-progress events eligible for replay or highlights.
- Sort primarily by a replay score that blends importance and freshness.
- Remove items automatically via decay rather than requiring manual cleanup.[1]

### Decay Model

Use importance-weighted age decay so higher-stakes events remain visible longer than middling ones. The simplest MVP-safe approach is to compute a replay persistence score daily and hide cards below a threshold.[1]

Suggested model:

\[
replayScore = recommendationScore \times decayMultiplier(ageDays, stakesScore)
\]

One practical decay function:

\[
decayMultiplier = e^{-ageDays / halfLife}
\]

Where `halfLife` depends on stakes:

- Stakes 5/5 → half-life 7 days
- Stakes 4/5 → half-life 5 days
- Stakes 3/5 → half-life 3 days
- Stakes 2/5 → half-life 2 days
- Stakes 1/5 → half-life 1 day[1]

This gives the intended behaviour:

- Recent additions rise quickly.
- Big events decay slowly.
- Low-value replays disappear fast.[1]

### Replay Ranking Behaviour

Recommended ordering logic:

1. Partition by recency window, for example 0–2 days, 3–7 days, and 8+ days.
2. Rank within each window by replay score.
3. Auto-remove when replay score drops below threshold or when replay availability expires.[1]

This keeps the replay list feeling fresh without burying genuinely major events.[1]

### HITL Gate

Before enabling the replay list broadly, validate with a seeded test set containing:

- One massive final from 6 days ago.
- One medium event from yesterday.
- One minor event from today.
- One highly preferred but mid-importance event from 4 days ago.[1]

Check whether the resulting order matches human instinct before freezing the decay constants.[1]

## Deployment Order

For immediate deployment, sequence the work in this order:

1. Refactor card states: compact → selected → opened.
2. Remove default spiels and visible narrative chrome.
3. Add contained stakes meter and heat-ranked backgrounds.
4. Add the Top Storylines / Worth Checking Out split.
5. Implement enthusiasm presets for Tennis first.
6. Wire Refresh feed to remote versioned JSON.
7. Add opened-state inclusion explanations.
8. Ship replay list with decay after the core feed feels right.[1]

This sequence keeps the MVP disciplined:

- First fix scanability.
- Then ranking clarity.
- Then personalisation.
- Then replay rescue.[1]

It also matches the preference for phased delivery with explicit verification gates rather than one large autonomous build.

Sources
[1] pasted_image_1783553733_0.jpeg https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/images/804647663/931976bf-285d-4db6-98ce-c3a12c4259b0/pasted_image_1783553733_0.jpeg?AWSAccessKeyId=ASIA2F3EMEYEUQ6QSTT3&Signature=KzhetENGFmRQoeUxyTyQ2uur7HM%3D&x-amz-security-token=IQoJb3JpZ2luX2VjEM%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCXVzLWVhc3QtMSJHMEUCIDVqOgM6ruCed8nJOlj5AGU1iyhlMAbX0fZ3GB6MxhsUAiEAo9FOdK2rnzI2neTJF5K7t6CxdUVbPMnQ4b1X%2BVHNFYUq%2FAQImP%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDAjx4b4Okvkolhws7yrQBOFQEmdzPTNOfFKwkDgKZ7z%2F8DyHrCNCK%2FLhnV5Y6QF0%2F9WmCGMEq4HsfZ0PF2mlweAiAoEKR3w5l0zcpErsGnQ58YLqBlJIOywR5iT%2BbylHx39iQqoDfDh%2FLm8Swoj%2FOQj5zZRWLjuDbNmzuLmiXgIGWSrP4nu6BPv%2FXhUFmdHHy9aWN8rKOYRrunHNfFRdft9DZj1kdEICoDgW5CUgUmmGHiKOsQ9EDl6yUkkdNySEhtOS5276oFq%2BmjFQc6nzgviYMB%2BN4G8Do8nnf67fnSnrALUx6%2BQdoES%2BjjAkPzI26W8FozN2Og3OXWbXAzSW7oaHlMG4AdO%2FTbN49IHfFGPbqgo85PFIjBvjWksBEdmz2MFzq6SqCvHcMXLJx3WTx0WKrxNISxqX9dnZ02xlKPbdNGzUzdJyhjB%2FNTfu8wjRoqs7cmbDDRENX9E8apcVMnw0cV3NQMTf%2BBTebh7sqDLxWoPBuQcRDLL64DRtGulQAjG9%2F3SKJNCFy2b4GcKnopDLGGQoBsTKXnWEViXhsdlh35FXxTewc13cbPZNqt7g77lDhU0Z9mKVrh76vO3ICZXuW1lWP6D%2BfFVlmcfKDJMD7o1MbrmeLZDYHMFyE7r5B%2BTl0Am9INM68%2BHxnsKOCiKjnrOhZEVwClZ9EiH5tpLHl6zts8fTLJ6lR0wbzUMLG9BwnJfaoXpKFx0%2FdFVcEXf8zxgWor3cx9PK43jr8j%2BP0U9kec4UmSqULOMHG%2FxbvYt%2BUjkwy8gaJxXJQx6C4OusQWvWFXTnvtw%2FGGlePMcwl%2F%2B80gY6mAHMiFnXSxcYwMTcLOpBfiQS9j1SqKCqF1Yy65XmJ95ZKNijMQMvc3Q8zCXR4Oml8CmeE%2Blwqd51vOkanGoPZpBdn0bYXZNO0ArZYArNIZetA3nPndebvMsCjsqGwwmqLX32u8vtzUV%2B8pRlUxokvnl6U1ZC2gronfTaeV3BBWlIEWyMStxdhkNSX4V%2F6ZZFMhvD82dJ9H0zoQ%3D%3D&Expires=1783582058
[2] Wimbledon 2026 results: Arthur Fery fights back to beat Zizou Bergs to keep British singles hopes alive. https://www.bbc.co.uk/sport/tennis/articles/cj3gp85me40o
[3] Wimbledon 2026 today: Live updates, news as Brit Arthur ... https://www.espn.com/tennis/story/_/id/49299865/wimbledon-2026-today-blog-tennis-08-07-2026-live-updates-news-schedule-results-arthur-fery-flavio-cobolli-taylor-fritz-alexander-zverev
[4] Roger Federer vs Rafael Nadal head-to-head: An epic rivalry https://olympics.com/en/news/roger-federer-vs-rafael-nadal-head-to-head-tennis-record
[5] Rafael Nadal and Roger Federer: A rivalry built on respect and friendship | Tennis News - The Times of India https://timesofindia.indiatimes.com/sports/tennis/top-stories/rafael-nadal-and-roger-federer-a-rivalry-built-on-respect-and-friendship/articleshow/115467990.cms
