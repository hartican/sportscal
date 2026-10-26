'use strict';
// Disposable local composition of the four observed user-state trigger owners.
// This does not replace or relax the older SELECT-only recovery fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const legacy = require('./public-comment-recovery-coexistence');
const pins = require('../fixtures/public-comment-managed-source-pins.json');
const files = {
  feature: 'supabase/migrations/20261023222545_public_fixture_comments.sql',
  erasure: 'supabase/migrations/20260927144441_guard_account_erasure_writes.sql',
  redaction: 'supabase/migrations/20260927164938_redact_erased_account_audit_snapshots.sql',
  epic: 'supabase/migrations/20261014052040_epic_classics_and_curators.sql',
  reminders: 'supabase/migrations/20261002081559_global_fixture_reminders.sql',
  patch: 'supabase/migrations/20261002104010_bledisloe_future_identity_reconciliation.sql',
  epl: 'supabase/migrations/20261012203115_epl_provider_alias_bridge.sql',
  rugby: 'supabase/migrations/20261002035913_rugby_reviewed_identity_reconciliation.sql',
  columns: 'supabase/migrations/20260901003907_preference_reset_recovery.sql',
  schedule: 'supabase/migrations/20260927160736_reconcile_football_reminder_times.sql',
  baseReminder: 'supabase/follow-first-user-meta-and-notifications.sql',
};
const digest = (text, algorithm = 'md5') => crypto.createHash(algorithm).update(text).digest('hex');
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function statement(source, prefix) {
  const match = source.match(new RegExp(escape(prefix) + '[^;]*;', 'i'));
  assert(match, 'Complete source statement required: ' + prefix);
  return match[0];
}
function functionSource(source, name) {
  const match = source.match(new RegExp('create(?: or replace)? function ' + escape(name) +
    '\\([^)]*\\)[\\s\\S]*?\\bas\\s+(\\$[a-z_0-9]*\\$)([\\s\\S]*?)\\1;', 'i'));
  assert(match, 'Complete literal function required: ' + name);
  return {sql: match[0], body: match[2]};
}
function reminderPatch(original, patch) {
  const branch = patch.split("elsif v_function.proname='nothingsports_sync_reminder_choices' then")[1]?.split('\n  else')[0];
  assert(branch, 'Actual Bledisloe reminder branch required');
  const parts = branch.match(/definition:=replace\(definition,'((?:''|[^'])*)',E'((?:\\.|''|[^'])*)'\);/);
  assert(parts, 'Exact literal reminder replacement required');
  const before = parts[1].replace(/''/g, "'");
  const after = parts[2].replace(/''/g, "'").replace(/\\([\s\S])/g, (_, code) => {
    const escapes = {n: '\n', r: '\r', t: '\t', "'": "'", '\\': '\\'};
    assert(Object.hasOwn(escapes, code), 'Unsupported SQL E-string escape');
    return escapes[code];
  });
  assert.equal(original.sql.split(before).length, 2, 'One source replacement, without repair');
  return functionSource(original.sql.replace(before, after), 'public.nothingsports_sync_reminder_choices');
}
function sources() {
  const text = Object.fromEntries(Object.entries(pins.files).map(([file, expected]) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(digest(source, 'sha256'), expected, 'Observed composition source drift: ' + file);
    return [file, source];
  }));
  const functions = {
    guard: functionSource(text[files.redaction], 'private.nothingsports_guard_erasure_write'),
    purge: functionSource(text[files.epic], 'private.nothingsports_preserve_card_purges'),
    alias: functionSource(text[files.epl], 'nothingsports_recovery.fixture_alias_v1'),
    reminder: reminderPatch(functionSource(text[files.reminders], 'public.nothingsports_sync_reminder_choices'), text[files.patch]),
  };
  for (const [key, name] of Object.entries({guard: 'private.nothingsports_guard_erasure_write()',
    purge: 'private.nothingsports_preserve_card_purges()', alias: 'nothingsports_recovery.fixture_alias_v1(text)',
    reminder: 'public.nothingsports_sync_reminder_choices()'})) {
    assert.equal(digest(functions[key].body), pins.bodies[name], 'Literal body differs from observed catalog: ' + name);
  }
  return {text, functions};
}
function create(db, loaded) {
  const recovery = legacy.create(db);
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  async function install() {
    // Supporting feature tables are synthetic, as in the older SQL harness.
    // The user-state schema, four owner functions/bindings and their helpers are actual source.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
      create table public.nothingsports_nsc_profiles(user_id uuid primary key references auth.users on delete cascade,handle text,visibility text);
      create table public.nothingsports_nsc_personas(user_id uuid primary key references auth.users on delete cascade,moderation_flag boolean);
      create table public.nothingsports_nsc_points(user_id uuid references auth.users on delete cascade,points integer);
      create table public.nothingsports_user_follows(follower_user_id uuid references auth.users on delete cascade,followed_user_id uuid references auth.users on delete cascade);
      create table public.nothingsports_push_installations(installation_id uuid primary key,user_id uuid references auth.users on delete cascade,permission text default 'granted');
      create table public.nothingsports_classic_fixtures(event_id text primary key,fixture jsonb default '{}');
      create table public.nothingsports_personal_classics(user_id uuid references auth.users on delete cascade,event_id text references public.nothingsports_classic_fixtures,primary key(user_id,event_id));
      grant usage on schema public,private to service_role; grant all on all tables in schema public to service_role;`);
    await recovery.install();
    const source = key => loaded.text[files[key]];
    await db.exec(statement(source('baseReminder'), 'create table if not exists public.nothingsports_reminders ('));
    await db.exec(statement(source('schedule'), 'alter table public.nothingsports_reminders add column schedule_checked_at'));
    await db.exec(statement(source('reminders'), 'alter table public.nothingsports_push_installations add column'));
    await db.exec(statement(source('reminders'), 'alter table public.nothingsports_reminders add column'));
    await db.exec(statement(source('reminders'), 'create table public.nothingsports_reminder_intents('));
    await db.exec(statement(source('reminders'), 'create table public.nothingsports_reminder_account_checks('));
    for (const prefix of ['alter table public.nothingsports_reminder_intents enable',
      'alter table public.nothingsports_reminder_intents force',
      'alter table public.nothingsports_reminder_account_checks enable',
      'alter table public.nothingsports_reminder_account_checks force',
      'revoke all on public.nothingsports_reminder_intents,',
      'grant all on public.nothingsports_reminder_intents,']) await db.exec(statement(source('reminders'), prefix));
    await db.exec(source('erasure'));
    await db.exec(loaded.functions.guard.sql);
    await db.exec(loaded.functions.alias.sql);
    await db.exec(legacy.sources().functionRevoke);
    await db.exec(statement(source('rugby'), 'grant usage on schema nothingsports_recovery'));
    await db.exec(statement(source('rugby'), 'grant execute on function nothingsports_recovery.fixture_alias_v1'));
    for (const [key, sourceKey, functionName, triggerName] of [
      ['purge', 'epic', 'private.nothingsports_preserve_card_purges()', 'nothingsports_preserve_card_purges'],
      ['reminder', 'reminders', 'public.nothingsports_sync_reminder_choices()', 'nothingsports_reminder_choices'],
    ]) {
      await db.exec(loaded.functions[key].sql);
      await db.exec(statement(source(sourceKey), 'revoke all on function ' + functionName));
      await db.exec(statement(source(sourceKey), 'create trigger ' + triggerName + ' '));
    }
    // Reproduce the OBSERVED ACL only in this disposable fixture, never in production SQL.
    await db.exec('grant all on public.nothingsports_user_state to service_role');
    await db.exec(statement(source('columns'), 'grant update (preferences, updated_at)'));
  }
  async function fingerprint() {
    return {recovery: await recovery.fingerprint(), columns: await query(`select attname,attacl::text as acl
      from pg_attribute where attrelid='public.nothingsports_user_state'::regclass and attnum>0 and not attisdropped order by attnum`),
    extras: await query(`select n.nspname,p.proname,p.prosrc,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text as acl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where (n.nspname,p.proname) in (('private','nothingsports_preserve_card_purges'),('public','nothingsports_sync_reminder_choices')) order by n.nspname,p.proname`)};
  }
  async function verifyObserved() {
    const before = await fingerprint();
    const acl = text => text.slice(1, -1).split(',').sort();
    assert.deepEqual(acl(before.recovery.table[0].acl), acl(pins.userState.acl), 'Observed broader table ACL reproduced');
    assert.deepEqual(Object.fromEntries(before.columns.filter(x => x.acl).map(x => [x.attname, x.acl])), pins.userState.columnAcls);
    const triggers = await query(`select t.tgname as name,t.tgtype as type,t.tgenabled as enabled,t.tgattr::text as columns,
      encode(t.tgargs,'hex') as args_hex,n.nspname||'.'||p.proname||'()' as function,md5(p.prosrc) as function_body_md5
      from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
      where t.tgrelid='public.nothingsports_user_state'::regclass and not t.tgisinternal order by t.tgname`);
    assert.deepEqual(triggers, pins.userState.triggers, 'All four observed bindings and bodies reproduced');
    for (const fn of before.recovery.recovery) assert.equal(digest(fn.prosrc), pins.bodies['nothingsports_recovery.' + fn.proname + (fn.proname === 'fixture_alias_v1' ? '(text)' : fn.proname === 'cricket_preferences_v1' ? '(jsonb)' : '()')]);
    return before;
  }
  async function preserve(before, saved) {
    const after = await fingerprint();
    await recovery.preserve(before.recovery, saved);
    assert.deepEqual(after.columns, before.columns, 'Column grants unchanged');
    assert.deepEqual(after.extras, before.extras, 'EPIC/reminder owners and ACLs unchanged');
  }
  return {install, fingerprint, verifyObserved, preserve, recovery};
}
module.exports = {pins, files, sources, create};
