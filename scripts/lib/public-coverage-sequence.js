'use strict';
const crypto=require('node:crypto'),contract=require('./live-coverage-read-contract'),schema=require('./public-coverage-schema');
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// One source/page/clock contract; format-specific byte limits are enforced by
// each caller before this shared observation sequence can be consumed.
function validate(value){
 const start=schema.instant(value.startedAt),end=schema.instant(value.capturedAt);
 if(end<start||end-start>contract.MAX_PAGES*10000)schema.fail('CAPTURE_WINDOW');
 if(!Array.isArray(value.pages)||!value.pages.length||value.pages.length>contract.MAX_PAGES)schema.fail('PAGE_BUDGET');
 let prior=start,lastRow=null,rows=0;const seen=new Set();
 for(const [page,entry]of value.pages.entries()){
  schema.object(Object.fromEntries(['request','requestSha256','requestedAt','receivedAt','rows','sha256'].map(k=>[k,()=>{}])))(entry);
  if(!same(entry.request,contract.requestForPage(page))||entry.requestSha256!==digest(entry.request))schema.fail('REQUEST_CONTRACT');
  const requested=schema.instant(entry.requestedAt),received=schema.instant(entry.receivedAt);
  if(requested<prior||received<requested||received>requested+10000||received>end)schema.fail('CAPTURE_WINDOW');prior=received;
  if(!Array.isArray(entry.rows)||entry.rows.length>contract.PAGE_SIZE||entry.rows.length<contract.PAGE_SIZE&&page!==value.pages.length-1)schema.fail('PAGE_COMPLETENESS');
  if(entry.sha256!==digest(entry.rows))schema.fail('PAGE_HASH');
  for(const row of entry.rows){
   schema.validateRow(row,end);const key=row.source_id+'|'+row.fixture_id;
   if(seen.has(key))schema.fail('SOURCE_OR_DUPLICATE');seen.add(key);
   if(lastRow&&(row.source_id<lastRow.source_id||row.source_id===lastRow.source_id&&row.fixture_id<=lastRow.fixture_id))schema.fail('PAGE_ORDER_OR_DRIFT');lastRow=row;rows++;
  }
 }
 if(value.pages.at(-1).rows.length===contract.PAGE_SIZE)schema.fail('PAGE_COMPLETENESS');
 return {rows};
}
module.exports={digest,same,validate};
