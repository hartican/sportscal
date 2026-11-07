# Rugby Schedule discovery — 12 October 2026

The current app opens Rugby Schedule with 468 cards across just three headings. The “League” heading contains 466 matches. That makes the calendar difficult to scan and creates unnecessary page content before the person chooses a competition or date.

This is a navigation and grouping problem. The published Rugby collection contains 780 records, including the six reviewed Nations Championship placement matches. It is not evidence that those fixtures are missing from the source collection.

## Verified current behaviour

| Check | Result | Limits |
| --- | --- | --- |
| Chromium and WebKit, 390-pixel width | Actual anonymous Follow → Rugby → Schedule opens League, Match 3 and Match 4; 468 cards | Desktop browser engines at a mobile width, not a physical phone |
| WebKit group inventory | League: 466 cards; Match 3: one; Match 4: one | Current public shell 512, dated observation |
| Earlier/Later navigation | Nineteen native button actions reach calendar window 0–59 and expose two reviewed Nations placement matches | Deliberately bounded; remaining groups were not exhausted, so no absence claim for the other four |
| Source collection | 780 Rugby records; six reviewed placement IDs retain Sydney dates 28–30 November | Internal published-data evidence, not a new organiser reconciliation |
| Retained source labels | 516 records use the generic round label League across eight named competitions, including women's competitions | Whole retained corpus; the default men's view filters it further |
| Error and write checks | No page errors, attempted account writes or document overflow | Ratings receipt, actual usability time and physical performance not proven |

The live rendering matches the code boundary: general round grouping uses the round label as its group identity. A generic “League” label combines fixtures from different competitions and dates. Rugby's fallback date headings also pass through the round-label comparator; their displayed weekday/month text is not a reliable chronological key. These code paths require a focused regression before editing.

## Recommended next module

Repair Rugby's calendar grouping using existing competition/edition identity and actual source dates. Keep a genuine source round when it exists; a generic League stage must not collect an entire season into one screen. Sort with source calendar values. Provide recognisable competition/date headings and a small initial window while retaining access to the whole published collection.

Preserve fixture IDs, participant uncertainty, source observation dates, saved actions, Results and Remind choices. Do not create rounds, fixtures, clocks, qualifiers or outcomes from dates. Reuse the existing deferred Schedule owner and canonical data. Begin with Rugby; extend the grouping to other sports only after showing the same defect and preserving their specific round rules.

| Recommendation | Business value and evidence | Effort, cost and dependencies | Acceptance and why to act |
| --- | --- | --- | --- |
| Repair Rugby grouping after the current passing card release | Less scrolling and fewer choices to interpret; both engines show the large initial bucket | Estimated 1–3 working days including genuine browser/cache/release proof; existing Schedule and decision records; no new service/subscription or owner decision. Existing assistant/runner/hosting costs unpriced | Source-backed competition/date groups, bounded useful initial cards, chronological Earlier/Later, all six reviewed finals reachable, unchanged IDs/settings and exact live rendering |
| Diagnose ratings and parent-date wording separately | Protect trust without mistaking an initial/transient state for a permanent failure | Bounded native Major Events → Events → Schedule check; source/calendar evidence already saved | Verify actual settled rating controls and parent date qualification before a patch; this pass does not close those questions |

## Evidence

`rugby-discovery-inventory.cjs/.json/.log` and `rugby-webkit-initial.cjs/.json/.log` contain the two actual read-only journeys. Disposable local preferences keep reminders off, block account writes and use the genuine public application. Service workers are blocked. No new sports source check, scheduler, deployment or physical-device test was performed.

This finding is verified; the repair is not implemented. It does not certify the entire sport or require a new owner task.
