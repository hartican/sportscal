# Sportscal hosting cost-benefit — 15 September 2026

## Decision

**Upgrade the existing Vercel team to Pro now, then do only the small deployment-hygiene pass. Do not migrate Sportscal merely to save the USD $20/month.**

At the measured workload, Pro is principally continuity insurance: Hobby can pause after an included limit is exceeded, whereas Pro continues on pay-as-you-go and has Spend Management. It does **not** make the CPU-heavy personalised feed efficient. The feed still needs optimisation if its roughly 10.5 seconds of active CPU per sampled invocation is also harming response latency.

The sensible near-term package is:

1. Pro upgrade.
2. Retention at roughly 1 day for cancelled/errored/pre-production and 1 week for production.
3. Refuse a second production deployment when the same `releaseGitSha` is already READY.
4. Use `vercel deploy --dry --json` and shrink the uploaded snapshot/function bundles.
5. Add phase timings to `/api/feed`; optimise it only against measured latency/CPU rather than as a condition of staying online.

That is a few hours of bounded hygiene, not an open-ended platform rewrite.

## Cost and capability comparison

| Option | Likely monthly cost at today's workload | What it genuinely solves | What remains |
|---|---:|---|---|
| Vercel Hobby + safeguards | $0 | Retention, smaller artefacts and deployment deduplication can fix the 14.01 GB storage symptom; feed work can remain under the 4-hour limit | Little operating headroom; crossing a free limit can pause projects; 1-hour runtime-log retention; daily-only imprecise Vercel cron |
| **Vercel Pro + safeguards** | **$20 minimum** | No automatic stop at the Hobby ceiling; $20/month usage credit; Spend Management; 1-day logs; per-minute cron; configurable 4 GB/2 vCPU functions and longer duration; minimal migration risk | Same code still burns the same underlying work; deployment storage remains metered; 2 vCPU may improve wall time but is not a substitute for reducing work |
| Cloudflare Workers Paid | $5 minimum | Excellent raw unit economics: 10M requests and 30M CPU-ms included, free/unlimited static-asset requests and no egress charge | A real port: 128 MB isolate memory, 64 MiB Worker limit and Worker/Node compatibility constraints clash with the current data-heavy Node handlers; Supabase remains remote; code efficiency still matters |
| Netlify Pro | $20 for 3,000 credits, possibly more | Similar managed static + functions model, previews and rollback | No clear economic or architectural win; production deploys and compute both consume credits, so current deploy churn simply moves to a different meter; migration required |
| Railway Hobby hybrid | About $5–10, subject to a pilot | A persistent Node process can keep a pre-indexed catalogue warm and gives conventional service/worker/cron/container control; CDN is available | Adapter/routing migration, cost while RAM is resident, cold-boot/possible first-request 502 in sleep mode, only Singapore as the closest runtime region, and a five-minute minimum for Railway cron |

All prices are USD before tax.

## Vercel Pro economics using the observed month

