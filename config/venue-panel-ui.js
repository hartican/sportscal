function appendVenuePanel(card,main,ev){
  if((!ev.golfMajorCalendar&&!['f1','motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))||!main||main.querySelector('.venue-location-hero'))return;
  const p=NOTHINGSPORTS_FEED_CARD_PRESENTATION, palette=p.palette(ev);
  if(palette){card.style.setProperty('--fixture-left',palette[0]);card.style.setProperty('--fixture-right',palette[1]);if(palette[2])card.style.setProperty('--fixture-accent',palette[2]);}
  card.classList.add('venue-location-card');if(ev.key==='f1')card.classList.add('f1-location-card');
  const hero=document.createElement('div');hero.className='f1-location-hero venue-location-hero';hero.dataset.cardArea='artwork';
  const artwork=p.venueArtwork(ev),track=p.circuitAsset(ev);
  if(track){const outline=document.createElement('img');outline.src=track;outline.alt=artwork?.label||`${ev.venue} circuit outline`;outline.width=600;outline.height=320;outline.loading='lazy';outline.decoding='async';hero.append(outline);if(artwork?.kind==='fallback')hero.classList.add('is-venue-fallback');outline.onerror=()=>{if(artwork&&!hero.classList.contains('is-venue-fallback')){hero.classList.add('is-venue-fallback');const fallback=p.venueArtwork({...ev,courseGeometryVerified:false,editionGeometryVerified:false,venueConfigurationVerified:false});outline.src=fallback.path;outline.alt=fallback.label;caption.textContent=[ev.venue,ev.venueCity].filter(Boolean).join(' • ');caption.hidden=!caption.textContent;}};}
  const labels=document.createElement('div');labels.className='f1-location-labels';
  const badge=document.createElement('span');badge.className='f1-location-date';badge.textContent=ev.date?new Date(ev.date+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}):'Date unavailable';
  if((ev.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta','dakar','lemans'].includes(ev.key))&&ev.endDate&&ev.endDate!==ev.date)badge.textContent+=' – '+new Date(ev.endDate+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
  labels.append(badge);
  const raceLabel=p.raceLabel(ev);
  if(raceLabel){const race=document.createElement('span');race.className='f1-location-race';const flag=document.createElement('span');flag.className='f1-chequered-flag';flag.setAttribute('aria-hidden','true');flag.textContent='🏁';race.append(flag,document.createTextNode(raceLabel));labels.append(race);}
  const caption=document.createElement('span');caption.className='f1-location-caption';caption.textContent=p.circuitCaption(ev)||'';caption.hidden=!caption.textContent;
  hero.append(labels,caption);main.prepend(hero);
}


function composeFeedCard(card,ev,{compact,renderCardState,mode}){
  card.dataset.cardSurface=mode==='schedule'?'schedule':mode==='events'?'events':activeTab==='feed'?'feed':activeTab==='events'?'events':'calendar';
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
  const actions=card.querySelector('.event-card-primary-actions');
  if(actions){actions.querySelectorAll('a:has(.provider-action-mark),.viewing-tbc').forEach(n=>n.remove());}
  const info=document.createElement('div');info.className='fixture-access';info.dataset.cardArea='essentials';
  appendEventQuickActions(info,ev,{reminder:false,chat:false});
  const venue=document.createElement('p');venue.className='fixture-venue';venue.textContent=globalThis.NOTHINGSPORTS_COVERAGE_PAUSES.womensT20(ev)?'':NOTHINGSPORTS_FEED_CARD_PRESENTATION.venue(ev,VENUE_REGISTRY);if(venue.textContent)info.append(venue);
  info.classList.toggle('has-venue',!!venue.textContent);
  const schedule=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST());
  if(cardStateForEvent(ev)==='opened'){const date=document.createElement('p');date.className='fixture-scheduled event-date-chip';date.textContent=schedule.fullSchedule;info.prepend(date);}

  const rating=main.querySelector('.nsc-summary');if(rating)rating.after(info);else main.append(info);
  const more=document.createElement('button');more.type='button';more.className='fixture-more';more.textContent=cardStateForEvent(ev)==='opened'?'Less':'More…';more.setAttribute('aria-expanded',String(cardStateForEvent(ev)==='opened'));more.onclick=e=>{e.stopPropagation();renderCardState(cardStateForEvent(ev)==='opened'?'selected':'opened',{restoreFocus:true,focusTarget:'.fixture-more'});};
  const footer=document.createElement('div');footer.className='fixture-card-footer';footer.append(more);
  if(actions)footer.append(actions);
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
 const id=String(event.eventId||event.id);let card=document.createElement('article');card.className='event-card tournament-start-marker';card.dataset.eventId=id;card.dataset.scrollKey=`event:calendar:${id}`;card._retargetCard=target=>{card=target;};card._rebuildCard=()=>buildTournamentMarker(event);
 if(cardStateForEvent(event)==='compact'||getEventAction(event).isMinimised){
   card.dataset.cardState='compact';return mountMinimisedCard(card,event,(state,options)=>{if(getEventAction(event).isMinimised)updateEventAction(event,{isMinimised:false});if(state==='selected')tennisFeedOpenParents.delete(id);setCardState(event,state);refreshExpandableCard(card,buildTournamentMarker(event),options);syncNothingscoreReadRecovery();});
 }
 const details=document.createElement('details'),summary=document.createElement('summary');details.className='feed-tournament-details';details.open=tennisFeedOpenParents.has(id);
 const title=document.createElement('h3');title.textContent=[fixtureCompetitionLabel(event),event.name].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ');const dates=document.createElement('p'),timing=NOTHINGSPORTS_CARD_TIMING.presentation(event,nowAEST(),{fullRange:true});dates.textContent=(NOTHINGSPORTS_FEED_TIMELINE.finalDay(event)?timing.day:timing.progress||[event.date,event.endDate!==event.date?event.endDate:null].filter(Boolean).map(value=>NOTHINGSPORTS_AUSTRALIAN_DATES.date(value)).join(' – '))+(timing.status==='FINISHED'?' · FINISHED':'');dates.title=timing.ariaLabel;summary.append(title,dates);details.append(summary);if(timing.progress){const full=document.createElement('p');full.className='fixture-source-dates';full.textContent=timing.fullSchedule;details.append(full);}
 summary.setAttribute('aria-label','Expand '+event.name+'. '+timing.ariaLabel);
 const content=document.createElement('div');content.className='feed-tournament-appearances';details.append(content);let mounted=false;
 const mount=()=>{if(details.open){tennisFeedOpenParents.add(id);if(!mounted){mounted=true;loadDeferredScript('assets/js/tournament-card-ui.js?v=533').then(()=>NOTHINGSPORTS_TOURNAMENT_CARD_UI.render(content,event)).catch(()=>{mounted=false;content.textContent='Appearances could not load. Close and reopen to retry.';});}}else tennisFeedOpenParents.delete(id);};details.addEventListener('toggle',mount);
 card.append(details,buildEventCardControls(event,{card}),buildCardDisclosureControl(event.name,'selected',(state,options)=>{setCardState(event,state);refreshExpandableCard(card,buildTournamentMarker(event),options);syncNothingscoreReadRecovery();}));appendEventQuickActions(card,event,{reminder:false,chat:false,highlightsOnly:true});if(details.open)queueMicrotask(mount);return card;
}

function buildFixtureTimingBadge(ev){
  const timing = NOTHINGSPORTS_CARD_TIMING.presentation(ev, nowAEST(), {fullRange:activeTab==='feed'});
  const badge = document.createElement('button');badge.type='button';
  badge.className = 'fixture-timing-badge btn ghost';
  const day=document.createElement('span');day.className='fixture-timing-day';day.textContent=timing.day;
  const pause=ev.key==='cricket'&&timing.progress?NOTHINGSPORTS_CARD_TIMING.pausePresentation(ev,nowAEST()):null;
  const clock=document.createElement('span');clock.className='fixture-timing-clock';clock.textContent=pause?[timing.status,pause.restart].filter(Boolean).join(' • '):timing.time;
  badge.append(day);if(clock.textContent)badge.append(clock);
  if(activeTab==='feed'&&NOTHINGSPORTS_FEED_TIMELINE.finalDay(ev)&&timing.progress){const progress=document.createElement('small');progress.className='fixture-source-progress';progress.textContent=timing.progress;badge.append(progress);}
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
function buildMinimisedParticipant(identity,ev){
  const frame=document.createElement('span');frame.className='minimised-participant-frame';frame.setAttribute('aria-hidden','true');
  const mark=identity.mark||{},person=identity.participant||{};
  const country=person.countryCode||identity.countryCode;
  if(['tennis','wimbledon'].includes(ev.key)&&country){
    const flag=COUNTRY_FLAGS?.flagMarkup?.(country,{nationality:true});if(flag){frame.insertAdjacentHTML('beforeend',flag);return frame;}
  }
  const fallback=document.createElement('span');fallback.className='minimised-participant-fallback';fallback.textContent=(identity.label||'?').split(/\s+/).map(word=>word[0]).join('').slice(0,2);frame.append(fallback);
  if(mark.url||mark.logo?.primary){const img=document.createElement('img');img.className='minimised-participant-mark';img.alt='';img.width=20;img.height=20;img.loading='lazy';img.decoding='async';img.onerror=()=>img.remove();applyTeamLogoAsset(img,mark,'icon',themeUsesDarkAssets());frame.append(img);}
  return frame;
}
function buildCompactCardSummary(ev){
  const summary=document.createElement('button');summary.type='button';summary.className='compact-card-summary minimised-card-summary';summary.dataset.cardArea='essentials';
  const value=NOTHINGSPORTS_CARD_TIMING.minimised(ev,nowAEST());
  if(ev.timePrecision==='not-before'&&!NOTHINGSPORTS_CARD_TIMING.played(ev))summary.dataset.timePrecision='not-before';
  const overview=ev.tournamentParent||ev.isEditionOverview||ev.majorEventMarker||['tennis_parent','golf_tournament','tournament_overview'].includes(ev.cardType);
  let identities=overview?[]:matchupIdentityMatches(ev,compactFixtureName(ev));
  const tennis=['tennis','wimbledon'].includes(ev.key);
  if(tennis&&!overview&&identities.length!==2){
    let sides=ev.matchupSides||[];
    if(sides.length!==2&&ev.participants?.length===2)sides=ev.participants.map(player=>({players:[typeof player==='string'?{name:player}:player]}));
    if(sides.length===2)identities=NOTHINGSPORTS_FIXTURE_LABELS.australianFirst(sides,ev,cardIdentityParticipants()).map(side=>{
      const players=side.players||[],person=players[0]||{},known=NOTHINGSPORTS_FIXTURE_LABELS.participantRecord(person,ev,cardIdentityParticipants());
      return {participant:{...known,id:person.id||person.playerId||known.id},label:players.map(p=>NOTHINGSPORTS_FEED_CARD_PRESENTATION.metadataLabel(p.name||p.displayName||'Player unavailable')).join(' / '),shortLabel:players.map(p=>{const record=NOTHINGSPORTS_FIXTURE_LABELS.participantRecord(p,ev,cardIdentityParticipants());return NOTHINGSPORTS_FEED_CARD_PRESENTATION.metadataLabel(record.shortName||record.familyName||record.lastName||p.shortName||p.name||p.displayName||'Player unavailable');}).join('/')};
    });
  }
  const name=document.createElement('span');name.className='compact-card-name minimised-card-name';
  const label=document.createElement('span');label.className='minimised-card-label';
  if(identities.length===2){
    const short=identities.map(side=>NOTHINGSPORTS_FEED_CARD_PRESENTATION.metadataLabel(side.shortLabel||NOTHINGSPORTS_FEED_CARD_PRESENTATION.shortLabel(side.participant?.id||side.mark?.id,NOTHINGSPORTS_FEED_CARD_PRESENTATION.displayLabel(side.mark?.id,side.mark?.label||side.label),side.participant)));
    label.textContent=short.join(' v ');name.append(buildMinimisedParticipant(identities[0],ev),label,buildMinimisedParticipant(identities[1],ev));
  }else{label.textContent=overview?ev.name:compactFixtureName(ev);const brand=CARD_IDENTITIES.markForEvent(ev);if(brand&&(brand.url||brand.logo?.primary))name.append(buildMinimisedParticipant({mark:brand,label:ev.name},ev));name.append(label);}
  const format=document.createElement('span');format.className='minimised-card-format';
  const gender=NOTHINGSPORTS_FIXTURE_LABELS.gender(ev),kind=compactFixtureFormat(ev);
  format.textContent=tennis?fixtureCompetitionLabel(ev):ev.key==='cricket'?[gender==='men'?'Men’s':gender==='women'?'Women’s':gender==='mixed'?'Mixed':'',kind].filter(Boolean).join(' '):kind;
  const progress=document.createElement('span');progress.className='minimised-card-progress';
  const context=tennis?NOTHINGSPORTS_FIXTURE_LABELS.tennisContext(ev):null;
  progress.textContent=overview?value.progress||'':value.progress||(context?.round==='Final'?'FINAL':context?.round)||compactFixtureStage(ev,format.textContent);
  if(progress.textContent)summary.dataset.progress=progress.textContent;
  const time=document.createElement('span');time.className='compact-card-time minimised-card-time';time.textContent=value.time;
  summary.dataset.longTiming=String(time.textContent.length>14);
  summary.dataset.longProgress=String(progress.textContent.length>20);
  summary.append(name,format,progress,time);
  summary.setAttribute('aria-label',`${spoilerSafeDisplayTitle(ev)}. ${format.textContent}. ${progress.textContent}. ${value.ariaLabel}. Expand card`);summary.title=summary.getAttribute('aria-label');
  return summary;
}
function mountMinimisedCard(card,ev,activate){
  card.classList.add('is-compact-row','is-minimised-row');card.dataset.cardLevel='L0';card.removeAttribute('tabindex');card.removeAttribute('aria-keyshortcuts');
  for(const child of [...card.children])if(!child.classList.contains('calendar-select-label'))child.remove();
  const summary=buildCompactCardSummary(ev);
  summary.onclick=event=>{event.stopPropagation();const mounted=summary.closest('.event-card')||card,choice=mounted.querySelector('[data-calendar-id]');if(calendarChoice.active&&activeTab==='feed'&&choice){if(!choice.disabled)choice.click();return;}activate('selected',{restoreFocus:event.detail===0,focusTarget:mounted});};
  card.append(summary);
  if(globalThis.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS?.viewing(ev)&&!calendarChoice.active)appendEventQuickActions(card,ev,{reminder:false,chat:false,highlightsOnly:true});
  return card;
}
function refreshMinimisedCard(card,ev){
  const row=card.querySelector('.minimised-card-summary');if(!row)return;
  const fresh=buildCompactCardSummary(ev);syncElementAttributes(row,fresh);row.replaceChildren(...fresh.childNodes);
}


function buildDetailedEventCard(ev, options = {}){
  const meta = sportMetaForEvent(ev);
  const status = getEventStatus(ev);
  const timingState = FEED_CONTROLS?.timingState?.(ev, nowAEST()) || null;
  const presentation = surfacePresentationForEvent(ev);
  const enrichment = eventEnrichment(ev);
  const actual = getActual(ev);
  const displayTitle = spoilerSafeDisplayTitle(ev);
  const isTeamMatchup = CARD_IDENTITIES?.isTeamSportMatchup?.(ev, displayTitle) || false;
  const upgraded = isUpgrade(ev) && isSpoilerVisible(ev);
  const mode = options.mode || "calendar";
  const matchupIdentity = isTeamMatchup && mode !== "premium-rail" ? buildMatchupIdentity(ev, displayTitle) : null;
  const soloIdentity = !matchupIdentity && mode !== "premium-rail";
  const expandable = mode !== "premium-rail";
  const storedState = expandable ? cardStateForEvent(ev) : "compact";
  const state = storedState;
  const importanceColor = importanceColorForEvent(ev);
  const spoilerVisible = isSpoilerVisible(ev);
  const displayedResult = status === "past" ? buildCompactResult(ev, displayTitle) : null;
  const protectedFacts = spoilerFactsForEvent(ev);
  const hasSpoilerFacts = hasSpoilerSensitiveContent(ev, protectedFacts, status);
  const spoilerProtected = !spoilerVisible && hasSpoilerFacts;
  const localGame = isLocalGame(ev);
  const recommendationClass = eventRecommendationClassification(ev);
  const action = getEventAction(ev);
  const isMinimised = activeTab!=="feed" && Boolean(action.isMinimised);
  const card = document.createElement("article");
  let interactionCard = options.interactionCard || card;
  card._retargetCard=target=>{interactionCard=target;card._mountedCard=target;};
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
    ["adjacent", "discovery"].includes(recommendationClass) ? "is-discovery" : "",
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
  card.dataset.recommendationClassification = recommendationClass;
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
    if(getEventAction(ev).isMinimised) updateEventAction(ev, {isMinimised:false});
    if(nextState==="opened")recordEventFeedAction(ev, "open", { surface:"card-content" });
    setCardState(ev, nextState);
    refreshExpandableCard(interactionCard, buildEventCard(profileFixtureEvents.get(String(ev.eventId||ev.id))||ev, {...options, interactionCard}), {restoreFocus,focusTarget});
    syncNothingscoreReadRecovery();
  };
  if (expandable) bindCardCycle(card, ({restoreFocus=false}={}) => {
    renderCardState(nextCardState(state),{restoreFocus,focusTarget:interactionCard});
  });
  card.dataset.cardLevel = cardLevelForState(state);
  card.setAttribute("aria-expanded", String(state !== "compact" && !isMinimised));
  if(expandable)card.appendChild(buildCardDisclosureControl(displayTitle,state,renderCardState));
  if ((state === "compact" || isMinimised) && expandable){
    return mountMinimisedCard(card,ev,renderCardState);
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
  if(activeTab==='feed'||activeTab==='events'||mode==='schedule')composeFeedCard(card,ev,{compact:false,renderCardState,mode});
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
 if(!(ev.key==='horse-racing'||isSpoilerVisible(ev)&&(ev.score?.racing||/^(f1|supercars|motogp|wrc|horse-racing)$/.test(ev.key)||ev.key==='cricket'||/football|soccer|fifa|premier-league|uefa-/.test(ev.key))))return null;
 const slot=document.createElement('div');slot.dataset.cardArea='expanded-information';slot.className='fixture-scorecard';
 loadDeferredScript('config/score-details.js?v=527').then(()=>NOTHINGSPORTS_SCORE_DETAILS.feed(slot,ev,()=>isSpoilerVisible(ev))).catch(()=>{if(slot.isConnected&&isSpoilerVisible(ev))slot.textContent='Scorecard unavailable.';});return slot;
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
        const fullName=NOTHINGSPORTS_FEED_CARD_PRESENTATION.metadataLabel(player.name || player.displayName || "Player unavailable");
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
    } else group.textContent = NOTHINGSPORTS_FEED_CARD_PRESENTATION.metadataLabel(side.name || side.displayName || "Side unavailable");
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
    closingCopy:opened && (ev.key==='horse-racing'||!helper.completed(ev)) ? uniqueCopy(ev.editorialNarrative?.closingCopy) : '',
    supplementalCopy:isValidatedEditorialCopy(supplemental) ? supplemental : "",
  });
}

function eventMeetsDerivedRetention(ev, reference = nowAEST()){
  if(!reference||typeof reference.getTime!=='function'||!Number.isFinite(+reference))reference=nowAEST();
  if(getEventAction(ev).isPurged||globalThis.NOTHINGSPORTS_EPIC.retired(ev,reference))return false;
  if(CARD_LIFECYCLE.currentPlayUntil(ev,reference))return true;
  if(!NOTHINGSPORTS_FIXTURE_IDENTITY.retainedInActiveTimeline(ev,reference)||!CARD_LIFECYCLE.withinFeedWindow(ev,reference))return false;
  if((ev.date || ev.startDate)===NOTHINGSPORTS_CALENDAR.sydneyDay(reference))return true;
  const effectiveReference = reference && typeof reference.getTime === "function" && Number.isFinite(reference.getTime())
    ? new Date(reference.getTime())
    : nowAEST();
  return CARD_LIFECYCLE
    ? CARD_LIFECYCLE.isWithinRetention(ev, effectiveReference, { action: getEventAction(ev) })
    : true;
}

function eventIsAutoArchived(ev, reference = nowAEST()){
  if(CARD_LIFECYCLE.currentPlayUntil(ev,reference))return false;
  if((ev.date || ev.startDate)===NOTHINGSPORTS_CALENDAR.sydneyDay(reference))return false;
  const effectiveReference = reference && typeof reference.getTime === "function" && Number.isFinite(reference.getTime())
    ? new Date(reference.getTime())
    : nowAEST();
  return CARD_LIFECYCLE
    ? CARD_LIFECYCLE.shouldAutoArchive(ev, effectiveReference, getEventAction(ev))
    : false;
}


function followedHomeTag(event){
  const ids=FOLLOW_FEED_POLICY.participantIds(event), key=FOLLOW_FEED_POLICY.sportKey(event);
  const followed=ids.filter(id=>cachedParticipantFollow(id).followed);
  const homeId=event.homeParticipantId || event.homeTeamId;
  if(followed.some(id=>id.startsWith('team:') && id===homeId))return 'Home game';
  const country=COUNTRY_FLAGS?.alpha2(event.venueCountryCode || event.countryCode || event.location?.countryCode);
  if(!country)return '';
  const records=[...cardIdentityParticipants(),...Array.from(followDirectoryChunks.values()).flatMap(chunk=>chunk.records||[]),...(event.participants||[])];
  for(const id of followed){
    if(id.startsWith('team:'))continue;
    const record=records.find(p=>FOLLOW_FIRST.participantFollowIdentityKey(p.id||p.participantId)===FOLLOW_FIRST.participantFollowIdentityKey(id));
    if(country!==COUNTRY_FLAGS?.alpha2(record?.homeCountryCode||record?.nationalityCode||record?.countryCode||record?.metadata?.countryCode))continue;
    return key==='tennis'?'Home tournament':['f1','motogp','wrc','motorsport','cycling'].includes(key)?'Home race':'Home game';
  }
  return '';
}


function buildNothingscoreSummary(ev,{showAggregate=true}={}){
  const eventId = nothingscoreEventId(ev);
  nothingscoreEventRefs.set(eventId, ev);
  registerNothingscoreEvent(ev);
  const summary = buildNothingscorePeerResults(ev, nothingscoreSnapshots.get(eventId),{showAggregate});
  summary.classList.add("nsc-summary");
  summary.dataset.nscEventId = eventId;
  summary.dataset.nscShowAggregate=String(showAggregate);
  return summary;
}



function buildViewingProviderMark(viewing){
  const mark = document.createElement("span");
  mark.className = "provider-action-mark";
  mark.dataset.providerId = viewing.providerId;
  if (viewing.logoBackground) mark.style.setProperty("--provider-mark-bg", viewing.logoBackground);
  const showFallback = () => {
    const fallback = document.createElement("span");
    fallback.className = "provider-action-text-fallback";
    fallback.textContent = viewing.actionLabel || viewing.label;
    mark.classList.add("provider-action-mark-fallback");
    mark.replaceChildren(fallback);
  };
  if (!viewing.logoPath){
    showFallback();
    return mark;
  }
  const image = document.createElement("img");
  image.className = "provider-action-logo";
  image.alt = `${viewing.label} logo`;
  image.decoding = "async";
  image.loading = "lazy";
  image.width = 64; image.height = 32;
  image.addEventListener("error", showFallback, { once:true });
  image.src = viewing.logoPath;
  mark.appendChild(image);
  return mark;
}

function nothingscorePhaseCopy(phase){
  return globalThis.NOTHINGSPORTS_EPIC.phaseCopy(phase);
}

function buildNothingscorePeerResults(ev,snapshot,{inDrawer=false,showAggregate=true}={}){
  const root=document.createElement('section');root.className='nsc-peer-results';
  root.dataset.cardArea='ratings';
  const watch=document.createElement('div');watch.className='fixture-watch-rating';watch.dataset.cardArea='rating-interaction';
  if(inDrawer)appendEventQuickActions(watch,ev,{reminder:false,chat:false});const rating=buildInlineCrowdRating(ev,snapshot);if(!rating.hidden)watch.appendChild(rating);if(watch.childElementCount)root.appendChild(watch);
  if(showAggregate){
    const peers=snapshot?.peerResults, summary=document.createElement('p');summary.className='nsc-peer-summary';summary.dataset.cardArea='rating-statistics';
    const phase=snapshot?.phase||({upcoming:'heat',live:'pulse',past:'impact'})[getEventStatus(ev)];
    const singular=peers?.count===1;
    const verb=phase==='heat'?(singular?'expects':'expect'):phase==='pulse'?(singular?'is rating this':'are rating this'):(singular?'has rated this':'have rated this');
    const failed=nothingscoreLoadErrors.has(nothingscoreEventId(ev));
    summary.textContent=peers?.count?`${peers.count} Nothinger${peers.count===1?'':'s'} ${verb} ${nothingscorePhaseCopy(phase).labels[Math.round(peers.rawAverage??peers.average)-1]} · ${Number(peers.average).toFixed(1)}/5${failed?' · Saved ratings; update unavailable':''}`:'';
    summary.hidden=!peers?.count;
    if(summary.textContent)root.appendChild(summary);
    const tags=document.createElement('div');tags.className='fixture-tags';
    const labels=[];const homeTag=followedHomeTag(ev);if(homeTag)labels.push(homeTag);if(NOTHINGSPORTS_PROMOTED_REPLAY.recommendation(ev,snapshot,phase))labels.push('Promoted replay');
    for(const tag of ev.consensusTags||[])if(['Rivalry','Derby','Round-Robin','Knockout','Final','Record Chase'].includes(tag.label)&&tag.sourceUrls?.some(url=>/^https:\/\//.test(url))&&Number(tag.confidence)>=.6)labels.push(tag.label);
    for(const label of new Set(labels)){const tag=document.createElement('span');tag.className='fixture-tag';tag.textContent=label.toUpperCase();tags.appendChild(tag);}if(tags.childElementCount)root.appendChild(tags);
  }
  if(nothingscoreLoadErrors.has(nothingscoreEventId(ev))){
    const recovery=nothingscoreReadRecoveryState(ev),retry=document.createElement('button');retry.type='button';retry.className='btn ghost nsc-rating-retry';retry.textContent=recovery.pending?'Retrying ratings…':'Retry ratings';retry.disabled=recovery.pending;
    retry.onclick=event=>{event.stopPropagation();retryNothingscoreRatings(ev);};root.append(retry);
    if(!snapshot?.peerResults?.count&&![...root.querySelectorAll('[role=status]')].some(node=>node.textContent)){const feedback=document.createElement('span');feedback.className='nsc-rating-status';feedback.setAttribute('role','status');feedback.textContent='Ratings unavailable';root.append(feedback);}
  }
  root.hidden=!root.childElementCount;return root;
}

function buildInlineCrowdRating(ev,snapshot){
  const root=document.createElement('div');root.className='nsc-inline-rating';
  const phase=snapshot?snapshot.phase:globalThis.NOTHINGSPORTS_EPIC.confirmedOngoing(ev)?'pulse':/^(completed|finished|final)$/.test(ev.status||'')?'impact':getEventStatus(ev)==='upcoming'?'heat':null;
  const awaitingViewer=Boolean(serverSyncClient?.sessionSubject())&&!snapshot;
  const copy=phase?nothingscorePhaseCopy(phase):{name:'Ratings',detail:'Awaiting match update',glyph:'ui:shockwave'};
  if(phase)root.dataset.ratingPhase=phase;
  const heading=document.createElement('span');heading.className='nsc-rating-phase';heading.textContent=copy.name+' · '+copy.detail;root.appendChild(heading);
  const group=document.createElement('div');group.className='nsc-rating-blocks';group.setAttribute('role','group');group.setAttribute('aria-label','Your '+copy.name+' rating out of five');
  const prompt=document.createElement('span');prompt.className='nsc-rating-prompt';
  const status=document.createElement('span');status.className='nsc-rating-status';status.setAttribute('role','status');
  const id=nothingscoreEventId(ev),owner=serverPersistence.user?.id;
  let chosen=phase?Number(snapshot?.currentUser?.contribution?.rating || snapshot?.currentUser?.submissions?.[phase]?.rating)||0:0;
  const paint=value=>{group.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('is-filled',i<value);b.classList.toggle('is-selected',i+1===value);b.setAttribute('aria-pressed',String(i+1===value));});prompt.textContent=value?copy.labels[value-1]:'';prompt.hidden=!value;};
  for(let value=1;value<=5;value++){
    const label=copy.labels?.[value-1]||copy.detail;
    const b=document.createElement('button');b.type='button';b.className='nsc-rating-block';b.setAttribute('aria-label',`${value} out of 5: ${label}`);b.title=`${value}/5 · ${label}`;b.disabled=awaitingViewer||!phase;
    b.innerHTML=glyphMarkup(copy.glyph);
    b.onclick=async()=>{
      if(!phase)return;
      if(!serverSyncClient?.sessionSubject()){status.textContent='Sign in to rate this fixture.';openSettings({section:'account'});return;}
      if(inlineRatingRequests.has(id))return;
      const previous=chosen;paint(value);status.textContent='Saving…';group.querySelectorAll('button').forEach(x=>x.disabled=true);
      const task=serverSyncClient.nothingscoreRequest({}, {action:phase==='pulse'?'pulse':'submit',eventId:id,phase,rating:value,tags:[]});inlineRatingRequests.set(id,task);
      try{
        const receipt=await task;if(owner!==(serverPersistence.user?.id))return;chosen=value;
        window.NOTHINGSPORTS_CROWD_RANKINGS?.clear?.();
        status.textContent=receipt.pointsAwarded?`+${receipt.pointsAwarded} points`:'Rating saved';
        if(receipt.pointsAwarded&&!matchMedia('(prefers-reduced-motion: reduce)').matches)status.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:300});
        if(value===5){root.classList.add('is-epic-burst');setTimeout(()=>root.classList.remove('is-epic-burst'),700);}
        const prior=nothingscoreSnapshots.get(id)||snapshot;mergeNothingscoreSnapshot({...prior,currentUser:{...prior.currentUser,contribution:{rating:value},submissions:{...prior.currentUser?.submissions,[phase]:receipt}}});
        const readGeneration=nothingscoreReadGeneration;
        try{
          const fresh=await serverSyncClient.nothingscoreRequest({eventId:id});
          if(owner===(serverPersistence.user?.id)&&readGeneration===nothingscoreReadGeneration){
            if(!fresh.detail)throw Error('Community summary unavailable');
            nothingscoreReadRecovered(id);mergeNothingscoreSnapshot(fresh.detail);
          }
        }catch(error){if(owner===(serverPersistence.user?.id)&&readGeneration===nothingscoreReadGeneration){nothingscoreReadFailed(id);status.textContent='Rating saved. Community ratings could not refresh.';}}
      }catch(error){chosen=previous;status.textContent=`${error.message || 'Could not save.'} Tap to retry.`;paint(chosen);}
      finally{inlineRatingRequests.delete(id);group.querySelectorAll('button').forEach(x=>x.disabled=false);if(owner===(serverPersistence.user?.id))nothingscoreQueueRender();}
    };group.appendChild(b);
  }
  if(awaitingViewer&&phase){
    const failed=nothingscoreLoadErrors.has(id);
    status.textContent=failed?'Ratings are temporarily unavailable. Retry to check your saved rating.':'Checking your rating…';
  }
  paint(chosen);root.append(group,prompt);
  root.append(status);return root;
}

