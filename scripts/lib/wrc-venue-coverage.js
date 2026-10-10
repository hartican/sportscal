'use strict';
const metadata=require('../../config/wrc-venues.json');
const {CALENDAR_URL}=require('./wrc-context');
const REVISION_URL='https://api.fia.com/news/fia-and-wrc-promoter-confirm-final-round-2026-fia-world-rally-championship';
const FUTURE_URL='https://acm.mc/en/epreuves/rallye-automobile-monte-carlo/event/itinerary/';
function verifiedWithdrawal(html){
 const text=String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 return /FIA and WRC Promoter confirm final round of the 2026/i.test(text)&&/Rally Saudi Arabia will not form part of the 2026 FIA World Rally Championship/i.test(text)&&/calendar will comprise 13 rounds/i.test(text);
}
function futureMonteCarlo(html,checkedAt){
 const text=String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 if(!/Rallye Automobile Monte-Carlo/.test(text)||!/21\s*[–-]\s*24 January 2027/.test(text)||!/Official start\s*-\s*Port Hercule, Monaco/i.test(text)||!/SS 18\s*-\s*La Boll[eè]ne-V[eé]subie\s*\/\s*Moulinet/i.test(text))throw Error('Monte-Carlo 2027 organiser itinerary changed or is incomplete; review required');
 return {id:'event:wrc:2027:monte-carlo',sportDomainId:'sport:motorsport',preferenceDomainId:'sport:wrc',competitionId:'competition:wrc-2027',displayName:'WRC Rallye Monte-Carlo',season:'2027',roundLabel:'2027 edition',date:'2027-01-21',endDate:'2027-01-24',dateOnly:true,timePrecision:'date-only',scheduleStatus:'date-only',status:'scheduled',countryCode:'MC',country:'Monaco',region:'Europe',venueName:'Monaco / French Alps',venueCountryCode:'MC',venueCaption:'Monaco start and finish • stages in France • 2027 edition',venueSourceUrl:FUTURE_URL,venueVerified:true,participantsConfirmed:false,participantIds:[],broadcasters:[],scheduleNote:'Organiser-published event window; stage timetable is indicative. Shakedown is 20 January in Gap and stays in Schedule information.',source:{provider:'Automobile Club de Monaco',sourceUrl:FUTURE_URL,checkedAt}};
}
function withVenue(event){
 const venue=metadata.events[event.id];
 return {...event,season:event.season||event.date.slice(0,4),venueCountryCode:event.venueCountryCode||event.countryCode,...(venue||{})};
}
function applyCoverage(context,{rounds,withdrawalVerified=false,future,checkedAt}){
 const current=context.events.filter(e=>e.date.startsWith('2026-'));
 const incoming=new Map(rounds.map(r=>[r.roundNumber,r]));
 const events=current.map(event=>{
  const round=incoming.get(event.roundNumber);
  if(!round){
   if(event.roundNumber!==14||!withdrawalVerified)throw Error('An omitted WRC round needs explicit official withdrawal evidence');
   const result={...event,status:'cancelled',statusSourceUrl:REVISION_URL,statusCheckedAt:checkedAt,scheduleNote:'The 2026 WRC element was withdrawn. The separate regional MERC rally is outside this competition.'};delete result.result;return withVenue(result);
  }
  // Calendar corrections retain identity, results and their original verification times.
  return withVenue({...event,displayName:round.name,date:round.startDate,endDate:round.endDate,source:{provider:'WRC',sourceUrl:CALENDAR_URL,checkedAt}});
 });
 const futureEvents=future?[withVenue(future)]:context.events.filter(e=>!e.date.startsWith('2026-')).map(withVenue);
 const competitions=context.competitions.filter(c=>c.id!=='competition:wrc-2027');
 if(futureEvents.length)competitions.push({...context.competitions.find(c=>c.id==='competition:wrc-2026'),id:'competition:wrc-2027',slug:'wrc-2027',name:'2027 FIA World Rally Championship',seasonLabel:'2027',supportsLadder:false});
 const source={provider:'FIA',sourceUrl:REVISION_URL,sourceType:'official',checkedAt};
 return {...context,generatedAt:checkedAt,calendarCoverage:{season:2026,publishedRounds:rounds.length,retainedWithdrawals:events.filter(e=>e.status==='cancelled').map(e=>e.id),complete:true,checkedAt,...(withdrawalVerified?{revisionSourceUrl:REVISION_URL}:{}),futureCalendarComplete:false,futureNote:'Future coverage includes only the individually listed rallies.'},competitions,events:[...events,...futureEvents],eventParticipantScopes:context.eventParticipantScopes.map(scope=>({...scope,season:'2026'})),sources:[...context.sources.filter(s=>s.sourceUrl!==REVISION_URL&&s.sourceUrl!==FUTURE_URL).map(s=>['https://www.wrc.com/en/calendar',CALENDAR_URL].includes(s.sourceUrl)?{...s,sourceUrl:CALENDAR_URL,checkedAt}:s),...(withdrawalVerified?[source]:[]),...(futureEvents.length?[futureEvents[0].source]:[])]};
}
module.exports={REVISION_URL,FUTURE_URL,verifiedWithdrawal,futureMonteCarlo,withVenue,applyCoverage};
