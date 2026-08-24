(function attachNothingSportsPersonalisedFeed(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_PERSONALISED_FEED = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsPersonalisedFeed(){
  "use strict";

  const VERSION = "personalised-feed.v1";
  const FEED_INTENTS = Object.freeze(["focused", "balanced", "discovery"]);

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
    if (event?.timeTbc) return null;
    const clock = typeof event?.time === "string" && /^\d{2}:\d{2}$/.test(event.time)
      ? event.time
      : (event?.dateOnly === true || event?.tournamentParent || event?.majorEventMarker ? "00:00" : "");
    const match = `${event?.date || ""}T${clock}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
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

  function splitTimeline(events, _actionForEvent, now = new Date()){
    const reference = now instanceof Date ? now : new Date(now);
    const result = { retainedPast: [], today: [], future: [] };
    const today = sydneyDateKey(reference);
    sortChronological(events).forEach(event => {
      const start = eventStart(event);
      if (!start) return;
      if (start.getTime() < reference.getTime()) {
        result.retainedPast.push(event);
      } else if (sydneyDateKey(start) === today) {
        result.today.push(event);
      } else {
        result.future.push(event);
      }
    });
    return result;
  }

  function compareChronological(first, second){
    return (eventStart(first)?.getTime() || Number.MAX_SAFE_INTEGER) - (eventStart(second)?.getTime() || Number.MAX_SAFE_INTEGER)
      || eventId(first).localeCompare(eventId(second));
  }

  function sortChronological(events){
    return (Array.isArray(events) ? events : [])
      .filter(event => eventStart(event))
      .slice()
      .sort(compareChronological);
  }

  function sydneyDateKey(value){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  return Object.freeze({
    VERSION,
    FEED_INTENTS,
    normaliseFeedIntent,
    eventStart,
    compareChronological,
    sortChronological,
    sydneyDateKey,
    splitTimeline,
  });
});
