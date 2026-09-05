(function attachNothingSportsFeedRefreshLifecycle(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FEED_REFRESH_LIFECYCLE = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsFeedRefreshLifecycle(){
  "use strict";

  const CONTEXT_ONLY_EVENT_FIELDS = new Set([
    "awayParticipantId",
    "broadcasterIds",
    "broadcastOptions",
    "competitionId",
    "homeParticipantId",
    "participantIds",
    "sportDomainId",
    "sportDomainIds",
  ]);
  const VOLATILE_CARD_FIELDS = new Set(["generatedAt"]);
  const VOLATILE_EVENT_FIELD = /(?:checked|generated|retrieved|updated)At$/i;

  function stableClone(value, ignoredFields = new Set(), ignoredPattern = null){
    if (Array.isArray(value)) return value.map(item => stableClone(item, ignoredFields, ignoredPattern));
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      if (!ignoredFields.has(key) && !ignoredPattern?.test(key)) result[key] = stableClone(value[key], ignoredFields, ignoredPattern);
      return result;
    }, {});
  }

  function presentationFingerprint({
    events = [],
    derivedCards = [],
  } = {}){
    const visibleEventIds = new Set(events.map(event => String(event?.eventId || event?.id || "")).filter(Boolean));
    const relevantCards = derivedCards.filter(card => visibleEventIds.has(String(card?.canonicalEventId || "")));
    return JSON.stringify({
      events: events.map(event => stableClone(event, CONTEXT_ONLY_EVENT_FIELDS, VOLATILE_EVENT_FIELD)),
      derivedCards: relevantCards.map(card => stableClone(card, VOLATILE_CARD_FIELDS)),
    });
  }

  function shouldRenderUpdate(committedFingerprint, nextFingerprint){
    return committedFingerprint === null || committedFingerprint === undefined || committedFingerprint !== nextFingerprint;
  }

  function createStartupCoordinator({
    hadControllerAtStartup = false,
    reloadForUpdate = () => {},
  } = {}){
    let hydrating = true;
    let controllerUpdatePending = false;
    let reloadCommitted = false;

    function releasePendingUpdate(){
      if (
        hydrating
        || !hadControllerAtStartup
        || !controllerUpdatePending
        || reloadCommitted
      ) return false;
      // The activated worker serves the next navigation. Never restart an
      // already visible document or replay its launch animation.
      controllerUpdatePending = false;
      reloadCommitted = true;
      return false;
    }

    return Object.freeze({
      isHydrating(){
        return hydrating;
      },
      controllerChanged(){
        if (!hadControllerAtStartup || reloadCommitted) return false;
        controllerUpdatePending = true;
        return releasePendingUpdate();
      },
      markHydrationComplete(){
        hydrating = false;
        return releasePendingUpdate();
      },
    });
  }

  return Object.freeze({
    createStartupCoordinator,
    presentationFingerprint,
    shouldRenderUpdate,
  });
});
