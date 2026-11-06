(function attachProfileStorage(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PROFILE_STORAGE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildProfileStorage(){
  "use strict";

  const PROFILE_SCHEMA_VERSION = 6;
  const INSTALL_SCHEMA_VERSION = 1;
  const CACHE_SCHEMA_VERSION = 2;
  const freshLocalProfileIds = new Set();
  const KEYS = Object.freeze({
    install: "ns_install_v1",
    activeProfileId: "ns_active_profile_id_v1",
    profilePrefix: "ns_profile_v1:",
    accountTransition: "ns_account_transition_v1",
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
    if(!stored&&freshLocalProfileIds.size<32&&!Object.values(LEGACY_KEYS).flat().some(legacyKey=>storage.getItem(legacyKey)!==null))freshLocalProfileIds.add(install.activeProfileId);
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

  // Deliberate device-only discard, not an acknowledgement or ordinary bundle save.
  function recoverPreferences(storage, bundle, { ownerId, expectedRaw, expectedReceipt, sections }){
    const key=profileKey(bundle?.profile?.id);
    const latestRaw=storage.getItem(key);
    if(typeof expectedRaw!=="string"||latestRaw!==expectedRaw)throw new Error("Local choices changed; reopen recovery.");
    const latest=JSON.parse(latestRaw),sync=latest.preferenceSync;
    if(latest.schemaVersion!==PROFILE_SCHEMA_VERSION||latest.profile?.id!==bundle?.profile?.id
      ||sync?.writer!=="owned-preference-intent.v1"||!Array.isArray(sync.entries)
      ||sync.entries.filter(entry=>entry.ownerId===ownerId).length!==1
      ||!samePreferenceValues(sync.entries.find(entry=>entry.ownerId===ownerId),expectedReceipt))throw new Error("The pending preference request changed.");
    const allowed=["preferences","domainPreferences","competitionPreferences","entityFollows","viewingPreference","learningPreference"];
    if(!sections||Object.keys(sections).length!==allowed.length||!allowed.every(name=>Object.hasOwn(sections,name)))throw new Error("Incomplete recovery preferences.");
    const next={...latest,...clone(sections),preferenceSync:{...sync,entries:sync.entries.filter(entry=>entry.ownerId!==ownerId)}};
    const text=JSON.stringify(next);
    try{
      storage.setItem(key,text);
      const readback=storage.getItem(key);
      if(readback!==text){
        // Never overwrite a different, newer value found during verification.
        if(readback===latestRaw)throw new Error("Local recovery was not stored.");
        throw new Error("Local choices changed during recovery.");
      }
    }catch(error){
      // Native localStorage is synchronous. Roll back only our own unverified write.
      let current;try{current=storage.getItem(key);}catch(_readError){
        throw Object.assign(new Error("Local recovery completion is unknown; sync must remain paused."),{code:"local_recovery_storage_uncertain"});
      }
      if(current===text){
        try{storage.setItem(key,latestRaw);if(storage.getItem(key)!==latestRaw)throw new Error("Unverified rollback");}
        catch(_rollbackError){throw Object.assign(new Error("Local recovery rollback could not be verified; sync must remain paused."),{code:"local_recovery_storage_uncertain"});}
      }
      throw error;
    }
    return clone(next);
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

  function recordPreferenceIntent(storage,bundle,{ownerId,generation,baseUpdatedAt,basePreferences,preferences,sections={},expectedReceipt}){
    if(typeof ownerId!=='string'||!ownerId||!Number.isSafeInteger(generation)||generation<0
      || !(baseUpdatedAt===null||typeof baseUpdatedAt==='string')||!basePreferences||typeof basePreferences!=='object'||Array.isArray(basePreferences)
      ||!preferences||typeof preferences!=='object'||Array.isArray(preferences))throw new Error("A verified preference baseline is required.");
    const latest=preferenceSyncBundle(storage,bundle),entries=clone(latest.preferenceSync?.entries||[]);
    const prior=entries.find(entry=>entry.ownerId===ownerId);
    if(expectedReceipt!==undefined&&!samePreferenceValues(prior||null,expectedReceipt))throw new Error("Pending choices changed; retry your follow change.");
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

  // A cold deliberate writer can extend retained intent without loading the
  // Account helper. Only its two already-defined, typed device-local views may
  // differ; every other projected choice remains part of the comparison.
  function preferenceIntentCurrentMatches(receipt,preferences){
    const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
    const text=value=>typeof value==='string';
    const valid=value=>{
      if(!object(value)||(value.feedCompact!==undefined&&typeof value.feedCompact!=='boolean'))return false;
      if(value.followBrowse===undefined)return true;
      const fields={sportId:text,categoryId:text,section:v=>['teams-players','schedule'].includes(v),
        page:v=>Number.isSafeInteger(v)&&v>=0,
        scheduleScope:v=>v===null||(object(v)&&Object.keys(v).length===4&&['codeId','tournamentId','competitionId','label'].every(k=>text(v[k])))};
      return object(value.followBrowse)&&Object.keys(value.followBrowse).every(k=>Object.hasOwn(fields,k)&&fields[k](value.followBrowse[k]));
    };
    if(!valid(receipt?.preferences)||!valid(preferences))return false;
    const comparable=value=>{const result=preferenceDecisions(value);delete result.followBrowse;delete result.feedCompact;return result;};
    return samePreferenceValues(comparable(receipt.preferences),comparable(preferences));
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

  // One pending device handoff, at most four account profiles, and the original
  // device profile. Captures are inert history, never server intent or Auth.
  function readAccountTransition(storage){
    const raw=storage.getItem(KEYS.accountTransition);
    if(!raw)return null;
    if(raw.length>3*1024*1024)throw new Error('The saved device handoff is too large to safely read.');
    let value;
    try{value=JSON.parse(raw);}catch(_error){throw new Error('The saved device handoff needs recovery. Your device copies have not been replaced.');}
    if(value?.schemaVersion!==1||!Array.isArray(value.accounts)||value.accounts.length>4
      ||typeof value.deviceProfileId!=='string'||!value.deviceProfileId
      ||value.accounts.some(item=>!item||typeof item.accountId!=='string'||!item.accountId||item.accountId.length>128||typeof item.profileId!=='string'||!item.profileId||Object.keys(item).some(key=>!['accountId','profileId'].includes(key)))
      ||new Set(value.accounts.map(item=>item.accountId)).size!==value.accounts.length
      ||new Set(value.accounts.map(item=>item.profileId)).size!==value.accounts.length
      ||Object.keys(value).some(key=>!['schemaVersion','deviceProfileId','accounts','pending'].includes(key)))throw new Error('The saved device handoff needs recovery.');
    if(value.pending&&(!['pending','resolved','cancelled','awaiting'].includes(value.pending.status)||typeof value.pending.id!=='string'
      ||typeof value.pending.sourceRaw!=='string'||typeof value.pending.preferencesRaw!=='string'
      ||typeof value.pending.sourceProfileId!=='string'
      ||Object.keys(value.pending).some(key=>!['id','status','sourceProfileId','sourceOwnerId','generation','sourceRaw','preferencesRaw','capturedAt','targetAccountId','targetProfileId','freshGuest','associationRequired','remoteStateWasPresent','resolvedAt'].includes(key))))throw new Error('The saved device handoff is incomplete.');
    if(value.pending){
      const pending=value.pending;
      try{
        const source=JSON.parse(pending.sourceRaw),preferences=JSON.parse(pending.preferencesRaw);
        if(pending.sourceRaw.length>2*1024*1024||pending.preferencesRaw.length>512*1024
          ||source?.profile?.id!==pending.sourceProfileId||!preferences||typeof preferences!=='object'||Array.isArray(preferences)
          ||!pending.id||!Number.isSafeInteger(pending.generation)||!Number.isFinite(Date.parse(pending.capturedAt))
          ||(pending.sourceOwnerId!==null&&(typeof pending.sourceOwnerId!=='string'||!pending.sourceOwnerId))
          ||(pending.targetAccountId!==null&&(typeof pending.targetAccountId!=='string'||!pending.targetAccountId))
          ||(pending.targetProfileId!==null&&(typeof pending.targetProfileId!=='string'||!pending.targetProfileId))
          ||Boolean(pending.targetAccountId)!==Boolean(pending.targetProfileId)||typeof pending.freshGuest!=='boolean')throw new Error('invalid');
      }catch(_error){throw new Error('The preserved device choices need recovery. Your current copy has not been replaced.');}
    }
    return value;
  }
  function writeAccountTransition(storage,value){
    const raw=JSON.stringify(value);
    if(raw.length>3*1024*1024)throw new Error('There is not enough space to keep these device choices safely.');
    storage.setItem(KEYS.accountTransition,raw);
    if(storage.getItem(KEYS.accountTransition)!==raw)throw new Error('The device handoff save could not be confirmed.');
    return clone(value);
  }
  function captureAccountTransition(storage,bundle,{preferences,ownerId=null,generation,current}){
    if(typeof current!=='function'||!current()||!Number.isSafeInteger(generation))throw new Error('Your sign-in changed. Reopen Account before continuing.');
    const sourceProfileId=bundle?.profile?.id;
    if(typeof sourceProfileId!=='string'||parseStored(storage,KEYS.activeProfileId)!==sourceProfileId)throw new Error('Your local profile changed. Reopen Account.');
    const sourceRaw=storage.getItem(profileKey(sourceProfileId)),preferencesRaw=JSON.stringify(preferences);
    if(typeof sourceRaw!=='string'||JSON.parse(sourceRaw)?.profile?.id!==sourceProfileId||sourceRaw.length>2*1024*1024
      ||typeof preferencesRaw!=='string'||preferencesRaw.length>512*1024)throw new Error('Your device choices could not be safely preserved.');
    const record=readAccountTransition(storage)||{schemaVersion:1,deviceProfileId:sourceProfileId,accounts:[],pending:null};
    if(record.pending?.status==='pending'){
      const old=record.pending;
      if(old.sourceProfileId===sourceProfileId&&old.sourceRaw===sourceRaw&&old.preferencesRaw===preferencesRaw&&old.sourceOwnerId===ownerId&&current())return clone(old);
      throw new Error('Review the previous device handoff in Account before starting another sign-in. Your copies are kept.');
    }
    record.pending={id:makeId('account-handoff'),status:'pending',sourceProfileId,sourceOwnerId:ownerId,generation,
      sourceRaw,preferencesRaw,capturedAt:nowIso(),targetAccountId:null,targetProfileId:null,
      freshGuest:freshLocalProfileIds.has(sourceProfileId)&&!ownerId&&!record.accounts.some(item=>item.profileId===sourceProfileId)};
    writeAccountTransition(storage,record);
    if(!current()||storage.getItem(profileKey(sourceProfileId))!==sourceRaw||parseStored(storage,KEYS.activeProfileId)!==sourceProfileId)throw new Error('Your device choices changed while being preserved. Sign-in has not started.');
    return clone(record.pending);
  }
  function activateAccountProfile(storage,capture,{accountId,preferenceVersion,hasRemoteState,current}){
    if(typeof accountId!=='string'||!accountId||accountId.length>128||typeof current!=='function'||!current())throw new Error('The target account is not verified.');
    const record=readAccountTransition(storage),pending=record?.pending;
    if(!pending||pending.status!=='pending'||pending.id!==capture?.id)throw new Error('The saved device handoff changed.');
    let owned=record.accounts.find(item=>item.accountId===accountId);
    if(!owned&&record.accounts.length>=4)throw new Error('Four accounts are already kept on this device. Your existing copies remain available.');
    const sourceOwned=record.accounts.find(item=>item.profileId===pending.sourceProfileId);
    if(!owned&&pending.sourceOwnerId===accountId)owned={accountId,profileId:pending.sourceProfileId};
    const activeId=parseStored(storage,KEYS.activeProfileId);
    if(pending.targetAccountId&&pending.targetAccountId!==accountId)throw new Error('This handoff belongs to another account.');
    if(activeId!==pending.sourceProfileId&&activeId!==pending.targetProfileId)throw new Error('Your local profile changed during sign-in.');
    if(storage.getItem(profileKey(pending.sourceProfileId))!==pending.sourceRaw)throw new Error('The preserved source changed. Your copies need review before account loading.');
    if(!owned){
      if(record.accounts.length>=4)throw new Error('Four accounts are already kept on this device. Your existing copies remain available.');
      owned={accountId,profileId:'profile:account:'+accountId};
      const target=emptyBundle(owned.profileId,new Date(pending.capturedAt));
      if(!Number.isSafeInteger(preferenceVersion)||preferenceVersion<1)throw new Error('The current preference schema is unavailable.');
      target.preferences={version:preferenceVersion,onboardingComplete:true,selectedSelectorEntityIds:[],followedSports:[]};
      const receipt=readPreferenceIntent(storage,{profile:{id:pending.sourceProfileId}},accountId);
      if(receipt){
        // Carry this owner's original receipt unchanged, never another owner's
        // current displayed choices or a newly manufactured guest receipt.
        target.preferenceSync={writer:'owned-preference-intent.v1',entries:[clone(receipt)]};
        target.preferences=clone(receipt.preferences);
        const graph=receipt.preferences?.preferenceGraph||{};
        for(const [section,key] of [['domainPreferences','domainPreferences'],['competitionPreferences','competitionPreferences'],['entityFollows','entityFollows'],['viewingPreference','viewing'],['learningPreference','learning']])if(Object.hasOwn(graph,key))target[section]=clone(graph[key]);
      }
      const raw=JSON.stringify(target),key=profileKey(owned.profileId),existing=storage.getItem(key);
      if(existing!==null&&existing!==raw)throw new Error('An existing account copy needs recovery; it has not been replaced.');
      if(existing===null)storage.setItem(key,raw);
      if(storage.getItem(key)!==raw||!current())throw new Error('The separate account copy could not be confirmed.');
    }
    if(!record.accounts.some(item=>item.accountId===accountId))record.accounts.push(owned);
    const associationRequired=!sourceOwned&&!pending.sourceOwnerId&&owned.profileId!==pending.sourceProfileId;
    pending.targetAccountId=accountId;pending.targetProfileId=owned.profileId;pending.associationRequired=associationRequired;pending.remoteStateWasPresent=hasRemoteState===true;
    writeAccountTransition(storage,record);
    if(!current()||storage.getItem(profileKey(pending.sourceProfileId))!==pending.sourceRaw)throw new Error('Your device copy changed in another window. It is kept separately; review it before account loading.');
    storage.setItem(KEYS.activeProfileId,JSON.stringify(owned.profileId));
    if(parseStored(storage,KEYS.activeProfileId)!==owned.profileId||!current())throw new Error('The account copy could not be activated safely.');
    const target=loadActiveProfile(storage);
    return {bundle:target,pending:clone(pending),associationRequired};
  }
  function completeAccountTransition(storage,capture,{accountId,current}){
    const record=readAccountTransition(storage),pending=record?.pending;
    if(!pending||pending.id!==capture?.id||pending.targetAccountId!==accountId||!current()
      ||parseStored(storage,KEYS.activeProfileId)!==pending.targetProfileId)throw new Error('The account handoff changed; your copies are kept.');
    // Resolve only after explicit keep-separate or owned association ACK. The
    // original source profile remains; the last raw capture stays until a later
    // explicit handoff replaces this resolved record. Never clear any receipt.
    pending.status='resolved';pending.resolvedAt=nowIso();
    return writeAccountTransition(storage,record);
  }
  function cancelAccountTransition(storage,capture,{current}){
    const record=readAccountTransition(storage),pending=record?.pending;
    if(!pending||pending.id!==capture?.id||pending.targetAccountId||!current()
      ||parseStored(storage,KEYS.activeProfileId)!==pending.sourceProfileId)throw new Error('The handoff changed; your device copies are kept.');
    // Keep a durable no-import fence: another tab may still have an Auth/read
    // response in flight. Only another explicit Auth capture replaces this hold.
    pending.status='cancelled';pending.resolvedAt=nowIso();
    return writeAccountTransition(storage,record);
  }
  function awaitSignupConfirmation(storage,capture,{current}){
    const record=readAccountTransition(storage),pending=record?.pending;
    if(!pending||pending.status!=='pending'||pending.id!==capture?.id||pending.targetAccountId||!current()
      ||parseStored(storage,KEYS.activeProfileId)!==pending.sourceProfileId)throw new Error('Signup was accepted, but the local handoff could not be updated. Your device copies are kept.');
    // Retain an inert snapshot; the next deliberate Auth capture takes the
    // latest guest choices rather than locking the guest to this old snapshot.
    pending.status='awaiting';return writeAccountTransition(storage,record);
  }
  function activateDeviceProfile(storage,{current,allowPending=false}){
    const record=readAccountTransition(storage);
    if(!record?.deviceProfileId||(record.pending?.status==='pending'&&!allowPending)||!current())throw new Error('Finish the device handoff before returning to your device copy.');
    const raw=storage.getItem(profileKey(record.deviceProfileId));
    if(!raw||JSON.parse(raw)?.profile?.id!==record.deviceProfileId)throw new Error('The original device copy is unavailable; no current copy has been replaced.');
    storage.setItem(KEYS.activeProfileId,JSON.stringify(record.deviceProfileId));
    if(parseStored(storage,KEYS.activeProfileId)!==record.deviceProfileId||!current())throw new Error('The device copy could not be activated.');
    return loadActiveProfile(storage);
  }
  function withAccountTransitionLock(operation){
    const locks=globalThis.navigator?.locks;
    if(!locks?.request)return Promise.reject(Object.assign(new Error('This browser cannot safely keep separate account copies. Continue as a guest or update your browser before signing in.'),{code:'account_transition_blocked'}));
    return locks.request('ns-account-transition-v1',{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock)throw new Error('Another tab is keeping device choices safe. Wait a moment, then try again.');
      return operation();
    }).catch(error=>{error.code='account_transition_blocked';throw error;});
  }

  return Object.freeze({
    PROFILE_SCHEMA_VERSION,
    INSTALL_SCHEMA_VERSION,
    CACHE_SCHEMA_VERSION,
    KEYS,
    loadActiveProfile,
    saveBundle,
    commitSections,
    recoverPreferences,
    readPreferenceIntent,
    recordPreferenceIntent,
    acknowledgePreferenceIntent,
    preferenceIntentMatches,
    preferenceBaseMatches,
    preferenceIntentCurrentMatches,
    advancePreferenceIntentBase,
    saveSection,
    setUsernameLabel,
    readAccountTransition,
    captureAccountTransition:(...args)=>withAccountTransitionLock(()=>captureAccountTransition(...args)),
    activateAccountProfile:(...args)=>withAccountTransitionLock(()=>activateAccountProfile(...args)),
    completeAccountTransition:(...args)=>withAccountTransitionLock(()=>completeAccountTransition(...args)),
    cancelAccountTransition:(...args)=>withAccountTransitionLock(()=>cancelAccountTransition(...args)),
    awaitSignupConfirmation:(...args)=>withAccountTransitionLock(()=>awaitSignupConfirmation(...args)),
    activateDeviceProfile:(...args)=>withAccountTransitionLock(()=>activateDeviceProfile(...args)),
  });
});
