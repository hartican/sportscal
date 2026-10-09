# Faster match-list opening — 9 October 2026

The proposed change reduces the work needed to open Everything and places its server beside the existing Sydney database. It preserves current matches, corrected schedules, uncertain information and original source update times. Full future schedules remain available to other views. No purchase, source refresh, extra polling, retry or owner routine is added.

## Evidence before publication

- A fresh public read returned twenty-four matches in 5.856 seconds. Its server ran in the United States, while the database is in Sydney. Cold state and network were not controlled.
- The original global bundle contained 2,137 rows. A count-only read took 1,844 ms; a separate byte-count query exceeded the existing 2.5-second SQL budget.
- The first scoped helper also exceeded that budget. It was applied but remains unused by the live application; its failed check is retained. Removing receipt extraction alone still took 1,584 ms.
- Checking safely distant upcoming clocks before the repeated date checks reduced the candidate step to 308 ms. The complete prototype took 514 ms. The corrected applied helper then returned 878 rows, 2,112,193 serialized JSON bytes in 557 ms, within the unchanged budget. No previously displayed, still-stored identity was omitted. These are dated SQL measurements, not cold-phone or cash-saving claims.
- Actual local database, store and handler checks retain current membership, new live arrivals, future reschedule corrections, independent fact/check times, zero scores, pause/final states, uncertain clocks, milliseconds and offsets, aliases, team rubbers, full future schedules, explicit incomplete results and denied anonymous/authenticated access.
- The same two parallel database calls, three-second transport deadline, thirty-second server cache and selected-score fallback remain. Cache entries separate the near scope and protected IDs from other reads. Only the existing Feed function, which also owns the Match Centre rewrite, is configured for Sydney.

## Release acceptance

Publication and production verification are pending. The normal release must pass without changing its gates. Verify READY state, exact snapshot, aliases and served artifacts; verify actual Sydney execution and fresh public membership/selected-score behaviour separately. The browser shell and sporting data are unchanged. Controlled browser tests remain separate from real-phone proof.

The initial twenty-minute investigation allowance was exceeded; a failed real database gate required further diagnosis. Initial failed checks and setup errors are retained. No source or customer data was changed by this investigation. All sixteen sport families and all three Football pilots still have open certification requirements.

Detailed evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/match-opening-diagnosis-20261009`.
