// The source calendar owns chronological round order; views never create follows.
function footballRoundPlan(fixtures,today){
 const key=f=>JSON.stringify([f.competitionId||f.competitionName,f.season||f.seasonLabel||String(f.date).slice(0,4),f.stageType||f.stage,f.roundLabel||f.round||f.stage||f.date]);
 const groups=new Map();for(const f of fixtures){const k=key(f),g=groups.get(k)||{key:k,label:[f.competitionName,f.season||f.seasonLabel,f.stageType||f.stage,f.roundLabel||f.round||f.date].filter(Boolean).join(' · '),fixtures:[]};g.fixtures.push(f);groups.set(k,g);}
 const ordered=[...groups.values()].sort((a,b)=>String(a.fixtures.map(f=>f.date||'9999').sort()[0]).localeCompare(String(b.fixtures.map(f=>f.date||'9999').sort()[0]))||a.label.localeCompare(b.label));
 const eligible=fixtures.filter(f=>!['completed','finished','cancelled','canceled','abandoned'].includes(f.status)&&String(f.endDate||f.date||'')>=today).sort((a,b)=>String(a.startTimeUtc||a.date||'9999').localeCompare(String(b.startTimeUtc||b.date||'9999')));
 const current=eligible[0];return {groups:ordered,key,currentKey:current?key(current):null,currentIndex:Math.max(0,current?ordered.findIndex(g=>g.key===key(current)):ordered.length-1)};
}
function appendFootballCalendarFilters(panel,code,available){
 if(!/football|champions-league/.test(code.slug||''))return;
 const host=document.createElement('div');host.className='football-calendar-filters';
 const nav=globalThis.NOTHINGSPORTS_FOLLOW_NAV;if(!nav)return;const selected=nav.selected(code.id);
 for(const [key,label]of [['competition','Competition'],['season','Season'],['stage','Stage']]){
  const scoped=available.filter(f=>['competition','season','stage'].slice(0,['competition','season','stage'].indexOf(key)).every(k=>!selected[k]?.length||selected[k].includes(String(k==='competition'?(f.competitionId||f.competitionName):k==='season'?(f.season||f.seasonLabel||String(f.date).slice(0,4)):(f.stageType||f.stage)))));
  const choices=new Map(scoped.map(f=>{const value=String(key==='competition'?(f.competitionId||f.competitionName):key==='season'?(f.season||f.seasonLabel||String(f.date).slice(0,4)):(f.stageType||f.stage)||'');return [value,key==='competition'?(f.competitionName||value):value];}).filter(([v])=>v&&v!=='undefined'));
  if(!choices.size)continue;
  const row=document.createElement('label');row.textContent=label;const input=document.createElement('select');input.setAttribute('aria-label',label);
  input.add(new Option('All '+label.toLowerCase()+(key==='stage'?'s':key==='season'?'s':'s'),''));for(const [value,name]of [...choices].sort((a,b)=>a[1].localeCompare(b[1])))input.add(new Option(name,value));
  if(selected[key]?.length===1)input.value=selected[key][0];else if(selected[key]?.length>1){input.add(new Option('Selected '+label.toLowerCase()+'s','__selected'));input.value='__selected';}
  input.onchange=()=>{nav.setFilter(code.id,key,input.value?[input.value]:[]);renderCodeInspector();};row.append(input);host.append(row);
 }
 panel.append(host);
}
function codeInspectorCoverageCopy(code){
  if(code.coverageNote)return code.coverageNote;
  if(code.id==='sport:skiing'&&code.coverageStatus==='partial')return 'Snow coverage is partial: four selected 2026/27 appointments. Dates are local to the venue; race starts, entries, results and Australian viewing are unconfirmed.';
  if(['competition:tour-de-france','competition:giro-ditalia','competition:vuelta-a-espana'].includes(code.id))return 'Men’s Grand Tours: all published 2026 stages. For 2027, the Tour has three published opening stages (2–4 July); its remaining stages are unconfirmed. Giro: 8–30 May; La Vuelta: 4–26 September, edition dates only. Entries, start times, results and detailed route geometry remain partial.';
  if(code.id==='competition:wsl-championship-tour')return 'WSL: published 2026 event windows. New coverage is men’s; the existing mixed Margaret River result is retained. Daily times, entries, results and break shapes remain partial. Raglan returns in 2027; dates are unconfirmed.';
  if(code.id==='competition:sailgp'&&code.coverageStatus==='partial')return 'SailGP coverage is partial: published race days only. Season teams may be listed; individual event entries and future session times may be unconfirmed.';
  if (code.coverageStatus === "complete") return "Complete official published coverage is available for this code.";
  if (code.coverageStatus === "partial") return "Published coverage is partial. This view shows every available fixture, but does not claim a complete schedule.";
  return "No reliable fixture schedule is currently published for this code. This honest unavailable state will update when source-backed coverage exists.";
}

