// Loaded only when opening tennis Schedule or Major Events.
let tennisTournamentCatalogue = null;
let tennisTournamentCatalogueLoading = null;
function loadTennisTournamentCatalogue(){
  if (tennisTournamentCatalogue) return Promise.resolve(tennisTournamentCatalogue);
  if (!tennisTournamentCatalogueLoading) tennisTournamentCatalogueLoading = fetch('data/canonical/tennis-catalogue-2026.json', {cache:'no-cache'})
    .then(response=>{if(!response.ok)throw new Error('Tournament catalogue unavailable');return response.json();})
    .then(document=>{tennisTournamentCatalogue=document;return document;})
    .finally(()=>{tennisTournamentCatalogueLoading=null;});
  return tennisTournamentCatalogueLoading;
}
function renderTennisMajorEvents(container){
  if(!tennisTournamentCatalogue){
    const status=document.createElement('p');status.textContent='Loading published tournaments…';container.append(status);
    void loadTennisTournamentCatalogue().then(()=>{if(activeTab==='follow'&&followViewSection==='major-events')renderFollowView();}).catch(()=>{status.textContent='Tournament catalogue unavailable. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>renderFollowView();status.append(retry);});return;
  }
  const helper=NOTHINGSPORTS_TOURNAMENT_SCHEDULE;
  function row(t){
    const family=helper.family(t),card=document.createElement('div');card.className='follow-event-family tennis-catalogue-row';card.dataset.eventFamilyId=family;card.dataset.edition=t.tournamentId;
    const copy=document.createElement('div'),title=document.createElement('strong'),dates=document.createElement('small');title.textContent=`${t.name} ${t.season}`;dates.textContent=`${t.startDate} – ${t.endDate}`;copy.append(title,dates);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='btn ghost follow-event-family-toggle';toggle.dataset.eventFamilyLabel=t.name;const followed=userPreferences.followFirst.followedMajorEventIds.includes(family);toggle.textContent=`${followed?'Unfollow':'Follow'} ${t.name}`;toggle.setAttribute('aria-pressed',String(followed));toggle.onclick=()=>{toggleMajorEventFollow(family);};
    const open=document.createElement('button');open.type='button';open.className='btn ghost';open.textContent='Schedule';open.onclick=async()=>{tennisSelectedEdition=t.tournamentId;await openCodeInspector('sport:tennis');};card.append(copy,toggle,open);return card;
  }
  for(const section of helper.sections(tennisTournamentCatalogue.tournaments,formatDateKey(nowAEST()))){
    const group=document.createElement('section');group.className='tennis-catalogue-category';const heading=document.createElement('h3');heading.textContent=section.label;group.append(heading);
    section.current.forEach(t=>group.append(row(t)));
    for(const [key,label]of [['later','Later published editions'],['previous','Previous editions']])if(section[key].length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=label;details.dataset.followDisclosure=`tennis:${section.label}:${key}`;details.open=followDisclosureState.get(details.dataset.followDisclosure)===true;details.addEventListener('toggle',()=>followDisclosureState.set(details.dataset.followDisclosure,details.open));details.append(summary);section[key].forEach(t=>details.append(row(t)));group.append(details);}
    container.append(group);
  }
  const note=document.createElement('p');note.className='chat-empty';note.textContent='Tournament follows add an overview to Feed. Followed players and teams add their contests; following Tennis also adds singles and team finals. Other contests can be added individually.';container.append(note);
  installFollowEventBulk(container);
}
let tennisSelectedEdition = '';
function renderTennisTournamentSchedule(panel,fixtures){
  if(!tennisTournamentCatalogue){
    panel.textContent='Loading tournament editions…';void loadTennisTournamentCatalogue().then(()=>{if(activeInspectorCodeId==='sport:tennis')renderCodeInspector();}).catch(()=>{panel.textContent='Tournament catalogue unavailable. Try opening Schedule again.';});return;
  }
  const groups=NOTHINGSPORTS_TOURNAMENT_SCHEDULE.groups(fixtures,tennisTournamentCatalogue.tournaments);
  for(const t of tennisTournamentCatalogue.tournaments)if(!groups.some(g=>g.id===t.tournamentId))groups.push({id:t.tournamentId,label:`${t.name} ${t.season}`,startDate:t.startDate,endDate:t.endDate,fixtures:[]});
  groups.sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate))||a.id.localeCompare(b.id));
  const today=formatDateKey(nowAEST());
  const current=groups.filter(g=>g.endDate>=today);const latest=groups.filter(g=>g.endDate<today).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];
  if(!tennisSelectedEdition||!groups.some(g=>g.id===tennisSelectedEdition))tennisSelectedEdition=current[0]?.id||latest?.id||groups[0]?.id;
  const picker=document.createElement('select');picker.setAttribute('aria-label','Tournament and edition');picker.className='starting-round-select';
  for(const [label,list]of [['Live and upcoming editions',current],['Older editions',groups.filter(g=>g.endDate<today).reverse()]]){const group=document.createElement('optgroup');group.label=label;for(const g of list){const option=document.createElement('option');option.value=g.id;option.textContent=g.label;option.selected=g.id===tennisSelectedEdition;group.append(option);}picker.append(group);}
  picker.onchange=()=>{tennisSelectedEdition=picker.value;renderCodeInspector();};panel.append(picker);
  const chosen=groups.find(g=>g.id===tennisSelectedEdition);if(!chosen)return;
  const latestPlayed=groups.filter(g=>g.fixtures.some(f=>f.status==='completed')).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0];
  if(latestPlayed&&latestPlayed.id!==chosen.id){const recent=document.createElement('button');recent.type='button';recent.className='btn ghost';recent.textContent=`Latest completed matches · ${latestPlayed.label}`;recent.onclick=()=>{tennisSelectedEdition=latestPlayed.id;renderCodeInspector();};panel.append(recent);}
  const title=document.createElement('h3');title.textContent=chosen.label;panel.append(title);
  appendTournamentSlots(panel,{tournamentId:chosen.id});
  if(!chosen.fixtures.length){const note=document.createElement('p');note.textContent='Match schedule and draw not yet published in our verified sources.';panel.append(note);return;}
  const rounds=new Map();for(const fixture of chosen.fixtures){const label=fixture.roundLabel&&fixture.roundLabel!=='all'?fixture.roundLabel:fixture.stage||'Published matches';if(!rounds.has(label))rounds.set(label,[]);rounds.get(label).push(fixture);}
  const latestDay=chosen.fixtures.filter(f=>f.status==='completed').map(f=>f.date).sort().at(-1);
  for(const [round,matches]of rounds){const details=document.createElement('details');details.className='tennis-schedule-round';details.open=matches.some(f=>f.date>=today||f.status==='live'||f.date===latestDay);const summary=document.createElement('summary');summary.textContent=`${round} · ${matches.length} matches`;details.append(summary);let mounted=false;const mount=()=>{if(mounted||!details.open)return;mounted=true;const list=document.createElement('div');list.className='code-inspector-fixtures';matches.forEach(f=>list.append(buildCodeInspectorFixture(f)));details.append(list);};details.addEventListener('toggle',mount);panel.append(details);mount();}
}
