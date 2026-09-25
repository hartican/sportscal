// Legacy sport hubs load only when opened. Shared Follow schedules use follow-schedule-panel.js.
function sportHubRoundLabel(round){
  return round?.roundLabel || (Number.isInteger(round?.roundNumber) ? `Round ${round.roundNumber}` : "Round");
}

function sportHubDateTimeLabel(view){
  if (view?.event?.dateOnly && view.event.date){
    const range = view.event.endDate && view.event.endDate !== view.event.date
      ? `${dayDateLabel(view.event.date)} – ${dayDateLabel(view.event.endDate)}`
      : dayDateLabel(view.event.date);
    return `${range} · Multiple live stages`;
  }
  if (!view?.event?.date || !view?.event?.time) return "Date and time TBC";
  return `${dayDateLabel(view.event.date)} · ${fmtTime12(view.event.time)}`;
}

function sportHubVenueLabel(view){
  return view?.event?.venue || "Venue TBC";
}

function sportHubProviderCopy(providers, emptyCopy){
  return providers?.length ? providers.join(" · ") : emptyCopy;
}

function buildSportHubFixtureRow(view, {
  worthWatching = false,
  hiddenByUser = false,
  resultsMode = false,
} = {}){
  const event = view.event;
  const row = document.createElement("article");
  row.className = `sport-hub-fixture${view.isFinished ? " is-completed" : ""}${hiddenByUser ? " is-hidden-by-user" : ""}`;
  row.dataset.canonicalEventId = event.canonicalEventId;

  const timing = document.createElement("div");
  timing.className = "sport-hub-fixture-time";
  timing.textContent = sportHubDateTimeLabel(view);

  const main = document.createElement("div");
  main.className = "sport-hub-fixture-main";
  const titleLine = document.createElement("div");
  titleLine.className = "sport-hub-fixture-title-line";
  const title = document.createElement("h3");
  title.textContent = spoilerSafeDisplayTitle(event);
  titleLine.appendChild(title);
  if (worthWatching){
    const badge = document.createElement("span");
    badge.className = "sport-hub-worth-badge";
    badge.textContent = "Worth watching";
    titleLine.appendChild(badge);
  }
  if (hiddenByUser){
    const badge = document.createElement("span");
    badge.className = "sport-hub-hidden-badge";
    badge.textContent = "Hidden by you";
    titleLine.appendChild(badge);
  }
  const details = document.createElement("p");
  details.className = "sport-hub-fixture-detail";
  details.textContent = resultsMode
    ? event.key === "wrc"
      ? `${sportHubVenueLabel(view)} · ${event.resultStatus === "pending" ? "Official result pending" : "Official result"} · Replays: ${sportHubProviderCopy(view.replayProviders, "TBC")}`
      : `${sportHubVenueLabel(view)} · Result record · video availability is not promised`
    : `${sportHubVenueLabel(view)} · ${sportHubProviderCopy(view.liveProviders, "Broadcaster TBC")}`;
  main.append(titleLine, details);

  const status = document.createElement("div");
  status.className = "sport-hub-fixture-status";
  if (view.isFinished){
    if (userPreferences.showSpoilers && event.canonicalResultScoreline){
      status.textContent = event.canonicalResultScoreline;
      status.classList.add("has-result");
    } else if (event.resultStatus === "pending") {
      status.textContent = "Completed · Official result pending";
    } else {
      status.textContent = "Completed · Result hidden";
    }
  } else if (event.scheduleStatus === "tbc"){
    status.textContent = "Time TBC";
  } else {
    status.textContent = "Scheduled";
  }

  row.append(timing, main, status);
  return row;
}

