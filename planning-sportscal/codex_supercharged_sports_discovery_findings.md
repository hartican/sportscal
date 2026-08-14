# Supercharged Sports Discovery — adopted implementation findings

**Adopted:** 14 August 2026
**Authority:** the approved implementation plan and clarification quiz
**Release shape:** one combined preview, then one immutable production release after automated and rendered QA

## Product decision

The feed should open as a sports product, not a settings screen. The first viewport belongs to a complete normal card. `Tune` is the single control surface for browsing sports and changing feed intent; global results remain in the header and provider ownership remains in Settings.

This document replaces the earlier unresolved citation markers and supersedes its old 10-event rule, separate Cincinnati session cards, direct event follows, always-open filter rail and phased production releases.

## Catalogue and hierarchy

Use a versioned hierarchy with three node types: parents, selectable sport children and internal event tags. Keep existing canonical sport IDs wherever they still describe the sport accurately.

The exposed hierarchy is:

- Motorsport → F1, Rally
- Extreme → MTB
- Surfing → Big-wave
- Snow → Alpine, Freestyle

Goodwood, Le Mans, Wimbledon, the Super Bowl and other named events are internal tags. They are neither filters nor follow choices. Existing event follows migrate to their underlying sport. A Commonwealth Games umbrella follow migrates to the disciplines already selected, or to every supported Games sport when no discipline was recorded.

Parent controls have an independent selection tick and expand arrow. Selecting a parent includes every descendant. A parent is mixed when only some descendants are included.

## Browse visibility and session filtering

Visibility is calculated from the complete catalogue, not from the user's follows:

1. Count unfinished fixtures, matches, races or sessions occurring within the next 30 Sydney calendar days.
2. Count by stable underlying event ID, never by grouped card, so an event cannot be counted twice.
3. Show a family in the main Browse list when its combined descendants contain at least five events.
4. Put followed sports below that threshold under `More`, retaining both the session Toggle and focused-view Open actions.

Every main visible sport starts included on each visit. Inclusion is multi-select and session-only: switching a sport off hides it for that visit without changing follows. `Open` launches its focused view. An unfollowed sport opens with Must Watch and top-story highlights plus a Follow action.

## Tune and header

The compact navigation row is `Feed | Standings | Tune`. Tune opens a focus-trapped bottom sheet and restores both feed position and the launching control's focus on close. It contains Browse plus Froth, Scope, Availability, Timing and Stakes. It does not duplicate Spoilers or Services owned.

The header retains the current action icons and changes the time suffix to `AEST/AEDT`. After the first normal card renders, the app measures the card against a 390×844 viewport budget. It progressively reduces header padding, reduces the logo, then hides the slogan only if needed. Branding remains visible. After those steps, no more than approximately 48 px of residual scrolling is acceptable.

## AFL and NRL

Complete AFL or NRL coverage is controlled by that sport's saved `Froth` template, not the global Froth control and not a temporary filter choice.

Opening either league below sport Froth offers two explicit outcomes:

- `Set this sport to Froth` persists Froth and unlocks every fixture.
- `Keep highlights` keeps Must Watch and top-story cards only.

Following an unfollowed league starts at the existing normal follow default. The same focused-view prompt can then upgrade it.

## Cincinnati joint-tournament beta

Build a reusable `joint-tennis-tournament.v1` model but enable only Cincinnati in this release. One stable tournament card is pinned from the first published order of play through the final.

The card promotes three matches using a deterministic balanced score based on round importance, pre-match player rankings, Australian interest and trustworthy existing pre-match narrative/media signals. The chosen matches are displayed in their actual court/play sequence with ATP/WTA labels and exact, not-before, followed-by or session-only timing.

The card displays `Beta schedule`, its official source and one confidence state: Confirmed, Provisional, Session only or Stale. When results are hidden, schedule and lineup data are separated from result fields and no score, winner or outcome-derived ranking signal is rendered. When results are shown, completed promoted-match results can appear alongside upcoming highlights.

Save, reminder and related actions belong to individual matches. A saved or reminded match that rotates out of the top three remains on the card in collapsed `Saved matches (N)`.

### Approved source boundary

Automation may follow only links published through Cincinnati's official [Tournament Schedule](https://cincinnatiopen.com/tournament/tournament-schedule/), [Order of Play](https://cincinnatiopen.com/score-center/order-of-play/) and [Draws](https://cincinnatiopen.com/score-center/draws/) pages. The importer discovers official PDFs from those pages, validates their host/type/content and records provenance.

Do not automate ATP or WTA fallbacks. Their published [ATP terms](https://www.atptour.com/en/terms-and-conditions) and [WTA terms](https://www.wtatennis.com/terms-and-conditions) restrict systematic or automated retrieval without permission. Do not depend on undocumented Rain endpoints.

After a parse failure, retain the last successful document for no more than 24 hours with `Stale`. After that, keep the pinned overview and say schedule details are unavailable. Optional tournament-detail failure must not block the wider feed; schema errors, duplicate IDs, impossible dates and spoiler leakage do block release.

The supporting [source and paid-provider research](../docs/research/nothingsport-cincinnati-and-paid-tennis-sources.md) records the evidence, unknowns and procurement questions. Sportradar, SportsDataIO and API-Tennis are research-only candidates; no purchase or integration is approved for this MVP.

## Data, preferences and measurement

- Store stable tournament and match IDs, retrieval/source metadata, confidence/freshness, venue, court, tour, players, rankings and scheduled sequence.
- Store optional results separately from spoiler-safe schedule fields.
- Store the deterministic promotion score and categorical reasons.
- Bump the preference version and migrate event-brand follows without resetting other user state.
- Persist follows, sport Froth and match actions normally; never persist session sport inclusion.
- Reuse the approved categorical telemetry for Tune, sport toggles, Open, Follow, Froth upgrades and match actions. Add no free text, credentials or client-supplied user IDs.

## Verification and release contract

Automated checks cover hierarchy, five-event aggregation and deduplication, mixed parent state, session reset, More, migration, AFL/NRL gating, Cincinnati parsing, stable IDs, scoring, spoiler separation, saved-match retention, stale/overview fallbacks and measurement validation.

Rendered QA covers 390×844 and desktop widths, the first-card budget, dynamic compaction, horizontal overflow, Tune focus/dismissal, multi-select controls, focused views and both results modes.

The canonical `scripts/update-cards.js` chain remains the only refresh entry point. Keep the Fri–Sun 9am Sydney full refresh. Add a separate 9am Sydney tournament check which invokes that canonical path and the shared immutable release path, and exits without a release when Cincinnati is inactive or output is unchanged.

The implementation remains static-first: no browser-time scraping and no runtime proxy.
