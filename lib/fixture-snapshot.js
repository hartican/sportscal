"use strict";

// Source omissions are not deletions. Keep explicit withdrawal/status updates;
// expire consumer caches separately, without deleting season history.
function mergeFixtureSnapshot(previous, incoming){
  if (!Array.isArray(previous) || !Array.isArray(incoming)) throw new Error("Fixture snapshots must be arrays");
  const ids = event => event && typeof event === "object" && !Array.isArray(event)
    ? [event.canonicalEventId,event.eventId,event.id,...(event.sourceEventIds||[])].filter(id => typeof id === "string" && id).map(String) : [];
  const events = [], indexes = new Map();
  let invalid = 0, updated = 0;
  const put = (event, current) => {
    const aliases = ids(event);
    if (!aliases.length){ if (current) invalid++; return; }
    const matches=[...new Set(aliases.map(id=>indexes.get(id)).filter(index=>index!==undefined))];
    const match=matches[0];
    const index = match ?? events.length;
    if (current && match !== undefined) updated++;
    const combinedAliases=[...new Set([...aliases,...matches.flatMap(i=>ids(events[i]))])];
    for(const duplicate of matches.slice(1)){events[index]={...events[duplicate],...events[index]};events[duplicate]=null;for(const [alias,i] of indexes)if(i===duplicate)indexes.set(alias,index);}
    events[index] = {...events[index],...event,...(matches.length>1?{sourceEventIds:combinedAliases}:{})};
    aliases.forEach(id => indexes.set(id,index));
  };
  previous.forEach(event => put(event,false));
  const previousCount = events.length;
  incoming.forEach(event => put(event,true));
  return {events:events.filter(Boolean),invalid,updated,retained:Math.max(0,previousCount-updated)};
}

module.exports = {mergeFixtureSnapshot};
