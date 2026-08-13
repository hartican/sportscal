(function attachBroadcasterDiscovery(root, factory){
  const hierarchy = root.NOTHINGSPORTS_SPORT_HIERARCHY
    || (typeof require === "function" ? require("./sport-hierarchy.js") : null);
  const api = factory(hierarchy);
  root.NOTHINGSPORTS_BROADCASTER_DISCOVERY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildBroadcasterDiscovery(hierarchy){
  "use strict";

  const SCHEMA_VERSION = "broadcaster-discovery.v1";
  const SOURCE_MODES = Object.freeze(["licensed_api", "reviewed_export", "manual_fixture", "unavailable"]);
  const ACCESS_TYPES = Object.freeze(["free", "included", "ppv", "unknown"]);
  const LISTING_TYPES = Object.freeze(["live", "delayed", "replay", "highlights", "studio", "unknown"]);
  const TIME_CONFIDENCE = Object.freeze(["exact", "approximate", "date_only", "unknown"]);
  const MATCH_CONFIDENCE_THRESHOLD = 0.65;
  const AUTO_PUBLISH_CONFIDENCE_THRESHOLD = 0.92;
  const AMBIGUITY_CONFIDENCE_MARGIN = 0.08;

  const sourceProfiles = Object.freeze([
    ["kayo", "Kayo Sports", "AU", "kayo", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["foxtel", "Foxtel", "AU", "foxtel", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["stan_sport", "Stan Sport", "AU", "stan_sport", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["espn_au", "ESPN Australia", "AU", null, ["licensed_api", "reviewed_export", "manual_fixture"], true, true],
    ["sbs", "SBS", "AU", "sbs_on_demand", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["9now", "9Now", "AU", "9now", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["7plus", "Seven / 7plus", "AU", "7plus", ["licensed_api", "reviewed_export", "manual_fixture"], true, false],
    ["paramount_plus_au", "Paramount+ Australia", "AU", "paramount_plus_au", ["licensed_api", "manual_fixture"], true, false],
    ["eurosport", "Eurosport", "EU", null, ["licensed_api", "reviewed_export", "manual_fixture"], false, false],
    ["canal_plus_fr", "CANAL+ France", "FR", null, ["licensed_api", "reviewed_export", "manual_fixture"], false, false],
    ["tnt_sports_uk", "TNT Sports UK", "GB", null, ["licensed_api", "reviewed_export", "manual_fixture"], false, false],
    ["dazn", "DAZN", "MULTI", null, ["licensed_api", "manual_fixture"], false, false],
    ["bein_sports_au", "beIN SPORTS Australia", "AU", null, ["licensed_api", "reviewed_export", "manual_fixture"], false, true],
  ].map(([id, label, territory, defaultServiceId, allowedModes, priorityAu, requiresAuDistributor]) => Object.freeze({
    id,
    label,
    territory,
    defaultServiceId,
    allowedModes: Object.freeze(allowedModes),
    priorityAu,
    requiresAuDistributor,
  })));

  const services = Object.freeze([
    ["kayo", "Kayo Sports", "included"],
    ["foxtel", "Foxtel", "included"],
    ["main_event", "MAIN EVENT", "ppv"],
    ["stan_sport", "Stan Sport", "included"],
    ["stan_ppv", "Stan PPV", "ppv"],
    ["disney_plus_au", "Disney+", "included"],
    ["sbs", "SBS", "free"],
    ["sbs_on_demand", "SBS On Demand", "free"],
    ["9now", "9Now", "free"],
    ["seven", "Seven", "free"],
    ["7plus", "7plus", "free"],
    ["paramount_plus_au", "Paramount+", "included"],
    ["network_10", "Network 10 / 10 Streaming", "free"],
    ["bein_sports_au", "beIN SPORTS CONNECT Australia", "included"],
  ].map(([id, label, defaultAccessType]) => Object.freeze({ id, label, defaultAccessType, territory: "AU" })));

  const commercialSourceOptions = Object.freeze([
    Object.freeze({
      id: "yuvu",
      label: "YuVu",
      role: "Australian linear EPG",
      auFit: "verified_fta",
      delivery: "Commercial API/feed; sample and approved test feeds available",
      evaluation: "sample_or_test_feed",
      pricing: "contact_sales",
      recommendation: "shortlist_first",
      limitations: "No Foxtel Pay TV; excludes several datacast, religious and horse-racing channels",
      sourceUrl: "https://yuvu.tv/syndication/",
    }),
    Object.freeze({
      id: "gracenote_on",
      label: "Gracenote On API",
      role: "Enterprise linear and streaming availability plus sports identity",
      auFit: "verified_platform_capability_inventory_requires_quote",
      delivery: "Entitled APIs, schemas and delta updates",
      evaluation: "small_public_plan_then_sales_sample",
      pricing: "contact_sales",
      recommendation: "shortlist_enterprise",
      limitations: "Exact AU channel and OTT inventory is entitlement-specific; general VOD availability must not be assumed to cover sport",
      sourceUrl: "https://documentation.gracenote.com/on-api/index.html",
    }),
    Object.freeze({
      id: "justwatch_sports",
      label: "JustWatch Sports Widget",
      role: "Event-level streaming and broadcast offers",
      auFit: "au_locale_verified_competition_inventory_unverified",
      delivery: "Branded JavaScript widget with partner API key",
      evaluation: "partner_discussion",
      pricing: "contact_sales",
      recommendation: "shortlist_streaming",
      limitations: "No public raw sports export; verify AU competition coverage and branding constraints",
      sourceUrl: "https://apis.justwatch.com/docs/sports_widget/",
    }),
    Object.freeze({
      id: "sportradar",
      label: "Sportradar Media APIs",
      role: "Canonical multi-sport fixtures, IDs and reschedules",
      auFit: "afl_verified_other_competitions_contract_specific",
      delivery: "REST JSON/XML and supported push feeds",
      evaluation: "30_day_trial",
      pricing: "contact_sales",
      recommendation: "shortlist_fixture_truth",
      limitations: "Does not by itself establish Australian viewing availability or access type",
      sourceUrl: "https://sportradar.com/media-tech/data-content/sports-data-api/?lang=en-us",
    }),
    Object.freeze({
      id: "stats_perform",
      label: "Stats Perform / Opta",
      role: "Official competition fixture and live data",
      auFit: "nrl_rugby_a_leagues_verified",
      delivery: "REST, WebSocket, push/pull and S3 in JSON/XML",
      evaluation: "sales_demo",
      pricing: "contact_sales",
      recommendation: "quote_for_official_au_competitions",
      limitations: "No verified all-sport AU availability layer; exact competition and display entitlements are contractual",
      sourceUrl: "https://www.statsperform.com/products/opta-data-feeds/",
    }),
    Object.freeze({
      id: "simply_tv",
      label: "Simply.TV",
      role: "Linear EPG, streaming metadata and sports identity",
      auFit: "unverified",
      delivery: "API/push in JSON, XML or custom formats",
      evaluation: "small_self_service_trial",
      pricing: "contact_sales",
      recommendation: "request_inventory_before_integration",
      limitations: "Public material does not enumerate Australian channels or services",
      sourceUrl: "https://www.simply.tv/products/video-metadata",
    }),
    Object.freeze({
      id: "epg_service",
      label: "EPG Service",
      role: "EPG and sports metadata benchmark",
      auFit: "unverified",
      delivery: "REST/OpenAPI JSON, XMLTV, webhooks and exports",
      evaluation: "free_sandbox_and_seven_day_pilot",
      pricing: "public_starting_prices_plus_quote",
      recommendation: "benchmark_only_until_au_inventory_proven",
      limitations: "Australia is not identified in public coverage material",
      sourceUrl: "https://epgservice.tv/en/",
    }),
    Object.freeze({
      id: "sportsdataio",
      label: "SportsDataIO Global Sports API",
      role: "Broad schedules and scores across long-tail sports",
      auFit: "fixture_only",
      delivery: "Commercial API with one consistent global schema",
      evaluation: "no_self_service_trial",
      pricing: "contact_sales",
      recommendation: "compare_fixture_breadth_only",
      limitations: "No Australian broadcaster or streaming availability layer",
      sourceUrl: "https://sportsdata.io/developers",
    }),
  ]);

  const sourceById = new Map(sourceProfiles.map(profile => [profile.id, profile]));
  const serviceById = new Map(services.map(service => [service.id, service]));
  const taxonomyLookup = new Map();

  function normalizeText(value){
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\b(live|coverage|stream|watch|202[0-9]|presented by|sponsored by)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  (hierarchy?.nodes || []).forEach(node => {
    [node.id, node.label, ...(node.aliases || [])].forEach(value => {
      const normalized = normalizeText(value);
      if (normalized && !taxonomyLookup.has(normalized)) taxonomyLookup.set(normalized, node.id);
    });
  });

  function uniqueStrings(values){
    return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean)));
  }

  function stableId(value){
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1){
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function parseIso(value, label, { optional = false } = {}){
    if ((value === null || value === undefined || value === "") && optional) return null;
    const parsed = Date.parse(value || "");
    if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO date-time`);
    return new Date(parsed).toISOString();
  }

  function isoDate(value, label, { optional = false } = {}){
    const text = String(value || "");
    if (!text && optional) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) {
      throw new Error(`${label} must be YYYY-MM-DD`);
    }
    return text;
  }

  function taxonomyNode(value, level){
    const direct = hierarchy?.canonicalNodeId?.(String(value || ""));
    const directNode = hierarchy?.nodes?.find(candidate => candidate.id === direct);
    if (directNode && (!level || directNode.level === level)) return directNode;
    const normalized = normalizeText(value);
    const levelMatch = (hierarchy?.nodes || []).find(candidate => (
      (!level || candidate.level === level)
      && [candidate.id, candidate.label, ...(candidate.aliases || [])].some(alias => normalizeText(alias) === normalized)
    ));
    if (levelMatch) return levelMatch;
    const resolved = taxonomyLookup.get(normalized) || null;
    const node = hierarchy?.nodes?.find(candidate => candidate.id === resolved);
    return !level || node?.level === level ? node : null;
  }

  function resolveTaxonomy(listing){
    const competitionNode = taxonomyNode(listing.rawCompetition, "event_series")
      || taxonomyNode(listing.rawCompetition, "competition");
    const sportNode = taxonomyNode(listing.rawSport, "sport");
    const primaryId = competitionNode?.id || sportNode?.id || null;
    const lineage = hierarchy?.lineageFor?.(primaryId) || [];
    const byLevel = Object.fromEntries(lineage.map(node => [node.level, node.id]));
    return {
      taxonomyVersion: hierarchy?.schemaVersion || "sport-hierarchy-unavailable",
      taxonomyStatus: competitionNode ? "resolved" : sportNode ? "sport_only" : "unresolved",
      taxonomyNodeId: primaryId,
      sportId: byLevel.sport || sportNode?.id || null,
      disciplineId: byLevel.discipline || null,
      competitionId: byLevel.competition || null,
      eventSeriesId: byLevel.event_series || null,
      rawSport: listing.rawSport || null,
      rawCompetition: listing.rawCompetition || null,
    };
  }

  function normalizeAccessType(value, serviceId){
    const declared = String(value || "").toLowerCase();
    if (ACCESS_TYPES.includes(declared)) return declared;
    return serviceById.get(serviceId)?.defaultAccessType || "unknown";
  }

  function normalizeSnapshot(snapshot){
    if (snapshot?.schemaVersion !== "broadcaster-schedule-export.v1") throw new Error("Broadcaster export has an unsupported schema version");
    const source = sourceById.get(snapshot.sourceId);
    if (!source) throw new Error(`Unknown broadcaster source: ${snapshot.sourceId}`);
    if (!SOURCE_MODES.includes(snapshot.sourceMode) || !source.allowedModes.includes(snapshot.sourceMode)) {
      throw new Error(`${snapshot.sourceId} cannot use source mode ${snapshot.sourceMode}`);
    }
    if (snapshot.sourceMode === "reviewed_export" && (!snapshot.reviewedAt || !snapshot.reviewedBy)) {
      throw new Error(`${snapshot.sourceId} reviewed exports require reviewedAt and reviewedBy`);
    }
    if (!/^https:\/\//.test(snapshot.sourceUrl || "")) throw new Error(`${snapshot.sourceId} requires an HTTPS source URL`);
    const observedAt = parseIso(snapshot.observedAt, `${snapshot.sourceId}.observedAt`);
    const windowStart = isoDate(snapshot.windowStart, `${snapshot.sourceId}.windowStart`);
    const windowEnd = isoDate(snapshot.windowEnd, `${snapshot.sourceId}.windowEnd`);
    if (windowEnd < windowStart) throw new Error(`${snapshot.sourceId} window ends before it starts`);
    const listingIds = new Set();
    const items = (Array.isArray(snapshot.items) ? snapshot.items : []).map(item => {
      const sourceListingId = String(item.sourceListingId || "").trim();
      if (!sourceListingId || listingIds.has(sourceListingId)) throw new Error(`${snapshot.sourceId} has a duplicate or empty source listing ID`);
      listingIds.add(sourceListingId);
      const liveOrReplay = String(item.liveOrReplay || "unknown").toLowerCase();
      const timeConfidence = String(item.timeConfidence || "unknown").toLowerCase();
      if (!LISTING_TYPES.includes(liveOrReplay)) throw new Error(`${sourceListingId} has an unsupported listing type`);
      if (!TIME_CONFIDENCE.includes(timeConfidence)) throw new Error(`${sourceListingId} has unsupported time confidence`);
      if (!String(item.rawTitle || "").trim()) throw new Error(`${sourceListingId} needs a source title`);
      const programmeStartsAtUtc = parseIso(item.programmeStartsAtUtc, `${sourceListingId}.programmeStartsAtUtc`, { optional: true });
      const eventStartsAtUtc = parseIso(item.eventStartsAtUtc, `${sourceListingId}.eventStartsAtUtc`, { optional: true });
      const localDate = isoDate(item.localDate || (eventStartsAtUtc || programmeStartsAtUtc || "").slice(0, 10), `${sourceListingId}.localDate`, { optional: true });
      if (!localDate) throw new Error(`${sourceListingId} requires a local date or a UTC start`);
      const serviceId = String(item.serviceId || source.defaultServiceId || "").trim() || null;
      if (serviceId && !serviceById.has(serviceId)) throw new Error(`${sourceListingId} uses unknown AU service ${serviceId}`);
      const territory = String(item.territory || snapshot.territory || source.territory || "").toUpperCase();
      const accessType = normalizeAccessType(item.accessType, serviceId);
      const sourceUrl = item.sourceUrl || snapshot.sourceUrl;
      if (!/^https:\/\//.test(sourceUrl || "")) throw new Error(`${sourceListingId} requires an HTTPS source URL`);
      const canEstablishAuAvailability = territory.startsWith("AU")
        && Boolean(serviceId)
        && (!source.requiresAuDistributor || serviceId !== source.defaultServiceId);
      return {
        listingId: `${source.id}:${sourceListingId}`,
        sourceListingId,
        snapshotId: String(snapshot.snapshotId),
        sourceId: source.id,
        sourceLabel: source.label,
        sourceMode: snapshot.sourceMode,
        sourceUrl,
        observedAt,
        territory,
        rawTitle: String(item.rawTitle).trim(),
        rawSport: String(item.rawSport || "").trim() || null,
        rawCompetition: String(item.rawCompetition || "").trim() || null,
        rawParticipants: uniqueStrings(item.rawParticipants),
        roundOrSession: String(item.roundOrSession || "").trim() || null,
        venue: String(item.venue || "").trim() || null,
        channelBrand: String(item.channelBrand || "").trim() || null,
        scheduleTimeText: String(item.scheduleTimeText || "").trim() || null,
        scheduleTimeZone: String(item.scheduleTimeZone || "").trim() || null,
        programmeStartsAtUtc,
        eventStartsAtUtc,
        localDate,
        timeConfidence,
        liveOrReplay,
        serviceId,
        serviceLabel: serviceId ? serviceById.get(serviceId).label : null,
        accessType,
        canEstablishAuAvailability,
      };
    });
    return {
      schemaVersion: snapshot.schemaVersion,
      snapshotId: String(snapshot.snapshotId),
      sourceId: source.id,
      sourceLabel: source.label,
      sourceMode: snapshot.sourceMode,
      territory: String(snapshot.territory || source.territory).toUpperCase(),
      sourceUrl: snapshot.sourceUrl,
      observedAt,
      reviewedAt: snapshot.reviewedAt ? parseIso(snapshot.reviewedAt, `${source.id}.reviewedAt`) : null,
      reviewedBy: snapshot.reviewedBy || null,
      windowStart,
      windowEnd,
      checksum: String(snapshot.checksum || "").trim() || `local-${stableId(JSON.stringify(snapshot.items || []))}`,
      itemCount: items.length,
      items,
    };
  }

  function dayFor(value){
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : null;
  }

  function titleTokens(value){
    const stop = new Set(["the", "and", "vs", "v", "day", "round", "session", "open"]);
    return normalizeText(value).split(" ").filter(token => token.length > 1 && !stop.has(token));
  }

  function tokenScore(left, right){
    const a = new Set(titleTokens(left));
    const b = new Set(titleTokens(right));
    if (!a.size || !b.size) return 0;
    const intersection = Array.from(a).filter(token => b.has(token)).length;
    return intersection / new Set([...a, ...b]).size;
  }

  function participantNames(event){
    return uniqueStrings((event?.participants || []).map(participant => participant?.name || participant?.displayName || participant));
  }

  function venueName(event){
    return String(event?.venue?.name || event?.venueName || event?.venue || "");
  }

  function scoreListingAgainstEvent(listing, taxonomy, event){
    const reasonCodes = [];
    let confidence = 0;
    const eventCompetitionId = event.eventSeriesId || event.competitionId || null;
    const listingCompetitionId = taxonomy.eventSeriesId || taxonomy.competitionId || null;
    if (listingCompetitionId && eventCompetitionId && (
      listingCompetitionId === eventCompetitionId
      || hierarchy?.lineageFor?.(eventCompetitionId).some(node => node.id === listingCompetitionId)
      || hierarchy?.lineageFor?.(listingCompetitionId).some(node => node.id === eventCompetitionId)
    )){
      confidence += 0.45;
      reasonCodes.push("competition_match");
    } else if (taxonomy.sportId && taxonomy.sportId !== event.sportId) {
      return { confidence: 0, reasonCodes: ["sport_conflict"], participantConflict: false };
    }

    const listedParticipants = listing.rawParticipants.map(normalizeText).filter(Boolean);
    const eventParticipants = participantNames(event).map(normalizeText).filter(Boolean);
    const participantMatches = listedParticipants.filter(listed => eventParticipants.some(existing => existing === listed || existing.includes(listed) || listed.includes(existing))).length;
    const participantConflict = listedParticipants.length >= 2 && eventParticipants.length >= 2 && participantMatches === 0;
    if (participantConflict) return { confidence: 0, reasonCodes: ["participant_conflict"], participantConflict: true };
    if (participantMatches >= 2){
      confidence += 0.25;
      reasonCodes.push("both_participants_match");
    } else if (participantMatches === 1){
      confidence += 0.12;
      reasonCodes.push("one_participant_matches");
    }

    const listingStart = Date.parse(listing.eventStartsAtUtc || listing.programmeStartsAtUtc || "");
    const eventStart = Date.parse(event.startTimeUtc || "");
    if (Number.isFinite(listingStart) && Number.isFinite(eventStart)){
      const deltaMinutes = Math.abs(listingStart - eventStart) / 60000;
      if (deltaMinutes <= 15){
        confidence += 0.15;
        reasonCodes.push("start_within_15_minutes");
      } else if (deltaMinutes <= 120){
        confidence += 0.08;
        reasonCodes.push("start_within_two_hours");
      }
    } else if (listing.localDate && listing.localDate === dayFor(event.sourceLocalDate || event.date || event.startTimeUtc)) {
      confidence += 0.08;
      reasonCodes.push("same_calendar_date");
    }

    const roundMatches = listing.roundOrSession && event.round && normalizeText(listing.roundOrSession) === normalizeText(event.round);
    const venueMatches = listing.venue && venueName(event) && (
      normalizeText(venueName(event)).includes(normalizeText(listing.venue))
      || normalizeText(listing.venue).includes(normalizeText(venueName(event)))
    );
    if (roundMatches || venueMatches){
      confidence += 0.10;
      reasonCodes.push(roundMatches ? "round_matches" : "venue_matches");
    }
    if (tokenScore(listing.rawTitle, event.title || event.name) >= 0.35){
      confidence += 0.05;
      reasonCodes.push("title_tokens_match");
    }

    if (!["live", "delayed"].includes(listing.liveOrReplay)) confidence = Math.min(confidence, 0.49);
    if (listing.timeConfidence === "date_only") confidence = Math.min(confidence, 0.69);
    if (!listing.canEstablishAuAvailability && listing.territory.startsWith("AU")) confidence = Math.min(confidence, 0.79);
    return { confidence: Math.round(Math.min(confidence, 1) * 100) / 100, reasonCodes, participantConflict };
  }

  function likelyEvents(listing, taxonomy, catalogue){
    return (Array.isArray(catalogue) ? catalogue : []).filter(event => {
      if (taxonomy.sportId && event.sportId && taxonomy.sportId !== event.sportId) return false;
      const listingDay = listing.localDate || dayFor(listing.eventStartsAtUtc || listing.programmeStartsAtUtc);
      const eventDay = dayFor(event.sourceLocalDate || event.date || event.startTimeUtc);
      if (!listingDay || !eventDay) return true;
      const delta = Math.abs(Date.parse(`${listingDay}T00:00:00Z`) - Date.parse(`${eventDay}T00:00:00Z`)) / 86400000;
      return delta <= 1;
    });
  }

  function currentBroadcastLabels(event){
    return uniqueStrings((event?.broadcasts || []).flatMap(option => [option?.broadcasterName, option?.platform, option?.serviceLabel]));
  }

  function candidateForListing(listing, catalogue, reportId){
    const taxonomy = resolveTaxonomy(listing);
    const scored = likelyEvents(listing, taxonomy, catalogue)
      .map(event => ({ event, ...scoreListingAgainstEvent(listing, taxonomy, event) }))
      .filter(item => !item.participantConflict)
      .sort((left, right) => right.confidence - left.confidence || String(left.event.id).localeCompare(String(right.event.id)));
    const top = scored[0] || null;
    const second = scored[1] || null;
    const closeTie = top && second && top.confidence >= 0.45 && top.confidence - second.confidence < AMBIGUITY_CONFIDENCE_MARGIN;
    const matchStatus = closeTie ? "ambiguous" : top && top.confidence >= MATCH_CONFIDENCE_THRESHOLD ? "matched" : "new";
    const canonicalEventId = matchStatus === "matched" ? top.event.id : null;
    const confidence = top?.confidence || 0;
    const broadcast = listing.canEstablishAuAvailability ? {
      serviceId: listing.serviceId,
      serviceLabel: listing.serviceLabel,
      territory: listing.territory,
      accessType: listing.accessType,
      liveOrReplay: listing.liveOrReplay,
      channelBrand: listing.channelBrand,
      sourceId: listing.sourceId,
      sourceUrl: listing.sourceUrl,
      observedAt: listing.observedAt,
    } : null;
    const publishable = matchStatus === "matched"
      && confidence >= AUTO_PUBLISH_CONFIDENCE_THRESHOLD
      && Boolean(broadcast)
      && broadcast.accessType !== "unknown"
      && ["live", "delayed"].includes(listing.liveOrReplay);
    const suggestedAction = publishable ? "publish"
      : matchStatus === "new" || matchStatus === "ambiguous" || confidence >= MATCH_CONFIDENCE_THRESHOLD ? "review"
        : "ignore";
    const existingLabels = top ? currentBroadcastLabels(top.event).map(normalizeText) : [];
    const availabilityChange = broadcast && canonicalEventId && !existingLabels.some(label => label.includes(normalizeText(broadcast.serviceLabel)))
      ? "added_au_option"
      : null;
    const candidateId = `coverage:${stableId(`${listing.sourceId}|${listing.sourceListingId}|${listing.localDate}`)}`;
    const provisionalEvent = matchStatus === "new" ? {
      schemaVersion: "provisional-catalog-event.v1",
      id: `provisional:${stableId(`${listing.sourceId}|${listing.sourceListingId}|${listing.localDate}`)}`,
      title: listing.rawTitle,
      sportId: taxonomy.sportId,
      disciplineId: taxonomy.disciplineId,
      competitionId: taxonomy.competitionId,
      eventSeriesId: taxonomy.eventSeriesId,
      rawCompetition: listing.rawCompetition,
      startTimeUtc: listing.eventStartsAtUtc || listing.programmeStartsAtUtc,
      sourceLocalDate: listing.localDate,
      status: "provisional",
    } : null;
    const priority = matchStatus === "new" && taxonomy.sportId && listing.timeConfidence === "exact" && broadcast ? "high"
      : matchStatus === "ambiguous" || availabilityChange ? "high"
        : suggestedAction === "ignore" ? "low"
          : "normal";
    return {
      schemaVersion: "coverage-candidate.v1",
      id: candidateId,
      candidateId,
      reportId,
      title: listing.rawTitle,
      eventTitle: listing.rawTitle,
      source: listing.sourceId,
      sport: taxonomy.sportId || listing.rawSport,
      competition: taxonomy.eventSeriesId || taxonomy.competitionId || listing.rawCompetition,
      startsAt: listing.eventStartsAtUtc || listing.programmeStartsAtUtc || `${listing.localDate}T00:00:00.000Z`,
      matchStatus,
      catalogueStatus: matchStatus,
      matchConfidence: confidence,
      coverageReason: "broadcaster_featured",
      suggestedAction,
      priority,
      taxonomy,
      eventTiming: {
        localDate: listing.localDate,
        eventStartsAtUtc: listing.eventStartsAtUtc,
        programmeStartsAtUtc: listing.programmeStartsAtUtc,
        timeConfidence: listing.timeConfidence,
      },
      match: {
        canonicalEventId,
        confidence,
        reasonCodes: top?.reasonCodes || ["no_catalogue_match"],
        alternatives: scored.slice(0, 3).map(item => ({ canonicalEventId: item.event.id, title: item.event.title || item.event.name, confidence: item.confidence })),
      },
      broadcastsAu: broadcast ? [broadcast] : [],
      sourceEvidence: [{
        listingId: listing.listingId,
        snapshotId: listing.snapshotId,
        sourceId: listing.sourceId,
        sourceMode: listing.sourceMode,
        sourceUrl: listing.sourceUrl,
        observedAt: listing.observedAt,
        territory: listing.territory,
        rawTitle: listing.rawTitle,
      }],
      provisionalEvent,
      availabilityChange,
      blockers: uniqueStrings([
        !taxonomy.sportId ? "unresolved_sport" : null,
        taxonomy.taxonomyStatus !== "resolved" ? "competition_needs_review" : null,
        !listing.canEstablishAuAvailability ? "au_availability_unproven" : null,
        !["live", "delayed"].includes(listing.liveOrReplay) ? "not_live_event_coverage" : null,
        matchStatus !== "matched" ? `${matchStatus}_catalogue_identity` : null,
        matchStatus === "matched" && confidence < AUTO_PUBLISH_CONFIDENCE_THRESHOLD ? "confidence_below_publish_threshold" : null,
      ]),
      editorial: { decision: "pending", reviewedBy: null, reviewedAt: null, note: null },
    };
  }

  function canPublishCandidate(candidate){
    return candidate?.matchStatus === "matched"
      && Number(candidate?.match?.confidence) >= AUTO_PUBLISH_CONFIDENCE_THRESHOLD
      && Array.isArray(candidate?.broadcastsAu)
      && candidate.broadcastsAu.length > 0
      && candidate.broadcastsAu.every(option => option.accessType !== "unknown" && String(option.territory || "").startsWith("AU"))
      && !(candidate.blockers || []).length;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SOURCE_MODES,
    ACCESS_TYPES,
    LISTING_TYPES,
    TIME_CONFIDENCE,
    MATCH_CONFIDENCE_THRESHOLD,
    AUTO_PUBLISH_CONFIDENCE_THRESHOLD,
    AMBIGUITY_CONFIDENCE_MARGIN,
    sourceProfiles,
    services,
    commercialSourceOptions,
    normalizeText,
    normalizeAccessType,
    normalizeSnapshot,
    resolveTaxonomy,
    scoreListingAgainstEvent,
    candidateForListing,
    canPublishCandidate,
    stableId,
  });
});
