# Storyline → SportsCal Context Handoff

## Purpose

This document captures the key context from the current session about how the **Storyline** narrative card system should be reused inside the **SportsCal** project. Storyline is an interactive design system for sports event cards that maps narrative archetypes and event stakes onto visual intensity, with all cards framed as pre-event previews rather than post-event recaps.[cite:1][cite:2]

The recommended direction is to reuse Storyline as a narrative enrichment layer inside SportsCal rather than as a separate standalone experience.[cite:1][cite:3] SportsCal should remain a spoiler-safe sports planner and event tracker, while Storyline should help rank, explain, and visually prioritise which upcoming events deserve attention.[cite:1][cite:11][cite:16]

## What Storyline Already Defines

Storyline has a structured narrative model built around seven archetypes: Overcoming the Monster, Rags to Riches, The Quest, Voyage & Return, Rivalry/Tragedy-in-Waiting, Rebirth, and Comedy/Order Restored.[cite:1][cite:2] Each archetype defines colour, iconography, motif family, and typical character-role pairings, which means it already functions as a reusable narrative taxonomy rather than just a visual theme pack.[cite:1]

It also defines five intensity tiers that control type weight, motion, UI chrome, and which supporting elements appear on a card, from a low-key Routine Fixture to a full Historic/Defining Moment treatment.[cite:1][cite:2] A core design law of the system is that routine fixtures and defining moments must not compete visually, so restraint is treated as meaningful information rather than lack of polish.[cite:1]

The metadata model is already close to what SportsCal needs for narrative enrichment: archetype, arc stage, stakes, character roles, narrative hook, and intensity all sit alongside normal event logistics like kickoff, venue, and broadcast.[cite:1] The narrative hook is explicitly a short anticipatory sentence written before the event happens, which aligns well with SportsCal’s spoiler-safe product direction.[cite:1][cite:11]

## Why It Fits SportsCal

SportsCal already has a product direction centred on spoiler-safe scheduling, event filtering, broadcaster-aware viewing, must-watch logic, and narrative preview cards for important events.[cite:3][cite:11][cite:13][cite:16] The user has already expressed a preference to start SportsCal’s narrative layer with preview cards rather than more abstract discovery tooling.[cite:3][cite:12]

This makes Storyline a strong fit because it solves the “why should I care about this event?” problem without requiring SportsCal to abandon its existing event-planning role.[cite:1][cite:3] In practical terms, SportsCal remains the schedule, preference, and watch-planning product, while Storyline becomes the layer that scores and presents event significance.[cite:1][cite:16]

## Recommended Product Role

Storyline should not replace SportsCal’s base UI or event model.[cite:3][cite:16] Instead, it should be treated as a selective presentation and prioritisation system that activates mainly in high-value contexts such as marquee event rails, weekly must-watch summaries, favourite-team spotlight cards, and shared recommendations.[cite:1][cite:16][cite:18]

The most useful end-state is a SportsCal experience where users can still browse a normal calendar or list, but the app can also surface a “Top Storylines This Week” or “Must Watch” layer driven by Storyline metadata.[cite:1][cite:16] This preserves usability for ordinary planning while adding editorial intelligence for major events.[cite:1]

## Recommended Architecture

A clean reuse pattern is to separate SportsCal into three concerns: the canonical event layer, a Storyline narrative enrichment layer, and a rendering layer.[cite:1][cite:6] The canonical event layer should own hard facts such as sport, competition, participants, start time, broadcaster, venue, round, and user preference state.[cite:1][cite:16]

The Storyline layer should derive or store narrative fields such as `archetype`, `stakes`, `arcStage`, `characterArchetypes`, `narrativeHook`, and `intensity`.[cite:1] The rendering layer should decide whether the event appears as a plain row, a compact preview card, or a marquee high-intensity card without changing the underlying event record.[cite:1]

This architecture fits the user’s broader preference for strict boundaries and modular systems where interpretation and AI-like logic stay at the edges rather than mutating core truth models.[cite:6] That same thinking has already been applied by the user in Flashr’s layered architecture preferences, and it is a good fit here too.[cite:6]

## Proposed Data Shape for SportsCal

The safest integration path is to keep SportsCal’s current event object intact and add a nested `storyline` block.[cite:1][cite:16] This avoids spreading narrative fields across the entire app and keeps the enrichment layer optional per event.[cite:1]

