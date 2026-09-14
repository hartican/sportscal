# Supabase recovery runbook

Last verified: 14 September 2026

Project: `jljgtodyviwpslprxaao` (`nothingSport`, Sydney)

## Current incident boundary

The Supabase management API reports `ACTIVE_HEALTHY`, while every SQL request returns:

```text
FATAL 57P03: the database system is not accepting connections
DETAIL: Hot standby mode is disabled.
```

This is a control-plane/database mismatch. Do not pause, restore, or reset the project while the dashboard reports Active. Those actions require either a recoverable backup and Supabase support direction, or an explicit managed recovery procedure from Supabase.

The production web release must continue serving its static last-good fixture and schedule data. Authenticated database features should fail clearly and must not retry in tight loops.

## Submit this support request

Open [Supabase Support](https://supabase.com/dashboard/support/new?projectRef=jljgtodyviwpslprxaao), select the `nothingSport` project, and send:

> Project `jljgtodyviwpslprxaao` is reported as `ACTIVE_HEALTHY` by the management API, but SQL returns `FATAL 57P03: database system is not accepting connections; DETAIL: Hot standby mode is disabled.` We also received the recent disk-I/O budget warning. Please restore the primary database to writable service and confirm whether a managed restore or pause/resume procedure is required. We have not initiated a speculative pause or restore because the control plane still reports Active. Please preserve the current database and advise before any operation that could replace or discard it.

Attach the disk-I/O warning email already retained with the incident evidence. Do not include service keys or database passwords.

## Recovery sequence

1. Confirm the project status immediately before acting. If the dashboard now shows **Paused**, use **Resume project**. If it still shows Active with `57P03`, wait for Supabase support rather than cycling it.
2. After Supabase reports recovery, run a read-only health check:

   ```sql
   select pg_is_in_recovery(), current_setting('transaction_read_only'), now();
   ```

   Continue only when `pg_is_in_recovery()` is false and `transaction_read_only` is `off`.
3. Verify one small transaction can commit and roll back without changing application data.
4. Verify Auth, REST, Storage, and Realtime independently.
5. Take a logical backup before cleanup or migrations. Export the affected preference row separately before repairing the US Open family exclusion.
6. Measure database, WAL, tables, indexes, bloat, and `cron.job_run_details`. Disable high-write schedules for the maintenance window.
7. Compare repository and production migrations. Apply only missing additive migrations, including `20260914061506_right_size_fixture_runtime.sql`.
8. Run security and performance advisors. Resolve exposed-table RLS problems before enabling the client paths.
9. Repair the reported account's US Open family exclusion from its backup and preserve unrelated preference state.
10. Run the canonical refresh through `node scripts/update-cards.js`. Do not invoke a league loader directly.
11. Re-enable exactly one canonical card workflow, one live-fixture scheduler, and one notification dispatcher. Leave overlapping local automations paused.

## Post-recovery proof

Record SQL health, migration versions, backup location, advisor results, scheduler ownership, the US Open preference repair, Auth/REST/Storage/Realtime checks, physical push delivery, and the first 24-hour Supabase/Vercel resource comparison. The release target is at least an 80% reduction in fixture writes, transferred fixture bytes, and invocations without removing accepted product behavior.
