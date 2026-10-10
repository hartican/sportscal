'use strict';
(function(){
const style=document.createElement('style');style.textContent='.football-card-standings{background:rgba(255,255,255,.88);color:#182330;padding:12px;border-radius:12px;font-size:13px;text-align:left}.football-card-standings h3{font-size:13px;color:#182330;margin:0 0 8px}.football-card-standings ul{padding-left:18px}.football-card-standings p{font-size:12px;line-height:1.5;color:#455466}.football-card-standings a{color:#224f78}.football-card-standings .btn{color:#182330;background:transparent;border-color:#7c8794;margin:8px 0 0} .football-match-context{padding:12px;background:rgba(255,255,255,.88);color:#182330;border-radius:12px;font-size:13px;text-align:left;margin:8px 0}.football-match-context h3{font-size:13px;margin:0 0 8px}.football-match-context ul{padding-left:18px;margin:0}.football-match-context li{margin:6px 0;overflow-wrap:anywhere}.football-match-context p{font-size:12px;line-height:1.5;color:#455466;margin:8px 0 0}';document.head.append(style);
function context(ev,showResults){
  const nbl=ev.teamMatchContext?.schemaVersion==='nbl-match-context.v1'&&ev.competitionId==='competition:nbl';
  const context=nbl?ev.teamMatchContext:ev.footballMatchContext;
  if(!Number.isFinite(Date.parse(context?.checkedAt||''))||context?.schemaVersion!==(nbl?'nbl-match-context.v1':'football-match-context.v1')||context.competitionId!==ev.competitionId||context.season!==ev.season||context.beforeKickoff!==ev.startTimeUtc||(nbl&&context.checkedAt!==ev.sourceCheckedAt)||Date.parse(context.checkedAt)>Date.now()+60000||!Array.isArray(context.teams)||context.teams.length!==2)return null;
  const ids=ev.participantIds||[];
  if(new Set(context.teams.map(t=>t.participantId)).size!==2||context.teams.some(t=>!ids.includes(t.participantId)||!t.name||!(nbl?['played','won','lost']:['played','won','drawn','lost']).every(k=>Number.isSafeInteger(t[k])&&t[k]>=0)||t.played!==t.won+(nbl?0:t.drawn)+t.lost))return null;
  const section=document.createElement('section');section.className='football-match-context';section.dataset.cardArea='expanded-information';
  const heading=document.createElement('h3');heading.textContent=(nbl?'Before this game · NBL regular season · ':'This competition · ')+context.season;section.append(heading);
  const note=document.createElement('p');
  if(!showResults){note.textContent='Team records hidden while Results is off.';section.append(note);return section;}
  const list=document.createElement('ul');
  for(const team of context.teams){const row=document.createElement('li');row.textContent=team.played?`${team.name}: ${team.won}W · ${nbl?'':team.drawn+'D · '}${team.lost}L from ${team.played} ${nbl?(team.played===1?'game':'games'):(team.played===1?'match':'matches')}`:`${team.name}: no earlier confirmed result in this ${nbl?'regular season':'league phase'}`;list.append(row);}
  note.textContent=nbl?'Confirmed earlier regular-season games only. Excludes this game, preseason and finals; not a ladder or prediction. Source checked '+new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney',timeZoneName:'short'}).format(new Date(context.checkedAt))+'.':'Confirmed earlier matches only. Excludes other competitions; not a prediction. Context checked '+new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(context.checkedAt))+' (Sydney).';section.append(list,note);return section;
}

function primaryAttribution(ev){
  if(ev.sourceAttribution?.provider!=='OpenLigaDB')return null;
  const note=document.createElement('div');note.className='fixture-source-attribution';
  const context=document.createElement('p');context.className='fixture-source-context';
  const matchday=Number(ev.roundNumber);
  if(ev.stage==='League phase'&&Number.isInteger(matchday)&&matchday>=1&&matchday<=8)context.textContent=`League phase · Matchday ${matchday}`;
  if(context.textContent)note.append(context);
  const checked=new Date(ev.sourceCheckedAt||'');
  if(Number.isFinite(checked.getTime())){
    const freshness=document.createElement('p');freshness.className='fixture-source-freshness';
    const time=document.createElement('time');time.dateTime=checked.toISOString();
    time.textContent=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Australia/Sydney',timeZoneName:'short'}).format(checked);
    freshness.append(document.createTextNode('Source checked '),time);note.append(freshness);
  }
  const links=document.createElement('p');links.className='fixture-source-links';
  links.append(document.createTextNode('Data: '));
  for(const [label,href] of [['OpenLigaDB','https://www.openligadb.de/'],['ODbL','https://opendatacommons.org/licenses/odbl/1-0/'],['Dataset','/data/providers/openligadb/football-2026-27.json']]){
    if(links.children.length)links.append(document.createTextNode(' · '));
    const link=document.createElement('a');link.textContent=label;link.href=href;link.target='_blank';link.rel='noopener';link.addEventListener('click',event=>event.stopPropagation());links.append(link);
  }
  note.append(links);return note;
}
function attribution(ev){
  const primary=primaryAttribution(ev);if(!ev.delayedResultSource)return primary;
  const wrapper=document.createElement('div');wrapper.className='fixture-source-attribution';if(primary)wrapper.append(primary);
  const note=document.createElement('p'),link=document.createElement('a');link.href='https://www.football-data.org/';link.textContent='Football data provided by the Football-Data.org API';link.target='_blank';link.rel='noopener';link.onclick=e=>e.stopPropagation();
  note.append(link,document.createTextNode('. Delayed final result; primary source unavailable at recovery.'));
  const checked=new Date(ev.delayedResultSource.updatedAt);if(Number.isFinite(checked.getTime()))note.append(document.createTextNode(' Result source updated '+new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(checked)+'.'));
  wrapper.append(note);return wrapper;
}
let tableDocument=null,tableLoading=null;
async function standings(ev){
 if(!['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'].includes(ev.competitionId))return null;
 const section=document.createElement('section');section.className='football-card-standings';section.dataset.cardArea='expanded-information';
 const heading=document.createElement('h3');heading.textContent=ev.competitionName+' · published standings';section.append(heading);
 const full=document.createElement('button');full.type='button';full.className='btn ghost';full.textContent='View competition standings';full.onclick=async()=>{await loadDeferredScript('assets/js/follow-navigation.js?v=463');NOTHINGSPORTS_FOLLOW_NAV.setFilter('sport:football','competition',[ev.competitionId]);activeTab='follow';followHomeView='browse';saveFollowBrowse({sportId:'sport:football',categoryId:'',section:'standings',scheduleScope:null});renderAll();};
 const paint=async()=>{
  section.replaceChildren(heading);
  if(!userPreferences.showSpoilers){const note=document.createElement('p');note.textContent='Standings hidden while Results is off.';section.append(note,full);return;}
  try{const doc=codeInspectorChunk?.code?.id==='sport:football'?codeInspectorChunk:tableDocument||(await(tableLoading||=(fetchJson('data/code-inspector/football.json',{cache:'default'}).then(d=>{if(d.code?.id!=='sport:football'||!Array.isArray(d.standings))throw Error('Invalid table document');return tableDocument=d;}).finally(()=>tableLoading=null))));
   if(!userPreferences.showSpoilers){await paint();return;}
   const rows=doc.standings.filter(r=>r.competitionId===ev.competitionId&&(ev.participantIds||[]).includes(r.participantId));
   if(!rows.length)throw Error('No published table rows');
   if(rows.some(row=>row.stale)){const warning=document.createElement('p');warning.className='standings-stale-note';warning.textContent=rows.find(row=>row.stale)?.staleNote||'Table awaits primary-source confirmation.';section.append(warning);}
   const list=document.createElement('ul');for(const r of rows){const row=document.createElement('li');row.textContent=NOTHINGSPORTS_FEED_CARD_PRESENTATION.standingPosition(r)+' · '+r.displayName+' · '+r.played+' played · '+r.ladderPoints+' pts';list.append(row);}section.append(list);
   const note=document.createElement('p'),checked=rows.map(r=>r.asOf).filter(Boolean).sort().at(-1);note.className='standings-source-note';note.textContent=(rows[0].tableNote||'')+(checked?' Table checked '+new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(checked))+' (Sydney).':'');section.append(note);
   if(/^https:\/\//.test(rows[0].sourceUrl||'')){const link=document.createElement('a');link.href=rows[0].sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Standings source';section.append(link);}
  }catch{const note=document.createElement('p');note.textContent='Standings unavailable.';const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Retry standings';retry.onclick=paint;section.append(note,retry);}
  section.append(full);
 };await paint();return section;
}
globalThis.NOTHINGSPORTS_FOOTBALL_CONTEXT={context,attribution,standings};
})();