function buildNothingscoreReceipt(receipt, phaseName){
  const row = document.createElement("div");
  row.className = "nsc-receipt nsc-submission-receipt";
  row.setAttribute("role", "status");
  const cheer = document.createElement("strong"); cheer.textContent = "Submitted ✓";
  const copy = document.createElement("span");
  copy.textContent = `${phaseName} ${Number(receipt?.rating || 0)}/5${receipt?.tags?.length ? ` · ${receipt.tags.join(" · ")}` : ""}`;
  const results = document.createElement("button"); results.type = "button"; results.textContent = "View results";
  results.addEventListener("click", event => {
    event.stopPropagation();
    const details = row.closest(".nsc-panel")?.querySelector(".nsc-peer-results details");
    if (details){ details.open = true; details.scrollIntoView({block:"nearest"}); }
  });
  row.append(cheer,copy,results);
  return row;
}

function buildNothingscorePending(ev,phase){
  const row = document.createElement("div"); row.className = "nsc-submission-receipt is-confirming";
  row.setAttribute("role","status"); row.textContent = "Confirming your rating…";
  const retry = document.createElement("button"); retry.type = "button"; retry.className = "btn ghost"; retry.textContent = "Check confirmation";
  retry.addEventListener("click", async () => {
    retry.disabled = true;
    await reconcileNothingscoreSubmission(nothingscoreEventId(ev),phase);
    retry.disabled = false;
    if (activeNothingscoreContributionEvent === ev) renderNothingscoreDrawer();
  });
  row.appendChild(retry); return row;
}

