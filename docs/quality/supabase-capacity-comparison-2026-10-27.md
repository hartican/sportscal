# Supabase purchase: loading checks

Prepare one matching before/after pair for Nothing Sport. No purchase, plan/compute change, deployment, source refresh, account change or scheduler restart is included. DEPLOY owns this finite read window; original LOADING owns source fixes. Existing release checks remain unchanged.

## Fixed comparison

- One **before** window and one **after** window; four rounds in each,40seconds between rounds. No warm-up or retry. Each window makes20 anonymous app reads plus10 static identity reads, at most30HTTPrequests and10minutes. Failed or stale reads stay in totals. HTTP429 stops immediately; static identity failure stops rather than silently changing app versions. This measurement deliberately retains later preallocated diagnostic samples after a loading failure; it never supplies release acceptance or changes fail-fast release gates.
- Use the same script/dependency hashes, app version/commit/READY deployment, served document/worker/runtime/feed metadata, primary address, real selected fixture, two participants and request bodies. Frozen selected fixture is published A-League Sydney–Adelaide `event:football:a-league-men:401892151`; missing identity is a recorded failure, never an invented replacement. Source observation staleness is reported separately from successful fresh retrieval. A different actual current fixture requires a new explicit paired plan, not a mid-window substitution.
- Routes are Match Centre membership, that selected fixture, SydneyFC and AlexdeMinaur public participant pages, and the existing global-backed tennis history. ParticipantPOSTs use the existing anonymous read-only API with constructed preferences; they neither read nor save a real user's follows. No auth token, provider lookup, fixture refresh or reminder dispatch.
- Preserve5s interactive/3s selected policies,4s interactive and<2.5s selected headroom checks,30s cache TTL, original observations, coverage and all release budgets. GLOBAL6s qualification remains the existing actual-SDK publisher gate, not a longer public-fetch assertion. The15s observer transport ceiling includes public platform work; it changes no app/backend deadline. Complete public response bodies are capped at4MiB for this diagnostic, not truncated or treated as successful when oversized.
- Each receipt records full-body elapsed, origin timings, bytes/hash, cache status, pass/failure reasons and aggregate identity/revision hashes. No response fixture/account values are saved. Keep median, worst and failure counts; four samples per route do not support a reliable p95 or long-term/cold-server claim. Origin phases overlap; don't add inclusive timings or call them isolated SQL CPU.

## Before purchase

1. Confirm production alias/READY exact commit and served595 (or establish a fresh plan for a later version). Freeze app/SQL/config/provider/scheduler changes for this short pair. Loading source work may continue in isolation. Read the current queue before taking the shared window.
2. Read organization plan/project status through the connected service. Existing organization isFree; only `nothingSport-recovery` is active, six other projects inactive as observed27October. Keep those inactive. Recheck billing quote before purchase; published base isUS$25/month, aboutA$35.56 beforetax atRBA26October USD0.7031/AUD. Other usage/add-ons may change the invoice.
3. Run `scripts/sql/supabase-capacity-observation.sql` once through the existing read-only operator:5sstatement/1slock, explicitROLLBACK, no automatic retry. Save exact query/hash and returned aggregate JSON. Capture the same observation after the HTTP window to detect concurrent schema/fact changes; classify changes as confounding rather than a capacity win. CPU/memory/disk-enforcement fields remain unknown unless actual resource metrics confirm them. Idle connection counts and point samples are not saturation proof.
4. Save a0600environmentJSON with schemaVersion `supabase-capacity-environment.v1`,stage`before`,project`mkghopnkhcxtmfrcjdbc`,observedAt,plan`free`,compute`null`unlessverified, deployment{id,sha,version,state:`READY`},database{codeFingerprint,factFingerprint}; cpuSaturationObserved staysnull unlessmeasured. It must be at most10minutes old. Keep the full service metadata beside it, not inside the capture report.
5. Run the capture below once. A failing exit means failed checks, not permission to rerun. Preserve it. If the purchase is delayed or any code/data/config changes, record this as an earlier baseline and explicitly allocate a new current pair; do not recycle it as matched evidence.

## After separately authorised purchase

Confirm bothPro billing **and Micro compute**; changing the billing plan alone does not automatically resize the database. Record actual compute, price, completion time and any restart. No speculative higher tier or add-on. Once available, use the same app/DB-code input and four-round plan, plus the same two database metadata observations. Create fresh`after`environmentJSON with independently observed resources. Run once, preserve failures, then compare saved files offline. Different app/SQL/facts/membership, missed samples or unknown compute are explicit limits; no causal speed claim.

```sh
node scripts/validate-supabase-capacity.js
node scripts/capture-supabase-capacity.js
node scripts/capture-supabase-capacity.js --capture before /absolute/output/before /absolute/output/before-environment.json
node scripts/capture-supabase-capacity.js --capture after /absolute/output/after /absolute/output/after-environment.json
node scripts/capture-supabase-capacity.js --compare /absolute/output/before/capacity-before.json /absolute/output/after/capacity-after.json
```

Default capture command is inert. Output files are exclusively created; existing receipts are never overwritten. No recurring automation is created. Source tests use loopback-free controlled streams and disposable output only.

## Decision and release

PreferPro/Micro as the smallest measured capacity trial; don't promise that it cures the loading bug. Useful evidence is fewer failed/stale reads and every required headroom check passing, with matching app/data boundaries. A modest median gain alone is insufficient. If the actual repeated load gates still fail, keep the loading repair open; avoid an unmeasured ladder of upgrades. Check resource pressure before proposing a larger instance. Do not auto-downgrade: billing/storage/restart consequences need review.

The comparison never merges or deploys. Once a fix is ready, DEPLOY must run the complete exact-SHA safety, actualSDK, installed/browser, hosted/public/repeated/security gates, confirm served commit/aliases/artifacts, and record Live then Accepted. Phone responsiveness, existing saved follows, actual sports accuracy and natural scheduled success remain separate evidence. Keep background automations paused.

Official sources checked27October2026: [Pricing](https://supabase.com/pricing), [compute and resizing](https://supabase.com/docs/guides/platform/compute-and-disk), [RBA exchange rates](https://www.rba.gov.au/statistics/frequency/exchange-rates.html). No paid service was changed.
