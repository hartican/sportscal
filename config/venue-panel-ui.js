function appendVenuePanel(card,main,ev){
  if((!ev.golfMajorCalendar&&!['f1','motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))||!main||main.querySelector('.venue-location-hero'))return;
  const p=NOTHINGSPORTS_FEED_CARD_PRESENTATION, palette=p.palette(ev);
  if(palette){card.style.setProperty('--fixture-left',palette[0]);card.style.setProperty('--fixture-right',palette[1]);if(palette[2])card.style.setProperty('--fixture-accent',palette[2]);}
  card.classList.add('venue-location-card');if(ev.key==='f1')card.classList.add('f1-location-card');
  const hero=document.createElement('div');hero.className='f1-location-hero venue-location-hero';hero.dataset.cardArea='artwork';
  const artwork=p.venueArtwork(ev),track=p.circuitAsset(ev);
  if(track){const outline=document.createElement('img');outline.src=track;outline.alt=artwork?.label||`${ev.venue} circuit outline`;outline.width=600;outline.height=320;outline.loading='lazy';outline.decoding='async';hero.append(outline);if(artwork?.kind==='fallback')hero.classList.add('is-venue-fallback');outline.onerror=()=>{if(artwork&&!hero.classList.contains('is-venue-fallback')){hero.classList.add('is-venue-fallback');const fallback=p.venueArtwork({...ev,courseGeometryVerified:false,editionGeometryVerified:false,venueConfigurationVerified:false});outline.src=fallback.path;outline.alt=fallback.label;caption.textContent=[ev.venue,ev.venueCity,'Artwork unavailable'].filter(Boolean).join(' • ');}};}
  const labels=document.createElement('div');labels.className='f1-location-labels';
  const badge=document.createElement('span');badge.className='f1-location-date';badge.textContent=ev.date?new Date(ev.date+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}):'Date TBC';
  if((ev.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))&&ev.endDate&&ev.endDate!==ev.date)badge.textContent+=' – '+new Date(ev.endDate+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
  labels.append(badge);
  const raceLabel=p.raceLabel(ev);
  if(raceLabel){const race=document.createElement('span');race.className='f1-location-race';const flag=document.createElement('span');flag.className='f1-chequered-flag';flag.setAttribute('aria-hidden','true');flag.textContent='🏁';race.append(flag,document.createTextNode(raceLabel));labels.append(race);}
  const caption=document.createElement('span');caption.className='f1-location-caption';caption.textContent=p.circuitCaption(ev)||'Venue TBC';
  hero.append(labels,caption);main.prepend(hero);
}


function composeFeedCard(card,ev,{compact,renderCardState}){
  card.classList.add('feed-fixture');
  if(ev.contestUnit==='tie'&&ev.key==='tennis')card.classList.add('tennis-team-tie');
  const fixtureSides=matchupIdentityMatches(ev,spoilerSafeDisplayTitle(ev));
  const palette=NOTHINGSPORTS_FEED_CARD_PRESENTATION.palette(ev,fixtureSides.map(side=>({...side,participant:{...side.participant,countryCode:side.participant?.countryCode||CARD_IDENTITIES.nationalTeamIdentities?.teamsById?.[side.participant?.id||side.mark?.id]?.countryCode}})));
  if(palette){card.style.setProperty('--fixture-left',palette[0]);card.style.setProperty('--fixture-right',palette[1]);if(palette[2])card.style.setProperty('--fixture-accent',palette[2]);}
  const main=card.querySelector('.event-main')||card.querySelector('.compact-card-summary');
  if(!main)return;
  appendVenuePanel(card,main,ev);
  const timing=card.querySelector('.fixture-timing-group');
  const identity=card.querySelector('.matchup-identity');
  const summary=card.querySelector('.compact-card-summary');
  if(identity){
    const logos=[...identity.querySelectorAll('.matchup-team-logo-slot')],names=[...identity.querySelectorAll('.matchup-team-name')];
    const sides=fixtureSides;
    const format=identity.querySelector('.matchup-format-badge');
    identity.replaceChildren();identity.classList.add('feed-matchup');
    for(let i=0;i<2;i++){
      const side=document.createElement('div');side.className='feed-opponent';side.append(logos[i],names[i]);
      const name=names[i].querySelector('.fixture-profile-link')||names[i];
      name.textContent=NOTHINGSPORTS_FEED_CARD_PRESENTATION.displayLabel(sides[i]?.participant?.id||sides[i]?.mark?.id,name.textContent);
      const standing=NOTHINGSPORTS_FEED_CARD_PRESENTATION.ranking(ev,sides[i]?.participant?.id||sides[i]?.mark?.id,canonicalSportsData?.ladderSnapshots||NOTHINGSPORTS_FEED_CARD_STANDINGS);
      if(standing){const rank=document.createElement('span');rank.className='fixture-standing';rank.textContent=standing.label;rank.title=standing.description;rank.setAttribute('aria-label',standing.description);side.append(rank);}
      identity.append(side);if(i===0&&timing)identity.append(timing);
    }
    if(format){format.classList.add('fixture-kind');main.prepend(format);}
  }else{
    const name=summary?.querySelector('.compact-card-name')||main.querySelector('.event-name-line');
    const lineup=card.querySelector('.major-event-matchup-sides');
    const middle=lineup?.querySelector('.major-event-matchup-v,.compact-matchup-middle')||summary?.querySelector('.compact-matchup-middle');
    if(middle&&timing){
      const format=middle.querySelector('.matchup-format-badge');if(format)main.prepend(format);
      middle.replaceWith(timing);lineup?.classList.add('feed-player-matchup');
    }else if(name&&timing)name.after(timing);
    const mark=card.querySelector(':scope > .event-hero-mark,:scope > .event-icon');
    if(mark){if(ev.contestUnit==='tie'&&ev.key==='tennis')mark.remove();else main.prepend(mark);}
    const caption=card.querySelector(':scope > .fixture-event-caption');if(caption)main.prepend(caption);
  }
  const header=document.createElement('div');header.className='fixture-card-header';
  const oldKind=main.querySelector('.fixture-kind,.matchup-format-badge');if(oldKind){if(!/^(?:afl|nrl|tennis|football|golf|f1)$/i.test(oldKind.textContent.trim()))header.dataset.fixtureFormat=oldKind.textContent;oldKind.remove();}
  const mark=card.querySelector('.event-hero-mark,.event-icon');
  if(['tennis','wimbledon'].includes(ev.key)){
    const brand=CARD_IDENTITIES.markForEvent(ev);
    if(/\b(?:singles|doubles)\b/i.test(ev.stage||''))header.dataset.fixtureFormat=ev.stage;
    if(brand&&brand.id?.startsWith('brand:')){const img=document.createElement('img');img.src=CARD_IDENTITIES.logoForTheme(brand,{useDark:themeUsesDarkAssets()});img.alt='';img.width=96;img.height=64;img.decoding='async';img.loading='lazy';img.onerror=()=>img.remove();header.append(img);}
    mark?.remove();card.querySelector('.fixture-event-caption')?.remove();
  }else if(mark){if(ev.key==='f1'){mark.remove();card.querySelector('.fixture-event-caption')?.remove();}else mark.classList.add('fixture-brand-mark');}
  card.prepend(header);
  card.querySelector('.fixture-timing-header')?.remove();
  card.querySelector('.event-date-line')?.remove();
  if(compact){
    for(const side of summary.querySelectorAll('.compact-matchup-side')){
      const index=[...summary.querySelectorAll('.compact-matchup-side')].indexOf(side),ids=matchupIdentityMatches(ev,compactFixtureName(ev));
      const rank=NOTHINGSPORTS_FEED_CARD_PRESENTATION.ranking(ev,ids[index]?.participant?.id||ids[index]?.mark?.id,canonicalSportsData?.ladderSnapshots||NOTHINGSPORTS_FEED_CARD_STANDINGS);
      const name=side.querySelector('.fixture-profile-link');if(name)name.textContent=NOTHINGSPORTS_FEED_CARD_PRESENTATION.displayLabel(ids[index]?.participant?.id||ids[index]?.mark?.id,name.textContent);
      if(rank){const el=document.createElement('small');el.className='fixture-standing';el.textContent=rank.label;el.title=rank.description;side.append(el);}
    }
    main.appendChild(buildNothingscoreSummary(ev,{showAggregate:true}));
  }
  const actions=card.querySelector('.event-card-primary-actions');
  if(actions){actions.querySelectorAll('a:has(.provider-action-mark),.viewing-tbc').forEach(n=>n.remove());}
  const info=document.createElement('div');info.className='fixture-access';info.dataset.cardArea='essentials';
  appendEventQuickActions(info,ev,{reminder:false,chat:false});
  const venue=document.createElement('p');venue.className='fixture-venue';venue.textContent=globalThis.NOTHINGSPORTS_COVERAGE_PAUSES.womensT20(ev)?'':NOTHINGSPORTS_FEED_CARD_PRESENTATION.venue(ev,VENUE_REGISTRY);info.append(venue);
  const schedule=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST());
  if(schedule.status&&(!schedule.progress||cardStateForEvent(ev)==='opened')){const date=document.createElement('p');date.className='fixture-scheduled event-date-chip';date.textContent=schedule.fullSchedule;info.prepend(date);}
  const pause=NOTHINGSPORTS_CARD_TIMING.pausePresentation(ev,nowAEST());if(pause){const restart=document.createElement('p');restart.className='fixture-restart';restart.textContent=pause.label+' · '+pause.restart;info.prepend(restart);}
  const rating=main.querySelector('.nsc-summary');if(rating)rating.after(info);else main.append(info);
  const more=document.createElement('button');more.type='button';more.className='fixture-more';more.textContent=cardStateForEvent(ev)==='opened'?'Less':'More…';more.setAttribute('aria-expanded',String(cardStateForEvent(ev)==='opened'));more.onclick=e=>{e.stopPropagation();renderCardState(cardStateForEvent(ev)==='opened'?'selected':'opened',{restoreFocus:true,focusTarget:'.fixture-more'});};
  if(compact){const hook=buildEventWhyItMatters(ev);if(hook)main.append(hook);}
  const footer=document.createElement('div');footer.className='fixture-card-footer';footer.append(more);
  if(actions)footer.append(actions);
  else if(compact){const secondary=document.createElement('div');secondary.className='event-card-primary-actions';appendEventQuickActions(secondary,ev,{viewing:false});footer.append(secondary);}
  main.append(footer);
}

function buildTennisFixtureContext(ev){
  const value=NOTHINGSPORTS_FIXTURE_LABELS.tennisContext(ev);if(!value)return null;
  const row=document.createElement('span');row.className='tennis-fixture-context';
  const competition=document.createElement('span');competition.textContent=value.competition;
  const round=document.createElement('span');round.className=value.finals?'matchup-stage-badge':'tennis-fixture-round';round.textContent=value.round;round.title=ev.roundLabel||ev.round||ev.stage||value.round;
  row.append(competition,round);return row;
}
function buildTournamentMarker(event){
 const id=String(event.eventId||event.id),card=document.createElement('article');card.className='event-card tournament-start-marker';card.dataset.eventId=id;card.dataset.scrollKey=`event:calendar:${id}`;
 const details=document.createElement('details'),summary=document.createElement('summary');details.className='feed-tournament-details';details.open=tennisFeedOpenParents.has(id);
 const title=document.createElement('h3');title.textContent=event.name;const dates=document.createElement('p'),timing=NOTHINGSPORTS_CARD_TIMING.presentation(event,nowAEST());dates.textContent=(timing.progress||[event.date,event.endDate!==event.date?event.endDate:null].filter(Boolean).map(value=>NOTHINGSPORTS_AUSTRALIAN_DATES.date(value)).join(' – '))+(timing.status==='FINISHED'?' · FINISHED':'');dates.title=timing.ariaLabel;summary.append(title,dates);details.append(summary);if(timing.progress){const full=document.createElement('p');full.className='fixture-source-dates';full.textContent=timing.fullSchedule;details.append(full);}
 summary.setAttribute('aria-label','Expand '+event.name+'. '+timing.ariaLabel);
 const content=document.createElement('div');content.className='feed-tournament-appearances';details.append(content);let mounted=false;
 const mount=()=>{if(details.open){tennisFeedOpenParents.add(id);if(!mounted){mounted=true;loadDeferredScript('assets/js/tournament-card-ui.js?v=509').then(()=>NOTHINGSPORTS_TOURNAMENT_CARD_UI.render(content,event)).catch(()=>{mounted=false;content.textContent='Appearances could not load. Close and reopen to retry.';});}}else tennisFeedOpenParents.delete(id);};details.addEventListener('toggle',mount);
 card.append(details,buildEventCardControls(event,{card}));if(details.open)queueMicrotask(mount);return card;
}

function buildFixtureTimingBadge(ev){
  const timing = NOTHINGSPORTS_CARD_TIMING.presentation(ev, nowAEST());
  const badge = document.createElement('button');badge.type='button';
  badge.className = 'fixture-timing-badge btn ghost';
  const day=document.createElement('span');day.className='fixture-timing-day';day.textContent=timing.day;
  const clock=document.createElement('span');clock.className='fixture-timing-clock';clock.textContent=timing.time;
  badge.append(day);if(timing.time)badge.append(clock);
  if(['RALLY DATES','TOURNAMENT DATES'].includes(timing.time)){const note=document.createElement('small');note.textContent=ev.key==='wrc'?'Stage timetable not verified':ev.appearances?.length?'See player tee times':'Tee times not verified';badge.append(note);}
  if(timing.status){const status=document.createElement('small');status.textContent=timing.status;badge.append(status);}
  badge.dataset.timingStatus = timing.status;
  badge.title = timing.fullSchedule;
  badge.setAttribute('aria-label',`${timing.ariaLabel}. Open fixture`);
  badge.onclick=event=>{event.stopPropagation();void openFixtureFromTimingCapsule(ev);};
  return badge;
}


function buildFixtureTimingGroup(ev){
  const group=document.createElement('div');group.className='fixture-timing-group';
  group.appendChild(buildFixtureTimingBadge(ev));
  const context=buildTennisFixtureContext(ev);if(context)group.append(context);
  const stage=context?'':FOLLOW_FIRST.stageLabel(ev);
  if(stage){const label=document.createElement('span');label.className='fixture-stage-label';label.textContent=stage.toUpperCase();group.appendChild(label);}
  return group;
}

function compactFixtureFormat(ev){
  const values=[ev.format,ev.matchFormat,ev.playingFormat,ev.discipline,ev.drawName,ev.competitionFormat].filter(Boolean).join(' ');
  const context=[values,ev.roundLabel,ev.round,ev.stage,ev.name,ev.displayTitleCompact].filter(Boolean).join(' ');
  if(['tennis','wimbledon'].includes(ev.key)){
    const gender=NOTHINGSPORTS_FIXTURE_LABELS.gender(ev);
    const sides=Array.isArray(ev.matchupSides)?ev.matchupSides:[];
    const doubles=/doubles/i.test(context)||sides.some(side=>(side.players||[]).length>1);
    const eventType=doubles?'Doubles':'Singles';
    return `${gender==='women'?"Women’s":gender==='mixed'?'Mixed':"Men’s"} ${eventType}`;
  }
  if(ev.key==='cricket')return cricketPlayingFormatForEvent(ev)||String(ev.format||ev.matchFormat||'').trim();
  if(/\b(?:grand )?final\b/i.test(context))return activeTab==='feed' ? NOTHINGSPORTS_FIXTURE_LABELS.badge(ev) : 'Final';
  return String(ev.format||ev.matchFormat||ev.playingFormat||ev.discipline||'').trim();
}
function compactFixtureStage(ev,format){
  const stage=String(FOLLOW_FIRST?.stageLabel?.(ev)||ev.roundLabel||ev.round||ev.stage||'').trim();
  return stage&&stage.toLowerCase()!==String(format||'').toLowerCase()?stage:'';
}
function buildCompactMatchupMiddle(ev){
  const middle=document.createElement('span');middle.className='compact-matchup-middle';
  const format=compactFixtureFormat(ev),stage=compactFixtureStage(ev,format);
  if(format){const badge=document.createElement('span');badge.className='matchup-format-badge compact-format-badge';badge.textContent=format;middle.appendChild(badge);}
  else{const versus=document.createElement('span');versus.className='compact-matchup-v';versus.textContent='v';middle.appendChild(versus);}
  if(stage && activeTab!=='feed'){const detail=document.createElement('small');detail.className='compact-stage-label';detail.textContent=stage;middle.appendChild(detail);}
  return middle;
}
