'use strict';
const tennisParentDrawTabs=new Map();
function category(parent){return (parent.tourCategories||[{tour:parent.tour,level:parent.tournamentLevel}]).map(t=>{const level=String(t.level||'').match(/(1000|500|250)/)?.[1];return [t.tour,level].filter(Boolean).join(' ');}).join(' / ');}
function buildTennisParentCard(parent){
  const card=document.createElement('article');card.className='event-card tennis-feed-parent';card.dataset.eventId=parent.id;
  const details=document.createElement('details'),summary=document.createElement('summary'),timing=document.createElement('span');
  const ongoing=NOTHINGSPORTS_FEED_CARD_PRESENTATION.parentCompact(parent,nowAEST());
  card.classList.toggle('parent-ongoing',ongoing);
  const heading=document.createElement('div');heading.className='tournament-parent-heading';
  const link=buildFeedScheduleLink(parent);link.textContent=ongoing?({'Billie Jean King Cup Finals':'BJK Cup Finals'}[parent.name]||parent.name):`${parent.name} ${parent.season}`;
  timing.className='tournament-parent-context';timing.textContent=[parent.venueCity||parent.venue,category(parent),String(parent.season)].filter(Boolean).join(' · ');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='btn ghost';toggle.textContent='Matches';toggle.setAttribute('aria-label',`Show ${parent.name} matches`);
  const identity=document.createElement('span');identity.className='tennis-parent-mark identity-frame';renderEventIdentityMark(identity,parent,SPORT_META.tennis);const title=document.createElement('div');title.className='tennis-parent-title';title.append(link,timing);heading.append(identity,title,toggle);card.append(heading);const dates=document.createElement('p');dates.className='tennis-parent-dates';dates.textContent=NOTHINGSPORTS_TENNIS_FEED.timingLabel(parent);card.append(dates);const next=document.createElement('div');next.className='tennis-parent-next';next.textContent='Checking published matches…';card.append(next);details.append(summary);card.append(details);const official=document.createElement('a');official.className='tennis-parent-source';official.href=parent.sourceUrl;official.target='_blank';official.rel='noopener noreferrer';official.textContent='Official tournament information';card.append(official);if(parent.viewingOptions?.length)appendEventQuickActions(card,parent,{reminder:false,chat:false});
  toggle.onclick=()=>{details.open=!details.open;toggle.setAttribute('aria-expanded',String(details.open));toggle.setAttribute('aria-label',`${details.open?'Hide':'Show'} ${parent.name} matches`);};
  const body=document.createElement('div');body.className='tennis-parent-contests';details.append(body);
  let loaded=false,focusDraw=false;
  async function paint(){
    body.replaceChildren();body.textContent='Loading contests…';next.textContent='Checking published matches…';
    try{
      const doc=await loadTennisFeedContests();
      if(doc.fixtures.some(f=>f.rubbers?.length))await loadDeferredScript('assets/js/tennis-tie-details.js?v=305');
      if(!card.isConnected)return;
      const fixtures=NOTHINGSPORTS_TENNIS_FEED.reconcile({...parent,childContests:doc.fixtures.filter(e=>NOTHINGSPORTS_TENNIS_FEED.matches(parent,e))},activeEvents).childContests;
      body.replaceChildren();next.replaceChildren();const current=fixtures.filter(f=>!['completed','finished','final','cancelled','abandoned','not-required'].includes(f.status)&&(!f.date||f.date>=formatDateKey(nowAEST()))).sort((a,b)=>(a.startTimeUtc||a.date||'9999').localeCompare(b.startTimeUtc||b.date||'9999'));const personal=current.filter(f=>FOLLOW_FEED_POLICY.participantIds(f).some(id=>FOLLOW_FIRST.effectiveParticipantFollow(id,userPreferences,followCollectionsById()).followed));for(const f of (personal.length?personal:current).slice(0,2)){const ev=NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(f,'tennis'),row=document.createElement('p');row.className='tennis-parent-next-match';const name=document.createElement('strong');name.textContent=spoilerSafeDisplayTitle(ev);row.append(name,document.createElement('br'),document.createTextNode([f.roundLabel||f.round,NOTHINGSPORTS_CARD_TIMING.presentation(ev,nowAEST()).schedule,f.sourceCheckedAt?'checked '+f.sourceCheckedAt.slice(0,10):null].filter(Boolean).join(' · ')));next.append(row);}if(!next.children.length)next.textContent='Next match timing has not been verified. Check the official schedule.';
      if(!fixtures.length){body.textContent='Contests will appear as reliable schedules become available.';return;}
      const groups=new Map();
      for(const f of fixtures){const label=f.contestUnit==='tie'||f.tour==='TEAM'?'Team ties':/doubles/i.test([f.eventType,f.matchType,f.name].join(' '))?'Doubles':/women|wta/i.test([f.eventType,f.matchType,f.gender,f.tour].join(' '))?'Women’s singles':'Men’s singles';if(!groups.has(label))groups.set(label,[]);groups.get(label).push(f);}
      const tabs=document.createElement('nav');tabs.className='tennis-parent-draw-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',parent.name+' published draws');body.append(tabs);tabs.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...tabs.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();};for(const [label,fixtures]of groups){
        const section=document.createElement('section');section.className='tennis-parent-draw';section.setAttribute('role','tabpanel');const button=document.createElement('button');button.type='button';button.className='btn ghost';button.setAttribute('role','tab');button.textContent=label;const selected=(tennisParentDrawTabs.get(parent.id)||groups.keys().next().value)===label;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;section.hidden=!selected;button.onclick=()=>{tennisParentDrawTabs.set(parent.id,label);focusDraw=true;void paint();};tabs.append(button);body.append(section);
        let count=0;fixtures.sort((a,b)=>Number(['completed','finished','final'].includes(a.status))-Number(['completed','finished','final'].includes(b.status))||String(a.startTimeUtc||a.date||'9999').localeCompare(String(b.startTimeUtc||b.date||'9999')));
        function more(){
          for(const fixture of fixtures.slice(count,count+20)){
            const ev=NOTHINGSPORTS_FIXTURE_IDENTITY.fromSchedule(fixture,'tennis'),row=document.createElement('div');row.className='tennis-contest-row';
            row.dataset.eventId=String(ev.eventId||ev.id);const copy=document.createElement('span');renderEventTitleIdentity(copy,ev,spoilerSafeDisplayTitle(ev));copy.append(document.createTextNode(` · ${ev.date||'Date TBC'}${ev.time&&!ev.timeTbc?' · '+(ev.timePrecision==='not-before'?'Not before ':'')+ev.time:''}`));row.append(copy);
            const excluded=FOLLOW_FEED_POLICY.explicitlyExcluded(ev,userPreferences);
            const action=getEventAction(ev),automatic=!excluded&&Boolean(automaticEventFollowReason(ev)),visible=!excluded&&!action.dismissed&&!action.archived&&(automatic||action.addedToFixtures);
            const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent=visible?'In Feed':excluded?'Excluded':'Add to Feed';button.disabled=excluded;
            button.onclick=()=>{
              if(visible){pendingNotificationEventId=String(ev.eventId||ev.id);if(!activeEvents.some(e=>String(e.eventId||e.id)===pendingNotificationEventId))activeEvents.push(ev);renderAll({preserveViewport:true});focusPendingNotificationEvent();return;}
              const next=updateEventAction(ev,{addedToFixtures:true,addedToFixturesAt:new Date().toISOString(),addedFixture:{...ev,manualPin:true},dismissed:false,archived:false,pinState:'added',pinRevision:(Number(action.pinRevision)||0)+1,pinMutationId:crypto.randomUUID()});
              queueFixturePinCommand(eventActionKey(ev),next);renderAll({preserveViewport:true});
            };row.append(button);
            if(action.addedToFixtures){const remove=document.createElement('button');remove.type='button';remove.className='btn ghost';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove manual selection for ${spoilerSafeDisplayTitle(ev)}`);remove.onclick=()=>{const next=updateEventAction(ev,{addedToFixtures:false,pinState:'removed',pinRevision:(Number(action.pinRevision)||0)+1,pinMutationId:crypto.randomUUID()});queueFixturePinCommand(eventActionKey(ev),next);void paint();renderAll({preserveViewport:true});};row.append(remove);}
            if(fixture.rubbers?.length)row.append(NOTHINGSPORTS_TENNIS_TIE_DETAILS.build(fixture,{showResults:isSpoilerVisible(ev)}));
            section.append(row);
          }
          count+=20;
          if(count<fixtures.length){const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent='More contests';button.onclick=()=>{button.remove();more();};section.append(button);}
        }more();
      }
      if(focusDraw){focusDraw=false;tabs.querySelector('[aria-selected="true"]')?.focus();}
    }catch(error){loaded=false;next.textContent='Match details are temporarily unavailable. ';const again=document.createElement('button');again.type='button';again.className='btn ghost';again.textContent='Retry matches';again.onclick=()=>void paint();next.append(again);body.textContent='Contests could not load. ';const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Retry';retry.onclick=()=>void paint();body.append(retry);}
  }
  summary.addEventListener('click',()=>{if(details.open)tennisFeedOpenParents.delete(parent.id);else tennisFeedOpenParents.add(parent.id);});
  details.open=tennisFeedOpenParents.has(parent.id);
  details.addEventListener('toggle',()=>{if(!card.isConnected)return;toggle.setAttribute('aria-expanded',String(details.open));if(details.open)tennisFeedOpenParents.add(parent.id);else tennisFeedOpenParents.delete(parent.id);if(details.open&&!loaded){loaded=true;void paint();}});
  toggle.setAttribute('aria-expanded',String(details.open));queueMicrotask(()=>{if(card.isConnected){loaded=true;void paint();}});return card;
}

globalThis.NOTHINGSPORTS_TENNIS_PARENT_UI={build:buildTennisParentCard};
