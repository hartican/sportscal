"use strict";
const identity=require("../config/fixture-identity");
const COUNTRIES={australia:"AU",england:"GB",pakistan:"PK",india:"IN",bangladesh:"BD","sri-lanka":"LK","new-zealand":"NZ","south-africa":"ZA",namibia:"NA",zimbabwe:"ZW",ireland:"IE",scotland:"GB",netherlands:"NL",afghanistan:"AF","west-indies":"", "united-arab-emirates":"AE",uae:"AE","hong-kong":"HK",nepal:"NP",oman:"OM",usa:"US"};
const RUGBY_NAMES={"South Africa":"springboks","New Zealand":"all-blacks",Australia:"wallabies",Argentina:"argentina",England:"england",Ireland:"ireland",France:"france",Scotland:"scotland",Wales:"wales",Italy:"italy",Fiji:"fiji",Japan:"japan"};
const RUGBY_COUNTRIES={springboks:"ZA","all-blacks":"NZ",wallabies:"AU",argentina:"AR",england:"GB",ireland:"IE",france:"FR",scotland:"GB",wales:"GB",italy:"IT",fiji:"FJ",japan:"JP"};
function slug(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function decodeStringLiteral(value){
  return value.replace(/\\(?:u[\da-f]{4}|x[\da-f]{2}|\r?\n|[\s\S])/gi,escape=>{
    const code=escape.slice(1);
    if(/^u[\da-f]{4}$/i.test(code))return String.fromCharCode(parseInt(code.slice(1),16));
    if(/^x[\da-f]{2}$/i.test(code))return String.fromCharCode(parseInt(code.slice(1),16));
    return ({n:"\n",r:"\r",t:"\t",b:"\b",f:"\f",v:"\v","0":"\0","\n":"","\r\n":""})[code]??code;
  });
}
function cricketTeam(team,women){
  if(!team || Number(team.id)===12 || /^(?:TBC|TBD)$/i.test(team.name || ""))return null;
  const country=slug(String(team.name).replace(/\s+(?:Men|Women)$/i,""));
  const national=Object.hasOwn(COUNTRIES,country);
  return {id:`team:cricket:${national?country:`ca-${team.id}`}${women?"-women":""}`,name:team.name,
    countryCode:COUNTRIES[country]||null,teamKind:national?"national":"club",genderCategory:women?"female":"male"};
}
function parseCricketPage(html,{sourceUrl,checkedAt=new Date().toISOString()}={}){
  const literal=String(html).match(/(?:window\.)?FIXTURES_DATA\s*=\s*JSON\.parse\('((?:\\[\s\S]|[^'\\])*)'\)/)?.[1];
  if(!literal)throw new Error("Cricket Australia fixture data unavailable");
  const games=JSON.parse(decodeStringLiteral(literal));
  return parseCricketFixtures(games,{sourceUrl,checkedAt});
}
function parseCricketFixtures(games,{sourceUrl,checkedAt=new Date().toISOString()}={}){
  if(!Array.isArray(games))throw new Error("Cricket Australia fixture collection invalid");
  return games.filter(game=>game?.id).map(game=>{
    const women=game.isWomensMatch===true,home=cricketTeam(game.homeTeam,women),away=cricketTeam(game.awayTeam,women);
    const international=home?.teamKind==="national"&&away?.teamKind==="national" || String(game.competition?.id).replace(/^CA:/,"")==="4710";
    const providerId=`CA:${String(game.id).replace(/^CA:/,"")}`,id=`fixture:cricket:${providerId}`;
    const sides=[home,away].filter(Boolean);
    return identity.normalizeCore({id,eventId:id,canonicalEventId:id,sourceFixtureId:providerId,key:"cricket",sport:"Cricket",sportDomainId:"sport:cricket",
      competitionId:`competition:cricket:${game.competition?.id || "unconfirmed"}`,competitionName:game.competition?.name,
      competitionScope:international?"international":"domestic",isInternational:international,isSenior:!/(?:under.?19|\bu19\b|youth)/i.test(game.competition?.name||""),gender:women?"women":"men",
      name:`${game.homeTeam?.name||"TBC"} v ${game.awayTeam?.name||"TBC"}`,roundLabel:game.name,
      startTimeUtc:game.startDateTime||null,endTimeUtc:game.endDateTime||null,timePrecision:game.startDateTime?"exact":"unknown",
      venue:[game.venue?.name,game.venue?.location].filter(item=>typeof item==="string").join(", "),
      participantIds:sides.map(team=>team.id),participants:sides,participantCountryCodes:sides.map(team=>team.countryCode).filter(Boolean),
      homeParticipantId:home?.id,awayParticipantId:away?.id,
      status:game.isCompleted?"completed":game.isLive||game.isInProgress?"live":"scheduled",
      scoreDisplay:game.isCompleted?(require('../data/canonical/current-card-evidence-2026.json').resultOverrides.find(result=>[result.id,result.canonicalId].includes(id))?.scoreDisplay || game.resultText || null):null,
      innings:(game.innings||[]).map(innings=>{const batting=String(innings.battingTeamId)===String(game.homeTeam?.id)?home:String(innings.battingTeamId)===String(game.awayTeam?.id)?away:null;return {...innings,participantId:batting?.id||null,team:batting?.name||null};}),
      format:game.gameType||null,numberOfDays:game.numberOfDays,
      sourceName:"Cricket Australia",sourceType:"official",sourceUrl,sourceCheckedAt:checkedAt,
      timingProvenance:{kind:"official",sourceUrl,checkedAt},
    });
  });
}
function parseRugbyPage(html,{sourceUrl,checkedAt=new Date().toISOString()}={}){
  const raw=String(html).match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  const game=raw&&JSON.parse(raw)?.props?.pageProps?.matchData?.getFixtureItem;
  if(!game?.id)throw new Error("Rugby Australia fixture data unavailable");
  const team=(value,role)=>{const name=value?.name||"TBC",key=({"900":"springboks","850":"all-blacks","800":"argentina","100":"wallabies"})[value?.teamId]||RUGBY_NAMES[name]||slug(name);return {id:`team:rugby:${key}`,name,role,countryCode:RUGBY_COUNTRIES[key]||null,teamKind:RUGBY_COUNTRIES[key]?"national":"club",genderCategory:"male"};};
  const home=team(game.homeTeam,"home"),away=team(game.awayTeam,"away");
  const id=String(game.id)==="949624"?"rugby-argentina-australia-mendoza-2026-09-06":`fixture:rugby:ra:${game.id}`;
  const international=home.teamKind==="national"&&away.teamKind==="national";
  return [identity.normalizeCore({id,eventId:id,canonicalEventId:id,sourceFixtureId:String(game.id),key:"rugby",sport:"Rugby Union",sportDomainId:"sport:rugby-union",
    competitionId:`competition:rugby:ra:${game.compId}`,competitionName:game.compName,competitionScope:international?"international":"domestic",isInternational:international,isSenior:true,gender:"men",
    name:`${home.name} v ${away.name}`,round:game.round,roundLabel:game.roundLabel,startTimeUtc:game.dateTime,timePrecision:game.dateTime?"exact":"unknown",
    venue:typeof game.venue==="string"?game.venue:game.venue?.name,
    participantIds:[home.id,away.id],participants:[home,away],participantCountryCodes:[home.countryCode,away.countryCode].filter(Boolean),homeParticipantId:home.id,awayParticipantId:away.id,
    status:/result|completed/i.test(game.status)?"completed":game.isLive?"live":/cancel|postpon/i.test(game.status)?String(game.status).toLowerCase():"scheduled",
    homeScore:game.homeTeam?.score,awayScore:game.awayTeam?.score,
    scoreDisplay:/result|completed/i.test(game.status)?`${game.homeTeam?.score}–${game.awayTeam?.score}`:null,
    sourceName:"Rugby Australia",sourceType:"official",sourceUrl,sourceCheckedAt:checkedAt,timingProvenance:{kind:"official",sourceUrl,checkedAt},
  })];
}
const SOURCE_PAGES=Object.freeze([
  {id:"cricket-ca-current",url:"https://www.cricket.com.au/matches/",parse:parseCricketPage},
  {id:"cricket-ca-4710",url:"https://www.cricket.com.au/matches/series/CA:4710/asia-cup-2026-women",parse:parseCricketPage},
  {id:"rugby-ra-949461",url:"https://www.rugby.com.au/match-centre/3/2026/949461",parse:parseRugbyPage},
  {id:"rugby-ra-949624",url:"https://www.rugby.com.au/match-centre/3/2026/949624",parse:parseRugbyPage},
]);
const ASIA_CUP_RESULTS_URL="https://apiv2.cricket.com.au/web/fixtures/yearfilter?competitionId=4710&isCompleted=true&limit=13&isInningInclude=true&jsconfig=eccn%3Atrue&format=json";
async function completedAsiaCup(fetchImpl,now,signal){
  const games=[],seen=new Set();let lastId;
  for(let page=0;page<3;page++){
    const url=new URL(ASIA_CUP_RESULTS_URL);if(lastId)url.searchParams.set('lastId',lastId);
    const response=await fetchImpl(url.href,{signal:signal||AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Cricket Australia results unavailable');
    const payload=await response.json();
    if(payload.responseError||!Array.isArray(payload.fixtures))throw new Error('Invalid cricket results page');
    for(const game of payload.fixtures){
      if(!Number.isSafeInteger(game.id)||seen.has(game.id)||String(game.competition?.id)!=='4710'||game.isWomensMatch!==true||game.isCompleted!==true||!game.resultText||!cricketTeam(game.homeTeam,true)||!cricketTeam(game.awayTeam,true))throw new Error('Unconfirmed or duplicate Asia Cup result');
      seen.add(game.id);games.push(game);
    }
    if(payload.fixtures.length<13){
      if(games.length!==15)throw new Error('Incomplete finished Asia Cup: expected 15 results');
      return parseCricketFixtures(games,{sourceUrl:ASIA_CUP_RESULTS_URL,checkedAt:now.toISOString()});
    }
    lastId=payload.fixtures.at(-1).id;
  }
  throw new Error('Asia Cup results exceeded page budget');
}
function coverageSources(fetchImpl=globalThis.fetch,{discovery=true}={}){return [...SOURCE_PAGES.filter(page=>{const competitionId=page.id.match(/^cricket-ca-(\d+)$/)?.[1];return !competitionId||!require('../config/cricket-coverage').policy.retiredCompetitionIds.includes('competition:cricket:'+competitionId);}).map(page=>({id:page.id,...(page.id==="cricket-ca-4710"?{minimumIntervalMs:21600000}:{}),fetch:async({now,signal,previous=[],coverage={}})=>{
  if(page.id==="cricket-ca-4710")return completedAsiaCup(fetchImpl,now,signal);
  if(page.id==="cricket-ca-current")return require("./cricket-current-results").currentCricket({fetchImpl,now,signal,previous,coverage,parseCricketPage,parseCricketFixtures});
  const response=await fetchImpl(page.url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error("Coverage source unavailable");
  return page.parse(await response.text(),{sourceUrl:page.url,checkedAt:now.toISOString()});
}})),...(discovery?require('./coverage-discovery').discoverySources(fetchImpl):[])];}
module.exports={parseCricketFixtures,completedAsiaCup,ASIA_CUP_RESULTS_URL,parseCricketPage,parseRugbyPage,coverageSources,SOURCE_PAGES};
