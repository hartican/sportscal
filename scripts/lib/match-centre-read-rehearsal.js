"use strict";

const assert = require("node:assert/strict"), fs = require("node:fs");

const model = require("../../config/match-centre");

const {createSnapshotStore: createSnapshotStore} = require("../../lib/live-fixtures");

const {createMatchCentreHandler: createMatchCentreHandler} = require("../../lib/match-centre-handler");

async function run(db) {
  const cases = [];
  const now = Date.now(), at = offset => new Date(now + offset * 6e4).toISOString();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(now));
  const fixture = (id, patch = {}) => ({
    id: id,
    key: "nrl",
    kind: "fixture",
    status: "live",
    date: day,
    startTimeUtc: at(-30),
    statusCheckedAt: at(0),
    scoreCheckedAt: at(0),
    homeParticipantId: "team:nrl:storm",
    awayParticipantId: "team:nrl:panthers",
    homeScore: 0,
    awayScore: 0,
    ...patch
  });
  const digest = async () => (await db.query("select md5(pg_get_functiondef('public.nothingsports_read_match_centre_fixture_bundle(text[])'::regprocedure)) as digest")).rows[0].digest;
  const migration = fs.readFileSync("supabase/migrations/20261012120600_qualify_match_centre_read_candidates.sql", "utf8");
  await db.exec("reset role");
  assert.equal(await digest(), "00ee9b223e92df9c7b34df1924a02697", "Real migration binds to the deployed reader");
  const seed = async events => {
    await db.exec("reset role;truncate public.nothingsports_live_scores,public.nothingsports_fixture_current,public.nothingsports_fixture_snapshots,public.nothingsports_fixture_sources restart identity cascade;");
    const receipts = Object.fromEntries(events.map(e => [ e.id, {
      s: e.scoreCheckedAt,
      t: e.statusCheckedAt
    } ]));
    await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report) values('efficiency-test',$1::jsonb)", [ JSON.stringify({
      _fixtureObservations: receipts
    }) ]);
    await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash) select 'efficiency-test',e->>'id',array[e->>'id','alias:'||(e->>'id')],e,md5(e::text) from jsonb_array_elements($1::jsonb) e", [ JSON.stringify(events) ]);
  };
  const read = async (ids = [], name = "nothingsports_read_match_centre_fixture_bundle") => (await db.query("select public." + name + "($1) as value", [ ids ])).rows[0].value;
  const test = async (name, fn) => {
    await fn();
    cases.push(name);
  };
  const requestFor = (calls = []) => async (route, {body, timeoutMs}) => {
    calls.push(route);
    assert.equal(timeoutMs,3000,"The real caller retains its read deadline");
    const name=route.split("/").at(-1);
    assert(["nothingsports_read_fixture_source_health","nothingsports_read_match_centre_fixture_bundle","nothingsports_read_match_scores"].includes(name),"Unexpected RPC in the actual handler");
    const ids=body.p_membership_ids!==undefined?body.p_membership_ids:body.p_fixture_ids;
    const rows=(await db.query("select * from public."+name+"("+(ids!==undefined?"$1":"")+")",ids!==undefined?[ids]:[])).rows;
    return name.endsWith("_fixture_bundle")?rows[0][name]:rows;
  };
  const noise = Array.from({
    length: 1200
  }, (_, i) => fixture("calendar:" + i, {
    status: "scheduled",
    startTimeUtc: null,
    timeTbc: true,
    context: "unrelated".repeat(180)
  }));
  await seed([ ...noise, fixture("current") ]);
  const old = await read();
  assert.equal(old.rows.length, 1201);
  assert.equal(model.select(old.rows.map(r => r.fixture), now).length, 1, "The old overfetch is not needed for actual membership");
  assert(Buffer.byteLength(JSON.stringify(old)) > 15e5, "Controlled old response reproduces excessive read data");
  await db.exec("begin");
  await db.exec(migration);
  await db.exec("commit");
  await test("guarded replacement rejects unreviewed definitions and rolls back", async () => {
    const before = await digest();
    await db.exec("begin");
    await assert.rejects(db.exec(migration), /differs from reviewed baseline/);
    await db.exec("rollback");
    assert.equal(await digest(), before);
  });
  await test("calendar-only rows do not inflate current membership; global and selected readers retain them", async () => {
    const result = await read();
    assert.equal(result.complete, true);
    assert.deepEqual(result.rows.map(r => r.fixture.id), [ "current" ]);
    assert(Buffer.byteLength(JSON.stringify(result)) < 1e4);
    const global = (await db.query("select public.nothingsports_read_current_fixture_bundle(null) as value")).rows[0].value;
    assert(global.rows.some(r => r.fixture.id === "calendar:0"));
    const selected = (await db.query("select * from public.nothingsports_read_current_fixtures(array['calendar:0'])")).rows;
    assert.equal(selected[0].fixture.id, "calendar:0");
  });
  await test("all explicit underway and pause states remain, including unknown clocks and old dates", async () => {
    const states = [ "live", "in-progress", "in_progress", "stumps", "suspended", "interrupted", "delayed", "rain-delay", "break", "ongoing" ];
    await seed(states.map((status, i) => fixture("playing:" + i, {
      status: status,
      date: "2020-01-01",
      startTimeUtc: null
    })));
    assert.equal((await read()).rows.length, states.length);
  });
  await test("a new source-announced start twenty minutes away survives without a published ID", async () => {
    await seed([ fixture("near", {
      status: "scheduled",
      startTimeUtc: at(20)
    }), fixture("far", {
      status: "upcoming",
      startTimeUtc: at(120)
    }) ]);
    assert.deepEqual((await read()).rows.map(r => r.fixture.id), [ "near" ]);
  });
  await test("valid offset clocks and the thirty-one-minute conservative boundary remain", async () => {
    await seed([ fixture("offset", {
      status: "upcoming",
      startTimeUtc: at(20).replace("Z", "+00:00")
    }), fixture("boundary", {
      status: "scheduled",
      startTimeUtc: at(30.5)
    }), fixture("outside", {
      status: "scheduled",
      startTimeUtc: at(32)
    }) ]);
    assert.deepEqual((await read()).rows.map(r => r.fixture.id).sort(), [ "boundary", "offset" ]);
  });
  await test("uncertain nonempty clocks remain for model qualification; missing clocks and elapsed starts do not create membership", async () => {
    await seed([ null, "2026-02-30T12:00:00Z", "2099-01-01T12:00:00", at(-10) ].map((startTimeUtc, i) => fixture("unknown:" + i, {
      status: "scheduled",
      startTimeUtc: startTimeUtc,
      timeTbc: true
    })));
    const result = await read();
    assert.deepEqual(result.rows.map(r => r.fixture.id), [ "unknown:1", "unknown:2" ]);
    assert.deepEqual(model.select(result.rows.map(r => r.fixture), now), []);
  });
  await test("supported alternate ISO clocks remain for the shared classifier", async () => {
    const shortStart = at(20).replace(/:\d{2}[.]\d{3}Z$/, "Z");
    const shortFinal = at(-30).replace(/:\d{2}[.]\d{3}Z$/, "Z");
    await seed([ fixture("short-start", {
      status: "scheduled",
      startTimeUtc: shortStart
    }), fixture("short-final", {
      status: "completed",
      completedAt: shortFinal,
      statusCheckedAt: at(-120)
    }) ]);
    const result = await read();
    assert.equal(result.rows.length, 2);
    assert.equal(model.select(result.rows.map(r => r.fixture), now).length, 2);
  });
  await test("known ID and alias corrections remain even outside the current window", async () => {
    await seed([ fixture("moved", {
      status: "scheduled",
      startTimeUtc: at(120)
    }), fixture("cancelled", {
      status: "cancelled"
    }), fixture("unknown", {
      status: "unreviewed",
      startTimeUtc: null
    }), fixture("expired", {
      status: "completed",
      completedAt: at(-120),
      statusCheckedAt: at(-120)
    }) ]);
    const ids = [ "alias:moved", "cancelled", "alias:unknown", "expired" ];
    assert.deepEqual((await read(ids)).rows.map(r => r.fixture.id).sort(), [ "cancelled", "expired", "moved", "unknown" ]);
  });
  await test("old results stay off the current transfer; genuine recent zero-score finals remain", async () => {
    await seed([ fixture("old-final", {
      status: "completed",
      completedAt: at(-120),
      statusCheckedAt: at(-120)
    }), fixture("recent-final", {
      status: "final",
      completedAt: at(-30),
      statusCheckedAt: at(-30)
    }) ]);
    const result = await read();
    assert.deepEqual(result.rows.map(r => r.fixture.id), [ "recent-final" ]);
    assert.equal(result.rows[0].fixture.homeScore, 0);
  });
  await test("all independent completion evidence is retained conservatively", async () => {
    const fields = [ "actualEndTimeUtc", "completedAt", "firstConfirmedCompleteAt", "resultPublishedAt", "statusCheckedAt" ];
    await seed(fields.map((field, i) => fixture("complete:" + i, {
      status: "completed",
      statusCheckedAt: at(-120),
      [field]: at(-30)
    })));
    assert.equal((await read()).rows.length, fields.length);
  });
  await test("stored first-completion evidence survives old fixture clocks", async () => {
    await seed([ fixture("column-final", {
      status: "finished",
      statusCheckedAt: at(-120)
    }) ]);
    await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('efficiency-test','column-final','{}','score',$1::timestamptz)", [ at(-30) ]);
    assert.equal((await read()).rows[0].fixture.id, "column-final");
  });
  await test("score overrides qualify newly timed starts and remove a moved kickoff", async () => {
    await seed([ fixture("score-near", {
      status: "scheduled",
      startTimeUtc: at(120)
    }), fixture("score-far", {
      status: "scheduled",
      startTimeUtc: at(20)
    }) ]);
    for (const [id, offset] of [ [ "score-near", 20 ], [ "score-far", 120 ] ]) await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('efficiency-test',$1,$2::jsonb,'score')", [ id, JSON.stringify({
      id: id,
      startTimeUtc: at(offset)
    }) ]);
    assert.deepEqual((await read()).rows.map(r => r.fixture.id), [ "score-near" ]);
    assert.equal((await read([ "score-far" ])).rows.length, 2);
  });
  await test("effective score status wins and an explicit null clock withdraws a start", async () => {
    await seed([ fixture("became-live", {
      status: "scheduled",
      startTimeUtc: at(120)
    }), fixture("became-upcoming"), fixture("withdrawn-clock", {
      status: "scheduled",
      startTimeUtc: at(20)
    }) ]);
    const values = [ [ "became-live", {
      id: "became-live",
      status: "live"
    } ], [ "became-upcoming", {
      id: "became-upcoming",
      status: "upcoming",
      startTimeUtc: at(120)
    } ], [ "withdrawn-clock", {
      id: "withdrawn-clock",
      startTimeUtc: null
    } ] ];
    for (const [id, score] of values) await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('efficiency-test',$1,$2::jsonb,'score')", [ id, JSON.stringify(score) ]);
    assert.deepEqual((await read()).rows.map(r => r.fixture.id), [ "became-live" ]);
    const preserved = await read([ "became-upcoming", "withdrawn-clock" ]);
    assert.equal(preserved.rows.length, 3);
    assert.equal(preserved.rows.find(r => r.fixture.id === "withdrawn-clock").fixture.startTimeUtc, null);
  });
  await test("invalid timestamps do not throw or manufacture a final", async () => {
    await seed([ fixture("invalid-final", {
      status: "completed",
      completedAt: "2026-02-30T12:00:00Z",
      statusCheckedAt: null,
      resultPublishedAt: "garbage"
    }), fixture("valid-live") ]);
    const result = await read();
    assert.deepEqual(result.rows.map(r => r.fixture.id), [ "invalid-final", "valid-live" ]);
    assert.deepEqual(model.select(result.rows.map(r => r.fixture), now).map(model.id), [ "valid-live" ]);
  });
  await test("selected fields, IDs, zero scores, fact dates and source verification stay unchanged", async () => {
    await seed([ fixture("exact", {
      statusCheckedAt: at(-2),
      scoreCheckedAt: at(-2),
      participants: [ {
        id: "team:nrl:storm",
        name: "Storm"
      } ],
      fixtureIdAliases: [ "legacy:exact" ],
      sourceUrl: "https://example.test/official",
      storyline: {
        stakes: 4,
        hookSpoilerOn: "private recap"
      }
    }) ]);
    const legacy = await read([], "qa_reference_match_centre_bundle"), result = await read();
    assert.deepEqual(result, legacy);
    assert.equal(result.rows[0].fixture.storyline.hookSpoilerOn, undefined);
    assert.equal(Date.parse(result.rows[0].fixture.statusFactObservedAt), Date.parse(at(-2)));
    const before = (await db.query("select fixture,content_hash,updated_at from public.nothingsports_fixture_current")).rows;
    await read();
    assert.deepEqual((await db.query("select fixture,content_hash,updated_at from public.nothingsports_fixture_current")).rows, before);
  });
  await test("actual handler/store uses two membership reads, complete identities and unchanged selected scores", async () => {
    await seed([ fixture("actual-current"), ...noise ]);
    await db.exec("set role service_role");
    const calls = [];
    const request = requestFor(calls);
    const store = createSnapshotStore({
      request: request
    }), response = () => ({
      setHeader() {},
      status() {
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    });
    const handler = createMatchCentreHandler({
      enabled: () => true,
      clock: () => now,
      published: () => [],
      request: request,
      snapshotRead: async options => ({
        sources: await store.read(options),
        readAt: now,
        stale: false
      })
    });
    const listing = response();
    await handler({
      url: "/api/match-centre?membership=everything"
    }, listing);
    assert.equal(listing.body.membershipStale, false);
    assert.deepEqual(listing.body.fixtures.map(f => f.id), [ "actual-current" ]);
    assert.equal(calls.length, 2);
    calls.length = 0;
    const selected = response();
    await handler({
      url: "/api/match-centre?ids=actual-current"
    }, selected);
    assert.equal(calls.length, 1);
    assert.deepEqual(selected.body.fixtures, listing.body.fixtures);
    await db.exec("reset role");
  });
  await test("cancelled known correction removes an old published starting-soon member", async () => {
    const old = fixture("cancelled-known", {
      status: "scheduled",
      startTimeUtc: at(20)
    });
    await seed([ {
      ...old,
      status: "cancelled"
    } ]);
    const store = createSnapshotStore({request:requestFor()});
    const response = {
      setHeader() {},
      status() {
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      }
    };
    const handler = createMatchCentreHandler({
      enabled: () => true,
      clock: () => now,
      published: () => [ old ],
      snapshotRead: async options => ({
        sources: await store.read(options),
        readAt: now,
        stale: false
      }),
      request: () => {
        throw Error("Unexpected additional read");
      }
    });
    await handler({
      url: "/api/match-centre?membership=everything"
    }, response);
    assert.equal(response.body.membershipStale, false);
    assert.deepEqual(response.body.fixtures, []);
  });
  await test("no current matches is a complete quiet result", async () => {
    await seed(noise);
    const result = await read();
    assert.equal(result.complete, true);
    assert.deepEqual(result.rows, []);
  });
  await test("real current overflow retains the five-thousand-and-one incomplete sentinel", async () => {
    await seed(Array.from({
      length: 5002
    }, (_, i) => fixture("overflow:" + i)));
    const result = await read();
    assert.equal(result.complete, false);
    assert.equal(result.rows.length, 5001);
  });
  await test("oversized preservation input fails closed without a truncated healthy result", async () => {
    const result = await read(Array.from({
      length: 5001
    }, (_, i) => "known:" + i));
    assert.equal(result.complete, false);
    assert.deepEqual(result.rows, []);
  });
  await test("anonymous/authenticated callers remain denied and service-only access survives", async () => {
    for (const role of [ "anon", "authenticated" ]) {
      await db.exec("set role " + role);
      await assert.rejects(read(), /permission denied for function/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal((await read()).complete, false);
    await db.exec("reset role");
  });
  await test("restoring the reviewed reader preserves facts and service-only rights", async () => {
    const nextDigest=await digest();
    const before=(await db.query("select fixture,content_hash,updated_at from public.nothingsports_fixture_current order by fixture_id")).rows;
    await db.exec(fs.readFileSync("supabase/migrations/20261010140637_materialize_match_centre_read_receipts.sql","utf8"));
    assert.equal(await digest(),"00ee9b223e92df9c7b34df1924a02697");
    assert.equal((await db.query("select has_function_privilege('service_role','public.nothingsports_read_match_centre_fixture_bundle(text[])','execute') as allowed")).rows[0].allowed,true);
    assert.deepEqual((await db.query("select fixture,content_hash,updated_at from public.nothingsports_fixture_current order by fixture_id")).rows,before);
    await db.exec("begin");await db.exec(migration);await db.exec("commit");assert.equal(await digest(),nextDigest);
  });
  console.log(JSON.stringify({
    schemaVersion: "match-centre-read-efficiency-regression.v1",
    readerDigest: await digest(),
    passed: cases.length,
    cases: cases,
    originalNoiseRows: old.rows.length,
    originalBytes: Buffer.byteLength(JSON.stringify(old)),
    limits: "Synthetic real-schema/function/handler mechanics. Not production concurrency, cold latency, phone or whole-sport proof."
  }));
}

module.exports = {
  run: run
};
