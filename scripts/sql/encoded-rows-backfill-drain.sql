-- Same operator transaction. COMMIT only after this succeeds; no retry on failure.
set constraints nothingsports_fixture_read_private.fixture_integrity_at_commit immediate;
