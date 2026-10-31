# AFLW bounded result recovery — source preparation

Allocated base: `85b3a8672199e851a2dc60585f8edbb889439485`, tree
`e9dd986065e830a13a161b1041520cbd841d3619`. ROOT/nsDEPLOY owns adoption,
current source windows and the single release lane. This preparation grants no
live request, token, account/SDK/database read or write, CI dispatch, push,
deployment, scheduler change or additional publisher.

Scores precede editorial: Cricket, Rugby, EPL, F1, NRL, AFL, other Football, rest.
Cricket remains held; Rugby/EPL/F1 have their separate acceptance, and retained
NRL needs zero additional GETs. AFLW is the currently allocated source-only work.

## Proposed invocation and public resources

Only `node scripts/update-cards.js --quick --source=aflw-results --local-only`
may select this scope. Reject mixed, duplicate, offline, rebuild and nonlocal
forms before source/diagnostic IO. Direct quick-child selection is refused.
Reuse the existing atomic quick owner, known canonical parser, result projection,
per-surface retained publisher, full Feed/spoiler validation and generated owners.
No broad AFL/NRL loader, StatsPro token or alternate source path is admitted.

An eventual separately allocated trial would make at most these two serial GETs:

- `https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=96&roundNumber=11&pageSize=50`
- `https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=96&roundNumber=12&pageSize=50`

The public fixture route uses Origin/Referer without credentials. Minimum start
gap is one second; no retry, redirect, token, ladder or extra resource is allowed.
Each resource has 15 seconds for rate wait, headers, complete body, decode, UTF8,
JSON and synchronous domain consumer, with separate 1MiB wire/decoded caps. The
source invocation has 45 seconds and separate 2MiB aggregate caps, including
rejected bytes. The existing owner reserves 110 seconds for work and 120 seconds
including rollback/diagnostics. Parent deadlines remain upper bounds. Close all
request/response/decoder handles and timers; record actual attempts, safe body
hash/byte/time receipts and refused resources. Do not archive raw current bodies.

## Admission and independence

Bind the exact eighteen retained fixture identities, ordered numeric/provider
teams, season96/provider `CD_S2026264`, rounds11/12 and single complete nine-row
page0/numPages1/pageSize50 envelope before admitting results. Missing/invalid
single-round responses defer that entire round. Wrong competition/season,
ambiguous or unknown IDs, changed ordered sides, calendar contradictions,
reopened finals and conflicting accepted results reject the whole candidate.
Check supplied identities before page completeness; incomplete bytes cannot
conceal a shared identity conflict. Consumer expiry discards all staged rows
from that resource before independent peers can proceed.

Only nine Round11 fixtures and the first Round12 fixture may receive results.
Require the reviewed explicit `CONCLUDED`, original retained start, nonfuture
real body receipt and nonnegative integer goals/behinds/totals with
`total = goals*6 + behinds`; no unexplained super-goals. Preserve zero scores and
draws. Unsupported individual result fields defer their own card. Known live or
final claims cannot hide future-start contradictions behind missing scores.

HTTP401/403 stops further acquisitions, with no fallback or token borrowing.
Already independently complete verified results may continue through all shared
gates. Report refused resources/cards and a separate later resource proposal;
no supported observations is failure with last-good retained, never a fresh
unchanged success. Transport/resource-local faults cannot waive aggregate,
whole-invocation or shared identity/result integrity failures.

## Preservation and qualification

Retain the eight future fixtures and all other sports, IDs, source aliases,
order, starts, viewing, reviewed writing and original observation clocks.
Unchanged verified finals keep their own facts, result clocks and copy; do not
call a new check a new result observation. Canonical retained historical previews
stay dated; completed on-card projection clears old preview claims and uses the
existing spoiler-safe completion/result helper without editorial research.

Keep the AfterRound10 ladder, its ranks, qualification metadata, source and
snapshot clock byte-exact. It is an older retained table relative to the newly
recovered results; the recovery receipt explicitly records that stale scope.
Derive no new ladder, rank or qualification from the ten scores.

Generated publication uses the existing canonical-context, paged Feed, AFLW
Code Inspector/Follow, runtime and directory owners. Only each surface's exact
changed AFLW IDs may enter normalization; stitch every unchanged counterpart
and unrelated card back unchanged. Full Feed and spoiler gates remain required.
Rollback restores all data/Feed and eight runtime outputs, including removing
new outputs absent before invocation; preserve the original error even when
failure diagnostics fail. Summaries retain missing-result IDs and source failures.

Historical Round9 is real captured shape evidence, not current Round11/12
results. Owned zero-score stand-ins and captured retained inputs use an explicit
clock. The pinned baseline witness demonstrates missing/negative admission and
unbounded old body handling through the actual old parser/reader. Local checks,
required independent reviews, a source pin and inert proposal must precede any
ROOT-allocated actual trial; none constitutes current or hosted acceptance.
