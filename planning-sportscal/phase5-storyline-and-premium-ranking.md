# Phase 5 — storyline enrichment and premium ranking

## Release contract

Phase 5 keeps canonical event facts unchanged and derives interpretation at read/build time. It adds:

- deterministic stakes, arc-stage and intensity rules;
- a versioned editorial override registry with reviewer, review time and note;
- an explainable premium-ranking score using stakes, intensity, user interest, followed participants, Australian relevance, AU availability and viewing-time fit;
- separate, capped `Must Watch` and `Top Storylines This Week` surfaces for the next seven days;
- plain, compact, standard and marquee rendering tiers, with premium cards removed from the ordinary chronological stream to avoid duplication;
- spoiler-safe narrative hooks inherited from the existing preview/recap lifecycle.

Routine fixture breadth remains in the chronological feed or sport-hub completeness view. It does not qualify for premium rails unless the user explicitly marks it Must Watch.

## Editorial overrides

`config/storyline-overrides.js` is the only manual override registry. Each entry must include `reviewedAt`, `reviewedBy` and `note`. Overrides may change interpretation and presentation, including stakes, intensity, label, card variant and premium surface. They must not change event time, participants, broadcaster, status, score or result truth.

## Validation

Run the Phase 5 gate before a release:

```bash
node scripts/validate-phase5-premium-ranking.js
node scripts/validate-enrichment-engine.js
node scripts/validate-card-lifecycle.js
node scripts/validate-feed.js data/events.json
node scripts/qa-storyline-spoilers.js data/events.json
```

Then run the canonical local refresh and full repository checks. Browser QA must confirm both rails render on desktop and mobile, remain horizontally usable on mobile, disclose ranking evidence only after the existing three-stage card expansion, and report no console errors.
