function directoryIndividualLabel(key){return /^(f1|wrc|motorsport|supercars)$/.test(key)?'Drivers':key==='motogp'?'Riders':key.startsWith('golf')?'Golfers':/^(tennis|football|afl|nrl|rugby|nbl|nba)/.test(key)?'Players':'Athletes';}
function directorySectionLabel(){return 'Teams & Players';}
function directoryViewFilters(key,records){
  const filters=directoryFilters(key),teamsAvailable=records.some(record=>(record.entityType==='team'||record.type==='team'||String(record.id).startsWith('team:'))&&!NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam(record)&&[filters.genderCategory,'unknown','mixed'].includes(record.genderCategory||'unknown'));
  const entityType=key.startsWith('cricket')?'team':teamsAvailable?filters.entityType:'athlete';
  return {...filters,teamsAvailable,entityType,collectionId:entityType==='athlete'?filters.collectionId:''};
}
function appendDirectoryEntityTabs(host,key,filters){const tabs=document.createElement('nav');tabs.className='follow-directory-tabs';tabs.setAttribute('aria-label',directorySectionLabel(key));for(const [type,label]of [['team','Teams'],['athlete',directoryIndividualLabel(key)]]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.disabled=type==='team'&&!filters.teamsAvailable;if(b.disabled){b.style.opacity='.45';b.title='No teams are available for this sport.';}b.setAttribute('aria-pressed',String(filters.entityType===type));b.onclick=()=>{updateDirectoryFilters(key,{entityType:type});renderStandingsContext();};tabs.append(b);}host.append(tabs);}
"use strict";
// Follow UI; admission and mutations stay in the shell.
function buildDirectorySelect(label, value, options, onChange){
  const field = document.createElement("label");
  field.className = "football-directory-field";
  field.append(document.createTextNode(label));
  const select = document.createElement("select");
  options.forEach(([optionValue, optionLabel]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.appendChild(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  field.appendChild(select);
  return field;
}

function buildFootballDirectoryToolbar(directory, filters, sportKey = "football"){
  const toolbar = document.createElement("div");
  toolbar.className = "football-directory-toolbar";
  const searchField = document.createElement("label");
  searchField.className = "football-directory-field";
  searchField.append(document.createTextNode("Search"));
  const search = document.createElement("input");
  search.type = "search";
  search.value = filters.query;
  search.placeholder = "Club or player";
  search.addEventListener("input", () => {
    updateDirectoryFilters(sportKey, { query: search.value });
    window.clearTimeout(footballDirectorySearchTimer);
    footballDirectorySearchTimer = window.setTimeout(() => {
      renderStandingsContext();
      const restored = document.querySelector('.football-directory-field input[type="search"]');
      restored?.focus({ preventScroll: true });
      restored?.setSelectionRange(restored.value.length, restored.value.length);
    }, 600);
  });
  searchField.appendChild(search);
  toolbar.appendChild(searchField);
  const leagueOptions = [["", "All leagues"], ...directory.leagues.map(league => [league.id, league.displayName||league.name])];
  toolbar.appendChild(buildDirectorySelect("League", filters.leagueId, leagueOptions, leagueId => {
    updateDirectoryFilters(sportKey, { leagueId, teamId: "", expandedTeamIds: [], expandedTeamId: "" }); renderStandingsContext();
  }));
  const teamOptions = [["", "All clubs"], ...directory.teams
    .filter(team => !filters.leagueId || team.leagueId === filters.leagueId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(team => [team.id, team.displayName])];
  toolbar.appendChild(buildDirectorySelect("Club", filters.teamId, teamOptions, teamId => {
    updateDirectoryFilters(sportKey, { teamId, expandedTeamIds: teamId ? [teamId] : [], expandedTeamId: "" }); renderStandingsContext();
  }));
  const countries = Array.from(new Set(directory.players.map(player => player.birthCountryCode).filter(Boolean))).sort((a, b) => (
    COUNTRY_FLAGS.countryName(a).localeCompare(COUNTRY_FLAGS.countryName(b))
  ));
  if (countries.length){
    toolbar.appendChild(buildDirectorySelect("Country", filters.birthCountryCode, [["", "All countries"], ...countries.map(code => [code, COUNTRY_FLAGS.countryName(code)])], birthCountryCode => {
      updateDirectoryFilters(sportKey, { birthCountryCode }); renderStandingsContext();
    }));
  }
  if (sportKey === "football"){
    toolbar.appendChild(buildDirectorySelect("Rank", filters.prominenceTier, [
      ["", "All players"], ["emerging", "Emerging"], ["established", "Established"], ["marquee", "Marquee"],
    ], prominenceTier => {
      updateDirectoryFilters(sportKey, { prominenceTier }); renderStandingsContext();
    }));
  }
  const hasMarketValues = directory.players.some(player => Number.isFinite(Number(player.marketValue ?? player.marketValueEur)));
  const sortOptions = [["table", sportKey === "football" ? "Table / ladder" : "Ranking / ladder"]];
  if (hasMarketValues) sortOptions.push(["value", `Value · ${directory.valueSource?.label || "current source"}`]);
  sortOptions.push(["alpha", "A–Z"]);
  toolbar.appendChild(buildDirectorySelect("Sort", filters.sortMode, sortOptions, sortMode => {
    updateDirectoryFilters(sportKey, { sortMode }); renderStandingsContext();
  }));
  return toolbar;
}

function buildFootballPlayerRow(player, sportKey = "football"){
  const row = document.createElement("div");
  row.className = "football-player-row";
  row.dataset.scrollKey = `directory-player:${sportKey}:${player.id}`;
  const identity = document.createElement(player.profileRef ? "button" : "div");
  if (player.profileRef) identity.type = "button";
  identity.className = "football-player-name";
  if (player.birthCountryCode){
    const countryName = COUNTRY_FLAGS.countryName(player.birthCountryCode);
    const flagLabel = player.birthCountryBasis === "official-birthplace" ? `Born in ${countryName}` : `Country: ${countryName}`;
    identity.innerHTML = COUNTRY_FLAGS.flagMarkup(player.birthCountryCode, { label: flagLabel });
  }
  const name = document.createElement("span");
  name.textContent = player.displayName;
  identity.appendChild(name);
  identity.dataset.profileTrigger='player:'+player.id;identity.setAttribute('aria-label',`Open ${player.displayName} profile in Follow`);identity.onclick=()=>void openAthleteProfile(player.id,player.displayName,sportKey,identity);identity.setAttribute('role','button');identity.tabIndex=0;identity.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();identity.click();}};
  const position = document.createElement("span");
  position.className = "football-player-position";
  position.textContent = player.position;
  const tier = document.createElement("span");
  tier.className = "football-player-tier";
  tier.textContent = player.prominenceTier || "";
  tier.title = player.prominenceReason || "";
  const follow = buildDirectoryFollowButton(player.id, { sportKey, leagueId: player.leagueId, label: player.displayName });
  if (player.prominenceTier) row.append(identity, position, tier, follow);
  else {
    row.classList.add("without-tier");
    row.append(identity, position, follow);
  }
  return row;
}

function buildFootballClubRow(team, league, players, expanded, sportKey = "football"){
  const row = document.createElement("section");
  row.className = "football-club-row";
  row.dataset.scrollKey = `directory-team:${sportKey}:${team.id}`;
  const head = document.createElement("div");
  head.className = "football-club-head";
  const mark = CARD_IDENTITIES?.participantMarks?.[team.id];
  const missingChampionshipCrest=team.leagueId==='competition:australian-championship'&&!team.crestUrl&&!mark;
  const crest = document.createElement(missingChampionshipCrest?"span":"img");
  crest.className = "football-club-crest";
  crest.dataset.scrollStable = `directory-crest:${sportKey}:${team.id}`;
  if(missingChampionshipCrest){crest.innerHTML=glyphMarkup('sport:football');crest.setAttribute('aria-hidden','true');}
  else if (mark) applyTeamLogoAsset(crest, mark, "icon");
  else {
    installIdentityImageRecovery(crest);
    crest.src = team.crestUrl || "";
  }
  crest.alt = `${team.displayName} crest`;
  crest.width = 38;
  crest.height = 38;
  crest.loading = "lazy";
  crest.decoding = "async";
  const copy = document.createElement("div");
  copy.className = "football-club-copy";
  const title = document.createElement("strong");
  title.textContent = team.displayName;title.dataset.profileTrigger='team:'+team.id;title.setAttribute('role','button');title.setAttribute('aria-label',`Open ${team.displayName} profile in Follow`);title.tabIndex=0;title.onclick=()=>void openAthleteProfile(team.id,team.displayName,sportKey,title);title.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();title.click();}};
  const detail = document.createElement("span");
  const playerScope = ["nrl", "afl", "aflw"].includes(sportKey) ? "current player" : "priority player";
  detail.textContent = team.leagueId==='competition:australian-championship' ? 'Australian Championship · Player directory unavailable' : `${league?.displayName || SPORT_META[sportKey]?.label || "Sport"} · ${players.length} ${playerScope}${players.length === 1 ? "" : "s"}`;
  copy.append(title, detail);
  const follow = buildDirectoryFollowButton(team.id, { sportKey, leagueId: team.leagueId, label: team.displayName });
  const expander = document.createElement("button");
  expander.type = "button";
  expander.className = "football-club-expand";
  expander.setAttribute("aria-expanded", String(expanded));
  expander.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${team.displayName} players`);
  expander.innerHTML = glyphMarkup("ui:chevron-right");
  expander.addEventListener("click", () => {
    const liveRow = Array.from(document.querySelectorAll("[data-scroll-key]"))
      .find(element => element.dataset.scrollKey === `directory-team:${sportKey}:${team.id}`) || row;
    const current = new Set(directoryFilters(sportKey).expandedTeamIds);
    if (current.has(team.id)) current.delete(team.id);
    else current.add(team.id);
    mutateWithScrollContinuity(liveRow, () => {
      updateDirectoryFilters(sportKey, { expandedTeamIds:Array.from(current), expandedTeamId:"" });
      renderStandingsContext();
    }, {
      restoreFocus:true,
      focusTarget:`[data-directory-team-id="${CSS.escape(team.id)}"] .football-club-expand`,
      anchorStrategy:"target",
    });
  });
  head.append(crest, copy, follow, expander);
  row.dataset.directoryTeamId = team.id;
  row.appendChild(head);
  if (expanded){
    const list = document.createElement("div");
    list.className = "football-player-list";
    players.forEach(player => list.appendChild(buildFootballPlayerRow(player, sportKey)));
    if (!players.length){
      const empty = document.createElement("div");
      empty.className = "football-directory-empty";
      empty.textContent = team.leagueId==='competition:australian-championship' ? 'Player directory unavailable.' : "No priority players match the current filters.";
      list.appendChild(empty);
    }
    row.appendChild(list);
  }
  return row;
}

function renderFootballDirectory(container, {
  sportKey = "football",
  directoryData = footballDirectoryData,
  loading = footballDirectoryLoading,
  error = footballDirectoryError,
  loadDirectory = loadFootballDirectoryData,
} = {}){
  if (!directoryData){
    const status = document.createElement("div");
    status.className = "standings-module";
    const sportLabel = SPORT_META[sportKey]?.label || "Sport";
    status.textContent = error ? `${sportLabel} teams and players are temporarily unavailable.` : `Loading ${sportLabel.toLocaleLowerCase("en-AU")} teams and players…`;
    if (error){
      const retry = document.createElement("button"); retry.type = "button"; retry.className = "btn ghost"; retry.textContent = "Retry directory";
      retry.addEventListener("click", () => { retry.disabled = true; void loadDirectory(); }); status.appendChild(retry);
    }
    container.appendChild(status);
    if (!loading && !error) void loadDirectory();
    return;
  }
  directoryData={...directoryData,teams:directoryData.teams.filter(record=>!NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam(record))};
  const filters = directoryViewFilters(sportKey,[...directoryData.teams,...directoryData.players]);
  const filtered = footballDirectoryApi.filteredDirectory(directoryData, filters);
  const collections=followCollectionsById();
  filtered.teams=footballDirectoryApi.followOrder(filtered.teams,userPreferences,collections);
  filtered.players=footballDirectoryApi.followOrder(filtered.players,userPreferences,collections);
  const leagues = new Map(directoryData.leagues.map(league => [league.id, league]));
  const playersByTeam = new Map();
  filtered.players.forEach(player => {
    const players = playersByTeam.get(player.currentTeamId) || [];
    players.push(player);
    playersByTeam.set(player.currentTeamId, players);
  });
  const directory = document.createElement("section");
  directory.className = "football-directory";
  appendDirectoryEntityTabs(directory,sportKey,filters);
  directory.appendChild(buildFootballDirectoryToolbar(directoryData, filters, sportKey));
  if(filters.entityType==='athlete'){
    const list=document.createElement('div');list.className='football-club-list';const batchKey=JSON.stringify(['players:'+sportKey,filters]);const limit=followDirectoryBatchLimits.get(batchKey)||40;
    filtered.players.slice(0,limit).forEach(player=>list.append(buildFootballPlayerRow(player,sportKey)));directory.append(list);
    if(!filtered.players.length){const empty=document.createElement('p');empty.textContent=filters.leagueId==='competition:australian-championship'?'Player directory unavailable.':'No players match these filters.';directory.append(empty);}
    if(filtered.players.length>limit){const more=document.createElement('button');more.className='btn ghost';more.textContent='Show more players';more.onclick=()=>{followDirectoryBatchLimits.set(batchKey,limit+40);renderStandingsContext();};directory.append(more);}container.append(directory);return;
  }
  const summary = document.createElement("p");
  summary.className = "football-directory-summary";
  const directoryNote = ["nrl", "afl", "aflw"].includes(sportKey)
    ? " Current official squad list at the directory refresh time."
    : directoryData.players.some(player => player.birthCountryCode)
      ? " Flags use evidenced birthplace where published; provider country is labelled as country, not birthplace."
      : " Players are a source-backed priority shortlist, not a weekly team list.";
  summary.textContent = filters.leagueId==='competition:australian-championship' ? `${filtered.teams.length} clubs · Player directory unavailable.` : `${filtered.teams.length} club${filtered.teams.length === 1 ? "" : "s"} · ${filtered.players.length} matching player${filtered.players.length === 1 ? "" : "s"}.${directoryNote}`;
  directory.appendChild(summary);
  const list = document.createElement("div");
  list.className = "football-club-list";
  list.dataset.scrollList = `directory-teams:${sportKey}`;
  const batchKey=JSON.stringify([`clubs:${sportKey}`,filters]);
  const limit=followDirectoryBatchLimits.get(batchKey)||40;
  let competitionGroup='';
  filtered.teams.slice(0,limit).forEach(team => {
    const group=footballDirectoryApi.competitionGroup(team);
    if(group!==competitionGroup){competitionGroup=group;const heading=document.createElement('h3');heading.textContent=group;list.appendChild(heading);}
    const players = playersByTeam.get(team.id) || [];
    const autoExpanded = Boolean(filters.query.trim() && players.length);
    list.appendChild(buildFootballClubRow(team, leagues.get(team.leagueId), players, autoExpanded || filters.expandedTeamIds.includes(team.id), sportKey));
  });
  if (!filtered.teams.length){
    const empty = document.createElement("div");
    empty.className = "football-directory-empty";
    empty.textContent = "No clubs or players match these filters.";
    list.appendChild(empty);
  }
  directory.appendChild(list);
  if(filtered.teams.length>limit){
    const more=document.createElement('button');more.type='button';more.className='btn ghost directory-load-more';
    more.textContent=`Show more (${Math.min(limit,filtered.teams.length)} of ${filtered.teams.length})`;
    more.onclick=()=>{followDirectoryBatchLimits.set(batchKey,limit+40);const anchor=captureViewportRenderAnchor();renderStandingsContext();restoreViewportRenderAnchor(anchor);};
    directory.appendChild(more);
  }
  container.appendChild(directory);
}

function renderLegacyParticipantDirectory(container, sportKey){
  const chunk = followDirectoryChunks.get(sportKey);
  if (!footballDirectoryApi || !chunk){
    const state = document.createElement("div");
    state.className = "standings-module football-directory-empty";
    const failed = followDirectoryChunkErrors.has(sportKey);
    state.textContent = failed
      ? `${SPORT_META[sportKey]?.label || sportKey} teams and players are temporarily unavailable.`
      : `Loading the current ${SPORT_META[sportKey]?.label || sportKey} directory…`;
    if (failed){
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn ghost";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => {
        followDirectoryChunkErrors.delete(sportKey);
        renderStandingsContext();
      });
      state.appendChild(retry);
    }
    container.appendChild(state);
    if (!failed){
      Promise.all([loadFootballDirectoryModule(), loadFollowDirectoryChunk(sportKey)])
        .then(() => queueScrollIdleMutation(renderStandingsContext))
        .catch(error => {followDirectoryChunkErrors.set(sportKey,error);queueScrollIdleMutation(renderStandingsContext);});
    }
    return;
  }
  // Profiles load only when a participant is opened.
  const filters = directoryViewFilters(sportKey,chunk.records);
  const curatedIds = (chunk.browseGroups || []).flatMap(group=>group.memberIds);
  const curatedOrder = new Map(curatedIds.map((id,index)=>[id,index]));
  const allRecords = chunk.records.filter(record=>!NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam(record)).map(record => ({
    ...record,
    rank: FOLLOW_FIRST?.normalizeDirectoryRank?.(record.ranking ?? record.ladderPosition) ?? null,
  }));
  const rosterCountries = new Map();
  allRecords.filter(record => record.entityType === "athlete" && record.currentTeamId && record.countryCode).forEach(record => {
    const countries = rosterCountries.get(record.currentTeamId) || new Set();
    countries.add(record.countryCode);
    rosterCountries.set(record.currentTeamId, countries);
  });
  const motorsportDirectory = ["motorsport", "f1", "wrc"].includes(sportKey);
  const separatedEntityDirectory = !sportKey.startsWith("cricket");
  const collectionsById = new Map((chunk.collections || []).map(collection => [collection.id, collection]));
  const selectedCollectionMemberIds = new Set(collectionsById.get(filters.collectionId)?.memberIds || []);
  const records = allRecords
    .filter(record=>!sportKey.startsWith('cricket')||NOTHINGSPORTS_CRICKET_COVERAGE.policy.bblTeams.some(n=>record.id==='team:cricket:'+n)===(filters.cricketFormat==='BBL'))
    .filter(record => !separatedEntityDirectory || record.entityType === filters.entityType)
    .filter(record => !filters.collectionId || selectedCollectionMemberIds.has(record.id))
    .filter(record => !filters.birthCountryCode || record.countryCode === filters.birthCountryCode)
    .filter(record => !filters.genderCategory || record.genderCategory === filters.genderCategory || ['unknown','mixed'].includes(record.genderCategory))
    .filter(record => Number.isFinite(footballDirectoryApi.searchMatchScore(record, filters.query)))
    .sort((first, second) => {
      if(!filters.query)return NOTHINGSPORTS_PARTICIPANT_DIRECTORY.compare(first,second,allRecords);
      if (filters.query){
        const scoreDelta = footballDirectoryApi.searchMatchScore(first, filters.query) - footballDirectoryApi.searchMatchScore(second, filters.query);
        if (scoreDelta) return scoreDelta;
      }
      if (filters.sortMode === "value"){
        const left = Number(first.marketValue ?? first.marketValueEur);
        const right = Number(second.marketValue ?? second.marketValueEur);
        if (Number.isFinite(left) || Number.isFinite(right)) return (Number.isFinite(right) ? right : -1) - (Number.isFinite(left) ? left : -1);
      }
      if (filters.sortMode === "table"){
        const left = first.rank;
        const right = second.rank;
        if (left !== null || right !== null) return (left ?? Number.MAX_SAFE_INTEGER) - (right ?? Number.MAX_SAFE_INTEGER);
      }
      return String(first.displayName || "").localeCompare(String(second.displayName || ""), "en-AU", { sensitivity:"base" });
    });
  if(!filters.query)records.sort((a,b)=>NOTHINGSPORTS_PARTICIPANT_DIRECTORY.compare(a,b,allRecords));
  const directory = document.createElement("section");
  directory.className = "football-directory";
  if (separatedEntityDirectory){
    appendDirectoryEntityTabs(directory,sportKey,filters);
  }
  const toolbar = document.createElement("div");
  toolbar.className = "football-directory-toolbar";
  const field = document.createElement("label");
  field.className = "football-directory-field";
  field.textContent = "Search";
  const search = document.createElement("input");
  search.type = "search";
  search.value = filters.query;
  search.placeholder = "Team or player";
  search.addEventListener("input", () => {
    updateDirectoryFilters(sportKey, { query: search.value });
    window.clearTimeout(footballDirectorySearchTimer);
    footballDirectorySearchTimer = window.setTimeout(() => {
      renderStandingsContext();
      const restored = document.querySelector('.football-directory-field input[type="search"]');
      restored?.focus({ preventScroll: true });
      restored?.setSelectionRange(restored.value.length, restored.value.length);
    }, 600);
  });
  field.appendChild(search);
  toolbar.appendChild(field);
  if (sportKey.startsWith("tennis") && filters.entityType==='athlete' && collectionsById.size){
    const listOptions = [["", "All players"], ...Array.from(collectionsById.values())
      .sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0))
      .map(collection => [collection.id, collection.label])];
    toolbar.appendChild(buildDirectorySelect("List", filters.collectionId, listOptions, collectionId => {
      updateDirectoryFilters(sportKey, { collectionId }); renderStandingsContext();
    }));
  }
  const countries = Array.from(new Set(allRecords.map(record => record.countryCode).filter(Boolean)))
    .sort((first, second) => COUNTRY_FLAGS.countryName(first).localeCompare(COUNTRY_FLAGS.countryName(second)));
  if (countries.length){
    toolbar.appendChild(buildDirectorySelect("Country", filters.birthCountryCode, [["", "All countries"], ...countries.map(code => [code, COUNTRY_FLAGS.countryName(code)])], birthCountryCode => {
      updateDirectoryFilters(sportKey, { birthCountryCode }); renderStandingsContext();
    }));
  }
  if(sportKey.startsWith('cricket'))toolbar.appendChild(buildDirectorySelect('Format',filters.cricketFormat,[['Tests','Tests'],['ODIs','ODIs'],['T20Is','T20Is'],...(!sportKey.endsWith('-women')?[['BBL','BBL']]:[])],cricketFormat=>{updateDirectoryFilters(sportKey,{cricketFormat});renderStandingsContext();}));
  const hasValues = allRecords.some(record => Number.isFinite(Number(record.marketValue ?? record.marketValueEur)));
  toolbar.appendChild(buildDirectorySelect("Sort", filters.sortMode, [
    ["table", allRecords.some(record => record.rank !== null) ? "Ranking / ladder" : "Ranking / A–Z"],
    ...(hasValues ? [["value", "Value"]] : []),
    ["alpha", "A–Z"],
  ], sortMode => {
    updateDirectoryFilters(sportKey, { sortMode }); renderStandingsContext();
  }));
  directory.appendChild(toolbar);
  const list = document.createElement("div");
  list.className = "football-club-list";
  list.dataset.scrollList = `directory-participants:${sportKey}`;
  const batchKey=JSON.stringify([sportKey,filters]);
  const limit=followDirectoryBatchLimits.get(batchKey)||40;
  let directoryGroup='';
  records.slice(0,limit).forEach(record => {
    const curatedGroup=(chunk.browseGroups || []).find(group=>group.memberIds.includes(record.id));
    const group=curatedGroup?.label || (record.teamKind==='national'||record.competitionScope==='international'?'International':record.teamKind==='club'||record.competitionScope==='domestic'?'Domestic':'Open competition');
    if(group!==directoryGroup){directoryGroup=group;const heading=document.createElement('h3');heading.className='follow-directory-group';heading.textContent=group;list.appendChild(heading);}
    const row = document.createElement("div");
    row.className = "football-club-head follow-directory-row";
    const icon = document.createElement("span");
    icon.className = "follow-directory-identity identity-frame";
    const originalIdentityUrl = record.logoUrl || record.headshotUrl || null;
    const isF1Record = /^(?:competitor|team):f1:/.test(String(record.id || ""));
    const isWrcRecord = /^(?:competitor|team):wrc:/.test(String(record.id || ""));
    const identityUrl = isF1Record && record.entityType === "athlete"
      ? originalIdentityUrl?.replace("/c_fill,w_720/", "/c_fill,w_96,h_96,g_north/")
      : originalIdentityUrl;
    const mark = CARD_IDENTITIES?.participantMarks?.[record.id]
      || (identityUrl ? { url:identityUrl, logo:{ primary:identityUrl, dark:record.logoDarkUrl || identityUrl } } : null);
    const athlete = record.entityType === "athlete";
    icon.classList.toggle("is-athlete", athlete);
    icon.classList.toggle("on-dark", !athlete && mark?.logo?.backgroundLight === "dark");
    const nationalTeam = record.entityType === "team" && record.teamKind === "national";
    const showNationalityFlag = athlete && (!record.currentTeamId || (rosterCountries.get(record.currentTeamId)?.size || 0) > 1);
    if (mark?.url || mark?.logo?.primary){
      const image = document.createElement("img");
      image.alt = `${record.displayName} identity`;
      image.width = 40;
      image.height = 40;
      image.loading = "lazy";
      image.decoding = "async";
      applyTeamLogoAsset(image, mark, "icon");
      image.addEventListener("error", () => {
        icon.replaceChildren();
        if (showNationalityFlag){
          const flag = COUNTRY_FLAGS?.flagMarkup?.(record.countryCode, { label:record.displayName });
          if (flag) icon.insertAdjacentHTML("beforeend", flag);
          else appendClubIdentityFallback(icon, record.displayName, "team-logo-fallback follow-directory-fallback");
        } else if (nationalTeam) appendTeamIdentityFallback(icon, { isNationalTeam:true, teamKind:"national", label:record.displayName }, record.displayName, "team-logo-fallback follow-directory-fallback");
        else appendClubIdentityFallback(icon, record.displayName, "team-logo-fallback follow-directory-fallback");
      }, { once:true });
      icon.appendChild(image);
    } else if (showNationalityFlag){
      appendTeamIdentityFallback(icon, { countryCode:record.countryCode, fallbackCountryCode:record.countryCode, label:record.displayName }, record.displayName, "team-logo-fallback follow-directory-fallback");
    } else if (nationalTeam){
      appendTeamIdentityFallback(icon, { isNationalTeam:true, teamKind:"national", label:record.displayName }, record.displayName, "team-logo-fallback follow-directory-fallback");
    } else appendClubIdentityFallback(icon, record.displayName, "team-logo-fallback follow-directory-fallback");
    const copy = document.createElement("div");
    copy.className = "football-club-copy";
    const name = document.createElement("strong");
    name.textContent = record.displayName;
    if (showNationalityFlag && record.countryCode){
      const flag = COUNTRY_FLAGS?.flagMarkup?.(record.countryCode, { label:`${record.displayName} nationality` });
      if (flag) name.insertAdjacentHTML("afterbegin", `${flag} `);
    }
    const detail = document.createElement("span");
    const rankLabel = record.rank !== null ? ` · ${record.rankingBasis||'Rank'} ${record.rank}${record.rankingEffectiveOn?' · '+record.rankingEffectiveOn:record.rankingCheckedOn?' · checked '+record.rankingCheckedOn:''}` : sportKey === "tennis" && record.watchPoolMember ? " · Watch list · Unranked" : "";
    const competitionNumber = Number(record.competitionNumber || 0);
    const numberLabel = athlete && !isWrcRecord && record.competitionNumberKind ? ` · ${competitionNumber > 0 ? `No. ${competitionNumber}` : "No. TBC"}` : "";
    const wrcRole = ({ driver:"Driver", "co-driver":"Co-driver", manufacturer:"Manufacturer" })[record.position];
    detail.textContent = `${isWrcRecord ? wrcRole || (athlete ? "Competitor" : "Manufacturer") : motorsportDirectory ? (athlete ? "Driver" : "Constructor") : record.sectionLabel || FOLLOW_FIRST?.directoryEntityLabel?.(record) || "Selection"}${numberLabel}${rankLabel}`;
    copy.append(name, detail);
    const follow = record.profileOnly ? document.createElement("span") : buildDirectoryFollowButton(record.id, { sportKey, label: record.displayName, cricketFormat: sportKey.startsWith('cricket') ? filters.cricketFormat : null });
    [icon,copy].forEach(target=>{target.dataset.profileTrigger=(target===icon?'icon:':'copy:')+record.id;target.setAttribute('aria-label',`Open ${record.displayName} profile in Follow`);target.setAttribute('role','button');target.tabIndex=0;target.onclick=()=>void openAthleteProfile(record.id,record.displayName,isF1Record?'f1':sportKey,target);target.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();target.click();}};});
    row.append(icon, copy, follow);
    list.appendChild(row);
  });
  if (!records.length){
    const empty = document.createElement("div");
    empty.className = "football-directory-empty";
    empty.textContent = chunk.status === "unavailable"
      ? `No current source-backed ${SPORT_META[sportKey]?.label || sportKey} directory is published yet.`
      : sportKey === "tennis"
        ? "No Tennis players match these filters."
        : `No current ${SPORT_META[sportKey]?.label || sportKey} teams or players match these filters.`;
    list.appendChild(empty);
  }
  directory.appendChild(list);
  if(records.length>limit){
    const more=document.createElement('button');more.type='button';more.className='btn ghost directory-load-more';
    more.textContent=`Show more (${Math.min(limit,records.length)} of ${records.length})`;
    more.onclick=()=>{followDirectoryBatchLimits.set(batchKey,limit+40);const anchor=captureViewportRenderAnchor();renderStandingsContext();restoreViewportRenderAnchor(anchor);};
    directory.appendChild(more);
  }
  container.appendChild(directory);
}

function renderTeamsAndPlayersDirectoryLoaded(container){
  const session = readStandingsDirectorySession();
  const directorySportOptions = BASE_SPORT_SELECTOR_ENTITIES
    .filter(entity => Number(entity.level) === 2 && entity.id !== 'sport:horse-racing')
    .map(entity => [entity.id.replace(/^sport:/, ""), entity.label]);
  const aflIndex = directorySportOptions.findIndex(([key]) => key === "afl");
  if (aflIndex >= 0) directorySportOptions.splice(aflIndex + 1, 0, ["aflw", "AFLW"]);
  const chooser = buildDirectorySelect("Sport", session.directorySportKey, directorySportOptions, sportKey => {
    updateStandingsDirectorySession({ directorySportKey: sportKey });
    renderStandingsContext();
  });
  const toolbar = document.createElement("div");
  toolbar.className = "football-directory-sport-choice";
  toolbar.appendChild(chooser);
  container.appendChild(toolbar);
  if(['football','nrl','afl','aflw'].includes(session.directorySportKey)){
    const sportKey=session.directorySportKey,chunk=followDirectoryChunks.get(sportKey);
    if(!chunk||!footballDirectoryApi){renderLegacyParticipantDirectory(container,sportKey);return;}
    const teams=chunk.records.filter(record=>record.entityType==='team'),byTeam=new Map(teams.map(record=>[record.id,record])),leagues=new Map();
    const records=chunk.records.map(record=>{const leagueId=record.leagueId||byTeam.get(record.currentTeamId)?.leagueId||'competition:'+sportKey;leagues.set(leagueId,{id:leagueId,displayName:record.leagueName||leagueId.replace(/^competition:/,'').replaceAll('-',' ')});return {...record,leagueId,...(/birth/i.test(record.countryBasis||'')?{birthCountryCode:record.countryCode}:{}),rank:record.ranking};});
    renderFootballDirectory(container,{sportKey,directoryData:{teams:records.filter(r=>r.entityType==='team'),players:records.filter(r=>r.entityType==='athlete'),leagues:[...leagues.values()]}});
  }else renderLegacyParticipantDirectory(container,session.directorySportKey);
}

function renderFollowViewLoaded(){
  if(!globalThis.NOTHINGSPORTS_FOLLOW_NAV){
    const panel=document.getElementById('listView');panel.replaceChildren();buildFollowHomeTabs(panel);const state=document.createElement('p');state.textContent='Loading sports…';state.setAttribute('role','status');panel.append(state);
    void loadDeferredScript('assets/js/follow-navigation.js?v=522').then(()=>{if(activeTab==='follow')renderFollowView();}).catch(()=>{if(activeTab==='follow'){panel.textContent='Follow could not load. ';const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=renderFollowView;panel.append(retry);}});return;
  }
  const oldNavigation=document.querySelector('#listView > .follow-navigation');
  if(oldNavigation){for(const child of [...oldNavigation.querySelector('#follow-navigation-controls').children])oldNavigation.before(child);oldNavigation.remove();}
  const focusDisclosure=document.activeElement?.closest('[data-follow-disclosure]')?.dataset.followDisclosure;
  if(focusDisclosure)requestAnimationFrame(()=>{if(document.activeElement===document.body)document.querySelector(`[data-follow-disclosure="${CSS.escape(focusDisclosure)}"] summary`)?.focus({preventScroll:true});});
  document.querySelectorAll('[data-follow-disclosure]').forEach(d=>followDisclosureState.set(d.dataset.followDisclosure,d.open));
  resetFeedCardWindow();
  const container=document.getElementById('listView');
  const retainedBar=container.querySelector(':scope > .follow-sport-bar');
  for(const child of [...container.children])if(child!==retainedBar)child.remove();
  container.className='follow-view';container.dataset.scrollList='follow';
  const state={...followBrowseState()};
  const raceOnly=state.sportId==='sport:horse-racing';
  if(raceOnly&&!['schedule','major-events'].includes(state.section))state.section='schedule';
  if(!userPreferences.followBrowse)saveFollowBrowse(state);
  const female=entity=>/-women$/.test(entity.id)||['sport:aflw','sport:nrlw','sport:fiba-women','sport:netball'].includes(entity.id);
  const gender=state.gender||(female({id:state.sportId})?'women':'men');
  const sports=orderSelectorEntities(BASE_SPORT_SELECTOR_ENTITIES.filter(entity=>Number(entity.level)===2||['sport:aflw','sport:nrlw'].includes(entity.id)).filter(entity=>entity.id==='sport:horse-racing'||female(entity)===(gender==='women')));
  const genderTabs=document.createElement('nav');genderTabs.className='follow-gender-tabs events-view-tabs';genderTabs.setAttribute('role','tablist');genderTabs.setAttribute('aria-label','Browse sports gender');
  for(const [value,label]of [['men','Men'],['women','Women']]){const button=document.createElement('button');button.type='button';button.className='btn ghost'+(value===gender?' active':'');button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(value===gender));button.onclick=()=>{if(value===gender)return;const sportId=value==='women'?'sport:tennis-women':rankedFollowGridSports(BASE_SPORT_SELECTOR_ENTITIES.filter(e=>Number(e.level)===2&&!female(e)))[0]?.id||'sport:afl';const genderRoutes={...(state.genderRoutes||{}),[gender]:{sportId:state.sportId,categoryId:state.categoryId,section:state.section}};saveFollowBrowse({sportId,categoryId:'',section:'teams-players',...(genderRoutes[value]||{}),gender:value,genderRoutes});activeInspectorCodeId=null;renderFollowView();};genderTabs.append(button);}
  for(const [index,button]of [...genderTabs.children].entries())button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?1:1-index;genderTabs.children[target].click();requestAnimationFrame(()=>container.querySelector('.follow-gender-tabs [aria-selected="true"]')?.focus({preventScroll:true}));});
  container.insertBefore(genderTabs,retainedBar);
  const primarySports=rankedFollowGridSports(sports);
  if(gender==='women'&&!primarySports.length){const tennis=sports.find(e=>e.id==='sport:tennis-women');if(tennis)primarySports.push(tennis);}
  const primaryIds=primarySports.map(entity=>entity.id);
  const gridFingerprint=gender+'|'+primaryIds.join('|');
  if(retainedBar&&retainedBar.dataset.sportOrder!==gridFingerprint){retainedBar.remove();}
  const currentBar=container.querySelector(':scope > .follow-sport-bar');
  if(!currentBar){
  const bar=document.createElement('nav');bar.className='follow-sport-bar';bar.setAttribute('aria-label','Choose sport');
  bar.dataset.sportOrder=gridFingerprint;
  const primaryLabels={'sport:afl':'AFL','sport:nrl':'NRL','sport:rugby':'Rugby Union','sport:football':'Football','sport:cricket':'Cricket','sport:tennis':'Tennis','sport:motorsport':'Motorsport','sport:nba':'Basketball','sport:nbl':'NBL','sport:american-football':'NFL'};
  const countByKey=new Map((followDirectoryManifest?.sports||[]).map(item=>[item.key,Number(item.recordCount||0)]));
  const moreSports=sports.filter(entity=>!primaryIds.includes(entity.id)).sort((a,b)=>{
    const priority=id=>id==='sport:american-football'?0:id==='sport:nbl'?1:2;
    const priorityDifference=priority(a.id)-priority(b.id);if(priorityDifference)return priorityDifference;
    const count=entity=>Math.max(...(entity.canonicalSportKeys||[]).map(key=>countByKey.get(key)||0),countByKey.get(entity.id.replace(/^sport:/,''))||0);
    return count(b)-count(a) || Number(a.editorialOrder||999)-Number(b.editorialOrder||999);
  });
  const addSportButton=(entity,label=entity.label,host=bar)=>{
    const button=document.createElement('button');button.type='button';button.className=`follow-sport-icon${entity.id===state.sportId?' active':''}`;
    button.dataset.followSport=entity.id;button.setAttribute('aria-pressed',String(entity.id===state.sportId));
    const sport={key:entity.preferenceKey||entity.sportKey||({ 'rugby-union':'rugby',basketball:'nba','afl-premiership':'afl','nrl-premiership':'nrl' })[entity.id.replace('sport:','')]||entity.id.replace('sport:','')};
    const mark=document.createElement('span');mark.className='follow-sport-mark';renderEventIdentityMark(mark,sport,{...sportMetaForEvent(sport),label:entity.label});
    const text=document.createElement('span');text.textContent=label;button.append(mark,text);
    button.addEventListener('click',()=>{host.closest('dialog')?.close();NOTHINGSPORTS_FOLLOW_NAV.closeMenu();saveFollowBrowse({sportId:entity.id,categoryId:'',section:entity.id==='sport:horse-racing'?'schedule':'teams-players',scheduleScope:null});activeInspectorCodeId=null;renderFollowView();});host.appendChild(button);
    return button;
  };
  primarySports.forEach(entity=>addSportButton(entity,primaryLabels[entity.id]||entity.label));
  const more=document.createElement('button');more.type='button';more.className=`follow-sport-icon follow-more-trigger${moreSports.some(entity=>entity.id===state.sportId)?' active':''}`;more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-label','More sports');
  const moreMark=document.createElement('span');moreMark.className='follow-sport-mark follow-more-mark';moreMark.textContent='⋯';const moreLabel=document.createElement('span');moreLabel.textContent='More';more.append(moreMark,moreLabel);bar.appendChild(more);
  const dialog=document.createElement('dialog');dialog.className='follow-more-dialog';dialog.setAttribute('aria-label','More sports');
  const dialogHead=document.createElement('div');dialogHead.className='follow-more-head';const title=document.createElement('h2');title.textContent='More sports';const close=document.createElement('button');close.type='button';close.className='btn ghost';close.textContent='Close';close.onclick=()=>dialog.close();dialogHead.append(title,close);
  const moreGrid=document.createElement('div');moreGrid.className='follow-more-grid';moreSports.forEach(entity=>addSportButton(entity,entity.id==='sport:american-football'?'NFL':entity.label,moreGrid));dialog.append(dialogHead,moreGrid);bar.appendChild(dialog);
  more.onclick=()=>dialog.showModal();
  container.appendChild(bar);
  } else {
    currentBar.querySelectorAll('[data-follow-sport]').forEach(button=>{const selected=button.dataset.followSport===state.sportId;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
    currentBar.querySelector('.follow-more-trigger')?.classList.toggle('active',!primaryIds.includes(state.sportId));
  }
  const root=selectorEntityById(state.sportId) || sports[0];
  const children=(root.childIds || []).map(selectorEntityById).filter(Boolean).filter(e=>female(e)===(gender==='women'));
  if (children.length){
    const choices=document.createElement('nav');choices.className='follow-category-bar';choices.setAttribute('aria-label',`${root.label} categories`);
    const items=root.id==='sport:afl'?children:[{...root,label:`All ${root.label}`},...children];
    items.forEach(entity=>{
      const button=document.createElement('button');button.type='button';button.className=`btn ghost${state.categoryId===entity.id?' active':''}`;button.textContent=entity.label;
      button.onclick=()=>{saveFollowBrowse({categoryId:entity.id,section:'teams-players',scheduleScope:null});activeInspectorCodeId=null;renderFollowView();};choices.appendChild(button);
    });container.appendChild(choices);
    if (!state.categoryId){
      saveFollowBrowse({categoryId:root.id==='sport:football'?root.id:children[0].id});
    }
  }
  const entity=followSelectedEntity();
  const heading=document.createElement('h2');heading.textContent=entity.label;container.appendChild(heading);
  if (!codeInspectorManifest && !codeInspectorManifestLoading) void loadCodeInspectorManifest().then(()=>{if(activeTab==='follow') queueScrollIdleMutation(renderFollowView);}).catch(()=>{});
  const code=followInspectorCode(entity);
  const commonControls=document.createElement('div');commonControls.className='follow-common-controls';
  const followed=selectorEntityIsEffectivelySelected(entity.id,userPreferences);
  const followLabel=document.createElement('label');followLabel.className='follow-checkbox';
  const follow=document.createElement('input');follow.type='checkbox';follow.checked=followed;follow.setAttribute('aria-label',`Follow ${entity.label}`);
  follow.addEventListener('change',()=>saveFollowSport({id:entity.canonicalSportKeys?.[0],selectorId:entity.id,label:entity.label},follow.checked));
  followLabel.append(follow,document.createTextNode(`Follow ${entity.label}`));commonControls.appendChild(followLabel);
  if(entity.id==='sport:football'){
    const label=document.createElement('label');label.className='follow-checkbox';
    const league=document.createElement('input');league.type='checkbox';league.setAttribute('aria-label','Follow Australian Championship');
    league.checked=userPreferences.preferenceGraph?.competitionPreferences?.some(p=>p.competitionId==='competition:australian-championship'&&p.enabled===true)===true;
    league.onchange=()=>{const next=clonePreferences(userPreferences);next.preferenceGraph=PREFERENCE_SYSTEM.upsertCompetitionPreference(next.preferenceGraph,'competition:australian-championship',{enabled:league.checked,templateInheritedFromDomain:false});if(!savePreferences(next,{deliberate:true})){renderAll({preserveViewport:true});return;}void requestFeedRebuildAfterFollowChange();renderAll({preserveViewport:true});};
    label.append(league,document.createTextNode('Follow Australian Championship'));commonControls.append(label);
  }
  if(followed && FOLLOW_FEED_POLICY.australiansFilterUseful({selectorId:entity.id,key:followDirectoryKey(entity),competitionId:entity.competitionId})){
    const label=document.createElement('label');label.className='follow-checkbox';
    const au=document.createElement('input');au.type='checkbox';au.checked=(userPreferences.followFirst.australiansOnlySportIds || []).includes(entity.id);au.setAttribute('aria-label','Follow Australians');
    au.onchange=()=>{const next=clonePreferences(userPreferences);const ids=new Set(next.followFirst.australiansOnlySportIds || []);au.checked?ids.add(entity.id):ids.delete(entity.id);next.followFirst.australiansOnlySportIds=[...ids];if(!savePreferences(next,{deliberate:true})){renderAll({preserveViewport:true});return;}renderAll({preserveViewport:true});};
    label.append(au,document.createTextNode('Follow Australians'));commonControls.appendChild(label);
  }
  container.appendChild(commonControls);
  const tabs=document.createElement('nav');tabs.className='follow-section-tabs';tabs.setAttribute('aria-label',`${entity.label} sections`);
  [...(raceOnly?[]:[['teams-players',directorySectionLabel(followDirectoryKey(entity))]]),['schedule','Schedule'],...(code?.slug === "wrc" ? [["results", "Results / Replays"]] : []),...(!raceOnly&&followHasStandings(code)?[['standings',followStandingsLabel(code)]]:[]),['major-events','Major Events']].forEach(([section,label])=>{
    const button=document.createElement('button');button.type='button';button.className=`follow-section-tab${state.section===section?' active':''}`;button.textContent=label;
    button.onclick=()=>{activeInspectorCodeId=null;saveFollowBrowse({section});renderFollowView();};tabs.appendChild(button);
  });container.appendChild(tabs);
  followViewSection=state.section || 'schedule';
  NOTHINGSPORTS_FOLLOW_NAV.mount(container,entity,state);buildFollowHomeTabs(container);
  if(inspectorReturnState?.activeTab==='feed'){
    const back=document.createElement('button');back.type='button';back.className='btn ghost follow-feed-back';back.textContent='Back to Feed';back.onclick=backFromCodeInspector;container.insertBefore(back,container.firstChild);
  }
  if(['schedule','standings','results'].includes(followViewSection)){
    const panel=document.createElement('section');panel.className='follow-schedule-panel';container.append(panel);
    if(!code){panel.textContent=codeInspectorManifest?'No schedule published yet.':'Loading schedule…';return;}
    activeInspectorCodeId=code.id;codeInspectorTab=followViewSection==='standings'?'standings':followViewSection==='results'?'results':'all-fixtures';
    if(codeInspectorChunk?.code?.id!==code.id){
      panel.textContent='Loading schedule…';
      if(!codeInspectorChunkLoading||codeInspectorChunkLoading.codeId!==code.id)void loadCodeInspectorChunk(code.id).then(()=>{if(activeTab==='follow'&&followInspectorCode()?.id===code.id)renderFollowView();}).catch(()=>{if(panel.isConnected){panel.textContent='Couldn’t load the schedule. ';const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>renderFollowView();panel.append(retry);}});
      return;
    }
    renderCodeInspectorPanel(panel);return;
  }
  activeInspectorCodeId=null;
  if(followViewSection==='major-events'){
    if(followDirectoryKey(entity).startsWith('tennis')){renderTennisMajorEvents(container);return;}
    const host=document.createElement('div');host.textContent='Loading published events…';container.append(host);
    void loadDeferredScript('config/event-overviews-ui.js?v=595').then(()=>NOTHINGSPORTS_EVENT_OVERVIEWS_UI.followRows(host,followDirectoryKey(entity))).catch(()=>{if(host.isConnected){host.textContent='Events could not load. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry events';retry.onclick=renderFollowView;host.append(retry);}});
    return;
  }
  const panel=document.createElement('section');panel.className='follow-section-panel';panel.dataset.scrollKey=`follow-directory:${entity.id}`;
  const key=followDirectoryKey(entity);updateStandingsDirectorySession({directorySportKey:key});
  const content=document.createElement('div');content.className='follow-directory-content';
  renderTeamsAndPlayersDirectory(content);const guide=document.createElement('p');guide.className='chat-empty';guide.textContent=content.querySelector('.follow-directory-tabs [aria-pressed="true"]')?.textContent==='Teams'||key.startsWith('cricket')?'Follow teams to see their fixtures in Feed.':'Your individual follows choose the matches in Feed. Lists only filter this page; follow the players you want to see.';content.prepend(guide);content.querySelector('.football-directory-sport-choice')?.remove();
  content.querySelectorAll('.football-directory-field').forEach(field=>{if(field.querySelector('input[type=search]'))field.remove();});
  const search=document.createElement('div');search.className='follow-global-search';panel.append(search,content);container.appendChild(panel);
  void loadDeferredScript('assets/js/participant-search-ui.js?v=512').then(()=>{if(search.isConnected)NOTHINGSPORTS_PARTICIPANT_SEARCH.mount(search,content);}).catch(()=>{search.textContent='Search could not load. Select a participant below.';});
}


// Existing Follow presentation helpers; executable bodies retained unchanged.
function appendClubIdentityFallback(container, label, className = "team-logo-fallback"){
  const monogram = document.createElement("span");
  monogram.className = `${className} team-logo-monogram`;
  monogram.setAttribute("aria-label", `${label || "Team"} identity`);
  monogram.textContent = String(label || "Team").split(/\s+/).map(word => word[0]).join("").slice(0, 3).toUpperCase() || "TM";
  container.appendChild(monogram);
}

function backFromCodeInspector(){
  if (codeInspectorCodeFromLocation()) history.back();
  else closeCodeInspector();
}

function inspectorFixtureIsResult(fixture){
  return ["completed", "finished", "final"].includes(String(fixture.status || "").toLowerCase());
}

function renderCodeInspectorPlayers(panel, fixtures){
  const followed = followedStandingsParticipantIds();
  const players = new Map();
  fixtures.forEach(fixture => (fixture.participantSlots || []).forEach(slot => {
    const id = String(slot.participantId || slot.label || "");
    if (!id) return;
    const record = players.get(id) || { id, label:slot.label || followedParticipantLabel(id), appearances:0 };
    record.appearances += 1;
    players.set(id, record);
  }));
  const ordered = [...players.values()].sort((first, second) => (
    Number(followed.has(second.id)) - Number(followed.has(first.id))
    || second.appearances - first.appearances
    || first.label.localeCompare(second.label)
  ));
  const visible = codeInspectorPlayersExpanded
    ? ordered
    : ordered.filter((player, index) => index < 3 || followed.has(player.id));
  const list = document.createElement("div");
  list.className = "code-inspector-fixtures";
  list.dataset.scrollList = "inspector-players";
  visible.forEach(player => {
    const row = document.createElement("article");
    row.className = "code-inspector-fixture";
    row.dataset.scrollKey = `inspector-player:${player.id}`;
    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = player.label;
    const detail = document.createElement("p");
    detail.textContent = `${player.appearances} published appearance${player.appearances === 1 ? "" : "s"}${followed.has(player.id) ? " · Following" : ""}`;
    copy.append(title, detail);
    row.appendChild(copy);
    list.appendChild(row);
  });
  panel.appendChild(list);
  if (visible.length < ordered.length || codeInspectorPlayersExpanded){
    const expander = document.createElement("button");
    expander.type = "button";
    expander.className = "standings-table-expander";
    expander.setAttribute("aria-expanded", String(codeInspectorPlayersExpanded));
    expander.innerHTML = `<span>${codeInspectorPlayersExpanded ? "Top 3 + followed" : "Show all players & teams"}</span>${glyphMarkup("ui:chevron-right")}`;
    expander.addEventListener("click", () => {
      mutateWithScrollContinuity(list, () => {
        codeInspectorPlayersExpanded = !codeInspectorPlayersExpanded;
        renderCodeInspector();
      }, {
        restoreFocus:true,
        focusTarget:".code-inspector-panel > .standings-table-expander",
      });
    });
    panel.appendChild(expander);
  }
}

function codeInspectorFixtureSnapshot(fixture){
  if (!fixture?.id || !fixture.date || (!["golf","masters"].includes(codeInspectorFixtureSportKey(fixture)) && (!fixture.time || fixture.scheduleStatus === "provisional" || inspectorFixtureIsResult(fixture)))) return null;
  const participantSlots = Array.isArray(fixture.participantSlots) ? fixture.participantSlots : [];
  const canonicalFixture = canonicalFeedFixtureForInspector(fixture);
  const editorialNarrative = fixture.editorialNarrative || canonicalFixture?.editorialNarrative || null;
  const snapshot = {
    ...fixture,
    id:fixture.id,
    eventId:fixture.id,
    canonicalEventId:fixture.id,
    actionKey:fixture.id,
    cardKind:"fixture",
    manualPin:true,
    key:codeInspectorFixtureSportKey(fixture),
    sport:codeInspectorManifest?.codes?.find(code => code.id === fixture.codeId)?.label || codeInspectorFixtureSportKey(fixture),
    competitionId:fixture.competitionId || null,
    name:fixture.name || "Fixture unavailable",
    date:fixture.date,
    time:fixture.time,
    startTimeUtc:fixture.startTimeUtc || null,
    venue:fixture.venue || null,
    broadcaster:fixture.broadcaster || "",
    viewingOptions:Array.isArray(fixture.viewingOptions) ? fixture.viewingOptions.map(option => ({ ...option })) : [],
    sourceUrl:fixture.sourceUrl || null,
    stage:fixture.stage || null,
    roundLabel:fixture.roundLabel || null,
    competitionScope:fixture.competitionScope || null,
    isInternational:fixture.isInternational === true || fixture.competitionScope === "international",
    representativeCountryCodes:Array.isArray(fixture.representativeCountryCodes) ? fixture.representativeCountryCodes : [],
    participantIds:participantSlots.map(slot => slot.participantId).filter(Boolean),
    participantSlots:participantSlots.map(slot => ({ ...slot })),
    participants:participantSlots.map(slot => ({
      id:slot.participantId || null,
      name:slot.label || "TBD",
      displayName:slot.label || "TBD",
      logoUrl:slot.logoUrl || null,
      crestUrl:slot.logoUrl || null,
      homeAway:slot.homeAway || null,
    })),
    matchupSides:participantSlots.map(slot => ({
      id:slot.participantId || null,
      label:slot.label || "TBD",
      participants:[{ id:slot.participantId || null, name:slot.label || "TBD", logoUrl:slot.logoUrl || null }],
    })),
    status:fixture.status || "scheduled",
    stakesScore:Number(fixture.expected) >= 9 ? 5 : Number(fixture.expected) >= 7 ? 4 : 3,
    expected:Number(fixture.expected || 7),
    ...(editorialNarrative ? {
      editorialNarrative:{ ...editorialNarrative },
      storyline:fixture.storyline || canonicalFixture?.storyline || {
        stakes:Number(fixture.expected) >= 9 ? 5 : Number(fixture.expected) >= 7 ? 4 : 3,
        hookSpoilerOff:editorialNarrative.hook,
        hookSpoilerOn:editorialNarrative.hook,
        synopsisSpoilerOff:editorialNarrative.synopsis,
        synopsisSpoilerOn:editorialNarrative.synopsis,
        arcStage:"preview",
      },
    } : {}),
  };
  return ["golf","masters"].includes(snapshot.key) || eventDateTime(snapshot).getTime() > Date.now() ? snapshot : null;
}

function buildCodeInspectorFixture(fixture){
  const slots=fixture.participantSlots || [];
  let canonical=canonicalFeedFixtureForInspector(fixture);
  if(globalThis.inspectorSourcePreferred?.(fixture,canonical))canonical=null;
  const event=fixture.calendarNote&&canonical?.sourceTrust!=='verified'?{...canonical,...fixture}:canonical || {...fixture,id:fixture.id,eventId:fixture.id,key:codeInspectorFixtureSportKey(fixture),
    participantIds:slots.map(slot=>slot.participantId).filter(Boolean),
    participants:slots.map(slot=>({id:slot.participantId,name:slot.label,displayName:slot.label,logoUrl:slot.logoUrl})),
    status:inspectorFixtureIsResult(fixture)?'finished':fixture.status || 'scheduled',
    stakesScore:fixture.stakesScore || (fixture.expected>=9?5:fixture.expected>=7?4:3)};
  const fields=globalThis.inspectorPresentationFields?.(fixture,event);
  return buildEventCard(fields?{...event,...fields}:event,{mode:'schedule',inspectorFixture:fixture});
}

function appendSchedulePin(container,fixture,card){
  const snapshot=codeInspectorFixtureSnapshot(fixture);
  if(!snapshot)return;
  const added=Boolean(getEventAction(snapshot).addedToFixtures);
  const canonical=canonicalFeedFixtureForInspector(fixture) || {...snapshot,manualPin:false};
  const automatic=Boolean(automaticEventFollowReason(canonical)) && !getEventAction(canonical).dismissed && !getEventAction(canonical).archived;
  const pin=document.createElement('button');pin.type='button';pin.className='event-quick-action code-inspector-feed-action';
  pin.setAttribute('aria-pressed',String(added || automatic));pin.textContent=automatic?'In Feed':added?'Remove from Feed':'Add to Feed';pin.disabled=automatic;
  pin.onclick=event=>{event.stopPropagation();if(!setCodeInspectorFixtureAdded(fixture,!added))return;
    if(!added)recordCodeAffinity(fixture.codeId,'pin');
    mutateWithScrollContinuity(pin.closest('.event-card') || card,renderCodeInspector,{anchorStrategy:'target'});
  };
  container.appendChild(pin);
}

function codeInspectorStandingsSportKey(code){
  return ({ "rugby-union": "rugby", "american-football": "nfl" })[code.slug] || code.slug;
}

function renderCodeInspectorPanel(container){
  if(globalThis.renderFollowSchedulePanel)return globalThis.renderFollowSchedulePanel(container);
  container.textContent='Loading schedule…';
  void loadDeferredScript('assets/js/follow-schedule-panel.js?v=576').then(()=>{if(container.isConnected){container.textContent='';globalThis.renderFollowSchedulePanel(container);}}).catch(()=>{if(container.isConnected)container.textContent='Couldn’t load the schedule. Try again.';});
}

function followStandingsLabel(code){
  return ['afl','aflw','nrl','rugby-union','netball'].includes(code?.slug) ? 'Ladder' : 'Standings';
}

function rootSportKeys(entity){return new Set([entity.id.replace(/^sport:/,''),...(entity.canonicalSportKeys||[]),...(entity.childIds||[]).flatMap(id=>selectorEntityById(id)?.canonicalSportKeys||[])]);}

function rootSportIsFollowed(entity){
  const selected=new Set(userPreferences.selectedSelectorEntityIds||[]),keys=rootSportKeys(entity),graph=userPreferences.preferenceGraph||{};
  if(selected.has(entity.id)||(entity.childIds||[]).some(id=>selected.has(id)))return true;
  if((userPreferences.followedSports||[]).some(key=>keys.has(key)))return true;
  if((graph.domainPreferences||[]).some(item=>item.enabled!==false&&(item.sportDomainId===entity.domainId||item.sportDomainId===entity.id)))return true;
  const selectorIds=[entity.id,...(entity.childIds||[])].map(selectorEntityById).filter(Boolean).map(item=>item.taxonomyNodeId);
  if((graph.competitionPreferences||[]).some(item=>item.enabled===true&&selectorIds.includes(item.competitionId)))return true;
  if((graph.entityFollows||[]).some(item=>['follow','priority'].includes(item.followLevel)&&[...keys].some(key=>String(item.participantId).includes(`:${key}:`))))return true;
  if((userPreferences.followFirst?.collectionFollows||[]).some(id=>[...keys].some(key=>String(id).includes(`:${key}:`))))return true;
  const families=new Set(userPreferences.followFirst?.followedMajorEventIds||[]);
  return (FOLLOW_FIRST?.MAJOR_EVENT_FAMILIES||[]).some(family=>families.has(family.id)&&family.sportIds.some(key=>keys.has(key)));
}

function rankedFollowGridSports(sports){
  const affinity=new Map((followRatingAffinity.sports||[]).map(item=>[item.sportId,item]));
  const score=entity=>affinity.get(entity.id)||[...(entity.childIds||[])].map(id=>affinity.get(id)).find(Boolean)||{count:0,lastInteractedAt:''};
  return sports.filter(rootSportIsFollowed).sort((a,b)=>Number(score(b).count)-Number(score(a).count)||String(score(b).lastInteractedAt||'').localeCompare(String(score(a).lastInteractedAt||''))||Number(a.editorialOrder||999)-Number(b.editorialOrder||999)).slice(0,7);
}

function followHasStandings(code){
  if (!code) return false;
  return code.hasStandings===true || followStandingsAvailability.get(code.id)===true || Boolean(codeInspectorChunk?.code?.id===code.id && codeInspectorChunk.standings?.length)
    || (CANONICAL_TAXONOMY.competitions || []).some(competition=>competition.supportsLadder && standingsSportKey(competition)===codeInspectorStandingsSportKey(code));
}


// Optional standings presentation; bodies moved unchanged from the shell.
function standingsPinTimestamp(competitionId, preferences = userPreferences){
  return preferences?.standings?.pinTimestamps?.[competitionId] || null;
}

function toggleStandingsPin(competitionId){
  const pins = { ...(userPreferences.standings?.pinTimestamps || {}) };
  if (pins[competitionId]) delete pins[competitionId];
  else pins[competitionId] = new Date().toISOString();
  savePreferences({
    ...userPreferences,
    standings: { ...(userPreferences.standings || {}), pinTimestamps: pins },
  });
  renderAll({ preserveViewport: true });
}

function standingsFrothRank(competition){
  const preference = userPreferences.preferenceGraph?.domainPreferences?.find(item => (
    item.sportDomainId === (competition.preferenceDomainId || competition.sportDomainId)
  ));
  return { "template:froth": 3, "template:like": 2, "template:casual": 1, "template:custom": 1 }[preference?.templateId] || 0;
}

function orderStandingsCompetitions(competitions){
  return competitions.slice().sort((first, second) => {
    const firstPin = standingsPinTimestamp(first.id);
    const secondPin = standingsPinTimestamp(second.id);
    if (Boolean(firstPin) !== Boolean(secondPin)) return firstPin ? -1 : 1;
    const frothGap = standingsFrothRank(second) - standingsFrothRank(first);
    if (frothGap) return frothGap;
    if (firstPin && secondPin){
      const pinGap = Date.parse(secondPin) - Date.parse(firstPin);
      if (pinGap) return pinGap;
    }
    return String(first.name).localeCompare(String(second.name));
  });
}

function activeStandingsCompetitions(){
  const selected = new Set(selectedStandingsSportKeys());
  return orderStandingsCompetitions(rankingCompetitionsForStandings()
    .filter(competition => selected.has(standingsSportKey(competition))));
}

function buildStandingsFilter(){
  const available = standingsFilterSportKeys();
  const selected = new Set(selectedStandingsSportKeys());
  const panel = document.createElement("section");
  panel.className = "standings-filter-panel";
  panel.setAttribute("aria-label", "Standings filter");
  const head = document.createElement("div");
  head.className = "standings-filter-head";
  const title = document.createElement("h2");
  title.textContent = "Filter standings";
  const actions = document.createElement("div");
  const selectAll = document.createElement("button");
  selectAll.type = "button";
  selectAll.className = "btn ghost";
  selectAll.textContent = "Select all";
  selectAll.addEventListener("click", () => setAllStandingsSportKeys(true));
  const deselectAll = document.createElement("button");
  deselectAll.type = "button";
  deselectAll.className = "btn ghost";
  deselectAll.textContent = "Deselect all";
  deselectAll.addEventListener("click", () => setAllStandingsSportKeys(false));
  actions.append(selectAll, deselectAll);
  head.append(title, actions);
  const choices = document.createElement("div");
  choices.className = "standings-filter-choices";
  available.forEach(key => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `standings-filter-choice${selected.has(key) ? " active" : ""}`;
    button.setAttribute("role", "checkbox");
    button.setAttribute("aria-checked", String(selected.has(key)));
    button.textContent = SPORT_META[key]?.label || key.toUpperCase();
    button.addEventListener("click", () => toggleStandingsSportKey(key));
    choices.appendChild(button);
  });
  panel.append(head, choices);
  return panel;
}

function buildStandingsInnerTabs(){
  const activeView = readStandingsDirectorySession().activeView;
  const tabs = document.createElement("div");
  tabs.className = "standings-inner-tabs";
  tabs.setAttribute("role", "tablist");
  [["tables", "Tables"], ["directory", "Follow Teams & Players"]].forEach(([view, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `standings-inner-tab${activeView === view ? " active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(activeView === view));
    button.textContent = label;
    button.addEventListener("click", () => {
      updateStandingsDirectorySession({ activeView: view });
      renderStandingsContext();
    });
    tabs.appendChild(button);
  });
  return tabs;
}

