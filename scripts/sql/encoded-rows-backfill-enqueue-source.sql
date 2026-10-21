-- Same transaction AFTER source lock, no captured fixture tuples.
insert into nothingsports_fixture_read_private.integrity_pending(source_id) values($1) on conflict do nothing;
