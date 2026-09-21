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
    const original = String(structured || result?.score || result?.outcome || "").trim();
    if (!original) return null;
    const labels=globalThis.NOTHINGSPORTS_FIXTURE_LABELS || (typeof require==='function'?require('./fixture-labels'):null);
    const sourceTitle=String(event?.displayTitleCompact || event?.name || '');
    if(labels && labels.matchupTitle(event,sourceTitle)!==sourceTitle){
      const names=sourceTitle.split(/\s+v\.?\s+/i).map(s=>s.split(/\s+[—–]\s+/)[0]);
      if(event.homeScore!=null && event.awayScore!=null && names.length===2)return `${names[0]} ${event.homeScore} — ${names[1]} ${event.awayScore}`;
      return `${sourceTitle}: ${original}`;
    }
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


  function tennisSets(event, displayTitle, result){
    if(!['tennis','wimbledon'].includes(event?.key))return null;
    const sides=event.matchupSides?.map(s=>s.name||s.players?.map(p=>p.name||p.displayName).join(' / '));
    const names=sides?.length===2?sides:String(event.displayTitleCompact||event.name||displayTitle||'').split(/\s+v\.?\s+/i);
    if(names.length!==2||names.some(n=>!n))return null;
    const original=String(event.scoreDisplay||result?.score||event.result||'');
    const first=original.indexOf(names[0]),second=original.indexOf(names[1]);
    const reverse=second>=0&&(first<0||second<first);
    const sets=[];
    // A bracketed score is an explicitly supplied match tie-break, not a sixth set.
    const pattern=/(\[)?(\d{1,2})(?:\((\d{1,2})\))?\s*[-–]\s*(\d{1,2})(?:\((\d{1,2})\))?(\])?/g;
    for(const m of original.matchAll(pattern)){
      const matchTiebreak=Boolean(m[1]&&m[6]);
      const pair=[{games:Number(m[2]),tieBreak:m[3]==null?null:Number(m[3])},{games:Number(m[4]),tieBreak:m[5]==null?null:Number(m[5])}];
      // Common 7-6(5) notation supplies only the losing player's tie-break points.
      if(reverse)pair.reverse();sets.push({label:matchTiebreak?'Match TB':`Set ${sets.filter(s=>s.label!=='Match TB').length+1}`,scores:pair});
    }
    if(!sets.length)return null;
    if(sets.length===1&&sets[0].label!=='Match TB'&&Math.max(...sets[0].scores.map(s=>s.games))<6&&!/\bRET(?:IRED)?\b/i.test(original))return null;
    const labels=globalThis.NOTHINGSPORTS_FIXTURE_LABELS || (typeof require==='function'?require('./fixture-labels'):null);
    const sourceTitle=names.join(' v ');
    const reverseDisplay=labels && (event.matchupSides?.length===2 ? labels.australianFirst(event.matchupSides,event)[0]!==event.matchupSides[0] : labels.matchupTitle(event,sourceTitle)!==sourceTitle);
    if(reverseDisplay){names.reverse();sets.forEach(set=>set.scores.reverse());}
    return {names,sets,status:(original.match(/\b(?:RET(?:IRED)?|W\/?O|WALKOVER|ABD|ABANDONED)\b/i)||[])[0]||null};
  }
  return Object.freeze({ VERSION, structuredScore, scoreLine, tennisSets });
});
