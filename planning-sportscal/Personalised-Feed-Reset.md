# Personalised Feed Reset

## Summary

Deliver three production-ready releases that make the feed behave like a personal sports curator: team follows are complete and reliable, priority is manually controlled, Tune and Standings are persistent and usable, and slow loading, source and venue issues are addressed.

For the personal-use MVP, automated collection may scrape publicly accessible internet pages even when a site has not granted explicit automation permission. It must not bypass authentication, paywalls, CAPTCHAs or other technical access controls. Facts collected from sources that are neither first-party nor explicitly permitted are admissible as unverified reporting and must be visibly labelled `Unverified source`. Before the product becomes commercial, this acquisition policy must be reviewed and paid feeds should be procured where appropriate.

## Release 1 — Feed correctness, Rugby, Cricket and Football

- Introduce a reusable hierarchy: sport → International or Domestic → competition → team. Populate Rugby, Cricket and Football first.
- A followed team always surfaces all its fixtures. Casual adds no unrelated fixtures; Like adds 5/5 fixtures; Froth adds 4–5/5 fixtures. This explicitly covers All Blacks v South Africa when either team is followed.
- Make Feed intent persistent and effective:
  - Focused: followed teams and manually added Must Watch cards.
  - Balanced: normal tiered coverage.
  - Discovery: Balanced plus high-stakes suggestions across enabled families.
- Rebuild feed order as: retained past cards → Must Watch queue → Today → future dates. Always enter the Feed tab at Today.
- Must Watch is chronological, manually populated by a subtle `Add to Must Watch` action on every card, and retains past choices for three days in a subdued state. Unseen queue cards receive a one-time soft growing glow and `NEW` label, cleared on open.
- Replace the alternating jump behaviour with contextual navigation: if Today is visible, show `Jump to Must Watch`; otherwise show `Jump to Today`.
- Remove card-level Save, Archive and Mark Watched. Keep Rate for past cards. Replace More/Less like this with mutually exclusive outlined thumb controls that fill when selected; a thumbs-up immediately surfaces eligible nearby cards while preserving scroll position.
- Remove user-facing ranking explanations and Score/Outcome/Labels blocks. With results enabled, show the score naturally in the result copy only.
- Model Cincinnati as one combined ATP/WTA tournament parent card. It is never automatically pinned; it enters Must Watch only by user action. Tennis settings can still surface it as a normal suggestion.

## Release 2 — Tune, Settings and Standings

- Put persistent Feed intent first in Tune, followed by a session-only `Filter` section with Select all, Deselect all and a visible Clear filter action after Open.
- Ensure parent/child sport rows are never duplicated. Children appear only beneath their expanded parent.
- Implement inherited child overrides: Casual keeps children collapsed; Like/Froth reveal children; Custom exposes child Casual/Like/Froth overrides while team follows remain separate.
- Surface one-off motorsport events only in the feed when their relevant child is Froth; never add those event brands to Sports followed.
- Restructure Settings to: Account & sync, Sports followed, Viewing & reminders, Local venues, Feedback & appearance. Move Trust pilot and Appearance into Feedback & appearance; remove Settings Tune and Swipe Calibration from user-facing UI.
- Make Standings open at page top with a persistent all-selected-by-default filter and Select/Deselect all. Persist filter and pin choices.
- Order Standings as pinned first, then Froth level, then most recently pinned when otherwise equal. Add a Pin control to every standings card.

## Release 3 — Speed, source quality, venues and tournament detail

- Audit cold and warm mobile load paths, measure the baseline before setting final targets, then reduce blocking feed work and add a lightweight sports-themed loading state while cards hydrate.
- Add a source-trust model:
  - First-party and explicitly permitted automated sources are verified.
  - Other public web reporting may be collected automatically for this personal-use MVP and enters as unverified reporting, visibly labelled `Unverified source`.
  - Unverified facts never overwrite conflicting verified fixture, timing or result facts.
  - Do not bypass authentication, paywalls, CAPTCHAs or other technical access controls.
  - Reassess source rights and procure paid API feeds before commercialisation.
- Expand the Cincinnati parent card into Day 1…N drill-down sections, combining ATP and WTA schedules, results, highlights and commentary under the one tournament identity.
- Create a canonical venue identity and alias registry. Audit the current venue set and future inputs; show the common colloquial name first, retain official or sponsor naming in detail, and prevent different venues from being merged because of naming changes.

## Data and interaction changes

- Extend the preference graph with hierarchy-level coverage overrides, team follows, persistent feed intent, persistent standings filters and pin timestamps.
- Replace saved/archive actions with a Must Watch action record containing add time, first-seen time and three-day post-event retention.
- Add tournament parent/day records, source trust/provenance and venue alias fields while retaining canonical event IDs.
- Keep Filter session-only; all eligible sports return on the next app open.

## Test and release plan

- Add fixture regressions for All Blacks v South Africa, followed Rugby/Cricket/Football teams, Casual/Like/Froth thresholds, child inheritance and one-off motorsport discovery.
- Browser-test Feed entry at Today, contextual jump behaviour, chronological Must Watch, three-day past retention, glow clearing, immediate thumb-up surfacing, Filter clearability and no duplicated hierarchy rows.
- Test Standings persistence, pin ordering, all-select controls and top-of-page loading.
- Test Cincinnati single-card/day drill-down behaviour, verified/unverified source labels, spoiler safety and no automatic pinning.
- Benchmark cold/warm loading before and after Release 3; test mobile and desktop loading states, no horizontal overflow, service-worker updates and source-commit deployment verification.
- Treat each release as independently previewed, validated and deployable.

## Assumptions

- Team follows are the only complete-fixture guarantee; non-followed coverage follows the chosen tiered discovery rule.
- The colloquial venue name is display copy, not a replacement for canonical venue identity.
- Automatically scraped reporting is an MVP fallback and remains clearly distinguished from verified data.
- Source acquisition does not bypass authentication, paywalls, CAPTCHAs or other technical access controls.
- Paid feed procurement is a future commercialisation requirement, not a current MVP blocker.
