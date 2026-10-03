function directoryIndividualLabel(key){return /^(f1|wrc|motorsport|supercars)$/.test(key)?'Drivers':key==='motogp'?'Riders':key==='golf'?'Golfers':/^(tennis|football|afl|nrl|rugby|nbl|nba)/.test(key)?'Players':'Athletes';}
function directorySectionLabel(key){return key.startsWith('cricket')?'Teams':directoryIndividualLabel(key)+' & Teams';}
function appendDirectoryEntityTabs(host,key,filters){const tabs=document.createElement('nav');tabs.className='follow-directory-tabs';tabs.setAttribute('aria-label',directorySectionLabel(key));for(const [type,label]of [['athlete',directoryIndividualLabel(key)],['team','Teams']]){const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.setAttribute('aria-pressed',String(filters.entityType===type));b.onclick=()=>{updateDirectoryFilters(key,{entityType:type});renderStandingsContext();};tabs.append(b);}host.append(tabs);}
"use strict";
// Optional Follow presentation. Admission, preferences and mutations stay in the shell.
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
  const leagueOptions = [["", "All leagues"], ...directory.leagues.map(league => [league.id, league.displayName])];
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
  const crest = document.createElement("img");
  crest.className = "football-club-crest";
  crest.dataset.scrollStable = `directory-crest:${sportKey}:${team.id}`;
  const mark = CARD_IDENTITIES?.participantMarks?.[team.id];
  if (mark) applyTeamLogoAsset(crest, mark, "icon");
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
  detail.textContent = `${league?.displayName || SPORT_META[sportKey]?.label || "Sport"} · ${players.length} ${playerScope}${players.length === 1 ? "" : "s"}`;
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
      empty.textContent = "No priority players match the current filters.";
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
  const filters = directoryFilters(sportKey);
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
    if(!filtered.players.length){const empty=document.createElement('p');empty.textContent='No players match these filters.';directory.append(empty);}
    if(filtered.players.length>limit){const more=document.createElement('button');more.className='btn ghost';more.textContent='Show more players';more.onclick=()=>{followDirectoryBatchLimits.set(batchKey,limit+40);renderStandingsContext();};directory.append(more);}container.append(directory);return;
  }
  const summary = document.createElement("p");
  summary.className = "football-directory-summary";
  const directoryNote = ["nrl", "afl", "aflw"].includes(sportKey)
    ? " Current official squad list at the directory refresh time."
    : directoryData.players.some(player => player.birthCountryCode)
      ? " Flags use evidenced birthplace where published; provider country is labelled as country, not birthplace."
      : " Players are a source-backed priority shortlist, not a weekly team list.";
  summary.textContent = `${filtered.teams.length} club${filtered.teams.length === 1 ? "" : "s"} · ${filtered.players.length} matching player${filtered.players.length === 1 ? "" : "s"}.${directoryNote}`;
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
  if ((chunk.records || []).some(record => record.entityType === "athlete")) void ensureAthleteProfileUi().catch(() => {});
  const filters = directoryFilters(sportKey);
  const curatedIds = (chunk.browseGroups || []).flatMap(group=>group.memberIds);
  const curatedOrder = new Map(curatedIds.map((id,index)=>[id,index]));
  const allRecords = chunk.records.map(record => ({
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
    .filter(record => !curatedIds.length || filters.query || filters.genderCategory === "female" || curatedOrder.has(record.id))
    .filter(record => !separatedEntityDirectory || record.entityType === filters.entityType)
    .filter(record => !filters.collectionId || selectedCollectionMemberIds.has(record.id))
    .filter(record => !filters.birthCountryCode || record.countryCode === filters.birthCountryCode)
    .filter(record => !filters.genderCategory || record.genderCategory === filters.genderCategory || ['unknown','mixed'].includes(record.genderCategory))
    .filter(record => Number.isFinite(footballDirectoryApi.searchMatchScore(record, filters.query)))
    .sort((first, second) => {
      if(curatedIds.length && !filters.query && !filters.genderCategory)return (curatedOrder.get(first.id) ?? 999)-(curatedOrder.get(second.id) ?? 999);
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
  if(!curatedIds.length)records.splice(0,records.length,...footballDirectoryApi.followOrder(records,userPreferences,followCollectionsById()));
  const directory = document.createElement("section");
  directory.className = "football-directory";
  if (separatedEntityDirectory){
    const tabs = document.createElement("div");
    tabs.className = "follow-directory-tabs";
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", `${SPORT_META[sportKey]?.label || "Motorsport"} directory`);
    const entityTabs = [["athlete", directoryIndividualLabel(sportKey)], ["team", "Teams"]];
    entityTabs.forEach(([entityType, label]) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "btn ghost";
      tab.textContent = label;
      tab.setAttribute("aria-pressed", String(filters.entityType === entityType));
      tab.addEventListener("click", () => { updateDirectoryFilters(sportKey, { entityType }); renderStandingsContext(); });
      tabs.appendChild(tab);
    });
    directory.appendChild(tabs);
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
  if (sportKey === "tennis" && collectionsById.size){
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
    const rankLabel = record.rank !== null ? ` · Rank ${record.rank}` : sportKey === "tennis" && record.watchPoolMember ? " · Watch list · Unranked" : "";
    const competitionNumber = Number(record.competitionNumber || 0);
    const numberLabel = athlete && !isWrcRecord && record.competitionNumberKind ? ` · ${competitionNumber > 0 ? `No. ${competitionNumber}` : "No. TBC"}` : "";
    const wrcRole = ({ driver:"Driver", "co-driver":"Co-driver", manufacturer:"Manufacturer" })[record.position];
    detail.textContent = `${isWrcRecord ? wrcRole || (athlete ? "Competitor" : "Manufacturer") : motorsportDirectory ? (athlete ? "Driver" : "Constructor") : record.sectionLabel || FOLLOW_FIRST?.directoryEntityLabel?.(record) || "Selection"}${numberLabel}${rankLabel}`;
    copy.append(name, detail);
    if (Array.isArray(record.collectionIds) && record.collectionIds.length){
      const chips = document.createElement("span");
      chips.className = "follow-collection-chips";
      record.collectionIds.forEach(collectionId => {
        const collection = followCollectionsById()[collectionId];
        if (!collection) return;
        const chip = document.createElement("span");
        chip.textContent = collection.label;
        chips.appendChild(chip);
      });
      if (chips.childElementCount) copy.appendChild(chips);
    }
    const follow = record.profileOnly ? document.createElement("span") : buildDirectoryFollowButton(record.id, { sportKey, label: record.displayName });
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
    .filter(entity => Number(entity.level) === 2)
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
  if (session.directorySportKey === "football") renderFootballDirectory(container);
  else if (session.directorySportKey === "nrl") renderFootballDirectory(container, {
    sportKey: "nrl",
    directoryData:leagueDirectoryState.nrl.data,
    loading:leagueDirectoryState.nrl.loading,
    error:leagueDirectoryState.nrl.error,
    loadDirectory: loadNrlDirectoryData,
  });
  else if (session.directorySportKey === "afl") renderFootballDirectory(container, {
    sportKey: "afl",
    directoryData:leagueDirectoryState.afl.data,
    loading:leagueDirectoryState.afl.loading,
    error:leagueDirectoryState.afl.error,
    loadDirectory: loadAflDirectoryData,
  });
  else if (session.directorySportKey === "aflw") renderFootballDirectory(container, {
    sportKey:"aflw",
    directoryData:leagueDirectoryState.aflw.data,
    loading:leagueDirectoryState.aflw.loading,
    error:leagueDirectoryState.aflw.error,
    loadDirectory:loadAflwDirectoryData,
  });
  else renderLegacyParticipantDirectory(container, session.directorySportKey);
}

function renderTennisFollowCollections(container){
  const chunk = followDirectoryChunks.get("tennis");
  const panel = document.createElement("div");
  panel.className = "tennis-follow-collections";
  panel.setAttribute("aria-label", "Tennis follow collections");
  if (!chunk){
    panel.textContent = followDirectoryChunkErrors.has("tennis") ? "Tennis groups are temporarily unavailable. Tap to retry." : "Loading Tennis groups…";
    panel.addEventListener("click", () => {
      followDirectoryChunkErrors.delete("tennis");
      void loadFollowDirectoryChunk("tennis").then(() => queueScrollIdleMutation(renderFollowView)).catch(() => queueScrollIdleMutation(renderFollowView));
    }, { once:true });
    if (!followDirectoryChunkErrors.has("tennis") && !followDirectoryChunkLoading.has("tennis")) void loadFollowDirectoryChunk("tennis").then(() => {
      if (activeTab === "follow" && followDirectoryKey() === "tennis") queueScrollIdleMutation(renderFollowView);
    }).catch(() => {
      if (activeTab === "follow" && followDirectoryKey() === "tennis") queueScrollIdleMutation(renderFollowView);
    });
    container.appendChild(panel);
    return panel;
  }
  (chunk.collections || []).slice().sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0)).forEach(collection => {
    const selected = userPreferences.followFirst.collectionFollows.includes(collection.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tennis-collection-toggle${selected ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(selected));
    const copy = document.createElement("span");
    const label = document.createElement("strong");
    label.textContent = collection.label;
    const detail = document.createElement("small");
    detail.textContent = `${collection.memberIds.length} players · inherited follow with individual opt-out`;
    const state = document.createElement("b");
    state.textContent = selected ? "On" : "Off";
    copy.append(label, detail);
    button.append(copy, state);
    button.addEventListener("click", event => {
      event.stopPropagation();
      const enabled = button.getAttribute("aria-pressed") !== "true";
      savePreferences(FOLLOW_FIRST.setCollectionFollow(userPreferences, collection.id, enabled));
      button.setAttribute("aria-pressed", String(enabled));
      button.classList.toggle("active", enabled);
      button.querySelector("b").textContent = enabled ? "On" : "Off";
      renderTabCounts();
      showToast(`${collection.label}: ${enabled ? "followed" : "not followed"}.`);
    });
    panel.appendChild(button);
  });
  container.appendChild(panel);
  return panel;
}

function renderFollowViewLoaded(){
  if(!globalThis.NOTHINGSPORTS_FOLLOW_NAV){
    const panel=document.getElementById('listView');panel.textContent='Loading Follow…';
    void loadDeferredScript('assets/js/follow-navigation.js?v=399').then(()=>{if(activeTab==='follow')renderFollowView();}).catch(()=>{if(activeTab==='follow'){panel.textContent='Follow could not load. ';const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=renderFollowView;panel.append(retry);}});return;
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
  const state=followBrowseState();
  const sports=orderSelectorEntities(BASE_SPORT_SELECTOR_ENTITIES.filter(entity=>Number(entity.level)===2));
  const primarySports=rankedFollowGridSports(sports);
  const primaryIds=primarySports.map(entity=>entity.id);
  const gridFingerprint=primaryIds.join('|');
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
    button.addEventListener('click',()=>{host.closest('dialog')?.close();saveFollowBrowse({sportId:entity.id,categoryId:'',section:'schedule',scheduleScope:null});activeInspectorCodeId=null;renderFollowView();});host.appendChild(button);
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
  const children=(root.childIds || []).map(selectorEntityById).filter(Boolean);
  if (children.length){
    const choices=document.createElement('nav');choices.className='follow-category-bar';choices.setAttribute('aria-label',`${root.label} categories`);
    const items=root.id==='sport:afl'?children:[{...root,label:`All ${root.label}`},...children];
    items.forEach(entity=>{
      const button=document.createElement('button');button.type='button';button.className=`btn ghost${state.categoryId===entity.id?' active':''}`;button.textContent=entity.label;
      button.onclick=()=>{saveFollowBrowse({categoryId:entity.id,section:'schedule',scheduleScope:null});activeInspectorCodeId=null;renderFollowView();};choices.appendChild(button);
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
  if(followed && FOLLOW_FEED_POLICY.australiansFilterUseful({key:followDirectoryKey(entity)})){
    const label=document.createElement('label');label.className='follow-checkbox';
    const au=document.createElement('input');au.type='checkbox';au.checked=(userPreferences.followFirst.australiansOnlySportIds || []).includes(entity.id);au.setAttribute('aria-label','Follow Australians');
    au.onchange=()=>{const next=clonePreferences(userPreferences);const ids=new Set(next.followFirst.australiansOnlySportIds || []);au.checked?ids.add(entity.id):ids.delete(entity.id);next.followFirst.australiansOnlySportIds=[...ids];savePreferences(next);renderAll({preserveViewport:true});};
    label.append(au,document.createTextNode('Follow Australians'));commonControls.appendChild(label);
  }
  container.appendChild(commonControls);
  const tabs=document.createElement('nav');tabs.className='follow-section-tabs';tabs.setAttribute('aria-label',`${entity.label} sections`);
  [['schedule','Schedule'],...(code?.slug === "wrc" ? [["results", "Results / Replays"]] : []),...(followHasStandings(code)?[['standings',followStandingsLabel(code)]]:[]),['teams-players',directorySectionLabel(followDirectoryKey(entity))],['major-events','Major Events']].forEach(([section,label])=>{
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
    if(followDirectoryKey(entity)==='tennis'){renderTennisMajorEvents(container);return;}
    const grid=document.createElement('div');grid.className='setup-choice-grid';
    const keys=new Set([followDirectoryKey(entity),...(entity.canonicalSportKeys || [])]);
    FOLLOW_FIRST.MAJOR_EVENT_FAMILIES.filter(record=>record.sportIds.some(id=>keys.has(id))).forEach(record=>{
      const card=document.createElement('div');card.className='choice-card follow-event-family';card.dataset.eventFamilyId=record.id;card.dataset.scrollKey=`follow-event-family:${record.id}`;
      const followed=userPreferences.followFirst.followedMajorEventIds.includes(record.id);
      const toggle=document.createElement('button');toggle.type='button';toggle.className='follow-event-family-toggle';toggle.dataset.eventFamilyLabel=record.label;toggle.textContent=`${followed?'Unfollow':'Follow'} ${record.label}`;toggle.setAttribute('aria-pressed',String(followed));toggle.onclick=()=>toggleMajorEventFollow(record.id);
      const edition=MAJOR_EVENTS?.activeEditionForFamily?.(majorEventsDocument,record.id,nowAEST());
      if(record.majorSlug){const identity=document.createElement('span');identity.className='follow-sport-mark identity-frame';identity.style.cssText='display:block;width:64px;height:44px;margin:0 auto 8px';renderEventIdentityMark(identity,{key:'golf',golfMajorCalendar:true,majorSlug:record.majorSlug},{...sportMetaForEvent({key:'golf'}),glyph:'sport:golf',label:record.label});card.append(identity);}
      card.appendChild(toggle);
      if(edition){const open=document.createElement('button');open.type='button';open.className='btn ghost';open.textContent='Open in Events';open.onclick=()=>openMajorEventInEvents(edition.id);card.appendChild(open);}
      grid.appendChild(card);
    });
    if(!grid.childElementCount){const empty=document.createElement('p');empty.textContent='No major events published for this category.';grid.appendChild(empty);}
    container.appendChild(grid);
    installFollowEventBulk(container);
    if(!majorEventsDocument && !majorEventsLoading) void loadMajorEventsData().then(()=>{if(activeTab==='follow')queueScrollIdleMutation(renderFollowView);});
    return;
  }
  const panel=document.createElement('section');panel.className='follow-section-panel';panel.dataset.scrollKey=`follow-directory:${entity.id}`;
  const key=followDirectoryKey(entity);updateStandingsDirectorySession({directorySportKey:key});
  if(key==='tennis')renderTennisFollowCollections(panel);
  renderTeamsAndPlayersDirectory(panel);panel.querySelector('.football-directory-sport-choice')?.remove();
  container.appendChild(panel);
}
