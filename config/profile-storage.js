(function attachProfileStorage(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PROFILE_STORAGE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildProfileStorage(){
  "use strict";

  const PROFILE_SCHEMA_VERSION = 6;
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
  const selectorAlias = value => String(value || "") === "sport:rally" ? "sport:wrc" : String(value || "");
  const sportAlias = value => String(value || "") === "rally" ? "wrc" : String(value || "");
  const competitionAlias = value => String(value || "") === "competition:world-rally" ? "competition:wrc-2026" : String(value || "");

  function uniquePreferences(items, field, alias){
    const byId = new Map();
    (Array.isArray(items) ? items : []).forEach(item => {
      if (!item || typeof item !== "object") return;
      const id = alias(item[field]);
      if (!id) return;
      byId.set(id, { ...item, [field]:id });
    });
    return Array.from(byId.values());
  }

  function sanitizeEventUserState(input){
    return Object.fromEntries(Object.entries(input && typeof input === "object" ? input : {}).map(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [key, value];
      const { mustWatch, mustWatchAddedAt, mustWatchSeenAt, ...safe } = value;
      return [key, safe];
    }));
  }

  function sanitizePreferences(input){
    if (!input || typeof input !== "object" || Array.isArray(input)) return input ?? null;
    const preferences = clone(input);
    ["selectedSelectorEntityIds", "followedSports"].forEach(key => {
      if (Array.isArray(preferences[key])){
        preferences[key] = Array.from(new Set(preferences[key]
          .map(key === "selectedSelectorEntityIds" ? selectorAlias : sportAlias)));
      }
    });
    if (Array.isArray(preferences.standings?.selectedSportKeys)) preferences.standings.selectedSportKeys = Array.from(new Set(preferences.standings.selectedSportKeys.map(sportAlias)));
    if (preferences.standings?.pinTimestamps && typeof preferences.standings.pinTimestamps === "object"){
      preferences.standings.pinTimestamps = Object.fromEntries(Object.entries(preferences.standings.pinTimestamps)
        .map(([competitionId, value]) => [competitionAlias(competitionId), value]));
    }
    const graph = preferences.preferenceGraph;
    if (graph && typeof graph === "object"){
      if (Array.isArray(graph.domainPreferences)){
        graph.domainPreferences = uniquePreferences(graph.domainPreferences.map(item => {
          if (!item || typeof item !== "object") return item;
          const { mustWatchSensitivity, ...safe } = item;
          return { ...safe, sportDomainId: selectorAlias(safe.sportDomainId) };
        }), "sportDomainId", selectorAlias);
      }
      if (Array.isArray(graph.competitionPreferences)){
        graph.competitionPreferences = graph.competitionPreferences
          .map(item => ({ ...item, competitionId:competitionAlias(item?.competitionId) }));
        graph.competitionPreferences = uniquePreferences(graph.competitionPreferences, "competitionId", competitionAlias);
      }
    }
    return preferences;
  }

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
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
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
    bundle.preferences = sanitizePreferences(firstLegacyValue(storage, LEGACY_KEYS.preferences, null));
    bundle.ratings = firstLegacyValue(storage, LEGACY_KEYS.ratings, {});
    bundle.eventUserState = sanitizeEventUserState(firstLegacyValue(storage, LEGACY_KEYS.eventUserState, {}));
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
      domainPreferences: uniquePreferences(input.domainPreferences, "sportDomainId", selectorAlias),
      competitionPreferences: uniquePreferences(input.competitionPreferences, "competitionId", competitionAlias),
      entityFollows: Array.isArray(input.entityFollows) ? input.entityFollows : [],
      learningPreference: input.learningPreference && typeof input.learningPreference === "object" && !Array.isArray(input.learningPreference)
        ? input.learningPreference
        : null,
      archivedEvents: Array.isArray(input.archivedEvents) ? input.archivedEvents : [],
      ratings: input.ratings && typeof input.ratings === "object" ? input.ratings : {},
      preferences: sanitizePreferences(input.preferences),
      eventUserState: sanitizeEventUserState(input.eventUserState),
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
      ...(current.preferenceSync ? { preferenceSync:current.preferenceSync } : {}),
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

  // Deliberate preference writes only. Ordinary hydration/section writes cannot
  // replace these receipts from a stale in-memory bundle.
  function preferenceSyncBundle(storage, bundle){
    if (!bundle?.profile?.id) throw new Error("A stable profile id is required");
    const raw=storage.getItem(profileKey(bundle.profile.id));
    const latest=raw===null?clone(bundle):JSON.parse(raw);
    const sync=latest.preferenceSync;
    if(sync && (Object.keys(sync).length!==2||sync.writer!=="owned-preference-intent.v1" || !Array.isArray(sync.entries)
      || new Set(sync.entries.map(entry=>entry.ownerId)).size!==sync.entries.length
      || sync.entries.some(entry=>Object.keys(entry).length!==6||typeof entry.ownerId!=='string'||!entry.ownerId
        ||typeof entry.receiptId!=='string'||!entry.receiptId.startsWith('preference-edit:')||!Number.isSafeInteger(entry.generation)||entry.generation<0
        || !(entry.baseUpdatedAt===null||typeof entry.baseUpdatedAt==='string')
        || !entry.basePreferences || typeof entry.basePreferences!=='object'||Array.isArray(entry.basePreferences)
        || !entry.preferences||typeof entry.preferences!=='object'||Array.isArray(entry.preferences))))throw new Error("Saved preference intent is unavailable; keeping the local copy.");
    return latest;
  }

  function readPreferenceIntent(storage, bundle, ownerId){
    return clone(preferenceSyncBundle(storage,bundle).preferenceSync?.entries.find(entry=>entry.ownerId===ownerId)||null);
  }

  function writePreferenceSync(storage, latest, entries, sections={}){
    const allowed=emptyBundle(latest.profile.id);
    for(const key of Object.keys(sections))if(!Object.hasOwn(allowed,key)||key==='profile'||key==='schemaVersion')throw new Error("Unknown preference section");
    const next=migrateBundle({...latest,...clone(sections),
      profile:{...latest.profile,...(Object.hasOwn(sections,'preferences')?{onboardingCompleted:Boolean(sections.preferences?.onboardingComplete)}:{})},
      preferenceSync:{writer:"owned-preference-intent.v1",entries}},latest.profile.id);
    next.profile.updatedAt=nowIso();
    const body=JSON.stringify(next),key=profileKey(next.profile.id);
    storage.setItem(key,body);
    if(storage.getItem(key)!==body)throw new Error("Preference intent was not saved on this device.");
    return clone(next);
  }

  function recordPreferenceIntent(storage,bundle,{ownerId,generation,baseUpdatedAt,basePreferences,preferences,sections={}}){
    if(typeof ownerId!=='string'||!ownerId||!Number.isSafeInteger(generation)||generation<0
      || !(baseUpdatedAt===null||typeof baseUpdatedAt==='string')||!basePreferences||typeof basePreferences!=='object'||Array.isArray(basePreferences)
      ||!preferences||typeof preferences!=='object'||Array.isArray(preferences))throw new Error("A verified preference baseline is required.");
    const latest=preferenceSyncBundle(storage,bundle),entries=clone(latest.preferenceSync?.entries||[]);
    const prior=entries.find(entry=>entry.ownerId===ownerId);
    if(prior&&(prior.baseUpdatedAt!==baseUpdatedAt||JSON.stringify(canonicalValue(prior.basePreferences))!==JSON.stringify(canonicalValue(basePreferences))))throw new Error("Pending choices need their original server baseline.");
    const receipt={ownerId,generation,receiptId:makeId("preference-edit"),baseUpdatedAt,basePreferences:clone(basePreferences),preferences:clone(preferences)};
    const index=entries.findIndex(entry=>entry.ownerId===ownerId);
    if(index<0)entries.push(receipt);else entries[index]=receipt;
    return writePreferenceSync(storage,latest,entries,sections);
  }

  function acknowledgePreferenceIntent(storage,bundle,receipt,preferences,patches,acknowledgement){
    const observe=(reason,site=11/*ack_witness*/,decision='retained')=>{try{acknowledgement?.observe?.({site,reason,decision});}catch(_error){}};
    try{
      const latest=preferenceSyncBundle(storage,bundle),entries=latest.preferenceSync?.entries||[];
      const current=receipt&&entries.find(entry=>entry.ownerId===receipt.ownerId);
      const original=receipt?.originalReceipt||receipt;
      const retain=reason=>{observe(reason);return clone(latest);};
      if(!current||!original)return retain(43/*ack_current_receipt_unavailable*/);
      if(original.ownerId!==receipt.ownerId||original.receiptId!==receipt.receiptId||original.generation!==receipt.generation)return retain(44/*ack_original_witness_invalid*/);
      if(!preferenceIntentMatches(receipt,preferences,patches))return retain(42/*ack_semantics_mismatch*/);
      if(receipt.originalReceipt&&current.receiptId===receipt.receiptId&&!samePreferenceValues(original,current))return retain(45/*ack_original_receipt_changed*/);
      if(current.receiptId===receipt.receiptId){
        return writePreferenceSync(storage,latest,entries.filter(entry=>entry.ownerId!==receipt.ownerId||entry.receiptId!==receipt.receiptId));
      }
      // An owned in-flight ACK may advance a newer receipt, never clear it.
      if(!patches)return retain(46/*ack_patch_unavailable*/);
      if(current.generation!==acknowledgement?.generation)return retain(47/*ack_newer_generation_rejected*/);
      if(!Number.isFinite(Date.parse(acknowledgement?.updatedAt)))return retain(48/*ack_time_invalid*/);
      if(!preferenceBaseMatches(current,original.basePreferences))return retain(49/*ack_newer_base_incompatible*/);
      const remainingPreferences=receipt.originalReceipt
        ?receipt.continue?.(clone(current),{preferences:clone(preferences),updatedAt:acknowledgement.updatedAt})
        :patches.applyPatch({preferences},patches.createPatch({preferences:receipt.preferences},{preferences:current.preferences})).preferences;
      if(!remainingPreferences)return retain(50/*continuation_refused*/);
      const continued={...current,baseUpdatedAt:acknowledgement.updatedAt,basePreferences:clone(preferences),preferences:remainingPreferences};
      return writePreferenceSync(storage,latest,entries.map(entry=>entry===current?continued:entry));
    }catch(error){observe(56/*unexpected_exception*/,11/*ack_witness*/,'exception');throw error;}
  }

  // These local profile pointers, seed marker and prompt counters do not express a user's
  // choices. Keep every unknown field and deliberate preference in comparison.
  function preferenceDecisions(preferences){
    if(!preferences||typeof preferences!=="object")return preferences;
    const result=clone(preferences),graph=result.preferenceGraph;
    for(const [record,keys] of [
      [graph,["profileId","updatedAt"]],[result.followFirst,["appliedSeedHash"]],
      [graph?.viewing,["profileId"]],[graph?.learning,["profileId"]],
      [result.followFirst?.refinement,["distinctOpenCount","lastOpenId","firstSwipeAt","promptedAt"]],
      [result.ratingPromptState,["sessionCount","lastSessionId"]],
    ])if(record&&typeof record==="object")for(const key of keys)delete record[key];
    for(const key of ["entityFollows","domainPreferences","competitionPreferences"]){
      if(Array.isArray(graph?.[key]))for(const record of graph[key])if(record&&typeof record==="object")delete record.profileId;
    }
    return result;
  }

  function samePreferenceValues(first,second){
    return JSON.stringify(canonicalValue(first))===JSON.stringify(canonicalValue(second));
  }

  function preferenceBaseMatches(receipt,preferences){
    return Boolean(receipt&&samePreferenceValues(preferenceDecisions(receipt.basePreferences),preferenceDecisions(preferences)));
  }

  function advancePreferenceIntentBase(storage,bundle,receipt,state){
    const latest=preferenceSyncBundle(storage,bundle),entries=latest.preferenceSync?.entries||[];
    const current=receipt&&entries.find(entry=>entry.ownerId===receipt.ownerId&&entry.receiptId===receipt.receiptId);
    if(!current||!state||!Number.isFinite(Date.parse(state.updatedAt))
      ||current.baseUpdatedAt===state.updatedAt||!samePreferenceValues(current.basePreferences,state.preferences)
      ||!samePreferenceValues(receipt.basePreferences,state.preferences))return clone(latest);
    return writePreferenceSync(storage,latest,entries.map(entry=>entry===current
      ?{...entry,baseUpdatedAt:state.updatedAt,basePreferences:clone(state.preferences)}:entry));
  }

  function preferenceIntentMatches(receipt,preferences,patches){
    if(!receipt)return false;
    if(receipt.originalReceipt&&Object.hasOwn(receipt,'acceptsAcknowledgement')){
      try{if(typeof receipt.acceptsAcknowledgement!=="function"||receipt.acceptsAcknowledgement(preferences)!==true)return false;}
      catch{return false;}
    }
    const expected=patches
      ? patches.applyPatch({preferences},patches.createPatch({preferences:receipt.basePreferences},{preferences:receipt.preferences})).preferences
      : receipt.preferences;
    return samePreferenceValues(preferenceDecisions(expected),preferenceDecisions(preferences));
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
    readPreferenceIntent,
    recordPreferenceIntent,
    acknowledgePreferenceIntent,
    preferenceIntentMatches,
    preferenceBaseMatches,
    advancePreferenceIntentBase,
    saveSection,
    setUsernameLabel,
  });
});
