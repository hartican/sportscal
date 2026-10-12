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
  const timing=card.querySelector('.fixture-timing-group')||buildFixtureTimingGroup(ev);
  if(!card.contains(timing))main.append(timing);
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
  const formatLabel=compactFixtureFormat(ev);
  if(timing){const kind=document.createElement('span');kind.className='matchup-format-badge fixture-kind';kind.textContent=formatLabel;if(formatLabel)timing.prepend(kind);timing.prepend(header);}else card.prepend(header);
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
  if(cardStateForEvent(ev)==='opened'){const date=document.createElement('p');date.className='fixture-scheduled event-date-chip';date.textContent=schedule.fullSchedule;info.prepend(date);}

  const rating=main.querySelector('.nsc-summary');if(rating)rating.after(info);else main.append(info);
  const more=document.createElement('button');more.type='button';more.className='fixture-more';more.textContent=cardStateForEvent(ev)==='opened'?'Less':'More…';more.setAttribute('aria-expanded',String(cardStateForEvent(ev)==='opened'));more.onclick=e=>{e.stopPropagation();renderCardState(cardStateForEvent(ev)==='opened'?'selected':'opened',{restoreFocus:true,focusTarget:'.fixture-more'});};
  if(compact){const hook=buildEventWhyItMatters(ev);if(hook)main.append(hook);}
  const footer=document.createElement('div');footer.className='fixture-card-footer';footer.append(more);
  if(actions)footer.append(actions);
  else if(compact){const secondary=document.createElement('div');secondary.className='event-card-primary-actions';appendEventQuickActions(secondary,ev,{viewing:false});footer.append(secondary);}
  main.append(footer);
}

