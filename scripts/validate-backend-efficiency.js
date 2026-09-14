#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const {createSnapshotStore}=require("../lib/live-fixtures");

const read=path=>fs.readFileSync(path,"utf8");

async function main(){
  const calls=[];
  const store=createSnapshotStore({request:async(path,options={})=>{
    calls.push({path,options});
    if(path.includes("select=source_id,revision,checked_at"))return [{source_id:"f1",revision:9,checked_at:"2026-09-14T00:00:00Z"}];
    if(path.endsWith("/rpc/nothingsports_read_current_fixtures"))return [
      {source_id:"f1",fixture_id:"race",identity_keys:["race"],fixture:{id:"race",status:"live"}},
    ];
    throw new Error(`Unexpected store request: ${path}`);
  }});
  const rows=await store.read({ids:["race"]});
  assert.deepEqual(rows[0].fixtures,[{id:"race",status:"live"}]);
  assert(calls.some(call=>call.path.endsWith("/rpc/nothingsports_read_current_fixtures")&&call.options.timeoutMs===3000));
  assert(!calls.some(call=>call.path.includes("revision,fixtures")),"normal visible-card reads must not fetch full source JSON");

  const source=read("lib/live-fixtures.js");
  const handler=read("lib/live-fixture-handler.js");
  const html=read("index.html");
  const chat=read("config/chat-contract.js");
  const score=read("config/nothingscore.js");
  const alerts=read("lib/live-rating-alerts.js");
  const migration=read("supabase/migrations/20260914061506_right_size_fixture_runtime.sql");
  const cron=read("supabase/enable-live-fixture-cron.sql");
  const workflow=read(".github/workflows/canonical-card-refresh.yml");

  assert.match(source,/const known=store\.dueIds\?await store\.dueIds\(\):\[\]/,"a database outage must fail once instead of claiming every source");
  assert.match(handler,/s-maxage=30, stale-while-revalidate=300/);
  assert.match(handler,/snapshot=\{sources:\[\],revision:'published-fallback'/,"the static library must remain available without Supabase");
  assert.match(html,/setInterval\(\(\)=>void refreshLiveFixtureSnapshot\(\),120000\)/);
  assert.match(html,/Date\.now\(\)-liveFixtureLastRequestedAt<30_000/);
  assert.deepEqual(require("../config/chat-contract").POLLING,{roomMs:5000,quietMs:30000,quietAfterMs:60000,activeMs:30000,failureMs:30000});
  assert.equal(require("../config/nothingscore").PRESENCE_TTL_MS,10*60*1000);
  assert.match(html,/scheduleNothingscoreHeartbeat\(60_000\)/,"the first confirmation must remain one minute after entry");
  assert.match(html,/5\*60_000/,"confirmed watching must settle to five-minute heartbeats");
  assert(alerts.indexOf("if(!alerts.length)")<alerts.indexOf("await api.refreshEventSnapshots()"),"an empty EPIC outbox must not rebuild event snapshots");
  assert.match(migration,/nothingsports_fixture_current/);
  assert.match(migration,/current_row\.content_hash is not distinct from p_hash/);
  assert.match(migration,/nothingsports_claim_due_reminders/);
  assert.match(migration,/interval '5 minutes'/);
  assert.match(cron,/nothingsport-live-fixtures','\*\/2 \* \* \* \*'/);
  assert.match(cron,/nothingsport-prune-cron-history/);
  assert.match(workflow,/QUICK_RESULTS: \$\{\{ steps\.cadence\.outputs\.quick \}\}/);
  assert.equal(fs.existsSync(".github/workflows/quick-results-refresh.yml"),false);
  assert.match(read("AGENTS.md"),/docs\/backend-efficiency-decisions\.md/);

  console.log("Backend efficiency: bounded fixture reads, fail-soft delivery, adaptive clients, batched jobs and single scheduler passed.");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
