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
  if(f.competitionKey(ev.competitionId)&&userPreferences.fantasyDeadlines.gameByCompetition[f.competitionKey(ev.competitionId)])queueLiveFixtureSnapshot();
}
function clearFantasyPlaceholderSpace(){
  for(const slot of document.querySelectorAll('.feed-card-slot[data-fantasy-height]')){
    if(slot.style.minHeight)slot.style.minHeight=Math.max(0,parseFloat(slot.style.minHeight)-Number(slot.dataset.fantasyHeight))+'px';
    delete slot.dataset.fantasyHeight;
  }
}
function saveFantasySetting(next){
  const clean=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES.normalizePreferences({...next,choiceSource:'settings'});
  savePreferences({...userPreferences,fantasyDeadlines:clean},{viewOnly:true});
  if(draftPreferences)draftPreferences.fantasyDeadlines=clonePreferences(clean);
  if(settingsDraftBaseline)settingsDraftBaseline.fantasyDeadlines=clonePreferences(clean);
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
function appendEvaluationDisclosure(parent){
  if(fantasySourceState['live-fantasy-fpl']?.accessStatus==='approved')return;
  const note=document.createElement('p');note.className='preference-help fantasy-license-note';
  note.textContent='Evaluation feature. FPL data licence pending negotiation; commercial use subject to licence clearance. Nothing Sport is not affiliated with or endorsed by the Premier League.';
  parent.append(note);
}
function renderFantasySettings(body){
  const f=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES,p=f.normalizePreferences(userPreferences.fantasyDeadlines);
  body.innerHTML='<section class="filter-panel"><label><input id="fantasyDeadlineToggle" type="checkbox"> Show fantasy deadlines on soccer cards</label><p class="preference-help">Show a small countdown for your selected fantasy games when their submission deadline is verified. Unavailable or expired deadlines stay hidden.</p><p class="preference-help">Changes save immediately.</p></section>';
  const toggle=body.querySelector('input');toggle.checked=p.enabled;toggle.onchange=()=>{saveFantasySetting({...p,enabled:toggle.checked});renderFantasySettings(body);};
  if(!p.enabled)return;
  const section=document.createElement('section');section.className='filter-panel';section.innerHTML='<h3>Your fantasy games</h3><p class="preference-help">Choose one game per competition. Deadlines and lockout rules differ between games. Changes save immediately.</p>';
  for(const competition of f.COMPETITIONS){
    const group=document.createElement('div');group.className='fantasy-game-choice';const title=document.createElement('strong');title.textContent=competition.label;group.append(title);
    const games=f.GAMES.filter(g=>g.competitionId===competition.id);
    if(games.length){const label=document.createElement('label');label.textContent='Fantasy game ';const select=document.createElement('select');select.setAttribute('aria-label',competition.label+' fantasy game');const none=document.createElement('option');none.value='';none.textContent='None';select.append(none);for(const game of games){const option=document.createElement('option');option.value=game.gameId;option.textContent=game.label;select.append(option);}select.value=p.gameByCompetition[competition.id]||'';select.onchange=()=>{const choices={...userPreferences.fantasyDeadlines.gameByCompetition};if(select.value)choices[competition.id]=select.value;else delete choices[competition.id];saveFantasySetting({...userPreferences.fantasyDeadlines,gameByCompetition:choices});};label.append(select);group.append(label);const help=document.createElement('p');help.className='preference-help';help.textContent=games[0].help+(fantasySourceState[games[0].sourceId]?.enabled===false?' Deadline data is currently unavailable.':'');group.append(help);appendEvaluationDisclosure(group);}
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
  body.innerHTML = `<article class="about-body settings-about"><img class="settings-about-logo" data-brand-asset="hero" src="assets/brand/web/nothingsport-hero-logo.png" width="1400" height="856" alt="" aria-hidden="true" loading="lazy" decoding="async"><div class="settings-about-copy"><p data-brand-copy="about">Nothing Sport is a live sports curator, tailored to your tastes. Follow a sport for its finals and marquee fixtures, or a team or athlete for all their known fixtures. Australian discovery adds fixtures with Australian participants where that filter is useful. Ratings never decide whether a followed fixture appears. Dismiss removes that exact card without changing your follows. Open Events for tournaments, Follow for each sport’s Schedule, Ladder and Standings, or Settings for All Followed.</p><details class="asset-attribution" data-results-fine-print><summary>Results and spoilers</summary><p>Tournament and Event cards show progression and upcoming matchups to keep the experience rich. These can reveal who has advanced even with Results OFF. Avoid studying these cards if you don’t want advancement clues.</p></details><details class="asset-attribution"><summary>Editorial standards</summary><p>Why it matters is independently written from researched facts, with official sources preferred and reputable reporting used when official material cannot establish form or context. Source wording is not copied into cards. Citations, fact records and uncertainty notes are retained in the editorial audit trail rather than shown in the reading flow.</p><p>Future draws, participants and dates can change. Nothing Sport keeps the last verified narrative during a temporary source failure and withholds new structural filler when substantive context cannot be verified.</p></details><p class="asset-attribution">Generic sport silhouettes use Sporticon under Apache 2.0. Interface glyphs use Lucide under ISC. Team, league and event marks use recorded sources or neutral fallbacks. Watch actions use official-source provider marks where bundled and a text fallback otherwise.</p><p class="asset-attribution steak-attribution"><a href="https://www.flaticon.com/free-icons/steak" title="steak icons" target="_blank" rel="noopener noreferrer">Steak icons created by meaicon - Flaticon</a></p><p class="asset-attribution venue-attribution">MotoGP artwork: <a href="https://www.flaticon.com/free-icon/motorbike_1768191" target="_blank" rel="noopener noreferrer">Magnific</a>, <a href="https://www.flaticon.com/free-icon/world_14063354" target="_blank" rel="noopener noreferrer">Roundicons Premium</a> and <a href="https://www.flaticon.com/packs/circuit-13796880" target="_blank" rel="noopener noreferrer">berkahicon</a> — <a href="https://www.flaticon.com" target="_blank" rel="noopener noreferrer">Flaticon</a>. Vectorised and adapted; <a href="https://www.flaticon.com/media/license/license.pdf" target="_blank" rel="noopener noreferrer">Flaticon licence</a>.</p><details class="asset-attribution"><summary>MotoGP artwork credits and modifications</summary><ul><li><a href="https://www.flaticon.com/free-icon/motorbike_1768191" target="_blank" rel="noopener noreferrer">motorcycle — Magnific</a>. Alpha silhouette vector traced, transparent exterior cropped; monochrome black. </li><li><a href="https://www.flaticon.com/free-icon/world_14063354" target="_blank" rel="noopener noreferrer">badge — Roundicons Premium</a>. Vector traced, transparent exterior cropped; full original colours retained. </li><li><a href="https://www.flaticon.com/free-icon/san-marino_13797026" target="_blank" rel="noopener noreferrer">misano — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/silverstone_13797011" target="_blank" rel="noopener noreferrer">silverstone — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/track_13796988" target="_blank" rel="noopener noreferrer">sachsenring — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/philip-island_13796981" target="_blank" rel="noopener noreferrer">phillip island — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/motogp_13796946" target="_blank" rel="noopener noreferrer">brno — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/track_13796903" target="_blank" rel="noopener noreferrer">indianapolis — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/e/e/eea725c5-432a-483b-bf46-f9769b8e5ddf/simple/cat.png" target="_blank" rel="noopener noreferrer">catalunya — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/track_13796893" target="_blank" rel="noopener noreferrer">bugatti — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/motogp_13796964" target="_blank" rel="noopener noreferrer">termas candidate — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/mugello_13796973" target="_blank" rel="noopener noreferrer">mugello — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/sachsenring_13796936" target="_blank" rel="noopener noreferrer">jerez — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/qatar_13796955" target="_blank" rel="noopener noreferrer">lusail — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/track_13796925" target="_blank" rel="noopener noreferrer">us candidate — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/spain_13796995" target="_blank" rel="noopener noreferrer">aragon — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/sepang_13797003" target="_blank" rel="noopener noreferrer">sepang — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://www.flaticon.com/free-icon/spain_13797019" target="_blank" rel="noopener noreferrer">valencia — berkahicon</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/5/e/5eb8c6ce-f16b-4be5-8aea-39ebaa3b18ba/simple/tha.png" target="_blank" rel="noopener noreferrer">chang — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/c/7/c7c0782e-67f2-4351-af96-6dd5835e8d42/simple/usa.png" target="_blank" rel="noopener noreferrer">cota — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/4/6/46218937-1b94-4d2e-97b7-256b5bf181c3/simple/hun.png" target="_blank" rel="noopener noreferrer">balaton park — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/2/c/2c30ee0c-d85b-48e1-b6d4-303a2ba22ae1/simple/nld.png" target="_blank" rel="noopener noreferrer">assen — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/9/f/9fbd0109-0b0b-4bbb-a671-d7840036babe/simple/jpn.png" target="_blank" rel="noopener noreferrer">motegi — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/0/d/0db4e87a-920f-4699-a688-63e22b924f1b/simple/ina.png" target="_blank" rel="noopener noreferrer">mandalika — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/0/b/0b5cf829-21cf-48dd-a324-1465fc504c24/simple/por.png" target="_blank" rel="noopener noreferrer">portimao — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://photos.motogp.com/events-admin/5/0/50941f7f-e112-4404-8dcf-5fb2c47e9617/simple/bra.png" target="_blank" rel="noopener noreferrer">goiania — MotoGP Sports Entertainment Group</a>. Route linework vector traced and cropped; white monochrome, transparent exterior and enclosed areas. No infill or embedded raster. </li><li><a href="https://commons.wikimedia.org/wiki/File:Red_Bull_Ring_moto_2022.svg" target="_blank" rel="noopener noreferrer">spielberg motogp — Gpmat; Pitlane02, Sentoan, HorsePunchKid, Cs-wolves, RoelTM, Sparkle1</a>. Race-course path retained, including the MotoGP right-left chicane. Labels, old straight and pit lane removed; white stroke and cropped transparent viewBox. This derivative remains CC BY-SA 3.0. <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a></li></ul><p>Flaticon artwork is adapted under the <a href="https://www.flaticon.com/media/license/license.pdf" target="_blank" rel="noopener noreferrer">Flaticon attribution licence</a>. Additional course outlines use the cited official MotoGP geometry references; original media rights remain with their owners. The adapted Spielberg map is <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>. Track interiors and backgrounds are transparent. Unverified configurations use the motorcycle fallback.</p></details><details class="asset-attribution"><summary>WRC artwork credits and modifications</summary><p><a href="https://rallyitaliasardegna.com/wp-content/uploads/2026/09/SS8-11.pdf" target="_blank" rel="noopener noreferrer">Rally Italia Sardegna / Automobile Club d’Italia — 2026 Lerno stage geometry</a>. One prominent stage shown with source-verified start and finish. Route simplified, rotated and uniformly scaled; transfers, labels and basemap removed. Original media rights remain with the organiser; no open licence asserted. <a href="https://github.com/ookamiinc/sporticon" target="_blank" rel="noopener noreferrer">Sporticon motorsport helmet</a> — white adaptation under <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache 2.0</a>. Unverified edition routes use the helmet fallback.</p></details><p class="asset-attribution wsl-attribution">Wave designed by <a href="https://www.flaticon.com/free-icon/wave_12863984" target="_blank" rel="noopener noreferrer">manshagraphics from Flaticon</a>. Vector traced, cropped and recoloured white. WSL mark: <a href="https://www.worldsurfleague.com/" target="_blank" rel="noopener noreferrer">World Surf League</a>, editorial identification; original rights retained.</p><p class="asset-attribution sailgp-attribution">SailGP marks: <a href="https://sailgp.com/" target="_blank" rel="noopener noreferrer">SailGP</a>, editorial identification; original rights retained. Sailing fallback by Nothing Sport. Unverified courses use this glyph.</p><p class="country-acknowledgement" data-brand-copy="countryAcknowledgement">Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.</p></div></article>`;
  const about = body.querySelector(".settings-about-copy");
  const cyclingCredits = document.querySelector("footer.app-footer .cycling-attribution")?.cloneNode(true);
  if (cyclingCredits) about.appendChild(cyclingCredits);
  const dakarCredits = document.querySelector("footer.app-footer .dakar-attribution")?.cloneNode(true);
  if(dakarCredits)about.appendChild(dakarCredits);
  const golfCredits = document.querySelector("footer.app-footer .golf-attribution")?.cloneNode(true);
  if (golfCredits) about.appendChild(golfCredits);
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
  appendEvaluationDisclosure(about);
}

function renderStartupMetadataSettings(body){
  const meta = startupMetaDraft();
  body.innerHTML = `${wizardProgressMarkup()}<div class="preference-stack">
    <section class="filter-panel"><h3>What are you into?</h3><p class="preference-help">Choose at least one. These seed your sport follows and Aussies Only; you can refine clubs and players later.</p><div class="setup-choice-grid" id="startupSportsGrid"></div></section>
    <section class="filter-panel"><h3>Fantasy deadlines</h3><label class="setup-consent"><input id="startupFantasyDeadlines" type="checkbox" ${draftPreferences.fantasyDeadlines.enabled ? "checked" : ""}> Show FPL deadline countdowns on Premier League cards</label><p class="preference-help">Shows verified Fantasy Premier League deadlines. You can turn this off in Settings.</p></section>
    <section class="filter-panel"><h3>Major events</h3><p class="preference-help">Optional. Pick the big event families you actively want.</p><div class="setup-choice-grid" id="startupEventsGrid"></div></section>
    <section class="filter-panel"><h3>Set location</h3><p class="preference-help">City, postcode or area only. Coordinates are rounded and the default radius is 20 km.</p><div class="setup-location-grid"><label class="field-label">City, postcode or area<input id="startupLocationQuery" type="search" value="${meta.location.label.replace(/"/g, "&quot;")}" maxlength="120" autocomplete="postal-code" placeholder="e.g. Sydney or 2000"></label><label class="field-label">Radius<select id="startupRadius">${[1,5,10,20,50,100,200,300].map(km => `<option value="${km}" ${meta.location.radiusKm === km ? "selected" : ""}>${km} km</option>`).join("")}</select></label></div><div class="account-sync-actions"><button class="btn ghost" type="button" id="findStartupLocationBtn">Find location</button><button class="btn ghost" type="button" id="useCurrentLocationBtn">Use current location</button></div><p class="preference-help" id="startupLocationStatus">${meta.location.label ? `${meta.location.label}${meta.location.region ? `, ${meta.location.region}` : ""} · ${meta.location.radiusKm} km` : "No location set yet."}</p></section>
    <section class="filter-panel"><h3>Offers you might actually use</h3><p class="preference-help">Optional, lightweight ad relevance metadata. It does not change Feed eligibility.</p><div class="setup-choice-grid" id="startupOffersGrid"></div><label class="pilot-disclosure setup-consent"><input id="personalisedOffersConsent" type="checkbox" ${meta.personalisedOffersConsent ? "checked" : ""}><span><strong>Allow personalised offers later</strong>This is separate, optional consent. A Supabase admin can edit your seed preferences but cannot grant this consent for you.</span></label></section>
    <section class="filter-panel"><h3>Create an account</h3><p class="preference-help">Optional for now. A verified account keeps this setup and future follows connected across devices.</p><div class="setup-location-grid"><label class="field-label">Email<input id="startupAccountEmail" type="email" autocomplete="username" maxlength="254" placeholder="you@example.com"></label><label class="field-label">Password<input id="startupAccountPassword" type="password" autocomplete="new-password" minlength="8" maxlength="1024" placeholder="8+ characters"></label></div><button class="btn ghost" id="startupCreateAccountBtn" type="button">Create verified account</button><p class="preference-help" id="startupAccountStatus" role="status" aria-live="polite">Or continue with a local profile.</p></section>
  </div>`;
  document.getElementById('startupFantasyDeadlines').addEventListener('change',event=>{
    draftPreferences.fantasyDeadlines=globalThis.NOTHINGSPORTS_FANTASY_DEADLINES.onboardingChoice(event.target.checked);
  });
  const renderChoices = (targetId, records, selectedIds, onChange) => {
    const grid = document.getElementById(targetId);
    records.forEach(record => {
      const label = document.createElement("label");
      label.className = "setup-choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedIds.includes(record.id);
      input.addEventListener("change", () => onChange(record.id, input.checked));
      label.append(input, document.createTextNode(record.label));
      grid.appendChild(label);
    });
  };
  renderChoices("startupSportsGrid", FOLLOW_FIRST.STARTUP_SPORTS, meta.sports, (id, checked) => {
    const sports = new Set(startupMetaDraft().sports);
    if (checked) sports.add(id); else sports.delete(id);
    if (!sports.size){ showToast("Choose at least one sport."); renderSettingsScreen(); return; }
    applyStartupMetaDraft({ sports:Array.from(sports) });
  });
  renderChoices("startupEventsGrid", FOLLOW_FIRST.MAJOR_EVENT_FAMILIES, meta.majorEvents, (id, checked) => {
    const events = new Set(startupMetaDraft().majorEvents);
    if (checked) events.add(id); else events.delete(id);
    applyStartupMetaDraft({ majorEvents:Array.from(events) });
  });
  renderChoices("startupOffersGrid", FOLLOW_FIRST.OFFER_INTERESTS, meta.offerInterests, (id, checked) => {
    const offers = new Set(startupMetaDraft().offerInterests);
    if (checked) offers.add(id); else offers.delete(id);
    applyStartupMetaDraft({ offerInterests:Array.from(offers) });
  });
  document.getElementById("startupRadius").addEventListener("change", event => applyStartupMetaDraft({ location:{ ...startupMetaDraft().location, radiusKm:Number(event.target.value) } }));
  document.getElementById("personalisedOffersConsent").addEventListener("change", event => applyStartupMetaDraft({ personalisedOffersConsent:event.target.checked, consentUpdatedAt:event.target.checked ? new Date().toISOString() : null }));
  document.getElementById("findStartupLocationBtn").addEventListener("click", async () => {
    const status = document.getElementById("startupLocationStatus");
    status.textContent = "Finding that area…";
    try{ await resolveSetupLocation(document.getElementById("startupLocationQuery").value.trim()); }
    catch(error){ status.textContent = error.message; }
  });
  document.getElementById("useCurrentLocationBtn").addEventListener("click", async () => {
    const status = document.getElementById("startupLocationStatus");
    status.textContent = "Requesting your current area…";
    try{ await useCurrentSetupLocation(); }
    catch(error){ status.textContent = error.message || "Location permission was not granted."; }
  });
  document.getElementById("startupCreateAccountBtn").addEventListener("click", async () => {
    const status = document.getElementById("startupAccountStatus");
    const email = document.getElementById("startupAccountEmail").value.trim();
    const password = document.getElementById("startupAccountPassword").value;
    status.textContent = "Creating your account…";
    try{
      const result = await serverSyncClient.signUp(email, password, startupMetaDraft());
      if (result.session){ await bootstrapServerPersistence(); status.textContent = "Account created and connected."; }
      else status.textContent = "Check your email to verify the account, then sign in from Settings.";
    }catch(error){ status.textContent = error.message || "The account could not be created."; }
  });
}

function renderNotificationSettings(body){
  const preferences = draftPreferences.followFirst.notifications;
  const enabled = preferences.enabled !== false;
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const iosInstall = iosPushRequiresHomeScreen();
  const statusCopy = permission === "denied"
    ? "System alerts are blocked. Allow notifications for Nothing Sport in this browser or device Settings, then return here."
    : iosInstall
      ? "On iPhone or iPad, add Nothing Sport to the Home Screen, open it there, then reopen a guest room link there once. System push and badges only work in the installed app."
      : enabled && permission === "granted"
        ? "System alerts are enabled on this device. Background sounds are controlled by the device."
        : "Your alert choices default to on. Tap Enable system alerts to grant this device permission.";
  const actionLabel = permission === "granted" && enabled ? "Turn off system alerts on this device" : "Enable system alerts";
  body.innerHTML = `<div class="preference-stack">
    <section class="filter-panel"><h3>Sounds, alerts and badges</h3>
      <p class="preference-help">Background notifications can arrive even when Nothing Sport is closed. Nothing Sport asks for system permission only when you tap the button below. Message previews stay private: lock-screen chat alerts name only the room.</p>
      <label class="viewing-toggle"><input type="checkbox" id="liveRatingsEnabled" ${preferences.liveRatingsEnabled !== false ? "checked" : ""}><span><strong>5/5 ratings from people I follow</strong>Grouped Heat, Live and Impact alerts across all sports.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="socialAlertsEnabled" ${preferences.socialAlertsEnabled !== false ? "checked" : ""}><span><strong>New followers and bonus points</strong>Notify you when someone follows your profile, copies your sporting follows, or earns you points.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="chatAlertsEnabled" ${preferences.chatAlertsEnabled !== false ? "checked" : ""}><span><strong>Chat alerts</strong>Notify you about new messages from other room participants.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="autoRemindersEnabled" ${preferences.autoRemindersEnabled !== false ? "checked" : ""}><span><strong>Automatic reminders for my follows</strong>Remind me before eligible knockout fixtures featuring athletes or teams I follow.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="sportingRemindersEnabled" ${preferences.sportingRemindersEnabled !== false ? "checked" : ""}><span><strong>Sporting reminders</strong>Deliver sporting reminders before their published start.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="notificationSoundsEnabled" ${preferences.soundsEnabled !== false ? "checked" : ""}><span><strong>In-app sounds</strong>Play a short cue for an incoming chat message. Impact sound has its own switch in Nothinger Leaderboard.</span></label>
      <label class="viewing-toggle"><input type="checkbox" id="notificationBadgesEnabled" ${preferences.badgesEnabled !== false ? "checked" : ""}><span><strong>Unread badges</strong>Show the total unread chat message count on the app icon where supported.</span></label>
      <button class="btn ${permission === "granted" && enabled ? "ghost" : "primary"}" type="button" id="notificationPermissionBtn" ${permission === "unsupported" ? "disabled" : ""}>${actionLabel}</button>
      <button class="btn ghost" type="button" id="testChatSoundBtn">Play test sound</button>
      <button class="btn ghost" type="button" id="testSystemNotificationBtn" ${permission === "unsupported" ? "disabled" : ""}>Send test notification</button>
      <p class="preference-help" id="notificationPermissionStatus">${statusCopy}</p>
      <p class="preference-help" id="notificationDiagnosticsStatus">Checking device and scheduler status…</p>
    </section>
  </div>`;
  [["autoRemindersEnabled","autoRemindersEnabled"],["liveRatingsEnabled","liveRatingsEnabled"],["socialAlertsEnabled","socialAlertsEnabled"],["chatAlertsEnabled","chatAlertsEnabled"],["sportingRemindersEnabled","sportingRemindersEnabled"],["notificationSoundsEnabled","soundsEnabled"],["notificationBadgesEnabled","badgesEnabled"]].forEach(([id,key]) => {
    document.getElementById(id).addEventListener("change", event => {
      draftPreferences.followFirst.notifications[key] = event.target.checked;
    });
  });
  document.getElementById("notificationPermissionBtn").addEventListener("click", async () => {
    const status = document.getElementById("notificationPermissionStatus");
    const button = document.getElementById("notificationPermissionBtn");
    button.disabled = true;
    if (enabled && permission === "granted"){
      status.textContent = "Turning off system alerts on this device…";
      try{
        await disablePushInstallation();
        setBackgroundNotificationPreference(draftPreferences, false);
        renderSettingsScreen();
      }catch(error){
        status.textContent = error.message || "System alerts could not be turned off.";
        button.disabled = false;
      }
      return;
    }
    status.textContent = "Requesting system permission…";
    try{
      await ensurePushInstallation();
      setBackgroundNotificationPreference(draftPreferences, true);
      renderSettingsScreen();
    }catch(error){
      status.textContent = error.message || (Notification.permission === "denied"
        ? "Notifications are blocked. Allow Nothing Sport in browser or device Settings."
        : "Notification permission was not granted.");
      button.disabled = false;
    }
  });
  document.getElementById("testChatSoundBtn").addEventListener("click", async event => {
    const status = document.getElementById("notificationPermissionStatus");
    event.currentTarget.disabled = true;
    draftPreferences.followFirst.notifications.soundsEnabled = true;
    const played = await playIncomingChatSound({ force: true });
    status.textContent = played ? "Test sound played." : "Sound is blocked on this device. Check volume and browser sound permissions.";
    event.currentTarget.disabled = false;
  });
  document.getElementById("testSystemNotificationBtn").addEventListener("click", async event => {
    const status = document.getElementById("notificationPermissionStatus");
    event.currentTarget.disabled = true;
    status.textContent = "Sending a real system notification to this device…";
    try{
      await ensurePushInstallation();
      const result = await notificationDiagnosticsCommand("test");
      status.textContent = result.sent ? "Test notification sent. Its receipt will appear below when the open app observes it." : "The test was not sent.";
      await refreshNotificationDiagnosticsStatus();
    }catch(error){
      status.textContent = error.message || "The test notification could not be sent.";
    }finally{
      event.currentTarget.disabled = false;
    }
  });
  void refreshNotificationDiagnosticsStatus();
}

globalThis.NOTHINGSPORTS_FANTASY_UI={renderNotificationSettings,createController,renderStartupSettings:renderStartupMetadataSettings,renderAboutSettings,renderAppearanceSettings,renderSubscriptionSettings,renderLocationSettings,renderSettings:renderFantasySettings,install:installFantasyCard,clearSpace:clearFantasyPlaceholderSpace,save:saveFantasySetting};
for(const card of document.querySelectorAll('.feed-card-slot .event-card')){const ev=profileFixtureEvents.get(card.dataset.eventId);if(ev)installFantasyCard(card,ev,{});}
globalThis.fantasyDeadlineController.sync();
})();
