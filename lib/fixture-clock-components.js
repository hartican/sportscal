'use strict';

// Service-to-service transport only. Never derive these headers from a browser.
const SCHEMA='fixture-clock-components.v1';
const HEADERS=Object.freeze({'x-ns-fixture-components':'clock-v1'});
const ADMISSION_SCHEMA='fixture-admission-components.v1';
const ADMISSION_HEADERS=Object.freeze({'x-ns-fixture-components':'admission-v1'});
const own=(value,key)=>Object.hasOwn(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const jsonValue=value=>value===null||typeof value==='object'||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value));
const timestamp=value=>typeof value==='string'&&(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)||value==='infinity'||value==='-infinity');
const textArray=value=>Array.isArray(value)&&value.every(item=>item===null||typeof item==='string'||textArray(item));

function concat(left,right){
  return object(left)&&object(right)?{...left,...right}:
    [...(Array.isArray(left)?left:[left]),...(Array.isArray(right)?right:[right])];
}

function validate(bundle,admission=false){
  if(!object(bundle)||bundle.schemaVersion!==(admission?ADMISSION_SCHEMA:SCHEMA)||typeof bundle.complete!=='boolean'||!Array.isArray(bundle.rows)||(!admission&&(bundle.rows.length>5001||bundle.complete!==(bundle.rows.length<=5000)))||!Array.isArray(bundle.parsed_clocks)||bundle.parsed_clocks.length>(admission?bundle.rows.length*6:30006))throw Error('Invalid fixture component envelope');
  const clocks=new Map();
  for(const entry of bundle.parsed_clocks){
    if(!object(entry)||!own(entry,'value')||typeof entry.value!=='string'||!own(entry,'stamp')||(entry.stamp!==null&&!timestamp(entry.stamp))||clocks.has(entry.value))throw Error('Invalid parsed fixture clock map');
    clocks.set(entry.value,entry.stamp);
  }
  // Complete validation precedes every merge, including rows after the first.
  for(const row of bundle.rows){
    if(!object(row)||typeof row.source_id!=='string'||typeof row.fixture_id!=='string'||!textArray(row.identity_keys)||!own(row,'base')||!jsonValue(row.base)||!own(row,'score')||!jsonValue(row.score)||!own(row,'base_is_sql_null')||typeof row.base_is_sql_null!=='boolean'||(row.base_is_sql_null&&row.base!==null)||!own(row,'score_is_sql_null')||typeof row.score_is_sql_null!=='boolean'||(row.score_is_sql_null&&row.score!==null)||!Array.isArray(row.raw)||row.raw.length!==6||row.raw.some(key=>key!==null&&typeof key!=='string')||!own(row,'first_completed_at')||(row.first_completed_at!==null&&!timestamp(row.first_completed_at)))throw Error('Invalid fixture component row');
    for(const key of row.raw)if(key!==null&&!clocks.has(key))throw Error('Missing parsed fixture clock');
  }
  return clocks;
}

function decode(bundle){
  // Leave legacy/unknown validation to the existing snapshot contract. Only an
  // explicitly identified component envelope enters this decoder; no retry or
  // healthy legacy fallback is attempted for corrupt components.
  if(bundle?.schemaVersion===ADMISSION_SCHEMA)return decodeAdmission(bundle);
  if(bundle?.schemaVersion!==SCHEMA)return bundle;
  const clocks=validate(bundle);
  return reconstruct(bundle.rows,clocks,bundle.complete);
}

