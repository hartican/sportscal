(function attachNothingSportsSourceTrust(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SOURCE_TRUST = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsSourceTrust(){
  "use strict";

  const VERSION = "source-trust.v1";
  const VERIFIED_TYPES = Object.freeze(["official", "broadcaster", "explicitly-permitted"]);
  const UNVERIFIED_TYPES = Object.freeze(["reputable", "scraped", "community", "unknown"]);
  const PROTECTED_FACT_FIELDS = Object.freeze(["date", "time", "startTimeUtc", "endTimeUtc", "status", "score", "outcomeText", "recapText"]);

  function normaliseTrust(value, sourceType){
    if (value === "verified" || value === "unverified") return value;
    return VERIFIED_TYPES.includes(String(sourceType || "").toLowerCase()) ? "verified" : "unverified";
  }

  function sourceTrustForEvent(event = {}){
    const trust = normaliseTrust(event.sourceTrust, event.sourceType);
    return Object.freeze({
      trust,
      label: trust === "verified" ? "Verified source" : "Unverified source",
      mayOverrideVerifiedFacts: trust === "verified",
      sourceType: String(event.sourceType || "unknown").toLowerCase(),
    });
  }

  function mergeClaims(current = {}, incoming = {}, { currentTrust, incomingTrust } = {}){
    const currentSource = normaliseTrust(currentTrust || current.sourceTrust, current.sourceType);
    const nextSource = normaliseTrust(incomingTrust || incoming.sourceTrust, incoming.sourceType);
    const merged = { ...current };
    const protectedFields = [];
    Object.entries(incoming || {}).forEach(([key, value]) => {
      if (value === undefined) return;
      if (currentSource === "verified" && nextSource === "unverified" && PROTECTED_FACT_FIELDS.includes(key)) {
        if (current[key] !== undefined && current[key] !== value) protectedFields.push(key);
        return;
      }
      merged[key] = value;
    });
    merged.sourceTrust = nextSource;
    if (currentSource === "verified" && nextSource === "unverified") {
      merged.verifiedFactSource = {
        sourceType: String(current.sourceType || "official").toLowerCase(),
        sourceName: current.sourceName || null,
        sourceUrl: current.sourceUrl || null,
        sourceCheckedAt: current.sourceCheckedAt || null,
        protectedFields: Array.from(new Set(protectedFields)).sort(),
      };
    }
    return merged;
  }

  return Object.freeze({
    VERSION,
    VERIFIED_TYPES,
    UNVERIFIED_TYPES,
    PROTECTED_FACT_FIELDS,
    normaliseTrust,
    sourceTrustForEvent,
    mergeClaims,
  });
});
