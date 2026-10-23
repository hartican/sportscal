# Queue-driven releases

The [pinned Release Queue](https://github.com/hartican/sportscal/issues/28) is the only live priority index. PRs own implementation/source/handover; the issue links them and records priority, owner, dependencies and stage. Older delivery reports are dated evidence, not another live backlog. Sports-demand ranking remains in its separate ignored register and does not authorise implementation.

## Working → Ready → Integrating → Live → Accepted

Workers start a dedicated branch/worktree, open a draft PR and use the handover template. A complete, approved, tested head with resolved dependencies enters Ready. DEPLOY selects one Ready item and pins included heads/base. Draft work cannot be selected. DEPLOY tests the combined revision, publishes via the PR lane and sends the exact published main SHA through the existing serial production workflow. The workflow still runs every existing safety command before building/deploying that revision. A moved main, changed PR head or unresolved dependency invalidates qualification.

DEPLOY records Live only after exact READY/SHA, aliases and served-byte proof. Required public/security/freshness/coverage/upgrade checks must all pass before Accepted. Record failed gates and known device/operational limits. A substantial defect returns to its worker/Working with evidence; do not patch another worker's scope silently or promote a successful retry as reliability proof. Rollback follows the existing guarded route, preserving newer customer decisions.

Workers may push only task branches and update their own draft handover. No worker main push, deployment, production SQL, Auth/config change, reminder replay or independent shared-data mutation. DEPLOY alone allocates shared-service changes and publishes. Existing update/release shell helpers contain legacy main-push paths: workers must not invoke them. `SKIP_RELEASE=1`, `--local-only` and a worktree do not isolate production services.

## Reuse what exists

Retain Sportscal production's exact-main dispatch, immutable materialisation, full249 safety commands, serial production/cleanup lane, build seal, READY/alias/served-byte checks and public/security probes. Retain canonical update-cards ownership and the existing Follow/backend decision records. No competing publisher, scheduler, tracker or tool subscription is added.

## Missing controls proposed for approval/integration

[Enforcement proposal](plans/release-queue-enforcement-2026-10-23.md) covers PR-triggered reuse of current checks, bot branch/draft-PR routing and approved main protection. No repository permission/protection has changed. Canonical refresh and deployment cleanup remain disabled_manually; only the existing manual production workflow is active. Do not resume either automation as part of this rollout.

A branch isolates files, not Supabase facts/Auth/storage, Vercel settings/aliases, provider limits/keys, notifications, scheduler leases or the GitHub login shared by chats. Record those dependencies in each PR. Hard separation of chat identities is not claimed: shared login credentials cannot distinguish DEPLOY from a worker. Current role ownership is an operating rule, with repository enforcement pending approval.

## Transition checkpoint

Cricket584/d567ac0f began before this convention and is accepted with its full dated workflow/public proof in the pinned issue. Do not manufacture an empty retrospective implementation PR. P1 follows/account sync is next and must use a draft PR. Queue hardening follows without disrupting that repair. Public Feed remains deferred; All Sports View remains last.
