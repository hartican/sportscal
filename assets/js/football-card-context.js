'use strict';
(function(){
const style=document.createElement('style');style.textContent='.football-match-context{padding:12px 0;border-top:1px solid var(--border);font-size:13px;text-align:left}.football-match-context h3{font-size:13px;margin:0 0 8px}.football-match-context ul{padding-left:18px;margin:0}.football-match-context li{margin:6px 0;overflow-wrap:anywhere}.football-match-context p{font-size:12px;line-height:1.5;color:var(--text-dim);margin:8px 0 0}';document.head.append(style);
function context(ev,showResults){
  const context=ev.footballMatchContext;
  if(!Number.isFinite(Date.parse(context?.checkedAt||''))||context?.schemaVersion!=='football-match-context.v1'||context.competitionId!==ev.competitionId||context.season!==ev.season||context.beforeKickoff!==ev.startTimeUtc||context.checkedAt!==ev.sourceCheckedAt||!Array.isArray(context.teams)||context.teams.length!==2)return null;
  const ids=ev.participantIds||[];
  if(new Set(context.teams.map(t=>t.participantId)).size!==2||context.teams.some(t=>!ids.includes(t.participantId)||!t.name||!['played','won','drawn','lost'].every(k=>Number.isSafeInteger(t[k])&&t[k]>=0)||t.played!==t.won+t.drawn+t.lost))return null;
  const section=document.createElement('section');section.className='football-match-context';section.dataset.cardArea='expanded-information';
  const heading=document.createElement('h3');heading.textContent='This competition · '+context.season;section.append(heading);
  const note=document.createElement('p');
  if(!showResults){note.textContent='Team records hidden while Results is off.';section.append(note);return section;}
  const list=document.createElement('ul');
  for(const team of context.teams){const row=document.createElement('li');row.textContent=team.played?`${team.name}: ${team.won}W · ${team.drawn}D · ${team.lost}L from ${team.played} ${team.played===1?'match':'matches'}`:`${team.name}: no earlier confirmed result in this league phase`;list.append(row);}
  note.textContent='Confirmed earlier matches only, as of the source check below. Excludes other competitions; not a prediction.';section.append(list,note);return section;
}

function attribution(ev){
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
globalThis.NOTHINGSPORTS_FOOTBALL_CONTEXT={context,attribution};
})();
