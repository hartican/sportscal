globalThis.installFollowEventBulkUI=function(container){
  const cards=[...container.querySelectorAll('[data-event-family-id]')];
  const ids=[...new Set(cards.map(c=>c.dataset.eventFamilyId))];
  const bar=document.createElement('div');bar.className='follow-event-bulk';bar.setAttribute('aria-label','Select event families');
  const status=document.createElement('span');status.setAttribute('aria-live','polite');
  const update=()=>{status.textContent=`${ids.filter(id=>followBulkSelection.has(id)).length} selected`;cards.forEach(c=>{c.querySelector('.follow-family-select').checked=followBulkSelection.has(c.dataset.eventFamilyId);});};
  for(const card of cards){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.className='follow-family-select';input.setAttribute('aria-label',`Select ${card.querySelector('[data-event-family-label]')?.dataset.eventFamilyLabel||card.dataset.eventFamilyId}`);input.onchange=()=>{input.checked?followBulkSelection.add(card.dataset.eventFamilyId):followBulkSelection.delete(card.dataset.eventFamilyId);update();};label.append(input);card.prepend(label);}
  for(const [label,action] of [['Select all',()=>{ids.forEach(id=>followBulkSelection.add(id));update();}],['Clear selection',()=>{ids.forEach(id=>followBulkSelection.delete(id));update();}],['Follow selected',()=>apply(true)],['Unfollow selected',()=>apply(false)]]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=action;bar.append(b);}
  function apply(enabled){const chosen=ids.filter(id=>followBulkSelection.has(id));if(!chosen.length)return;const next=clonePreferences(userPreferences),f=next.followFirst;
    const selected=new Set(f.followedMajorEventIds||[]),excluded=new Set(f.excludedMajorEventIds||[]),states={...(f.eventFamilyDecisions?.states||{})};
    for(const id of chosen){if(enabled){selected.add(id);excluded.delete(id);}else{selected.delete(id);excluded.add(id);}states[id]=enabled?'followed':'excluded';}
    f.followedMajorEventIds=[...selected];f.excludedMajorEventIds=[...excluded];f.eventFamilyDecisions={schemaVersion:'event-family-decisions.v1',states};savePreferences(next);renderFollowView();
  }
  bar.append(status);container.insertBefore(bar,container.querySelector('.tennis-catalogue-category,.setup-choice-grid'));update();
}
;
