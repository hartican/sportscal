'use strict';
// Server-only media matching. These checks cannot change fixture identity or
// admit a fixture to a user's Feed.
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const contains=(text,phrase)=>Boolean(phrase)&&(' '+text+' ').includes(' '+phrase+' ');
function key(event){
  const explicit=String(event.codeId||'').replace(/^(sport|competition):/,'').replace(/-20\d\d(?:-\d{2,4})?$/,'');
  if(explicit==='rugby-union')return 'rugby';
  if(explicit==='american-football')return 'nfl';
  if(/^(?:nbl|nba|aflw|nrlw|motogp|f1)$/.test(explicit))return explicit;
  if(/football|premier-league|bundesliga|la-liga|serie-a|ligue-1|uefa|fifa/.test(explicit))return 'football';
  if(/^formula-one/.test(explicit))return 'f1';
  const fallback=String(event.sportKey||event.key||explicit).replace(/^(sport|competition):/,'');
  if(fallback==='rugby-union')return 'rugby';
  if(fallback==='american-football')return 'nfl';
  if(/football|premier-league|bundesliga|la-liga|serie-a|ligue-1|uefa|fifa/.test(fallback))return 'football';
  return fallback;
}
const racing=new Set(['f1','motogp','supercars','wrc','dakar','le-mans','lemans','goodwood']);
const ignored=new Set('the and vs v of at in grand prix gp race round match sport sports highlights recap formula f1 league championship championships cup world tour open football basketball baseball cricket rugby golf men women mens womens all final day stage qualifying practice sprint 2026'.split(' '));
const terms=value=>normal(value).split(' ').filter(t=>t.length>2&&!ignored.has(t)&&!/^\d+$/.test(t));
function gender(event){
  const value=normal([key(event),event.codeId,event.competitionId,event.gender,event.competitionName,event.tournamentName,event.name].join(' '));
  return /\b(women|womens|female|aflw|nrlw|matildas|wallaroos|black ferns|white ferns|jillaroos|opals|fiba women|wsl championship tour women)\b/.test(value)?'women':/\b(men|mens|male)\b/.test(value)?'men':null;
}
function genderMatches(event,title,all){
  const wanted=gender(event),female=/\b(women|womens|female|aflw|nrlw|w league|wnba|matildas|wallaroos|black ferns|white ferns|jillaroos|opals)\b/.test(title),male=/\b(men|mens|male)\b/.test(title);
  if(wanted==='women')return female&&!male;
  return !female;
}
function session(value){
  const text=normal(value);
  if(/\bsprint (?:qualifying|shootout)\b/.test(text))return 'sprint qualifying';
  if(/\bsprint\b/.test(text))return 'sprint';
  if(/\b(?:qualifying|qualification|quali|q1|q2|q3|shootout)\b/.test(text))return 'qualifying';
  if(/\bwarm ?up\b/.test(text))return 'warm up';
  const p=text.match(/\b(?:free )?practice\s*(\d)?\b|\bfp\s*(\d)\b/);
  if(p)return 'practice'+(p[1]||p[2]?' '+(p[1]||p[2]):'');
  if(/\brace\b/.test(text))return 'race';
  return null;
}
function ordinal(value,kind){
  const text=normal(value),m=text.match(new RegExp('\\b'+kind+'\\s*(\\d{1,3})\\b'));
  if(m)return +m[1];
  if(kind==='test'){const n=text.match(/\b(first|second|third|fourth|fifth) test\b/);if(n)return ['first','second','third','fourth','fifth'].indexOf(n[1])+1;}
  return null;
}
function roundMatches(event,title,{requireEvidence=false}={}){
  const wanted=normal([event.name,event.stage,event.roundLabel,event.round!=='all'?event.round:''].join(' '));
  let hasEvidence=false;
  for(const kind of ['game','matchweek','week','round','stage','day','test']){
    const a=ordinal(wanted,kind),b=ordinal(title,kind);
    if(a!==null&&b!==null&&a!==b)return false;
    if(a!==null&&b===a)hasEvidence=true;
  }
  return !requireEvidence||hasEvidence;
}
function datesMatch(event,video){
  const date=String(event.date||'').slice(0,10),end=String(event.endDate||date).slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return true;
  const title=String(video.title||'');
  // An explicit game date outranks a fresh upload receipt, especially where
  // the same two clubs play on consecutive days. US sports use local dates.
  const allowed=new Set([date,end]);
  const start=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');
  if(Number.isFinite(start)){
    allowed.add(new Date(start).toISOString().slice(0,10));
    if(['baseball','nba','nbl','nfl'].includes(key(event)))allowed.add(new Date(start-8*3600000).toISOString().slice(0,10));
  }
  const supplied=[...title.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)].map(m=>m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'));
  for(const m of title.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2}|\d{2})\b/g))supplied.push((m[3].length===2?'20':'')+m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'));
  const monthNames=['jan(?:uary)?','feb(?:ruary)?','mar(?:ch)?','apr(?:il)?','may','jun(?:e)?','jul(?:y)?','aug(?:ust)?','sep(?:t(?:ember)?)?','oct(?:ober)?','nov(?:ember)?','dec(?:ember)?'];
  const text=normal(title),monthPattern='('+monthNames.join('|')+')',dayPattern='(\\d{1,2})(?:st|nd|rd|th)?',yearPattern='(?: (20\\d{2}))?';
  const addDate=(month,day,year)=>{const index=monthNames.findIndex(pattern=>new RegExp('^'+pattern+'$').test(month));supplied.push((year||date.slice(0,4))+'-'+String(index+1).padStart(2,'0')+'-'+day.padStart(2,'0'));};
  for(const m of text.matchAll(new RegExp('\\b'+monthPattern+' '+dayPattern+yearPattern+'\\b','g')))addDate(m[1],m[2],m[3]);
  for(const m of text.matchAll(new RegExp('\\b'+dayPattern+' '+monthPattern+yearPattern+'\\b','g')))addDate(m[2],m[1],m[3]);
  return supplied.every(d=>allowed.has(d));
}
function competitionMatches(event,title){
  const competitions=[/\bpremier league\b/,/\bbundesliga\b/,/\bla ?liga\b/,/\bserie a\b/,/\bligue 1\b/,/\b(?:uefa )?champions league\b/,/\b(?:uefa )?europa league\b/,/\b(?:uefa )?conference league\b/,/\bfa cup\b/,/\b(?:efl|carabao|league) cup\b/,/\ba league\b/,/\bnbl\b/,/\bnba\b/,/\bclub world cup\b/,/\bworld cup qualif\w*\b/,/\bworld cup\b/,/\binternational friendl\w*\b/];
  const expected=[event.competitionId,event.competitionName,event.tournamentName,event.key].map(value=>competitions.findIndex(pattern=>pattern.test(normal(value)))).find(index=>index>=0),supplied=competitions.findIndex(pattern=>pattern.test(title));
  if(expected!==undefined&&supplied>=0&&expected!==supplied)return false;
  // Country names alone cannot make football/cricket/rugby interchangeable.
  const family=key(event),sport=/football|premier|fifa|bundesliga|la-liga|serie-a|ligue-1|uefa/.test(family)?'football':family;
  if(sport==='rugby'&&/\b(?:rugby league|nrl|state of origin)\b/.test(title))return false;
  if(['nrl','nrlw'].includes(sport)&&/\b(?:rugby union|bledisloe|six nations)\b/.test(title))return false;
  const markers={football:/\b(?:football|soccer|fifa)\b/,cricket:/\b(?:cricket|icc|t20|odi)\b/,rugby:/\brugby\b/,baseball:/\b(?:baseball|mlb)\b/,nbl:/\bnbl\b/,nba:/\bnba\b/};
  return !Object.entries(markers).some(([other,pattern])=>other!==sport&&!(other==='rugby'&&['nrl','nrlw'].includes(sport))&&pattern.test(title));
}
const genericTeam=new Set(['united','city','town','rovers','athletic','fc','afc','cf','club','new','york','los','angeles','south','north','west','east','western','eastern','central','saint','st']);
function participantAliases(participant,event){
  const name=normal(participant.displayName||participant.name||participant.label),aliases=new Set([name,...(Array.isArray(participant.aliases)?participant.aliases.map(normal):[])]);
  // Use the existing reviewed identity catalogues, never fuzzy substrings.
  const catalogue=require('../config/team-follow-catalogue');
  const domain=/football|premier|fifa/.test(key(event))?'sport:football':/rugby/.test(key(event))?'sport:rugby':key(event)==='nbl'?'sport:nbl':'sport:'+key(event).replace(/w$/,'');
  const wantedGender=gender(event)==='women'?'female':'male';
  const candidates=catalogue.allTeams.filter(t=>(t.id===participant.id||t.sportDomainId===domain&&t.aliases.some(a=>normal(a)===name))&&(!t.gender||t.gender==='mixed'||t.gender===wantedGender));
  for(const team of candidates)for(const alias of [team.displayName,...team.aliases])aliases.add(normal(alias));
  if(domain==='sport:football'){
    const clubs=require('../data/canonical/football-directory.v1.json').teams;
    for(const team of clubs.filter(t=>t.id===participant.id||(t.aliases||[]).some(a=>normal(a)===name)))for(const alias of [team.displayName,team.shortName,...(team.aliases||[])])if(alias)aliases.add(normal(alias));
  }
  if(/rugby/.test(key(event))){
    if(['new zealand','all blacks'].includes(name)){aliases.add('new zealand');aliases.add('all blacks');}
    if(['australia','wallabies'].includes(name)){aliases.add('australia');aliases.add('wallabies');}
  }
  for(const alias of [...aliases]){
    const clean=alias.replace(/\b(?:women s|womens|women|men s|mens|men|fc|afc|cf)\b/g,'').replace(/\s+/g,' ').trim();aliases.add(clean);
    if(clean.includes('manchester'))aliases.add(clean.replace('manchester','man').replace('united','utd'));
    const words=clean.split(' '),last=words.at(-1);
    if(domain!=='sport:football'&&words.length>1&&!genericTeam.has(last)&&last.length>3)aliases.add(last);
    if(words.length===2&&genericTeam.has(last)&&!genericTeam.has(words[0])&&!['manchester','bristol','melbourne','sydney'].includes(words[0]))aliases.add(words[0]);
    if(/\bwhite sox\b/.test(clean))aliases.add('white sox');
    if(/\bred sox\b/.test(clean))aliases.add('red sox');
  }
  return [...aliases].filter(a=>a.length>=3&&!genericTeam.has(a));
}
function pair(event){
  const participants=(event.participants||[]).filter(p=>p.displayName||p.name||p.label);
  if(participants.length===2&&!racing.has(key(event)))return participants;
  if(!participants.length){const sides=String(event.name||'').split(/\s+v(?:s\.?)?\s+/i);if(sides.length===2)return sides.map(name=>({name:name.split(/\s+[—|·]/)[0]}));}
  return [];
}
function isReel(title){return /\b(day \d+|round \d+ roundup|round up|roundup|all matches|and more|compilation|weekend|day highlights|session highlights)\b/.test(normal(title));}
function pairedAliases(aliases,value){
  if(aliases.length!==2)return false;
  const text=normal(value),unique=aliases.map((side,index)=>side.filter(alias=>alias&&!aliases[1-index].includes(alias)));
  const paired=(left,right)=>unique[left].some(a=>unique[right].some(b=>new RegExp('(?:^| )'+a+' (?:v|vs|versus|at|faces|plays|meets|takes on|clashes with|\\d{1,2} \\d{1,2}) '+b+'(?: |$)').test(text)));
  return paired(0,1)||paired(1,0);
}
function locationAliases(event){
  const title=normal(event.name||event.tournamentName),base=title.replace(/\b(?:motogp|formula 1|f1|wrc|rallye?|20\d\d|r\d+)\b|\bround \d+\b/g,'').split(/\b(?:grand prix|gp|practice|qualifying|sprint|race|warm up)\b/)[0].replace(/\s+/g,' ').trim();
  const aliases=new Set([base]);
  if(['lemans','le-mans'].includes(key(event)))aliases.add('le mans');
  const groups=[['indonesia','indonesian','mandalika'],['japan','japanese'],['britain','british','silverstone'],['australia','australian'],['italy','italian'],['spain','spanish'],['austria','austrian','spielberg','red bull ring'],['brazil','brazilian'],['united states','united states of america','austin','americas','cota'],['saudi arabia','saudi arabian','jeddah'],['thailand','thai','buriram'],['argentina','argentine'],['france','french'],['germany','german'],['netherlands','dutch'],['czechia','czech','brno'],['hungary','hungarian'],['malaysia','malaysian','sepang'],['portugal','portuguese','portimao'],['belgium','belgian','spa francorchamps'],['canada','canadian','montreal'],['mexico','mexican'],['azerbaijan','azerbaijani','baku']];
  for(const group of groups)if(group.some(a=>contains(base,a)))for(const a of group)aliases.add(a);
  return [...aliases].filter(a=>a.length>2);
}
function matches(event,video){
  const title=normal(video.title),all=title+' '+normal(video.description),family=key(event);
  if(!genderMatches(event,title,all)||!datesMatch(event,video)||!roundMatches(event,title)||!competitionMatches(event,title))return false;
  const ageGroup=normal([event.name,event.competitionName,event.eventType].join(' ')).match(/\bu ?(\d{2})\b|\bunder (\d{2})\b/),videoGroup=title.match(/\bu ?(\d{2})\b|\bunder (\d{2})\b/);
  if(videoGroup&&(!ageGroup||(ageGroup[1]||ageGroup[2])!==(videoGroup[1]||videoGroup[2])))return false;
  if(ageGroup&&(!videoGroup||(ageGroup[1]||ageGroup[2])!==(videoGroup[1]||videoGroup[2])))return false;
  const reel=isReel(title);
  if(reel&&!/\b(day|matchweek|round|stage|session)\b/.test(title))return false;
  if(racing.has(family)){
    const wanted=session(event.stage||event.roundLabel||event.name)||'race',supplied=session(title);
    if(wanted==='race'&&supplied&&supplied!=='race'||wanted!=='race'&&wanted!==supplied)return false;
    if(family==='motogp'&&(!/\bmotogp\b/.test(title)||/\bmoto ?(?:2|3|e)\b/.test(title)))return false;
    if(family==='f1'&&/\b(?:f2|f3|formula 2|formula 3|f1 academy|formula e|motogp|moto2|moto3|supercars)\b/.test(title))return false;
    if(family==='supercars'&&/\b(?:f1|formula 1|motogp|moto2|moto3)\b/.test(title))return false;
    if(family==='wrc'&&(!/\b(?:wrc|rally|rallye)\b/.test(title)||/\b(?:f1|formula 1|motogp|supercars)\b/.test(title)))return false;
    if(['lemans','le-mans'].includes(family)&&/\b(?:f1|formula 1|motogp|moto2|moto3)\b/.test(title))return false;
    if(!locationAliases(event).some(alias=>contains(title,alias)))return false;
    return true;
  }
  const sides=pair(event),context=reel?all:title;
  if(sides.length===2){
    const aliases=sides.map(p=>participantAliases(p,event));
    if(!aliases.every((side,index)=>side.some(alias=>!aliases[1-index].includes(alias)&&contains(context,alias))))return false;
    if(reel&&!pairedAliases(aliases,context))return false;
    if(reel&&!roundMatches(event,title,{requireEvidence:true})&&!/\bday \d+\b/.test(title))return false;
    return true;
  }
  // Stages and rounds are separate cards. Require their known unit rather
  // than borrowing a whole-event recap for a particular stage/day.
  const units=normal([event.stage,event.roundLabel,event.name].join(' '));
  if(/\b(?:round|stage|day) \d+\b/.test(units)&&!roundMatches(event,title,{requireEvidence:true}))return false;
  if(['golf','masters'].includes(family)){
    const tournament=normal(event.tournamentName||String(event.name||'').split(/[—|·]/)[0]).replace(/\b20\d\d\b/g,'').replace(/\b(?:round|day) \d+\b/g,'').replace(/^the /,'').trim();
    const source=context.replace(/\bu s\b/g,'us');
    if(/^(?:the )?open(?: championship)?$/.test(tournament))return /\b(?:the open|open championship)\b/.test(source);
    return contains(source,tournament.replace(/\bu s\b/g,'us'));
  }
  const cycling={giro:/\bgiro(?: d italia)?\b/,tdf:/\btour de france\b/,vuelta:/\b(?:la )?vuelta\b/};
  if(cycling[family])return cycling[family].test(title);
  if(family==='horse-racing')return contains(context,normal(event.name).replace(/\b20\d\d\b/g,'').trim());
  const primary=normal(String(event.name||'').split(/[—|·]/)[0]);
  const anchors=terms(primary).filter(t=>!['sail','sailgp','freestyle','freeski','downhill','mtb','finals','opening','session'].includes(t));
  return anchors.length>0&&anchors.every(t=>contains(context,t));
}
module.exports={normal,key,matches,isReel,session,roundMatches,datesMatch,participantAliases,pairedAliases};