function reconstruct(inputs,clocks,complete){
  const rows=new Array(inputs.length);
  for(let index=0;index<inputs.length;index++){
    const row=inputs[index],raw=row.raw;
    // SQL clock_inputs order: score/base facts, status/base facts, s/t receipts.
    const sf=raw[0]===null?null:clocks.get(raw[0]),bf=raw[1]===null?null:clocks.get(raw[1]);
    const tf=raw[2]===null?null:clocks.get(raw[2]),bt=raw[3]===null?null:clocks.get(raw[3]);
    const sr=raw[4]===null?null:clocks.get(raw[4]),tr=raw[5]===null?null:clocks.get(raw[5]);
    let fixture;
    if(row.base_is_sql_null){
      // PostgreSQL jsonb || is strict: later patches cannot repair SQL NULL.
      fixture=null;
    }else if(object(row.base)&&(row.score_is_sql_null||object(row.score))){
      // Canonical hashes sort keys; preserve values without sorting every row.
      fixture={...row.base,...(row.score_is_sql_null?{}:row.score),
        fixtureObservationSchema:'fixture-observations.v1',scoreFactObservedAt:sf??bf??null,
        statusFactObservedAt:tf??bt??null,scoreCheckedAt:sr??sf??bf??null,statusCheckedAt:tr??tf??bt??null};
      if(row.first_completed_at!==null)fixture.firstConfirmedCompleteAt=row.first_completed_at;
    }else{
      const patch={fixtureObservationSchema:'fixture-observations.v1',scoreFactObservedAt:sf??bf??null,
        statusFactObservedAt:tf??bt??null,scoreCheckedAt:sr??sf??bf??null,statusCheckedAt:tr??tf??bt??null};
      fixture=concat(concat(concat(row.base,row.score_is_sql_null?{}:row.score),patch),
        row.first_completed_at===null?{}:{firstConfirmedCompleteAt:row.first_completed_at});
    }
    rows[index]={source_id:row.source_id,fixture_id:row.fixture_id,identity_keys:row.identity_keys,fixture};
  }
  return {schemaVersion:'current-fixture-bundle.v1',complete,rows};
}

const calendarFields=['status','endDate','date','startDate','schedulingWindow'];
const calendarFlags=['hasStatus','hasEndDate','hasDate','hasStartDate','hasSchedulingWindow'];
const datePattern=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const calendarDate=value=>typeof value==='string'&&value.length===10&&datePattern.test(value);
const nullableTextArray=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>x===null||typeof x==='string');
function validWindow(window){
  return object(window)&&calendarFields.every(k=>own(window,k))&&calendarFlags.every(k=>own(window,k)&&(window[k]===null||typeof window[k]==='boolean'))&&calendarFields.slice(0,4).every(k=>window[k]===null||typeof window[k]==='string');
}
function decodeAdmission(bundle){
  const clocks=validate(bundle,true);
  if(bundle.complete!==true||!Number.isSafeInteger(bundle.input_count)||bundle.input_count!==bundle.rows.length||typeof bundle.integrity_clear!=='boolean'||typeof bundle.lower_date!=='string'||!calendarDate(bundle.lower_date)||typeof bundle.upper_date!=='string'||!calendarDate(bundle.upper_date)||!timestamp(bundle.statement_clock))throw Error('Invalid fixture admission envelope');
  const identities=new Set();
  // Validate ALL raw inputs before selection or projection, including excluded
  // rows and rows beyond the eventual 5001 sentinel. Order is SQL's own order;
  // do not re-sort identifiers with a different JavaScript collation.
  for(const row of bundle.rows){
    const id=JSON.stringify([row.source_id,row.fixture_id]);
    if(identities.has(id)||!nullableTextArray(row.fallback,6)||(row.context!==null&&(!object(row.context)||!Number.isInteger(row.context.shape_version)||!own(row.context,'base_window')||!own(row.context,'score_window')||!nullableTextArray(row.context.edges,4))))throw Error('Invalid fixture admission row');
    identities.add(id);
  }
  const admitted=[];
  for(const row of bundle.rows){
    let fields=row.fallback;
    const ctx=row.context;
    if(bundle.integrity_clear&&ctx?.shape_version===1&&validWindow(ctx.base_window)&&validWindow(ctx.score_window)){
      fields=calendarFields.slice(0,4).map((k,i)=>ctx.score_window[calendarFlags[i]]===true?ctx.score_window[k]:ctx.base_window[k]);
      // Nested JSONB ->> text conversion remains SQL-owned, including numbers,
      // arrays and objects; it must not be approximated by JSON.stringify.
      const offset=ctx.score_window.hasSchedulingWindow===true?2:0;
      fields.push(ctx.edges[offset],ctx.edges[offset+1]);
    }
    const [status,endDate,date,startDate,windowEnd,windowStart]=fields;
    const ends=endDate||date||startDate||windowEnd||'';
    const starts=date||startDate||windowStart||'';
    if(status==='live'||(!calendarDate(ends)||ends>=bundle.lower_date)&&(!calendarDate(starts)||starts<=bundle.upper_date)){
      admitted.push(row);
      if(admitted.length===5001)break;
    }
  }
  return reconstruct(admitted,clocks,admitted.length<=5000);
}

module.exports={SCHEMA,HEADERS,ADMISSION_SCHEMA,ADMISSION_HEADERS,decode};
