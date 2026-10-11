# Bathurst timing tower pilot

The 11 October approved racing programme starts with the existing Bathurst
source. One anonymous Natsoft snapshot delivered all 26 cars in about 300 ms;
the full timetable-plus-tower adapter completed in 674 ms. Meeting title,
SG3 class, R17 Race30 session, all distinct car entries and ordered positions
are validated together. Both drivers and the explicitly selected current
driver survive. Sector zero placeholders stay blank. No provider script is
executed. One connection closes immediately on completion or after four
seconds; no retry, permanent connection or browser provider read is added.

The existing two-minute owner leases this source at a four-minute minimum.
The score object carries optional racing detail in the existing compact JSON
store. Provider and collection clocks remain independent. Natsoft's observed
numeric clock has no declared timezone, so it is retained raw rather than
mislabelled UTC. Last complete detail survives failure; eight-minute-old
running detail says Awaiting update. Explicit red flags retain their label;
a chequered flag supplies provisional classification, not an official result.

Feed and Match Centre reuse a lazy full-field table. Membership omits its
entries; selected `details=racing` uses the existing bounded score read.
Stable car rows retain expansion and horizontal scroll. Results OFF hides
the table. Follow admission and the reminder owner are unchanged.

Validation: `validate-racing-details.js` compares the actual 26-car receipt,
driver changes, lap deficits, unavailable values, wrong identity, incomplete
orders, pauses, provisional completion, score persistence, selected/list API
and the four-second failure boundary. Chromium and WebKit at 390 and 1280
pixels pass full-field Feed/Match Centre parity and refresh continuity with
zero provider requests from the browser. These are controlled source replays.
Ordinary production scheduler and exact deployment proof are recorded
separately in the release report; they are not inferred from local tests.

Evidence: `/Users/jackhartican/Documents/AI/Codex/racing-coverage-2026-10-11/`.
Source clock interpretation, unsupported explicit retirement labels and
physical-device performance remain unverified; unavailable values stay blank.
