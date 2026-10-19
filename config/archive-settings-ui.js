(function(root){
'use strict';
function accountSettingsSummary(){
  const email = serverPersistence.user?.email || "";
  if (serverPersistence.state === "checking") return "Checking server sync";
  if (serverPersistence.state === "local") return "Local only · this device";
  if (serverPersistence.state === "signedOut") return "Sign in to sync across devices";
  if (serverPersistence.state === "requesting") return "Signing in";
  if (serverPersistence.state === "syncing") return `${email || "Signed in"} · syncing`;
  if (serverPersistence.state === "signedIn") return `${email || "Signed in"} · synced`;
  return email ? `${email} · local copy active` : "Local copy active";
}

function fantasySettingsSummary(){
  const p=userPreferences.fantasyDeadlines;
  return p.enabled?(p.gameByCompetition['competition:premier-league']==='fpl-classic'?'FPL':'Choose a game'):'Off';
}
function renderSettingsMenu(body){
  const hiddenCount = dismissedEventEntries().length;
  body.innerHTML = `<div class="settings-menu">
    ${settingsMenuItem("account", "ui:radio", "Account", accountSettingsSummary())}
    ${settingsMenuItem("classics", "ui:archive", "EPIC Hall of Fame", "Your classics and year of NS in review")}
    ${settingsMenuItem("all-followed", "ui:list", "All Followed", "Sports, events, teams, athletes and collections")}
    ${settingsMenuItem("about", "ui:info", "About", "Nothing Sport, editorial standards and legal information")}
    ${settingsMenuItem("fantasy", "ui:settings", "Fantasy deadlines", fantasySettingsSummary())}
    ${settingsMenuItem("appearance", "ui:sun", "Appearance", "Day, night or system theme")}
    ${settingsMenuItem("subscriptions", "ui:watch", "Subscriptions", `${draftPreferences.followFirst.subscriptions.length} preferred viewing service${draftPreferences.followFirst.subscriptions.length === 1 ? "" : "s"}`)}
    ${settingsMenuItem("notifications", "ui:bell", "Notifications", draftPreferences.followFirst.notifications.enabled ? "15 minutes before kickoff or race start" : "Off")}
    ${settingsMenuItem("location", "ui:map-pin", "Set location", draftPreferences.followFirst.location.label || "Not set")}
    ${settingsMenuItem("hidden", "ui:archive", "Hidden events", `${hiddenCount} dismissed card${hiddenCount === 1 ? "" : "s"}`)}
    ${settingsMenuItem("feedback", "ui:message", "Feedback", "Send feedback to Nothing Sport")}
  </div><div class="filter-panel"><h3>Feed refresh and recovery</h3><p class="preference-help">The published feed refreshes automatically when the app opens. Use this recovery action if cards appear stale or incomplete.</p><p class="preference-help" id="derivedFeedCacheSummary">${derivedCardCache?.derivedCards?.length || 0} derived cards are cached on this device. Ordinary cards retire seven calendar days after their final date. Personal classics and ratings are retained separately.</p><button class="btn ghost" type="button" id="refreshAndRebuildFeedBtn" aria-describedby="refreshAndRebuildFeedStatus">Refresh and rebuild feed</button><p class="preference-help" id="refreshAndRebuildFeedStatus" role="status" aria-live="polite"></p></div>`;
  const updates = globalThis.NOTHINGSPORTS_APP_UPDATE;
  if (updates){
    const section = document.createElement("section");
    section.className = "filter-panel";
    section.innerHTML = '<h3>App updates</h3><p class="preference-help" id="appVersionStatus" role="status" aria-live="polite"></p><button class="btn ghost" type="button" id="checkAppUpdateBtn">Check for updates</button>';
    body.appendChild(section);
    const status = section.querySelector("#appVersionStatus");
    const button = section.querySelector("button");
    const render = state => {
      const messages = { idle:"", checking:"Checking for updates…", current:"Up to date.", updating:"Update available. Applying when your current action is saved…", offline:"Offline. Your saved app is available; reconnect to check for updates.", error:"Couldn’t confirm the latest version. Try again when connected." };
      status.textContent = "Version " + state.version + " · " + (messages[state.phase] || "");
      button.disabled = state.phase === "checking";
    };
    render(updates.snapshot());
    const unsubscribe = updates.subscribe(state => { if (section.isConnected) render(state); });
    const observer = new MutationObserver(() => { if (!section.isConnected){ unsubscribe(); observer.disconnect(); } });
    observer.observe(body, { childList:true });
    button.addEventListener("click", () => void updates.check({ force:true }));
  }
  bindSettingsMenuNavigation(body);
  document.getElementById("refreshAndRebuildFeedBtn").addEventListener("click", async () => {
    const button = document.getElementById("refreshAndRebuildFeedBtn");
    const status = document.getElementById("refreshAndRebuildFeedStatus");
    button.disabled = true;
    button.textContent = "Refreshing…";
    status.textContent = "Checking the latest published feed and rebuilding this device’s disposable card cache…";
    if (CARD_LIFECYCLE) saveDerivedCardCache(CARD_LIFECYCLE.emptyCache(nowAEST()));
    const result = await refreshRemoteFeed({ quiet: true });
    const sourceCopy = result.source === "server"
      ? "The synced feed and cache were rebuilt centrally."
      : result.source === "fallback"
        ? "The published feed could not be reached, so the bundled feed and local cache were rebuilt safely."
        : "The latest published feed and local cache were rebuilt.";
    const changeCopy = result.rendered
      ? " Visible cards were updated."
      : " The visible feed was already current, so it was left in place.";
    status.textContent = `${sourceCopy}${changeCopy}`;
    document.getElementById("derivedFeedCacheSummary").textContent = `${derivedCardCache?.derivedCards?.length || 0} derived cards are cached on this device. Ordinary cards retire seven calendar days after their final date. Personal classics and ratings are retained separately.`;
    button.textContent = "Refresh and rebuild feed";
    button.disabled = false;
    showToast(status.textContent);
  });
}

function renderArchiveSettings(body){
  const events = archivedEvents().filter(e=>!getEventAction(e).isPurged&&!NOTHINGSPORTS_EPIC.retired(e));
  body.innerHTML = `<div class="preference-stack"><p class="preference-help">Saved ordinary cards retire seven days after their final fixture date. Your personal 5/5 classics stay in EPIC Hall of Fame.</p><div id="settingsArchiveList"></div></div>`;
  const list = document.getElementById("settingsArchiveList");
  if (!events.length){
    list.innerHTML = `<div class="empty-state" style="padding:24px 12px">No archived events.</div>`;
    return;
  }
  const grouped = groupEventsByDate(calendarTimelineEvents(events));
  Object.keys(grouped).sort().forEach(dateStr => {
    const section = document.createElement("section");
    section.className = "queue-section";
    const heading = document.createElement("h3");
    heading.textContent = fmtDateHeading(dateStr);
    section.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "cards-grid";
    grouped[dateStr].forEach(ev => grid.appendChild(buildEventCard(ev, {
      mode: "archived",
      archived: true,
      autoArchived: eventIsAutoArchived(ev) && !getEventAction(ev).archived,
    })));
    section.appendChild(grid);
    list.appendChild(section);
  });
}

function renderHiddenEventsSettings(body){
  const entries = dismissedEventEntries();
  body.innerHTML = `<div class="preference-stack"><p class="preference-help">Dismissed cards stay out of Feed and Events. Restoring a card makes that exact edition eligible again; future editions were never blocked.</p><div class="hidden-event-list" id="settingsHiddenEventList"></div></div>`;
  const list = document.getElementById("settingsHiddenEventList");
  if (!entries.length){
    list.innerHTML = `<div class="empty-state" style="padding:24px 12px">No hidden events.</div>`;
    return;
  }
  const purge=document.createElement('button');purge.type='button';purge.className='btn ghost';purge.textContent=`Empty bin (${entries.length})`;
  purge.onclick=()=>void ensureEpicUi().then(ui=>ui.purge(entries)).catch(error=>showToast(error.message));
  list.before(purge);
  entries.forEach(entry => {
    const row = document.createElement("article");
    row.className = "hidden-event-row";
    const identity = document.createElement("div");
    identity.className = "event-icon";
    renderEventIdentityMark(identity, entry.event, sportMetaForEvent(entry.event));
    const copy = document.createElement("div");
    copy.className = "hidden-event-copy";
    const title = document.createElement("strong");
    title.textContent = entry.label;
    const detail = document.createElement("span");
    detail.textContent = `${entry.kind} · hidden ${new Date(getEventAction(entry.event).dismissedAt || Date.now()).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" })}`;
    copy.append(title, detail);
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "btn ghost";
    restore.textContent = "Restore";
    restore.addEventListener("click", () => restoreDismissedEvent(entry.event));
    row.append(identity, copy, restore);
    list.appendChild(row);
  });
}

function dismissedEventEntries(){
  const byId = new Map();
  activeEvents.forEach(event => {
    const action=getEventAction(event);
    if ((!action.dismissed&&!action.isDismissed)||action.isPurged||NOTHINGSPORTS_EPIC.retired(event)) return;
    byId.set(String(event.eventId || event.id), { event, label:spoilerSafeDisplayTitle(event), kind:"Feed event" });
  });
  (majorEventsDocument?.events || []).forEach(record => {
    const event = majorEventActionEvent(record);
    const action=getEventAction(event);
    if ((!action.dismissed&&!action.isDismissed)||action.isPurged||NOTHINGSPORTS_EPIC.retired(event)) return;
    byId.set(String(event.eventId || event.id), { event, label:record.name, kind:"Major event" });
  });
  return [...byId.values()].sort((first, second) => {
    const firstAt = Date.parse(getEventAction(first.event).dismissedAt || "") || 0;
    const secondAt = Date.parse(getEventAction(second.event).dismissedAt || "") || 0;
    return secondAt - firstAt || first.label.localeCompare(second.label);
  });
}

root.NOTHINGSPORTS_ARCHIVE_SETTINGS_UI={renderSettingsMenu,renderArchiveSettings,renderHiddenEventsSettings};
})(globalThis);
