globalThis.installFollowEventBulkUI=function(container){
  const cards=[...container.querySelectorAll('[data-edition]')].filter(c=>c.classList.contains('follow-event-family'));
  const ids=[...new Set(cards.map(c=>c.dataset.edition))];
  const bar=document.createElement('div');bar.className='follow-event-bulk';bar.setAttribute('aria-label','Select event editions');
  const status=document.createElement('span');status.setAttribute('aria-live','polite');
  const update=()=>{bar.querySelectorAll('button').forEach(b=>{if(/selected|Clear/.test(b.textContent))b.disabled=!ids.some(id=>followBulkSelection.has(id));});status.textContent=`${ids.filter(id=>followBulkSelection.has(id)).length} selected`;cards.forEach(c=>{c.querySelector('.follow-family-select').checked=followBulkSelection.has(c.dataset.edition);});};
  for(const card of cards){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.className='follow-family-select';input.setAttribute('aria-label',`Select ${card.querySelector('[data-event-family-label]')?.dataset.eventFamilyLabel||card.dataset.edition}`);input.onchange=()=>{input.checked?followBulkSelection.add(card.dataset.edition):followBulkSelection.delete(card.dataset.edition);update();};label.append(input);card.prepend(label);}
  for(const [label,action] of [['Select all',()=>{ids.forEach(id=>followBulkSelection.add(id));update();}],['Clear selection',()=>{ids.forEach(id=>followBulkSelection.delete(id));update();}],['Follow selected',()=>apply(true)],['Unfollow selected',()=>apply(false)]]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=action;bar.append(b);}
  function apply(enabled){const chosen=ids.filter(id=>followBulkSelection.has(id));if(!chosen.length)return;const next=clonePreferences(userPreferences),f=next.followFirst;
    const states={...(f.eventEditionDecisions?.states||{})};for(const id of chosen)states[id]=enabled?'followed':'excluded';f.eventEditionDecisions={schemaVersion:'event-edition-decisions.v1',states};savePreferences(next);renderFollowView();
  }
  bar.append(status);container.insertBefore(bar,container.querySelector('.tennis-catalogue-category,.setup-choice-grid'));update();
}
;
