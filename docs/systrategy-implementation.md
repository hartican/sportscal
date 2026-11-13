# sySTRATEGY — 13 November 2026

Prepared implementation; production release and irreversible cleanup remain gated.

## Product contract

YURTERS replaces the person leaderboard. Accounts start on Following; guests start
on Find Yurters. Public profiles sort by case-folded name, handle and profile ID,
with name/handle search and 25-person pages. Selected follow copying remains
additive, protects exclusions and uses the existing preference/event-state CAS.
Hidden and moderated profiles remain outside discovery and preview. Editing a
hidden profile preserves its visibility.

Chat, public conversation content/media, hearts, points/rewards/person rankings,
and thumbs/swipe/Fine Tune learning retire. Genuine Anticipation/Ongoing/Impact
ratings, curator weighting, Watching Now/check-ins, explicit follows, dismissals,
saved fixtures, reminders and optional friend-rating/follow/copy alerts remain.
The annual review is named for its selected year, such as **2026 Classics**;
eligibility remains personal saved 5/5 Classics. Private notes/captions remain.

## Interfaces and compatibility

- `GET /api/nothingscore?people=1` accepts `audience=following|all`, `search` and
  an offset `cursor`; returns `yurters.v1` identity/follow entries and `nextCursor`.
  Its service-only RPC reads profiles/follows without scoring aggregation.
- Retained rating, Watching Now, follow and copy commands keep their account,
  phase, moderation and concurrency checks. Compatibility award fields are zero.
- Chat and anonymous-chat session endpoints return 410. Hearts and person
  leaderboard/reward reads retire. Old settlement calls become harmless no-ops
  so an older live-refresh owner can continue through the cutover.
- Existing social links open YURTERS; handle sharing reads the owner profile.
  Retired local chat drafts/capabilities are cleared on current-shell startup.
- One shared feedback projection removes only named retired fields. Unknown
  fields, explicit choices and original pending receipts remain protected; the
  existing matching-ACK mechanism clears or carries owned intent.

## Migration and irreversible cleanup

Apply `20261113082047_systrategy_retire_social_extras.sql` through the existing
publisher after reviewing fresh owning definitions. It installs the point-free
rating/follow/copy and directory functions, retains rating/classic/history
triggers, decouples friend activity, removes consensus capture and chat
maintenance, blocks retired writers, and filters retired inbox entries.
It does **not** purge historical customer content.

`lib/systrategy-retirement.js` supplies the one-off purge with injected production,
Storage and privileged SQL adapters. It requires the exact READY deployment/SHA
and alias, the recovery database project `mkghopnkhcxtmfrcjdbc`, every named
acceptance check, verified issuer shutdown, expired upload capabilities and
separate in-flight-transfer reconciliation. Expiry alone is insufficient.

Storage files are removed and swept before relational ownership metadata. The
SQL transaction deletes the explicit chat/reward/archive allowlist, removes
retired inbox entries and known feedback fields, and verifies zero retired rows.
No content export or recovery archive is created. Empty, write-revoked
compatibility tables and immutable historical migrations remain to preserve the
reviewed account-erasure inventory. Accounts, avatars, follows, rating history,
Classics and unrelated notification records are retained.

## Verification and release status

Focused SQL/retirement tests and browser tests pass, including all three rating
phases, point-free friend activity, follow-copy CAS, directory privacy/order,
pending-intent cleanup, purge refusal/order/idempotency, guest/account navigation,
four widths and both themes. Ratings recovery, Classics, notifications, dismissal,
backend efficiency, preference bookkeeping and 75 account-isolation scenarios
also pass locally. These are automated source tests, not hosted/device acceptance.

Workspace critical startup assets fell from 449,738 to 417,923 gzip bytes on
Node v25.9.0, with the same seven critical files: 31,815 compressed bytes and
140,531 raw bytes removed. Shared avatar and push dependencies remain required.

Required release blockers remain:

1. The unchanged performance policy expects 426,115 gzip bytes for its recorded
   baseline; the reference measures 425,600 in this environment, so its integrity
   check refuses the measurement.
2. Installed Chromium passes initial activation and offline recovery but times
   out during resumed upgrade. Its validator and timeout remain in force.

No live migration, deployment or customer-data purge has been performed. The
current-main adoption candidate keeps the separately owned branding work out of
its patch. Publication, hosted acceptance and physical-device acceptance must be
recorded separately before the purge can run.