function fixtureCompetitionLabel(ev){
  if(!['tennis','wimbledon'].includes(ev.key||ev.sportKey))return '';
  const categories=(ev.tourCategories||[]).flatMap(c=>{const level=String(c.level||'').match(/(1000|500|250)/)?.[1];return level?(c.tour==='BOTH'?(ev.representedTours||['ATP','WTA']):[c.tour]).filter(t=>/^(ATP|WTA)$/.test(t)).map(t=>t+level):[];});
  return [...new Set(categories)].join(' / ')||NOTHINGSPORTS_FIXTURE_LABELS.tennisContext({...ev,key:'tennis'}).competition;
}
function buildTennisFixtureContext(ev){
  const value=NOTHINGSPORTS_FIXTURE_LABELS.tennisContext(ev);if(!value)return null;
  const row=document.createElement('span');row.className='tennis-fixture-context';
  const competition=document.createElement('span');competition.className='tennis-fixture-competition';competition.textContent=value.competition;
  const round=document.createElement('span');round.className=value.finals?'matchup-stage-badge':'tennis-fixture-round';round.textContent=value.round;round.title=ev.roundLabel||ev.round||ev.stage||value.round;
  row.append(competition,round);return row;
}
function buildTournamentMarker(event){
 const id=String(event.eventId||event.id),card=document.createElement('article');card.className='event-card tournament-start-marker';card.dataset.eventId=id;card.dataset.scrollKey=`event:calendar:${id}`;
 const details=document.createElement('details'),summary=document.createElement('summary');details.className='feed-tournament-details';details.open=tennisFeedOpenParents.has(id);
 const title=document.createElement('h3');title.textContent=[fixtureCompetitionLabel(event),event.name].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ');const dates=document.createElement('p'),timing=NOTHINGSPORTS_CARD_TIMING.presentation(event,nowAEST());dates.textContent=(timing.progress||[event.date,event.endDate!==event.date?event.endDate:null].filter(Boolean).map(value=>NOTHINGSPORTS_AUSTRALIAN_DATES.date(value)).join(' – '))+(timing.status==='FINISHED'?' · FINISHED':'');dates.title=timing.ariaLabel;summary.append(title,dates);details.append(summary);if(timing.progress){const full=document.createElement('p');full.className='fixture-source-dates';full.textContent=timing.fullSchedule;details.append(full);}
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
  const pause=ev.key==='cricket'&&timing.progress?NOTHINGSPORTS_CARD_TIMING.pausePresentation(ev,nowAEST()):null;
  const clock=document.createElement('span');clock.className='fixture-timing-clock';clock.textContent=pause?[timing.status,pause.restart].filter(Boolean).join(' • '):timing.time;
  badge.append(day);if(clock.textContent)badge.append(clock);
  if(['RALLY DATES','TOURNAMENT DATES'].includes(timing.time)){const note=document.createElement('small');note.textContent=ev.key==='wrc'?'Stage timetable not verified':ev.appearances?.length?'See player tee times':'Tee times not verified';badge.append(note);}
  if(timing.status&&!pause){const status=document.createElement('small');status.className='fixture-timing-status';status.textContent=timing.status;badge.append(status);}
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

function buildCompactParticipant(identity,ev){
  const side=document.createElement('span');side.className='compact-matchup-side';
  const mark=identity.mark||{};
  const frame=document.createElement('span');frame.className='compact-participant-frame';side.append(frame);
  const fallback=document.createElement('span');fallback.className='compact-participant-fallback';fallback.textContent=(identity.label||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2);frame.appendChild(fallback);
  if(mark.url||mark.logo?.primary){const image=document.createElement('img');image.className='compact-participant-mark';image.alt='';image.loading='lazy';image.decoding='async';image.addEventListener('load',()=>fallback.remove(),{once:true});image.addEventListener('error',()=>image.remove(),{once:true});applyTeamLogoAsset(image,mark,'icon',themeUsesDarkAssets());frame.appendChild(image);if(image.complete&&image.naturalWidth>0)fallback.remove();}
  side.appendChild(participantProfileLink(identity.participant?.id||mark.id,identity.label,ev.key));return side;
}
function buildCompactCardSummary(ev,{minimal=false}={}){
  const summary=document.createElement('div');summary.className='compact-card-summary';
  if(ev.timePrecision==='not-before')summary.dataset.timePrecision='not-before';
  const title=document.createElement('span');title.className='compact-card-name';
  const identities=matchupIdentityMatches(ev,compactFixtureName(ev));
  const tennisLineup=['tennis','wimbledon'].includes(ev.key)?majorEventMatchupLineup(ev,{compact:true}):null;
  if(tennisLineup){title.classList.add('has-compact-matchup');const versus=tennisLineup.querySelector('.major-event-matchup-v');if(versus&&!minimal)versus.replaceWith(buildCompactMatchupMiddle(ev));if(minimal)for(const link of tennisLineup.querySelectorAll('.fixture-profile-link'))if(link.title)link.textContent=link.title;title.appendChild(tennisLineup);}
  else if(identities.length===2){title.classList.add('compact-matchup-grid','has-compact-matchup');title.appendChild(buildCompactParticipant(identities[0],ev));title.appendChild(buildCompactMatchupMiddle(ev));title.appendChild(buildCompactParticipant(identities[1],ev));}
  else renderEventTitleIdentity(title,ev,compactFixtureName(ev),{compact:true});
  const time=document.createElement('span');time.className='compact-card-time';
  const start=ev.timePrecision==='follows'?null:FEED_CONTROLS.eventStart(ev);
  const progressTiming=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST());
  if(progressTiming.progress)summary.dataset.progress=progressTiming.progress;
  const timing=progressTiming.progress|| (ev.timePrecision==='not-before'||ev.timingProvenance?.precision==='venue-calendar'?progressTiming.fullSchedule:ev.timePrecision==='follows'?'Follows prior match':start ? new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',hour12:true}).format(start).replace(/Sept/g,'Sep').replace(/, /g,' ').replace(/ (am|pm)/g,'$1') : compactFallbackTiming(ev));
  const format=compactFixtureFormat(ev);const tennisCompetition=ev.competitionName||ev.majorEventName||String(ev.summary||'').split(' · ')[0];const sportLabel=ev.key==='tennis'||ev.key==='wimbledon'?`Tennis${tennisCompetition?' · '+tennisCompetition:''}`:(ev.sport||sportMetaForEvent(ev).label||ev.key).replace('American Football','NFL');time.textContent=`${timing} • ${sportLabel}${!title.classList.contains('has-compact-matchup')&&format?' · '+format:''}`;
  summary.setAttribute('aria-label',`${spoilerSafeDisplayTitle(ev)}. ${time.textContent}`);summary.title=summary.getAttribute('aria-label');
  if(activeTab === 'feed'){
    summary.dataset.cardArea='essentials';
    summary.appendChild(buildFixtureTimingGroup(ev));
    const badgeTiming=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST());
    const pause=NOTHINGSPORTS_CARD_TIMING.pausePresentation(ev,nowAEST());
    time.textContent=minimal?[badgeTiming.progress||(ev.timePrecision==='not-before'?badgeTiming.schedule:badgeTiming.fullSchedule),badgeTiming.status,NOTHINGSPORTS_FIXTURE_LABELS.tennisContext(ev)?'':FOLLOW_FIRST.stageLabel(ev)].filter(Boolean).join(' · '):`${badgeTiming.status&&!badgeTiming.progress ? badgeTiming.fullSchedule+' • ' : ''}${sportLabel}${!title.classList.contains('has-compact-matchup')&&format?' · '+format:''}`;
    if(pause)time.textContent=(badgeTiming.status.toLowerCase()===pause.label.toLowerCase()?'':pause.label+' · ')+time.textContent+' · '+pause.restart;
    summary.setAttribute('aria-label',`${spoilerSafeDisplayTitle(ev)}. ${badgeTiming.ariaLabel}. ${pause?[pause.label,pause.restart].join('. '):''}. ${sportLabel}`);
    summary.title=summary.getAttribute('aria-label');
  }
  summary.append(title,time);

  if(activeTab !== 'feed'){
    const phase=NOTHINGSPORTS_CARD_TIMING.tournamentPhase(ev);
    if(phase){summary.appendChild(buildEventTimingStateChip(ev,phase));summary.setAttribute('aria-label',`${summary.getAttribute('aria-label')}. ${phase.ariaLabel}`);summary.title=summary.getAttribute('aria-label');}
  }
  return summary;
}


