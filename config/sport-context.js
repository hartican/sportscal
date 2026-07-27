(function attachNothingSportsSportContext(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SPORT_CONTEXT = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsSportContext(){
  "use strict";

  function clone(value){
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function mergeById(collections){
    const merged = new Map();
    collections.flat().filter(Boolean).forEach(item => {
      if (item.id) merged.set(item.id, { ...(merged.get(item.id) || {}), ...clone(item) });
    });
    return Array.from(merged.values());
  }

  function mergeSources(collections){
    const merged = new Map();
    collections.flat().filter(Boolean).forEach(source => {
      const key = `${source.provider || ""}:${source.sourceUrl || ""}`;
      merged.set(key, { ...(merged.get(key) || {}), ...clone(source) });
    });
    return Array.from(merged.values());
  }

  function mergeCanonicalBundles(...bundles){
    const available = bundles.filter(bundle => bundle && typeof bundle === "object");
    if (!available.length) return null;
    const base = clone(available[0]);
    return {
      ...base,
      generatedAt: available
        .map(bundle => bundle.generatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || base.generatedAt,
      sources: mergeSources(available.map(bundle => bundle.sources || [])),
      sportDomains: mergeById(available.map(bundle => bundle.sportDomains || [])),
      competitionFamilies: mergeById(available.map(bundle => bundle.competitionFamilies || [])),
      competitions: mergeById(available.map(bundle => bundle.competitions || [])),
      participants: mergeById(available.map(bundle => bundle.participants || [])),
      events: mergeById(available.map(bundle => bundle.events || [])),
      ladderSnapshots: mergeById(available.map(bundle => bundle.ladderSnapshots || [])),
      eventParticipantScopes: available.flatMap(bundle => clone(bundle.eventParticipantScopes || [])),
    };
  }

  function participantIdsForScope(scope, context){
    return (context?.participants || [])
      .filter(participant => participant.sportDomainId === scope.participantSportDomainId)
      .filter(participant => participant.metadata?.active !== false)
      .map(participant => participant.id);
  }

  function applyEventContext(event, context){
    const title = `${event?.name || ""} ${event?.displayTitleCompact || ""}`.trim();
    const scope = (context?.eventParticipantScopes || []).find(candidate => {
      if (candidate.sportKey !== event?.key) return false;
      try{
        return new RegExp(candidate.titlePattern, "i").test(title);
      }catch{
        return false;
      }
    });
    if (!scope) return { ...event };
    const participantIds = Array.from(new Set([
      ...(Array.isArray(event.participantIds) ? event.participantIds : []),
      ...participantIdsForScope(scope, context),
    ]));
    return {
      ...event,
      sportDomainId: event.sportDomainId || scope.preferenceDomainId || event.key,
      participantIds,
    };
  }

  function applyContextToEvents(events, context){
    return (Array.isArray(events) ? events : []).map(event => applyEventContext(event, context));
  }

  return Object.freeze({
    applyContextToEvents,
    applyEventContext,
    mergeCanonicalBundles,
  });
});
