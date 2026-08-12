(function attachNothingSportsServerSync(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SERVER_SYNC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildServerSync(){
  "use strict";

  const SESSION_STORAGE_KEY = "ns_auth_session_v1";
  const PERSISTENT_SESSION_STORAGE_KEY = "ns_auth_persistent_session_v1";
  const SESSION_PERSISTENCE_KEY = "ns_auth_persistence_v1";
  const USER_STATE_SCHEMA_VERSION = "user-state.v1";
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
      }
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
      async loadFeed(){
        return authenticatedRequest("/api/feed");
      },
      async sendProductEvents(events){
        return authenticatedRequest("/api/product-events", {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: PRODUCT_EVENTS_SCHEMA_VERSION,
            events,
          }),
        });
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
      getSession(){
        return session ? { ...session } : restoreStoredSession();
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
    USER_STATE_SCHEMA_VERSION,
    buildUserState,
    createClient,
    mergeSettings,
    parseSession,
    stateFromDatabaseRow,
  });
});