globalThis.renderFollowSchedulePanel=function(container){
  const code = codeInspectorManifest?.codes?.find(candidate => candidate.id === activeInspectorCodeId);
  if(!code){container.textContent='Loading schedule…';return;}
  const view=document.createElement('section');view.className='code-inspector-view';view.dataset.codeInspector=code.id;
  const panel=document.createElement('div');panel.className='code-inspector-panel';view.append(panel);container.append(view);
  if (codeInspectorTab === "standings"){
    renderCodeInspectorStandings(panel, code);
    return;
  }
  if (codeInspectorChunkLoading || codeInspectorChunk?.code?.id !== code.id){
    panel.innerHTML = '<div class="empty-state">Loading detailed fixtures…</div>';
    return;
  }
  const available = (codeInspectorChunk.fixtures || []).filter(inspectorFixtureMatchesTab).filter(f=>followScheduleScopeMatches(f));
  appendFootballCalendarFilters(panel,code,available);
  const fixtures=available.filter(f=>NOTHINGSPORTS_FOLLOW_NAV.matches(f,code.id));
  if(['sport:skiing','sport:surf'].includes(code.id)&&code.coverageStatus==='partial'){const note=document.createElement('p');note.className='code-inspector-note';note.textContent=codeInspectorCoverageCopy(code);panel.append(note);}
  const filterButton=document.createElement('button');filterButton.type='button';filterButton.className='btn ghost';filterButton.textContent='Filter schedule';filterButton.onclick=()=>NOTHINGSPORTS_FOLLOW_NAV.openFilters(code.id,available);panel.append(filterButton);
  if (codeInspectorTab === "players"){
    renderCodeInspectorPlayers(panel, codeInspectorChunk.fixtures || []);
    return;
  }
  if (!fixtures.length){
    panel.appendChild(sportHubEmptyState(code.coverageStatus === "unavailable"
      ? `No reliable ${code.label} fixtures are currently published.`
      : "No fixtures match this view."));
    return;
  }
  if(code.id==='sport:tennis'){renderTennisTournamentSchedule(panel,fixtures);return;}
  const football=/football|champions-league/.test(code.slug||'');
  const today=formatDateKey(nowAEST());
  const footballPlan=football?footballRoundPlan(fixtures,today):null;
  const grouped = new Map();
  // Programme dates order the calendar; they never become match kickoffs.
  const sortDate=f=>f.date||f.schedulingWindow?.startsOn||'9999-12-31';
  const eventGroup=f=>f.tournamentId||((f.dakarCalendar||f.lemansCalendar)?f.weekendId:null)||(f.circuitId?`${f.circuitId}:${String(f.date).slice(0,4)}`:null);
  const tournamentDates=new Map();for(const f of fixtures){const key=eventGroup(f);if(key&&f.date&&(!tournamentDates.has(key)||f.date<tournamentDates.get(key)))tournamentDates.set(key,f.date);}
  const useRounds=code.groupingMode==='round'&&!['sport:golf','sport:f1','sport:cricket','sport:cricket-women','sport:skiing','competition:dakar','competition:le-mans'].includes(code.id);
  const groupLabel=f=>{if(football)return footballPlan.key(f);const round=useRounds?codeInspectorGroupLabel(f,'round'):null;return round&&round!=='Other fixtures'?round:`${NOTHINGSPORTS_AUSTRALIAN_DATES.date(tournamentDates.get(eventGroup(f))||f.date)} · ${f.tournamentName||(f.circuitId?f.venue:null)||f.competitionName||code.label}`;};
  fixtures.forEach(fixture => {
    const label = groupLabel(fixture);
    const group = grouped.get(label) || [];
    group.push(fixture);
    grouped.set(label, group);
  });
  grouped.forEach(group => group.sort((first, second) => (
    String(sortDate(first)).localeCompare(String(sortDate(second)))
    || (first.lemansCalendar&&second.lemansCalendar?first.sessionOrder-second.sessionOrder:0)
    || String(first.time || "99:99").localeCompare(String(second.time || "99:99"))
    || String(first.id || "").localeCompare(String(second.id || ""))
  )));
  const groupLabels = [...grouped.keys()].sort((first, second) => (football||!useRounds ? String(sortDate(grouped.get(first)[0])).localeCompare(String(sortDate(grouped.get(second)[0]))) : FOLLOW_FIRST?.compareFixtureGroupLabels?.(first, second))
    ?? String(first).localeCompare(String(second), "en-AU", { numeric:true, sensitivity:"base" }));
  const current=fixtures.filter(f=>(f.endDate||f.date||f.schedulingWindow?.endsOn)>=today).sort((a,b)=>String(sortDate(a)).localeCompare(String(sortDate(b))))[0]||fixtures.at(-1);
  const currentIndex=football?Math.max(0,footballPlan.currentKey?groupLabels.indexOf(footballPlan.currentKey):groupLabels.length-1):Math.max(0,groupLabels.indexOf(current?groupLabel(current):groupLabels[0]));
  const windows=NOTHINGSPORTS_FOLLOW_NAV.windows;
  const fingerprint=JSON.stringify([codeInspectorTab,followBrowseState().scheduleScope,NOTHINGSPORTS_FOLLOW_NAV.selected(code.id)]);
  let window=windows.get(code.id);if(!window||window.fingerprint!==fingerprint){window={start:currentIndex,end:Math.min(groupLabels.length,currentIndex+(football?1:3)),fingerprint};windows.set(code.id,window);}
  const action=(label,callback)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=callback;panel.append(b);};
  action('Jump to current',()=>{window.start=currentIndex;window.end=Math.min(groupLabels.length,currentIndex+(football?1:3));renderCodeInspector();requestAnimationFrame(()=>document.querySelector('.code-inspector-group')?.scrollIntoView({block:'start'}));});
  if(football){const row=document.createElement('label');row.className='football-round-picker';row.textContent='Matchday / round';const select=document.createElement('select');select.setAttribute('aria-label','Matchday / round');groupLabels.forEach((key,index)=>{const group=footballPlan.groups.find(g=>g.key===key);select.add(new Option((key===footballPlan.currentKey?'Current / next · ':'')+group.label,String(index)));});select.value=String(window.start);select.onchange=()=>{window.start=Number(select.value);window.end=window.start+1;renderCodeInspector();};row.append(select);panel.append(row);}
  if(window.start>0)action('Earlier rounds / events',()=>{window.start=Math.max(0,window.start-(football?1:3));renderCodeInspector();});
  groupLabels.slice(window.start,window.end).forEach(label=>{
    const section=document.createElement('section');section.className='code-inspector-group';
    const title=document.createElement('h3');title.textContent=football?footballPlan.groups.find(g=>g.key===label).label:label;
    if(football&&label===footballPlan.currentKey){section.dataset.currentRound='true';title.setAttribute('aria-current','date');const note=document.createElement('span');note.className='football-current-round';note.textContent='Current / next round';title.append(document.createTextNode(' '),note);}
    const list=document.createElement('div');list.className='code-inspector-fixtures';list.dataset.scrollList=`inspector-group:${label}`;
    const rows=[...grouped.get(label)];
    if(code.id==='competition:dakar'&&codeInspectorTab!=='results')for(const note of codeInspectorChunk.scheduleNotes||[])if(rows.some(f=>f.season===note.season))rows.push({...note,restDayNote:true});
    rows.sort((a,b)=>String(sortDate(a)).localeCompare(String(sortDate(b)))).forEach(f=>{
      if(f.competitionId==='competition:chl'&&f.timingProvenance?.precision==='competition-stage-calendar'&&!f.participantSlots?.length){const note=document.createElement('p');note.className='schedule-rest-note chl-programme-note';note.textContent=`${f.displayDateLabel} · ${f.stage} — teams and kickoff not announced. `;const source=document.createElement('a');source.href=f.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='CHL programme';note.append(source);list.append(note);return;}
      if(f.restDayNote){const rest=document.createElement('p');rest.className='schedule-rest-note';rest.textContent=`${NOTHINGSPORTS_AUSTRALIAN_DATES.date(f.date)} · Rest day · ${f.venue} — no competitive stage`;list.append(rest);return;}
      const card=buildCodeInspectorFixture(f);
      if(codeInspectorTab==='results'){
        const canonical=canonicalFeedFixtureForInspector(f),status=f.resultStatus||canonical?.resultStatus,score=f.resultScore||canonical?.score;
        if(status==='pending'){if(!card.querySelector('.fixture-result-availability')){const pending=buildFixtureResultAvailability({...f,...canonical,resultStatus:'pending'});if(pending)card.append(pending);}}
        else if(userPreferences.showSpoilers&&score){const note=document.createElement('p');note.textContent=`Official: ${score}`;card.append(note);}
      }
      list.appendChild(card);
    });
    section.append(title,list);panel.append(section);
  });
  if(window.end<groupLabels.length)action('Later rounds / events',()=>{window.end=Math.min(groupLabels.length,window.end+(football?1:3));renderCodeInspector();});

}
;

