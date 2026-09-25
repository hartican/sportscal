/* Follow owns its browsing filters; they never mutate sporting follows or Feed filters. */
(()=>{
 const savedKey='ns_follow_filters_v1';let filters={};try{filters=JSON.parse(localStorage.getItem(savedKey)||'{}');}catch{}
 const windows=new Map();let collapsed=false,floating=false,lastY=scrollY,lockedUntil=0;
 const persist=()=>{try{localStorage.setItem(savedKey,JSON.stringify(filters));}catch{}};
 const selected=code=>filters[code]||{};
 const rawValues=(f,key)=>{
  if(key==='round')return [f.roundLabel||f.round||f.stage].filter(Boolean);
  if(key==='competition')return [f.competitionId||f.competitionName].filter(Boolean);
  if(key==='tournament')return [f.tournamentId||f.eventFamilyId].filter(Boolean);
  if(key==='series')return [f.seriesId||f.seriesName].filter(Boolean);
  if(key==='country')return [...new Set([f.venueCountryCode,f.competitionCountryCode,f.countryCode,...(f.participantCountryCodes||[]),...(f.participants||[]).map(p=>p.countryCode||p.nationalityCode)].filter(Boolean))];
  return [...new Set([...(f.participantIds||[]),...(f.participants||[]).map(p=>p.id),...(f.participantSlots||[]).map(p=>p.participantId)].filter(Boolean))];
 };
 const values=(f,key)=>rawValues(f,key).map(String);
 const matches=(f,code)=>Object.entries(selected(code)).every(([k,v])=>!v.length||values(f,k).some(x=>v.includes(x)));
 function openFilters(code,fixtures){
  const dialog=document.createElement('dialog');dialog.className='follow-more-dialog follow-filter-dialog';dialog.setAttribute('aria-label','Filter schedule');
  const title=document.createElement('h2');title.textContent='Filter schedule';dialog.append(title);
  const draft=JSON.parse(JSON.stringify(selected(code)));
  for(const [key,label]of [['round','Rounds'],['competition','Competitions / championships'],['tournament','Tournaments'],['series','Series'],['country','Countries'],['participant','Teams & players']]){
   const choices=new Map();for(const f of fixtures)for(const value of values(f,key)){
    const person=(f.participants||[]).find(p=>p.id===value)||(f.participantSlots||[]).find(p=>p.participantId===value)||cardIdentityParticipants().find(p=>p.id===value);
    const name=key==='competition'?f.competitionName||value:key==='tournament'?f.tournamentName||value:key==='participant'?person?.displayName||person?.name||person?.label||value:key==='country'?(value.length===2?new Intl.DisplayNames(['en'],{type:'region'}).of(value):value):value;
    choices.set(value,name);
   }
   if(choices.size<2)continue;
   const section=document.createElement('details');section.open=Boolean(draft[key]?.length);const heading=document.createElement('summary');heading.textContent=label;section.append(heading);
   for(const [value,name]of [...choices].sort((a,b)=>String(a[1]).localeCompare(String(b[1]),undefined,{numeric:true}))){const row=document.createElement('label');row.className='follow-checkbox';const input=document.createElement('input');input.type='checkbox';input.checked=(draft[key]||[]).includes(value);input.onchange=()=>{const set=new Set(draft[key]||[]);input.checked?set.add(value):set.delete(value);draft[key]=[...set];};row.append(input,document.createTextNode(name));section.append(row);}dialog.append(section);
  }
  const actions=document.createElement('div');actions.className='follow-filter-actions';
  for(const [label,action]of [['Clear filters',()=>{filters[code]={};persist();windows.delete(code);dialog.close();renderFollowView();}],['Apply',()=>{filters[code]=draft;persist();windows.delete(code);dialog.close();renderFollowView();}],['Cancel',()=>dialog.close()]]){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.onclick=action;actions.append(b);}dialog.append(actions);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
 }
 function mount(container,entity,state){
  const nav=document.createElement('div');nav.className='follow-navigation';const spacer=document.createElement('div');spacer.className='follow-navigation-spacer';spacer.setAttribute('aria-hidden','true');
  const compact=document.createElement('div');compact.className='follow-navigation-compact';
  const label=document.createElement('span');label.textContent=`${entity.label} · ${state.section==='teams-players'?'Teams & players':state.section==='major-events'?'Major Events':state.section==='standings'?'Standings':state.section==='results'?'Results':'Schedule'}`;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='btn ghost follow-navigation-toggle';toggle.setAttribute('aria-controls','follow-navigation-controls');
  const controls=document.createElement('div');controls.id='follow-navigation-controls';
  while(container.firstChild)controls.append(container.firstChild);
  const set=value=>{const panel=container.querySelector('.follow-schedule-panel,.follow-section-panel');const before=panel?.getBoundingClientRect().top;collapsed=value;if(value)floating=true;controls.hidden=value;spacer.hidden=!floating;nav.classList.toggle('is-floating',floating);nav.classList.toggle('is-collapsed',value);toggle.textContent=value?'⌄':'⌃';toggle.setAttribute('aria-label',value?'Expand Follow navigation':'Collapse Follow navigation');toggle.setAttribute('aria-expanded',String(!value));if(before!=null){lockedUntil=performance.now()+150;scrollBy(0,panel.getBoundingClientRect().top-before);}};
  toggle.onclick=()=>set(!collapsed);compact.append(label);
  if(['schedule','results'].includes(state.section)){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent='Filter';b.onclick=()=>{const code=followInspectorCode(entity);if(codeInspectorChunk?.code?.id===code?.id)openFilters(code.id,(codeInspectorChunk.fixtures||[]).filter(inspectorFixtureMatchesTab).filter(followScheduleScopeMatches));};compact.append(b);}
  compact.append(toggle);nav.append(compact,controls);container.prepend(nav,spacer);set(collapsed);
  nav.collapse=()=>set(true);
 }
 addEventListener('scroll',()=>{const y=scrollY;if(performance.now()>lockedUntil&&y>lastY+6&&y>100&&!document.activeElement?.matches('.follow-navigation input:not([type=checkbox]),.follow-navigation select,.follow-navigation textarea'))document.querySelector('.follow-navigation:not(.is-collapsed)')?.collapse();lastY=y;},{passive:true});
 globalThis.NOTHINGSPORTS_FOLLOW_NAV={mount,matches,selected,openFilters,windows};
})();
