# Public coverage read input — 26 October 2026

Base: frozen draft PR65, `1f7359a3d7b9a03c1c72820c8bd38c515f4f88ce`.
This is its separate source/local-fixture follow-up. DEPLOY alone integrates,
allocates shared operations and publishes; All Sports/Public Feed retain priority.
No provider/service/SQL/native/CI/main/deploy/scheduler operation is included.

## Exact dependency traced

Unscoped `quick-results.refresh` calls `sync-live-coverage.sync` before canonical
fixture/projection work. The existing `--coverage-live` route reaches the same
owner. The owner reads `data/follow-sources/coverage.v1.json`, merges additive
observations through existing identity and fact-clock rules, and writes only
when semantic facts change. It does not retire omitted fixtures. Quick mode
then projects changed sport codes; its other providers/gates remain separate.

The existing reader is a **POST read RPC**, not a write and not a generic POST
allowance. `live-coverage-read-contract.js` is its shared executable manifest:

- `/rest/v1/rpc/nothingsports_read_current_fixtures`, body `{p_fixture_ids:null}`;
- exact twelve Cricket/Rugby sources, order `source_id.asc,fixture_id.asc`;
- limit500, offsets0..3500, maximum8 pages,10-second per-request deadline,
  no retry, terminal short page required;
- returned columns `source_id`, `fixture_id`, `fixture`, `identity_keys`.

`readRows` now derives the identical request from that contract. Its original
source membership, overlap, page-size and terminal-budget checks remain. The
repository SQL basis is `20261002171936_preserve_compact_fixture_observations.sql`:
STABLE/security-invoker/service-only, joining canonical rows, split scores and
stored sporting observation receipts. This is source inspection, not proof of
the current deployed definition or a new authority to invoke it. Independent
pages are not an atomic whole-database snapshot; offset drift cannot justify
deletions, whole-export acceptance or private-control retirement.

## Implemented saved public boundary

`public-coverage-capture.js` validates one2MiB `live-coverage-public-capture.v1`
envelope before local source-file reads/writes. Provenance is currently ONLY
`constructed-fixture`. Every page carries the exact path/method/body/deadline,
parsed-JSON row digest and recorded return time within the existing80-second
maximum read window. There must be no extra page after a short page, missing
terminal page, duplicate row, unknown source, drifted identity, private/unknown
field, query-bearing source URL or malformed clock/score/ordered side.

The explicit public v1 projection contains core two-sided Cricket/Rugby fixture
facts and supplied original observation clocks. Unknown/private fields reject;
they are not silently copied or stripped. Detailed Cricket innings/results,
viewing/editorial structures and uncertain/TBC sides/starts are not qualified
by this narrow schema. It is not an exporter of arbitrary privileged fixture
JSON or a promise that existing server JSON is intrinsically public.

Validated saved pages replace only the request dependency of the real
`readRows`/`project`/`sync` owner. Invalid/empty/stale input never falls back to
a managed call. The explicit replay clock must equal the envelope clock;
sporting clocks remain their own supplied clocks. Ordinary callers keep their
existing service reader. Unscoped quick's optional module input validates before
any source work; source-scoped/offline misuse rejects. Full quick is still not
admitted by candidate preparation.

The existing `--coverage-live` route accepts exactly
`--live-coverage-public=/absolute/public-coverage.json --local-only` as an
alternative to its legacy input. Preflight rejects combined/default routes
before diagnostics/source work. Only the public route uses the existing atomic
candidate rollback around sync and dependent checks; ordinary routing remains.
It reports `public-coverage-replay`, retaining structured receipt/pending intents.

PR65's existing `--public-candidate` capability now has one additional narrow
`coverage:shared` target, bound to that public file/resource/hash/clock. It runs
the existing coverage route and permits only coverage/Cricket/Rugby inspector,
schedule, manifest and chat-fixture outputs. It retains the original credentials,
private-path/native/managed/publishing guard and local review packaging. Every
real fetch remains denied for this saved-input target. No new refresh owner or
parallel collector is introduced.

## Protected content and intake

Unmatched records and unknown retained annotations survive the additive merge.
No private Follow/control export is created for Actions. Receipts and staging
intents explicitly leave three checks pending with DEPLOY: actual producer/
public projection/source scope, private protected-content/retirement policy,
and managed publication qualification. A local validated replay is not a
publication ACK. The intake owner must perform those checks in its own granted
context; this module neither guesses protected membership nor retires content.

## Evidence and remaining producer decision

The causal red test shows the old owner ignoring a valid saved input and
attempting its managed request dependency. Green tests run the actual owner
with a trapped request, preserving scores, unknown content and original clocks;
repeat poll-only changes leave identical bytes. Negative controls cover exact
request drift, private data, identity/sides/scores/clocks, page hash/completeness,
staleness, mode misuse and unsupported genuine-provenance claims. A small
guarded real `update-cards` invocation passes the no-change path and original
source validator. A changed fixture plus refused dependent command proves exact
rollback and original-source preservation. Source modules are reused read-only;
tests copy no whole workspace and launch no service/browser/native runtime.

`validate-public-coverage-capture.js`, existing
`validate-live-coverage-publication.js` (without `--live-read`), and PR65's
boundary-only validator pass locally. Changed-coverage packaging and all real
generated projections, complete full/unscoped provider closure, managed reads/
writes and the normal release suite still need DEPLOY allocation. The general
PR65 packager was not replayed with a large workspace merely for status.

Concrete producer decision still needed: DEPLOY must approve/qualify a privacy-
safe public projection from its actual privileged rows, including the required
non-core fields/aliases and a truthful capture/completeness contract. The current
RPC returns open-ended fixture JSON and no cross-page snapshot token. Genuine
producer receipts therefore remain refused; no new SQL/schema/credential or
reader permission is invented here. Full mode's private Follow/PDFKit-native/
aggregate closure remains an explicit blocker. Routine restoration and two
natural successes remain open0/2. Rollback is source-only; no live-data inverse.
