# Curator MVP: a trusted shortlist inside Feed

**Authoritative specification:** repository `docs/plans/curator-mvp-2026-10-24.md`; personal-output copies are review exports.

**Decision date:** 24 October 2026, Australia/Sydney.

**App/repository:** Nothing Sport, `hartican/sportscal`.

**Source inspected for queue capture:** `91862967ccd85f2785b7b0c164d3101f379dc1dc`.

**Authority:** the user approved this proposed plan with “Implement the proposed plan.” The explicitly chosen queue position remains after all existing work, including Public Feed and All Sports View.

**Current phase:** specification and queue capture only. Runtime implementation is authorised subject to that predecessor gate; it is not started or deployed by capturing this contract.

**Release ownership:** retain the existing sole integrator/publisher. This specification creates no second scheduler, implementation owner or release lane.

## 1. Product brief and agreed boundaries

**North star:** a casual, non-completist user can open NS sporadically, find a few compelling spectacles suited to them, understand why they matter, and decide whether to watch or plan around them. That single interaction should justify having NS and create willingness to pay for a lite premium account.

Curator is the **default view within Feed**, selected through floating **Curator / Feed** buttons. It contains up to five strong recommendations borrowed from the user’s eligible Feed fixtures. Priority determines selection; chronology determines display.

Agreed boundaries:

- Consider upcoming fixtures within **90 Sydney calendar days**, including today, plus genuinely live fixtures.
- Show fewer than five when insufficient fixtures qualify. Never fill places with weak alternatives.
- Preserve the complete chronological Feed and existing Follow eligibility, exclusions, session restrictions and retention.
- Remove Events from navigation. Enrich fixture cards with event context, relevant schedules and verified tickets; do not introduce tournament/programme cards into Feed.
- Manual **Add to Feed** belongs exclusively in **Follow → Schedule**.
- Reuse existing calibration and offer optional refinement. Calibration never creates follows.
- Billing, paywalls, new notifications, additional sports coverage and statistical expansion are outside this implementation.
- Place this work **after the entire existing queue**, including Public Feed and All Sports View. Reliability work and current owners retain their order.

The original dedicated Curator-tab proposal is superseded.

## 2. Experience, navigation and personal actions

### Feed and floating view controls

- Navigation becomes **Feed, Match Centre, Follow**.
- Fresh launches without an explicit destination open Feed’s Curator view.
- Show a floating segmented control, **Curator** left and **Feed** right, only within Feed. Respect safe areas, keyboard access and existing floating controls; provide 44px targets and sufficient content clearance.
- Switching views preserves each view’s scroll and expansion state during the visit. Normal Feed retains its filters; those filters do not restrict Curator’s candidate pool.
- Explicit fixture, notification, profile and calendar destinations take precedence over the default. A fixture outside the shortlist opens in normal Feed without adding it to Curator.

Curator reuses ordinary fixture cards, including expansion, provider actions, ratings, reminders and applicable ticket links. Add a short explanation of why NS selected the fixture. Do not display internal priority numbers as public spectacle ratings.

### Events consolidation

Reuse existing event metadata to supply fixture cards with competition context, stakes, related fixtures and ticket actions. Keep overview material accessible through Follow’s Major Events/Schedule journey.

Legacy Events links must resolve to the corresponding Follow overview or Schedule context; links identifying an individual fixture open that fixture. Preserve event-family follows, exclusions, identities and saved actions. Standalone ticket-sale records become contextual actions rather than sporting Feed cards.

Only show qualified ticket offers through the existing verified ticketing resolver. Label event-wide passes accurately; do not imply they guarantee admission to a particular fixture. Ticket availability, revenue and sale deadlines do not influence ranking.

### Curator-only ×

Place an accessible × in the top-right corner of each curated card.

