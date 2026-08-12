# nothingsport Supabase setup

Canonical events and disposable derived cards stay out of the user-state table. Supabase stores only durable identity-owned state: preferences, follows, saved cards, Catch Up watched state, spoiler choices, archived references, ratings, calendar settings, and signed-in measurement participation state.

Cross-device writes use the versioned `user-state-patch.v1` contract. Each client pulls the latest row, applies only fields changed since its last successful sync, and conditionally updates the row it just read. Unchanged fields therefore inherit the newest server values; a concurrent write returns a retryable conflict instead of overwriting another device.

The closed trust pilot has a separate append-only `product_events` table. It accepts only the versioned fixed-choice contract in `config/product-events.js`; it stores no free text, social content, precise location, or contact information.

The Phase 2 tennis catalogue has separate public-reference tables in `nothingsports-tennis-catalogue.sql`. Clients receive read-only access; only a trusted server-side ingestion job may write reviewed or licensed provider snapshots. Do not apply that migration until the provider contract and deployment environment are approved.

## Project setup

1. Open the existing Supabase project and run `nothingsports-user-state.sql` in the SQL editor.
2. Run `nothingsports-product-events.sql` to create or upgrade the append-only pilot table, its fixed-contract constraints, indexes, grants, and forced RLS policy. Rerun it whenever the product-event allowlist changes.
3. Ensure at least two test Auth users exist, then run `verify-product-events.sql`. It verifies INSERT access for the signed-in owner, rejects cross-user ownership, checks the absence of SELECT/UPDATE/DELETE privileges, and rolls back its test row.
4. Run `nothingsports-tsdr.sql` to verify the weekly TSDR and fixed-choice pulse queries. Product users cannot run these administrative read queries.
5. Run `harden-nothingsports-security.sql` to revoke direct execution of the internal `public.rls_auto_enable()` helper from `PUBLIC`, `anon` and `authenticated`.
6. Run `nothingsports-pilot-readout.sql` on demand as an administrator and pass its JSON export through `scripts/evaluate-pilot-readout.js`. The query creates no view or client-readable object and groups pulses by explicit survey version.
7. In Authentication > Sign In / Providers, keep Email enabled. In Authentication > General Configuration, turn off `Allow new users to sign up` for the closed pilot; existing users can still sign in. Enable leaked-password protection in Authentication security settings.
8. Create approved pilot accounts in Authentication > Users with a confirmed email and password. The app exposes password sign-in only and has no public sign-up route.
   - `Keep me signed in on this device` is enabled by default. It stores the rotating Supabase access/refresh session in that browser or Home Screen app, never the password. Sign out clears both persistent and session-only copies on that device.
9. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the Vercel project for Production, Preview, and Development as appropriate. A legacy `SUPABASE_ANON_KEY` is accepted as a compatibility fallback.
10. Do not add or expose a Supabase service-role or secret key. All state and product-event writes use the signed-in user's access token and the tables' RLS policies. Rotate any secret key that has ever been shared or committed.

The ongoing measurement and operational-readiness checklist is documented in `docs/pilot/phase6-runbook.md`.

Without those environment variables, the app deliberately remains in local-only mode and the existing nothingsport experience continues to work.
