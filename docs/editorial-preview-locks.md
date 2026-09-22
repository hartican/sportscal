# Approved fixture preview locks — 22 September 2026

The owner-approved Dockers–Lions preview is recorded verbatim in `config/editorial-locks.js`, with canonical identity `event:afl:cd_m20260142901`, its source aliases, approval date and completion-based release condition. The shared module is consumed by generation, server enrichment and browser display. It protects both collapsed and expanded copy, including stale cached projections, and prevents consequence text being appended.

The lock remains active for upcoming, live and postponed fixtures. Only explicit source completion (`completed`, `finished` or `final`) releases it. Elapsed time, estimated finishing windows and browser-derived `past` status never release it. Postponement/cancellation takes precedence over conflicting completion. Scores, fixture facts and existing spoiler controls continue independently. After confirmed completion, normal result-aware editorial and spoiler handling resume.

The existing research queue assigns owner-approved five-star editorial priority, deferring review until confirmed completion. This is not a crowd rating, user vote, Feed sorting rule or new scheduler. Weekend editorial excludes an active lock; full generation and enrichment reapply the approved text. The source-depth generator no longer reinstates unresolved preliminary-final-survivor copy.

Feed cards retain internal marquee classification and emphasis but show no Marquee label. One stage label follows the timing/status badge in the header of full and compact cards. It wraps only when needed, uses accessible blue in both themes, and replaces duplicate central/supporting stage text. Distinct sporting-format labels remain.

Validation: `validate-editorial-locks.js --published` covers aliases, repeated projections, server enrichment, lock statuses, completion, spoilers and queue integrity. `validate-editorial-locks-browser.js` checks stale browser content and full/compact layout at 320, 390, 768 and 1280px in both themes. Canonical regeneration remains `node scripts/update-cards.js`.

## Local verification and release blocker

On 22 September 2026, published-copy/alias/server/queue tests, both-theme responsive checks, timing, card identities, Follow parity, scroll continuity, UI foundation and startup precache checks passed. The canonical pipeline was resumed through the editorial regeneration and downstream Follow/feed validation stages with a real anonymised Follow snapshot; its temporary snapshot was removed after use.

Release is blocked by `validate-feed-performance.js`: critical gzip bytes are 434,297 against the gate's 425,600-byte baseline (2.04% growth; limit 1.25%). Unchanged parent `7a2b793` is already 433,031 bytes (1.75%). This change adds 1,266 bytes. The budget has not been raised or bypassed. GitHub main publication, production deployment and live production verification remain pending.

The owner subsequently authorised a one-release exception to the compressed-byte gate on 22 September 2026. AGENTS.md records the exception and remediation during 28 September–4 October. The validator and threshold remain unchanged; downstream checks and production safety gates remain required.
