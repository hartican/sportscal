(function attachProfileStorage(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PROFILE_STORAGE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildProfileStorage(){
  "use strict";

  const PROFILE_SCHEMA_VERSION = 4;
  const INSTALL_SCHEMA_VERSION = 1;
  const CACHE_SCHEMA_VERSION = 2;
  const KEYS = Object.freeze({
    install: "ns_install_v1",
    activeProfileId: "ns_active_profile_id_v1",
    profilePrefix: "ns_profile_v1:",
  });

  const LEGACY_KEYS = Object.freeze({
    preferences: ["ns_preferences_v1", "sportscal:v1:preferences"],
    ratings: ["ns_ratings_v1", "sportscal:v1:ratings", "jacksSportsCalendar_actualRatings_v1"],
    eventUserState: ["ns_event_user_state_v1", "ns_event_actions_v1"],
    eventSpoilerState: ["ns_event_spoiler_state_v1", "ns_spoiler_reveals_v1"],
    surfacePresentation: ["ns_surface_presentation_v1"],
  });

  function parseStored(storage, key, fallback = null){
    try{
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_error){
      return fallback;
    }
  }

  function writeStored(storage, key, value){
    storage.setItem(key, JSON.stringify(value));
    return value;
  }

  function clone(value){
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalValue(value){
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalValue(value[key]);
      return result;
    }, {});
  }

  function sameBundleState(first, second){
    if (!first || !second) return false;
    const withoutWriteTime = bundle => ({
      ...bundle,
      profile: {
        ...(bundle.profile || {}),
        updatedAt: null,
      },
    });
    return JSON.stringify(canonicalValue(withoutWriteTime(first)))
      === JSON.stringify(canonicalValue(withoutWriteTime(second)));
  }

  function makeId(prefix){
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}:${uuid}`;
  }

  function nowIso(now){
    return (now instanceof Date ? now : new Date()).toISOString();
  }

  function profileKey(profileId){
    return `${KEYS.profilePrefix}${profileId}`;
  }

  function firstLegacyValue(storage, keys, fallback){
    for (const key of keys){
      const value = parseStored(storage, key, undefined);
      if (value !== undefined && value !== null) return value;
    }
    return fallback;
  }

  function createInstall(storage, now){
    const existing = parseStored(storage, KEYS.install, null);
    const activeProfileId = parseStored(storage, KEYS.activeProfileId, null)
      || existing?.activeProfileId
      || makeId("profile");
    const install = {
      installId: existing?.installId || makeId("install"),
      schemaVersion: INSTALL_SCHEMA_VERSION,
      cacheSchemaVersion: CACHE_SCHEMA_VERSION,
      activeProfileId,
      createdAt: existing?.createdAt || nowIso(now),
      updatedAt: nowIso(now),
    };
    writeStored(storage, KEYS.install, install);
    writeStored(storage, KEYS.activeProfileId, activeProfileId);
    return install;
  }

  function emptyBundle(profileId, now){
    const timestamp = nowIso(now);
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      profile: {
        id: profileId,
        usernameLabel: "Local profile",
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: PROFILE_SCHEMA_VERSION,
        onboardingCompleted: false,
        timezone: "Australia/Sydney",
      },
      preferences: null,
      domainPreferences: [],
      competitionPreferences: [],
      entityFollows: [],
      viewingPreference: null,
      learningPreference: null,
      ratings: {},
      eventUserState: {},
      eventSpoilerState: {},
      archivedEvents: [],
    };
  }

  function migrateLegacyBundle(storage, profileId, now){
    const bundle = emptyBundle(profileId, now);
    bundle.preferences = firstLegacyValue(storage, LEGACY_KEYS.preferences, null);
    bundle.ratings = firstLegacyValue(storage, LEGACY_KEYS.ratings, {});
    bundle.eventUserState = firstLegacyValue(storage, LEGACY_KEYS.eventUserState, {});
    bundle.eventSpoilerState = firstLegacyValue(storage, LEGACY_KEYS.eventSpoilerState, {});
    bundle.profile.onboardingCompleted = Boolean(bundle.preferences?.onboardingComplete);
    return bundle;
  }

  function migrateBundle(input, profileId, now){
    const fallback = emptyBundle(profileId, now);
    if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;
    const bundle = {
      ...fallback,
      ...input,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      profile: {
        ...fallback.profile,
        ...(input.profile || {}),
        id: profileId,
        schemaVersion: PROFILE_SCHEMA_VERSION,
        updatedAt: input.profile?.updatedAt || nowIso(now),
      },
      domainPreferences: Array.isArray(input.domainPreferences) ? input.domainPreferences : [],
      competitionPreferences: Array.isArray(input.competitionPreferences) ? input.competitionPreferences : [],
      entityFollows: Array.isArray(input.entityFollows) ? input.entityFollows : [],
      learningPreference: input.learningPreference && typeof input.learningPreference === "object" && !Array.isArray(input.learningPreference)
        ? input.learningPreference
        : null,
      archivedEvents: Array.isArray(input.archivedEvents) ? input.archivedEvents : [],
      ratings: input.ratings && typeof input.ratings === "object" ? input.ratings : {},
      eventUserState: input.eventUserState && typeof input.eventUserState === "object" ? input.eventUserState : {},
      eventSpoilerState: input.eventSpoilerState && typeof input.eventSpoilerState === "object" ? input.eventSpoilerState : {},
    };
    bundle.profile.onboardingCompleted = Boolean(
      input.profile?.onboardingCompleted ?? input.preferences?.onboardingComplete
    );
    return bundle;
  }

  function loadActiveProfile(storage, { now } = {}){
    const install = createInstall(storage, now);
    const key = profileKey(install.activeProfileId);
    const stored = parseStored(storage, key, null);
    const bundle = stored
      ? migrateBundle(stored, install.activeProfileId, now)
      : migrateLegacyBundle(storage, install.activeProfileId, now);
    writeStored(storage, key, bundle);
    const verified = parseStored(storage, key, null);
    if (verified?.schemaVersion === PROFILE_SCHEMA_VERSION){
      [
        ...LEGACY_KEYS.preferences,
        ...LEGACY_KEYS.ratings,
        ...LEGACY_KEYS.eventUserState,
        ...LEGACY_KEYS.eventSpoilerState,
      ].forEach(legacyKey => storage.removeItem?.(legacyKey));
    }
    return clone(bundle);
  }

  function saveBundle(storage, bundle, { now } = {}){
    if (!bundle?.profile?.id) throw new Error("A stable profile id is required");
    const key = profileKey(bundle.profile.id);
    const stored = parseStored(storage, key, null);
    const current = stored ? migrateBundle(stored, bundle.profile.id, now) : null;
    const nextInput = current ? {
      ...current,
      ...bundle,
      profile: {
        ...current.profile,
        ...(bundle.profile || {}),
      },
    } : bundle;
    const migrated = migrateBundle(nextInput, bundle.profile.id, now);
    if (current && sameBundleState(current, migrated)) return clone(current);
    migrated.profile.updatedAt = nowIso(now);
    writeStored(storage, key, migrated);
    return clone(migrated);
  }

  function commitSections(storage, bundle, sections, options){
    const profileId = bundle?.profile?.id;
    if (!profileId) throw new Error("A stable profile id is required");
    const allowed = emptyBundle(profileId);
    const incoming = sections && typeof sections === "object" && !Array.isArray(sections) ? sections : {};
    Object.keys(incoming).forEach(section => {
      if (!Object.prototype.hasOwnProperty.call(allowed, section) || section === "schemaVersion" || section === "profile"){
        throw new Error(`Unknown profile section: ${section}`);
      }
    });
    const stored = profileId ? parseStored(storage, profileKey(profileId), null) : null;
    const latest = stored ? migrateBundle(stored, profileId, options?.now) : bundle;
    const next = { ...latest };
    Object.entries(incoming).forEach(([section, value]) => { next[section] = clone(value); });
    if (Object.prototype.hasOwnProperty.call(incoming, "preferences")){
      next.profile = {
        ...latest.profile,
        onboardingCompleted: Boolean(incoming.preferences?.onboardingComplete),
      };
    }
    return saveBundle(storage, next, options);
  }

  function saveSection(storage, bundle, section, value, options){
    return commitSections(storage, bundle, { [section]: value }, options);
  }

  function setUsernameLabel(storage, bundle, usernameLabel, options){
    const label = String(usernameLabel || "").trim() || "Local profile";
    return saveBundle(storage, {
      ...bundle,
      profile: { ...bundle.profile, usernameLabel: label },
    }, options);
  }

  return Object.freeze({
    PROFILE_SCHEMA_VERSION,
    INSTALL_SCHEMA_VERSION,
    CACHE_SCHEMA_VERSION,
    KEYS,
    loadActiveProfile,
    saveBundle,
    commitSections,
    saveSection,
    setUsernameLabel,
  });
});
