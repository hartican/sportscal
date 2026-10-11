# Major horse races and racing tables — 11 October 2026

The approved programme uses the existing live refresh owner and score store.
Bathurst was published and verified at main `00395eeb00ef2ca05c56e71579549f3c7846b697`,
normal production workflow 38104849715, READY deployment
`dpl_9PcMBeunHno7cVX3wioHShGHTSHK`. Two ordinary source leases at 02:26 and
02:30 UTC scheduled the next check four minutes later with zero failures.
Public complete 26-car snapshots subsequently advanced to 02:34 UTC. Actual
hosted Chromium/WebKit expansion agrees with the selected score endpoint;
this is separate from the controlled parser and continuity replays.
The existing two-minute live cron and daily maintenance cron are unchanged.

## Horse catalogue and maintenance

Twelve authorised feature races are reviewed against organiser publications.
Nine have a published date and their own fixture card. Doncaster Mile,
Queen Elizabeth Stakes and Stradbroke Handicap remain edition-date pending
in Events; no date, clock or reminder is invented. Carnival expansion groups
only authorised feature races. Supporting races are outside this catalogue.

Melbourne Cup is 3 November 2026. Its complete 71-horse Racing Australia
weights roster matches every entry in the organiser's first-acceptance PDF,
published 29 September. The card labels that collection First acceptances /
published weights and links both sources. It is not a final field. The reviewed
acceptance stage applies only when the complete stable horse roster agrees;
a changed/incomplete roster cannot inherit the label. Other available fields
include 34 Caulfield Cup nominations and 23 Cox Plate nominations. Unpublished
jockeys, barriers, form, starts and future fields stay blank or explicitly
unavailable. The Cox Plate venue follows the published 2026 Flemington guide.

`update-cards.js` owns advance maintenance, including its scoped
`--horse-fields-only` route. It uses two bounded collectors and preserves the
last complete field if a source is absent or supplies an older stage.
Racing Australia starts come only from explicit race-header clocks. Live
scratchings/results use the existing owner from an hour before a confirmed
start: one shared horse source, at most two due races per pass, four seconds
per collection and a four-minute active source minimum. Unresolved results
later use the existing quiet cadence; an explicit official result or
cancellation stops checks. Advance entry lists without a confirmed start
cannot establish live or activate near-start source polling. Advance field
stages keep their dated receipt without a false eight-minute missed-live-check
warning; near-start fields and explicit failure flags still show the warning.

## Shared racing presentation and source limits

Feed and Match Centre reuse lazy tables with stable entry identities and
contained horizontal scrolling. Compact membership omits full racing rows;
selected `details=racing` reads use the existing endpoint and shared database.
Results OFF suppresses fields and classifications. Existing Follow admission,
exclusions, choices, notifications and reminder ownership remain unchanged.

Verified 2026 F1 classifications require the complete 22-entry official field,
unique car numbers, a bound circuit/event/session, nonempty driver/car identities, valid check time and an
appropriate completed status. A different source, incomplete field or live
status falls back to verified session detail and the official timing link.
The official F1 public live page has not passed actual-session validation;
no embedded F1 live source is enabled. OpenF1 paid live is excluded.
Other Supercars, MotoGP and WRC sessions use the same official-link fallback
where a complete free tower has not been validated. WRC's existing verified
winner/elapsed result remains available; no unsourced stage table is invented.

Bathurst unknown current-driver code zero leaves that cell blank while keeping
both entered drivers. Nonzero unknown identities still reject the snapshot.
Table column changes from an unavailable view to a sourced classification
update the header and cells together. Row patches retain focus/scroll for a
stable schema. Explicit red flags keep their label; stale running snapshots
say Awaiting update after eight minutes. A chequered flag is provisional.

## Acceptance and evidence

Captured source comparisons and controlled tests cover complete fields,
identities, driver changes, lap deficits, pauses, incomplete messages, horse
stages, scratchings, corrections, changed published starts, cancellation and
older-stage rejection. Chromium and WebKit at 390 and 1280 pixels check full
Feed/Match Centre fields, carnival routes, pending dates, fallback links,
Results OFF, stable rows and no browser requests to providers. Cached upgrade
and offline checks must pass for the exact final bytes. The startup limits,
two workers, 45-second owner deadline and backoff are retained.

Ordinary Bathurst cadence is proven separately. Horse near-start refresh and
F1 source boundaries have controlled coverage; no real horse-day cron or
embedded F1 live success is claimed. Physical iPhone behaviour is unmeasured.
The coverage quality contract explicitly records the partial horse catalogue
as unverified; adding cards does not certify whole-sport coverage.

Final publication, immutable READY/alias/served-byte proof and hosted horse
rendering are recorded in the coordinated release report:
`/Users/jackhartican/Documents/AI/Codex/racing-coverage-2026-10-11/release-review.md`.
