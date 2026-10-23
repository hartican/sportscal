# Missing release controls — proposal, 23 October 2026

## Verified existing state

- Production already serialises deployment/cleanup and refuses a requested SHA different from main at checkout. It materialises exact Git blobs, runs249 safety commands, seals server-only sources, deploys prebuilt output with releaseGitSha and verifies READY, aliases, served hashes and live APIs/security.
- No open PRs or pinned queue existed before this change. Release Queue issue28 is now pinned. The old backlog was a local/repository document. No PR-triggered CI exists.
- Main protection returned404; repository rulesets were empty. No permission/protection was changed by this inspection.
- Canonical refresh and deployment cleanup are disabled_manually. Manual production remains active. Canonical refresh currently has contents/actions write, production Supabase/Vercel credentials and invokes the legacy main-push/deploy wrapper.

## Add only the missing pieces

1. **PR convention and one queue:** the new template, AGENTS rule and release procedure replace the live local backlog. P1 is the first task through it. DEPLOY records stage, exact head/combined main SHA and acceptance links in issue28. No new dashboard or owner meeting.
2. **Pre-merge CI:** add stable checks `Release handover` and `Release safety contracts`. Validate required handover fields/head; run the same existing249-command list against the combined PR revision when ready for review. Keep Working drafts cheap; draft status already prevents merging. Reuse the production list through one tested runner instead of maintaining a second list. Keep all production gates unchanged. Untrusted PR CI gets no production/provider secrets or privileged events.
3. **Automatic changes enter as draft PRs:** the existing canonical owner prepares a unique branch and complete diagnostic handover; it never pushes main or dispatches production. A no-op creates no PR. Duplicate/in-flight proposals are explicit, not silently rebased over active work. Keep the workflow disabled until routing and shared-data boundaries pass review. Its current local-only path may still write Supabase, so removing deployment alone is insufficient: production fact publication must remain an explicitly allocated DEPLOY/canonical-owner operation, fenced against an active candidate. Workers receive no production write credentials. Do not introduce a second refresh owner or scheduler.
4. **Candidate gate:** preserve current serial production group; verify the issue has only one Integrating/Live-pending-acceptance candidate, expected PR heads/dependencies and exact main SHA immediately before build/deploy. Candidate/source drift fails closed. Retain every safety check. Issue changes are auditable; they are not an atomic database lock or a replacement for service leases.

## Main protection recommended for Jack's approval

After the two checks exist and have passed on the real PR path: require PRs, both named checks, an up-to-date branch and resolved conversations; block force-push/deletion and apply the rules to administrators. Require zero routine human approvals so Jack is not asked to review every release; DEPLOY and the existing independent/risk-proportionate reviews remain responsible. Do not enable auto-merge or broad bypass actors. Preserve merge commits/rollback history rather than requiring a history rewrite.

Any added bot pull-request permission or repository Actions setting is also proposed for approval, not silently enabled. No new GitHub App/token is required for this first operating convention. Hard DEPLOY-only identity isolation would need separate scoped credentials later; existing chats share the same GitHub identity.

## Order and acceptance

Finish P1 through its own draft PR while automations stay paused. Then integrate/test pre-merge and bot/candidate controls in small reviewed changes; test no-op, changed/stale head, two competing candidates, missing handover, absent credentials, failed gates and queued automatic proposal without touching main. Bootstrap required check contexts before applying an approved protection payload. Verify protection and an intentionally denied direct worker push only with a disposable safe ref/test configuration, never by risking a real production main mutation.

The branch protection payload is prepared outside source under /Users/jackhartican/Documents/AI/Codex/release-queue-20261023. It has not been applied. Until approval/integration, queue ownership is operational, not a claim that direct-main or shared-credential access is technically impossible. No app deployment or automation restart is needed for this documentation/queue setup.
