# Feed and chat recovery — 14 September 2026

## Source recovery

The prior `/private/tmp/sportscal-feed-follow-20260908` worktree had been cleared, including its uncommitted files and `.git` link. The primary checkout was not modified. GitHub main was independently verified at `42ad2dcac593f8094f45b60bcf762046584b6a98`.

A fresh isolated clone at `/private/tmp/sportscal-restored-20260914` was created on `codex/restore-feed-chat-20260914`. Recoverable source patches and reviewed canonical-input edits were replayed from the task history. The recovered work was committed and backed up to this remote branch. Do not depend on the temporary directory surviving: fetch the branch on resume.

## Repairs and focused verification

- Legacy event removal/refollow deltas become durable event-family decisions before preference migration. `validate-event-unfollow.js` passes.
- Canonical refresh no longer changes an unresolved AFL Grand Final title back into bracket copy. Resolved clubs replace the public title while retaining the Grand Final stage. Tested through `syncCanonicalFixtures`, not only a string helper.
- Unresolved finals retain week metadata through Inspector projection. Confirmed dates clear week labels. NRL Grand Final keeps its published date without pretending an exact time exists.
- Explicit F1 follows include published practice sessions, preserving exclusions and avoiding implied driver follows. Decision record updated.
- Chat invitations grant no membership until acceptance. Local PostgreSQL tests found and fixed ambiguous output-column references in the acceptance RPC. Acceptance/rejection, wrong-identity denial, retries, one atomic leave message, and direct-role denial pass.
- Receipt acknowledgement uses the received message timestamp and a monotonic database update. Merely making a GET request no longer counts as delivered. Poll responses include bounded updates for earlier own-message receipts. Optimistic messages do not show a sent tick before server acceptance.
- Bulk deletion removes chats from the requesting member's list. The client batches at 50, retains failed selections, and retries only unfinished batches; the API rejects oversized batches instead of silently truncating them. This does not erase other members' transcripts.
- Sent timestamps appear alongside one/two receipt ticks. Full-screen chat geometry and timestamp/tick alignment pass at 320, 390, 768 and 1280px.

Commands passed:

```
node scripts/validate-event-unfollow.js
node scripts/validate-follow-decisions.js
node scripts/validate-follow-policy-parity.js
node scripts/validate-competition-classification.js
node scripts/validate-restored-feed-chat-contract.js
node scripts/validate-ui-reliability.js
node scripts/validate-feed-controls.js
node scripts/validate-private-fixture-chat.js
node scripts/validate-shared-chat-ui.js
node scripts/validate-chat-bulk-receipts.js
node scripts/validate-chat-invitation-storage.js
node scripts/validate-startup-budget.js
```

Browser checks passed using bundled Playwright in disposable profiles:

- `validate-compact-feed-browser.js`: all four requested widths, collapse/expand, persisted compact state, bounded mounted cards.
- `validate-chat-presentation-browser.js`: all four widths, full-screen geometry and timestamp/receipt alignment.
- `validate-installed-pwa-upgrade-browser.js`: actual cache-first version 236 to candidate version 251, automatic catch-up, preferences preserved, optional failure tolerated, required failure retains the shell, offline fallback and resumed upgrade with draft preservation. This is automated browser proof, not a physical iPhone test.

Synthetic precache: 72 assets, **2.71 MB**, under the 3 MB limit. The candidate shell version is still 251; bump all coordinated version markers and repeat upgrade checks before deployment.

Only the canonical command was used to rebuild generated projections:

```
node scripts/update-cards.js --follow-ui --local-only
```

This mode rebuilds from retained canonical sources. It does not refresh current sports source data or substitute for the complete acceptance pipeline.

## Blocker and remaining release work

Full `node scripts/update-cards.js --local-only` stops at the required active-follow snapshot because no local server secret is configured. The authorised connector fallback is also unavailable: repeated read-only SQL requests and the security advisor fail with Postgres `57P03`, “the database system is not accepting connections; Hot standby mode is disabled.” Management API reports the project `ACTIVE_HEALTHY`. Do not infer that the public app database is down solely from this connector failure. Do not restart/restore an active project speculatively.

No production migrations, preference-row repair, main-branch push, production deployment or physical push-delivery proof were performed in this recovery pass.

Once SQL access is restored:

1. Verify and back up the reported user's actual preference row, then repair its missing US Open exclusion. Preserve all unrelated state.
2. Capture a fresh anonymised follow snapshot through the connector; do not fabricate credentials or present the old snapshot as current.
3. Run the complete canonical refresh and fix remaining source/editorial/result failures. The prior interrupted refresh had unresolved editorial contestant updates and required current sports-source verification; the four golf majors and other recovered source edits still need full publication QA.
4. Finish the remaining accepted-plan coverage audit, including identities, standings/profile navigation, editorial uniqueness, alert privacy/grouping, invitation resolution notification and deep links. Passing focused chat tests is not proof of every requested feature.
5. Review/apply additive chat and preference migrations, run security/performance advisors and live API checks. Test physical push separately.
6. Bump the shell, rerun upgrade and layout checks, commit/push the exact verified snapshot, deploy production, and independently verify GitHub SHA, READY deployment, alias, releaseGitSha and live behaviour.
