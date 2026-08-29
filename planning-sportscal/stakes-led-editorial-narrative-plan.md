# Stakes-led editorial narrative layer

Status: authoritative implementation plan

## Product intent

Nothing Sport is not only a fixture index. Its editorial value is the ability to explain why an event matters now, and to remember the larger story around a team, athlete, rivalry, season or tournament.

Editorial effort is steered by canonical stakes and influenced by Nothingscore. Nothingscore may change research priority, refresh urgency and the prominence of clearly labelled audience sentiment. It must never rewrite sourced facts or change the canonical stakes rating.

The editorial hook must be visible at L0, before a card is expanded.

## Editorial contract

- Stakes 1/5 and 2/5 remain concise schedule records.
- Stakes 3/5 receives at least one persistent narrative thread and one current, event-specific sourced fact.
- Stakes 4/5 receives at least two sourced facts.
- Stakes 5/5 receives at least four sourced facts across at least three narrative dimensions and at least three sources, with the fastest refresh cadence.
- Persistent knowledge lives outside individual event editions as versioned narrative facts, narrative threads and source records.
- Each event carries an `editorialNarrative` projection that references its persistent facts and threads.
- Existing `selectedSentence`, `fullSpiel` and `storyline` fields remain compatible while consumers migrate.
- Research stores original fact summaries and citations, not copied source prose. An originality guard rejects suspicious phrase overlap and generic filler.
- When online research or generation is unavailable, publishing falls back to an event-specific factual hook composed from already verified source material. It must not invent context.
- No human review gate blocks publishing. Validation, provenance and conservative fallbacks are the publication controls.

## Presentation contract

- L0: one sentence that reveals the hook and the stakes.
- L1: `Story so far`, built from persistent thread summaries and current developments.
- L2: a fuller synopsis with sources, freshness and provenance.
- Month-grid entries remain lightweight.

## Pipeline contract

The canonical `scripts/update-cards.js` sequence is:

1. refresh canonical sports sources;
2. resolve subjects and stable event identities;
3. create the stakes-led editorial queue and perform source research;
4. update persistent narrative knowledge;
5. compose event editorial projections;
6. publish the canonical event feed once;
7. build derived pages, audits and inspectors;
8. run editorial and feed quality gates.

## Nothingscore contract

- Nothingscore affects editorial work only for stakes 3/5 and above.
- Heat can increase research depth and refresh frequency.
- Pulse makes post-event editorial updates more urgent.
- Supported Impact signals can add clearly labelled audience memory or sentiment.
- Audience signals are secondary context; sourced facts remain authoritative.

## Phases

### Phase 1 — active 5/5 marquee foundation

Ship the smallest complete vertical slice:

- add the persistent editorial knowledge and event-projection contracts;
- build source-backed narrative records for active upcoming and recently retained stakes-5 marquee events;
- publish an event-specific hook at L0 on feed cards and marquee cards;
- keep ordinary month-grid rows compact;
- add gates for source provenance, minimum marquee depth, originality and L0 rendering;
- run the canonical local refresh plus desktop and mobile browser verification.

Historical stakes-5 backfill is not required for this phase.

### Phase 2 — stakes 3/5 and 4/5 coverage

Extend the queue, research budgets, fallbacks and validators to every canonical stakes-3 and stakes-4 card.

### Phase 3 — Story so far and evidence view

Expose persistent threads at L1 and source/freshness details at L2 without overloading the compact card.

### Phase 4 — Nothingscore editorial memory

Use supported Heat, Pulse and Impact signals to prioritise editorial work and add clearly labelled audience context without weakening provenance.

## Phase 1 exclusions

- no historical catalogue-wide editorial backfill;
- no Nothingscore-driven audience sentiment in published copy;
- no new human moderation workflow;
- no new standalone startup request for Nothingscore or editorial display data;
- no release from the user-owned dirty checkout.
