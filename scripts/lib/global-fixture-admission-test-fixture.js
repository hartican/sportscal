'use strict';
// Constructed test data only; exercises the current canonical write triggers.
const assert=require('node:assert/strict');
const {sampleRows}=require('./grouped-fixture-test-wire');
async function loadLarge(db){
  await db.exec('begin;delete from public.nothingsports_live_scores;delete from public.nothingsports_fixture_current;delete from public.nothingsports_fixture_snapshots;delete from public.nothingsports_fixture_sources;commit');
  const today=(await db.query("select(statement_timestamp()at time zone'Australia/Sydney')::date::text d")).rows[0].d;
  const innings=Array.from({length:2},(_,inning)=>({inning:inning+1,score:{runs:0,wickets:0,overs:'0.0'},batting:Array.from({length:3},(_,i)=>({position:i+1,playerId:'qa-batter:'+i,name:'Constructed player '+i,runs:0,balls:0,fours:0,sixes:0,strikeRate:0,dismissal:null,sourceNotes:['constructed statistic','original receipt retained']})),bowling:Array.from({length:1},(_,i)=>({position:i+1,playerId:'qa-bowler:'+i,name:'Constructed bowler '+i,overs:'0.0',maidens:0,runs:0,wickets:0,economy:0,detail:null}))}));
  const rows=sampleRows();
  for(let i=0;i<rows.length;i++){
   const base=i%2586,copy=Math.floor(i/2586),duplicate=copy===1&&base>=1&&base<=6;
   const key='qa:'+String(duplicate?0:base).padStart(5,'0'),source='qa-source:'+String(duplicate?base+1:(base+copy)%30).padStart(2,'0');
   rows[i]={source_id:source,fixture_id:key,identity_keys:[key,'alias:'+key,null],fixture:{...rows[i].fixture,id:key,eventId:key,sourceEventIds:['alias:'+key],sourceName:source,key:'cricket',date:today,scorecard:{schemaVersion:'constructed-detail.v1',innings}}};
  }
  assert.equal(new Set(rows.map(r=>r.source_id+'\0'+r.fixture_id)).size,5145);
  for(let i=0;i<3367;i++){
   const key='qa-expired:'+String(i).padStart(5,'0'),source='qa-source:'+String(30+i%15).padStart(2,'0');
   rows.push({source_id:source,fixture_id:key,identity_keys:[key],fixture:{id:key,eventId:key,key:'cricket',date:'2020-01-01',endDate:'2020-01-01',status:'completed',homeScore:0,awayScore:1,statusCheckedAt:'2020-01-01T00:00:00Z'}});
  }
  const sources=[...new Set(rows.map(r=>r.source_id))].map(source_id=>({source_id,report:{_fixtureObservations:Object.fromEntries(rows.filter(r=>r.source_id===source_id).map((r,i)=>[r.fixture_id,{s:i%2?'2026-10-26T00:00:02.123456Z':null,t:'2026-10-26T00:00:03.654321Z'}]))}}));
  assert.equal(sources.length,45);
  await db.exec('begin');
  await db.query("insert into public.nothingsports_fixture_sources(source_id,discovery_report)select r->>'source_id',r->'report'from jsonb_array_elements($1::jsonb)r",[JSON.stringify(sources)]);
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,identity_keys,fixture,content_hash)select r->>'source_id',r->>'fixture_id',array(select jsonb_array_elements_text(r->'identity_keys')),r->'fixture',md5(r::text)from jsonb_array_elements($1::jsonb)r",[JSON.stringify(rows)]);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash)select r->>'source_id',r->>'fixture_id',jsonb_build_object('status',r->'fixture'->'status','homeScore',r->'fixture'->'homeScore','awayScore',r->'fixture'->'awayScore','scoreCheckedAt',r->'fixture'->'scoreCheckedAt','statusCheckedAt',r->'fixture'->'statusCheckedAt'),md5(r::text)from jsonb_array_elements($1::jsonb)r",[JSON.stringify(rows)]);
  await db.exec('commit;analyze public.nothingsports_fixture_current;analyze public.nothingsports_fixture_sources;analyze public.nothingsports_live_scores;analyze nothingsports_fixture_read_private.fixture_context');
  assert.equal((await db.query('select count(*)::int n from nothingsports_fixture_read_private.integrity_pending')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from nothingsports_fixture_read_private.fixture_context')).rows[0].n,8512);
  assert.equal((await db.query('select count(*)::int n from nothingsports_fixture_read_private.near_selection')).rows[0].n,8512);
  return{rows:8512,sources:45,edges:5145,keys:2586};
}
module.exports={loadLarge};
