# Supabase recovery runbook

Last verified: 14 September 2026

Project: `jljgtodyviwpslprxaao` (`nothingSport`, Sydney)

## Owner recovery preference — 14 September 2026

Restoring service is more important than preserving the most recent database changes. Recent follows, ratings, chat activity, reminders, notification registrations and similar user-state changes may be recreated if recovery requires an older physical snapshot. Preserve the repository, static published data and configuration, but do not delay a practical free-tier recovery solely to protect recent database writes.

## Incident progression — 14 September 2026

An ordinary **Restart project** was attempted. During the restart, the dashboard reported `Database process is down` and `HostOutOfDiskSpace (critical, /data)`. The initial TCP failure briefly cleared, but SQL continued alternating between `ECONNRESET` and `ECONNREFUSED` while the management API returned `ACTIVE_HEALTHY`. Treat that combination as a failed restart and database crash loop. Under the owner recovery preference, proceed to the normal free-tier pause and restore flow rather than repeatedly restarting the project.

## Current incident boundary

The Supabase management API reports `ACTIVE_HEALTHY`, while every SQL request returns:

```text
FATAL 57P03: the database system is not accepting connections
DETAIL: Hot standby mode is disabled.
```

This is a control-plane/database mismatch. Do not begin with pause, restore, or reset while the dashboard reports Active. Attempt one ordinary project restart first. A pause and restore is the next fallback only under the recorded owner preference and through Supabase's normal free-tier dashboard flow.

First use **Restart project** from Project Settings. This restarts the existing project services without deliberately selecting an older backup. If it does not restore writable SQL, a free-tier pause and restore is an accepted fallback under the owner preference above. Record the status and error before starting it, then use only the dashboard's normal **Pause project** and **Resume/Restore project** flow.

The production web release must continue serving its static last-good fixture and schedule data. Authenticated database features should fail clearly and must not retry in tight loops.

## Submit this support request

Open [Supabase Support](https://supabase.com/dashboard/support/new?projectRef=jljgtodyviwpslprxaao), select the `nothingSport` project, and send:

> Project `jljgtodyviwpslprxaao` is reported as `ACTIVE_HEALTHY` by the management API, but SQL returns `FATAL 57P03: database system is not accepting connections; DETAIL: Hot standby mode is disabled.` We also received the recent disk-I/O budget warning. Please restore the primary database to writable service and confirm whether a managed restore or pause/resume procedure is required. We have not initiated a speculative pause or restore because the control plane still reports Active. Please preserve the current database and advise before any operation that could replace or discard it.

Attach the disk-I/O warning email already retained with the incident evidence. Do not include service keys or database passwords.

## Recovery sequence

1. Confirm the project status immediately before acting. If it shows Active with `57P03`, use **Restart project** once and allow the restart to complete. If the dashboard already shows **Paused**, use **Resume project**.
2. Test SQL after the restart. If the same error remains, use the dashboard's free-tier **Pause project** followed by **Resume/Restore project** flow. This may restore from a physical snapshot and can lose recent database changes; that tradeoff is explicitly accepted for this MVP. Do not delete the project or create a replacement unless separately approved.
3. After Supabase reports recovery, run a read-only health check:

   ```sql
   select pg_is_in_recovery(), current_setting('transaction_read_only'), now();
   ```

   Continue only when `pg_is_in_recovery()` is false and `transaction_read_only` is `off`.
4. Verify one small transaction can commit and roll back without changing application data.
5. Verify Auth, REST, Storage, and Realtime independently.
6. Take a logical backup of the recovered state before cleanup or migrations. Export the affected preference row separately before repairing the US Open family exclusion.
7. Measure database, WAL, tables, indexes, bloat, and `cron.job_run_details`. Disable high-write schedules for the maintenance window.
8. Compare repository and production migrations. Apply only missing additive migrations, including `20260914061506_right_size_fixture_runtime.sql`.
9. Run security and performance advisors. Resolve exposed-table RLS problems before enabling the client paths.
10. Repair the reported account's US Open family exclusion from its backup and preserve unrelated preference state.
11. Run the canonical refresh through `node scripts/update-cards.js`. Do not invoke a league loader directly.
12. Re-enable exactly one canonical card workflow, one live-fixture scheduler, and one notification dispatcher. Leave overlapping local automations paused.

## Post-recovery proof

Record SQL health, migration versions, backup location, advisor results, scheduler ownership, the US Open preference repair, Auth/REST/Storage/Realtime checks, physical push delivery, and the first 24-hour Supabase/Vercel resource comparison. The release target is at least an 80% reduction in fixture writes, transferred fixture bytes, and invocations without removing accepted product behavior.
