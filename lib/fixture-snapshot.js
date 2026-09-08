"use strict";

// Source omissions are not deletions. Keep explicit withdrawal/status updates;
// expire consumer caches separately, without deleting season history.
function mergeFixtureSnapshot(previous, incoming){
  if (!Array.isArray(previous) || !Array.isArray(incoming)) throw new Error("Fixture snapshots must be arrays");
  const ids = event => event && typeof event === "object" && !Array.isArray(event)
    ? [event.canonicalEventId,event.eventId,event.id].filter(id => typeof id === "string" && id).map(String) : [];
  const events = [], indexes = new Map();
  let invalid = 0, updated = 0;
  const put = (event, current) => {
    const aliases = ids(event);
    if (!aliases.length){ if (current) invalid++; return; }
    const match = aliases.map(id => indexes.get(id)).find(index => index !== undefined);
    const index = match ?? events.length;
    if (current && match !== undefined) updated++;
    events[index] = {...events[index],...event};
    aliases.forEach(id => indexes.set(id,index));
  };
  previous.forEach(event => put(event,false));
  const previousCount = events.length;
  incoming.forEach(event => put(event,true));
  return {events,invalid,updated,retained:Math.max(0,previousCount-updated)};
}

module.exports = {mergeFixtureSnapshot};
