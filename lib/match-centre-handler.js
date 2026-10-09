'use strict';
const model=require('../config/match-centre');
const {supabaseServiceRequest}=require('./supabase-server');
const {overlaySnapshots,readLiveSnapshots}=require('./live-fixtures');
const matchesIds=(e,selected)=>[model.id(e),e.eventId,e.id,...(e.sourceEventIds||[])].some(id=>selected.has(id));
const contestKey=e=>{const sides=[e.homeParticipantId,e.awayParticipantId].filter(Boolean).sort(),start=Date.parse(e.startTimeUtc||'');return sides.length===2&&Number.isFinite(start)?`${model.sport(e)}|${start}|${sides.join('|')}`:null;};
const freshObservation=(e,now)=>{
 const scoreAt=Date.parse(model.compact(e).checkedAt||''),statusAt=Date.parse(e.statusCheckedAt||''),budget=model.interval(e,now)*2;
 return e.fixtureObservationSchema==='fixture-observations.v1'&&[statusAt,scoreAt].every(at=>Number.isFinite(at)&&at<=now&&now-at<=budget);
};
function createMatchCentreHandler({request=supabaseServiceRequest,published=()=>require('./calendar-catalogue').catalogue(),enabled=()=>process.env.MATCH_CENTRE_ENABLED==='true',clock=()=>Date.now(),snapshotRead=options=>readLiveSnapshots(options)}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  if(req.method&&req.method!=='GET')return res.status(405).json({error:'GET required'});
  if(!enabled())return res.status(200).json({enabled:false,fixtures:[]});
  const url=new URL(req.url,'https://nothingsport.local'),ids=[...new Set((url.searchParams.get('ids')||'').split(',').filter(Boolean))];
  const listing=url.searchParams.get('membership')==='everything',cursor=Number(url.searchParams.get('cursor')||0),limit=Number(url.searchParams.get('limit')||50);
  if(listing&&(!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>60))return res.status(400).json({error:'Invalid membership page'});
  if(!listing&&(!ids.length||ids.length>60||ids.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id))))return res.status(400).json({error:'Select between 1 and 60 fixtures'});
  // Start the existing remote read while the local fallback is assembled.
  let snapshotTask=null;
  if(listing)try{snapshotTask=Promise.resolve(snapshotRead({now:clock()})).catch(()=>null);}catch{snapshotTask=Promise.resolve(null);}
  let catalogue=published().filter(model.supported),membershipStale=false,snapshot=null;const selected=new Set(ids);
  if(listing)try{
   snapshot=await snapshotTask;
   if(!snapshot)throw Error('Membership unavailable');
   catalogue=overlaySnapshots(catalogue,snapshot.sources).filter(model.supported);
   membershipStale=Boolean(snapshot.stale);
  }catch{membershipStale=true;}
  // A live source may announce a match before the daily published checkpoint.
  // Reconcile membership first, then page. The global projection already
  // includes independent score/status observations; reuse only fresh ones.
  const members=listing?model.select(catalogue,clock()):null;
  let baseline=listing?members.slice(cursor,cursor+limit):catalogue.filter(e=>matchesIds(e,selected));
  const events=[];
  const snapshotAge=clock()-snapshot?.readAt;
  const reusable=listing&&!membershipStale&&Number.isFinite(snapshotAge)&&snapshotAge>=0&&snapshotAge<=30000;
  const coveredIds=new Set(),coveredContests=new Set();
  if(reusable)for(const source of snapshot.sources||[])for(const event of source.fixtures||[]){
   if(!freshObservation(event,clock()))continue;
   for(const id of [model.id(event),event.id,event.eventId,...(event.sourceEventIds||[])])if(id)coveredIds.add(id);
   const key=contestKey(event);if(key)coveredContests.add(key);
  }
  const needsRead=listing?baseline.filter(e=>!freshObservation(e,clock())||!matchesIds(e,coveredIds)&&!(contestKey(e)&&coveredContests.has(contestKey(e)))):baseline;
  // The Feed can own an ESPN ID while live innings arrive under the CA ID.
  // Expand only published aliases with the same sport, exact start and sides.
  const keys=new Set(needsRead.map(contestKey).filter(Boolean));
  const readIds=[...new Set([...(listing?[]:ids),...catalogue.filter(e=>needsRead.includes(e)||(contestKey(e)&&keys.has(contestKey(e)))).flatMap(e=>[model.id(e),...(e.sourceEventIds||[])])])];
  let rows=[],stale=membershipStale;
  try{const batches=[];for(let i=0;i<readIds.length;i+=60)batches.push(request('/rest/v1/rpc/nothingsports_read_match_scores',{method:'POST',body:{p_fixture_ids:readIds.slice(i,i+60)},timeoutMs:3000}));rows=(await Promise.all(batches)).flat();}catch{stale=true;}
  // A current match may arrive between daily catalogue checkpoints. The same
  // bounded read used for its scores also supplies that source-owned fixture.
  // Keep unknown, unsupported and unrequested records outside the response.
  if(!listing){
   const allowed=new Set(readIds);rows=rows.filter(r=>r.fixture&&matchesIds(r.fixture,allowed));
   baseline=overlaySnapshots(baseline,rows.map(r=>({checked_at:r.checked_at,fixtures:[r.fixture]}))).filter(model.supported).filter(e=>matchesIds(e,selected));
  }
  const fixtures=baseline.map(base=>{const matching=rows.filter(r=>[model.id(r.fixture),...(r.fixture.sourceEventIds||[])].includes(model.id(base))||(contestKey(base)&&contestKey(base)===contestKey(r.fixture))).sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||'')));
   const event=overlaySnapshots([base],matching.map(r=>({checked_at:r.checked_at,fixtures:[r.fixture]})))[0];
   const checkedAt=event.scoreCheckedAt||event.statusCheckedAt||(event.fixtureObservationSchema?null:event.sourceCheckedAt||event.canonicalSourceCheckedAt);
   events.push(event);return model.compact(event,{checkedAt,stale:stale||!checkedAt||clock()-Date.parse(checkedAt)>model.interval(event,clock())*2,rubbers:url.searchParams.get('rubbers')==='1'});
  });
  if(listing){const included=new Set(model.select(events,clock()).map(model.id));return res.status(200).json({enabled:true,schemaVersion:'match-centre.v1',membershipStale,membershipConflicts:model.conflicts(catalogue,clock()).length,events:events.filter(e=>included.has(model.id(e))),fixtures:fixtures.filter(e=>included.has(e.id)),pagination:{cursor,limit,nextCursor:cursor+limit<members.length?cursor+limit:null}});}
  return res.status(200).json({enabled:true,schemaVersion:'match-centre.v1',fixtures});
 };
}
module.exports={createMatchCentreHandler};
