-- Later reminder tables must share the existing account-erasure write barrier.
-- No backfill, account activation, reminder replay or change to client grants.
set local lock_timeout='2s';
set local statement_timeout='15s';
create trigger nothingsports_account_erasure_guard
after insert or update on public.nothingsports_reminder_intents
for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard
after insert or update on public.nothingsports_reminder_account_checks
for each row execute function private.nothingsports_guard_erasure_write('user_id');
