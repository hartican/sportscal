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
.athlete-profile-trigger{border:0;background:transparent;color:inherit;padding:0;text-align:left;cursor:pointer}.athlete-profile-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}.athlete-headshot{width:38px;height:38px;flex:0 0 38px;border-radius:50%;object-fit:cover;object-position:50% 18%;background:var(--panel);box-shadow:0 0 0 1px var(--border)}.athlete-number{display:inline-grid;place-items:center;min-width:28px;height:24px;padding:0 6px;border-radius:999px;background:color-mix(in srgb,var(--sport-color,var(--accent)) 17%,var(--panel));color:var(--text);font-size:.66rem;font-weight:900}
.athlete-profile-backdrop{position:fixed;inset:0;z-index:10040;display:flex;justify-content:flex-end;background:rgba(0,0,0,.54)}
.athlete-profile-drawer{width:min(100%,560px);height:100%;overflow:auto;padding:calc(18px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom));background:var(--bg-card);color:var(--text);box-shadow:-18px 0 50px rgba(0,0,0,.28)}
.athlete-profile-close{float:right;width:40px;height:40px;border:1px solid var(--border);border-radius:50%;background:var(--panel);color:var(--text);font-size:1.2rem;cursor:pointer}
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

  async function fetchJson(url){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
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
    target.addEventListener("click", () => void open(record, sportKey, target));
    target.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " "){ event.preventDefault(); void open(record, sportKey, target); } });
  }

  async function open(record, sportKey, trigger){
    document.querySelector(".athlete-profile-backdrop")?.remove();
    const backdrop = document.createElement("div"); backdrop.className = "athlete-profile-backdrop";
    const drawer = document.createElement("aside"); drawer.className = "athlete-profile-drawer"; drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-label", `${record.displayName} athlete profile`);
    const close = document.createElement("button"); close.type = "button"; close.className = "athlete-profile-close"; close.setAttribute("aria-label", "Close athlete profile"); close.textContent = "×";
    const body = document.createElement("div"); body.className = "athlete-profile-body"; body.innerHTML = "<p>Loading official profile…</p>";
    drawer.append(close, body); backdrop.appendChild(drawer); document.body.appendChild(backdrop);
    const dismiss = () => { backdrop.remove(); trigger?.focus?.({ preventScroll:true }); document.removeEventListener("keydown", onKey); };
    const onKey = event => { if (event.key === "Escape") dismiss(); };
    close.addEventListener("click", dismiss); backdrop.addEventListener("click", event => { if (event.target === backdrop) dismiss(); }); document.addEventListener("keydown", onKey); close.focus();
    try{
      const profile = await loadProfile(record.profileRef, sportKey);
      if (!profile){
        body.innerHTML = `<div class="athlete-profile-hero"><div></div><div><h2></h2><p>Detailed statistics are currently available for the published top 10 in this code and the complete GWS AFLW experiment.</p></div></div>`;
        body.querySelector("h2").textContent = record.displayName;
        return;
      }
      body.replaceChildren();
      const hero = document.createElement("div"); hero.className = "athlete-profile-hero";
      const image = document.createElement("img"); image.className = "athlete-headshot"; image.alt = `${profile.displayName} portrait`; image.src = profile.headshotUrl || record.headshotUrl || ""; image.addEventListener("error", () => image.remove(), { once:true });
      const titleWrap = document.createElement("div"), title = document.createElement("h2"), sub = document.createElement("p"); title.textContent = profile.displayName; sub.textContent = `${profile.teamName || "Athlete"}${profile.competitionNumber ? ` · No. ${profile.competitionNumber}` : ""}${profile.selection?.topTen ? ` · Top 10 #${profile.selection.rank}` : ""}`;
      titleWrap.append(title, sub); hero.append(image, titleWrap); body.appendChild(hero);
      const bio = document.createElement("section"); bio.className = "athlete-profile-section"; bio.innerHTML = "<h3>Biography</h3>"; const bioText = document.createElement("p"); bioText.textContent = profile.biography; bio.appendChild(bioText); body.appendChild(bio);
      [["Key facts", profile.keyFacts], ["2026 season", profile.seasonStats], ["Career", profile.careerStats]].forEach(([heading, rows]) => {
        if (!rows?.length) return; const section = document.createElement("section"); section.className = "athlete-profile-section"; const h = document.createElement("h3"); h.textContent = heading; section.append(h, statGrid(rows)); body.appendChild(section);
      });
      if (profile.recentFive?.length){
        const section = document.createElement("section"); section.className = "athlete-profile-section"; section.innerHTML = "<h3>Recent form</h3>"; const list = document.createElement("div"); list.className = "athlete-recent";
        profile.recentFive.forEach(item => { const row = document.createElement("div"); row.className = "athlete-recent-row"; row.textContent = `${item.label || "Match"}${item.opponent ? ` · v ${item.opponent}` : ""}${item.result ? ` · ${item.result}` : ""}${item.stats?.length ? ` · ${item.stats.map(stat => `${stat.label} ${stat.value}`).join(" · ")}` : ""}`; list.appendChild(row); });
        section.appendChild(list); body.appendChild(section);
      }
      if (profile.sourceLinks?.length){
        const section = document.createElement("section"); section.className = "athlete-profile-section"; section.innerHTML = "<h3>Profile sources</h3>"; const links = document.createElement("div"); links.className = "athlete-source-links";
        profile.sourceLinks.forEach(source => { const link = document.createElement("a"); link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = source.label; links.appendChild(link); }); section.appendChild(links); body.appendChild(section);
      }
    }catch(error){
      body.innerHTML = "<p>The detailed profile is temporarily unavailable. The athlete can still be followed directly from the directory.</p>";
      const retry = document.createElement("button"); retry.type = "button"; retry.className = "btn ghost"; retry.textContent = "Retry profile";
      retry.addEventListener("click", () => { dismiss(); void open(record,sportKey,trigger); }); body.appendChild(retry);
      console.warn("Athlete profile failed", error);
    }
  }

  root.NOTHINGSPORTS_ATHLETE_PROFILE_UI = Object.freeze({ open, decorateIdentity, makeTrigger });
})(typeof globalThis !== "undefined" ? globalThis : window);