Vercel Pro is $20/month and includes $20 of usage credit. In Sydney, Fluid Compute is $0.180 per active CPU-hour and $0.0149 per provisioned GB-hour; function invocations are $0.60 per million. Deployment Storage is $0.10/GB-month. [Vercel pricing](https://vercel.com/pricing), [Fluid Compute pricing](https://vercel.com/docs/functions/usage-and-pricing), [Deployment Storage announcement](https://vercel.com/changelog/deployment-storage-keeps-your-deployments-rollback-ready)

A deliberately conservative calculation using the whole reported storage balance is:

- 3h14 Active CPU: about **$0.58**
- 70.1 GB-hours provisioned memory: about **$1.04**
- 14.01 GB deployment storage: about **$1.40**
- 48K invocations: about **$0.03**

That is only about **$3.05 of metered compute/storage** before build and minor traffic items. Allowing roughly another $2–4 for the reported build usage still leaves the workload comfortably inside the $20 credit. The upgrade should therefore behave like a predictable $20 subscription at today's scale, not $20 plus a large usage bill.

Pro also changes the operational boundary: Pro keeps running with on-demand usage, while Hobby is paused when free usage is exceeded. Spend Management can notify, call a webhook or pause all production projects at a chosen amount, but pausing must be explicitly enabled. [Vercel plans](https://vercel.com/docs/plans), [Spend Management](https://vercel.com/docs/spend-management)

Recommended guardrail: alert/webhook on the first meaningful overage and enable automatic pausing only at a ceiling Jack would genuinely prefer to an outage-free extra charge (for example $10–20 beyond the included credit).

## What Pro unlocks for performance and scale

- Standard remains 2 GB/1 vCPU. Pro can select Performance at 4 GB/2 vCPU; Hobby cannot. This can reduce feed wall time if it is CPU-throttled or parallelisable, but Active CPU billing counts vCPU work, so it need not reduce consumption. [Function memory and CPU](https://vercel.com/docs/functions/configuring-functions/memory)
- Pro function duration can be configured beyond Hobby's ceiling, but the current feed is not timing out; extending duration would mask rather than fix excessive work. [Function limits](https://vercel.com/docs/functions/limitations)
- Vercel Functions automatically scale to high concurrency on both Hobby and Pro, so current traffic volume is not the scalability problem. [Function limits](https://vercel.com/docs/functions/limitations)
- Pro provides one day of runtime logs instead of one hour and supports per-minute precise cron instead of Hobby's once-daily, hourly-imprecise schedule. This helps diagnosis and could replace an external scheduler only after deliberately preserving the existing one-owner rule. [Runtime logs](https://vercel.com/docs/logs/runtime), [Cron pricing and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Alternative-platform reality

### Cloudflare Workers Paid

Workers Paid costs $5/month, includes 10M requests and 30M CPU-ms, and charges $0.30/M requests and $0.02/M CPU-ms beyond that. Sportscal's 3h14 of reported active CPU is about 11.64M ms, so it fits the included CPU pool if the workloads meter comparably. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

However, Workers allow 128 MB memory and a 64 MiB uncompressed Worker. Sportscal's current whole deployment snapshot is around 121 MiB; Workers would split static assets from code, but the backend bundle and roughly 297 MB observed function working set would still need substantial redesign. Moving would require bundling, compatibility testing, and probably relocating or precompiling catalogue data into static assets/KV/R2. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

Cloudflare is the best *eventual* cost/performance candidate if Sportscal is redesigned around compact precomputed data plus edge-native handlers. It is not the cheapest answer in engineering time this month.

### Netlify Pro

Netlify Pro starts at $20/month for 3,000 credits. Production deploys consume 15 credits each, compute consumes 10 credits/GB-hour, bandwidth 20 credits/GB, and requests 2 credits/10K. Additional Pro credit packs are $10 per 1,500. [Netlify pricing](https://www.netlify.com/pricing/), [credit metering](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)

If Vercel's 70.1 GB-hours translated directly, compute alone would consume about 701 credits. One hundred production deploys would consume another 1,500; previews are free. This might fit the base tier, but it rewards fixing deployment churn just as strongly and offers no demonstrated feed-performance advantage. It is therefore migration cost without a clear payoff.

### Railway hybrid

Railway Hobby has a $5 minimum including $5 usage; RAM is $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB and volume storage $0.15/GB-month. A small 256–512 MB Node service would plausibly land around $5–10/month, but only a one-week pilot can establish its real resident-memory cost. [Railway pricing](https://docs.railway.com/pricing)

Its advantage is architectural: one persistent server can load/index the catalogue once and serve all API routes, while its CDN can cache static responses without compute or egress charges. Its serverless sleep mode can remove idle compute cost, but outbound connections can prevent sleep and the first request may return 502. Railway has no Sydney runtime region; the closest is Singapore. Cron has a five-minute minimum. [Railway CDN](https://docs.railway.com/guides/cache-headers-cdn), [serverless mode](https://docs.railway.com/deployments/serverless), [regions](https://docs.railway.com/deployments/regions), [cron jobs](https://docs.railway.com/cron-jobs)

A hybrid pilot becomes worthwhile when the backend needs an always-warm in-memory index, background workers, WebSockets/presence, or sustained CPU that makes a conventional service materially simpler. The current measured workload does not yet justify that migration.

## Break-even judgement

USD $20/month is $240/year. Avoiding that fee is not worth even a modest platform migration or repeated rounds of token-heavy quota work. The upgrade should be treated as buying reliability and better diagnostic room, while the small storage safeguards prevent paying to retain accidental duplicate artefacts.

The one backend change still worth doing regardless of host is reducing `/api/feed` work, because that improves user-visible latency as well as cost. Paying Vercel removes the emergency; it does not remove that product-performance opportunity.