A practical example shape is shown below:

```ts
interface SportsCalEvent {
  id: string;
  sport: string;
  competition: string;
  startTime: string;
  venue?: string;
  broadcasters: string[];
  participants: Array<{
    name: string;
    role?: 'protagonist' | 'antagonist' | 'peer';
    color?: string;
  }>;
  userInterestScore?: number;
  storyline?: {
    archetype?: 'monster' | 'ragsToRiches' | 'quest' | 'voyageReturn' | 'rivalry' | 'rebirth' | 'comedy';
    arcStage?: 'inciting' | 'rising' | 'climax' | 'resolution';
    stakes?: 'low' | 'medium' | 'high' | 'critical';
    characterArchetypes?: Array<'underdog' | 'giant' | 'chosenOne' | 'mentor' | 'rival' | 'veteran' | 'rookie' | 'fallenHero'>;
    narrativeHook?: string;
    intensity?: 1 | 2 | 3 | 4 | 5;
    intensitySource?: 'computed' | 'manual';
    lastReviewedAt?: string;
  };
}
```

This shape preserves the Storyline schema while making it optional and non-invasive for ordinary events.[cite:1] It also leaves room for later automation, manual editorial override, and sport-specific tuning.[cite:1][cite:16]

## Rendering Strategy Inside SportsCal

Storyline should be reused selectively rather than sprayed across every event surface.[cite:1] The best initial UI surfaces are:

- A **Must Watch** rail using tier 4–5 cards for major upcoming events.[cite:1][cite:16]
- A **Top Storylines This Week** module using compact tier 3–4 cards.[cite:1][cite:16]
- Enhanced event cards on athlete/team detail views where narrative context adds decision value.[cite:1][cite:3]
- Shared recommendation cards for the social “mates watched/recommended” direction the user has discussed for SportsCal.[cite:18]

Ordinary list rows, dense schedule views, and filter-heavy screens should mostly stay low-intensity and functional.[cite:1][cite:16] The Storyline system itself warns against making routine fixtures visually compete with defining events, and that principle is even more important in a calendar product where over-signalling would quickly become noise.[cite:1]

## Scoring and Enrichment Approach

The first version should use a rule-based enrichment engine rather than an AI-first one.[cite:1][cite:5] Narrative metadata can be inferred from already-known event facts such as finals status, elimination stakes, rivalries, title implications, ranking gaps, streaks, and whether the user already follows the team or athlete involved.[cite:1][cite:4][cite:16]

A practical pattern is:

- Compute `stakes` from event importance rules such as final rounds, knockout matches, or title implications.[cite:1]
- Compute `arcStage` from where the event sits within its tournament or season progression.[cite:1]
- Compute a default `intensity` from `stakes` plus `arcStage`, preserving Storyline’s existing intensity logic.[cite:1]
- Assign an `archetype` only where the system has high confidence, otherwise leave it blank or default to low-narrative handling.[cite:1]
- Allow manual override for flagship events where editorial judgement is more reliable than automation.[cite:1]

This balances speed, control, and trustworthiness.[cite:1][cite:5] It also aligns with the user’s preference for stepwise human-verified development rather than fully autonomous batch decisions.[cite:5][cite:8]

## SportsCal-Specific Adaptations

Several Storyline concepts should be adapted before full reuse in SportsCal.[cite:1]

### 1. Keep the internal taxonomy richer than the visible labels

Users may respond faster to plain-language labels like “Must Watch”, “Rivalry”, or “Record Chase” than to the full literary taxonomy in every surface.[cite:1][cite:16] The underlying Storyline archetypes can stay intact while the outward-facing UI simplifies wording in dense contexts.[cite:1]

### 2. Make `narrativeHook` optional by context

In a marquee card or weekly digest, the hook can appear as visible copy.[cite:1] In a calendar grid, compact list, or onboarding flow, the hook may be hidden or reduced to a short subtitle to avoid crowding the planning UI.[cite:1][cite:16]

### 3. Reserve high-intensity motion for premium contexts

Storyline’s stronger motion treatments are appropriate for feature rails or a hero surface, but SportsCal’s everyday schedule use will benefit from much more restrained behaviour.[cite:1][cite:2] Motion and glow should reinforce hierarchy, not slow scanning.[cite:1]

### 4. Start with the user’s actual tracked sports