function buildSportHubRoundNavigation(fixtures, selectedRoundNumber, {
  size = 2,
  onChange,
  label = "Browse season rounds",
} = {}){
  const rounds = SPORT_HUBS.supportedRounds(fixtures);
  const selected = SPORT_HUBS.normalizeSelectedRound(fixtures, selectedRoundNumber);
  const selectedIndex = rounds.findIndex(round => round.roundNumber === selected);
  const nav = document.createElement("div");
  nav.className = "sport-hub-round-nav";
  nav.setAttribute("aria-label", label);

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "sport-hub-round-step";
  previous.textContent = "Previous";
  previous.disabled = selectedIndex <= 0;
  previous.addEventListener("click", () => onChange(SPORT_HUBS.moveRoundNumber(fixtures, selected, -1)));

  const field=document.createElement('button');field.type='button';field.className='btn ghost';field.textContent='Jump to current';field.onclick=()=>onChange(SPORT_HUBS.currentRoundNumber(fixtures));
  const windowCopy = document.createElement("span");
  windowCopy.className = "sport-hub-round-window-copy";
  const visibleRounds = SPORT_HUBS.roundWindow(fixtures, selected, size);
  windowCopy.textContent = size > 1 && visibleRounds.length > 1
    ? `${sportHubRoundLabel(visibleRounds[0])} + ${sportHubRoundLabel(visibleRounds[1])}`
    : sportHubRoundLabel(visibleRounds[0]);

  const next=document.createElement('button');next.type='button';next.className='sport-hub-round-step';next.textContent='Next';next.disabled=selectedIndex>=rounds.length-1;next.onclick=()=>onChange(SPORT_HUBS.moveRoundNumber(fixtures,selected,1));
  nav.append(previous, field, next, windowCopy);
  return nav;
}

function appendSportHubHiddenSummary(container, partition){
  const summary = document.createElement("div");
  summary.className = "sport-hub-hidden-summary";
  const copy = document.createElement("span");
  const visibleCount = partition.visible.length - (sportHubState.showHidden ? partition.hiddenCount : 0);
  copy.textContent = `${visibleCount} visible fixture${visibleCount === 1 ? "" : "s"} · ${partition.hiddenCount} hidden by you`;
  summary.appendChild(copy);
  if (partition.hiddenCount){
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn ghost";
    toggle.setAttribute("aria-pressed", String(sportHubState.showHidden));
    toggle.textContent = sportHubState.showHidden ? "Hide muted" : "Show hidden";
    toggle.addEventListener("click", () => {
      sportHubState.showHidden = !sportHubState.showHidden;
      renderCurrentSection();
    });
    summary.appendChild(toggle);
  }
  container.appendChild(summary);
}

function appendSportHubRoundGroups(container, views, {
  curatedCanonicalIds = new Set(),
  resultsMode = false,
  mutedParticipantIds = sportHubMutedParticipantIds(),
} = {}){
  const roundGroups = new Map();
  views.forEach(view => {
    const roundNumber = view.event.roundNumber;
    const group = roundGroups.get(roundNumber) || [];
    group.push(view);
    roundGroups.set(roundNumber, group);
  });
  roundGroups.forEach(groupViews => {
    const section = document.createElement("section");
    section.className = "sport-hub-round-group";
    const heading = document.createElement("h2");
    heading.textContent = groupViews[0]?.event?.roundLabel || `Round ${groupViews[0]?.event?.roundNumber}`;
    const list = document.createElement("div");
    list.className = "sport-hub-fixture-list";
    groupViews.forEach(view => list.appendChild(buildSportHubFixtureRow(view, {
      worthWatching: curatedCanonicalIds.has(view.event.canonicalEventId),
      hiddenByUser: SPORT_HUBS.fixtureIsMuted(view, mutedParticipantIds),
      resultsMode,
    })));
    section.append(heading, list);
    container.appendChild(section);
  });
}


function renderSportHubAllFixtures(panel, fixtures, sportKey){
  const currentRound = SPORT_HUBS.currentRoundNumber(fixtures);
  sportHubState.selectedRoundNumber = SPORT_HUBS.normalizeSelectedRound(
    fixtures,
    sportHubState.selectedRoundNumber,
    currentRound
  );
  panel.appendChild(buildSportHubRoundNavigation(fixtures, sportHubState.selectedRoundNumber, {
    size: 2,
    onChange(roundNumber){
      recordFixtureCheck(sportKey, { entry: "round_picker", roundNumber });
      sportHubState.selectedRoundNumber = roundNumber;
      sportHubState.showHidden = false;
      renderCurrentSection();
    },
  }));
  const windowFixtures = SPORT_HUBS.fixturesForRoundWindow(fixtures, sportHubState.selectedRoundNumber, 2);
  const views = SPORT_HUBS.buildFixtureViews(windowFixtures, {
    feedCards: activeEvents,
    participants: canonicalSportsData.participants,
  });
  const mutedIds = sportHubMutedParticipantIds();
  const partition = SPORT_HUBS.partitionMutedFixtures(views, mutedIds, { showHidden: sportHubState.showHidden });
  appendSportHubHiddenSummary(panel, partition);
  appendSportHubRoundGroups(panel, partition.visible, {
    curatedCanonicalIds: sportHubCuratedCanonicalIds(sportKey),
    mutedParticipantIds: mutedIds,
  });
  if (!partition.visible.length) panel.appendChild(sportHubEmptyState("Every fixture in these rounds is hidden by your team mutes."));
}

