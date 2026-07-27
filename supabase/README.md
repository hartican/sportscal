# nothingSports Supabase setup

Phase 6 keeps canonical events and disposable derived cards out of the user-state table. Supabase stores only the durable identity-owned state required by the MVP: preferences, follows, saved cards, Catch Up watched state, spoiler choices, archived references, ratings, and calendar settings.

## Project setup

1. Open the existing Supabase project and run `nothingsports-user-state.sql` in the SQL editor.
2. In Authentication > URL Configuration, set the production Site URL and allow the local development URL used for testing. Magic-link redirects must be allow-listed.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the Vercel project for Production, Preview, and Development as appropriate. A legacy `SUPABASE_ANON_KEY` is accepted as a compatibility fallback.
4. Do not add or expose a Supabase service-role or secret key. All state access uses the signed-in user's access token and the table's RLS policies.

Without those environment variables, the app deliberately remains in local-only mode and the existing nothingSports experience continues to work.
