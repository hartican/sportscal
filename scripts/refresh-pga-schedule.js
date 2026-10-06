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
async function refresh({years=[new Date().getUTCFullYear(),new Date().getUTCFullYear()+1],fetchImpl=fetch,outputPath=OUTPUT,now=new Date(),clock=()=>new Date(),observer=require('../lib/golf-source-observations').create({clock})}={}){
 const previous=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath)):null;const seasons=[];
 const seenErrors=new WeakSet(),code=require('../lib/golf-source-observations').errorCode;
 const facts=base=>({tournamentId:base?.tournamentId||null,name:base?.name||null,competitionId:base?.competitionId||null,retainedFactAt:base?.participationCheckedAt||base?.sourceCheckedAt||null});
 const failed=(error,row)=>{if(!seenErrors.has(error)){observer.record({...row,state:'failed',code:code(error)});seenErrors.add(error);}};
 async function page(url,resource,base,{future=false,deadline=15000}={}){
  const row={resource,sourceUrl:url,...facts(base)};
  try{
   if(!require('../lib/golf-source-observations').sourceUrl(url))throw Error('Unrecognised Golf source URL');
   let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(deadline)});}catch(error){if(!['TimeoutError','AbortError'].includes(error.name))error.code='GOLF_TRANSPORT';throw error;}
   if(future&&response.status===404){observer.record({...row,state:'unpublished',code:'not-published'});return null;}
   if(!response.ok)throw Error('HTTP '+response.status);
   const html=await response.text();observer.record({...row,state:'fetched',code:'http-ok'});return html;
  }catch(error){failed(error,row);throw error;}
 }
 for(const year of years){
  const future=year>years[0];
  const url=`https://www.pgatour.com/schedule/${year}`,html=await page(url,'calendar',{sourceCheckedAt:previous?.checkedAt},{future,deadline:30000});
  if(html===null){console.log(`PGA TOUR ${year} is not published yet.`);continue;}
  try{seasons.push(...parse(html,year,{requireFull:!future}));observer.record({resource:'calendar',sourceUrl:url,state:'accepted',code:'validated'});}catch(error){if(future&&error.code==='PGA_SEASON_UNPUBLISHED'){observer.record({resource:'calendar',sourceUrl:url,state:'unpublished',code:'not-published'});console.log(error.message);continue;}failed(error,{resource:'calendar',sourceUrl:url});throw error;}
 }
 let document={schemaVersion:'pga-tour-schedule.v1',sourceName:'PGA TOUR official schedule',checkedAt:clock().toISOString(),tournaments:seasons};
 const cup=baseFixtures(document).find(t=>t.name==='Presidents Cup');
 if(cup){
  const previousCup=previous?.presidentsCup||[];
  try{
   let attempted=false;const url=require('../lib/presidents-cup').URL;
   document.presidentsCup=await require('../lib/presidents-cup').refresh({now,previous:[{...cup,tournamentParent:true,...previousCup.find(e=>e.tournamentParent)},...previousCup.filter(e=>!e.tournamentParent)],fetchImpl:async(source,options)=>{attempted=true;return fetchImpl(source,options);}});
   if(attempted)observer.record({resource:'team-contests',sourceUrl:url,state:'accepted',code:'validated',name:'Presidents Cup',status:document.presidentsCup[0].status,statusEvidence:'official-tournament',retainedFactAt:previousCup[0]?.sourceCheckedAt||null});
  }
  catch(error){failed(error,{resource:'team-contests',sourceUrl:require('../lib/presidents-cup').URL,name:'Presidents Cup',retainedFactAt:previousCup[0]?.sourceCheckedAt||null});if(!previousCup.length)throw error;document.presidentsCup=previousCup;console.warn('Presidents Cup source unavailable; retaining last-good observations.');}
 }
 const lpga=require('../lib/golf-participation');
 const reference=+now,day=86400000;
 document.pgaParticipation=previous?.pgaParticipation||[];
 for(const base of baseFixtures(document).filter(t=>t.name!=='Presidents Cup'&&Date.parse(t.endDate)>=reference-7*day&&Date.parse(t.date)<=reference+14*day)){
  const slug=base.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!/^[RH]\d{7}$/.test(base.tournamentId))continue;
  const root=`https://www.pgatour.com/${base.tournamentId.startsWith('H')?'korn-ferry-tour/':''}tournaments/${base.season}/${slug}/${base.tournamentId}`;
  try{
   const old=document.pgaParticipation.find(e=>e.id===base.id);
   const attempts=await Promise.allSettled(['tee-times','field'].map(suffix=>page(root+'/'+suffix,suffix,old||base)));
   const failure=attempts.find(r=>r.status==='rejected');if(failure)throw failure.reason;
   const pages=attempts.map(r=>r.value);
   const next=lpga.mergeObservation(lpga.parsePga(pages[0],{base,sourceUrl:root+'/tee-times',fieldHtml:pages[1],checkedAt:clock().toISOString()}),old);
   document.pgaParticipation=[...document.pgaParticipation.filter(e=>e.id!==base.id),next];
   const sourceStatus=lpga.pgaStatus(lpga.pgaQueries(pages[0]),base);
   observer.record({resource:'participation',sourceUrl:root+'/tee-times',...facts(old||base),state:sourceStatus==='completed'&&next.status!=='completed'?'not-attested':'accepted',code:sourceStatus==='completed'&&next.status!=='completed'?'final-result-required':'validated',status:next.status,statusEvidence:sourceStatus&&sourceStatus!=='completed'?'official-tournament':base.tournamentId.startsWith('H')?'retained-calendar':'official-calendar'});
  }catch(error){failed(error,{resource:'participation',sourceUrl:root+'/tee-times',...facts(document.pgaParticipation.find(e=>e.id===base.id)||base)});console.warn('PGA participation source retained:',base.name,code(error));}
 }

 document.lpga=previous?.lpga||[];
 try{
  const html=await page('https://www.lpga.com/tournaments','calendar');
  const upcoming=lpga.rscObjects(html).filter(t=>t.tournamentCode&&t.month&&t.dateRange&&t.link?.href);
  const urls=[...new Set(upcoming.filter(t=>{try{const year=Number(t.month.match(/\d{4}/)[0]);const range=dateRange(t.dateRange,year);return Date.parse(range.endDate)>=reference-7*day&&Date.parse(range.startDate)<=reference+14*day;}catch{return false;}}).map(t=>'https://www.lpga.com'+t.link.href.replace('/overview','/pairings')))];
  if(!urls.length)throw Error('LPGA calendar contains no tournament links');
  const observations=[];
  for(const sourceUrl of urls){
   try{
    const prior=document.lpga.find(e=>e.sourceUrl?.replace(/\/(pairings|entries|results|leaderboard)$/,'')===sourceUrl.replace('/pairings',''));
    const pairingsHtml=await page(sourceUrl,'pairings',prior),metadata=lpga.parseLpga(pairingsHtml,{sourceUrl,checkedAt:clock().toISOString()});let entriesHtml='';
    const old=document.lpga.find(e=>e.id===metadata.id);
    if(Date.parse(metadata.date)<=reference+14*day&&Date.parse(metadata.endDate)>=reference-7*day){try{entriesHtml=await page(sourceUrl.replace('/pairings','/entries'),'entries',old||metadata);}catch(error){if(old?.entryListPublished)throw error;}}
    const next=lpga.parseLpga(pairingsHtml,{sourceUrl,entriesHtml,checkedAt:clock().toISOString()});
    if(old?.entryListPublished&&!next.entryListPublished)throw Error('Previously published LPGA field unavailable in response');
    observations.push(lpga.mergeObservation(next,old));
    const publishedStatus=lpga.rscObjects(pairingsHtml).find(o=>o.status&&'active' in o&&'refresh' in o)?.status;
    observer.record({resource:'participation',sourceUrl,...facts(old||next),state:'accepted',code:'validated',status:next.status,statusEvidence:/^(?:complete|completed|official|in progress|in_progress|live|upcoming|scheduled)$/i.test(publishedStatus||'')?'official-pairings':'not-attested'});
    if(!next.entryListPublished)observer.record({resource:'entries',sourceUrl:sourceUrl.replace('/pairings','/entries'),...facts(old||next),state:'not-attested',code:'field-not-attested'});
   }
   catch(error){failed(error,{resource:'participation',sourceUrl});console.warn('LPGA source retained:',sourceUrl,code(error));}
  }
  const observed=new Set(observations.map(e=>e.id));document.lpga=[...document.lpga.filter(e=>!observed.has(e.id)),...observations];
 }catch(error){failed(error,{resource:'calendar',sourceUrl:'https://www.lpga.com/tournaments'});console.warn('LPGA source retained:',code(error));}
 const results=await require('../lib/lpga-results').refresh(document,{fetchImpl,now,clock,onCheck:observer.record});document=results.document;observer.resultsPass(results);for(const failure of results.failures)console.warn('LPGA results retained:',failure.id,failure.code);
 // The snapshot contains sporting facts only, never page-context/session data.
 if(previous&&JSON.stringify(previous.tournaments)===JSON.stringify(seasons))document.checkedAt=previous.checkedAt;
 if(outputPath===OUTPUT){const ranking=await require('../lib/golf-ranked-cohort').refresh({now,fetchImpl});if(ranking.error)console.warn('Golf rankings retained:',ranking.error);const scope=require('../lib/golf-tracked-scope');document=scope.projectDocument(document,{ids:scope.trackedIds(scope.privateFollowIds()),now});}
 fs.writeFileSync(outputPath,JSON.stringify(document,null,2)+'\n');console.log(`PGA TOUR: ${seasons.length} published tournaments, ${seasons.filter(t=>t.major).length} majors, ${seasons.filter(t=>t.winners.length).length} confirmed results`);return document;
}
if(require.main===module)refresh().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parse,dateRange,refresh,fixtures};