function buildNothingscorePanel(ev,snapshot){
 const panel=document.createElement('section');panel.className='nsc-panel';panel.dataset.nscPanel=nothingscoreEventId(ev);
 const back=document.createElement('button');back.type='button';back.className='btn ghost';back.textContent='Back to rankings';back.onclick=()=>{activeNothingscoreContributionEvent=null;renderCrowdRankings();};
 const timing=document.createElement('p');timing.textContent=NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST()).fullSchedule;
 panel.append(back,timing,buildNothingscorePeerResults(ev,snapshot,{inDrawer:true}));
 const incentive=document.createElement('p');incentive.className='nsc-note';incentive.textContent='Earn 1 point for Heat, plus 19 when another Nothinger matches it live or afterwards.';panel.appendChild(incentive);
 return panel;
}

function buildSpoilerOverrideControl(ev){
  const state = getEventSpoilerState(ev);
  const visible = isSpoilerVisible(ev);
  const status = getEventStatus(ev);
  const control = document.createElement("div");
  control.className = "spoiler-control";

  const copy = document.createElement("span");
  copy.className = "spoiler-control-copy";
  copy.textContent = `${status === "past" ? "Past" : status === "live" ? "Live" : "Upcoming"} event · Global results ${userPreferences.showSpoilers ? "shown" : "hidden"} · ${state.override === "inherit" ? "Uses global setting" : state.override === "show" ? "Results shown" : "Results hidden"}`;
  control.appendChild(copy);

  if (userPreferences.feedControls?.spoilers === "strict"){
    copy.textContent = `${status === "past" ? "Past" : status === "live" ? "Live" : "Upcoming"} event · Strict spoiler protection is active`;
    return control;
  }

  const toggle = document.createElement("button");
  toggle.className = "spoiler-reveal-btn";
  toggle.textContent = visible ? "Hide results" : "Show results";
  toggle.addEventListener("click", evt => {
    evt.stopPropagation();
    if (visible){
      hideSpoilersForEvent(ev);
      renderCurrentSection();
      showToast("Results hidden for this event.");
      return;
    }
    if (window.confirm("Show results for this event?")){
      revealSpoilerDetails(ev);
      renderCurrentSection();
      showToast("Results shown for this event.");
    }
  });
  control.appendChild(toggle);

  if (state.override !== "inherit"){
    const reset = document.createElement("button");
    reset.className = "spoiler-reveal-btn";
    reset.textContent = "Use global setting";
    reset.addEventListener("click", evt => {
      evt.stopPropagation();
      resetSpoilerOverride(ev);
      renderCurrentSection();
      showToast("This event now follows the global spoiler setting.");
    });
    control.appendChild(reset);
  }

  return control;
}

