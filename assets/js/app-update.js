(function(){
  "use strict";
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const version = document.querySelector('meta[name="app-shell-version"]')?.content;
  const state = { version, workerVersion:null, availableVersion:null, phase:'idle', lastCheckedAt:null };
  const listeners = new Set();
  let registration, checking, lastAttempt = 0, pendingVersion, reloading = false, beforeReload;
  let pendingWrites = 0;
  const originalFetch = window.fetch.bind(window);
  // A worker update must not interrupt a rating, follow save or message POST.
  window.fetch = function(input, options){
    const method = String(options?.method || input?.method || 'GET').toUpperCase();
    if (['GET','HEAD','OPTIONS'].includes(method)) return originalFetch(input, options);
    pendingWrites++;
    const finished = () => { pendingWrites--; setTimeout(() => void applyUpdate(), 0); };
    return originalFetch(input, options).then(response => {
      // Headers alone do not mean the save response has been received.
      response.clone().arrayBuffer().then(finished, finished);
      return response;
    }, error => { finished(); throw error; });
  };
  function publish(phase){
    if (phase) state.phase = phase;
    listeners.forEach(listener => listener({ ...state }));
  }
  async function workerVersion(worker){
    if (!worker) return null;
    return new Promise(resolve => {
      const channel = new MessageChannel();
      const done = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
      const timer = setTimeout(() => done(null), 2000);
      channel.port1.onmessage = event => done(event.data?.version || null);
      try { worker.postMessage({ type:'nothingsport-worker-version' }, [channel.port2]); }
      catch (_) { done(null); }
    });
  }
  async function applyUpdate(){
    if (!pendingVersion || pendingVersion === version || reloading || !beforeReload || pendingWrites) return;
    const active = document.activeElement;
    if (active?.matches('input,textarea,[contenteditable="true"]')) return;
    const key = 'nothingsport:shell-reload:' + pendingVersion;
    try {
      // A failed navigation must not turn into a reload loop.
      if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 60000) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch (_) { /* The in-memory guard still prevents repeated reloads. */ }
    reloading = true;
    publish('updating');
    try { await beforeReload(); }
    catch (_) { reloading = false; publish('error'); }
  }
  function requestReload(nextVersion){
    if (!nextVersion || nextVersion === version) return;
    pendingVersion = String(nextVersion);
    state.availableVersion = pendingVersion;
    publish('updating');
    void applyUpdate();
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'nothingsport-shell-probe') return;
    event.ports?.[0]?.postMessage({ version, protocol:1 });
    requestReload(event.data.version);
  });
  function watch(reg){
    const activate = worker => {
      if (worker?.state === 'installed') worker.postMessage({ type:'nothingsport-activate-update' });
    };
    activate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        activate(worker);
        if (worker.state === 'redundant') publish('error');
      });
    });
  }
  let registering;
  function register(){
    if (registration) return Promise.resolve(registration);
    if (registering) return registering;
    registering = navigator.serviceWorker.register('/service-worker.js', { updateViaCache:'none' })
      .then(reg => { registration = reg; watch(reg); return reg; })
      .finally(() => { registering = null; });
    return registering;
  }
  async function bounded(promise){
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Update timed out')), 15000); })]); }
    finally { clearTimeout(timer); }
  }
  // Registration starts independently of window.load (images/fonts can delay it).
  void register().catch(() => publish('error'));
  async function check({ force = false } = {}){
    if (checking) return checking;
    if (!force && Date.now() - lastAttempt < 30000) return { ...state };
    lastAttempt = Date.now();
    publish('checking');
    checking = (async () => {
      try {
        if (!navigator.onLine) throw new Error('offline');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let response, current;
        try { response = await originalFetch('/app-version.json', { cache:'no-store', signal:controller.signal });
          if (!response.ok) throw new Error('Version unavailable');
          current = await response.json();
        }
        finally { clearTimeout(timeout); }
        if (!/^\d+$/.test(String(current.version))) throw new Error('Invalid version');
        state.availableVersion = String(current.version);
        const reg = await bounded(register());
        await bounded(reg.update());
        state.workerVersion = await workerVersion(navigator.serviceWorker.controller || reg.active);
        state.lastCheckedAt = Date.now();
        if (state.workerVersion && state.workerVersion !== version) requestReload(state.workerVersion);
        else publish(state.availableVersion === version && state.workerVersion === version ? 'current' : 'updating');
      } catch (_) { publish(navigator.onLine ? 'error' : 'offline'); }
      return { ...state };
    })().finally(() => { checking = null; });
    return checking;
  }
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    state.workerVersion = await workerVersion(navigator.serviceWorker.controller);
    if (state.workerVersion === version) publish(state.availableVersion === version ? 'current' : 'idle');
    else requestReload(state.workerVersion);
  });
  window.addEventListener('pageshow', () => void check());
  window.addEventListener('online', () => void check({ force:true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  document.addEventListener('focusout', () => setTimeout(() => void applyUpdate(), 0));
  window.NOTHINGSPORTS_APP_UPDATE = Object.freeze({
    check,
    snapshot:() => ({ ...state }),
    subscribe(listener){ listeners.add(listener); listener({ ...state }); return () => listeners.delete(listener); },
    configure(callback){ beforeReload = callback; void applyUpdate(); },
  });
  void check();
})();
