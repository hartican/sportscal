(function(root,factory){const api=factory();root.NOTHINGSPORTS_PROMOTED_REPLAY=api;if(typeof module!=='undefined')module.exports=api;})(typeof globalThis!=='undefined'?globalThis:window,function(){
  'use strict';
  const MONZA_ID='evt_27';
  function recommendation(event,snapshot={},phase){
    const completed=phase==='impact'||['completed','past','finished','final'].includes(String(event?.status).toLowerCase());
    if(!completed)return null;
    const editorial=event?.id===MONZA_ID && event?.date==='2026-09-06' || Number(event?.editorialReplayRecommendation?.rating)===5;
    const published=Number(snapshot?.aggregates?.impact?.score ?? event?.nothingscore?.impact?.score ?? event?.publishedImpactScore)===5;
    const personal=Number(snapshot?.currentUser?.submissions?.impact?.rating ?? (snapshot.phase==='impact'?snapshot.currentUser?.contribution?.rating:null))===5;
    return editorial||published||personal?{label:'Promoted replay',rating:5,editorial,published,personal}:null;
  }
  return Object.freeze({recommendation});
});