function renderSportHubWorthWatching(panel, fixtures, sportKey){
  const currentRound = SPORT_HUBS.currentRoundNumber(fixtures);
  sportHubState.selectedRoundNumber = SPORT_HUBS.normalizeSelectedRound(
    fixtures,
    sportHubState.selectedRoundNumber,
    currentRound
  );
  panel.appendChild(buildSportHubRoundNavigation(fixtures, sportHubState.selectedRoundNumber, {
    size: 2,
    onChange(roundNumber){
      sportHubState.selectedRoundNumber = roundNumber;
      renderCurrentSection();
    },
    label: "Browse worth-watching rounds",
  }));
  const curatedIds = sportHubCuratedCanonicalIds(sportKey);
  const views = SPORT_HUBS.buildFixtureViews(
    SPORT_HUBS.fixturesForRoundWindow(fixtures, sportHubState.selectedRoundNumber, 2)
      .filter(fixture => curatedIds.has(fixture.id)),
    { feedCards: activeEvents, participants: canonicalSportsData.participants }
  );
  const mutedIds = sportHubMutedParticipantIds();
  const partition = SPORT_HUBS.partitionMutedFixtures(views, mutedIds);
  appendSportHubRoundGroups(panel, partition.visible, {
    curatedCanonicalIds: curatedIds,
    mutedParticipantIds: mutedIds,
  });
  if (!partition.visible.length){
    panel.appendChild(sportHubEmptyState("Nothing in these rounds clears your curated-feed threshold. All Fixtures still has the complete schedule."));
  }
}

function renderSportHubResults(panel, fixtures, sportKey){
  const latestCompleted = SPORT_HUBS.latestCompletedRoundNumber(fixtures);
  sportHubState.resultsRoundNumber = SPORT_HUBS.normalizeSelectedRound(
    fixtures,
    sportHubState.resultsRoundNumber,
    latestCompleted
  );
  panel.appendChild(buildSportHubRoundNavigation(fixtures, sportHubState.resultsRoundNumber, {
    size: 1,
    onChange(roundNumber){
      sportHubState.resultsRoundNumber = roundNumber;
      sportHubState.showHidden = false;
      renderCurrentSection();
    },
    label: "Browse results by round",
  }));
  if (!userPreferences.showSpoilers){
    const notice = document.createElement("p");
    notice.className = "sport-hub-spoiler-notice";
    notice.textContent = sportKey === "wrc"
      ? "Results are off. Winning crews and total times stay hidden; Stan Sport replay availability remains visible."
      : "Results are off. Scores stay hidden; this view does not promise video availability.";
    panel.appendChild(notice);
  }
  const selectedFixtures = SPORT_HUBS.fixturesForRoundWindow(fixtures, sportHubState.resultsRoundNumber, 1)
    .filter(SPORT_HUBS.fixtureIsFinished);
  const views = SPORT_HUBS.buildFixtureViews(selectedFixtures, {
    feedCards: activeEvents,
    participants: canonicalSportsData.participants,
  });
  const mutedIds = sportHubMutedParticipantIds();
  const partition = SPORT_HUBS.partitionMutedFixtures(views, mutedIds, { showHidden: sportHubState.showHidden });
  appendSportHubHiddenSummary(panel, partition);
  appendSportHubRoundGroups(panel, partition.visible, {
    curatedCanonicalIds: sportHubCuratedCanonicalIds(sportKey),
    resultsMode: true,
    mutedParticipantIds: mutedIds,
  });
  if (!partition.visible.length) panel.appendChild(sportHubEmptyState("No completed fixtures are available for this round yet."));
}

function renderSportHubStandings(panel, sportKey){
  const competitions = rankingCompetitionsForStandings()
    .filter(competition => standingsSportKey(competition) === sportKey);
  renderStandingsContext({
    container: panel,
    competitions,
    sectionLabel: `${SPORT_HUBS.sportConfig(sportKey).label} standings`,
  });
}

