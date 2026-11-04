Release Queue: https://github.com/hartican/sportscal/issues/28
Owner:
Status: Working

## Scope
User-visible outcome and exclusions.

## Commit
Exact full PR head SHA; update after the final push.

## Tests and results
Commands, actual pass/failure results and evidence links. Distinguish local, hosted, installed-browser and physical-device proof. Pending checks remain explicit.

## Dependencies
Required PRs, accepted base and shared files/services. State none where appropriate.

## Database and configuration
Migrations/configuration/credentials/external-service changes, or explicitly none. Workers do not execute production changes. `--local-only` is not a database safety guarantee.

## Shared-service effects
Supabase facts/Auth/storage, Vercel/project variables/aliases, provider quotas, notifications, schedulers and shared credentials. State any DEPLOY-only operation and coordination needed.

## Known risks
Account-state, source correctness/freshness, cache/upgrade, security and remaining unknowns.

## Rollback
Exact reversible code/config/database recovery path and preserved preimage. Never roll back newer customer choices.

## DEPLOY release and acceptance
DEPLOY fills: included PR head(s), combined tested main SHA, workflow, immutable READY deployment, aliases/served hashes, required live/coverage/security/upgrade proof, acceptance outcome and unverified limits. Live is not Accepted. Only one candidate Integrating/Live pending acceptance at a time.
