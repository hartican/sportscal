-- Attribution is nullable after an independently authorised account erasure.
-- Preserve shared rooms and peer memberships. Message sender RESTRICT remains.
-- No row deletion, ownership transfer, RLS change or new API is introduced.
set local lock_timeout = '2s';
set local statement_timeout = '10s';
alter table public.nothingsports_chat_rooms
  alter column created_by drop not null,
  drop constraint nothingsports_chat_rooms_created_by_fkey,
  add constraint nothingsports_chat_rooms_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
alter table public.nothingsports_chat_members
  alter column added_by drop not null,
  drop constraint nothingsports_chat_members_added_by_fkey,
  add constraint nothingsports_chat_members_added_by_fkey
    foreign key (added_by) references auth.users(id) on delete set null;
