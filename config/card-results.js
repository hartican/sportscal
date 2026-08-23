(function attachNothingSportsCardResults(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_CARD_RESULTS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsCardResults(){
  "use strict";

  const VERSION = "card-results.v1";

  function escapePattern(value){
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function structuredScore(event){
    if (event?.scoreDisplay) return String(event.scoreDisplay).trim();
    const home = event?.homeScore;
    const away = event?.awayScore;
    if (home !== undefined && home !== null && away !== undefined && away !== null) return `${home}-${away}`;
    return null;
  }

  function scoreLine(event, displayTitle, result){
    const structured = structuredScore(event);
    if (structured) return structured;
    const original = String(result?.score || result?.outcome || "").trim();
    if (!original) return null;
    const titleParticipants = String(displayTitle || "")
      .split(/\s+v\.?\s+/i)
      .map(name => name.split(/\s+[\u2014\u2013-]\s+|\s*\(/)[0].trim())
      .filter(Boolean);
    const eventParticipants = (Array.isArray(event?.participants) ? event.participants : [])
      .map(participant => typeof participant === "string" ? participant : participant?.name)
      .map(name => String(name || "").trim())
      .filter(Boolean);
    let compact = original;
    Array.from(new Set([...titleParticipants, ...eventParticipants]))
      .sort((left, right) => right.length - left.length)
      .forEach(name => {
        const escaped = escapePattern(name);
        if (!escaped) return;
        compact = compact.replace(new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "gi"), "$1");
      });
    compact = compact
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,;:\u2014\u2013-]+|[\s,;:\u2014\u2013-]+$/g, "")
      .replace(/^(?:v(?:s\.?)?)\s*(?:[\u2014\u2013-]\s*)?/i, "")
      .replace(/^(?:defeated|beat|def)\s+(?=\d)/i, "")
      .replace(/^beat\s+by\s+/i, "Won by ")
      .trim();
    return compact || original;
  }

  return Object.freeze({ VERSION, structuredScore, scoreLine });
});
