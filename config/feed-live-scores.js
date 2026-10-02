(function(root,factory){const api=factory(typeof module==='object'?require('./match-centre'):root.NOTHINGSPORTS_MATCH_CENTRE);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_FEED_LIVE_SCORES=api;})(typeof globalThis==='object'?globalThis:this,function(model){
 'use strict';
 function presentation(event,{resultsOn=false,now=Date.now(),label=id=>id}={}){
  if(!resultsOn||!model.supported(event))return null;
  const snapshot=model.compact(event),score=snapshot.score;
  const name=id=>(event.participants||[]).find(p=>p.id===id)?.displayName||label(id);
  let text='';
  if(score.innings?.length)text=score.innings.map(i=>`${i.team||name(i.participantId)||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · ');
  else if(score.sets?.length||score.games){const sides=[snapshot.homeParticipantId,snapshot.awayParticipantId].map(id=>id&&name(id));text=(sides.every(Boolean)?sides.join(' / ')+': ':'')+(score.sets||[]).map(s=>`${s.home??'—'}–${s.away??'—'}`).join('  ')+(score.games?` · Games ${score.games.home??'—'}–${score.games.away??'—'}`:'');}
  else if(score.home!=null&&score.away!=null)text=`${snapshot.homeParticipantId&&name(snapshot.homeParticipantId)||'Home'} ${score.home} · ${snapshot.awayParticipantId&&name(snapshot.awayParticipantId)||'Away'} ${score.away}`;
  if(!text)return null;
  const stamp=Date.parse(snapshot.scoreCheckedAt||snapshot.checkedAt||''),fresh=Number.isFinite(stamp)&&stamp<=now&&now-stamp<=model.interval(event,now)*2&&!event.stale;
  const status=model.final(event)?'Finished':fresh&&/^(live|in-progress)$/.test(event.status)?'Live':model.interrupted(event)?String(event.status).replace(/-/g,' '):'Last available score';
  return {text,status,stale:!fresh,checkedAt:Number.isFinite(stamp)?new Date(stamp).toISOString():null};
 }
 function install(card,event,options){
  card.querySelector('.feed-live-score')?.remove();
  if(card.querySelector('.card-result-line'))return;
  const value=presentation(event,options);if(!value)return;
  if(!document.querySelector('[data-feed-score-style]')){const style=document.createElement('style');style.dataset.feedScoreStyle='';style.textContent='.feed-live-score{grid-column:1/-1;padding:8px 12px;margin:0;font-size:.76rem;line-height:1.5;overflow-wrap:anywhere}.feed-live-score small{display:block;color:var(--text-dim);font-size:.66rem}';document.head.append(style);}
  const row=document.createElement('div');row.className='feed-live-score';row.dataset.fixtureScoreId=model.id(event);
  const score=document.createElement('strong');score.textContent=value.text;
  const detail=document.createElement('small');detail.textContent=[value.status,value.stale?'Update needed':'',value.checkedAt?'Checked '+new Date(value.checkedAt).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}):'Awaiting source update'].filter(Boolean).join(' · ');
  row.append(score,detail);card.append(row);
 }
 return {presentation,install};
});
