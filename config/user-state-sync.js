(function attachNothingSportsUserStateSync(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_USER_STATE_SYNC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildUserStateSync(){
  "use strict";

  const PATCH_SCHEMA_VERSION = "user-state-patch.v1";
  const STATE_ROOTS = Object.freeze([
    "profile",
    "preferences",
    "eventUserState",
    "eventSpoilerState",
    "archivedEvents",
    "ratings",
  ]);
  const BLOCKED_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

  function clone(value){
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function plainObject(value){
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function canonicalValue(value){
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!plainObject(value)) return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalValue(value[key]);
      return result;
    }, {});
  }

  function sameValue(first, second){
    return JSON.stringify(canonicalValue(first)) === JSON.stringify(canonicalValue(second));
  }

  function validPath(path){
    return Array.isArray(path)
      && path.length >= 1
      && path.length <= 32
      && STATE_ROOTS.includes(path[0])
      && path.every(segment => (
        typeof segment === "string"
        && segment.length >= 1
        && segment.length <= 256
        && !BLOCKED_PATH_SEGMENTS.has(segment)
      ));
  }

  function collectChanges(previous, current, path, changes){
    if (sameValue(previous, current)) return;
    if (current === undefined){
      changes.push({ path: [...path], remove: true });
      return;
    }
    if (!plainObject(previous) || !plainObject(current)){
      changes.push({ path: [...path], value: clone(current) });
      return;
    }
    const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();
    keys.forEach(key => collectChanges(previous[key], current[key], [...path, key], changes));
  }

  function createPatch(baseState, currentState, { baseUpdatedAt = null } = {}){
    const previous = plainObject(baseState) ? baseState : {};
    const current = plainObject(currentState) ? currentState : {};
    const changes = [];
    STATE_ROOTS.forEach(rootKey => collectChanges(previous[rootKey], current[rootKey], [rootKey], changes));
    return {
      schemaVersion: PATCH_SCHEMA_VERSION,
      baseUpdatedAt: typeof baseUpdatedAt === "string" && baseUpdatedAt ? baseUpdatedAt : null,
      changes,
    };
  }

  function normalizePatch(input){
    if (!plainObject(input) || input.schemaVersion !== PATCH_SCHEMA_VERSION || !Array.isArray(input.changes)){
      throw new TypeError("A valid user-state patch is required.");
    }
    if (input.changes.length > 10_000) throw new TypeError("The user-state patch has too many changes.");
    const changes = input.changes.map(change => {
      if (!plainObject(change) || !validPath(change.path)) throw new TypeError("The user-state patch contains an invalid path.");
      const hasValue = Object.prototype.hasOwnProperty.call(change, "value");
      const removesValue = change.remove === true;
      if (hasValue === removesValue) throw new TypeError("A patch change requires either a value or remove flag.");
      if (removesValue) return { path: [...change.path], remove: true };
      return { path: [...change.path], value: clone(change.value) };
    });
    return {
      schemaVersion: PATCH_SCHEMA_VERSION,
      baseUpdatedAt: typeof input.baseUpdatedAt === "string" && input.baseUpdatedAt ? input.baseUpdatedAt : null,
      changes,
    };
  }

  function applyPatch(baseState, input){
    const patch = normalizePatch(input);
    const next = plainObject(baseState) ? clone(baseState) : {};
    patch.changes.forEach(change => {
      let target = next;
      for (let index = 0; index < change.path.length - 1; index += 1){
        const segment = change.path[index];
        if (!plainObject(target[segment])) target[segment] = {};
        target = target[segment];
      }
      const finalSegment = change.path[change.path.length - 1];
      if (change.remove) delete target[finalSegment];
      else target[finalSegment] = clone(change.value);
    });
    return next;
  }

  function hasChanges(patch){
    return normalizePatch(patch).changes.length > 0;
  }

  return Object.freeze({
    PATCH_SCHEMA_VERSION,
    STATE_ROOTS,
    applyPatch,
    createPatch,
    hasChanges,
    normalizePatch,
  });
});
