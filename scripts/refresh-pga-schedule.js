#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const OUTPUT=path.resolve(__dirname,'../data/canonical/pga-tour-schedule.json');
function dateRange(display,year){
 const match=String(display).match(/^([A-Za-z]+)\s+(\d+)\s*-\s*(?:([A-Za-z]+)\s+)?(\d+)$/);
 if(!match)throw new Error(`Unrecognised PGA schedule dates: ${display}`);
 const day=(month,d)=>{const date=new Date(`${month} ${d}, ${year} 12:00:00 GMT`);if(!Number.isFinite(+date))throw new Error('Invalid PGA date');return date.toISOString().slice(0,10);};
 return {startDate:day(match[1],match[2]),endDate:day(match[3]||match[1],match[4])};
}
function parse(html,year,{requireFull=true}={}){
 const encoded=html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!encoded)throw new Error('PGA schedule payload missing');
 const data=JSON.parse(encoded).props?.pageProps?.dehydratedState?.queries?.find(q=>q.queryKey?.[0]==='schedule')?.state?.data;
 if(data?.season && String(data.season)!==String(year)){const error=new Error(`PGA season ${year} is not published`);error.code='PGA_SEASON_UNPUBLISHED';throw error;}
 if(!data||data.tourCode!=='R')throw new Error('PGA season/tour mismatch');
 const tournaments=data.tournaments.filter(t=>t.display==='SHOW').map(t=>{
  const completed=t.status==='COMPLETED';
  return {id:t.tournamentId,name:t.name,season:year,...dateRange(t.displayDate,year),status:completed?'completed':t.status==='IN_PROGRESS'?'live':t.status==='CANCELED'?'cancelled':'upcoming',venue:t.courseData?.name||null,city:t.courseData?.city||null,countryCode:t.courseData?.countryCode||null,
   major:['014','033','026','100'].some(code=>t.tournamentId===`R${year}${code}`),
   winners:completed?(t.champions||[]).map(p=>({id:p.playerId,name:p.displayName})):[],sourceUrl:`https://www.pgatour.com/schedule/${year}`};
 });
 if(!tournaments.length||(requireFull&&(tournaments.length<35||tournaments.filter(t=>t.major).length!==4))||new Set(tournaments.map(t=>t.id)).size!==tournaments.length)throw new Error(`Incomplete ${year} PGA schedule`);
 return tournaments;
}
async function refresh({years=[new Date().getUTCFullYear(),new Date().getUTCFullYear()+1],fetchImpl=fetch}={}){
 const previous=fs.existsSync(OUTPUT)?JSON.parse(fs.readFileSync(OUTPUT)):null;const seasons=[];
 for(const year of years){
  const response=await fetchImpl(`https://www.pgatour.com/schedule/${year}`,{signal:AbortSignal.timeout(30000)});
  const future=year>years[0];
  if(future&&response.status===404){console.log(`PGA TOUR ${year} is not published yet.`);continue;}
  if(!response.ok)throw new Error(`PGA schedule ${year}: HTTP ${response.status}`);
  try{seasons.push(...parse(await response.text(),year,{requireFull:!future}));}catch(error){if(future&&error.code==='PGA_SEASON_UNPUBLISHED'){console.log(error.message);continue;}throw error;}
 }
 const document={schemaVersion:'pga-tour-schedule.v1',sourceName:'PGA TOUR official schedule',checkedAt:new Date().toISOString(),tournaments:seasons};
 // The snapshot contains sporting facts only, never page-context/session data.
 if(previous&&JSON.stringify(previous.tournaments)===JSON.stringify(seasons))document.checkedAt=previous.checkedAt;
 fs.writeFileSync(OUTPUT,JSON.stringify(document,null,2)+'\n');console.log(`PGA TOUR: ${seasons.length} published tournaments, ${seasons.filter(t=>t.major).length} majors, ${seasons.filter(t=>t.winners.length).length} confirmed results`);return document;
}
function fixtures(document){return document.tournaments.map(t=>({id:`fixture:golf:pga:${t.id}`,eventId:`fixture:golf:pga:${t.id}`,key:'golf',sport:'golf',codeId:'sport:golf',competitionId:'competition:pga-tour',competitionName:'PGA TOUR',name:t.name,date:t.startDate,endDate:t.endDate,dateOnly:true,timePrecision:'date-only',timeTbc:true,status:t.status,venue:t.venue,venueCountryCode:t.countryCode,participants:[],participantIds:[],tournamentId:t.id,tournamentName:t.name,season:t.season,stage:t.major?'Major championship':'PGA TOUR',sourceName:document.sourceName,sourceUrl:t.sourceUrl,sourceType:'official',sourceCheckedAt:document.checkedAt,sourceTrust:'verified',...(t.winners.length?{outcomeText:`${t.winners.map(w=>w.name).join(' and ')} won ${t.name}.`,scoreDisplay:`Winner: ${t.winners.map(w=>w.name).join(' / ')}`,resultLabels:['Official winner']}:{}),detailsUnavailable:'Tee times and round-by-round scores are unavailable in the published schedule.'}));}
if(require.main===module)refresh().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parse,dateRange,refresh,fixtures};
