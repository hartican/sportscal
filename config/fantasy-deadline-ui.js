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
  body.innerHTML = `<article class="about-body settings-about"><img class="settings-about-logo" data-brand-asset="hero" src="assets/brand/web/nothingsport-hero-logo.png" width="1400" height="856" alt="" aria-hidden="true" loading="lazy" decoding="async"><div class="settings-about-copy"><div class="settings-about-introduction" data-brand-section="about"></div><details class="asset-attribution" data-results-fine-print><summary>Results and spoilers</summary><p>Tournament and Event cards show progression and upcoming matchups to keep the experience rich. These can reveal who has advanced even with Results OFF. Avoid studying these cards if you don’t want advancement clues.</p></details><details class="asset-attribution" data-about-section="editorial-standards"><summary>Editorial standards</summary><p>Why it matters is independently written from researched facts, with official sources preferred and reputable reporting used when official material cannot establish form or context. Source wording is not copied into cards. Citations, fact records and uncertainty notes are retained in the editorial audit trail rather than shown in the reading flow.</p><p>Future draws, participants and dates can change. Nothing Sport keeps the last verified narrative during a temporary source failure and withholds new structural filler when substantive context cannot be verified.</p></details><p class="asset-attribution">DM Sans by the DM Sans Project Authors is bundled under the <a href="assets/licenses/DM-SANS-OFL.txt" target="_blank" rel="noopener noreferrer">SIL Open Font License 1.1</a>. Generic sport silhouettes use Sporticon under Apache 2.0. Interface glyphs use Lucide under ISC. Team, league and event marks use recorded sources or neutral fallbacks. Watch actions use official-source provider marks where bundled and a text fallback otherwise.</p><p class="asset-attribution steak-attribution"><a href="https://www.flaticon.com/free-icons/steak" title="steak icons" target="_blank" rel="noopener noreferrer">Steak icons created by meaicon - Flaticon</a></p><p class="asset-attribution venue-attribution">MotoGP artwork: <a href="https://www.flaticon.com/free-icon/motorbike_1768191" target="_blank" rel="noopener noreferrer">Magnific</a>, <a href="https://www.flaticon.com/free-icon/world_14063354" target="_blank" rel="noopener noreferrer">Roundicons Premium</a> and <a href="https://www.flaticon.com/packs/circuit-13796880" target="_blank" rel="noopener noreferrer">berkahicon</a> — <a href="https://www.flaticon.com" target="_blank" rel="noopener noreferrer">Flaticon</a>. Vectorised and adapted; <a href="https://www.flaticon.com/media/license/license.pdf" target="_blank" rel="noopener noreferrer">Flaticon licence</a>.</p><details class="asset-attribution"><summary>MotoGP artwork credits and modifications</summary><p>Current circuit artwork uses exact main-route paths from official MotoGP SVG maps. White presentation and cropped viewBox; backgrounds and labels removed. Original rights retained. Unverified configurations use the motorcycle fallback.</p><ul><li><a href="https://photos.motogp.com/events-admin/0/c/0c4b819d-6014-4920-877b-ab0a1f3415a3/info/rsm-info2.svg" target="_blank" rel="noopener noreferrer">misano — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/2/f/2f84e93c-dca6-4ca4-9319-c29eba5bbabb/info/gbr-info3.svg" target="_blank" rel="noopener noreferrer">silverstone — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/5/c/5cab1166-44c1-45ad-bc30-96d910170097/info/ger2-info.svg" target="_blank" rel="noopener noreferrer">sachsenring — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/c/e/ce2c750b-4a15-4285-966b-5db647e6596a/info/aus2-info.svg" target="_blank" rel="noopener noreferrer">phillip-island — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/8/1/811bb92b-cf2c-44ec-a188-b9681ba9fc12/info/cze2-info.svg" target="_blank" rel="noopener noreferrer">brno — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/e/e/eea725c5-432a-483b-bf46-f9769b8e5ddf/info/cat2-info.svg" target="_blank" rel="noopener noreferrer">catalunya — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/4/5/45f698f6-883b-4379-bac3-3253ee6e32e0/info/fra2-info.svg" target="_blank" rel="noopener noreferrer">bugatti — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/a/f/af57cc25-cf15-4f68-b775-ddaea8fec828/info/ita2-info.svg" target="_blank" rel="noopener noreferrer">mugello — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/4/2/42621ff3-ef5d-4c7c-8abf-eb54c16181bc/info/spa-i2nfo.svg" target="_blank" rel="noopener noreferrer">jerez — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/b/1/b1cd25b2-1658-4c3b-bd3f-1a7796f7cd27/info/qat-info2.svg" target="_blank" rel="noopener noreferrer">lusail — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/9/9/99cf40f3-6ed4-4cd9-9c1c-22379f6d929b/info/ara2-info.svg" target="_blank" rel="noopener noreferrer">aragon — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/0/7/07f44869-813e-46e6-97ba-aa405e134d87/info/mal-i2nfo.svg" target="_blank" rel="noopener noreferrer">sepang — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/7/9/795839a0-8faa-4f4e-a574-8dce32cfc560/info/v2al-info.svg" target="_blank" rel="noopener noreferrer">valencia — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/5/e/5eb8c6ce-f16b-4be5-8aea-39ebaa3b18ba/info/tha-inf2o.svg" target="_blank" rel="noopener noreferrer">chang — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/c/7/c7c0782e-67f2-4351-af96-6dd5835e8d42/info/usa-in2fo.svg" target="_blank" rel="noopener noreferrer">cota — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/4/6/46218937-1b94-4d2e-97b7-256b5bf181c3/info/hun2-fo.svg" target="_blank" rel="noopener noreferrer">balaton-park — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/2/c/2c30ee0c-d85b-48e1-b6d4-303a2ba22ae1/info/nld2-info.svg" target="_blank" rel="noopener noreferrer">assen — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/9/f/9fbd0109-0b0b-4bbb-a671-d7840036babe/info/jpn-info.svg" target="_blank" rel="noopener noreferrer">motegi — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/0/d/0db4e87a-920f-4699-a688-63e22b924f1b/info/ina2-info.svg" target="_blank" rel="noopener noreferrer">mandalika — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/0/b/0b5cf829-21cf-48dd-a324-1465fc504c24/info/por-info2.svg" target="_blank" rel="noopener noreferrer">portimao — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/5/0/50941f7f-e112-4404-8dcf-5fb2c47e9617/info/bra2-info.svg" target="_blank" rel="noopener noreferrer">goiania — MotoGP official vector</a></li><li><a href="https://photos.motogp.com/events-admin/5/3/53e027a4-908f-4253-9805-7321bd212fae/info/aut-info2.svg" target="_blank" rel="noopener noreferrer">spielberg-motogp — MotoGP official vector</a></li></ul><p>Motorcycle fallback: Magnific; badge: Roundicons Premium, from Flaticon under the attribution licence. Vector traced and cropped; original badge colours retained.</p></details><details class="asset-attribution"><summary>WRC artwork credits and modifications</summary><p><a href="https://rallyitaliasardegna.com/wp-content/uploads/2026/09/SS8-11.pdf" target="_blank" rel="noopener noreferrer">Rally Italia Sardegna / Automobile Club d’Italia — 2026 Lerno stage geometry</a>. One prominent stage shown with source-verified start and finish. Route simplified, rotated and uniformly scaled; transfers, labels and basemap removed. Original media rights remain with the organiser; no open licence asserted. <a href="https://github.com/ookamiinc/sporticon" target="_blank" rel="noopener noreferrer">Sporticon motorsport helmet</a> — white adaptation under <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache 2.0</a>. Unverified edition routes use the helmet fallback.</p></details><p class="asset-attribution wsl-attribution">Wave designed by <a href="https://www.flaticon.com/free-icon/wave_12863984" target="_blank" rel="noopener noreferrer">manshagraphics from Flaticon</a>. Vector traced, cropped and recoloured white. WSL mark: <a href="https://www.worldsurfleague.com/" target="_blank" rel="noopener noreferrer">World Surf League</a>, editorial identification; original rights retained.</p><p class="asset-attribution sailgp-attribution">SailGP marks: <a href="https://sailgp.com/" target="_blank" rel="noopener noreferrer">SailGP</a>, editorial identification; original rights retained. Sailing fallback by Nothing Sport. Unverified courses use this glyph.</p><p class="country-acknowledgement" data-brand-copy="countryAcknowledgement">Nothing Sport acknowledges the Yuin Nation, the Traditional Custodians of the land on which this app was built. Always was, always will be Aboriginal land. Voice. Treaty. Truth.</p></div></article>`;
  const about = body.querySelector(".settings-about-copy");
  const brand = globalThis.NOTHINGSPORTS_BRAND;
  const introduction = about.querySelector('[data-brand-section="about"]');
  for (const text of brand.about.split("\n\n")){
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    introduction.append(paragraph);
  }
  const ratings = document.createElement('details');
  ratings.className = 'asset-attribution';ratings.dataset.aboutSection = 'ratings';
  const ratingsTitle = document.createElement('summary');
  ratingsTitle.textContent = 'About Anticipation/Electricity/Impact ratings';ratings.append(ratingsTitle);
  for (const phase of ['heat','pulse','impact']){
    const copy = globalThis.NOTHINGSPORTS_EPIC.phaseCopy(phase), paragraph = document.createElement('p');
    const icon = document.createElement('span');icon.className = 'about-rating-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML = glyphMarkup(copy.glyph);
    const label = document.createElement('strong');label.textContent = copy.name + ' · ' + copy.detail + ': ';
    paragraph.append(icon,label,document.createTextNode(copy.tip));ratings.append(paragraph);
  }
  for (const text of [
    'NS fixture curators carry 8× weight in community scores. Contributor counts remain real people; points and rewards stay the same.',
    'Anticipation earns one point. A matching rating from another registered Nothinger during play or afterwards earns another 19 under the existing reward rules.',
    'Your own genuine 5/5 in any phase permanently saves the fixture to your EPIC Hall of Fame. Lowering that rating later does not remove it; you can remove or deliberately save a classic in Settings.'
  ]){const paragraph = document.createElement('p');paragraph.textContent = text;ratings.append(paragraph);}
  introduction.after(ratings);
  const support = document.createElement('details');support.className = 'asset-attribution';support.dataset.aboutSection = 'gambling-free';
  const supportTitle = document.createElement('summary');supportTitle.textContent = 'Gambling-free sport and support';
  const supportCopy = document.createElement('p');supportCopy.textContent = 'NS is deliberately a gambling-free space. Do not rely on NS information to assess bets or make financial decisions. Free, confidential support is available 24/7 through ';
  const supportLink = document.createElement('a');supportLink.textContent = 'Gambling Help Online';supportLink.href = 'https://www.gamblinghelponline.org.au/';supportLink.target = '_blank';supportLink.rel = 'noopener noreferrer';
  const supportPhone = document.createElement('a');supportPhone.textContent = '1800 858 858';supportPhone.href = 'tel:1800858858';
  supportCopy.append(supportLink,document.createTextNode(' or '),supportPhone);support.append(supportTitle,supportCopy);ratings.after(support);

  const charter = document.createElement("details");
  charter.className = "asset-attribution product-charter";
  charter.id = "product-charter";
  charter.dataset.aboutSection = "product-charter";
  const charterSummary = document.createElement("summary");
  charterSummary.textContent = brand.productCharter.title;
  const charterCopy = document.createElement("div");
  charterCopy.className = "product-charter-copy";
  const charterIntroduction = document.createElement("p");
  charterIntroduction.textContent = brand.productCharter.introduction;
  charterCopy.append(charterIntroduction);
  for (const commitment of brand.productCharter.commitments){
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = commitment.title;
    const paragraph = document.createElement("p");
    paragraph.textContent = commitment.body;
    section.append(heading, paragraph);
    charterCopy.append(section);
  }
  const coverage = document.createElement("p");
  coverage.textContent = brand.productCharter.coverage;
  charterCopy.append(coverage);
  charter.append(charterSummary, charterCopy);
  about.querySelector('[data-about-section="editorial-standards"]').after(charter);
  const acknowledgements=document.createElement('details');acknowledgements.className='about-acknowledgements';
  const summary=document.createElement('summary');summary.textContent='Acknowledgements';acknowledgements.append(summary);
  const credits=[...about.querySelectorAll('.asset-attribution')].filter(credit=>!credit.hasAttribute('data-about-section')&&!credit.hasAttribute('data-results-fine-print')&&credit.querySelector('summary')?.textContent!=='Editorial standards');
  const inherited=document.createElement('div');inherited.innerHTML="<p class=\"asset-attribution steak-attribution\"><a href=\"https://www.flaticon.com/free-icons/steak\" title=\"steak icons\" target=\"_blank\" rel=\"noopener noreferrer\">Steak icons created by meaicon - Flaticon</a></p><p class=\"asset-attribution venue-attribution\">Current MotoGP circuit vectors: <a href=\"https://www.motogp.com/en/calendar\" target=\"_blank\" rel=\"noopener noreferrer\">MotoGP official maps</a>; exact route paths, white presentation and cropped background. Original rights retained. Fallback and badge: <a href=\"https://www.flaticon.com/free-icon/motorbike_1768191\" target=\"_blank\" rel=\"noopener noreferrer\">Magnific</a>, <a href=\"https://www.flaticon.com/free-icon/world_14063354\" target=\"_blank\" rel=\"noopener noreferrer\">Roundicons Premium</a> \u2014 <a href=\"https://www.flaticon.com\" target=\"_blank\" rel=\"noopener noreferrer\">Flaticon</a>. </p><p class=\"asset-attribution wrc-attribution\">WRC route: <a href=\"https://rallyitaliasardegna.com/wp-content/uploads/2026/09/SS8-11.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Rally Italia Sardegna / ACI</a>. Fallback: Sporticon (Apache 2.0). Full credits in About.</p><p class=\"asset-attribution lemans-attribution\">Circuit de la Sarthe outline: <a href=\"https://www.fiawec.com/en/race/24-hours-of-le-mans-2027\" target=\"_blank\" rel=\"noopener noreferrer\">FIA WEC / ACO</a>, traced from the official centreline to transparent white SVG paths; background and legend removed. Complete Le Mans mark: <a href=\"https://www.24h-lemans.com/en/news/the-24-hours-of-le-mans-reveals-a-new-brand-identity-60525\" target=\"_blank\" rel=\"noopener noreferrer\">24 Hours of Le Mans / ACO</a>. Original rights and trademarks retained; editorial identification. Motorsport fallback by <a href=\"https://github.com/ookamiinc/sporticon\" target=\"_blank\" rel=\"noopener noreferrer\">ookami / Sporticon contributors</a> under Apache 2.0.</p><p class=\"asset-attribution dakar-attribution\">Rally raid glyph by <a href=\"https://www.flaticon.com/free-icon/off-road_2054939\" target=\"_blank\" rel=\"noopener noreferrer\">Freepik from Flaticon</a>, traced, cropped and recoloured white under the <a href=\"https://www.flaticon.com/media/license/license.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Flaticon attribution licence</a>. Edition routes and full Dakar mark: <a href=\"https://www.dakar.com/en/overall-route?iframe=true\" target=\"_blank\" rel=\"noopener noreferrer\">Dakar / ASO</a>; routes extracted from official edition maps, with backgrounds, labels and legends removed. Original rights and trademarks retained; editorial identification.</p><p class=\"asset-attribution golf-attribution\">Golf glyph by <a href=\"https://www.flaticon.com/free-icon/golf_5147640\" target=\"_blank\" rel=\"noopener noreferrer\">Plastic Donut from Flaticon</a>, vector traced, cropped and recoloured white under the <a href=\"https://www.flaticon.com/media/license/license.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Flaticon attribution licence</a>. Aronimink fairway layout adapted from the <a href=\"https://pgachampionship.brightspotcdn.com/14/91/0989bdc24837a8cc1c33c7b1fe29/26-ch-course-map-spectator-guide-1.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">PGA of America\u2019s 2026 spectator map</a>; background, amenities and practice areas removed, fairways simplified. Marks: <a href=\"https://commons.wikimedia.org/wiki/File:Masters_Tournament.svg\" target=\"_blank\" rel=\"noopener noreferrer\">The Masters / Wikimedia Commons</a>, <a href=\"https://www.pgachampionship.com/tickets\" target=\"_blank\" rel=\"noopener noreferrer\">PGA of America</a>, and <a href=\"https://www.theopen.com/st-andrews-2027\" target=\"_blank\" rel=\"noopener noreferrer\">The R&amp;A</a>. Original rights and trademarks retained; editorial identification. Unverified championship layouts use the golf glyph.</p><p class=\"asset-attribution cycling-attribution\">Bicycle designed by <a href=\"https://www.flaticon.com/free-icon/bicycle_131684\" target=\"_blank\" rel=\"noopener noreferrer\">Baianat from Flaticon</a>, vector traced and recoloured white. Grand Tour marks and simplified route artwork: <a href=\"https://www.letour.fr/en/overall-route\" target=\"_blank\" rel=\"noopener noreferrer\">ASO / Tour de France</a>, <a href=\"https://www.giroditalia.it/en/the-route/\" target=\"_blank\" rel=\"noopener noreferrer\">RCS Sport / Giro d\u2019Italia</a> and <a href=\"https://www.lavuelta.es/en/overall-route\" target=\"_blank\" rel=\"noopener noreferrer\">ASO / Unipublic / La Vuelta</a>, with organiser-linked ArcGIS and Komoot geometry. Original rights retained; editorial identification.</p><p class=\"asset-attribution wsl-attribution\">Wave designed by <a href=\"https://www.flaticon.com/free-icon/wave_12863984\" target=\"_blank\" rel=\"noopener noreferrer\">manshagraphics from Flaticon</a>. Vector traced, cropped and recoloured white. WSL mark: <a href=\"https://www.worldsurfleague.com/\" target=\"_blank\" rel=\"noopener noreferrer\">World Surf League</a>, editorial identification; original rights retained.</p><p class=\"asset-attribution sailgp-attribution\">SailGP marks: <a href=\"https://sailgp.com/\" target=\"_blank\" rel=\"noopener noreferrer\">SailGP</a>, editorial identification; original rights retained. Sailing fallback by Nothing Sport. Unverified courses use this glyph.</p>";
  const groups=new Map(),seen=new Set();
  for(const credit of [...credits,...inherited.children]){
    const signature=credit.textContent.trim()+[...credit.querySelectorAll('a')].map(a=>a.href).join('|');if(seen.has(signature)){credit.remove();continue;}seen.add(signature);
    const category=[...credit.classList].find(name=>name.endsWith('-attribution')&&name!=='asset-attribution'),heading=credit.querySelector('summary')?.textContent||'';
    const label=({steak:'Ratings artwork',venue:'MotoGP',wrc:'WRC',cycling:'Cycling',lemans:'Le Mans',dakar:'Dakar',golf:'Golf',wsl:'Surfing',sailgp:'SailGP'})[category?.replace('-attribution','')]||(/MotoGP/.test(heading)?'MotoGP':/WRC/.test(heading)?'WRC':/SailGP/.test(heading)?'SailGP':'General artwork');
    let group=groups.get(label);if(!group){group=document.createElement('details');const title=document.createElement('summary');title.textContent=label;group.append(title);groups.set(label,group);acknowledgements.append(group);}group.append(credit);
  }
  about.append(acknowledgements);
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
  body.innerHTML = `${wizardProgressMarkup()}<section class="filter-panel"><h3>What are you into?</h3><p class="preference-help">Choose your sports, then your teams. No account needed.</p><div class="setup-choice-grid" id="startupSportsGrid"></div><p class="preference-help" role="status">Your choices stay on this device. Account sync is separate.</p></section>`;
  const grid = body.querySelector('#startupSportsGrid');
  for (const record of FOLLOW_FIRST.STARTUP_SPORTS){
    const label = document.createElement('label'); label.className = 'setup-choice';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = meta.sports.includes(record.id);
    input.onchange = () => {
      const sports = new Set(startupMetaDraft().sports);
      if (input.checked) sports.add(record.id); else sports.delete(record.id);
      if (!sports.size){ input.checked = true; showToast('Choose at least one sport.'); return; }
      applyStartupMetaDraft({sports:[...sports]});
      if (settingsFirstRun) persistOnboardingDraft();
    };
    label.append(input, document.createTextNode(record.label)); grid.append(label);
  }
}