- Tooltip: **“Remove from Curator. Keep in Feed.”**
- Accessible label includes the fixture name.
- Suppress that canonical fixture from Curator until confirmed completion, including subsequent visits and reschedules.
- Leave the fixture, follows, ratings, reminders, calendar choices and normal Feed visibility unchanged.
- Offer immediate **Undo** and a **Moved to Feed** list within Curator’s refinement controls for later restoration.
- Refill the vacant position only when another qualifying fixture exists.
- Keep this handler separate from normal Feed’s existing Dismiss action.

Persist suppression through the existing account preference-save path; signed-out use remains local under existing account-transition rules. Undo removes the suppression and its learning contribution.

### Schedule-only manual additions

Replace direct Add to Feed actions elsewhere—including Match Centre and friend activity—with **Open in Schedule**, focusing the corresponding row. Existing manual pins remain effective. Follow/Unfollow controls continue operating in their existing locations.

An empty Curator says no fixtures currently clear the bar and offers normal Feed, Follow → Schedule and optional taste refinement.

## 3. Deterministic selection and editorial quality contract

### Eligibility and scoring

Run selection over the **complete eligible candidate set before Feed pagination**, never just the currently rendered cards.

Exclude completed, cancelled, postponed-without-a-new-date, dismissed, archived, explicitly excluded and Curator-suppressed fixtures. Preserve all existing sport/session admission rules. Allow published fixture dates with time TBC; never manufacture a kickoff or enable an exact-time reminder from that date.

A fixture first needs a valid, reviewed **internal spectacle assessment of at least 4/5**. This assesses expected watchability—contest, skill, participants, rivalry, atmosphere, narrative and consequences—not stakes alone. It is editorial metadata, not a manufactured Nothing Score vote.

For qualifying fixtures:

**Priority = 50% spectacle + 30% personal taste + 20% sporting urgency**

Normalize components to 0–100. Use a minimum overall priority of **65**.

| Component | MVP rule |
|---|---|
| Spectacle | Reviewed 1–5 assessment, allowing half-points, multiplied by 20. |
| Personal taste | Twenty times the higher existing interest/follow-priority score; use 50 when an eligible fixture has no usable priority signal. Apply existing bounded explicit calibration adjustments and Curator learning, then clamp to 0–100. |
| Urgency | Confirmed live or within 24 hours: 100; 1–3 days: 90; 4–7: 75; 8–14: 55; 15–30: 35; 31–60: 15; 61–90: 0. Date-only fixtures use their published calendar day without creating a sporting instant. |

Verified viewing access is useful but not required. Unknown access produces no unsupported watch claim.

Resolve score ties by spectacle assessment, personal taste, earlier published start/date, then canonical fixture ID. Display selected fixtures chronologically, placing time-TBC fixtures after confirmed times on the same date.

### Related fixtures and stability

Use canonical event-edition/weekend identifiers to group related fixtures; never infer grouping from title similarity.

Normally select one fixture per group. A second may qualify only with a 5/5 spectacle assessment, priority at least 85, and a ten-point advantage over the best remaining alternative from another group. Permit at most two per group. Do not force cross-sport diversity.

Re-select on a new visit, deliberate refresh or explicit preference change. Keep membership stable while reading through routine updates. Immediately reconcile completion, cancellation, lost eligibility, invalid editorial and × actions; retain other cards and preserve reading position. Verified reschedules update chronology.

### Gentle learning from ×

Derive a reversible penalty from distinct relegations in the preceding 90 days:

- Reduce personal taste by three points per relegation matching the same canonical competition and fixture/session category, capped at twelve.
- Count each fixture once. Repeated clicks cannot accumulate penalties.
- Undo removes that fixture’s contribution.
- Do not infer a sport mute, change Follow admission, alter public ratings or count passive browsing as dislike.

Retain an active fixture’s suppression until completion. Expire completed records once they fall outside the learning window.

### Editorial admission contract

Every recommended fixture must have:

