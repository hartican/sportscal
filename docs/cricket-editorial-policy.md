# Cricket card editorial — 20 October 2026

Jack approved implementation and explicitly approved the initial sample structure
and publication on 20 October. The recorded approval and exact sample hashes are
in `config/cricket-editorial-approval.json`. The review packet
belongs outside the checkout in `/Users/jackhartican/Documents/AI/Codex/cricket-editorial-policy-20261020`.

## Writing and evidence

Use separate paragraphs without visible section labels. Preserve selection, form,
tactics and competitive context where useful. Aim for 80–150 words across the
expanded copy, with no minimum. The 150-word cap includes every existing copy field.
Do not fill missing themes. Retain the four existing field names for compatibility.

Use `synthesis` only with two independent journalistic origins and independent
reporting bases. Syndicated Reuters/AAP copies share the agency origin. Repeated
announcements/interviews share an evidence basis even across publishers. Official
announcements and governing-body journalism are classified separately and cannot
meet the independent-journalism threshold. A named, attributed `fact-brief` can use
one authoritative source. `withheld` has empty paragraphs and an audit reason;
the fixture stays available.

Record URL, publisher, author/agency, origin, reporting type, original publication
and update dates, retrieval precision and check time. Date-only publication or
retrieval values stay date-only; `checkedAt` is the ledger verification time, not
a fabricated retrieval timestamp. A page without readable article evidence cannot
support a claim. Store short supporting excerpts, not whole articles.

Every sentence maps to stable claim IDs in `paragraphClaims`. Each claim records
fact/opinion/disputed classification, source indexes and support with a reporting
`basisId`; opinions, disputes and factual briefs name their attribution in the
published sentence. Disputes retain contradictory support. `agreement: true`
requires two independent origins/bases supporting the same proposition. Merely
covering different topics cannot support consensus wording.

Build this ledger before drafting. Review the draft in a separate pass against
support, attribution, phase, spoilers, duplication and style. Record the separate draft/review pass IDs, an SHA-256 binding of the exact copy
and evidence, and the research allowance. Editing reviewed inputs invalidates that binding. Deterministic checks reject known aphorisms, metaphors,
rhetorical questions and structured score/status text; these checks complement
the editorial review and cannot prove semantic truth by themselves. Never invent
quotes, motives, feelings, causal explanations or certainty. An unverified quote,
unsupported interpretation or unresolved conflict must be removed or deferred.

## Freshness and maintenance

Keep the existing 5/2/1-day preview cadence. Confirmed play or the existing preview
deadline retires speculation. Structured match states come from the existing
shared timing helper. A passed scheduled clock does not prove play; it is enough
to withhold an outdated preview. A newer authoritative announcement supersedes
older selection uncertainty. Submit a withheld outcome when a contradicted passage
cannot yet be replaced; do not preserve it as last-good editorial.

Ongoing evidence has a `coverageThrough` cutoff and a `validUntil` deadline no later
than 24 hours afterwards. Checking the same article later cannot extend that limit. Already reviewed immutable
research may be reprojected after expiry without blocking fixture refresh; its
deadline remains unchanged and the public resolver keeps it hidden.
Use an explicitly known reporting cutoff; if only a report's publication instant
is known, record that basis rather than inventing a match timestamp. Historical
background must be dated and cannot establish current fitness or the next XI.

All public paragraphs carry the policy version, evidence mode, phase, validity
deadline and reviewed marker. One resolver handles all paragraphs for Feed, Events,
saved/cold-pinned fixtures and cached fallback. Legacy cricket paragraphs without
the policy contract stay hidden; they cannot restore an old preview. Ongoing and
recap paragraphs are hidden with Results OFF. Scores, day, Stumps, interruptions
and resume times stay in the existing structured match presentation.

The existing daily editorial owner now includes active cricket fixtures passing
the existing real-signal/request selection. Holds, protected fixtures, aliases,
private control snapshots and revision checks still apply. An intentional brief
or withheld result is complete and cannot trigger a missing-four-sections loop.
Other sports retain their existing copy requirements.

Per due fixture, allow at most two searches and six article reads including retries,
one draft, one separate review and at most one correction. Reuse sources across
fixtures within the owner's existing allocation; defer when it is exhausted. No
new scheduler, ingestion service, public API, model API or client database request.
The source reader/drafting agent records usage; the canonical importer enforces
the submitted allowance and evidence contract. Token and cash cost remain unknown
unless actual usage is available. Unchanged checks do not create releases.

## Canonical execution and approval

Use the existing `node scripts/update-cards.js --adaptive-editorial --list` and
`--research <dated-json>` route. Do not introduce an independent cricket refresh.
The research entry extends the existing fixture schema with the fields specified
in `schemas/cricket-editorial-research.schema.json`. Detailed support stays in the
knowledge audit; public narrative projections carry only display metadata and the
existing provenance IDs.
The raw research and knowledge JSON stay server-only: the existing build seal
removes both from static downloads only after verifying exact retained Feed and
calendar server copies. Normal release proof checks their denied public paths,
including encoded variants. Public Feed projections never include the claim ledger.

`config/cricket-editorial-approval.json` records the direct sample approval, its
recorded timestamp, approving chat and exact sample hashes. Canonical adaptive/weekend
application and the direct research writer reject new policy entries without a
valid approval record; there is no environment bypass. The approved ODI withholding
is a fallback example, not a researched finding that reporting was unavailable.
The dated samples remain regression evidence and are never imported as fresh
reporting. Current shell integration, budget checks and normal release gates remain
required before production acceptance.

The existing automation's source instruction should point to this policy when the
release owner integrates the approved sample. This implementation does not change
an external automation or claim one has been updated. Keep its cadence, active
state and quiet notification policy; no second owner or publisher.

## Verification

- `node scripts/validate-cricket-editorial-policy.js`: provenance, origin/basis
  deduplication, attribution, review, budgets, phase/expiry, withheld repair
  behaviour, unchanged sporting fields and legacy compatibility.
- `node scripts/preview-cricket-editorial-policy.js --output <absolute-folder>`:
  local actual-app Chromium/WebKit rendering, 390/1280px, both themes, Feed/Events,
  Results ON/OFF, repeated expansion, source ledger, screenshots and measured cost.
  It builds the runtime in memory and performs no refresh/publication.
- Existing adaptive, publication, identity, API, Feed/spoiler and startup checks
  remain mandatory. Root owns current shell/version/worker/generated integration.

The sample reuses articles checked during the planning interview on 20 October;
there are no new source/provider requests. Its innings data is a retained regression
capture, not a fresh score. The pre-match sample uses explicitly dated background;
it does not assert the third-Test XI or current fitness. Browser simulations are
separate from hosted rendering and physical-device proof.
