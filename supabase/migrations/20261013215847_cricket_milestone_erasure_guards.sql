-- Reuse the account-erasure barrier for both later recipient-owned tables.
-- This creates no account block, changes no grants and replays no alert.
set local lock_timeout='2s';
set local statement_timeout='15s';
create trigger nothingsports_account_erasure_guard
after insert or update on public.nothingsports_milestone_groups
for each row execute function private.nothingsports_guard_erasure_write('user_id');
create trigger nothingsports_account_erasure_guard
after insert or update on public.nothingsports_milestone_receipts
for each row execute function private.nothingsports_guard_erasure_write('user_id');
