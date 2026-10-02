function appendVenuePanel(card,main,ev){
  if((!ev.golfMajorCalendar&&!['f1','motogp','wrc','sailgp','wsl','tdf','giro','vuelta'].includes(ev.key))||!main||main.querySelector('.venue-location-hero'))return;
  const p=NOTHINGSPORTS_FEED_CARD_PRESENTATION, palette=p.palette(ev);
  if(palette){card.style.setProperty('--fixture-left',palette[0]);card.style.setProperty('--fixture-right',palette[1]);if(palette[2])card.style.setProperty('--fixture-accent',palette[2]);}
  card.classList.add('venue-location-card');if(ev.key==='f1')card.classList.add('f1-location-card');
  const hero=document.createElement('div');hero.className='f1-location-hero venue-location-hero';hero.dataset.cardArea='artwork';
  const artwork=p.venueArtwork(ev),track=p.circuitAsset(ev);
  if(track){const outline=document.createElement('img');outline.src=track;outline.alt=artwork?.label||`${ev.venue} circuit outline`;outline.width=600;outline.height=320;outline.loading='lazy';outline.decoding='async';hero.append(outline);if(artwork?.kind==='fallback')hero.classList.add('is-venue-fallback');outline.onerror=()=>{if(artwork&&!hero.classList.contains('is-venue-fallback')){hero.classList.add('is-venue-fallback');const fallback=p.venueArtwork({...ev,courseGeometryVerified:false,editionGeometryVerified:false,venueConfigurationVerified:false});outline.src=fallback.path;outline.alt=fallback.label;caption.textContent=[ev.venue,ev.venueCity,'Artwork unavailable'].filter(Boolean).join(' • ');}};}
  const labels=document.createElement('div');labels.className='f1-location-labels';
  const badge=document.createElement('span');badge.className='f1-location-date';badge.textContent=ev.date?new Date(ev.date+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}):'Date TBC';
  if((ev.golfMajorCalendar||['motogp','wrc','sailgp','wsl','tdf','giro','vuelta'].includes(ev.key))&&ev.endDate&&ev.endDate!==ev.date)badge.textContent+=' – '+new Date(ev.endDate+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});
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
  if(schedule.status){const date=document.createElement('p');date.className='fixture-scheduled event-date-chip';date.textContent=schedule.fullSchedule;info.prepend(date);}
  const rating=main.querySelector('.nsc-summary');if(rating)rating.after(info);else main.append(info);
  const more=document.createElement('button');more.type='button';more.className='fixture-more';more.textContent=cardStateForEvent(ev)==='opened'?'Less':'More…';more.setAttribute('aria-expanded',String(cardStateForEvent(ev)==='opened'));more.onclick=e=>{e.stopPropagation();renderCardState(cardStateForEvent(ev)==='opened'?'selected':'opened',{restoreFocus:true,focusTarget:'.fixture-more'});};
  if(compact){const hook=buildEventWhyItMatters(ev);if(hook)main.append(hook);}
  const footer=document.createElement('div');footer.className='fixture-card-footer';footer.append(more);
  if(actions)footer.append(actions);
  else if(compact){const secondary=document.createElement('div');secondary.className='event-card-primary-actions';appendEventQuickActions(secondary,ev,{viewing:false});footer.append(secondary);}
  main.append(footer);
}
