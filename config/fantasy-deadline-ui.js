(function(){
'use strict';
const f=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES;
const {select,format,ageLimit}=f;
  function presentation(record,now=Date.now()){
    const ms=record.deadline-now,label=format(ms);if(!label)return null;
    const minutes=Math.floor(ms/60000),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),mins=minutes%60;
    const spoken=ms<60000?'less than 1 minute':[[days,'day'],[hours,'hour'],[mins,'minute']].filter(([n])=>n||(!days&&!hours)).map(([n,u])=>`${n} ${u}${n===1?'':'s'}`).join(', ');
    const absolute=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(record.deadline));
    return {text:`${record.definition.shortLabel} deadline · ${label}`,accessible:`${record.definition.label} team deadline: ${spoken} remaining. ${absolute} (local time).`};
  }
  function createController({document,preferences,sources,resolve,active,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
    let timer=null,disposed=false;const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
    function sync(){cancel();if(disposed)return;const clock=now(),cache=new Map();let next=Infinity;
      for(const card of document.querySelectorAll('[data-fantasy-fixture]')){
        const event=resolve(card.dataset.fantasyFixture),record=active()?select(event,preferences(),sources(),clock):null;let line=card.querySelector('.fantasy-deadline');
        if(!record){line?.remove();continue;}
        const key=record.gameId+':'+record.fantasyRoundId+':'+record.deadlineAt;if(!cache.has(key))cache.set(key,presentation(record,clock));const copy=cache.get(key);
        if(!line){line=document.createElement('p');line.className='fantasy-deadline';const target=card.querySelector('[data-fantasy-placement]');const schedule=target?.querySelector('.fixture-scheduled');if(schedule)schedule.after(line);else target?.prepend(line);}
        if(line.textContent!==copy.text)line.textContent=copy.text;if(line.getAttribute('aria-label')!==copy.accessible)line.setAttribute('aria-label',copy.accessible);
        const remaining=record.deadline-clock;const minute=remaining<60000?remaining:remaining%60000+1;
        const tightening=record.deadline-6*3600000;
        next=Math.min(next,minute,record.deadline-clock,record.verified+ageLimit(record.deadline,clock)-clock,tightening>clock?tightening-clock:Infinity);
      }
      if(active()&&!document.hidden&&Number.isFinite(next))timer=setTimer(sync,Math.max(1,Math.min(next,60000)));
    }
    const observer=typeof MutationObserver==='function'?new MutationObserver(sync):null;
    observer?.observe(document.getElementById('listView'),{childList:true,subtree:true});
    return {sync,cancel,dispose(){disposed=true;cancel();observer?.disconnect();},get timerActive(){return timer!==null;}};
  }
function installFantasyCard(card,ev,options){
  if(activeTab!=='feed'||activeInspectorCodeId||options.archived||options.inspectorFixture||options.eventParent||['events','premium-rail'].includes(options.mode))return;
  const target=card.querySelector('.fixture-access');if(!target)return;
  card.dataset.fantasyFixture=String(ev.eventId||ev.id);target.dataset.fantasyPlacement='';
}
function clearFantasyPlaceholderSpace(){
  for(const slot of document.querySelectorAll('.feed-card-slot[data-fantasy-height]')){
    if(slot.style.minHeight)slot.style.minHeight=Math.max(0,parseFloat(slot.style.minHeight)-Number(slot.dataset.fantasyHeight))+'px';
    delete slot.dataset.fantasyHeight;
  }
}
function saveFantasySetting(next){
  const clean=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES.normalizePreferences(next);
  savePreferences({...userPreferences,fantasyDeadlines:clean},{viewOnly:true});
  if(draftPreferences)draftPreferences.fantasyDeadlines=clonePreferences(clean);
  queueServerStateSync();
  clearFantasyPlaceholderSpace();
  globalThis.fantasyDeadlineController?.sync();
  liveFixtureRevision='';liveFixtureLastRequestedAt=0;
  if(clean.enabled){void ensureFantasyUi().then(()=>globalThis.fantasyDeadlineController.sync()).catch(()=>{});void refreshLiveFixtureSnapshot();}
}
globalThis.fantasyDeadlineController=createController({
  document,preferences:()=>userPreferences.fantasyDeadlines,sources:()=>fantasySourceState,
  resolve:id=>profileFixtureEvents.get(id),active:()=>activeTab==='feed'&&!activeInspectorCodeId,
});
for(const name of ['focus','pageshow'])window.addEventListener(name,()=>globalThis.fantasyDeadlineController.sync());
document.addEventListener('visibilitychange',()=>globalThis.fantasyDeadlineController.sync());
function renderFantasySettings(body){
  const f=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES,p=f.normalizePreferences(userPreferences.fantasyDeadlines);
  body.innerHTML='<section class="filter-panel"><label><input id="fantasyDeadlineToggle" type="checkbox"> Show fantasy deadlines on soccer cards</label><p class="preference-help">Show a small countdown for your selected fantasy games when their submission deadline is verified. Unavailable or expired deadlines stay hidden.</p><p class="preference-help">Changes save immediately.</p></section>';
  const toggle=body.querySelector('input');toggle.checked=p.enabled;toggle.onchange=()=>{saveFantasySetting({...p,enabled:toggle.checked});renderFantasySettings(body);};
  if(!p.enabled)return;
  const section=document.createElement('section');section.className='filter-panel';section.innerHTML='<h3>Your fantasy games</h3><p class="preference-help">Choose one game per competition. Deadlines and lockout rules differ between games. Changes save immediately.</p>';
  for(const competition of f.COMPETITIONS){
    const group=document.createElement('div');group.className='fantasy-game-choice';const title=document.createElement('strong');title.textContent=competition.label;group.append(title);
    const games=f.GAMES.filter(g=>g.competitionId===competition.id);
    if(games.length){const label=document.createElement('label');label.textContent='Fantasy game ';const select=document.createElement('select');select.setAttribute('aria-label',competition.label+' fantasy game');const none=document.createElement('option');none.value='';none.textContent='None';select.append(none);for(const game of games){const option=document.createElement('option');option.value=game.gameId;option.textContent=game.label;select.append(option);}select.value=p.gameByCompetition[competition.id]||'';select.onchange=()=>{const choices={...userPreferences.fantasyDeadlines.gameByCompetition};if(select.value)choices[competition.id]=select.value;else delete choices[competition.id];saveFantasySetting({...userPreferences.fantasyDeadlines,gameByCompetition:choices});};label.append(select);group.append(label);const help=document.createElement('p');help.className='preference-help';help.textContent=games[0].help+(fantasySourceState[games[0].sourceId]?.enabled===false?' Deadline data is currently unavailable.':'');group.append(help);}
    else{const help=document.createElement('p');help.className='preference-help';help.textContent='No verified fantasy source yet';group.append(help);}section.append(group);
  }body.append(section);
}
function renderAppearanceSettings(body){
  body.innerHTML = `<div class="preference-stack"></div>`;
  const stack = body.querySelector(".preference-stack");
  const theme = normalizeThemePreference(draftPreferences.theme);
  const themes = [
    ["day", "Day"],
    ["night", "Night"],
    ["system", "System"],
  ];
  const appearance = document.createElement("section");
  appearance.className = "filter-panel";
  appearance.innerHTML = `<h3>Appearance</h3><p class="preference-help">Choose how Nothing Sport looks on this device.</p><div class="theme-choice-list" role="radiogroup" aria-label="App theme">${themes.map(([value, label]) => `<label class="theme-choice${theme === value ? " selected" : ""}"><input type="radio" name="theme" value="${value}" ${theme === value ? "checked" : ""}><strong>${label}</strong></label>`).join("")}</div>`;
  appearance.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener("change", () => {
      draftPreferences.theme = normalizeThemePreference(input.value);
      applyThemePreference(draftPreferences.theme);
      renderSettingsScreen();
    });
  });
  const pilot = document.createElement("button");
  pilot.type = "button";
  pilot.className = "btn ghost";
  pilot.textContent = "Trust pilot details";
  pilot.addEventListener("click", () => {
    settingsSection = "pilot";
    renderSettingsScreen();
  });
  appearance.appendChild(pilot);
  stack.appendChild(appearance);
}