- A fixture-specific **reason to watch**, approximately 25–55 words.
- Source-backed context explaining the sporting appeal or consequence.
- Up to three useful supporting facts, where supported.
- Source references, review time, expiry, canonical grouping and internal spectacle assessment.
- A spoiler-safe version appropriate to the fixture’s current phase.

Participant/venue/date restatement, generic excitement, recycled context and unsupported predictions fail the contract. Missing editorial removes Curator eligibility, not ordinary Feed admission.

Use shared research across users through the existing editorial owner. Extend that owner’s concise-brief inventory to 90 days without scanning private preferences or commissioning research per viewer. Preserve current full-feature editorial rules.

Default brief review intervals are daily within seven days, weekly at 8–30 days, and every thirty days at 31–90 days. Earlier source expiry or a material factual change invalidates the affected brief immediately. Existing research budgets remain fixed; insufficient evidence or capacity means fewer qualifying recommendations.

## 4. Implementation sequence and interfaces

**First, capture the settled brief and queue entry when execution is authorised.** This is the current documentation-only phase; no runtime work starts before the recorded predecessors finish.

1. **Rebase after predecessors finish.** Inspect current main and the delivered Public Feed/All Sports interfaces. Update Follow decisions to record the agreed Events, presentation and Schedule-only addition changes.
2. **Build the shared selector and editorial projection.** Implement a pure, versioned selector accepting canonical fixtures, effective preferences, Curator suppressions, reviewed briefs and a supplied clock. Return selected IDs, component scores, reason codes and source/review revisions.
3. **Integrate the existing Feed pipeline.** Add `view=curator` to the authenticated Feed GET interface. Select before pagination and materialize at most five cards. Keep the ordinary Feed response and chronology compatible; give Curator responses explicit selection-version/completeness metadata.
4. **Add personal state and telemetry.** Extend the existing versioned preference payload with canonical relegation records. Reuse account ownership, pending-intent, conditional-save and conflict protections. Add Curator exposure, view-switch, relegate and restore events to existing measurement; separate them from ordinary Feed activity.
5. **Deliver presentation and consolidation.** Add the floating controls, default routing, shared-card explanation and scoped ×; consolidate Events context and migrate legacy routes; relocate manual additions.
6. **Qualify and release.** Regenerate through existing build owners, complete normal release gates, publish the exact snapshot and verify hosted plus installed-app behaviour.

Signed-out selection uses the same selector against the existing available catalogue and effective local preferences. Incomplete/unavailable catalogue input must not be presented as a fresh complete selection: retain eligible, editorial-valid last-good cards with view-level freshness handling, or show the honest empty/unavailable state.

No separate preference store, database table, scheduler, provider ingestion path or notification mechanism is introduced. Preserve current backend deadlines, source ownership, download/cache budgets and release safeguards. Curator must not fetch every ordinary Feed page to discover candidates.

## 5. Acceptance, rollout and success measures

Test the actual shared selector and rendered journeys:

- Complete-pool selection finds a high-priority fixture beyond the first Feed page; ordinary Feed pagination and chronology remain unchanged.
- Ranking weights, threshold boundaries, ties, 90-day limits, Sydney daylight-saving changes and date-only ordering are deterministic.
- Near-term strong fixtures usually beat comparable distant fixtures; exceptional distant fixtures can win.
- Group limits, second-fixture exceptions, sparse results and honest zero-pick states behave exactly as specified.
- Genuine live status can retain a pick; scheduled time alone cannot create live membership.
- × affects Curator only, persists across restart/devices, deduplicates learning and reverses correctly through Undo/restoration.
- Follow exclusions, explicit empty/OFF choices, account switches and stale callbacks retain their protections.
- Curator and normal Feed share fixture actions without duplicate saves, reminders, identities or rewards.
- Only Schedule can manually add fixtures; old pins and legacy Events/notification links survive.
- Editorial failures, expiry, changed facts, Results OFF, ticket scope/expiry and unknown providers fail safely.
- Floating controls and card actions pass keyboard, narrow-phone, desktop, Chromium/WebKit and installed-upgrade/offline checks.

