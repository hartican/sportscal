# Broadcaster schedule inputs

This directory contains sanitised, source-linked schedule snapshots for Phase 3 coverage discovery. Each file must satisfy `broadcaster-schedule-export.v1` and use one of three approved modes:

- `licensed_api`: an agreement permits automated retrieval, storage, transformation and display.
- `reviewed_export`: an operator reviewed a public or supplied schedule and recorded only the factual fields required for matching.
- `manual_fixture`: an authorised competition owner or broadcaster supplied an event-specific fact.

Consumer pages must not be scraped unless their owner has given written permission. Credentials, cookies, player URLs and DRM information never belong here. `node scripts/scan-broadcaster-coverage.js` runs every configured adapter, reports missing inputs for the eight priority Australian sources, and fails closed on invalid or stale snapshots.

The canonical fixture source remains authoritative for event identity and timing. A broadcaster snapshot contributes availability evidence and catalogue-discovery candidates only.

Licensed providers use the same file contract with `sourceMode: "licensed_api"`; no source-specific payload may bypass normalization. The current commercial shortlist and procurement test are in `data/coverage/latest.md` and `docs/research/nothingsport-phase-3-broadcaster-source-research.md`.