function renderCreateAccountSettings(body){
  const anchor = settingsViewportAnchor, life = serverSyncClient.accountSnapshot();
  const current = () => body.isConnected && form.isConnected && settingsSection === 'create-account' && settingsViewportAnchor === anchor
    && serverSyncClient.accountSnapshot().generation === life.generation
    && serverSyncClient.accountSnapshot().accountId === life.accountId;
  body.innerHTML = `<form class="account-sync-form" id="createAccountForm"><label class="field-label">Email<input name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" required></label><label class="field-label">Password<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="1024" required></label><p class="preference-help">Your Feed and choices remain available on this device while you confirm your email. Confirmation protects actions such as rating and chat. Creating an account does not subscribe you to marketing.</p><button class="btn primary" type="submit">Create account</button><p class="preference-help" role="status" aria-live="polite"></p><button class="btn ghost" type="button" id="continueGuestFeed">Continue to Feed</button><button class="btn ghost" type="button" id="returnAccountSignIn">Back to sign in</button></form>`;
  const form = body.querySelector('form'), submit = form.querySelector('[type=submit]'), status = form.querySelector('[role=status]');
  const feed = () => { closeSettings({restoreViewport:false}); activateTopLevelTab('feed'); };
  body.querySelector('#continueGuestFeed').onclick = feed;
  body.querySelector('#returnAccountSignIn').onclick = () => { settingsSection = 'account'; renderSettingsScreen(); };
  const differentEmail=document.createElement('button');differentEmail.type='button';differentEmail.className='btn ghost';differentEmail.textContent='Use a different email';differentEmail.hidden=true;
  differentEmail.onclick=()=>{
    if(!current())return;
    form.elements.email.value='';form.elements.password.value='';submit.disabled=false;differentEmail.hidden=true;
    status.textContent='Enter the email you want to use, then create an account with that address. This does not change the earlier signup request. Your device choices are kept.';
    form.elements.email.focus();
  };
  form.append(differentEmail);
  form.onsubmit = async event => {
    event.preventDefault();
    if (!current()){
      if(body.isConnected&&form.isConnected&&settingsSection==='create-account'&&settingsViewportAnchor===anchor)status.textContent='Your sign-in changed. Open Account before continuing. Your device choices are kept.';
      return;
    }
    if(submit.disabled)return;
    submit.disabled = true;
    let authTransition;
    try{authTransition=await preserveDeviceChoicesBeforeAuth({currentView:current});}catch(error){status.textContent=error.message||'Your device choices could not be preserved. Account creation has not started.';submit.disabled=false;return;}
    if(!current())return;
    let authRequest;try{authRequest=beginAccountAuthRequest(authTransition);}catch(error){status.textContent=error.message;submit.disabled=false;return;}
    status.textContent = 'Creating your account…';
    try{
      const result = await serverSyncClient.signUp(form.elements.email.value.trim(),form.elements.password.value,startupMetaDraft(),{isCurrent:()=>accountAuthCaptureCurrent(authTransition),isCurrentWithoutSession:()=>accountSignupWithoutSessionCaptureCurrent(authTransition)});
      form.elements.password.value = '';
      let noSessionLocalNote='';
      if(!result.session){
        try{await retainConfirmationOnlySignup(authTransition);}
        catch(error){noSessionLocalNote=' '+(error.message||'The local handoff still needs review in Account; your device choices are kept.');}
      }
      // A session transition has its own owner/generation; do not reuse the
      // pre-signup guest lifetime to write account preferences.
      if (!body.isConnected || !form.isConnected || settingsSection !== 'create-account' || settingsViewportAnchor !== anchor) return;
      if (result.session){
        const signedUp = result.accountSnapshot, active = serverSyncClient.accountSnapshot();
        if (!result.user?.id || !signedUp || signedUp.accountId !== result.user.id
            || active.accountId !== signedUp.accountId || active.generation !== signedUp.generation){
          status.textContent = 'Your sign-in changed. Open Account to check the current account. Your device choices are kept.';
          return;
        }
        rememberAccountAuthTransition(authTransition,{currentView:()=>body.isConnected&&form.isConnected&&settingsSection==='create-account'&&settingsViewportAnchor===anchor});
        await bootstrapServerPersistence({authTransitionId:authTransition.id});
        if (!body.isConnected || !form.isConnected || settingsSection !== 'create-account' || settingsViewportAnchor !== anchor) return;
        const afterLoad=serverSyncClient.accountSnapshot();
        if(afterLoad.accountId!==signedUp.accountId||afterLoad.generation!==signedUp.generation){
          status.textContent=afterLoad.hasSession
            ?'The account request was accepted, but your sign-in changed. Open Account to check the current account. Your device choices are kept.'
            :'The account request was accepted, but this app is now signed out. Your device choices are kept. Sign in from Account or continue to Feed.';
          submit.textContent='Account request accepted';
          body.querySelector('#returnAccountSignIn').textContent=afterLoad.hasSession?'Open Account':'Sign in from Account';
          return;
        }
        status.textContent = 'Account created. Open Account & sync to check whether your choices have reached your account.';
        body.querySelector('#returnAccountSignIn').textContent='Review choices in Account';
      }else{
        if(!current())return;
        status.textContent = 'Signup request accepted. Check your inbox, then sign in. You can keep browsing indefinitely and changing your choices on this device.'+noSessionLocalNote;
        differentEmail.hidden=false;
      }
    }catch(error){
      if (!current()) return;
      status.textContent = error.message || 'Account creation could not be confirmed. Your choices are kept. Try again.'; submit.disabled = false;
    }finally{endAccountAuthRequest(authRequest);}
  };
}