function buildDetailedEventCard(ev, options = {}){
  const meta = sportMetaForEvent(ev);
  const status = getEventStatus(ev);
  const timingState = FEED_CONTROLS?.timingState?.(ev, nowAEST()) || null;
  const presentation = surfacePresentationForEvent(ev);
  const enrichment = eventEnrichment(ev);
  const actual = getActual(ev.id);
  const displayTitle = spoilerSafeDisplayTitle(ev);
  const isTeamMatchup = CARD_IDENTITIES?.isTeamSportMatchup?.(ev, displayTitle) || false;
  const upgraded = isUpgrade(ev) && isSpoilerVisible(ev);
  const mode = options.mode || "calendar";
  const matchupIdentity = isTeamMatchup && mode !== "premium-rail" ? buildMatchupIdentity(ev, displayTitle) : null;
  const soloIdentity = !matchupIdentity && mode !== "premium-rail";
  const expandable = mode !== "premium-rail";
  const multiDay=activeTab==='feed'&&NOTHINGSPORTS_FEED_CARD_PRESENTATION.cricketCompact(ev,nowAEST());
  const storedState = multiDay&&!multiDayCricketExpanded.has(ev.id)?'compact':expandable ? cardStateForEvent(ev) : "compact";
  const state = storedState;
  const importanceColor = importanceColorForEvent(ev);
  const spoilerVisible = isSpoilerVisible(ev);
  const displayedResult = status === "past" ? buildCompactResult(ev, displayTitle) : null;
  const protectedFacts = spoilerFactsForEvent(ev);
  const hasSpoilerFacts = hasSpoilerSensitiveContent(ev, protectedFacts, status);
  const spoilerProtected = !spoilerVisible && hasSpoilerFacts;
  const localGame = isLocalGame(ev);
  const recommendationProfile = eventRecommendationProfile(ev);
  const action = getEventAction(ev);
  const isMinimised = activeTab!=="feed" && Boolean(action.isMinimised);
  const card = document.createElement("article");
  let interactionCard = options.interactionCard || card;
  card._retargetCard=target=>{interactionCard=target;};
  card._rebuildCard=()=>buildEventCard(ev,{...options,interactionCard});
  appendCalendarChoice(card,ev);
  card.className = [
    "event-card",
    matchupIdentity ? "is-logo-led-matchup" : "",
    soloIdentity ? "is-logo-led-event" : "",
    `mode-${mode}`,
    `variant-${enrichment.cardVariant}`,
    `intensity-${enrichment.intensity}`,
    ["standard", "marquee"].includes(enrichment.cardVariant) ? "is-rail-card" : "",
    state === "selected" ? "is-selected" : "",
    state === "opened" ? "is-opened" : "",
    spoilerProtected ? "is-spoiler-protected" : "",
    displayedResult ? "has-card-result" : "",
    presentation.isNew ? "is-new" : "",
    status === "past" ? "is-past" : "",
    ["adjacent", "discovery"].includes(recommendationProfile.classification) ? "is-discovery" : "",
    isMinimised ? "is-event-minimised" : "",
  ].filter(Boolean).join(" ");
  if(options.inspectorFixture)card.dataset.inspectorFixtureId=options.inspectorFixture.id;
  card.dataset.eventId = ev.eventId || ev.id;
  card.dataset.scrollKey = `event:${mode}:${ev.eventId || ev.id}`;
  card.dataset.cardState = isMinimised ? "minimised" : state;
  card.dataset.cardMode = mode;
  card.dataset.feedBucket = presentation.feedBucket;
  card.dataset.cardVariant = enrichment.cardVariant;
  card.dataset.intensity = String(enrichment.intensity);
  card.dataset.mustWatchScore = String(enrichment.mustWatchScore);
  card.dataset.recommendationClassification = recommendationProfile.classification;
  card.dataset.nscPhase = nothingscoreSnapshotFor(ev)?.phase || "loading";
  card.style.setProperty("--sport-color", meta.color);
  card.style.setProperty("--importance-color", importanceColor);
  card.style.setProperty("--importance-strength", `${Math.min(34, 8 + enrichment.intensity * 4)}%`);
  if (!options.archived && mode !== "premium-rail"){
    card.appendChild(buildEventCardControls(ev, {
      card:interactionCard,
      eventsOnly:activeTab === "events" || mode === "events",
      displayLabel:displayTitle,
    }));
  }
  const renderCardState=(nextState,{restoreFocus=false,focusTarget=interactionCard}={})=>{
    if(multiDay&&nextState==='selected')nextState='opened';
    if(getEventAction(ev).isMinimised) updateEventAction(ev, {isMinimised:false});
    if(nextState==="opened")recordEventFeedAction(ev, "open", { surface:"card-content" });
    if(NOTHINGSPORTS_FEED_CARD_PRESENTATION.cricketCompact(ev,nowAEST())){if(nextState==='compact')multiDayCricketExpanded.delete(ev.id);else multiDayCricketExpanded.add(ev.id);}
    setCardState(ev, nextState);
    refreshExpandableCard(interactionCard, buildEventCard(ev, {...options, interactionCard}), {restoreFocus,focusTarget});
  };
  if (expandable) bindCardCycle(card, ({restoreFocus=false}={}) => {
    renderCardState(nextCardState(state),{restoreFocus,focusTarget:interactionCard});
  });
  card.dataset.cardLevel = cardLevelForState(state);
  card.setAttribute("aria-expanded", String(state !== "compact" && !isMinimised));
  if(expandable)card.appendChild(buildCardDisclosureControl(displayTitle,state,renderCardState));
  if ((state === "compact" || isMinimised) && expandable){
    card.classList.add("is-compact-row");
    card.appendChild(buildCompactCardSummary(ev,{minimal:activeTab==='feed'}));
    if(options.inspectorFixture)appendSchedulePin(card,options.inspectorFixture,card);
    if(activeTab==='feed'||activeTab==='events'||mode==='schedule'){card.classList.add('is-minimal-fixture');composeFeedCard(card,ev,{compact:true,renderCardState});}
    else if(ev.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))appendVenuePanel(card,card,ev);
    return card;
  }
  if(activeTab === 'feed'||activeTab==='events'||mode==='schedule'){
    card.classList.add('has-fixture-timing');
    const header=document.createElement('div');
    header.className='fixture-timing-header';
    header.dataset.cardArea='essentials';
    header.appendChild(buildFixtureTimingGroup(ev));
    card.appendChild(header);
  }
  const mainDiv = document.createElement("div");
  mainDiv.className = "event-main";
  appendFixtureCardArtwork(card, mainDiv, ev, {matchupIdentity, soloIdentity, meta});
  mainDiv.appendChild(buildFixtureCardEssentials(ev, {matchupIdentity, timingState, options, isMinimised, displayTitle, displayedResult, status, state, meta, interactionCard, renderCardState}));
  if (!isMinimised) mainDiv.appendChild(buildNothingscoreSummary(ev,{showAggregate:true}));
  appendFixtureCardInformation(mainDiv,ev,{isMinimised,state,options,displayTitle,localGame});
  mainDiv.id = `event-title-${String(ev.eventId || ev.id).replace(/[^a-z0-9_-]/gi, "-")}-details`;
  if (options.archived){
    mainDiv.appendChild(buildEventActionPanel(ev, {
      archived:true,
      autoArchived:options.autoArchived,
    }));
  }
  card.appendChild(mainDiv);
  if(activeTab==='feed'||activeTab==='events'||mode==='schedule')composeFeedCard(card,ev,{compact:false,renderCardState});
  else if(ev.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))appendVenuePanel(card,mainDiv,ev);
  if (interactionCard === card) observeNewSurfaceItem(card, ev, presentation);
  if (interactionCard === card && !options.archived && activeTab === "feed" && activeView === "list" && activeFilter === "all"){
    const canonicalId = ev.canonicalEventId || ev.eventId || ev.id;
    observeProductOpportunity(card, `card:${canonicalId}`, {
      eventName: "opportunity_exposed",
      surface: "curated_feed",
      ...productEventContextForEvent(ev),
      properties: {
        pilotVersion: "trust-pilot.v1",
        presentation: "card",
        feedBucket: presentation.feedBucket,
        ...productRecommendationContext(ev),
      },
    });
  }
  return card;
}