function buildSpoilerOverrideButton(ev, refreshCard){
  const visible = isSpoilerVisible(ev);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-footer-button";
  button.textContent = userPreferences.feedControls?.spoilers === "strict"
    ? "Results hidden"
    : visible ? "Hide results" : "Show results";
  button.disabled = userPreferences.feedControls?.spoilers === "strict";
  button.addEventListener("click", event => {
    event.stopPropagation();
    if (visible){
      hideSpoilersForEvent(ev);
      refreshCard?.();
      showToast("Results hidden for this event.");
      return;
    }
    if (window.confirm("Show results for this event?")){
      revealSpoilerDetails(ev);
      refreshCard?.();
      showToast("Results shown for this event.");
    }
  });
  return button;
}

function buildCricketInnings(ev,{localReveal=false}={}){
  if(ev.key!=='cricket'||!ev.innings?.length||!['completed','finished','past','live','ongoing','in_progress','in-progress','stumps','rain-delay','interrupted','suspended','break'].includes(ev.status)||globalThis.NOTHINGSPORTS_COVERAGE_PAUSES?.womensT20(ev))return null;
  if(globalThis.NOTHINGSPORTS_CRICKET_INNINGS)return NOTHINGSPORTS_CRICKET_INNINGS.build(ev);
  const slot=document.createElement('div');
  loadDeferredScript('config/cricket-innings.js?v=486').then(()=>{if(slot.isConnected&&(localReveal||isSpoilerVisible(ev)))slot.replaceChildren(NOTHINGSPORTS_CRICKET_INNINGS.build(ev)||'');}).catch(()=>{if(slot.isConnected&&(localReveal||isSpoilerVisible(ev)))slot.textContent='Innings details are unavailable.';});
  return slot;
}

