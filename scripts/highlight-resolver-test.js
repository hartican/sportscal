'use strict';
// Existing media-policy tests keep their strict provider/cache fakes. This
// boundary fake implements the new lookup RPCs; real SQL is tested separately.
const assert=require('node:assert/strict');
const production=require('../lib/youtube-top-result');
const stores=new WeakMap();
function wrap(request){
  assert.equal(typeof request,'function');
  if(stores.has(request))return stores.get(request).wrapped;
  const rows=new Map();
  const wrapped=async(path,options={})=>{
    const b=options.body||{},id=b.p_fixture_id,r=rows.get(id),now=Date.now();
    if(path.endsWith('/nothingsports_claim_youtube_lookup')){
      if(r?.until>now)return {state:'busy'};
      if(r?.hash===b.p_query_hash&&r.after>now)return {state:'cooldown'};
      rows.set(id,{hash:b.p_query_hash,token:b.p_token,until:now+30000});return {state:'claimed'};
    }
    if(path.endsWith('/nothingsports_reserve_youtube_lookup_quota')){
      assert(r?.token===b.p_token&&r.hash===b.p_query_hash);
      const result=await request('/rest/v1/rpc/nothingsports_reserve_youtube_quota',{...options,body:{p_bucket:b.p_bucket,p_source_token:null}});
      if(result?.granted)r.after=now+1800000;return result;
    }
    if(path.endsWith('/nothingsports_withdraw_youtube_lookup')){
      assert(r?.token===b.p_token);
      await request('/rest/v1/nothingsports_youtube_selections?fixture_id=eq.'+encodeURIComponent(id)+'&query_hash=eq.'+b.p_query_hash+'&video_id=eq.'+b.p_video_id,{...options,method:'DELETE'});return {applied:true};
    }
    if(path.endsWith('/nothingsports_finish_youtube_lookup')){
      if(r?.token!==b.p_token)return {applied:false};
      if(b.p_outcome==='selected')await request('/rest/v1/nothingsports_youtube_selections',{...options,body:b.p_selection});
      r.until=0;r.after=b.p_outcome==='selected'?0:now+1800000;return {applied:true};
    }
    return request(path,options);
  };
  stores.set(request,{rows,wrapped});return wrapped;
}
function reset(request){stores.get(request)?.rows.clear();}
function createTopResultResolver(options){return production.createTopResultResolver({...options,request:wrap(options.request),discoverUploads:options.discoverUploads||async function(){return [];}});}
module.exports={createTopResultResolver,wrap,reset};
