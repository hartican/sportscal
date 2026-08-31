-- The canonical updater takes an encrypted, anonymised follow snapshot before
-- rebuilding published fixtures. This grant remains backend-only: forced RLS
-- stays enabled and no access is added for anon or authenticated clients.

grant select on table public.nothingsports_user_state to service_role;
