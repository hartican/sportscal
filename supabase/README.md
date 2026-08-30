# nothingsport Supabase setup

Canonical events and disposable derived cards stay out of the user-state table. Supabase stores only durable identity-owned state: preferences, follows, saved cards, Catch Up watched state, spoiler choices, archived references, ratings, calendar settings, and signed-in measurement participation state.

Cross-device writes use the versioned `user-state-patch.v1` contract. Each client pulls the latest row, applies only fields changed since its last successful sync, and conditionally updates the row it just read. Unchanged fields therefore inherit the newest server values; a concurrent write returns a retryable conflict instead of overwriting another device.

The closed trust pilot has a separate append-only `product_events` table. It accepts only the versioned fixed-choice contract in `config/product-events.js`; it stores no free text, social content, precise location, or contact information.

Web Push installations/reminders and private fixture chat use separate forced-RLS, server-only tables. `anon` and `authenticated` have no direct table privileges. The authenticated Vercel APIs verify the caller first, then use the server-only Supabase service role for only those commands; the credential never enters browser code. Chat room access is based solely on `nothingsports_chat_members`, not follows.

The Phase 2 tennis catalogue has separate public-reference tables in `nothingsports-tennis-catalogue.sql`. Clients receive read-only access; only a trusted server-side ingestion job may write reviewed or licensed provider snapshots. Do not apply that migration until the provider contract and deployment environment are approved.

The Phase 3 broadcaster-discovery queue has private service-role-only tables in `nothingsports-coverage-candidates.sql`. Both tables use forced RLS and revoke every privilege from `anon` and `authenticated`; the browser never needs direct access. Do not apply the migration until a licensed provider and server-side ingestion environment are approved. Repository reports remain the operational MVP.

## Project setup

1. Open the existing Supabase project and run `nothingsports-user-state.sql` in the SQL editor.
2. Run `nothingsports-product-events.sql` to create or upgrade the append-only pilot table, its fixed-contract constraints, indexes, grants, and forced RLS policy. Rerun it whenever the product-event allowlist changes.
3. Ensure at least two test Auth users exist, then run `verify-product-events.sql`. It verifies INSERT access for the signed-in owner, rejects cross-user ownership, checks the absence of SELECT/UPDATE/DELETE privileges, and rolls back its test row.
4. Run `nothingsports-tsdr.sql` to verify the weekly TSDR and fixed-choice pulse queries. Product users cannot run these administrative read queries.
5. Run `harden-nothingsports-security.sql` to revoke direct execution of the internal `public.rls_auto_enable()` helper from `PUBLIC`, `anon` and `authenticated`.
6. Run `nothingsports-pilot-readout.sql` on demand as an administrator and pass its JSON export through `scripts/evaluate-pilot-readout.js`. The query creates no view or client-readable object and groups pulses by explicit survey version.
7. Run `follow-first-user-meta-and-notifications.sql` for the user metadata and server-only Web Push tables.
8. Run `private-fixture-chat.sql` for private room/profile/member/message tables, enforcement triggers, the one-use anonymous-signup ticket gate and the hourly seven-day purge job. Confirm every chat table has RLS enabled and forced, with no `anon` or `authenticated` table privileges.
9. In Authentication > Hooks, enable the **Before User Created** Postgres hook and select `public.nothingsports_before_user_created`. It rejects direct anonymous signups unless the request consumes a five-minute server-issued ticket; ordinary account flows pass through unchanged.
10. In Authentication > Sign In / Providers, keep Email sign-in enabled but disable new Email signups. Enable global account creation and anonymous sign-ins so the hook can admit ticketed chat guests without reopening the closed email pilot. Enable leaked-password protection in Authentication security settings.
11. Create approved pilot accounts in Authentication > Users with a confirmed email and password. The app exposes password sign-in only and has no public sign-up route.
   - `Keep me signed in on this device` is enabled by default. It stores the rotating Supabase access/refresh session in that browser or Home Screen app, never the password. Sign out clears both persistent and session-only copies on that device.
12. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the Vercel project for Production, Preview, and Development as appropriate. A legacy `SUPABASE_ANON_KEY` is accepted as a compatibility fallback.
13. Add `SUPABASE_SERVICE_ROLE_KEY` only as a sensitive server-side Vercel setting for the notification and chat APIs. Never prefix it with a public/client build convention, return it from an API, inject it into HTML, or commit it. Durable user state and product-event writes continue to use the signed-in user's access token and RLS.
14. Create a Supabase `sb_secret_…` key and add it to Vercel as the sensitive server-only `SUPABASE_SECRET_KEY`. In Authentication > Rate Limits, enable **IP Address Forwarding**. Anonymous signup and its immediate token refresh use this key only to send Vercel's overwritten client address in `Sb-Forwarded-For`; missing configuration fails closed instead of sharing one proxy-egress rate bucket.
15. Add `CHAT_ADMIN_EMAILS` as a sensitive, comma-separated list of exact authenticated account emails. Missing or empty values fail closed and expose no chat admin controls.

The ongoing measurement and operational-readiness checklist is documented in `docs/pilot/phase6-runbook.md`.

Without those environment variables, the app deliberately remains in local-only mode and the existing nothingsport experience continues to work.
