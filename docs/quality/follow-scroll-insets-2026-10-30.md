# Follow native scroll insets

Version 602 candidate `4ecb47c323c49eacbf137bbd5c4e33e6153225c8`, source
`b1f8ecbf37fa00ba3f1a125a0b6a9dcc212c29db`, failed the unchanged Follow browser
journey at its native Players tap. The first run passed Chromium 320 day and
failed the next case. Its night/women attribution was inferred from serial order.
One separately allocated failure-only capture then failed in the actual first
Chromium 320 day/men case, disproving a night-only classification.

At 320×568 and scrollY522, Players occupied y0.234–44.234. The sticky home tabs
occupied y0–53 and intercepted all three sampled hit stacks. The collapsed
navigation still correctly occupied y58–251, including the persistent selected
sport checkbox, gender and section controls. Bottom navigation occupied
y490–568. There was usable space from y251–490; the failure was content scrolled
behind pinned controls. Root scroll padding was auto and Players scroll margins
were zero. The screenshot and original actionability log agree with this final
occlusion. They do not establish every preceding scroll transition.

ROOT retained the complete diagnostic under
`/Users/jackhartican/Documents/AI/Codex/nothingsport-allsports-release-602-20261030/follow-overlap-diagnostic-4ec/run-root-4ec-follow-overlap-20261030-1/`.
The capture completed in 16.17 seconds, exit1, with natural process cleanup,
no remaining group members, no capture error and unchanged source. Its packet
manifest is `3a19bd6951c79b308de3e807825f4601e8131689fafe999c10677293899f1edc`.
The original failure and this observation remain separate retained RED evidence.

The existing navigation owner now measures its mounted height and observes
changes. The document uses that height, the existing 58px Follow home-tab offset,
the existing dynamic shell-header height and bottom navigation space as native
scroll padding, with 8px clearance. The CSS selector requires the current Follow
navigation, so other routes do not receive that padding. Redraw disconnects the
old observer; queued callbacks and disconnected nodes cannot overwrite the new
mount. No menu is hidden to make a tap pass, and the test journey is unchanged.

`scripts/validate-follow-scroll-insets.js` mounts the actual owner in disposable
JSDOM with controlled navigation measurements. It was RED on source b1 at the
missing initial reservation, then GREEN after the change. It verifies initial
mount, resizing/wrapping, real menu open/collapse, retained checkbox visibility,
redraw, stale callback fencing, detach and CSS route scoping. It joins the existing
Follow decision gate. These are source-owner and CSS-wiring controls; JSDOM does
not prove browser layout, hit testing or touch behavior.

Native confirmation stays in ROOT's single lane: assemble a new frozen candidate
with its version 602/baseline601 bookkeeping, then run the original eight-case
Follow journey on Chromium/WebKit, 320/390, day/night. Preserve all original
tap/keyboard actions, 15-second action timeout, directory gate, redraw, waits,
assertions, API/network denial, service-worker block and natural cleanup. Do not
force taps, insert test scrolling or weaken visibility. A native GREEN must mean
all eight case receipts and the original assertions passed. A failure is retained
and returns to diagnosis without an unchanged retry. ROOT owns other affected
release gates, supported CI, publication and any hosted/device acceptance.

The prior e30/WebKit hidden-Tennis failure remains cause UNRESOLVED. This is a
different observed failure; a later pass is not a retrospective explanation.
Source version stays 601. API, data, source clocks, account, sync, notification,
provider, scheduler and physical-device behavior are outside this source repair.
