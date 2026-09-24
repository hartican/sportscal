'use strict';
const model=require('../config/match-centre');
const {supabaseServiceRequest}=require('./supabase-server');
const {overlaySnapshots}=require('./live-fixtures');
function createMatchCentreHandler({request=supabaseServiceRequest,published=()=>require('./calendar-catalogue').catalogue(),enabled=()=>process.env.MATCH_CENTRE_ENABLED==='true'}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  if(req.method&&req.method!=='GET')return res.status(405).json({error:'GET required'});
  if(!enabled())return res.status(200).json({enabled:false,fixtures:[]});
  const url=new URL(req.url,'https://nothingsport.local'),ids=[...new Set((url.searchParams.get('ids')||'').split(',').filter(Boolean))];
  if(!ids.length||ids.length>60||ids.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))return res.status(400).json({error:'Select between 1 and 60 fixtures'});
  const selected=new Set(ids),baseline=published().filter(e=>model.supported(e)&&[model.id(e),e.eventId,e.id,...(e.sourceEventIds||[])].some(id=>selected.has(id)));
  let rows=[],stale=false;
  try{if(baseline.length)rows=await request('/rest/v1/rpc/nothingsports_read_match_scores',{method:'POST',body:{p_fixture_ids:baseline.map(model.id)},timeoutMs:3000});}catch{stale=true;}
  const fixtures=overlaySnapshots(baseline,[{fixtures:(rows||[]).map(r=>r.fixture)}]).filter(e=>baseline.some(b=>model.id(b)===model.id(e)));
  return res.status(200).json({enabled:true,schemaVersion:'match-centre.v1',fixtures:fixtures.map(e=>model.compact(e,{checkedAt:rows.findLast(r=>model.id(r.fixture)===model.id(e))?.checked_at,stale,rubbers:url.searchParams.get('rubbers')==='1'}))});
 };
}
module.exports={createMatchCentreHandler};