function buildCompactResult(ev, displayTitle = ""){
  const result = compactResultForEvent(ev);
  if (!result) return null;

  const wrap = document.createElement("div");
  wrap.className = "card-result-line";
  wrap.setAttribute("aria-label", "Final result");

  const tennis=CARD_RESULTS.tennisSets(ev,displayTitle,result);
  if(tennis){
    const table=document.createElement('table');table.className='tennis-set-table';table.setAttribute('aria-label','Tennis result by set');
    const header=document.createElement('tr');for(const label of ['Player',...tennis.sets.map(s=>s.label)]){const th=document.createElement('th');th.scope='col';th.textContent=label;header.append(th);}const thead=document.createElement('thead');thead.append(header);table.append(thead);
    const tbody=document.createElement('tbody');tennis.names.forEach((name,i)=>{const row=document.createElement('tr'),player=document.createElement('th');player.scope='row';player.textContent=name;row.append(player);for(const set of tennis.sets){const cell=document.createElement('td'),score=set.scores[i];cell.textContent=String(score.games);if(score.tieBreak!==null){const sup=document.createElement('sup');sup.textContent=String(score.tieBreak);sup.setAttribute('aria-label',`${score.tieBreak} tie-break points`);cell.append(sup);}row.append(cell);}tbody.append(row);});table.append(tbody);wrap.append(table);if(tennis.status){const label=document.createElement('span');label.textContent=tennis.status;wrap.append(label);}return wrap;
  }
  const score = document.createElement("span");
  score.className = "card-result-score";
  score.textContent = scoreLineForDisplay(ev, displayTitle, result);
  wrap.appendChild(score);
  const innings=buildCricketInnings(ev);if(innings)wrap.append(innings);
  return wrap;
}

function scheduleScopeForEvent(ev){
  const codeId=codeIdForEvent(ev);
  const tournamentId=ev.tennisTournamentId || ev.tournamentId || '';
  const competitionId=ev.competitionId || '';
  const tournamentMark=['tennis','wimbledon'].includes(ev.key)?CARD_IDENTITIES?.markForCompetitionId(ev.competitionId):null;
  const label=ev.tournamentName || ev.competitionName || (tournamentMark?.id?.startsWith('brand:')?tournamentMark.label:'') || ev.majorEventName || (ev.stage==='Major'?ev.name:ev.key==='masters'?'Masters':codeId==='sport:f1'?'F1':'') || codeInspectorManifest?.codes?.find(c=>c.id===codeId)?.label || sportMetaForEvent(ev).label || ev.key || 'Sport';
  return {codeId,tournamentId,competitionId,label};
}

function buildFeedScheduleLink(ev){
  const scope=scheduleScopeForEvent(ev),link=document.createElement('a');
  link.className='feed-schedule-link';link.textContent=NOTHINGSPORTS_FIXTURE_LABELS.displayName(scope.label,ev);link.href=codeInspectorHash(scope.codeId);
  link.title=`See full ${scope.label} schedule`;link.setAttribute('aria-label',link.title);link.onfocus=()=>showToast(link.title);
  let timer=null,longPress=false;
  link.onpointerdown=()=>{longPress=false;timer=setTimeout(()=>{longPress=true;showToast(link.title);},550);};
  for(const type of ['pointerup','pointercancel','pointerleave'])link.addEventListener(type,()=>clearTimeout(timer));
  link.oncontextmenu=e=>{e.preventDefault();};
  link.onclick=async e=>{e.preventDefault();e.stopPropagation();if(longPress)return;
    saveFollowBrowse({scheduleScope:scope,sportId:'sport:'+NOTHINGSPORTS_SURFACE_CATEGORY.category(ev),categoryId:''});
    if(scope.tournamentId&&['tennis','wimbledon'].includes(ev.key)){await loadTennisScheduleUi();tennisSelectedEdition=scope.tournamentId;}
    await openCodeInspector(scope.codeId);
  };
  return link;
}

function configureProviderLaunch(link, viewing){
  let target = viewing.webUrl || viewing.universalUrl || viewing.url, appHandoff = false;
  // Stan associates its player host with the installed apps. Its /watch/sport
  // marketing pages have no iOS association; do not invent a match permalink.
  if(viewing.providerId==='stan'&&typeof navigator!=='undefined'&&(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||/Macintosh/i.test(navigator.userAgent||'')&&navigator.maxTouchPoints>1)){
    try{
      const url=new URL(target);
      if(/^https:\/\/(www\.)?stan\.com\.au$/.test(url.origin)&&/^\/watch\/sport(?:\/|$)/.test(url.pathname)){target='https://play.stan.com.au/sport';appHandoff=true;}
      else if(url.origin==='https://play.stan.com.au')appHandoff=true;
    }catch(_error){}
  }
  link.href = /^https:\/\//i.test(String(target || "")) || viewing.highlights&&/^\/api\/fixtures\?mode=highlight&ids=[-a-z0-9_%]+$/i.test(target||'') ? target : "#";
  link.target = appHandoff ? "_self" : "_blank";
  link.rel = "noopener noreferrer external";
}

function viewingAccessLabel(viewing){
  switch(viewing.accessType){
    case 'free': return 'Free';
    case 'subscription': return 'Subscription';
    case 'ppv': return 'Pay-per-view';
    case 'included': return 'Included in plan';
    default: return 'Check cost';
  }
}

function appendEventQuickActions(container, ev, { reminder = true, chat = true, viewing = true, highlightsOnly = false } = {}){
  const viewingPaused=globalThis.NOTHINGSPORTS_COVERAGE_PAUSES?.womensT20(ev);
  const actions = document.createElement("div");
  actions.className = "event-quick-actions";
  const viewingLinks = viewing&&!highlightsOnly&&!viewingPaused ? FOLLOW_FIRST.viewingOptions(ev,userPreferences.followFirst?.subscriptions||[]).filter(p=>(!p.territory||['AU','GLOBAL'].includes(p.territory))&&(p.liveOrReplay!=='replay'||p.replayVerified)) : [];
  const highlights=globalThis.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS?.viewing(ev);
  if(viewing&&highlights&&(!highlights.highlightsFeedOnly||activeTab==='feed'))viewingLinks.unshift({...FOLLOW_FIRST.VIEWING_PROVIDERS.youtube,...highlights});
  if(highlightsOnly&&!viewingLinks.length)return;
  if(viewing&&viewingLinks.length){
    const row=document.createElement('div');row.className='fixture-providers';row.setAttribute('aria-label','Viewing providers');
    for(const viewingLink of viewingLinks){
      const link=document.createElement('a');link.className='event-quick-action provider-link'+(viewingLink.highlights?' fixture-highlights-link':'');
      configureProviderLaunch(link,viewingLink);
      const verb=viewingLink.highlights?viewingLink.highlightsLabel:viewingLink.liveOrReplay==='replay'?'Replay':'Watch';
      const access=viewingAccessLabel(viewingLink);
      link.title=`${verb} on ${viewingLink.label}${viewingLink.highlightsTopResult?' · Selected highlights; match not verified':viewingLink.highlightsSearch?' · Opens a fixture search':` · ${access}`}`;link.setAttribute('aria-label',link.title);link.appendChild(buildViewingProviderMark(viewingLink));
      const cost=document.createElement('span');if(!viewingLink.highlights)cost.className='provider-access';cost.textContent=viewingLink.highlights?verb:access;link.appendChild(cost);
      link.addEventListener('click',event=>{event.stopPropagation();if(viewingLink.highlights){const current=globalThis.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS?.viewing(ev);if(!current||current.highlightsFeedOnly&&activeTab!=='feed'){event.preventDefault();return;}configureProviderLaunch(link,current);}else recordCodeAffinity(codeIdForEvent(ev),viewingLink.liveOrReplay==='replay'?'replay':'watch');});row.append(link);
    }
    actions.append(row);
  }
  if (reminder && getEventStatus(ev) === "upcoming"){
    const timing = eventReminderTiming(ev);
    const reminderButton = document.createElement("button");
    reminderButton.type = "button";
    reminderButton.className = "event-quick-action primary";
    const reminderRequested = Boolean(getEventAction(ev).reminderRequested);
    reminderButton.dataset.reminderPrecision = ev.timePrecision || "";
    reminderButton.dataset.reminderActionKey = eventActionKey(ev);
    reminderButton.dataset.reminderAliases = EVENT_ACTION_IDENTITY.aliasesForEvent(ev).join("|");
    reminderButton.setAttribute("aria-pressed", String(reminderRequested));
    reminderButton.title = timing?.fallback
      ? "Background notification 15 minutes before the published broadcast time because a kickoff or race start is not available."
      : "Background notification 15 minutes before kickoff or race start.";
    renderQuickReminderButton(reminderButton, reminderRequested, {fixture:ev});
    reminderButton.addEventListener("click", event => {
      event.stopPropagation();
      void toggleQuickReminder(ev, reminderButton);
    });
    actions.appendChild(reminderButton);
  }
  if (chat){
    actions.dataset.fixtureChatId = nothingscoreEventId(ev);
    nothingscoreEventRefs.set(nothingscoreEventId(ev),ev);
    appendFixtureChatActions(actions, ev);
  }
  if(!highlightsOnly&&/^cricket(?:-women)?$/.test(ev.key||'')){
    void loadDeferredScript('assets/js/milestone-alerts-ui.js?v=535').then(()=>NOTHINGSPORTS_MILESTONE_UI.appendMute(actions,ev));
  }
  container.appendChild(actions);
  return actions;
}

