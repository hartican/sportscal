(function attachNothingSportsSportHubs(root, factory){
  const api = factory();
  root.NOTHINGSPORTS_SPORT_HUBS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildNothingSportsSportHubs(){
  "use strict";

  const SUPPORTED_SPORTS = Object.freeze({
    afl: Object.freeze({
      key: "afl",
      domainId: "sport:afl",
      competitionId: "competition:afl-premiership-2026",
      label: "AFL",
    }),
    nrl: Object.freeze({
      key: "nrl",
      domainId: "sport:nrl",
      competitionId: "competition:nrl-premiership-2026",
      label: "NRL",
    }),
  });

  function clone(value){
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function sportConfig(value){
    const normalized = String(value || "").replace(/^sport:/, "");
    return SUPPORTED_SPORTS[normalized] || null;
  }

  function isSupportedSport(value){
    return Boolean(sportConfig(value));
  }

  function canonicalFixturesForSport(bundle, sportValue){
    const sport = sportConfig(sportValue);
    if (!sport) return [];
    return (Array.isArray(bundle?.events) ? bundle.events : [])
      .filter(event => event?.sportDomainId === sport.domainId)
      .filter(event => Number.isInteger(Number(event.roundNumber)))
      .map(clone)
      .sort(compareFixtures);
  }

  function compareFixtures(first, second){
    const roundDifference = Number(first?.roundNumber || 0) - Number(second?.roundNumber || 0);
    if (roundDifference) return roundDifference;
    const firstTime = Date.parse(first?.startTimeUtc || "");
    const secondTime = Date.parse(second?.startTimeUtc || "");
    if (Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime !== secondTime) return firstTime - secondTime;
    if (Number.isFinite(firstTime)) return -1;
    if (Number.isFinite(secondTime)) return 1;
    return String(first?.displayName || "").localeCompare(String(second?.displayName || ""), "en-AU");
  }

  function fixtureIsFinished(fixture){
    return ["completed", "cancelled", "abandoned"].includes(String(fixture?.status || fixture?.result?.status || ""));
  }

  function supportedRounds(fixtures){
    const byNumber = new Map();
    (Array.isArray(fixtures) ? fixtures : []).forEach(fixture => {
      const roundNumber = Number(fixture?.roundNumber);
      if (!Number.isInteger(roundNumber) || byNumber.has(roundNumber)) return;
      byNumber.set(roundNumber, {
        roundNumber,
        roundLabel: fixture.roundLabel || `Round ${roundNumber}`,
      });
    });
    return Array.from(byNumber.values()).sort((first, second) => first.roundNumber - second.roundNumber);
  }

  function currentRoundNumber(fixtures){
    const rounds = supportedRounds(fixtures);
    const unfinished = rounds.find(round => (
      fixtures.some(fixture => Number(fixture.roundNumber) === round.roundNumber && !fixtureIsFinished(fixture))
    ));
    if (unfinished) return unfinished.roundNumber;
    const completed = rounds.filter(round => (
      fixtures.some(fixture => Number(fixture.roundNumber) === round.roundNumber && fixtureIsFinished(fixture))
    ));
    return completed.at(-1)?.roundNumber ?? rounds.at(-1)?.roundNumber ?? null;
  }

  function latestCompletedRoundNumber(fixtures){
    return supportedRounds(fixtures)
      .filter(round => fixtures.some(fixture => Number(fixture.roundNumber) === round.roundNumber && fixtureIsFinished(fixture)))
      .at(-1)?.roundNumber ?? null;
  }

  function normalizeSelectedRound(fixtures, requestedRoundNumber, fallbackRoundNumber = currentRoundNumber(fixtures)){
    const rounds = supportedRounds(fixtures);
    const hasRequestedRound = requestedRoundNumber !== null
      && requestedRoundNumber !== undefined
      && requestedRoundNumber !== "";
    const requested = hasRequestedRound ? Number(requestedRoundNumber) : null;
    if (Number.isInteger(requested) && rounds.some(round => round.roundNumber === requested)) return requested;
    if (rounds.some(round => round.roundNumber === fallbackRoundNumber)) return fallbackRoundNumber;
    return rounds[0]?.roundNumber ?? null;
  }

  function moveRoundNumber(fixtures, selectedRoundNumber, direction){
    const rounds = supportedRounds(fixtures);
    const normalized = normalizeSelectedRound(fixtures, selectedRoundNumber);
    const currentIndex = rounds.findIndex(round => round.roundNumber === normalized);
    if (currentIndex < 0) return null;
    const nextIndex = Math.max(0, Math.min(rounds.length - 1, currentIndex + Math.sign(Number(direction) || 0)));
    return rounds[nextIndex]?.roundNumber ?? normalized;
  }

  function roundWindow(fixtures, selectedRoundNumber, size = 2){
    const rounds = supportedRounds(fixtures);
    const normalized = normalizeSelectedRound(fixtures, selectedRoundNumber);
    const startIndex = rounds.findIndex(round => round.roundNumber === normalized);
    if (startIndex < 0) return [];
    return rounds.slice(startIndex, startIndex + Math.max(1, Number(size) || 1));
  }

  function fixturesForRoundWindow(fixtures, selectedRoundNumber, size = 2){
    const roundNumbers = new Set(roundWindow(fixtures, selectedRoundNumber, size).map(round => round.roundNumber));
    return (Array.isArray(fixtures) ? fixtures : [])
      .filter(fixture => roundNumbers.has(Number(fixture.roundNumber)))
      .slice()
      .sort(compareFixtures);
  }

  function sydneyDateTime(startTimeUtc){
    if (!startTimeUtc) return { date: null, time: null };
    const date = new Date(startTimeUtc);
    if (!Number.isFinite(date.getTime())) return { date: null, time: null };
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  function broadcasterNames(fixture, capability = "live"){
    return Array.from(new Set((Array.isArray(fixture?.broadcasters) ? fixture.broadcasters : [])
      .filter(broadcaster => capability ? broadcaster?.[capability] === true : true)
      .map(broadcaster => broadcaster?.broadcasterName)
      .filter(Boolean)));
  }

  function feedCardByCanonicalId(feedEvents){
    const index = new Map();
    (Array.isArray(feedEvents) ? feedEvents : []).forEach(event => {
      const canonicalEventId = event?.canonicalEventId;
      if (canonicalEventId && !index.has(canonicalEventId)) index.set(canonicalEventId, event);
    });
    return index;
  }

  function participantById(participants){
    return new Map((Array.isArray(participants) ? participants : [])
      .filter(participant => participant?.id)
      .map(participant => [participant.id, participant]));
  }

  function canonicalFixtureView(fixture, { feedCards, participants } = {}){
    if (!fixture?.id) return null;
    const sport = sportConfig(fixture.sportDomainId);
    if (!sport) return null;
    const cardIndex = feedCards instanceof Map ? feedCards : feedCardByCanonicalId(feedCards);
    const participantIndex = participants instanceof Map ? participants : participantById(participants);
    const feedCard = cardIndex.get(fixture.id) || null;
    const home = participantIndex.get(fixture.homeParticipantId);
    const away = participantIndex.get(fixture.awayParticipantId);
    const start = sydneyDateTime(fixture.startTimeUtc);
    const liveProviders = broadcasterNames(fixture, "live");
    const replayProviders = broadcasterNames(fixture, "replay");
    const mergedEvent = {
      ...(feedCard ? clone(feedCard) : {}),
      id: feedCard?.id || fixture.id,
      eventId: feedCard?.eventId || fixture.id,
      canonicalEventId: fixture.id,
      key: sport.key,
      sport: sport.label,
      sportDomainId: sport.domainId,
      competitionId: fixture.competitionId,
      name: fixture.displayName,
      displayTitleCompact: fixture.displayName,
      date: start.date,
      time: start.time,
      startTimeUtc: fixture.startTimeUtc,
      status: fixtureIsFinished(fixture) ? "completed" : "upcoming",
      scheduleStatus: fixture.scheduleStatus,
      roundNumber: Number(fixture.roundNumber),
      roundLabel: fixture.roundLabel,
      venue: [fixture.venueName, fixture.venueCity].filter(Boolean).join(", ") || null,
      participantIds: clone(fixture.participantIds || []),
      homeParticipantId: fixture.homeParticipantId,
      awayParticipantId: fixture.awayParticipantId,
      participants: [
        { name: home?.displayName || home?.shortName || "Home team", role: "home" },
        { name: away?.displayName || away?.shortName || "Away team", role: "away" },
      ],
      broadcaster: liveProviders.join(" / ") || "Broadcaster TBC",
      broadcastOptions: liveProviders,
      broadcasterIds: (fixture.broadcasters || []).map(item => String(item.broadcasterId || "").replace(/^broadcaster:/, "")).filter(Boolean),
      canonicalResultScoreline: fixture.result?.scorelineText || null,
      score: fixture.result?.scorelineText || null,
    };
    return {
      canonicalEvent: clone(fixture),
      feedCard: feedCard ? clone(feedCard) : null,
      event: mergedEvent,
      liveProviders,
      replayProviders,
      isFinished: fixtureIsFinished(fixture),
    };
  }

  function buildFixtureViews(fixtures, options = {}){
    const cardIndex = feedCardByCanonicalId(options.feedCards);
    const participantIndex = participantById(options.participants);
    return (Array.isArray(fixtures) ? fixtures : [])
      .map(fixture => canonicalFixtureView(fixture, { feedCards: cardIndex, participants: participantIndex }))
      .filter(Boolean);
  }

  function fixtureIsMuted(fixtureOrView, mutedParticipantIds){
    const fixture = fixtureOrView?.canonicalEvent || fixtureOrView;
    const muted = mutedParticipantIds instanceof Set ? mutedParticipantIds : new Set(mutedParticipantIds || []);
    return (fixture?.participantIds || []).some(participantId => muted.has(participantId));
  }

  function partitionMutedFixtures(fixtures, mutedParticipantIds, { showHidden = false } = {}){
    const source = Array.isArray(fixtures) ? fixtures : [];
    const visible = [];
    const hidden = [];
    source.forEach(fixture => {
      if (fixtureIsMuted(fixture, mutedParticipantIds)) hidden.push(fixture);
      else visible.push(fixture);
    });
    return {
      visible: showHidden ? source.slice() : visible,
      hidden,
      hiddenCount: hidden.length,
    };
  }

  return Object.freeze({
    SUPPORTED_SPORTS,
    broadcasterNames,
    buildFixtureViews,
    canonicalFixtureView,
    canonicalFixturesForSport,
    currentRoundNumber,
    fixtureIsFinished,
    fixtureIsMuted,
    fixturesForRoundWindow,
    isSupportedSport,
    latestCompletedRoundNumber,
    moveRoundNumber,
    normalizeSelectedRound,
    partitionMutedFixtures,
    roundWindow,
    sportConfig,
    supportedRounds,
  });
});
