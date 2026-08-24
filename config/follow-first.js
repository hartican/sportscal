(function attachNothingSportsFollowFirst(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FIRST = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsFollowFirst(){
  "use strict";

  const SCHEMA_VERSION = "follow-first.v1";
  const META_SCHEMA_VERSION = "user-meta.v1";
  const FEEDBACK_SCHEMA_VERSION = "recommendation-feedback.v1";
  const DEFAULT_RADIUS_KM = 20;
  const MAX_RADIUS_KM = 300;

  const STARTUP_SPORTS = Object.freeze([
    { id:"afl", selectorId:"sport:afl", label:"AFL" },
    { id:"nrl", selectorId:"sport:nrl", label:"NRL" },
    { id:"cricket", selectorId:"sport:cricket", label:"Cricket" },
    { id:"football", selectorId:"sport:football", label:"Football" },
    { id:"tennis", selectorId:"sport:tennis", label:"Tennis" },
    { id:"f1", selectorId:"sport:f1", label:"Formula 1" },
    { id:"rugby", selectorId:"sport:rugby", label:"Rugby Union" },
    { id:"nba", selectorId:"sport:nba", label:"Basketball" },
  ]);

  const MAJOR_EVENT_FAMILIES = Object.freeze([
    { id:"afl-finals", label:"AFL Finals", sportIds:["afl"] },
    { id:"nrl-finals", label:"NRL Finals", sportIds:["nrl"] },
    { id:"state-of-origin", label:"State of Origin", sportIds:["nrl"] },
    { id:"australian-open", label:"Australian Open", sportIds:["tennis"] },
    { id:"australian-grand-prix", label:"Australian Grand Prix", sportIds:["f1"] },
    { id:"fifa-world-cup", label:"FIFA World Cup", sportIds:["football"] },
    { id:"olympic-games", label:"Olympic Games", sportIds:[] },
    { id:"wimbledon", label:"Wimbledon", sportIds:["tennis"] },
  ]);

  const OFFER_INTERESTS = Object.freeze([
    { id:"tickets-live", label:"Tickets & live events" },
    { id:"merch-equipment", label:"Merch & equipment" },
    { id:"streaming-venues", label:"Streaming & places to watch" },
    { id:"sports-travel", label:"Sports travel" },
  ]);

  const VIEWING_PROVIDERS = Object.freeze({
    kayo:{ label:"Kayo Sports", url:"https://kayosports.com.au/" },
    stan:{ label:"Stan Sport", url:"https://www.stan.com.au/sport" },
    seven:{ label:"7plus", url:"https://7plus.com.au/" },
    nine:{ label:"9Now", url:"https://www.9now.com.au/" },
    sbs:{ label:"SBS On Demand", url:"https://www.sbs.com.au/ondemand/sport" },
    foxtel:{ label:"Foxtel", url:"https://www.foxtel.com.au/watch.html" },
    optus:{ label:"Optus Sport", url:"https://sport.optus.com.au/" },
    paramount:{ label:"Paramount+", url:"https://www.paramountplus.com/au/" },
  });

  function uniqueAllowed(values, records){
    const allowed = new Set(records.map(record => record.id));
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(value => allowed.has(value))));
  }

  function roundCoordinate(value){
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
  }

  function normalizeLocation(input){
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const radiusKm = Math.max(1, Math.min(MAX_RADIUS_KM, Number(source.radiusKm) || DEFAULT_RADIUS_KM));
    const mode = ["automatic", "home", "travel"].includes(source.mode) ? source.mode : "home";
    const label = String(source.label || source.city || source.postcode || source.area || "").trim().slice(0, 120);
    const region = String(source.region || source.state || "").trim().slice(0, 80);
    const countryCode = String(source.countryCode || "AU").trim().toUpperCase().slice(0, 2) || "AU";
    return {
      mode,
      label,
      region,
      countryCode,
      latitude:roundCoordinate(source.latitude),
      longitude:roundCoordinate(source.longitude),
      radiusKm,
      source:["system", "places", "manual", "unset"].includes(source.source) ? source.source : "unset",
      updatedAt:source.updatedAt && !Number.isNaN(Date.parse(source.updatedAt)) ? new Date(source.updatedAt).toISOString() : null,
    };
  }

  function canonical(value){
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonical(value[key]);
      return result;
    }, {});
  }

  function hashString(value){
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1){
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `ff_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function normalizeMeta(input){
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const sports = uniqueAllowed(source.sports, STARTUP_SPORTS);
    const meta = {
      schemaVersion:META_SCHEMA_VERSION,
      revision:Math.max(1, Number(source.revision) || 1),
      sports:sports.length ? sports : ["afl", "nrl"],
      majorEvents:uniqueAllowed(source.majorEvents, MAJOR_EVENT_FAMILIES),
      offerInterests:uniqueAllowed(source.offerInterests, OFFER_INTERESTS),
      location:normalizeLocation(source.location),
      personalisedOffersConsent:source.personalisedOffersConsent === true,
      consentUpdatedAt:source.personalisedOffersConsent === true && !Number.isNaN(Date.parse(source.consentUpdatedAt || ""))
        ? new Date(source.consentUpdatedAt).toISOString()
        : null,
      source:["signup", "user", "admin", "local"].includes(source.source) ? source.source : "local",
    };
    meta.seedHash = hashString(JSON.stringify(canonical({
      sports:meta.sports,
      majorEvents:meta.majorEvents,
      location:meta.location,
    })));
    return meta;
  }

  function defaultFollowFirst(){
    return {
      schemaVersion:SCHEMA_VERSION,
      startupMeta:normalizeMeta({}),
      appliedSeedHash:null,
      australiansOnlySportIds:["afl", "nrl"],
      followedMajorEventIds:[],
      location:normalizeLocation({}),
      subscriptions:[],
      notifications:{ enabled:false, defaultLeadMinutes:15, permissionPromptedAt:null },
      refinement:{ distinctOpenCount:0, lastOpenId:null, firstSwipeAt:null, promptedAt:null, completedAt:null, deferred:false },
      feedback:{ schemaVersion:FEEDBACK_SCHEMA_VERSION, sequence:0, entries:[] },
    };
  }

  function normalizeFeedback(input){
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const entries = (Array.isArray(source.entries) ? source.entries : []).slice(-500).map((entry, index) => ({
      id:String(entry?.id || `feedback_${index + 1}`),
      eventId:String(entry?.eventId || ""),
      direction:entry?.direction === "negative" ? "negative" : "positive",
      weight:Number(entry?.weight) === -1 || entry?.direction === "negative" ? -1 : 1,
      targetType:String(entry?.targetType || "event").slice(0, 40),
      targetId:String(entry?.targetId || entry?.eventId || "").slice(0, 180),
      occurredAt:!Number.isNaN(Date.parse(entry?.occurredAt || "")) ? new Date(entry.occurredAt).toISOString() : new Date(0).toISOString(),
      sequence:Math.max(1, Number(entry?.sequence) || index + 1),
    })).filter(entry => entry.eventId && entry.targetId);
    return { schemaVersion:FEEDBACK_SCHEMA_VERSION, sequence:Math.max(Number(source.sequence) || 0, entries.at(-1)?.sequence || 0), entries };
  }

  function migratePreferences(input){
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const prior = source.followFirst && typeof source.followFirst === "object" ? source.followFirst : {};
    const defaults = defaultFollowFirst();
    const startupMeta = normalizeMeta(prior.startupMeta || source.startupMeta || {});
    return {
      ...source,
      version:Math.max(16, Number(source.version) || 0),
      followFirst:{
        ...defaults,
        ...prior,
        schemaVersion:SCHEMA_VERSION,
        startupMeta,
        appliedSeedHash:String(prior.appliedSeedHash || "") || null,
        australiansOnlySportIds:uniqueAllowed(prior.australiansOnlySportIds || startupMeta.sports, STARTUP_SPORTS),
        followedMajorEventIds:uniqueAllowed(prior.followedMajorEventIds || startupMeta.majorEvents, MAJOR_EVENT_FAMILIES),
        location:normalizeLocation(prior.location || startupMeta.location),
        subscriptions:Array.from(new Set((Array.isArray(prior.subscriptions) ? prior.subscriptions : []).map(String).filter(id => VIEWING_PROVIDERS[id]))),
        notifications:{
          ...defaults.notifications,
          ...(prior.notifications || {}),
          enabled:prior.notifications?.enabled === true,
          defaultLeadMinutes:15,
        },
        refinement:{ ...defaults.refinement, ...(prior.refinement || {}) },
        feedback:normalizeFeedback(prior.feedback),
      },
    };
  }

  function selectorIdsForSports(sportIds){
    const selected = new Set(uniqueAllowed(sportIds, STARTUP_SPORTS));
    return STARTUP_SPORTS.filter(sport => selected.has(sport.id)).map(sport => sport.selectorId);
  }

  function applyMetaSeed(preferences, metaInput){
    const meta = normalizeMeta(metaInput);
    const current = migratePreferences(preferences);
    if (current.followFirst.appliedSeedHash === meta.seedHash) return { preferences:current, changed:false };
    const next = migratePreferences({
      ...current,
      selectedSelectorEntityIds:selectorIdsForSports(meta.sports),
      followedSports:meta.sports.slice(),
      followFirst:{
        ...current.followFirst,
        startupMeta:meta,
        appliedSeedHash:meta.seedHash,
        australiansOnlySportIds:meta.sports.slice(),
        followedMajorEventIds:meta.majorEvents.slice(),
        location:meta.location,
      },
    });
    return { preferences:next, changed:true };
  }

  function eventText(event){
    return [event?.name, event?.displayTitleCompact, event?.competitionName, event?.stage, event?.roundLabel]
      .filter(Boolean).join(" ").toLowerCase();
  }

  function participantIds(event){
    return Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participants) ? event.participants.map(participant => participant?.id || participant?.participantId) : []),
      event?.homeTeamId,
      event?.awayTeamId,
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].map(value => String(value || "")).filter(Boolean)));
  }

  function reasonForEvent(event, preferences, { participantLabel = id => id } = {}){
    const next = migratePreferences(preferences);
    const follows = new Map((next.preferenceGraph?.entityFollows || []).map(follow => [String(follow.participantId), follow]));
    for (const id of participantIds(event)){
      const follow = follows.get(id);
      if (follow && ["follow", "priority"].includes(follow.followLevel)){
        return { type:id.startsWith("team:") ? "team" : "athlete", id, label:`Because you follow ${participantLabel(id)}` };
      }
    }
    const sportId = String(event?.sportId || event?.key || "");
    const inherentlyAustralianCompetition = ["afl", "nrl"].includes(sportId);
    if (next.followFirst.australiansOnlySportIds.includes(sportId) && (inherentlyAustralianCompetition || event?.australianInterest || /australia|aussie|socceroos|matildas|wallabies/.test(eventText(event)))){
      return { type:"australians", id:sportId, label:"Because you follow Aussies Only" };
    }
    return null;
  }

  function stageLabel(event){
    const value = `${event?.stage || ""} ${event?.roundLabel || ""} ${event?.round || ""}`.toLowerCase();
    if (/wild\s*card/.test(value)) return "Wildcard";
    if (/prelim/.test(value)) return "Prelim";
    if (/quarter|\bqf\b/.test(value)) return "QF";
    if (/semi|\bsf\b/.test(value)) return "Semis";
    if (/grand final|\bfinals?\b/.test(value)) return "Finals";
    return "";
  }

  function appendFeedback(preferences, input){
    const next = migratePreferences(preferences);
    const feedback = normalizeFeedback(next.followFirst.feedback);
    const sequence = feedback.sequence + 1;
    const entry = {
      id:`feedback_${sequence}`,
      eventId:String(input?.eventId || ""),
      direction:input?.direction === "negative" ? "negative" : "positive",
      weight:input?.direction === "negative" ? -1 : 1,
      targetType:String(input?.targetType || "event"),
      targetId:String(input?.targetId || input?.eventId || ""),
      occurredAt:new Date(input?.occurredAt || Date.now()).toISOString(),
      sequence,
    };
    return migratePreferences({
      ...next,
      followFirst:{ ...next.followFirst, feedback:{ schemaVersion:FEEDBACK_SCHEMA_VERSION, sequence, entries:[...feedback.entries, entry].slice(-500) } },
    });
  }

  function registerOpen(preferences, openId){
    const next = migratePreferences(preferences);
    const refinement = { ...next.followFirst.refinement };
    const id = String(openId || "");
    if (id && refinement.lastOpenId !== id){
      refinement.distinctOpenCount = Math.max(0, Number(refinement.distinctOpenCount) || 0) + 1;
      refinement.lastOpenId = id;
    }
    return migratePreferences({ ...next, followFirst:{ ...next.followFirst, refinement } });
  }

  function shouldPromptRefinement(preferences){
    const refinement = migratePreferences(preferences).followFirst.refinement;
    return !refinement.promptedAt && !refinement.completedAt
      && (Number(refinement.distinctOpenCount) >= 3 || Boolean(refinement.firstSwipeAt));
  }

  function viewingLink(event, selectedProviderIds = []){
    const text = [event?.broadcaster, ...(event?.broadcasterIds || []), ...(event?.broadcastOptions || [])].join(" ").toLowerCase();
    const ordered = Array.from(new Set([...(selectedProviderIds || []), ...Object.keys(VIEWING_PROVIDERS)]));
    const providerId = ordered.find(id => VIEWING_PROVIDERS[id] && text.includes(id))
      || ordered.find(id => VIEWING_PROVIDERS[id]);
    const provider = VIEWING_PROVIDERS[providerId];
    return provider ? { providerId, ...provider } : null;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    META_SCHEMA_VERSION,
    FEEDBACK_SCHEMA_VERSION,
    DEFAULT_RADIUS_KM,
    MAX_RADIUS_KM,
    STARTUP_SPORTS,
    MAJOR_EVENT_FAMILIES,
    OFFER_INTERESTS,
    VIEWING_PROVIDERS,
    normalizeLocation,
    normalizeMeta,
    migratePreferences,
    selectorIdsForSports,
    applyMetaSeed,
    reasonForEvent,
    stageLabel,
    appendFeedback,
    registerOpen,
    shouldPromptRefinement,
    viewingLink,
  });
});
