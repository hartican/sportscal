(function(root,factory){const api=factory(typeof module==='object'?require('./match-centre'):root.NOTHINGSPORTS_MATCH_CENTRE);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_FEED_LIVE_SCORES=api;})(typeof globalThis==='object'?globalThis:this,function(model){
 'use strict';
 function presentation(event,{resultsOn=false,now=Date.now(),label=id=>id}={}){
  // Feed admission is owned by the host. MC's public catalogue boundary must
  // not hide an already admitted legacy fixture's sourced score.
  if(!resultsOn||!model.supported(event,{catalogue:false}))return null;
  const snapshot=model.compact(event),score=snapshot.score;
  const name=id=>(event.participants||[]).find(p=>p.id===id)?.displayName||(event.participantSlots||[]).find(s=>s.participantId===id)?.label||label(id);
  let text='';
  if(score.innings?.length)text=score.innings.map(i=>`${i.team||name(i.participantId)||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · ');
  else if(score.sets?.length||score.games){const sides=[snapshot.homeParticipantId,snapshot.awayParticipantId].map(id=>id&&name(id));text=(sides.every(Boolean)?sides.join(' / ')+': ':'')+(score.sets||[]).map(s=>`${s.home??'—'}–${s.away??'—'}`).join('  ')+(score.games?` · Games ${score.games.home??'—'}–${score.games.away??'—'}`:'');}
  else if(score.home!=null&&score.away!=null){const home=`${snapshot.homeParticipantId&&name(snapshot.homeParticipantId)||'Home'} ${score.home}`,away=`${snapshot.awayParticipantId&&name(snapshot.awayParticipantId)||'Away'} ${score.away}`;text=snapshot.sport==='ice-hockey'&&event.participantSlots?.[0]?.homeAway==='away'?`${away} · ${home}`:`${home} · ${away}`;}
  if(!text)return null;
  const stamp=Date.parse(snapshot.scoreCheckedAt||(event.fixtureObservationSchema?null:snapshot.checkedAt)||''),observed=Number.isFinite(stamp)&&stamp<=now,settled=model.final(event),fresh=observed&&now-stamp<=model.interval(event,now)*2&&!event.stale;
  const status=settled?'Finished':fresh&&/^(live|in-progress)$/.test(event.status)?'Live':model.interrupted(event)?String(event.status).replace(/-/g,' '):'Last available score';
  return {text,status,stale:Boolean(event.stale)||(!settled&&!fresh),checkedAt:observed?new Date(stamp).toISOString():null};
 }
 function install(card,event,options){
  card.querySelector('.feed-live-score')?.remove();
  if(card.querySelector('.card-result-line'))return;
  const value=presentation(event,options);if(!value)return;
  if(!document.querySelector('[data-feed-score-style]')){const style=document.createElement('style');style.dataset.feedScoreStyle='';style.textContent='.feed-live-score{grid-column:1/-1;padding:8px 12px;margin:0;font-size:.76rem;line-height:1.5;overflow-wrap:anywhere}.feed-live-score small{display:block;color:var(--text-dim);font-size:.66rem}';document.head.append(style);}
  const row=document.createElement('div');row.className='feed-live-score';row.dataset.fixtureScoreId=model.id(event);
  const score=document.createElement('strong');score.textContent=value.text;
  const detail=document.createElement('small');detail.textContent=[value.status,value.stale?'Update needed':''].filter(Boolean).join(' · ');
  detail.append(' · ');
  if(value.checkedAt){const time=document.createElement('time');time.dateTime=value.checkedAt;time.textContent='Checked '+new Date(value.checkedAt).toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});detail.append(time);}
  else detail.append(value.status==='Finished'?'Source date unavailable':'Awaiting source update');
  row.append(score,detail);card.append(row);
 }
 return {presentation,install};
});
