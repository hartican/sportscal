(function attachNothingSportsPersonalisedFeed(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PERSONALISED_FEED = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsPersonalisedFeed(){
  "use strict";

  const VERSION = "personalised-feed.v1";
  const FEED_INTENTS = Object.freeze(["focused", "balanced", "discovery"]);
  const POST_EVENT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

  function normaliseFeedIntent(value){
    return FEED_INTENTS.includes(value) ? value : "balanced";
  }

  function eventId(event){
    return String(event?.eventId || event?.id || "");
  }

  function eventStart(event){
    if (event?.startTimeUtc){
      const parsed = new Date(event.startTimeUtc);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const date = String(event?.date || "");
    const time = String(event?.time || "00:00");
    const parsed = new Date(`${date}T${time}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function eventEnd(event){
    const endDate = String(event?.endDate || "");
    if (/^20\d{2}-\d{2}-\d{2}$/.test(endDate)){
      const parsed = new Date(`${endDate}T23:59:59`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return eventStart(event);
  }

  function normaliseMustWatchAction(action = {}, event, now = new Date()){
    const enabled = Boolean(action.mustWatch);
    const addedAt = enabled
      ? normaliseTimestamp(action.mustWatchAddedAt) || normaliseTimestamp(action.lastActionAt) || normaliseTimestamp(now)
      : null;
    return {
      ...action,
      mustWatch: enabled,
      mustWatchAddedAt: addedAt,
      mustWatchSeenAt: normaliseTimestamp(action.mustWatchSeenAt),
      eventId: action.eventId || eventId(event),
    };
  }

  function normaliseTimestamp(value){
    const parsed = new Date(value || "");
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function isRetainedMustWatch(event, action, now = new Date()){
    if (!action?.mustWatch) return false;
    const end = eventEnd(event);
    if (!end) return true;
    const reference = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(reference.getTime())) return true;
    return reference.getTime() <= end.getTime() + POST_EVENT_RETENTION_MS;
  }

  function queueEvents(events, actionForEvent, now = new Date()){
    return (Array.isArray(events) ? events : [])
      .filter(event => isRetainedMustWatch(event, actionForEvent(event), now))
      .slice()
      .sort((first, second) => {
        const firstStart = eventStart(first)?.getTime() || Number.MAX_SAFE_INTEGER;
        const secondStart = eventStart(second)?.getTime() || Number.MAX_SAFE_INTEGER;
        return firstStart - secondStart || eventId(first).localeCompare(eventId(second));
      });
  }

  function splitTimeline(events, actionForEvent, now = new Date()){
    const reference = now instanceof Date ? now : new Date(now);
    const queuedIds = new Set(queueEvents(events, actionForEvent, reference).map(eventId));
    const result = { retainedPast: [], mustWatch: [], today: [], future: [] };
    const today = localDateKey(reference);
    (Array.isArray(events) ? events : []).forEach(event => {
      const id = eventId(event);
      const start = eventStart(event);
      if (queuedIds.has(id)) return;
      if (!start || start.getTime() < reference.getTime()) {
        result.retainedPast.push(event);
      } else if (localDateKey(start) === today) {
        result.today.push(event);
      } else {
        result.future.push(event);
      }
    });
    result.retainedPast.sort((first, second) => (eventStart(second)?.getTime() || 0) - (eventStart(first)?.getTime() || 0));
    result.today.sort(compareChronological);
    result.future.sort(compareChronological);
    result.mustWatch = queueEvents(events, actionForEvent, reference);
    return result;
  }

  function compareChronological(first, second){
    return (eventStart(first)?.getTime() || Number.MAX_SAFE_INTEGER) - (eventStart(second)?.getTime() || Number.MAX_SAFE_INTEGER)
      || eventId(first).localeCompare(eventId(second));
  }

  function localDateKey(value){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  return Object.freeze({
    VERSION,
    FEED_INTENTS,
    POST_EVENT_RETENTION_MS,
    normaliseFeedIntent,
    normaliseMustWatchAction,
    isRetainedMustWatch,
    queueEvents,
    splitTimeline,
  });
});
