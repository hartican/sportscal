#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {baseFixtures,fixtures}=require('../lib/golf-fixtures');
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
 const cup=baseFixtures(document).find(t=>t.name==='Presidents Cup');
 if(cup){
  const previousCup=previous?.presidentsCup||[];
  try{document.presidentsCup=await require('../lib/presidents-cup').refresh({previous:[{...cup,tournamentParent:true,...previousCup.find(e=>e.tournamentParent)},...previousCup.filter(e=>!e.tournamentParent)],fetchImpl});}
  catch(error){if(!previousCup.length)throw error;document.presidentsCup=previousCup;console.warn('Presidents Cup source unavailable; retaining last-good observations.');}
 }
 const lpga=require('../lib/golf-participation');
 const now=Date.now(),day=86400000;
 document.pgaParticipation=previous?.pgaParticipation||[];
 for(const base of baseFixtures(document).filter(t=>t.name!=='Presidents Cup'&&Date.parse(t.endDate)>=now-7*day&&Date.parse(t.date)<=now+14*day)){
  const slug=base.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const root=`https://www.pgatour.com/tournaments/${base.season}/${slug}/${base.tournamentId}`;
  try{
   const pages=await Promise.all(['tee-times','field'].map(async suffix=>{const r=await fetchImpl(root+'/'+suffix,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.text();}));
   const next=lpga.mergeObservation(lpga.parsePga(pages[0],{base,sourceUrl:root+'/tee-times',fieldHtml:pages[1]}),document.pgaParticipation.find(e=>e.id===base.id));
   document.pgaParticipation=[...document.pgaParticipation.filter(e=>e.id!==base.id),next];
  }catch(error){console.warn('PGA participation source retained:',base.name,error.message);}
 }

 document.lpga=previous?.lpga||[];
 try{
  const index=await fetchImpl('https://www.lpga.com/tournaments',{signal:AbortSignal.timeout(15000)});if(!index.ok)throw Error('LPGA calendar unavailable');
  const html=await index.text();
  const upcoming=lpga.rscObjects(html).filter(t=>t.tournamentCode&&t.month&&t.dateRange&&t.link?.href);
  const urls=[...new Set(upcoming.filter(t=>{try{const year=Number(t.month.match(/\d{4}/)[0]);const range=dateRange(t.dateRange,year);return Date.parse(range.endDate)>=now-7*day&&Date.parse(range.startDate)<=now+14*day;}catch{return false;}}).map(t=>'https://www.lpga.com'+t.link.href.replace('/overview','/pairings')))];
  if(!urls.length)throw Error('LPGA calendar contains no tournament links');
  const observations=[];
  for(const sourceUrl of urls){
   try{const r=await fetchImpl(sourceUrl,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const pairingsHtml=await r.text();const metadata=lpga.parseLpga(pairingsHtml,{sourceUrl});let entriesHtml='';if(Date.parse(metadata.date)<=now+14*day&&Date.parse(metadata.endDate)>=now-7*day){const field=await fetchImpl(sourceUrl.replace('/pairings','/entries'),{signal:AbortSignal.timeout(15000)});if(field.ok)entriesHtml=await field.text();}const next=lpga.parseLpga(pairingsHtml,{sourceUrl,entriesHtml});observations.push(lpga.mergeObservation(next,document.lpga.find(e=>e.id===next.id)));}
   catch(error){console.warn('LPGA source retained:',sourceUrl,error.message);}
  }
  const observed=new Set(observations.map(e=>e.id));document.lpga=[...document.lpga.filter(e=>!observed.has(e.id)),...observations];
 }catch(error){console.warn('LPGA source retained:',error.message);}
 // The snapshot contains sporting facts only, never page-context/session data.
 if(previous&&JSON.stringify(previous.tournaments)===JSON.stringify(seasons))document.checkedAt=previous.checkedAt;
 fs.writeFileSync(OUTPUT,JSON.stringify(document,null,2)+'\n');console.log(`PGA TOUR: ${seasons.length} published tournaments, ${seasons.filter(t=>t.major).length} majors, ${seasons.filter(t=>t.winners.length).length} confirmed results`);return document;
}
if(require.main===module)refresh().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parse,dateRange,refresh,fixtures};
