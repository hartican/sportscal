'use strict';
// Reviewed evidence for generated/API presentation only. No provider calls,
// browser credentials or clock-based sporting updates. Apply after reconciliation,
// so viewing richness cannot select a different result or identity.
const audit=require('../data/coverage/australian-viewing-rights.v1.json');
const follow=require('../config/follow-first');
const key=value=>String(value||'').replace(/:/g,'-');
const reviewedIds=new Set((audit.reviewedWindows||[]).flatMap(rule=>rule.fixtureIds||[]).map(key));
const reviewedCompetitions=new Set((audit.reviewedWindows||[]).flatMap(rule=>rule.competitionIds||[]));
const reviewedTournaments=new Set((audit.reviewedWindows||[]).flatMap(rule=>rule.tournamentIds||[]));
const australianDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
function tournamentIdentity(event){
 if(event.tournamentIds!=null&&!Array.isArray(event.tournamentIds))return null;
 const values=[event.tournamentId,event.tennisTournamentId,...(event.tournamentIds||[])].filter(value=>value!=null);
 return values.every(value=>typeof value==='string'&&value.length>0)?[...new Set(values)]:null;
}
function targets(rule,event,ids,tournaments){
 const fixture=rule.fixtureIds?.some(id=>ids.includes(key(id))),competition=rule.competitionIds?.includes(event.competitionId);
 const prior=(fixture||competition)&&(!rule.fixtureIds||!rule.competitionIds||fixture&&competition);
 if(!rule.tournamentIds)return prior;
 if(!tournaments?.length||!tournaments.every(id=>rule.tournamentIds.includes(id)))return false;
 const sports=[event.key,event.sportId,event.sportDomainId,event.taxonomySportId].filter(value=>value!=null);
 if(!sports.length||sports.some(value=>String(value).replace(/^sport:/,'')!==rule.sportKey))return false;
 const tours=[event.tour,event.tennisTour,...(Array.isArray(event.representedTours)?event.representedTours:[])].filter(value=>value!=null);
 if(event.representedTours!=null&&!Array.isArray(event.representedTours)||tours.some(value=>String(value).toUpperCase()!==rule.tour))return false;
 if(event.season!=null&&String(event.season)!==String(rule.season))return false;
 return !rule.fixtureIds&&!rule.competitionIds||prior;
}
function datedFixtureEvidence(option){
 try{
  const url=new URL(option.sourceUrl),at=Date.parse(option.verifiedAt);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&Number.isFinite(at)&&at<=Date.now()
   && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(option.verifiedAt)
   &&new Date(at).toISOString().slice(0,19)===option.verifiedAt.slice(0,19);
 }catch{return false;}
}
function reviewedAuViewing(event){
 const rugby=event.sportDomainId==='sport:rugby-union'||['rugby','rugby-union'].includes(event.key);
 const ids=[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].map(key);
 const tournaments=tournamentIdentity(event);
 if(!rugby&&!ids.some(id=>reviewedIds.has(id))&&!reviewedCompetitions.has(event.competitionId)&&!tournaments?.some(id=>reviewedTournaments.has(id))&&!(event.viewingOptions||[]).some(option=>option.reviewId==='au-viewing-20261002'))return event;
 const at=Date.parse(event.startTimeUtc||event.startsAt||event.date||'');
 const date=Number.isFinite(at)?(event.startTimeUtc||event.startsAt?australianDate.format(new Date(at)):event.date):null;
 const validDate=date && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
 const rule=(audit.reviewedWindows||[]).find(rule=>validDate&&date>=rule.notBefore&&date<rule.notAfter
   && targets(rule,event,ids,tournaments)
   && (!rule.fixtureIdPattern||new RegExp(rule.fixtureIdPattern).test(key(event.canonicalEventId||event.id||event.eventId)))
   && (!rule.roundLabel||rule.roundLabel===event.roundLabel)
   && (!rule.participantIds||JSON.stringify([...(event.participantIds||[])].sort())===JSON.stringify([...rule.participantIds].sort()))
   && (!rule.format||String(event.format||event.matchFormat||'').toLowerCase()===rule.format));
 if(!rule&&!rugby&&!(event.viewingOptions||[]).some(option=>option.reviewId==='au-viewing-20261002'))return event;
 // Older generated options from our review must expire with the evidence window.
 // Preserve independently sourced fixture options; unstructured provider guesses
 // cannot restore the retired blanket Rugby rule.
 const retained=(event.viewingOptions||[]).filter(option=>option&&typeof option==='object'&&option.reviewId!=='au-viewing-20261002'
   && option.rightsScope==='fixture'&&option.sourceUrl&&Number.isFinite(Date.parse(option.verifiedAt)));
 // Competition carriage cannot displace independently sourced fixture access.
 const tournamentOverrides=rule?.tournamentIds&&rule.rightsScope==='competition'?retained.filter(datedFixtureEvidence):[];
 const fixtureOverrides=tournamentOverrides.length>0;
 const viewingOptions=rule&&!fixtureOverrides?rule.providers.map(provider=>({providerId:provider.id,rightsScope:provider.rightsScope||rule.rightsScope||'fixture',linkScope:provider.linkScope||'event',
   webUrl:provider.url,sourceUrl:provider.sourceUrl||rule.sourceUrl,verifiedAt:provider.verifiedAt||rule.verifiedAt,territory:'AU',liveOrReplay:provider.liveOrReplay||'live',...(provider.channelBrand?{channelBrand:provider.channelBrand}:{}),reviewId:'au-viewing-20261002'})):fixtureOverrides?tournamentOverrides:retained;
 return {...event,viewingOptions,broadcaster:viewingOptions.length?viewingOptions.map(option=>follow.VIEWING_PROVIDERS[option.providerId]?.label).filter(Boolean).join(' / '):'Australian viewing unconfirmed',
   broadcastOptions:[],broadcasterIds:[]};
}
module.exports={reviewedAuViewing};
