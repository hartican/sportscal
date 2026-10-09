(function attachNothingSportsFollowFeedPolicy(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_FOLLOW_FEED_POLICY = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildFollowFeedPolicy(){
  "use strict";

  const SCHEMA_VERSION = "follow-feed-policy.v12";
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
    const identity=globalThis.NOTHINGSPORTS_FIXTURE_IDENTITY || (typeof require==='function'?require('./fixture-identity'):null);
    const canonical=id=>identity?.canonicalParticipantId?.(id)||id;
    const excluded = new Set((Array.isArray(event?.excludedParticipantIds) ? event.excludedParticipantIds : []).map(canonical));
    return Array.from(new Set([
      ...(Array.isArray(event?.participantIds) ? event.participantIds : []),
      ...(Array.isArray(event?.participantSlots) ? event.participantSlots.map(slot => slot?.participantId) : []),
      ...(Array.isArray(event?.participants) ? event.participants.map(participant => participant?.id || participant?.participantId) : []),
      ...(Array.isArray(event?.matchupSides) ? event.matchupSides.flatMap(side => (side?.players || []).map(player => player?.id)) : []),
      event?.homeTeamId,
      event?.awayTeamId,
      event?.homeParticipantId,
      event?.awayParticipantId,
    ].filter(Boolean).map(String))).filter(id => !excluded.has(canonical(id)));
  }

  function presidentsCup(event){return sportKey(event)==='golf'&&event.eventFamilyId==='presidents-cup'&&['competition:presidents-cup'].includes(event.competitionId)&&!/^Live From/i.test(event.name||'');}
  function golfMajor(event){
    if(!['golf','golf-women','masters'].includes(sportKey(event)))return false;
    return sportKey(event)==='masters' || event.isMajor===true || event.major===true || event.stage==='Major' || /^(?:\d{4} )?(?:Masters Tournament|The Masters|PGA Championship|U\.?S\.? Open|The Open(?: Championship)?|U\.?S\.? Women['’]?s Open|AIG Women['’]?s Open|The Chevron Championship|KPMG Women['’]?s PGA Championship|The Amundi Evian Championship)(?: \d{4})?$/i.test(event.tournamentName||event.name||'');
  }
  function tennisModel(){return globalThis.NOTHINGSPORTS_TENNIS_FEED || (typeof require === "function" ? require("./tennis-feed") : null);}

  function aggregateEvent(event){
    if (!event) return true;
    if(['golf','golf-women','masters'].includes(sportKey(event)) && event.kind!=='ticket_sale')return multiDayMarker(event);
    if (event.majorEventMarker || event.tournamentParent || event.narrativeType === "tennis-tournament-overview" || event.cardKind === "event" || ["tournament","major_event","ticket_sale"].includes(event.kind)) return true;
    // Legacy published summaries have no typed kind. Do not confuse a dated
    // championship match with the programme for a whole week or round.
    return /\bfinals?\s+week\s*\d|\bpreliminary finals\b|\bfinals series\b/i.test(event.name || "") && participantIds(event).length < 2;
  }

  function explicitCompetitionRequired(event){
    const key = sportKey(event);
    if(event.competitionId==='competition:wsl-championship-tour'||event.grandTourCalendar===true||event.dakarCalendar===true||event.lemansCalendar===true)return true;
    if(golfMajor(event))return false;
    if (["aflw", "nrlw"].includes(key)) return true;
    if (key.startsWith("tennis")) return false;
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

  // Edition choices override recurring choices and derived participation. They
  // suppress the overview and event-wide coverage, never an independent follow.
  function editionKey(event){
    if(!event?.tournamentId && sportKey(event).startsWith('tennis')){const family=eventFamilyIds(event).find(id=>['australian-open','roland-garros','wimbledon','us-open'].includes(id)),year=String(event.date||event.startDate||'').slice(0,4);if(family&&/^20\d{2}$/.test(year))return 'tournament:tennis:grand-slam-'+family+'-'+year;}
    return String(event?.editionId || event?.tournamentId || event?.tennisTournamentId || event?.majorEventId || event?.canonicalEventId || event?.id || "");
  }
  function editionDecision(event, preferences){return preferences?.followFirst?.eventEditionDecisions?.states?.[editionKey(event)] || null;}
  function eventExcluded(event, preferences){
    const decision=editionDecision(event,preferences);
    return decision ? decision === "excluded" : (preferences?.followFirst?.excludedMajorEventIds || []).some(id=>eventFamilyIds(event).includes(id));
  }
  function activeEligible(event){
    if(!sportKey(event).startsWith('tennis'))return true;
    const levels=[event?.tournamentLevel,event?.level,event?.competitionLevel,...(event?.tourCategories||[]).map(t=>t.level)].filter(Boolean).join(' ');
    return !/250|125|challenger|itf|atp_challenger/i.test(levels+' '+String(event?.competitionId||''));
  }
  function scheduleVisible(event,preferences,collections={}){
    if(!activeEligible(event))return false;
    const key=sportKey(event),ids=participantIds(event);
    if(!key.startsWith('tennis')&&!['golf','golf-women','masters'].includes(key)||ids.some(id=>id.startsWith('team:'))||event.contestUnit==='tie')return true;
    if(key.startsWith('tennis')&&/^(?:(?:men.s|women.s|singles|doubles|mixed|championship|grand)\s+)*(?:quarter[ -]?finals?|semi[ -]?finals?|finals?|QF|SF)$/i.test(String(event.roundLabel||event.round||event.stage||'').trim()))return true;
    const follows=globalThis.NOTHINGSPORTS_FOLLOW_FIRST||(typeof require==='function'?require('./follow-first'):null);
    return ids.some(id=>follows.effectiveParticipantFollow(id,preferences,collections).followed);
  }
  function multiDayMarker(event){return Boolean(event?.tournamentParent || event?.majorEventMarker || event?.cardKind==='event' || ['tournament','major_event'].includes(event?.kind) || ['golf','golf-women','masters'].includes(sportKey(event)) && event?.cardType!=='golf_session' && event?.date && event?.endDate>event.date && !event?.startTimeUtc);}
  function explicitlyExcluded(event, preferences){
    const graph = preferences?.preferenceGraph || {};
    const key = sportKey(event);
    return Number(preferences?.version||0)>=24 && (graph.entityFollows||[]).some(f=>f.followLevel==='mute'&&participantIds(event).includes(f.participantId))
      || aggregateEvent(event) && eventExcluded(event,preferences)
      || (graph.competitionPreferences || []).some(p => p.competitionId === event.competitionId && p.enabled === false)
      || effectiveDomainPreferences(event,preferences).some(p => [event.sportDomainId, `sport:${key}`, premiershipDomainId(event)].filter(Boolean).includes(p.sportDomainId) && p.enabled === false);
  }

  function sportingFixture(event){
    if(['golf','golf-women','masters'].includes(sportKey(event)) && event.kind!=='ticket_sale')return hasPublishedFixture(event)&&!multiDayMarker(event);
    return hasPublishedFixture(event) && !aggregateEvent(event) && !event.majorEventMarker && !event.tournamentParent
      && event.cardKind !== "event" && !["tournament", "major_event", "ticket_sale"].includes(event.kind);
  }

  function sportKey(event){
    const competition = String(event?.competitionId || "");
    if (/^competition:(formula-one|f1)(?:[:-]|$)/.test(competition)) return "f1";
    if (/^competition:wrc(?:[:-]|$)/.test(competition)) return "wrc";
    const key = String(event?.key || event?.sportKey || event?.representativeSportKey || event?.sportId || event?.sportDomainId || "").replace(/^sport:/, "");
    const family=({"rugby-union":"rugby",wimbledon:"tennis",fifa:"football","premier-league":"football",rally:"wrc",basketball:"nba"})[key] || key;
    const labels=globalThis.NOTHINGSPORTS_FIXTURE_LABELS||(typeof require==='function'?require('./fixture-labels'):null);
    return labels?.gender(event)==='women'&&!['aflw','nrlw','wnba','fiba-women','netball'].includes(family)&&!family.endsWith('-women')?family+'-women':family;
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
    if (key.startsWith("tennis")){
      const doubles = /doubles/i.test([event.eventType,event.matchType,event.discipline,event.drawType,event.stage,event.name].filter(Boolean).join(" "));
      const final = /^(?:women.s |men.s |mixed |singles |doubles )*(?:grand )?finals?$/i.test(round.trim()) || /\bfinal\b/i.test(round) && !/quarter|semi|round|qualif/i.test(round);
      return (doubles ? final : final || /quarter[- ]?final|semi[- ]?final|\b[qQsS][fF]\b|\b(?:QF|SF)\b/i.test(round));
    }
    const international = event?.isInternational === true || event?.competitionScope === "international";
    const junior = event?.isSenior === false || /\b(?:u[- ]?(?:1[0-9]|2[0-3])|under[- ]?(?:1[0-9]|2[0-3])|junior|youth)\b/i.test([event?.ageGroup,event?.competitionName,event?.name].join(" "));
    if (["rugby", "cricket"].includes(key) && international && !junior) return true;
    // Senior Socceroos fixtures qualify even when providers omit editorial flags.
    if(key === 'football' && !junior && participantIds(event).includes('team:football:socceroos')) return true;
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
    if(key==='motogp')return !isPractice(event)&&/race|sprint|qualifying|grand prix/i.test([event.sessionType,event.name].join(' '));
    if(key==='sailgp')return !isPractice(event);
    if(key==='lemans'&&event.lemansCalendar===true)return ['qualifying','hyperpole','race-start','race-finish'].includes(event.sessionType)&&Boolean(event.calendarProvenance?.sourceUrl);
    if(key==='dakar'&&event.dakarCalendar===true)return ['prologue','stage'].includes(event.sessionType)&&Boolean(event.calendarProvenance?.sourceUrl);
    if(key==='wsl'&&event.competitionId==='competition:wsl-championship-tour')return event.sessionType==='event-window'&&Boolean(event.calendarProvenance?.sourceUrl);
    if(['tdf','giro','vuelta'].includes(key)&&event.grandTourCalendar===true)return event.sessionType==='stage'&&Boolean(event.calendarProvenance?.sourceUrl);
    const f1 = /^competition:(?:formula-one|f1)(?:[:-]\d{4})?$/.test(competition) || key === "f1";
    return f1 && !isPractice(event);
  }

  function isPractice(event){
    return /\b(?:practice|fp[123]|warm[ -]?up|testing|test session)\b/i.test([event?.sessionType,event?.stage,event?.name].filter(Boolean).join(" "));
  }

  function feedEligibleSession(event){
    if(sportKey(event)==='dakar'&&event.dakarCalendar===true&&!(['stage','prologue'].includes(event.sessionType)))return false;
    return !(["f1","motogp","lemans"].includes(sportKey(event)) && isPractice(event));
  }

  function isFinalsOrKnockout(event){
    const key=sportKey(event);
    if (['golf','golf-women','masters'].includes(key) || aggregateEvent(event)) return false;
    if(key.startsWith('tennis'))return tennisModel().isFinal(event);
    if(event?.isFinals===true || event?.isKnockout===true || event?.knockout===true)return true;
    // A competition name such as ATP Finals is not evidence of a knockout stage.
    const stage=[event?.stage,event?.round,event?.roundLabel].filter(Boolean).join(' ');
    return /\b(finals?|semi[- ]?finals?|quarter[- ]?finals?|preliminary final|eliminat(?:ion|or)|qualifying final|knockout|play[- ]?offs?|grand final)\b/i.test(stage);
  }

  function participantFeedEligible(event){
    if(!activeEligible(event))return false;
    if(!sportKey(event).startsWith('tennis')||participantIds(event).some(id=>id.startsWith('team:')))return true;
    return /500|1000|grand.?slam|major|masters|team|davis|billie|bjk|finals/i.test([event.tournamentLevel,event.level,event.category,event.competitionCategory].filter(Boolean).join(' '));
  }
  function eligibleForFollow(event,{competitionFollow=false,participantFollow=false,explicitSelection=false,explicitEventFollow=false,sportFollow=false,australiansOnly=false,australianDiscovery=false,muted=false}={}){
    if(event.universeOnly || !activeEligible(event) || !hasPublishedFixture(event) || aggregateEvent(event) && !multiDayMarker(event) || !feedEligibleSession(event))return false;
    if(muted)return false;
    if(explicitSelection)return true;
    if(['golf','golf-women','masters'].includes(sportKey(event))){
      if(event.cardType!=='golf_session'&&event.participantsConfirmed===true&&(participantFollow||competitionFollow&&australiansOnly&&hasAustralianParticipant(event)))return true;
      // Retain the tournament identity for pins and confirmed golfer entries.
      // Broad Golf already receives its published rounds, without a fifth card.
      if(event.golfMajorOverview===true)return false;
      return presidentsCup(event)?(explicitEventFollow||competitionFollow&&event.tournamentParent===true):competitionFollow&&golfMajor(event)&&(!australiansOnly||hasAustralianParticipant(event));
    }
    if(participantFollow&&participantFeedEligible(event))return true;
    if(sportFollow && (!sportKey(event).startsWith('tennis')||event.contestUnit==='tie') && isFinalsOrKnockout(event))return true;
    if(!sportingFixture(event))return false;
    if(sportKey(event)==="f1" && competitionFollow)return true;
    if(sportKey(event).startsWith("tennis"))return event.contestUnit==='tie'&&competitionFollow&&tennisModel().isFinal(event);
    if(explicitEventFollow)return isMarquee(event);
    if(["cricket","rugby"].includes(sportKey(event)))return false;
    if(australiansOnly && australiansFilterUseful(event))return competitionFollow && hasAustralianParticipant(event);
    if(australianDiscovery && hasAustralianParticipant(event))return true;
    return Boolean(competitionFollow && isMarquee(event));
  }

  function followedFixtureDecision(event, { followed = false, followSource = "sport", now = new Date(), timeZone = SYDNEY_TIME_ZONE } = {}){
    if (!followed || !hasPublishedFixture(event) || aggregateEvent(event) && !multiDayMarker(event) || !feedEligibleSession(event)) return { mode:"ineligible", include:false, label:"Add to Feed" };
    if (["team", "athlete", "collection", "entity", "australians", "competition"].includes(String(followSource || ""))){
      return participantFeedEligible(event)?{ mode:"direct", include:true, label:"In Feed via follow" }:{mode:"manual",include:false,label:"Add to Feed"};
    }
    if (eligibleForFollow(event,{competitionFollow:true})) return { mode:"immediate", include:true, label:"In Feed via follow" };
    return { mode:"manual", include:false, label:"Add to Feed" };
  }

  return Object.freeze({ SCHEMA_VERSION, SYDNEY_TIME_ZONE, presidentsCup, golfMajor, aggregateEvent, explicitCompetitionRequired, effectiveDomainPreferences, eventFamilyIds, editionKey, editionDecision, eventExcluded, activeEligible, scheduleVisible, multiDayMarker, explicitlyExcluded, dateKey, hasReleasedMatchup, hasPublishedFixture, sportingFixture, sportKey, isChampionshipMarquee, isPractice, feedEligibleSession, participantIds, stakesScore, isFinalsOrKnockout, isMarquee, australiansFilterUseful, hasAustralianParticipant, eligibleForFollow, participantFeedEligible, followedFixtureDecision });
});
