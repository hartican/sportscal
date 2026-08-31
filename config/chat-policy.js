(function attachNothingSportsChatPolicy(root, factory){
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NOTHINGSPORTS_CHAT_POLICY = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildChatPolicy(){
  "use strict";

  const SCHEMA_VERSION = "chat-policy.v1";
  const GIF_UNLOCK_POINTS = 25;
  const FOLLOWS_SESSION_WINDOW_MS = 12 * 60 * 60 * 1000;
  const CLOSED_STATUSES = new Set(["cancelled", "postponed", "completed", "past", "finished", "final"]);

  function iso(value){
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  function fixtureTiming(event = {}){
    const exactStart = iso(event.startTimeUtc);
    const sessionStart = iso(event.sessionStartTimeUtc || event.timelineSortTimeUtc);
    const follows = String(event.timePrecision || "").toLowerCase() === "follows" && !exactStart && sessionStart;
    return {
      timingPrecision:follows ? "follows" : exactStart ? String(event.timePrecision || "exact") : "unknown",
      startTimeUtc:exactStart,
      sessionStartTimeUtc:sessionStart,
      sequenceInSession:Number.isFinite(Number(event.sequenceInSession)) ? Number(event.sequenceInSession) : null,
      effectiveStartTimeUtc:exactStart || (follows ? sessionStart : null),
    };
  }

  function fixtureEligibility(event, nowValue = new Date()){
    const timing = fixtureTiming(event);
    const effectiveStart = Date.parse(timing.effectiveStartTimeUtc || "");
    const now = nowValue instanceof Date ? nowValue.getTime() : Date.parse(nowValue || "");
    const status = String(event?.status || event?.scheduleStatus || "").toLowerCase();
    if (CLOSED_STATUSES.has(status)) return { eligible:false, reason:"closed", timing };
    if (!Number.isFinite(effectiveStart) || !Number.isFinite(now)) return { eligible:false, reason:"timing-unavailable", timing };
    const exactWindow = Math.max(.25, Math.min(24, Number(event?.liveWindow || 3))) * 60 * 60 * 1000;
    const end = effectiveStart + (timing.timingPrecision === "follows" ? FOLLOWS_SESSION_WINDOW_MS : exactWindow);
    return { eligible:effectiveStart > now || now <= end, reason:effectiveStart > now || now <= end ? "upcoming-or-live" : "elapsed", timing };
  }

  function gifCapability(points){
    const lifetimeNscPoints = Math.max(0, Math.floor(Number(points) || 0));
    return { lifetimeNscPoints, gifMinimumPoints:GIF_UNLOCK_POINTS, canUseGifs:lifetimeNscPoints >= GIF_UNLOCK_POINTS };
  }

  return Object.freeze({ SCHEMA_VERSION, GIF_UNLOCK_POINTS, FOLLOWS_SESSION_WINDOW_MS, fixtureTiming, fixtureEligibility, gifCapability });
});
