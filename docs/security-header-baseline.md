# Browser security header baseline

27 September 2026. Production inspection found HSTS already supplied by Vercel, but no CSP, frame-options, MIME-sniffing or referrer headers on the public app, admin rewrite, fixture rewrite or API response.

## Policy and purpose

The global Vercel rule supplies:

- `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'`: only same-origin parents can embed NS, an injected base URL cannot point outside the origin, and legacy object/plugin embedding is disabled.
- `X-Frame-Options: SAMEORIGIN`: compatible framing restriction for older browsers.
- `X-Content-Type-Options: nosniff`: scripts and styles must have suitable MIME types.
- `Referrer-Policy: strict-origin-when-cross-origin`: retain same-origin navigation context while limiting cross-origin referrers to the origin and suppressing downgrade referrers.

This is not a strict script CSP or complete XSS protection. The existing inline-script architecture and third-party connections are not given a new allowlist in this phase. That requires an inventory, nonce/hash strategy, report-only observation and sign-in/installed-device regression work. No new telemetry collector or subscription is introduced. HSTS and the separate no-store rules for service worker/version metadata remain unchanged. Geolocation is used by existing Follow preferences, so no blanket Permissions-Policy denial is added.

The shell marker advances to 326 so installed clients replace cached HTML responses that predate the policy. Runtime JavaScript bytes are unchanged. The installed-browser harness now applies candidate response headers and checks that the cached HTML retains the new CSP; browser automation does not prove physical iOS behavior.

## Verification and release maintenance

`validate-security-headers.js` checks configuration before deployment and actual headers, expected status and MIME types on seven production routes afterward. This is a mandatory release gate, with evidence retained beside exact-SHA deployment proof. It includes the unauthorised API response and rewritten admin/fixture documents. `validate-security-headers-browser.js` exercises successful same-origin and rejected cross-origin framing; with `QA_BASE_URL`, it also tries framing the public application from a separate local origin.

The PWA upgrade exercise verifies preferences, mandatory asset failures, offline fallback and cached policy retention. Existing startup budgets remain unchanged. Ordinary authenticated workflows and physical-device validation remain separate requirements; these headers do not replace API authorisation, RLS, input validation or account-erasure work.

No cash cost, database migration, added scheduled job or owner decision. Roll back by restoring the prior header configuration through the normal release pipeline; installed cache changes require the ordinary forward shell-version update rather than downgrading a version marker.

References inspected: [MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors), [MDN nosniff](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options). This record describes intended policy; production evidence is saved with each release rather than inferred from configuration.
