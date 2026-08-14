# Cincinnati parser fixtures

These files exercise the static Cincinnati order-of-play parser without claiming to be live tournament data.

- `official-order-of-play-page.html`, `official-tournament-schedule-page.html` and `official-draws-page.html` represent the three approved Cincinnati publisher pages.
- `order-of-play-2026-08-14.pdf` is a deliberately simple, synthetic PDF with representative ATP/WTA rows, courts and timing types. It is test input only.
- `order-of-play-table-extract-2026-08-14.txt` mirrors the multi-court row layout used by official order-of-play PDFs, including tour suffixes and bare country codes. It is also test input only.
- `order-of-play-column-block-extract-2026-08-14.txt` mirrors the accessible column-by-column text order emitted by newer Chrome-generated official PDFs. It is test input only.
- The refresh code may discover automatic documents only through the three live publisher-page URLs. It does not call ATP, WTA, Rain or undocumented score endpoints.
- The committed canonical document stays in the safe overview fallback until a successful official-page refresh replaces it.
- Fixture mode requires `--print`; it cannot overwrite the canonical document.