The user has already identified interest in events such as the Masters, NBA playoffs and Finals, Australian cricket Tests, the Super Bowl, Le Mans, Rugby League Finals, and Wallabies matches.[cite:4][cite:14] Reuse should start with these known, high-signal categories rather than attempting to narrativise every sport on day one.[cite:4][cite:16]

## Suggested Initial Scope

The highest-leverage pilot is a narrow subset of marquee events that naturally carry strong narrative scaffolding.[cite:3][cite:4] Good starting categories include:

- Tennis finals and late-round Grand Slam matches.[cite:13]
- NBA Finals and deep playoff games.[cite:4]
- Test cricket series matches, especially Ashes-style rivalry fixtures.[cite:1][cite:4]
- The Masters final rounds and major-golf contention windows.[cite:4]
- Wallabies Tests, NRL finals, and major Australian rivalry fixtures.[cite:4][cite:14]

These event classes are easier to score for stakes and easier to explain in preview language, which makes them ideal for validating the model before broader rollout.[cite:1][cite:16]

## UI and Technical Patterns Worth Reusing Directly

Some Storyline implementation patterns are directly reusable in SportsCal.[cite:2]

### Narrative card rendering pipeline

Storyline already uses a metadata-to-visual rendering pipeline where archetype resolves colour/icon/motif, intensity resolves template and UI chrome, and conditional UI elements appear based on stakes and arc stage.[cite:1] This is a strong basis for a portable SportsCal card renderer.[cite:1]

### Runtime scale-to-fit for variable-height card stacks

Storyline solved a mobile overflow problem in its fanned hero stack by measuring actual rendered card height and width, then applying a uniform `transform: scale()` to fit the stack within a fixed frame.[cite:1][cite:2] That pattern is worth reusing anywhere SportsCal needs stacked featured cards or responsive preview rails with unpredictable copy length.[cite:1][cite:2]

### Defensive icon loading and graceful degradation

Storyline had to harden `lucide.createIcons()` with a `safeCreateIcons()` wrapper because a CDN outage could otherwise halt app initialisation.[cite:2] That same defensive posture is relevant to SportsCal if it remains lightweight and CDN-driven.[cite:2]

## Risks and Failure Modes

The main risks in reuse are over-tagging, over-designing, and collapsing the distinction between factual event data and editorial narrative interpretation.[cite:1][cite:6] If every event receives a dramatic hook or high-intensity treatment, the signal quality drops and the user learns to ignore the system.[cite:1]

Another risk is trying to launch Storyline support across every sport immediately.[cite:4][cite:16] The safer path is to prove that the narrative layer improves watch-planning for a small number of flagship event classes, then expand once the rules feel trustworthy.[cite:4][cite:5]

## Recommended Implementation Roadmap

A phased rollout is the best fit for the user’s preferred workflow with one edit at a time and explicit verification gates.[cite:5][cite:8]

### Phase 1 — Schema only

Add the nested `storyline` object to the SportsCal event model with no visible UI changes yet.[cite:1][cite:16] Populate it manually for a small seed set of flagship events.[cite:1]

### Phase 2 — Single reusable card component

Build one `NarrativePreviewCard` component with at least three display modes: compact, standard, and marquee.[cite:1][cite:2] Confirm that it can render both enriched and plain events gracefully.[cite:1]

### Phase 3 — Rule-based enrichment

Add deterministic scoring rules for stakes, arc stage, and intensity for the small pilot sports set.[cite:1][cite:4] Keep archetype assignment conservative and editable.[cite:1]

### Phase 4 — One high-value surface

Launch a single “Must Watch” or “Top Storylines This Week” module before changing the wider calendar UI.[cite:3][cite:16] Measure whether this improves event discoverability and perceived usefulness.[cite:16]

### Phase 5 — Broader reuse

Only after the pilot is stable should Storyline expand into onboarding preferences, recommendation sharing, weekly digests, and deeper event-detail pages.[cite:13][cite:18]

## Strategic Takeaway

Storyline should be reused in SportsCal as a disciplined narrative operating system for event significance, not just as a visual card skin.[cite:1] Its value lies in combining structured metadata, spoiler-safe preview copy, graded visual intensity, and selective editorial framing so the app can tell users what matters without overwhelming them.[cite:1][cite:2]

If implemented with strict schema boundaries, selective rollout, and rule-based scoring first, it can become one of SportsCal’s clearest product differentiators.[cite:3][cite:5][cite:16]
