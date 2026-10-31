(function(root,factory){const api=factory();root.NOTHINGSPORTS_SCORE_DETAILS=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
function table(parent,title,columns,rows){
 if(!rows?.length)return;
 const wrap=node('div',null,'scorecard-table-wrap'),t=node('table',null,'scorecard-table');wrap.tabIndex=0;wrap.setAttribute('aria-label',title);t.append(node('caption',title));
 const head=node('thead'),h=node('tr');for(const [label] of columns){const c=node('th',label);c.scope='col';h.append(c);}head.append(h);t.append(head);
 const body=node('tbody');for(const row of rows){const tr=node('tr');columns.forEach(([,key],index)=>{const c=node(index?'td':'th',row[key]??'—');if(!index)c.scope='row';tr.append(c);});body.append(tr);}t.append(body);wrap.append(t);parent.append(wrap);
}
const selections=new Map();
function inningsTitles(innings){
 const counts=new Map(),titles=new Map();let complete=true;
 for(const [index,i] of innings.slice().sort((a,b)=>a.inningNumber-b.inningNumber).entries()){
  const id=i.participantId??i.battingTeamId;complete=complete&&i.inningNumber===index+1&&id!=null;
  const n=(counts.get(id)||0)+1;counts.set(id,n);
  const ordinal=complete?(['1st','2nd','3rd','4th'][n-1]+' '):'';
  titles.set(i,`${String(i.team||'Team').replace(/\s+Men$/i,'')} — ${ordinal}innings${i.isFollowOn?' · following on':''}`);
 }return titles;
}
function battingGroups(rows){
 const batting=[],groups=new Map();
 for(const [index,row] of rows.entries()){
  const status=String(row.dismissalType||row.dismissal||'').replace(/[\s_-]/g,'').toLowerCase();
  const group=status==='yettobat'?'Yet to bat':status==='didnotbat'||!status&&row.didNotBat?'Did not bat':status==='absenthurt'?'Absent hurt':status==='absent'?'Absent':null;
  if(!group){batting.push(row);continue;}
  if(!groups.has(group))groups.set(group,[]);groups.get(group).push({row,index});
 }
 return {batting,groups:[...groups].map(([label,entries])=>({label,rows:entries.sort((a,b)=>(a.row.sourceOrder??a.index)-(b.row.sourceOrder??b.index)).map(e=>e.row)}))};
}
function styles(){if(document.querySelector?.('[data-score-details-style]'))return;const link=node('link');link.rel='stylesheet';link.href='assets/styles/score-details.css?v=582';link.dataset.scoreDetailsStyle='';document.head?.append(link);}
function cricket(innings,{selectedInnings,fixtureId,stale=false}={}){
 styles();
 const root=node('div',null,'full-cricket-scorecard');if(!innings?.length)return root;
 const choose=node('select'),label=node('label','Innings '),content=node('div');choose.setAttribute('aria-label','Scorecard innings');
 const chronological=innings.slice().sort((a,b)=>a.inningNumber-b.inningNumber),titles=inningsTitles(innings);
 for(const i of chronological){const o=node('option',titles.get(i));o.value=String(i.inningNumber);choose.append(o);}const selected=String(selectedInnings||selections.get(fixtureId)||chronological.at(-1).inningNumber);choose.value=chronological.some(i=>String(i.inningNumber)===selected)?selected:String(chronological.at(-1).inningNumber);label.append(choose);root.append(label,content);
 function render(){if(fixtureId)selections.set(fixtureId,choose.value);const i=innings.find(i=>String(i.inningNumber)===choose.value)||chronological.at(-1),title=titles.get(i);content.replaceChildren();
  const notes=[i.isDeclared?'Declared':null,i.isForfeited?'Forfeited':null].filter(Boolean).join(' · ');
  const total=`${i.runs??i.runsScored??'—'}/${i.wicketsCount??i.numberOfWicketsFallen??(typeof i.wickets==='number'?i.wickets:'—')} (${i.overs??i.oversBowled??'—'} overs)${notes?' · '+notes:''}`;table(content,'Total · '+title,[['Innings','total']],[{total}]);
  const {batting,groups}=battingGroups(i.batting||[]),bowling=i.bowling||[];
  table(content,'Batting · '+title,[['Batsman','name'],['Dismissal','dismissal'],['R','runs'],['B','balls'],['4s','fours'],['6s','sixes'],['SR','strikeRate']],batting);
  if(!batting.length)content.append(node('p','Batting details unavailable.'));
  for(const group of groups){const section=node('section',null,'scorecard-player-group'),list=node('ul');section.append(node('h4',group.label));list.setAttribute('aria-label',group.label);for(const row of group.rows)list.append(node('li',row.name));section.append(list);content.append(section);}
  if(i.extras)table(content,'Extras · '+title,[['Total','total'],['Byes','byes'],['Leg byes','legByes'],['Wides','wides'],['No balls','noBalls'],['Penalty','penalties']],[i.extras]);
  table(content,'Bowling · '+title,[['Bowler','name'],['O','overs'],['M','maidens'],['R','runs'],['W','wickets'],['Econ','economy'],['Wd','wides'],['NB','noBalls']],bowling);
  if(!bowling.length)content.append(node('p','Bowling details unavailable.'));
  table(content,'Fall of wickets · '+title,[['Batsman','name'],['Wicket','wicket'],['Score','runs'],['Over','overs']],i.fallOfWickets|| (Array.isArray(i.wickets)?i.wickets:[]));
  if(i.detailCheckedAt){const date=new Date(i.detailCheckedAt);content.append(node('small',(i.detailStale||stale?'Last available scorecard':'Scorecard source update')+' · '+date.toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'})));}
 }
 choose.addEventListener('change',render);choose.addEventListener('click',e=>e.stopPropagation());render();return root;
}
function incidents(rows){return (Array.isArray(rows)?rows:[]).filter(i=>i&&typeof i==='object'&&i.disallowed!==true&&i.isDisallowed!==true&&i.cancelled!==true&&!/disallow|overturn|cancel/i.test(i.type||'')).slice(0,40).map(i=>{
 const minute=i.minute??i.elapsedMinute??i.time??i.clock,added=i.addedTime??i.stoppageTime;
 const time=typeof minute==='number'&&Number.isFinite(minute)?String(minute)+(Number(added)>0?'+'+added:'')+'′':typeof minute==='string'&&/^\d{1,3}(?:\+\d{1,2})?[′']?$/.test(minute)?minute.replace(/[′']$/,'')+'′':null;
 return {name:i.name||i.playerName||i.scorer?.name|| (typeof i.scorer==='string'?i.scorer:null),time,type:i.ownGoal===true||i.goalType==='own-goal'?'Own goal':i.penalty===true||i.goalType==='penalty'?'Penalty':i.type||'Goal',team:i.teamName||i.team?.name||null};});}
function football(rows){styles();const root=node('div',null,'football-goal-details');const list=incidents(rows);if(list.length)table(root,'Goals',[['Scorer','name'],['Game minute','time'],['Type','type'],['Team','team']],list);return root;}
function feed(slot,ev,visible){
 if(!slot.isConnected||ev.key!=='horse-racing'&&!visible())return;
 if(/^(f1|supercars|motogp|wrc|horse-racing)$/.test(ev.key)){slot.classList.add('fixture-racing-details');void loadDeferredScript('config/match-centre.js?v=605').then(()=>loadDeferredScript('config/racing-details.js?v=527')).then(()=>NOTHINGSPORTS_RACING_DETAILS.mount(slot,ev,{visible:()=>slot.isConnected&&(ev.key==='horse-racing'||visible()),resultsVisible:visible,followed:entry=>cardIdentityParticipants().some(p=>entry.drivers?.includes(p.displayName||p.name)&&cachedParticipantFollow(p.id).followed)})).catch(()=>{if(slot.isConnected&&visible())slot.textContent='Racing detail unavailable.';});return;}
 if(ev.key==='cricket'){
  slot.append(cricket(ev.innings,{fixtureId:String(ev.canonicalEventId||ev.eventId||ev.id),stale:ev.sourceStale===true}));
  const id=[ev.canonicalEventId,ev.eventId,ev.id,...(ev.sourceEventIds||[])].map(v=>String(v||'').match(/(?:^|:)CA:(\d+)$/)?.[1]).find(Boolean);
  if(id){const a=node('a','Official scorecard');a.href='https://www.cricket.com.au/matches/CA%3A'+id;a.target='_blank';a.rel='noopener noreferrer';slot.append(a);}
 }else {slot.append(football(ev.incidents||ev.goalScorers));if(ev.scorecardUrl&&/^https:\/\//.test(ev.scorecardUrl)){const a=node('a','Source scorecard');a.href=ev.scorecardUrl;a.target='_blank';a.rel='noopener noreferrer';slot.append(a);}if(ev.goalDetailsCheckedAt)slot.append(node('small',(ev.goalDetailsStale?'Last available goal details':'Goal details source update')+' · '+new Date(ev.goalDetailsCheckedAt).toLocaleString('en-AU',{timeZone:'Australia/Sydney',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})));}
}
return {cricket,football,incidents,feed,styles,inningsTitles,battingGroups};
});
