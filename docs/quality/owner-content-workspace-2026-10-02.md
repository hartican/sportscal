# Owner content workspace

The former provider-specific handoff workspace is now one autosaving content editor. Content is primary; Media, Live and History are disclosure sections. Copy/download controls freeze a revision but never lock editing. Team logos come first. Animation is automatic: real pre-match mean >4.8 is Energy, otherwise Subtle; reduced motion disables both photo and fallback animation. Focal controls are disabled for text/logo compositions and support zero when a photo is selected.

Posting order remains proposed-post ascending, pending last. Two tasks per eligible fixture/event: preview at 72h and day-of at 9am Sydney (or 2h before an early start). A missed preview at first discovery merges into day-of. Existing operator text, especially Bledisloe, remains protected when source facts change. Copy uses current published editorial hook/form/context/storyline as flowing paragraphs plus the participation invitation. No automatic social or email publishing is introduced.

The approved media library keeps immutable first-party compositions or admin-supplied approved images; no external image scraping occurs. Code marks use local/open-use sport assets. Team references retain the existing identity registry's rights/provenance. Copyright permission for a new promotional photo is an operator responsibility.

## Verification scope

Pure model/database regression covers Sydney DST, early starts, estimates, missed slots, deterministic copy, eligibility, raw rating thresholds, edited prose, history, sync/task compare-and-set, permission-denied table/RPC access and deduplicated reminders. It uses isolated PGlite, not production accounts. Existing notification-send/erasure tests cover transport admission boundaries.

The additive migration was applied to `nothingSport-recovery`. A rolled-back live transaction verified create/idempotency, task CAS and immutable history; direct anonymous RPC execution and authenticated table reads are denied. The owner account's current server-owned role is admin. Refresh regression additionally checks stale image rejection after community stakes change and preservation of delivery-linked/shared historical media.

Security/performance advisors introduced no new warning. The private comms tables deliberately have RLS with no direct browser policy; newly created indexes are naturally reported as unused. Existing anonymous-policy and leaked-password-protection warnings remain outside this release ([policy advisor](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Chromium and WebKit fixture-browser tests cover 390px and 1280px, sign-in presentation, collapsed/single-open rows, deep links, selection without autosave, body autosave, focal zero, fallback animation/reduced-motion and no horizontal overflow. The browser client is synthetic; genuine account login, iOS Home Screen installation/worker activation and physical system push delivery are separate acceptance steps.

Owner: open `/admin/comms`, sign in with the protected admin account, add the page to Home Screen in Safari, open the installed Owner app, and tap Enable post reminders. Alerts are opt-in for the current device, 30m before and when due, checked by the existing five-minute dispatcher. Mark posted stops outstanding task alerts; Snooze delays the due task by one hour. Use Publish live revision only when the public countdown is ready. Copy/download does not publish.

Expired generated compositions remain recoverable in Git and local temporary recovery directories. Ended campaign/version removal is permanent at the application level; ordinary database backups are the only external recovery possibility. Historical delivery rows and active/shared assets are preserved.
