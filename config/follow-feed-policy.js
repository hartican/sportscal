(function attachNothingSportsFollowFeedPolicy(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FEED_POLICY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFollowFeedPolicy(){
  "use strict";

  const SCHEMA_VERSION = "follow-feed-policy.v9";
  const SYDNEY_TIME_ZONE = "Australia/Sydney";
  const SYDNEY_DATE = new Intl.DateTimeFormat('en-CA',{timeZone:SYDNEY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});

  function dateKey(value, timeZone = SYDNEY_TIME_ZONE){
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return (timeZone === SYDNEY_TIME_ZONE ? SYDNEY_DATE : new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
    })).format(date);
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

  function golfMajor(event){
    if(!['golf','masters'].includes(sportKey(event)))return false;
    return sportKey(event)==='masters' || event.isMajor===true || event.major===true || event.stage==='Major' || /^(?:\d{4} )?(?:Masters Tournament|The Masters|PGA Championship|U\.?S\.? Open|The Open(?: Championship)?|U\.?S\.? Women['’]?s Open|AIG Women['’]?s Open|The Chevron Championship|KPMG Women['’]?s PGA Championship|The Amundi Evian Championship)(?: \d{4})?$/i.test(event.tournamentName||event.name||'');
  }
  function aggregateEvent(event){
    if (!event) return true;
    if(['golf','masters'].includes(sportKey(event)) && event.kind!=='ticket_sale')return false;
    if (event.majorEventMarker || event.tournamentParent || event.narrativeType === "tennis-tournament-overview" || event.cardKind === "event" || ["tournament","major_event","ticket_sale"].includes(event.kind)) return true;
    // Legacy published summaries have no typed kind. Do not confuse a dated
    // championship match with the programme for a whole week or round.
    return /\bfinals?\s+week\s*\d|\bpreliminary finals\b|\bfinals series\b/i.test(event.name || "") && participantIds(event).length < 2;
  }

  function explicitCompetitionRequired(event){
    const key = sportKey(event);
    if(golfMajor(event))return false;
    if (["aflw", "nrlw"].includes(key)) return true;
    if (key === "tennis") return false;
    return /women|female|\bwbb[l]\b|\bwpl\b/i.test([event.gender,event.genderCategory,event.competitionGender,event.competitionId,event.competitionName,event.name].filter(Boolean).join(" "));
  }

  function premiershipDomainId(event){
    const key=sportKey(event);
    return ["afl","nrl"].includes(key) && (!event.competitionId || event.competitionId===key || new RegExp(`^competition:${key}[:-]premiership(?:[:-]|$)`).test(event.competitionId)) ? `sport:${key}-premiership` : null;
  }

  function effectiveDomainPreferences(event, preferences){
    const domains=preferences?.preferenceGraph?.domainPreferences || [];
    const taxonomy=globalThis.NOTHINGSPORTS_SELECTOR_TAXONOMY
      || (typeof require === "function" ? require("./selector-taxonomy.js") : null);
    const selected=new Set(preferences?.selectedSelectorEntityIds || []);
    const ancestors=new Set();
    // Parent switches are projections of selection, not independent exclusions
    // of explicitly chosen children. Resolve specificity for this fixture only;
    // never enable the parent or admit any unselected siblings.
    for(const id of [premiershipDomainId(event),`sport:${sportKey(event)}`,event?.sportDomainId]){
      if(!id || !selected.has(id))continue;
      let parent=taxonomy?.byId?.[id]?.parentId;
      while(parent?.startsWith("sport:") && !ancestors.has(parent)){
        ancestors.add(parent);
        parent=taxonomy?.byId?.[parent]?.parentId;
      }
    }
    return ancestors.size ? domains.filter(p=>!ancestors.has(p.sportDomainId)) : domains;
  }

  function eventFamilyIds(event){
    return [event?.eventFamilyId,event?.majorEventId,event?.parentEventId,event?.eventSeriesId,event?.competitionId].filter(Boolean).map(id=>String(id).replace(/^(?:major-event|major|event|event-series):/, "").replace(/^(?:competition|tournament):/, "").replace(/[:-]\d{4}.*$/, "").split(":").at(-1));
  }

  function explicitlyExcluded(event, preferences){
    const graph = preferences?.preferenceGraph || {};
    const key = sportKey(event);
    return (preferences?.followFirst?.excludedMajorEventIds || []).some(id=>eventFamilyIds(event).includes(id))
      || (graph.competitionPreferences || []).some(p => p.competitionId === event.competitionId && p.enabled === false)
      || effectiveDomainPreferences(event,preferences).some(p => [event.sportDomainId, `sport:${key}`, premiershipDomainId(event)].filter(Boolean).includes(p.sportDomainId) && p.enabled === false);
  }

  function sportingFixture(event){
    if(['golf','masters'].includes(sportKey(event)) && event.kind!=='ticket_sale')return hasPublishedFixture(event);
    return hasPublishedFixture(event) && !aggregateEvent(event) && !event.majorEventMarker && !event.tournamentParent
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
      return (doubles ? final : final || /quarter[- ]?final|semi[- ]?final|\b[qQsS][fF]\b|\b(?:QF|SF)\b/i.test(round));
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

  function feedEligibleSession(event){
    return !(sportKey(event) === "f1" && isPractice(event));
  }

  function isFinalsOrKnockout(event){
    if(event?.isFinals===true || event?.isKnockout===true || event?.knockout===true)return true;
    const text=[event?.stage,event?.round,event?.roundLabel,event?.competitionName,event?.name].filter(Boolean).join(" ").toLowerCase();
    return /\b(finals?|semi[- ]?finals?|quarter[- ]?finals?|eliminat(?:ion|or)|qualifying final|knockout|play[- ]?offs?|grand final)\b/.test(text);
  }

  function eligibleForFollow(event,{competitionFollow=false,participantFollow=false,explicitSelection=false,explicitEventFollow=false,australiansOnly=false,australianDiscovery=false,muted=false}={}){
    if(!hasPublishedFixture(event) || aggregateEvent(event) || !feedEligibleSession(event))return false;
    if(muted)return false;
    if(explicitSelection)return true;
    if(['golf','masters'].includes(sportKey(event)))return competitionFollow&&golfMajor(event)&&(!australiansOnly||hasAustralianParticipant(event));
    if(participantFollow)return true;
    if(!sportingFixture(event))return false;
    if(sportKey(event)==="f1" && competitionFollow)return true;
    if(sportKey(event)==="tennis")return false;
    if(explicitEventFollow)return isMarquee(event);
    if(["cricket","rugby"].includes(sportKey(event)))return false;
    if(australiansOnly && australiansFilterUseful(event))return competitionFollow && hasAustralianParticipant(event);
    if(australianDiscovery && hasAustralianParticipant(event))return true;
    return Boolean(competitionFollow && isMarquee(event));
  }

  function followedFixtureDecision(event, { followed = false, followSource = "sport", now = new Date(), timeZone = SYDNEY_TIME_ZONE } = {}){
    if (!followed || !hasPublishedFixture(event) || aggregateEvent(event) || !feedEligibleSession(event)) return { mode:"ineligible", include:false, label:"Add to Feed" };
    if (["team", "athlete", "collection", "entity", "australians", "competition"].includes(String(followSource || ""))){
      return { mode:"direct", include:true, label:"In Feed via follow" };
    }
    if (eligibleForFollow(event,{competitionFollow:true})) return { mode:"immediate", include:true, label:"In Feed via follow" };
    return { mode:"manual", include:false, label:"Add to Feed" };
  }

  return Object.freeze({ SCHEMA_VERSION, SYDNEY_TIME_ZONE, golfMajor, aggregateEvent, explicitCompetitionRequired, effectiveDomainPreferences, explicitlyExcluded, dateKey, hasReleasedMatchup, hasPublishedFixture, sportingFixture, sportKey, isChampionshipMarquee, isPractice, feedEligibleSession, participantIds, stakesScore, isFinalsOrKnockout, isMarquee, australiansFilterUseful, hasAustralianParticipant, eligibleForFollow, followedFixtureDecision });
});
