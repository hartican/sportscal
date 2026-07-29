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
      jerseySnapshots: mergeById(available.map(bundle => bundle.jerseySnapshots || [])),
      eventParticipantScopes: available.flatMap(bundle => clone(bundle.eventParticipantScopes || [])),
    };
  }

  function normalizeMatchText(value){
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en");
  }

  function escapeRegExp(value){
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function participantTitleAliases(participant){
    const configured = Array.isArray(participant?.metadata?.titleAliases)
      ? participant.metadata.titleAliases
      : [];
    return Array.from(new Set([
      ...configured,
      participant?.shortName,
      participant?.displayName,
      participant?.canonicalName,
    ].map(normalizeMatchText).filter(Boolean)));
  }

  function titleContainsAlias(title, alias){
    try{
      return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(alias)}(?:$|[^a-z0-9])`, "i").test(title);
    }catch{
      return false;
    }
  }

  function matchedParticipantIdsForScope(scope, context, title){
    const eligible = (context?.participants || [])
      .filter(participant => participant.sportDomainId === scope.participantSportDomainId)
      .filter(participant => participant.metadata?.active !== false);
    if (scope.resolutionMode !== "title-match") return eligible.map(participant => participant.id);
    const normalizedTitle = normalizeMatchText(title);
    return eligible
      .filter(participant => participantTitleAliases(participant).some(alias => titleContainsAlias(normalizedTitle, alias)))
      .map(participant => participant.id);
  }

  function applyEventContext(event, context){
    const title = `${event?.name || ""} ${event?.displayTitleCompact || ""}`.trim();
    const eventId = String(event?.eventId || event?.id || "");
    const jerseySnapshot = (context?.jerseySnapshots || [])
      .find(candidate => String(candidate.eventId || "") === eventId);
    const contextualEvent = jerseySnapshot
      ? { ...event, jerseySnapshot: clone(jerseySnapshot) }
      : { ...event };
    const scope = (context?.eventParticipantScopes || []).find(candidate => {
      if (candidate.sportKey !== event?.key) return false;
      try{
        return new RegExp(candidate.titlePattern, "i").test(title);
      }catch{
        return false;
      }
    });
    if (!scope) return contextualEvent;
    const participantIds = Array.from(new Set([
      ...(Array.isArray(event.participantIds) ? event.participantIds : []),
      ...matchedParticipantIdsForScope(scope, context, title),
    ]));
    return {
      ...contextualEvent,
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
