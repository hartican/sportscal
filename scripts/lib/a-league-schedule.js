'use strict';
// Called only by the canonical update-cards owner. Official match facts take
// precedence; ESPN supplies compatible legacy identities and club artwork.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..');
const COMPETITION='competition:a-leagues',KEY='a-league-men';
const OFFICIAL_COMPETITION='xwnjb1az11zffwty3m6vn8y6',SEASON='1ztoqmkrzy1d4ejf5jokthiqc';
const PAGE='https://aleagues.com.au/matches/a-league-men/';
const SOURCE=`https://match.api.aleagues.football/middleware/v2/fixturesAndResultsV2?competitionId=${OFFICIAL_COMPETITION}&tournamentId=${SEASON}&includeTicketAndStreamInfo=true`;
const RIGHTS='https://aleagues.com.au/news/aleague-men-2026-2027-fixture-list-revealed-key-dates-fixture-information/';
const ESPN='https://site.api.espn.com/apis/site/v2/sports/soccer/aus.1/';
const LEGACY_IDS={'5321':'team:football:adelaide-united','5326':'team:football:brisbane-roar','5328':'team:football:melbourne-victory','5322':'team:football:perth-glory','5327':'team:football:sydney-fc','13696':'team:football:western-sydney-wanderers'};
const normalize=value=>String(value||'').toLowerCase().replace(/\bfc\b/g,'').replace(/[^a-z0-9]/g,'');
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function local(iso){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return{date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function statusFor(raw){
 const key=String(raw||'').toLowerCase().replace(/[^a-z]/g,'');
 if(['fixture','scheduled'].includes(key))return 'upcoming';
 if(['playing','inprogress','halftime'].includes(key))return 'live';
 if(['played','fulltime','finished','completed'].includes(key))return 'completed';
 if(['postponed','cancelled','canceled','abandoned','suspended'].includes(key))return key==='canceled'?'cancelled':key;
 throw Error(`Unrecognised A-League source status: ${raw}`);
}
function validateMatches(matches){
 if(!Array.isArray(matches)||!matches.length)throw Error('Missing official A-League schedule');
 const regular=matches.filter(m=>m.stage?.name==='Regular Season');
 if(regular.length!==156)throw Error(`Expected 156 official regular-season fixtures, received ${regular.length}`);
 if(new Set(matches.map(m=>m.id)).size!==matches.length)throw Error('Duplicate official A-League fixture');
 const teams=new Set(),counts=new Map();
 for(const m of matches){
  if(!m.id||m.competition?.id!==OFFICIAL_COMPETITION||m.tournament?.id!==SEASON||!Number.isFinite(m.startDate))throw Error('Invalid official A-League season or kickoff');
  statusFor(m.matchStatus);
  for(const t of [m.homeTeam,m.awayTeam]){if(!t?.id||!t.officialName||/^TBD$/i.test(t.officialName))throw Error('Unresolved official A-League club');teams.add(t.id);if(m.stage.name==='Regular Season')counts.set(t.id,(counts.get(t.id)||0)+1);}
  if(m.homeTeam.id===m.awayTeam.id)throw Error('A-League fixture repeats a participant');
 }
 if(teams.size!==12||[...counts.values()].some(n=>n!==26))throw Error('Official A-League club schedule is incomplete');
 return matches;
}
function build({matches,teams,espnEvents=[],previous={events:[]},checkedAt=new Date().toISOString()}){
 validateMatches(matches);
 teams=teams.map(team=>({...team,id:LEGACY_IDS[team.externalIds?.espn]||team.id}));
 if(teams.length!==12||new Set(teams.map(t=>t.id)).size!==12)throw Error('Expected twelve unique A-League clubs');
 const byOfficial=new Map(),teamNames=new Map();
 for(const team of teams)for(const name of [team.displayName,...team.aliases||[]])teamNames.set(normalize(name),team);
 for(const m of matches)for(const raw of [m.homeTeam,m.awayTeam]){
  const team=teams.find(t=>t.externalIds?.aleagues===raw.id)||teamNames.get(normalize(raw.officialName))||teamNames.get(normalize(raw.name));
  if(!team)throw Error(`Unknown A-League club: ${raw.officialName}`);
  const existing=byOfficial.get(raw.id);if(existing&&existing.id!==team.id)throw Error('Ambiguous A-League club identity');byOfficial.set(raw.id,team);
 }
 if(new Set([...byOfficial.values()].map(t=>t.id)).size!==12)throw Error('A-League club mapping is not one to one');
 const byEspn=new Map(teams.map(t=>[String(t.externalIds?.espn),t]));
 const espn=espnEvents.filter(e=>e.season?.year===2026).map(e=>{const c=e.competitions?.[0]?.competitors||[];return{raw:e,home:byEspn.get(String(c.find(t=>t.homeAway==='home')?.team.id))?.id,away:byEspn.get(String(c.find(t=>t.homeAway==='away')?.team.id))?.id};});
 const exactFor=new Map(matches.map(m=>{
  const home=byOfficial.get(m.homeTeam.id),away=byOfficial.get(m.awayTeam.id);
  const exact=espn.filter(e=>e.home===home.id&&e.away===away.id&&Date.parse(e.raw.date)===m.startDate);
  return [m.id,exact.length===1?exact[0]:null];
 }));
 const reserved=new Set([...exactFor.values()].filter(Boolean).map(e=>e.raw.id));
 const taken=new Set();
 const oldByOfficial=new Map(previous.events.map(e=>[e.officialMatchId,e]));
 const events=matches.map(m=>{
  const home=byOfficial.get(m.homeTeam.id),away=byOfficial.get(m.awayTeam.id),startTimeUtc=new Date(m.startDate).toISOString(),parts=local(startTimeUtc);
  const prior=oldByOfficial.get(m.id),pair=espn.filter(e=>e.home===home.id&&e.away===away.id&&!taken.has(e.raw.id)&&!reserved.has(e.raw.id));
  const candidate=exactFor.get(m.id)||(pair.length===1?pair[0]:null);
  if(candidate)taken.add(candidate.raw.id);
  const providerId=candidate?.raw.id;
  const id=prior?.id||(providerId?`football-${KEY}-2026-27-${providerId}`:`football-${KEY}-2026-27-${m.id}`);
  const canonicalEventId=prior?.canonicalEventId||(providerId?`event:football:${KEY}:${providerId}`:`event:football:${KEY}:${m.id}`);
  const status=statusFor(m.matchStatus),name=`${home.displayName} v ${away.displayName}`;
  const viewingOptions=[{providerId:'paramount',rightsScope:'competition',linkScope:'sport',territory:'AU',liveOrReplay:'live',webUrl:'https://www.paramountplus.com/au/sports/a-league/',sourceUrl:RIGHTS,verifiedAt:checkedAt}];
  // The official flags establish TV carriage, not a 10 streaming permalink.
  if(m.isCh10||m.is10Bold)viewingOptions.push({providerId:'ten-tv',rightsScope:'fixture',linkScope:'sport',territory:'AU',liveOrReplay:'live',webUrl:'https://aleagues.com.au/more/where-to-watch-aleagues-mens/',sourceUrl:SOURCE,verifiedAt:checkedAt,channelBrand:m.isCh10?'10 (10 Drama in Perth)':'10 Drama'});
  if(m.is10Play)viewingOptions.push({providerId:'ten',rightsScope:'fixture',linkScope:'sport',territory:'AU',liveOrReplay:'live',webUrl:'https://10.com.au/a-league',sourceUrl:SOURCE,verifiedAt:checkedAt});
  // Include competition carriage alongside fixture-specific TV; otherwise the
  // shared viewing resolver correctly treats fixture providers as exhaustive.
  if(viewingOptions.length>1)viewingOptions[0].rightsScope='fixture';
  const result=status==='completed'?m.liveData?.matchDetails?.scores?.total:null;
  const hasResult=result&&Number.isInteger(result.home)&&Number.isInteger(result.away);
  return {id,eventId:prior?.eventId||id,canonicalEventId,officialMatchId:m.id,canonicalSourceId:m.id,canonicalSourceName:'A-Leagues official schedule',canonicalSourceUrl:SOURCE,canonicalSourceCheckedAt:checkedAt,canonicalSourceType:'official',
   sport:'Football',key:'football',sportDomainId:'sport:football',competitionId:COMPETITION,competitionName:'A-League Men',season:'2026/27',name,displayTitleCompact:name,
   participants:[{name:home.displayName,role:'home'},{name:away.displayName,role:'away'}],participantIds:[home.id,away.id],homeParticipantId:home.id,awayParticipantId:away.id,
   ...parts,startTimeUtc,venue:m.venue?.longName||m.venue?.shortName||null,scheduleStatus:['postponed','cancelled','abandoned','suspended'].includes(status)?status:'confirmed',status,
   round:'all',roundNumber:Number(m.week)||null,roundLabel:Number(m.week)?`Matchweek ${Number(m.week)}`:m.stage.name,stage:m.stage.name,narrativeType:'regular-season-fixture',expected:4,liveWindow:3,
   selectedSentence:`${name} in the 2026/27 A-League Men season.`,fullSpiel:`Official A-League Men fixture. ${Number(m.week)?`Matchweek ${Number(m.week)}.`:m.stage.name}`,
   broadcaster:viewingOptions.map(o=>o.providerId==='paramount'?'Paramount+':o.providerId==='ten-tv'?'Network 10':'10 Streaming').join(' / '),broadcastOptions:[],viewingOptions,
   sourceName:'A-Leagues official schedule',sourceUrl:SOURCE,sourceCheckedAt:checkedAt,sourceType:'official',sourceTrust:'verified',lastReviewedAt:checkedAt,
   replayEligible:status==='completed',highlightEligible:status==='completed',catchupEligible:status==='completed',briefingEligible:false,
   ...(hasResult?{homeScore:result.home,awayScore:result.away,score:`${home.displayName} ${result.home}-${result.away} ${away.displayName}`,canonicalResultScoreline:`${home.displayName} ${result.home}-${result.away} ${away.displayName}`}:{})};
 });
 const nextTeams=teams.map(t=>({...t,externalIds:{...t.externalIds,aleagues:[...byOfficial].find(([,v])=>v.id===t.id)[0]}}));
 return {teams:nextTeams,document:{schemaVersion:'football-fixtures.v1',leagueId:COMPETITION,leagueKey:KEY,seasonLabel:'2026/27',checkedAt,sourceUrl:SOURCE,events:events.sort((a,b)=>a.startTimeUtc.localeCompare(b.startTimeUtc))}};
}
function semantic(value){if(Array.isArray(value))return value.map(semantic);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['checkedAt','verifiedAt','sourceCheckedAt','canonicalSourceCheckedAt','lastReviewedAt'].includes(k)).map(([k,v])=>[k,semantic(v)]));return value;}
async function refresh({root=ROOT,fetchImpl=fetch,now=new Date(),force=false}={}){
 const fixturePath=`data/football/fixtures/${KEY}.json`,directory=read(root,'data/canonical/football-directory.v1.json');
 const previous=fs.existsSync(path.join(root,fixturePath))?read(root,fixturePath):{events:[]};
 const hasClubEvidence=directory.sources.some(s=>s.id==='source:football:a-league-men:clubs-current');
 const legacyCurrent=directory.teams.filter(t=>t.leagueId===COMPETITION).every(t=>!LEGACY_IDS[t.externalIds?.espn]||t.id===LEGACY_IDS[t.externalIds.espn]);
 if(hasClubEvidence&&legacyCurrent&&previous.events.every(e=>e.competitionName==='A-League Men')&&!force&&previous.checkedAt&&+now-Date.parse(previous.checkedAt)>=0&&+now-Date.parse(previous.checkedAt)<30*60*1000)return{changed:false,state:'current',requests:0};
 let requests=0;const receipts=new Map();
 async function json(url){requests++;const r=await fetchImpl(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`A-League source HTTP ${r.status}`);const body=typeof r.text==='function'?await r.text():JSON.stringify(await r.json()),payload=JSON.parse(body);receipts.set(url,{url,checkedAt:now.toISOString(),sha256:crypto.createHash('sha256').update(body).digest('hex')});return payload;}
 let built;
 try{
  const matches=validateMatches(await json(SOURCE));
  let teams=directory.teams.filter(t=>t.leagueId===COMPETITION),espnEvents=[];
  if(teams.length!==12){
   const adapter=require('../refresh-football-directory'),league=adapter.LEAGUES.find(l=>l.key===KEY);
   const raw=(await json(ESPN+'teams?limit=100')).sports?.[0]?.leagues?.[0]?.teams||[];
   teams=raw.map(t=>adapter.teamRecord(league,t.team));
   for(const year of [2026,2027])espnEvents.push(...(await json(ESPN+`scoreboard?limit=1000&dates=${year}`)).events||[]);
  }
  built=build({matches,teams,espnEvents,previous,checkedAt:now.toISOString()});
 }catch(error){if(previous.events.length>=156)return{changed:false,state:'deferred-retained',requests,error:error.message};throw error;}
 if(hasClubEvidence&&legacyCurrent&&JSON.stringify(semantic(built.document))===JSON.stringify(semantic(previous)))return{changed:false,state:'unchanged',requests};
 const {document,teams}=built,league={id:COMPETITION,key:KEY,displayName:'A-League Men',countryCode:'AU',seasonLabel:'2026/27',teamCount:12,sourceRefs:['source:football:a-league-men:official','source:football:a-league-men:clubs-current']};
 const next={...directory,leagues:[...directory.leagues.filter(l=>l.id!==COMPETITION),league],teams:[...directory.teams.filter(t=>t.leagueId!==COMPETITION),...teams]};
 const sources=[{id:'source:football:a-league-men:clubs-current',provider:'A-Leagues official current-season clubs',url:SOURCE,sourceType:'official',checkedAt:now.toISOString()},{id:'source:football:a-league-men:official',provider:'A-Leagues official schedule',url:SOURCE,sourceType:'official',checkedAt:now.toISOString()},{id:'source:football:a-league-men:bootstrap',provider:'ESPN public club identities',url:ESPN+'teams?limit=100',sourceType:'reputable',checkedAt:directory.sources.find(s=>s.id==='source:football:a-league-men:bootstrap')?.checkedAt||now.toISOString()}];
 next.sources=[...directory.sources.filter(s=>!sources.some(n=>n.id===s.id)),...sources];
 if(next.refreshEvidence)next.refreshEvidence={...next.refreshEvidence,teams:next.teams.length,receipts:[...next.refreshEvidence.receipts.filter(r=>r.url!==SOURCE),receipts.get(SOURCE)]};
 const index=read(root,'data/canonical/football-follow-index.v1.json');
 index.teams=[...index.teams.filter(t=>t.leagueId!==COMPETITION),...teams.map(t=>({id:t.id,leagueId:COMPETITION}))];
 const identityFile='config/card-identities.js',identity=fs.readFileSync(path.join(root,identityFile),'utf8');
 const identitySource=require('./football-identity-source').footballIdentitySource(next.teams);
 const outputs=[['data/canonical/football-directory.v1.json',JSON.stringify(next,null,2)+'\n'],['data/canonical/football-directory.v1.js','globalThis.NOTHINGSPORTS_FOOTBALL_DIRECTORY_DATA = '+JSON.stringify(next)+';\n'],['data/canonical/football-follow-index.v1.json',JSON.stringify(index,null,2)+'\n'],['data/canonical/football-follow-index.v1.js','globalThis.NOTHINGSPORTS_FOOTBALL_FOLLOW_INDEX = '+JSON.stringify(index)+';\n'],[fixturePath,JSON.stringify(document,null,2)+'\n'],[fixturePath.replace('.json','.js'),`globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES["${KEY}"] = ${JSON.stringify(document)};\n`],[identityFile,identity.replace(/\/\* football-club-identities:start \*\/[\s\S]*?\/\* football-club-identities:end \*\//,identitySource)]];
 const old=outputs.map(([f])=>[f,fs.existsSync(path.join(root,f))?fs.readFileSync(path.join(root,f)):null]);
 try{for(const [f,body] of outputs){const target=path.join(root,f);if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===body)continue;fs.writeFileSync(target+'.candidate',body);fs.renameSync(target+'.candidate',target);}}catch(error){for(const [f,body] of old){const target=path.join(root,f);if(body)fs.writeFileSync(target,body);else if(fs.existsSync(target))fs.unlinkSync(target);}throw error;}
 return{changed:true,state:'verified',requests,clubs:teams.length,fixtures:document.events.length};
}
module.exports={build,refresh,validateMatches,statusFor,SOURCE,PAGE,RIGHTS,COMPETITION,KEY};
