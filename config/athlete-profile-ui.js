(function attachAthleteProfileUi(root){
  "use strict";

  const CONFIG = Object.freeze({
    manifestUrl:"data/athlete-profiles/manifest.v1.json",
    manifestScriptUrl:"data/athlete-profiles/manifest.v1.js",
  });
  let manifest = null;
  let manifestLoading = null;
  const chunks = new Map();
  const chunkLoading = new Map();

  const style = document.createElement("style");
  style.textContent = `
.profile-context-table{width:100%;border-collapse:collapse;font-size:.75rem;}.profile-context-table th,.profile-context-table td{padding:7px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap;}
.profile-standings-table{table-layout:fixed}.profile-standings-table th,.profile-standings-table td{white-space:normal;overflow-wrap:anywhere;padding:7px 4px}.profile-standings-table th:not(:nth-child(2)){width:18%}

.athlete-profile-trigger{border:0;background:transparent;color:inherit;padding:0;text-align:left;cursor:pointer}.athlete-profile-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}.athlete-headshot{width:38px;height:38px;flex:0 0 38px;border-radius:50%;object-fit:cover;object-position:50% 18%;background:var(--panel);box-shadow:0 0 0 1px var(--border)}.athlete-number{display:inline-grid;place-items:center;min-width:28px;height:24px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--sport-color,var(--accent)) 17%,var(--panel));color:var(--text);font-size:.66rem;font-weight:900}
.athlete-profile-backdrop{position:fixed;inset:0;z-index:10040;display:flex;justify-content:flex-end;background:rgba(0,0,0,.54)}
.athlete-profile-drawer{width:min(100%,560px);height:100%;overflow:auto;padding:calc(18px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom));background:var(--bg-card);color:var(--text);box-shadow:-18px 0 50px rgba(0,0,0,.28)}
.athlete-profile-close{float:right;width:44px;height:44px;border:1px solid var(--border);border-radius:50%;background:var(--panel);color:var(--text);font-size:1.2rem;cursor:pointer}
.athlete-profile-hero{display:grid;grid-template-columns:92px minmax(0,1fr);align-items:center;gap:16px;clear:both;padding:12px 0 20px}.athlete-profile-hero .athlete-headshot{width:92px;height:92px}.athlete-profile-hero h2{margin:0;font-size:1.45rem}.athlete-profile-hero p,.athlete-profile-body p{margin:5px 0 0;color:var(--text-dim);font-size:.76rem;line-height:1.55}
.athlete-profile-section{padding:16px 0;border-top:1px solid var(--border)}.athlete-profile-section h3{margin:0 0 10px;font-size:.84rem}.athlete-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.athlete-stat{padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--panel)}.athlete-stat span{display:block;color:var(--text-dim);font-size:.64rem}.athlete-stat strong{display:block;margin-top:3px;font-size:.82rem}.athlete-recent{display:grid;gap:7px}.athlete-recent-row{padding:9px 10px;border:1px solid var(--border);border-radius:8px;font-size:.7rem;line-height:1.45}.athlete-source-links{display:flex;flex-wrap:wrap;gap:8px}.athlete-source-links a{color:var(--accent);font-size:.7rem;font-weight:800}
@media(max-width:640px){.athlete-profile-drawer{width:100%}}
`;
  document.head.appendChild(style);

  function loadScript(url){
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      const timer = setTimeout(() => { script.remove(); reject(new Error(`Timed out loading ${url}`)); }, 12000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error(`Unable to load ${url}`)); };
      document.head.appendChild(script);
    });
  }

  async function fetchJson(url,{timeoutMs=12000}={}){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try{
      const response = await fetch(url, { cache:"no-cache", signal:controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function loadManifest(){
    if (manifest) return manifest;
    if (!manifestLoading){
      manifestLoading = (async () => {
        let next;
        if (root.location?.protocol === "file:"){
          await loadScript(CONFIG.manifestScriptUrl);
          next = root.NOTHINGSPORTS_ATHLETE_PROFILE_MANIFEST;
        } else {
          try { next = await fetchJson(CONFIG.manifestUrl); }
          catch (_error){
            await loadScript(CONFIG.manifestScriptUrl);
            next = root.NOTHINGSPORTS_ATHLETE_PROFILE_MANIFEST;
          }
        }
        if (next?.schemaVersion !== "athlete-profile-manifest.v1") throw new Error("Athlete profile manifest was unavailable");
        manifest = next;
        return next;
      })().finally(() => { manifestLoading = null; });
    }
    return manifestLoading;
  }

  async function loadProfile(profileRef, sportKey){
    if (!profileRef) return null;
    const index = await loadManifest();
    const sport = index.sports.find(item => item.key === sportKey && item.profileIds.includes(profileRef));
    if (!sport) return null;
    if (!chunks.has(sportKey)){
      if (!chunkLoading.has(sportKey)){
        chunkLoading.set(sportKey, (async () => {
          let chunk;
          if (root.location?.protocol === "file:"){
            await loadScript(sport.scriptUrl);
            chunk = root.NOTHINGSPORTS_ATHLETE_PROFILE_CHUNKS?.[sportKey];
          } else {
            try { chunk = await fetchJson(sport.jsonUrl); }
            catch (_error){
              await loadScript(sport.scriptUrl);
              chunk = root.NOTHINGSPORTS_ATHLETE_PROFILE_CHUNKS?.[sportKey];
            }
          }
          if (chunk?.schemaVersion !== "athlete-profile-chunk.v1") throw new Error("Athlete profile chunk was invalid");
          chunks.set(sportKey, chunk);
          return chunk;
        })().finally(() => chunkLoading.delete(sportKey)));
      }
      await chunkLoading.get(sportKey);
    }
    return chunks.get(sportKey)?.profiles.find(profile => profile.id === profileRef) || null;
  }

  function statGrid(rows){
    const grid = document.createElement("div");
    grid.className = "athlete-stat-grid";
    (rows || []).forEach(row => {
      const item = document.createElement("div"); item.className = "athlete-stat";
      const label = document.createElement("span"); label.textContent = row.label;
      const value = document.createElement("strong"); value.textContent = String(row.value);
      item.append(label, value); grid.appendChild(item);
    });
    return grid;
  }

  function decorateIdentity(identity, record, sportKey){
    const portraitUrl = record.headshotUrl || record.photoURL;
    if (portraitUrl){
      const portrait = document.createElement("img");
      portrait.className = "athlete-headshot"; portrait.src = portraitUrl; portrait.alt = ""; portrait.loading = "lazy"; portrait.decoding = "async";
      portrait.addEventListener("error", () => portrait.remove(), { once:true }); identity.prepend(portrait);
    }
    const number = Number(record.competitionNumber ?? record.jumperNumber);
    if (["afl", "aflw"].includes(sportKey)){
      const badge = document.createElement("b"); badge.className = "athlete-number"; badge.textContent = number > 0 ? `#${number}` : "No. TBC"; identity.appendChild(badge);
    }
    if (record.profileRef){
      makeTrigger(identity, record, sportKey);
    }
  }

  function makeTrigger(target, record, sportKey){
    if (target.dataset.athleteProfileBound === record.profileRef) return;
    target.dataset.athleteProfileBound = record.profileRef;
    target.classList.add("athlete-profile-trigger"); target.tabIndex = 0; target.setAttribute("role", "button"); target.setAttribute("aria-label", `Open ${record.displayName} profile`);
    target.addEventListener("click", event => {event.stopPropagation();void open(record, sportKey, target);});
    target.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " "){ event.preventDefault();event.stopPropagation(); void open(record, sportKey, target); } });
  }

const profileStandingsChunks=new Map();
async function appendProfileFixtureContext(container,record,sportKey,fixture){
  const table=(columns,rows,label)=>{const wrap=document.createElement('div');wrap.style.overflowX='auto';const t=document.createElement('table');t.className='profile-context-table';if(label)t.setAttribute('aria-label',label);const head=document.createElement('tr');columns.forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);});const thead=document.createElement('thead');thead.append(head);t.append(thead);rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(value=>{const td=document.createElement('td');td.textContent=String(value??'—');tr.append(td);});t.append(tr);});wrap.append(t);return wrap;};
  const retainSectionFocus=(section,heading,hadFocus=section.contains(document.activeElement))=>{if(hadFocus){heading.tabIndex=-1;heading.focus({preventScroll:true});}};
  if(fixture){
    const section=document.createElement('section');section.className='athlete-profile-section';const heading=document.createElement('h3');heading.textContent=`Fixture results · ${spoilerSafeDisplayTitle(fixture)||fixture.name}`;section.append(heading);
    const show=()=>{const result=fixture.fixtureResults;if(result?.rows?.length)section.append(table(result.columns,result.rows,heading.textContent));else{const p=document.createElement('p');p.textContent=[fixture.scoreDisplay,fixture.result?.scorelineText,fixture.result,fixture.outcomeText,fixture.score?.display,fixture.score].find(value=>typeof value==='string'&&value.trim())||'Full results are not published yet.';section.append(p);}if(fixture.fixtureResults?.sourceUrl){const a=document.createElement('a');a.href=fixture.fixtureResults.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Official full results';section.append(a);}};
    if(userPreferences.showSpoilers)show();else{const reveal=document.createElement('button');reveal.type='button';reveal.className='btn ghost';reveal.textContent='Show fixture results';reveal.onclick=()=>{retainSectionFocus(section,heading);reveal.remove();show();};section.append(reveal);}container.append(section);
  }
  const section=document.createElement('section');section.className='athlete-profile-section';const heading=document.createElement('h3');heading.textContent='Ladder / standings';const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');section.append(heading,status);container.append(section);
  const showStandings=async()=>{
    const hadFocus=section.contains(document.activeElement);status.textContent='Loading standings…';section.replaceChildren(heading,status);retainSectionFocus(section,heading,hadFocus);
    try{
      const manifest=await loadCodeInspectorManifest();
      const codeId=fixture&&typeof root.codeIdForEvent==='function'?root.codeIdForEvent(fixture):`sport:${sportKey}`;
      const code=(manifest?.codes||codeInspectorManifest?.codes||[]).find(c=>c.id===codeId||c.slug===sportKey);
      if(!code){status.textContent='Standings are not published for this competition yet.';return;}
      if(!profileStandingsChunks.has(code.id))profileStandingsChunks.set(code.id,fetchJson(code.chunkPath).catch(error=>{profileStandingsChunks.delete(code.id);throw error;}));
      const chunk=await profileStandingsChunks.get(code.id);if(!section.isConnected)return;
      const all=chunk.standings||[];
      const relevant=new Set(fixture?.competitionId?[fixture.competitionId]:all.filter(row=>[record.id,record.currentTeamId].includes(row.participantId)).map(row=>row.competitionId));
      const standings=all.filter(row=>relevant.has(row.competitionId));
      status.textContent=standings.length?'Standings loaded.':'Standings are not published for this competition yet.';
      for(const competition of new Set(standings.map(e=>e.competitionId))){
        const rows=standings.filter(e=>e.competitionId===competition),first=rows[0];
        const label=document.createElement('p');label.textContent=[first.competitionName||competition?.replace(/^competition:/,'').replaceAll('-',' '),first.roundLabel,first.asOf?'As of '+new Date(first.asOf).toLocaleDateString('en-AU'):''].filter(Boolean).join(' · ');
        const standingsTable=table(['Pos','Team / athlete','Points','Played'],rows.map(e=>[root.NOTHINGSPORTS_FEED_CARD_PRESENTATION.standingPosition(e),e.displayName,e.points??e.ladderPoints,e.played]),label.textContent);
        standingsTable.firstChild.classList.add('profile-standings-table');section.append(label,standingsTable);
        if(first.tableNote){const note=document.createElement('p');note.textContent=first.tableNote;section.append(note);}
        if(/^https:\/\//i.test(first.sourceUrl||'')){const source=document.createElement('a');source.href=first.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Standings source';section.append(source);}
      }
    }catch(error){status.textContent='Standings unavailable. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry standings';retry.onclick=showStandings;status.append(retry);}
  };
  if(userPreferences.showSpoilers)void showStandings();
  else{
    status.textContent='Standings hidden while Results is off.';
    const reveal=document.createElement('button');reveal.type='button';reveal.className='btn ghost';reveal.textContent='Show profile standings';
    reveal.onclick=()=>void showStandings();section.append(reveal);
  }
}

  async function open(record, sportKey, trigger, options={}){
    if(!options.teamProfile && /^(athlete|competitor|player):/.test(record.id) && globalThis.openAthleteProfile)return globalThis.openAthleteProfile(record.id,record.displayName,sportKey,trigger);
    document.querySelector(".athlete-profile-backdrop")?.remove();
    const backdrop = document.createElement("div"); backdrop.className = "athlete-profile-backdrop";
    const drawer = document.createElement("aside"); drawer.className = "athlete-profile-drawer"; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-label", `${record.displayName} athlete profile`);
    const close = document.createElement("button"); close.type = "button"; close.className = "athlete-profile-close"; close.setAttribute("aria-label", "Close athlete profile"); close.textContent = "×";
    const body = document.createElement("div"); body.className = "athlete-profile-body"; body.innerHTML = "<p>Loading official profile…</p>";
    drawer.append(close);
    if(!record.profileOnly&&typeof root.buildDirectoryFollowButton==='function')drawer.append(root.buildDirectoryFollowButton(record.id,{sportKey,label:record.displayName}));
    drawer.append(body);const context=document.createElement('div');drawer.append(context);void appendProfileFixtureContext(context,record,sportKey,options.fixture); backdrop.appendChild(drawer); document.body.appendChild(backdrop);
    const historyToken=options.fixture?`profile:${record.id}:${Date.now()}`:null,originUrl=location.href;
    if(historyToken)history.pushState({...history.state,fixtureProfile:historyToken},'');
    const cleanup=()=>{if(!backdrop.isConnected)return;backdrop.remove();options.onClose?.();if(trigger?.isConnected)trigger.focus?.({preventScroll:true});document.removeEventListener('keydown',onKey);window.removeEventListener('popstate',onBack,true);};
    const onBack=event=>{if(history.state?.fixtureProfile!==historyToken){if(location.href===originUrl)event.stopImmediatePropagation();cleanup();}};
    if(historyToken)window.addEventListener('popstate',onBack,true);
    const dismiss=()=>{if(historyToken&&history.state?.fixtureProfile===historyToken)history.back();else cleanup();};
    const onKey = event => {
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();return;}
      if(event.key!=='Tab')return;
      const controls=[...drawer.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);
      const first=controls[0]||close,last=controls[controls.length-1]||close;
      if(event.shiftKey&&(!drawer.contains(document.activeElement)||document.activeElement===first)){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(!drawer.contains(document.activeElement)||document.activeElement===last)){event.preventDefault();first.focus();}
    };
    close.addEventListener("click", dismiss); backdrop.addEventListener("click", event => { if (event.target === backdrop) dismiss(); }); document.addEventListener("keydown", onKey); close.focus();
    await populateProfile(body,record,sportKey,()=>backdrop.isConnected);
  }

  async function populateProfile(body,record,sportKey,valid=()=>body.isConnected){
    try{
      let profile = record.profileOnly ? {...record,sourceUrl:record.sourceRefs?.[0]} : await loadProfile(record.profileRef, sportKey);
      let cross;
      try{
        if(!globalThis.NOTHINGSPORTS_ATHLETE_PARTICIPATION)await loadScript('data/canonical/athlete-participation.v1.js');
        cross=globalThis.NOTHINGSPORTS_ATHLETE_PARTICIPATION?.athletes.find(athlete=>athlete.id===record.id);
      }catch(error){/* Optional experience must not remove the existing athlete profile. */}
      if(root.location?.protocol!=='file:')try{
        const live=await fetchJson(`/api/fixtures?athlete=${encodeURIComponent(record.id)}`,{timeoutMs:2500});
        if(live.schemaVersion==='athlete-participation-live.v1'&&live.history?.length)cross={...record,...cross,history:[...new Map([...(cross?.history||[]),...live.history].map(item=>[item.eventId||`${item.date}|${item.sourceUrl}`,item])).values()]};
      }catch(_error){/* Retain published history when live discovery is unavailable. */}
      if(!profile&&cross)profile={...record,biography:'Source-backed athlete history. Current season statistics are not published for this profile.'};
      if(!valid())return;
      if (!profile){
        body.innerHTML = `<div class="athlete-profile-hero"><div></div><div><h2></h2><p>Detailed profile information is not currently available. Published fixtures appear below when verified.</p></div></div>`;
        body.querySelector("h2").textContent = record.displayName;
        return;
      }
      if(!valid())return;
      body.replaceChildren();
      const hero = document.createElement("div"); hero.className = "athlete-profile-hero";
      const image = document.createElement("img"); image.className = "athlete-headshot"; image.alt = `${profile.displayName} portrait`; image.src = profile.headshotUrl || record.headshotUrl || ""; image.addEventListener("error", () => image.remove(), { once:true });
      const titleWrap = document.createElement("div"), title = document.createElement("h2"), sub = document.createElement("p"); title.textContent = profile.displayName; sub.textContent = `${profile.teamName || "Athlete"}${profile.competitionNumber ? ` · No. ${profile.competitionNumber}` : ""}${userPreferences.showSpoilers&&profile.selection?.topTen ? ` · Top 10 #${profile.selection.rank}` : ""}`;
      titleWrap.append(title, sub); hero.append(image, titleWrap); body.appendChild(hero);
      const bio = document.createElement("section"); bio.className = "athlete-profile-section"; bio.innerHTML = "<h3>Biography</h3>"; const bioText = document.createElement("p"); bioText.textContent = profile.biography; bio.appendChild(bioText); if(userPreferences.showSpoilers||profile.biographySpoilerSafe===true)body.appendChild(bio);
      if(userPreferences.showSpoilers&&cross?.history.length){
        const section=document.createElement('section');section.className='athlete-profile-section';
        const heading=document.createElement('h3');heading.textContent='Other disciplines & experience';section.appendChild(heading);
        for(const item of cross.history){
          const row=document.createElement('p');row.textContent=`${item.date} · ${item.discipline} · ${item.kind==='test'?'Test / experience':item.kind==='match'?'Match':'Race'} — ${item.description} `;
          const link=document.createElement('a');link.textContent='Source';link.href=item.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';row.appendChild(link);section.appendChild(row);
        }
        body.appendChild(section);
      }
      (userPreferences.showSpoilers ? [["Key facts", profile.keyFacts], ["2026 season", profile.seasonStats], ["Career", profile.careerStats]] : []).forEach(([heading, rows]) => {
        if (!rows?.length) return; const section = document.createElement("section"); section.className = "athlete-profile-section"; const h = document.createElement("h3"); h.textContent = heading; section.append(h, statGrid(rows)); body.appendChild(section);
      });
      if (userPreferences.showSpoilers && profile.recentFive?.length){
        const section = document.createElement("section"); section.className = "athlete-profile-section"; section.innerHTML = "<h3>Recent form</h3>"; const list = document.createElement("div"); list.className = "athlete-recent";
        profile.recentFive.forEach(item => { const row = document.createElement("div"); row.className = "athlete-recent-row"; row.textContent = `${item.label || "Match"}${item.opponent ? ` · v ${item.opponent}` : ""}${item.result ? ` · ${item.result}` : ""}${item.stats?.length ? ` · ${item.stats.map(stat => `${stat.label} ${stat.value}`).join(" · ")}` : ""}`; list.appendChild(row); });
        section.appendChild(list); body.appendChild(section);
      }
      if (profile.sourceLinks?.length){
        const section = document.createElement("section"); section.className = "athlete-profile-section"; section.innerHTML = "<h3>Profile sources</h3>"; const links = document.createElement("div"); links.className = "athlete-source-links";
        profile.sourceLinks.forEach(source => { const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = source.label; links.appendChild(link); }); section.appendChild(links); body.appendChild(section);
      }
    }catch(error){
      if(!valid())return;
      body.replaceChildren();const heading=document.createElement("h2");heading.textContent=record.displayName;const gap=document.createElement("p");gap.textContent="Detailed profile information is temporarily unavailable.";body.append(heading,gap);
      const retry = document.createElement("button"); retry.type = "button"; retry.className = "btn ghost"; retry.textContent = "Retry profile";
      retry.addEventListener("click", () => { if(valid())void populateProfile(body,record,sportKey,valid); }); body.appendChild(retry);
      console.warn("Athlete profile failed", error);
    }
  }


async function openFromFixture(id,label,sportKey,trigger,origin={}){
  if(!id)return;
  const fixture=profileFixtureEvents.get(trigger?.closest('[data-event-id]')?.dataset.eventId);
  const previous={tab:activeTab,inspector:activeInspectorCodeId,y:origin.y??scrollY,cardTop:origin.top??trigger?.closest('[data-event-id]')?.getBoundingClientRect().top,browse:{...followBrowseState()},eventId:fixture?.eventId||fixture?.id,label:trigger?.getAttribute('aria-label')};
  const restore=()=>{
    activeTab=previous.tab;activeInspectorCodeId=previous.inspector;saveFollowBrowse(previous.browse);renderAll();
    const host=document.getElementById('listView');let frame=null,stopped=false;
    const intent=['pointerdown','touchstart','wheel','keydown','pagehide'];
    const stop=()=>{stopped=true;observer.disconnect();resize?.disconnect();if(frame!==null)cancelAnimationFrame(frame);intent.forEach(type=>window.removeEventListener(type,stop,true));document.removeEventListener('focusin',onFocus);};
    const onFocus=event=>{if(event.target!==document.body&&event.target?.closest('[data-event-id]')?.dataset.eventId!==previous.eventId)stop();};
    const restoreTarget=()=>{
      frame=null;if(stopped)return;
      if(activeTab!==previous.tab||activeInspectorCodeId!==previous.inspector){stop();return;}
      const item=previous.tab==='feed'?[...feedCardSlots.values()].find(item=>(item.event.eventId||item.event.id)===previous.eventId):null;
      if(item&&!item.mounted){item.slot.replaceChildren(buildEventCard(item.event));item.slot.style.minHeight='';item.mounted=true;}
      const card=[...host.querySelectorAll('[data-event-id]')].find(node=>node.dataset.eventId===previous.eventId);
      const target=[...(card?.querySelectorAll('.fixture-profile-link')||[])].find(node=>node.getAttribute('aria-label')===previous.label);
      (target||card)?.focus({preventScroll:true});
      scrollTo({top:card&&Number.isFinite(previous.cardTop)?scrollY+card.getBoundingClientRect().top-previous.cardTop:previous.y,behavior:'instant'});
    };
    const schedule=()=>{if(!stopped&&frame===null)frame=requestAnimationFrame(restoreTarget);};
    const observer=new MutationObserver(schedule),resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
    observer.observe(host,{childList:true,subtree:true});resize?.observe(host);
    intent.forEach(type=>window.addEventListener(type,stop,{capture:true,once:true,passive:true}));document.addEventListener('focusin',onFocus);
    schedule();
  };
  const key=fixture&&codeIdForEvent(fixture)==='sport:football'?'football':sportKey==='wimbledon'?'tennis':sportKey;
  activeTab='follow';saveFollowBrowse({sportId:key==='f1'?'sport:motorsport':key==='aflw'?'sport:afl':key==='nrlw'?'sport:nrl':`sport:${key}`,categoryId:['f1','aflw','nrlw'].includes(key)?`sport:${key}`:'',section:'teams-players'});
  renderAll({preserveViewport:true});
  try{
    const chunk=await loadFollowDirectoryChunk(key).catch(()=>({}));
    const records=[...(chunk.participants||[]),...(chunk.teams||[]),...(chunk.players||[]),...(chunk.records||[])];
    const identityKey=FOLLOW_FIRST.participantFollowIdentityKey;
    const record=records.find(p=>p.id===id || identityKey?.(p.id)===identityKey?.(id)) || cardIdentityParticipants().find(p=>p.id===id) || {id,displayName:label};
    await open({...record,id:record.id||id,displayName:record.displayName||record.name||label},key,trigger,{fixture,onClose:restore});
  }catch(error){restore();showToast('Profile unavailable. Please try again.');}
}

  async function renderInto(host,record,sportKey,{valid=()=>host.isConnected,fixture=null,basicOnly=false}={}){
    host.replaceChildren();
    if(!record.profileOnly)host.append(buildDirectoryFollowButton(record.id,{sportKey,label:record.displayName}));
    const body=document.createElement('div');body.className='athlete-profile-body';body.textContent='Loading profile…';host.append(body);
    if(fixture){const context=document.createElement('div');host.append(context);void appendProfileFixtureContext(context,record,sportKey,fixture);}
    if(basicOnly){
      body.replaceChildren();const title=document.createElement('h2');title.textContent=record.displayName||record.name;body.append(title);
      const text=document.createElement('p');text.textContent=[record.id.startsWith('team:')?'Team':record.tour||record.metadata?.tour||'Professional '+(typeof NOTHINGSPORTS_ATHLETES!=='undefined'?NOTHINGSPORTS_ATHLETES.role(sportKey).toLowerCase():'athlete'),record.nationalityCode||record.countryCode||record.metadata?.nationalityCode||record.metadata?.countryCode||record.metadata?.representedCountryCode,record.dateOfBirth?'Born '+record.dateOfBirth:null].filter(Boolean).join(' · ');body.append(text);
      const alias=record.metadata?.providerAlias||'';const url=record.sourceUrl||record.metadata?.sourceUrl||record.sourceRefs?.[0]||(alias.startsWith('atp:player:')?'https://www.atptour.com/en/players/-/'+alias.split(':').at(-1)+'/overview':alias.startsWith('wta:player:')?'https://www.wtatennis.com/players/'+alias.split(':').at(-1)+'/name':null);if(/^https:\/\//.test(url||'')){const a=document.createElement('a');a.textContent='Player background source';a.href=url;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}return;
    }
    await populateProfile(body,record,sportKey,valid);
  }
  root.NOTHINGSPORTS_ATHLETE_PROFILE_UI = Object.freeze({ open, openFromFixture, renderInto, decorateIdentity, makeTrigger });
})(typeof globalThis !== "undefined" ? globalThis : window);
