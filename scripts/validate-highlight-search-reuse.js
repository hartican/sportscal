'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createTopResultResolver}=require('../lib/youtube-top-result');
async function main(){
  const outerClock=Date.now;Date.now=()=>+new Date(); // SQL and resolver share a real local replay clock.
  const {db,request,reset,before,migration,functions}=await require('./highlight-database-test').database();
  try{
    // Local replay clocks only: no sporting fact is written or published.
    const now=new Date(),iso=offset=>new Date(+now+offset).toISOString();
    const fixture={...require('../data/events.json').events.find(e=>e.id==='rlwc-australia-new-zealand-2026'),date:iso(-10800000).slice(0,10),startTimeUtc:iso(-10800000),actualStartTimeUtc:iso(-10800000),endDate:iso(-7200000).slice(0,10),status:'completed',season:String(now.getUTCFullYear())};
    delete fixture.highlights;
    const original=JSON.stringify(fixture),id=fixture.canonicalEventId||fixture.eventId||fixture.id;
    const video={id:'FRESHVIDEO1',snippet:{channelId:'UC33-OkQ6VCYk8xtml8Pk4-g',title:'Australia v New Zealand Match Highlights | Rugby League World Cup '+now.getUTCFullYear(),publishedAt:iso(-3600000),defaultAudioLanguage:'en'},contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}};
    const options={request,environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>[],discoverUploads:async()=>[]};
    let searches=0,metadata=0;
    const empty=async url=>{assert(new URL(url).pathname.endsWith('/search'));searches++;return Response.json({items:[]});};
    for(let tap=0;tap<3;tap++)await assert.rejects(createTopResultResolver({...options,fetchImpl:empty}).resolve(fixture,now));
    assert.equal(searches,1,'Repeated taps across separate workers share an unsuccessful lookup');
    let row=(await db.query('select * from public.nothingsports_youtube_selections where fixture_id=$1',[id])).rows[0];
    assert.equal(row.video_id,null);assert.equal(row.lookup_outcome,'no_results');assert.equal(row.lookup_search_calls,1);
    await db.query("update public.nothingsports_youtube_selections set lookup_after=clock_timestamp()-interval '1 second'");
    await assert.rejects(createTopResultResolver({...options,fetchImpl:empty}).resolve(fixture,now));assert.equal(searches,2,'Retry is allowed after the bounded delay');
    await reset();searches=metadata=0;
    const found=async url=>{const u=new URL(url);if(u.pathname.endsWith('/search')){searches++;return Response.json({items:[{id:{videoId:video.id},snippet:video.snippet}]});}assert(u.pathname.endsWith('/videos'));metadata++;return Response.json({items:[video]});};
    const arrivals=await Promise.all([createTopResultResolver({...options,fetchImpl:found}).resolve(fixture,now),createTopResultResolver({...options,fetchImpl:found}).resolve(fixture,now)]);
    assert(arrivals.every(r=>r.url==='https://www.youtube.com/watch?v='+video.id));assert.equal(searches,1);assert.equal(metadata,1,'Separate workers reuse the committed selection');
    await db.query("update public.nothingsports_youtube_selections set selected_at=clock_timestamp()-interval '2 hours'");
    assert.equal((await createTopResultResolver({...options,fetchImpl:found}).resolve(fixture,now)).url,arrivals[0].url);assert.equal(searches,1);assert.equal(metadata,2,'An old selection is checked by ID without another search');
    await db.query("update public.nothingsports_youtube_selections set selected_at=clock_timestamp()-interval '2 hours'");
    let beginCheck,releaseCheck;const checking=new Promise(r=>beginCheck=r),released=new Promise(r=>releaseCheck=r);
    const rejecting=createTopResultResolver({...options,fetchImpl:async url=>{if(new URL(url).pathname.endsWith('/videos')){beginCheck();await released;}return Response.json({items:[]});}}).resolve(fixture,now);
    const rejected=rejecting.catch(e=>e);await checking;
    const follower=createTopResultResolver({...options,fetchImpl:()=>assert.fail('The waiting worker cannot spend after a shared rejection'),pause:async()=>{releaseCheck();await rejected;}});
    await assert.rejects(follower.resolve(fixture,now),'A waiting worker cannot resurrect a video withdrawn by current metadata');await assert.rejects(rejecting);
    assert.equal((await db.query('select video_id from public.nothingsports_youtube_selections')).rows[0].video_id,null);
    await reset();await createTopResultResolver({...options,fetchImpl:found}).resolve(fixture,now);
    await db.query("update public.nothingsports_youtube_selections set selected_at=clock_timestamp()-interval '2 hours'");
    const withdrawalFailure=async(path,o)=>{if(path.endsWith('/nothingsports_withdraw_youtube_lookup'))throw Error('controlled database timeout');return request(path,o);};
    await assert.rejects(createTopResultResolver({...options,request:withdrawalFailure,fetchImpl:async()=>Response.json({items:[]})}).resolve(fixture,now),/controlled database timeout/);
    assert.equal((await db.query('select video_id from public.nothingsports_youtube_selections')).rows[0].video_id,null,'Failure finalisation also clears a known rejected video');
    await assert.rejects(createTopResultResolver({...options,fetchImpl:()=>assert.fail('Cooldown cannot resurrect rejected media')}).resolve(fixture,now));
    await reset();
    const hash='a'.repeat(64),otherHash='b'.repeat(64),token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
    const rpc=async(name,values)=>(await db.query('select public.nothingsports_'+name+'('+values.map((_,i)=>'$'+(i+1)).join(',')+') as r',values)).rows[0].r;
    assert.equal((await rpc('claim_youtube_lookup',[id,hash,token])).state,'claimed');assert((await rpc('reserve_youtube_lookup_quota',[id,hash,token,'search'])).granted);
    await db.query("update public.nothingsports_youtube_selections set lookup_until=clock_timestamp()-interval '1 second'");
    assert.equal((await rpc('claim_youtube_lookup',[id,hash,other])).state,'cooldown','A crashed dispatch cannot immediately spend again');
    assert.equal((await rpc('claim_youtube_lookup',[id,otherHash,other])).state,'claimed','A changed context is not bound to an old negative result');
    assert(!(await rpc('reserve_youtube_lookup_quota',[id,hash,token,'search'])).granted);
    assert(!(await rpc('finish_youtube_lookup',[id,hash,token,'no_results',null,null])).applied,'Stale completion cannot overwrite a replacement owner');
    assert.equal((await db.query('select search_calls from public.nothingsports_youtube_api_daily')).rows[0].search_calls,1);
    // Model a midnight boundary where the existing authority assigns its
    // reservation a different day from the wrapper's entry clock. Roll back
    // this local stub so the real authority and ledger are never replaced.
    await db.exec("reset role;begin;create or replace function public.nothingsports_reserve_youtube_quota(p_bucket text,p_source_token uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$begin return jsonb_build_object('granted',true,'quota',jsonb_build_object('day',((clock_timestamp() at time zone 'America/Los_Angeles')::date+1)::text));end;$$;set role service_role;");
    const boundaryId='fixture:test:pacific-boundary';
    assert.equal((await rpc('claim_youtube_lookup',[boundaryId,hash,token])).state,'claimed');assert((await rpc('reserve_youtube_lookup_quota',[boundaryId,hash,token,'search'])).granted);
    assert((await db.query("select lookup_quota_day=((clock_timestamp() at time zone 'America/Los_Angeles')::date+1) as correct from public.nothingsports_youtube_selections where fixture_id=$1",[boundaryId])).rows[0].correct,'Fixture attribution uses the granted reservation day, including a midnight boundary');
    await db.exec('rollback;set role service_role;');
    await reset();
    await db.query("insert into public.nothingsports_youtube_api_daily(quota_day,search_calls,ordinary_calls,scheduled_search_calls) values((clock_timestamp() at time zone 'America/Los_Angeles')::date,90,0,45)");
    let playlists=0;metadata=0;
    const exhausted=async url=>{const u=new URL(url);assert(!u.pathname.endsWith('/search'),'Official upload lookup must work without a new search');if(u.pathname.endsWith('/playlistItems')){playlists++;assert.equal(u.searchParams.get('playlistId'),'UU33-OkQ6VCYk8xtml8Pk4-g');return Response.json({items:[{snippet:{...video.snippet,resourceId:{videoId:video.id}},contentDetails:{videoId:video.id,videoPublishedAt:video.snippet.publishedAt}}]});}metadata++;assert(u.pathname.endsWith('/videos'));return Response.json({items:[video]});};
    const {officialUploads}=require('../lib/highlight-official-uploads');
    const resolver=createTopResultResolver({...options,discoverUploads:officialUploads,fetchImpl:exhausted});
    assert.equal((await resolver.resolve(fixture,now)).url,'https://www.youtube.com/watch?v='+video.id);assert.equal(playlists,1);assert.equal(metadata,1);
    const ledger=(await db.query('select search_calls,ordinary_calls,scheduled_search_calls from public.nothingsports_youtube_api_daily')).rows;
    assert.deepEqual(ledger,[{search_calls:90,ordinary_calls:2,scheduled_search_calls:45}]);
    row=(await db.query('select lookup_search_calls,lookup_ordinary_calls from public.nothingsports_youtube_selections')).rows[0];assert.deepEqual(row,{lookup_search_calls:0,lookup_ordinary_calls:2});
    assert((await resolver.resolve(fixture,now)).cached);assert.equal(playlists+metadata,2,'Warm taps consume zero further calls');
    await db.exec('reset role');
    for(const role of ['anon','authenticated']){
      await db.exec('set role '+role);
      await assert.rejects(db.query('select * from public.nothingsports_youtube_selections'),/permission denied/);
      for(const [name,args] of Object.entries(functions))await assert.rejects(db.query('select public.nothingsports_'+name+'('+args.map(()=> 'null').join(',')+')'),/permission denied/);
      await db.exec('reset role');
    }
    for(const fn of (await db.query("select proname,prosecdef,proconfig from pg_proc where proname=any($1)",[Object.keys(functions).map(n=>'nothingsports_'+n)])).rows){assert.equal(fn.prosecdef,false);assert(fn.proconfig.includes('search_path=""'));assert(fn.proconfig.includes('statement_timeout=3s'));}
    await db.exec(fs.readFileSync('supabase/rollbacks/'+migration,'utf8'));
    assert.equal((await db.query("select md5(pg_get_functiondef(oid)) as hash from pg_proc where proname='nothingsports_reserve_youtube_quota'")).rows[0].hash,before,'The quota authority is unchanged');
    assert.deepEqual((await db.query('select search_calls,ordinary_calls,scheduled_search_calls from public.nothingsports_youtube_api_daily')).rows,ledger,'Rollback preserves spent allowance');
    assert.equal((await db.query('select video_id from public.nothingsports_youtube_selections')).rows[0].video_id,video.id,'Rollback preserves the valid selected video');
    assert.equal(JSON.stringify(fixture),original);
    console.log('Highlight lookup SQL/resolver: negative reuse, bounded retry, separate workers, metadata-only refresh, crash/token fencing, official uploads at 90/90, service-only grants and quota/cache-preserving rollback passed.');
  }finally{await db.close();Date.now=outerClock;}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={main};
