'use strict';
// Local SQL fixtures only. Load complete accepted function/table/policy statements;
// never reconstruct or replace the recovery/erasure owners under test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ACCEPTED_SOURCE = '87958d3b87b739cef84c5f087a20a6b234a49997';
const SOURCE_HASHES = Object.freeze({
  'supabase/nothingsports-user-state.sql':'9e87daa37fa42897f69dfadda051f78dfa9a9e038a728ba7a52a3512b5cdec5b',
  'supabase/nothingsports-user-state-service-snapshot.sql':'52e17e0b35b3de5d1bd61a309ed81c7016b82542a73370cac2367821a9c963dc',
  'supabase/migrations/20260930100449_cricket_coverage_v1.sql':'9c380bd06ee155165a58b1ea9f4b57170132437c4ce43d26f5c7651123a1e467',
});
const names = ['fixture_alias_v1','cricket_preferences_v1','preferences_guard_v1'];
const clone = value => JSON.parse(JSON.stringify(value));
function sources(){
  const files = Object.fromEntries(Object.entries(SOURCE_HASHES).map(([file, expected]) => {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expected, 'Accepted recovery source drift: ' + file);
    return [file, source];
  }));
  const recovery = files['supabase/migrations/20260930100449_cricket_coverage_v1.sql'];
  const functions = names.map(name => {
    const statement = recovery.match(new RegExp('create or replace function nothingsports_recovery\\.' + name + '\\([\\s\\S]*?\\$\\$;'))?.[0];
    assert(statement, 'Complete accepted recovery function required: ' + name); return statement;
  });
  const trigger = recovery.match(/create trigger cricket_preferences_v1 before insert or update of preferences on public\.nothingsports_user_state for each row execute function nothingsports_recovery\.preferences_guard_v1\(\);/)?.[0];
  const schemaRevoke = recovery.match(/revoke all on schema nothingsports_recovery from public, anon, authenticated;/)?.[0];
  const functionRevoke = recovery.match(/revoke all on all functions in schema nothingsports_recovery from public, anon, authenticated;/)?.[0];
  assert(trigger && schemaRevoke && functionRevoke, 'Actual accepted trigger and permission statements required');
  return {files, functions, trigger, schemaRevoke, functionRevoke};
}