function appendFixtureCardArtwork(card, main, ev, {matchupIdentity, soloIdentity, meta}){
  if(matchupIdentity){
    matchupIdentity.dataset.cardArea='artwork';
    main.appendChild(matchupIdentity);
    return;
  }
  const icon=document.createElement('div');
  icon.className=soloIdentity ? 'event-hero-mark' : 'event-icon';
  icon.dataset.cardArea='artwork';
  renderEventIdentityMark(icon,ev,meta);
  const caption=document.createElement('strong');
  caption.className='fixture-event-caption';
  caption.dataset.cardArea='essentials';
  caption.textContent=(ev.eventName||ev.competitionName||CARD_IDENTITIES?.markForEvent(ev)?.label||meta.label).toUpperCase();
  card.append(icon,caption);
}

function buildFixtureCardEssentials(ev, {matchupIdentity, timingState, options, isMinimised, displayTitle, displayedResult, status, state, meta, interactionCard, renderCardState}){
  const topRow = document.createElement("div");
  topRow.dataset.cardArea = "essentials";
  topRow.className = `event-top-row${matchupIdentity ? " has-team-matchup" : ""}`;
  const nameWrap = document.createElement("div");
  nameWrap.className = "event-title-stack";
  const dateLine = document.createElement("div");
  dateLine.className = "event-date-line";
  const dateChip = document.createElement("div");
  dateChip.className = "event-date-chip";
  const badgeTiming=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST());
  dateChip.textContent = badgeTiming.progress || (activeTab === 'feed'
    ? [badgeTiming.status ? badgeTiming.fullSchedule : '', globalThis.NOTHINGSPORTS_COVERAGE_PAUSES.womensT20(ev) ? '' : eventLocationLabel(ev)].filter(Boolean).join(' · ')
    : ev.timePrecision==='not-before'?badgeTiming.fullSchedule:`${eventDateLabel(ev)} · ${eventTimeLabel(ev)}`);
  dateChip.title=badgeTiming.fullSchedule;
  if(badgeTiming.progress&&state==='opened'){const dates=document.createElement('small');dates.className='fixture-source-dates';dates.textContent=badgeTiming.fullSchedule;dateLine.append(dates);}
  dateLine.appendChild(dateChip);
  const stageText=FOLLOW_FIRST.stageLabel(ev);
  if(stageText && activeTab!=='feed'){const badge=document.createElement('span');badge.className='matchup-stage-badge';badge.textContent=stageText;badge.title=ev.roundLabel || ev.round || ev.stage || stageText;dateLine.appendChild(badge);}
  const timingChip = buildEventTimingStateChip(ev, timingState);
  if (timingChip && activeTab !== "feed") dateLine.appendChild(timingChip);


  const primaryActions = document.createElement("div");
  primaryActions.className = "event-card-primary-actions";
  appendEventQuickActions(primaryActions, ev);
  if(options.eventParent){
    const button=document.createElement('button');button.type='button';button.className='btn ghost';
    const automatic=Boolean(automaticEventFollowReason(ev));
    const added=Boolean(getEventAction(ev).addedToFixtures);button.disabled=automatic;button.textContent=automatic?'In Feed':added?'Remove from Feed':'Add to Feed';
    button.onclick=()=>{setMajorEventFixtureAdded(options.sourceSubEvent,options.eventParent,!added);renderCardState(state);};primaryActions.appendChild(button);
  }
  if(options.inspectorFixture)appendSchedulePin(primaryActions,options.inspectorFixture,interactionCard);

  const nameLine = document.createElement("div");
  nameLine.className = "event-name-line";
  if (matchupIdentity) nameLine.classList.add("matchup-visual-title-hidden");
  const nameEl = document.createElement("div");
  nameEl.className = "event-name";
  nameEl.id = `event-title-${String(ev.eventId || ev.id).replace(/[^a-z0-9_-]/gi, "-")}`;
  if (matchupIdentity) nameEl.textContent = displayTitle;
  else renderEventTitleIdentity(nameEl, ev, displayTitle);
  nameLine.appendChild(nameEl);
  nameWrap.appendChild(nameLine);
  if (isMinimised){
    const competition = document.createElement("div");
    competition.className = "event-competition-line";
    competition.textContent = [ev.competitionName || ev.competitionLabel || meta.label, ev.roundLabel || ev.round, timingState?.key==='awaiting-update' ? timingState.label : globalThis.NOTHINGSPORTS_ODI_DISPLAY.awaiting(ev,nowAEST()) ? "Awaiting confirmed result" : NOTHINGSPORTS_CARD_TIMING.tournamentPhase(ev)?.label || (status === "past" ? "Completed" : status === "live" ? "Live" : "Upcoming")].filter(value => value && value !== "all").join(" · ");
    nameWrap.appendChild(competition);
  }
  if (displayedResult) nameWrap.appendChild(displayedResult);
  nameWrap.append(dateLine, primaryActions);
  topRow.appendChild(nameWrap);

  return topRow;
}

