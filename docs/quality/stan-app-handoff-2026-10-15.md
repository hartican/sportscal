# Stan provider app handoff — 15 October 2026 Sydney

The reported Manchester City–Paris Saint-Germain card linked to Stan's Champions League marketing page. The shared provider launcher chose that web URL and forced a new tab on every platform. A failing actual-launcher regression reproduced that routing choice with an iPhone user agent.

Official evidence captured on this date:

- [Stan's player Apple association](https://play.stan.com.au/.well-known/apple-app-site-association) names `5WK3ASPXML.au.com.stan`, with all paths. Apple's association CDN returns the same production app identity. Both Apple association paths on `www.stan.com.au` return 404, as does Apple's cached association for that host.
- [Stan's player Android association](https://play.stan.com.au/.well-known/assetlinks.json) names `au.com.stan.and`. The marketing host also has an Android association; its lack of an Apple association is the platform-specific difference, not proof that all Android marketing links fail.
- [The reported marketing page](https://www.stan.com.au/watch/sport/football/uefa-champions-league) contains the Android alternate `stan://au.com.stan.and/`. Stan's own public player bundle supports `/sport` and program routes. No private API or authenticated playback was used.

On iPhone/iPad/Android, known Stan marketing sport links now target `https://play.stan.com.au/sport` as a direct same-context anchor. Existing exact player URLs retain their path/query. Desktop, other providers and highlights retain their existing actions. This supplies an associated HTTPS destination with the player website as the no-app fallback. It cannot override operating-system or user app-opening choices, establish native content routing, or manufacture a match/replay permalink.

The regression covers mobile/tablet detection, desktop, exact player links, official-host boundaries and highlights. The ordinary clean-viewing gate includes it. All 308 shared-viewing browser cases passed, including 48 visible reported-card mobile user-agent cases across Feed/Events/Schedule, both themes and summary/expanded states, plus four direct-tap controlled web fallbacks without popups. These are browser routing tests, not physical installed-app proof. Follow, backend, runtime/cache and startup gates pass. Original routing evidence is in `/Users/jackhartican/Documents/AI/Codex/stan-app-handoff-20261015`.

Later same-day deployment preparation starts from published `20b79a37`. The production-pinned Node 24 reproduces the unchanged launcher's size failure: 431,514 critical gzip bytes against a 426,115-byte baseline (73 bytes over the unchanged 1.25% cap). Eight existing inline implementation comments move into [shell source notes](../shell-source-notes.md), retaining every noncomment byte and identical inline-script ASTs. Three short source pointers keep the notes discoverable. That saves 226 gzip bytes and yields 431,288 bytes / 1.2140% growth, eight critical requests and precache below 3 MiB. No executable code, launcher guard, builder, baseline or gate is weakened. Node 25 compression had shown a different result, so release acceptance uses Node 24. Comment parity and the fresh browser receipts are in `/Users/jackhartican/Documents/AI/Codex/stan-app-release-20261015`.

Production receipts are recorded separately. Source preparation is not deployment or proof of installed-app launch; physical-phone acceptance remains outstanding.

## Verified production delivery

Published and deployed `cfc1799d168eee6aa90d6dfa53c643db14fe9a07`, shell version 543. [Normal release run 38662730853](https://github.com/hartican/sportscal/actions/runs/38662730853) passed; READY deployment `dpl_Go1LoFK9L3dfqfmtUCGQefugffZi`, normal production aliases, release metadata and five served-artifact hashes are verified. Root integration matched all nine frozen source hashes before generation, passed 308 viewing cases and both 542→543 installed/offline rehearsals. Hosted viewing checks are recorded alongside the source packet. Physical installed-app opening and playback remain unverified; the release is ready for that phone test. No new subscription, scheduler, sporting-data or customer-state change.
