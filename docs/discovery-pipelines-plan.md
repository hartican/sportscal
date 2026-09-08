# Source discovery release — 8 September 2026

App: Nothing Sport / Sportscal. Repository: `hartican/sportscal`. Branch: `codex/discovery-pipelines`, based on `0555a5a`. Vercel: existing `sportscal` project. Extends the approved `followed-fixture-reliability-plan.md`; the user's current instruction authorises the three pipelines together, followed by push and production deployment.

## Included and acceptance boundary

- Rolling 7-day lookback / 90-day future Cricket and Rugby fixture discovery; official first-party Rugby pagination and broad reputable Cricket scoreboards, including women, internationals and domestic competitions. Report source/date/competition coverage explicitly. Unknown opponents, optional broken metadata and source outages must preserve cards. Existing Follow rules continue to decide admission.
- Automated cross-discipline searches for canonical tracked athletes, resolving only explicit participation against identity, fixture/date and source evidence. Tests, ownership, rumour, ambiguous names and a missing entry list cannot manufacture a race entry. Confirmed withdrawals remove athlete association, not the fixture. Extend the common athlete contract rather than a special Verstappen-only UI.
- Autonomous, bounded AI-backed reporting discovery and controlled consensus labels. Accept only evidence returned by the search provider, trusted source domains, suitable date/event matching and source corroboration. Keep source provenance internally; no copied article bodies. AI failures, missing credentials and budget limits never remove fixtures or fabricate ratings/tags.
- Integrate through `scripts/update-cards.js` and the existing protected server refresh/scheduler, not a second fixture cron. Keep durable leases, bounded work, successful-empty discovery semantics and last-good results.
- Verify parser/source interfaces, source-to-Follow/Feed transport, cross-sport participation/exclusion, tag acceptance/rejection, source failure retention, canonical generated artefacts and responsive browser rendering. Verify real production source runs, exact GitHub SHA/READY deployment/public alias separately.

## Exclusions and honest completeness

No claim of every worldwide fixture or unpublished draws. No RSS publisher ingestion where commercial usage is not cleared. No fabricated results/entries, account writes, subscription changes, billing-card additions, credit purchases or silent stakes-based admission. Existing votes, follows and source archives are preserved. Research inventories must distinguish competition coverage, requested date coverage, empty-but-valid results and actual failed sources.

## Activation dependency

The first real AI Gateway probe returned HTTP 403 `customer_verification_required`: a payment card is required to unlock the team's credits. Production has neither `AI_GATEWAY_API_KEY` nor `OPENAI_API_KEY`; deployment OIDC is available. The user has been asked to enable existing Gateway billing or securely configure an OpenAI key. Do not describe autonomous AI ingestion as operational until a real authenticated call and scheduled execution pass.
