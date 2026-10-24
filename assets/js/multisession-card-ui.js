(function(){
  'use strict';
  const model=globalThis.NOTHINGSPORTS_MULTISESSION;
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
  function presets(event){
    const key=model.presetKey(event);if(!key)return null;
    const section=node('details',null,'session-reminder-preferences'),summary=node('summary','Reminder preferences');section.append(summary);
    section.append(node('p','Reminders arrive 15 minutes before confirmed starts. Individual session choices take precedence.'));
    const golf=['golf','masters'].includes(event.key),saved=userPreferences.followFirst?.notifications?.sessionPresets?.[key]||{},types=saved.sessionTypes||(golf?['final-round']:['race','sprint']);
    const controls=[];
    const enabled=node('input');enabled.type='checkbox';enabled.checked=saved.enabled===true;
    const label=node('label',null,'follow-checkbox');label.append(enabled,document.createTextNode('Use these reminders'));section.append(label);
    for(const [value,text]of (golf?[['round','Rounds 1–3'],['final-round','Final round']]:[['practice','Practice'],['qualifying','Qualifying / shootout'],['sprint','Sprints'],['race','Races']])){
      const input=node('input');input.type='checkbox';input.checked=types.includes(value);input.dataset.sessionType=value;
      const row=node('label',null,'follow-checkbox');row.append(input,document.createTextNode(text));section.append(row);controls.push(input);
    }
    const save=()=>{const next=clonePreferences(userPreferences);next.followFirst.notifications.sessionPresets={...(next.followFirst.notifications.sessionPresets||{}),[key]:{enabled:enabled.checked,sessionTypes:controls.filter(c=>c.checked).map(c=>c.dataset.sessionType)}};savePreferences(next,{deliberate:true});};
    enabled.onchange=save;controls.forEach(c=>c.onchange=save);return section;
  }
  function build(event,options={}){
    const card=node('article',null,'event-card multisession-card');card.dataset.eventGroupId=event.eventGroupId;card.dataset.occurrenceDate=event.date;
    const header=node('header',null,'multisession-header');header.append(node('h3',event.eventGroupTitle));
    header.append(node('p',[event.venue,event.date].filter(Boolean).join(' · '),'compact-card-meta'));card.append(header);
    const presentation=globalThis.NOTHINGSPORTS_FEED_CARD_PRESENTATION,art=presentation?.circuitAsset(event);
    if(art){const figure=node('figure',null,'multisession-artwork'),image=node('img');image.src=art;image.alt=presentation.venueArtwork(event)?.label||event.venue||'Venue layout';image.loading='lazy';image.decoding='async';image.onerror=()=>{figure.innerHTML=VECTOR_ASSETS.glyphMarkup(['golf','masters'].includes(event.key)?'sport:golf':'sport:motorsport');};figure.append(image);header.append(figure);}

    const now=+nowAEST(),next=event.sessions.find(e=>model.start(e)>now&&!/cancelled|postponed|abandoned/.test(e.status||''));
    const renderRows=(sessions,host,withDay=false)=>{
      for(const session of sessions){
        const row=node('div',null,'multisession-row');row.dataset.sessionId=model.id(session);
        const clock=model.start(session),time=node('time',Number.isFinite(clock)?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit'}).format(new Date(clock)):'Time TBC');if(Number.isFinite(clock))time.dateTime=new Date(clock).toISOString();
        const label=node('span',String(session.sessionType||session.roundLabel||session.name).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),'multisession-session-label');
        if(withDay)label.prepend(document.createTextNode((model.day(session)||'Date TBC')+' · '));
        row.append(time,label);if(model.id(session)===model.id(next||{}))row.append(node('span','Next','multisession-next'));
        if(/cancelled|canceled|postponed|abandoned/.test(session.status||''))row.append(node('span',session.status,'fixture-status'));
        if(Number.isFinite(clock)&&clock>now){const controls=node('div',null,'multisession-actions');appendEventQuickActions(controls,session,{chat:false,viewing:false});row.append(controls);}
        if(model.practice(session))row.append(node('span','Unrated practice','compact-card-meta'));
        const open=node('button','Open session','btn ghost');open.type='button';open.onclick=()=>{setCardState(session,'opened');detail.replaceChildren(buildEventCard(session,{...options,mode:'schedule'}));};row.append(open);
        host.append(row);
      }
    };
    const today=node('div',null,'multisession-today');card.append(today);renderRows(event.daySessions,today);
    const full=node('details',null,'multisession-full');full.append(node('summary','Full event schedule'));renderRows(event.sessions,full,true);card.append(full);
    const preferences=presets(event.daySessions[0]);if(preferences)card.append(preferences);
    const detail=node('div',null,'multisession-detail');card.append(detail);
    const focused=event.daySessions.find(e=>model.id(e)===options.focusSessionId);
    if(focused){setCardState(focused,'opened');detail.append(buildEventCard(focused,{...options,mode:'schedule'}));requestAnimationFrame(()=>{if(card.isConnected){detail.tabIndex=-1;detail.scrollIntoView({block:'start'});detail.focus({preventScroll:true});}});}
    return card;
  }
  globalThis.NOTHINGSPORTS_MULTISESSION_UI={build};
})();
