'use strict';
const assert=require('node:assert/strict');

const capture=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;}});
async function main(){
  const supabase=require('../lib/supabase-server');
  const originals={request:supabase.supabaseServiceRequest,user:supabase.authenticatedUser};
  let actor={id:'owner-test',app_metadata:{role:'admin'}},state={event_id:'epl-2026-27-128980',revision:2,history:[],held:false,pending_copy:{hook:'Retained private draft'}},writes=0,reads=0,conflict=false,failure=false;
  supabase.authenticatedUser=async token=>{if(!token)throw new supabase.SupabaseRequestError('Sign in is required.',{status:401,payload:{code:'missing_access_token'}});return actor;};
  supabase.supabaseServiceRequest=async(url,options={})=>{
    const u=new URL(url,'https://supabase.test');
    assert.equal(u.pathname,'/rest/v1/nothingsports_editorial_maintenance','test forbids unrelated service access');
    if(failure)throw Error('private upstream detail must not reach the browser');
    const method=options.method||'GET';
    if(method==='GET'){reads++;return [structuredClone(state)];}
    if(method==='POST')return [];
    assert.equal(method,'PATCH');
    if(conflict)return [];
    assert.equal(u.searchParams.get('revision'),'eq.'+state.revision);
    state={...state,...options.body};writes++;return [structuredClone(state)];
  };
  const handler=require('../api/comms');
  const request=async(body,token='test')=>{const r=capture();await handler({method:'POST',query:{},headers:{authorization:token?'Bearer '+token:''},body},r);assert.equal(r.headers['Cache-Control'],'private, no-store, max-age=0');assert.equal(r.headers.Vary,'Authorization');return r;};
  const body={action:'editorial-save',eventId:state.event_id,expectedRevision:2,copy:{hook:'A hook',formCopy:'Source-backed form',closingCopy:'A storyline',synopsis:'Match context'}};
  try{
    assert.equal((await request(body,'')).statusCode,401);
    actor={id:'viewer-test',app_metadata:{role:'viewer'},user_metadata:{role:'admin'}};
    assert.equal((await request(body)).statusCode,403,'editable user metadata cannot grant editorial access');
    assert.equal(reads,0);assert.equal(writes,0);
    actor={id:'owner-test',app_metadata:{role:'admin'}};
    const before=structuredClone(state);
    for(const [input,status,code,message] of [
      [{...body,expectedRevision:1},409,'editorial_revision_conflict',/reload before saving/i],
      [{...body,copy:{...body.copy,hook:''}},400,'editorial_invalid_copy',/valid hook/i],
      [{...body,copy:{hook:'same',formCopy:'same',closingCopy:'same',synopsis:'same'}},400,'editorial_invalid_copy',/distinct/i],
      [{...body,eventId:'not-a-fixture'},404,'editorial_unknown_fixture',/unknown/i],
      [{...body,eventId:'evt_84'},409,'editorial_protected_fixture',/protected/i],
      [{...body,action:'editorial-delete'},400,'editorial_unknown_action',/unknown/i]
    ]){
      const result=await request(input);assert.equal(result.statusCode,status,code);assert.equal(result.body.code,code);assert.match(result.body.error,message);assert.deepEqual(state,before,'rejected request retains queued private copy and revision');
    }
    conflict=true;const raced=await request(body);assert.equal(raced.statusCode,409);assert.equal(raced.body.code,'editorial_revision_conflict');assert.deepEqual(state,before);conflict=false;
    failure=true;const outage=await request(body);assert.equal(outage.statusCode,500);assert.equal(outage.body.code,'comms_unavailable');assert(!JSON.stringify(outage.body).includes('private upstream'));assert.deepEqual(state,before);failure=false;
    const saved=await request(body);assert.equal(saved.statusCode,200);assert.equal(saved.body.queued,true);assert.equal(state.revision,3);assert.deepEqual(state.pending_copy,body.copy);
    const held=await request({action:'editorial-hold',eventId:state.event_id,expectedRevision:3,held:true});assert.equal(held.statusCode,200);assert.equal(state.held,true);assert.equal(state.revision,4);assert.deepEqual(state.pending_copy,body.copy);assert.equal(writes,2);
    console.log('Editorial API: private auth, forged-role denial, actionable validation/conflict/protection, unchanged rejected drafts, sanitised outages, queued save and hold passed.');
  }finally{supabase.supabaseServiceRequest=originals.request;supabase.authenticatedUser=originals.user;}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
