(function attachNothingSportsFollowFeedPolicy(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FEED_POLICY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFollowFeedPolicy(){
  "use strict";

  const SCHEMA_VERSION = "follow-feed-policy.v2";
  const SYDNEY_TIME_ZONE = "Australia/Sydney";

  function dateKey(value, timeZone = SYDNEY_TIME_ZONE){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
    }).format(date);
  }

  function stakesScore(event){
    const storyline = Number(event?.storyline?.stakes);
    if (Number.isInteger(storyline) && storyline >= 1 && storyline <= 5) return storyline;
    const explicit = Number(event?.stakesScore);
    return Number.isFinite(explicit) ? Math.max(1, Math.min(5, Math.round(explicit))) : 1;
  }

  function participantIds(event){
    return Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participantSlots) ? event.participantSlots.map(slot => slot?.participantId) : []),
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].filter(Boolean).map(String)));
  }

  function hasReleasedMatchup(event){
    const status = String(event?.status || event?.scheduleStatus || "scheduled").toLowerCase();
    return Boolean(
      event?.date
      && participantIds(event).length >= 2
      && !["cancelled", "abandoned", "postponed", "unpublished"].includes(status)
    );
  }

  function isFinalsOrKnockout(event){
    if(event?.isFinals===true || event?.isKnockout===true || event?.knockout===true)return true;
    const text=[event?.stage,event?.round,event?.roundLabel,event?.competitionName,event?.name].filter(Boolean).join(" ").toLowerCase();
    return /\b(finals?|semi[- ]?finals?|quarter[- ]?finals?|eliminat(?:ion|or)|qualifying final|knockout|play[- ]?offs?|grand final)\b/.test(text);
  }

  function eligibleForFollow(event,{competitionFollow=false,participantFollow=false,explicitSelection=false}={}){
    if(explicitSelection)return true;
    if(!hasReleasedMatchup(event))return false;
    if(participantFollow)return true;
    return Boolean(competitionFollow && (stakesScore(event)>=4 || isFinalsOrKnockout(event)));
  }

  function followedFixtureDecision(event, { followed = false, followSource = "sport", now = new Date(), timeZone = SYDNEY_TIME_ZONE } = {}){
    if (!followed || !hasReleasedMatchup(event)) return { mode:"ineligible", include:false, label:"Add to Feed" };
    if (["team", "athlete", "collection", "entity"].includes(String(followSource || ""))){
      return { mode:"direct", include:true, label:"In Feed via follow" };
    }
    if (eligibleForFollow(event,{competitionFollow:true})) return { mode:"immediate", include:true, label:"In Feed via follow" };
    return { mode:"manual", include:false, label:"Add to Feed" };
  }

  return Object.freeze({ SCHEMA_VERSION, SYDNEY_TIME_ZONE, dateKey, hasReleasedMatchup, participantIds, stakesScore, isFinalsOrKnockout, eligibleForFollow, followedFixtureDecision });
});