Release first to the existing pilot after preceding queue items and reliability gates pass.

The primary pilot is **ten casual/non-completist users**, evaluated on a single sporadic-use session. Target at least eight being able to choose a fixture and explain its appeal within 45 seconds. Record shortlist relevance, decision confidence, successful watch/reminder/calendar actions and whether users consider the interaction valuable enough to keep NS.

Use later spectacle feedback to assess whether recommendations delivered. Report sample size and missing responses. Measure willingness to pay separately; this release contains no payment or entitlement changes.

The prioritisation floor, urgency buckets, learning cap and editorial review intervals above are explicit MVP defaults. Version them and evaluate changes through the pilot; do not leave implementers to invent alternative ranking rules.

## 6. Phase ledger and execution gate

| Phase | Included | Deferred / acceptance boundary |
|---|---|---|
| Contract and queue capture | This authoritative brief, an exported review copy and one Curator entry after All Sports View in the delivery record. | Documentation only. No runtime, source facts, effective Follow policy, generated assets, private state, deployment or scheduling change. |
| Runtime implementation | Steps 1–5 above, only after every existing queued predecessor finishes and the sole integrator allocates the normal integration lane. | Reinspect current main and existing contracts first; a dated old reliability receipt or green source test does not clear the queue. |
| Qualification and release | Step 6 and all acceptance cases above. | Normal hosted, installed, account/device and production proof remain distinct. No release exception is inferred. |

At contract capture, the repository record still describes Public Feed and All Sports View as deferred, with earlier work ahead of them. Therefore this phase may save and propose the queue amendment but must not implement or activate Curator ahead of them. A locally prepared entry or draft pull request is not an acknowledged/merged authoritative queue update.

Update [the delivery record](../cto-delivery-plan.md), [Follow decisions](../follow-decisions.md) and [backend efficiency decisions](../backend-efficiency-decisions.md) alongside their actual affected implementation when the respective phase becomes active. The queue capture alone does not make the future navigation, ranking or manual-add rules effective.

## 28 October 2026 — match cards and continuing multi-day play

Original-owner receipt: the 28 October user clarification was relayed by coordination task `01a167bb-08c3-7015-bb37-cc06b889d029`, reference `Sentinel_3abec71e6ea4819196043057c5c0e0b0`. It supplements the approved 24 October contract; the earlier decision history is retained.

> exclude tournament overview cards. Treat multi-day events like test cricket cards, where matchplay continues at a known time if the teams stay the same. If teams or players change, and matches change (like tennis), just treat each match as it's own card. Acknowledge that it's part of a tournament or multi-day event, but what really matters is the match in hand, and that's what deserves the dedicated card on Feed.

- No tournament overview cards enter Feed. Tournament/series context belongs on each match card; discovery and overview access remain under Follow → Major Events/Schedule.
- One continuing match, such as a Test, retains its own canonical card across days. Show its next session/resumption time only when known from qualified source evidence; otherwise preserve unknown timing. An overnight break does not create a new match card.
- Distinct matches retain distinct cards, including within the same tournament and even when the participants repeat. Identical teams or players alone never justify merging fixture identities. Source-confirmed continuation of the same match, rather than participant equality, determines continuity.
- Preserve settled navigation removal, Schedule-only manual Add to Feed, follows, exclusions, saved actions, legacy routes and source identities. Curator's related-fixture selection cap does not merge or delete separate Feed cards.
- Add acceptance cases for one Test continuing over several days, known versus unknown next-session times, separate tennis matches within a tournament, and separate fixtures with identical participants.

Documentation only. The active phone-sync incident retains priority. Curator stays after all existing predecessors, including Public Feed and All Sports View, with no ETA. No runtime work, new owner, main merge or deployment is authorised by this clarification.