function renderEventIdentityMark(container, ev, meta){
  const mark = CARD_IDENTITIES?.markForEvent(ev);
  if (mark?.id) container.dataset.cardIdentity = mark.id;
  else delete container.dataset.cardIdentity;
  const renderFallback = () => {
    container.classList.remove("has-brand-logo", "has-sport-logo");
    container.replaceChildren();
    if(container.classList.contains('follow-sport-mark') && meta.glyph){container.innerHTML=glyphMarkup(meta.glyph,{className:'vector-glyph',label:meta.label});return;}
    const label=document.createElement('span');label.className='event-sport-wordmark';label.textContent=mark?.wordmark||mark?.label||meta.label;container.append(label);
  };
  if (mark?.kind === "wordmark" && mark.wordmark){
    container.classList.remove("has-brand-logo", "has-sport-logo");
    container.dataset.identityWordmarkLight = mark.themeColor?.light || "#ff1e00";
    container.dataset.identityWordmarkDark = mark.themeColor?.dark || "#ffffff";
    const wordmark = document.createElement("span");
    wordmark.className = "event-identity-wordmark";
    wordmark.textContent = mark.wordmark;
    wordmark.style.color = themeUsesDarkAssets() ? container.dataset.identityWordmarkDark : container.dataset.identityWordmarkLight;
    container.replaceChildren(wordmark);
    return;
  }
  if (mark?.kind === "vector" && mark.glyph){
    const vectorEntry = VECTOR_ASSETS?.openUse?.[mark.glyph] || VECTOR_ASSETS?.custom?.[mark.glyph];
    if (vectorEntry){
      container.classList.remove("has-brand-logo");
      container.classList.add("has-sport-logo");
      const vector = document.createElement("span");
      vector.className = "event-sport-mark nrl-finals-trophy-mark";
      vector.innerHTML = glyphMarkup(mark.glyph, { className:"event-sport-logo", label:mark.label });
      container.replaceChildren(vector);
      return;
    }
    if (mark.fallback?.url){
      ev = { ...ev, key:"nrl", brandId:null };
      return renderEventIdentityMark(container, ev, meta);
    }
  }
  if (mark?.kind === "sport" && mark.glyph){
    renderFallback();return;
  }
  if (!mark?.url){
    renderFallback();
    return;
  }
  const image = document.createElement("img");
  image.className = "event-brand-logo";
  installIdentityImageRecovery(image);
  const logoContext = container.matches(".event-hero-mark,.major-event-logo") ? "primary" : "icon";
  const lightSource = CARD_IDENTITIES?.logoForTheme?.(mark, { context:logoContext, useDark: false }) || mark.url;
  const darkSource = CARD_IDENTITIES?.logoForTheme?.(mark, { context:logoContext, useDark: true }) || lightSource;
  image.dataset.eventLogoLight = lightSource;
  image.dataset.eventLogoDark = darkSource;
  assignCardImageSource(image, themeUsesDarkAssets() ? darkSource : lightSource);
  image.alt = mark.label;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", renderFallback, { once: true });
  container.classList.remove("has-sport-logo");
  container.classList.add("has-brand-logo");
  const placeholder = document.createElement("span");
  placeholder.className = "event-sport-mark identity-image-placeholder";
  placeholder.innerHTML = glyphMarkup(meta.glyph, { label:meta.label, preferImage:true });
  if(container.classList.contains('compact-card-icon')) container.replaceChildren(image);
  else container.replaceChildren(placeholder, image);
}

function appendTeamIdentityFallback(container, mark, label, className = "team-logo-fallback"){
  if (mark?.isNationalTeam || mark?.teamKind === "national"){
    const unavailable = document.createElement("span");
    unavailable.className = `${className} national-team-logo-unavailable`;
    unavailable.setAttribute("role", "img");
    unavailable.setAttribute("aria-label", `${label || mark?.label || "National team"} official identity unavailable`);
    container.appendChild(unavailable);
    return;
  }
  const flagMarkup = COUNTRY_FLAGS?.flagMarkup?.(mark?.fallbackCountryCode || mark?.countryCode, { className, label });
  if (flagMarkup){
    container.insertAdjacentHTML("beforeend", flagMarkup);
    return;
  }
  const monogram = document.createElement("span");
  monogram.className = `${className} team-logo-monogram`;
  monogram.setAttribute("aria-label", label);
  monogram.textContent = String(label || mark?.label || "TBD").split(/\s+/).map(word => word[0]).join("").slice(0, 3).toUpperCase() || "TBD";
  container.appendChild(monogram);
}

function renderEventTitleIdentity(nameElement, ev, displayTitle, options){
  displayTitle=NOTHINGSPORTS_FIXTURE_LABELS.matchupTitle(ev,displayTitle,cardIdentityParticipants());
  const compact=Boolean(options?.compact);
  if((ev.key==='tennis'||ev.key==='wimbledon')&&!/hidden|winner of|loser of|TBC|TBD/i.test(displayTitle)){
    const lineup=majorEventMatchupLineup(ev,{compact});
    if(lineup){nameElement.appendChild(lineup);return;}
  }
  const identities = CARD_IDENTITIES?.participantMarksForEvent(ev, cardIdentityParticipants(), displayTitle) || [];
  const matches = identities
    .map(identity => ({ ...identity, range: CARD_IDENTITIES.aliasRange(displayTitle, identity.participant) }))
    .filter(identity => identity.range)
    .sort((left, right) => left.range.start - right.range.start)
    .filter((identity, index, all) => index === 0 || identity.range.start >= all[index - 1].range.end);
  if (!matches.length){
    nameElement.textContent = displayTitle;
    if(!compact)appendFollowedFixtureParticipants(nameElement,ev);
    return;
  }
  nameElement.setAttribute("aria-label", displayTitle);
  let cursor = 0;
  matches.forEach(({ mark, range, participant }) => {
    if (range.start > cursor) nameElement.append(document.createTextNode(displayTitle.slice(cursor, range.start)));
    const teamName = document.createElement("span");
    teamName.className = "team-name-with-logo";
    const appendFlagFallback = () => appendTeamIdentityFallback(teamName, mark, mark.label, "team-logo-fallback team-name-logo-fallback");
    if (mark.url || mark?.logo?.primary){
      appendFlagFallback();
      const logo = document.createElement("img");
      logo.className = "team-logo";
      logo.alt = "";
      logo.loading = "lazy";
      logo.decoding = "async";
      logo.referrerPolicy = "no-referrer";
      applyTeamLogoAsset(logo, mark, "icon");
      logo.addEventListener("error", () => logo.remove(), { once: true });
      teamName.appendChild(logo);
    } else {
      appendFlagFallback();
    }
    const label = participantProfileLink(participant?.id || mark?.id,range.text,ev.key);
    teamName.appendChild(label);
    nameElement.appendChild(teamName);
    cursor = range.end;
  });
  if (cursor < displayTitle.length) nameElement.append(document.createTextNode(displayTitle.slice(cursor)));
}

function buildFixtureFallbackCard(event, options = {}){
  const ev = globalThis.NOTHINGSPORTS_FIXTURE_IDENTITY.normalizeCore(event);
  let card = document.createElement("article");
  card._retargetCard=target=>{card=target;};card._rebuildCard=()=>buildFixtureFallbackCard(ev,options);
  const mode = options.mode || "calendar";
  card.className = `event-card mode-${mode} is-compact-row is-fixture-fallback`;
  card.dataset.eventId = ev.eventId || ev.id;
  card.dataset.scrollKey = `event:${mode}:${ev.eventId || ev.id}`;
  card.dataset.cardMode = mode;
  card.dataset.cardState = "compact";
  card.dataset.cardLevel = "L0";
  if(cardStateForEvent(ev)==='compact'||getEventAction(ev).isMinimised){
    return mountMinimisedCard(card,ev,(state,settings)=>{if(getEventAction(ev).isMinimised)updateEventAction(ev,{isMinimised:false});setCardState(ev,state);refreshExpandableCard(card,buildFixtureFallbackCard(ev,options),settings);syncNothingscoreReadRecovery();});
  }
  if (options.inspectorFixture) card.dataset.inspectorFixtureId = options.inspectorFixture.id;
  const copy = document.createElement("div");
  copy.className = "compact-card-copy";
  const title = document.createElement("h3");
  title.className = "compact-card-name";
  if(ev.calendarNote){copy.style.minWidth="0";title.style.whiteSpace="normal";}
  let label = ev.name;
  try { label = spoilerSafeDisplayTitle(ev) || label; } catch {}
  title.textContent = label;
  const timing = document.createElement("p");
  timing.className = "compact-card-meta";
  timing.textContent = NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST()).fullSchedule;
  if(ev.calendarNote?.localDateLabel)timing.textContent=ev.calendarNote.localDateLabel+' · Sydney time unavailable';
  if(activeTab === 'feed')copy.appendChild(ev.calendarNote?.localDateLabel?timing:buildFixtureTimingGroup(ev));
  copy.append(title,...(ev.calendarNote&&activeTab==='feed'?[]:[timing]));
  if(ev.calendarNote){const note=document.createElement('p');note.className='code-inspector-note';note.textContent=ev.fullSpiel;const source=document.createElement('a');source.href=ev.calendarNote.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Organiser calendar';const links=document.createElement('div');links.className='event-card-secondary-actions';links.append(source,buildFeedScheduleLink(ev));copy.append(note,links);}
  if(activeTab !== 'feed'){
    const phase=NOTHINGSPORTS_CARD_TIMING.tournamentPhase(ev);
    if(phase)copy.appendChild(buildEventTimingStateChip(ev,phase));
  }
  card.append(copy,...(ev.calendarNote?[]:[buildFeedScheduleLink(ev)]));
  appendEventQuickActions(card,ev,{reminder:false,chat:false,highlightsOnly:true});
  if(options.inspectorFixture)appendSchedulePin(card,options.inspectorFixture,card);
  card.setAttribute("aria-label", `${label}. Fixture details.`);
  card.append(buildCardDisclosureControl(label,'selected',(state,settings)=>{setCardState(ev,state);refreshExpandableCard(card,buildFixtureFallbackCard(ev,options),settings);syncNothingscoreReadRecovery();}));
  return card;
}


