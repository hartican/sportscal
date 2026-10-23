'use strict';
const crypto=require('node:crypto');
const sports=require('../config/all-sports-view');
const match=require('../config/match-centre');
function createAllSportsHandler({published,snapshotRead,clock,overlay}){
 return async(req,res)=>{
  const url=new URL(req.url,'https://nothingsport.local');
  const range=url.searchParams.get('range')||'today',cursor=Number(url.searchParams.get('cursor')||0),limit=Number(url.searchParams.get('limit')||50);
  const asOf=url.searchParams.has('asOf')?Number(url.searchParams.get('asOf')):clock();
  let window;
  try{window=sports.windowFor(range,asOf);}catch{return res.status(400).json({error:'Invalid sports range'});}
  if(url.searchParams.get('membership')!=='everything'||url.searchParams.has('ids')||url.searchParams.has('details')||url.searchParams.has('context')||!Number.isSafeInteger(cursor)||cursor<0||!Number.isSafeInteger(limit)||limit<1||limit>60)return res.status(400).json({error:'Invalid sports membership page'});
  // This is the existing GLOBAL reader, not the near-live SQL projection.
  // Its normal policy/cache/deadline remain unchanged. A failed read keeps the
  // complete published schedule usable and explicitly marks current membership.
  let events=published().filter(sports.supported),membershipStale=false;
  try{const snapshot=await snapshotRead({now:clock(),scope:'global'});events=overlay(events,snapshot.sources).filter(sports.supported);membershipStale=Boolean(snapshot.stale);}
  catch{membershipStale=true;}
  const members=sports.select(events,window);
  const revision=crypto.createHash('sha256').update(JSON.stringify(members.map(({event:e,day,start,tbc})=>[match.id(e),day,start,tbc,e.status,e.endTimeUtc,e.actualEndTimeUtc]))).digest('hex');
  if(url.searchParams.has('revision')&&url.searchParams.get('revision')!==revision)return res.status(409).json({code:'range_changed',error:'The schedule changed. Refresh this range.'});
  const page=members.slice(cursor,cursor+limit);
  if(membershipStale)res.setHeader('Cache-Control','no-store');
  return res.status(200).json({enabled:true,schemaVersion:'all-sports.v1',window,revision,membershipStale,
   events:page.map(({event:e})=>{const event=match.racingDetail(e)?{...e,acceptanceReview:undefined,fixtureResults:undefined,score:match.compact(e).score}:e;return membershipStale?{...event,stale:true}:event;}),
   pagination:{cursor,limit,total:members.length,nextCursor:cursor+limit<members.length?cursor+limit:null}});
 };
}
module.exports={createAllSportsHandler};