function buildExpandedScoreDetails(ev){
 if(!(isSpoilerVisible(ev)&&(ev.score?.racing||/^(f1|supercars|motogp|wrc|horse-racing)$/.test(ev.key)||ev.key==='cricket'||/football|soccer|fifa|premier-league|uefa-/.test(ev.key))))return null;
 const slot=document.createElement('div');slot.dataset.cardArea='expanded-information';slot.className='fixture-scorecard';
 loadDeferredScript('config/score-details.js?v=516').then(()=>NOTHINGSPORTS_SCORE_DETAILS.feed(slot,ev,()=>isSpoilerVisible(ev))).catch(()=>{if(slot.isConnected&&isSpoilerVisible(ev))slot.textContent='Scorecard unavailable.';});return slot;
}
function buildFootballMatchContext(ev){return ev.footballMatchContext||ev.teamMatchContext?buildEuropeanDetail(ev,'context'):null;}

function appendFixtureCardInformation(parent, ev, {isMinimised, state, options, displayTitle, localGame}){
  const ticketOffer=preferredTicketOfferForEvent(ev,{surface:'fixture',localVenueMatched:localGame});
  const whyItMatters = !isMinimised ? buildEventWhyItMatters(ev) : null;
  if (whyItMatters){whyItMatters.dataset.cardArea='expanded-information';parent.appendChild(whyItMatters);}
  if (!isMinimised && state === "opened"){
    const scoreDetails=buildExpandedScoreDetails(ev);if(scoreDetails)parent.append(scoreDetails);
    const footballContext=buildFootballMatchContext(ev);if(footballContext)parent.append(footballContext);
    if(['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'].includes(ev.competitionId))parent.append(buildEuropeanDetail(ev,'standings'));
    const secondaryActions = document.createElement("div");
    secondaryActions.className = "event-card-secondary-actions";
    secondaryActions.dataset.cardArea="expanded-information";
    if (ticketOffer){
      const tickets = document.createElement("a");
      tickets.className = "ticket-link event-quick-action";
      tickets.href = ticketOffer.url;
      tickets.target = "_blank";
      tickets.rel = "noopener noreferrer";
      tickets.innerHTML = `${glyphMarkup("ui:ticket", { preferImage: true })}<span>Buy tickets</span>`;
      tickets.setAttribute("aria-label", `Buy tickets for ${displayTitle} from ${ticketOffer.provider}`);
      tickets.addEventListener("click", evt => evt.stopPropagation());
      secondaryActions.appendChild(tickets);
    }
    if(activeTab === "feed" && !options.archived)secondaryActions.append(...buildEventFeedbackButtons(ev));
    if(secondaryActions.childElementCount)parent.appendChild(secondaryActions);
  }
}