async function renderOnboardingTeams(body){
  const draft = draftPreferences, anchor = settingsViewportAnchor, life = serverSyncClient.accountSnapshot();
  const current = () => body.isConnected && settingsFirstRun && settingsSection === 'teams'
    && draftPreferences === draft && settingsViewportAnchor === anchor
    && serverSyncClient.accountSnapshot().generation === life.generation
    && serverSyncClient.accountSnapshot().accountId === life.accountId;
  const sports = FOLLOW_FIRST.STARTUP_SPORTS.filter(sport => startupMetaDraft().sports.includes(sport.id));
  body.innerHTML = `${wizardProgressMarkup()}<section class="filter-panel"><h3>Choose your teams</h3><p class="preference-help">Follow teams to bring their fixtures into Feed. You can continue without choosing a team and explore schedules in Follow.</p><div class="setup-choice-grid" id="onboardingSportChoices"></div><div id="onboardingTeamChoices" aria-live="polite"></div></section>`;
  const sportChoices = body.querySelector('#onboardingSportChoices'), choices = body.querySelector('#onboardingTeamChoices');
  let request = 0;
  async function chooseSport(sport){
    const turn = ++request;
    sportChoices.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.sport === sport.id)));
    choices.textContent = `Loading ${sport.label} teams…`; choices.setAttribute('aria-busy','true');
    try{
      const chunk = await loadFollowDirectoryChunk(sport.id);
      if (!current() || request !== turn) return;
      choices.replaceChildren(); choices.setAttribute('aria-busy','false');
      const gender = directoryFilters(sport.id).genderCategory;
      const recognisedTeam = record => (record.entityType === 'team' || record.type === 'team' || record.type === 'nationalSide' || record.id?.startsWith('team:')) && !NOTHINGSPORTS_PARTICIPANT_DIRECTORY.isUnresolvedTeam(record);
      const records = (chunk.records || []).filter(record => [gender,'unknown','mixed'].includes(record.genderCategory || 'unknown'));
      const teams = records.filter(recognisedTeam);
      const teamless = chunk.status === 'available' && !(chunk.records || []).some(recognisedTeam);
      const available = teams.length ? teams : teamless && !sport.id.startsWith('cricket') ? records.filter(record => record.entityType === 'athlete') : [];
      const note = document.createElement('p'); note.className = 'preference-help';
      note.textContent = teams.length ? sport.label : available.length ? `${sport.label} has individual competitors. Choose the people you follow, or continue to Feed.` : 'No supported teams are available here yet. Continue to Feed and use Follow to explore the published schedule.';
      choices.append(note);
      const searchLabel = document.createElement('label'); searchLabel.className = 'field-label'; searchLabel.textContent = 'Search';
      const search = document.createElement('input'); search.type = 'search'; search.placeholder = teams.length ? 'Team name' : 'Competitor name'; searchLabel.append(search);
      const list = document.createElement('div'); list.className = 'setup-choice-grid'; choices.append(searchLabel,list);
      let limit = 40;
      const more = document.createElement('button'); more.type = 'button'; more.className = 'btn ghost'; more.textContent = 'Show more'; choices.append(more);
      function render(){
        list.replaceChildren();
        const filtered = available.filter(record => String(record.displayName || record.canonicalName || record.name || '').toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
        for (const record of filtered.slice(0,limit)){
          const label = document.createElement('label'); label.className = 'setup-choice';
          const input = document.createElement('input'); input.type = 'checkbox';
          input.checked = ['follow','priority'].includes(draft.preferenceGraph?.entityFollows?.find(follow => follow.participantId === record.id)?.followLevel);
          input.onchange = () => {
            if (!current()){ input.checked = !input.checked; return; }
            const previous = clonePreferences(draft.preferenceGraph);
            draft.preferenceGraph = PREFERENCE_SYSTEM.setEntityFollow(draft.preferenceGraph,record.id,input.checked ? 'follow' : 'unfollow');
            if (!persistOnboardingDraft()){ draft.preferenceGraph = previous; input.checked = !input.checked; }
          };
          label.append(input,document.createTextNode(record.displayName || record.canonicalName || record.name)); list.append(label);
        }
        more.hidden = filtered.length <= limit;
        if (!filtered.length){ const empty = document.createElement('p'); empty.textContent = 'No matches. Try another search or continue.'; list.append(empty); }
      }
      search.oninput = () => { limit = 40; render(); };
      more.onclick = () => { limit += 40; render(); };
      render();
    }catch(error){
      if (!current() || request !== turn) return;
      choices.textContent = 'Teams could not load. Your choices are kept; retry or continue to Feed.'; choices.setAttribute('aria-busy','false');
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn ghost'; retry.textContent = 'Retry'; retry.onclick = () => void chooseSport(sport); choices.append(retry);
    }
  }
  for (const sport of sports){
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn ghost'; button.textContent = sport.label; button.dataset.sport = sport.id;
    button.onclick = () => void chooseSport(sport); sportChoices.append(button);
  }
  if (sports[0]) await chooseSport(sports[0]);
}

