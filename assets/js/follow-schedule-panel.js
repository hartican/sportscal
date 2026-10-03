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
  const fixtures=available.filter(f=>NOTHINGSPORTS_FOLLOW_NAV.matches(f,code.id));
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
  const grouped = new Map();
  // Programme dates order the calendar; they never become match kickoffs.
  const sortDate=f=>f.date||f.schedulingWindow?.startsOn||'9999-12-31';
  const eventGroup=f=>f.tournamentId||((f.dakarCalendar||f.lemansCalendar)?f.weekendId:null)||(f.circuitId?`${f.circuitId}:${String(f.date).slice(0,4)}`:null);
  const tournamentDates=new Map();for(const f of fixtures){const key=eventGroup(f);if(key&&f.date&&(!tournamentDates.has(key)||f.date<tournamentDates.get(key)))tournamentDates.set(key,f.date);}
  const useRounds=code.groupingMode==='round'&&!['sport:golf','sport:f1','sport:cricket','sport:cricket-women','competition:dakar','competition:le-mans'].includes(code.id);
  const groupLabel=f=>{const round=useRounds?codeInspectorGroupLabel(f,'round'):null;return round&&round!=='Other fixtures'?round:`${NOTHINGSPORTS_AUSTRALIAN_DATES.date(tournamentDates.get(eventGroup(f))||f.date)} · ${f.tournamentName||(f.circuitId?f.venue:null)||f.competitionName||code.label}`;};
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
  const groupLabels = [...grouped.keys()].sort((first, second) => (!useRounds ? String(sortDate(grouped.get(first)[0])).localeCompare(String(sortDate(grouped.get(second)[0]))) : FOLLOW_FIRST?.compareFixtureGroupLabels?.(first, second))
    ?? String(first).localeCompare(String(second), "en-AU", { numeric:true, sensitivity:"base" }));
  const today=formatDateKey(nowAEST());
  const current=fixtures.filter(f=>(f.endDate||f.date||f.schedulingWindow?.endsOn)>=today).sort((a,b)=>String(sortDate(a)).localeCompare(String(sortDate(b))))[0]||fixtures.at(-1);
  const currentIndex=Math.max(0,groupLabels.indexOf(current?groupLabel(current):groupLabels[0]));
  const windows=NOTHINGSPORTS_FOLLOW_NAV.windows;
  const fingerprint=JSON.stringify([codeInspectorTab,followBrowseState().scheduleScope,NOTHINGSPORTS_FOLLOW_NAV.selected(code.id)]);
  let window=windows.get(code.id);if(!window||window.fingerprint!==fingerprint){window={start:currentIndex,end:Math.min(groupLabels.length,currentIndex+3),fingerprint};windows.set(code.id,window);}
  const action=(label,callback)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=callback;panel.append(b);};
  action('Jump to current',()=>{window.start=currentIndex;window.end=Math.min(groupLabels.length,currentIndex+3);renderCodeInspector();requestAnimationFrame(()=>document.querySelector('.code-inspector-group')?.scrollIntoView({block:'start'}));});
  if(window.start>0)action('Earlier rounds / events',()=>{window.start=Math.max(0,window.start-3);renderCodeInspector();});
  groupLabels.slice(window.start,window.end).forEach(label=>{
    const section=document.createElement('section');section.className='code-inspector-group';
    const title=document.createElement('h3');title.textContent=label;
    const list=document.createElement('div');list.className='code-inspector-fixtures';list.dataset.scrollList=`inspector-group:${label}`;
    const rows=[...grouped.get(label)];
    if(code.id==='competition:dakar'&&codeInspectorTab!=='results')for(const note of codeInspectorChunk.scheduleNotes||[])if(rows.some(f=>f.season===note.season))rows.push({...note,restDayNote:true});
    rows.sort((a,b)=>String(sortDate(a)).localeCompare(String(sortDate(b)))).forEach(f=>{
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
  if(window.end<groupLabels.length)action('Later rounds / events',()=>{window.end=Math.min(groupLabels.length,window.end+3);renderCodeInspector();});

}
;

function renderCodeInspectorStandings(panel, code){
  if(!userPreferences.showSpoilers && !standingsRevealApproved){
    const message=document.createElement('p');message.textContent='Standings hidden while Results is off.';
    const reveal=document.createElement('button');reveal.type='button';reveal.className='btn ghost';reveal.textContent='Reveal standings';
    reveal.onclick=()=>confirmStandingsReveal(()=>renderCodeInspector());
    panel.append(message,reveal);return;
  }
  const publishedStandings = codeInspectorChunk?.code?.id === code.id && Array.isArray(codeInspectorChunk.standings)
    ? codeInspectorChunk.standings.filter(row=>NOTHINGSPORTS_SURFACE_CATEGORY.genderMatches({...row,key:code.slug},followBrowseState().sportId))
    : [];
  if (publishedStandings.length){
    const byCompetition = new Map();
    publishedStandings.forEach(entry => {
      const rows = byCompetition.get(entry.competitionId) || [];
      rows.push(entry);
      byCompetition.set(entry.competitionId, rows);
    });
    byCompetition.forEach((rows, competitionId) => {
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
        facts.textContent = [played != null ? `${played} played` : null, wins != null ? `${wins} wins` : null, draws != null ? `${draws} draws` : null, losses != null ? `${losses} losses` : null, points != null ? `${points} pts` : null, entry.derived ? `${entry.pointsFor} GF · ${entry.pointsAgainst} GA · ${entry.pointsDifference>0?"+":""}${entry.pointsDifference} GD` : null].filter(Boolean).join(" · ") || "Season table published; results pending.";
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
