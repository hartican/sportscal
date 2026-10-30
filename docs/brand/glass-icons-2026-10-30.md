# Nothing Sport brand assets and icon choices

## Approved artwork

The wordmark reads lowercase **nothing** with one separate uppercase **SPORT**. All lettering, n symbols and the original hero-skier artwork stay flat. The rounded icon tile alone has the glass treatment. Dark glass is the default in both Day and Night themes.

The complete approved export set, ZIP, corrected guidance sheet, prompts, checksums and export verification live in `assets/brand/source/glass-icons-2026-10-30/`. The archive contains 173 PNGs, including original transparent primary and hero-skier masters, eight icon colourways, app sizes and n-only favicons. Earlier glass-lettering studies are superseded. The original chat downloads are retained so existing download links keep working.

The existing deployment manifest excludes all of `assets/brand/source/`; the full artwork archive is for GitHub backup, not an app dependency. Only generated runtime derivatives under `icons/brand/` and the existing default icon paths are published. `scripts/build-glass-brand-icons.js` reproduces those derivatives from the archived approved PNGs. The existing flat primary and hero wordmarks remain in their established runtime paths; the primary logo's protected bytes stay unchanged.

## Settings behaviour

App icon appears in Settings and Appearance. It is greyed out with a padlock through **99** NothingScore points; **100 and above** unlock all eight choices. The threshold explanation appears on hover and keyboard focus, and is available on touch. Theme selection remains free to use.

The existing authenticated Nothingscore route exposes `GET /api/nothingscore?icon=1`. It derives a boolean entitlement from the signed-in user's own points ledger and returns no balance or ledger records. Anonymous users are rejected. The existing database constrains awards to positive points, so any 100 rows suffice to decide whether the user has at least 100 points; fewer rows give the complete balance. The query selects only points, filters by the authenticated owner and stops at 100 rows, with no sort, reward reconciliation, RPC, customer mutation, polling or new scheduler.

The optional Settings bundle caches the entitlement for 30 seconds per account and generation, and rechecks it on action/selection. Responses from another account generation cannot save a choice. A missing session, failed request or invalid entitlement keeps the action locked. Local storage holds only the selected colourway for this device; it cannot supply points or entitlement. The preference does not alter Follow data or create server-state saves.

The chosen design updates in-app brand icons, the browser favicon, Apple touch-icon metadata and the referenced installation manifest. All variant manifests retain the same app ID, scope and start URL. This is a best-effort request to the browser/OS; immediate replacement of an existing Home Screen icon is not guaranteed. Per the user's direction, there are no icon-change instructions in the interface. The normal public website installation guide is unchanged.

## Website

The existing public `nothingsport.com` Site keeps its identity and audience. The website uses the dark glass icon in its header, footer, installation illustrations and favicon, with the original flat skier logo in the marketing hero. Its existing flat wordmark, app links, installation origin, feed source and Results controls are preserved. The marketing website does not add a separate account or points system.

## Verification and release

`scripts/validate-app-icon-choice.js` exercises the actual authenticated handler with fixture rows, anonymous rejection and private headers, plus real Chromium/WebKit controls at 0/99/100 points, every colourway, reload persistence and stale-account rejection. It uses local fixtures and does not mutate a production account. The database schema/positive-award constraint is checked separately without reading customer rows.

The existing startup-size, performance, protected-wordmark, brand/footer and provider-brand checks remain required. Full-app settings and website layout screenshots are separate local visual checks; they are not physical-iPhone or installed-icon proof.

The app source began on accepted main `65c749d6082f0045b6acf2bb90ffd37af62a1314` (602), then merged main `59b25031f621924fa13a670c369de4b3821f4706` (603 markers). The sole merge conflict was the generated runtime, rebuilt from the merged sources. This work does not allocate a release/cache version or independently publish the app. nsDEPLOY remains the sole app integrator and publisher, and must perform the ordinary combined release and hosted acceptance. The website follows the existing Sites source/publish workflow separately.