globalThis.notificationDiagnosticsCommand = async function(action, extra = {}){
  const credentials = readStorage(PUSH_INSTALLATION_STORAGE_KEY, null);
  if (!credentials?.installationId || !credentials?.secret) throw new Error("Enable system alerts on this device first.");
  const authenticated = Boolean(serverSyncClient.getSession?.());
  if (["status","test","milestone-test"].includes(action)) return serverSyncClient.notificationCommand({ action, ...credentials, ...extra }, { authenticated });
  throw new Error("Unknown notification diagnostic action.");
};

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
      <label class="viewing-toggle"><input type="checkbox" id="liveRatingsEnabled" ${preferences.liveRatingsEnabled !== false ? "checked" : ""}><span><strong>Ratings and Impact requests</strong>5/5 ratings from people I follow, plus requests to rate Impact after high-stakes fixtures finish. At most one immediate Impact request a day, with the rest in a 10 am digest.</span></label>
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
  const milestoneHost=document.createElement('div');body.querySelector('.preference-stack').append(milestoneHost);
  void loadDeferredScript('assets/js/milestone-alerts-ui.js?v=535').then(()=>NOTHINGSPORTS_MILESTONE_UI.settings(milestoneHost,draftPreferences)).catch(()=>{if(milestoneHost.isConnected)milestoneHost.textContent='Milestone settings unavailable. Try again.';});
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

globalThis.NOTHINGSPORTS_FANTASY_UI={renderCreateAccountSettings,renderOnboardingTeams,renderNotificationSettings,createController,renderStartupSettings:renderStartupMetadataSettings,renderAboutSettings,renderAppearanceSettings,renderSubscriptionSettings,renderLocationSettings,renderSettings:renderFantasySettings,install:installFantasyCard,clearSpace:clearFantasyPlaceholderSpace,save:saveFantasySetting};
for(const card of document.querySelectorAll('.feed-card-slot .event-card')){const ev=profileFixtureEvents.get(card.dataset.eventId);if(ev)installFantasyCard(card,ev,{});}
globalThis.fantasyDeadlineController.sync();
})();
