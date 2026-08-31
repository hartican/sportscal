(function attachNothingSportsServerSync(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SERVER_SYNC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildServerSync(){
  "use strict";

  const SESSION_STORAGE_KEY = "ns_auth_session_v1";
  const PERSISTENT_SESSION_STORAGE_KEY = "ns_auth_persistent_session_v1";
  const SESSION_PERSISTENCE_KEY = "ns_auth_persistence_v1";
  const RECOVERY_STORAGE_KEY = "ns_auth_recovery_v1";
  const GUEST_CHAT_SESSION_STORAGE_KEY = "ns_guest_chat_session_v1";
  const RECOVERY_TTL_MS = 15 * 60 * 1000;
  const USER_STATE_SCHEMA_VERSION = "user-state.v2";
  const PRODUCT_EVENTS_SCHEMA_VERSION = "product-events.v1";
  const REFRESH_EARLY_MS = 60 * 1000;

  function clone(value){
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function plainObject(value, fallback = {}){
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  }

  function mergeSettings(base, incoming){
    const previous = plainObject(base);
    const patch = plainObject(incoming);
    const merged = clone(previous);
    Object.entries(patch).forEach(([key, value]) => {
      if (plainObject(value, null) && plainObject(previous[key], null)){
        merged[key] = mergeSettings(previous[key], value);
      } else {
        merged[key] = clone(value);
      }
    });
    return merged;
  }

  function parseSession(input, now = Date.now()){
    const source = plainObject(input, null);
    if (!source) return null;
    const accessToken = String(source.accessToken || source.access_token || "");
    const refreshToken = String(source.refreshToken || source.refresh_token || "");
    if (!accessToken || !refreshToken) return null;
    const explicitExpiry = Number(source.expiresAt || source.expires_at);
    const expiresIn = Number(source.expiresIn || source.expires_in || 3600);
    const expiresAt = Number.isFinite(explicitExpiry) && explicitExpiry > 0
      ? (explicitExpiry < 10_000_000_000 ? explicitExpiry * 1000 : explicitExpiry)
      : Number(now) + Math.max(60, expiresIn) * 1000;
    return { accessToken, refreshToken, expiresAt };
  }

  function sessionSubject(input){
    const token = String(input?.accessToken || input?.access_token || input || "");
    const payload = token.split(".")[1];
    if (!payload) return "";
    try{
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
      const decoded = typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf8");
      return String(JSON.parse(decoded)?.sub || "");
    }catch(_error){
      return "";
    }
  }

  function parseRecoveryFragment(hash, now = Date.now()){
    const source = String(hash || "").replace(/^#/, "");
    if (!source) return null;
    const params = new URLSearchParams(source);
    if (params.get("type") !== "recovery") return null;
    const accessToken = String(params.get("access_token") || "");
    if (!accessToken) return null;
    const expiresIn = Math.max(60, Math.min(RECOVERY_TTL_MS / 1000, Number(params.get("expires_in")) || RECOVERY_TTL_MS / 1000));
    return { accessToken, expiresAt:Number(now) + expiresIn * 1000 };
  }

  function storeRecoverySession(storage, recovery){
    try{
      if (recovery) storage?.setItem?.(RECOVERY_STORAGE_KEY, JSON.stringify(recovery));
      else storage?.removeItem?.(RECOVERY_STORAGE_KEY);
    }catch(_error){ return null; }
    return recovery;
  }

  function readRecoverySession(storage = globalThis.sessionStorage, now = Date.now()){
    try{
      const recovery = JSON.parse(storage?.getItem?.(RECOVERY_STORAGE_KEY) || "null");
      if (!recovery?.accessToken || Number(recovery.expiresAt) <= Number(now)){
        storeRecoverySession(storage, null);
        return null;
      }
      return { accessToken:String(recovery.accessToken), expiresAt:Number(recovery.expiresAt) };
    }catch(_error){
      storeRecoverySession(storage, null);
      return null;
    }
  }

  function captureRecoveryFromLocation({
    location = globalThis.location,
    history = globalThis.history,
    storage = globalThis.sessionStorage,
    now = Date.now(),
  } = {}){
    const fragment = new URLSearchParams(String(location?.hash || "").replace(/^#/, ""));
    const recoveryLink = fragment.get("type") === "recovery" || new URLSearchParams(location?.search || "").get("auth") === "recovery";
    const recovery = parseRecoveryFragment(location?.hash, now);
    if (recovery) storeRecoverySession(storage, recovery);
    if (recoveryLink){
      try{
      const search = new URLSearchParams(location.search || "");
      search.delete("auth");
      const suffix = search.toString();
      history?.replaceState?.(null, "", `${location.pathname || "/"}${suffix ? `?${suffix}` : ""}`);
      }catch(_error){ /* Token storage is already isolated even if URL replacement is unavailable. */ }
    }
    if (recovery) return recovery;
    const stored = readRecoverySession(storage, now);
    return stored || (recoveryLink ? { invalid:true, expiresAt:Number(now) } : null);
  }

  function stateFromDatabaseRow(row){
    if (!row || typeof row !== "object") return null;
    return {
      schemaVersion: row.schema_version || USER_STATE_SCHEMA_VERSION,
      profile: plainObject(row.profile),
      preferences: plainObject(row.preferences),
      eventUserState: plainObject(row.event_user_state),
      eventSpoilerState: plainObject(row.event_spoiler_state),
      archivedEvents: Array.isArray(row.archived_events) ? row.archived_events : [],
      ratings: plainObject(row.ratings),
      updatedAt: row.updated_at || null,
    };
  }

  function buildUserState({
    profile,
    preferences,
    eventUserState,
    eventSpoilerState,
    archivedEvents,
    ratings,
  } = {}){
    return {
      schemaVersion: USER_STATE_SCHEMA_VERSION,
      profile: clone(plainObject(profile)),
      preferences: clone(plainObject(preferences)),
      eventUserState: clone(plainObject(eventUserState)),
      eventSpoilerState: clone(plainObject(eventSpoilerState)),
      archivedEvents: clone(Array.isArray(archivedEvents) ? archivedEvents : []),
      ratings: clone(plainObject(ratings)),
    };
  }

  function storageRead(storage, key = SESSION_STORAGE_KEY){
    try{
      return parseSession(JSON.parse(storage?.getItem?.(key) || "null"));
    }catch(_error){
      return null;
    }
  }

  function storageWrite(storage, key, session){
    try{
      if (session) storage?.setItem?.(key, JSON.stringify(session));
      else storage?.removeItem?.(key);
    }catch(_error){
      // Blocked browser storage means the user signs in again next visit.
    }
    return session;
  }

  function createClient({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    storage = globalThis.sessionStorage,
    persistentStorage = globalThis.localStorage,
    now = () => Date.now(),
  } = {}){
    let session = null;
    let persistSession = true;
    let refreshInFlight = null;
    let guestChatSession = null;
    let guestRefreshInFlight = null;

    async function jsonRequest(path, options = {}){
      if (typeof fetchImpl !== "function") throw new Error("Server sync is unavailable in this browser.");
      const response = await fetchImpl(path, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok){
        const error = new Error(payload.error || "Server sync request failed.");
        error.status = response.status;
        error.code = payload.code || "server_sync_request_failed";
        throw error;
      }
      return payload;
    }

    function persistencePreference(){
      try{
        return persistentStorage?.getItem?.(SESSION_PERSISTENCE_KEY) === "session"
          ? "session"
          : "persistent";
      }catch(_error){
        return "persistent";
      }
    }

    function savePersistencePreference(persist){
      try{
        persistentStorage?.setItem?.(SESSION_PERSISTENCE_KEY, persist ? "persistent" : "session");
      }catch(_error){
        // The chosen mode still applies for the current app process.
      }
    }

    function saveSession(next){
      session = parseSession(next, now());
      if (persistSession){
        storageWrite(persistentStorage, PERSISTENT_SESSION_STORAGE_KEY, session);
        storageWrite(storage, SESSION_STORAGE_KEY, null);
      } else {
        storageWrite(storage, SESSION_STORAGE_KEY, session);
        storageWrite(persistentStorage, PERSISTENT_SESSION_STORAGE_KEY, null);
      }
      return session;
    }

    function clearSession(){
      session = null;
      refreshInFlight = null;
      storageWrite(storage, SESSION_STORAGE_KEY, null);
      storageWrite(persistentStorage, PERSISTENT_SESSION_STORAGE_KEY, null);
    }

    function restoreStoredSession(){
      const persistent = storageRead(persistentStorage, PERSISTENT_SESSION_STORAGE_KEY);
      if (persistent){
        persistSession = true;
        storageWrite(storage, SESSION_STORAGE_KEY, null);
        return persistent;
      }
      const temporary = storageRead(storage, SESSION_STORAGE_KEY);
      if (!temporary) return null;
      persistSession = persistencePreference() !== "session";
      if (persistSession){
        session = temporary;
        savePersistencePreference(true);
        return saveSession(temporary);
      }
      return temporary;
    }

    async function refreshSession(){
      if (!session?.refreshToken) return null;
      if (refreshInFlight) return refreshInFlight;
      refreshInFlight = (async () => {
        try{
          const payload = await jsonRequest("/api/auth", {
            method: "POST",
            body: JSON.stringify({
              action: "refresh",
              refreshToken: session.refreshToken,
            }),
          });
          return saveSession(payload.session);
        }catch(error){
          clearSession();
          throw error;
        }finally{
          refreshInFlight = null;
        }
      })();
      return refreshInFlight;
    }

    async function currentSession(){
      if (!session) session = restoreStoredSession();
      if (!session) return null;
      if (session.expiresAt <= now() + REFRESH_EARLY_MS) await refreshSession();
      return session;
    }

    async function authenticatedRequest(path, options = {}){
      const activeSession = await currentSession();
      if (!activeSession){
        const error = new Error("Sign in is required.");
        error.status = 401;
        error.code = "missing_session";
        throw error;
      }
      try{
        return await jsonRequest(path, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${activeSession.accessToken}`,
          },
        });
      }catch(error){
        if (error.status !== 401 || !session?.refreshToken) throw error;
        const refreshed = await refreshSession();
        return jsonRequest(path, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${refreshed.accessToken}`,
          },
        });
      }
    }

    function saveGuestChatSession(next){
      guestChatSession = parseSession(next, now());
      storageWrite(persistentStorage, GUEST_CHAT_SESSION_STORAGE_KEY, guestChatSession);
      return guestChatSession;
    }

    function clearGuestChatSession(){
      guestChatSession = null;
      guestRefreshInFlight = null;
      storageWrite(persistentStorage, GUEST_CHAT_SESSION_STORAGE_KEY, null);
    }

    function restoreGuestChatSession(){
      if (!guestChatSession) guestChatSession = storageRead(persistentStorage, GUEST_CHAT_SESSION_STORAGE_KEY);
      return guestChatSession;
    }

    async function refreshGuestChatSession(){
      if (!guestChatSession?.refreshToken) return null;
      if (guestRefreshInFlight) return guestRefreshInFlight;
      guestRefreshInFlight = (async () => {
        try{
          const payload = await jsonRequest("/api/auth", {
            method:"POST",
            body:JSON.stringify({ action:"refresh-anonymous-chat-session", refreshToken:guestChatSession.refreshToken }),
          });
          return saveGuestChatSession(payload.session);
        }catch(error){
          clearGuestChatSession();
          throw error;
        }finally{
          guestRefreshInFlight = null;
        }
      })();
      return guestRefreshInFlight;
    }

    async function currentGuestChatSession(){
      const active = restoreGuestChatSession();
      if (!active) return null;
      if (active.expiresAt <= now() + REFRESH_EARLY_MS) await refreshGuestChatSession();
      return guestChatSession;
    }

    async function guestAuthenticatedRequest(path, options = {}){
      const activeSession = await currentGuestChatSession();
      if (!activeSession){
        const error = new Error("Join this room from its guest link first.");
        error.status = 401;
        error.code = "missing_guest_session";
        throw error;
      }
      try{
        return await jsonRequest(path, {
          ...options,
          headers:{ ...(options.headers || {}), Authorization:`Bearer ${activeSession.accessToken}` },
        });
      }catch(error){
        if (error.status !== 401 || !guestChatSession?.refreshToken) throw error;
        const refreshed = await refreshGuestChatSession();
        return jsonRequest(path, {
          ...options,
          headers:{ ...(options.headers || {}), Authorization:`Bearer ${refreshed.accessToken}` },
        });
      }
    }

    async function chatAuthenticatedRequest(path, options = {}){
      if (await currentSession()) return authenticatedRequest(path, options);
      return guestAuthenticatedRequest(path, options);
    }

    return Object.freeze({
      async status(){
        return jsonRequest("/api/auth");
      },
      async restoreSession(){
        return currentSession();
      },
      async signIn(email, password, { persist = true } = {}){
        const payload = await jsonRequest("/api/auth", {
          method: "POST",
          body: JSON.stringify({ action: "password-sign-in", email, password }),
        });
        persistSession = persist !== false;
        savePersistencePreference(persistSession);
        const saved = saveSession(payload.session);
        if (!saved){
          const error = new Error("The sign-in response did not contain a valid session.");
          error.code = "invalid_auth_session";
          throw error;
        }
        return { ...saved };
      },
      async signUp(email, password, meta, { persist = true } = {}){
        const payload = await jsonRequest("/api/auth", {
          method:"POST",
          body:JSON.stringify({ action:"sign-up", email, password, meta }),
        });
        if (!payload.session) return payload;
        persistSession = persist !== false;
        savePersistencePreference(persistSession);
        const saved = saveSession(payload.session);
        if (!saved){
          const error = new Error("The sign-up response did not contain a valid session.");
          error.code = "invalid_auth_session";
          throw error;
        }
        return { ...payload, session:{ ...saved } };
      },
      async requestPasswordRecovery(email){
        return jsonRequest("/api/auth", {
          method:"POST",
          body:JSON.stringify({ action:"password-recovery-request", email }),
        });
      },
      async updateRecoveryPassword(accessToken, password){
        return jsonRequest("/api/auth", {
          method:"POST",
          headers:{ Authorization:`Bearer ${String(accessToken || "")}` },
          body:JSON.stringify({ action:"password-update", password }),
        });
      },
      async user(){
        const payload = await authenticatedRequest("/api/auth");
        return payload.user;
      },
      async loadState(){
        const payload = await authenticatedRequest("/api/user-state");
        return {
          user: payload.user,
          state: stateFromDatabaseRow(payload.state),
        };
      },
      async loadMeta(){
        return authenticatedRequest("/api/user-meta");
      },
      async saveMeta(meta){
        return authenticatedRequest("/api/user-meta", {
          method:"PUT",
          body:JSON.stringify({ meta }),
        });
      },
      async notificationCommand(command, { authenticated = true } = {}){
        const options = { method:"POST", body:JSON.stringify(command || {}) };
        if (authenticated && (session || restoreStoredSession())){
          return authenticatedRequest("/api/notifications", options);
        }
        if (authenticated && (guestChatSession || restoreGuestChatSession())){
          return guestAuthenticatedRequest("/api/notifications", options);
        }
        return jsonRequest("/api/notifications", options);
      },
      async anonymousChatSession({ capability = "", guestDisplayName = "" } = {}){
        const existing = await currentGuestChatSession();
        if (existing) return { session:{ ...existing }, existing:true };
        const payload = await jsonRequest("/api/auth", {
          method:"POST",
          body:JSON.stringify({
            action:"anonymous-chat-session",
            capability:String(capability || ""),
            guestDisplayName:String(guestDisplayName || ""),
          }),
        });
        const saved = saveGuestChatSession(payload.session);
        if (!saved){
          const error = new Error("The guest chat session could not be started.");
          error.code = "invalid_guest_chat_session";
          throw error;
        }
        return { ...payload, session:{ ...saved } };
      },
      async chatGuestPreview(capability){
        return jsonRequest("/api/chat", {
          method:"POST",
          body:JSON.stringify({ action:"guest-preview", capability:String(capability || "") }),
        });
      },
      async chatRequest({ mode = "", roomId = "", after = "", before = "", q = "", reactionAfter = "" } = {}, command = null){
        if (command){
          return chatAuthenticatedRequest("/api/chat", {
            method:"POST",
            body:JSON.stringify(command),
          });
        }
        const params = new URLSearchParams();
        if (mode) params.set("mode", mode);
        if (roomId) params.set("roomId", roomId);
        if (after) params.set("after", after);
        if (before) params.set("before", before);
        if (q) params.set("q", q);
        if (reactionAfter) params.set("reactionAfter", reactionAfter);
        return chatAuthenticatedRequest(`/api/chat?${params.toString()}`);
      },
      async commsRequest(command = null){
        return authenticatedRequest("/api/comms", command ? {
          method:"POST",
          body:JSON.stringify(command),
        } : {});
      },
      async adminUsersRequest({ q = "" } = {}, command = null){
        if (command) return authenticatedRequest("/api/admin/users", { method:"POST", body:JSON.stringify(command) });
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        return authenticatedRequest(`/api/admin/users${params.size ? `?${params}` : ""}`);
      },
      async adminReportsRequest({ status = "" } = {}, command = null){
        if (command) return authenticatedRequest("/api/admin/reports", { method:"POST", body:JSON.stringify(command) });
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        return authenticatedRequest(`/api/admin/reports${params.size ? `?${params}` : ""}`);
      },
      async adminPanelRequest(command = null){
        return authenticatedRequest("/api/admin/panel", command ? { method:"POST", body:JSON.stringify(command) } : {});
      },
      async nothingscoreRequest({ ids = [], eventId = "", leaderboard = "" } = {}, command = null){
        if (command){
          return authenticatedRequest("/api/nothingscore", { method:"POST", body:JSON.stringify(command) });
        }
        const params = new URLSearchParams();
        if (Array.isArray(ids) && ids.length) params.set("ids", ids.slice(0, 50).join(","));
        if (eventId) params.set("eventId", eventId);
        if (leaderboard) params.set("leaderboard", leaderboard);
        const target = `/api/nothingscore?${params.toString()}`;
        return session || restoreStoredSession() ? authenticatedRequest(target) : jsonRequest(target);
      },
      async nothingscoreMarquee(command){
        return authenticatedRequest("/api/nothingscore-marquee", { method:"POST", body:JSON.stringify(command || {}) });
      },
      async loadFeed({ cursor = 0, limit = 20 } = {}){
        const params = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });
        return authenticatedRequest(`/api/feed?${params.toString()}`);
      },
      async sendProductEvents(events){
        const payload = await authenticatedRequest("/api/product-events", {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: PRODUCT_EVENTS_SCHEMA_VERSION,
            events,
          }),
        });
        if (payload?.schemaVersion !== PRODUCT_EVENTS_SCHEMA_VERSION || payload?.accepted !== events.length){
          const error = new Error("The server did not confirm every product event.");
          error.code = "product_events_not_confirmed";
          throw error;
        }
        return payload;
      },
      async savePatch(patch){
        const payload = await authenticatedRequest("/api/user-state", {
          method: "PUT",
          body: JSON.stringify({ patch }),
        });
        return {
          user: payload.user,
          state: stateFromDatabaseRow(payload.state),
        };
      },
      async signOut(){
        try{
          if (await currentSession()){
            await authenticatedRequest("/api/auth", {
              method: "POST",
              body: JSON.stringify({ action: "logout" }),
            });
          }
        }finally{
          clearSession();
        }
      },
      clearSession,
      clearGuestChatSession,
      getSession(){
        return session ? { ...session } : restoreStoredSession();
      },
      getGuestChatSession(){
        const active = restoreGuestChatSession();
        return active ? { ...active } : null;
      },
      guestChatSessionSubject(){
        return sessionSubject(restoreGuestChatSession());
      },
      sessionSubject(){
        return sessionSubject(session || restoreStoredSession());
      },
      prefersPersistentSession(){
        return persistencePreference() !== "session";
      },
      isPersistentSession(){
        return Boolean(session || restoreStoredSession()) && persistSession;
      },
      setSessionPersistence(persist){
        const active = session || restoreStoredSession();
        persistSession = persist !== false;
        savePersistencePreference(persistSession);
        if (active) saveSession(active);
        return persistSession;
      },
    });
  }

  return Object.freeze({
    REFRESH_EARLY_MS,
    PRODUCT_EVENTS_SCHEMA_VERSION,
    PERSISTENT_SESSION_STORAGE_KEY,
    SESSION_STORAGE_KEY,
    SESSION_PERSISTENCE_KEY,
    RECOVERY_STORAGE_KEY,
    GUEST_CHAT_SESSION_STORAGE_KEY,
    RECOVERY_TTL_MS,
    USER_STATE_SCHEMA_VERSION,
    buildUserState,
    createClient,
    mergeSettings,
    parseSession,
    parseRecoveryFragment,
    captureRecoveryFromLocation,
    readRecoverySession,
    storeRecoverySession,
    sessionSubject,
    stateFromDatabaseRow,
  });
});
