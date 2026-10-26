(function(root,factory){const api=factory(typeof module==='object'?require('./match-centre'):root.NOTHINGSPORTS_MATCH_CENTRE);if(typeof module==='object')module.exports=api;else root.NOTHINGSPORTS_FEED_LIVE_SCORES=api;})(typeof globalThis==='object'?globalThis:this,function(model){
 'use strict';
 const escapePattern=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function cricketNames(event,innings,{label,displayLabel,participant}){
  const ids=[...new Set([...(event.participantIds||[]),event.homeParticipantId,event.awayParticipantId,...(event.participants||[]).map(p=>p.id||p.participantId),...(event.participantSlots||[]).map(s=>s.participantId),...innings.map(i=>i.participantId)].filter(Boolean))];
  const records=ids.map(id=>{
   const local=(event.participants||[]).find(p=>(p.id||p.participantId)===id),record=participant?.(id),slots=(event.participantSlots||[]).filter(s=>s.participantId===id);
   const labelled=label(id),fallback=local?.displayName||local?.name||record?.displayName||record?.name||(labelled!==id&&labelled)||slots[0]?.label||innings.find(i=>i.participantId===id)?.team;
   const name=String((local||record||slots.length?displayLabel?.(id,fallback):null)||fallback||'').trim();
   const aliases=[local?.displayName,local?.name,...(Array.isArray(local?.aliases)?local.aliases:[]),record?.displayName,record?.name,...(Array.isArray(record?.aliases)?record.aliases:[]),...slots.map(s=>s.label),...innings.filter(i=>i.participantId===id).map(i=>i.team)].filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim());
   return {id,name,aliases:[...new Set(aliases)]};
  }).filter(r=>r.name&&r.name!==r.id);
  const aliasMap=new Map();for(const record of records)for(const alias of record.aliases){const key=alias.toLocaleLowerCase('en');const previous=aliasMap.get(key);aliasMap.set(key,previous&&previous.id!==record.id?{ambiguous:true}:previous||record);}
  const uniqueAlias=value=>aliasMap.get(String(value||'').trim().toLocaleLowerCase('en'));
  const name=inning=>records.find(r=>r.id===inning.participantId)?.name||((uniqueAlias(inning.team)?.ambiguous?null:uniqueAlias(inning.team)?.name))||inning.team||'Innings';
  const aliases=[...aliasMap.keys()].filter(key=>!aliasMap.get(key).ambiguous).sort((a,b)=>b.length-a.length);
  const pattern=aliases.length?new RegExp('(?<![\\p{L}\\p{N}])('+aliases.map(escapePattern).join('|')+')(?![\\p{L}\\p{N}])','giu'):null;
  return {name,balance:value=>pattern?String(value).replace(pattern,alias=>uniqueAlias(alias).name):String(value)};
 }
 function withoutStatusPrefix(value,status){const prefix=new RegExp('^'+escapePattern(status)+'\\s*:\\s*','i');return status?value.replace(prefix,''):value;}
 function presentation(event,{resultsOn=false,now=Date.now(),label=id=>id,displayLabel,participant}={}){
  // Feed admission is owned by the host. MC's public catalogue boundary must
  // not hide an already admitted legacy fixture's sourced score.
  if(!resultsOn||!model.supported(event,{catalogue:false}))return null;
  const snapshot=model.compact(event),score=snapshot.score;
  const name=id=>(event.participants||[]).find(p=>p.id===id)?.displayName||(event.participantSlots||[]).find(s=>s.participantId===id)?.label||label(id);
  const cricket=score.innings?.length?cricketNames(event,score.innings,{label,displayLabel,participant}):null;
  const inningsText=i=>`${cricket.name(i)} ${i.runs??'—'}/${i.wickets??'—'} (${i.overs??'—'} overs)`;
  let text='',summary='';
  if(score.racing)text=score.racing.kind==='horse'?`${score.racing.entryCount??score.racing.entries?.length??0} entries`:model.racingSummary(score.racing);
  else if(score.innings?.length)text=score.innings.map(inningsText).join(' · ');
  else if(score.sets?.length||score.games){const sides=[snapshot.homeParticipantId,snapshot.awayParticipantId].map(id=>id&&name(id));text=(sides.every(Boolean)?sides.join(' / ')+': ':'')+(score.sets||[]).map(s=>`${s.home??'—'}–${s.away??'—'}`).join('  ')+(score.games?` · Games ${score.games.home??'—'}–${score.games.away??'—'}`:'');}
  else if(score.home!=null&&score.away!=null){const home=`${snapshot.homeParticipantId&&name(snapshot.homeParticipantId)||'Home'} ${score.home}`,away=`${snapshot.awayParticipantId&&name(snapshot.awayParticipantId)||'Away'} ${score.away}`;text=snapshot.sport==='ice-hockey'&&event.participantSlots?.[0]?.homeAway==='away'?`${away} · ${home}`:`${home} · ${away}`;}
  if(!text)return null;
  const stamp=Date.parse(snapshot.scoreCheckedAt||(event.fixtureObservationSchema?null:snapshot.checkedAt)||''),observed=Number.isFinite(stamp)&&stamp<=now,settled=model.final(event),fresh=observed&&now-stamp<=model.interval(event,now)*2&&(score.racing||!event.stale&&!event.sourceStale);
  const status=score.racing?.kind==='horse'?(['nominations','acceptances'].includes(score.racing.phase)?'Early entries':score.racing.statusText):settled?(score.racing?.phase==='provisional-result'?'Provisional classification':'Finished'):fresh&&/^(live|in-progress)$/.test(event.status)?score.racing?.statusText||'Live':model.interrupted(event)&&(!model.halftime(event)||fresh)?model.pausedLabel(event):score.racing?'Awaiting update':'Last available score';
  if(score.innings?.length){const i=score.innings.reduce((a,b)=>Number.isInteger(b.inningNumber)&&b.inningNumber>(a.inningNumber||0)?b:a,score.innings.at(-1));summary=inningsText(i);}
  if(snapshot.cricketBalance){const balance=cricket?withoutStatusPrefix(cricket.balance(snapshot.cricketBalance),status):snapshot.cricketBalance;if(balance){text+=' · '+balance;if(summary)summary+=' · '+balance;}}
  const start=Date.parse(event.startTimeUtc||''),advanceField=score.racing?.kind==='horse'&&['nominations','acceptances','final-declarations'].includes(score.racing.phase)&&(!Number.isFinite(start)||now<start-3600000);
  return {text,summary,status,stale:Boolean(event.stale)||(!settled&&!fresh&&!advanceField),checkedAt:observed?new Date(stamp).toISOString():null};
 }
 function install(card,event,options){
  if(card.classList?.contains('is-minimised-row'))return;
  if(typeof activeTab!=='undefined'&&activeTab==='feed'&&card.dataset.cardState==='opened'&&!card.querySelector('.fixture-public-comments')){
   const comments=document.createElement('button');comments.type='button';comments.className='btn ghost fixture-public-comments';comments.textContent='Comments';comments.onclick=async e=>{e.stopPropagation();const owner=serverSyncClient.sessionSubject(),life=serverSyncClient.accountSnapshot();if(!owner||!serverPersistence.user||serverPersistence.user.id!==owner||serverPersistence.user.isAnonymous===true){openSettings({section:'account'});return;}try{await Promise.all([loadDeferredScript('assets/js/public-comments-ui.js?v=1'),loadDeferredScript('config/chat-media-ui.js?v=304')]);if(card.isConnected&&owner===serverSyncClient.sessionSubject()&&life.generation===serverSyncClient.accountSnapshot().generation)NOTHINGSPORTS_PUBLIC_COMMENTS_UI.mount(card,event);}catch(error){showToast(error.message||'Comments are temporarily unavailable.');}};card.insertBefore(comments,card.querySelector(':scope > .public-comments'));
  }
  card.querySelector('.cricket-test-day')?.remove();
  const timing=globalThis.NOTHINGSPORTS_CARD_TIMING?.badgePresentation(event,undefined,{fullRange:card.classList?.contains('feed-fixture')===true,compactCricket:true});
  for(const badge of card.querySelectorAll('.fixture-timing-badge')){
   let progress=badge.querySelector('.fixture-source-progress');
   if(card.classList.contains('feed-fixture')&&!timing?.compactCricket&&globalThis.NOTHINGSPORTS_FEED_TIMELINE?.finalDay(event)&&timing?.progress){
    if(!progress){progress=document.createElement('small');progress.className='fixture-source-progress';badge.append(progress);}
    progress.textContent=timing.progress;
   }else progress?.remove();
  }
  if(timing){
   if(timing.progress||timing.compactCricket)for(const day of card.querySelectorAll('.fixture-timing-day')){day.textContent=timing.day;day.hidden=!timing.day;}
   for(const badge of card.querySelectorAll('.fixture-timing-badge')){
    badge.classList.toggle('fixture-cricket-timing',timing.compactCricket===true);
     let clock=badge.querySelector('.fixture-timing-clock');if(timing.badgeClock){if(!clock){clock=document.createElement('span');clock.className='fixture-timing-clock';badge.append(clock);}clock.textContent=timing.badgeClock;}else clock?.remove();
     let status=badge.querySelector('.fixture-timing-status:not(.fixture-timing-freshness)');if(timing.badgeStatus){if(!status){status=document.createElement('small');status.className='fixture-timing-status';badge.append(status);}status.textContent=timing.badgeStatus;}else status?.remove();
    let freshness=badge.querySelector('.fixture-timing-freshness');if(timing.badgeFreshness){if(!freshness){freshness=document.createElement('small');freshness.className='fixture-timing-status fixture-timing-freshness';badge.append(freshness);}freshness.textContent=timing.badgeFreshness;}else freshness?.remove();
    badge.title=timing.fullSchedule;badge.setAttribute('aria-label',timing.ariaLabel);
   }
   const compact=card.querySelector('.compact-card-time');if(compact&&timing.compactCricket)compact.textContent=[timing.day,timing.badgeClock,timing.badgeStatus].filter(Boolean).join(' · ');else if(compact&&timing.progress)compact.textContent=[timing.progress,timing.status,timing.pause?.restart].filter(Boolean).join(' · ');
  }
  const golfSlot=card.querySelector('.fixture-golf-details');if(golfSlot&&globalThis.NOTHINGSPORTS_GOLF_SCORES)globalThis.NOTHINGSPORTS_GOLF_SCORES.mount(golfSlot,event,{visible:options.resultsOn,followed:id=>cachedParticipantFollow(id).followed});
  const racingSlot=card.querySelector('.fixture-racing-details');if(racingSlot&&globalThis.NOTHINGSPORTS_RACING_DETAILS)globalThis.NOTHINGSPORTS_RACING_DETAILS.mount(racingSlot,event,{visible:()=>event.key==='horse-racing'||(typeof isSpoilerVisible==='function'?isSpoilerVisible(event):options.resultsOn),resultsVisible:()=>typeof isSpoilerVisible==='function'?isSpoilerVisible(event):options.resultsOn,followed:entry=>cardIdentityParticipants().some(p=>entry.drivers?.includes(p.displayName||p.name)&&cachedParticipantFollow(p.id).followed)});
  card.querySelector('.feed-live-score')?.remove();
  if(event.key==='horse-racing'&&card.classList.contains('is-opened'))return;
  const value=presentation(event,options);
  if(event.key==='cricket'){if(!options.resultsOn||value)card.querySelector('.card-result-line')?.remove();}
  else if(card.querySelector('.card-result-line'))return;
  if(!value)return;
  if(!document.querySelector('[data-feed-score-style]')){const style=document.createElement('style');style.dataset.feedScoreStyle='';style.textContent='.feed-live-score{grid-column:1/-1;padding:8px 12px;margin:0;font-size:.76rem;line-height:1.5;overflow-wrap:anywhere}.feed-live-score small{display:block;color:var(--text-dim);font-size:.66rem}';document.head.append(style);}
  const row=document.createElement('div');row.className='feed-live-score';row.dataset.fixtureScoreId=model.id(event);
  const score=document.createElement(event.key==='cricket'?'button':'strong');score.textContent=value.summary||value.text;
  if(event.key==='cricket'){score.type='button';score.className='fixture-score-summary';score.setAttribute('aria-expanded',String(card.classList.contains('is-opened')));score.setAttribute('aria-label',score.textContent+'. '+(card.classList.contains('is-opened')?'Collapse':'Expand')+' scorecard');score.onclick=e=>{e.stopPropagation();const host=score.closest('.event-card');(host?.querySelector('.fixture-more')||host?.querySelector('.event-card-disclosure'))?.click();};}
  const slot=card.querySelector('.fixture-scorecard');if(slot&&globalThis.NOTHINGSPORTS_SCORE_DETAILS&&options.resultsOn){slot.replaceChildren();globalThis.NOTHINGSPORTS_SCORE_DETAILS.feed(slot,event,()=>options.resultsOn);}
  const headerStatus=event.key==='cricket'&&[...card.querySelectorAll('.fixture-timing-badge')].some(badge=>new RegExp('(?:^|[\\s•·])'+escapePattern(value.status)+'(?:$|[\\s•·])','i').test(badge.textContent));
  const detail=document.createElement('small');detail.textContent=[headerStatus?'':value.status,value.stale?'Update needed':''].filter(Boolean).join(' · ');
  if(detail.textContent)detail.append(' · ');
  if(value.checkedAt){const time=document.createElement('time');time.dateTime=value.checkedAt;time.textContent='Checked '+new Date(value.checkedAt).toLocaleString('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});detail.append(time);}
  else detail.append(value.status==='Finished'?'Source date unavailable':'Awaiting source update');
  row.append(score,detail);const access=card.querySelector('.fixture-access'),footer=card.querySelector('.fixture-card-footer');if(access)access.after(row);else if(footer)footer.before(row);else card.append(row);
 }
 return {presentation,install};
});
