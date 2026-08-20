# Cincinnati parser fixtures

These files exercise the static Cincinnati order-of-play parser without claiming to be live tournament data.

- `official-order-of-play-page.html`, `official-tournament-schedule-page.html` and `official-draws-page.html` represent the three official PDF-discovery pages. Public Rain JSON and WordPress reporting are exercised with compact validator fixtures rather than saved live payloads.
- `order-of-play-2026-08-14.pdf` is a deliberately simple, synthetic PDF with representative ATP/WTA rows, courts and timing types. It is test input only.
- `order-of-play-table-extract-2026-08-14.txt` mirrors the multi-court row layout used by official order-of-play PDFs, including tour suffixes and bare country codes. It is also test input only.
- `order-of-play-column-block-extract-2026-08-14.txt` mirrors the accessible column-by-column text order emitted by newer Chrome-generated official PDFs. It is test input only.
- Schedule truth still comes only from documents discovered through the three live Cincinnati publisher pages. Separate build-time reporting adapters may scrape the public Cincinnati Results/Scores/Recap pages, WTA's year-pinned tournament page and ESPN's year-pinned men's and women's scoreboards.
- First-party reporting is marked verified. ESPN and other surrounding reporting is marked `Unverified source`; it may fill a missing result or add a highlight/commentary link, but cannot overwrite conflicting verified schedule, timing or result facts.
- The reporting adapters do not bypass authentication, paywalls, CAPTCHAs or other technical access controls. A failed public reporting source is non-fatal and never weakens the official schedule fallback.
- The committed canonical document stays in the safe overview fallback until a successful official-page refresh replaces it.
- Fixture mode requires `--print`; it cannot overwrite the canonical document.
