'use strict';
const model=require('../config/match-centre');
const {supabaseServiceRequest}=require('./supabase-server');
const {overlaySnapshots}=require('./live-fixtures');
const contestKey=e=>{const sides=[e.homeParticipantId,e.awayParticipantId].filter(Boolean).sort(),start=Date.parse(e.startTimeUtc||'');return sides.length===2&&Number.isFinite(start)?`${model.sport(e)}|${start}|${sides.join('|')}`:null;};
function createMatchCentreHandler({request=supabaseServiceRequest,published=()=>require('./calendar-catalogue').catalogue(),enabled=()=>process.env.MATCH_CENTRE_ENABLED==='true'}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  if(req.method&&req.method!=='GET')return res.status(405).json({error:'GET required'});
  if(!enabled())return res.status(200).json({enabled:false,fixtures:[]});
  const url=new URL(req.url,'https://nothingsport.local'),ids=[...new Set((url.searchParams.get('ids')||'').split(',').filter(Boolean))];
  if(!ids.length||ids.length>60||ids.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))return res.status(400).json({error:'Select between 1 and 60 fixtures'});
  const catalogue=published().filter(model.supported),selected=new Set(ids),baseline=catalogue.filter(e=>[model.id(e),e.eventId,e.id,...(e.sourceEventIds||[])].some(id=>selected.has(id)));
  // The Feed can own an ESPN ID while live innings arrive under the CA ID.
  // Expand only published aliases with the same sport, exact start and sides.
  const keys=new Set(baseline.map(contestKey).filter(Boolean));
  const readIds=[...new Set(catalogue.filter(e=>baseline.includes(e)||(contestKey(e)&&keys.has(contestKey(e)))).flatMap(e=>[model.id(e),...(e.sourceEventIds||[])]))];
  let rows=[],stale=false;
  try{const batches=[];for(let i=0;i<readIds.length;i+=60)batches.push(request('/rest/v1/rpc/nothingsports_read_match_scores',{method:'POST',body:{p_fixture_ids:readIds.slice(i,i+60)},timeoutMs:3000}));rows=(await Promise.all(batches)).flat();}catch{stale=true;}
  const fixtures=baseline.map(base=>{const matching=rows.filter(r=>[model.id(r.fixture),...(r.fixture.sourceEventIds||[])].includes(model.id(base))||(contestKey(base)&&contestKey(base)===contestKey(r.fixture))).sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||'')));
   const event=overlaySnapshots([base],matching.map(r=>({checked_at:r.checked_at,fixtures:[r.fixture]})))[0];
   const checkedAt=matching.at(-1)?.checked_at||event.sourceCheckedAt||event.canonicalSourceCheckedAt;
   return model.compact(event,{checkedAt,stale:stale||!checkedAt||Date.now()-Date.parse(checkedAt)>model.interval(event)*2,rubbers:url.searchParams.get('rubbers')==='1'});
  });
  return res.status(200).json({enabled:true,schemaVersion:'match-centre.v1',fixtures});
 };
}
module.exports={createMatchCentreHandler};
