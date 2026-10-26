'use strict';
const fs=require('node:fs'),path=require('node:path');
const contract=require('./live-coverage-read-contract');
const schema=require('./public-coverage-schema');
const MAX_BYTES=2*1024*1024,VERSION='live-coverage-public-capture.v2';
const sequence=require('./public-coverage-sequence'),{digest,same}=sequence;
const consistency='non-atomic-per-page; additive-observations-only; omissions-are-not-deletions';
const producer={schemaVersion:'public-coverage-producer.v1',expectedReaderDefinitionMd5:contract.reviewedDefinition.reader,expectedProjectorDefinitionMd5:contract.reviewedDefinition.projector,definitionEvidence:'ROOT metadata-only review 26October2026; not fetched by this exporter',hashBasis:'JSON.stringify(parsed-rows); not wire bytes or an authenticity signature',maxResponseBytes:2*1024*1024,responseByteBasis:'fetch-decoded-body-before-parse'};
function validate(value){
 schema.object(Object.fromEntries(['schemaVersion','provenance','startedAt','capturedAt','consistency','producer','pages'].map(k=>[k,()=>{}])))(value);
 if(value.schemaVersion!==VERSION||!['service-read','test-service-response'].includes(value.provenance))schema.fail('PROVENANCE_UNQUALIFIED');
 if(value.consistency!==consistency||!same(value.producer,producer))schema.fail('PRODUCER_CONTRACT');
 if(Buffer.byteLength(JSON.stringify(value))>MAX_BYTES)schema.fail('PAGE_BUDGET');
 const {rows}=sequence.validate(value);
 return {schemaVersion:VERSION,provenance:value.provenance,capturedAt:value.capturedAt,startedAt:value.startedAt,pages:value.pages.length,rows,sha256:digest(value),consistency,producer:{...producer},requestContract:contract.manifest(),currentSourceAcceptance:false,wholeSnapshotAcceptance:false,omissionsMayDelete:false,pendingIntents:pendingIntents()};
}
function outputPath(file){
 if(!path.isAbsolute(file)||path.basename(file)!=='public-coverage.json'||fs.realpathSync(path.dirname(file))!==path.dirname(file))schema.fail('OUTPUT_PATH');
 try{fs.lstatSync(file);schema.fail('OUTPUT_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}return file;
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
async function produce({request,clock=()=>new Date(),output,format='v2'}={}){
 if(!['v2','v3'].includes(format))schema.fail('FORMAT');
 const capsules=format==='v3'?require('./public-coverage-capsules'):null;
 if(output!==undefined)(capsules?capsules.outputPath:outputPath)(output);
 const outputGuard=capsules&&output!==undefined?capsules.outputGuard(output):null;
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
  outputGuard?.verify();
  pages.push({request:expected,requestSha256:digest(expected),requestedAt,receivedAt,rows,sha256:digest(rows)});
  if(capsules&&Buffer.byteLength(capsules.pageBody(pages.at(-1),pages.length-1))>capsules.PART_BYTES)schema.fail('CAPSULE_BUDGET');
  if(Buffer.byteLength(JSON.stringify(pages))>(capsules?capsules.TOTAL_BYTES:MAX_BYTES))schema.fail('PAGE_BUDGET');
  return rows;
 });
 const value={schemaVersion:VERSION,provenance:'service-read',startedAt,capturedAt:stamp(),consistency,producer:{...producer},pages};
 // Injection identifies a local test seam only. Neither provenance string nor
 // hashes establish who collected an arbitrary file or current sporting freshness.
 if(request!==require('../../lib/supabase-server').supabaseServiceRequest)value.provenance='test-service-response';
 if(capsules){const set=capsules.fromPages(value),{receipt}=capsules.consume(set);if(output!==undefined)capsules.save(set,output,outputGuard);return {value:set,receipt};}
 const receipt=validate(value);if(output!==undefined)save(value,output);
 return {value,receipt};
}
function pendingIntents(){return ['DEPLOY qualifies actual service capture and current source freshness; saved hashes are not authenticity','DEPLOY checks private protected-content/retirement rules without exporting controls','DEPLOY alone qualifies shared publication and full/quick closure; no ACK implied'];}
module.exports={produce,validate,outputPath,MAX_BYTES,VERSION,consistency,producerMetadata:()=>structuredClone(producer),pendingIntents};
