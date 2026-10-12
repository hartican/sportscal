(function(root,factory){const api=factory(typeof module==='object'?require('./match-centre'):root.NOTHINGSPORTS_MATCH_CENTRE);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_FEED_LIVE_SCORES=api;})(typeof globalThis==='object'?globalThis:this,function(model){
 'use strict';
 function presentation(event,{resultsOn=false,now=Date.now(),label=id=>id}={}){
  // Feed admission is owned by the host. MC's public catalogue boundary must
  // not hide an already admitted legacy fixture's sourced score.
  if(!resultsOn||!model.supported(event,{catalogue:false}))return null;
  const snapshot=model.compact(event),score=snapshot.score;
  const name=id=>(event.participants||[]).find(p=>p.id===id)?.displayName||(event.participantSlots||[]).find(s=>s.participantId===id)?.label||label(id);
  let text='',summary='';
  if(score.racing)text=model.racingSummary(score.racing);
  else if(score.innings?.length)text=score.innings.map(i=>`${i.team||name(i.participantId)||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`).join(' · ');
  else if(score.sets?.length||score.games){const sides=[snapshot.homeParticipantId,snapshot.awayParticipantId].map(id=>id&&name(id));text=(sides.every(Boolean)?sides.join(' / ')+': ':'')+(score.sets||[]).map(s=>`${s.home??'—'}–${s.away??'—'}`).join('  ')+(score.games?` · Games ${score.games.home??'—'}–${score.games.away??'—'}`:'');}
  else if(score.home!=null&&score.away!=null){const home=`${snapshot.homeParticipantId&&name(snapshot.homeParticipantId)||'Home'} ${score.home}`,away=`${snapshot.awayParticipantId&&name(snapshot.awayParticipantId)||'Away'} ${score.away}`;text=snapshot.sport==='ice-hockey'&&event.participantSlots?.[0]?.homeAway==='away'?`${away} · ${home}`:`${home} · ${away}`;}
  if(!text)return null;
  const stamp=Date.parse(snapshot.scoreCheckedAt||(event.fixtureObservationSchema?null:snapshot.checkedAt)||''),observed=Number.isFinite(stamp)&&stamp<=now,settled=model.final(event),fresh=observed&&now-stamp<=model.interval(event,now)*2&&(score.racing||!event.stale&&!event.sourceStale);
  const status=score.racing?.kind==='horse'?score.racing.statusText:settled?(score.racing?.phase==='provisional-result'?'Provisional classification':'Finished'):fresh&&/^(live|in-progress)$/.test(event.status)?score.racing?.statusText||'Live':model.interrupted(event)&&(!model.halftime(event)||fresh)?model.pausedLabel(event):score.racing?'Awaiting update':'Last available score';
  if(score.innings?.length){const i=score.innings.reduce((a,b)=>Number.isInteger(b.inningNumber)&&b.inningNumber>(a.inningNumber||0)?b:a,score.innings.at(-1));summary=`${i.team||name(i.participantId)||'Innings'} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`;}
  if(snapshot.cricketBalance){text+=' · '+snapshot.cricketBalance;if(summary)summary+=' · '+snapshot.cricketBalance;}
  const start=Date.parse(event.startTimeUtc||''),advanceField=score.racing?.kind==='horse'&&['nominations','acceptances','final-declarations'].includes(score.racing.phase)&&(!Number.isFinite(start)||now<start-3600000);
  return {text,summary,status,stale:Boolean(event.stale)||(!settled&&!fresh&&!advanceField),checkedAt:observed?new Date(stamp).toISOString():null};
 }
 function install(card,event,options){
  card.querySelector('.cricket-test-day')?.remove();
  const timing=globalThis.NOTHINGSPORTS_CARD_TIMING?.presentation(event);
  if(timing?.progress){for(const day of card.querySelectorAll('.fixture-timing-day'))day.textContent=timing.day;const pause=globalThis.NOTHINGSPORTS_CARD_TIMING.pausePresentation(event);if(event.key==='cricket'){for(const badge of card.querySelectorAll('.fixture-timing-badge')){let clock=badge.querySelector('.fixture-timing-clock');if(!clock){clock=document.createElement('span');clock.className='fixture-timing-clock';badge.append(clock);}clock.textContent=pause?[timing.status,pause.restart].filter(Boolean).join(' • '):timing.time;badge.querySelector('.fixture-timing-status')?.remove();if(timing.status&&!pause){const status=document.createElement('small');status.className='fixture-timing-status';status.textContent=timing.status;badge.append(status);}}}for(const badge of card.querySelectorAll('.fixture-timing-badge')){badge.title=timing.fullSchedule;badge.setAttribute('aria-label',timing.ariaLabel+'. Open fixture');}const compact=card.querySelector('.compact-card-time');if(compact)compact.textContent=[timing.progress,timing.status,globalThis.NOTHINGSPORTS_CARD_TIMING.pausePresentation(event)?.restart].filter(Boolean).join(' · ');}
  const golfSlot=card.querySelector('.fixture-golf-details');if(golfSlot&&globalThis.NOTHINGSPORTS_GOLF_SCORES)globalThis.NOTHINGSPORTS_GOLF_SCORES.mount(golfSlot,event,{visible:options.resultsOn,followed:id=>cachedParticipantFollow(id).followed});
  const racingSlot=card.querySelector('.fixture-racing-details');if(racingSlot&&globalThis.NOTHINGSPORTS_RACING_DETAILS)globalThis.NOTHINGSPORTS_RACING_DETAILS.mount(racingSlot,event,{visible:()=>options.resultsOn,followed:entry=>cardIdentityParticipants().some(p=>entry.drivers?.includes(p.displayName||p.name)&&cachedParticipantFollow(p.id).followed)});
  card.querySelector('.feed-live-score')?.remove();
  if(event.key==='cricket')card.querySelector('.card-result-line')?.remove();
  else if(card.querySelector('.card-result-line'))return;
  const value=presentation(event,options);if(!value)return;
  if(!document.querySelector('[data-feed-score-style]')){const style=document.createElement('style');style.dataset.feedScoreStyle='';style.textContent='.feed-live-score{grid-column:1/-1;padding:8px 12px;margin:0;font-size:.76rem;line-height:1.5;overflow-wrap:anywhere}.feed-live-score small{display:block;color:var(--text-dim);font-size:.66rem}';document.head.append(style);}
  const row=document.createElement('div');row.className='feed-live-score';row.dataset.fixtureScoreId=model.id(event);
  const score=document.createElement(event.key==='cricket'?'button':'strong');score.textContent=value.summary||value.text;
  if(event.key==='cricket'){score.type='button';score.className='fixture-score-summary';score.setAttribute('aria-expanded',String(card.classList.contains('is-opened')));score.setAttribute('aria-label',score.textContent+'. '+(card.classList.contains('is-opened')?'Collapse':'Expand')+' scorecard');score.onclick=e=>{e.stopPropagation();score.closest('.event-card')?.querySelector('.fixture-more,.event-card-disclosure')?.click();};}
  const slot=card.querySelector('.fixture-scorecard');if(slot&&globalThis.NOTHINGSPORTS_SCORE_DETAILS&&options.resultsOn){slot.replaceChildren();globalThis.NOTHINGSPORTS_SCORE_DETAILS.feed(slot,event,()=>options.resultsOn);}
  const detail=document.createElement('small');detail.textContent=[value.status,value.stale?'Update needed':''].filter(Boolean).join(' · ');
  detail.append(' · ');
  if(value.checkedAt){const time=document.createElement('time');time.dateTime=value.checkedAt;time.textContent='Checked '+new Date(value.checkedAt).toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});detail.append(time);}
  else detail.append(value.status==='Finished'?'Source date unavailable':'Awaiting source update');
  row.append(score,detail);const access=card.querySelector('.fixture-access'),footer=card.querySelector('.fixture-card-footer');if(access)access.after(row);else if(footer)footer.before(row);else card.append(row);
 }
 return {presentation,install};
});
