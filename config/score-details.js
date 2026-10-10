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
function styles(){if(document.querySelector?.('[data-score-details-style]'))return;const link=node('link');link.rel='stylesheet';link.href='assets/styles/score-details.css?v=486';link.dataset.scoreDetailsStyle='';document.head?.append(link);}
function cricket(innings,{selectedInnings,fixtureId,stale=false}={}){
 styles();
 const root=node('div',null,'full-cricket-scorecard');if(!innings?.length)return root;
 const choose=node('select'),label=node('label','Innings '),content=node('div');choose.setAttribute('aria-label','Scorecard innings');
 for(const i of innings){const o=node('option',`${i.team||'Innings'} · ${i.inningNumber||''}`);o.value=String(i.inningNumber);choose.append(o);}choose.value=String(selectedInnings||selections.get(fixtureId)||innings.at(-1).inningNumber);label.append(choose);root.append(label,content);
 function render(){if(fixtureId)selections.set(fixtureId,choose.value);const i=innings.find(i=>String(i.inningNumber)===choose.value)||innings.at(-1),title=`${i.team||'Innings'} · innings ${i.inningNumber||''}`;content.replaceChildren();
  const notes=[i.isDeclared?'Declared':null,i.isFollowOn?'Follow-on':null,i.isForfeited?'Forfeited':null].filter(Boolean).join(' · ');
  const total=`${i.runs??i.runsScored??'—'}/${i.wicketsCount??i.numberOfWicketsFallen??(typeof i.wickets==='number'?i.wickets:'—')} (${i.overs??i.oversBowled??'—'} overs)${notes?' · '+notes:''}`;table(content,'Total · '+title,[['Innings','total']],[{total}]);
  const batting=i.batting||[],bowling=i.bowling||[];
  table(content,'Batting · '+title,[['Batsman','name'],['Dismissal','dismissal'],['R','runs'],['B','balls'],['4s','fours'],['6s','sixes'],['SR','strikeRate']],batting);
  if(!batting.length)content.append(node('p','Batting details unavailable.'));
  if(i.extras)table(content,'Extras',[['Total','total'],['Byes','byes'],['Leg byes','legByes'],['Wides','wides'],['No balls','noBalls'],['Penalty','penalties']],[i.extras]);
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
 if(!slot.isConnected||!visible())return;
 if(ev.key==='cricket'){
  if(ev.cricketBalance)slot.append(node('p',ev.cricketBalance));
  if(ev.restartTimeUtc)slot.append(node('p','Play resumes '+new Date(ev.restartTimeUtc).toLocaleString('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit',timeZoneName:'short'})));
  slot.append(cricket(ev.innings,{fixtureId:String(ev.canonicalEventId||ev.eventId||ev.id),stale:ev.sourceStale===true}));
  const id=[ev.canonicalEventId,ev.eventId,ev.id,...(ev.sourceEventIds||[])].map(v=>String(v||'').match(/(?:^|:)CA:(\d+)$/)?.[1]).find(Boolean);
  if(id){const a=node('a','Official scorecard');a.href='https://www.cricket.com.au/matches/CA%3A'+id;a.target='_blank';a.rel='noopener noreferrer';slot.append(a);}
 }else slot.append(football(ev.incidents||ev.goalScorers));
}
return {cricket,football,incidents,feed,styles};
});
