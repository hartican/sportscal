'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const schema=require('./public-coverage-schema'),sequence=require('./public-coverage-sequence'),files=require('./public-coverage-files'),contract=require('./live-coverage-read-contract');
const VERSION='live-coverage-public-capture.v3',PAGE='live-coverage-public-page.v3',PART_BYTES=2097152,TOTAL_BYTES=4194304,MANIFEST_BYTES=65536,MAX_PARTS=8;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const partName=i=>'public-coverage-page-'+String(i).padStart(3,'0')+'.json';
const keys=(names)=>Object.fromEntries(names.split(' ').map(k=>[k,()=>{}]));
const encoded=v=>JSON.stringify(v)+'\n';
function clockHash(rows){
 const clocks=[];const walk=(value,prefix)=>{if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){const at=prefix+'/'+k;if(/At$|TimeUtc$|Date$|^(?:date|time|sourceTime)$/.test(k))clocks.push([at,v]);else if(v&&typeof v==='object')walk(v,at);}};
 rows.forEach((r,i)=>walk(r.fixture,String(i)));return sequence.digest(clocks);
}
function metadata(){return {...require('./public-coverage-producer').producerMetadata(),savedFormat:VERSION,partBytes:PART_BYTES,totalBytes:TOTAL_BYTES,manifestBytes:MANIFEST_BYTES,maxCapsules:MAX_PARTS};}
function descriptor(page,i,body){return {page:i,path:partName(i),bytes:Buffer.byteLength(body),sha256:sha(Buffer.from(body)),rowCount:page.rows.length,rowsSha256:page.sha256,originalClocksSha256:clockHash(page.rows),request:page.request,requestSha256:page.requestSha256,requestedAt:page.requestedAt,receivedAt:page.receivedAt};}
function parseManifest(body){
 if(typeof body!=='string'||Buffer.byteLength(body)>MANIFEST_BYTES)schema.fail('MANIFEST_BUDGET');
 const m=files.json(Buffer.from(body));schema.object(keys('schemaVersion provenance startedAt capturedAt consistency producer capsules terminalPage terminalRowCount'))(m);
 if(m.schemaVersion!==VERSION||!['service-read','test-service-response'].includes(m.provenance))schema.fail('PROVENANCE_UNQUALIFIED');
 if(m.consistency!==require('./public-coverage-producer').consistency||!sequence.same(m.producer,metadata()))schema.fail('PRODUCER_CONTRACT');
 if(!Array.isArray(m.capsules)||!m.capsules.length||m.capsules.length>MAX_PARTS||m.capsules.length>contract.MAX_PAGES)schema.fail('PAGE_BUDGET');
 for(const [i,d]of m.capsules.entries()){
  schema.object(keys('page path bytes sha256 rowCount rowsSha256 originalClocksSha256 request requestSha256 requestedAt receivedAt'))(d);
  if(d.page!==i||d.path!==partName(i)||!Number.isSafeInteger(d.bytes)||d.bytes<1||d.bytes>PART_BYTES||!Number.isInteger(d.rowCount)||d.rowCount<0||d.rowCount>contract.PAGE_SIZE)schema.fail('CAPSULE_DESCRIPTOR');
  for(const k of ['sha256','rowsSha256','originalClocksSha256','requestSha256'])if(typeof d[k]!=='string'||!/^[a-f0-9]{64}$/.test(d[k]))schema.fail('CAPSULE_HASH');
 }
 if(m.terminalPage!==m.capsules.length-1||m.terminalRowCount!==m.capsules.at(-1).rowCount||m.terminalRowCount>=contract.PAGE_SIZE)schema.fail('PAGE_COMPLETENESS');
 if(Buffer.byteLength(body)+m.capsules.reduce((n,d)=>n+d.bytes,0)>TOTAL_BYTES)schema.fail('AGGREGATE_BUDGET');return m;
}
function consume(value){
 schema.object(keys('schemaVersion capturedAt manifestBody capsules'))(value);
 if(value.schemaVersion!==VERSION)schema.fail('PROVENANCE_UNQUALIFIED');
 const m=parseManifest(value.manifestBody);if(value.capturedAt!==m.capturedAt)schema.fail('CAPTURE_WINDOW');
 if(!Array.isArray(value.capsules)||value.capsules.length!==m.capsules.length)schema.fail('PAGE_COMPLETENESS');
 const pages=[];let total=Buffer.byteLength(value.manifestBody);
 for(const [i,p]of value.capsules.entries()){
  schema.object(keys('path body'))(p);const d=m.capsules[i];
  if(p.path!==d.path||typeof p.body!=='string')schema.fail('CAPSULE_DESCRIPTOR');
  const length=Buffer.byteLength(p.body);if(length!==d.bytes||length>PART_BYTES)schema.fail('CAPSULE_HASH');
  const bytes=Buffer.from(p.body);if(sha(bytes)!==d.sha256)schema.fail('CAPSULE_HASH');total+=bytes.length;
  const page=files.json(bytes);schema.object(keys('schemaVersion page request requestSha256 requestedAt receivedAt rows sha256'))(page);
  if(page.schemaVersion!==PAGE||page.page!==i||!Array.isArray(page.rows)||!sequence.same(descriptor(page,i,p.body),d))schema.fail('CAPSULE_DESCRIPTOR');
  const {schemaVersion,page:pageNumber,...entry}=page;pages.push(entry);
 }
 if(total>TOTAL_BYTES)schema.fail('AGGREGATE_BUDGET');
 const {rows}=sequence.validate({...m,pages});
 return {pages,receipt:{schemaVersion:VERSION,provenance:m.provenance,capturedAt:m.capturedAt,startedAt:m.startedAt,pages:pages.length,rows,sha256:sha(Buffer.from(value.manifestBody)),totalBytes:total,limits:{partBytes:PART_BYTES,totalBytes:TOTAL_BYTES,manifestBytes:MANIFEST_BYTES,maxCapsules:MAX_PARTS},consistency:m.consistency,producer:m.producer,requestContract:contract.manifest(),currentSourceAcceptance:false,wholeSnapshotAcceptance:false,omissionsMayDelete:false,pendingIntents:require('./public-coverage-producer').pendingIntents()}};
}
function pageBody(entry,i){return encoded({schemaVersion:PAGE,page:i,...entry});}
function fromPages(value){
 const capsules=value.pages.map((entry,i)=>({path:partName(i),body:pageBody(entry,i)}));
 const manifest={schemaVersion:VERSION,provenance:value.provenance,startedAt:value.startedAt,capturedAt:value.capturedAt,consistency:value.consistency,producer:metadata(),capsules:value.pages.map((p,i)=>descriptor(p,i,capsules[i].body)),terminalPage:value.pages.length-1,terminalRowCount:value.pages.at(-1).rows.length};
 const set={schemaVersion:VERSION,capturedAt:value.capturedAt,manifestBody:encoded(manifest),capsules};consume(set);return set;
}
function namespace(dir,expected){
 const names=fs.readdirSync(dir).filter(n=>n.startsWith('public-coverage-page-')).sort();
 if(!sequence.same(names,[...expected].sort()))schema.fail('EXTRA_OR_MISSING_CAPSULE');
}
function read(file,pinned,body){
 if(path.basename(file)!=='public-coverage.json')schema.fail('INPUT_PATH');
 const dir=path.dirname(file),m=parseManifest(body),handles=[];let primary;
 try{
  namespace(dir,m.capsules.map(d=>d.path));
  // Open all expected regular NOFOLLOW descriptors before reading any part.
  for(const d of m.capsules)handles.push(files.open(path.join(dir,d.path),PART_BYTES));
  if(handles.some((h,i)=>h.size!==m.capsules[i].bytes))schema.fail('CAPSULE_HASH');
  if(Buffer.byteLength(body)+handles.reduce((n,h)=>n+h.size,0)>TOTAL_BYTES)schema.fail('AGGREGATE_BUDGET');
  const capsules=handles.map((h,i)=>{const bytes=h.read();return {path:m.capsules[i].path,body:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)};});
  handles.forEach(h=>h.verify());pinned.verify();namespace(dir,m.capsules.map(d=>d.path));
  const set={schemaVersion:VERSION,capturedAt:m.capturedAt,manifestBody:body,capsules};consume(set);return set;
 }catch(error){primary=error;throw error;}finally{let cleanup;for(const h of handles)try{h.close();}catch(error){cleanup ||= error;}if(cleanup&&!primary)throw cleanup;}
}
function outputPath(file){
 if(path.basename(file)!=='public-coverage.json')schema.fail('OUTPUT_PATH');files.parent(file);
 for(const name of ['public-coverage.json',...Array.from({length:MAX_PARTS},(_,i)=>partName(i))])try{fs.lstatSync(path.join(path.dirname(file),name));schema.fail('OUTPUT_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(fs.readdirSync(path.dirname(file)).some(n=>n.startsWith('public-coverage-page-')))schema.fail('OUTPUT_EXISTS');return file;
}
function outputGuard(file){
 outputPath(file);const initial=files.parent(file).stat,dir=path.dirname(file);
 return {initial,verify(){const current=fs.lstatSync(dir,{bigint:true});if([current.dev,current.ino,current.mode,current.mtimeNs,current.ctimeNs].join('|')!==[initial.dev,initial.ino,initial.mode,initial.mtimeNs,initial.ctimeNs].join('|')||fs.realpathSync(dir)!==dir)schema.fail('OUTPUT_CHANGED');outputPath(file);}};
}
function save(value,file,guard){
 const {receipt}=consume(value);guard?.verify();outputPath(file);const dir=path.dirname(file),created=[];
 const parent=guard?.initial||fs.lstatSync(dir,{bigint:true}),stableParent=()=>{const now=fs.lstatSync(dir,{bigint:true});if(now.dev!==parent.dev||now.ino!==parent.ino||fs.realpathSync(dir)!==dir)schema.fail('OUTPUT_CHANGED');};
 try{
  // The manifest is the commit point. No valid set exists until every part is
  // complete; exclusive opens never replace another owner's or last-good file.
  for(const item of [...value.capsules,{path:'public-coverage.json',body:value.manifestBody}]){
   stableParent();const target=path.join(dir,item.path),fd=fs.openSync(target,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
   const stat=fs.fstatSync(fd,{bigint:true});created.push({target,dev:stat.dev,ino:stat.ino});let error;
   try{fs.writeFileSync(fd,item.body);}catch(e){error=e;}try{fs.closeSync(fd);}catch(e){error ||= e;}if(error)throw error;stableParent();
  }
  const pinned=files.open(file,MANIFEST_BYTES);try{const reread=read(file,pinned,new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(pinned.read()));if(consume(reread).receipt.sha256!==receipt.sha256)schema.fail('OUTPUT_CHANGED');}finally{pinned.close();}
 }catch(error){
  for(const item of created.reverse())try{const stat=fs.lstatSync(item.target,{bigint:true});if(stat.dev===item.dev&&stat.ino===item.ino)fs.unlinkSync(item.target);}catch{}
  throw error;
 }
 return receipt;
}
function materialize(value,directory){return save(value,path.join(directory,'public-coverage.json'));}
module.exports={VERSION,PART_BYTES,TOTAL_BYTES,MANIFEST_BYTES,MAX_PARTS,partName,pageBody,fromPages,consume,read,save,outputPath,outputGuard,materialize};
