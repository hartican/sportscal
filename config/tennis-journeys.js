(function(root,factory){const api=factory();root.NOTHINGSPORTS_TENNIS_JOURNEYS=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(globalThis,function(){
 'use strict';
 function through(day){
  const [year,month,date]=day.split('-').map(Number),last=new Date(Date.UTC(year+1,month,0)).getUTCDate();
  return new Date(Date.UTC(year+1,month-1,Math.min(date,last))).toISOString().slice(0,10);
 }
 function editions(document,day,preferences=null,collections={}){
  const until=through(day),follow=globalThis.NOTHINGSPORTS_FOLLOW_FIRST||(typeof require==='function'?require('./follow-first'):null),feed=globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null);
  return document.editions.flatMap(edition=>{
   const windows=edition.tourWindows.filter(w=>w.endDate>=day&&w.startDate<=until);
   const undated=!edition.tourWindows.length&&edition.season>=Number(day.slice(0,4))&&edition.season<=Number(until.slice(0,4));
   if(!windows.length&&!undated)return [];
   const allowed=windows.filter(w=>!preferences||!feed.explicitlyExcluded({id:edition.id,key:'tennis',eventFamilyId:edition.eventFamilyId,tournamentId:w.tournamentId,competitionId:w.tournamentId},preferences));
   if(preferences&&feed.explicitlyExcluded({id:edition.id,key:'tennis',eventFamilyId:edition.eventFamilyId},preferences)||windows.length&&!allowed.length)return [];
   const participation=edition.participation.filter(p=>(!preferences||follow.effectiveParticipantFollow(p.playerId,preferences,collections).followed)&&(!windows.length||allowed.some(w=>w.tour===document.players.find(player=>player.id===p.playerId)?.tour)));
   if(!participation.length)return [];
   return [{...edition,tourWindows:allowed,participation,contextOnly:true,undated}];
  }).sort((a,b)=>(a.tourWindows[0]?.startDate||'9999').localeCompare(b.tourWindows[0]?.startDate||'9999')||a.id.localeCompare(b.id));
 }
 return Object.freeze({through,editions});
});