function renderStandingsContextLoaded(options = {}){
  const embedded = Boolean(options.container);
  const container = options.container || document.getElementById("standingsContext");
  if (!container) return;
  container.innerHTML = "";
  const scrollScope = container.id || options.sectionLabel || "standings";
  container.dataset.scrollList = `standings:${scrollScope}`;
  if (!embedded && activeTab === "follow"){
    renderFollowView();
    return;
  }
  if (!embedded && activeTab !== "standings") return;
  if(!globalThis.chooseStandingsCategory){
    container.textContent="Loading rankings…";loadDeferredScript("config/surface-category-ui.js?v=403").then(()=>renderStandingsContext(options)).catch(()=>{container.textContent="Rankings could not load.";});return;
  }
  const competitions = chooseStandingsCategory(options.competitions || activeStandingsCompetitions(),container,options);
  const sectionLabel = options.sectionLabel || "Standings";
  if (!embedded){
    container.appendChild(buildStandingsInnerTabs());
    if (readStandingsDirectorySession().activeView === "directory"){
      renderTeamsAndPlayersDirectory(container);
      return;
    }
    container.appendChild(buildStandingsFilter());
  }
  if (!competitions.length){
    const empty = document.createElement("div");
    empty.className = "standings-empty";
    empty.textContent = "No supported sports are selected in the filters above.";
    container.appendChild(empty);
    return;
  }

  if (!userPreferences.showSpoilers && !standingsRevealApproved){
    const module = document.createElement("section");
    module.className = "standings-module standings-withheld";
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = sectionLabel;
    const detail = document.createElement("p");
    detail.textContent = "Hidden while Results is off because standings can reveal recent outcomes.";
    copy.append(title, detail);
    const reveal = document.createElement("button");
    reveal.className = "btn ghost";
    reveal.type = "button";
    reveal.textContent = "Reveal standings";
    reveal.addEventListener("click", () => confirmStandingsReveal(renderAll));
    module.append(copy, reveal);
    container.appendChild(module);
    return;
  }

  if (!canonicalSportsData){
    const module = document.createElement("section");
    module.className = "standings-module";
    const title = document.createElement("h2");
    title.textContent = sectionLabel;
    const status = document.createElement("p");
    status.textContent = canonicalSportsDataError
      ? `${sectionLabel} data is unavailable, so this area has been withheld.`
      : "Loading current standings…";
    module.append(title, status);
    if (canonicalSportsDataError){
      const retry = document.createElement("button");
      retry.className = "btn ghost";
      retry.type = "button";
      retry.textContent = "Try again";
      retry.addEventListener("click", () => {
        canonicalSportsDataError = null;
        loadCanonicalSportsData();
        renderStandingsContext(options);
      });
      module.appendChild(retry);
    } else {
      loadCanonicalSportsData();
    }
    container.appendChild(module);
    return;
  }

  const competitionsBySport = new Map();
  competitions.forEach(competition => {
    const sportKey = standingsSportKey(competition);
    const sportCompetitions = competitionsBySport.get(sportKey) || [];
    sportCompetitions.push(competition);
    competitionsBySport.set(sportKey, sportCompetitions);
  });

  competitionsBySport.forEach((sportCompetitions, sportKey) => {
    const sportSection = document.createElement("section");
    sportSection.className = "standings-sport-section";
    sportSection.dataset.sportSection = sportKey;
    const heading = document.createElement("div");
    heading.className = "standings-sport-heading";
    heading.innerHTML = `${glyphMarkup(SPORT_META[sportKey]?.glyph || "ui:filter")}<span>${SPORT_META[sportKey]?.label || sportKey.toUpperCase()}</span>`;
    sportSection.appendChild(heading);
    const sportContent = document.createElement("div");
    sportContent.className = "standings-sport-content";
    sportContent.id = `ranking-standings-${sportKey}`;
    sportContent.dataset.scrollList = `standings:${scrollScope}:${sportKey}`;

    sportCompetitions.forEach(competition => {
      const module = document.createElement("section");
      module.className = "standings-module";
      const moduleScrollKey = `standings:${scrollScope}:${competition.id}`;
      module.dataset.scrollKey = moduleScrollKey;
      const head = document.createElement("div");
      head.className = "standings-head";
      const copy = document.createElement("div");
      const title = document.createElement("h2");
      title.textContent = competition.name;
      const snapshot = latestStandingsSnapshot(competition.id);
      const detail = document.createElement("p");
      detail.textContent = snapshot?.snapshotTimeUtc
        ? `Updated ${new Date(snapshot.snapshotTimeUtc).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}${snapshot.roundLabel ? ` · ${snapshot.roundLabel}` : ""}`
        : "No current standings snapshot is available.";
      copy.append(title, detail);
      const pin = document.createElement("button");
      const pinned = Boolean(standingsPinTimestamp(competition.id));
      pin.type = "button";
      pin.className = `standings-pin${pinned ? " active" : ""}`;
      pin.setAttribute("aria-pressed", String(pinned));
      pin.textContent = pinned ? "Pinned" : "Pin";
      pin.addEventListener("click", () => toggleStandingsPin(competition.id));
      head.append(copy, pin);
      module.appendChild(head);
      if (!snapshot?.entries?.length){
        const withheld = document.createElement("p");
        withheld.textContent = "No valid data is available, so this standings module has been withheld.";
        module.appendChild(withheld);
      } else {
        const expanded = standingsCompetitionExpansion[competition.id] === true;
        const summaryEntries = standingsEntriesForVisibility(snapshot, "summary");
        appendStandingsTable(module, competition, snapshot, expanded ? "full" : "summary");
        const freshness = document.createElement("p");
        freshness.className = "standings-freshness-note";
        freshness.textContent = snapshot.metadata?.roundStatus === "in-progress"
          ? "This round is ongoing, so positions may change after the next completed match. Standings refresh periodically and may briefly differ from official sources due to update delays."
          : "Standings refresh periodically and may briefly differ from official sources due to update delays.";
        module.appendChild(freshness);
        if (summaryEntries.length < snapshot.entries.length){
          const expander = document.createElement("button");
          expander.type = "button";
          expander.className = "standings-table-expander";
          expander.dataset.standingsExpander = competition.id;
          expander.setAttribute("aria-expanded", expanded ? "true" : "false");
          expander.setAttribute(
            "aria-label",
            expanded
              ? `Collapse ${competition.name} to Top 3 plus followed`
              : `Expand ${competition.name} to the full standings`
          );
          expander.innerHTML = `<span>${expanded ? "Full standings" : "Top 3 + followed"}</span>${glyphMarkup("ui:chevron-right")}`;
          expander.addEventListener("click", () => {
            const liveModule = Array.from(document.querySelectorAll("[data-scroll-key]"))
              .find(element => element.dataset.scrollKey === moduleScrollKey) || module;
            mutateWithScrollContinuity(liveModule, () => {
              standingsCompetitionExpansion[competition.id] = standingsCompetitionExpansion[competition.id] !== true;
              renderStandingsContext(options);
            }, {
              restoreFocus:true,
              focusTarget:`[data-scroll-key="${CSS.escape(moduleScrollKey)}"] [data-standings-expander="${CSS.escape(competition.id)}"]`,
            });
          });
          module.appendChild(expander);
        }
      }
      sportContent.appendChild(module);
    });
    sportSection.appendChild(sportContent);
    container.appendChild(sportSection);
  });
}