function buildMatchupIdentity(ev, displayTitle){
  const identities = matchupIdentityMatches(ev, displayTitle);
  if (identities.length !== 2) return null;
  const playingFormat = NOTHINGSPORTS_FIXTURE_LABELS.badge(ev);
  const useDark = themeUsesDarkAssets();
  const identity = document.createElement("div");
  identity.className = "matchup-identity";
  const row = document.createElement("div");
  row.className = "matchup-identity-row";
  row.setAttribute("aria-label", `${identities[0].label} versus ${identities[1].label}${playingFormat ? `, ${playingFormat}` : ""}`);
  const buildLogoSlot = ({ mark, label }) => {
    const slot = document.createElement("div");
    const surface = mark?.logo?.[useDark ? "backgroundDark" : "backgroundLight"] || "light";
    slot.className = `matchup-team-logo-slot matchup-logo-surface-${surface === "dark" ? "dark" : "light"}`;
    slot.dataset.logoSurface = surface === "dark" ? "dark" : "light";
    if (mark?.id) slot.dataset.teamLogoId = mark.id;
    appendTeamIdentityFallback(slot, mark, label, "team-logo-fallback matchup-team-logo-fallback");
    if (mark?.url || mark?.logo?.primary){
      const logo = document.createElement("img");
      logo.className = "matchup-team-logo";
      logo.alt = `${label} logo`;
      logo.loading = "lazy";
      logo.decoding = "async";
      logo.width = 133;
      logo.height = 139;
      logo.referrerPolicy = "no-referrer";
      applyTeamLogoAsset(logo, mark, "primary", useDark);
      logo.addEventListener("error", () => {
        logo.remove();
      }, { once: true });
      slot.appendChild(logo);
    }
    return slot;
  };
  row.appendChild(buildLogoSlot(identities[0]));
  const stageSlot = document.createElement("div");
  stageSlot.className = "matchup-stage-slot";
  if(activeTab!=='feed')stageSlot.appendChild(buildFixtureTimingGroup(ev));
  if(playingFormat){
    const formatBadge = document.createElement("span");
    formatBadge.className = "matchup-format-badge";
    formatBadge.textContent = playingFormat;
    formatBadge.setAttribute("aria-hidden", "true");
    stageSlot.appendChild(formatBadge);
  }
  row.appendChild(stageSlot);
  row.appendChild(buildLogoSlot(identities[1]));
  const teamNames = document.createElement("div");
  teamNames.className = "matchup-team-name-row";

  const firstTeam = document.createElement("span");
  firstTeam.className = "matchup-team-name";
  firstTeam.appendChild(participantProfileLink(identities[0].participant?.id || identities[0].mark?.id,identities[0].label,ev.key));
  const versus = document.createElement("span");
  versus.className = "matchup-vs";
  versus.textContent = "v";
  const secondTeam = document.createElement("span");
  secondTeam.className = "matchup-team-name";
  secondTeam.appendChild(participantProfileLink(identities[1].participant?.id || identities[1].mark?.id,identities[1].label,ev.key));
  teamNames.append(firstTeam, versus, secondTeam);
  identity.append(row, teamNames);
  return identity;
}


