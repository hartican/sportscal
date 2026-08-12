# Coverage discovery outputs

`latest.json`, `latest.md` and `latest.html` are deterministic views of the latest reviewed or licensed broadcaster inputs against the canonical event catalogue. They are regenerated only through `node scripts/update-cards.js` or explicitly with `node scripts/scan-broadcaster-coverage.js`.

The report is an editorial queue, not a second event feed. `new` and `ambiguous` candidates always remain under review. Only an exact existing-event match with at least 0.92 confidence, an unambiguous Australian service, a known access type and no blockers can receive a `publish` decision.

Use `node scripts/review-coverage-candidates.js --list` to inspect the queue, edit `review-decisions.json`, then run `node scripts/review-coverage-candidates.js --apply`. The decision file is intentionally versioned and human-readable; its approved output is consumed by the sole canonical `node scripts/update-cards.js` path.

An approved exact match adds normalized availability without changing canonical fixture identity or time. Publishing a new candidate additionally requires a fully reviewed `canonicalEvent` backed by an official HTTPS fixture source, an authoritative UTC start, complete card fields, and sport → discipline → competition taxonomy resolution. The broadcaster listing alone can never create a live card.