function renderNflConferenceStandings(panel,rows){
  for(const conferenceId of ['AFC','NFC']){
    const entries=rows.filter(row=>row.conferenceId===conferenceId).sort((a,b)=>a.conferenceSeed-b.conferenceSeed);
    if(!entries.length)continue;
    const section=document.createElement('section');section.className='standings-module code-inspector-published-standings';
    const title=document.createElement('h3');title.textContent=`NFL ${conferenceId} standings · ${entries[0].season}`;
    const note=document.createElement('p');note.className='standings-source-note';note.textContent=entries[0].tableNote;
    const checked=document.createElement('p');checked.textContent=`Table facts checked ${new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(entries[0].asOf))} (Sydney) · ESPN`;
    const source=document.createElement('a');source.href=entries[0].sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Standings source';
    const wrap=document.createElement('div');wrap.className='standings-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',`NFL ${conferenceId} standings; scroll for all columns`);
    const table=document.createElement('table');table.className='standings-table nfl-standings-table';table.style.minWidth='680px';table.style.fontSize='0.8rem';
    const caption=document.createElement('caption');caption.textContent=`${conferenceId} source-supplied conference seeds and regular-season records`;
    const columns=[['conferenceSeed','Seed'],['displayName','Team'],['gamesPlayed','P'],['wins','W'],['losses','L'],['ties','T'],['winPercentage','PCT'],['pointsFor','PF'],['pointsAgainst','PA'],['pointDifferential','Diff']];
    const thead=document.createElement('thead'),head=document.createElement('tr');
    for(const [,label] of columns){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}thead.append(head);
    const tbody=document.createElement('tbody');
    for(const entry of entries){const row=document.createElement('tr');row.dataset.participantId=entry.participantId;
      for(const [key] of columns){const cell=document.createElement(key==='displayName'?'th':'td');if(key==='displayName')cell.scope='row';cell.textContent=key==='winPercentage'?Number(entry[key]).toFixed(3):key==='pointDifferential'&&entry[key]>0?`+${entry[key]}`:String(entry[key]);row.append(cell);}tbody.append(row);}
    table.append(caption,thead,tbody);wrap.append(table);section.append(title,note,checked,source,wrap);panel.append(section);
  }
}
function renderChlClubRecords(panel,rows){
  const section=document.createElement('section');section.className='standings-module code-inspector-published-standings';
  const title=document.createElement('h3');title.textContent='Champions Hockey League club records';
  const note=document.createElement('p');note.textContent=rows[0].tableNote;
  const checked=document.createElement('p');checked.textContent=`Record facts checked ${new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(rows[0].asOf))} (Sydney)`;
  const source=document.createElement('a');source.href=rows[0].sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Club records source';
  const wrap=document.createElement('div');wrap.className='standings-table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','CHL club records; scroll for all columns');
  const table=document.createElement('table');table.className='standings-table chl-club-records-table';table.style.minWidth='400px';table.style.fontSize='0.8rem';
  const caption=document.createElement('caption');caption.textContent='2026/27 published club records; alphabetical order';
  const columns=[['displayName','Team'],['gamesPlayed','P'],['wins','W'],['losses','L'],['goalsFor','GF'],['goalsAgainst','GA']];
  const thead=document.createElement('thead'),head=document.createElement('tr');for(const [,label] of columns){const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);}thead.append(head);
  const tbody=document.createElement('tbody');for(const entry of [...rows].sort((a,b)=>a.displayName.localeCompare(b.displayName))){const tr=document.createElement('tr');tr.dataset.participantId=entry.participantId;for(const [key] of columns){const cell=document.createElement(key==='displayName'?'th':'td');if(key==='displayName')cell.scope='row';cell.textContent=String(entry[key]);tr.append(cell);}tbody.append(tr);}
  table.append(caption,thead,tbody);wrap.append(table);section.append(title,note,checked,source);
  if(rows.some(row=>row.stale)){const stale=document.createElement('p');stale.textContent=rows.find(row=>row.stale).staleNote;section.append(stale);}
  section.append(wrap);panel.append(section);
}
function renderCodeInspectorStandings(panel, code){
  if(!userPreferences.showSpoilers && !standingsRevealApproved){
    const message=document.createElement('p');message.textContent='Standings hidden while Results is off.';
    const reveal=document.createElement('button');reveal.type='button';reveal.className='btn ghost';reveal.textContent='Reveal standings';
    reveal.onclick=()=>confirmStandingsReveal(()=>renderCodeInspector());
    panel.append(message,reveal);return;
  }
  appendFootballCalendarFilters(panel,code,codeInspectorChunk?.fixtures||[]);
  const publishedStandings = codeInspectorChunk?.code?.id === code.id && Array.isArray(codeInspectorChunk.standings)
    ? codeInspectorChunk.standings.filter(row=>!globalThis.NOTHINGSPORTS_FOLLOW_NAV?.selected(code.id).competition?.length||globalThis.NOTHINGSPORTS_FOLLOW_NAV.selected(code.id).competition.includes(row.competitionId)).filter(row=>NOTHINGSPORTS_SURFACE_CATEGORY.genderMatches({...row,key:code.slug},followBrowseState().sportId))
    : [];
  if (publishedStandings.length){
    const byCompetition = new Map();
    publishedStandings.forEach(entry => {
      const rows = byCompetition.get(entry.competitionId) || [];
      rows.push(entry);
      byCompetition.set(entry.competitionId, rows);
    });
    byCompetition.forEach((rows, competitionId) => {
      if(competitionId==='competition:chl'&&rows.every(row=>row.recordKind==='club-record')){renderChlClubRecords(panel,rows);return;}
      if(competitionId==='competition:nfl'&&rows.every(row=>row.rankScope==='conference')){renderNflConferenceStandings(panel,rows);return;}
      const section = document.createElement("section");
      section.className = "standings-module code-inspector-published-standings";
      const title = document.createElement("h3");
      title.textContent = competitionId === "competition:nhl" ? "NHL standings"
        : competitionId === "competition:chl" ? "Champions Hockey League table"
        : (CANONICAL_TAXONOMY.competitions || []).find(competition => competition.id === competitionId)?.name || rows[0]?.competitionName || "Competition standings";
      const list = document.createElement("div");
      list.className = "code-inspector-fixtures";
      rows.sort((first, second) => Number(first.sortOrder || first.rank || 999) - Number(second.sortOrder || second.rank || 999) || String(first.displayName).localeCompare(String(second.displayName))).forEach(entry => {
        const row = document.createElement("article");
        row.className = "code-inspector-fixture code-inspector-standing-row";
        const label = document.createElement("strong");
        const position = NOTHINGSPORTS_FEED_CARD_PRESENTATION.standingPosition(entry);
        label.textContent = `${position}${position==='Pending'||position==='—'?' ·':'.'} ${entry.displayName}`;
        const facts = document.createElement("span");
        const played = entry.played ?? entry.gamesPlayed ?? entry.stats?.gamesPlayed ?? entry.stats?.gamesplayed;
        const wins = entry.won ?? entry.wins ?? entry.stats?.wins;
        const losses = entry.lost ?? entry.losses ?? entry.stats?.losses;
        const draws = entry.drawn;
        const points = entry.ladderPoints ?? entry.points ?? entry.stats?.points;
        facts.textContent = [played != null ? `${played} played` : null, wins != null ? `${wins} wins` : null, draws != null ? `${draws} draws` : null, losses != null ? `${losses} losses` : null, competitionId==='competition:nhl'&&entry.otLosses!=null?`${entry.otLosses} OT/SO losses`:null, points != null ? `${points} pts` : null, competitionId==='competition:nhl'&&entry.goalsFor!=null?`${entry.goalsFor} GF · ${entry.goalsAgainst} GA · ${entry.goalDifferential>0?'+':''}${entry.goalDifferential} GD`:null, entry.derived ? `${entry.pointsFor} GF · ${entry.pointsAgainst} GA · ${entry.pointsDifference>0?"+":""}${entry.pointsDifference} GD` : null].filter(Boolean).join(" · ") || "Season table published; results pending.";
        row.append(label, facts);
        list.appendChild(row);
      });
      const asOf=rows.map(entry=>entry.asOf).filter(Boolean).sort().at(-1);
      section.append(title);
      if(rows.some(row=>row.stale)){const note=document.createElement('p');note.textContent=rows.find(row=>row.stale)?.staleNote||'Table awaits primary-source confirmation.';section.append(note);}
      if(asOf){const checked=document.createElement('p');checked.textContent=`Table checked ${new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(asOf))} (Sydney)`;section.append(checked);}
      if(rows[0]?.tableNote){const note=document.createElement('p');note.className='standings-source-note';note.textContent=rows[0].tableNote;section.append(note);const attribution=buildFixtureDataAttribution(rows[0]);if(attribution)section.append(attribution);}
      if(/^https:\/\//i.test(rows[0]?.sourceUrl||'')){const source=document.createElement('a');source.href=rows[0].sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Standings source';section.append(source);}
      section.append(list);
      panel.appendChild(section);
    });
    return;
  }
  const sportKey = codeInspectorStandingsSportKey(code);
  const competitions = (CANONICAL_TAXONOMY.competitions || [])
    .filter(competition => competition.supportsLadder)
    .filter(competition => standingsSportKey(competition) === sportKey)
    .filter(competition => NOTHINGSPORTS_SURFACE_CATEGORY.genderMatches(competition,followBrowseState().sportId));
  if (!competitions.length){
    panel.appendChild(sportHubEmptyState(`Standings or rankings are not meaningfully available for ${code.label}.`));
    return;
  }
  renderStandingsContext({ container: panel, competitions, sectionLabel: `${code.label} standings` });
}

function followScheduleScopeMatches(f){
  const scope=followBrowseState().scheduleScope,fixtures=codeInspectorChunk?.fixtures||[];
  if(!NOTHINGSPORTS_SURFACE_CATEGORY.genderMatches(f,followBrowseState().sportId))return false;
  if(!scope)return true;
  if(scope.tournamentId&&fixtures.some(x=>(x.tournamentId||x.tennisTournamentId)===scope.tournamentId))return (f.tournamentId||f.tennisTournamentId)===scope.tournamentId;
  if(scope.competitionId&&fixtures.some(x=>x.competitionId===scope.competitionId))return f.competitionId===scope.competitionId;
  return true;
}

if(typeof module==='object'&&module.exports)module.exports={footballRoundPlan};