function buildDetailedMajorEventCard(record, { interactionCard = null } = {}){
  const meta = sportMetaForEvent(majorEventIdentityEvent(record));
  const actionEvent = majorEventActionEvent(record);
  const eventAction = getEventAction(actionEvent);
  const isMinimised = Boolean(eventAction.isMinimised);
  const state = cardStateForEvent(record);
  const card = document.createElement("article");
  let eventCard = interactionCard || card;
  card._retargetCard=target=>{eventCard=target;};
  card._rebuildCard=()=> (eventCard.classList.contains("ticket-sale-card")?buildTicketSaleCard:buildMajorEventCard)(record,{interactionCard:eventCard});
  appendCalendarChoice(card,record);
  card.className = [
    "event-card",
    "mode-events",
    "major-event-card",
    "events-feed-card",
    state === "selected" ? "is-selected" : "",
    state === "opened" ? "is-opened" : "",
    isMinimised ? "is-event-minimised" : "",
  ].filter(Boolean).join(" ");
  card.id = `major-event-card-${record.id.replace(/[^a-z0-9_-]/gi, "-")}`;
  card.dataset.majorEventId = record.id;
  card.dataset.eventId = actionEvent.eventId || actionEvent.id;
  card.dataset.scrollKey = `major-event:${record.id}`;
  card.dataset.cardState = isMinimised ? "minimised" : state;
  card.dataset.cardLevel = isMinimised ? "L0" : cardLevelForState(state);
  card.tabIndex = 0;
  card.setAttribute("aria-expanded", String(!isMinimised && state !== "compact"));
  card.setAttribute("aria-label", `${record.name}. ${isMinimised ? "Minimised view" : state === "compact" ? "Compact view" : state === "selected" ? "Summary view" : "Full detail view"}.`);
  card.style.setProperty("--sport-color", meta.color);

  const renderMajorState = (nextState,{ restoreFocus = false,focusTarget=eventCard } = {}) => {
    if(getEventAction(actionEvent).isMinimised)updateEventAction(actionEvent, {isMinimised:false});
    activeMajorEventNowId = record.id;
    if(nextState==="opened")recordEventFeedAction(actionEvent, "open", { surface:"card-content" });
    setCardState(record, nextState);
    refreshExpandableCard(eventCard, (eventCard.classList.contains("ticket-sale-card") ? buildTicketSaleCard : buildMajorEventCard)(record, { interactionCard:eventCard }), {
      restoreFocus,
      focusTarget,
    });
  };
  bindCardCycle(card, options=>renderMajorState(nextCardState(cardStateForEvent(record)),options));
  card.appendChild(buildEventCardControls(actionEvent,{card:eventCard,eventsOnly:true,displayLabel:record.name}));
  card.appendChild(buildCardDisclosureControl(record.name,state,renderMajorState));
  if(isMinimised || state==='compact'){
    return mountMinimisedCard(card,{...record,key:record.sportKey,date:record.startDate,time:null,isEditionOverview:true,dateOnly:true},renderMajorState);
  }
  const ticketRow = document.createElement("div");
  ticketRow.className = "major-event-ticket-row event-card-primary-actions";
  const ticketLink = buildMajorEventTicketLink(record);
  if (ticketLink) ticketRow.appendChild(ticketLink);
  const primaryTimeline = MAJOR_EVENTS.phaseTimeline({ ...record, subEvents:visibleMajorEventSubEvents(record) }, nowAEST(), { level:"L0", timeZone:"Australia/Sydney" });
  const primaryItem = primaryTimeline.upcoming[0] || primaryTimeline.recent.at(-1) || null;
  const primaryFixture = (primaryItem ? majorEventFixtureSnapshot(primaryItem.subEvent, record) : null) || majorEventActionEvent(record);
  appendEventQuickActions(ticketRow, primaryFixture);

  const navigationRow = document.createElement("div");
  navigationRow.className = "major-event-navigation-row";
  navigationRow.appendChild(buildEventEditionToggle({...majorEventActionEvent(record),editionId:record.id,eventFamilyId:MAJOR_EVENTS.eventFamilyId(record),tournamentParent:true}));

  const inspect = document.createElement("button");
  inspect.type = "button";
  inspect.className = "event-quick-action major-event-timetable";
  inspect.innerHTML = `${glyphMarkup("ui:list", { preferImage:true })}<span>Schedule</span>`;
  inspect.addEventListener("click", event => {
    event.stopPropagation();
    activeMajorEventNowId = record.id;
    if (getEventAction(actionEvent).isMinimised) updateEventAction(actionEvent, { isMinimised:false });
    setCardState(record, "opened");
    refreshExpandableCard(eventCard, (eventCard.classList.contains("ticket-sale-card") ? buildTicketSaleCard : buildMajorEventCard)(record, { interactionCard:eventCard }), { restoreFocus:false });
    window.requestAnimationFrame(() => focusMajorEventSchedule(record.id));
  });
  navigationRow.appendChild(inspect);

  const identity = document.createElement("header");
  identity.className = "major-event-identity";
  const logo = document.createElement("div");
  logo.className = "major-event-logo";
  logo.dataset.scrollStable = `major-event-logo:${record.id}`;
  renderEventIdentityMark(logo, majorEventIdentityEvent(record), meta);
  const title = document.createElement("h3");
  title.textContent = record.name;
  const facts = document.createElement("div");
  facts.className = "major-event-facts";
  [majorEventDateLabel(record), record.venue].filter(Boolean).forEach(value => {
    const fact = document.createElement("span");
    fact.textContent = value;
    facts.appendChild(fact);
  });
  identity.append(logo, title);
  identity.appendChild(facts);
  if (isMinimised && primaryItem){
    const next = document.createElement("p");
    next.className = "major-event-next-fixture";
    next.textContent = `${primaryTimeline.upcoming.length ? "Next" : "Latest"}: ${spoilerSafeDisplayTitle(primaryFixture)} · ${eventDateLabel(primaryFixture)} · ${eventTimeLabel(primaryFixture)}`;
    identity.appendChild(next);
  }
  if (!isMinimised && state === "opened"){
    const whyItMatters = buildEventWhyItMatters(record);
    if (whyItMatters) identity.appendChild(whyItMatters);
  }

  ticketRow.append(...navigationRow.children);
  card.append(identity,ticketRow);
  if (!isMinimised && state === "opened"){
    const draw = buildMajorEventDraw(record);
    if (draw) card.appendChild(draw);
  }
  if (!isMinimised && state === "opened"){
    const immediateSchedule = buildMajorEventSchedule(record, {
      level: cardLevelForState(state),
      headingText: state === "opened" ? "Published timeline" : state === "selected" ? "Around now" : "Next match or line-up",
      compact: state === "compact",
    });
    if (immediateSchedule) card.appendChild(immediateSchedule);

    const tablePreview = buildMajorEventTablePreview(record);
    if (tablePreview && state !== "compact") card.appendChild(tablePreview);
  }
  if (!isMinimised && state === "opened"){
    card.dataset.editorialProvenance = record.editorialNarrative ? "validated" : "structural";
  }

  return card;
}


function visibleNothingscoreReadIds(){
  return [...document.querySelectorAll('.nsc-summary[data-nsc-event-id], .nsc-panel[data-nsc-panel]')]
    .filter(node=>node.getClientRects().length&&!node.closest('.is-compact-row, .is-minimised-row'))
    .map(node=>node.dataset.nscEventId||node.dataset.nscPanel).filter(Boolean);
}

function syncNothingscoreReadRecovery(){
  nothingscoreReadRecovery.sync();
  if(document.visibilityState==="hidden"||navigator.onLine===false){
    window.clearTimeout(nothingscoreBatchTimer);nothingscoreBatchTimer=null;return;
  }
  const mounted=new Set(visibleNothingscoreReadIds());
  for(const id of nothingscorePendingIds)if(!mounted.has(id))nothingscorePendingIds.delete(id);
  if(nothingscorePendingIds.size&&!nothingscoreBatchTimer)nothingscoreBatchTimer=window.setTimeout(flushNothingscoreBatch,0);
}

function nothingscoreReadRecoveryState(ev){
  const id=nothingscoreEventId(ev);
  return {...nothingscoreReadRecovery.state(id),failed:nothingscoreLoadErrors.has(id)};
}

function retryNothingscoreRatings(ev){
  const id=nothingscoreEventId(ev);
  if(!id||!NOTHINGSCORE||!serverSyncClient?.nothingscoreRequest)return false;
  const started=nothingscoreReadRecovery.manual(id);
  if(started)nothingscoreQueueRender();
  return started;
}

function nothingscoreReadFailed(id){
  const changed=!nothingscoreLoadErrors.has(id);
  nothingscoreLoadErrors.set(id,Date.now());nothingscoreReadRecovery.failure(id);return changed;
}

function nothingscoreReadRecovered(id){
  nothingscoreReadRecovery.success(id);return nothingscoreLoadErrors.delete(id);
}

