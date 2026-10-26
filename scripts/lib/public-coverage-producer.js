'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const contract=require('./live-coverage-read-contract');
const schema=require('./public-coverage-schema');
const MAX_BYTES=2*1024*1024,VERSION='live-coverage-public-capture.v2';
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const consistency='non-atomic-per-page; additive-observations-only; omissions-are-not-deletions';
const producer={schemaVersion:'public-coverage-producer.v1',expectedReaderDefinitionMd5:contract.reviewedDefinition.reader,expectedProjectorDefinitionMd5:contract.reviewedDefinition.projector,definitionEvidence:'ROOT metadata-only review 26October2026; not fetched by this exporter',hashBasis:'JSON.stringify(parsed-rows); not wire bytes or an authenticity signature',maxResponseBytes:2*1024*1024,responseByteBasis:'fetch-decoded-body-before-parse'};
function validate(value){
 schema.object(Object.fromEntries(['schemaVersion','provenance','startedAt','capturedAt','consistency','producer','pages'].map(k=>[k,()=>{}])))(value);
 if(value.schemaVersion!==VERSION||!['service-read','test-service-response'].includes(value.provenance))schema.fail('PROVENANCE_UNQUALIFIED');
 if(value.consistency!==consistency||!same(value.producer,producer))schema.fail('PRODUCER_CONTRACT');
 const start=schema.instant(value.startedAt),end=schema.instant(value.capturedAt);
 if(end<start||end-start>contract.MAX_PAGES*10000) schema.fail('CAPTURE_WINDOW');
 if(!Array.isArray(value.pages)||!value.pages.length||value.pages.length>contract.MAX_PAGES||Buffer.byteLength(JSON.stringify(value))>MAX_BYTES)schema.fail('PAGE_BUDGET');
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
 return {schemaVersion:VERSION,provenance:value.provenance,capturedAt:value.capturedAt,startedAt:value.startedAt,pages:value.pages.length,rows,sha256:digest(value),consistency,producer:{...producer},requestContract:contract.manifest(),currentSourceAcceptance:false,wholeSnapshotAcceptance:false,omissionsMayDelete:false,pendingIntents:['DEPLOY qualifies actual service capture and current source freshness; saved hashes are not authenticity','DEPLOY checks private protected-content/retirement rules without exporting controls','DEPLOY alone qualifies shared publication and full/quick closure; no ACK implied']};
}
function outputPath(file){
 if(!path.isAbsolute(file)||path.basename(file)!=='public-coverage.json'||fs.realpathSync(path.dirname(file))!==path.dirname(file))schema.fail('OUTPUT_PATH');
 if(fs.existsSync(file))schema.fail('OUTPUT_EXISTS');return file;
}
function save(value,file){
 outputPath(file);const data=JSON.stringify(value)+'\n';
 // The actual saved representation, not only compact JSON, keeps the old cap.
 if(Buffer.byteLength(data)>MAX_BYTES)schema.fail('PAGE_BUDGET');
 const fd=fs.openSync(file,'wx',0o600);
 let failure;try{fs.writeFileSync(fd,data);}catch(error){failure=error;}
 try{fs.closeSync(fd);}catch(error){failure ||= error;}
 if(failure){try{fs.unlinkSync(file);}catch{}throw failure;}
}
async function produce({request,clock=()=>new Date(),output}={}){
 if(output!==undefined)outputPath(output);
 const stamp=()=>{const at=clock();return new Date(schema.instant(typeof at==='string'?at:at.toISOString())).toISOString();};
 const startedAt=stamp(),pages=[];
 // Reuse the real reader (source, overlap, page and terminal budget checks).
 // No second collector, request loop, schema/DB owner or provider fallback.
 await require('../sync-live-coverage').readRows(async(resource,options)=>{
  const expected=contract.requestForPage(pages.length);
  if(!same({path:resource,...options},expected))schema.fail('REQUEST_CONTRACT');
  const requestedAt=stamp();let response;
  try{response=await request(resource,{...options,maxResponseBytes:MAX_BYTES});}
  catch(error){
   // Preserve an actionable class/status without exporting backend/body text.
   const known=new Set(['supabase_timeout','supabase_response_too_large','supabase_response_stream_unavailable','supabase_response_stream_invalid','supabase_response_limit_invalid','supabase_service_role_not_configured','supabase_not_configured','supabase_maintenance']);
   const code=known.has(error?.payload?.code)?error.payload.code:'service_read_failed';
   const safe=Error('PUBLIC_COVERAGE_'+code.toUpperCase());safe.status=Number.isInteger(error?.status)?error.status:502;throw safe;
  }
  const receivedAt=stamp();
  // Own the exact response before asynchronous callers can mutate it. Reject
  // unknown nested structures; never silently strip or retain privileged raw JSON.
  const rows=structuredClone(response);
  if(!Array.isArray(rows)||rows.length>contract.PAGE_SIZE)schema.fail('PAGE_COMPLETENESS');
  for(const row of rows)schema.validateRow(row,schema.instant(receivedAt));
  pages.push({request:expected,requestSha256:digest(expected),requestedAt,receivedAt,rows,sha256:digest(rows)});
  if(Buffer.byteLength(JSON.stringify(pages))>MAX_BYTES)schema.fail('PAGE_BUDGET');
  return rows;
 });
 const value={schemaVersion:VERSION,provenance:'service-read',startedAt,capturedAt:stamp(),consistency,producer:{...producer},pages};
 // Injection identifies a local test seam only. Neither provenance string nor
 // hashes establish who collected an arbitrary file or current sporting freshness.
 if(request!==require('../../lib/supabase-server').supabaseServiceRequest)value.provenance='test-service-response';
 const receipt=validate(value);if(output!==undefined)save(value,output);
 return {value,receipt};
}
module.exports={produce,validate,outputPath,MAX_BYTES,VERSION};
