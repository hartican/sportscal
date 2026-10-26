'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const observed = require('./lib/public-comment-managed-coexistence');
async function main() {
  // Hash/derive literal source before requiring or starting either SQL engine.
  const loaded = observed.sources();
  if (process.argv.includes('--source-check')) {
    console.log('Observed Public Feed composition source pins match; no database started.');
    return;
  }
  const {PGlite} = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  const fixture = observed.create(db, loaded);
  const completed = [];
  let featureApplied = false;
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const mark = name => { completed.push(name); console.log('Observed composition: ' + name); };
  async function as(role, owner, run) {
    assert(['postgres', 'authenticated', 'anon', 'service_role'].includes(role));
    const previous = (await query("select current_user as role,current_setting('request.jwt.claim.sub',true) as claim"))[0];
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)", [owner || '']);
    if (role !== 'postgres') await db.exec('set role ' + role);
    try { return await run(); }
    finally {
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub',$1,false)", [previous.claim || '']);
      if (previous.role !== 'postgres') await db.exec('set role ' + previous.role);
    }
  }
  const snapshot = async () => ({
    states: await query('select * from public.nothingsports_user_state order by user_id'),
    intents: await query('select * from public.nothingsports_reminder_intents order by user_id,fixture_id'),
    reminders: await query('select * from public.nothingsports_reminders order by id'),
  });
  async function exercise(phase) {
    const [owner, peer, unknown] = Array.from({length: 3}, () => crypto.randomUUID());
    for (const id of [owner, peer]) await query('insert into auth.users(id,email) values($1,$2)', [id, id + '@example.invalid']);
    await fixture.recovery.seed(owner);
    await fixture.recovery.seed(peer);
    const prefs = (await query('select preferences from public.nothingsports_user_state where user_id=$1', [owner]))[0].preferences;
    await as('service_role', null, () => query('update public.nothingsports_user_state set preferences=$1 where user_id=$2', [JSON.stringify({...prefs, theme: 'light'}), owner]));
    assert.equal((await query('select preferences from public.nothingsports_user_state where user_id=$1', [owner]))[0].preferences.theme, 'light', 'Observed broader service write is allowed, never relabelled as denied');
    mark(phase + ': observed broader service baseline permits legitimate preference update');
    const beforeDenied = await snapshot();
    await as('authenticated', peer, async () => {
      assert.deepEqual(await query('select user_id from public.nothingsports_user_state where user_id=$1', [owner]), []);
      assert.deepEqual(await query("update public.nothingsports_user_state set profile='{}' where user_id=$1 returning user_id", [owner]), []);
      await assert.rejects(query('update public.nothingsports_user_state set user_id=$1 where user_id=$2', [owner, peer]), e => e.code === '42501');
    });
    await as('authenticated', unknown, () => assert.rejects(query('insert into public.nothingsports_user_state(user_id) values($1)', [unknown]), e => e.code === '23503'));
    await as('authenticated', null, async () => {
      assert.deepEqual(await query('select user_id from public.nothingsports_user_state'), []);
      assert.deepEqual(await query("update public.nothingsports_user_state set profile='{}' returning user_id"), []);
    });
    await as('anon', null, () => assert.rejects(query('select * from public.nothingsports_user_state'), e => e.code === '42501'));
    assert.deepEqual(await snapshot(), beforeDenied);
    mark(phase + ': wrong owner, unknown/missing identity and anonymous paths preserve all saved state');
    await query('insert into public.nothingsports_account_erasure_blocks(user_id) values($1)', [peer]);
    const beforeBlocked = await snapshot();
    for (const role of ['authenticated', 'service_role']) await as(role, peer, () => assert.rejects(query("update public.nothingsports_user_state set preferences=jsonb_set(preferences,'{theme}','\"blocked\"') where user_id=$1", [peer]), e => e.code === '55000' && e.message === 'account_erasure_in_progress'));
    assert.deepEqual(await snapshot(), beforeBlocked);
    mark(phase + ': canonical erasure barrier rejects browser and broader-service writes atomically');
    // Exercise the genuine ON/OFF branch before applying any Public Feed SQL.
    // Preserve the exact observed helper, including its literal Bledisloe patch.
    const stamp = new Date(Date.now() - 1000).toISOString();
    const actions = {
      'fixture:nrl:managed-on': {canonicalEventId: 'fixture:nrl:managed-on', reminderChoice: 'on', reminderRequested: true, reminderChangedAt: stamp},
      'fixture:nrl:managed-off': {canonicalEventId: 'fixture:nrl:managed-off', reminderChoice: 'off', reminderRequested: false, reminderChangedAt: stamp},
    };
    const sql = 'update public.nothingsports_user_state set event_user_state=$1 where user_id=$2 returning user_id';
    const parameters = [JSON.stringify(actions), owner];
    const beforeChoice = await snapshot(), beforeComposition = await fixture.fingerprint();
    try { await as('authenticated', owner, () => query(sql, parameters)); }
    catch (error) {
      const afterChoice = await snapshot(), afterComposition = await fixture.fingerprint();
      assert.deepEqual(afterChoice, beforeChoice, 'Failed genuine choice rolls back all state and reminder intents');
      assert.deepEqual(afterComposition, beforeComposition, 'Failure does not alter the four owners, guard, ACLs or schema');
      const featureCount = Number((await query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='nothingsports_public_threads'"))[0].n);
      const packet = {phase: phase + ': genuine explicit ON/OFF', featureApplied, sql, parameters,
        error: {code: error.code, message: error.message, where: error.where},
        trigger: {name: 'nothingsports_reminder_choices', function: 'public.nothingsports_sync_reminder_choices()',
          observedBodyMd5: observed.pins.bodies['public.nothingsports_sync_reminder_choices()'],
          branch: "key:=nothingsports_recovery.fixture_alias_v1(coalesce(existing.fixture_id,a.value->'canonicalEventId',a.key));"},
        before: beforeChoice, after: afterChoice,
        postChecks: {allSavedStateAndIntentsUnchanged: true, allFourOwnersAndAclsUnchanged: true, publicThreadRelations: featureCount},
        completed, scope: 'Disposable local SQL; not production failure or managed behavior proof.'};
      console.error('PUBLIC_FEED_OBSERVED_COMPOSITION_RED ' + JSON.stringify(packet));
      throw error;
    }
    const intents = await query('select fixture_id,choice,enabled from public.nothingsports_reminder_intents where user_id=$1 order by fixture_id', [owner]);
    assert.deepEqual(intents, [{fixture_id: 'fixture:nrl:managed-off', choice: 'off', enabled: false}, {fixture_id: 'fixture:nrl:managed-on', choice: 'on', enabled: true}]);
    mark(phase + ': actual patched reminder owner preserves genuine ON and OFF choices');
    const purged = 'fixture:nrl:managed-purged';
    const purgedAction = {isPurged: true, purgedAt: stamp, canonicalEventId: purged, saved: false};
    await as('authenticated', owner, () => query('update public.nothingsports_user_state set event_user_state=event_user_state||$1::jsonb where user_id=$2', [JSON.stringify({[purged]: purgedAction}), owner]));
    await as('service_role', null, () => query("update public.nothingsports_user_state set event_user_state='{}' where user_id=$1", [owner]));
    const state = (await query('select * from public.nothingsports_user_state where user_id=$1', [owner]))[0];
    assert.equal(state.event_user_state[purged].isPurged, true);
    assert.equal(state.event_user_state[purged].saved, false);
    assert.equal(state.event_user_state[purged].canonicalEventId, purged);
    assert.deepEqual(await query('select fixture_id,choice,enabled from public.nothingsports_reminder_intents where user_id=$1 order by fixture_id', [owner]), intents);
    const dirty = {...state.preferences, preferenceGraph: {entityFollows: [{participantId: 'team:cricket:not-approved'}, {participantId: 'team:cricket:australia', follow: false}], competitionPreferences: []}};
    delete dirty.cricketCoverageVersion;
    await as('authenticated', owner, () => query('update public.nothingsports_user_state set preferences=$1 where user_id=$2', [JSON.stringify(dirty), owner]));
    const normal = (await query('select preferences from public.nothingsports_user_state where user_id=$1', [owner]))[0].preferences;
    assert.deepEqual(normal.preferenceGraph.entityFollows, [{participantId: 'team:cricket:australia', follow: false}]);
    assert.equal(normal.cricketCoverageVersion, 1);
    assert.deepEqual(normal.futureUserChoice, prefs.futureUserChoice);
    mark(phase + ': real EPIC purge and Cricket recovery preserve OFF/unknown choices');
    return {owner, peer, unknown};
  }
  try {
    const engine = (await query("select version() as version,current_setting('server_version_num') as server_version_num"))[0];
    console.log('Observed composition SQL engine: ' + JSON.stringify(engine));
    await fixture.install();
    await fixture.verifyObserved();
    mark('all four observed trigger bodies/bindings and broader table/column ACLs reproduced');
    await exercise('before Public Feed');
    const before = await fixture.fingerprint(), saved = await fixture.recovery.allStates();
    await db.exec(loaded.text[observed.files.feature]);
    featureApplied = true;
    await fixture.preserve(before, saved);
    mark('feature migration preserves actual composed owners, ACLs and every saved row');
    const actors = await exercise('after Public Feed');
    const tables = ['public_threads', 'public_comments', 'public_comment_tombstones', 'public_comment_votes', 'public_comment_limits', 'public_comment_runs', 'public_comment_heads', 'public_comment_deliveries', 'classic_comments'];
    for (const table of tables) {
      const actual = (await query('select relrowsecurity,relforcerowsecurity from pg_class where oid=$1::regclass', ['public.nothingsports_' + table]))[0];
      assert.deepEqual(actual, {relrowsecurity: true, relforcerowsecurity: true});
      for (const role of ['anon', 'authenticated']) await as(role, actors.owner, () => assert.rejects(query('select * from public.nothingsports_' + table), e => e.code === '42501'));
    }
    const rpc = (id, action) => query('select public.nothingsports_public_comments($1,$2,$3) result', [id, 'fixture:nrl:managed-public', JSON.stringify(action)]);
    const post = {action: 'post', clientId: crypto.randomUUID(), body: 'Protected public comment', fixture: {id: 'fixture:nrl:managed-public', status: 'upcoming'}};
    await query("insert into public.nothingsports_nsc_profiles values($1,'managed-owner','visible')", [actors.owner]);
    await as('service_role', null, () => rpc(actors.owner, post));
    for (const role of ['anon', 'authenticated']) await as(role, actors.owner, () => assert.rejects(rpc(actors.owner, post), e => e.code === '42501'));
    await as('service_role', null, () => assert.rejects(rpc(actors.peer, post), /account_unavailable/));
    await as('service_role', null, () => assert.rejects(rpc(actors.unknown, {...post, clientId: crypto.randomUUID()}), e => e.code === '23503' || /handle_required/.test(e.message)));
    mark('new Public Feed tables/RPC remain service-only and erasing/unknown actors are refused');
    console.log('Observed composition summary: ' + JSON.stringify({complete: true, featureApplied, completed, managedAcceptance: false}));
  } finally {
    await db.close();
    console.log('Observed composition engine closed.');
  }
}
main().catch(error => { console.error(JSON.stringify({status: 'STOPPED_FIRST_RED', code: error.code, message: error.message, where: error.where})); process.exitCode = 1; });