async function loadNothingscoreBatch(ids, { rerender = true } = {}){
  if (!NOTHINGSCORE || !serverSyncClient?.nothingscoreRequest) return null;
  const requested = [...new Set((ids || []).map(String).filter(Boolean))].slice(0, 50);
  if (!requested.length) return null;
  const owner = serverPersistence.user?.id || "";
  const generation=nothingscoreReadGeneration;
  const before=new Map(nothingscoreSnapshots);
  let payload;
  try{payload=await serverSyncClient.nothingscoreRequest({ids:requested});}
  catch(error){
    if(owner===(serverPersistence.user?.id||"")&&generation===nothingscoreReadGeneration){
      requested.forEach(nothingscoreReadFailed);if(rerender)nothingscoreQueueRender();
    }
    throw error;
  }
  if (owner !== (serverPersistence.user?.id || "")||generation!==nothingscoreReadGeneration) return null;
  let changed = false;
  const returnedIds=new Set((payload.snapshots || []).map(snapshot=>String(snapshot.eventId)));
  (payload.snapshots || []).forEach(snapshot => {
    if(before.get(String(snapshot.eventId))!==nothingscoreSnapshots.get(String(snapshot.eventId)))return;
    changed = nothingscoreReadRecovered(String(snapshot.eventId)) || changed;
    changed = mergeNothingscoreSnapshot(snapshot) || changed;
  });
  Object.entries(payload.eventAliases||{}).forEach(([alias,id])=>{if(returnedIds.has(id)){returnedIds.add(alias);if(alias===id||before.get(alias)!==nothingscoreSnapshots.get(alias))return;const snapshot=nothingscoreSnapshots.get(id);if(snapshot){changed=nothingscoreReadRecovered(alias)||changed;changed=mergeNothingscoreSnapshot({...snapshot,eventId:alias})||changed;}}});
  requested.filter(id=>!returnedIds.has(id)).forEach(id=>{changed=nothingscoreReadFailed(id)||changed;});
  if (payload.viewer) nothingscoreViewer = payload.viewer;
  if (changed && rerender) nothingscoreQueueRender();
  return payload;
}

async function flushNothingscoreBatch(){
  window.clearTimeout(nothingscoreBatchTimer);
  nothingscoreBatchTimer = null;
  if(document.visibilityState==="hidden"||navigator.onLine===false)return;
  const mounted=new Set(visibleNothingscoreReadIds());
  for(const id of nothingscorePendingIds)if(!mounted.has(id))nothingscorePendingIds.delete(id);
  const ids = [...nothingscorePendingIds].filter(id=>!nothingscoreBatchInFlight.has(id)).slice(0, 50);
  ids.forEach(id => nothingscorePendingIds.delete(id));
  if (!ids.length) return;
  const generation=nothingscoreReadGeneration;
  ids.forEach(id => nothingscoreBatchInFlight.add(id));
  try{
    await loadNothingscoreBatch(ids);
  }catch(error){
    console.warn("Nothingscore summary refresh paused", error);
  }finally{
    if(generation===nothingscoreReadGeneration){
      ids.forEach(id=>nothingscoreBatchInFlight.delete(id));syncNothingscoreReadRecovery();nothingscoreQueueRender();
    }
  }
}

function registerNothingscoreEvent(ev, { force = false } = {}){
  if (!NOTHINGSCORE || !serverSyncClient?.nothingscoreRequest) return;
  const eventId = nothingscoreEventId(ev);
  if (!eventId) return;
  if(nothingscoreBatchInFlight.has(eventId)||nothingscorePendingIds.has(eventId))return;
  if(nothingscoreLoadErrors.has(eventId)){
    if(force)retryNothingscoreRatings(ev);
    return;
  }
  const snapshot = nothingscoreSnapshots.get(eventId);
  const maxAge = snapshot?.phase === "pulse" ? 120_000 : 5 * 60_000;
  if (!force && Date.now() - Number(nothingscoreLoadedAt.get(eventId) || 0) < maxAge) return;
  nothingscorePendingIds.add(eventId);
  if (!nothingscoreBatchTimer) nothingscoreBatchTimer = window.setTimeout(flushNothingscoreBatch, 0);
}


function mergeNothingscoreSnapshot(snapshot){
  const eventId = String(snapshot?.eventId || "");
  if (!eventId) return false;
  const previous = nothingscoreSnapshots.get(eventId) || null;
  const merged = {
    ...previous,
    ...snapshot,
    // A slower batch summary must not erase the breakdown just opened. If its
    // totals changed, discard the old histogram and refresh the visible detail.
    peerResults:snapshot.ratingRequired ? undefined : snapshot.peerResults && !snapshot.peerResults.distribution
      && previous?.peerResults?.distribution
      && ["phase","count","average"].every(key => previous.peerResults[key] === snapshot.peerResults[key])
      ? {...previous.peerResults,...snapshot.peerResults} : snapshot.peerResults || previous?.peerResults,
    currentUser:globalThis.NOTHINGSPORTS_NSC_SUBMISSION_STATE.mergeCurrentUser(previous?.currentUser, snapshot.currentUser),
    ...(snapshot.contributors === undefined && previous?.contributors !== undefined ? { contributors:previous.contributors } : {}),
  };
  const fingerprint = value => JSON.stringify({
    phase:value?.phase,
    ratingRequired:value?.ratingRequired,
    aggregate:value?.aggregate,
    aggregates:value?.aggregates,
    watchingCount:value?.watchingCount,
    currentUser:value?.currentUser,
    contributors:value?.contributors,
    series:value?.series,
    crowdEditorial:value?.crowdEditorial,
    filterRatings:value?.filterRatings,
    peerResults:value?.peerResults,
  });
  nothingscoreSnapshots.set(eventId, merged);
  nothingscoreLoadedAt.set(eventId, Date.now());
  return fingerprint(previous) !== fingerprint(merged);
}


async function loadNothingscoreDetail(ev){
  const eventId = nothingscoreEventId(ev);
  if (!eventId || nothingscoreDetailLoading.has(eventId) || (nothingscoreSnapshots.get(eventId)?.contributors !== undefined && nothingscoreSnapshots.get(eventId)?.peerResults?.distribution)) return;
  nothingscoreDetailLoading.add(eventId);
  const owner = serverPersistence.user?.id || "",generation=nothingscoreReadGeneration;
  try{
    const payload = await serverSyncClient.nothingscoreRequest({ eventId });
    if (owner !== (serverPersistence.user?.id || "")||generation!==nothingscoreReadGeneration) return;
    if (payload.viewer) nothingscoreViewer = payload.viewer;
    if(payload.detail){
      const recovered=nothingscoreReadRecovered(eventId);
      if(mergeNothingscoreSnapshot(payload.detail)||recovered)nothingscoreQueueRender();
    }
  }catch(error){
    console.warn("Nothingscore contributor detail unavailable", error);
  }finally{
    if(generation===nothingscoreReadGeneration)nothingscoreDetailLoading.delete(eventId);
  }
}





async function openNothingscoreContribution(ev, {showResults = false} = {}){
  const id=nothingscoreEventId(ev);nscDetailEvents.set(id,ev);
  if(activeNothingscoreContributionEvent!==ev){
    nscOpenedFromRankings=document.body.classList.contains('nsc-open');
    if(nscOpenedFromRankings)nscRankingState.scrollTop=document.getElementById('nothingscoreBody').scrollTop;
    history.pushState({nscPage:{view:'fixture',eventId:id}},'', '#nsc');
  }
  activeNothingscoreContributionEvent = ev;
  activeNothingscoreContributionError = "";
  setNothingscoreDrawerOpen(true);
  if(getEventStatus(ev)==="live"&&serverPersistence.user&&!nothingscoreWatching.has(id)){
    nothingscoreWatching.add(id);nothingscoreWatchingStartedAt.set(id,Date.now());
    try{await serverSyncClient?.nothingscoreRequest?.({}, {action:"watching",eventId:id});nothingscoreHeartbeatFailures.set(id,0);scheduleNothingscoreHeartbeat(60_000);}
    catch(_error){nothingscoreWatching.delete(id);nothingscoreWatchingStartedAt.delete(id);}
  }
  const owner = serverPersistence.user?.id || "",generation=nothingscoreReadGeneration;
  try{
    const payload = await serverSyncClient?.nothingscoreRequest?.({ eventId:nothingscoreEventId(ev) });
    if (owner !== (serverPersistence.user?.id || "")||generation!==nothingscoreReadGeneration) return;
    if (payload?.viewer) nothingscoreViewer = payload.viewer;
    if (payload?.detail){
      nothingscoreReadRecovered(nothingscoreEventId(ev));
      const phase = payload.detail.phase;
      const key = nothingscoreSubmissionKey(nothingscoreEventId(ev),phase);
      const receipt = payload.detail.currentUser?.submissions?.[phase];
      if (receipt) nothingscoreSubmissionStore.confirm(key,receipt);
      else if (!nothingscoreSubmissionRequests.has(key)) nothingscoreSubmissionStore.release(key);
      mergeNothingscoreSnapshot(payload.detail);
    }
  }catch(error){
    if(owner!==(serverPersistence.user?.id||"")||generation!==nothingscoreReadGeneration)return;
    console.warn("Nothingscore contribution unavailable", error);
    activeNothingscoreContributionError = error?.message || "Your contribution form could not be loaded.";
  }
  if (document.getElementById("nothingscoreBackdrop")?.classList.contains("show") && activeNothingscoreContributionEvent === ev){
    renderNothingscoreDrawer();
    if (showResults) document.getElementById("nothingscoreBackdrop")?.querySelector(".nsc-peer-results details")?.setAttribute("open", "");
  }
}
