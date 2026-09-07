# UX recovery verification — 7 September 2026

Implemented from `7ae4d93c3bcae95bcec7d2c3549f8b07c9ade3b7` on an isolated `codex/` worktree. The older primary checkout and its unrelated files were preserved. Shell version: 243.

## Changes and causes

- Removed the three-second minimum launch delay and one-second launch animation. Valid cached/public fixtures can render while supplementary sources load.
- Feed now resolves saved collections and the Major Events catalogue independently of visiting Follow. Cached directory/catalogue data is usable before network revalidation; failures retain validated fixtures and pagination.
- Fixed retained cards whose new activation handlers referenced detached replacement nodes. A tap now updates the mounted card, including after reload and reconciliation.
- Compact patches mounted cards atomically. Profiling found catalogue merging, rather than card construction, dominated the old toggle transaction; that merge no longer runs for a display-only toggle.
- Consolidated the shared layout stylesheet. Standard cards have equal available widths, compact summaries retain complete timing, and enlarged text has a readable two-line fallback. Tennis tournament names and both doubles partners remain recognisable.
- Events summaries defer editorial and schedules to full detail and share the separate Maximise/Collapse control. Events still has no rating inputs or calendar selection.
- Follow retains its sport track between section updates, starts directories at 40 entries, and retains the loaded batch and browsing state on Back. Account restore does not overwrite local browsing position or Compact mode.
- NSC uses a full-screen route and one Back path. Viewer-scoped permitted ranking responses are cached briefly and in-flight reads reused. Account changes invalidate cached responses. Scoring, sealed predictions and server privacy rules are unchanged.
- Quick refresh rebuilds affected projections. The actual tennis-only Schedule build retained 25 unrelated output files byte-for-byte. Both refresh schedules remain in place.

## Browser acceptance

The new `validate-ux-recovery-*` scripts use published fixture data. The main journey does not substitute synthetic fixtures or bypass the eligibility resolver.

| Check | Result |
|---|---|
| Saved AFL/NRL + tennis collection, cold load / Follow / reload | Same 28 eligible fixtures |
| Requests held, then failed | Cached Feed usable before completion; fixtures retained |
| Refresh after loading another page | Loaded fixtures and pagination retained |
| Follow directory | 40 initial entries; 80 after Show more; sport track retained |
| Schedule Back | Sport, category, page, batch and scroll restored; Feed unchanged |
| Phone 325/390px, tablet 768px, desktop 1280px; 100%/150% text | Published football, tennis, motorsport and Event-derived cards fit; times visible; one identity |
| Local card pointer cycles | L0/L1/L2, visible state sampled on animation frames; no anchor movement |
| 100 spaced Compact/Expand clicks | No mixed levels; acknowledgement within 100ms |
| Delayed real identity asset, public NSC response, minute/resume updates | Anchor movement within 2px |
| Calendar | Real ICS download; select/unselect all across 30 pages; absent from Events |
| NSC | Full-screen; delayed public rankings; one request across detail/Back; Feed position restored |
| Installed Chromium PWA | Actual v241 and v242 releases upgraded on first navigation; route retained |

One local run observed card transitions in 17–33ms, maximum toggle acknowledgement of 44ms, and 0px anchor movement. Measurements record a changed visual state by the second animation frame, not just handler duration. They are not physical-display or iPhone measurements.

## Live audit follow-up

The first production audit caught an intermittent 261ms toggle acknowledgement. A controlled reproduction with actual published page arrivals reached 393ms. Page reconciliation rebuilt all tournament children, constructed duplicate locale formatters and rebuilt participant lookup maps per fixture. The correction reuses the formatter and per-pass participant indexes, reconciles each page catalogue once, and prevents layout-generated scrollend from flushing background work before input paints. All 702 published child fixture projections remain exactly equal to the preceding implementation. The 100-interaction test now includes three real page arrivals; the final local audit passed at 46ms maximum and 0px anchor movement (card changes 21–31ms).

My NSC now loads the restored account independently of opening a rated Feed card, updates only its account section and uses the header Back path. Its controlled-account journey makes no production writes.

## Repository checks

Passed `verify-nothingsport`, mobile reliability, NSC client transaction/restore tests, crowd/foresight, calendar API and timeline, follow resolver/surfacing, coverage resilience, Feed controls/data, quick cadence and projection scope, loading progress, generated runtime consistency, startup budget, update-cards mode validation, and `git diff --check`.

Coverage validation used the unchanged published catalogue: 3,710 union candidates, 229 fixtures/Events in the September 6–17 regression window, and 695 released US Open fixtures.

## Limits

Physical iPhone PWA performance and Apple/Google Calendar application behaviour were not verified. Account restoration was exercised with isolated test preferences; calendar owner controls and NSC scoring/privacy were tested using their existing controlled server test suites. No ratings or subscriptions were written to production.

The full canonical refresh stopped before ingestion because its all-user follow snapshot was unavailable. Automatic approval review separately rejected access to all users' private follow preferences as beyond this UX task. No workaround was used. This release preserves and validates the existing published data; it does not claim a fresh canonical refresh.
