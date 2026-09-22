globalThis.renderFollowSchedulePanel=function(container){
  const code = codeInspectorManifest?.codes?.find(candidate => candidate.id === activeInspectorCodeId);
  if(!code){container.textContent='Loading schedule…';return;}
  const view=document.createElement('section');view.className='code-inspector-view';view.dataset.codeInspector=code.id;
  const panel=document.createElement('div');panel.className='code-inspector-panel';view.append(panel);container.append(view);
  if (codeInspectorTab === "standings"){
    renderCodeInspectorStandings(panel, code);
    return;
  }
  if (codeInspectorTab === "results"){
    renderCodeInspectorResults(panel, code);
    return;
  }
  if (codeInspectorChunkLoading || codeInspectorChunk?.code?.id !== code.id){
    panel.innerHTML = '<div class="empty-state">Loading detailed fixtures…</div>';
    return;
  }
  const fixtures = (codeInspectorChunk.fixtures || []).filter(inspectorFixtureMatchesTab).filter(f=>followScheduleScopeMatches(f));
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
  if(code.id==='sport:golf'){const note=document.createElement('p');note.className='chat-empty';note.textContent='PGA TOUR tournament dates and confirmed winners. Tee times and round-by-round scores remain unavailable where not published.';panel.append(note);}
  const grouped = new Map();
  fixtures.forEach(fixture => {
    const label = codeInspectorGroupLabel(fixture, code.groupingMode);
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
  if (!codeInspectorGroup || !grouped.has(codeInspectorGroup)){
    const todayKey = formatDateKey(nowAEST());
    const nextFixture = fixtures.find(fixture => fixture.date && fixture.date >= todayKey);
    const nextGroup = nextFixture ? codeInspectorGroupLabel(nextFixture, code.groupingMode) : null;
    codeInspectorGroup = nextGroup && grouped.has(nextGroup) ? nextGroup : groupLabels[0];
  }
  const toolbar = document.createElement("div");
  toolbar.className = "code-inspector-toolbar";
  const pickerLabel = document.createElement("label");
  pickerLabel.setAttribute("for", "codeInspectorStartingRound");
  pickerLabel.textContent = code.groupingMode === "round" ? "Starting round" : "Starting group";
  const picker = document.createElement("select");
  picker.id = "codeInspectorStartingRound";
  picker.className = "starting-round-select";
  groupLabels.forEach(label => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    option.selected = label === codeInspectorGroup;
    picker.appendChild(option);
  });
  picker.addEventListener("change", () => {
    const startedAt = feedPerformanceNow();
    codeInspectorGroup = picker.value;
    renderCodeInspector();
    recordFeedInteraction("inspector_round_change", startedAt);
  });
  toolbar.append(pickerLabel, picker);
  panel.appendChild(toolbar);
  const startIndex = Math.max(0, groupLabels.indexOf(codeInspectorGroup));
  groupLabels.slice(startIndex, startIndex + 2).forEach(label => {
    const section = document.createElement("section");
    section.className = "code-inspector-group";
    const groupTitle = document.createElement("h3");
    groupTitle.textContent = label;
    const list = document.createElement("div");
    list.className = "code-inspector-fixtures";
    list.dataset.scrollList = `inspector-group:${label}`;
    grouped.get(label).forEach(fixture => list.appendChild(buildCodeInspectorFixture(fixture)));
    section.append(groupTitle, list);
    panel.appendChild(section);
  });
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
