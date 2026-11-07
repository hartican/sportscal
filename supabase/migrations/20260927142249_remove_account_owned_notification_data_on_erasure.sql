-- Account erasure must not convert private notification state into anonymous state.
-- No existing account, installation or reminder is deleted by this migration.
set local lock_timeout = '2s';
set local statement_timeout = '15s';

alter table public.nothingsports_push_installations
  drop constraint nothingsports_push_installations_user_id_fkey,
  add constraint nothingsports_push_installations_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.nothingsports_reminders
  drop constraint nothingsports_reminders_user_id_fkey,
  add constraint nothingsports_reminders_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