function majorEventMatchupLineup(subEvent,{compact=false}={}){
  let sides = Array.isArray(subEvent?.matchupSides) ? subEvent.matchupSides : [];
  if(sides.length!==2){const players=[...new Map((subEvent.participants||[]).map(p=>typeof p==='string'?{name:p}:p).filter(Boolean).map(p=>[p.id||p.name||p.displayName,p])).values()];if(players.length===2)sides=players.map(player=>({players:[player]}));}
  if (sides.length !== 2) return null;
  sides=NOTHINGSPORTS_FIXTURE_LABELS.australianFirst(sides,subEvent,cardIdentityParticipants());
  const matchup = document.createElement("div");
  matchup.className = "major-event-matchup-sides";
  sides.forEach((side, sideIndex) => {
    if (sideIndex){
      const versus = document.createElement("span");
      versus.className = "major-event-matchup-v";
      versus.textContent = "v";
      matchup.appendChild(versus);
    }
    const group = document.createElement("span");
    group.className = "major-event-matchup-side";
    const players = [...new Map((Array.isArray(side.players)?side.players:[]).map(player=>[player.id||player.playerId||String(player.name||player.displayName).toLowerCase(),player])).values()];
    if (players.length){
      players.forEach(player => {
        const person = document.createElement("span");
        person.className = "major-event-matchup-player";
        const known=NOTHINGSPORTS_FIXTURE_LABELS.participantRecord(player,subEvent,cardIdentityParticipants());
        const countryCode = known.countryCode;
        const fullName=player.name || player.displayName || "Player TBC";
        const name = participantProfileLink(player.id || player.playerId,fullName,subEvent.key || 'tennis');
        name.textContent = compact ? fullName.trim().split(/\s+/).slice(-1)[0] : fullName;
        if(compact)name.title=fullName;
        if (countryCode){
          const flag = COUNTRY_FLAGS?.flagMarkup?.(countryCode, { label:`${fullName} nationality`, nationality:true });
          if (flag) person.insertAdjacentHTML("beforeend", flag);
        }
        person.appendChild(name);
        group.appendChild(person);
      });
    } else group.textContent = side.name || side.displayName || "Side TBC";
    matchup.appendChild(group);
  });
  return matchup;
}
function eventParticipantFollowLevels(ev){
  const participantIds = new Set([
    ...FOLLOW_FEED_POLICY.participantIds(ev),
    ...(TEAM_FOLLOW_CATALOGUE?.participantIdsForEvent?.(ev) || []),
    ev.homeParticipantId,
    ev.awayParticipantId,
  ].filter(id=>id&&!(ev.excludedParticipantIds || []).includes(id)));
  const direct = (userPreferences.preferenceGraph?.entityFollows || [])
    .filter(preference => participantIds.has(preference.participantId)&&NOTHINGSPORTS_CRICKET_COVERAGE.matchesFollow(ev,preference))
    .filter(preference => !FOLLOW_FEED_POLICY.sportKey(ev).startsWith("tennis") || !["follow","priority"].includes(preference.followLevel) || cachedParticipantFollow(preference.participantId).followed)
    .map(preference => preference.followLevel);
  const expanded = footballDirectoryApi?.expandedFollowLevels?.(
    { ...ev, participantIds: Array.from(participantIds) },
    userPreferences.preferenceGraph,
    directoryFollowIndex()
  ) || [];
  return Array.from(new Set([...direct, ...expanded]));
}


