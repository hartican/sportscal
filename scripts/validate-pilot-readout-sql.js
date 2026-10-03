#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const path = require('node:path'), os = require('node:os');
const {execFileSync,spawnSync} = require('node:child_process');
const COHORT = require('./lib/pilot-cohort-selection');
const {reportFromReadout,parseOptions} = require('./evaluate-pilot-readout');

async function cohortAcceptance(source){
  const db = new PGlite(), temp = fs.mkdtempSync(path.join(os.tmpdir(),'nothingsport-cohort-'));
  const ids = Array.from({length:6},(_,i)=>`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`);
  const [returner,once,owner,qa,outsider,empty] = ids;
  const now = new Date(), ago = days => new Date(now.getTime()-days*86400000).toISOString();
  const selection = {schemaVersion:COHORT.VERSION,reviewedAt:ago(0.01),members:[{accountId:returner,joinedAt:ago(4)},{accountId:once,joinedAt:ago(4)},{accountId:owner,joinedAt:ago(10)}],excludedAccountIds:[owner,qa]};
  const privateFile = path.join(temp,'selection.json'), queryFile = path.join(temp,'cohort.sql');
  fs.writeFileSync(privateFile,JSON.stringify(selection),{mode:0o600});
  try {
    // The actual persisted account column is UUID, unlike the older anonymous
    // string fixtures above. No production connection or user data is used.
    await db.exec(`create table product_events(id bigint generated always as identity,user_id uuid,event_name text,occurred_at timestamptz,properties jsonb default '{}',surface text,sport text,competition_id text);`);
    const before = "((now() at time zone 'Australia/Sydney')::date - 2 + time '23:59') at time zone 'Australia/Sydney'";
    const after = "((now() at time zone 'Australia/Sydney')::date - 1 + time '00:01') at time zone 'Australia/Sydney'";
    for (const id of [returner,owner,qa,outsider]){
      await db.query(`insert into product_events(user_id,event_name,occurred_at) values ($1,'fixture_check',${before}),($1,'watch_decision',${after})`,[id]);
    }
    await db.query(`insert into product_events(user_id,event_name,occurred_at) values ($1,'fixture_check',now()-interval '1 hour'),($1,'fixture_check',now()-interval '1 hour'),($1,'fixture_check',now()-interval '6 days')`,[once]);
    for (const id of [returner,once,owner,qa,outsider]){
      await db.query(`insert into product_events(user_id,event_name,occurred_at,properties,surface,sport,competition_id) values ($1,'opportunity_exposed',now()-interval '1 hour','{"recommendationClass":"discovery"}','curated_feed','football','epl')`,[id]);
    }
    await db.query(`insert into product_events(user_id,event_name,occurred_at,properties,sport,competition_id) values ($1,'swipe',now()-interval '1 hour','{"recommendationClass":"discovery","direction":"negative"}','football','epl'),($2,'swipe',now()-interval '1 hour','{"recommendationClass":"discovery","direction":"negative"}','football','epl'),($3,'swipe',now()-interval '6 days','{"recommendationClass":"discovery","direction":"negative"}','football','epl')`,[returner,owner,once]);
    await db.query(`insert into product_events(user_id,event_name,occurred_at,properties) values ($1,'weekly_pulse',now()-interval '1 hour','{"pilotCohort":"curator","surveyVersion":"weekly-pulse.v1","trustConfidence":"high","missedFixtures":"none"}'),($2,'weekly_pulse',now()-interval '1 hour','{"pilotCohort":"completist","surveyVersion":"weekly-pulse.v1","trustConfidence":"low","missedFixtures":"multiple"}')`,[returner,owner]);
    const all = (await db.query(source)).rows.find(row=>row.cohort==='all');
    assert.equal(Number(all.useful_action_users),5);assert.equal(Number(all.returning_useful_users),5);assert.equal(Number(all.useful_return_percent),100,'the real unfiltered query includes owner/QA/nonmembers and pre-joining activity');
    const command = ['scripts/evaluate-pilot-readout.js',`--prepare-cohort-sql=${privateFile}`,`--output=${queryFile}`];
    const prepared = execFileSync(process.execPath,command,{encoding:'utf8'});
    assert(!ids.some(id=>prepared.includes(id)),'CLI prints no account identifiers');
    assert.equal(fs.statSync(queryFile).mode&0o777,0o600);
    const sql = fs.readFileSync(queryFile,'utf8');
    const rows = JSON.parse(JSON.stringify((await db.query(sql)).rows));
    const row = rows.find(item=>item.cohort==='all');
    assert.equal(Number(row.cohort_requested_accounts),3);assert.equal(Number(row.cohort_exclusion_accounts),2);assert.equal(Number(row.cohort_eligible_accounts),2);assert.equal(Number(row.cohort_measured_accounts),2);
    assert.equal(Number(row.useful_action_users),2);assert.equal(Number(row.returning_useful_users),1);assert.equal(Number(row.useful_return_percent),50);
    assert.equal(Number(row.exposed_users),2);assert.equal(Number(row.discovery_exposures),2);assert.equal(Number(row.discovery_negative_actions),1);assert.equal(Number(row.pulse_users),1);
    assert.equal(Number(row.positive_trust_percent),100);assert.equal(Number(row.missed_fixture_percent),0);
    assert.deepEqual(row.negative_feedback_by_sport,[{sport:'football',negativeActions:1,ratePercent:50}]);
    assert.deepEqual(row.negative_feedback_by_competition,[{competitionId:'epl',negativeActions:1,ratePercent:50}]);
    assert(rows.every(item=>item.measurement_population===COHORT.POPULATION));
    assert.equal(Number(rows.find(item=>item.cohort==='completist').useful_action_users),0);
    assert.equal(Number(rows.find(item=>item.cohort==='curator').returning_useful_users),1);
    assert(row.weekly_tsdr.every(week=>Number(week.denominator)<=2&&Number(week.numerator)<=Number(week.denominator)),'weekly metric is filtered before aggregation');
    assert(!ids.some(id=>JSON.stringify(rows).includes(id)),'aggregate export contains no account identifiers');
    const readiness={ready:true,supportedFixtureCoveragePercent:100,overdueResultCount:0};
    const report=reportFromReadout({data:rows},readiness,{requireCohort:true});
    assert.equal(report.measurementScope.population,COHORT.POPULATION);assert.equal(report.metrics.usefulReturnPercent,50);assert.equal(report.recommendation,null);assert(report.operationalReady);
    assert.match(report.measurementScope.qualification,/not independently verified/);assert.match(report.weeklyTsdrScope,/joining date/);assert(!report.notes.some(note=>note.includes('owner activity may be included')));
    const exportFile=path.join(temp,'aggregate.json'),readyFile=path.join(temp,'readiness.json'),reportFile=path.join(temp,'report.json');
    fs.writeFileSync(exportFile,JSON.stringify(rows),{mode:0o600});fs.writeFileSync(readyFile,JSON.stringify(readiness),{mode:0o600});
    execFileSync(process.execPath,['scripts/evaluate-pilot-readout.js',exportFile,`--readiness=${readyFile}`,'--require-invited-cohort',`--output=${reportFile}`],{encoding:'utf8'});
    assert.deepEqual(JSON.parse(fs.readFileSync(reportFile,'utf8')),report);assert.equal(fs.statSync(reportFile).mode&0o777,0o600);
    const emptySql=COHORT.buildCohortSql({...selection,members:[{accountId:empty,joinedAt:ago(4)}]},source).sql;
    const emptyRows=JSON.parse(JSON.stringify((await db.query(emptySql)).rows));
    const zero=reportFromReadout(emptyRows,readiness,{requireCohort:true});assert.equal(zero.measurementScope.measuredAccounts,0);assert.equal(zero.metrics.usefulActionUsers,0);assert.equal(zero.metrics.usefulReturnPercent,null);assert.equal(zero.sample.distinctUsers,0);
    const futureSql=COHORT.buildCohortSql({...selection,members:[{accountId:returner,joinedAt:ago(0.01)}]},source).sql;
    const postJoin=reportFromReadout(JSON.parse(JSON.stringify((await db.query(futureSql)).rows)),readiness,{requireCohort:true});assert.equal(postJoin.measurementScope.measuredAccounts,0,'earlier history cannot masquerade as pilot activity');
    assert.throws(()=>reportFromReadout([all],readiness,{requireCohort:true}),/unqualified/);
    assert.throws(()=>reportFromReadout(report,readiness,{requireCohort:true}),/original scoped/);
    for (const patch of [{cohort_selection_sha256:'bad'},{cohort_eligible_accounts:1},{cohort_reviewed_at:null},{cohort_measured_accounts:false},{returning_useful_users:3},{useful_action_users:false},{measurement_population:'verified-Australians'}]){
      const bad=structuredClone(rows);bad.forEach(item=>Object.assign(item,patch));assert.throws(()=>reportFromReadout(bad,readiness,{requireCohort:true}),'corrupt metadata/numerators fail closed');
    }
    const mixed=structuredClone(rows);delete mixed.at(-1).measurement_population;assert.throws(()=>reportFromReadout(mixed,readiness,{requireCohort:true}),/Mixed or missing/);
    for (const bad of [
      {...selection,reviewedAt:'2099-01-01T00:00:00Z'}, {...selection,reviewedAt:'2026-02-30T00:00:00Z'},
      {...selection,members:[]}, {...selection,excludedAccountIds:[]}, {...selection,members:[{accountId:owner,joinedAt:ago(4)}]},
      {...selection,members:[selection.members[0],selection.members[0]]}, {...selection,excludedAccountIds:[owner,owner]},
      {...selection,members:[{accountId:"x'); delete from product_events; --",joinedAt:ago(4)}]},
      {...selection,members:[{accountId:once,joinedAt:'2099-01-01T00:00:00Z'}]}, {...selection,unknown:'unsupported'},
      {...selection,members:Array(101).fill(selection.members[0])},
    ]) assert.throws(()=>COHORT.buildCohortSql(bad,source),'invalid selections never produce SQL');
    assert.throws(()=>COHORT.buildCohortSql(selection,source.replace("interval '28 days'","interval '27 days'")),/template changed/);
    assert.equal(COHORT.buildCohortSql({...selection,members:[...selection.members].reverse(),excludedAccountIds:[...selection.excludedAccountIds].reverse()},source).sql,sql,'array order does not change selection or query');
    assert.throws(()=>COHORT.writePrivate(queryFile,'overwrite'),/new file path/);assert.equal(fs.readFileSync(queryFile,'utf8'),sql);
    assert.throws(()=>COHORT.writePrivate(path.resolve('cohort-private-never-created.sql'),'leak'),/outside Git/);assert(!fs.existsSync('cohort-private-never-created.sql'));
    assert.throws(()=>COHORT.readSelection(path.resolve('config/product-events.js')),/outside Git/);
    assert.throws(()=>COHORT.writePrivate('relative.sql','leak'),/absolute/);
    const oldStat=fs.lstatSync, unsafeOutput=path.join(temp,'unknown-boundary.sql'), blockedMarker=path.join(fs.realpathSync(temp),'.git');
    try {fs.lstatSync=(file,...args)=>{if(file===blockedMarker)throw Object.assign(new Error('Denied'),{code:'EACCES'});return oldStat(file,...args);};assert.throws(()=>COHORT.writePrivate(unsafeOutput,'leak'),/Cannot establish/);assert(!fs.existsSync(unsafeOutput),'an unreadable Git boundary cannot authorise a private output');}
    finally {fs.lstatSync=oldStat;}
    const oversized=path.join(temp,'large.json');fs.writeFileSync(oversized,' '.repeat(64*1024+1));assert.throws(()=>COHORT.readSelection(oversized),/64 KiB/);
    const badFile=path.join(temp,'bad.json'),badOutput=path.join(temp,'should-not-exist.sql');fs.writeFileSync(badFile,'{'+owner);
    const failed=spawnSync(process.execPath,['scripts/evaluate-pilot-readout.js',`--prepare-cohort-sql=${badFile}`,`--output=${badOutput}`],{encoding:'utf8'});assert.notEqual(failed.status,0);assert(!failed.stderr.includes(owner));assert(!fs.existsSync(badOutput));
    for (const args of [[],['--unknown'],['--prepare-cohort-sql=x'],['events.json','--prepare-cohort-sql=x','--output=y']])assert.throws(()=>parseOptions(args));
    console.log('Private cohort readout: actual CLI/UUID SQL/export/report, exclusions, joining cutoffs, 1/2 useful returns, zero/nulls, all segments and fail-closed/file privacy checks passed.');
  } finally {await db.close();fs.rmSync(temp,{recursive:true,force:true});}
}
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
    // Ordinary Unfollow stays neutral, with or without discovery context. Only
    // explicit discovery negative swipes count, consistently across breakdowns.
    await db.exec(`insert into product_events(user_id,event_name,occurred_at,properties,sport,competition_id) values
      ('once','opportunity_exposed',now(),'{"recommendationClass":"discovery"}','football','epl'),
      ('once','opportunity_exposed',now(),'{"recommendationClass":"discovery"}','football','epl'),
      ('once','swipe',now(),'{"recommendationClass":"discovery","direction":"negative"}','football','epl'),
      ('once','swipe',now(),'{"recommendationClass":"followed","direction":"negative"}','football','epl'),
      ('once','swipe',now(),'{"direction":"negative"}','football','epl'),
      ('once','swipe',now(),'{"recommendationClass":"discovery","direction":"positive"}','football','epl'),
      ('once','preference_change',now(),'{"action":"unfollow"}','football','epl'),
      ('once','preference_change',now(),'{"recommendationClass":"discovery","action":"unfollow"}','football','epl'),
      ('once','feed_action',now(),'{"recommendationClass":"discovery","action":"archive"}','football','epl');`);
    row = await read();
    assert.equal(row.discovery_contract_version, 'discovery-aggregate.v2');
    assert.equal(Number(row.discovery_negative_actions), 1);
    assert.deepEqual(row.negative_feedback_by_sport, [{sport:'football',negativeActions:1,ratePercent:50}]);
    assert.deepEqual(row.negative_feedback_by_competition, [{competitionId:'epl',negativeActions:1,ratePercent:50}]);
    console.log('Readout SQL valid: null denominators, repeat useful dates, Sydney boundaries, window exclusions and cohorts.');
    await cohortAcceptance(sql);
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
