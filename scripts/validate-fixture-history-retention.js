#!/usr/bin/env node
// Regression for the existing publisher's seven-day disposable history policy.
"use strict";

const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");

const migrations = path.join(root, "supabase/migrations");

const baselineFile = path.join(migrations, "20261010140633_align_live_source_refresh_cadence.sql");

const migrationFile = path.join(migrations, "20261012113815_expire_unchanged_fixture_history.sql");

const {PGlite: PGlite} = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");

const mode = process.argv.includes("--baseline") ? "baseline" : "migration";

assert(process.argv.slice(2).every(arg => arg === "--baseline"), "Unknown retention validation argument");

const token = "11111111-1111-4111-8111-111111111111", fixtures = [ {
  id: "retention-fixture",
  status: "scheduled",
  sourceCheckedAt: "2026-10-01T10:00:00Z",
  identity_keys: [ "retention-fixture" ]
} ], cases = [];

(async () => {
  const db = await PGlite.create("memory://");
  try {
    // Only synthetic in-memory objects. The real schema and reviewed baseline
    // migrations supply permissions, indexes and function dependencies.
    await db.exec("set timezone='UTC';create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
    for (const name of [ "20260908093906_live_fixture_snapshots.sql", "20260908110529_discovery_source_health.sql" ]) await db.exec(fs.readFileSync(path.join(migrations, name), "utf8"));
    await db.exec(fs.readFileSync(path.join(migrations, "20260914061506_right_size_fixture_runtime.sql"), "utf8").split("-- One write replaces")[0]);
    await db.exec(fs.readFileSync(baselineFile, "utf8"));
    await db.exec("create table public.retention_mock_user_activity(id int primary key,value text);insert into public.retention_mock_user_activity values(1,'keep-user-activity');");
    if (mode !== "baseline") {
      const migration = fs.readFileSync(migrationFile, "utf8");
      await db.exec("begin");
      await db.exec(migration);
      await db.exec("commit");
      const access = (await db.query("select has_function_privilege('anon','public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as anon, has_function_privilege('authenticated','public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as authenticated, has_function_privilege('service_role','public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as service")).rows[0];
      assert.deepEqual(access, {
        anon: false,
        authenticated: false,
        service: true
      });
      cases.push({
        name: "actual guarded migration preserves existing execution privileges",
        passed: true
      });
      const digest = async () => (await db.query("select md5(pg_get_functiondef('public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)'::regprocedure)) as md5")).rows[0].md5;
      const before = await digest();
      await db.exec("begin");
      await assert.rejects(db.exec(migration), /differs from reviewed baseline/);
      await db.exec("rollback");
      assert.equal(await digest(), before);
      cases.push({
        name: "changed publisher binding refuses replacement and rolls back",
        passed: true
      });
    }
    const seed = async ({expiredLatest: expiredLatest = false, current: current = 2, missing: missing = false} = {}) => {
      await db.exec("truncate public.nothingsports_fixture_snapshots,public.nothingsports_fixture_sources,public.nothingsports_fixture_current restart identity cascade;");
      await db.query("insert into public.nothingsports_fixture_sources(source_id,revision,fixtures,content_hash,checked_at,next_due_at,lease_token,lease_until,failure_count) values('retention-source',$1,$2::jsonb,'same-hash',now()-interval '1 hour',now(),$3,now()+interval '90 seconds',2)", [ current, JSON.stringify(fixtures), token ]);
      if (!missing) {
        await db.query("insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash,published_at) values('retention-source',$1::jsonb,'old-hash',now()-interval '8 days'),('retention-source',$1::jsonb,'same-hash',now()-$2::interval)", [ JSON.stringify(fixtures), expiredLatest ? "8 days" : "1 day" ]);
      }
      await db.query("insert into public.nothingsports_fixture_current values('retention-source','retention-fixture',array['retention-fixture'],$1::jsonb,'fixture-hash',now()-interval '1 hour')", [ JSON.stringify(fixtures[0]) ]);
    };
    const publish = (p = fixtures, hash = "same-hash", tok = token, interval = 12e4) => db.query("select public.nothingsports_publish_fixture_source($1,$2,$3::jsonb,$4,$5) as revision", [ "retention-source", tok, JSON.stringify(p), hash, interval ]);
    const source = async () => (await db.query("select * from public.nothingsports_fixture_sources where source_id='retention-source'")).rows[0];
    const current = async () => (await db.query("select * from public.nothingsports_fixture_current order by fixture_id")).rows;
    const revisions = async () => (await db.query("select revision from public.nothingsports_fixture_snapshots order by revision")).rows.map(r => Number(r.revision));
    const renew = () => db.query("update public.nothingsports_fixture_sources set lease_token=$1,lease_until=now()+interval '90 seconds'", [ token ]);
    const test = async (name, run) => {
      await run();
      cases.push({
        name: name,
        passed: true
      });
    };
    await test("unchanged success prunes expired history without a new revision or current-fact mutation", async () => {
      await seed();
      const before = await current();
      const old = await source(), r = await publish();
      assert.equal(Number(r.rows[0].revision), 2);
      assert.deepEqual(await revisions(), [ 2 ]);
      assert.deepEqual(await current(), before);
      const after = await source();
      assert.deepEqual(after.fixtures, old.fixtures);
      assert.equal(after.content_hash, old.content_hash);
      assert.equal(after.failure_count, 0);
      assert.equal(after.lease_token, null);
      assert(+after.checked_at > +old.checked_at);
      assert(after.next_due_at > after.checked_at);
    });
    if (mode === "baseline") throw new Error("The unchanged baseline unexpectedly passed the retention regression");
    await test("old latest and referenced current history survive", async () => {
      await seed({
        expiredLatest: true
      });
      await publish();
      assert.deepEqual(await revisions(), [ 2 ]);
    });
    await test("a later saved snapshot and current revision are both protected", async () => {
      await seed({
        expiredLatest: true,
        current: 1
      });
      await publish();
      assert.deepEqual(await revisions(), [ 1, 2 ]);
    });
    await test("changed success updates current facts and retains recent history", async () => {
      await seed();
      await publish([ {
        ...fixtures[0],
        status: "completed",
        score: {
          home: 0,
          away: 1
        }
      } ], "changed-hash");
      assert.deepEqual(await revisions(), [ 2, 3 ]);
      const s = await source();
      assert.equal(Number(s.revision), 3);
      assert.equal(s.fixtures[0].score.home, 0);
      assert.equal((await current())[0].fixture.score.away, 1);
    });
    await test("invalid lease cannot prune or alter data", async () => {
      await seed();
      const before = await source();
      await assert.rejects(publish(fixtures, "same-hash", "22222222-2222-4222-8222-222222222222"), /Lease expired/);
      assert.deepEqual(await revisions(), [ 1, 2 ]);
      assert.deepEqual(await source(), before);
    });
    await test("expired lease cannot prune or alter data", async () => {
      await seed();
      await db.exec("update public.nothingsports_fixture_sources set lease_until=now()-interval '1 second'");
      const before = await source();
      await assert.rejects(publish(), /Lease expired/);
      assert.deepEqual(await revisions(), [ 1, 2 ]);
      assert.deepEqual(await source(), before);
    });
    await test("invalid input fails before cleanup", async () => {
      await seed();
      const before = await source();
      await assert.rejects(publish({
        invalid: true
      }), /Invalid snapshot/);
      assert.deepEqual(await revisions(), [ 1, 2 ]);
      assert.deepEqual(await source(), before);
    });
    await test("empty primary response preserves last-good data and history", async () => {
      await seed();
      await assert.rejects(publish([]), /Invalid snapshot/);
      assert.deepEqual(await revisions(), [ 1, 2 ]);
      assert.deepEqual((await source()).fixtures, fixtures);
    });
    await test("missing historical copy does not fabricate a revision", async () => {
      await seed({
        missing: true
      });
      const before = await current();
      await publish();
      assert.deepEqual(await revisions(), []);
      assert.deepEqual(await current(), before);
      assert.equal(Number((await source()).revision), 2);
    });
    await test("age boundary retains inside seven days and removes outside", async () => {
      await seed();
      await db.query("insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash,published_at) values('retention-source',$1::jsonb,'inside',now()-interval '7 days'+interval '1 minute'),('retention-source',$1::jsonb,'outside',now()-interval '7 days'-interval '1 minute'),('retention-source',$1::jsonb,'last',now())", [ JSON.stringify(fixtures) ]);
      await publish();
      assert.deepEqual(await revisions(), [ 2, 3, 5 ]);
    });
    await test("other sources and user activity remain untouched", async () => {
      await seed();
      await db.query("insert into public.nothingsports_fixture_sources(source_id,revision,fixtures,content_hash,checked_at,next_due_at,lease_token,lease_until,failure_count) values('other-source',8,$1::jsonb,'other',now(),now(),null,null,0)", [ JSON.stringify(fixtures) ]);
      await db.query("insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash,published_at) values('other-source',$1::jsonb,'other',now()-interval '30 days')", [ JSON.stringify(fixtures) ]);
      await publish();
      assert.equal(Number((await db.query("select count(*) as n from public.nothingsports_fixture_snapshots where source_id='other-source'")).rows[0].n), 1);
      assert.equal((await db.query("select value from public.retention_mock_user_activity")).rows[0].value, "keep-user-activity");
    });
    await test("unchanged reruns retain the same keeper and fact values", async () => {
      await seed();
      await publish();
      const before = await current();
      await renew();
      await publish();
      assert.deepEqual(await revisions(), [ 2 ]);
      assert.deepEqual(await current(), before);
    });
    await test("quiet interval timing remains bounded by the original contract", async () => {
      await seed();
      await publish(fixtures, "same-hash", token, 18e5);
      const s = await source();
      const gap = (+s.next_due_at - +s.checked_at) / 1e3;
      assert(gap >= 1799 && gap <= 1801);
    });
    await test("cleanup is limited to sixty-four copies per accepted check", async () => {
      await seed();
      await db.query("insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash,published_at) select 'retention-source',$1::jsonb,'expired-'||g,now()-interval '8 days' from generate_series(1,100) g", [ JSON.stringify(fixtures) ]);
      await publish();
      assert.equal((await revisions()).length, 38);
      assert((await revisions()).includes(2));
      assert((await revisions()).includes(102));
    });
    await test("cleanup is limited to four MiB of stored payload per check", async () => {
      await seed();
      await db.query("insert into public.nothingsports_fixture_snapshots(source_id,fixtures,content_hash,published_at) select 'retention-source',jsonb_build_array(jsonb_build_object('id','copy','blob',v)),'large-'||g,now()-interval '8 days' from (select string_agg(md5(x::text),'') as v from generate_series(1,16384) x) noise cross join generate_series(1,30) g");
      const before = Number((await db.query("select sum(pg_column_size(fixtures)) as bytes from public.nothingsports_fixture_snapshots")).rows[0].bytes);
      assert(before > 4194304, "fixture must exceed the byte budget");
      await publish();
      const after = Number((await db.query("select sum(pg_column_size(fixtures)) as bytes from public.nothingsports_fixture_snapshots")).rows[0].bytes);
      assert(before - after > 0 && before - after <= 4194304);
      assert((await revisions()).length > 2);
      assert((await revisions()).includes(2));
      assert((await revisions()).includes(32));
    });
    await test("the existing service role can run cleanup while public callers are denied", async () => {
      await seed();
      for (const role of [ "anon", "authenticated" ]) {
        await db.exec("set role " + role);
        try {
          await assert.rejects(publish(), /permission denied for function/);
        } finally {
          await db.exec("reset role");
        }
      }
      await db.exec("set role service_role");
      try {
        await publish();
      } finally {
        await db.exec("reset role");
      }
      assert.deepEqual(await revisions(), [ 2 ]);
    });
    await test("ordinary source failure retains facts and all history", async () => {
      await seed();
      const before = await current();
      await db.query("select public.nothingsports_fail_fixture_source($1,$2,$3)", [ "retention-source", token, 3e5 ]);
      assert.deepEqual(await revisions(), [ 1, 2 ]);
      assert.deepEqual(await current(), before);
      assert.equal((await source()).failure_count, 3);
    });
    await test("restoring the reviewed publisher preserves retained facts and caller permissions", async () => {
      await seed();
      await publish();
      const before = await current();
      await db.exec(fs.readFileSync(baselineFile, "utf8"));
      assert.equal((await db.query("select md5(pg_get_functiondef('public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)'::regprocedure)) as digest")).rows[0].digest, "4e6cd3c84f8a2211d04e1f271540451f");
      assert.equal((await db.query("select has_function_privilege('service_role','public.nothingsports_publish_fixture_source(text,uuid,jsonb,text,integer)','execute') as allowed")).rows[0].allowed, true);
      await renew();
      await publish();
      assert.deepEqual(await revisions(), [ 2 ]);
      assert.deepEqual(await current(), before);
    });
    console.log(JSON.stringify({
      mode: mode,
      passed: cases.length,
      postgres: (await db.query("select version() as version")).rows[0].version,
      limits: [ "In-memory PostgreSQL regression using real schema/migrations; not production concurrency, full recovery, physical space reclamation or a natural scheduled run.", "No network, provider, customer data or production operation." ]
    }));
  } finally {
    await db.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