function buildEventWhyItMatters(ev){
  const locked=NOTHINGSPORTS_EDITORIAL_LOCKS.activeFor(ev);
  if(locked)return buildEditorialL0Hook(locked.hook,'',{labelText:'Why it matters',supplementalCopy:cardStateForEvent(ev)==='opened'?locked.synopsis:''});
  const opened = cardStateForEvent(ev) === "opened";
  const originalHook = editorialNarrativeHookForDisplay(ev);
  const precedingCopy = [spoilerSafeDisplayTitle(ev)];
  if(isSpoilerVisible(ev) && getEventStatus(ev)==='past')precedingCopy.push(scoreLineForDisplay(ev,precedingCopy[0],compactResultForEvent(ev)) || '');
  const helper=globalThis.NOTHINGSPORTS_EDITORIAL_LIFECYCLE;
  const hook = helper.distinct(originalHook,precedingCopy) || (helper.distinct(editorialNarrativeSynopsisForDisplay(ev),precedingCopy).match(/[^.!?]+[.!?]*/)?.[0] || '').trim();
  if (!isValidatedEditorialCopy(hook)) return null;
  const seen = [...precedingCopy];
  const uniqueCopy = copy => {
    const value=globalThis.NOTHINGSPORTS_EDITORIAL_LIFECYCLE.distinct(copy,seen);
    if(value)seen.push(value);return value;
  };
  uniqueCopy(hook);
  const consequence = opened ? uniqueCopy(editorialConsequenceForDisplay(ev)) : "";
  const supplemental = opened ? uniqueCopy(editorialNarrativeSynopsisForDisplay(ev)) : "";
  return buildEditorialL0Hook(hook, isValidatedEditorialCopy(consequence) ? consequence : "", {
    labelText:"Why it matters",
    formCopy:opened && !helper.completed(ev) && ev.editorialNarrative?.dimensions?.includes('form') ? uniqueCopy(ev.editorialNarrative.formCopy) : '',
    closingCopy:opened && !helper.completed(ev) ? uniqueCopy(ev.editorialNarrative?.closingCopy) : '',
    supplementalCopy:isValidatedEditorialCopy(supplemental) ? supplemental : "",
  });
}
