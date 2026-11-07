# Preserve different follows during same-account reconciliation

Status: integrated locally on accepted Cricket584/d567ac0f; generated shell585
and its release checks are being prepared. This P1 prevention slice is next in
Release Queue issue28; it is not published or accepted. The latest user goal authorises code fixes and a lightweight refactor,
without purchasing database capacity. This does not authorise guessed historical
restoration or establish that a particular reported account hit this mechanism.

## Verified failure and intended change

The existing actual application reconciliation test reproduced the loss of a
different remote follow: the accepted baseline held Arsenal, one device added
Australia Tests, and another added South Africa T20Is. Rebasing the whole local
entityFollows array over the latest version removed South Africa. The same case
also fails when the other addition occurs during an actual conflict/retry.

Extend the existing user-state-patch.v1 comparison metadata to entityFollows,
using the known previous list. Apply only changed identities and changed fields
within a retained record to the current same-account list. Reuse the existing
canonical participant Follow identity helper. Preserve unrelated remote follows,
accepted identity spelling, unknown fields, nested fields, formats, explicit
unfollows and newer remote removals. A format-only edit must not revive a removed
or explicitly unfollowed participant.

An explicit whole-list empty choice keeps its existing reset meaning. A missing
old graph/list becoming an empty default is different: it carries no known
removals and cannot clear a concurrently created list. New nonempty choices from
a missing graph must be expressed at the collection boundary rather than replace
the entire graph. Invalid or ambiguous comparison identities fail visibly.

Keep old payloads without comparison metadata compatible with their existing
semantics; that is an explicit older-client limitation, not a claim that every
cached client is already protected. New durable intent receipts retain their
current stricter changed-base pause, ownership, generation and acknowledgement
rules. Do not reinterpret an unowned old graph as deliberate intent or replay it.

## Boundaries and acceptance

Use the same SDK, endpoint, authenticated conditional write, baseUpdatedAt guard,
profile store and existing 650 ms queue. Add no database migration, request,
retry, polling, permission, owner or storage key; keep the 512 KiB state budget.
Do not change domain/competition preferences, Feed admission, spoilers, reminders,
ratings, resets or another account's data.

The existing required cross-device gate must exercise the actual application
orchestrator before/after a conflict, explicit empty/OFF, formats, remote removal,
aliases, unknown nested fields, initial graph creation, invalid comparison data,
idempotency and legacy compatibility. Load the real browser UMD sources without
Node require and compare their result with the server module. The actual API
gate must preserve both follows through normalization/conditional persistence,
retain the verified row owner and reject malformed metadata before any write.
Unknown own metadata keys must survive both the actual API's unchanged-state
comparison and the profile store's receipt comparison. An old returned value
must not be acknowledged as the edited value. Both counterexamples failed
before the two existing canonical comparators were corrected and pass after it.
An actual conflict/retry counterexample also proves that editing one nested
field must not restore its unchanged siblings after another device removes the
whole nested object. Rebase the changed child fields against the latest empty
object in that case. Compare own-key presence before comparing nested values:
adding or removing an own empty-object `__proto__` metadata field must remain a
real edit, preserve unrelated remote metadata and never change object prototypes.
The actual conflict/retry regression reproduced both lost edits before that
presence check and passes after it. The actual application orchestration now runs 24 scenarios,
including the required formats, removals, aliases, initial graph, invalid
comparison, idempotent rerun and older-payload controls; focused module cases
remain additional coverage rather than substitutes for that integration path.
The original red run is retained outside Git with the incident evidence.

Source tests are not production or device proof. Before this slice is released,
complete independent Spec/Standards review, regenerate the coherent next shell
through the sole publisher, and pass every normal release, security, cache,
browser and fresh hosted-data gate. Controlled actual-device/two-device evidence
and the incident's historical recovery remain separate unfinished requirements.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-follow-recovery-planning-20261022/`.

## Accepted-base integration — 23 October

The five reviewed source paths remain byte-identical to07cace517df10d0f1c8311abad44ce5c111adec7. Shell585 is rebuilt from accepted Cricket584/d567ac0f. Ten focused checks passed; the combined initial critical-download check failed by47bytes. A duplicate explanatory comment in the delivered HTML was consolidated without changing executable code, retaining the full decision record. The unchanged performance gate now passes at431440gzipbytes against431441ceiling. Exploratory compiler/source changes were not adopted. Full normal and current installed/hosted acceptance remain pending; draft PR30 is Working, not Ready.