globalThis.renderSportHubLoaded=function(){
  const container = document.getElementById("listView");
  container.innerHTML = "";
  const sportKey = activeSportHubKey();
  if (!sportKey || !SPORT_HUBS) return;
  if (sportHubState.sportKey !== sportKey) resetSportHubState(sportKey);

  const sport = SPORT_HUBS.sportConfig(sportKey);
  const hub = document.createElement("section");
  hub.className = "sport-hub";
  hub.dataset.sportHub = sportKey;
  hub.style.setProperty("--sport-color", SPORT_META[sportKey]?.color || "var(--accent)");

  const focusedBanner = buildFocusedDiscoveryBanner(activeFilter);
  if (focusedBanner) hub.appendChild(focusedBanner);

  const heading = document.createElement("header");
  heading.className = "sport-hub-heading";
  const identity = document.createElement("div");
  identity.className = "sport-hub-identity";
  const fullCoverage = sportHubFullCoverageAllowed(sportKey);
  identity.innerHTML = `${glyphMarkup(SPORT_META[sportKey]?.glyph || "ui:filter", { label: sport.label })}<div><p>${fullCoverage ? "Complete 2026 coverage" : "Top picks and stories"}</p><h2>${sport.label}</h2></div>`;
  const promise = document.createElement("p");
  promise.className = "sport-hub-promise";
  promise.textContent = fullCoverage
    ? "Curated when you want judgement. Complete when you want to check every fixture."
    : "Follow teams and players to add their fixtures to your Feed.";
  heading.append(identity, promise);
  hub.appendChild(heading);

  const tabs = [
    ["worth-watching", "Worth Watching"],
    ...(fullCoverage ? [["all-fixtures", "All Fixtures"]] : []),
    ["standings", "Standings"],
    ["results", sportKey === "wrc" ? "Results / Replays" : "Results"],
  ];
  const tablist = document.createElement("div");
  tablist.className = "sport-hub-tabs";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", `${sport.label} hub sections`);
  const tabButtons = tabs.map(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `sport-hub-tab${sportHubState.activeTab === id ? " active" : ""}`;
    button.id = `sport-hub-tab-${id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(sportHubState.activeTab === id));
    button.setAttribute("aria-controls", "sportHubPanel");
    button.tabIndex = sportHubState.activeTab === id ? 0 : -1;
    button.textContent = label;
    button.addEventListener("click", () => {
      if (id === "standings" && !userPreferences.showSpoilers && !standingsRevealApproved){
        confirmStandingsReveal(() => {
          sportHubState.activeTab = "standings";
          sportHubState.showHidden = false;
          renderCurrentSection();
        });
        return;
      }
      if (id === "all-fixtures" && sportHubState.activeTab !== id){
        recordFixtureCheck(sportKey, {
          entry: "hub_tab",
          roundNumber: sportHubState.selectedRoundNumber,
        });
      }
      sportHubState.activeTab = id;
      sportHubState.showHidden = false;
      renderCurrentSection();
    });
    tablist.appendChild(button);
    return button;
  });
  tabButtons.forEach((button, index) => {
    button.addEventListener("keydown", event => {
      const moves = { ArrowLeft: -1, ArrowRight: 1 };
      if (!(event.key in moves) && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
        ? tabButtons.length - 1
        : (index + moves[event.key] + tabButtons.length) % tabButtons.length;
      tabButtons[nextIndex].click();
      document.getElementById(tabButtons[nextIndex].id)?.focus();
    });
  });
  hub.appendChild(tablist);

  const panel = document.createElement("div");
  panel.className = "sport-hub-panel";
  panel.id = "sportHubPanel";
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", `sport-hub-tab-${sportHubState.activeTab}`);
  hub.appendChild(panel);
  container.appendChild(hub);

  if (!canonicalSportsData){
    panel.appendChild(sportHubEmptyState(canonicalSportsDataError
      ? "Complete fixture data is temporarily unavailable. The curated feed remains available under All sports."
      : "Loading the complete canonical fixture schedule…"));
    if (!canonicalSportsDataLoading) loadCanonicalSportsData();
    return;
  }
  const fixtures = sportHubCanonicalFixtures(sportKey);
  if (!fixtures.length){
    panel.appendChild(sportHubEmptyState("No canonical fixtures are available for this supported season."));
    return;
  }
  if (sportHubState.activeTab === "worth-watching") renderSportHubWorthWatching(panel, fixtures, sportKey);
  else if (sportHubState.activeTab === "standings") renderSportHubStandings(panel, sportKey);
  else if (sportHubState.activeTab === "results") renderSportHubResults(panel, fixtures, sportKey);
  else if (fullCoverage) renderSportHubAllFixtures(panel, fixtures, sportKey);
  else renderSportHubWorthWatching(panel, fixtures, sportKey);
}
