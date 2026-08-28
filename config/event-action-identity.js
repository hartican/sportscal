(function attachNothingSportsEventActionIdentity(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_EVENT_ACTION_IDENTITY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildEventActionIdentity(){
  "use strict";

  const LEGACY_SCHEDULE_SUFFIX = /:(?:\d{4}-\d{2}-\d{2}|null)T(?:\d{2}:\d{2}|null)$/;

  function identifier(value){
    if (value === undefined || value === null) return "";
    return String(value).trim();
  }

  function unique(values){
    return Array.from(new Set(values.map(identifier).filter(Boolean)));
  }

  function aliasesForEvent(event){
    return unique([
      event?.actionKey,
      event?.canonicalEventId,
      event?.eventId,
      event?.id,
    ]);
  }

  function stableKey(event){
    return aliasesForEvent(event)[0] || "";
  }

  function inferredStoredKey(key, action){
    const actionIdentity = stableKey(action);
    if (actionIdentity) return actionIdentity;
    const storedKey = identifier(key);
    return storedKey.replace(LEGACY_SCHEDULE_SUFFIX, "") || storedKey;
  }

  function aliasesForStoredAction(key, action){
    return unique([
      ...aliasesForEvent(action),
      inferredStoredKey(key, action),
      LEGACY_SCHEDULE_SUFFIX.test(identifier(key)) ? "" : key,
    ]);
  }

  function actionTimestamp(action){
    return [
      action?.lastActionAt,
      action?.dismissedAt,
      action?.watchedAt,
      action?.addedToFixturesAt,
      action?.ticketAlertSeenAt,
    ].reduce((latest, value) => {
      const parsed = Date.parse(value || "");
      return Number.isFinite(parsed) ? Math.max(latest, parsed) : latest;
    }, 0);
  }

  function matchingKeys(event, actions){
    const source = actions && typeof actions === "object" && !Array.isArray(actions) ? actions : {};
    const eventAliases = new Set(aliasesForEvent(event));
    if (!eventAliases.size) return [];
    return Object.entries(source)
      .filter(([key, action]) => {
        if (!action || typeof action !== "object" || Array.isArray(action)) return false;
        return aliasesForStoredAction(key, action).some(alias => eventAliases.has(alias));
      })
      .map(([key]) => key);
  }

  function resolveAction(event, actions){
    const source = actions && typeof actions === "object" && !Array.isArray(actions) ? actions : {};
    const key = stableKey(event);
    const matchedKeys = matchingKeys(event, source);
    const selectedKey = matchedKeys
      .map((matchedKey, index) => ({
        key: matchedKey,
        action: source[matchedKey],
        timestamp: actionTimestamp(source[matchedKey]),
        stable: matchedKey === key,
        index,
      }))
      .sort((first, second) => (
        second.timestamp - first.timestamp
        || Number(second.stable) - Number(first.stable)
        || second.index - first.index
      ))[0]?.key || null;
    return {
      key,
      matchedKey: selectedKey,
      matchedKeys,
      action: selectedKey ? source[selectedKey] : null,
    };
  }

  function migrateActions(actions){
    const source = actions && typeof actions === "object" && !Array.isArray(actions) ? actions : {};
    const migrated = {};
    const selected = new Map();
    Object.entries(source).forEach(([key, action], index) => {
      if (!action || typeof action !== "object" || Array.isArray(action)){
        migrated[key] = action;
        return;
      }
      const targetKey = inferredStoredKey(key, action) || key;
      const candidate = {
        key,
        action,
        timestamp: actionTimestamp(action),
        stable: key === targetKey,
        index,
      };
      const current = selected.get(targetKey);
      if (!current
        || candidate.timestamp > current.timestamp
        || (candidate.timestamp === current.timestamp && candidate.stable && !current.stable)
        || (candidate.timestamp === current.timestamp && candidate.stable === current.stable && candidate.index > current.index)){
        selected.set(targetKey, candidate);
      }
    });
    selected.forEach((candidate, targetKey) => {
      migrated[targetKey] = candidate.action;
    });
    return migrated;
  }

  function writeAction(actions, event, action){
    const source = actions && typeof actions === "object" && !Array.isArray(actions) ? actions : {};
    const next = { ...source };
    matchingKeys(event, next).forEach(key => delete next[key]);
    const key = stableKey(event);
    if (!key || !action) return next;
    const canonicalEventId = identifier(event?.canonicalEventId);
    next[key] = {
      ...action,
      actionKey: key,
      ...(canonicalEventId ? { canonicalEventId } : {}),
    };
    return next;
  }

  return Object.freeze({
    actionFor(event, actions){
      return resolveAction(event, actions).action || {};
    },
    aliasesForEvent,
    matchingKeys,
    migrateActions,
    resolveAction,
    stableKey,
    writeAction,
  });
});
