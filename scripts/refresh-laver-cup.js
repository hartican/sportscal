'use strict';
// Called only by canonical tournament hydration, for full and quick refreshes.
const fs=require('node:fs');
const identity=require('../config/fixture-identity');
const URL='https://lavercup.com/scores-results-2026';
const TOURNAMENT='tournament:tennis:laver-cup-2026';
const tournament={providerId:'laver-cup-2026',name:'Laver Cup',tour:'TEAM',representedTours:['ATP'],level:'team_competition',startDate:'2026-09-25',endDate:'2026-09-27',city:'London',countryCode:'GBR',surface:'hard',sourceUrl:URL,season:2026,tournamentId:TOURNAMENT,providerAlias:'team:tournament:laver-cup-2026',competitionId:'competition:laver-cup',taxonomySportId:'sport:tennis',disciplineId:'discipline:tennis:professional',baselineEligible:true};
const decode=s=>String(s||'').replace(/&#(?:0?39|8217);|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&quot;/g,'"');
const attr=(tag,name)=>decode(tag.match(new RegExp("(?:^|\\s)"+name+"=(\"[^\"]*\"|'[^']*')"))?.[1]?.slice(1,-1)||'');
function parse(html,{participants=[],checkedAt=new Date().toISOString()}={}){
 const fixtures=[];
 for(const match of html.matchAll(/<table\b([^>]*class="components-match-scoreboard"[^>]*)>([\s\S]*?)<\/table>/g)){
  const a=match[1],body=match[2],provider=attr(a,'match-id'),day=Number(attr(a,'match-day')),order=Number(attr(a,'match-order'));
  if(attr(a,'match-year')!=='2026'||!provider)continue;
  const number=Number(body.match(/Match (\d+)/)?.[1]);
  if(!number||![1,2,3].includes(day))throw Error('Invalid Laver match identity');
  const doubles=attr(a,'match-format')==='doubles',sides=[];
  for(const row of (body.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
   const players=[];
   for(const link of row[1].matchAll(/<a\b([^>]*player-id=[^>]*)>/g)){
    const p=link[1],slug=attr(p,'href').split('/').filter(Boolean).at(-1),name=attr(p,'title').replace(/^View '/,'').replace(/' profile$/,'');
    if(!slug||!name)throw Error('Invalid Laver athlete');
    const canonical=participants.find(x=>String(x.metadata?.providerAlias||'').toLowerCase()==='atp:player:'+attr(p,'player-id').replace(/^ATP/,'').toLowerCase())||participants.find(x=>x.id==='competitor:tennis:atp:'+slug);
    players.push({...canonical,id:canonical?.id||'competitor:tennis:atp:'+slug,name,displayName:name,type:'competitor',sportDomainId:'sport:tennis:atp',sourceUrl:attr(p,'href')});
   }
   const sets=[...row[1].matchAll(/<td\b[^>]*class="value"[^>]*>([\s\S]*?)<\/td>/g)].map(m=>({games:Number(m[1].match(/^\s*(\d+)/)?.[1]),tiebreak:m[1].match(/<sup>(\d+)<\/sup>/)?.[1]}));
   if(players.length)sides.push({players,sets});
  }
  if(sides.length!==2||sides.some(s=>s.players.length!==(doubles?2:1)))throw Error('Incomplete published Laver lineup');
  const session=Date.parse(attr(a,'match-date-gmt'));
  if(!Number.isFinite(session))throw Error('Invalid Laver session time');
  const local=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(session).map(p=>[p.type,p.value]));
  const first=day<3?(order===1||order===3):order===1;
  const status=attr(a,'match-status');
  if(!['completed','scheduled','upcoming','live','in-progress'].includes(status))throw Error('Unknown Laver status: '+status);
  if(status==='completed'&&(sides[0].sets.length<2||sides[0].sets.length!==sides[1].sets.length||sides.some(s=>s.sets.some(x=>!Number.isFinite(x.games)))))throw Error('Incomplete Laver result');
  const sets=sides[0].sets.map((s,i)=>({home:s.games,away:sides[1].sets[i]?.games,...(s.tiebreak!=null?{homeTiebreak:Number(s.tiebreak)}:{}),...(sides[1].sets[i]?.tiebreak!=null?{awayTiebreak:Number(sides[1].sets[i].tiebreak)}:{}),...(i===2?{matchTiebreak:true}:{})}));
  const names=sides.map(s=>s.players.map(p=>p.name).join(' / ')),name=names.join(' v '),id='fixture:tennis:laver-cup:2026:'+provider.toLowerCase();
  const score=sets.map(s=>`${s.matchTiebreak?'[':''}${s.home}${s.homeTiebreak!=null?'('+s.homeTiebreak+')':''}-${s.away}${s.awayTiebreak!=null?'('+s.awayTiebreak+')':''}${s.matchTiebreak?']':''}`).join(' ');
  const winner=attr(a,'match-winner')==='europe'?0:attr(a,'match-winner')==='world'?1:null;
  if(status==='completed'&&winner===null)throw Error('Completed Laver match has no winner');
  const hook=`${names[0]} face ${names[1]} with ${day} ${day===1?'point':'points'} at stake for their Laver Cup teams.`;
  const synopsis=`This ${doubles?'doubles':'singles'} match at The O2 is part of day ${day} in London. ${doubles?'Coordinating returns and covering the net together are the central challenges.':'The individual contest also contributes to the Europe versus World team total.'} The match format uses a deciding match tiebreak instead of a full third set.`;
  fixtures.push(identity.normalizeCore({id,eventId:id,canonicalEventId:id,key:'tennis',sport:'Tennis',sportDomainId:'sport:tennis',competitionId:'competition:laver-cup',competitionName:'Laver Cup',eventFamilyId:'laver-cup',tournamentId:TOURNAMENT,tournamentName:'Laver Cup',season:2026,gender:'men',tour:'ATP',cardKind:'fixture',eventType:doubles?'doubles':'singles',matchType:doubles?'mens-doubles':'mens-singles',name,status:status==='completed'?'completed':status==='live'||status==='in-progress'?'live':'upcoming',roundLabel:`Day ${day} - Match ${number}`,date:`${local.year}-${local.month}-${local.day}`,startTimeUtc:first?new Date(session).toISOString():null,sessionStartTimeUtc:new Date(session).toISOString(),sessionId:`laver-2026-${day}-${day<3&&order>=3?'evening':'day'}`,sequenceInSession:day<3?(order-1)%2+1:order,timePrecision:first?'session-start':'follows',scheduleStatus:'confirmed',venue:'The O2',venueCountryCode:'GB',participantIds:sides.flatMap(s=>s.players.map(p=>p.id)),participants:sides.flatMap(s=>s.players),participantsConfirmed:true,participantSlots:sides.map((s,i)=>({slot:i+1,label:names[i],participantId:doubles?null:s.players[0].id})),matchupSides:sides.map((s,i)=>({name:names[i],players:s.players})),homeParticipantId:doubles?null:sides[0].players[0].id,awayParticipantId:doubles?null:sides[1].players[0].id,sets,...(status==='completed'?{score,scoreDisplay:`${names[0]} ${score} ${names[1]}`,outcomeText:`${names[winner]} won for Team ${winner===0?'Europe':'World'}.`,winnerParticipantIds:sides[winner].players.map(p=>p.id),result:{status:'official',score,sourceUrl:URL,checkedAt}}:{}),broadcaster:'Stan Sport',broadcastSourceUrl:'https://lavercup.com/how-to-watch-the-laver-cup',sourceUrl:`https://lavercup.com/match/london-2026-match-${number}`,sourceName:'Laver Cup',sourceType:'official',sourceCheckedAt:checkedAt,selectedSentence:hook,fullSpiel:synopsis,expected:6,stakesScore:3}));
 }
 if(!fixtures.length)throw Error('Laver source contains no published matches');
 return [...new Map(fixtures.map(f=>[f.id,f])).values()];
}
async function refresh({fetchImpl=fetch,now=new Date(),output='data/canonical/tennis-team-contests.v1.json',cataloguePath='data/canonical/tennis-catalogue-2026.json'}={}){
 const response=await fetchImpl(URL,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Laver source HTTP '+response.status);
 const prior=JSON.parse(fs.readFileSync(output)),catalogue=JSON.parse(fs.readFileSync(cataloguePath));
 const participants=require('../data/canonical/tennis-context-2026.json').participants;
 const fixtures=parse(await response.text(),{participants,checkedAt:now.toISOString()});
 const next=identity.mergeOverlays(prior.fixtures,fixtures);
 const nextCatalogue={...catalogue,tournaments:[...catalogue.tournaments.filter(t=>t.tournamentId!==TOURNAMENT),tournament]};
 fs.writeFileSync(output,JSON.stringify({...prior,fixtures:next},null,2)+'\n');
 fs.writeFileSync(cataloguePath,JSON.stringify(nextCatalogue,null,2)+'\n');
 return {fixtures:fixtures.length,failures:[]};
}
module.exports={parse,refresh,TOURNAMENT,tournament};
