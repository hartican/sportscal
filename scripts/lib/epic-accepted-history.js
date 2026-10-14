'use strict';
// One-time canonical recovery uses accepted shared facts; it never writes sporting rows or original copy.
const db=require('../../lib/epic-classics'),identity=require('../../config/fixture-identity');
const named=fixture=>Boolean(String(fixture?.name||fixture?.displayTitleCompact||'').trim());
const receipt=fixture=>Math.max(0,...['statusCheckedAt','scoreCheckedAt','sourceCheckedAt','canonicalSourceCheckedAt'].map(key=>Date.parse(fixture?.[key]||'')).filter(Number.isFinite));
const scoreFacts=score=>Object.fromEntries(['scoreDisplay','score','homeScore','awayScore','outcomeText','matchStatusText','statusText','scoreCheckedAt','scoreFactObservedAt','innings','situation','result','winner','winnerParticipantId'].filter(key=>score?.[key]!==undefined).map(key=>[key,score[key]]));
function records(rows,{now=new Date()}={}){
 const groups=new Map();for(const row of rows){if(!row.event_id||!row.fixture_id||!named(row.fixture))continue;if(row.bound_event_id!==row.event_id)throw Error('Accepted history requires a registered source identity binding.');if(typeof row.source_id!=='string'||!row.source_id||row.score&&row.score_source_id!==row.source_id)throw Error('Accepted history requires an exact source/fixture score pair.');const group=groups.get(row.event_id)||[];group.push(row);groups.set(row.event_id,group);}
 return[...groups].map(([id,group])=>{
  const ordered=[...group].sort((a,b)=>receipt(a.fixture)-receipt(b.fixture)||Number(a.fixture_id===id)-Number(b.fixture_id===id)||a.source_id.localeCompare(b.source_id)||a.fixture_id.localeCompare(b.fixture_id));
  const updates=ordered.map(row=>({...scoreFacts(row.score),...row.fixture,id:row.fixture_id,canonicalEventId:id}));
  const event=identity.mergeOverlays([{id,canonicalEventId:id}],updates)[0];
  const scores=[...new Set(group.map(row=>row.published_ns_score??0))];if(scores.length!==1)throw Error('Accepted history requires one authoritative published NS score.');
  const record=db.recordFor(event,{nsScore:scores[0],now});if(record.eventId!==id)throw Error('Accepted history requires a registered canonical identity.');
  return{...record,aliases:[...new Set([...record.aliases,id,...group.map(row=>row.fixture_id)])],copies:[]};
 });
}
const inFilter=ids=>'in.('+ids.map(id=>'"'+String(id).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',')+')';
async function paged(request,table,parameters,key){
 const result=[];let cursor='';for(;;){const rows=await request(db.path(table,{...parameters,select:parameters.select,order:key+'.asc',limit:'500',...(cursor?{[key]:'gt.'+cursor}:{})}));if(!Array.isArray(rows)||rows.length>500)throw Error('Invalid accepted archive recovery page.');result.push(...rows);if(rows.length<500)return result;const next=rows.at(-1)?.[key];if(typeof next!=='string'||next<=cursor)throw Error('Accepted archive recovery cursor did not advance.');cursor=next;}
}
const pair=row=>JSON.stringify([row.source_id,row.fixture_id]);
const later=(row,last)=>row.source_id>last.source_id||row.source_id===last.source_id&&row.fixture_id>last.fixture_id;
const quoted=value=>'"'+String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
async function sourcePages(request,table,parameters){
 const result=[];let last=null;for(;;){const rows=await request(db.path(table,{...parameters,order:'source_id.asc,fixture_id.asc',limit:'100',...(last?{or:'(source_id.gt.'+quoted(last.source_id)+',and(source_id.eq.'+quoted(last.source_id)+',fixture_id.gt.'+quoted(last.fixture_id)+'))'}:{})}));
 if(!Array.isArray(rows)||rows.length>100)throw Error('Invalid accepted source recovery page.');
 for(const row of rows){if(typeof row.source_id!=='string'||!row.source_id||typeof row.fixture_id!=='string'||!row.fixture_id||last&&!later(row,last))throw Error('Accepted source recovery cursor did not advance.');result.push(row);last=row;}
 if(rows.length<100)return result;
 }
}
async function recover({request,jobs=[],now=new Date()}={}){
 const classics=(await paged(request,'classic_fixtures',{select:'event_id,fixture'},'event_id')).filter(row=>!named(row.fixture));
 if(!classics.length)return{records:[],unavailable:0};
 const mapping=new Map(classics.map(row=>[row.event_id,row.event_id]));
 for(let offset=0;offset<classics.length;offset+=50){const ids=classics.slice(offset,offset+50).map(row=>row.event_id);for(const alias of await paged(request,'classic_aliases',{select:'alias,event_id',event_id:inFilter(ids)},'alias'))mapping.set(alias.alias,alias.event_id);}
 const ids=[...mapping.keys()],fixtures=[];
 for(let offset=0;offset<ids.length;offset+=100){const batch=ids.slice(offset,offset+100),allowed=new Set(batch);const rows=await sourcePages(request,'fixture_current',{select:'source_id,fixture_id,fixture',fixture_id:inFilter(batch)});if(rows.some(row=>!allowed.has(row.fixture_id)))throw Error('Accepted fixture recovery escaped its scope.');fixtures.push(...rows.filter(row=>{const declared=row.fixture?.canonicalEventId||row.fixture?.eventId||row.fixture?.id||row.fixture_id;return named(row.fixture)&&(mapping.get(declared)||identity.canonicalFixtureId(declared))===mapping.get(row.fixture_id);}));}
 const scoreByPair=new Map(),sources=[...new Set(fixtures.map(row=>row.source_id))];
 for(const source_id of sources){const sourceIds=[...new Set(fixtures.filter(row=>row.source_id===source_id).map(row=>row.fixture_id))];for(let offset=0;offset<sourceIds.length;offset+=100){const batch=sourceIds.slice(offset,offset+100),allowed=new Set(batch);for(const row of await sourcePages(request,'live_scores',{select:'source_id,fixture_id,score',source_id:'eq.'+source_id,fixture_id:inFilter(batch)})){if(row.source_id!==source_id||!allowed.has(row.fixture_id))throw Error('Accepted score recovery escaped its source pair scope.');scoreByPair.set(pair(row),row.score);}}}
 const jobById=new Map(jobs.map(job=>[job.event_id,job]));
 const source=fixtures.map(row=>({event_id:mapping.get(row.fixture_id),bound_event_id:mapping.get(row.fixture_id),source_id:row.source_id,fixture_id:row.fixture_id,fixture:row.fixture,score_source_id:scoreByPair.has(pair(row))?row.source_id:null,score:scoreByPair.get(pair(row)),published_ns_score:jobById.get(mapping.get(row.fixture_id))?.published_ns_score??0}));
 const recovered=records(source,{now});return{records:recovered,unavailable:classics.length-recovered.length};
}
async function persist(records,request){let batch=[],bytes=0;for(const record of records){const size=Buffer.byteLength(JSON.stringify(record));if(batch.length&&(batch.length===100||bytes+size>500000)){await db.rpc('record_classic_fixtures',{records:batch},request);batch=[];bytes=0;}batch.push(record);bytes+=size;}if(batch.length)await db.rpc('record_classic_fixtures',{records:batch},request);}
module.exports={records,recover,persist};
