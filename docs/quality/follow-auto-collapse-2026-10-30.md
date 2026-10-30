# Follow automatic-collapse anchor correction

ROOT's diagnostic I run `41008854825` executed head
`4d5571126e8377a2a1ad53b75771eea1b6b49430`, tested merge
`7927c0d5b476403df0814d8e9dba3d7260a6414a`, tree
`d8fc83ac78bbb66b7bd1351e640f500332f24420`. Its WebKit 320/day writer sequence
contains nine records with no overflow or recorder error. One original 350-unit
wheel was issued at (6,284); delivery/trust/default-prevention fields were
unobserved in this diagnostic. The document moved 20 -> 68 -> 165. At automatic
menu collapse, the panel top changed 364.046875 -> 239 and the navigation owner
called scrollBy(0,-125.046875). The recorded document position immediately
changed 165 -> 39 and settled there. The continuity lease stopped later; no
other writer appears in these nine records. ROOT verified all four artifact ZIP
digests and extracted hashes. Actual failure JSON:

`/Users/jackhartican/Documents/AI/Codex/nothingsport-allsports-release-604-20261030/I-workflow-order/native/installed-artifacts/installed-upgrade-4d5571126e8377a2a1ad53b75771eea1b6b49430-webkit/follow-controls/follow-scroll-sequence-webkit-320-day-failure.json`

The strict original >100 scroll assertion failed after 15 seconds. The later
navigation/Players assertion was not reached. The child exited 1 after 16.8826
seconds with natural empty-group cleanup, no signals and unchanged source.
The diagnostic remains nonqualifying. Both All Sports UI jobs and Chromium
installed checks passed. Both 23-case account sets, WebKit readiness control
and Feed checks passed in I; the earlier H/C failures remain unresolved evidence.
H's actual critical gzip result remains RED and is not a release baseline.

## Source feedback loop

`node scripts/validate-follow-auto-collapse.js` loads the actual unmodified
navigation module into disposable JSDOM, mounts it, opens the real menu, and
dispatches the recorded 20/68/165 scroll sequence through its actual listener.
Only scroll positions, clock and the recorded panel geometry are controlled;
the setter and its caller are not copied or modeled. The original source
produced scrollY39.953125 instead of 165, with the exact -125.046875 correction.
This fractional arithmetic reproduces the measured source displacement;
WebKit's observed integer39 is not a claim about JSDOM rounding. Two executions
were RED before the repair. An isolated checkbox-focus case drives the same
real listener with just the final165 event and independently detects the write.

Ranked hypotheses were: (1) automatic collapse's own compensating write produces
the backwards displacement; removing it only for that caller should retain165;
(2) a redraw/continuity writer also moves the page, which would require an
additional write at the failure boundary; (3) engine momentum interruption
affects the remaining gesture, which cannot be established by this source loop.
The actual trace and replay establish (1)'s displacement, not (3)'s mechanism
and not every earlier default-CSS failure. No new instrumentation was added.

## Narrow repair

The existing setter and collapse API now accept an optional preserveAnchor
boolean, default true. Only the existing passive scroll listener calls
collapse(false). Explicit toggle clicks, mounting, explicit collapse calls
and selection/redraw paths keep their existing default anchor behavior. The
native auto-collapse path changes menu state and accessible labels without
scrollBy, including a zero-delta write. There are no added listeners, observers,
frames, timers, CSS changes, gesture changes or scroll-to-target workarounds.
All existing direction, distance, position, focus, dialog and timing guards are
unchanged. The selected sport checkbox remains outside the collapsible controls.

The regression is now GREEN and joins validate-follow-decisions.js. Its mounted
cases also retain explicit close/reopen compensation, the public collapse API,
focused input/select/textarea exclusion, focused checkbox visibility/focus,
open-dialog exclusion and direction/distance/position/time guards. Existing
sport-save/refusal/gender/privacy controls and measured inset lifecycle remain
in that gate. The existing continuity lease source is untouched.

Independent review found that initial source commit
`0ff0de58548165ac8d6d0cb98553bbc8907b09f9` also skipped the original automatic
collapse lock assignment. That commit and its earlier RED/GREEN evidence remain
historical. The corrected setter keeps the original `before!=null` condition
and `lockedUntil=performance.now()+150` assignment; only scrollBy is conditional
on preserveAnchor. It adds no lock when the panel is missing, and an open dialog
still returns before either assignment or scroll correction.

Three additional lexical unit controls execute the exact setter declaration
from navigation source with its real DOM nodes and a controlled clock. The
automatic path was RED on0ff (lock71 instead of1400 at now1250), then GREEN
after correction. Missing-panel and dialog paths retain71, and no case writes
scroll. This seam exposes the existing private variable only in a test VM;
there is no production hook/export and no copy of the setter or timer logic.
It proves assignment conditions in the real setter, not public observation of
the mounted closure's private clock or actual browser timing. The nine mounted
controls remain, for12 source controls in total. Native acceptance is unchanged.

## Remaining acceptance

Source preparation starts from source14b, without H/I temporary probe hooks or
diagnostic CSS. The normal runtime is rebuilt/compared with the existing builder;
all compressed-byte and startup-cache limits remain unchanged. Source checks
are recorded separately in the handover, including any failures.

This proves the competing source write was removed for automatic collapse. It
does not prove trusted native momentum continues, real layout remains usable,
Players becomes tappable, or the original eight browser cases pass. ROOT's next
bounded comparison should change only this navigation source on a normal
candidate, with the original Follow journey, original default CSS, gesture,
threshold, waits, timeout, directory gate and cleanup unchanged. No extra input
or observer is needed. Preserve all previous REDs. If the original journey still
fails, return its concrete boundary for diagnosis; do not claim a scroll fix or
retry unchanged. ROOT owns composition, version/baseline bookkeeping, native
allocation, all normal account/performance/release checks and publication.

No provider, source facts/clocks, fixture identity, account, gender, consent,
Follow save, notification, database, sync or physical-device behavior is changed
or accepted by this source proof. Automatic sync remains parked by human choice.
