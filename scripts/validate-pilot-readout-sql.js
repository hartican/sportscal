#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create table product_events(id bigint generated always as identity, user_id text, event_name text, occurred_at timestamptz, properties jsonb default '{}', surface text, sport text, competition_id text);`);
    const sql = fs.readFileSync('supabase/nothingsports-pilot-readout.sql', 'utf8');
    const read = async () => (await db.query(sql)).rows.find(row => row.cohort === 'all');
    let row = await read();
    assert.equal(Number(row.useful_action_users), 0);
    assert.equal(row.useful_return_percent, null, 'No denominator is unknown, not zero return');
    // Adjacent UTC instants cross Sydney midnight. Duplicate same-day actions add no return.
    await db.exec(`insert into product_events(user_id,event_name,occurred_at) values
      ('returner','fixture_check',((now() at time zone 'Australia/Sydney')::date - 2 + time '23:59') at time zone 'Australia/Sydney'),
      ('returner','watch_decision',((now() at time zone 'Australia/Sydney')::date - 1 + time '00:01') at time zone 'Australia/Sydney'),
      ('once','fixture_check',now()-interval '1 hour'),
      ('once','fixture_check',now()-interval '1 hour'),
      ('passive','feed_action',now()-interval '2 days'),
      ('passive','feed_action',now()-interval '1 day'),
      ('expired','fixture_check',now()-interval '29 days'),
      ('future','watch_decision',now()+interval '1 day');`);
    row = await read();
    assert.equal(Number(row.useful_action_users), 2);
    assert.equal(Number(row.returning_useful_users), 1);
    assert.equal(Number(row.useful_return_percent), 50);
    assert.equal(Number(row.exposed_users), 0, 'Repeat useful actions have their own explicit denominator');
    assert.equal(row.tsdr_percent, null);
    await db.exec(`insert into product_events(user_id,event_name,occurred_at,properties) values ('returner','weekly_pulse',now(),'{"pilotCohort":"curator","surveyVersion":"weekly-pulse.v1"}');`);
    const rows = (await db.query(sql)).rows;
    assert.equal(Number(rows.find(r => r.cohort === 'curator').returning_useful_users), 1);
    assert.equal(Number(rows.find(r => r.cohort === 'unclassified').useful_action_users), 1);
    assert.equal(rows.find(r => r.cohort === 'hybrid').useful_return_percent, null);
    console.log('Readout SQL valid: null denominators, repeat useful dates, Sydney boundaries, window exclusions and cohorts.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
