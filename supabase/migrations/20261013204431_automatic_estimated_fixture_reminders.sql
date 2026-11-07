-- Allow server-validated sourced estimates under the existing reminder owner.
-- No account backfill, settings changes, extra scheduler or delivery replay.
set local lock_timeout='2s';
set local statement_timeout='15s';
alter table public.nothingsports_reminders drop constraint nothingsports_reminders_timing_precision_check;
alter table public.nothingsports_reminders add constraint nothingsports_reminders_timing_precision_check check(timing_precision in('exact','not-before','estimated'));
do $migration$
declare body text;old text;begin
 body:=pg_get_functiondef('public.nothingsports_reconcile_reminder_accounts(jsonb)'::regprocedure);
 old:=' or (f.precision=''estimated'' and f.choice<>''on'')';
 if strpos(body,old)=0 then raise exception 'Unexpected reminder account policy';end if;
 execute replace(body,old,'');
 body:=pg_get_functiondef('public.nothingsports_reconcile_reminder_schedules(jsonb)'::regprocedure);
 old:='if item.new_precision=''estimated'' and r.reminder_origin<>''manual'' then raise exception ''Estimated timing requires manual intent'';end if;';
 if strpos(body,old)=0 then raise exception 'Unexpected reminder schedule policy';end if;
 execute replace(body,old,'');
end $migration$;
-- Existing service-only function grants, locks, revision checks, budgets,
-- installation/OFF/erasure guards and sent-receipt protections are unchanged.
