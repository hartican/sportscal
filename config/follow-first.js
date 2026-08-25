(function attachNothingSportsFollowFirst(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FIRST = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsFollowFirst(){
  "use strict";

  const SCHEMA_VERSION = "follow-first.v3";
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
    { id:"cincinnati-open", label:"Cincinnati Open", sportIds:["tennis"] },
    { id:"us-open", label:"US Open", sportIds:["tennis"] },
    { id:"rugby-league-world-cup", label:"Rugby League World Cup", sportIds:["nrl"] },
    { id:"nations-championship", label:"Nations Championship", sportIds:["rugby"] },
    { id:"uefa-champions-league", label:"UEFA Champions League", sportIds:["football"] },
  ]);

  const INTERNATIONAL_AUSTRALIA_SPORT_IDS = Object.freeze([
    "cricket", "football", "tennis", "f1", "rugby", "nba", "motorsport", "rally",
    "extreme", "skateboard", "surf", "wsl", "big-wave", "cycling", "tdf", "basketball",
    "golf", "masters", "ski", "alpine", "freestyle", "telemark", "cwg", "multi-sport",
    "athletics", "swimming", "netball", "hockey", "gymnastics", "boxing",
  ]);

  const OFFER_INTERESTS = Object.freeze([
    { id:"tickets-live", label:"Tickets & live events" },
    { id:"merch-equipment", label:"Merch & equipment" },
    { id:"streaming-venues", label:"Streaming & places to watch" },
    { id:"sports-travel", label:"Sports travel" },
  ]);

  const VIEWING_PROVIDERS = Object.freeze({
    kayo:{ label:"Kayo Sports", actionLabel:"Kayo", webUrl:"https://kayosports.com.au/en-AU/schedule", universalUrl:"https://kayosports.com.au/en-AU/schedule", paid:true, territory:"AU", accessType:"subscription", aliases:["kayo"], logoPath:"assets/providers/kayo-sports-negative.svg", logoBackground:"#111111" },
    foxtel:{ label:"Foxtel", actionLabel:"Foxtel", webUrl:"https://www.foxtel.com.au/watch.html", paid:true, territory:"AU", accessType:"subscription", aliases:["foxtel", "fox sports"], logoPath:"assets/providers/foxtel.svg", logoBackground:"#ffffff" },
    stan:{ label:"Stan Sport", actionLabel:"Stan Sport", webUrl:"https://www.stan.com.au/sport", appScheme:"stan://au.com.stan.and/", paid:true, territory:"AU", accessType:"subscription", aliases:["stan sport", "stan"], logoPath:"assets/providers/stan-sport.jpg", logoBackground:"#0877f9" },
    optus:{ label:"Optus Sport", actionLabel:"Optus Sport", webUrl:"https://sport.optus.com.au/", paid:true, territory:"AU", accessType:"subscription", aliases:["optus sport", "optus"] },
    paramount:{ label:"Paramount+", actionLabel:"Paramount+", webUrl:"https://www.paramountplus.com/au/", paid:true, territory:"AU", accessType:"subscription", aliases:["paramount+", "paramount plus", "paramount"], logoPath:"assets/providers/paramount-plus.svg", logoBackground:"#ffffff" },
    seven:{ label:"7plus", actionLabel:"7plus", webUrl:"https://7plus.com.au/", paid:false, territory:"AU", accessType:"free", aliases:["7plus", "channel 7", "seven"] },
    nine:{ label:"9Now", actionLabel:"9Now", webUrl:"https://www.9now.com.au/", paid:false, territory:"AU", accessType:"free", aliases:["9now", "channel 9", "nine"] },
    sbs:{ label:"SBS On Demand", actionLabel:"SBS", webUrl:"https://www.sbs.com.au/ondemand/sport", paid:false, territory:"AU", accessType:"free", aliases:["sbs on demand", "sbs"] },
    "nba-pass":{ label:"NBA League Pass", webUrl:"https://www.nba.com/watch/league-pass-stream", paid:true, aliases:[] },
    dazn:{ label:"DAZN NFL Game Pass", webUrl:"https://www.dazn.com/en-AU/l/nfl-game-pass", paid:true, aliases:[] },
    "prime-video":{ label:"Prime Video", webUrl:"https://www.primevideo.com/", paid:true, aliases:[] },
    goodwood:{ label:"Goodwood", webUrl:"https://goodwood.com/", paid:false, aliases:[] },
    youtube:{ label:"YouTube", actionLabel:"YouTube", webUrl:"https://www.youtube.com/", paid:false, territory:"GLOBAL", accessType:"free", aliases:["youtube", "you tube"] },
    "watch-afl":{ label:"Watch AFL", actionLabel:"Watch AFL", webUrl:"https://www.watchafl.com.au/", paid:true, territory:"ROW", accessType:"subscription", aliases:["watch afl", "watchafl"] },
  });

  const RIGHTS_VERIFIED_AT = "2026-08-25T00:00:00.000Z";

  function viewingRights(competitionAliases, providerIds, sourceUrl, overrides = {}){
    return Object.freeze({
      competitionAliases:Object.freeze(competitionAliases),
      providerIds:Object.freeze(providerIds),
      territory:"AU",
      liveOrReplay:"both",
      rightsScope:"competition",
      sourceUrl,
      verifiedAt:RIGHTS_VERIFIED_AT,
      ...overrides,
    });
  }

  const COMPETITION_VIEWING_RIGHTS = Object.freeze({
    "competition:premier-league":viewingRights(["competition:premier-league"], ["stan"], "https://www.stan.com.au/watch/sport/football/premier-league", { sourceIsProvider:true }),
    "competition:uefa-champions-league":viewingRights(["competition:uefa-champions-league"], ["stan"], "https://www.stan.com.au/watch/sport/football/uefa-champions-league", { sourceIsProvider:true }),
    "competition:tennis:us-open":viewingRights(["competition:tennis:us-open", "us-open"], ["stan"], "https://www.stan.com.au/watch/sport/tennis", { sourceIsProvider:true }),
    "competition:afl":viewingRights(["competition:afl"], ["kayo", "foxtel", "seven", "watch-afl"], "https://www.afl.com.au/matches/broadcast-guide/broadcast-rights", { liveOrReplay:"live", grandFinalProviderIds:Object.freeze(["seven"]) }),
    "competition:nrl":viewingRights(["competition:nrl"], ["kayo", "foxtel"], null, { grandFinalProviderIds:Object.freeze(["nine"]) }),
    "competition:rugby-league-world-cup":viewingRights(["competition:rugby-league-world-cup", "rlwc2026"], ["seven"], null, { matchPriority:1 }),
    "sport:rugby-union":viewingRights(["sport:rugby-union", "rugby"], ["stan"], "https://www.stan.com.au/watch/sport/rugby", { rightsScope:"sport", sourceIsProvider:true }),
    "competition:formula-one":viewingRights(["competition:formula-one", "f1"], ["kayo", "foxtel"], null),
    "competition:cricket-australia":viewingRights(["competition:cricket-australia", "boxing-day-test", "new-year-s-test", "the-ashes"], ["kayo", "foxtel", "seven"], null),
    "competition:icc-cricket":viewingRights(["competition:icc", "icc-world-cup", "icc-champions-trophy"], ["prime-video"], null),
    "competition:nba":viewingRights(["competition:nba"], ["nba-pass"], null),
    "competition:nbl":viewingRights(["competition:nbl"], ["kayo", "foxtel"], null),
    "competition:golf-majors":viewingRights(["competition:masters", "competition:pga-tour", "competition:dp-world-tour", "the-open"], ["kayo", "foxtel"], null, { eventKeys:Object.freeze(["golf", "masters"]) }),
    "competition:liv-golf":viewingRights(["competition:liv-golf"], ["seven"], null),
    "competition:nfl":viewingRights(["competition:nfl", "american-football"], ["dazn"], null),
    "competition:netball-2026":viewingRights(["competition:netball"], ["kayo", "foxtel"], null, { notAfter:"2026-12-31T23:59:59.999Z" }),
    "competition:netball-2027":viewingRights(["competition:netball"], ["stan", "nine"], null, { notBefore:"2027-01-01T00:00:00.000Z", matchPriority:1 }),
    "competition:a-leagues":viewingRights(["competition:a-league"], ["paramount"], null),
    "competition:australian-national-football":viewingRights(["competition:afc-womens-asian-cup", "competition:afc-asian-cup", "competition:australia-cup", "socceroos", "matildas", "australia-cup"], ["paramount"], null),
    "competition:fifa-world-cup-2026":viewingRights(["competition:fifa-world-cup-2026"], ["sbs"], null),
    "competition:tennis-major":viewingRights(["competition:tennis:australian-open", "competition:tennis:roland-garros", "competition:tennis:wimbledon", "australian-open", "roland-garros", "french-open", "wimbledon"], ["stan"], null),
    "competition:stan-motorsport":viewingRights(["competition:formula-e", "competition:indycar", "competition:asbk", "competition:mxgp"], ["stan"], null),
    "competition:wec":viewingRights(["competition:wec", "le-mans"], ["stan"], null),
    "competition:wrc":viewingRights(["competition:wrc"], ["stan"], null),
    "competition:dakar":viewingRights(["competition:dakar", "paris-dakar"], ["sbs"], null),
    "competition:goodwood":viewingRights(["competition:goodwood"], ["goodwood"], null, { territory:"GLOBAL" }),
    "competition:road-cycling":viewingRights(["competition:tour-de-france", "competition:giro-ditalia", "competition:vuelta-a-espana"], ["sbs"], null),
    "competition:x-games":viewingRights(["competition:x-games"], ["youtube"], "https://www.youtube.com/@XGames", { territory:"GLOBAL", sourceIsProvider:true }),
    "competition:olympic-games":viewingRights(["competition:olympic-games", "olympics"], ["stan", "nine"], null),
    "competition:commonwealth-games":viewingRights(["competition:commonwealth-games", "cwg"], ["seven"], null),
    "competition:australian-hockey":viewingRights(["competition:hockey-one", "competition:hockeyroos", "competition:kookaburras"], ["seven"], null),
    "competition:swimming-australia":viewingRights(["competition:swimming-australia", "pan-pacs"], ["nine"], null),
    "competition:world-gymnastics":viewingRights(["competition:world-gymnastics", "competition:fig-gymnastics"], ["sbs"], null),
    "competition:australian-athletics":viewingRights(["competition:australian-athletics", "world-u20-athletics"], ["seven"], null),
    "competition:sydney-marathon":viewingRights(["competition:sydney-marathon"], ["sbs"], null),
  });

  function uniqueAllowed(values, records){
    const allowed = new Set(records.map(record => record.id));
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map(value => String(value || "").trim())
      .filter(value => allowed.has(value))));
  }

  function roundCoordinate(value){
    if (value === null || value === undefined || String(value).trim() === "") return null;
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
      australiaInternationalsEnabled:true,
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
    const { australiansOnlySportIds:_retiredAustraliansOnlySportIds, ...priorWithoutRetiredAustralia } = prior;
    return {
      ...source,
      version:Math.max(16, Number(source.version) || 0),
      followFirst:{
        ...defaults,
        ...priorWithoutRetiredAustralia,
        schemaVersion:SCHEMA_VERSION,
        startupMeta,
        appliedSeedHash:String(prior.appliedSeedHash || "") || null,
        australiaInternationalsEnabled:prior.australiaInternationalsEnabled !== false,
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
        australiaInternationalsEnabled:current.followFirst.australiaInternationalsEnabled !== false,
        followedMajorEventIds:meta.majorEvents.slice(),
        location:meta.location,
      },
    });
    return { preferences:next, changed:true };
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
        const entityKind = id.startsWith("team:") ? "team" : "athlete";
        return {
          type:entityKind,
          entityKind,
          id,
          label:`Because you follow ${participantLabel(id)}`,
          displayTag:entityKind === "athlete",
        };
      }
    }
    const sportAliases = {
      "rugby-union":"rugby", basketball:"nba", "multi-sport":"cwg",
      fifa:"football", "premier-league":"football", bundesliga:"football", "la-liga":"football", "serie-a":"football", "ligue-1":"football",
      wimbledon:"tennis", tdf:"cycling", masters:"golf", nfl:"american-football",
      ski:"telemark", skiing:"telemark", alpine:"telemark", freestyle:"telemark",
      skateboard:"extreme", wsl:"surf", "big-wave":"surf",
    };
    const sourceSportId = String(event?.representativeSportKey || event?.sportId || event?.key || "");
    const sportId = sportAliases[sourceSportId] || sourceSportId;
    const representativeCountryCodes = Array.from(new Set([
      ...(Array.isArray(event?.representativeCountryCodes) ? event.representativeCountryCodes : []),
      event?.representingCountryCode,
    ].map(value => String(value || "").toUpperCase()).filter(Boolean)));
    const representsAustralia = representativeCountryCodes.some(code => ["AU", "AUS"].includes(code));
    const international = event?.isInternational === true || event?.competitionScope === "international";
    const followedSportIds = new Set((next.followedSports || []).map(String));
    const sportFollowed = followedSportIds.has(sourceSportId) || followedSportIds.has(sportId);
    if (next.followFirst.australiaInternationalsEnabled && sportFollowed && international && representsAustralia){
      return { type:"australians", entityKind:"national-representation", id:sportId, label:"Australia in international competition", displayTag:false };
    }
    const concreteSportingCard = Boolean(
      event?.date
      && event?.time
      && event?.majorEventMarker !== true
      && event?.tournamentParent !== true
      && event?.dateOnly !== true
      && event?.cardKind !== "event"
      && event?.kind !== "tournament"
      && event?.kind !== "major_event"
      && event?.kind !== "ticket_sale"
    );
    if (
      sportFollowed
      && concreteSportingCard
      && Number(event?.stakesScore) >= 5
      && !(international && representsAustralia && next.followFirst.australiaInternationalsEnabled === false)
    ){
      return { type:"sport-high-stakes", entityKind:"sport", id:sportId, label:null, displayTag:false };
    }
    return null;
  }

  function stageLabel(event){
    const value = `${event?.stage || ""} ${event?.roundLabel || ""} ${event?.round || ""}`.toLowerCase();
    if (/wild\s*card/.test(value)) return "Wildcard";
    if (/prelim/.test(value)) return "Prelim";
    if (/quarter|qualifying|\bqf\b/.test(value)) return "QF";
    if (/semi|\bsf\b/.test(value)) return "Semis";
    if (/grand final|elimination|\bfinals?\b/.test(value)) return "Finals";
    return "";
  }

  function finalsStageRank(value){
    const label = String(value || "").trim().toLowerCase();
    if (!label) return 9_000;
    if (/^opening round$/.test(label)) return 0;
    const round = label.match(/^round\s+(\d+)$/);
    if (round) return Number(round[1]);
    if (/wild\s*card/.test(label)) return 1_000;
    if (/qualifying|elimination|\bqf\b/.test(label)) return 1_010;
    if (/semi|\bsf\b/.test(label)) return 1_020;
    if (/prelim/.test(label)) return 1_030;
    if (/grand final/.test(label)) return 1_040;
    if (/\bfinals?\b/.test(label)) return 1_050;
    if (label === "all" || /\s+v\.?\s+/.test(label)) return 8_000;
    return 5_000;
  }

  function normalizedFixtureGroupLabel(value){
    const label = String(value || "").trim();
    return !label || label.toLowerCase() === "all" || /\s+v\.?\s+/i.test(label)
      ? "Other fixtures"
      : label;
  }

  function compareFixtureGroupLabels(first, second){
    return finalsStageRank(first) - finalsStageRank(second)
      || String(first || "").localeCompare(String(second || ""), "en-AU", { numeric:true, sensitivity:"base" });
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

  function normalizeDirectoryRank(value){
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const rank = Number(value);
    return Number.isInteger(rank) && rank > 0 ? rank : null;
  }

  function directoryEntityLabel(record){
    const explicit = String(record?.sectionLabel || "").trim();
    if (explicit) return explicit;
    const kind = String(record?.entityType || record?.type || "").toLowerCase();
    if (["athlete", "competitor", "player"].includes(kind)) return "Player";
    if (["nationalside", "national-side"].includes(kind)) return "National team";
    return "Team";
  }

  function competitionRightsForEvent(event){
    const tokens = [event?.competitionId, event?.majorEventId, event?.sportDomainId, event?.sportId, event?.key, event?.competition, event?.competitionName, event?.name]
      .map(value => String(value || "").trim().toLowerCase().replace(/^(?:competition|sport):/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
      .filter(Boolean);
    const eventTime = Date.parse(event?.startsAt || event?.sportingStartsAt || event?.start || event?.date || "");
    const eventKey = String(event?.key || "").toLowerCase();
    return [...Object.values(COMPETITION_VIEWING_RIGHTS)]
      .sort((left, right) => (Number(right.matchPriority) || 0) - (Number(left.matchPriority) || 0))
      .find(rights => {
        if (rights.eventKeys && eventKey && !rights.eventKeys.includes(eventKey)) return false;
        if (Number.isFinite(eventTime) && ((rights.notBefore && eventTime < Date.parse(rights.notBefore)) || (rights.notAfter && eventTime > Date.parse(rights.notAfter)))) return false;
        return rights.competitionAliases.some(rawAlias => {
          const alias = String(rawAlias || "").toLowerCase().replace(/^(?:competition|sport):/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          return tokens.some(token => token === alias || (alias.length >= 3 && token.startsWith(`${alias}-`)) || (alias.length >= 4 && token.includes(alias)));
        });
      }) || null;
  }

  function providerIdForOption(option){
    if (typeof option === "string"){
      const text = option.toLowerCase();
      return Object.entries(VIEWING_PROVIDERS).find(([, provider]) => provider.aliases.some(alias => text.includes(alias)))?.[0] || null;
    }
    const direct = String(option?.providerId || option?.serviceId || "").trim().toLowerCase();
    if (VIEWING_PROVIDERS[direct]) return direct;
    const text = [option?.broadcasterName, option?.serviceLabel, option?.platform, option?.channelBrand].filter(Boolean).join(" ").toLowerCase();
    return Object.entries(VIEWING_PROVIDERS).find(([, provider]) => provider.aliases.some(alias => text.includes(alias)))?.[0] || null;
  }

  function trustedProviderIdForOption(event, option){
    const providerId = providerIdForOption(option);
    if (!providerId || (option && typeof option === "object" && option.sourceUrl && option.verifiedAt)) return providerId;
    const text = typeof option === "string" ? option : [option?.broadcasterName, option?.serviceLabel, option?.platform, option?.channelBrand].filter(Boolean).join(" ");
    if (/\b(?:supersport|eurosport|sky sports|watchespn|watch nrl)\b/i.test(text)) return null;
    const key = String(event?.key || "").toLowerCase();
    if (key === "wsl" && providerId === "paramount") return null;
    if (["ski", "telemark"].includes(key) && /\bfis broadcast\b/i.test(text)) return null;
    return providerId;
  }

  function viewingOptions(event, selectedProviderIds = []){
    const broadcasterIds = new Set((event?.broadcasterIds || []).map(id => String(id || "").trim().toLowerCase()).filter(Boolean));
    const explicitOptions = [event?.broadcaster, ...(event?.broadcastOptions || []), ...(event?.viewingOptions || [])].filter(Boolean);
    explicitOptions.map(option => trustedProviderIdForOption(event, option)).filter(Boolean).forEach(id => broadcasterIds.add(id));
    const rights = competitionRightsForEvent(event);
    const isGrandFinal = /\bgrand\s+final\b/i.test([event?.stage, event?.roundLabel, event?.round, event?.name].filter(Boolean).join(" "));
    const fixtureProviderIds = Array.from(new Set(explicitOptions
      .filter(option => option && typeof option === "object" && option.rightsScope === "fixture")
      .map(option => trustedProviderIdForOption(event, option))
      .filter(Boolean)));
    const rightsProviderIds = fixtureProviderIds.length
      ? fixtureProviderIds
      : rights ? [...(isGrandFinal && rights.grandFinalProviderIds ? rights.grandFinalProviderIds : rights.providerIds)] : [];
    if (rightsProviderIds.length){
      broadcasterIds.clear();
      rightsProviderIds.forEach(id => broadcasterIds.add(id));
    }
    const selectedOrder = new Map((selectedProviderIds || []).map((id, index) => [String(id), index]));
    const providerOrder = [...rightsProviderIds, ...Object.keys(VIEWING_PROVIDERS).filter(id => !rightsProviderIds.includes(id))];
    const completed = ["completed", "past", "finished", "final"].includes(String(event?.status || event?.scheduleStatus || "").toLowerCase())
      || Boolean(event?.scoreDisplay || event?.score || event?.canonicalResultScoreline);
    return providerOrder
      .filter(id => broadcasterIds.has(id))
      .sort((left, right) => {
        if (rightsProviderIds.includes(left) && rightsProviderIds.includes(right)) return rightsProviderIds.indexOf(left) - rightsProviderIds.indexOf(right);
        const paidDelta = Number(VIEWING_PROVIDERS[right].paid) - Number(VIEWING_PROVIDERS[left].paid);
        if (paidDelta) return paidDelta;
        const leftSelected = selectedOrder.has(left) ? selectedOrder.get(left) : Number.MAX_SAFE_INTEGER;
        const rightSelected = selectedOrder.has(right) ? selectedOrder.get(right) : Number.MAX_SAFE_INTEGER;
        if (leftSelected !== rightSelected) return leftSelected - rightSelected;
        return providerOrder.indexOf(left) - providerOrder.indexOf(right);
      })
      .map(providerId => {
        const provider = VIEWING_PROVIDERS[providerId];
        const explicit = explicitOptions.find(option => trustedProviderIdForOption(event, option) === providerId);
        const explicitObject = explicit && typeof explicit === "object" ? explicit : {};
        const webUrl = explicitObject.webUrl || explicitObject.url || rights?.providerUrls?.[providerId] || (rights?.sourceIsProvider ? rights.sourceUrl : null) || provider.webUrl;
        return {
          providerId,
          ...provider,
          webUrl,
          url:provider.universalUrl || webUrl,
          territory:explicitObject.territory || provider.territory || rights?.territory || "AU",
          accessType:explicitObject.accessType || provider.accessType || (provider.paid ? "subscription" : "free"),
          liveOrReplay:completed ? "replay" : "live",
          rightsScope:explicitObject.rightsScope || (fixtureProviderIds.length ? "fixture" : rights?.rightsScope) || "fixture",
          sourceUrl:explicitObject.sourceUrl || rights?.sourceUrl || null,
          verifiedAt:explicitObject.verifiedAt || rights?.verifiedAt || null,
        };
      });
  }

  function viewingLink(event, selectedProviderIds = [], { territory = "AU" } = {}){
    const options = viewingOptions(event, selectedProviderIds);
    return options.find(option => option.territory === territory || option.territory === "GLOBAL") || options[0] || null;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    META_SCHEMA_VERSION,
    FEEDBACK_SCHEMA_VERSION,
    DEFAULT_RADIUS_KM,
    MAX_RADIUS_KM,
    STARTUP_SPORTS,
    MAJOR_EVENT_FAMILIES,
    INTERNATIONAL_AUSTRALIA_SPORT_IDS,
    OFFER_INTERESTS,
    VIEWING_PROVIDERS,
    COMPETITION_VIEWING_RIGHTS,
    normalizeLocation,
    normalizeMeta,
    migratePreferences,
    selectorIdsForSports,
    applyMetaSeed,
    reasonForEvent,
    stageLabel,
    finalsStageRank,
    normalizedFixtureGroupLabel,
    compareFixtureGroupLabels,
    appendFeedback,
    registerOpen,
    shouldPromptRefinement,
    normalizeDirectoryRank,
    directoryEntityLabel,
    competitionRightsForEvent,
    viewingOptions,
    viewingLink,
  });
});
