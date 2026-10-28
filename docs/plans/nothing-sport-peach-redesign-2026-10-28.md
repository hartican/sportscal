# Nothing Sport peach redesign — approved 28 October 2026

## Approved outcome

Apply the peach preview across nothingsport.com, preserving its layout, copy, photography, live public fixture feed, app links and installation guidance. Carry the same visual system through the app without changing API payloads, account preferences, Follow eligibility or fixture identities.

Use charcoal #0C1010, lavender-white #F1E7F6, peach #F9BC9B, coral #FB7B82 and pink #FB3D6C. Keep Day, Night and System; Day has a contrast-safe warm light palette. Reuse the original app wordmark byte for byte on both surfaces. Its SHA-256 is `2a0e3a7c2d9096b863ff5d5ca30d65904dc5cd3c152a619d1828e9d3f86eb10b`. The angular n logomark is a separate asset. Favicons and launcher icons use that gradient mark on charcoal. Do not rebuild, recolour, crop or re-encode the original wordmark.

Exactly three bottom destinations, in order: Feed, Match Centre, Follow. Keep the bar fixed at all widths, including safe-area and content clearance. The header hides downward and reveals upward, remains visible during header focus/open menus, and is separate from the bottom bar. Account sits left on the second row; Results sits directly before Leader Board on the right. Below 768px put Settings, Calendar sync and Share in More, preserving the same controls and owners.

Use the supplied iconography board as direction for first-party, small-size-safe SVG drawings. Neutral lavender/dark ink for ordinary controls, peach/pink for active states, richer gradients for branding. Preserve meaningful status colours and official team/competition/provider/platform marks. Correct the A-Leagues Women cricket-bat mismatch. Retain stable image-backed glyphs on scrolling cards.

## Integration boundary: Events

The user confirmed functional Events redistribution is loosely contained in the existing nsDEPLOY queue. That existing lane owns retirement of the standalone screen and overview/ticket interfaces, targeting fixtures-only presentation while preserving saved data. This redesign removes the primary Events tab and aliases old Events destinations to Match Centre. Do not duplicate the functional retirement, silently delete its data, or claim the queued dependency complete. Follow's remaining Major Events surface is deliberately left for that owner.

## Source and release

App base: 5ef9cf291c20ee6c62f7603be4f40944c24f5d29. Website base: 9974c7728caeca1face6faebaeddf4e3057f5903, existing Sites project appgprj_6ae13085ea2c81919e7e8b16cdbbe05e. Website and app remain separate hosting units. Prepare a draft app PR and a saved, undeployed website candidate. Append one handoff at the very end of GitHub issue 28, preserving all previous ordering and history. DEPLOY coordinates final integration, version/cache assembly, publication and production acceptance.

## Verification

Check both app modes at 320/390/768/1280px, More/Escape/focus, scrolling, navigation, dialogs and footer clearance. Check website fixtures, scores, sport/date filters, details, QR/app links and both installation guides. Run relevant brand, icon, Follow, layout and unchanged startup/performance gates. Preserve honest separation of source, local browser, installed-PWA, hosted account and physical-device evidence.

`node scripts/build-peach-brand.js` builds the active SVG registry, complete reference sprite, separate mark and launcher assets while enforcing the original wordmark hash. The complete authored catalogue stays in `config/nothingsport-iconography.source.js`; only caller-used/current registry icons enter the startup bundle. Rebuild through `node scripts/build-app-shell-runtime.js`. Existing startup limits remain unchanged.