function renderSubscriptionSettings(body){
  body.innerHTML = `<div class="preference-stack"><section class="filter-panel"><h3>Subscriptions</h3><p class="preference-help">These choices only order View links. They never decide which cards appear in Feed.</p><div class="setup-choice-grid" id="subscriptionGrid"></div></section></div>`;
  const selected = new Set(draftPreferences.followFirst.subscriptions || []);
  const grid = document.getElementById("subscriptionGrid");
  Object.entries(FOLLOW_FIRST.VIEWING_PROVIDERS).forEach(([id, provider]) => {
    const label = document.createElement("label");
    label.className = "setup-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.has(id);
    input.addEventListener("change", () => {
      if (input.checked) selected.add(id); else selected.delete(id);
      draftPreferences.followFirst.subscriptions = Array.from(selected);
    });
    label.append(input, document.createTextNode(provider.label));
    grid.appendChild(label);
  });
}

function renderLocationSettings(body){
  const location = draftPreferences.followFirst.location;
  body.innerHTML = `<div class="preference-stack"><section class="filter-panel"><h3>Set location</h3><p class="preference-help">Search for a city, postcode or area, or use permissioned system location. Use Travel mode for a temporary local Feed while you are away.</p><div class="setup-location-grid"><label class="field-label">City, postcode or area<input id="settingsLocationQuery" type="search" value="${String(location.label || "").replace(/"/g, "&quot;")}" maxlength="120" placeholder="e.g. Leeds"></label><label class="field-label">Radius<select id="settingsLocationRadius">${[1,5,10,20,50,100,200,300].map(km => `<option value="${km}" ${location.radiusKm === km ? "selected" : ""}>${km} km</option>`).join("")}</select></label></div><label class="viewing-toggle"><input id="travelLocationMode" type="checkbox" ${location.mode === "travel" ? "checked" : ""}><span><strong>Temporary travel location</strong>Use this area until you switch Travel mode off.</span></label><div class="account-sync-actions"><button class="btn primary" type="button" id="settingsFindLocationBtn">Update location</button><button class="btn ghost" type="button" id="settingsUseCurrentLocationBtn">Use current location</button></div><p class="preference-help" id="settingsLocationStatus">${location.label ? `${location.label} · ${location.radiusKm} km` : "No location set."}</p></section></div>`;
  const applyLocation = value => {
    draftPreferences.followFirst.location = FOLLOW_FIRST.normalizeLocation({ ...value, radiusKm:Number(document.getElementById("settingsLocationRadius").value), mode:document.getElementById("travelLocationMode").checked ? "travel" : value.mode });
    draftPreferences.followFirst.startupMeta = FOLLOW_FIRST.normalizeMeta({ ...draftPreferences.followFirst.startupMeta, location:draftPreferences.followFirst.location });
  };
  document.getElementById("settingsFindLocationBtn").addEventListener("click", async () => {
    const status = document.getElementById("settingsLocationStatus");
    status.textContent = "Finding that area…";
    try{
      const response = await fetch(`/api/location?q=${encodeURIComponent(document.getElementById("settingsLocationQuery").value.trim())}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      applyLocation(payload.location);
      status.textContent = `${payload.location.label} will be used when you save.`;
    }catch(error){ status.textContent = error.message || "That location could not be found."; }
  });
  document.getElementById("settingsUseCurrentLocationBtn").addEventListener("click", async () => {
    try{
      if (!navigator.geolocation) throw new Error("Location is not supported on this device.");
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 }));
      const latitude = Number(position.coords.latitude.toFixed(2));
      const longitude = Number(position.coords.longitude.toFixed(2));
      const response = await fetch(`/api/location?lat=${latitude}&lng=${longitude}`);
      const payload = await response.json();
      applyLocation(payload.location || { label:"Current area", latitude, longitude, source:"system" });
      document.getElementById("settingsLocationStatus").textContent = `${draftPreferences.followFirst.location.label} will be used when you save.`;
    }catch(error){ document.getElementById("settingsLocationStatus").textContent = error.message || "Location permission was not granted."; }
  });
  document.getElementById("settingsLocationRadius").addEventListener("change", () => applyLocation(draftPreferences.followFirst.location));
  document.getElementById("travelLocationMode").addEventListener("change", () => applyLocation(draftPreferences.followFirst.location));
}

function renderAboutSettings(body){
  body.innerHTML = `<article class="about-body settings-about"><img class="settings-about-logo" data-brand-asset="hero" src="assets/brand/web/nothingsport-hero-logo.png" width="1400" height="856" alt="" aria-hidden="true" loading="lazy" decoding="async"><div class="settings-about-copy"><p data-brand-copy="about">Nothing Sport is a live sports curator, tailored to your tastes. Follow a sport for its finals and marquee fixtures, or a team or athlete for all their known fixtures. Australian discovery adds fixtures with Australian participants where that filter is useful. Ratings never decide whether a followed fixture appears. Dismiss removes that exact card without changing your follows. Open Events for tournaments, Follow for each sport’s Schedule, Ladder and Standings, or Settings for All Followed.</p><details class="asset-attribution"><summary>Editorial standards</summary><p>Why it matters is independently written from researched facts, with official sources preferred and reputable reporting used when official material cannot establish form or context. Source wording is not copied into cards. Citations, fact records and uncertainty notes are retained in the editorial audit trail rather than shown in the reading flow.</p><p>Future draws, participants and dates can change. Nothing Sport keeps the last verified narrative during a temporary source failure and withholds new structural filler when substantive context cannot be verified.</p></details><p class="asset-attribution">Generic sport silhouettes use Sporticon under Apache 2.0. Interface glyphs use Lucide under ISC. Team, league and event marks use recorded sources or neutral fallbacks. Watch actions use official-source provider marks where bundled and a text fallback otherwise.</p><p class="country-acknowledgement" data-brand-copy="countryAcknowledgement">Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.</p></div></article>`;
  const about = body.querySelector(".settings-about-copy");
  const socials = document.querySelector("footer.app-footer .footer-socials")?.cloneNode(true);
  if (socials) about.appendChild(socials);
  const legal = document.createElement("nav");
  legal.className = "legal-settings-links";
  legal.setAttribute("aria-label", "Legal");
  legal.innerHTML = '<button class="legal-settings-link" type="button" data-legal-document="privacy">Privacy Policy</button><button class="legal-settings-link" type="button" data-legal-document="terms">Terms &amp; Conditions</button>';
  legal.querySelectorAll("[data-legal-document]").forEach(button => {
    button.addEventListener("click", () => openLegalDocument(button.dataset.legalDocument));
  });
  about.appendChild(legal);
}

globalThis.NOTHINGSPORTS_FANTASY_UI={createController,renderAboutSettings,renderAppearanceSettings,renderSubscriptionSettings,renderLocationSettings,renderSettings:renderFantasySettings,install:installFantasyCard,clearSpace:clearFantasyPlaceholderSpace,save:saveFantasySetting};
for(const card of document.querySelectorAll('.feed-card-slot .event-card')){const ev=profileFixtureEvents.get(card.dataset.eventId);if(ev)installFantasyCard(card,ev,{});}
globalThis.fantasyDeadlineController.sync();
})();
