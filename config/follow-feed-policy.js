(function attachNothingSportsFollowFeedPolicy(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FEED_POLICY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFollowFeedPolicy(){
  "use strict";

  const SCHEMA_VERSION = "follow-feed-policy.v4";
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
    const excluded = new Set(Array.isArray(event?.excludedParticipantIds) ? event.excludedParticipantIds : []);
    return Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participantSlots) ? event.participantSlots.map(slot => slot?.participantId) : []),
      ...(Array.isArray(event?.participants) ? event.participants.map(participant => participant?.id || participant?.participantId) : []),
      ...(Array.isArray(event?.matchupSides) ? event.matchupSides.flatMap(side => (side?.players || []).map(player => player?.id)) : []),
      event?.homeTeamId,
      event?.awayTeamId,
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].filter(Boolean).map(String))).filter(id => !excluded.has(id));
  }

  function sportingFixture(event){
    return hasPublishedFixture(event) && !event.majorEventMarker && !event.tournamentParent
      && event.cardKind !== "event" && !["tournament", "major_event", "ticket_sale"].includes(event.kind);
  }

  function sportKey(event){
    const competition = String(event?.competitionId || "");
    if (/^competition:(formula-one|f1)(?:[:-]|$)/.test(competition)) return "f1";
    if (/^competition:wrc(?:[:-]|$)/.test(competition)) return "wrc";
    const key = String(event?.key || event?.sportKey || event?.representativeSportKey || event?.sportId || event?.sportDomainId || "").replace(/^sport:/, "");
    return ({"rugby-union":"rugby",wimbledon:"tennis",fifa:"football","premier-league":"football",rally:"wrc",basketball:"nba"})[key] || key;
  }

  function australiansFilterUseful(event){
    const key = sportKey(event);
    if (["afl", "aflw", "nrl", "nrlw", "afl-premiership", "nrl-premiership"].includes(key)) return false;
    if (["rugby", "cricket"].includes(key) && event?.competitionScope === "domestic"
      && ["AU", "AUS"].includes(String(event?.countryCode || event?.competitionCountryCode || "").toUpperCase())) return false;
    return true;
  }

  function hasAustralianParticipant(event){
    const excluded = new Set(event?.excludedParticipantIds || []);
    const participants = (Array.isArray(event?.participants) ? event.participants : []).filter(p => !excluded.has(p.id || p.participantId));
    const codes = [event?.representingCountryCode, ...(event?.representativeCountryCodes || []),
      ...(event?.participantCountryCodes || []), ...participants.flatMap(p => [p.countryCode,p.nationalityCode,p.isAustralian ? "AU" : null])];
    // A source-confirmed complete field supersedes a provisional country summary.
    const effective = event?.participantsConfirmed === true && participants.length
      ? participants.flatMap(p => [p.countryCode,p.nationalityCode,p.isAustralian ? "AU" : null]) : codes;
    return effective.some(code => ["AU", "AUS"].includes(String(code || "").toUpperCase()));
  }

  function explicitMarquee(event){
    const classification = event?.marqueeClassification;
    return classification?.isMarquee === true && Array.isArray(classification.sourceUrls) && classification.sourceUrls.some(url => /^https:\/\//.test(url));
  }

  function isMarquee(event){
    if (!sportingFixture(event) || isPractice(event)) return false;
    if (isChampionshipMarquee(event)) return true;
    const key = sportKey(event);
    const round = [event?.stage,event?.round,event?.roundLabel].filter(Boolean).join(" ");
    if (key === "tennis"){
      const doubles = /doubles/i.test([event.eventType,event.matchType,event.discipline,event.drawType,event.stage,event.name].filter(Boolean).join(" "));
      const final = /^(?:women.s |men.s |mixed |singles |doubles )*(?:grand )?finals?$/i.test(round.trim()) || /\bfinal\b/i.test(round) && !/quarter|semi|round|qualif/i.test(round);
      return (doubles ? final : final || /quarter[- ]?final|semi[- ]?final|\b[qQsS][fF]\b|\b(?:QF|SF)\b/i.test(round)) || explicitMarquee(event);
    }
    const international = event?.isInternational === true || event?.competitionScope === "international";
    const junior = event?.isSenior === false || /\b(?:u[- ]?(?:1[0-9]|2[0-3])|under[- ]?(?:1[0-9]|2[0-3])|junior|youth)\b/i.test([event?.ageGroup,event?.competitionName,event?.name].join(" "));
    if (["rugby", "cricket"].includes(key) && international && !junior) return true;
    return isFinalsOrKnockout(event) || explicitMarquee(event);
  }

  function hasReleasedMatchup(event){
    const status = String(event?.status || event?.scheduleStatus || "scheduled").toLowerCase();
    return Boolean(
      event?.date
      && participantIds(event).length >= 2
      && !["cancelled", "abandoned", "postponed", "unpublished"].includes(status)
    );
  }

  // A published fixture is not necessarily a two-sided matchup. Race fields,
  // provisional draws and postponed fixtures still belong in a followed Feed.
  function hasPublishedFixture(event){
    const status = String(event?.status || event?.scheduleStatus || "").toLowerCase();
    return Boolean(event && typeof event === "object"
      && (event.canonicalEventId || event.eventId || event.id)
      && event.published !== false && status !== "unpublished");
  }

  function isChampionshipMarquee(event){
    if (event?.majorEventMarker || event?.tournamentParent || event?.cardKind === "event" || ["tournament", "major_event", "ticket_sale"].includes(event?.kind)) return false;
    const competition = String(event?.competitionId || "").toLowerCase();
    const key = sportKey(event);
    if (/^competition:wrc(?:-\d{4})?$/.test(competition) || key === "wrc") return true;
    if(key==='motogp')return !isPractice(event)&&/race|sprint|grand prix/i.test([event.sessionType,event.name].join(' '));
    if(key==='sailgp')return !isPractice(event);
    const f1 = /^competition:(?:formula-one|f1)(?:[:-]\d{4})?$/.test(competition) || key === "f1";
    return f1 && !isPractice(event);
  }

  function isPractice(event){
    return /\b(?:practice|fp[123]|testing|test session)\b/i.test([event?.sessionType,event?.stage,event?.name].filter(Boolean).join(" "));
  }

  function isFinalsOrKnockout(event){
    if(event?.isFinals===true || event?.isKnockout===true || event?.knockout===true)return true;
    const text=[event?.stage,event?.round,event?.roundLabel,event?.competitionName,event?.name].filter(Boolean).join(" ").toLowerCase();
    return /\b(finals?|semi[- ]?finals?|quarter[- ]?finals?|eliminat(?:ion|or)|qualifying final|knockout|play[- ]?offs?|grand final)\b/.test(text);
  }

  function eligibleForFollow(event,{competitionFollow=false,participantFollow=false,explicitSelection=false,explicitEventFollow=false,australiansOnly=false,australianDiscovery=false,muted=false}={}){
    if(!hasPublishedFixture(event))return false;
    if(muted)return false;
    if(explicitSelection)return true;
    if(participantFollow)return true;
    if(!sportingFixture(event))return false;
    if(explicitEventFollow)return isMarquee(event);
    if(australiansOnly && australiansFilterUseful(event))return competitionFollow && hasAustralianParticipant(event);
    if(australianDiscovery && hasAustralianParticipant(event))return true;
    return Boolean(competitionFollow && isMarquee(event));
  }

  function followedFixtureDecision(event, { followed = false, followSource = "sport", now = new Date(), timeZone = SYDNEY_TIME_ZONE } = {}){
    if (!followed || !hasPublishedFixture(event)) return { mode:"ineligible", include:false, label:"Add to Feed" };
    if (["team", "athlete", "collection", "entity", "australians"].includes(String(followSource || ""))){
      return { mode:"direct", include:true, label:"In Feed via follow" };
    }
    if (eligibleForFollow(event,{competitionFollow:true})) return { mode:"immediate", include:true, label:"In Feed via follow" };
    return { mode:"manual", include:false, label:"Add to Feed" };
  }

  return Object.freeze({ SCHEMA_VERSION, SYDNEY_TIME_ZONE, dateKey, hasReleasedMatchup, hasPublishedFixture, sportingFixture, sportKey, isChampionshipMarquee, participantIds, stakesScore, isFinalsOrKnockout, isMarquee, australiansFilterUseful, hasAustralianParticipant, eligibleForFollow, followedFixtureDecision });
});
