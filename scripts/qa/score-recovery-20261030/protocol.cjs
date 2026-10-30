'use strict';
const {performance}=require('node:perf_hooks');
const ORIGIN='https://mkghopnkhcxtmfrcjdbc.supabase.co',RPC='/rest/v1/rpc/nothingsports_read_current_fixtures';
const RUGBY_SOURCES=Object.freeze(['mru','wru','mrs','wrs'].flatMap(s=>[`discovery-rugby-${s}`,`discovery-rugby-${s}-near`]));
const SOURCES=Object.freeze(['cricket-ca-current','cricket-ca-4710','discovery-cricket-history','discovery-cricket-near',...RUGBY_SOURCES]);
const PAGE=500,MAX_REQUESTS=8,DEADLINE=10000,PAGE_BYTES=4194304,TOTAL_BYTES=16777216;
const error=code=>Object.assign(Error(code),{code});
// Only this validator can mint a descriptor. Upstream error properties and
// unapproved names/values are never evidence to serialize.
const ownedShapeFailures=new WeakMap();
const shapeFailure=error=>ownedShapeFailures.get(error);
const ownedShapeSummaries=new WeakMap();
const shapeFailures=error=>ownedShapeSummaries.get(error);
function sourcesFor(coverageSport){if(coverageSport==null)return SOURCES;if(coverageSport!=='rugby-union')throw error('POST_GUARD_SCOPE');return RUGBY_SOURCES;}
function validateActualScope(p){
 if(p.mode!=='live-coverage-canonical'){sourcesFor(p.coverageSport);return;}
 const scoped='--coverage-sport=rugby-union';
 if(p.coverageSport!=='rugby-union'||p.sourceGitSha!=='3d3ec1af93cb261598e9f22db1d67b0ae402fd08'||JSON.stringify(p.entryArgv)!==JSON.stringify(['scripts/update-cards.js','--quick','--source=live-coverage',scoped,'--local-only'])||JSON.stringify(p.sourceArgv)!==JSON.stringify(['scripts/quick-results.js','--source=live-coverage',scoped])||p.childArgvs.some(a=>['scripts/quick-results.js','scripts/publish-feed.js'].includes(a[0])&&!a.includes(scoped)))throw error('GUARD_ACTUAL_SCOPE');
}
const endpoint=(ordinal,coverageSport)=>`${ORIGIN}${RPC}?source_id=in.(${sourcesFor(coverageSport).join(',')})&order=source_id.asc,fixture_id.asc&limit=500&offset=${ordinal*500}`;
function credentials(environment=process.env){return [...new Set(['SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'].flatMap(k=>[environment[k],environment[k]?.trim()]).filter(Boolean))];}
function privacy(values){
 const variants=values.flatMap(value=>[value,Buffer.from(value).toString('base64'),Buffer.from(value).toString('base64url'),Buffer.from(value).toString('hex')]);
 const binary=values.flatMap(value=>{const le=Buffer.from(value,'utf16le');return[Buffer.from(value),le,Buffer.from(le).swap16()];});
 function contains(input){
  const buffer=Buffer.isBuffer(input)?input:Buffer.from(String(input));if(binary.some(b=>buffer.includes(b)))return true;
  let text=buffer.toString('utf8');
  for(let n=0;n<16;n++){
   const compact=text.replace(/\s/g,'');if(variants.some(v=>text.includes(v)||compact.includes(v))||values.some(v=>compact.toLowerCase().includes(Buffer.from(v).toString('hex'))))return true;
   // Paired backslashes represent another escaping layer. Do not decode the
   // final slash first and strand a literal slash between credential letters.
   const next=text.replace(/(\\+)(u[a-f\d]{4}|x[a-f\d]{2})/ig,(_,slashes,encoded)=>slashes.length%2===0?'\\'.repeat(slashes.length/2)+encoded:'\\'.repeat((slashes.length-1)/2)+String.fromCharCode(parseInt(encoded.slice(1),16))).replace(/%([a-f\d]{2})/ig,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&#(?:x([a-f\d]+)|(\d+));/ig,(_,h,d)=>String.fromCodePoint(parseInt(h||d,h?16:10))).replace(/\\\\/g,'\\').replace(/\\\//g,'/');
   if(next===text)return false;text=next;
  }
  // Ambiguous remaining encoded text cannot be exported as public evidence.
  return /\\[ux]|%[a-f\d]{2}|&#/i.test(text);
 }
 return {contains};
}
function rejectDuplicateKeys(text){
 const stack=[],tokens=text.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]/g)||[];
 for(const token of tokens){
  if(token==='{'){stack.push({object:true,key:true,seen:new Set()});continue;}
  if(token==='['){stack.push({object:false});continue;}
  if(token==='}'||token===']'){stack.pop();continue;}
  const top=stack.at(-1);if(!top?.object)continue;
  if(token===','){top.key=true;continue;}if(token===':'){top.key=false;continue;}
  if(token.startsWith('"')&&top.key){const key=JSON.parse(token);if(top.seen.has(key))throw error('POST_GUARD_DUPLICATE_KEY');top.seen.add(key);top.key=false;}
 }
}
function validatePublic(rows,schema,secret,check=()=>{},coverageSport){
 const selectedSources=sourcesFor(coverageSport);
 if(!Array.isArray(rows)||rows.length>PAGE)throw error('POST_GUARD_ROW_SHAPE');
 let nodes=0,firstShape=null,totalRefusals=0,overflowCount=0;const descriptors=new Map();
 const indexes=new Map(Object.keys(schema.paths).sort().map((key,index)=>[key,index]));
 const jsonTypes=new Set(['null','array','object','number','string','boolean']);
 function shapeError(reason,type,index,parent){
  const e=error('POST_GUARD_FIXTURE_SHAPE');
  if(jsonTypes.has(type))ownedShapeFailures.set(e,Object.freeze({reason,...(index===undefined?{parentIndex:parent}:{pathIndex:index}),actualType:type}));
  firstShape ||= e;totalRefusals++;
  const descriptor=shapeFailure(e),key=descriptor&&JSON.stringify(descriptor);
  if(key&&descriptors.has(key))descriptors.get(key).count++;
  else if(key&&descriptors.size<16)descriptors.set(key,{...descriptor,count:1});
  else overflowCount++;
  return e;
 }
 function finish(knownScanComplete){
  ownedShapeSummaries.set(firstShape,Object.freeze({descriptors:Object.freeze([...descriptors.values()].map(Object.freeze)),totalRefusals,overflowCount,knownScanComplete}));
 }
 const forbidden=new Set(['userid','accountid','email','accesstoken','refreshtoken','apikey','authorization','cookie','deviceid','devicehash','preferences','eventuserstate','eventspoilerstate','archivedevents','ratings','password','constructor','prototype','proto']);
 function walk(value,path,depth,parent){
  check();
  if(++nodes>schema.maxNodes||depth>schema.maxDepth)throw error('POST_GUARD_SHAPE_BUDGET');
  const type=value===null?'null':Array.isArray(value)?'array':typeof value;
  const index=indexes.get(path);
  // Refuse this branch, retaining at most16 fixed descriptors. Unknown or
  // wrongly typed subtrees are never visited; known siblings stay bounded by
  // the same node/depth budget. No refused page can return successfully.
  if(index===undefined){shapeError('UNKNOWN_PATH',type,undefined,parent);return;}
  if(!schema.paths[path].includes(type)){shapeError('TYPE_NOT_ALLOWED',type,index);return;}
  if(type==='number'&&!Number.isFinite(value)){shapeError('NON_FINITE_NUMBER',type,index);return;}
  if(type==='string'&&(Buffer.byteLength(value)>schema.maxStringBytes||secret.contains(value)))throw error('POST_GUARD_PRIVATE_PAYLOAD');
  if(type==='array')for(const item of value)walk(item,path+'[]',depth+1,index);
  if(type==='object')for(const [key,item]of Object.entries(value)){
   if(key.startsWith('_')||forbidden.has(key.replace(/[_-]/g,'').toLowerCase()))throw error('POST_GUARD_PRIVATE_PAYLOAD');
   if(key.includes('.')||key.includes('[')||key.includes(']')){
    check();
    if(++nodes>schema.maxNodes||depth+1>schema.maxDepth)throw error('POST_GUARD_SHAPE_BUDGET');
    shapeError('UNKNOWN_PATH',item===null?'null':Array.isArray(item)?'array':typeof item,undefined,index);continue;
   }
   walk(item,path+'.'+key,depth+1,index);
  }
 }
 try{for(const row of rows){
  check();
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['source_id','fixture_id','fixture','identity_keys'].includes(k))||!selectedSources.includes(row.source_id)||typeof row.fixture_id!=='string'||!row.fixture_id||row.fixture_id.length>300||!row.fixture||row.fixture.id!==row.fixture_id||coverageSport&&row.fixture.key!=='rugby')throw error('POST_GUARD_ROW_SHAPE');
  if(row.identity_keys!=null&&(!Array.isArray(row.identity_keys)||row.identity_keys.length>64||row.identity_keys.some(id=>typeof id!=='string'||id.length>300)))throw error('POST_GUARD_ROW_SHAPE');
  walk(row.fixture,'',0);
 }}catch(e){if(firstShape){finish(false);throw firstShape;}throw e;}
 if(firstShape){finish(true);throw firstShape;}
}
module.exports={ORIGIN,RPC,SOURCES,RUGBY_SOURCES,sourcesFor,validateActualScope,PAGE,MAX_REQUESTS,DEADLINE,PAGE_BYTES,TOTAL_BYTES,error,endpoint,credentials,privacy,rejectDuplicateKeys,validatePublic,shapeFailure,shapeFailures,performance};
