(function attachNothingSportsFeedControls(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FEED_CONTROLS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsFeedControls(){
  "use strict";

  const SCHEMA_VERSION = "feed-controls.v1";
  const FROTH_LEVELS = Object.freeze(["low", "balanced", "high", "maximum"]);
  const SCOPES = Object.freeze(["following", "for_you", "explore"]);
  const AVAILABILITY = Object.freeze(["any", "free", "included", "ppv"]);
  const TIMING = Object.freeze(["any", "live_now", "tonight", "this_week", "overnight"]);
  const STAKES = Object.freeze(["everything", "important", "top_picks"]);
  const SPOILERS = Object.freeze(["strict", "standard", "results_visible"]);
  const NEGATIVE_SUPPRESSION_COUNT = 2;
  const FIRST_IMPRESSION_DEPTH = 10;
  const FIRST_IMPRESSION_DISCOVERY_CAP = 1;
  const EXPERIMENT_FLAGS = Object.freeze({
    controlledDiscovery: true,
    balancedDiscovery: true,
    explicitNegativeSuppression: true,
    firstImpressionDiscoveryCap: FIRST_IMPRESSION_DISCOVERY_CAP,
  });

  const DEFAULT_CONTROLS = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    froth: "balanced",
    scope: "for_you",
    availability: "any",
    timing: "any",
    stakes: "everything",
    spoilers: "standard",
    expanded: true,
  });

  const MIX_TARGETS = Object.freeze({
    low: Object.freeze({ direct: 0.90, adjacent: 0.10, discovery: 0 }),
    balanced: Object.freeze({ direct: 0.75, adjacent: 0.20, discovery: 0.05 }),
    high: Object.freeze({ direct: 0.60, adjacent: 0.30, discovery: 0.10 }),
    maximum: Object.freeze({ direct: 0.45, adjacent: 0.35, discovery: 0.20 }),
  });

  function enumValue(value, allowed, fallback){
    return allowed.includes(value) ? value : fallback;
  }

  function normalize(input = {}, { showSpoilers = false } = {}){
    const saved = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      froth: enumValue(saved.froth, FROTH_LEVELS, DEFAULT_CONTROLS.froth),
      scope: enumValue(saved.scope, SCOPES, DEFAULT_CONTROLS.scope),
      availability: enumValue(saved.availability, AVAILABILITY, DEFAULT_CONTROLS.availability),
      timing: enumValue(saved.timing, TIMING, DEFAULT_CONTROLS.timing),
      stakes: enumValue(saved.stakes === "must_watch" ? "top_picks" : saved.stakes, STAKES, DEFAULT_CONTROLS.stakes),
      spoilers: enumValue(saved.spoilers, SPOILERS, showSpoilers ? "results_visible" : DEFAULT_CONTROLS.spoilers),
      expanded: saved.expanded !== false,
    };
  }

  function accessTypes(event){
    const types = new Set();
    (Array.isArray(event?.broadcasts) ? event.broadcasts : []).forEach(option => {
      const declared = String(option?.accessType || option?.type || option?.platformType || "").toLowerCase();
      if (declared === "fta") types.add("free");
      else if (["subscription", "streaming"].includes(declared)) types.add("included");
      else if (["free", "included", "ppv"].includes(declared)) types.add(declared);
    });
    if (event?.auViewing?.isFreeToWatchAu) types.add("free");
    if (event?.auViewing?.isIncludedWithSubscriptionAu) types.add("included");
    if (event?.auViewing?.isPpvAu) types.add("ppv");
    if (["free", "included", "ppv"].includes(event?.auViewing?.availability)) types.add(event.auViewing.availability);
    return Array.from(types);
  }

  function eventStart(event){
    const utc = Date.parse(event?.startTimeUtc || "");
    if (Number.isFinite(utc)) return new Date(utc);
    const match = `${event?.date || ""}T${event?.time || "00:00"}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, year, month, day, hour, minute] = match.map(Number);
    const assumedUtc = Date.UTC(year, month - 1, day, hour, minute);
    const offsetParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(assumedUtc));
    const offset = Object.fromEntries(offsetParts.map(part => [part.type, Number(part.value)]));
    const renderedAsUtc = Date.UTC(offset.year, offset.month - 1, offset.day, offset.hour, offset.minute);
    return new Date(assumedUtc - (renderedAsUtc - assumedUtc));
  }

  function sydneyParts(value){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    return Object.fromEntries(parts.map(part => [part.type, part.value]));
  }

  function sydneyDate(value){
    const parts = sydneyParts(value);
    return parts ? `${parts.year}-${parts.month}-${parts.day}` : null;
  }

  function friendlyWindow(event){
    if (event?.auViewing?.friendlyWindow && event.auViewing.friendlyWindow !== "unknown") return event.auViewing.friendlyWindow;
    const parts = sydneyParts(eventStart(event));
    if (!parts) return "unknown";
    const hour = Number(parts.hour);
    if (hour >= 5 && hour < 10) return "breakfast";
    if (hour >= 10 && hour < 17) return "daytime";
    if (hour >= 17 && hour < 23) return "primetime";
    if (hour >= 23 || hour < 1) return "late_night";
    return "overnight";
  }

  function isLiveNow(event, now){
    if (String(event?.status || "").toLowerCase() === "live") return true;
    const start = eventStart(event);
    if (!start) return false;
    const end = Date.parse(event?.endTimeUtc || "");
    const fallbackEnd = start.getTime() + Math.max(1, Number(event?.liveWindow) || 3) * 3600000;
    const reference = now instanceof Date ? now : new Date(now);
    return start <= reference && reference.getTime() <= (Number.isFinite(end) ? end : fallbackEnd);
  }

  function matchesAvailability(event, value){
    if (value === "any") return true;
    return accessTypes(event).includes(value);
  }

  function matchesTiming(event, value, now = new Date()){
    if (value === "any") return true;
    const start = eventStart(event);
    if (!start) return false;
    const reference = now instanceof Date ? now : new Date(now);
    if (value === "live_now") return isLiveNow(event, reference);
    if (value === "tonight") return sydneyDate(start) === sydneyDate(reference) && friendlyWindow(event) === "primetime";
    if (value === "this_week") {
      const delta = start.getTime() - reference.getTime();
      return delta >= 0 && delta <= 7 * 86400000;
    }
    if (value === "overnight") return ["late_night", "overnight"].includes(friendlyWindow(event));
    return true;
  }

  function frothMinimumStakes(froth){
    return { low: 4, balanced: 3, high: 2, maximum: 1 }[froth] || 3;
  }

  function isPremierLeagueEvent(event){
    return event?.key === "premier-league" || /premier[-_ ]league/i.test(String(event?.competitionId || ""));
  }

  function matchesStakes(event, controls, {
    explicitCoverage = false,
    followedParticipant = false,
    explicitlyAdded = false,
  } = {}){
    const score = Math.max(1, Math.min(5, Number(event?.stakesScore || event?.storyline?.stakes || 1)));
    if (controls.stakes === "top_picks" && score < 4) return false;
    if (controls.stakes === "important" && score < 3) return false;
    if (isPremierLeagueEvent(event) && controls.froth === "balanced"){
      if (followedParticipant || explicitlyAdded) return true;
      if (score < 4) return false;
    }
    if (controls.stakes === "everything" && explicitCoverage) return true;
    return score >= frothMinimumStakes(controls.froth);
  }

  function matchesEvent(event, input, { now = new Date(), explicitCoverage = false, followedParticipant = false, explicitlyAdded = false } = {}){
    const controls = normalize(input);
    return matchesAvailability(event, controls.availability)
      && matchesTiming(event, controls.timing, now)
      && matchesStakes(event, controls, { explicitCoverage, followedParticipant, explicitlyAdded });
  }

  function classifyRecommendation({
    directInterest = false,
    explicitUnfollow = false,
    competitionDisabled = false,
    mutedParticipant = false,
    negativeContextCount = 0,
    learningScore = 0,
    stakes = 1,
    australianInterest = false,
    availability = "unknown",
    friendlyWindow: watchWindow = "unknown",
  } = {}){
    if (explicitUnfollow || competitionDisabled || mutedParticipant){
      return { classification: "suppressed", eligible: false, label: null, reasons: ["explicit_preference"] };
    }
    if (directInterest){
      return { classification: "direct", eligible: true, label: null, reasons: ["direct_interest"] };
    }
    if (negativeContextCount >= NEGATIVE_SUPPRESSION_COUNT){
      return { classification: "suppressed", eligible: false, label: null, reasons: ["repeated_negative_context"] };
    }
    const reasons = [];
    if (Number(learningScore) > 0) reasons.push("narrative_similarity");
    if (Number(stakes) >= 5) reasons.push("universal_stakes");
    if (australianInterest) reasons.push("australian_relevance");
    if (["free", "included"].includes(availability) && !["late_night", "overnight", "unknown"].includes(watchWindow)) reasons.push("low_friction_watch");
    if (!reasons.length) return { classification: "ineligible", eligible: false, label: null, reasons: [] };
    const adjacent = reasons.includes("narrative_similarity");
    const label = adjacent ? "Because you watch similar events"
      : reasons.includes("australian_relevance") ? "Australian interest"
        : reasons.includes("universal_stakes") ? "Big moment"
          : "Easy to watch";
    return { classification: adjacent ? "adjacent" : "discovery", eligible: true, label, reasons };
  }

  function targetCount(directCount, mix, classification, scope){
    if (scope === "following") return 0;
    const directShare = Math.max(0.01, mix.direct);
    const share = mix[classification] || 0;
    if (!share) return 0;
    const baseline = Math.floor((directCount * share) / directShare);
    const minimum = scope === "explore" ? (classification === "discovery" ? 3 : 2) : 1;
    return Math.max(minimum, baseline);
  }

  function selectRecommendationMix(items, input){
    const controls = normalize(input);
    const mix = MIX_TARGETS[controls.froth];
    const direct = items.filter(item => item.classification === "direct");
    if (controls.scope === "following") return new Set(direct.map(item => item.id));
    const order = (left, right) => (
      Number(right.score || 0) - Number(left.score || 0)
      || Number(left.startsAt || 0) - Number(right.startsAt || 0)
      || String(left.id).localeCompare(String(right.id))
    );
    const adjacent = items.filter(item => item.classification === "adjacent").sort(order);
    const discovery = items.filter(item => item.classification === "discovery").sort(order);
    const selectedAdjacent = adjacent.slice(0, targetCount(direct.length, mix, "adjacent", controls.scope));
    const discoveryLimit = targetCount(direct.length, mix, "discovery", controls.scope);
    const chronologicalDirect = direct.slice().sort((left, right) => Number(left.startsAt || 0) - Number(right.startsAt || 0));
    const firstDepthCutoff = chronologicalDirect[Math.min(FIRST_IMPRESSION_DEPTH - 1, chronologicalDirect.length - 1)]?.startsAt ?? Infinity;
    const selectedDiscovery = [];
    discovery.forEach(item => {
      if (selectedDiscovery.length >= discoveryLimit) return;
      const insideFirstImpression = Number(item.startsAt || 0) <= Number(firstDepthCutoff);
      const earlyCount = selectedDiscovery.filter(candidate => Number(candidate.startsAt || 0) <= Number(firstDepthCutoff)).length;
      if (insideFirstImpression && earlyCount >= FIRST_IMPRESSION_DISCOVERY_CAP) return;
      selectedDiscovery.push(item);
    });
    return new Set([...direct, ...selectedAdjacent, ...selectedDiscovery].map(item => item.id));
  }

  return Object.freeze({
    SCHEMA_VERSION,
    FROTH_LEVELS,
    SCOPES,
    AVAILABILITY,
    TIMING,
    STAKES,
    SPOILERS,
    DEFAULT_CONTROLS,
    MIX_TARGETS,
    NEGATIVE_SUPPRESSION_COUNT,
    FIRST_IMPRESSION_DEPTH,
    FIRST_IMPRESSION_DISCOVERY_CAP,
    EXPERIMENT_FLAGS,
    normalize,
    accessTypes,
    eventStart,
    friendlyWindow,
    isLiveNow,
    matchesAvailability,
    matchesTiming,
    isPremierLeagueEvent,
    matchesStakes,
    matchesEvent,
    classifyRecommendation,
    selectRecommendationMix,
  });
});