function create(db){
  const completed = [];
  const preservedPeers = new Map();
  const mark = name => { completed.push(name); console.log('Public comments recovery coexistence: ' + name + ' passed.'); };
  const query = async (sql, parameters = []) => (await db.query(sql, parameters)).rows;
  async function as(role, owner, run){
    assert(['authenticated','anon','service_role','admin'].includes(role));
    const prior = (await query("select current_user as role,session_user as session,current_setting('request.jwt.claim.sub',true) as claim"))[0];
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub',$1,false)", [owner || '']);
    if(role !== 'admin') await db.exec('set role ' + role);
    try{ return await run(); }
    finally{
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub',$1,false)", [prior.claim || '']);
      if(prior.role !== prior.session){ assert(['authenticated','anon','service_role'].includes(prior.role)); await db.exec('set role ' + prior.role); }
    }
  }
  const state = owner => as('admin', null, async () => (await query('select * from public.nothingsports_user_state where user_id=$1', [owner]))[0] || null);
  const allStates = () => as('admin', null, () => query('select * from public.nothingsports_user_state order by user_id'));
  const preferences = () => ({theme:'dark', cricketCoverageVersion:1,
    followFirst:{notifications:{enabled:false,commentAlertsEnabled:false}},
    preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',follow:false}],competitionPreferences:[]},
    futureUserChoice:{enabled:false,empty:[],value:'preserve-unknown'},
  });
  async function seed(owner){
    const prefs = preferences();
    await as('authenticated', owner, () => query(`insert into public.nothingsports_user_state
      (user_id,profile,preferences,event_user_state,event_spoiler_state,archived_events,ratings)
      values($1,$2,$3,$4,$5,$6,$7) returning user_id`, [owner,
      JSON.stringify({name:'Synthetic recovery owner'}), JSON.stringify(prefs),
      JSON.stringify({'fixture:synthetic':{isPinned:false,isMinimised:true}}),
      JSON.stringify({'fixture:synthetic':{revealed:false}}), JSON.stringify(['fixture:synthetic-archived']),
      JSON.stringify({'fixture:synthetic':5})]));
    assert.deepEqual((await state(owner)).preferences, prefs, 'Already-canonical legitimate choices stay unchanged');
  }
  async function install(){
    const loaded = sources();
    // auth.uid is a disposable JWT-subject fixture, not Supabase Auth proof.
    await db.exec(`create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;`);
    await db.exec(loaded.files['supabase/nothingsports-user-state.sql']);
    await db.exec(loaded.files['supabase/nothingsports-user-state-service-snapshot.sql']);
    await db.exec('create schema nothingsports_recovery;' + loaded.schemaRevoke);
    for(const statement of loaded.functions) await db.exec(statement);
    await db.exec(loaded.functionRevoke + '\n' + loaded.trigger);
    console.log('Public comments accepted recovery sources: ' + JSON.stringify({acceptedSource:ACCEPTED_SOURCE,files:SOURCE_HASHES,completeFunctions:names,trigger:'cricket_preferences_v1'}));
  }
  async function fingerprint(){
    return as('admin', null, async () => ({
      table:await query(`select relrowsecurity,relforcerowsecurity,relacl::text as acl from pg_class where oid='public.nothingsports_user_state'::regclass`),
      policies:await query("select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='nothingsports_user_state' order by policyname"),
      triggers:await query(`select t.tgname,t.tgtype,t.tgenabled,n.nspname,p.proname,encode(t.tgargs,'hex') as args
        from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
        where t.tgrelid='public.nothingsports_user_state'::regclass and not t.tgisinternal order by t.tgname`),
      recovery:await query(`select p.proname,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text as acl,p.prosrc
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nothingsports_recovery' order by p.proname`),
      schema:await query("select nspacl::text as acl from pg_namespace where nspname='nothingsports_recovery'"),
      erasure:await query(`select p.prosecdef,p.provolatile,p.proconfig,p.proacl::text as acl,p.prosrc from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='nothingsports_guard_erasure_write'`),
    }));
  }
  async function preserve(before, beforeRows){
    const after = await fingerprint(), prior = clone(before), next = clone(after);
    assert.equal(next.erasure.length, 1); assert.equal(prior.erasure.length, 1);
    let body = next.erasure[0].prosrc;
    const start = body.indexOf('  -- The combined canonical guard'), end = body.indexOf('\n end if;\n foreach column_name in array tg_argv', start);
    assert(start >= 0 && end > start, 'Only the reviewed public-comment allowance is expected');
    assert(body.slice(start,end).includes("tg_table_schema='public' and tg_table_name='nothingsports_public_comments'"));
    body = (body.slice(0,start) + body.slice(end)).replace(';current_comment public.nothingsports_public_comments;',';');
    const nonblank = text => text.split('\n').filter(line => line.trim()).join('\n');
    assert.equal(nonblank(body), nonblank(prior.erasure[0].prosrc), 'All existing non-comment guard logic stays exact');
    delete prior.erasure[0].prosrc; delete next.erasure[0].prosrc;
    assert.deepEqual(next, prior, 'Migration preserves RLS/policies/recovery bodies/ACLs/trigger bindings and erasure attributes');
    assert.deepEqual(await allStates(), beforeRows, 'Migration preserves all legitimate saved state');
    mark('migration preserves accepted recovery/state/permissions/erasure owners');
  }
  async function exercise(phase){
    const [owner, other, unknown] = Array.from({length:3}, () => crypto.randomUUID());
    await as('admin', null, async () => { for(const id of [owner,other]) await query('insert into auth.users(id,email) values($1,$2)', [id,id+'@example.invalid']); });
    await seed(owner); await seed(other);
    mark(phase + ': unchanged legitimate owned insert, OFF/empty/unknown choices');
    const before = await state(owner), next = {...before.preferences,theme:'light'}, stamp = new Date(new Date(before.updated_at).getTime()+1000).toISOString();
    const save = (base,prefs) => as('authenticated', owner, () => query(`update public.nothingsports_user_state
      set preferences=$1,updated_at=$2 where user_id=$3 and updated_at=$4 returning user_id`, [JSON.stringify(prefs),stamp,owner,base]));
    assert.equal((await save(before.updated_at,next)).length,1);
    const saved = await state(owner); assert.deepEqual(saved.preferences,next);
    for(const field of ['profile','event_user_state','event_spoiler_state','archived_events','ratings']) assert.deepEqual(saved[field],before[field]);
    assert.equal((await save(before.updated_at,{...next,theme:'stale'})).length,0, 'Stale conditional save cannot overwrite');
    assert.deepEqual(await state(owner),saved);
    mark(phase + ': owned conditional save and stale-base no-write');
    const both = await allStates();
    await as('authenticated', owner, async () => {
      assert.deepEqual(await query('select user_id from public.nothingsports_user_state where user_id=$1',[other]),[]);
      assert.deepEqual(await query("update public.nothingsports_user_state set profile='{}' where user_id=$1 returning user_id",[other]),[]);
      await assert.rejects(query('insert into public.nothingsports_user_state(user_id) values($1)',[other]),e=>e.code==='42501');
      await assert.rejects(query('update public.nothingsports_user_state set user_id=$1 where user_id=$2',[other,owner]),e=>e.code==='42501');
      await assert.rejects(query('delete from public.nothingsports_user_state where user_id=$1',[owner]),e=>e.code==='42501');
    });
    assert.deepEqual(await allStates(),both);
    mark(phase + ': cross-owner reads/writes, owner reassignment and delete denied');
    await as('authenticated', unknown, async () => {
      assert.deepEqual(await query('select user_id from public.nothingsports_user_state'),[]);
      assert.deepEqual(await query('update public.nothingsports_user_state set profile=profile returning user_id'),[]);
      await assert.rejects(query('insert into public.nothingsports_user_state(user_id) values($1)',[unknown]),e=>e.code==='23503');
    });
    await as('authenticated', null, async () => {
      assert.deepEqual(await query('select user_id from public.nothingsports_user_state'),[]);
      assert.deepEqual(await query('update public.nothingsports_user_state set profile=profile returning user_id'),[]);
    });
    await as('authenticated', owner, async () => {
      await assert.rejects(query("update public.nothingsports_user_state set schema_version='user-state.unknown' where user_id=$1",[owner]),e=>e.code==='23514');
      await assert.rejects(query("update public.nothingsports_user_state set profile='[]' where user_id=$1",[owner]),e=>e.code==='23514');
    });
    assert.deepEqual(await allStates(),both);
    mark(phase + ': unknown/missing identity and invalid document writes cannot persist');
    await as('anon', null, () => assert.rejects(query('select * from public.nothingsports_user_state'),e=>e.code==='42501'));
    await as('service_role', null, async () => {
      assert((await query('select user_id from public.nothingsports_user_state')).length>=2);
      await assert.rejects(query('update public.nothingsports_user_state set profile=profile'),e=>e.code==='42501');
    });
    await as('authenticated', owner, () => assert.rejects(query("select nothingsports_recovery.cricket_preferences_v1('{}')"),e=>e.code==='42501'));
    assert.deepEqual(await allStates(),both);
    mark(phase + ': anonymous/private helper/service write privileges remain closed');
    // A noncanonical input must traverse the actual full recovery function.
    const dirty = {...preferences(),preferenceGraph:{entityFollows:[{participantId:'team:cricket:not-approved'},{participantId:'team:cricket:australia',follow:false}],competitionPreferences:[{competitionId:'competition:cricket:4641'},{competitionId:'competition:nrl:synthetic',enabled:false}]}};
    delete dirty.cricketCoverageVersion;
    await as('authenticated', owner, () => query('update public.nothingsports_user_state set preferences=$1 where user_id=$2',[JSON.stringify(dirty),owner]));
    const normalized = (await state(owner)).preferences;
    assert.deepEqual(normalized,{...dirty,cricketCoverageVersion:1,preferenceGraph:{entityFollows:[{participantId:'team:cricket:australia',follow:false}],competitionPreferences:[{competitionId:'competition:nrl:synthetic',enabled:false}]}});
    mark(phase + ': complete actual recovery trigger normalizes only its approved fields');
  }
  async function blocked(owner){
    const before = await state(owner); assert(before);
    await as('authenticated', owner, () => assert.rejects(query("update public.nothingsports_user_state set preferences=jsonb_set(preferences,'{theme}','\"forbidden\"') where user_id=$1",[owner]),e=>e.code==='55000'&&e.message==='account_erasure_in_progress'));
    assert.deepEqual(await state(owner),before, 'Denied update and recovery normalization roll back together');
    mark('blocked account: real recovery BEFORE and erasure AFTER preserve whole state');
  }
  async function deletionRollback(owner, peer, eventId){
    const snapshot = () => as('admin', null, async () => ({
      users:await query('select * from auth.users where id=any($1::uuid[]) order by id',[[owner,peer]]),
      state:await allStates(),
      comments:await query('select * from public.nothingsports_public_comments where event_id=$1 order by id',[eventId]),
      votes:await query('select * from public.nothingsports_public_comment_votes order by comment_id,user_id'),
      threads:await query('select * from public.nothingsports_public_threads order by event_id'),
      tombstones:await query('select * from public.nothingsports_public_comment_tombstones order by id'),
    }));
    const before = await snapshot();
    preservedPeers.set(peer,await state(peer));
    await as('admin', null, async () => {
      await db.exec(`create function private.public_comment_test_delete_rollback() returns trigger language plpgsql as $$begin
        if exists(select 1 from public.nothingsports_user_state where user_id=old.id)
          or exists(select 1 from public.nothingsports_public_comments where author_user_id=old.id) then
          raise exception 'synthetic deletion did not reach completed cascades';
        end if; raise exception 'synthetic completed-cascade rollback';end$$;
        create constraint trigger zz_public_comment_test_delete_rollback after delete on auth.users
        deferrable initially deferred for each row execute function private.public_comment_test_delete_rollback();`);
      try{ await assert.rejects(query('delete from auth.users where id=$1',[owner]),e=>e.code==='P0001'&&e.message==='synthetic completed-cascade rollback'); }
      finally{ await db.exec('drop trigger zz_public_comment_test_delete_rollback on auth.users;drop function private.public_comment_test_delete_rollback();'); }
    });
    assert.deepEqual(await snapshot(),before, 'Completed Auth cascades roll back user state, comments, votes, threads and tombstones atomically');
    mark('actual Auth deletion: completed state/comment/vote cascades roll back atomically');
  }
  async function erased(owner, peer){
    assert.equal(await state(owner),null, 'Actual Auth deletion cascades saved account state');
    if(peer){assert(preservedPeers.has(peer));assert.deepEqual(await state(peer),preservedPeers.get(peer),'Another blocked account retains its complete saved state');}
    mark('actual Auth deletion: erased state removed and peer state retained');
  }
  return {install,fingerprint,allStates,preserve,exercise,seed,blocked,deletionRollback,erased,completed};
}
module.exports = {ACCEPTED_SOURCE,SOURCE_HASHES,sources,create};
