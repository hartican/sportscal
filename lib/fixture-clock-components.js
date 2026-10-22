'use strict';

// Service-to-service transport only. Never derive these headers from a browser.
const SCHEMA='fixture-clock-components.v1';
const HEADERS=Object.freeze({'x-ns-fixture-components':'clock-v1'});
const own=(value,key)=>Object.hasOwn(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const jsonValue=value=>value===null||typeof value==='object'||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value));
const timestamp=value=>typeof value==='string'&&(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)||value==='infinity'||value==='-infinity');
const textArray=value=>Array.isArray(value)&&value.every(item=>item===null||typeof item==='string'||textArray(item));

function concat(left,right){
  return object(left)&&object(right)?{...left,...right}:
    [...(Array.isArray(left)?left:[left]),...(Array.isArray(right)?right:[right])];
}

function validate(bundle){
  if(!object(bundle)||bundle.schemaVersion!==SCHEMA||typeof bundle.complete!=='boolean'||!Array.isArray(bundle.rows)||bundle.rows.length>5001||bundle.complete!==(bundle.rows.length<=5000)||!Array.isArray(bundle.parsed_clocks)||bundle.parsed_clocks.length>30006)throw Error('Invalid fixture component envelope');
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
  if(bundle?.schemaVersion!==SCHEMA)return bundle;
  const clocks=validate(bundle),rows=new Array(bundle.rows.length);
  for(let index=0;index<bundle.rows.length;index++){
    const row=bundle.rows[index],raw=row.raw;
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
  return {schemaVersion:'current-fixture-bundle.v1',complete:bundle.complete,rows};
}

module.exports={SCHEMA,HEADERS,decode};
