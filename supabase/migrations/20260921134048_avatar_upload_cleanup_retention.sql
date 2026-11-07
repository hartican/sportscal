-- Signed upload capabilities can be replayed until expiry, even after an object
-- is deleted. Keep a bounded tombstone so a late replay is collected as well.
alter table public.nothingsports_avatar_cleanup add column retain_until timestamptz;
update public.nothingsports_avatar_cleanup set retain_until=greatest(not_before,now()+interval '24 hours') where bucket='nothingsports-avatar-originals';
