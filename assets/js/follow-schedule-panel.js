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
  const tournamentDates=new Map();for(const f of fixtures){if(f.tournamentId&&f.date&&(!tournamentDates.has(f.tournamentId)||f.date<tournamentDates.get(f.tournamentId)))tournamentDates.set(f.tournamentId,f.date);}
  const groupLabel=f=>code.groupingMode==='round'?codeInspectorGroupLabel(f,code.groupingMode):`${tournamentDates.get(f.tournamentId)||f.date||'Upcoming'} · ${f.tournamentName||f.competitionName||code.label}`;
  fixtures.forEach(fixture => {
    const label = groupLabel(fixture);
    const group = grouped.get(label) || [];
    group.push(fixture);
    grouped.set(label, group);
  });
  grouped.forEach(group => group.sort((first, second) => (
    String(first.date || "9999-12-31").localeCompare(String(second.date || "9999-12-31"))
    || String(first.time || "99:99").localeCompare(String(second.time || "99:99"))
    || String(first.id || "").localeCompare(String(second.id || ""))
  )));
  const groupLabels = [...grouped.keys()].sort((first, second) => FOLLOW_FIRST?.compareFixtureGroupLabels?.(first, second)
    ?? String(first).localeCompare(String(second), "en-AU", { numeric:true, sensitivity:"base" }));
  const today=formatDateKey(nowAEST());
  const current=fixtures.filter(f=>(f.endDate||f.date)>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0]||fixtures.at(-1);
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
    grouped.get(label).forEach(f=>{
      const card=buildCodeInspectorFixture(f);
      if(codeInspectorTab==='results'){
        const canonical=canonicalFeedFixtureForInspector(f),status=f.resultStatus||canonical?.resultStatus,score=f.resultScore||canonical?.score;
        if(status==='pending'){const pending=document.createElement('p');pending.textContent = "Official FIA classification pending.";card.append(pending);}
        else if(userPreferences.showSpoilers&&score){const note=document.createElement('p');note.textContent=`Official: ${score}`;card.append(note);}
      }
      list.appendChild(card);
    });section.append(title,list);panel.append(section);
  });
  if(window.end<groupLabels.length)action('Later rounds / events',()=>{window.end=Math.min(groupLabels.length,window.end+3);renderCodeInspector();});

}
;

function renderCodeInspectorStandings(panel, code){
  const publishedStandings = codeInspectorChunk?.code?.id === code.id && Array.isArray(codeInspectorChunk.standings)
    ? codeInspectorChunk.standings
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
        : (CANONICAL_TAXONOMY.competitions || []).find(competition => competition.id === competitionId)?.name || "NFL standings";
      const list = document.createElement("div");
      list.className = "code-inspector-fixtures";
      rows.sort((first, second) => Number(first.rank || 999) - Number(second.rank || 999) || String(first.displayName).localeCompare(String(second.displayName))).forEach(entry => {
        const row = document.createElement("article");
        row.className = "code-inspector-fixture code-inspector-standing-row";
        const label = document.createElement("strong");
        label.textContent = `${entry.rank}. ${entry.displayName}`;
        const facts = document.createElement("span");
        const played = entry.gamesPlayed ?? entry.stats?.gamesPlayed ?? entry.stats?.gamesplayed;
        const wins = entry.wins ?? entry.stats?.wins;
        const losses = entry.losses ?? entry.stats?.losses;
        const points = entry.points ?? entry.stats?.points;
        facts.textContent = [played != null ? `${played} played` : null, wins != null ? `${wins} wins` : null, losses != null ? `${losses} losses` : null, points != null ? `${points} pts` : null].filter(Boolean).join(" · ") || "Season table published; results pending.";
        row.append(label, facts);
        list.appendChild(row);
      });
      section.append(title, list);
      panel.appendChild(section);
    });
    return;
  }
  const sportKey = codeInspectorStandingsSportKey(code);
  const competitions = (CANONICAL_TAXONOMY.competitions || [])
    .filter(competition => competition.supportsLadder)
    .filter(competition => standingsSportKey(competition) === sportKey);
  if (!competitions.length){
    panel.appendChild(sportHubEmptyState(`Standings or rankings are not meaningfully available for ${code.label}.`));
    return;
  }
  renderStandingsContext({ container: panel, competitions, sectionLabel: `${code.label} standings` });
}

function followScheduleScopeMatches(f){
  const scope=followBrowseState().scheduleScope,fixtures=codeInspectorChunk?.fixtures||[];
  if(!scope)return true;
  if(scope.tournamentId&&fixtures.some(x=>(x.tournamentId||x.tennisTournamentId)===scope.tournamentId))return (f.tournamentId||f.tennisTournamentId)===scope.tournamentId;
  if(scope.competitionId&&fixtures.some(x=>x.competitionId===scope.competitionId))return f.competitionId===scope.competitionId;
  return true;
}
