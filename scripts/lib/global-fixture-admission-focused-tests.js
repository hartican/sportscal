'use strict';
// Focused malformed/pending/raw controls against independent stored D3d.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
async function focused(db){
 const controls=[];
  const column='public.nothingsports_fixture_current',context='nothingsports_fixture_read_private.fixture_context',scores='public.nothingsports_live_scores';
  const id='qa-diag:main',source='qa-diag-source:0';
  const today=(await db.query("select(statement_timestamp()at time zone'Australia/Sydney')::date::text d")).rows[0].d;
  const fixtures=[{source,id,status:'scheduled',date:today},{source:'qa-diag-source:1',id,status:'scheduled',date:today},{source,id:'qa-diag:live-old',status:'live',date:'2020-01-01'},{source,id:'qa-diag:unknown',status:'scheduled'},{source,id:'qa-diag:expired',status:'completed',date:'2020-01-01'}].map(f=>({...f,key:'cricket',homeScore:0,awayScore:0,extra:{zero:0,presentNull:null},scoreCheckedAt:'2026-10-26T00:00:00.123456Z',statusCheckedAt:'2026-10-26T00:00:01.654321Z'}));
  await db.exec('begin');
  for(const sid of [source,'qa-diag-source:1'])await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report)values($1,$2::jsonb)",[sid,JSON.stringify({_fixtureObservations:{[id]:{s:'2026-10-26T00:00:02.123456Z',t:null}}})]);
  for(const f of fixtures){await db.query('insert into '+column+'(source_id,fixture_id,identity_keys,fixture,content_hash)values($1,$2,$3,$4::jsonb,md5($4::text))',[f.source,f.id,[f.id,'alias:'+f.id],JSON.stringify(f)]);await db.query('insert into '+scores+'(source_id,fixture_id,score,content_hash)values($1,$2,$3::jsonb,md5($3::text))',[f.source,f.id,JSON.stringify({status:f.status,homeScore:0,awayScore:0,statusCheckedAt:f.statusCheckedAt})]);}
  await db.exec('commit');
  const predicates=' where source_id=$1 and fixture_id=$2',params=[source,id];
  const mutation=(table,field,value)=>db.query('update '+table+' set '+field+'=$3::jsonb'+predicates,[...params,JSON.stringify(value)]);
  const clearPending=()=>db.exec('delete from nothingsports_fixture_read_private.integrity_pending');
  async function read(query){
   await db.exec("savepoint qa_read;set local statement_timeout='6s';set local lock_timeout='1s';set local role service_role;set local search_path='';");
   await db.query("select set_config('request.headers',$1,true)",['{"x-ns-fixture-source-groups":"v1"}']);
   let result;
   try{result={text:(await db.query(query)).rows[0].text};}catch(error){result={error:error.code};}
   finally{await db.exec('rollback to savepoint qa_read');}
   return result;
  }
  const oldQuery='select bundle::text text from public.qa_admission_staged',newQuery='select bundle::text text from public.nothingsports_current_global_fixture_bundle';
  async function same(name,mutate=async()=>{},options={}){
   await db.exec('begin');let entry={name};
   try{
    let writeError;try{await mutate();}catch(error){writeError=error.code;}
    if(writeError){assert(options.writeReject,'Unexpected fixture setup refusal '+name+':'+writeError);entry={...entry,state:'STORAGE_OR_WRITER_REFUSED_BEFORE_READER',code:writeError,admissionValueProof:false};}
    else{
     const a=await read(oldQuery),b=await read(newQuery);assert.deepEqual(b,a,name+' complete ordered text/error');
     entry={...entry,state:a.error?'SAME_READER_ERROR':'FULL_ORDERED_TEXT_EQUAL',code:a.error||null,bytes:a.text?Buffer.byteLength(a.text):null,sha256:a.text?hash(a.text):null};
     if(options.requireError)assert(a.error,name+' must preserve original error');
    }
   }finally{await db.exec('rollback');}
   controls.push(entry);
  }
  await same('healthy small mixed admission and duplicate source receipts');
  await same('missing context while integrity pending',()=>db.query('delete from '+context+predicates,params));
  await same('missing context without marker',async()=>{await db.query('delete from '+context+predicates,params);await clearPending();});
  await same('explicit integrity pending',()=>db.query('update '+context+' set base_selection=base_selection'+predicates,params));
  await same('shape version not one raw fallback',async()=>{await db.query('update '+context+' set shape_version=0'+predicates,params);await clearPending();});
  for(const side of ['base_selection','score_selection']){
   for(const value of [null,[],false,'invalid'])await same(side+' invalid root '+JSON.stringify(value),async()=>{await mutation(context,side,value);await clearPending();});
   await same(side+' missing calendar descriptor',async()=>{await db.query('update '+context+' set '+side+'='+side+"-'calendarWindow'"+predicates,params);await clearPending();});
   for(const value of [null,[],false,'invalid',{}])await same(side+' invalid/missing calendar '+JSON.stringify(value),async()=>{await db.query('update '+context+' set '+side+'=jsonb_set('+side+",'{calendarWindow}',$3::jsonb)"+predicates,[...params,JSON.stringify(value)]);await clearPending();});
   for(const [field,value]of [['hasDate',null],['hasDate','true'],['hasDate','bad'],['hasStatus',null],['hasStatus',0],['date',42],['status',{}]])await same(side+' calendar '+field+'='+JSON.stringify(value),async()=>{await db.query('update '+context+' set '+side+'=jsonb_set('+side+',$3::text[],$4::jsonb)'+predicates,[...params,['calendarWindow',field],JSON.stringify(value)]);await clearPending();});
   await same(side+' missing boolean key UNKNOWN goes raw',async()=>{await db.query('update '+context+' set '+side+'=jsonb_set('+side+",'{calendarWindow}',("+side+"->'calendarWindow')-'hasDate')"+predicates,params);await clearPending();});
  }
  await same('no score row SQL NULL through actual left join',()=>db.query('delete from '+scores+predicates,params));
  await same('empty base object',()=>mutation(column,'fixture',{}));
  await same('empty score object',()=>mutation(scores,'score',{}));
  for(const [label,table,field]of [['base',column,'fixture'],['score',scores,'score']]){
   await same(label+' SQL NULL storage refusal',()=>db.query('update '+table+' set '+field+'=NULL'+predicates,params),{writeReject:true});
   for(const value of [null,[],false,7,'invalid'])await same(label+' non-object '+JSON.stringify(value),()=>mutation(table,field,value),{writeReject:true});
  }
  for(const fields of [{date:null},{date:''},{date:'TBD'},{date:'2020-01-01',startDate:today},{date:null,startDate:today},{date:null,startDate:null,schedulingWindow:{startsOn:today,endsOn:today}},{date:null,schedulingWindow:null},{date:null,schedulingWindow:[]},{date:null,schedulingWindow:'invalid'},{date:today,endDate:'2020-01-01'},{date:'2020-01-01',status:'live'},{status:null,date:'2020-01-01'}]){
   await same('raw fallback base '+JSON.stringify(fields),async()=>{await db.query('update '+column+' set fixture=fixture||$3::jsonb'+predicates,[...params,JSON.stringify(fields)]);await db.query('delete from '+context+predicates,params);await clearPending();});
   await same('raw fallback score '+JSON.stringify(fields),async()=>{await db.query('update '+scores+' set score=score||$3::jsonb'+predicates,[...params,JSON.stringify(fields)]);await db.query('delete from '+context+predicates,params);await clearPending();});
  }
  assert.equal(controls.length,80);
  assert(controls.filter(c=>c.state==='STORAGE_OR_WRITER_REFUSED_BEFORE_READER').every(c=>['23502','23514','22023'].includes(c.code)));
  return controls;
}
module.exports={focused};
