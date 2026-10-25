# Canonical refresh safety: source checkpoint — 26 October 2026

Base: `87958d3b87b739cef84c5f087a20a6b234a49997`.
Owner: original REFRESH worker; DEPLOY alone integrates, allocates shared
operations and publishes. All Sports and Public Feed retain release priority.
This checkpoint fixes a deterministic catalogue contract and records the
remaining routing boundary. It does **not** make the held schedule safe to enable.

## Necessity and distinct freshness owners

- The existing two-minute protected live owner calls `refreshDueSources` with
  due adapters, fenced leases and shared score publication. DEPLOY reports job6
  active; that is not independent evidence of every source succeeding recently.
- Daily canonical full/quick routes own persisted fixture catalogues, current
  standings, ATP/WTA ranking/catalogue context, generated Schedule/Feed bundles
  and derived editorial consequences. Quick mode has its own source-dependent
  projections and bounded live-coverage read. Live score polling does not rebuild
  every one of these files. Retain the existing daily owner and six incremental
  days/full Sunday intent, subject to safety qualification before resumption.
- Account Follow sync and conditional saves have their existing account owner.
  Canonical work must not read or restore customer choices to repair freshness.
- User ratings are accepted/read through their existing API/database owner.
  `snapshot-editorial-nothingscore.js` takes a derived editorial aggregate;
  refreshing that file is not proof that user rating submission, ratings API
  freshness or live scores are healthy. Preserve those separate acceptance gates.

## Implemented deterministic QA repair

`validate-fixtures-contract.js` rejected the accepted seven-league directory
with `7 !== 6`. The independent directory validator already admitted the
retained Australian Championship. Replace numeric catalogue assumptions with
the identities/keys/team counts from the existing six-network-league owner
(`refresh-football-directory.LEAGUES`) plus the existing strictly validated
retained Championship projection. Neither generated data nor coverage is changed.

Both catalogue validators reuse that complete contract. It rejects missing,
extra, duplicate or misbound league contexts, wrong team counts, duplicate team
identities, foreign league associations and loss of the retained-only source policy. The pure
regression tests actual accepted data, order independence and seventeen negative
controls, plus the real owner's retained check under transport denial. Export
the owner's unchanged public definitions before its CLI validates so that the
owner/validator import order cannot leave approved definitions unavailable.
All original chronology, geometry, source, roster, fixture, rendering
and freshness checks remain. This is a correction to QA, not permission to
drop a competition or fetch the retained Championship anew.

## Existing unsafe boundaries, source-inspected

The held canonical workflow currently supplies service/cloud credentials and
calls `update-sportscal-cards-and-release.sh`, which can write main and dispatch
production. Its always/scheduled avatar-cleanup step is a separate managed
mutation. None belongs in an independently scheduled candidate preparer.

`-p`, `--local-only` and `SKIP_RELEASE=1` suppress release, not arbitrary shared
effects. The full owner includes private `snapshot-active-follows.js` when
service keys are present; quick mode reads shared current fixtures via
`sync-live-coverage`. Editorial aggregate capture also uses server-side readers.
Those dependencies must be explicitly classified and bounded before credentialed
candidate execution. A blanket POST ban would also reject legitimate read RPCs;
a blanket GET allowance would admit private account tables. Neither is a safe
replacement for an exact reviewed boundary.

No workflow, shared schema, credential reader, token, permission or setting is
changed in this checkpoint. No real refresh is run, even as local-only. A complete
real refresh closure has not yet been qualified as free of managed mutations;
an unqualified general-purpose monkeypatch is not claimed to be a hard sandbox.

## Proposed smallest routing under existing permissions

1. Keep the same canonical workflow and `node scripts/update-cards.js` owner;
   add no scheduler or parallel collector. Keep it disabled until the following
   source implementation and allocated acceptance are complete.
2. Prepare an explicit public candidate in an isolated current-main checkout.
   Exclude private Follow snapshots, publication credentials, direct main/deploy,
   avatar cleanup and unrelated operations. Preserve every dependent generated
   file and existing quality gate. Unknown shared operations must stop, not be
   silently skipped or acknowledged as if a mutation had happened.
3. Prefer genuine complete, source/identity/hash/clock-bound shared observations
   captured by DEPLOY through existing bounded readers and supplied as immutable
   inputs to existing projections. Existing `--coverage-live` supports saved
   observations; quick/full consumption still needs a reviewed source change.
   No captured file may be relabelled as a fresh source request or have old fact
   clocks replaced by capture time. If a live read is indispensable, its exact
   RPC/body/source/page/privacy budget needs a reviewed read-only capability;
   shared mutations remain DEPLOY-only. Stale/incomplete observations fail
   honestly under the existing gate, rather than obtaining a broader refresh.
4. Run full or incremental through the existing entrypoint under fixture-proven
   transport/mutation denial. Retain source failures, missing-result fields,
   actual child status, rollback, bounded stderr and original observation facts.
   Provider/read/request/process budgets must be enumerated for the actual
   selected mode; this checkpoint does not invent a safe whole-mode quota.
5. Use existing `contents: write` only for one uniquely named review branch,
   after validating the source revision, generated-path inventory and gates.
   An uncertain branch push must not dispatch a second candidate. Retain an
   immutable source/diff/output/hash/clock/diagnostic/handover artifact and
   truthful no-change or failure state. Exclude credentials, `.git`, private
   snapshots, raw customer records and transient files from published artifacts.
6. DEPLOY's existing authorised GitHub client creates the tested draft PR and
   queue entry from that handover, then performs integration/review and every
   release/shared-data operation serially. Scheduled workers never write main,
   deploy, update the shared database or promote their own candidate to Accepted.
   Before any resumption, qualify how DEPLOY discovers and accepts the handover;
   an unconsumed Actions artifact is not a functioning PR queue.

Repository settings were read only: default workflow permission is `read`, and
`can_approve_pull_request_reviews` is false. The current job explicitly grants
contents/actions write but no pull-requests write. Automatic worker-created PRs
therefore have an unqualified/missing permission and repository-approval
capability. Do not assume that adding a YAML permission alone can create a PR.
Additional scopes/settings remain proposals. The reviewed-branch plus DEPLOY
intake route avoids granting workers that capability; its managed acceptance
must still be allocated. PR29 is a draft documentation proposal, not executable
routing or active main protection, and is not absorbed by this checkpoint.

## Required next qualification and explicit gaps

Before an executable scheduler change, pin the full/quick dependency closure,
classify every shared read/write, and prove fixture-backed real-dispatch success,
no-change, denied mutation/private-read/unknown-native-transport, failure rollback,
secret exclusion, exact branch/handover, duplicate/uncertain routing and manual
DEPLOY intake without contacting providers or services during local tests.
If a safe complete closure cannot be demonstrated, leave the job held and name
the particular reader/writer/transport instead of claiming a generic safe mode.

No native database, heavy browser, full suite, provider, live shared operation,
CI, main publication, deployment or schedule toggle is allocated to this worker.
DEPLOY must qualify the integrated exact source and real full/incremental modes
later. Successful natural scheduled runs remain a separate open requirement;
local constructed tests, a manual refresh, GitHub merge or READY deploy cannot
substitute. Other held editorial/Tennis jobs have their own owners and scope.

Rollback of this QA checkpoint is its source-only revert. No migration/config
or live-data inverse is needed because it performs no live operation. Any later
managed execution needs its own evidence and recovery assessment.
