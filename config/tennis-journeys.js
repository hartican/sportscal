(function(root,factory){const api=factory();root.NOTHINGSPORTS_TENNIS_JOURNEYS=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(globalThis,function(){
 'use strict';
 function through(day){
  const [year,month,date]=day.split('-').map(Number),last=new Date(Date.UTC(year+1,month,0)).getUTCDate();
  return new Date(Date.UTC(year+1,month-1,Math.min(date,last))).toISOString().slice(0,10);
 }
 function editions(document,day,preferences=null,collections={}){
  const until=through(day),follow=globalThis.NOTHINGSPORTS_FOLLOW_FIRST||(typeof require==='function'?require('./follow-first'):null),feed=globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null);
  return document.editions.flatMap(edition=>{
   const windows=edition.tourWindows.filter(w=>feed.activeEligible({key:'tennis',tournamentLevel:w.level||edition.category})&&w.endDate>=day&&w.startDate<=until);
   const undated=!edition.tourWindows.length&&feed.activeEligible({key:'tennis',tournamentLevel:edition.category})&&edition.season>=Number(day.slice(0,4))&&edition.season<=Number(until.slice(0,4));
   if(!windows.length&&!undated)return [];
   const allowed=windows.filter(w=>!preferences||!feed.explicitlyExcluded({id:edition.id,key:'tennis',cardKind:'event',eventFamilyId:edition.eventFamilyId,tournamentId:w.tournamentId,competitionId:w.tournamentId},preferences));
   if(preferences&&feed.explicitlyExcluded({id:edition.id,key:'tennis',cardKind:'event',eventFamilyId:edition.eventFamilyId},preferences)||windows.length&&!allowed.length)return [];
   const participation=edition.participation.filter(p=>(!preferences||follow.effectiveParticipantFollow(p.playerId,preferences,collections).followed)&&(!windows.length||allowed.some(w=>w.tour===document.players.find(player=>player.id===p.playerId)?.tour)));
   if(!participation.length)return [];
   return [{...edition,tourWindows:allowed,participation,contextOnly:true,undated}];
  }).sort((a,b)=>(a.tourWindows[0]?.startDate||'9999').localeCompare(b.tourWindows[0]?.startDate||'9999')||a.id.localeCompare(b.id));
 }
 function forParticipant(document,record,day,preferences=null){
  const identity=globalThis.NOTHINGSPORTS_FOLLOW_FIRST||(typeof require==='function'?require('./follow-first'):null);
  const feed=globalThis.NOTHINGSPORTS_FOLLOW_FEED_POLICY||(typeof require==='function'?require('./follow-feed-policy'):null);
  const key=identity.participantFollowIdentityKey,known=(document.players||[]).find(p=>key(p.id)===key(record.id));
  const tour=record.tour||known?.tour||(/:wta:/.test(record.id)||record.genderCategory==='female'||record.sportKey==='tennis-women'?'WTA':record.genderCategory==='male'||/:atp:/.test(record.id)?'ATP':null);
  if(!tour)return [];
  const until=through(day);
  return (document.editions||[]).flatMap(edition=>{
   if(preferences&&feed.explicitlyExcluded({id:edition.id,key:'tennis',cardKind:'event',eventFamilyId:edition.eventFamilyId},preferences))return [];
   const participation=(edition.participation||[]).find(p=>key(p.playerId)===key(record.id));
   const intent=participation&&participation.evidenceKind!=='product_projection';
   const windows=(edition.tourWindows||[]).filter(w=>feed.activeEligible({key:'tennis',tournamentLevel:w.level||edition.category})&&w.tour===tour&&w.endDate>=day&&w.startDate<=until&&(!preferences||!feed.explicitlyExcluded({key:'tennis',cardKind:'event',tournamentId:w.tournamentId,competitionId:w.tournamentId,eventFamilyId:edition.eventFamilyId},preferences))&&(intent||/major|grand.slam|1000/i.test(String(w.level||edition.category))));
   const undated=!edition.tourWindows?.length&&feed.activeEligible({key:'tennis',tournamentLevel:edition.category})&&edition.season>=Number(day.slice(0,4))&&edition.season<=Number(until.slice(0,4))&&(intent||/major|grand.slam|1000/i.test(String(edition.category)));
   if(!windows.length&&!undated)return [];
   const confirmed=participation?.status==='confirmed'&&/^official_(entry|participation|qualification)$/.test(participation.evidenceKind);
   return [{...edition,tourWindows:windows,participation:participation?[participation]:[],contextOnly:true,undated,confirmed,withdrawn:participation?.status==='withdrawn',label:participation?.status==='withdrawn'?'Withdrawn':confirmed?'Confirmed entry': 'Possible tournament',reason:participation?.reason&&intent?participation.reason:'Entry not confirmed. Ranking, qualification and player schedule apply.',sourceIds:[...new Set([...windows.flatMap(w=>w.sourceIds||[]),...(participation?.sourceIds||[])])]}];
  }).sort((a,b)=>(a.tourWindows[0]?.startDate||'9999').localeCompare(b.tourWindows[0]?.startDate||'9999')||a.id.localeCompare(b.id));
 }
 return Object.freeze({through,editions,forParticipant});
});
