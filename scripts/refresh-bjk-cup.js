#!/usr/bin/env node
'use strict';
// Source adapter invoked by the canonical tournament hydration stage.
const fs=require('node:fs');
const BASE='https://www.billiejeankingcup.com';
const OUTPUT='data/canonical/tennis-team-contests.v1.json';
const FAMILY='billie-jean-king-cup';
const TOURNAMENT='tournament:tennis:bjk-cup-finals-2026';
const SCHEDULE=BASE+'/en/news/2026-bjk-cup-finals-where-you-can-watch-all-the-action';
const ARTICLES=['live-czechia-v-great-britain','live-kazakhstan-v-spain','live-ukr-v-bel','live-ita-v-chn'].map(s=>BASE+'/en/news/'+s+'-2026-billie-jean-king-cup-finals-quarter-final');
const COUNTRIES={CZE:['Czechia','CZ'],GBR:['Great Britain','GB'],ESP:['Spain','ES'],KAZ:['Kazakhstan','KZ'],UKR:['Ukraine','UA'],BEL:['Belgium','BE'],CHN:['China','CN'],ITA:['Italy','IT']};
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const teamId=name=>'team:tennis:bjk-cup:'+slug(name);
const text=node=>node?.value??(node?.content||[]).map(text).join('');
function article(html){
 const blocks=[],titles=[],links=new Set();
 function walk(o){if(!o||typeof o!=='object')return;
  if(o.nodeType&&/^(paragraph|heading-\d)$/.test(o.nodeType)){blocks.push(text(o).replace(/\s+/g,' ').trim());return;}
  if(typeof o.title==='string')titles.push(o.title);
  for(const v of Object.values(o))if(typeof v==='object')walk(v);
 }
 for(const m of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g))try{
  const payload=JSON.parse(m[1])[1];if(typeof payload!=='string')continue;
  for(const line of payload.split('\n'))try{walk(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}
  for(const x of payload.matchAll(/(?:https:\/\/www\.billiejeankingcup\.com)?\/en\/news\/([a-z0-9-]+)/g))links.add(BASE+'/en/news/'+x[1]);
 }catch{}
 return {blocks:[...new Set(blocks)],titles:[...new Set(titles)],links:[...links]};
}
function local(iso){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).reduce((r,p)=>(r[p.type]=p.value,r),{});return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};}
function parseSchedule(doc,checkedAt){
 const fixtures=[];let date=null,inSchedule=false;
 for(const line of doc.blocks){
  if(/2026 Billie Jean King Cup Finals Schedule|2026 BJK Cup Finals Schedule/.test(line))inSchedule=true;
  if(!inSchedule)continue;
  const day=line.match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d+) September$/);
  if(day){date=`2026-09-${day[1].padStart(2,'0')}`;continue;}
  const q=line.match(/^(.+?) v (.+?) \((not before )?(\d\d:\d\d)\) [–-] Quarter-final ([1-4])$/);
  const later=line.match(/^(Semi-final ([12])|Final) \((\d\d:\d\d)\)/);
  if(!q&&!later)continue;if(!date)throw new Error('BJK schedule has no date');
  const slot=q?'qf'+q[5]:later[2]?'sf'+later[2]:'final';
  const labels=q?[q[1],q[2]]:slot==='sf1'?['Winner Quarter-final 1','Winner Quarter-final 2']:slot==='sf2'?['Winner Quarter-final 3','Winner Quarter-final 4']:['Winner Semi-final 1','Winner Semi-final 2'];
  const startTimeUtc=new Date(`${date}T${q?q[4]:later[3]}:00+08:00`).toISOString();
  const id=`fixture:tennis:bjk-cup:2026:finals:${slot}`;
  fixtures.push({id,eventId:id,key:'tennis',sport:'Tennis',sportDomainId:'sport:tennis',competitionId:'competition:billie-jean-king-cup',eventFamilyId:FAMILY,tournamentId:TOURNAMENT,tournamentName:'Billie Jean King Cup Finals',tour:'TEAM',contestUnit:'tie',gender:'women',season:2026,bracketSlot:slot,name:labels.join(' v '),roundLabel:q?'Quarterfinal':later[2]?'Semifinal':'Final',round:q?'Quarterfinal':later[2]?'Semifinal':'Final',status:'upcoming',participantSlots:labels.map((label,i)=>({slot:i+1,label,participantId:q?teamId(label):null})),participantIds:q?labels.map(teamId):[],sourceName:'Billie Jean King Cup',sourceType:'official',sourceUrl:SCHEDULE,sourceCheckedAt:checkedAt,venue:'Shenzhen Bay Sports Centre Arena',venueCountryCode:'CN',broadcaster:'Nine / beIN Sports',expected:7,startTimeUtc,...local(startTimeUtc),timePrecision:q?.[3]?'not-before':'exact',scheduleStatus:'confirmed',rubbers:[1,2,3].map(order=>({id:`${id}:rubber:${order}`,parentTieId:id,contestUnit:'rubber',order,matchType:order===3?'Doubles':'Singles',name:order===3?'Doubles (if required)':`Singles ${order}`,status:'unconfirmed',conditional:order===3,participantIds:[],sides:[]}))});
 }
 if(fixtures.length!==7||new Set(fixtures.map(f=>f.id)).size!==7)throw new Error('BJK schedule must contain all seven distinct ties');
 return fixtures;
}
function parseRubbers(doc,url,checkedAt){
 return doc.blocks.filter(line=>/^Match [123]:/.test(line)).map(line=>{
  const order=Number(line.match(/^Match (\d)/)[1]);
  const m=line.match(/^Match [123]:\s*(.+?)\s*\(([A-Z]{3})\)\s+(d\.?|def\.?|v\.?|vs\.?)\s+(.+?)\s*\(([A-Z]{3})\)\s*(.*)$/);
  if(!m||!COUNTRIES[m[2]]||!COUNTRIES[m[5]])return null;
  const completed=/^d/.test(m[3]),score=m[6].trim();
  if(completed&&!/^\d+-\d+/.test(score))return null;
  const side=(name,code)=>({countryCode:COUNTRIES[code][1],teamId:teamId(COUNTRIES[code][0]),names:name.split(/\s*\/\s*/),participantIds:name.split(/\s*\/\s*/).map(n=>'competitor:tennis:wta:'+slug(n))});
  return {order,matchType:order===3?'Doubles':'Singles',status:completed?'completed':'upcoming',sides:[side(m[1],m[2]),side(m[4],m[5])],...(completed?{score,winnerTeamId:teamId(COUNTRIES[m[2]][0])}:{}),sourceUrl:url,sourceCheckedAt:checkedAt};
 }).filter(Boolean);
}
function applyArticles(fixtures,documents,prior=[]){
 const old=new Map(prior.map(f=>[f.id,f]));
 for(const f of fixtures){const previous=old.get(f.id);if(previous)f.rubbers=(previous.rubbers||f.rubbers).map(r=>({...r,status:r.status==='not-required'?'unconfirmed':r.status}));}
 // Resolve each bracket round before matching its reports. A report is only
 // attached when its two nation identities match a known tie in that round.
 for(const round of ['Quarterfinal','Semifinal','Final']){
  for(const f of fixtures.filter(f=>f.roundLabel===round)){
   if(f.bracketSlot.startsWith('sf')||f.bracketSlot==='final'){
    const sources=f.bracketSlot==='sf1'?['qf1','qf2']:f.bracketSlot==='sf2'?['qf3','qf4']:['sf1','sf2'];
    f.progressionSlots=sources;f.spoilerSafeTitle=f.participantSlots.map(s=>s.label).join(' v ');
    f.participantSlots=f.participantSlots.map((s,i)=>{const prev=fixtures.find(x=>x.bracketSlot===sources[i]);const pid=prev?.winnerParticipantId;return pid?{...s,participantId:pid,label:Object.values(COUNTRIES).find(([name])=>teamId(name)===pid)?.[0]||s.label}:s;});
    f.participantIds=f.participantSlots.map(s=>s.participantId).filter(Boolean);f.name=f.participantSlots.map(s=>s.label).join(' v ');
   }
   for(const {doc,url,checkedAt}of documents){
    const kind=/quarter-final/i.test(url)?'Quarterfinal':/semi-final/i.test(url)?'Semifinal':/final/i.test(url)?'Final':null;
    if(kind!==round)continue;
    const rows=parseRubbers(doc,url,checkedAt).filter(r=>r.sides.every(s=>f.participantIds.includes(s.teamId))&&f.participantIds.length===2);
    for(const r of rows){const index=r.order-1,previous=f.rubbers[index];if(previous.status==='completed'&&r.status!=='completed')continue;f.rubbers[index]={...previous,...r,name:[...r.sides].sort((a,b)=>f.participantIds.indexOf(a.teamId)-f.participantIds.indexOf(b.teamId)).map(s=>s.names.join(' / ')).join(' v '),participantIds:r.sides.flatMap(s=>s.participantIds)};}
   }
   const wins=f.participantSlots.map(s=>f.rubbers.filter(r=>r.status==='completed'&&r.winnerTeamId===s.participantId).length);
   if(wins.some(Boolean)&&Math.max(...wins)<2){f.status='live';f.score=wins.join('-');}
   if(Math.max(...wins)>=2){
    const winner=wins[0]>=2?0:1;f.status='completed';f.score=wins.join('-');f.winnerParticipantId=f.participantSlots[winner].participantId;f.eliminatedParticipantIds=[f.participantSlots[1-winner].participantId];
    const last=f.rubbers.filter(r=>r.status==='completed').at(-1);f.resultSourceUrl=last.sourceUrl;f.resultSourceCheckedAt=last.sourceCheckedAt;
    f.result={status:'official',score:f.score,sourceUrl:last.sourceUrl,checkedAt:last.sourceCheckedAt};f.outcomeText=`${f.participantSlots[winner].label} won ${wins[winner]}–${wins[1-winner]}`;f.recapText='Official Billie Jean King Cup result.';
    if(f.rubbers[2].status!=='completed')f.rubbers[2]={...f.rubbers[2],status:'not-required'};
   }
  }
 }
 return fixtures;
}
const semantic=value=>JSON.stringify(value,(k,v)=>/^(sourceCheckedAt|resultSourceCheckedAt|checkedAt|generatedAt)$/.test(k)?undefined:v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
async function refresh({fetchImpl=fetch,now=new Date(),output=OUTPUT}={}){
 const checkedAt=now.toISOString(),cache=new Map(),failures=[];
 async function get(url){if(!cache.has(url))cache.set(url,(async()=>{const r=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return article(await r.text());})());return cache.get(url);}
 const schedule=await get(SCHEDULE),previous=JSON.parse(fs.readFileSync(output));
 const fixtures=parseSchedule(schedule,checkedAt),urls=new Set(ARTICLES);
 try{for(const url of (await get(BASE+'/en/news')).links)if(/2026/.test(url)&&/final/.test(url)&&/live-|as-it-happened/.test(url))urls.add(url);}catch(e){failures.push({source:BASE+'/en/news',error:e.message});}
 const documents=[];
 for(const url of [...urls].slice(0,16))try{const doc=await get(url);if(!doc.blocks.length)throw new Error('Article body missing');const parsedOrders=new Set(parseRubbers(doc,url,checkedAt).map(r=>r.order));
  for(const heading of doc.blocks.filter(b=>/^Match [123]:/.test(b)))if(!/^Match [123]:\s*\((Singles|Doubles)\)\s*$/i.test(heading)&&!parsedOrders.has(Number(heading.match(/^Match (\d)/)[1])))failures.push({source:url,error:'Unparsed published match heading'});
  documents.push({doc,url,checkedAt});}catch(e){failures.push({source:url,error:e.message});}
 applyArticles(fixtures,documents,previous.fixtures.filter(f=>f.tournamentId===TOURNAMENT));
 const teams=Object.values(COUNTRIES).map(([name,countryCode])=>({id:teamId(name),type:'team',displayName:name,name,sportDomainId:'sport:tennis',countryCode,genderCategory:'women',sourceUrl:SCHEDULE,sourceRefs:[SCHEDULE]}));
 for(const f of fixtures)f.participants=f.participantIds.map(id=>teams.find(t=>t.id===id)).filter(Boolean);
 const next={...previous,participants:[...previous.participants.filter(t=>!t.id.startsWith('team:tennis:bjk-cup:')), ...teams],fixtures:[...previous.fixtures.filter(f=>f.tournamentId!==TOURNAMENT),...fixtures]};
 const changed=semantic(next)!==semantic(previous);if(changed)fs.writeFileSync(output,JSON.stringify(next,null,2)+'\n');
 return {changed,code:'tennis',fixtures:fixtures.length,failures};
}
module.exports={article,parseSchedule,parseRubbers,applyArticles,refresh,local,semantic,TOURNAMENT,SCHEDULE,teamId};
